from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import re
from datetime import datetime

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.benefits_management import BenefitPlan, EmployeeBenefit
from ..models.personnel import Personnel
from ..models.user import User
from ..schemas.benefits_management import (
    BenefitPlanCreate, BenefitPlanUpdate, BenefitPlanResponse,
    EmployeeBenefitCreate, EmployeeBenefitUpdate, EmployeeBenefitResponse,
)

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────────────

def _auto_plan_code(db: Session) -> str:
    year = datetime.now().year
    last = (
        db.query(BenefitPlan)
        .filter(BenefitPlan.plan_code.like(f"BP-{year}-%"))
        .order_by(BenefitPlan.id.desc())
        .first()
    )
    seq = 1
    if last and last.plan_code:
        m = re.search(r"-(\d+)$", last.plan_code)
        if m:
            seq = int(m.group(1)) + 1
    return f"BP-{year}-{seq:04d}"


def _name(p) -> str:
    if not p:
        return ""
    return f"{getattr(p,'first_name','')} {getattr(p,'last_name','')}".strip() or str(p.id)


def _enrich_plan(plan: BenefitPlan, db: Session) -> BenefitPlan:
    plan.enrollment_count = (
        db.query(EmployeeBenefit)
        .filter(EmployeeBenefit.plan_id == plan.id, EmployeeBenefit.status == "active")
        .count()
    )
    return plan


def _enrich_enrollment(e: EmployeeBenefit, db: Session) -> EmployeeBenefit:
    p = e.personnel or (db.query(Personnel).filter(Personnel.id == e.personnel_id).first() if e.personnel_id else None)
    e.personnel_name     = _name(p)
    e.personnel_emp_code = getattr(p, "emp_code", None)
    e.personnel_type     = getattr(p, "personnel_type", None)
    e.personnel_company  = getattr(p, "company", None)

    plan = e.plan or (db.query(BenefitPlan).filter(BenefitPlan.id == e.plan_id).first() if e.plan_id else None)
    e.plan_name    = getattr(plan, "plan_name", None)
    e.benefit_type = getattr(plan, "benefit_type", None)

    deps = e.dependents
    e.dependent_count = len(deps) if isinstance(deps, list) else 0
    return e


# ── Benefit Plans ─────────────────────────────────────────────────────────────

@router.post("/benefits/plans", response_model=BenefitPlanResponse, status_code=201)
async def create_benefit_plan(
    data: BenefitPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = data.model_dump()
    if not payload.get("plan_code"):
        payload["plan_code"] = _auto_plan_code(db)
    payload["created_by"] = current_user.id
    plan = BenefitPlan(**payload)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _enrich_plan(plan, db)


@router.get("/benefits/plans/meta/summary")
async def benefit_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plans       = db.query(BenefitPlan).all()
    enrollments = db.query(EmployeeBenefit).all()

    by_type   = {}
    by_status = {}
    active_plans = 0

    for p in plans:
        bt = p.benefit_type or "other"
        by_type[bt] = by_type.get(bt, 0) + 1
        if p.is_active:
            active_plans += 1

    for e in enrollments:
        by_status[e.status] = by_status.get(e.status, 0) + 1

    return {
        "total_plans":       len(plans),
        "active_plans":      active_plans,
        "total_enrollments": len(enrollments),
        "active_enrollments": by_status.get("active", 0),
        "waived":            by_status.get("waived", 0),
        "cancelled":         by_status.get("cancelled", 0),
        "by_benefit_type":   by_type,
        "by_enrollment_status": by_status,
    }


@router.get("/benefits/plans", response_model=List[BenefitPlanResponse])
async def list_benefit_plans(
    benefit_type: Optional[str] = None,
    is_active:    Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(BenefitPlan)
    if benefit_type:
        q = q.filter(BenefitPlan.benefit_type == benefit_type)
    if is_active is not None:
        q = q.filter(BenefitPlan.is_active == is_active)
    plans = q.order_by(BenefitPlan.plan_name).offset(skip).limit(limit).all()
    return [_enrich_plan(p, db) for p in plans]


@router.get("/benefits/plans/{plan_id}", response_model=BenefitPlanResponse)
async def get_benefit_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = db.query(BenefitPlan).filter(BenefitPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Benefit plan not found")
    return _enrich_plan(plan, db)


@router.put("/benefits/plans/{plan_id}", response_model=BenefitPlanResponse)
async def update_benefit_plan(
    plan_id: int,
    data: BenefitPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = db.query(BenefitPlan).filter(BenefitPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Benefit plan not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(plan, k, v)
    db.commit()
    db.refresh(plan)
    return _enrich_plan(plan, db)


@router.delete("/benefits/plans/{plan_id}", status_code=204)
async def delete_benefit_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = db.query(BenefitPlan).filter(BenefitPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Benefit plan not found")
    active = db.query(EmployeeBenefit).filter(
        EmployeeBenefit.plan_id == plan_id, EmployeeBenefit.status == "active"
    ).count()
    if active:
        raise HTTPException(status_code=400, detail=f"Cannot delete plan with {active} active enrollment(s)")
    db.delete(plan)
    db.commit()


# ── Enrollments ───────────────────────────────────────────────────────────────

@router.post("/benefits/enrollments", response_model=EmployeeBenefitResponse, status_code=201)
async def create_enrollment(
    data: EmployeeBenefitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.query(Personnel).filter(Personnel.id == data.personnel_id).first():
        raise HTTPException(status_code=404, detail="Personnel not found")
    if not db.query(BenefitPlan).filter(BenefitPlan.id == data.plan_id).first():
        raise HTTPException(status_code=404, detail="Benefit plan not found")
    # Check duplicate active enrollment
    existing = db.query(EmployeeBenefit).filter(
        EmployeeBenefit.personnel_id == data.personnel_id,
        EmployeeBenefit.plan_id == data.plan_id,
        EmployeeBenefit.status == "active",
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Personnel is already actively enrolled in this plan")
    e = EmployeeBenefit(**data.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return _enrich_enrollment(e, db)


@router.get("/benefits/enrollments", response_model=List[EmployeeBenefitResponse])
async def list_enrollments(
    personnel_id: Optional[int] = None,
    plan_id:      Optional[int] = None,
    status:       Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(EmployeeBenefit)
    if personnel_id:
        q = q.filter(EmployeeBenefit.personnel_id == personnel_id)
    if plan_id:
        q = q.filter(EmployeeBenefit.plan_id == plan_id)
    if status:
        q = q.filter(EmployeeBenefit.status == status)
    records = q.order_by(EmployeeBenefit.created_at.desc()).offset(skip).limit(limit).all()
    return [_enrich_enrollment(r, db) for r in records]


@router.get("/benefits/enrollments/{enrollment_id}", response_model=EmployeeBenefitResponse)
async def get_enrollment(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    e = db.query(EmployeeBenefit).filter(EmployeeBenefit.id == enrollment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return _enrich_enrollment(e, db)


@router.put("/benefits/enrollments/{enrollment_id}", response_model=EmployeeBenefitResponse)
async def update_enrollment(
    enrollment_id: int,
    data: EmployeeBenefitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    e = db.query(EmployeeBenefit).filter(EmployeeBenefit.id == enrollment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(e, k, v)
    db.commit()
    db.refresh(e)
    return _enrich_enrollment(e, db)


@router.delete("/benefits/enrollments/{enrollment_id}", status_code=204)
async def delete_enrollment(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    e = db.query(EmployeeBenefit).filter(EmployeeBenefit.id == enrollment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    db.delete(e)
    db.commit()


# ── Enrollment status transitions ─────────────────────────────────────────────

@router.put("/benefits/enrollments/{enrollment_id}/waive", response_model=EmployeeBenefitResponse)
async def waive_enrollment(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    e = db.query(EmployeeBenefit).filter(EmployeeBenefit.id == enrollment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if e.status != "active":
        raise HTTPException(status_code=400, detail="Only active enrollments can be waived")
    e.status = "waived"
    db.commit()
    db.refresh(e)
    return _enrich_enrollment(e, db)


@router.put("/benefits/enrollments/{enrollment_id}/cancel", response_model=EmployeeBenefitResponse)
async def cancel_enrollment(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    e = db.query(EmployeeBenefit).filter(EmployeeBenefit.id == enrollment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if e.status == "cancelled":
        raise HTTPException(status_code=400, detail="Already cancelled")
    e.status = "cancelled"
    db.commit()
    db.refresh(e)
    return _enrich_enrollment(e, db)


@router.put("/benefits/enrollments/{enrollment_id}/reactivate", response_model=EmployeeBenefitResponse)
async def reactivate_enrollment(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    e = db.query(EmployeeBenefit).filter(EmployeeBenefit.id == enrollment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if e.status == "active":
        raise HTTPException(status_code=400, detail="Already active")
    e.status = "active"
    db.commit()
    db.refresh(e)
    return _enrich_enrollment(e, db)
