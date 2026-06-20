"""
Shared attendance-export source for HR/payroll integrations (SeamlessHR, Business Central).

WHY THIS EXISTS
---------------
Both integrations previously built their payloads from RAW iclock_transaction rows using a
first-punch/last-punch heuristic. That was wrong in three ways:

  • Access-control door swipes are written to iclock_transaction too (ADMS writes a T&A row
    for ACCESS_ENTRY/EXIT readers), so "first swipe → last swipe" billed door movement as
    work hours — systematically over-stating time.
  • A single `punch_time::date` filter mis-attributed cross-midnight / night shifts.
  • The day boundary was UTC, splitting local workdays.

The system already computes correct, shift-aware, break-aware, reader_purpose-respecting
attendance into the `att_report` table (via attendance_calculation_service). This module makes
that the single source of truth for BOTH exporters, and attaches a stable idempotency key per
(employee, date) so re-runs/retries cannot double-post to payroll.
"""

import ipaddress
import logging
import socket
from datetime import date
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse

from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)


def build_daily_attendance(db: Session, sync_date: date) -> List[Dict[str, Any]]:
    """Return canonical, payroll-grade attendance for `sync_date`, one record per employee.

    Source: att_report (computed attendance), joined to personnel_employee for emp_code.
    Only rows with an actual check-in are returned (absent days are skipped). Each record:

        {
          "emp_code":         "EMP001",
          "att_date":         date(2026, 6, 6),
          "check_in":         datetime|None,   # tz-aware (timestamptz from att_report)
          "check_out":        datetime|None,   # tz-aware
          "work_minutes":     int,             # shift/break-aware, computed
          "overtime_minutes": int,
          "idempotency_key":  "pob-EMP001-2026-06-06",
        }
    """
    try:
        rows = db.execute(text("""
            SELECT pe.emp_code,
                   ar.att_date,
                   ar.check_in,
                   ar.check_out,
                   COALESCE(ar.work_minutes, 0)     AS work_minutes,
                   COALESCE(ar.overtime_minutes, 0) AS overtime_minutes
            FROM att_report ar
            JOIN personnel_employee pe ON pe.id = ar.emp_id
            WHERE ar.att_date = :d
              AND ar.check_in IS NOT NULL
              AND pe.emp_code IS NOT NULL
              AND pe.emp_code <> ''
            ORDER BY pe.emp_code
        """), {"d": sync_date}).fetchall()
    except Exception as e:
        # att_report missing (calc never run) or query error — return nothing rather than
        # silently falling back to the buggy raw-punch path.
        logger.error("attendance_export: could not read att_report for %s: %s", sync_date, e)
        return []

    if not rows:
        logger.warning(
            "attendance_export: att_report has no computed attendance for %s — "
            "has the attendance calculation run for that day?", sync_date,
        )

    records: List[Dict[str, Any]] = []
    for r in rows:
        records.append({
            "emp_code":         r.emp_code,
            "att_date":         r.att_date,
            "check_in":         r.check_in,
            "check_out":        r.check_out,
            "work_minutes":     int(r.work_minutes or 0),
            "overtime_minutes": int(r.overtime_minutes or 0),
            "idempotency_key":  f"pob-{r.emp_code}-{r.att_date}",
        })
    return records


# ── Integration base-URL safety (SSRF + TLS enforcement) ──────────────────────

class IntegrationUrlError(ValueError):
    """Raised when an integration base URL is unsafe to call."""


def validate_integration_base_url(url: str) -> str:
    """Validate an operator-supplied integration base URL before the server will send
    a bearer credential to it.

    Enforces:
      • https only — never send an API key over cleartext http.
      • host is not a private / loopback / link-local / reserved address (SSRF guard —
        blocks pointing the connector at internal services or the cloud metadata endpoint).

    Returns the normalised URL (trailing slash stripped) or raises IntegrationUrlError.
    """
    if not url or not url.strip():
        raise IntegrationUrlError("API base URL is required")

    parsed = urlparse(url.strip())

    if parsed.scheme != "https":
        raise IntegrationUrlError("API base URL must use https:// (the API key is sent in the request)")

    host = parsed.hostname
    if not host:
        raise IntegrationUrlError("API base URL has no host")

    # Resolve and reject private/loopback/link-local/reserved targets.
    addrs = set()
    try:
        addrs.add(ipaddress.ip_address(host))  # host is already an IP literal
    except ValueError:
        # Hostname — resolve all A/AAAA records and check each.
        try:
            for info in socket.getaddrinfo(host, None):
                try:
                    addrs.add(ipaddress.ip_address(info[4][0]))
                except ValueError:
                    continue
        except Exception:
            # DNS failure: don't hard-fail config save on a transient resolver issue,
            # but a name that won't resolve also can't be an SSRF target right now.
            return url.strip().rstrip("/")

    for addr in addrs:
        if (addr.is_private or addr.is_loopback or addr.is_link_local
                or addr.is_reserved or addr.is_multicast or addr.is_unspecified):
            raise IntegrationUrlError(
                f"API base URL resolves to a non-public address ({addr}) — refused to prevent "
                "the server from being pointed at internal services."
            )

    return url.strip().rstrip("/")
