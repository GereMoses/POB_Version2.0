"""
Subscription / License Management API
======================================
Endpoints:
  GET  /api/v1/subscription/status          — public, frontend polls to detect lock state
  POST /api/v1/subscription/activate        — public, enter renewal key to unlock
  GET  /api/v1/subscription/                — Global Admin only, full dashboard
  POST /api/v1/subscription/setup           — Global Admin only, create/reset subscription
  POST /api/v1/subscription/generate-key    — Global Admin only, produce renewal key

Key algorithm: HMAC-SHA256(LICENSE_SECRET, "{installation_id}:{new_expiry_iso}")
Encoded as base32, formatted: POBK-XXXXX-XXXXX-XXXXX-XXXXX
"""

import hmac
import hashlib
import base64
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _installation_id() -> str:
    """Stable identifier for this deployment, derived from SECRET_KEY."""
    return hashlib.sha256(settings.SECRET_KEY.encode()).hexdigest()[:16].upper()


def _license_secret() -> str:
    return getattr(settings, "LICENSE_SECRET", settings.SECRET_KEY + "-license")


def _generate_key(installation_id: str, new_expiry: str) -> str:
    """Generate HMAC-based renewal key for a given installation + expiry date."""
    msg = f"{installation_id}:{new_expiry}"
    sig = hmac.new(
        _license_secret().encode(),
        msg.encode(),
        hashlib.sha256,
    ).digest()
    b32 = base64.b32encode(sig[:15]).decode().rstrip("=")  # 24 chars
    return f"POBK-{b32[0:5]}-{b32[5:10]}-{b32[10:15]}-{b32[15:20]}"


def _verify_key(key: str, installation_id: str, new_expiry: str) -> bool:
    """Constant-time key verification."""
    expected = _generate_key(installation_id, new_expiry)
    a = key.upper().replace("-", "").replace(" ", "")
    b = expected.upper().replace("-", "")
    return hmac.compare_digest(a, b)


def _get_subscription(db: Session):
    """Return the active subscription row or None."""
    row = db.execute(
        __import__("sqlalchemy").text(
            "SELECT * FROM sys_subscription WHERE is_active = TRUE ORDER BY id DESC LIMIT 1"
        )
    ).fetchone()
    return row


def _normalise_expiry(expiry) -> datetime:
    """Convert a DATE or naive DATETIME from the DB to a timezone-aware datetime (UTC)."""
    if not hasattr(expiry, 'hour'):  # it's a date
        return datetime(expiry.year, expiry.month, expiry.day, tzinfo=timezone.utc)
    return expiry if expiry.tzinfo else expiry.replace(tzinfo=timezone.utc)


def _subscription_status(sub) -> dict:
    """Compute status dict from a subscription row (or None)."""
    if sub is None:
        return {
            "status": "no_license",
            "label": "No Subscription",
            "days_remaining": 0,
            "expiry_date": None,
            "org_name": None,
            "tier": None,
            "installation_id": _installation_id(),
        }

    now = datetime.now(timezone.utc)
    expiry_dt = _normalise_expiry(sub._mapping["expiry_date"])
    delta = expiry_dt - now
    days_remaining = int(delta.total_seconds() / 86400)

    if delta.total_seconds() <= 0:
        status = "expired"
        label = "Expired"
    elif days_remaining <= 14:
        status = "critical"
        label = f"Expires in {days_remaining} day{'s' if days_remaining != 1 else ''}"
    elif days_remaining <= 30:
        status = "warning"
        label = f"Expires in {days_remaining} days"
    else:
        status = "active"
        label = "Active"

    issue = sub._mapping["issue_date"]
    return {
        "status": status,
        "label": label,
        "days_remaining": max(0, days_remaining),
        "expiry_date": expiry_dt.isoformat(),
        "issue_date": issue.isoformat() if hasattr(issue, 'isoformat') else str(issue),
        "org_name": sub._mapping["org_name"],
        "tier": sub._mapping["tier"],
        "max_users": sub._mapping["max_users"],
        "max_employees": sub._mapping["max_employees"],
        "max_devices": sub._mapping["max_devices"],
        "installation_id": sub._mapping["installation_id"],
        "subscription_id": sub._mapping["id"],
    }


def _require_global_admin(current_user):
    """Raise 403 if user is not Global Admin."""
    if not getattr(current_user, "is_global_admin", False):
        raise HTTPException(status_code=403, detail="Global Admin access required")


# ── Request / Response models ─────────────────────────────────────────────────

class ActivateBody(BaseModel):
    key: str
    new_expiry: str       # ISO date: "2027-06-05"


class SetupBody(BaseModel):
    org_name: str
    tier: str = "standard"
    expiry_date: str      # ISO date
    max_users: int = 50
    max_employees: int = 500
    max_devices: int = 20
    notes: Optional[str] = None


class GenerateKeyBody(BaseModel):
    new_expiry: str       # ISO date the vendor is granting


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/status")
async def subscription_status(db: Session = Depends(get_db)):
    """
    Public endpoint — no auth required.
    Frontend polls this on startup to decide whether to show the lock screen.
    """
    sub = _get_subscription(db)
    return {"success": True, "data": _subscription_status(sub)}


@router.post("/activate")
async def activate_subscription(
    body: ActivateBody,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Public endpoint — accepts a renewal key + new expiry date.
    Verifies HMAC, updates subscription, logs the renewal.
    """
    from sqlalchemy import text

    iid = _installation_id()

    if not _verify_key(body.key.strip(), iid, body.new_expiry):
        raise HTTPException(status_code=400, detail="Invalid renewal key")

    try:
        new_expiry = datetime.fromisoformat(body.new_expiry)
    except ValueError:
        try:
            d = date.fromisoformat(body.new_expiry)
            new_expiry = datetime(d.year, d.month, d.day, 23, 59, 59)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid expiry format (use YYYY-MM-DDTHH:mm:ss)")
    if new_expiry.tzinfo is None:
        new_expiry = new_expiry.replace(tzinfo=timezone.utc)

    if new_expiry <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="New expiry date must be in the future")

    sub = _get_subscription(db)
    ip = request.client.host if request.client else "unknown"

    if sub is None:
        # No existing subscription — create one
        db.execute(text("""
            INSERT INTO sys_subscription
              (installation_id, org_name, tier, issue_date, expiry_date, is_active, created_by)
            VALUES (:iid, 'Activated via Key', 'standard', :today, :exp, TRUE, 'system')
        """), {"iid": iid, "today": date.today(), "exp": new_expiry})
        db.commit()
        sub = _get_subscription(db)
        db.execute(text("""
            INSERT INTO sys_renewal_log
              (subscription_id, previous_expiry, new_expiry, key_prefix, activated_by, ip_address)
            VALUES (:sid, :prev, :new, :kp, 'key_activation', :ip)
        """), {
            "sid": sub._mapping["id"],
            "prev": date.today(),
            "new": new_expiry,
            "kp": body.key[:12],
            "ip": ip,
        })
    else:
        prev_expiry = sub._mapping["expiry_date"]
        db.execute(text(
            "UPDATE sys_subscription SET expiry_date = :exp, updated_at = NOW() WHERE id = :id"
        ), {"exp": new_expiry, "id": sub._mapping["id"]})
        db.execute(text("""
            INSERT INTO sys_renewal_log
              (subscription_id, previous_expiry, new_expiry, key_prefix, activated_by, ip_address)
            VALUES (:sid, :prev, :new, :kp, 'key_activation', :ip)
        """), {
            "sid": sub._mapping["id"],
            "prev": prev_expiry,
            "new": new_expiry,
            "kp": body.key[:12],
            "ip": ip,
        })

    db.commit()
    logger.info(f"Subscription renewed until {new_expiry} from {ip}")
    return {"success": True, "message": f"Subscription activated until {new_expiry.strftime('%d %B %Y %H:%M')} UTC"}


@router.get("/")
async def get_subscription(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Global Admin only — full subscription info with renewal history."""
    from sqlalchemy import text
    _require_global_admin(current_user)

    sub = _get_subscription(db)
    status = _subscription_status(sub)

    # Renewal history
    history = []
    if sub is not None:
        rows = db.execute(text("""
            SELECT previous_expiry, new_expiry, key_prefix, activated_by, ip_address, activated_at
            FROM sys_renewal_log
            WHERE subscription_id = :sid
            ORDER BY activated_at DESC
        """), {"sid": sub._mapping["id"]}).fetchall()
        history = [dict(r._mapping) for r in rows]
        for h in history:
            for k, v in h.items():
                if isinstance(v, (date, datetime)):
                    h[k] = v.isoformat()

    return {
        "success": True,
        "data": {
            **status,
            "installation_id": _installation_id(),
            "renewal_history": history,
        },
    }


@router.post("/setup")
async def setup_subscription(
    body: SetupBody,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Global Admin only — create or replace the subscription.
    Used for initial deployment and manual adjustments.
    """
    from sqlalchemy import text
    _require_global_admin(current_user)

    try:
        expiry = datetime.fromisoformat(body.expiry_date)
    except ValueError:
        try:
            d = date.fromisoformat(body.expiry_date)
            expiry = datetime(d.year, d.month, d.day, 23, 59, 59)
        except ValueError:
            raise HTTPException(400, "Invalid expiry_date (use YYYY-MM-DDTHH:mm:ss)")
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    iid = _installation_id()

    # Deactivate any existing subscription
    db.execute(text("UPDATE sys_subscription SET is_active = FALSE WHERE is_active = TRUE"))

    db.execute(text("""
        INSERT INTO sys_subscription
          (installation_id, org_name, tier, max_users, max_employees, max_devices,
           issue_date, expiry_date, is_active, notes, created_by)
        VALUES (:iid, :org, :tier, :mu, :me, :md, :today, :exp, TRUE, :notes, :cb)
    """), {
        "iid": iid,
        "org": body.org_name,
        "tier": body.tier,
        "mu": body.max_users,
        "me": body.max_employees,
        "md": body.max_devices,
        "today": date.today(),
        "exp": expiry,
        "notes": body.notes,
        "cb": getattr(current_user, "username", "globaladmin"),
    })
    db.commit()

    return {"success": True, "message": f"Subscription set for {body.org_name} until {expiry.strftime('%d %B %Y %H:%M')} UTC"}


@router.post("/generate-key")
async def generate_renewal_key(
    body: GenerateKeyBody,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Global Admin only — generate a renewal key for a given expiry date.
    The key + expiry are handed to the customer to enter on the lock screen.
    """
    _require_global_admin(current_user)

    try:
        new_expiry = datetime.fromisoformat(body.new_expiry)
    except ValueError:
        try:
            d = date.fromisoformat(body.new_expiry)
            new_expiry = datetime(d.year, d.month, d.day, 23, 59, 59)
        except ValueError:
            raise HTTPException(400, "Invalid new_expiry (use YYYY-MM-DDTHH:mm:ss)")
    if new_expiry.tzinfo is None:
        new_expiry = new_expiry.replace(tzinfo=timezone.utc)

    if new_expiry <= datetime.now(timezone.utc):
        raise HTTPException(400, "New expiry must be in the future")

    iid = _installation_id()
    key = _generate_key(iid, body.new_expiry)

    logger.info(
        f"Renewal key generated by {getattr(current_user,'username','?')} "
        f"for expiry {body.new_expiry}"
    )

    return {
        "success": True,
        "data": {
            "key": key,
            "new_expiry": body.new_expiry,
            "installation_id": iid,
            "valid_until": new_expiry.isoformat(),
            "instructions": (
                f"Give the customer:\n"
                f"  Renewal Key: {key}\n"
                f"  New Expiry:  {new_expiry.strftime('%d %B %Y %H:%M')} UTC\n"
                f"They enter both on the system lock screen."
            ),
        },
    }
