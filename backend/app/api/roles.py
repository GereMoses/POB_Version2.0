"""
Roles API — BioTime-compatible
All role/permission data lives in auth_role, auth_user_role, auth_permission,
auth_role_permission.  The old `roles` / `role_assignments` tables are gone.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
import logging

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.roles import DEFAULT_PERMISSIONS

logger = logging.getLogger(__name__)

router = APIRouter(tags=["roles"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _require_superuser(current_user):
    if not current_user.is_superuser:
        raise HTTPException(403, "Requires superuser or settings.manage_roles permission")


def _role_row(row) -> dict:
    return {
        "id":          row.id,
        "name":        row.name,
        "description": row.description or "",
        "is_active":   row.is_active,
        "is_system":   getattr(row, "is_system", False),
        "level":       getattr(row, "level", 50),
    }


# ══════════════════════════════════════════════════════════════════════════════
# ROLES — CRUD (auth_role table)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/public")
async def list_roles_public(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List all active roles (used by dropdowns in Settings)."""
    rows = db.execute(text("""
        SELECT id, name, description, is_active
        FROM auth_role
        WHERE is_active = true
        ORDER BY name
    """)).fetchall()
    return [{"id": r.id, "name": r.name, "description": r.description or ""} for r in rows]


@router.get("/")
async def list_roles(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List all roles with permission count."""
    rows = db.execute(text("""
        SELECT r.id, r.name, r.description, r.is_active,
               COUNT(rp.id) AS permission_count,
               COUNT(ur.id) AS user_count
        FROM auth_role r
        LEFT JOIN auth_role_permission rp ON rp.role_id = r.id
        LEFT JOIN auth_user_role ur ON ur.role_id = r.id
        GROUP BY r.id
        ORDER BY r.name
    """)).fetchall()
    return {"success": True, "data": [
        {
            "id":               r.id,
            "name":             r.name,
            "description":      r.description or "",
            "is_active":        r.is_active,
            "permission_count": r.permission_count,
            "user_count":       r.user_count,
        }
        for r in rows
    ]}


@router.post("/")
async def create_role(
    role_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a new role in auth_role."""
    _require_superuser(current_user)
    name = (role_data.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "name is required")
    exists = db.execute(text("SELECT 1 FROM auth_role WHERE name = :n"), {"n": name}).fetchone()
    if exists:
        raise HTTPException(400, f"Role '{name}' already exists")
    row = db.execute(text("""
        INSERT INTO auth_role (name, description, is_active)
        VALUES (:name, :desc, :active)
        RETURNING id, name, description, is_active
    """), {
        "name":   name,
        "desc":   role_data.get("description", ""),
        "active": role_data.get("is_active", True),
    }).fetchone()
    db.commit()
    return {"success": True, "data": {"id": row.id, "name": row.name, "description": row.description, "is_active": row.is_active}}


@router.get("/{role_id}")
async def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get role details with its permission codenames."""
    row = db.execute(text("SELECT id, name, description, is_active FROM auth_role WHERE id = :id"), {"id": role_id}).fetchone()
    if not row:
        raise HTTPException(404, "Role not found")
    perms = db.execute(text("""
        SELECT p.codename FROM auth_role_permission rp
        JOIN auth_permission p ON p.id = rp.permission_id
        WHERE rp.role_id = :rid ORDER BY p.codename
    """), {"rid": role_id}).fetchall()
    return {"success": True, "data": {
        "id":          row.id,
        "name":        row.name,
        "description": row.description or "",
        "is_active":   row.is_active,
        "permissions": [p.codename for p in perms],
    }}


@router.put("/{role_id}")
async def update_role(
    role_id: int,
    role_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update role name/description/active state."""
    _require_superuser(current_user)
    row = db.execute(text("SELECT id, name FROM auth_role WHERE id = :id"), {"id": role_id}).fetchone()
    if not row:
        raise HTTPException(404, "Role not found")
    sets, params = [], {"id": role_id}
    if "name" in role_data:
        sets.append("name = :name"); params["name"] = role_data["name"]
    if "description" in role_data:
        sets.append("description = :desc"); params["desc"] = role_data["description"]
    if "is_active" in role_data:
        sets.append("is_active = :active"); params["active"] = role_data["is_active"]
    if sets:
        db.execute(text(f"UPDATE auth_role SET {', '.join(sets)} WHERE id = :id"), params)
        db.commit()
    return {"success": True, "message": "Role updated"}


@router.delete("/{role_id}")
async def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Delete a role (blocked if users are still assigned)."""
    _require_superuser(current_user)
    row = db.execute(text("SELECT id FROM auth_role WHERE id = :id"), {"id": role_id}).fetchone()
    if not row:
        raise HTTPException(404, "Role not found")
    in_use = db.execute(text("SELECT 1 FROM auth_user_role WHERE role_id = :id LIMIT 1"), {"id": role_id}).fetchone()
    if in_use:
        raise HTTPException(400, "Cannot delete role — users are still assigned to it")
    db.execute(text("DELETE FROM auth_role_permission WHERE role_id = :id"), {"id": role_id})
    db.execute(text("DELETE FROM auth_role WHERE id = :id"), {"id": role_id})
    db.commit()
    return {"success": True, "message": "Role deleted"}


# ══════════════════════════════════════════════════════════════════════════════
# ROLE PERMISSIONS (auth_role_permission + auth_permission)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{role_id}/permissions")
async def get_role_permissions(
    role_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get all permission codenames assigned to a role."""
    perms = db.execute(text("""
        SELECT p.id, p.codename, p.name
        FROM auth_role_permission rp
        JOIN auth_permission p ON p.id = rp.permission_id
        WHERE rp.role_id = :rid
        ORDER BY p.codename
    """), {"rid": role_id}).fetchall()
    return {"success": True, "data": [{"id": p.id, "codename": p.codename, "name": p.name} for p in perms]}


@router.put("/{role_id}/permissions")
async def set_role_permissions(
    role_id: int,
    body: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Replace all permissions for a role. Body: {permission_ids: [int, ...]}"""
    _require_superuser(current_user)
    role = db.execute(text("SELECT id FROM auth_role WHERE id = :id"), {"id": role_id}).fetchone()
    if not role:
        raise HTTPException(404, "Role not found")
    perm_ids: List[int] = body.get("permission_ids", [])
    db.execute(text("DELETE FROM auth_role_permission WHERE role_id = :rid"), {"rid": role_id})
    for pid in perm_ids:
        db.execute(text(
            "INSERT INTO auth_role_permission (role_id, permission_id) VALUES (:rid, :pid) ON CONFLICT DO NOTHING"
        ), {"rid": role_id, "pid": pid})
    db.commit()
    return {"success": True, "message": f"Permissions updated ({len(perm_ids)} assigned)"}


# ══════════════════════════════════════════════════════════════════════════════
# USER ↔ ROLE ASSIGNMENTS (auth_user_role)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{role_id}/users")
async def get_role_users(
    role_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List users assigned to a role."""
    rows = db.execute(text("""
        SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.is_active
        FROM auth_user_role ur
        JOIN auth_user u ON u.id = ur.user_id
        WHERE ur.role_id = :rid
        ORDER BY u.username
    """), {"rid": role_id}).fetchall()
    return {"success": True, "data": [
        {"id": r.id, "username": r.username, "email": r.email,
         "first_name": r.first_name, "last_name": r.last_name, "is_active": r.is_active}
        for r in rows
    ]}


@router.get("/assignments/list")
async def list_user_role_assignments(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List all user-role assignments."""
    rows = db.execute(text("""
        SELECT ur.id, ur.user_id, ur.role_id,
               u.username, r.name AS role_name
        FROM auth_user_role ur
        JOIN auth_user u ON u.id = ur.user_id
        JOIN auth_role r ON r.id = ur.role_id
        ORDER BY u.username, r.name
    """)).fetchall()
    return {"success": True, "data": [
        {"id": r.id, "user_id": r.user_id, "username": r.username,
         "role_id": r.role_id, "role_name": r.role_name}
        for r in rows
    ]}


@router.post("/assignments")
async def assign_user_role(
    body: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Assign a role to a user. Body: {user_id, role_id}"""
    _require_superuser(current_user)
    user_id = body.get("user_id")
    role_id = body.get("role_id")
    if not user_id or not role_id:
        raise HTTPException(400, "user_id and role_id are required")
    exists = db.execute(text(
        "SELECT 1 FROM auth_user_role WHERE user_id = :uid AND role_id = :rid"
    ), {"uid": user_id, "rid": role_id}).fetchone()
    if exists:
        raise HTTPException(400, "User already has this role")
    db.execute(text(
        "INSERT INTO auth_user_role (user_id, role_id) VALUES (:uid, :rid)"
    ), {"uid": user_id, "rid": role_id})
    db.commit()
    return {"success": True, "message": "Role assigned"}


@router.delete("/assignments/{assignment_id}")
async def remove_user_role(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Remove a user-role assignment by assignment id."""
    _require_superuser(current_user)
    row = db.execute(text("SELECT id FROM auth_user_role WHERE id = :id"), {"id": assignment_id}).fetchone()
    if not row:
        raise HTTPException(404, "Assignment not found")
    db.execute(text("DELETE FROM auth_user_role WHERE id = :id"), {"id": assignment_id})
    db.commit()
    return {"success": True, "message": "Assignment removed"}


# ══════════════════════════════════════════════════════════════════════════════
# PERMISSIONS CATALOGUE
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/permissions/all")
async def list_all_permissions(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return all permission records from auth_permission."""
    rows = db.execute(text("SELECT id, codename, name FROM auth_permission ORDER BY codename")).fetchall()
    return {"success": True, "data": [{"id": r.id, "codename": r.codename, "name": r.name} for r in rows]}


@router.get("/categories/public")
async def get_permission_categories(current_user=Depends(get_current_user)):
    """Return the permission catalogue grouped by category."""
    from itertools import groupby
    grouped: Dict[str, list] = {}
    for p in DEFAULT_PERMISSIONS:
        cat = p["category"]
        grouped.setdefault(cat, []).append({"key": p["code"], "name": p["name"]})
    return [{"key": cat, "name": cat, "permissions": perms} for cat, perms in grouped.items()]


@router.get("/summary/public")
async def role_summary_public(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Summary stats for the Settings dashboard."""
    total_roles = db.execute(text("SELECT COUNT(*) FROM auth_role WHERE is_active = true")).scalar()
    total_users = db.execute(text("SELECT COUNT(*) FROM auth_user WHERE is_active = true")).scalar()
    assigned    = db.execute(text("SELECT COUNT(DISTINCT user_id) FROM auth_user_role")).scalar()
    return {
        "total_roles":        total_roles,
        "active_roles":       total_roles,
        "total_users":        total_users,
        "users_with_roles":   assigned,
        "users_without_roles": total_users - assigned,
    }
