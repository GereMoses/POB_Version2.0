#!/usr/bin/env python3
"""
Migration script to create Shift Management and Schedule Management tables
ZKTeco BioTime compatible tables for personnel shift and schedule management
"""

import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.core.database import get_db
from sqlalchemy import text
from app.models.shift_management import ShiftManagement, ScheduleManagement

def create_shift_management_tables():
    """Create shift management tables"""
    
    db = next(get_db())
    
    try:
        # Create tables using SQLAlchemy
        from app.core.database import engine
        from app.core.database import Base
        Base.metadata.create_all(bind=engine)
        
        print("✅ Shift Management tables created successfully")
        
        # Check if shifts already exist
        existing_shifts = db.query(ShiftManagement).count()
        if existing_shifts > 0:
            print(f"⚠️  {existing_shifts} shifts already exist, skipping default data insertion")
            return
        
        # Create default shifts
        default_shifts = [
            ShiftManagement(
                shift_code="MORNING",
                shift_name="Morning Shift",
                start_time="06:00:00",
                end_time="14:00:00",
                break_duration=30,
                shift_type="morning",
                working_hours=8,
                grace_period_minutes=15,
                max_late_minutes=60,
                max_early_departure_minutes=30,
                overtime_threshold_minutes=30,
                description="Standard morning shift from 6:00 AM to 2:00 PM",
                is_active=True
            ),
            ShiftManagement(
                shift_code="EVENING",
                shift_name="Evening Shift",
                start_time="14:00:00",
                end_time="22:00:00",
                break_duration=30,
                shift_type="evening",
                working_hours=8,
                grace_period_minutes=15,
                max_late_minutes=60,
                max_early_departure_minutes=30,
                overtime_threshold_minutes=30,
                description="Standard evening shift from 2:00 PM to 10:00 PM",
                is_active=True
            ),
            ShiftManagement(
                shift_code="NIGHT",
                shift_name="Night Shift",
                start_time="22:00:00",
                end_time="06:00:00",
                break_duration=30,
                shift_type="night",
                is_night_shift=True,
                working_hours=8,
                grace_period_minutes=15,
                max_late_minutes=60,
                max_early_departure_minutes=30,
                overtime_threshold_minutes=30,
                description="Night shift from 10:00 PM to 6:00 AM",
                is_active=True
            ),
            ShiftManagement(
                shift_code="FLEXIBLE",
                shift_name="Flexible Shift",
                start_time="08:00:00",
                end_time="17:00:00",
                break_duration=60,
                shift_type="custom",
                is_flexible=True,
                working_hours=8,
                grace_period_minutes=30,
                max_late_minutes=90,
                max_early_departure_minutes=60,
                overtime_threshold_minutes=60,
                description="Flexible shift with extended grace periods",
                is_active=True
            ),
            ShiftManagement(
                shift_code="ROTATING_4_2",
                shift_name="4 Days On, 2 Days Off",
                start_time="08:00:00",
                end_time="16:00:00",
                break_duration=30,
                shift_type="rotating",
                working_hours=8,
                rotation_pattern=["day", "day", "day", "day", "off", "off"],
                rotation_cycle_days=6,
                grace_period_minutes=15,
                max_late_minutes=60,
                max_early_departure_minutes=30,
                overtime_threshold_minutes=30,
                description="Rotating shift pattern: 4 working days followed by 2 days off",
                is_active=True
            )
        ]
        
        db.add_all(default_shifts)
        db.commit()
        
        print(f"✅ Inserted {len(default_shifts)} default shifts")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating shift management tables: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("Creating Shift Management tables...")
    try:
        create_shift_management_tables()
        print("\n🎉 Migration completed successfully!")
    except Exception as e:
        print(f"\n💥 Migration failed: {e}")
        sys.exit(1)