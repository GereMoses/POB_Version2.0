"""
Nigerian statutory payroll engine — PAYE, Pension, NHF, NSITF, ITF.

WHY THIS EXISTS
---------------
The base payroll service can only sum fixed/attendance items; it has no concept of
graduated income tax, pension, or housing-fund deductions, which are mandatory for a
registered Nigerian employer. This module is a pure, fully-tested calculation core
(no DB, no side effects) so the figures can be unit-tested and audited in isolation,
then called from the payroll run.

STATUTORY BASIS (verify against current law before go-live — rates change with each
Finance Act; this set reflects the long-standing PITA bands + PRA 2014 pension):
  • PAYE: annualised, Consolidated Relief Allowance (CRA) + tax-deductible reliefs,
    graduated bands, with a 1%-of-gross minimum tax floor.
  • Pension (PRA 2014): employee 8% + employer 10% of Basic+Housing+Transport.
  • NHF: 2.5% of basic salary.
  • NSITF: 1% of total emolument — employer cost.
  • ITF: 1% of annual payroll — employer cost, company-level.

ALL RATES ARE DATA-DRIVEN (see StatutoryConfig) so finance can adjust them centrally
and per effective year without touching the algorithm. Defaults are NOT authoritative
tax advice — confirm with the client's tax consultant.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Tuple

# Two-kobo rounding for money
_Q = Decimal("0.01")


def _money(x) -> Decimal:
    return Decimal(str(x)).quantize(_Q, rounding=ROUND_HALF_UP)


@dataclass
class StatutoryConfig:
    """All statutory parameters in one place. Override per client/effective-year."""
    # PAYE graduated annual bands as (width, rate). Last band width is effectively ∞.
    paye_bands: List[Tuple[Decimal, Decimal]] = field(default_factory=lambda: [
        (Decimal("300000"),  Decimal("0.07")),
        (Decimal("300000"),  Decimal("0.11")),
        (Decimal("500000"),  Decimal("0.15")),
        (Decimal("500000"),  Decimal("0.19")),
        (Decimal("1600000"), Decimal("0.21")),
        (Decimal("Infinity"), Decimal("0.24")),
    ])
    cra_fixed_min: Decimal = Decimal("200000")   # higher of this …
    cra_gross_pct: Decimal = Decimal("0.01")     # … or 1% of gross
    cra_extra_pct: Decimal = Decimal("0.20")     # plus 20% of gross
    minimum_tax_pct: Decimal = Decimal("0.01")   # 1% of gross income floor

    pension_employee_pct: Decimal = Decimal("0.08")
    pension_employer_pct: Decimal = Decimal("0.10")
    pension_relief_in_paye: bool = True          # pension reduces taxable income

    nhf_pct: Decimal = Decimal("0.025")          # of basic
    nhf_enabled: bool = True
    nhf_relief_in_paye: bool = True

    nsitf_pct: Decimal = Decimal("0.01")         # of gross — employer
    itf_pct: Decimal = Decimal("0.01")           # of gross — employer (company-level)


@dataclass
class StatutoryResult:
    gross_monthly: Decimal
    annual_gross: Decimal
    cra_annual: Decimal
    taxable_annual: Decimal
    # employee deductions (monthly)
    pension_employee: Decimal
    nhf: Decimal
    paye: Decimal
    total_statutory_deductions: Decimal
    net_monthly: Decimal
    # employer costs (monthly)
    pension_employer: Decimal
    nsitf: Decimal
    itf: Decimal
    # transparency
    paye_band_breakdown: List[Dict] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict:
        return {
            "gross_monthly": float(self.gross_monthly),
            "annual_gross": float(self.annual_gross),
            "cra_annual": float(self.cra_annual),
            "taxable_annual": float(self.taxable_annual),
            "employee_deductions": {
                "pension": float(self.pension_employee),
                "nhf": float(self.nhf),
                "paye": float(self.paye),
                "total": float(self.total_statutory_deductions),
            },
            "net_monthly": float(self.net_monthly),
            "employer_costs": {
                "pension": float(self.pension_employer),
                "nsitf": float(self.nsitf),
                "itf": float(self.itf),
            },
            "paye_band_breakdown": self.paye_band_breakdown,
            "notes": self.notes,
        }


def _apply_paye_bands(taxable_annual: Decimal, cfg: StatutoryConfig
                      ) -> Tuple[Decimal, List[Dict]]:
    """Apply graduated bands to annual taxable income → (annual tax, breakdown)."""
    tax = Decimal("0")
    remaining = taxable_annual
    breakdown: List[Dict] = []
    for width, rate in cfg.paye_bands:
        if remaining <= 0:
            break
        slice_amt = remaining if width == Decimal("Infinity") else min(remaining, width)
        band_tax = slice_amt * rate
        tax += band_tax
        breakdown.append({
            "band": f"{rate * 100:.0f}%",
            "amount_taxed": float(_money(slice_amt)),
            "tax": float(_money(band_tax)),
        })
        remaining -= slice_amt
    return tax, breakdown


def compute_statutory(
    basic: Decimal | float,
    housing: Decimal | float = 0,
    transport: Decimal | float = 0,
    other_taxable: Decimal | float = 0,
    *,
    nhis: Decimal | float = 0,           # monthly NHIS contribution (PAYE-relievable)
    life_assurance: Decimal | float = 0,  # monthly premium (PAYE-relievable)
    cfg: StatutoryConfig | None = None,
) -> StatutoryResult:
    """Compute a full monthly statutory breakdown from a salary's components.

    All inputs are MONTHLY amounts. `basic/housing/transport` form the pension base
    (Basic+Housing+Transport); `other_taxable` is any further taxable cash emolument.
    """
    cfg = cfg or StatutoryConfig()
    basic = Decimal(str(basic))
    housing = Decimal(str(housing))
    transport = Decimal(str(transport))
    other_taxable = Decimal(str(other_taxable))
    nhis = Decimal(str(nhis))
    life = Decimal(str(life_assurance))

    pension_base = basic + housing + transport
    gross_m = pension_base + other_taxable
    annual_gross = gross_m * 12

    # Statutory contributions (monthly)
    pension_emp = _money(pension_base * cfg.pension_employee_pct)
    pension_empr = _money(pension_base * cfg.pension_employer_pct)
    nhf = _money(basic * cfg.nhf_pct) if cfg.nhf_enabled else Decimal("0")

    # Consolidated Relief Allowance (annual)
    cra_annual = (max(cfg.cra_fixed_min, annual_gross * cfg.cra_gross_pct)
                  + annual_gross * cfg.cra_extra_pct)

    # Tax-deductible reliefs (annual)
    reliefs = Decimal("0")
    if cfg.pension_relief_in_paye:
        reliefs += pension_emp * 12
    if cfg.nhf_relief_in_paye:
        reliefs += nhf * 12
    reliefs += (nhis + life) * 12

    taxable_annual = annual_gross - cra_annual - reliefs
    if taxable_annual < 0:
        taxable_annual = Decimal("0")

    paye_annual, bands = _apply_paye_bands(taxable_annual, cfg)

    notes: List[str] = []
    # Minimum tax floor: 1% of gross when computed PAYE falls below it
    min_tax_annual = annual_gross * cfg.minimum_tax_pct
    if paye_annual < min_tax_annual:
        notes.append(
            f"Minimum tax of {cfg.minimum_tax_pct * 100:.0f}% of gross applied "
            f"(computed PAYE ₦{_money(paye_annual / 12)}/mo was below the floor)."
        )
        paye_annual = min_tax_annual

    paye_m = _money(paye_annual / 12)
    total_ded = _money(pension_emp + nhf + paye_m)
    net_m = _money(gross_m - total_ded)

    return StatutoryResult(
        gross_monthly=_money(gross_m),
        annual_gross=_money(annual_gross),
        cra_annual=_money(cra_annual),
        taxable_annual=_money(taxable_annual),
        pension_employee=pension_emp,
        nhf=nhf,
        paye=paye_m,
        total_statutory_deductions=total_ded,
        net_monthly=net_m,
        pension_employer=pension_empr,
        nsitf=_money(gross_m * cfg.nsitf_pct),
        itf=_money(gross_m * cfg.itf_pct),
        paye_band_breakdown=bands,
        notes=notes,
    )
