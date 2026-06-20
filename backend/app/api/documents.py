"""
Document Management API — upload, list, download, and delete documents
attached to personnel records (certifications, permits, medical, contracts).

Files stored in /app/uploads/documents/{personnel_id}/
Metadata stored in the documents table (created on first use).
"""
import os
import uuid
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..core.database import get_db
from ..core.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/documents", tags=["Document Management"])

UPLOAD_ROOT = Path("/app/uploads/documents")
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".xls", ".xlsx"}
MAX_FILE_SIZE_MB = 20

CATEGORY_LABELS = {
    "certification":    "Certification",
    "permit":           "Permit",
    "medical":          "Medical Record",
    "contract":         "Contract",
    "training":         "Training Document",
    "id_document":      "ID / Passport",
    "other":            "Other",
}


def _ensure_docs_table(db: Session) -> None:
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS personnel_documents (
            id            SERIAL PRIMARY KEY,
            personnel_id  INTEGER NOT NULL,
            filename      TEXT    NOT NULL,
            original_name TEXT    NOT NULL,
            file_size     BIGINT,
            content_type  TEXT,
            category      TEXT    DEFAULT 'other',
            title         TEXT,
            expiry_date   DATE,
            notes         TEXT,
            uploaded_by   INTEGER,
            created_at    TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.commit()


def _assert_doc_access(personnel_id: int, current_user, db: Session) -> None:
    """Raise 403 unless current_user is superuser, has personnel.view, or owns the record."""
    if getattr(current_user, "is_superuser", False):
        return
    own_row = db.execute(text(
        "SELECT id FROM personnel WHERE user_id = :uid AND id = :pid"
    ), {"uid": current_user.id, "pid": personnel_id}).fetchone()
    if own_row:
        return
    perm_row = db.execute(text("""
        SELECT 1 FROM auth_user_role ur
        JOIN auth_role r ON r.id = ur.role_id
        JOIN auth_role_permission rp ON rp.role_id = r.id
        JOIN auth_permission p ON p.id = rp.permission_id
        WHERE ur.user_id = :uid AND p.codename = 'personnel.view' LIMIT 1
    """), {"uid": current_user.id}).fetchone()
    if not perm_row:
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("/{personnel_id}")
async def list_documents(
    personnel_id: int,
    category: str = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _assert_doc_access(personnel_id, current_user, db)
    _ensure_docs_table(db)
    filters, params = ["personnel_id = :pid"], {"pid": personnel_id}
    if category:
        filters.append("category = :cat"); params["cat"] = category

    rows = db.execute(text(f"""
        SELECT d.id, d.filename, d.original_name, d.file_size, d.content_type,
               d.category, d.title, d.expiry_date, d.notes, d.created_at,
               u.username AS uploaded_by_name
        FROM personnel_documents d
        LEFT JOIN auth_user u ON u.id = d.uploaded_by
        WHERE {' AND '.join(filters)}
        ORDER BY d.created_at DESC
    """), params).fetchall()

    return {
        "documents": [dict(r._mapping) for r in rows],
        "count": len(rows),
    }


@router.post("/{personnel_id}")
async def upload_document(
    personnel_id: int,
    file: UploadFile = File(...),
    category: str = Form(default="other"),
    title: str = Form(default=""),
    expiry_date: str = Form(default=None),
    notes: str = Form(default=""),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _ensure_docs_table(db)

    # Validate extension
    ext = Path(file.filename).suffix.lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_FILE_SIZE_MB}MB.")

    # Save to disk
    folder = UPLOAD_ROOT / str(personnel_id)
    folder.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    (folder / stored_name).write_bytes(content)

    # Save metadata
    db.execute(text("""
        INSERT INTO personnel_documents
            (personnel_id, filename, original_name, file_size, content_type,
             category, title, expiry_date, notes, uploaded_by, created_at)
        VALUES
            (:pid, :fn, :on, :fs, :ct, :cat, :tit, :exp, :notes, :uid, NOW())
    """), {
        "pid":   personnel_id,
        "fn":    stored_name,
        "on":    file.filename,
        "fs":    len(content),
        "ct":    file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream",
        "cat":   category,
        "tit":   title or file.filename,
        "exp":   expiry_date or None,
        "notes": notes,
        "uid":   current_user.id,
    })
    db.commit()

    return {
        "success": True,
        "message": "Document uploaded",
        "filename": stored_name,
        "original_name": file.filename,
        "size_bytes": len(content),
    }


@router.get("/{personnel_id}/{doc_id}/download")
async def download_document(
    personnel_id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _assert_doc_access(personnel_id, current_user, db)
    _ensure_docs_table(db)
    row = db.execute(text("""
        SELECT filename, original_name, content_type
        FROM personnel_documents
        WHERE id = :id AND personnel_id = :pid
    """), {"id": doc_id, "pid": personnel_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = UPLOAD_ROOT / str(personnel_id) / row.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=str(file_path),
        media_type=row.content_type or "application/octet-stream",
        filename=row.original_name,
    )


@router.delete("/{personnel_id}/{doc_id}")
async def delete_document(
    personnel_id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _assert_doc_access(personnel_id, current_user, db)
    _ensure_docs_table(db)
    row = db.execute(text("""
        SELECT filename FROM personnel_documents WHERE id = :id AND personnel_id = :pid
    """), {"id": doc_id, "pid": personnel_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove from disk
    file_path = UPLOAD_ROOT / str(personnel_id) / row.filename
    try:
        file_path.unlink(missing_ok=True)
    except Exception:
        pass

    db.execute(text("DELETE FROM personnel_documents WHERE id = :id"), {"id": doc_id})
    db.commit()
    return {"success": True}
