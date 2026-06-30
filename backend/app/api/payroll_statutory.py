"""
Nigerian statutory payroll API — PAYE / pension / NHF / NSITF / ITF.

Exposes the pure statutory engine for preview/validation so HR can see a legally
correct breakdown for any salary before it's wired into the full payroll run.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.payroll import PayEmployeeCompensation
from ..services.payroll_statutory_ng import compute_statutory, StatutoryConfig
from ..services.payroll_run_ng import (
    run_employee_payroll, run_period_payroll, get_active_compensation, build_schedule,
    _transition,
)
from ..services.payroll_payslip_ng import generate_payslip_pdf

router = APIRouter(prefix="/api/v1/payroll/statutory", tags=["Payroll Statutory (NG)"])


class StatutoryPreviewRequest(BaseModel):
    basic: float = Field(..., ge=0, description="Monthly basic salary")
    housing: float = Field(0, ge=0, description="Monthly housing allowance")
    transport: float = Field(0, ge=0, description="Monthly transport allowance")
    other_taxable: float = Field(0, ge=0, description="Other monthly taxable cash emoluments")
    nhis: float = Field(0, ge=0, description="Monthly NHIS contribution (PAYE-relievable)")
    life_assurance: float = Field(0, ge=0, description="Monthly life-assurance premium (PAYE-relievable)")
    # Optional rate overrides (else statutory defaults apply)
    nhf_enabled: Optional[bool] = None
    pension_employee_pct: Optional[float] = None
    pension_employer_pct: Optional[float] = None


@router.get("/config", summary="Current statutory parameters (bands, rates, reliefs)")
def get_config():
    cfg = StatutoryConfig()
    return {
        "paye_bands": [
            {"width": ("∞" if str(w) == "Infinity" else float(w)), "rate": float(r)}
            for w, r in cfg.paye_bands
        ],
        "cra": {"fixed_min": float(cfg.cra_fixed_min),
                "gross_pct": float(cfg.cra_gross_pct),
                "extra_pct": float(cfg.cra_extra_pct)},
        "minimum_tax_pct": float(cfg.minimum_tax_pct),
        "pension": {"employee_pct": float(cfg.pension_employee_pct),
                    "employer_pct": float(cfg.pension_employer_pct)},
        "nhf_pct": float(cfg.nhf_pct),
        "nsitf_pct": float(cfg.nsitf_pct),
        "itf_pct": float(cfg.itf_pct),
        "disclaimer": "Defaults reflect PITA bands + PRA 2014; confirm current rates "
                      "with a tax consultant before go-live.",
    }


@router.post("/preview", summary="Compute a full statutory breakdown for a salary")
def preview(body: StatutoryPreviewRequest):
    cfg = StatutoryConfig()
    from decimal import Decimal
    if body.nhf_enabled is not None:
        cfg.nhf_enabled = body.nhf_enabled
    if body.pension_employee_pct is not None:
        cfg.pension_employee_pct = Decimal(str(body.pension_employee_pct))
    if body.pension_employer_pct is not None:
        cfg.pension_employer_pct = Decimal(str(body.pension_employer_pct))

    res = compute_statutory(
        basic=body.basic, housing=body.housing, transport=body.transport,
        other_taxable=body.other_taxable, nhis=body.nhis,
        life_assurance=body.life_assurance, cfg=cfg,
    )
    return res.as_dict()


class CompensationRequest(BaseModel):
    basic: float = Field(..., ge=0)
    housing: float = 0
    transport: float = 0
    other_allowances: float = 0
    nhis: float = 0
    life_assurance: float = 0
    grade: Optional[str] = None
    nhf_enabled: bool = True
    tin: Optional[str] = None
    rsa_pin: Optional[str] = None
    pfa_name: Optional[str] = None
    nhf_number: Optional[str] = None
    tax_state: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    effective_date: Optional[str] = None


@router.put("/compensation/{emp_id}", summary="Set/replace an employee's compensation")
def set_compensation(emp_id: int, body: CompensationRequest, db: Session = Depends(get_db)):
    """Effective-dated: supersedes the employee's current active compensation row."""
    db.query(PayEmployeeCompensation).filter(
        PayEmployeeCompensation.emp_id == emp_id,
        PayEmployeeCompensation.is_active == True,  # noqa: E712
    ).update({"is_active": False})
    comp = PayEmployeeCompensation(emp_id=emp_id, **body.model_dump())
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return {"id": comp.id, "emp_id": emp_id, "basic": float(comp.basic),
            "gross_components": float(comp.basic + comp.housing + comp.transport + comp.other_allowances)}


@router.get("/compensation/{emp_id}", summary="Current active compensation for an employee")
def get_compensation(emp_id: int, db: Session = Depends(get_db)):
    from datetime import date as _date
    comp = get_active_compensation(db, emp_id, _date.today())
    if not comp:
        raise HTTPException(status_code=404, detail="No active compensation for employee")
    return {
        "id": comp.id, "emp_id": emp_id, "currency": comp.currency, "grade": comp.grade,
        "basic": float(comp.basic), "housing": float(comp.housing),
        "transport": float(comp.transport), "other_allowances": float(comp.other_allowances),
        "nhf_enabled": comp.nhf_enabled, "tin": comp.tin, "rsa_pin": comp.rsa_pin,
        "bank_name": comp.bank_name, "bank_account_no": comp.bank_account_no,
    }


@router.post("/run", summary="Compute + persist a statutory payslip for one employee")
def run(period_id: int, emp_id: int, cumulative: bool = True,
        db: Session = Depends(get_db), user=Depends(get_current_user)):
    res = run_employee_payroll(db, period_id, emp_id, actor_id=user.id, use_cumulative=cumulative)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error"))
    return res


@router.post("/run/bulk", summary="Run payroll for all employees with compensation")
def run_bulk(period_id: int, cumulative: bool = True,
             db: Session = Depends(get_db), user=Depends(get_current_user)):
    res = run_period_payroll(db, period_id, actor_id=user.id, use_cumulative=cumulative)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error"))
    return res


@router.get("/schedule/{kind}", summary="Remittance schedule: kind = bank | paye | pension")
def schedule(kind: str, period_id: int, db: Session = Depends(get_db)):
    if kind not in ("bank", "paye", "pension"):
        raise HTTPException(status_code=400, detail="kind must be bank, paye or pension")
    return build_schedule(db, period_id, kind)


@router.get("/payslip/{salary_id}/pdf", summary="Download a payslip PDF")
def payslip_pdf(salary_id: int, db: Session = Depends(get_db)):
    pdf = generate_payslip_pdf(db, salary_id)
    if pdf is None:
        raise HTTPException(status_code=404, detail="Salary record not found")
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="payslip_{salary_id}.pdf"'})


# ── Maker-checker approval (segregation of duties enforced) ──────────────────────
@router.post("/payslip/{salary_id}/verify", summary="Verify a calculated payslip (checker)")
def verify(salary_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    res = _transition(db, salary_id, user.id, "verify")
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["error"])
    return res


@router.post("/payslip/{salary_id}/approve", summary="Approve + lock a verified payslip")
def approve(salary_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    res = _transition(db, salary_id, user.id, "approve")
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["error"])
    return res


@router.post("/payslip/{salary_id}/reopen", summary="Reopen an approved/verified payslip")
def reopen(salary_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    res = _transition(db, salary_id, user.id, "reopen")
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["error"])
    return res
