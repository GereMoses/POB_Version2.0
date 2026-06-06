"""
Database Backup API — Global Admin only.

Endpoints:
  POST /trigger          — Run a pg_dump immediately, save to backup directory
  GET  /list             — List all backup files with size, date, type
  GET  /download/{name}  — Stream a backup file to the browser for download
  DELETE /{name}         — Delete a specific backup file
  GET  /status           — Last backup time, total backup size, NAS status
"""

import os
import gzip
import shutil
import subprocess
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from ..core.config import settings
from ..core.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# Backup directory — mapped to NAS volume in production via docker-compose.prod.yml
BACKUP_DIR = Path(os.getenv("BACKUP_DIR", "/backups"))


def _require_admin(current_user=Depends(get_current_user)):
    if not (current_user.is_superuser or getattr(current_user, "is_global_admin", False)):
        raise HTTPException(status_code=403, detail="Global Admin access required")
    return current_user


def _parse_db_url():
    """Extract connection params from DATABASE_URL or individual settings."""
    url = settings.DATABASE_URL
    if url.startswith("postgresql://"):
        # postgresql://user:pass@host:port/dbname
        rest = url[len("postgresql://"):]
        userinfo, hostinfo = rest.split("@", 1)
        user, password = userinfo.split(":", 1)
        hostport, dbname = hostinfo.split("/", 1)
        host, port = (hostport.split(":", 1) + ["5432"])[:2]
        return host, int(port), dbname, user, password
    return (
        settings.DATABASE_HOST,
        settings.DATABASE_PORT,
        settings.DATABASE_NAME,
        settings.DATABASE_USER,
        settings.DATABASE_PASSWORD,
    )


def _backup_files() -> List[dict]:
    files = []
    for subdir in ("daily", "weekly", "monthly", "manual"):
        d = BACKUP_DIR / subdir
        if not d.exists():
            continue
        for f in sorted(d.iterdir(), reverse=True):
            if f.suffix in (".gz", ".sql"):
                stat = f.stat()
                files.append({
                    "filename": f.name,
                    "path":     str(f),
                    "type":     subdir,
                    "size_bytes": stat.st_size,
                    "size_human": _human_size(stat.st_size),
                    "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                })
    return files


def _human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


# ── Trigger backup ─────────────────────────────────────────────────────────────

@router.post("/trigger")
async def trigger_backup(current_user=Depends(_require_admin)):
    """Run a pg_dump immediately. Returns the filename of the new backup."""
    host, port, dbname, user, password = _parse_db_url()

    ts       = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"pob_manual_{ts}.sql.gz"
    dest_dir = BACKUP_DIR / "manual"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / filename

    env = os.environ.copy()
    env["PGPASSWORD"] = password

    try:
        pg_dump = subprocess.run(
            [
                "pg_dump",
                "-h", host,
                "-p", str(port),
                "-U", user,
                "-d", dbname,
                "--format=plain",
                "--blobs",
                "--no-password",
            ],
            capture_output=True,
            env=env,
            timeout=300,
        )

        if pg_dump.returncode != 0:
            err = pg_dump.stderr.decode()
            logger.error(f"pg_dump failed: {err}")
            raise HTTPException(status_code=500, detail=f"pg_dump failed: {err[:200]}")

        # Compress and write
        with gzip.open(dest_path, "wb") as gz:
            gz.write(pg_dump.stdout)

        size = _human_size(dest_path.stat().st_size)
        logger.info(f"Manual backup created: {filename} ({size}) by user {current_user.email}")

        return {
            "success":    True,
            "filename":   filename,
            "size":       size,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "message":    f"Backup completed successfully ({size})",
        }

    except subprocess.TimeoutExpired:
        if dest_path.exists():
            dest_path.unlink()
        raise HTTPException(status_code=500, detail="Backup timed out after 5 minutes")
    except HTTPException:
        raise
    except Exception as e:
        if dest_path.exists():
            dest_path.unlink()
        logger.error(f"Backup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── List backups ───────────────────────────────────────────────────────────────

@router.get("/list")
async def list_backups(current_user=Depends(_require_admin)):
    """Return all backup files grouped by type (manual, daily, weekly, monthly)."""
    files = _backup_files()
    total_bytes = sum(f["size_bytes"] for f in files)

    # NAS connectivity check
    nas_ok = BACKUP_DIR.exists() and os.access(BACKUP_DIR, os.W_OK)

    return {
        "backups":      files,
        "total":        len(files),
        "total_size":   _human_size(total_bytes),
        "backup_dir":   str(BACKUP_DIR),
        "nas_connected": nas_ok,
        "last_backup":  files[0]["created_at"] if files else None,
    }


# ── Download a backup ──────────────────────────────────────────────────────────

@router.get("/download/{filename}")
async def download_backup(filename: str, current_user=Depends(_require_admin)):
    """Stream a backup file to the browser."""
    # Security: only allow filenames, no path traversal
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Search all subdirs
    found = None
    for subdir in ("manual", "daily", "weekly", "monthly"):
        candidate = BACKUP_DIR / subdir / filename
        if candidate.exists():
            found = candidate
            break

    if not found:
        raise HTTPException(status_code=404, detail="Backup file not found")

    def file_iterator():
        with open(found, "rb") as f:
            while chunk := f.read(64 * 1024):
                yield chunk

    media_type = "application/gzip" if filename.endswith(".gz") else "application/octet-stream"
    return StreamingResponse(
        file_iterator(),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Delete a backup ────────────────────────────────────────────────────────────

@router.delete("/{filename}")
async def delete_backup(filename: str, current_user=Depends(_require_admin)):
    """Delete a specific backup file."""
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    found = None
    for subdir in ("manual", "daily", "weekly", "monthly"):
        candidate = BACKUP_DIR / subdir / filename
        if candidate.exists():
            found = candidate
            break

    if not found:
        raise HTTPException(status_code=404, detail="Backup file not found")

    found.unlink()
    logger.info(f"Backup deleted: {filename} by user {current_user.email}")
    return {"success": True, "message": f"{filename} deleted"}


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def backup_status(current_user=Depends(_require_admin)):
    """Overall backup health: last run, total size, NAS connectivity."""
    files      = _backup_files()
    nas_ok     = BACKUP_DIR.exists() and os.access(BACKUP_DIR, os.W_OK)
    total      = sum(f["size_bytes"] for f in files)
    last       = files[0] if files else None
    manual_cnt = sum(1 for f in files if f["type"] == "manual")
    daily_cnt  = sum(1 for f in files if f["type"] == "daily")

    return {
        "nas_connected":    nas_ok,
        "backup_directory": str(BACKUP_DIR),
        "total_backups":    len(files),
        "total_size":       _human_size(total),
        "manual_count":     manual_cnt,
        "daily_count":      daily_cnt,
        "last_backup":      last,
        "schedule":         "Daily at 02:00 UTC (automated)",
    }
