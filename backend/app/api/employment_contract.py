from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timezone
import re

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.employment_contract import EmploymentContract
from ..models.personnel import Personnel
from ..models.user import User
from ..schemas.employment_contract import (
    EmploymentContractCreate, EmploymentContractUpdate, EmploymentContractResponse,
)

router = APIRouter()

VALID_TRANSITIONS = {
    "draft":      ["active", "terminated"],
    "active":     ["expired", "terminated", "suspended", "renewed"],
    "suspended":  ["active", "terminated"],
    "renewed":    ["active", "terminated"],
    "expired":    ["renewed"],
    "terminated": [],
}

# ZKTeco access state per contract status:
# active   → granted (biometric access allowed)
# draft    → pending (not yet enrolled)
# suspended/expired → warning (access should be reviewed)
# terminated → revoked (device record should be removed)
ZKTECO_ACCESS = {
    "draft":      "pending",
    "active":     "granted",
    "suspended":  "warning",
    "renewed":    "granted",
    "expired":    "warning",
    "terminated": "revoked",
}


# ── helpers ───────────────────────────────────────────────────────────────────

def _name(p) -> str:
    if not p:
        return ""
    return f"{getattr(p,'first_name','')} {getattr(p,'last_name','')}".strip() or str(p.id)


def _auto_contract_number(db: Session) -> str:
    year = datetime.now().year
    last = (
        db.query(EmploymentContract)
        .filter(EmploymentContract.contract_number.like(f"EC-{year}-%"))
        .order_by(EmploymentContract.id.desc())
        .first()
    )
    seq = 1
    if last and last.contract_number:
        m = re.search(r"-(\d+)$", last.contract_number)
        if m:
            seq = int(m.group(1)) + 1
    return f"EC-{year}-{seq:04d}"


def _enrich(c: EmploymentContract, db: Session) -> EmploymentContract:
    p = c.personnel or (db.query(Personnel).filter(Personnel.id == c.personnel_id).first() if c.personnel_id else None)
    c.personnel_name     = _name(p)
    c.personnel_emp_code = getattr(p, "emp_code", None)
    c.personnel_type     = getattr(p, "personnel_type", None)
    c.personnel_company  = getattr(p, "company", None)

    c.department_name = getattr(c.department, "name", None)

    if c.position_id:
        try:
            from ..models.position import Position
            pos = db.query(Position).filter(Position.id == c.position_id).first()
            c.position_name = getattr(pos, "position_name", None)
        except Exception:
            c.position_name = None

    signer = c.signer or (db.query(User).filter(User.id == c.signed_by).first() if c.signed_by else None)
    c.signer_name = getattr(signer, "username", None) or _name(signer)

    # Lifecycle computed fields
    today = date.today()
    c.is_in_probation = bool(c.probation_end_date and today <= c.probation_end_date)

    if c.status == "active" and c.end_date:
        delta = (c.end_date - today).days
        c.days_until_expiry = delta
        c.is_expiring_soon  = delta <= 30
    else:
        c.days_until_expiry = None
        c.is_expiring_soon  = False

    c.zkteco_access = ZKTECO_ACCESS.get(c.status, "pending")
    return c


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("/contracts", response_model=EmploymentContractResponse, status_code=201)
async def create_contract(
    data: EmploymentContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.query(Personnel).filter(Personnel.id == data.personnel_id).first():
        raise HTTPException(status_code=404, detail="Personnel not found")
    payload = data.model_dump()
    if not payload.get("contract_number"):
        payload["contract_number"] = _auto_contract_number(db)
    c = EmploymentContract(**payload)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _enrich(c, db)


@router.get("/contracts/meta/summary")
async def contract_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = db.query(EmploymentContract).all()
    by_status = {}
    by_type   = {}
    expiring_soon = 0
    today = date.today()

    for r in records:
        by_status[r.status] = by_status.get(r.status, 0) + 1
        by_type[r.contract_type] = by_type.get(r.contract_type, 0) + 1
        if r.status == "active" and r.end_date:
            if 0 <= (r.end_date - today).days <= 30:
                expiring_soon += 1

    return {
        "total":         len(records),
        "active":        by_status.get("active", 0),
        "draft":         by_status.get("draft", 0),
        "expired":       by_status.get("expired", 0),
        "terminated":    by_status.get("terminated", 0),
        "expiring_soon": expiring_soon,
        "by_status":     by_status,
        "by_type":       by_type,
        # ZKTeco summary
        "zkteco_granted": by_status.get("active", 0) + by_status.get("renewed", 0),
        "zkteco_revoked": by_status.get("terminated", 0),
        "zkteco_warning": by_status.get("expired", 0) + by_status.get("suspended", 0),
        "zkteco_pending": by_status.get("draft", 0),
    }


@router.get("/contracts", response_model=List[EmploymentContractResponse])
async def list_contracts(
    personnel_id:  Optional[int] = None,
    status:        Optional[str] = None,
    contract_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(EmploymentContract)
    if personnel_id:
        q = q.filter(EmploymentContract.personnel_id == personnel_id)
    if status:
        q = q.filter(EmploymentContract.status == status)
    if contract_type:
        q = q.filter(EmploymentContract.contract_type == contract_type)
    records = q.order_by(EmploymentContract.created_at.desc()).offset(skip).limit(limit).all()
    return [_enrich(r, db) for r in records]


@router.get("/contracts/{contract_id}", response_model=EmploymentContractResponse)
async def get_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(EmploymentContract).filter(EmploymentContract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    return _enrich(c, db)


@router.put("/contracts/{contract_id}", response_model=EmploymentContractResponse)
async def update_contract(
    contract_id: int,
    data: EmploymentContractUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(EmploymentContract).filter(EmploymentContract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    if c.status == "terminated":
        raise HTTPException(status_code=400, detail="Cannot edit a terminated contract")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return _enrich(c, db)


@router.delete("/contracts/{contract_id}", status_code=204)
async def delete_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(EmploymentContract).filter(EmploymentContract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    if c.status not in ("draft", "terminated", "expired"):
        raise HTTPException(status_code=400, detail="Only draft, terminated, or expired contracts can be deleted")
    db.delete(c)
    db.commit()


# ── Status transitions (ZKTeco-aligned) ──────────────────────────────────────

@router.put("/contracts/{contract_id}/activate", response_model=EmploymentContractResponse)
async def activate_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Activate contract → ZKTeco access GRANTED."""
    c = db.query(EmploymentContract).filter(EmploymentContract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    if "active" not in VALID_TRANSITIONS.get(c.status, []):
        raise HTTPException(status_code=400, detail=f"Cannot activate from status '{c.status}'")
    c.status = "active"
    db.commit()
    db.refresh(c)
    return _enrich(c, db)


@router.put("/contracts/{contract_id}/terminate", response_model=EmploymentContractResponse)
async def terminate_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Terminate contract → ZKTeco access REVOKED."""
    c = db.query(EmploymentContract).filter(EmploymentContract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    if "terminated" not in VALID_TRANSITIONS.get(c.status, []):
        raise HTTPException(status_code=400, detail=f"Cannot terminate from status '{c.status}'")
    c.status = "terminated"
    db.commit()
    db.refresh(c)
    return _enrich(c, db)


@router.put("/contracts/{contract_id}/suspend", response_model=EmploymentContractResponse)
async def suspend_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Suspend contract → ZKTeco access WARNING (review required)."""
    c = db.query(EmploymentContract).filter(EmploymentContract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    if "suspended" not in VALID_TRANSITIONS.get(c.status, []):
        raise HTTPException(status_code=400, detail=f"Cannot suspend from status '{c.status}'")
    c.status = "suspended"
    db.commit()
    db.refresh(c)
    return _enrich(c, db)


@router.put("/contracts/{contract_id}/renew", response_model=EmploymentContractResponse)
async def renew_contract(
    contract_id: int,
    new_end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Renew contract (extends end date) → ZKTeco access GRANTED."""
    c = db.query(EmploymentContract).filter(EmploymentContract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    if "renewed" not in VALID_TRANSITIONS.get(c.status, []):
        raise HTTPException(status_code=400, detail=f"Cannot renew from status '{c.status}'")
    c.status = "renewed"
    if new_end_date:
        c.end_date = new_end_date
    db.commit()
    db.refresh(c)
    return _enrich(c, db)


@router.put("/contracts/{contract_id}/expire", response_model=EmploymentContractResponse)
async def expire_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark contract expired → ZKTeco access WARNING."""
    c = db.query(EmploymentContract).filter(EmploymentContract.id == contract_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    if "expired" not in VALID_TRANSITIONS.get(c.status, []):
        raise HTTPException(status_code=400, detail=f"Cannot expire from status '{c.status}'")
    c.status = "expired"
    db.commit()
    db.refresh(c)
    return _enrich(c, db)
