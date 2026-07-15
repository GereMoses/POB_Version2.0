"""
Database administration API — Settings → Database tab. Global Admin only.

  GET  /overview              — size, tables, connections, POB, largest tables
  GET  /settings             — auto-checkout + retention config
  PUT  /settings             — save config
  POST /occupancy/reset      — instant full occupancy reset (check everyone out)
  POST /occupancy/auto-checkout — run age-based auto-checkout now (?days= override)
  POST /maintenance/{kind}   — vacuum | reindex | analyze
  GET  /retention/preview    — rows that would be purged per configured policy
  POST /retention/purge      — purge old records per policy
  GET  /integrity/scan       — stale/orphaned record counts
  POST /integrity/fix        — repair the fixable ones
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..services import database_admin_service as svc

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_admin(current_user=Depends(get_current_user)):
    if not (getattr(current_user, "is_superuser", False) or getattr(current_user, "is_global_admin", False)):
        raise HTTPException(status_code=403, detail="Global Admin access required")
    return current_user


class SettingsPayload(BaseModel):
    auto_checkout_enabled: bool | None = None
    auto_checkout_days: int | None = None
    retention: dict | None = None


@router.get("/overview")
def overview(db: Session = Depends(get_db), _=Depends(_require_admin)):
    return svc.get_overview(db)


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), _=Depends(_require_admin)):
    return svc.get_settings(db)


@router.put("/settings")
def put_settings(payload: SettingsPayload, db: Session = Depends(get_db), _=Depends(_require_admin)):
    return svc.save_settings(db, payload.model_dump(exclude_none=True))


@router.post("/occupancy/reset")
def occupancy_reset(db: Session = Depends(get_db), current_user=Depends(_require_admin)):
    res = svc.reset_all_occupancy(db)
    logger.warning("Occupancy reset by %s: %s", getattr(current_user, "email", "?"), res)
    return {"success": True, **res,
            "message": f"Occupancy reset — checked out {res['checked_out']}, cleared {res['onboard_cleared']} onboard flags."}


@router.post("/occupancy/auto-checkout")
def occupancy_auto_checkout(days: int | None = None, db: Session = Depends(get_db), _=Depends(_require_admin)):
    if days is None:
        days = svc.get_settings(db)["auto_checkout_days"]
    res = svc.auto_checkout_stale(db, days)
    return {"success": True, **res,
            "message": f"Auto-checkout ({res['days']}d): checked out {res['checked_out']} stale entr{'y' if res['checked_out']==1 else 'ies'}."}


@router.post("/maintenance/{kind}")
def maintenance(kind: str, db: Session = Depends(get_db), _=Depends(_require_admin)):
    if kind not in ("vacuum", "reindex", "analyze"):
        raise HTTPException(status_code=400, detail="kind must be vacuum, reindex or analyze")
    try:
        res = svc.run_maintenance(kind)
    except Exception as e:
        logger.error("Maintenance %s failed: %s", kind, e)
        raise HTTPException(status_code=500, detail=f"{kind} failed: {str(e)[:200]}")
    return {"success": True, **res, "message": f"{kind.upper()} completed in {res['duration_seconds']}s."}


@router.get("/retention/preview")
def retention_preview(db: Session = Depends(get_db), _=Depends(_require_admin)):
    return svc.retention_preview(db)


@router.post("/retention/purge")
def retention_purge(db: Session = Depends(get_db), current_user=Depends(_require_admin)):
    res = svc.retention_purge(db)
    logger.warning("Retention purge by %s: %s", getattr(current_user, "email", "?"), res)
    return {"success": True, **res, "message": f"Purged {res['total_deleted']} old record(s)."}


@router.get("/integrity/scan")
def integrity_scan(db: Session = Depends(get_db), _=Depends(_require_admin)):
    return svc.integrity_scan(db)


@router.post("/integrity/fix")
def integrity_fix(db: Session = Depends(get_db), current_user=Depends(_require_admin)):
    res = svc.integrity_fix(db)
    logger.warning("Integrity fix by %s: %s", getattr(current_user, "email", "?"), res)
    return {"success": True, **res, "message": f"Fixed {res['total_fixed']} issue(s)."}
