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

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models.payroll import (
    PayPeriod, PaySalary, PaySalaryItem, PayLoan, PayLoanStatus,
    PayEmployeeCompensation, PayItemType, PayCalcStatus,
)
from ..models.personnel import Personnel
from .payroll_statutory_ng import compute_statutory, StatutoryConfig


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


def run_employee_payroll(db: Session, period_id: int, emp_id: int,
                         actor_id: Optional[int] = None,
                         cfg: Optional[StatutoryConfig] = None) -> Dict:
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
