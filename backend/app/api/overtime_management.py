from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from datetime import date, datetime, timezone
from decimal import Decimal

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.overtime_management import OvertimeManagement, OvertimeRule
from ..models.personnel import Personnel
from ..schemas.overtime_management import (
    OvertimeManagementCreate, OvertimeManagementUpdate, OvertimeManagementResponse,
    OvertimeRuleCreate, OvertimeRuleUpdate, OvertimeRuleResponse,
    OvertimeApprovalRequest, OVERTIME_TYPE_CATALOGUE,
)
from ..models.user import User

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────────────

def _enrich_overtime(rec: OvertimeManagement) -> OvertimeManagement:
    if rec.personnel:
        rec.personnel_name = (
            f"{rec.personnel.first_name} {rec.personnel.last_name}".strip()
            if hasattr(rec.personnel, "first_name")
            else str(rec.personnel_id)
        )
        rec.personnel_emp_code = getattr(rec.personnel, "emp_code", None)
    else:
        rec.personnel_name = None
        rec.personnel_emp_code = None
    return rec


def _calc_hours(start_time, end_time) -> Optional[Decimal]:
    """Return total hours between two time objects, or None if either is missing."""
    if start_time is None or end_time is None:
        return None
    from datetime import timedelta
    dummy_date = date.today()
    start_dt = datetime.combine(dummy_date, start_time)
    end_dt = datetime.combine(dummy_date, end_time)
    if end_dt <= start_dt:
        return None
    delta = end_dt - start_dt
    return Decimal(str(round(delta.total_seconds() / 3600, 2)))


# ── static paths first ────────────────────────────────────────────────────────

@router.get("/overtime/types")
async def get_overtime_types(current_user: User = Depends(get_current_user)):
    return OVERTIME_TYPE_CATALOGUE


@router.get("/overtime/summary")
async def get_overtime_summary(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(OvertimeManagement)
    if year:
        q = q.filter(extract("year", OvertimeManagement.date) == year)
    if month:
        q = q.filter(extract("month", OvertimeManagement.date) == month)

    total = q.count()
    pending = q.filter(OvertimeManagement.status == "pending").count()
    approved = q.filter(OvertimeManagement.status == "approved").count()
    rejected = q.filter(OvertimeManagement.status == "rejected").count()
    total_ot_hours = db.query(func.sum(OvertimeManagement.overtime_hours)).scalar() or 0

    return {
        "total": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "total_overtime_hours": float(total_ot_hours),
    }


# ── rules (static prefix, before /{overtime_id}) ─────────────────────────────

@router.post("/overtime/rules", response_model=OvertimeRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_overtime_rule(
    rule_data: OvertimeRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rule = OvertimeRule(**rule_data.model_dump(), created_by=current_user.id)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/overtime/rules", response_model=List[OvertimeRuleResponse])
async def get_overtime_rules(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(OvertimeRule)
    if is_active is not None:
        q = q.filter(OvertimeRule.is_active == is_active)
    return q.order_by(OvertimeRule.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/overtime/rules/{rule_id}", response_model=OvertimeRuleResponse)
async def get_overtime_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rule = db.query(OvertimeRule).filter(OvertimeRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.put("/overtime/rules/{rule_id}", response_model=OvertimeRuleResponse)
async def update_overtime_rule(
    rule_id: int,
    rule_data: OvertimeRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rule = db.query(OvertimeRule).filter(OvertimeRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for field, value in rule_data.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/overtime/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_overtime_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rule = db.query(OvertimeRule).filter(OvertimeRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()


# ── overtime request CRUD ─────────────────────────────────────────────────────

@router.post("/overtime", response_model=OvertimeManagementResponse, status_code=status.HTTP_201_CREATED)
async def create_overtime_request(
    overtime_data: OvertimeManagementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    personnel = db.query(Personnel).filter(Personnel.id == overtime_data.personnel_id).first()
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")

    data = overtime_data.model_dump()

    # Auto-calculate hours_worked if times provided and not supplied
    if data.get("hours_worked") is None:
        data["hours_worked"] = _calc_hours(data.get("start_time"), data.get("end_time"))

    overtime = OvertimeManagement(**data)
    db.add(overtime)
    db.commit()
    db.refresh(overtime)
    return _enrich_overtime(overtime)


@router.get("/overtime", response_model=List[OvertimeManagementResponse])
async def get_overtime_requests(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    personnel_id: Optional[int] = None,
    status: Optional[str] = None,
    overtime_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(OvertimeManagement)
    if personnel_id:
        q = q.filter(OvertimeManagement.personnel_id == personnel_id)
    if status:
        q = q.filter(OvertimeManagement.status == status)
    if overtime_type:
        q = q.filter(OvertimeManagement.overtime_type == overtime_type)
    if start_date:
        q = q.filter(OvertimeManagement.date >= start_date)
    if end_date:
        q = q.filter(OvertimeManagement.date <= end_date)
    records = q.order_by(OvertimeManagement.created_at.desc()).offset(skip).limit(limit).all()
    return [_enrich_overtime(r) for r in records]


@router.get("/overtime/{overtime_id}", response_model=OvertimeManagementResponse)
async def get_overtime_request(
    overtime_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    overtime = db.query(OvertimeManagement).filter(OvertimeManagement.id == overtime_id).first()
    if not overtime:
        raise HTTPException(status_code=404, detail="Overtime request not found")
    return _enrich_overtime(overtime)


@router.put("/overtime/{overtime_id}", response_model=OvertimeManagementResponse)
async def update_overtime_request(
    overtime_id: int,
    overtime_data: OvertimeManagementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    overtime = db.query(OvertimeManagement).filter(OvertimeManagement.id == overtime_id).first()
    if not overtime:
        raise HTTPException(status_code=404, detail="Overtime request not found")
    if overtime.status not in ("pending",):
        raise HTTPException(status_code=400, detail="Only pending requests can be edited")

    updates = overtime_data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(overtime, field, value)

    # Re-calc hours_worked if times changed
    new_start = updates.get("start_time", overtime.start_time)
    new_end = updates.get("end_time", overtime.end_time)
    if "start_time" in updates or "end_time" in updates:
        calc = _calc_hours(new_start, new_end)
        if calc is not None:
            overtime.hours_worked = calc

    db.commit()
    db.refresh(overtime)
    return _enrich_overtime(overtime)


@router.delete("/overtime/{overtime_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_overtime_request(
    overtime_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    overtime = db.query(OvertimeManagement).filter(OvertimeManagement.id == overtime_id).first()
    if not overtime:
        raise HTTPException(status_code=404, detail="Overtime request not found")
    if overtime.status == "approved":
        raise HTTPException(status_code=400, detail="Approved requests cannot be deleted; cancel first")
    db.delete(overtime)
    db.commit()


@router.put("/overtime/{overtime_id}/approve", response_model=OvertimeManagementResponse)
async def approve_overtime(
    overtime_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    overtime = db.query(OvertimeManagement).filter(OvertimeManagement.id == overtime_id).first()
    if not overtime:
        raise HTTPException(status_code=404, detail="Overtime request not found")
    if overtime.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot approve a {overtime.status} request")
    overtime.status = "approved"
    overtime.approved_by = current_user.id
    overtime.approved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(overtime)
    return _enrich_overtime(overtime)


@router.put("/overtime/{overtime_id}/reject", response_model=OvertimeManagementResponse)
async def reject_overtime(
    overtime_id: int,
    approval_data: OvertimeApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    overtime = db.query(OvertimeManagement).filter(OvertimeManagement.id == overtime_id).first()
    if not overtime:
        raise HTTPException(status_code=404, detail="Overtime request not found")
    if overtime.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot reject a {overtime.status} request")
    overtime.status = "rejected"
    overtime.approved_by = current_user.id
    overtime.approved_at = datetime.now(timezone.utc)
    overtime.rejection_reason = approval_data.rejection_reason
    db.commit()
    db.refresh(overtime)
    return _enrich_overtime(overtime)


@router.put("/overtime/{overtime_id}/cancel", response_model=OvertimeManagementResponse)
async def cancel_overtime(
    overtime_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    overtime = db.query(OvertimeManagement).filter(OvertimeManagement.id == overtime_id).first()
    if not overtime:
        raise HTTPException(status_code=404, detail="Overtime request not found")
    if overtime.status not in ("pending", "approved"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {overtime.status} request")
    overtime.status = "cancelled"
    db.commit()
    db.refresh(overtime)
    return _enrich_overtime(overtime)
