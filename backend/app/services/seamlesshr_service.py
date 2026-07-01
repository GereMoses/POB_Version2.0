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

# ── Connector options (all tunable from the DB/UI — no code change needed) ─────
# Defaults reproduce the original behaviour exactly, so an unconfigured `options`
# column changes nothing. Any HR API's quirks are absorbed here.
_DEFAULT_OPTIONS: Dict[str, Any] = {
    "auth_type":          "bearer",              # bearer | api_key | basic | oauth2
    "org_header_name":    "X-Organization-ID",
    "payload_wrapper_key": "records",            # "" ⇒ send a bare JSON array
    "batch_size":         50,
    "http_method":        "POST",
    "employee_id_source": "emp_code",            # emp_code | badge_id | biotime_employee_id
    "time_format":        "iso",                 # iso | hms (HH:MM:SS)
    "field_map":          {},                    # canonical → output key ("" ⇒ omit field)
    "extra_headers":      {},                    # arbitrary static headers
    # OAuth2 client-credentials (client_secret reuses the encrypted api_key):
    "oauth_token_url":    "",
    "oauth_client_id":    "",
    "oauth_scope":        "",
    "basic_user":         "",                    # for auth_type=basic
}

# Cached OAuth2 token: {"token": str, "exp": epoch_seconds}
_oauth_cache: Dict[str, Any] = {"token": None, "exp": 0.0}


def _merge_options(raw: Optional[Dict]) -> Dict[str, Any]:
    opts = dict(_DEFAULT_OPTIONS)
    if isinstance(raw, dict):
        opts.update({k: v for k, v in raw.items() if v is not None})
    return opts


# ── Config helpers ────────────────────────────────────────────────────────────

def get_config(db: Session) -> Optional[Dict[str, Any]]:
    """Load integration config from DB. Returns None if not configured."""
    try:
        row = db.execute(text(
            "SELECT api_base_url, api_key, org_id, auth_header_name, "
            "       attendance_endpoint, employee_endpoint, is_enabled, sync_time, options "
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
            "options":             _merge_options(row[8] if len(row) > 8 else None),
        }
    except Exception as e:
        logger.warning(f"hr_integration_config read error: {e}")  # Bug 4 fix: WARNING not DEBUG
        return None


async def _get_oauth_token(cfg: Dict) -> str:
    """Fetch + cache an OAuth2 client-credentials token (client_secret = api_key)."""
    import time
    opts = cfg["options"]
    if _oauth_cache["token"] and _oauth_cache["exp"] > time.time() + 30:
        return _oauth_cache["token"]
    data = {"grant_type": "client_credentials",
            "client_id": opts.get("oauth_client_id") or cfg.get("org_id") or "",
            "client_secret": cfg["api_key"]}
    if opts.get("oauth_scope"):
        data["scope"] = opts["oauth_scope"]
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(opts["oauth_token_url"], data=data)
    resp.raise_for_status()
    body = resp.json()
    _oauth_cache["token"] = body["access_token"]
    _oauth_cache["exp"] = time.time() + int(body.get("expires_in", 3600))
    return _oauth_cache["token"]


async def build_auth_headers(cfg: Dict) -> Dict[str, str]:
    """Build auth headers per the configured scheme. Async because OAuth2 fetches a token."""
    opts = cfg["options"]
    name = cfg["auth_header_name"] or "Authorization"
    key  = cfg["api_key"]
    at   = opts.get("auth_type", "bearer")
    if at == "api_key":
        return {name: key}
    if at == "basic":
        import base64
        tok = base64.b64encode(f"{opts.get('basic_user','')}:{key}".encode()).decode()
        return {"Authorization": f"Basic {tok}"}
    if at == "oauth2":
        return {name: f"Bearer {await _get_oauth_token(cfg)}"}
    # default: bearer
    return {name: f"Bearer {key}"}


def _to_payload(r: Dict, opts: Dict, emp_map: Dict[str, str]) -> Dict:
    """Map an internal canonical record to the outbound JSON per configured field
    names / employee-id source / time format. A field mapped to "" is omitted."""
    fm = opts.get("field_map") or {}
    tf = opts.get("time_format", "iso")
    src = opts.get("employee_id_source", "emp_code")
    emp_val = emp_map.get(r["employee_id"], r["employee_id"]) if (src != "emp_code" and emp_map) else r["employee_id"]

    def _t(v):
        if v and tf == "hms":
            try: return datetime.fromisoformat(v).strftime("%H:%M:%S")
            except ValueError: return v
        return v

    out: Dict[str, Any] = {}
    for canon, val in (("employee_id", emp_val), ("date", r["date"]),
                       ("clock_in", _t(r["clock_in"])), ("clock_out", _t(r["clock_out"])),
                       ("total_minutes", r["total_minutes"]), ("overtime_minutes", r["overtime_minutes"]),
                       ("source", r["source"]), ("idempotency_key", r["idempotency_key"])):
        key = fm.get(canon, canon)
        if key != "":
            out[key] = val
    return out


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
    force: bool = False,
    allow_today: bool = False,
) -> Dict[str, Any]:
    """
    Build attendance records for sync_date (defaults to yesterday) and
    POST them to SeamlessHR. Logs the result to hr_sync_log.

    Idempotency: each (employee, date) is sent at most once — already-sent records are
    skipped so a re-run/retry cannot double-post to payroll.
      • force=True       — re-send even if already sent (admin correction; may duplicate).
      • allow_today=True — permit syncing a not-yet-finalized day (today/future).
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

    # Don't post a not-yet-finalized day (today/future) to payroll unless explicitly allowed.
    if not allow_today and not force and sync_date >= date.today():
        result["status"]  = "skipped"
        result["message"] = f"{sync_date} is not finalized yet — payroll syncs after the day closes"
        _log_sync(db, result)
        return result

    records = _build_attendance_records(db, sync_date)
    result["records_built"] = len(records)

    if not records:
        result["status"]  = "success"
        result["message"] = f"No attendance records found for {sync_date}"
        _log_sync(db, result)
        return result

    # Idempotency: drop employee-days already sent for this date (unless force re-send).
    if not force:
        from .attendance_export import already_synced_codes
        done = already_synced_codes(db, "hr_synced_records", sync_date)
        if done:
            records = [r for r in records if r["employee_id"] not in done]
        if not records:
            result["status"]  = "success"
            result["message"] = f"All records for {sync_date} already synced — nothing new to send"
            _log_sync(db, result)
            return result

    opts = cfg["options"]
    url     = cfg["api_base_url"] + cfg["attendance_endpoint"]
    headers = {**await build_auth_headers(cfg), "Content-Type": "application/json",
               **(opts.get("extra_headers") or {})}
    if cfg["org_id"] and opts.get("org_header_name"):
        headers[opts["org_header_name"]] = cfg["org_id"]

    # Translate emp_code → alternate employee identifier if configured
    emp_map: Dict[str, str] = {}
    if opts.get("employee_id_source", "emp_code") != "emp_code":
        col = opts["employee_id_source"]
        if col in ("badge_id", "biotime_employee_id"):
            for erow in db.execute(text(f"SELECT emp_code, {col} FROM personnel WHERE emp_code IS NOT NULL")).fetchall():
                if erow[1]:
                    emp_map[erow[0]] = str(erow[1])

    wrapper = opts.get("payload_wrapper_key", "records")
    method  = (opts.get("http_method") or "POST").upper()
    batch_size = int(opts.get("batch_size") or 50)

    failed = 0
    sent   = 0

    try:
        client = await _get_shr_client()
        sent_codes = []
        for i in range(0, len(records), batch_size):
            batch = records[i : i + batch_size]
            payload_list = [_to_payload(r, opts, emp_map) for r in batch]
            body = payload_list if not wrapper else {wrapper: payload_list}
            try:
                resp = await client.request(method, url, json=body, headers=headers)
                if resp.status_code in (200, 201, 204):
                    sent += len(batch)
                    sent_codes.extend(r["employee_id"] for r in batch)
                else:
                    logger.warning(
                        "SeamlessHR batch %d returned %s: %s",
                        i // batch_size + 1, resp.status_code, resp.text[:200],
                    )
                    failed += len(batch)
            except httpx.RequestError as e:
                logger.error("SeamlessHR request error (batch %d): %s", i // batch_size + 1, e)
                failed += len(batch)

        # Record successfully-sent employee-days so a re-run cannot double-post them.
        if sent_codes:
            from .attendance_export import mark_synced
            mark_synced(db, "hr_synced_records", sync_date, sent_codes)

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
    opts = cfg.get("options") or _DEFAULT_OPTIONS
    url     = cfg["api_base_url"] + cfg.get("employee_endpoint", "/v1/employees")
    headers = {**await build_auth_headers(cfg), "Content-Type": "application/json",
               **(opts.get("extra_headers") or {})}
    if cfg.get("org_id") and opts.get("org_header_name"):
        headers[opts["org_header_name"]] = cfg["org_id"]
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
