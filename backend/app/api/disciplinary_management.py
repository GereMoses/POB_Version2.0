from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
import re

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.disciplinary_management import DisciplinaryCase
from ..models.personnel import Personnel
from ..models.user import User
from ..schemas.disciplinary_management import (
    DisciplinaryCaseCreate, DisciplinaryCaseUpdate, DisciplinaryCaseResponse,
)

router = APIRouter()

# Status flow: open → under_investigation → resolved | appealed → closed
VALID_TRANSITIONS = {
    "open":                ["under_investigation", "resolved", "closed"],
    "under_investigation": ["resolved", "appealed", "closed"],
    "resolved":            ["appealed", "closed"],
    "appealed":            ["resolved", "closed"],
    "closed":              ["open"],   # reopen
}


# ── helpers ───────────────────────────────────────────────────────────────────

def _person_name(p) -> str:
    if not p:
        return ""
    return f"{p.first_name or ''} {p.last_name or ''}".strip() or str(p.id)


def _user_name(u) -> str:
    if not u:
        return ""
    return getattr(u, "full_name", None) or getattr(u, "username", None) or str(u.id)


def _has_training_gap(personnel_id: int, db: Session) -> Optional[bool]:
    """True if the person has any expired mandatory training certificate."""
    try:
        from ..models.training_management import TrainingCourse, TrainingEnrollment
        today = date.today()
        mandatory_ids = [
            r.id for r in db.query(TrainingCourse.id).filter(TrainingCourse.is_mandatory == True).all()
        ]
        if not mandatory_ids:
            return False
        for cid in mandatory_ids:
            enroll = (
                db.query(TrainingEnrollment)
                .filter(
                    TrainingEnrollment.personnel_id == personnel_id,
                    TrainingEnrollment.course_id == cid,
                    TrainingEnrollment.status == "certified",
                )
                .order_by(TrainingEnrollment.id.desc())
                .first()
            )
            if enroll and enroll.expiry_date and enroll.expiry_date < today:
                return True
            if not enroll:
                return True   # never enrolled = gap
        return False
    except Exception:
        return None


def _enrich(case: DisciplinaryCase, db: Session) -> DisciplinaryCase:
    p = case.personnel
    if not p and case.personnel_id:
        p = db.query(Personnel).filter(Personnel.id == case.personnel_id).first()

    reporter = case.reporter
    if not reporter and case.reported_by:
        reporter = db.query(User).filter(User.id == case.reported_by).first()

    assignee = case.assignee
    if not assignee and case.assigned_to:
        assignee = db.query(User).filter(User.id == case.assigned_to).first()

    case.personnel_name     = _person_name(p)
    case.personnel_emp_code = getattr(p, "emp_code", None)
    case.personnel_type     = getattr(p, "personnel_type", None)
    case.personnel_company  = getattr(p, "company", None)
    case.reporter_name      = _user_name(reporter)
    case.assignee_name      = _user_name(assignee)

    # Count open/active cases for this person (excluding current if closed)
    case.open_cases_count = db.query(DisciplinaryCase).filter(
        DisciplinaryCase.personnel_id == case.personnel_id,
        DisciplinaryCase.status.in_(["open", "under_investigation", "appealed"]),
    ).count()

    case.has_active_training_gap = _has_training_gap(case.personnel_id, db)
    return case


def _auto_case_number(db: Session) -> str:
    """Generate next case number: DISC-YYYY-NNNN"""
    year = datetime.now().year
    prefix = f"DISC-{year}-"
    last = (
        db.query(DisciplinaryCase)
        .filter(DisciplinaryCase.case_number.like(f"{prefix}%"))
        .order_by(DisciplinaryCase.id.desc())
        .first()
    )
    if last:
        m = re.search(r"(\d+)$", last.case_number)
        seq = int(m.group(1)) + 1 if m else 1
    else:
        seq = 1
    return f"{prefix}{str(seq).zfill(4)}"


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("/disciplinary/cases", response_model=DisciplinaryCaseResponse, status_code=201)
async def create_case(
    data: DisciplinaryCaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.query(Personnel).filter(Personnel.id == data.personnel_id).first():
        raise HTTPException(status_code=404, detail="Personnel not found")

    payload = data.model_dump()
    # Auto-generate case number if not supplied or already taken
    if not payload.get("case_number"):
        payload["case_number"] = _auto_case_number(db)
    elif db.query(DisciplinaryCase).filter(DisciplinaryCase.case_number == payload["case_number"]).first():
        raise HTTPException(status_code=400, detail="Case number already exists")

    if not payload.get("reported_by"):
        payload["reported_by"] = current_user.id

    case = DisciplinaryCase(**payload)
    db.add(case)
    db.commit()
    db.refresh(case)
    return _enrich(case, db)


@router.get("/disciplinary/cases", response_model=List[DisciplinaryCaseResponse])
async def list_cases(
    personnel_id:   Optional[int] = None,
    status:         Optional[str] = None,
    severity_level: Optional[str] = None,
    incident_type:  Optional[str] = None,
    action_type:    Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(DisciplinaryCase)
    if personnel_id:
        q = q.filter(DisciplinaryCase.personnel_id == personnel_id)
    if status:
        q = q.filter(DisciplinaryCase.status == status)
    if severity_level:
        q = q.filter(DisciplinaryCase.severity_level == severity_level)
    if incident_type:
        q = q.filter(DisciplinaryCase.incident_type == incident_type)
    if action_type:
        q = q.filter(DisciplinaryCase.action_type == action_type)
    cases = q.order_by(DisciplinaryCase.incident_date.desc()).offset(skip).limit(limit).all()
    return [_enrich(c, db) for c in cases]


@router.get("/disciplinary/cases/{case_id}", response_model=DisciplinaryCaseResponse)
async def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = db.query(DisciplinaryCase).filter(DisciplinaryCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return _enrich(case, db)


@router.put("/disciplinary/cases/{case_id}", response_model=DisciplinaryCaseResponse)
async def update_case(
    case_id: int,
    data: DisciplinaryCaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = db.query(DisciplinaryCase).filter(DisciplinaryCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(case, k, v)
    db.commit()
    db.refresh(case)
    return _enrich(case, db)


@router.delete("/disciplinary/cases/{case_id}", status_code=204)
async def delete_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = db.query(DisciplinaryCase).filter(DisciplinaryCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.status not in ("open", "closed"):
        raise HTTPException(status_code=400, detail="Only open or closed cases can be deleted")
    db.delete(case)
    db.commit()


# ── Status transitions ────────────────────────────────────────────────────────

@router.put("/disciplinary/cases/{case_id}/{action}", response_model=DisciplinaryCaseResponse)
async def case_action(
    case_id: int,
    action: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    action_map = {
        "investigate": "under_investigation",
        "resolve":     "resolved",
        "appeal":      "appealed",
        "close":       "closed",
        "reopen":      "open",
    }
    if action not in action_map:
        raise HTTPException(status_code=400, detail=f"Unknown action '{action}'")
    case = db.query(DisciplinaryCase).filter(DisciplinaryCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    new_status = action_map[action]
    allowed = VALID_TRANSITIONS.get(case.status, [])
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"Cannot move from '{case.status}' to '{new_status}'")
    case.status = new_status
    if new_status == "resolved" and not case.resolution_date:
        case.resolution_date = date.today()
    db.commit()
    db.refresh(case)
    return _enrich(case, db)


# ── Summary ───────────────────────────────────────────────────────────────────

@router.get("/disciplinary/summary")
async def disciplinary_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cases = db.query(DisciplinaryCase).all()

    by_severity = {}
    by_type     = {}
    by_action   = {}
    person_counts: dict = {}

    for c in cases:
        if c.severity_level:
            by_severity[c.severity_level] = by_severity.get(c.severity_level, 0) + 1
        if c.incident_type:
            by_type[c.incident_type] = by_type.get(c.incident_type, 0) + 1
        if c.action_type:
            by_action[c.action_type] = by_action.get(c.action_type, 0) + 1
        if c.status in ("open", "under_investigation", "appealed"):
            person_counts[c.personnel_id] = person_counts.get(c.personnel_id, 0) + 1

    repeat_offenders = []
    for pid, cnt in person_counts.items():
        if cnt >= 2:
            p = db.query(Personnel).filter(Personnel.id == pid).first()
            name = f"{getattr(p,'first_name','')} {getattr(p,'last_name','')}".strip() if p else str(pid)
            repeat_offenders.append({"personnel_id": pid, "name": name, "active_cases": cnt})
    repeat_offenders.sort(key=lambda x: -x["active_cases"])

    return {
        "total":               len(cases),
        "open":                sum(1 for c in cases if c.status == "open"),
        "under_investigation": sum(1 for c in cases if c.status == "under_investigation"),
        "resolved":            sum(1 for c in cases if c.status == "resolved"),
        "by_severity":         by_severity,
        "by_type":             by_type,
        "by_action":           by_action,
        "repeat_offenders":    repeat_offenders[:10],
    }
