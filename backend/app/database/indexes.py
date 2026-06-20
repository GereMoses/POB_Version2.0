"""
Database Indexes — applied at every startup via CREATE INDEX IF NOT EXISTS.
Only indexes tables confirmed to exist in the schema.
"""

import logging
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Each tuple: (index_name, SQL)
INDEXES = [
    # ── iclock_transaction (heaviest queried table) ───────────────────────
    ("idx_ict_emp_code",        "CREATE INDEX IF NOT EXISTS idx_ict_emp_code        ON iclock_transaction(emp_code)"),
    ("idx_ict_punch_time",      "CREATE INDEX IF NOT EXISTS idx_ict_punch_time      ON iclock_transaction(punch_time DESC)"),
    ("idx_ict_punch_date",      "CREATE INDEX IF NOT EXISTS idx_ict_punch_date      ON iclock_transaction((punch_time::date))"),
    ("idx_ict_emp_date",        "CREATE INDEX IF NOT EXISTS idx_ict_emp_date        ON iclock_transaction(emp_code, (punch_time::date))"),
    ("idx_ict_state",           "CREATE INDEX IF NOT EXISTS idx_ict_state           ON iclock_transaction(punch_state)"),
    ("idx_ict_terminal",        "CREATE INDEX IF NOT EXISTS idx_ict_terminal        ON iclock_transaction(terminal_sn)"),

    # ── personnel ────────────────────────────────────────────────────────
    ("idx_per_status",          "CREATE INDEX IF NOT EXISTS idx_per_status          ON personnel(status)"),
    ("idx_per_emp_code",        "CREATE INDEX IF NOT EXISTS idx_per_emp_code        ON personnel(emp_code)"),
    ("idx_per_badge",           "CREATE INDEX IF NOT EXISTS idx_per_badge           ON personnel(badge_id)"),
    ("idx_per_dept",            "CREATE INDEX IF NOT EXISTS idx_per_dept            ON personnel(department_id)"),

    # ── att_report ───────────────────────────────────────────────────────
    ("idx_atr_date",            "CREATE INDEX IF NOT EXISTS idx_atr_date            ON att_report(att_date)"),
    ("idx_atr_emp_date",        "CREATE INDEX IF NOT EXISTS idx_atr_emp_date        ON att_report(emp_id, att_date)"),
    ("idx_atr_dept",            "CREATE INDEX IF NOT EXISTS idx_atr_dept            ON att_report(department_id)"),
    ("idx_atr_status",          "CREATE INDEX IF NOT EXISTS idx_atr_status          ON att_report(att_status)"),

    # ── leave_management ─────────────────────────────────────────────────
    ("idx_lvm_status",          "CREATE INDEX IF NOT EXISTS idx_lvm_status          ON leave_management(status)"),
    ("idx_lvm_personnel",       "CREATE INDEX IF NOT EXISTS idx_lvm_personnel       ON leave_management(personnel_id)"),
    ("idx_lvm_dates",           "CREATE INDEX IF NOT EXISTS idx_lvm_dates           ON leave_management(start_date, end_date)"),

    # ── vis_visit_log ────────────────────────────────────────────────────
    ("idx_vvl_checkin",         "CREATE INDEX IF NOT EXISTS idx_vvl_checkin         ON vis_visit_log(check_in_time)"),
    ("idx_vvl_status",          "CREATE INDEX IF NOT EXISTS idx_vvl_status          ON vis_visit_log(status)"),
    ("idx_vvl_visitor",         "CREATE INDEX IF NOT EXISTS idx_vvl_visitor         ON vis_visit_log(visitor_id)"),

    # ── vis_pre_registration ─────────────────────────────────────────────
    ("idx_vpr_status",          "CREATE INDEX IF NOT EXISTS idx_vpr_status          ON vis_pre_registration(status)"),

    # ── contractors ──────────────────────────────────────────────────────
    ("idx_con_status",          "CREATE INDEX IF NOT EXISTS idx_con_status          ON contractors(status)"),
    ("idx_con_permit_expiry",   "CREATE INDEX IF NOT EXISTS idx_con_permit_expiry   ON contractors(work_permit_expiry)"),

    # ── zones ────────────────────────────────────────────────────────────
    ("idx_zon_status",          "CREATE INDEX IF NOT EXISTS idx_zon_status          ON zones(status)"),
    ("idx_zon_type",            "CREATE INDEX IF NOT EXISTS idx_zon_type            ON zones(zone_type)"),

    # ── departments ──────────────────────────────────────────────────────
    ("idx_dep_active",          "CREATE INDEX IF NOT EXISTS idx_dep_active          ON departments(is_active)"),

    # ── training_enrollment ──────────────────────────────────────────────
    ("idx_ten_personnel",       "CREATE INDEX IF NOT EXISTS idx_ten_personnel       ON training_enrollment(personnel_id)"),
    ("idx_ten_status",          "CREATE INDEX IF NOT EXISTS idx_ten_status          ON training_enrollment(status)"),
    ("idx_ten_expiry",          "CREATE INDEX IF NOT EXISTS idx_ten_expiry          ON training_enrollment(expiry_date)"),

    # ── sys_notifications ────────────────────────────────────────────────
    ("idx_snf_read",            "CREATE INDEX IF NOT EXISTS idx_snf_read            ON sys_notifications(is_read, created_at DESC)"),
    ("idx_snf_user",            "CREATE INDEX IF NOT EXISTS idx_snf_user            ON sys_notifications(user_id)"),

    # ── base_operationlog ────────────────────────────────────────────────
    ("idx_bol_created",         "CREATE INDEX IF NOT EXISTS idx_bol_created         ON base_operationlog(created_time DESC)"),
    ("idx_bol_user",            "CREATE INDEX IF NOT EXISTS idx_bol_user            ON base_operationlog(user_id)"),

    # ── iclock_terminal ──────────────────────────────────────────────────
    ("idx_itt_sn",              "CREATE INDEX IF NOT EXISTS idx_itt_sn              ON iclock_terminal(sn)"),
    ("idx_itt_last_activity",   "CREATE INDEX IF NOT EXISTS idx_itt_last_activity   ON iclock_terminal(last_activity DESC)"),

    # ── mustering_event ──────────────────────────────────────────────────
    ("idx_mev_status",          "CREATE INDEX IF NOT EXISTS idx_mev_status          ON mustering_event(status)"),
    ("idx_mev_start",           "CREATE INDEX IF NOT EXISTS idx_mev_start           ON mustering_event(start_time DESC)"),

    # ── emergency_event ──────────────────────────────────────────────────
    ("idx_eev_status",          "CREATE INDEX IF NOT EXISTS idx_eev_status          ON emergency_event(status)"),
    ("idx_eev_start",           "CREATE INDEX IF NOT EXISTS idx_eev_start           ON emergency_event(start_time DESC)"),

    # ── COMPOSITE INDEXES (hot query paths identified in deep analysis) ───

    # personnel: active employees by code (attendance calc inner loop)
    ("idx_per_code_active",     "CREATE INDEX IF NOT EXISTS idx_per_code_active     ON personnel(emp_code, is_active)"),

    # att_report: monthly payroll queries — range over emp+date
    ("idx_atr_emp_date_desc",   "CREATE INDEX IF NOT EXISTS idx_atr_emp_date_desc   ON att_report(emp_id, att_date DESC)"),

    # iclock_transaction: live-POB and attendance queries by employee+time
    ("idx_ict_emp_time",        "CREATE INDEX IF NOT EXISTS idx_ict_emp_time        ON iclock_transaction(emp_code, punch_time DESC)"),

    # zone_personnel_tracking: mustering headcount by zone+time
    ("idx_zpt_zone_time",       "CREATE INDEX IF NOT EXISTS idx_zpt_zone_time       ON zone_personnel_tracking(zone_id, punch_time DESC)"),

    # personnel_documents: list by personnel (IDOR-fix queries)
    ("idx_pdoc_personnel",      "CREATE INDEX IF NOT EXISTS idx_pdoc_personnel      ON personnel_documents(personnel_id)"),

    # mustering_drill_schedule: auto-start poller (processed=False + time)
    ("idx_mds_auto_pending",    "CREATE INDEX IF NOT EXISTS idx_mds_auto_pending    ON mustering_drill_schedule(auto_start, processed, scheduled_time)"),

    # auth_user_role + permission chain (RBAC hot path)
    ("idx_aur_user",            "CREATE INDEX IF NOT EXISTS idx_aur_user            ON auth_user_role(user_id)"),
    ("idx_arp_role",            "CREATE INDEX IF NOT EXISTS idx_arp_role            ON auth_role_permission(role_id)"),
]


def apply_indexes(db: Session) -> None:
    """
    Apply all indexes. Called once at application startup.
    Silently skips any index that fails (e.g. column doesn't exist yet).
    """
    ok = fail = 0
    for name, sql in INDEXES:
        try:
            db.execute(text(sql))
            db.commit()
            ok += 1
        except Exception as e:
            db.rollback()
            logger.debug("Index %s skipped: %s", name, e)
            fail += 1
    logger.info("✅ Database indexes: %d applied, %d skipped", ok, fail)
