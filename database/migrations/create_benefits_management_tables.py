#!/usr/bin/env python3
import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
from app.core.database import get_db, engine, Base
from app.models.benefits_management import BenefitPlan, EmployeeBenefit

def create_benefits_tables():
    db = next(get_db())
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Benefits Management tables created")
    except Exception as e:
        print(f"❌ Error creating benefits tables: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("Creating Benefits Management tables...")
    try:
        create_benefits_tables()
        print("\n🎉 Migration completed successfully!")
    except Exception as e:
        print(f"\n💥 Migration failed: {e}")
        sys.exit(1)
