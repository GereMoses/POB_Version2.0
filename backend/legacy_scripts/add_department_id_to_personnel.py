#!/usr/bin/env python3
"""
Migration script to add department_id column to personnel table
"""
import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.core.database import get_db
from sqlalchemy import text

def add_department_id_column():
    """Add department_id column to personnel table"""
    alter_table_sql = """
    ALTER TABLE personnel 
    ADD COLUMN IF NOT EXISTS department_id INTEGER;
    """
    
    db = next(get_db())
    try:
        db.execute(text(alter_table_sql))
        db.commit()
        print("✅ department_id column added to personnel table")
    except Exception as e:
        print(f"❌ Error adding department_id column: {e}")
        db.rollback()
        raise

if __name__ == "__main__":
    print("Adding department_id column to personnel table...")
    try:
        add_department_id_column()
        print("\n🎉 Migration completed successfully!")
    except Exception as e:
        print(f"\n💥 Migration failed: {e}")
        sys.exit(1)
