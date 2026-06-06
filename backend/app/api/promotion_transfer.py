from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.promotion_transfer import PromotionTransfer
from ..models.personnel import Personnel
from ..models.user import User
from ..schemas.promotion_transfer import (
    PromotionTransferCreate, PromotionTransferUpdate, PromotionTransferResponse,
)

router = APIRouter()

VALID_TRANSITIONS = {
    "pending":   ["approved", "rejected", "cancelled"],
    "approved":  ["completed", "cancelled"],
    "rejected":  ["pending"],
    "completed": [],
    "cancelled": ["pending"],
}


# ── helpers ───────────────────────────────────────────────────────────────────

def _name(p) -> str:
    if not p:
        return ""
    return f"{getattr(p,'first_name','')} {getattr(p,'last_name','')}".strip() or str(p.id)


def _enrich(t: PromotionTransfer, db: Session) -> PromotionTransfer:
    p = t.personnel or (db.query(Personnel).filter(Personnel.id == t.personnel_id).first() if t.personnel_id else None)
    t.personnel_name     = _name(p)
    t.personnel_emp_code = getattr(p, "emp_code", None)
    t.personnel_type     = getattr(p, "personnel_type", None)
    t.personnel_company  = getattr(p, "company", None)

    t.from_department_name = getattr(t.from_department, "name", None)
    t.to_department_name   = getattr(t.to_department, "name", None)

    # positions table has 'title' column
    if t.from_position_id:
        try:
            from ..models.position import Position
            fp = db.query(Position).filter(Position.id == t.from_position_id).first()
            t.from_position_name = getattr(fp, "position_name", None)
        except Exception:
            t.from_position_name = None
    if t.to_position_id:
        try:
            from ..models.position import Position
            tp = db.query(Position).filter(Position.id == t.to_position_id).first()
            t.to_position_name = getattr(tp, "position_name", None)
        except Exception:
            t.to_position_name = None

    requester = t.requester or (db.query(User).filter(User.id == t.requested_by).first() if t.requested_by else None)
    approver  = t.approver  or (db.query(User).filter(User.id == t.approved_by).first()  if t.approved_by  else None)
    t.requester_name = getattr(requester, "username", None) or _name(requester)
    t.approver_name  = getattr(approver,  "username", None) or _name(approver)
    return t


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("/promotion-transfers", response_model=PromotionTransferResponse, status_code=201)
async def create_transfer(
    data: PromotionTransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.query(Personnel).filter(Personnel.id == data.personnel_id).first():
        raise HTTPException(status_code=404, detail="Personnel not found")
    payload = data.model_dump()
    if not payload.get("requested_by"):
        payload["requested_by"] = current_user.id
    t = PromotionTransfer(**payload)
    db.add(t)
    db.commit()
    db.refresh(t)
    return _enrich(t, db)


@router.get("/promotion-transfers", response_model=List[PromotionTransferResponse])
async def list_transfers(
    personnel_id:  Optional[int] = None,
    status:        Optional[str] = None,
    transfer_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(PromotionTransfer)
    if personnel_id:
        q = q.filter(PromotionTransfer.personnel_id == personnel_id)
    if status:
        q = q.filter(PromotionTransfer.status == status)
    if transfer_type:
        q = q.filter(PromotionTransfer.transfer_type == transfer_type)
    records = q.order_by(PromotionTransfer.created_at.desc()).offset(skip).limit(limit).all()
    return [_enrich(r, db) for r in records]


@router.get("/promotion-transfers/{transfer_id}", response_model=PromotionTransferResponse)
async def get_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(PromotionTransfer).filter(PromotionTransfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Record not found")
    return _enrich(t, db)


@router.put("/promotion-transfers/{transfer_id}", response_model=PromotionTransferResponse)
async def update_transfer(
    transfer_id: int,
    data: PromotionTransferUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(PromotionTransfer).filter(PromotionTransfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Record not found")
    if t.status == "completed":
        raise HTTPException(status_code=400, detail="Cannot edit a completed record")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return _enrich(t, db)


@router.delete("/promotion-transfers/{transfer_id}", status_code=204)
async def delete_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(PromotionTransfer).filter(PromotionTransfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Record not found")
    if t.status not in ("pending", "cancelled", "rejected"):
        raise HTTPException(status_code=400, detail="Only pending, rejected, or cancelled records can be deleted")
    db.delete(t)
    db.commit()


# ── Status transitions ────────────────────────────────────────────────────────

@router.put("/promotion-transfers/{transfer_id}/approve", response_model=PromotionTransferResponse)
async def approve_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(PromotionTransfer).filter(PromotionTransfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Record not found")
    if "approved" not in VALID_TRANSITIONS.get(t.status, []):
        raise HTTPException(status_code=400, detail=f"Cannot approve from status '{t.status}'")
    t.status      = "approved"
    t.approved_by = current_user.id
    t.approved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(t)
    return _enrich(t, db)


@router.put("/promotion-transfers/{transfer_id}/reject", response_model=PromotionTransferResponse)
async def reject_transfer(
    transfer_id: int,
    rejection_reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(PromotionTransfer).filter(PromotionTransfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Record not found")
    if "rejected" not in VALID_TRANSITIONS.get(t.status, []):
        raise HTTPException(status_code=400, detail=f"Cannot reject from status '{t.status}'")
    t.status           = "rejected"
    t.approved_by      = current_user.id
    t.approved_at      = datetime.now(timezone.utc)
    t.rejection_reason = rejection_reason
    db.commit()
    db.refresh(t)
    return _enrich(t, db)


@router.put("/promotion-transfers/{transfer_id}/complete", response_model=PromotionTransferResponse)
async def complete_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(PromotionTransfer).filter(PromotionTransfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Record not found")
    if "completed" not in VALID_TRANSITIONS.get(t.status, []):
        raise HTTPException(status_code=400, detail=f"Cannot complete from status '{t.status}'")
    t.status = "completed"
    db.commit()
    db.refresh(t)
    return _enrich(t, db)


@router.put("/promotion-transfers/{transfer_id}/cancel", response_model=PromotionTransferResponse)
async def cancel_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(PromotionTransfer).filter(PromotionTransfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Record not found")
    if "cancelled" not in VALID_TRANSITIONS.get(t.status, []):
        raise HTTPException(status_code=400, detail=f"Cannot cancel from status '{t.status}'")
    t.status = "cancelled"
    db.commit()
    db.refresh(t)
    return _enrich(t, db)


# ── Summary / Analytics ───────────────────────────────────────────────────────

@router.get("/promotion-transfers/meta/summary")
async def transfer_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = db.query(PromotionTransfer).all()
    by_type   = {}
    by_status = {}
    by_ptype  = {}
    salary_increases = 0
    salary_total = 0.0

    for r in records:
        by_type[r.transfer_type]  = by_type.get(r.transfer_type, 0) + 1
        by_status[r.status]       = by_status.get(r.status, 0) + 1
        p = db.query(Personnel).filter(Personnel.id == r.personnel_id).first()
        pt = getattr(p, "personnel_type", "STAFF") or "STAFF"
        by_ptype[pt] = by_ptype.get(pt, 0) + 1
        if r.salary_change and r.status == "completed":
            salary_total += float(r.salary_change)
            if float(r.salary_change) > 0:
                salary_increases += 1

    return {
        "total":             len(records),
        "pending":           by_status.get("pending", 0),
        "completed":         by_status.get("completed", 0),
        "by_type":           by_type,
        "by_status":         by_status,
        "by_personnel_type": by_ptype,
        "salary_increases":  salary_increases,
        "total_salary_delta": round(salary_total, 2),
    }
