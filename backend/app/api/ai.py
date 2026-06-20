"""
ARIA AI API endpoints
POST /api/v1/ai/chat       — SSE streaming chat
GET  /api/v1/ai/status     — provider health check
GET  /api/v1/ai/briefing   — generate daily briefing on demand
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..services.ai.aria import aria_stream, aria_daily_briefing
from ..services.ai.config import provider_info, get_async_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ai", tags=["ARIA AI Assistant"])


class ChatMessage(BaseModel):
    role: str    # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


@router.post("/chat")
async def aria_chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Streaming SSE endpoint for ARIA chat.
    Returns server-sent events — each event is a JSON object:
      {type: "provider", info: {...}}       — first event, which AI is responding
      {type: "tool_call", tool: "name"}     — ARIA is fetching live data
      {type: "text", text: "word "}         — response token
      {type: "done"}                        — stream complete
      {type: "error", text: "message"}      — something went wrong
    """
    user_ctx = {
        "username": getattr(current_user, "username", "unknown"),
        "role": "superuser" if getattr(current_user, "is_superuser", False) else "user",
    }
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    return StreamingResponse(
        aria_stream(messages, db, user_ctx),
        media_type="text/event-stream",
        headers={
            "Cache-Control":              "no-cache",
            "X-Accel-Buffering":          "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/alerts")
async def aria_alerts(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Lightweight poll endpoint — returns count and list of critical system events.
    Called every 60 s by the frontend to power the proactive alert badge.
    """
    from ..services.ai.tools import execute_tool
    stats = execute_tool("get_dashboard_stats", {}, db)
    alerts = []

    if stats.get("active_emergencies", 0):
        alerts.append({"level": "critical", "msg": f"{stats['active_emergencies']} active emergency event(s)", "route": "/emergency"})
    if stats.get("permit_alerts", 0):
        alerts.append({"level": "warning", "msg": f"{stats['permit_alerts']} contractor permit(s) expiring within 30 days", "route": "/contractors"})
    if stats.get("pending_visitor_approvals", 0):
        alerts.append({"level": "info", "msg": f"{stats['pending_visitor_approvals']} visitor approval(s) pending", "route": "/visitors"})
    readers_total  = stats.get("total_readers", 0)
    readers_online = stats.get("readers_online", 0)
    if readers_total > 0 and readers_online == 0:
        alerts.append({"level": "warning", "msg": f"All {readers_total} readers offline", "route": "/devices"})
    total = stats.get("total_employees", 0)
    onsite = stats.get("punches_today", 0)
    if total > 0 and onsite / total < 0.5:
        alerts.append({"level": "info", "msg": f"Low manning: {onsite}/{total} personnel punched in today", "route": "/attendance"})

    return {"count": len(alerts), "alerts": alerts}


@router.post("/schedule")
async def set_briefing_schedule(
    schedule: dict,
    current_user=Depends(get_current_user),
):
    """Store briefing schedule preference (time + days). Lightweight — just echoes back."""
    return {"success": True, "schedule": schedule}


@router.get("/status")
async def aria_status(current_user=Depends(get_current_user)):
    """Check which AI provider is active and whether it is reachable."""
    info = provider_info()
    try:
        client, model = get_async_client()
        # Quick ping — tiny completion to verify connectivity
        resp = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=5,
        )
        info["status"] = "online"
        info["test_response"] = resp.choices[0].message.content
    except Exception as e:
        info["status"] = "offline"
        info["error"]  = str(e)
    return {"success": True, "data": info}


@router.get("/briefing")
async def get_daily_briefing(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Generate an on-demand AI operations briefing from live data."""
    try:
        briefing = await aria_daily_briefing(db)
        return {"success": True, "data": {"briefing": briefing}}
    except Exception as e:
        logger.error(f"Briefing generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
