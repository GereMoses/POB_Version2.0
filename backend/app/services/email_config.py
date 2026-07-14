"""
Database-backed email configuration (UI-managed, per-deployment).

Customers configure their OWN sending domain + SMTP server from the Settings UI —
nothing lives in backend env in production. Values are stored in `sys_parameters`
under the `email.` namespace; secrets (SMTP password, DKIM private key) are
encrypted at rest via app.core.crypto.

This module also generates the DKIM keypair and the SPF/DKIM/DMARC DNS records the
customer must publish for their domain, so the whole domain-authentication flow is
self-service from the UI.
"""

from __future__ import annotations

import base64
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from ..core.crypto import decrypt_secret, encrypt_secret
from ..models.system import SystemParameter

logger = logging.getLogger(__name__)

_MODULE = "notification"
_PREFIX = "email."

# key -> (is_secret, is_bool)
_FIELDS = {
    "enabled": (False, True),
    "smtp_host": (False, False),
    "smtp_port": (False, False),
    "smtp_user": (False, False),
    "smtp_password": (True, False),
    "from_address": (False, False),
    "from_name": (False, False),
    "use_tls": (False, True),
    "sending_domain": (False, False),
    "dkim_selector": (False, False),
    "dkim_private_key": (True, False),
    "dkim_public_key": (False, False),
}

_DEFAULTS = {
    "enabled": False,
    "smtp_host": "",
    "smtp_port": "587",
    "smtp_user": "",
    "smtp_password": "",
    "from_address": "",
    "from_name": "Apex POB",
    "use_tls": True,
    "sending_domain": "",
    "dkim_selector": "pob",
    "dkim_private_key": "",
    "dkim_public_key": "",
}


def get_email_settings(db: Session) -> Dict[str, Any]:
    """Return the full email config (secrets decrypted). Missing keys use defaults."""
    rows = (
        db.query(SystemParameter)
        .filter(SystemParameter.param_key.like(f"{_PREFIX}%"))
        .all()
    )
    stored = {r.param_key[len(_PREFIX):]: r.param_value for r in rows}

    out: Dict[str, Any] = {}
    for key, (is_secret, is_bool) in _FIELDS.items():
        raw = stored.get(key)
        if raw is None:
            out[key] = _DEFAULTS[key]
            continue
        if is_secret:
            out[key] = decrypt_secret(raw)
        elif is_bool:
            out[key] = str(raw).lower() in ("true", "1", "yes", "on")
        else:
            out[key] = raw
    return out


def save_email_settings(db: Session, data: Dict[str, Any], updated_by: str = None) -> Dict[str, Any]:
    """Upsert email config. Secrets are encrypted; a blank secret is left unchanged
    (so the UI can save without re-sending the password every time)."""
    for key, value in data.items():
        if key not in _FIELDS:
            continue
        is_secret, is_bool = _FIELDS[key]

        # Blank secret from the UI = "keep existing" — don't overwrite with empty.
        if is_secret and (value is None or value == ""):
            continue

        if is_bool:
            store_val = "true" if (value is True or str(value).lower() in ("true", "1", "yes", "on")) else "false"
        elif is_secret:
            store_val = encrypt_secret(str(value))
        else:
            store_val = "" if value is None else str(value)

        _upsert_param(db, _PREFIX + key, store_val, is_secret, updated_by)

    db.commit()
    return get_email_settings(db)


def _upsert_param(db: Session, key: str, value: str, is_secret: bool, updated_by: str = None):
    param = db.query(SystemParameter).filter(SystemParameter.param_key == key).first()
    if param:
        param.param_value = value
        param.is_encrypted = is_secret
        if updated_by:
            param.updated_by = updated_by
    else:
        db.add(SystemParameter(
            param_key=key,
            param_value=value,
            param_type="string",
            module=_MODULE,
            description=f"Email configuration: {key[len(_PREFIX):]}",
            is_public=False,
            is_encrypted=is_secret,
            updated_by=updated_by,
        ))


def db_smtp_configured(db: Session) -> bool:
    """True if a usable SMTP host is stored in the DB (used to prefer DB over env)."""
    row = (
        db.query(SystemParameter)
        .filter(SystemParameter.param_key == f"{_PREFIX}smtp_host")
        .first()
    )
    return bool(row and row.param_value and row.param_value.strip())


# ── DKIM keypair ─────────────────────────────────────────────────────────────

def generate_dkim_keypair() -> Dict[str, str]:
    """Generate a fresh RSA-2048 DKIM keypair.

    Returns {"private_pem": ..., "public_b64": ...}. The public key goes into the
    DKIM DNS TXT record; the private key is stored encrypted and used to sign mail.
    Uses `cryptography` directly so it works without the dkimpy signing library.
    """
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_der = key.public_key().public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    public_b64 = base64.b64encode(public_der).decode("ascii")
    return {"private_pem": private_pem, "public_b64": public_b64}


# ── DNS records the customer must publish ────────────────────────────────────

def build_dns_records(settings: Dict[str, Any]) -> List[Dict[str, str]]:
    """Build the SPF / DKIM / DMARC records for the configured sending domain.

    Returns a list of {type, host, value, purpose, status} the UI can render with
    copy buttons. Empty list if no sending domain is set yet.
    """
    domain = (settings.get("sending_domain") or "").strip().lower()
    if not domain:
        return []

    selector = (settings.get("dkim_selector") or "pob").strip()
    smtp_host = (settings.get("smtp_host") or "").strip().lower()
    public_b64 = (settings.get("dkim_public_key") or "").strip()

    records: List[Dict[str, str]] = []

    # SPF — authorise the domain's own A/MX and (if it's a hostname) the SMTP server.
    spf_mechanisms = ["a", "mx"]
    if smtp_host and not _looks_like_ip(smtp_host) and smtp_host not in ("localhost",):
        spf_mechanisms.append(f"a:{smtp_host}")
    spf_value = "v=spf1 " + " ".join(spf_mechanisms) + " ~all"
    records.append({
        "type": "TXT",
        "host": domain,
        "value": spf_value,
        "purpose": "SPF — authorises your servers to send mail for this domain",
    })

    # DKIM — publishes the public key at <selector>._domainkey.<domain>
    if public_b64:
        records.append({
            "type": "TXT",
            "host": f"{selector}._domainkey.{domain}",
            "value": f"v=DKIM1; k=rsa; p={public_b64}",
            "purpose": "DKIM — lets receivers verify mail was signed by you (not forged)",
        })
    else:
        records.append({
            "type": "TXT",
            "host": f"{selector}._domainkey.{domain}",
            "value": "",
            "purpose": "DKIM — click 'Generate DKIM key' first, then this record appears",
        })

    # DMARC — policy + reporting
    records.append({
        "type": "TXT",
        "host": f"_dmarc.{domain}",
        "value": f"v=DMARC1; p=none; rua=mailto:dmarc@{domain}; fo=1; adkim=r; aspf=r",
        "purpose": "DMARC — tells receivers what to do with unauthenticated mail (start with p=none)",
    })

    return records


def _looks_like_ip(host: str) -> bool:
    parts = host.split(".")
    return len(parts) == 4 and all(p.isdigit() for p in parts)
