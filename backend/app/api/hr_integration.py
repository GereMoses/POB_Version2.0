"""
HR Integration API — SeamlessHR connector management.

Endpoints:
  GET    /config            — get current integration config (API key masked)
  PUT    /config            — save API credentials and settings
  POST   /test-connection   — verify credentials against SeamlessHR
  POST   /sync              — trigger manual sync for a specific date
  GET    /sync/history      — sync log with status and record counts
  GET    /sync/status       — last sync summary + next scheduled run
  GET    /preview/{date}    — preview attendance records that would be sent
"""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..services.seamlesshr_service import (
    get_config, push_attendance, test_connection,
    _build_attendance_records,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_admin(current_user=Depends(get_current_user)):
    if not (current_user.is_superuser or getattr(current_user, "is_global_admin", False)):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _ensure_tables(db: Session):
    """Create integration tables if they don't exist (idempotent)."""
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS hr_integration_config (
            id                  SERIAL PRIMARY KEY,
            api_base_url        VARCHAR(255),
            api_key             VARCHAR(500),
            org_id              VARCHAR(100),
            auth_header_name    VARCHAR(100) DEFAULT 'Authorization',
            attendance_endpoint VARCHAR(255) DEFAULT '/v1/attendance/clock-records',
            employee_endpoint   VARCHAR(255) DEFAULT '/v1/employees',
            is_enabled          BOOLEAN      DEFAULT FALSE,
            sync_time           VARCHAR(10)  DEFAULT '00:00',
            updated_at          TIMESTAMPTZ  DEFAULT NOW()
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS hr_sync_log (
            id              SERIAL PRIMARY KEY,
            sync_date       DATE,
            triggered_by    VARCHAR(50),
            status          VARCHAR(20),
            records_built   INT  DEFAULT 0,
            records_sent    INT  DEFAULT 0,
            records_failed  INT  DEFAULT 0,
            message         VARCHAR(500),
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.commit()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ConfigIn(BaseModel):
    api_base_url:        str
    api_key:             str
    org_id:              Optional[str] = None
    auth_header_name:    Optional[str] = "Authorization"
    attendance_endpoint: Optional[str] = "/v1/attendance/clock-records"
    employee_endpoint:   Optional[str] = "/v1/employees"
    is_enabled:          Optional[bool] = False
    sync_time:           Optional[str] = "00:00"


class SyncIn(BaseModel):
    sync_date: Optional[str] = None   # YYYY-MM-DD, defaults to yesterday


# ── Config ────────────────────────────────────────────────────────────────────

@router.get("/config")
async def get_integration_config(
    db: Session = Depends(get_db),
    current_user=Depends(_require_admin),
):
    _ensure_tables(db)
    try:
        row = db.execute(text("""
            SELECT api_base_url, api_key, org_id, auth_header_name,
                   attendance_endpoint, employee_endpoint, is_enabled, sync_time
            FROM hr_integration_config LIMIT 1
        """)).fetchone()
    except Exception:
        row = None

    if not row:
        return {
            "configured": False,
            "api_base_url": "https://api.seamlesshr.com",
            "api_key": "",
            "org_id": "",
            "auth_header_name": "Authorization",
            "attendance_endpoint": "/v1/attendance/clock-records",
            "employee_endpoint": "/v1/employees",
            "is_enabled": False,
            "sync_time": "00:00",
        }

    # Mask the API key — only show last 6 chars
    key = row[1] or ""
    masked = ("*" * max(0, len(key) - 6)) + key[-6:] if len(key) > 6 else "***"

    return {
        "configured":            bool(row[0] and row[1]),
        "api_base_url":          row[0],
        "api_key_masked":        masked,
        "org_id":                row[2],
        "auth_header_name":      row[3],
        "attendance_endpoint":   row[4],
        "employee_endpoint":     row[5],
        "is_enabled":            row[6],
        "sync_time":             row[7] or "00:00",
    }


@router.put("/config")
async def save_integration_config(
    body: ConfigIn,
    db: Session = Depends(get_db),
    current_user=Depends(_require_admin),
):
    _ensure_tables(db)

    # If api_key is all stars (masked), keep the existing key
    existing_key = None
    if set(body.api_key) == {"*"}:
        row = db.execute(text("SELECT api_key FROM hr_integration_config LIMIT 1")).fetchone()
        existing_key = row[0] if row else None
        if not existing_key:
            raise HTTPException(status_code=400, detail="API key required")
    api_key = existing_key or body.api_key

    db.execute(text("DELETE FROM hr_integration_config"))
    db.execute(text("""
        INSERT INTO hr_integration_config
          (api_base_url, api_key, org_id, auth_header_name,
           attendance_endpoint, employee_endpoint, is_enabled, sync_time, updated_at)
        VALUES
          (:base_url, :api_key, :org_id, :auth_name,
           :att_ep, :emp_ep, :enabled, :sync_time, NOW())
    """), {
        "base_url":  body.api_base_url.rstrip("/"),
        "api_key":   api_key,
        "org_id":    body.org_id,
        "auth_name": body.auth_header_name or "Authorization",
        "att_ep":    body.attendance_endpoint or "/v1/attendance/clock-records",
        "emp_ep":    body.employee_endpoint or "/v1/employees",
        "enabled":   body.is_enabled,
        "sync_time": body.sync_time or "00:00",
    })
    db.commit()
    logger.info(f"HR integration config updated by {current_user.email}")
    return {"success": True, "message": "Configuration saved"}


# ── Test connection ───────────────────────────────────────────────────────────

@router.post("/test-connection")
async def test_integration_connection(
    db: Session = Depends(get_db),
    current_user=Depends(_require_admin),
):
    cfg = get_config(db)
    if not cfg:
        raise HTTPException(status_code=400, detail="Integration not configured yet")
    result = await test_connection(cfg)
    return result


# ── Manual sync ───────────────────────────────────────────────────────────────

@router.post("/sync")
async def manual_sync(
    body: SyncIn,
    db: Session = Depends(get_db),
    current_user=Depends(_require_admin),
):
    sync_date = None
    if body.sync_date:
        try:
            sync_date = date.fromisoformat(body.sync_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format — use YYYY-MM-DD")

    result = await push_attendance(db, sync_date=sync_date, triggered_by=current_user.email)
    return result


# ── Sync history ──────────────────────────────────────────────────────────────

@router.get("/sync/history")
async def get_sync_history(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(_require_admin),
):
    _ensure_tables(db)
    try:
        rows = db.execute(text("""
            SELECT id, sync_date, triggered_by, status,
                   records_built, records_sent, records_failed,
                   message, created_at
            FROM hr_sync_log
            ORDER BY created_at DESC
            LIMIT :limit
        """), {"limit": limit}).fetchall()
    except Exception:
        return {"history": [], "total": 0}

    return {
        "history": [
            {
                "id":              r[0],
                "sync_date":       str(r[1]) if r[1] else None,
                "triggered_by":    r[2],
                "status":          r[3],
                "records_built":   r[4],
                "records_sent":    r[5],
                "records_failed":  r[6],
                "message":         r[7],
                "created_at":      r[8].isoformat() if r[8] else None,
            }
            for r in rows
        ],
        "total": len(rows),
    }


# ── Sync status ───────────────────────────────────────────────────────────────

@router.get("/sync/status")
async def get_sync_status(
    db: Session = Depends(get_db),
    current_user=Depends(_require_admin),
):
    _ensure_tables(db)
    cfg = get_config(db)

    last = None
    try:
        row = db.execute(text("""
            SELECT status, records_sent, records_failed, message, created_at, sync_date
            FROM hr_sync_log
            ORDER BY created_at DESC LIMIT 1
        """)).fetchone()
        if row:
            last = {
                "status":          row[0],
                "records_sent":    row[1],
                "records_failed":  row[2],
                "message":         row[3],
                "created_at":      row[4].isoformat() if row[4] else None,
                "sync_date":       str(row[5]) if row[5] else None,
            }
    except Exception:
        pass

    sync_time = cfg["sync_time"] if cfg else "00:00"
    now  = datetime.now(timezone.utc)
    h, m = map(int, sync_time.split(":"))
    next_run = now.replace(hour=h, minute=m, second=0, microsecond=0)
    if next_run <= now:
        next_run += timedelta(days=1)

    return {
        "configured":   bool(cfg),
        "enabled":      cfg["is_enabled"] if cfg else False,
        "sync_time":    sync_time,
        "next_run_utc": next_run.isoformat(),
        "last_sync":    last,
    }


# ── Preview ───────────────────────────────────────────────────────────────────

@router.get("/preview/{sync_date}")
async def preview_sync(
    sync_date: str,
    db: Session = Depends(get_db),
    current_user=Depends(_require_admin),
):
    """Show exactly which records would be sent for a given date."""
    try:
        d = date.fromisoformat(sync_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date — use YYYY-MM-DD")

    records = _build_attendance_records(db, d)
    return {
        "sync_date":    sync_date,
        "total":        len(records),
        "records":      records[:100],   # cap preview at 100
        "truncated":    len(records) > 100,
    }
