"""
POB uses BioTime-compatible auth_* tables for all RBAC.
See: auth_role, auth_user_role, auth_permission, auth_role_permission

The SQLAlchemy ORM classes that previously lived here (Role, RoleAssignment,
Permission, RolePermission) have been removed — they mapped to a separate
`roles` / `permissions` / `role_assignments` / `role_permissions` schema that
conflicted with the BioTime approach.
"""

# Permission codenames recognised by the system.
# These are the codenames stored in auth_permission.codename.
DEFAULT_PERMISSIONS = [
    # Personnel
    {"code": "personnel.view",   "name": "View Personnel",   "category": "Personnel"},
    {"code": "personnel.change", "name": "Change Personnel", "category": "Personnel"},
    # Attendance
    {"code": "attendance.view",   "name": "View Attendance",   "category": "Attendance"},
    {"code": "attendance.change", "name": "Change Attendance", "category": "Attendance"},
    # Access Control
    {"code": "access_control.view",   "name": "View Access Control",   "category": "Access Control"},
    {"code": "access_control.change", "name": "Change Access Control", "category": "Access Control"},
    # Devices
    {"code": "devices.view",   "name": "View Devices",   "category": "Devices"},
    {"code": "devices.change", "name": "Change Devices", "category": "Devices"},
    {"code": "devices.sync",   "name": "Sync Devices",   "category": "Devices"},
    # POB
    {"code": "pob.view",   "name": "View POB",   "category": "POB"},
    {"code": "pob.change", "name": "Change POB", "category": "POB"},
    # Emergency / Mustering
    {"code": "emergency.view",   "name": "View Emergency",   "category": "Emergency"},
    {"code": "emergency.manage", "name": "Manage Emergency", "category": "Emergency"},
    {"code": "mustering.view",   "name": "View Mustering",   "category": "Mustering"},
    {"code": "mustering.manage", "name": "Manage Mustering", "category": "Mustering"},
    # Visitors
    {"code": "visitors.view", "name": "View Visitors", "category": "Visitors"},
    {"code": "visitors.add",  "name": "Add Visitors",  "category": "Visitors"},
    # Reports
    {"code": "reports.view",   "name": "View Reports",   "category": "Reports"},
    {"code": "reports.export", "name": "Export Reports", "category": "Reports"},
    # Report sub-permissions (module.action pattern)
    {"code": "report.attendance.view",     "name": "View Attendance Reports",   "category": "Reports"},
    {"code": "report.attendance.export",   "name": "Export Attendance Reports", "category": "Reports"},
    {"code": "report.personnel.view",      "name": "View Personnel Reports",    "category": "Reports"},
    {"code": "report.personnel.export",    "name": "Export Personnel Reports",  "category": "Reports"},
    {"code": "report.access_control.view", "name": "View AC Reports",           "category": "Reports"},
    {"code": "report.access_control.export","name": "Export AC Reports",        "category": "Reports"},
    {"code": "report.mustering.view",      "name": "View Mustering Reports",    "category": "Reports"},
    {"code": "report.mustering.export",    "name": "Export Mustering Reports",  "category": "Reports"},
    {"code": "report.emergency.view",      "name": "View Emergency Reports",    "category": "Reports"},
    {"code": "report.emergency.export",    "name": "Export Emergency Reports",  "category": "Reports"},
    {"code": "report.payroll.view",        "name": "View Payroll Reports",      "category": "Reports"},
    {"code": "report.payroll.export",      "name": "Export Payroll Reports",    "category": "Reports"},
    {"code": "report.visitor.view",        "name": "View Visitor Reports",      "category": "Reports"},
    {"code": "report.visitor.export",      "name": "Export Visitor Reports",    "category": "Reports"},
    {"code": "report.mtd.view",            "name": "View MTD Reports",          "category": "Reports"},
    {"code": "report.mtd.export",          "name": "Export MTD Reports",        "category": "Reports"},
    # Settings
    {"code": "settings.view",        "name": "View Settings",        "category": "Settings"},
    {"code": "settings.change",      "name": "Change Settings",      "category": "Settings"},
    {"code": "settings.manage_users","name": "Manage Users",         "category": "Settings"},
    {"code": "settings.manage_roles","name": "Manage Roles",         "category": "Settings"},
]
