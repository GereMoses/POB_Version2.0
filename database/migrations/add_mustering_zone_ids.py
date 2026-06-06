"""
Migration: Add zone_ids JSONB column to mustering_event, make zone_id nullable.

This enables mustering events to cover multiple access-control zones at once.
"""

import os
import sys
import logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "backend", ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in environment / .env")

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)


def run():
    engine = create_engine(DATABASE_URL)

    with engine.begin() as conn:
        log.info("Adding zone_ids JSONB column to mustering_event ...")
        conn.execute(text("""
            ALTER TABLE mustering_event
                ADD COLUMN IF NOT EXISTS zone_ids JSONB DEFAULT '[]'::jsonb
        """))

        log.info("Making mustering_event.zone_id nullable ...")
        conn.execute(text("""
            ALTER TABLE mustering_event
                ALTER COLUMN zone_id DROP NOT NULL
        """))

        log.info("Back-filling zone_ids from existing zone_id values ...")
        conn.execute(text("""
            UPDATE mustering_event
               SET zone_ids = json_build_array(zone_id)::jsonb
             WHERE zone_ids = '[]'::jsonb
               AND zone_id IS NOT NULL
        """))

    log.info("Migration complete.")


if __name__ == "__main__":
    run()
