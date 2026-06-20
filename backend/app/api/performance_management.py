from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.performance_management import AppraisalCycle, PerformanceAppraisal
from ..models.personnel import Personnel
from ..models.user import User
from ..schemas.performance_management import (
    AppraisalCycleCreate, AppraisalCycleUpdate, AppraisalCycleResponse,
    PerformanceAppraisalCreate, PerformanceAppraisalUpdate, PerformanceAppraisalResponse,
)

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────────────

def _person_name(p) -> str:
    if not p:
        return ""
    return f"{p.first_name or ''} {p.last_name or ''}".strip() or str(p.id)


def _training_snapshot(personnel_id: int, db: Session):
    """Return (compliance_pct, expired_count) for mandatory training courses."""
    try:
        from ..models.training_management import TrainingCourse, TrainingEnrollment
        from datetime import date as _date
        mandatory_ids = [
            r.id for r in db.query(TrainingCourse.id).filter(TrainingCourse.is_mandatory == True).all()
        ]
        if not mandatory_ids:
            return None, None
        today = _date.today()
        certified = 0
        expired = 0
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
            if enroll:
                if enroll.expiry_date and enroll.expiry_date < today:
                    expired += 1
                else:
                    certified += 1
        total = len(mandatory_ids)
        pct = int(certified / total * 100) if total else None
        return pct, expired
    except Exception:
        return None, None


def _enrich_appraisal(a: PerformanceAppraisal, db: Session) -> PerformanceAppraisal:
    p = a.personnel
    if not p and a.personnel_id:
        p = db.query(Personnel).filter(Personnel.id == a.personnel_id).first()
    c = a.cycle
    if not c and a.cycle_id:
        c = db.query(AppraisalCycle).filter(AppraisalCycle.id == a.cycle_id).first()
    reviewer = None
    if a.reviewer_id:
        reviewer = db.query(User).filter(User.id == a.reviewer_id).first()

    a.personnel_name     = _person_name(p)
    a.personnel_emp_code = getattr(p, "emp_code", None)
    a.personnel_type     = getattr(p, "personnel_type", None)
    a.personnel_company  = getattr(p, "company", None)
    a.cycle_name         = getattr(c, "cycle_name", None)
    a.cycle_code         = getattr(c, "cycle_code", None)
    a.reviewer_name      = _person_name(reviewer) if reviewer else None
    # Department enrichment
    dept = getattr(p, "department", None)
    a.department_id   = getattr(p, "department_id", None)
    a.department_name = getattr(dept, "name", None) if dept else None

    pct, expired = _training_snapshot(a.personnel_id, db)
    a.training_compliance = pct
    a.expired_certs       = expired
    return a


def _enrich_cycle(cycle: AppraisalCycle, db: Session) -> AppraisalCycle:
    count = db.query(PerformanceAppraisal).filter(PerformanceAppraisal.cycle_id == cycle.id).count()
    cycle.appraisal_count = count
    return cycle


# ── Appraisal Cycle endpoints ─────────────────────────────────────────────────

@router.post("/performance/cycles", response_model=AppraisalCycleResponse, status_code=201)
async def create_cycle(
    data: AppraisalCycleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(AppraisalCycle).filter(AppraisalCycle.cycle_code == data.cycle_code).first():
        raise HTTPException(status_code=400, detail="Cycle code already exists")
    cycle = AppraisalCycle(**data.model_dump(), created_by=current_user.id)
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return _enrich_cycle(cycle, db)


@router.get("/performance/cycles", response_model=List[AppraisalCycleResponse])
async def list_cycles(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(AppraisalCycle)
    if status:
        q = q.filter(AppraisalCycle.status == status)
    cycles = q.order_by(AppraisalCycle.start_date.desc()).offset(skip).limit(limit).all()
    return [_enrich_cycle(c, db) for c in cycles]


@router.get("/performance/cycles/{cycle_id}", response_model=AppraisalCycleResponse)
async def get_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cycle = db.query(AppraisalCycle).filter(AppraisalCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    return _enrich_cycle(cycle, db)


@router.put("/performance/cycles/{cycle_id}", response_model=AppraisalCycleResponse)
async def update_cycle(
    cycle_id: int,
    data: AppraisalCycleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cycle = db.query(AppraisalCycle).filter(AppraisalCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(cycle, k, v)
    db.commit()
    db.refresh(cycle)
    return _enrich_cycle(cycle, db)


@router.delete("/performance/cycles/{cycle_id}", status_code=204)
async def delete_cycle(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cycle = db.query(AppraisalCycle).filter(AppraisalCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    if db.query(PerformanceAppraisal).filter(PerformanceAppraisal.cycle_id == cycle_id).count():
        raise HTTPException(status_code=400, detail="Cycle has appraisals — cannot delete")
    db.delete(cycle)
    db.commit()


# ── Appraisal endpoints ───────────────────────────────────────────────────────

@router.post("/performance/appraisals", response_model=PerformanceAppraisalResponse, status_code=201)
async def create_appraisal(
    data: PerformanceAppraisalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.query(Personnel).filter(Personnel.id == data.personnel_id).first():
        raise HTTPException(status_code=404, detail="Personnel not found")
    if not db.query(AppraisalCycle).filter(AppraisalCycle.id == data.cycle_id).first():
        raise HTTPException(status_code=404, detail="Appraisal cycle not found")
    existing = db.query(PerformanceAppraisal).filter(
        PerformanceAppraisal.personnel_id == data.personnel_id,
        PerformanceAppraisal.cycle_id == data.cycle_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Appraisal already exists for this person in this cycle")
    appraisal = PerformanceAppraisal(**data.model_dump())
    db.add(appraisal)
    db.commit()
    db.refresh(appraisal)
    return _enrich_appraisal(appraisal, db)


@router.get("/performance/appraisals", response_model=List[PerformanceAppraisalResponse])
async def list_appraisals(
    personnel_id:  Optional[int] = None,
    cycle_id:      Optional[int] = None,
    status:        Optional[str] = None,
    department_id: Optional[int] = None,
    rating:        Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(PerformanceAppraisal)
    if personnel_id:
        q = q.filter(PerformanceAppraisal.personnel_id == personnel_id)
    if cycle_id:
        q = q.filter(PerformanceAppraisal.cycle_id == cycle_id)
    if status:
        q = q.filter(PerformanceAppraisal.status == status)
    if rating:
        q = q.filter(PerformanceAppraisal.overall_rating == rating)
    appraisals = q.order_by(PerformanceAppraisal.appraisal_date.desc()).offset(skip).limit(limit).all()
    enriched = [_enrich_appraisal(a, db) for a in appraisals]
    # Apply department filter after enrichment (via personnel.department_id)
    if department_id:
        enriched = [a for a in enriched if a.department_id == department_id]
    return enriched


@router.get("/performance/appraisals/{appraisal_id}", response_model=PerformanceAppraisalResponse)
async def get_appraisal(
    appraisal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = db.query(PerformanceAppraisal).filter(PerformanceAppraisal.id == appraisal_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Appraisal not found")
    return _enrich_appraisal(a, db)


@router.put("/performance/appraisals/{appraisal_id}", response_model=PerformanceAppraisalResponse)
async def update_appraisal(
    appraisal_id: int,
    data: PerformanceAppraisalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = db.query(PerformanceAppraisal).filter(PerformanceAppraisal.id == appraisal_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Appraisal not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    return _enrich_appraisal(a, db)


@router.delete("/performance/appraisals/{appraisal_id}", status_code=204)
async def delete_appraisal(
    appraisal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = db.query(PerformanceAppraisal).filter(PerformanceAppraisal.id == appraisal_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Appraisal not found")
    if a.status in ("approved",):
        raise HTTPException(status_code=400, detail="Cannot delete an approved appraisal")
    db.delete(a)
    db.commit()


# ── Status transition endpoints ───────────────────────────────────────────────

VALID_TRANSITIONS = {
    "draft":       ["submitted"],
    "submitted":   ["in_progress", "draft"],
    "in_progress": ["completed", "submitted"],
    "completed":   ["approved", "rejected"],
    "rejected":    ["draft"],
}


@router.put("/performance/appraisals/{appraisal_id}/{action}", response_model=PerformanceAppraisalResponse)
async def appraisal_action(
    appraisal_id: int,
    action: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    action_to_status = {
        "submit":   "submitted",
        "start":    "in_progress",
        "complete": "completed",
        "approve":  "approved",
        "reject":   "rejected",
        "reopen":   "draft",
    }
    if action not in action_to_status:
        raise HTTPException(status_code=400, detail=f"Unknown action '{action}'")
    a = db.query(PerformanceAppraisal).filter(PerformanceAppraisal.id == appraisal_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Appraisal not found")
    new_status = action_to_status[action]
    allowed = VALID_TRANSITIONS.get(a.status, [])
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"Cannot move from '{a.status}' to '{new_status}'")
    a.status = new_status
    db.commit()
    db.refresh(a)
    return _enrich_appraisal(a, db)


# ── Summary ───────────────────────────────────────────────────────────────────

@router.get("/performance/summary")
async def performance_summary(
    cycle_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(PerformanceAppraisal)
    if cycle_id:
        q = q.filter(PerformanceAppraisal.cycle_id == cycle_id)
    appraisals = q.all()

    by_status   = {}
    by_rating   = {}
    by_type     = {}
    by_dept     = {}
    scores      = []
    goals       = []

    RATING_ORDER = ["excellent", "very_good", "good", "satisfactory", "needs_improvement", "poor"]

    for a in appraisals:
        by_status[a.status] = by_status.get(a.status, 0) + 1
        if a.overall_rating:
            by_rating[a.overall_rating] = by_rating.get(a.overall_rating, 0) + 1
        if a.performance_score is not None:
            scores.append(float(a.performance_score))
        if a.goals_achieved is not None:
            goals.append(float(a.goals_achieved))
        p = db.query(Personnel).filter(Personnel.id == a.personnel_id).first()
        ptype = getattr(p, "personnel_type", "STAFF") or "STAFF"
        by_type[ptype] = by_type.get(ptype, 0) + 1
        dept = getattr(p, "department", None)
        dept_name = getattr(dept, "name", "No Department") if dept else "No Department"
        if dept_name not in by_dept:
            by_dept[dept_name] = {"total": 0, "scores": [], "ratings": {}}
        by_dept[dept_name]["total"] += 1
        if a.performance_score is not None:
            by_dept[dept_name]["scores"].append(float(a.performance_score))
        if a.overall_rating:
            by_dept[dept_name]["ratings"][a.overall_rating] = by_dept[dept_name]["ratings"].get(a.overall_rating, 0) + 1

    # Score histogram: buckets 0-20, 20-40, 40-60, 60-80, 80-100
    score_buckets = [0, 0, 0, 0, 0]
    for s in scores:
        idx = min(int(s // 20), 4)
        score_buckets[idx] += 1

    # Department summary with avg score
    dept_summary = []
    for name, data in by_dept.items():
        avg = round(sum(data["scores"]) / len(data["scores"]), 1) if data["scores"] else None
        top_rating = max(data["ratings"], key=data["ratings"].get) if data["ratings"] else None
        dept_summary.append({
            "department": name,
            "total": data["total"],
            "avg_score": avg,
            "top_rating": top_rating,
        })
    dept_summary.sort(key=lambda x: -(x["avg_score"] or 0))

    # Rating ordered list for charts
    rating_chart = [
        {"rating": r, "count": by_rating.get(r, 0), "label": r.replace("_", " ").title()}
        for r in RATING_ORDER
        if r in by_rating
    ]

    return {
        "total":         len(appraisals),
        "by_status":     by_status,
        "by_rating":     by_rating,
        "rating_chart":  rating_chart,
        "by_type":       by_type,
        "by_dept":       dept_summary,
        "avg_score":     round(sum(scores) / len(scores), 1) if scores else None,
        "avg_goals":     round(sum(goals) / len(goals), 1) if goals else None,
        "score_buckets": score_buckets,
        "total_cycles":  db.query(AppraisalCycle).count(),
        "open_cycles":   db.query(AppraisalCycle).filter(AppraisalCycle.status == "open").count(),
    }
