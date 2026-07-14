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
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..core.config import settings
from ..core.dependencies import get_current_user
from ..core.database import engine

logger = logging.getLogger(__name__)
router = APIRouter()

# Backup directory — mapped to NAS volume in production via docker-compose.prod.yml
BACKUP_DIR = Path(os.getenv("BACKUP_DIR", "/backups"))

# Sub-directories that may hold backup files. "uploaded" holds files brought in
# from elsewhere (disaster recovery) via POST /upload.
SUBDIRS = ("manual", "daily", "weekly", "monthly", "uploaded")


def _locate_backup(filename: str) -> Optional[Path]:
    """Find a backup file by name across all backup sub-directories."""
    for subdir in SUBDIRS:
        candidate = BACKUP_DIR / subdir / filename
        if candidate.exists():
            return candidate
    return None


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
    for subdir in SUBDIRS:
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

    found = _locate_backup(filename)
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

    found = _locate_backup(filename)
    if not found:
        raise HTTPException(status_code=404, detail="Backup file not found")

    found.unlink()
    logger.info(f"Backup deleted: {filename} by user {current_user.email}")
    return {"success": True, "message": f"{filename} deleted"}


# ── Upload an external backup (disaster recovery) ──────────────────────────────

@router.post("/upload")
async def upload_backup(file: UploadFile = File(...), current_user=Depends(_require_admin)):
    """
    Upload a backup file produced elsewhere (e.g. an off-site copy kept for
    disaster recovery) so it can be restored here. Saved under the 'uploaded'
    folder and then appears in the normal backup list.
    """
    raw_name = os.path.basename(file.filename or "")
    if not raw_name or "/" in raw_name or ".." in raw_name:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not raw_name.lower().endswith((".sql", ".sql.gz", ".dump", ".backup")):
        raise HTTPException(
            status_code=400,
            detail="Only .sql, .sql.gz, .dump or .backup files are accepted",
        )

    dest_dir = BACKUP_DIR / "uploaded"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / raw_name
    if dest_path.exists():
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        dest_path = dest_dir / f"{ts}_{raw_name}"

    size = 0
    try:
        with open(dest_path, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                out.write(chunk)
                size += len(chunk)
    except Exception as e:
        if dest_path.exists():
            dest_path.unlink()
        logger.error(f"Backup upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")
    finally:
        await file.close()

    if size == 0:
        if dest_path.exists():
            dest_path.unlink()
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    logger.info(f"Backup uploaded: {dest_path.name} ({_human_size(size)}) by user {current_user.email}")
    return {
        "success":  True,
        "filename": dest_path.name,
        "size":     _human_size(size),
        "type":     "uploaded",
        "message":  f"Uploaded {dest_path.name} ({_human_size(size)}). You can now restore it.",
    }


# ── Restore from a backup (DESTRUCTIVE) ────────────────────────────────────────

class RestoreRequest(BaseModel):
    filename: str
    confirm: bool = False


def _create_safety_backup(host, port, dbname, user, env) -> str:
    """pg_dump the CURRENT database before a restore overwrites it. Returns filename."""
    ts    = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    fname = f"pob_pre_restore_{ts}.sql.gz"
    dest_dir = BACKUP_DIR / "manual"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dump = subprocess.run(
        ["pg_dump", "-h", host, "-p", str(port), "-U", user, "-d", dbname,
         "--format=plain", "--blobs", "--no-password"],
        capture_output=True, env=env, timeout=300,
    )
    if dump.returncode != 0:
        raise RuntimeError(dump.stderr.decode()[:200])
    with gzip.open(dest_dir / fname, "wb") as gz:
        gz.write(dump.stdout)
    return fname


@router.post("/restore")
async def restore_backup(req: RestoreRequest, current_user=Depends(_require_admin)):
    """
    Restore the database from a backup file. DESTRUCTIVE — replaces ALL current
    data. Safety measures:
      1. A safety backup of the CURRENT database is taken first (pob_pre_restore_*).
      2. The restore runs in a single transaction, so any failure rolls back and
         leaves the current data untouched.
    Requires `confirm: true`.
    """
    if not req.confirm:
        raise HTTPException(status_code=400, detail="Restore must be explicitly confirmed")

    filename = req.filename
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    src = _locate_backup(filename)
    if not src:
        raise HTTPException(status_code=404, detail="Backup file not found")

    host, port, dbname, user, password = _parse_db_url()
    env = os.environ.copy()
    env["PGPASSWORD"] = password
    conn_args = ["-h", host, "-p", str(port), "-U", user, "-d", dbname, "--no-password"]

    # 1. Safety backup of the CURRENT data before we overwrite it.
    try:
        safety_file = _create_safety_backup(host, port, dbname, user, env)
        logger.info(f"Pre-restore safety backup created: {safety_file}")
    except Exception as e:
        logger.error(f"Pre-restore safety backup failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Aborted: could not create a safety backup first ({e}). Restore not attempted.",
        )

    tmp_path = None
    try:
        # 2. Decompress (if .gz) to a temp file and sniff the dump format.
        fd, tmp_path = tempfile.mkstemp(suffix=".sql", dir="/tmp")
        os.close(fd)
        if src.name.lower().endswith(".gz"):
            with gzip.open(src, "rb") as fin, open(tmp_path, "wb") as fout:
                shutil.copyfileobj(fin, fout, length=1024 * 1024)
        else:
            shutil.copyfile(src, tmp_path)

        with open(tmp_path, "rb") as f:
            is_custom = f.read(5) == b"PGDMP"

        if is_custom:
            # Custom-format dump → pg_restore, atomic + drops existing objects first.
            result = subprocess.run(
                ["pg_restore", *conn_args, "--clean", "--if-exists", "--no-owner",
                 "--single-transaction", tmp_path],
                capture_output=True, env=env, timeout=1800,
            )
        else:
            # Plain SQL dump → wipe+recreate the schema and apply, ALL in one
            # transaction so a mid-restore failure rolls back to the current data.
            preamble = (
                "SET lock_timeout = '30s';\n"
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = current_database() AND pid <> pg_backend_pid();\n"
                "DROP SCHEMA IF EXISTS public CASCADE;\n"
                "CREATE SCHEMA public;\n"
                f"GRANT ALL ON SCHEMA public TO {user};\n"
                "GRANT ALL ON SCHEMA public TO public;\n"
            )
            fd2, combined = tempfile.mkstemp(suffix=".sql", dir="/tmp")
            os.close(fd2)
            with open(combined, "wb") as out:
                out.write(preamble.encode())
                with open(tmp_path, "rb") as fin:
                    shutil.copyfileobj(fin, out, length=1024 * 1024)
            os.replace(combined, tmp_path)
            result = subprocess.run(
                ["psql", *conn_args, "--single-transaction", "-v", "ON_ERROR_STOP=1", "-f", tmp_path],
                capture_output=True, env=env, timeout=1800,
            )

        if result.returncode != 0:
            err = result.stderr.decode()[:400]
            logger.error(f"Restore failed: {err}")
            raise HTTPException(
                status_code=500,
                detail=f"Restore failed — current data was preserved. {err}",
            )

        # 3. Drop the app's now-stale pooled connections so new requests reconnect
        #    to the freshly restored database.
        engine.dispose()

        logger.warning(
            f"DATABASE RESTORED from '{filename}' by {current_user.email}; "
            f"pre-restore safety backup = {safety_file}"
        )
        return {
            "success":       True,
            "restored_from": filename,
            "safety_backup": safety_file,
            "message": (
                f"Database restored from {filename}. A safety backup of the previous "
                f"data was saved as {safety_file}. You may need to sign in again."
            ),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Restore error: {e}")
        raise HTTPException(status_code=500, detail=f"Restore error — current data preserved: {e}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


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
