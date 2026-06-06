"""
Position Management API
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional
import logging

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.position import Position, PositionAssignment
from ..models.department import Department

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/positions", tags=["Position Management"])


def _to_dict(pos: Position, db: Session) -> dict:
    dept = None
    if pos.department_id:
        d = db.query(Department).filter_by(id=pos.department_id).first()
        dept = {"id": d.id, "name": d.name, "code": d.code} if d else None

    assigned_count = db.query(PositionAssignment).filter(
        PositionAssignment.position_id == pos.id,
        PositionAssignment.is_current == True,
    ).count()

    return {
        "id": pos.id,
        "position_code": pos.position_code,
        "position_name": pos.position_name,
        "description": pos.description,
        "parent_id": pos.parent_id,
        "level": pos.level,
        "sort_order": pos.sort_order,
        "department_id": pos.department_id,
        "department": dept,
        "position_type": (pos.position_type or "").lower(),
        "job_category": (pos.job_category or "").lower(),
        "grade_level": pos.grade_level,
        "required_certifications": pos.required_certifications,
        "required_skills": pos.required_skills,
        "min_experience_years": pos.min_experience_years,
        "education_level": pos.education_level,
        "salary_range_min": float(pos.salary_range_min) if pos.salary_range_min is not None else None,
        "salary_range_max": float(pos.salary_range_max) if pos.salary_range_max is not None else None,
        "currency": pos.currency,
        "is_active": pos.is_active,
        "is_safety_critical": pos.is_safety_critical,
        "requires_background_check": pos.requires_background_check,
        "assigned_count": assigned_count,
        "notes": pos.notes,
        "created_at": pos.created_at.isoformat() if pos.created_at else None,
        "updated_at": pos.updated_at.isoformat() if pos.updated_at else None,
    }


# ── Static routes BEFORE /{position_id} ──────────────────────────────────────

@router.get("/meta/summary")
def get_summary(db: Session = Depends(get_db), _=Depends(get_current_user)):
    total = db.query(Position).count()
    active = db.query(Position).filter(Position.is_active == True).count()
    safety_critical = db.query(Position).filter(Position.is_safety_critical == True).count()

    by_type = {}
    for t, c in db.query(Position.position_type, func.count(Position.id)).group_by(Position.position_type).all():
        by_type[(t or "unspecified").lower()] = c

    by_category = {}
    for cat, c in db.query(Position.job_category, func.count(Position.id)).group_by(Position.job_category).all():
        by_category[(cat or "unspecified").lower()] = c

    by_dept = {}
    for dept_id, c in db.query(Position.department_id, func.count(Position.id)).group_by(Position.department_id).all():
        if dept_id:
            d = db.query(Department).filter_by(id=dept_id).first()
            name = d.name if d else f"dept_{dept_id}"
        else:
            name = "unassigned"
        by_dept[name] = c

    return {
        "total": total,
        "active": active,
        "inactive": total - active,
        "safety_critical": safety_critical,
        "by_type": by_type,
        "by_category": by_category,
        "by_department": by_dept,
    }


@router.get("/types")
def get_position_types(_=Depends(get_current_user)):
    return [
        {"value": "executive", "label": "Executive"},
        {"value": "manager", "label": "Manager"},
        {"value": "supervisor", "label": "Supervisor"},
        {"value": "staff", "label": "Staff"},
        {"value": "contractor", "label": "Contractor"},
    ]


@router.get("/categories")
def get_job_categories(_=Depends(get_current_user)):
    return [
        {"value": "technical", "label": "Technical"},
        {"value": "operations", "label": "Operations"},
        {"value": "safety", "label": "Safety"},
        {"value": "admin", "label": "Administration"},
        {"value": "support", "label": "Support"},
    ]


@router.get("/hierarchy")
def get_hierarchy(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    def build_node(pos):
        node = _to_dict(pos, db)
        q = db.query(Position).filter(Position.parent_id == pos.id)
        if not include_inactive:
            q = q.filter(Position.is_active == True)
        node["children"] = [build_node(c) for c in q.order_by(Position.sort_order).all()]
        return node

    q = db.query(Position).filter(Position.parent_id == None)
    if not include_inactive:
        q = q.filter(Position.is_active == True)
    return [build_node(p) for p in q.order_by(Position.sort_order, Position.position_name).all()]


@router.get("/assignments")
def list_assignments(
    personnel_id: Optional[int] = Query(None),
    position_id: Optional[int] = Query(None),
    assignment_status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(PositionAssignment)
    if personnel_id:
        q = q.filter(PositionAssignment.personnel_id == personnel_id)
    if position_id:
        q = q.filter(PositionAssignment.position_id == position_id)
    if assignment_status:
        q = q.filter(PositionAssignment.status == assignment_status.upper())
    return [
        {
            "id": a.id,
            "personnel_id": a.personnel_id,
            "position_id": a.position_id,
            "department_id": a.department_id,
            "assignment_type": (a.assignment_type or "").lower(),
            "start_date": a.start_date.isoformat() if a.start_date else None,
            "end_date": a.end_date.isoformat() if a.end_date else None,
            "status": (a.status or "").lower(),
            "is_current": a.is_current,
            "notes": a.notes,
        }
        for a in q.order_by(PositionAssignment.start_date.desc()).all()
    ]


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/")
def get_positions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    position_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Position)
    if search:
        q = q.filter(or_(
            Position.position_name.ilike(f"%{search}%"),
            Position.position_code.ilike(f"%{search}%"),
            Position.description.ilike(f"%{search}%"),
        ))
    if department_id is not None:
        q = q.filter(Position.department_id == department_id)
    if position_type:
        q = q.filter(Position.position_type.ilike(position_type))
    if is_active is not None:
        q = q.filter(Position.is_active == is_active)

    total = q.count()
    positions = q.order_by(Position.sort_order, Position.position_name).offset(skip).limit(limit).all()
    return {"data": [_to_dict(p, db) for p in positions], "total": total}


@router.get("/{position_id}")
def get_position(
    position_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    pos = db.query(Position).filter(Position.id == position_id).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    return _to_dict(pos, db)


@router.post("/", status_code=201)
def create_position(
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if db.query(Position).filter(Position.position_code == body.get("position_code")).first():
        raise HTTPException(status_code=400, detail="Position code already exists")

    pos = Position(
        position_code=body["position_code"],
        position_name=body["position_name"],
        description=body.get("description"),
        department_id=body.get("department_id"),
        parent_id=body.get("parent_id"),
        level=body.get("level", 1),
        sort_order=body.get("sort_order", 0),
        position_type=(body.get("position_type") or "").upper() or None,
        job_category=(body.get("job_category") or "").upper() or None,
        grade_level=body.get("grade_level"),
        required_certifications=body.get("required_certifications"),
        required_skills=body.get("required_skills"),
        min_experience_years=body.get("min_experience_years", 0),
        education_level=body.get("education_level"),
        salary_range_min=body.get("salary_range_min"),
        salary_range_max=body.get("salary_range_max"),
        currency=body.get("currency", "USD"),
        is_active=body.get("is_active", True),
        is_safety_critical=body.get("is_safety_critical", False),
        requires_background_check=body.get("requires_background_check", False),
        notes=body.get("notes"),
        created_by=current_user.id,
    )
    db.add(pos)
    db.commit()
    db.refresh(pos)
    return _to_dict(pos, db)


@router.put("/{position_id}")
def update_position(
    position_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pos = db.query(Position).filter(Position.id == position_id).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")

    for field, value in body.items():
        if field in ("position_type", "job_category") and value:
            value = value.upper()
        if hasattr(pos, field) and field not in ("id", "created_at", "created_by"):
            setattr(pos, field, value)

    pos.updated_by = current_user.id
    db.commit()
    db.refresh(pos)
    return _to_dict(pos, db)


@router.delete("/{position_id}")
def delete_position(
    position_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    pos = db.query(Position).filter(Position.id == position_id).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")

    active_assignments = db.query(PositionAssignment).filter(
        PositionAssignment.position_id == position_id,
        PositionAssignment.is_current == True,
    ).count()
    if active_assignments > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot deactivate: {active_assignments} active assignment(s). Reassign personnel first.",
        )

    pos.is_active = False
    db.commit()
    return {"message": "Position deactivated successfully"}


@router.post("/assignments")
def create_assignment(
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from datetime import datetime

    def parse_dt(v):
        return datetime.fromisoformat(v) if isinstance(v, str) else v

    a = PositionAssignment(
        personnel_id=body["personnel_id"],
        position_id=body["position_id"],
        department_id=body.get("department_id"),
        assignment_type=(body.get("assignment_type") or "PRIMARY").upper(),
        start_date=parse_dt(body["start_date"]),
        end_date=parse_dt(body["end_date"]) if body.get("end_date") else None,
        notes=body.get("notes"),
        assigned_by=current_user.id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return {"id": a.id, "personnel_id": a.personnel_id, "position_id": a.position_id}
