from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import logging
import uvicorn
import os
import asyncio
from datetime import datetime, timezone, timedelta

from .core.config import settings
from .core.database import test_db_connection, test_redis_connection, SessionLocal
from .core.rate_limiter import add_rate_limit_middleware
from .api import api_router, direct_router

# Configure logging with UTF-8 encoding
import sys
import os

# Ensure UTF-8 encoding for console output
if sys.platform == "win32":
    # Windows-specific encoding fix
    os.system('chcp 65001 > nul')

# Create formatters with proper encoding
formatter = logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

# File handler with UTF-8 encoding
file_handler = logging.FileHandler(settings.LOG_FILE, encoding='utf-8')
file_handler.setFormatter(formatter)

# Stream handler with UTF-8 encoding
stream_handler = logging.StreamHandler()
stream_handler.setFormatter(formatter)

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    handlers=[file_handler, stream_handler],
    force=True
)

logger = logging.getLogger(__name__)

# Holds refs to all long-running background tasks so shutdown can cancel them cleanly.
_background_tasks: list = []

# Disable interactive API docs in production
_docs_url = None if settings.ENVIRONMENT == "production" else f"{settings.API_V1_STR}/docs"
_redoc_url = None if settings.ENVIRONMENT == "production" else f"{settings.API_V1_STR}/redoc"
_openapi_url = None if settings.ENVIRONMENT == "production" else f"{settings.API_V1_STR}/openapi.json"

# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    openapi_url=_openapi_url,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
)

_INSECURE_KEY = "pob-system-production-secret-key-2024-secure-jwt-auth"
if settings.SECRET_KEY == _INSECURE_KEY and settings.ENVIRONMENT == "production":
    raise RuntimeError(
        "SECRET_KEY is still the default insecure value. "
        "Set a strong random SECRET_KEY in your environment before running in production."
    )
if settings.SECRET_KEY == _INSECURE_KEY:
    logger.warning(
        "⚠️  SECRET_KEY is using the insecure default — change it before deploying to production"
    )

# MIDDLEWARE ORDER MATTERS: in Starlette, last-added runs first.
# RBAC must be added first (runs last/inner) so CORS runs first (outer).

# Add RBAC middleware first — it will run INSIDE CORS
from .core.rbac import RBACMiddleware
app.add_middleware(RBACMiddleware, exclude_paths=[
    "/health", "/status", "/docs", "/redoc", "/openapi.json",
    "/api/v1/docs", "/api/v1/redoc", "/api/v1/openapi.json",
    "/api/v1/auth/login", "/api/v1/auth/simple-login", "/api/v1/auth/production-login",
    # Subscription public endpoints — no auth required
    "/api/v1/subscription/status", "/api/v1/subscription/activate",
    # ZKTeco ADMS device endpoints — device-initiated, no user auth
    "/iclock/cdata", "/iclock/getrequest", "/iclock/devicecmd", "/iclock/test",
    "/api/v1/iclock/cdata", "/api/v1/iclock/getrequest",
    "/api/v1/iclock/devicecmd", "/api/v1/iclock/test",
])
logger.info("✅ RBAC middleware enabled for comprehensive access control")

# License enforcement middleware — runs inside RBAC, outside rate limiter
# Returns 402 for all authenticated requests when subscription is expired,
# except Global Admin (who can log in and renew) and public paths.
_LICENSE_BYPASS_PREFIXES = (
    "/health", "/status", "/docs", "/redoc", "/openapi.json",
    "/api/v1/docs", "/api/v1/redoc", "/api/v1/openapi.json",
    "/api/v1/auth/",
    "/api/v1/subscription/status", "/api/v1/subscription/activate",
    "/iclock/", "/api/v1/iclock/",
)

import time as _time
from starlette.middleware.base import BaseHTTPMiddleware as _BaseHTTPMiddleware
from starlette.responses import JSONResponse as _JSONResponse
from jose import jwt as _jwt, JWTError as _JWTError

_license_cache: dict = {"expires_at": 0.0, "status": "unknown", "days": 0}


def _check_license_db() -> tuple[str, int]:
    """Synchronous DB check — returns (status, days_remaining). Cached 60 s."""
    from .core.database import SessionLocal
    from sqlalchemy import text as _text
    db = SessionLocal()
    try:
        row = db.execute(_text(
            "SELECT expiry_date FROM sys_subscription WHERE is_active = TRUE ORDER BY id DESC LIMIT 1"
        )).fetchone()
        if row is None:
            return "no_license", 0
        expiry = row[0]
        now = datetime.now(timezone.utc)
        # Normalise: handle both DATE and TIMESTAMPTZ columns
        if not hasattr(expiry, 'hour'):
            expiry = datetime(expiry.year, expiry.month, expiry.day, tzinfo=timezone.utc)
        elif expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        delta = expiry - now
        if delta.total_seconds() <= 0:
            return "expired", int(delta.total_seconds() / 86400)
        return "active", int(delta.total_seconds() / 86400)
    except Exception:
        return "active", 9999  # fail-open: don't block if DB check errors
    finally:
        db.close()


class LicenseMiddleware(_BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path

        # Always bypass public paths
        if any(path.startswith(p) for p in _LICENSE_BYPASS_PREFIXES):
            return await call_next(request)

        # Refresh cache every 60 s
        now = _time.monotonic()
        if now > _license_cache["expires_at"]:
            import asyncio
            status, days = await asyncio.to_thread(_check_license_db)
            _license_cache.update({"status": status, "days": days, "expires_at": now + 60.0})

        if _license_cache["status"] in ("active", "unknown"):
            return await call_next(request)

        # License expired or missing — allow Global Admins through
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            try:
                payload = _jwt.decode(
                    token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
                )
                sub = payload.get("sub", "")
                from .core.database import SessionLocal
                from sqlalchemy import text as _text
                db = SessionLocal()
                try:
                    row = db.execute(_text(
                        "SELECT COALESCE(is_global_admin, FALSE) FROM auth_user WHERE username = :u OR email = :u"
                    ), {"u": sub}).fetchone()
                    if row and row[0]:
                        return await call_next(request)
                finally:
                    db.close()
            except (_JWTError, Exception):
                pass

        return _JSONResponse(
            status_code=402,
            content={
                "detail": "subscription_expired",
                "message": "Your subscription has expired. Please contact your vendor to renew.",
                "days_remaining": _license_cache["days"],
            },
        )


app.add_middleware(LicenseMiddleware)
logger.info("✅ License enforcement middleware enabled")

# Add CORS middleware last — it will run FIRST (outermost) so preflight OPTIONS
# requests are handled before RBAC ever sees them.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
    expose_headers=["Content-Disposition"],
)

# Security headers — injected on every response.
# Added innermost (runs outermost) so headers appear on all responses including errors.
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("X-XSS-Protection", "1; mode=block")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=()"
        )
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Add rate limiting middleware for production security
try:
    app = add_rate_limit_middleware(app)
    logger.info("✅ Rate limiting middleware enabled for production security")
except Exception as e:
    logger.warning(f"⚠️ Rate limiting disabled due to connection issues: {e}")

# Add trusted host middleware for production
# Reads ALLOWED_HOSTS from env (comma-separated). Defaults to permissive set
# so docker-compose and local dev work without extra config.
_raw_hosts = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0,*")
_allowed_hosts = [h.strip() for h in _raw_hosts.split(",") if h.strip()]
if not settings.DEBUG:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=_allowed_hosts
    )

# Add enhanced exception handlers
from .core.error_handling import (
    global_exception_handler,
    validation_exception_handler,
    database_exception_handler
)
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text

app.add_exception_handler(Exception, global_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(SQLAlchemyError, database_exception_handler)

# BioTime 9.5 Authentication is now primary
print("✅ BioTime 9.5 compatible authentication enabled")

# Serve user-uploaded files — creates dirs if missing so first boot doesn't crash
import pathlib
for _d in ("uploads", "media"):
    pathlib.Path(_d).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/media", StaticFiles(directory="media"), name="media")

# Include API router (versioned — /api/v1/...)
app.include_router(api_router, prefix=settings.API_V1_STR)

# Include direct routers (self-prefixed — /api/... without /v1)
# All formerly-scattered router registrations are now in api/__init__.py direct_router.
app.include_router(direct_router)
logger.info("✅ All direct API routers registered")

# ADMS protocol endpoints — no authentication, device-initiated, MUST be at root
from .api.adms_protocol import router as adms_router
app.include_router(adms_router, tags=["ADMS Protocol"])


def _sync_time_one_pass() -> None:
    """Synchronous inner body of the time-sync loop — runs in a thread pool."""
    from .api.adms_protocol import queue_command, STATE_APPROVED, _get_direct_device
    from .models.biotime_models import IClockTerminal
    correct_time_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    db = SessionLocal()
    try:
        terminals = db.query(IClockTerminal).filter(IClockTerminal.state == STATE_APPROVED).all()
        for t in terminals:
            dev = _get_direct_device(t.sn, db)
            if dev and (dev.connection_mode or '').lower() in ('direct', 'both'):
                continue  # direct sync handled by async caller
            try:
                queue_command(t.sn, f"DATE TIME {correct_time_str}", db)
            except Exception as te:
                logger.warning(f"Time sync ADMS queue failed for {t.sn}: {te}")
        logger.info(f"Hourly ADMS time-sync queued for {len(terminals)} reader(s)")
    finally:
        db.close()


async def _time_sync_loop():
    """Hourly: sync clocks on all approved readers. DB work runs off the event loop."""
    from .api.adms_protocol import STATE_APPROVED, _direct_sync_time, _get_direct_device
    from .models.biotime_models import IClockTerminal

    await asyncio.sleep(10)
    logger.info("Time sync loop started — initial sync now, then every hour")

    while True:
        try:
            # Direct-IP devices: async TCP sync — stays on the event loop (non-blocking)
            db = SessionLocal()
            try:
                direct_devs = [
                    (t.sn, dev)
                    for t in db.query(IClockTerminal).filter(IClockTerminal.state == STATE_APPROVED).all()
                    if (dev := _get_direct_device(t.sn, db)) and (dev.connection_mode or '').lower() in ('direct', 'both')
                ]
            finally:
                db.close()

            for sn, dev in direct_devs:
                try:
                    result = await _direct_sync_time(dev.ip_address, dev.port)
                    if not result.get('success'):
                        logger.warning(f"Direct sync failed {sn}: {result.get('error')}")
                except Exception as exc:
                    logger.warning(f"Direct sync exception {sn}: {exc}")

            # ADMS queue for push-only devices — blocking DB write, run in thread
            await asyncio.to_thread(_sync_time_one_pass)

        except Exception as e:
            logger.error(f"Time sync loop error: {e}")

        await asyncio.sleep(3600)


def _attendance_query_pending(yesterday) -> list:
    """Synchronous DB query for employees needing attendance recalculation."""
    db = SessionLocal()
    try:
        rows = db.execute(text("""
            SELECT DISTINCT p.id AS emp_id, p.emp_code
            FROM iclock_transaction t
            JOIN personnel p ON (t.emp_code = p.emp_code OR t.emp_code = p.badge_id)
            WHERE t.punch_time::date >= :yesterday
              AND (p.is_active = true OR p.is_active IS NULL)
              AND EXISTS (
                    SELECT 1 FROM att_schedule sc
                    WHERE sc.emp_code = p.emp_code
                      AND sc.start_date <= t.punch_time::date
                      AND (sc.end_date IS NULL OR sc.end_date >= t.punch_time::date)
                  )
              AND (
                    NOT EXISTS (
                        SELECT 1 FROM att_report r
                        JOIN personnel_employee pe ON r.emp_id = pe.id
                        WHERE pe.emp_code = p.emp_code
                          AND r.att_date = t.punch_time::date
                    )
                    OR EXISTS (
                        SELECT 1 FROM att_report r
                        JOIN personnel_employee pe ON r.emp_id = pe.id
                        WHERE pe.emp_code = p.emp_code
                          AND r.att_date = t.punch_time::date
                          AND r.updated_at < t.upload_time
                    )
                  )
        """), {"yesterday": yesterday}).fetchall()
        return [r.emp_id for r in rows]
    finally:
        db.close()


async def _attendance_auto_calc_loop():
    """Periodic catch-all attendance recalc. DB query runs in thread pool."""
    from .services.attendance_calculation_service import attendance_calculation_service
    from datetime import date, timedelta

    await asyncio.sleep(90)
    logger.info("Attendance auto-calc loop started — periodic catch-all every 15 min")

    while True:
        try:
            today     = date.today()
            yesterday = today - timedelta(days=1)

            # Blocking query — off the event loop
            emp_ids = await asyncio.to_thread(_attendance_query_pending, yesterday)

            if emp_ids:
                db = SessionLocal()
                try:
                    result = await attendance_calculation_service.calculate_attendance(
                        emp_ids=emp_ids,
                        start_date=str(yesterday),
                        end_date=str(today),
                        db=db,
                    )
                    logger.info(
                        f"Periodic auto-calc: {result.get('processed', 0)} employees "
                        f"updated ({yesterday} – {today})"
                    )
                finally:
                    db.close()
        except Exception as exc:
            logger.error(f"Periodic attendance auto-calc error: {exc}")

        await asyncio.sleep(900)


def _drill_check_one_pass(now, retry_cutoff) -> None:
    """Synchronous drill scheduler body — runs in a thread pool."""
    from .models.biotime_models import MusteringDrillSchedule
    from .services.mustering_service import MusteringService
    db = SessionLocal()
    try:
        expired = db.query(MusteringDrillSchedule).filter(
            MusteringDrillSchedule.processed == False,
            MusteringDrillSchedule.auto_start == True,
            MusteringDrillSchedule.scheduled_time < retry_cutoff,
        ).all()
        for schedule in expired:
            schedule.processed = True
            schedule.processed_time = now
            schedule.status = "EXPIRED"
            logger.warning(f"Drill schedule {schedule.id} expired for zone {schedule.zone_id}")
        if expired:
            db.commit()

        due = db.query(MusteringDrillSchedule).filter(
            MusteringDrillSchedule.processed == False,
            MusteringDrillSchedule.auto_start == True,
            MusteringDrillSchedule.scheduled_time <= now,
            MusteringDrillSchedule.scheduled_time >= retry_cutoff,
        ).all()

        for schedule in due:
            try:
                service = MusteringService(db)
                service.start_mustering_event(
                    zone_id=schedule.zone_id,
                    event_type=schedule.event_type,
                    initiated_by=schedule.created_by or 1,
                    notes=f"Auto-triggered drill (schedule #{schedule.id})",
                )
                schedule.processed = True
                schedule.processed_time = now
                schedule.status = "TRIGGERED"
                db.commit()
                logger.info(f"Auto-triggered drill schedule {schedule.id} for zone {schedule.zone_id}")
            except ValueError as ve:
                logger.info(f"Drill schedule {schedule.id} deferred (zone {schedule.zone_id} busy): {ve}")
            except Exception as e:
                logger.error(f"Failed to auto-trigger drill schedule {schedule.id}: {e}")
                db.rollback()
    finally:
        db.close()


async def _drill_scheduler_loop():
    """Background loop: auto-trigger drill schedules. DB runs off the event loop."""
    logger.info("Drill scheduler started — polling every 30 s")
    while True:
        try:
            now = datetime.now(timezone.utc)
            await asyncio.to_thread(_drill_check_one_pass, now, now - timedelta(minutes=30))
        except asyncio.CancelledError:
            logger.info("Drill scheduler stopped")
            break
        except Exception as e:
            logger.error(f"Drill scheduler loop error: {e}")

        await asyncio.sleep(30)


@app.on_event("startup")
async def startup_event():
    """Application startup event"""
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}")

    # Test database connection (run sync check off the event loop)
    if await asyncio.to_thread(test_db_connection):
        logger.info("✅ Database connection successful")
    else:
        logger.error("❌ Database connection failed")

    # Test Redis connection
    if await asyncio.to_thread(test_redis_connection):
        logger.info("✅ Redis connection successful")
    else:
        logger.error("❌ Redis connection failed")

    # Start background drill scheduler
    _background_tasks.append(asyncio.create_task(_drill_scheduler_loop()))
    logger.info("✅ Drill scheduler task started")

    # Start attendance auto-calculation loop
    _background_tasks.append(asyncio.create_task(_attendance_auto_calc_loop()))
    logger.info("✅ Attendance auto-calc loop started (device punches → att_report, every 15 min)")

    # Start reader time-sync loop
    _background_tasks.append(asyncio.create_task(_time_sync_loop()))
    logger.info("✅ Reader time-sync loop started (SET DATE TIME to all readers, every hour)")

    # Start ZKTeco direct-IP device poller (60 s catch-up for missed records)
    from .services.zkteco.device_poller import poller_loop
    _background_tasks.append(asyncio.create_task(poller_loop()))
    logger.info("✅ ZKTeco device poller started")

    # Start live capture supervisor (sub-second real-time punch events via SSE)
    from .services.zkteco.live_capture import live_capture_supervisor
    _background_tasks.append(asyncio.create_task(live_capture_supervisor()))
    logger.info("✅ ZKTeco live capture supervisor started")

    # Start fast heartbeat — TCP reachability check every 5 s
    from .services.zkteco.device_heartbeat import heartbeat_loop, reset_stale_states
    reset_stale_states()   # mark all devices OFFLINE until heartbeat proves them reachable
    _background_tasks.append(asyncio.create_task(heartbeat_loop()))
    logger.info("✅ ZKTeco device heartbeat started")

    # Migrate subscription expiry columns to TIMESTAMPTZ for time-aware license control
    try:
        _mdb = SessionLocal()
        try:
            for _stmt in [
                "ALTER TABLE sys_subscription ALTER COLUMN expiry_date TYPE TIMESTAMPTZ USING expiry_date::TIMESTAMPTZ",
                "ALTER TABLE sys_renewal_log ALTER COLUMN previous_expiry TYPE TIMESTAMPTZ USING previous_expiry::TIMESTAMPTZ",
                "ALTER TABLE sys_renewal_log ALTER COLUMN new_expiry TYPE TIMESTAMPTZ USING new_expiry::TIMESTAMPTZ",
            ]:
                try:
                    _mdb.execute(text(_stmt))
                    _mdb.commit()
                except Exception:
                    _mdb.rollback()
            logger.info("✅ Subscription expiry columns are TIMESTAMPTZ")
        finally:
            _mdb.close()
    except Exception as _me:
        logger.debug(f"Subscription migration skipped: {_me}")

    # Log all registered routes grouped by prefix for operational visibility
    ws_routes   = [r.path for r in app.routes if hasattr(r, "path") and "ws" in r.path.lower()]
    api_routes  = sorted({"/".join(r.path.split("/")[:4]) for r in app.routes
                          if hasattr(r, "path") and r.path.startswith("/api")})
    logger.info(f"📋 API prefixes registered: {api_routes}")
    if ws_routes:
        logger.info(f"🔌 WebSocket routes: {ws_routes}")

    logger.info("🚀 Application startup complete")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event — cancel all background tasks gracefully."""
    logger.info("🛑 Application shutting down — cancelling background tasks")
    for task in _background_tasks:
        task.cancel()
    if _background_tasks:
        await asyncio.gather(*_background_tasks, return_exceptions=True)
    logger.info("✅ All background tasks stopped")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "version": settings.VERSION,
        "docs": f"{settings.API_V1_STR}/docs",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Lightweight health check — used by Docker. Never blocks the event loop."""
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/status")
async def detailed_status():
    """Detailed status with DB/Redis checks — not used by Docker health check."""
    loop = asyncio.get_event_loop()
    try:
        db_ok = await loop.run_in_executor(None, test_db_connection)
    except Exception:
        db_ok = False
    try:
        redis_ok = await loop.run_in_executor(None, test_redis_connection)
    except Exception:
        redis_ok = False
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "redis": "connected" if redis_ok else "disconnected",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
