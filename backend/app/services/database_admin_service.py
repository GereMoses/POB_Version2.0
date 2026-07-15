"""
Database administration service — powers the Settings → Database tab.

Features:
  • Overview: size, tables, connections, live POB / occupancy, largest tables
  • Occupancy control: instant reset (check everyone out) + age-based auto-checkout
  • Maintenance: VACUUM ANALYZE (optimize) and REINDEX
  • Data retention: purge old records (punches, access logs, notifications) after N days
  • Integrity: scan for + fix stale/orphaned records (future punches, dangling refs)

Settings are persisted in sys_parameters (module='database'). The same logic is
reused by the daily Celery auto-checkout task, so the scheduled job and the manual
button always behave identically.
"""

import logging
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..core.database import engine
from ..core.config import settings as app_settings

logger = logging.getLogger(__name__)

# ── Config keys (stored in sys_parameters, module='database') ───────────────
K_AUTO_CHECKOUT_ENABLED = "database.auto_checkout_enabled"
K_AUTO_CHECKOUT_DAYS    = "database.auto_checkout_days"
# Retention: {key: (label, table, timestamp_column)} — only verified tables.
RETENTION_TARGETS = {
    "punches":       ("Biometric punches",      "iclock_transaction",     "punch_time"),
    "access_logs":   ("Access logs",            "access_logs",            "timestamp"),
    "sys_notifs":    ("System notifications",   "sys_notifications",      "created_at"),
    "emerg_notifs":  ("Emergency notifications", "emergency_notification", "created_at"),
}
K_RETENTION_PREFIX = "database.retention."   # + <target_key> = days (0/blank = keep forever)

DEFAULT_AUTO_CHECKOUT_DAYS = 1


# ── SystemParameter helpers ────────────────────────────────────────────────────

def _get_param(db: Session, key: str, default=None):
    row = db.execute(
        text("SELECT param_value, param_type FROM sys_parameters WHERE param_key = :k"),
        {"k": key},
    ).fetchone()
    if not row or row.param_value is None:
        return default
    val, ptype = row.param_value, row.param_type
    try:
        if ptype == "bool":
            return str(val).lower() in ("true", "1", "yes")
        if ptype == "int":
            return int(val)
    except (ValueError, TypeError):
        return default
    return val


def _set_param(db: Session, key: str, value, ptype: str = "string"):
    if isinstance(value, bool):
        ptype, sval = "bool", "true" if value else "false"
    elif isinstance(value, int):
        ptype, sval = "int", str(value)
    else:
        sval = "" if value is None else str(value)
    db.execute(text("""
        INSERT INTO sys_parameters (param_key, param_value, param_type, module)
        VALUES (:k, :v, :t, 'database')
        ON CONFLICT (param_key) DO UPDATE SET param_value = EXCLUDED.param_value,
                                              param_type  = EXCLUDED.param_type
    """), {"k": key, "v": sval, "t": ptype})


# ── Settings ───────────────────────────────────────────────────────────────────

def get_settings(db: Session) -> dict:
    retention = {}
    for key, (label, _tbl, _col) in RETENTION_TARGETS.items():
        retention[key] = {
            "label": label,
            "days":  int(_get_param(db, K_RETENTION_PREFIX + key, 0) or 0),
        }
    return {
        "auto_checkout_enabled": bool(_get_param(db, K_AUTO_CHECKOUT_ENABLED, False)),
        "auto_checkout_days":    int(_get_param(db, K_AUTO_CHECKOUT_DAYS, DEFAULT_AUTO_CHECKOUT_DAYS) or DEFAULT_AUTO_CHECKOUT_DAYS),
        "retention":             retention,
    }


def save_settings(db: Session, payload: dict) -> dict:
    if "auto_checkout_enabled" in payload:
        _set_param(db, K_AUTO_CHECKOUT_ENABLED, bool(payload["auto_checkout_enabled"]))
    if "auto_checkout_days" in payload:
        days = max(0, int(payload["auto_checkout_days"] or 0))
        _set_param(db, K_AUTO_CHECKOUT_DAYS, days)
    for key in RETENTION_TARGETS:
        rp = (payload.get("retention") or {}).get(key)
        if rp is not None and "days" in rp:
            _set_param(db, K_RETENTION_PREFIX + key, max(0, int(rp["days"] or 0)))
    db.commit()
    return get_settings(db)


# ── Overview ───────────────────────────────────────────────────────────────────

def _live_occupancy_count(db: Session) -> int:
    """Distinct employees whose latest punch is an entry at a zone-assigned reader."""
    row = db.execute(text("""
        SELECT COUNT(DISTINCT latest.emp_code) AS cnt
        FROM (SELECT DISTINCT ON (t.emp_code) t.emp_code, t.punch_state, t.terminal_sn
              FROM iclock_transaction t ORDER BY t.emp_code, t.punch_time DESC) latest
        JOIN iclock_terminal term ON term.sn = latest.terminal_sn
        WHERE latest.punch_state IN (0, 4) AND term.zone_id IS NOT NULL
    """)).fetchone()
    return int(row.cnt or 0)


def get_overview(db: Session) -> dict:
    size = db.execute(text("SELECT pg_size_pretty(pg_database_size(current_database())) AS s, pg_database_size(current_database()) AS b")).fetchone()
    tables = db.execute(text("SELECT count(*) AS c FROM information_schema.tables WHERE table_schema='public'")).scalar()
    conns  = db.execute(text("SELECT count(*) AS c FROM pg_stat_activity WHERE datname = current_database()")).scalar()
    version = db.execute(text("SHOW server_version")).scalar()
    pob = db.execute(text("SELECT count(*) FROM personnel WHERE is_onboard=TRUE AND is_active=TRUE")).scalar()
    largest = db.execute(text("""
        SELECT relname AS name, pg_size_pretty(pg_total_relation_size(relid)) AS size,
               n_live_tup AS rows
        FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 8
    """)).fetchall()
    return {
        "db_size":            size.s,
        "db_size_bytes":      int(size.b),
        "table_count":        int(tables or 0),
        "active_connections": int(conns or 0),
        "postgres_version":   version,
        "personnel_onboard":  int(pob or 0),
        "live_occupancy":     _live_occupancy_count(db),
        "largest_tables":     [{"name": r.name, "size": r.size, "rows": int(r.rows or 0)} for r in largest],
    }


# ── Occupancy control ──────────────────────────────────────────────────────────

def _checkout_query(where_extra: str = "") -> str:
    """Insert a CHECK_OUT for every employee whose latest punch is an entry at a
    zone reader (optionally only those older than a cutoff). Mirrors zones.reset_occupancy."""
    return f"""
        INSERT INTO iclock_transaction (emp_code, punch_time, punch_state, verify_type, terminal_sn)
        SELECT latest.emp_code, now(), 1, 0, latest.terminal_sn
        FROM (SELECT DISTINCT ON (t.emp_code) t.emp_code, t.punch_state, t.terminal_sn, t.punch_time
              FROM iclock_transaction t ORDER BY t.emp_code, t.punch_time DESC) latest
        JOIN iclock_terminal term ON term.sn = latest.terminal_sn
        WHERE latest.punch_state IN (0, 4) AND term.zone_id IS NOT NULL
        {where_extra}
    """


def reset_all_occupancy(db: Session) -> dict:
    """Instant full reset: check everyone out, clear onboard flags, zone pointers,
    and stored counters. For use when the facility is known to be empty."""
    checked_out = db.execute(text(_checkout_query())).rowcount or 0
    onboard = db.execute(text(
        "UPDATE personnel SET is_onboard=FALSE, is_pob=FALSE, pob_since=NULL WHERE is_onboard=TRUE"
    )).rowcount or 0
    db.execute(text("UPDATE personnel SET current_zone_id=NULL WHERE current_zone_id IS NOT NULL"))
    db.execute(text("UPDATE zones SET current_personnel_count=0, current_occupancy=0 "
                    "WHERE current_personnel_count<>0 OR current_occupancy<>0"))
    db.commit()
    logger.info("reset_all_occupancy: checked_out=%s, onboard_cleared=%s", checked_out, onboard)
    return {"checked_out": checked_out, "onboard_cleared": onboard}


def auto_checkout_stale(db: Session, days: int) -> dict:
    """Check out anyone whose LAST punch was an entry more than `days` days ago
    (a forgotten check-in with no activity since). Does not touch people with any
    recent activity, so it never evicts someone legitimately still on site."""
    days = max(0, int(days))
    where = "AND latest.punch_time < now() - (:days || ' days')::interval"
    n = db.execute(text(_checkout_query(where)), {"days": days}).rowcount or 0
    db.commit()
    logger.info("auto_checkout_stale(days=%s): checked_out=%s", days, n)
    return {"checked_out": n, "days": days}


# ── Maintenance (VACUUM / REINDEX need autocommit — cannot run in a transaction) ─

def run_maintenance(kind: str) -> dict:
    started = datetime.now(timezone.utc)
    dbname = app_settings.DATABASE_NAME
    if kind == "vacuum":
        sql = "VACUUM (ANALYZE)"
    elif kind == "reindex":
        sql = f'REINDEX DATABASE CONCURRENTLY "{dbname}"'
    elif kind == "analyze":
        sql = "ANALYZE"
    else:
        raise ValueError("Unknown maintenance kind")
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.exec_driver_sql(sql)
    secs = (datetime.now(timezone.utc) - started).total_seconds()
    logger.info("maintenance %s completed in %.1fs", kind, secs)
    return {"kind": kind, "duration_seconds": round(secs, 1), "statement": sql}


# ── Data retention ─────────────────────────────────────────────────────────────

def _retention_plan(db: Session):
    """Yield (key, label, table, col, days) for each target with a positive retention."""
    for key, (label, table, col) in RETENTION_TARGETS.items():
        days = int(_get_param(db, K_RETENTION_PREFIX + key, 0) or 0)
        if days > 0:
            yield key, label, table, col, days


def retention_preview(db: Session) -> dict:
    items = []
    for key, label, table, col, days in _retention_plan(db):
        cnt = db.execute(text(
            f"SELECT count(*) FROM {table} WHERE {col} < now() - (:d || ' days')::interval"
        ), {"d": days}).scalar()
        items.append({"key": key, "label": label, "days": days, "rows_to_delete": int(cnt or 0)})
    return {"items": items, "total_rows": sum(i["rows_to_delete"] for i in items)}


def retention_purge(db: Session) -> dict:
    deleted = []
    for key, label, table, col, days in _retention_plan(db):
        n = db.execute(text(
            f"DELETE FROM {table} WHERE {col} < now() - (:d || ' days')::interval"
        ), {"d": days}).rowcount or 0
        deleted.append({"key": key, "label": label, "days": days, "deleted": n})
    db.commit()
    logger.info("retention_purge: %s", deleted)
    return {"deleted": deleted, "total_deleted": sum(d["deleted"] for d in deleted)}


# ── Integrity scan / fix ───────────────────────────────────────────────────────

_INTEGRITY_CHECKS = [
    ("future_punches", "Future-dated punches (corrupt clock)",
     "SELECT count(*) FROM iclock_transaction WHERE punch_time > now()",
     "DELETE FROM iclock_transaction WHERE punch_time > now()"),
    ("orphan_current_zone", "Personnel pointing at a deleted zone",
     "SELECT count(*) FROM personnel p WHERE p.current_zone_id IS NOT NULL "
     "AND NOT EXISTS (SELECT 1 FROM zones z WHERE z.id = p.current_zone_id)",
     "UPDATE personnel SET current_zone_id=NULL WHERE current_zone_id IS NOT NULL "
     "AND NOT EXISTS (SELECT 1 FROM zones z WHERE z.id = current_zone_id)"),
    ("orphan_event_muster_zone", "Mustering events referencing a deleted muster zone",
     "SELECT count(*) FROM mustering_event m WHERE m.muster_zone_id IS NOT NULL "
     "AND NOT EXISTS (SELECT 1 FROM zones z WHERE z.id = m.muster_zone_id)",
     "UPDATE mustering_event SET muster_zone_id=NULL WHERE muster_zone_id IS NOT NULL "
     "AND NOT EXISTS (SELECT 1 FROM zones z WHERE z.id = muster_zone_id)"),
    ("onboard_no_zone", "Onboard flag set but not in any zone (possible stale POB)",
     "SELECT count(*) FROM personnel WHERE is_onboard=TRUE AND current_zone_id IS NULL",
     None),  # informational only — not auto-fixed (could be legitimate)
]


def integrity_scan(db: Session) -> dict:
    items = []
    for key, label, check_sql, fix_sql in _INTEGRITY_CHECKS:
        cnt = db.execute(text(check_sql)).scalar()
        items.append({
            "key": key, "label": label, "count": int(cnt or 0),
            "fixable": fix_sql is not None,
        })
    return {"items": items, "total_issues": sum(i["count"] for i in items)}


def integrity_fix(db: Session) -> dict:
    fixed = []
    for key, label, _check_sql, fix_sql in _INTEGRITY_CHECKS:
        if not fix_sql:
            continue
        n = db.execute(text(fix_sql)).rowcount or 0
        fixed.append({"key": key, "label": label, "fixed": n})
    db.commit()
    logger.info("integrity_fix: %s", fixed)
    return {"fixed": fixed, "total_fixed": sum(f["fixed"] for f in fixed)}
