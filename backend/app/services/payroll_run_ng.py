"""
Nigerian statutory payroll run — ties per-employee compensation to the statutory
engine and persists a complete, legally-structured payslip (PaySalary + line items).

This is the Phase-1 replacement path for PERMANENT staff. It deliberately does not
touch the legacy structure-based `PayrollService.calculate_salary` (which hardcoded
a ₦20,000 basic and could not compute tax); instead it builds gross from the
employee's own Basic/Housing/Transport/other and applies PAYE/pension/NHF correctly.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy import or_, extract, func
from sqlalchemy.orm import Session

from ..models.payroll import (
    PayPeriod, PaySalary, PaySalaryItem, PayLoan, PayLoanStatus,
    PayEmployeeCompensation, PayItemType, PayCalcStatus,
)
from ..models.personnel import Personnel
from .payroll_statutory_ng import compute_statutory, compute_statutory_cumulative, StatutoryConfig


def get_active_compensation(db: Session, emp_id: int, on: date) -> Optional[PayEmployeeCompensation]:
    """Most recent active compensation row effective for the given date."""
    return (
        db.query(PayEmployeeCompensation)
        .filter(
            PayEmployeeCompensation.emp_id == emp_id,
            PayEmployeeCompensation.is_active == True,  # noqa: E712
            or_(PayEmployeeCompensation.effective_date.is_(None),
                PayEmployeeCompensation.effective_date <= on),
            or_(PayEmployeeCompensation.end_date.is_(None),
                PayEmployeeCompensation.end_date >= on),
        )
        .order_by(PayEmployeeCompensation.effective_date.desc().nullslast())
        .first()
    )


def _active_loan_emi(db: Session, emp_id: int) -> List[Dict]:
    loans = db.query(PayLoan).filter(
        PayLoan.emp_id == emp_id, PayLoan.status == PayLoanStatus.ACTIVE
    ).all()
    out = []
    for ln in loans:
        emi = min(Decimal(str(ln.emi_amount)), Decimal(str(ln.balance)))
        if emi > 0:
            out.append({"name": f"Loan EMI — {ln.loan_type}", "value": emi, "loan_id": ln.id})
    return out


def _ytd_prior(db: Session, emp_id: int, tax_year: int, before_month: int) -> Dict:
    """Sum the employee's prior periods THIS tax year (months < before_month):
    gross + the Pension/NHF/PAYE already deducted — feeds cumulative PAYE."""
    prior = (
        db.query(PaySalary).join(PayPeriod, PaySalary.period_id == PayPeriod.id)
        .filter(PaySalary.emp_id == emp_id,
                extract("year", PayPeriod.start_date) == tax_year,
                extract("month", PayPeriod.start_date) < before_month)
        .all()
    )
    gross = sum((Decimal(str(s.gross_salary or 0)) for s in prior), Decimal("0"))
    sums = {"Pension (8%)": Decimal("0"), "NHF (2.5%)": Decimal("0"), "PAYE": Decimal("0")}
    if prior:
        rows = (
            db.query(PaySalaryItem.item_name, func.coalesce(func.sum(PaySalaryItem.item_value), 0))
            .filter(PaySalaryItem.salary_id.in_([s.id for s in prior]),
                    PaySalaryItem.item_name.in_(list(sums.keys())))
            .group_by(PaySalaryItem.item_name).all()
        )
        for name, total in rows:
            sums[name] = Decimal(str(total))
    return {"gross": gross, "pension": sums["Pension (8%)"],
            "nhf": sums["NHF (2.5%)"], "paye": sums["PAYE"]}


def run_employee_payroll(db: Session, period_id: int, emp_id: int,
                         actor_id: Optional[int] = None,
                         cfg: Optional[StatutoryConfig] = None,
                         use_cumulative: bool = True) -> Dict:
    """Compute + persist a statutory payslip for one employee/period."""
    result: Dict = {"success": False, "error": None}

    period = db.query(PayPeriod).filter(PayPeriod.id == period_id).first()
    if not period:
        result["error"] = "Pay period not found"
        return result
    emp = db.query(Personnel).filter(Personnel.id == emp_id).first()
    if not emp:
        result["error"] = "Employee not found"
        return result

    comp = get_active_compensation(db, emp_id, period.start_date)
    if not comp:
        result["error"] = "No compensation configured for this employee"
        return result

    cfg = cfg or StatutoryConfig()
    cfg.nhf_enabled = bool(comp.nhf_enabled)

    if use_cumulative:
        m = period.start_date.month
        ytd = _ytd_prior(db, emp_id, period.start_date.year, m)
        st = compute_statutory_cumulative(
            basic=comp.basic, housing=comp.housing, transport=comp.transport,
            other_taxable=comp.other_allowances, nhis=comp.nhis,
            life_assurance=comp.life_assurance, months_elapsed=m,
            ytd_gross_prior=ytd["gross"], ytd_pension_prior=ytd["pension"],
            ytd_nhf_prior=ytd["nhf"], ytd_paye_prior=ytd["paye"], cfg=cfg,
        )
    else:
        st = compute_statutory(
            basic=comp.basic, housing=comp.housing, transport=comp.transport,
            other_taxable=comp.other_allowances, nhis=comp.nhis,
            life_assurance=comp.life_assurance, cfg=cfg,
        )

    # Build line items: earnings from comp components, deductions from statutory + loans
    earnings = [
        ("Basic", Decimal(str(comp.basic))),
        ("Housing Allowance", Decimal(str(comp.housing))),
        ("Transport Allowance", Decimal(str(comp.transport))),
        ("Other Allowances", Decimal(str(comp.other_allowances))),
    ]
    deductions = [
        ("Pension (8%)", st.pension_employee),
        ("NHF (2.5%)", st.nhf),
        ("PAYE", st.paye),
    ]
    loan_lines = _active_loan_emi(db, emp_id)
    for ln in loan_lines:
        deductions.append((ln["name"], ln["value"]))

    total_earnings = sum((v for _, v in earnings), Decimal("0"))
    total_deductions = sum((v for _, v in deductions), Decimal("0"))
    net = total_earnings - total_deductions

    # Upsert PaySalary
    salary = db.query(PaySalary).filter(
        PaySalary.period_id == period_id, PaySalary.emp_id == emp_id
    ).first()
    if salary:
        db.query(PaySalaryItem).filter(PaySalaryItem.salary_id == salary.id).delete()
    else:
        salary = PaySalary(period_id=period_id, emp_id=emp_id)
        db.add(salary)
        db.flush()

    salary.basic_salary = Decimal(str(comp.basic))
    salary.gross_salary = total_earnings
    salary.total_earnings = total_earnings
    salary.total_deductions = total_deductions
    salary.net_salary = net
    salary.calc_status = PayCalcStatus.CALCULATED
    salary.calc_time = datetime.utcnow()
    salary.calc_by = actor_id

    seq = 0
    for name, val in earnings:
        seq += 1
        db.add(PaySalaryItem(salary_id=salary.id, item_name=name, item_value=val,
                             item_type=PayItemType.EARNING, calculation_order=seq))
    for name, val in deductions:
        seq += 1
        db.add(PaySalaryItem(salary_id=salary.id, item_name=name, item_value=val,
                             item_type=PayItemType.DEDUCTION, calculation_order=seq))

    db.commit()

    result.update({
        "success": True,
        "salary_id": salary.id,
        "employee": {"id": emp.id, "emp_code": getattr(emp, "emp_code", None)},
        "period": {"id": period.id, "name": period.period_name},
        "currency": comp.currency,
        "earnings": [{"name": n, "amount": float(v)} for n, v in earnings],
        "deductions": [{"name": n, "amount": float(v)} for n, v in deductions],
        "totals": {
            "gross": float(total_earnings),
            "total_deductions": float(total_deductions),
            "net": float(net),
        },
        "statutory": st.as_dict(),
    })
    return result


def run_period_payroll(db: Session, period_id: int, actor_id: Optional[int] = None,
                       use_cumulative: bool = True) -> Dict:
    """Bulk run: process every active employee that has compensation configured."""
    period = db.query(PayPeriod).filter(PayPeriod.id == period_id).first()
    if not period:
        return {"success": False, "error": "Pay period not found"}

    emp_ids = [r[0] for r in db.query(PayEmployeeCompensation.emp_id)
               .filter(PayEmployeeCompensation.is_active == True).distinct().all()]  # noqa: E712

    processed, failed, errors = 0, 0, []
    totals = {"gross": 0.0, "paye": 0.0, "pension_emp": 0.0, "nhf": 0.0, "net": 0.0}
    for emp_id in emp_ids:
        res = run_employee_payroll(db, period_id, emp_id, actor_id, use_cumulative=use_cumulative)
        if res.get("success"):
            processed += 1
            totals["gross"] += res["totals"]["gross"]
            totals["net"] += res["totals"]["net"]
            totals["paye"] += res["statutory"]["employee_deductions"]["paye"]
            totals["pension_emp"] += res["statutory"]["employee_deductions"]["pension"]
            totals["nhf"] += res["statutory"]["employee_deductions"]["nhf"]
        else:
            failed += 1
            errors.append({"emp_id": emp_id, "error": res.get("error")})
    return {"success": True, "period_id": period_id, "processed": processed,
            "failed": failed, "errors": errors, "totals": totals}


# ── Statutory remittance schedules (what a large org files/pays monthly) ────────
def _period_salaries(db: Session, period_id: int):
    """One row per salary, each paired with the SINGLE compensation effective for
    the period (resolved via effective dating — never the all-active join, which
    would duplicate employees who have superseded compensation rows)."""
    period = db.query(PayPeriod).filter(PayPeriod.id == period_id).first()
    on = period.start_date if period else None
    salaries = (
        db.query(PaySalary, Personnel)
        .join(Personnel, PaySalary.emp_id == Personnel.id)
        .filter(PaySalary.period_id == period_id).all()
    )
    return [(sal, get_active_compensation(db, sal.emp_id, on) if on else None, emp)
            for sal, emp in salaries]


def _item_value(db: Session, salary_id: int, name: str) -> float:
    v = (db.query(func.coalesce(func.sum(PaySalaryItem.item_value), 0))
         .filter(PaySalaryItem.salary_id == salary_id, PaySalaryItem.item_name == name).scalar())
    return float(v or 0)


def build_schedule(db: Session, period_id: int, kind: str) -> Dict:
    """kind = 'bank' | 'paye' | 'pension'. Returns rows + totals for remittance."""
    rows, total = [], 0.0
    for sal, comp, emp in _period_salaries(db, period_id):
        code = getattr(emp, "emp_code", None)
        name = getattr(emp, "full_name", None) or getattr(emp, "first_name", "")
        if kind == "bank":
            amt = float(sal.net_salary or 0)
            rows.append({"emp_code": code, "name": name,
                         "bank": getattr(comp, "bank_name", None),
                         "account_no": getattr(comp, "bank_account_no", None),
                         "amount": amt})
        elif kind == "paye":
            amt = _item_value(db, sal.id, "PAYE")
            rows.append({"emp_code": code, "name": name,
                         "tin": getattr(comp, "tin", None),
                         "tax_state": getattr(comp, "tax_state", None),
                         "gross": float(sal.gross_salary or 0), "paye": amt})
        elif kind == "pension":
            emp_p = _item_value(db, sal.id, "Pension (8%)")
            base = float((comp.basic + comp.housing + comp.transport)) if comp else 0.0
            empr_p = round(base * 0.10, 2)
            amt = emp_p + empr_p
            rows.append({"emp_code": code, "name": name,
                         "rsa_pin": getattr(comp, "rsa_pin", None),
                         "pfa": getattr(comp, "pfa_name", None),
                         "employee": emp_p, "employer": empr_p, "total": amt})
        else:
            return {"error": f"unknown schedule kind: {kind}"}
        total += amt
    return {"period_id": period_id, "kind": kind, "count": len(rows),
            "total": round(total, 2), "rows": rows}
