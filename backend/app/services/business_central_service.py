"""
Microsoft Business Central Integration Service
───────────────────────────────────────────────
Pushes daily attendance (as timesheet hours) from iclock_transaction into
Business Central's Time Registration Entries so HR/Finance can process
payroll and project cost allocation.

Authentication: OAuth 2.0 Client Credentials (Azure AD / Microsoft Entra ID)
  Requires an App Registration in the organisation's Azure tenant with the
  Dynamics 365 Business Central API permission granted.

BC API base:
  https://api.businesscentral.dynamics.com/v2.0/{tenant_id}/{environment}/api/v2.0/

Key endpoints used:
  GET  /companies                                   — discover company ID
  GET  /companies({id})/employees?$filter=...       — verify employee exists
  POST /companies({id})/timeRegistrationEntries     — post attendance hours

Payload per employee per day:
  {
    "employeeNumber": "EMP001",
    "date":           "2026-06-06",
    "quantity":       8.72,          // hours worked (total_minutes / 60)
    "status":         "Open"
  }
"""

import logging
import time
from datetime import date, datetime, timedelta, timezone
from typing import Optional, Dict, Any, List, Tuple

import httpx
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

# ── Token cache (in-process; valid for 1 hour) ────────────────────────────────
_token_cache: Dict[str, Any] = {}   # keyed by tenant_id
_TOKEN_GRACE = 60                   # refresh 60s before expiry


def _token_cache_key(cfg: Dict) -> str:
    return f"{cfg['tenant_id']}:{cfg['client_id']}"


def _token_is_valid(cfg: Dict) -> bool:
    key   = _token_cache_key(cfg)
    entry = _token_cache.get(key)
    return bool(entry and entry["expires_at"] - time.time() > _TOKEN_GRACE)


def _get_cached_token(cfg: Dict) -> Optional[str]:
    key = _token_cache_key(cfg)
    entry = _token_cache.get(key)
    return entry["access_token"] if entry else None


async def _fetch_token(cfg: Dict) -> Tuple[Optional[str], Optional[str]]:
    """
    Obtain OAuth 2.0 access token via client_credentials grant.
    Returns (token, error_message).
    """
    url = f"https://login.microsoftonline.com/{cfg['tenant_id']}/oauth2/v2.0/token"
    data = {
        "grant_type":    "client_credentials",
        "client_id":     cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "scope":         "https://api.businesscentral.dynamics.com/.default",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, data=data)
        if resp.status_code != 200:
            err = resp.json().get("error_description") or resp.text[:200]
            return None, f"Token request failed ({resp.status_code}): {err}"
        body   = resp.json()
        token  = body["access_token"]
        expiry = time.time() + body.get("expires_in", 3600)
        _token_cache[_token_cache_key(cfg)] = {
            "access_token": token,
            "expires_at":   expiry,
        }
        return token, None
    except httpx.ConnectError:
        return None, f"Cannot reach login.microsoftonline.com — check internet/firewall"
    except Exception as e:
        return None, str(e)


async def _get_token(cfg: Dict) -> Tuple[Optional[str], Optional[str]]:
    if _token_is_valid(cfg):
        return _get_cached_token(cfg), None
    return await _fetch_token(cfg)


def _bc_base(cfg: Dict) -> str:
    env = cfg.get("environment") or "Production"
    return (
        f"https://api.businesscentral.dynamics.com/v2.0"
        f"/{cfg['tenant_id']}/{env}/api/v2.0"
    )


# ── Config helpers ────────────────────────────────────────────────────────────

def get_bc_config(db: Session) -> Optional[Dict[str, Any]]:
    try:
        row = db.execute(text(
            "SELECT tenant_id, client_id, client_secret, environment, "
            "       company_id, company_name, is_enabled, sync_time "
            "FROM bc_integration_config LIMIT 1"
        )).fetchone()
        if not row or not row[0] or not row[1] or not row[2]:
            return None
        return {
            "tenant_id":     row[0],
            "client_id":     row[1],
            "client_secret": row[2],
            "environment":   row[3] or "Production",
            "company_id":    row[4],
            "company_name":  row[5],
            "is_enabled":    bool(row[6]),
            "sync_time":     row[7] or "01:00",
        }
    except Exception as e:
        logger.debug(f"bc_integration_config not found: {e}")
        return None


# ── Company discovery ─────────────────────────────────────────────────────────

async def fetch_companies(cfg: Dict) -> Tuple[List[Dict], Optional[str]]:
    """Return list of BC companies available with the given credentials."""
    token, err = await _get_token(cfg)
    if err:
        return [], err
    url = f"{_bc_base(cfg)}/companies"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
        if resp.status_code == 200:
            companies = [
                {"id": c["id"], "name": c["displayName"]}
                for c in resp.json().get("value", [])
            ]
            return companies, None
        return [], f"HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return [], str(e)


# ── Core sync logic ───────────────────────────────────────────────────────────

def _build_time_entries(db: Session, sync_date: date) -> List[Dict]:
    """
    Build time registration entries for sync_date.
    One entry per employee = first check-in → last check-out → total hours.
    """
    rows = db.execute(text("""
        SELECT emp_code, punch_time, punch_state
        FROM iclock_transaction
        WHERE punch_time::date = :d
        ORDER BY emp_code, punch_time
    """), {"d": sync_date}).fetchall()

    by_emp: Dict[str, List] = {}
    for r in rows:
        by_emp.setdefault(r[0], []).append((r[1], r[2]))

    entries = []
    for emp_code, punches in by_emp.items():
        check_ins  = [p[0] for p in punches if p[1] == 0]
        check_outs = [p[0] for p in punches if p[1] == 1]
        if not check_ins:
            continue
        clock_in   = min(check_ins)
        clock_out  = max(check_outs) if check_outs else None
        hours      = round((clock_out - clock_in).total_seconds() / 3600, 2) if clock_out else None

        entries.append({
            "employeeNumber": emp_code,
            "date":           str(sync_date),
            "quantity":       hours if hours is not None else 0,
            "status":         "Open",
            # Internal fields used for logging — not sent to BC
            "_clock_in":      clock_in.strftime("%H:%M:%S"),
            "_clock_out":     clock_out.strftime("%H:%M:%S") if clock_out else None,
        })
    return entries


async def push_attendance(
    db: Session,
    sync_date: Optional[date] = None,
    triggered_by: str = "scheduler",
) -> Dict[str, Any]:
    """
    Build time entries for sync_date (defaults to yesterday) and POST to BC.
    """
    if sync_date is None:
        sync_date = date.today() - timedelta(days=1)

    result = {
        "sync_date":      str(sync_date),
        "triggered_by":   triggered_by,
        "started_at":     datetime.now(timezone.utc).isoformat(),
        "status":         "failed",
        "records_built":  0,
        "records_sent":   0,
        "records_failed": 0,
        "message":        "",
    }

    cfg = get_bc_config(db)
    if not cfg:
        result["message"] = "Business Central not configured — add credentials in Settings → BC Integration"
        _log_sync(db, result)
        return result

    if not cfg["is_enabled"]:
        result["status"]  = "skipped"
        result["message"] = "Integration is disabled"
        _log_sync(db, result)
        return result

    if not cfg.get("company_id"):
        result["message"] = "No BC company selected — open Settings → BC Integration and select a company"
        _log_sync(db, result)
        return result

    entries = _build_time_entries(db, sync_date)
    result["records_built"] = len(entries)

    if not entries:
        result["status"]  = "success"
        result["message"] = f"No attendance records found for {sync_date}"
        _log_sync(db, result)
        return result

    token, err = await _get_token(cfg)
    if err:
        result["message"] = f"Authentication failed: {err}"
        _log_sync(db, result)
        return result

    url     = f"{_bc_base(cfg)}/companies({cfg['company_id']})/timeRegistrationEntries"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    sent = failed = 0
    async with httpx.AsyncClient(timeout=30) as client:
        for entry in entries:
            # Strip internal fields before sending
            payload = {k: v for k, v in entry.items() if not k.startswith("_")}
            try:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code in (200, 201, 204):
                    sent += 1
                else:
                    logger.warning(
                        f"BC rejected entry for {entry['employeeNumber']}: "
                        f"HTTP {resp.status_code} — {resp.text[:200]}"
                    )
                    failed += 1
            except httpx.RequestError as e:
                logger.error(f"BC request error for {entry['employeeNumber']}: {e}")
                failed += 1

    result["records_sent"]   = sent
    result["records_failed"] = failed
    result["status"] = "success" if failed == 0 else ("partial" if sent > 0 else "failed")
    result["message"] = (
        f"Sent {sent}/{len(entries)} time entries to Business Central for {sync_date}"
        + (f" ({failed} failed)" if failed else "")
    )
    _log_sync(db, result)
    logger.info(f"Business Central sync [{result['status']}]: {result['message']}")
    return result


async def test_connection(cfg: Dict) -> Dict[str, Any]:
    """Verify Azure AD credentials and BC API access."""
    token, err = await _get_token(cfg)
    if err:
        return {"success": False, "message": err}

    companies, err = await fetch_companies(cfg)
    if err:
        return {"success": False, "message": f"Authenticated but cannot reach BC API: {err}"}

    if not companies:
        return {"success": True, "message": "Connected — no companies found (check API permissions)", "companies": []}

    return {
        "success":   True,
        "message":   f"Connected — {len(companies)} company/companies found",
        "companies": companies,
    }


# ── Sync log ──────────────────────────────────────────────────────────────────

def _log_sync(db: Session, result: Dict):
    try:
        db.execute(text("""
            INSERT INTO bc_sync_log
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
        logger.warning(f"Could not write bc_sync_log: {e}")
        db.rollback()
