#!/usr/bin/env python3
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
from app.core.database import get_db, engine, Base
from app.models.disciplinary_management import DisciplinaryCase

def create_disciplinary_tables():
    db = next(get_db())
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Disciplinary Management tables created")
    except Exception as e:
        print(f"❌ Error creating disciplinary tables: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("Creating Disciplinary Management tables...")
    try:
        create_disciplinary_tables()
        print("\n🎉 Migration completed successfully!")
    except Exception as e:
        print(f"\n💥 Migration failed: {e}")
        sys.exit(1)
