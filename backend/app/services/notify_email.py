"""
Shared, env-configured SMTP email sender.

One place every alert (emergency, mustering, …) sends email through, so a single
set of SMTP env vars turns notifications on everywhere. Accepts BOTH naming
conventions already used in the codebase so existing config keeps working:

  SMTP_HOST      or SMTP_SERVER      (host — required to enable sending)
  SMTP_PORT                          (default 587)
  SMTP_USER      or SMTP_USERNAME    (login user; also the default From)
  SMTP_PASSWORD                      (login password / app password)
  EMAIL_FROM     or FROM_EMAIL       (From address; defaults to the user)
  SMTP_USE_TLS                       ("false" to disable STARTTLS; default on)

Never raises — returns {"sent": N, "failed": [...], "error"?: str} so a mail
outage can never break the flow that triggered it (avoids worker starvation).
"""

from __future__ import annotations

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Iterable, List, Union

logger = logging.getLogger(__name__)


def _host() -> str:
    return os.getenv("SMTP_HOST") or os.getenv("SMTP_SERVER") or ""


def smtp_configured() -> bool:
    """True if an SMTP host is set — lets callers skip/queue when email is off."""
    return bool(_host())


def send_email(
    to: Union[str, Iterable[str]],
    subject: str,
    body_html: str,
    body_text: str | None = None,
) -> Dict[str, object]:
    """Send one email (to one or many recipients) via env-configured SMTP.

    Returns {"sent": N, "failed": [addr, ...], "error"?: str}. Fails soft: an
    unconfigured or unreachable server yields sent=0 with a clear error, never
    an exception.
    """
    recipients: List[str] = [to] if isinstance(to, str) else [r for r in to if r]
    recipients = [r.strip() for r in recipients if r and r.strip()]
    if not recipients:
        return {"sent": 0, "failed": [], "error": "no recipients with an email address"}

    host = _host()
    if not host:
        return {
            "sent": 0,
            "failed": recipients,
            "error": "SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM",
        }

    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER") or os.getenv("SMTP_USERNAME") or ""
    password = os.getenv("SMTP_PASSWORD", "")
    sender = os.getenv("EMAIL_FROM") or os.getenv("FROM_EMAIL") or user or "no-reply@pob"
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() != "false"

    sent, failed = 0, []
    try:
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.ehlo()
            if use_tls:
                try:
                    server.starttls()
                    server.ehlo()
                except Exception:
                    pass  # server without STARTTLS (e.g. local catcher) — continue plain
            if user:
                server.login(user, password)
            for addr in recipients:
                try:
                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = subject
                    msg["From"] = sender
                    msg["To"] = addr
                    if body_text:
                        msg.attach(MIMEText(body_text, "plain"))
                    msg.attach(MIMEText(body_html, "html"))
                    server.sendmail(sender, [addr], msg.as_string())
                    sent += 1
                except Exception as exc:  # noqa: BLE001 — one bad address must not fail the rest
                    failed.append(addr)
                    logger.warning("Email to %s failed: %s", addr, exc)
        logger.info("notify_email: sent %d, failed %d (subject=%r)", sent, len(failed), subject)
        return {"sent": sent, "failed": failed}
    except Exception as exc:  # noqa: BLE001 — connection/auth error must not raise
        logger.error("notify_email: SMTP send failed (%s:%s): %s", host, port, exc)
        return {"sent": 0, "failed": recipients, "error": str(exc)}
