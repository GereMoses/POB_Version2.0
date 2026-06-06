"""
Migration: Consolidate mustering_zone table into the zones table.

Steps:
  1. Add mustering-specific columns to zones.
  2. Copy every mustering_zone row into zones.
  3. Build an old_id → new_id mapping.
  4. Re-point every FK that pointed at mustering_zone to the new zones rows.
  5. Drop all FK constraints that referenced mustering_zone.
  6. Drop the mustering_zone table.

Tables whose FK(s) are updated:
  - mustering_event.zone_id
  - mustering_drill_schedule.zone_id
  - emergency_device.zone_id
  - emergency_device_enhanced.zone_id  (if exists)
  - emergency_plan.zone_id
  - emergency_template.auto_mustering_zone_id
  - meeting_room (mtg_room).mustering_zone_id
  - visitor_type (vis_type).mustering_zone_id
  - visitor_visit_log.mustering_zone_id
  - iclock_terminal.zone_id            (POB extension column, if present)
"""

import os
import sys
import re
import json
import logging

# Allow running from anywhere in the project tree
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "backend", ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in environment / .env")

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# Map MusteringZone.zone_type (int) → Zone.zone_type (str)
ZONE_TYPE_MAP = {
    0: "LOCATION",
    1: "EMERGENCY",
    2: "SAFE_HAVEN",
}


def column_exists(conn, table, column):
    row = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name=:t AND column_name=:c"
        ),
        {"t": table, "c": column},
    ).fetchone()
    return row is not None


def table_exists(conn, table):
    row = conn.execute(
        text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_name=:t"
        ),
        {"t": table},
    ).fetchone()
    return row is not None


def fk_exists(conn, table, fk_column, target_table):
    """Check whether table.fk_column has a foreign key pointing at target_table."""
    row = conn.execute(
        text(
            "SELECT 1 "
            "FROM information_schema.referential_constraints rc "
            "JOIN information_schema.key_column_usage kcu "
            "  ON kcu.constraint_name = rc.constraint_name "
            "JOIN information_schema.constraint_column_usage ccu "
            "  ON ccu.constraint_name = rc.constraint_name "
            "WHERE kcu.table_name = :table "
            "  AND kcu.column_name = :col "
            "  AND ccu.table_name = :target"
        ),
        {"table": table, "col": fk_column, "target": target_table},
    ).fetchone()
    return row is not None


def get_fk_constraint_name(conn, table, fk_column, target_table):
    row = conn.execute(
        text(
            "SELECT rc.constraint_name "
            "FROM information_schema.referential_constraints rc "
            "JOIN information_schema.key_column_usage kcu "
            "  ON kcu.constraint_name = rc.constraint_name "
            "JOIN information_schema.constraint_column_usage ccu "
            "  ON ccu.constraint_name = rc.constraint_name "
            "WHERE kcu.table_name = :table "
            "  AND kcu.column_name = :col "
            "  AND ccu.table_name = :target "
            "LIMIT 1"
        ),
        {"table": table, "col": fk_column, "target": target_table},
    ).fetchone()
    return row[0] if row else None


def drop_fk_if_exists(conn, table, fk_column, target_table):
    name = get_fk_constraint_name(conn, table, fk_column, target_table)
    if name:
        conn.execute(text(f'ALTER TABLE "{table}" DROP CONSTRAINT "{name}"'))
        log.info("  Dropped FK %s on %s.%s", name, table, fk_column)


def generate_code(name, existing_codes):
    """Generate a unique zone code from a name."""
    base = re.sub(r"[^A-Z0-9]", "", name.upper())[:12] or "MZ"
    code = base
    n = 1
    while code in existing_codes:
        code = f"{base}{n}"
        n += 1
    existing_codes.add(code)
    return code


def run():
    engine = create_engine(DATABASE_URL)

    with engine.begin() as conn:
        # ── 0. Guard: nothing to do if mustering_zone doesn't exist ──────────
        if not table_exists(conn, "mustering_zone"):
            log.info("mustering_zone table does not exist — nothing to migrate.")
            return

        # ── 1. Add new columns to zones ───────────────────────────────────────
        log.info("Step 1: Adding mustering columns to zones…")
        new_cols = [
            ("evac_point",       "VARCHAR(100)"),
            ("evac_gps",         "VARCHAR(50)"),
            ("reader_sn",        "VARCHAR(50)"),
            ("map_x",            "DOUBLE PRECISION"),
            ("map_y",            "DOUBLE PRECISION"),
            ("map_connections",  "TEXT"),
        ]
        for col, col_type in new_cols:
            if not column_exists(conn, "zones", col):
                conn.execute(text(f'ALTER TABLE zones ADD COLUMN "{col}" {col_type}'))
                log.info("  Added zones.%s", col)
            else:
                log.info("  zones.%s already exists — skipped", col)

        # ── 2. Read existing zone codes to avoid collisions ───────────────────
        existing_codes = {
            row[0]
            for row in conn.execute(text("SELECT code FROM zones")).fetchall()
        }

        # ── 3. Copy mustering_zone rows into zones ────────────────────────────
        log.info("Step 2: Copying mustering_zone rows into zones…")
        mz_rows = conn.execute(
            text(
                "SELECT id, name, capacity, evac_point, zone_type, reader_sn, "
                "evac_gps, description, map_x, map_y, map_connections, "
                "latitude, longitude, created_at "
                "FROM mustering_zone ORDER BY id"
            )
        ).fetchall()

        id_map = {}  # old mustering_zone.id → new zones.id

        for row in mz_rows:
            (
                old_id, name, capacity, evac_point, zone_type_int, reader_sn,
                evac_gps, description, map_x, map_y, map_connections,
                latitude, longitude, created_at,
            ) = row

            zone_type_str = ZONE_TYPE_MAP.get(zone_type_int or 0, "LOCATION")
            code = generate_code(name or f"MZ{old_id}", existing_codes)
            lat_str = str(latitude) if latitude is not None else None
            lon_str = str(longitude) if longitude is not None else None

            result = conn.execute(
                text(
                    "INSERT INTO zones "
                    "(name, code, zone_type, description, max_capacity, "
                    " evac_point, evac_gps, reader_sn, "
                    " map_x, map_y, map_connections, "
                    " latitude, longitude, "
                    " status, is_active, created_at) "
                    "VALUES "
                    "(:name, :code, :zone_type, :description, :max_capacity, "
                    " :evac_point, :evac_gps, :reader_sn, "
                    " :map_x, :map_y, :map_connections, "
                    " :latitude, :longitude, "
                    " 'ACTIVE', TRUE, :created_at) "
                    "RETURNING id"
                ),
                {
                    "name": name,
                    "code": code,
                    "zone_type": zone_type_str,
                    "description": description,
                    "max_capacity": capacity,
                    "evac_point": evac_point,
                    "evac_gps": evac_gps,
                    "reader_sn": reader_sn,
                    "map_x": map_x,
                    "map_y": map_y,
                    "map_connections": map_connections,
                    "latitude": lat_str,
                    "longitude": lon_str,
                    "created_at": created_at,
                },
            )
            new_id = result.fetchone()[0]
            id_map[old_id] = new_id
            log.info("  mustering_zone %d → zones %d  (%s)", old_id, new_id, name)

        # ── 4. Drop old FK constraints BEFORE remapping (constraint would block UPDATE) ──
        log.info("Step 3a: Dropping old FK constraints that reference mustering_zone…")
        fk_drop_targets = [
            ("mustering_event",           "zone_id"),
            ("mustering_drill_schedule",  "zone_id"),
            ("emergency_device",          "zone_id"),
            ("emergency_plan",            "zone_id"),
            ("emergency_template",        "auto_mustering_zone_id"),
            ("mtg_room",                  "mustering_zone_id"),
            ("vis_type",                  "mustering_zone_id"),
            ("visitor_visit_log",         "mustering_zone_id"),
            ("emergency_device_enhanced", "zone_id"),
            ("iclock_terminal",           "zone_id"),
        ]
        for table, col in fk_drop_targets:
            if table_exists(conn, table) and column_exists(conn, table, col):
                drop_fk_if_exists(conn, table, col, "mustering_zone")

        if not id_map:
            log.info("  No rows in mustering_zone — skip FK remapping.")
        else:
            # ── 5. Remap FK values ────────────────────────────────────────────
            log.info("Step 3b: Remapping foreign key values…")

            # Simple integer FK columns
            simple_fks = [
                ("mustering_event",        "zone_id"),
                ("mustering_drill_schedule", "zone_id"),
                ("emergency_device",       "zone_id"),
                ("emergency_plan",         "zone_id"),
                ("mtg_room",               "mustering_zone_id"),
                ("vis_type",               "mustering_zone_id"),
                ("visitor_visit_log",      "mustering_zone_id"),
            ]
            # Optional tables (may not exist in all environments)
            optional_fks = [
                ("emergency_device_enhanced", "zone_id"),
                ("iclock_terminal",           "zone_id"),
            ]

            def remap_simple(table, col):
                if not table_exists(conn, table):
                    log.info("  Table %s not found — skipped", table)
                    return
                if not column_exists(conn, table, col):
                    log.info("  Column %s.%s not found — skipped", table, col)
                    return
                for old_id, new_id in id_map.items():
                    conn.execute(
                        text(f'UPDATE "{table}" SET "{col}" = :new WHERE "{col}" = :old'),
                        {"new": new_id, "old": old_id},
                    )
                log.info("  Remapped %s.%s", table, col)

            for table, col in simple_fks:
                remap_simple(table, col)
            for table, col in optional_fks:
                remap_simple(table, col)

            # emergency_template.auto_mustering_zone_id
            if table_exists(conn, "emergency_template") and column_exists(
                conn, "emergency_template", "auto_mustering_zone_id"
            ):
                for old_id, new_id in id_map.items():
                    conn.execute(
                        text(
                            "UPDATE emergency_template "
                            "SET auto_mustering_zone_id = :new "
                            "WHERE auto_mustering_zone_id = :old"
                        ),
                        {"new": new_id, "old": old_id},
                    )
                log.info("  Remapped emergency_template.auto_mustering_zone_id")

            # emergency_plan_enhanced.zone_ids  (ARRAY of ints, no FK constraint)
            if table_exists(conn, "emergency_plan_enhanced") and column_exists(
                conn, "emergency_plan_enhanced", "zone_ids"
            ):
                rows = conn.execute(
                    text("SELECT id, zone_ids FROM emergency_plan_enhanced WHERE zone_ids IS NOT NULL")
                ).fetchall()
                for row_id, zone_ids in rows:
                    if zone_ids:
                        new_ids = [id_map.get(z, z) for z in zone_ids]
                        conn.execute(
                            text(
                                "UPDATE emergency_plan_enhanced SET zone_ids = :ids WHERE id = :rid"
                            ),
                            {"ids": new_ids, "rid": row_id},
                        )
                log.info("  Remapped emergency_plan_enhanced.zone_ids array")

        # ── 6. Add new FK constraints pointing at zones ───────────────────────
        log.info("Step 5: Adding FK constraints that reference zones…")
        new_fks = [
            ("mustering_event",           "zone_id",              "mustering_event_zone_id_fkey"),
            ("mustering_drill_schedule",  "zone_id",              "mustering_drill_zone_id_fkey"),
            ("emergency_device",          "zone_id",              "emergency_device_zone_id_fkey"),
            ("emergency_plan",            "zone_id",              "emergency_plan_zone_id_fkey"),
            ("emergency_template",        "auto_mustering_zone_id", "emg_tmpl_muster_zone_fkey"),
            ("mtg_room",                  "mustering_zone_id",    "mtg_room_mustering_zone_fkey"),
            ("vis_type",                  "mustering_zone_id",    "vis_type_mustering_zone_fkey"),
            ("visitor_visit_log",         "mustering_zone_id",    "vvl_mustering_zone_fkey"),
        ]
        optional_new_fks = [
            ("emergency_device_enhanced", "zone_id",  "emg_dev_enh_zone_id_fkey"),
            ("iclock_terminal",           "zone_id",  "iclock_terminal_zone_id_fkey"),
        ]
        for table, col, name in new_fks + optional_new_fks:
            if table_exists(conn, table) and column_exists(conn, table, col):
                # Only add if the FK doesn't already point at zones
                if not fk_exists(conn, table, col, "zones"):
                    conn.execute(
                        text(
                            f'ALTER TABLE "{table}" '
                            f'ADD CONSTRAINT "{name}" '
                            f'FOREIGN KEY ("{col}") REFERENCES zones(id) ON DELETE SET NULL'
                        )
                    )
                    log.info("  Added FK %s.%s → zones.id", table, col)

        # ── 7. Drop mustering_zone ────────────────────────────────────────────
        log.info("Step 6: Dropping mustering_zone table…")
        conn.execute(text("DROP TABLE mustering_zone CASCADE"))
        log.info("  mustering_zone dropped.")

    log.info("Migration complete.")


if __name__ == "__main__":
    run()
