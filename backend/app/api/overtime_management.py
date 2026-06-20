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
    p = rec.personnel
    if p:
        rec.personnel_name = f"{p.first_name or ''} {p.last_name or ''}".strip() or str(p.id)
        rec.personnel_emp_code = getattr(p, "emp_code", None)
        rec.personnel_type    = getattr(p, "personnel_type", None)
        rec.personnel_company = getattr(p, "company", None)
        dept = getattr(p, "department", None)
        rec.department_id   = getattr(p, "department_id", None)
        rec.department_name = getattr(dept, "name", None) if dept else None
    else:
        rec.personnel_name = None
        rec.personnel_emp_code = None
        rec.personnel_type    = None
        rec.personnel_company = None
        rec.department_id   = None
        rec.department_name = None
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
    from datetime import timedelta

    all_records = db.query(OvertimeManagement).all()

    by_status: dict = {}
    by_type: dict = {}
    by_comp: dict = {}
    by_dept: dict = {}
    month_counts: dict = {}
    approved_hours = 0.0

    for r in all_records:
        by_status[r.status] = by_status.get(r.status, 0) + 1
        if r.overtime_type:
            by_type[r.overtime_type] = by_type.get(r.overtime_type, 0) + 1
        ct = r.compensation_type or "unspecified"
        by_comp[ct] = by_comp.get(ct, 0) + 1
        if r.status == "approved" and r.overtime_hours:
            approved_hours += float(r.overtime_hours)
        if r.date:
            mk = r.date.strftime("%Y-%m")
            month_counts[mk] = month_counts.get(mk, 0) + 1
        p = db.query(Personnel).filter(Personnel.id == r.personnel_id).first()
        dept = getattr(p, "department", None) if p else None
        dept_name = getattr(dept, "name", "No Department") if dept else "No Department"
        if dept_name not in by_dept:
            by_dept[dept_name] = {"total": 0, "approved_hours": 0.0}
        by_dept[dept_name]["total"] += 1
        if r.status == "approved" and r.overtime_hours:
            by_dept[dept_name]["approved_hours"] += float(r.overtime_hours)

    today = date.today()
    monthly_trend = []
    for i in range(11, -1, -1):
        yr = today.year - (i // 12)
        mo = today.month - (i % 12)
        if mo <= 0:
            mo += 12
            yr -= 1
        mk = f"{yr:04d}-{mo:02d}"
        monthly_trend.append({"month": mk, "count": month_counts.get(mk, 0)})

    dept_summary = [
        {"department": k, **v}
        for k, v in sorted(by_dept.items(), key=lambda x: -x[1]["total"])
    ]

    total = len(all_records)
    total_ot_hours = db.query(func.sum(OvertimeManagement.overtime_hours)).scalar() or 0

    return {
        "total":                 total,
        "pending":               by_status.get("pending", 0),
        "approved":              by_status.get("approved", 0),
        "rejected":              by_status.get("rejected", 0),
        "cancelled":             by_status.get("cancelled", 0),
        "processed":             by_status.get("processed", 0),
        "total_overtime_hours":  float(total_ot_hours),
        "approved_hours":        approved_hours,
        "by_status":             by_status,
        "by_type":               by_type,
        "by_compensation":       by_comp,
        "by_dept":               dept_summary,
        "monthly_trend":         monthly_trend,
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
    limit: int = Query(500, ge=1, le=1000),
    personnel_id: Optional[int] = None,
    status: Optional[str] = None,
    overtime_type: Optional[str] = None,
    department_id: Optional[int] = None,
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
    enriched = [_enrich_overtime(r) for r in records]
    if department_id:
        enriched = [r for r in enriched if r.department_id == department_id]
    return enriched


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
