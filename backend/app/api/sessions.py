"""
Session Management API — view and revoke active user sessions.
"""
import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..core.redis_client import get_redis_client as get_redis

router = APIRouter(prefix="/api/v1/sessions", tags=["Sessions"])


def _session_key(user_id: int) -> str:
    return f"sessions:{user_id}"


@router.get("/")
async def list_sessions(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return all active sessions for the current user from Redis."""
    try:
        r = get_redis()
        keys = r.keys(f"sessions:{current_user.id}:*")
        sessions = []
        for key in keys:
            data = r.hgetall(key)
            if data:
                # decode_responses=True means all keys/values are already strings
                sessions.append({
                    "session_id": str(key).split(":")[-1],
                    "created_at":  data.get("created_at", ""),
                    "last_active": data.get("last_active", ""),
                    "ip_address":  data.get("ip", ""),
                    "user_agent":  data.get("ua", ""),
                })
        return {"sessions": sessions, "count": len(sessions)}
    except Exception:
        # Fallback: query user_sessions table if Redis unavailable
        rows = db.execute(text("""
            SELECT id, created_at, last_active, ip_address, user_agent, is_active
            FROM user_sessions WHERE user_id = :uid AND is_active = true
            ORDER BY last_active DESC LIMIT 20
        """), {"uid": current_user.id}).fetchall()
        return {"sessions": [dict(r._mapping) for r in rows], "count": len(rows)}


@router.delete("/{session_id}")
async def revoke_session(
    session_id: str,
    current_user=Depends(get_current_user),
):
    """Revoke a specific session by ID."""
    try:
        r = get_redis()
        key = f"sessions:{current_user.id}:{session_id}"
        deleted = r.delete(key)
        if deleted:
            return {"success": True, "message": "Session revoked"}
        raise HTTPException(status_code=404, detail="Session not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("")
async def revoke_all_sessions(
    current_user=Depends(get_current_user),
):
    """Revoke all sessions for current user (force re-login everywhere)."""
    try:
        r = get_redis()
        keys = r.keys(f"sessions:{current_user.id}:*")
        if keys:
            r.delete(*keys)
        return {"success": True, "revoked": len(keys)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all")
async def list_all_sessions(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Admin: list active sessions for all users."""
    if not getattr(current_user, "is_superuser", False):
        raise HTTPException(status_code=403, detail="Admin only")
    rows = db.execute(text("""
        SELECT us.id, us.user_id, u.username, us.created_at,
               us.last_active, us.ip_address, us.is_active
        FROM user_sessions us
        LEFT JOIN auth_user u ON u.id = us.user_id
        WHERE us.is_active = true
        ORDER BY us.last_active DESC LIMIT 100
    """)).fetchall()
    return {"sessions": [dict(r._mapping) for r in rows], "count": len(rows)}
