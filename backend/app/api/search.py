"""
Global Search API — search across personnel, devices, visitors, contractors, zones.
Returns ranked results grouped by entity type.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..core.database import get_db
from ..core.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/search", tags=["Global Search"])

_LIMIT_PER_TYPE = 5


def _user_permissions(current_user, db) -> set:
    """Return the set of permission codenames for the current user."""
    if getattr(current_user, "is_superuser", False):
        return {"*"}
    try:
        rows = db.execute(text("""
            SELECT DISTINCT p.codename
            FROM auth_user_role ur
            JOIN auth_role r ON r.id = ur.role_id AND r.is_active = TRUE
            JOIN auth_role_permission rp ON rp.role_id = r.id
            JOIN auth_permission p ON p.id = rp.permission_id
            WHERE ur.user_id = :uid
        """), {"uid": current_user.id}).fetchall()
        return {row[0] for row in rows}
    except Exception:
        return set()


def _user_dept_id(current_user, db):
    """Return the department_id of the current user's personnel record, or None."""
    try:
        row = db.execute(text(
            "SELECT department_id FROM personnel WHERE user_id = :uid LIMIT 1"
        ), {"uid": current_user.id}).fetchone()
        return row[0] if row else None
    except Exception:
        return None


@router.get("/")
async def global_search(
    q: str = Query(..., min_length=2, max_length=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Search across personnel, devices, zones, visitors, and contractors.
    Results are scoped to the caller's permissions:
    - personnel.view → own department only (superusers see all)
    - visitor.view  → required for visitor/contractor results
    - device.view   → required for device results
    """
    q = q.strip()
    like = f"%{q}%"
    results = []
    perms = _user_permissions(current_user, db)
    is_admin = "*" in perms

    # ── Personnel ─────────────────────────────────────────────────────────────
    if is_admin or "personnel.view" in perms:
        # Non-admins are scoped to their own department
        dept_filter = ""
        params: dict = {"q": like, "lim": _LIMIT_PER_TYPE}
        if not is_admin:
            own_dept = _user_dept_id(current_user, db)
            if own_dept:
                dept_filter = " AND department_id = :dept_id"
                params["dept_id"] = own_dept

        rows = db.execute(text(f"""
            SELECT id, emp_code,
                   (first_name || ' ' || COALESCE(last_name,'')) AS name,
                   COALESCE(department_id::text, '') AS dept,
                   status
            FROM personnel
            WHERE (first_name ILIKE :q OR last_name ILIKE :q
               OR emp_code ILIKE :q OR badge_id ILIKE :q)
            {dept_filter}
            ORDER BY first_name, last_name
            LIMIT :lim
        """), params).fetchall()
    for r in rows:
        results.append({
            "type": "personnel",
            "id": r.id,
            "label": r.name.strip() or r.emp_code,
            "sub": f"Emp: {r.emp_code}  •  {r.status or ''}",
            "url": f"/personnel/{r.id}",
            "icon": "user",
        })

    # ── Devices ───────────────────────────────────────────────────────────────
    if is_admin or "device.view" in perms or "devices.view" in perms:
        try:
            rows = db.execute(text("""
                SELECT id, name, serial_number, ip_address, status
                FROM devices
                WHERE name ILIKE :q OR serial_number ILIKE :q OR ip_address ILIKE :q
                ORDER BY name LIMIT :lim
            """), {"q": like, "lim": _LIMIT_PER_TYPE}).fetchall()
            for r in rows:
                results.append({"type": "device", "id": r.id,
                    "label": r.name or r.serial_number,
                    "sub": f"SN: {r.serial_number or '—'}  •  IP: {r.ip_address or '—'}",
                    "url": "/devices", "icon": "desktop"})
        except Exception:
            pass

    # ── Zones ─────────────────────────────────────────────────────────────────
    if is_admin or "zone.view" in perms or "zones.view" in perms:
        try:
            rows = db.execute(text("""
                SELECT id, name, zone_type, status FROM zones
                WHERE name ILIKE :q OR zone_type ILIKE :q
                ORDER BY name LIMIT :lim
            """), {"q": like, "lim": _LIMIT_PER_TYPE}).fetchall()
            for r in rows:
                results.append({"type": "zone", "id": r.id, "label": r.name,
                    "sub": f"Type: {r.zone_type or '—'}  •  {r.status or ''}",
                    "url": "/zones", "icon": "environment"})
        except Exception:
            pass

    # ── Visitors ──────────────────────────────────────────────────────────────
    if is_admin or "visitor.view" in perms or "visitors.view" in perms:
        try:
            rows = db.execute(text("""
                SELECT v.id, (v.first_name||' '||COALESCE(v.last_name,'')) AS name,
                       v.phone, v.visitor_type
                FROM vis_visitor v
                WHERE v.first_name ILIKE :q OR v.last_name ILIKE :q OR v.phone ILIKE :q
                ORDER BY v.first_name LIMIT :lim
            """), {"q": like, "lim": _LIMIT_PER_TYPE}).fetchall()
            for r in rows:
                results.append({"type": "visitor", "id": r.id, "label": r.name.strip(),
                    "sub": f"Phone: {r.phone or '—'}  •  {r.visitor_type or ''}",
                    "url": "/visitor", "icon": "idcard"})
        except Exception:
            pass

    # ── Contractors ───────────────────────────────────────────────────────────
    if is_admin or "contractor.view" in perms or "visitor.view" in perms:
        try:
            rows = db.execute(text("""
                SELECT c.id, (c.first_name||' '||COALESCE(c.last_name,'')) AS name,
                       c.contractor_code, c.status
                FROM contractors c
                WHERE c.first_name ILIKE :q OR c.last_name ILIKE :q
                   OR c.contractor_code ILIKE :q
                ORDER BY c.first_name LIMIT :lim
            """), {"q": like, "lim": _LIMIT_PER_TYPE}).fetchall()
            for r in rows:
                results.append({"type": "contractor", "id": r.id, "label": r.name.strip(),
                    "sub": f"Code: {r.contractor_code or '—'}  •  {r.status or ''}",
                    "url": "/personnel", "icon": "team"})
        except Exception:
            pass

    # ── Departments ───────────────────────────────────────────────────────────
    if is_admin or "department.view" in perms or "personnel.view" in perms:
        try:
            rows = db.execute(text("""
                SELECT id, name, code FROM departments
                WHERE name ILIKE :q OR code ILIKE :q
                ORDER BY name LIMIT :lim
            """), {"q": like, "lim": _LIMIT_PER_TYPE}).fetchall()
            for r in rows:
                results.append({"type": "department", "id": r.id, "label": r.name,
                    "sub": f"Code: {r.code or '—'}",
                    "url": "/personnel/departments", "icon": "bank"})
        except Exception:
            pass

    return {"query": q, "total": len(results), "results": results}
