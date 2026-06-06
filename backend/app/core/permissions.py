"""
Report Permission System — BioTime-compatible
Checks permissions against auth_role / auth_permission tables.
No hardcoded role→permission mappings; the DB is the single source of truth.
"""

from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi import HTTPException, Depends


def _has_db_permission(user_id: int, codename: str, db: Session) -> bool:
    """Return True if the user has the given permission codename via auth_* tables."""
    row = db.execute(text("""
        SELECT 1 FROM auth_user_role ur
        JOIN auth_role r ON r.id = ur.role_id AND r.is_active = true
        JOIN auth_role_permission rp ON rp.role_id = r.id
        JOIN auth_permission p ON p.id = rp.permission_id AND p.codename = :perm
        WHERE ur.user_id = :uid
        LIMIT 1
    """), {"uid": user_id, "perm": codename}).fetchone()
    return row is not None


def check_report_permission(user, module: str, action: str, db: Session = None) -> bool:
    """
    Check if user has permission for a report module/action.

    Permission codename format: report.<module>.<action>
    e.g. report.attendance.view, report.payroll.export

    Args:
        user:   AuthUser or any object with .id and .is_superuser
        module: report module name (attendance, personnel, access_control …)
        action: view | export | schedule | create
        db:     SQLAlchemy session — required for non-superusers
    """
    if not user:
        return False
    if getattr(user, "is_superuser", False):
        return True
    if db is None:
        return False  # cannot check without a DB session
    codename = f"report.{module}.{action}"
    return _has_db_permission(user.id, codename, db)


def require_report_permission(module: str, action: str):
    """FastAPI dependency that raises 403 when permission is missing."""
    from ..core.dependencies import get_db, get_current_active_user

    def dependency(
        current_user=Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ):
        if not check_report_permission(current_user, module, action, db):
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions for {module}.{action}",
            )
        return current_user

    return dependency


# ── Convenience helpers ───────────────────────────────────────────────────────

def filter_reports_by_permission(user, reports: list, db: Session = None) -> list:
    return [
        r for r in reports
        if check_report_permission(user, r.get("module", ""), "view", db)
    ]


def get_user_accessible_modules(user, db: Session = None) -> list:
    modules = [
        "personnel", "attendance", "access_control", "devices",
        "mustering", "emergency", "payroll", "visitor", "meeting", "mtd", "system",
    ]
    return [m for m in modules if check_report_permission(user, m, "view", db)]


def can_view_report(user, report_code: str, db: Session = None) -> bool:
    module = report_code.split(".")[0] if "." in report_code else "unknown"
    return check_report_permission(user, module, "view", db)


def can_export_report(user, report_code: str, db: Session = None) -> bool:
    module = report_code.split(".")[0] if "." in report_code else "unknown"
    return check_report_permission(user, module, "export", db)


def can_schedule_report(user, report_code: str, db: Session = None) -> bool:
    module = report_code.split(".")[0] if "." in report_code else "unknown"
    return check_report_permission(user, module, "schedule", db)


def can_create_template(user, module: str, db: Session = None) -> bool:
    return check_report_permission(user, module, "create", db)


def can_access_custom_builder(user, db: Session = None) -> bool:
    if getattr(user, "is_superuser", False):
        return True
    # Builder requires at least one report.*.create permission
    for module in ["personnel", "attendance", "access_control", "mustering", "emergency"]:
        if check_report_permission(user, module, "create", db):
            return True
    return False


def can_view_mtd_data(user, db: Session = None) -> bool:
    return check_report_permission(user, "mtd", "view", db)


def can_view_payroll_data(user, db: Session = None) -> bool:
    return check_report_permission(user, "payroll", "view", db)


def can_access_template(user, template, db: Session = None) -> bool:
    if template.created_by == user.id:
        return True
    if getattr(template, "is_public", False) or getattr(template, "is_system", False):
        return check_report_permission(user, template.module, "view", db)
    return False


def can_modify_template(user, template, db: Session = None) -> bool:
    if getattr(template, "is_system", False):
        return False
    if template.created_by == user.id:
        return check_report_permission(user, template.module, "create", db)
    return False


def can_delete_template(user, template, db: Session = None) -> bool:
    return can_modify_template(user, template, db)


def can_access_schedule(user, schedule, db: Session = None) -> bool:
    if schedule.created_by == user.id:
        return True
    return getattr(user, "is_superuser", False)


def can_modify_schedule(user, schedule, db: Session = None) -> bool:
    return can_access_schedule(user, schedule, db)


def can_export_large_dataset(user, row_count: int) -> bool:
    """Superusers: unlimited. Others: capped at 10 000 rows."""
    if getattr(user, "is_superuser", False):
        return True
    return row_count <= 10000


def can_export_sensitive_data(user, module: str, db: Session = None) -> bool:
    if getattr(user, "is_superuser", False):
        return True
    return check_report_permission(user, module, "export", db)
