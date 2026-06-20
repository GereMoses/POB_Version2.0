"""
SeamlessHR Integration Service
──────────────────────────────
Pushes daily attendance records from iclock_transaction → SeamlessHR
Time & Attendance module so HR can process payroll.

All API coordinates (base URL, endpoint paths, header names) are stored in
the hr_integration_config table so they can be updated without a code deploy
once SeamlessHR shares their API documentation.

Default assumptions (common REST HR API pattern — update via Settings UI):
  Base URL:             https://api.seamlesshr.com
  Auth header:          Authorization: Bearer <api_key>
  Attendance endpoint:  POST /v1/attendance/clock-records   (batch)
  Employee check:       GET  /v1/employees/{emp_id}

Attendance payload sent per employee per day:
  {
    "employee_id":   "EMP001",
    "date":          "2026-06-06",
    "clock_in":      "08:02:14",
    "clock_out":     "17:45:00",
    "total_minutes": 583,
    "source":        "POB_BIOMETRIC"
  }
"""

import logging
import asyncio
from datetime import date, datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Tuple

import httpx
from sqlalchemy.orm import Session
from sqlalchemy import text

# ── Shared httpx client (singleton) ──────────────────────────────────────────
_shr_client: Optional[httpx.AsyncClient] = None
_shr_client_lock = asyncio.Lock()


async def _get_shr_client() -> httpx.AsyncClient:
    global _shr_client
    if _shr_client is None or _shr_client.is_closed:
        async with _shr_client_lock:
            if _shr_client is None or _shr_client.is_closed:
                _shr_client = httpx.AsyncClient(timeout=30)
    return _shr_client


async def close_shr_client() -> None:
    global _shr_client
    if _shr_client and not _shr_client.is_closed:
        await _shr_client.aclose()
        _shr_client = None

logger = logging.getLogger(__name__)

# ── Config helpers ────────────────────────────────────────────────────────────

def get_config(db: Session) -> Optional[Dict[str, Any]]:
    """Load integration config from DB. Returns None if not configured."""
    try:
        row = db.execute(text(
            "SELECT api_base_url, api_key, org_id, auth_header_name, "
            "       attendance_endpoint, employee_endpoint, is_enabled, sync_time "
            "FROM hr_integration_config LIMIT 1"
        )).fetchone()
        if not row or not row[0] or not row[1]:
            return None
        from ..core.crypto import decrypt_secret
        return {
            "api_base_url":        row[0].rstrip("/"),
            "api_key":             decrypt_secret(row[1]),  # transparently handles legacy plaintext
            "org_id":              row[2],
            "auth_header_name":    row[3] or "Authorization",
            "attendance_endpoint": row[4] or "/v1/attendance/clock-records",
            "employee_endpoint":   row[5] or "/v1/employees",
            "is_enabled":          bool(row[6]),
            "sync_time":           row[7] or "00:00",  # Bug 2 fix: was missing
        }
    except Exception as e:
        logger.warning(f"hr_integration_config read error: {e}")  # Bug 4 fix: WARNING not DEBUG
        return None


def _auth_header(cfg: Dict) -> Dict[str, str]:
    name = cfg["auth_header_name"]
    key  = cfg["api_key"]
    # Support both "Authorization: Bearer <key>" and raw "X-API-Key: <key>"
    value = f"Bearer {key}" if name.lower() == "authorization" else key
    return {name: value}


# ── Core sync logic ───────────────────────────────────────────────────────────


def _build_attendance_records(db: Session, sync_date: date) -> List[Dict]:
    """
    Build one SeamlessHR clock-record per employee for sync_date.

    Source of truth is the COMPUTED attendance in att_report (via the shared
    attendance_export.build_daily_attendance), NOT raw iclock_transaction. This is
    what fixes the historical defects:
      • access-control door swipes no longer inflate work hours (att_report respects
        reader_purpose, shifts and breaks);
      • cross-midnight / night shifts are attributed to the correct business day;
      • the day boundary is the shift-resolved att_date, not UTC midnight.

    Each record carries an idempotency_key so a re-run/retry cannot double-post.
    Times are emitted as tz-aware ISO 8601 (with offset) to remove the previous
    naive-wall-clock ambiguity; total_minutes is the authoritative computed figure.
    """
    from .attendance_export import build_daily_attendance

    canonical = build_daily_attendance(db, sync_date)
    records = []
    for c in canonical:
        records.append({
            "employee_id":      c["emp_code"],
            "date":             str(c["att_date"]),
            "clock_in":         c["check_in"].isoformat() if c["check_in"] else None,
            "clock_out":        c["check_out"].isoformat() if c["check_out"] else None,
            "total_minutes":    c["work_minutes"],
            "overtime_minutes": c["overtime_minutes"],
            "source":           "POB_BIOMETRIC",
            "idempotency_key":  c["idempotency_key"],
        })
    return records


async def push_attendance(
    db: Session,
    sync_date: Optional[date] = None,
    triggered_by: str = "scheduler",
) -> Dict[str, Any]:
    """
    Build attendance records for sync_date (defaults to yesterday) and
    POST them to SeamlessHR. Logs the result to hr_sync_log.
    Returns a result summary dict.
    """
    if sync_date is None:
        sync_date = date.today() - timedelta(days=1)

    started_at = datetime.now(timezone.utc)
    result = {
        "sync_date":    str(sync_date),
        "triggered_by": triggered_by,
        "started_at":   started_at.isoformat(),
        "status":       "failed",
        "records_built": 0,
        "records_sent":  0,
        "records_failed": 0,
        "message":      "",
    }

    cfg = get_config(db)
    if not cfg:
        result["message"] = "Integration not configured — add API credentials in Settings → HR Integration"
        _log_sync(db, result)
        return result

    if not cfg["is_enabled"]:
        result["status"]  = "skipped"
        result["message"] = "Integration is disabled"
        _log_sync(db, result)
        return result

    records = _build_attendance_records(db, sync_date)
    result["records_built"] = len(records)

    if not records:
        result["status"]  = "success"
        result["message"] = f"No attendance records found for {sync_date}"
        _log_sync(db, result)
        return result

    url     = cfg["api_base_url"] + cfg["attendance_endpoint"]
    headers = {**_auth_header(cfg), "Content-Type": "application/json"}
    if cfg["org_id"]:
        headers["X-Organization-ID"] = cfg["org_id"]

    failed = 0
    sent   = 0

    try:
        client = await _get_shr_client()
        # Send in batches of 50 to avoid large payloads
        batch_size = 50
        for i in range(0, len(records), batch_size):
            batch = records[i : i + batch_size]
            try:
                resp = await client.post(url, json={"records": batch}, headers=headers)
                if resp.status_code in (200, 201, 204):
                    sent += len(batch)
                else:
                    logger.warning(
                        "SeamlessHR batch %d returned %s: %s",
                        i // batch_size + 1, resp.status_code, resp.text[:200],
                    )
                    failed += len(batch)
            except httpx.RequestError as e:
                logger.error("SeamlessHR request error (batch %d): %s", i // batch_size + 1, e)
                failed += len(batch)

        result["records_sent"]   = sent
        result["records_failed"] = failed
        result["status"]  = "success" if failed == 0 else ("partial" if sent > 0 else "failed")
        result["message"] = (
            f"Sent {sent}/{len(records)} records to SeamlessHR for {sync_date}"
            + (f" ({failed} failed)" if failed else "")
        )

    except Exception as e:
        result["message"] = f"Unexpected error: {e}"
        logger.exception("SeamlessHR sync crashed")

    _log_sync(db, result)
    logger.info(f"SeamlessHR sync [{result['status']}]: {result['message']}")
    return result


async def test_connection(cfg: Dict) -> Dict[str, Any]:
    """Verify API credentials by hitting the employee endpoint."""
    url     = cfg["api_base_url"] + cfg.get("employee_endpoint", "/v1/employees")
    headers = {**_auth_header(cfg), "Content-Type": "application/json"}
    if cfg.get("org_id"):
        headers["X-Organization-ID"] = cfg["org_id"]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers=headers)
        if resp.status_code in (200, 201):
            return {"success": True,  "message": f"Connected — HTTP {resp.status_code}"}
        if resp.status_code == 401:
            return {"success": False, "message": "Authentication failed — check your API key"}
        if resp.status_code == 403:
            return {"success": False, "message": "Access denied — check Organisation ID and API permissions"}
        if resp.status_code == 404:
            return {"success": False, "message": f"Endpoint not found: {url} — verify the API base URL"}
        return {"success": False, "message": f"Unexpected response: HTTP {resp.status_code}"}
    except httpx.ConnectError:
        return {"success": False, "message": f"Cannot reach {cfg['api_base_url']} — check the URL and network"}
    except httpx.TimeoutException:
        return {"success": False, "message": "Connection timed out — server did not respond within 10s"}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ── Sync log helper ───────────────────────────────────────────────────────────

def _log_sync(db: Session, result: Dict):
    try:
        db.execute(text("""
            INSERT INTO hr_sync_log
              (sync_date, triggered_by, status, records_built,
               records_sent, records_failed, message, created_at)
            VALUES
              (:sync_date, :triggered_by, :status, :records_built,
               :records_sent, :records_failed, :message, NOW())
        """), {
            "sync_date":      result["sync_date"],
            "triggered_by":   result["triggered_by"],
            "status":         result["status"],
            "records_built":  result["records_built"],
            "records_sent":   result["records_sent"],
            "records_failed": result["records_failed"],
            "message":        result["message"][:500],
        })
        db.commit()
    except Exception as e:
        logger.warning(f"Could not write hr_sync_log: {e}")
        db.rollback()
