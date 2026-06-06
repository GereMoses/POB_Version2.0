"""
Business Central Integration API — Admin only.

Endpoints:
  GET    /config              — get current config (secrets masked)
  PUT    /config              — save Azure AD credentials + settings
  POST   /test-connection     — verify Azure credentials, return companies list
  POST   /sync                — manual sync for a specific date
  GET    /sync/history        — sync log
  GET    /sync/status         — last sync + next scheduled run
  GET    /preview/{date}      — preview time entries that would be sent
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
from ..services.business_central_service import (
    get_bc_config, push_attendance, test_connection,
    fetch_companies, _build_time_entries,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_admin(current_user=Depends(get_current_user)):
    if not (current_user.is_superuser or getattr(current_user, "is_global_admin", False)):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _ensure_tables(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS bc_integration_config (
            id             SERIAL PRIMARY KEY,
            tenant_id      VARCHAR(200),
            client_id      VARCHAR(200),
            client_secret  VARCHAR(500),
            environment    VARCHAR(50)  DEFAULT 'Production',
            company_id     VARCHAR(100),
            company_name   VARCHAR(200),
            is_enabled     BOOLEAN      DEFAULT FALSE,
            sync_time      VARCHAR(10)  DEFAULT '01:00',
            updated_at     TIMESTAMPTZ  DEFAULT NOW()
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS bc_sync_log (
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

class BCConfigIn(BaseModel):
    tenant_id:     str
    client_id:     str
    client_secret: str
    environment:   Optional[str] = "Production"
    company_id:    Optional[str] = None
    company_name:  Optional[str] = None
    is_enabled:    Optional[bool] = False
    sync_time:     Optional[str] = "01:00"


class SyncIn(BaseModel):
    sync_date: Optional[str] = None


# ── Config ────────────────────────────────────────────────────────────────────

@router.get("/config")
async def get_config(
    db: Session = Depends(get_db),
    current_user=Depends(_require_admin),
):
    _ensure_tables(db)
    try:
        row = db.execute(text("""
            SELECT tenant_id, client_id, client_secret, environment,
                   company_id, company_name, is_enabled, sync_time
            FROM bc_integration_config LIMIT 1
        """)).fetchone()
    except Exception:
        row = None

    if not row:
        return {
            "configured": False,
            "tenant_id": "", "client_id": "", "client_secret_masked": "",
            "environment": "Production", "company_id": "", "company_name": "",
            "is_enabled": False, "sync_time": "01:00",
        }

    secret = row[2] or ""
    masked = ("*" * max(0, len(secret) - 6)) + secret[-6:] if len(secret) > 6 else "***"

    return {
        "configured":        bool(row[0] and row[1] and row[2]),
        "tenant_id":         row[0],
        "client_id":         row[1],
        "client_secret_masked": masked,
        "environment":       row[3] or "Production",
        "company_id":        row[4],
        "company_name":      row[5],
        "is_enabled":        row[6],
        "sync_time":         row[7] or "01:00",
    }


@router.put("/config")
async def save_config(
    body: BCConfigIn,
    db: Session = Depends(get_db),
    current_user=Depends(_require_admin),
):
    _ensure_tables(db)

    # Preserve existing secret if masked value is passed back
    client_secret = body.client_secret
    if set(client_secret) == {"*"}:
        row = db.execute(text("SELECT client_secret FROM bc_integration_config LIMIT 1")).fetchone()
        client_secret = row[0] if row else None
        if not client_secret:
            raise HTTPException(status_code=400, detail="Client secret required")

    db.execute(text("DELETE FROM bc_integration_config"))
    db.execute(text("""
        INSERT INTO bc_integration_config
          (tenant_id, client_id, client_secret, environment,
           company_id, company_name, is_enabled, sync_time, updated_at)
        VALUES
          (:tenant_id, :client_id, :client_secret, :environment,
           :company_id, :company_name, :is_enabled, :sync_time, NOW())
    """), {
        "tenant_id":     body.tenant_id.strip(),
        "client_id":     body.client_id.strip(),
        "client_secret": client_secret,
        "environment":   body.environment or "Production",
        "company_id":    body.company_id,
        "company_name":  body.company_name,
        "is_enabled":    body.is_enabled,
        "sync_time":     body.sync_time or "01:00",
    })
    db.commit()
    logger.info(f"BC integration config updated by {current_user.email}")
    return {"success": True, "message": "Configuration saved"}


# ── Test connection ───────────────────────────────────────────────────────────

@router.post("/test-connection")
async def test_bc_connection(
    db: Session = Depends(get_db),
    current_user=Depends(_require_admin),
):
    cfg = get_bc_config(db)
    if not cfg:
        raise HTTPException(status_code=400, detail="Integration not configured yet")
    result = await test_connection(cfg)
    return result


# ── Fetch companies (after test, to let user pick one) ────────────────────────

@router.get("/companies")
async def get_companies(
    db: Session = Depends(get_db),
    current_user=Depends(_require_admin),
):
    cfg = get_bc_config(db)
    if not cfg:
        raise HTTPException(status_code=400, detail="Integration not configured yet")
    companies, err = await fetch_companies(cfg)
    if err:
        raise HTTPException(status_code=502, detail=err)
    return {"companies": companies}


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
            raise HTTPException(status_code=400, detail="Invalid date — use YYYY-MM-DD")
    return await push_attendance(db, sync_date=sync_date, triggered_by=current_user.email)


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
            FROM bc_sync_log ORDER BY created_at DESC LIMIT :limit
        """), {"limit": limit}).fetchall()
    except Exception:
        return {"history": [], "total": 0}

    return {
        "history": [
            {
                "id":             r[0],
                "sync_date":      str(r[1]) if r[1] else None,
                "triggered_by":   r[2],
                "status":         r[3],
                "records_built":  r[4],
                "records_sent":   r[5],
                "records_failed": r[6],
                "message":        r[7],
                "created_at":     r[8].isoformat() if r[8] else None,
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
    cfg = get_bc_config(db)
    last = None
    try:
        row = db.execute(text("""
            SELECT status, records_sent, records_failed, message, created_at, sync_date
            FROM bc_sync_log ORDER BY created_at DESC LIMIT 1
        """)).fetchone()
        if row:
            last = {
                "status":         row[0],
                "records_sent":   row[1],
                "records_failed": row[2],
                "message":        row[3],
                "created_at":     row[4].isoformat() if row[4] else None,
                "sync_date":      str(row[5]) if row[5] else None,
            }
    except Exception:
        pass

    sync_time = cfg["sync_time"] if cfg else "01:00"
    now  = datetime.now(timezone.utc)
    h, m = map(int, sync_time.split(":"))
    next_run = now.replace(hour=h, minute=m, second=0, microsecond=0)
    if next_run <= now:
        next_run += timedelta(days=1)

    return {
        "configured":      bool(cfg),
        "enabled":         cfg["is_enabled"] if cfg else False,
        "company_name":    cfg["company_name"] if cfg else None,
        "environment":     cfg["environment"] if cfg else None,
        "sync_time":       sync_time,
        "next_run_utc":    next_run.isoformat(),
        "last_sync":       last,
    }


# ── Preview ───────────────────────────────────────────────────────────────────

@router.get("/preview/{sync_date}")
async def preview_sync(
    sync_date: str,
    db: Session = Depends(get_db),
    current_user=Depends(_require_admin),
):
    try:
        d = date.fromisoformat(sync_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date — use YYYY-MM-DD")

    entries = _build_time_entries(db, d)
    clean = [
        {
            "employee_number": e["employeeNumber"],
            "date":            e["date"],
            "hours":           e["quantity"],
            "clock_in":        e.get("_clock_in"),
            "clock_out":       e.get("_clock_out"),
        }
        for e in entries
    ]
    return {"sync_date": sync_date, "total": len(clean), "entries": clean[:100], "truncated": len(clean) > 100}
