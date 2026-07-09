"""
MFA/TOTP API — TOTP-based 2FA for admin accounts.
Uses pyotp to generate/verify TOTP codes.
MFA secrets are stored in auth_user.totp_secret (column added via migration).
"""
import io
import logging
import base64
import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..core.config import settings

# Prefix is relative — this router is mounted inside api_router, which already
# adds settings.API_V1_STR ("/api/v1"). Using the full path here double-prefixed
# every route to /api/v1/api/v1/mfa/... (404s in the UI).
router = APIRouter(prefix="/mfa", tags=["MFA/2FA"])
logger = logging.getLogger(__name__)

APP_NAME = "POB System"


def _get_totp_secret(db: Session, user_id: int) -> str | None:
    row = db.execute(
        text("SELECT totp_secret FROM auth_user WHERE id = :uid"),
        {"uid": user_id}
    ).fetchone()
    return row[0] if row else None


def _set_totp_secret(db: Session, user_id: int, secret: str | None) -> None:
    db.execute(
        text("UPDATE auth_user SET totp_secret = :s WHERE id = :uid"),
        {"s": secret, "uid": user_id}
    )
    db.commit()


def _ensure_totp_column(db: Session) -> None:
    """Create totp_secret column if it doesn't exist."""
    try:
        db.execute(text(
            "ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS totp_secret TEXT"
        ))
        db.execute(text(
            "ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE"
        ))
        db.commit()
    except Exception:
        db.rollback()


@router.get("/status")
async def mfa_status(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return whether MFA is enabled for the current user."""
    _ensure_totp_column(db)
    row = db.execute(text("""
        SELECT COALESCE(totp_enabled, FALSE) AS enabled
        FROM auth_user WHERE id = :uid
    """), {"uid": current_user.id}).fetchone()
    return {"mfa_enabled": bool(row[0]) if row else False}


@router.post("/setup/begin")
async def mfa_setup_begin(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Generate a new TOTP secret and return the QR code data URI.
    Secret is stored in a pending state until verified by the user.
    """
    _ensure_totp_column(db)
    secret = pyotp.random_base32()
    _set_totp_secret(db, current_user.id, secret)

    username = current_user.username or current_user.email or str(current_user.id)
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=username,
        issuer_name=APP_NAME,
    )

    # Build QR code as base64 PNG
    img = qrcode.make(totp_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()

    return {
        "secret": secret,
        "qr_code": f"data:image/png;base64,{b64}",
        "uri": totp_uri,
        "message": "Scan the QR code with your authenticator app, then verify with a code to activate 2FA.",
    }


class VerifyBody(BaseModel):
    code: str


@router.post("/setup/verify")
async def mfa_setup_verify(
    body: VerifyBody,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Verify the TOTP code the user scanned.  On success, mark MFA as enabled.
    """
    _ensure_totp_column(db)
    secret = _get_totp_secret(db, current_user.id)
    if not secret:
        raise HTTPException(status_code=400, detail="Start MFA setup first")

    totp = pyotp.TOTP(secret)
    if not totp.verify(body.code.strip(), valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code — check your authenticator app and try again")

    db.execute(text(
        "UPDATE auth_user SET totp_enabled = TRUE WHERE id = :uid"
    ), {"uid": current_user.id})
    db.commit()
    logger.info("MFA enabled for user %s", current_user.username)
    return {"success": True, "message": "2FA activated successfully"}


@router.post("/verify")
async def mfa_verify(
    body: VerifyBody,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Complete the MFA login handshake.

    Expects the short-lived mfa_pending token from the login response.
    On success, revokes the pending token and issues a full access token.

    NOTE: this endpoint must NOT use get_current_user — that dependency rejects
    mfa_pending tokens (they're barred from every other route), so it would 401
    the very token this endpoint exists to consume. We authenticate the pending
    token here directly and resolve the user from its `sub`.
    """
    from jose import jwt as _jwt, JWTError as _JWTError
    from datetime import timedelta
    from ..core.security import create_access_token, blacklist_token
    import time as _time

    # 1. Verify the caller holds an mfa_pending token (not a full access token)
    auth_header = request.headers.get("Authorization", "")
    raw_token = auth_header[7:] if auth_header.startswith("Bearer ") else ""
    if not raw_token:
        raise HTTPException(status_code=401, detail="Authorization header required")

    try:
        payload = _jwt.decode(
            raw_token, settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        if not payload.get("mfa_pending"):
            raise HTTPException(
                status_code=403,
                detail="This endpoint is only for completing the MFA login flow",
            )
        jti = payload.get("jti", "")
        exp = int(payload.get("exp", 0))
        sub = payload.get("sub")
    except _JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired MFA token")

    # Resolve the user from the pending token's subject (username or email).
    user_row = db.execute(text(
        "SELECT id, username FROM auth_user WHERE username = :s OR email = :s"
    ), {"s": sub}).fetchone()
    if not user_row:
        raise HTTPException(status_code=401, detail="Invalid or expired MFA token")
    user_id = user_row.id
    username = user_row.username

    # 2. Validate TOTP code — rate-limit to 5 attempts per pending token
    _ensure_totp_column(db)
    secret = _get_totp_secret(db, user_id)
    if not secret:
        raise HTTPException(status_code=400, detail="MFA not configured for this account")

    # Per-token attempt counter in Redis — prevents brute-forcing 6-digit codes
    try:
        from ..core.redis_client import get_redis_client
        _r = get_redis_client()
        attempt_key = f"mfa_attempts:{user_id}:{jti}"
        attempts = _r.incr(attempt_key)
        _r.expire(attempt_key, 300)  # 5-minute window
        if attempts > 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many incorrect codes — wait 5 minutes and try again",
                headers={"Retry-After": "300"},
            )
    except HTTPException:
        raise
    except Exception:
        pass  # Redis unavailable — still proceed, brute-force window is 5-min token TTL anyway

    totp = pyotp.TOTP(secret)
    if not totp.verify(body.code.strip(), valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code — check your authenticator app")

    # 3. Blacklist the pending token so it can't be reused
    if jti:
        remaining = max(int(exp) - int(_time.time()), 1)
        blacklist_token(jti, remaining)

    # 4. Issue a full access token (reads session timeout from att_rules)
    try:
        row = db.execute(text(
            "SELECT rule_value FROM att_rules WHERE rule_key = 'session_timeout_minutes'"
        )).fetchone()
        mins = int(row.rule_value) if row and row.rule_value else 480
        _MAX = 10080  # 7 days hard cap
        timeout_mins = max(1, min(525960 if mins == 0 else mins, _MAX))
    except Exception:
        timeout_mins = 480

    access_token = create_access_token(
        data={"sub": username},
        expires_delta=timedelta(minutes=timeout_mins),
    )
    logger.info("MFA login completed for user %s", username)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": timeout_mins * 60,
        "mfa_required": False,
    }


@router.delete("/disable")
async def mfa_disable(
    body: VerifyBody,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Disable MFA — requires valid TOTP code to confirm."""
    _ensure_totp_column(db)
    secret = _get_totp_secret(db, current_user.id)
    if not secret:
        raise HTTPException(status_code=400, detail="MFA not configured")

    totp = pyotp.TOTP(secret)
    if not totp.verify(body.code.strip(), valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code — confirm with your current code to disable MFA")

    db.execute(text(
        "UPDATE auth_user SET totp_secret = NULL, totp_enabled = FALSE WHERE id = :uid"
    ), {"uid": current_user.id})
    db.commit()
    logger.info("MFA disabled for user %s", current_user.username)
    return {"success": True, "message": "2FA disabled"}
