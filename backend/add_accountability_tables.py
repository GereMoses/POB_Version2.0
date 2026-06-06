"""
Migration: Add accountability closure loop tables
- mustering_search_sweep
- mustering_escalation_record

Run once:  docker exec pob_backend python add_accountability_tables.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import engine, Base
from sqlalchemy import text

# Import models so their metadata is registered with Base
from app.models.biotime_models import MusteringSearchSweep, MusteringEscalationRecord  # noqa

def run():
    with engine.connect() as conn:
        # Create new tables (checkfirst=True skips if already exist)
        Base.metadata.create_all(
            bind=engine,
            tables=[
                MusteringSearchSweep.__table__,
                MusteringEscalationRecord.__table__,
            ],
            checkfirst=True,
        )
        print("✓ mustering_search_sweep table ensured")
        print("✓ mustering_escalation_record table ensured")

        # Verify
        for tbl in ('mustering_search_sweep', 'mustering_escalation_record'):
            result = conn.execute(text(
                f"SELECT COUNT(*) FROM information_schema.tables "
                f"WHERE table_name = '{tbl}'"
            ))
            exists = result.scalar() > 0
            print(f"  {'EXISTS' if exists else 'MISSING'}: {tbl}")

    print("\nMigration complete.")

if __name__ == '__main__':
    run()
