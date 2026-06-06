#!/usr/bin/env python3
"""
Migration script to create Leave Management tables
ZKTeco BioTime compatible tables for personnel leave management
"""

import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.core.database import get_db, engine, Base
from app.models.leave_management import LeaveManagement, LeaveBalance, LeaveBlackout
from app.models.personnel import Personnel
from datetime import date

def create_leave_management_tables():
    """Create leave management tables"""
    
    db = next(get_db())
    
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Leave Management tables created successfully")
        
        current_year = date.today().year
        
        # Check if balances already exist
        existing_balances = db.query(LeaveBalance).filter(LeaveBalance.year == current_year).count()
        if existing_balances > 0:
            print(f"⚠️  {existing_balances} leave balances already exist for {current_year}, skipping default data insertion")
            return
        
        # Get all personnel
        personnel_list = db.query(Personnel).all()
        
        default_balances = []
        for personnel in personnel_list:
            # Annual leave
            default_balances.append(LeaveBalance(
                personnel_id=personnel.id,
                leave_type="annual",
                year=current_year,
                total_days=30,
                used_days=0,
                balance_days=30,
                carry_forward_days=0,
                accrual_rate=2.5
            ))
            
            # Sick leave
            default_balances.append(LeaveBalance(
                personnel_id=personnel.id,
                leave_type="sick",
                year=current_year,
                total_days=15,
                used_days=0,
                balance_days=15,
                carry_forward_days=0,
                accrual_rate=1.25
            ))
            
            # Compassionate leave
            default_balances.append(LeaveBalance(
                personnel_id=personnel.id,
                leave_type="compassionate",
                year=current_year,
                total_days=5,
                used_days=0,
                balance_days=5,
                carry_forward_days=0,
                accrual_rate=0
            ))
        
        db.add_all(default_balances)
        db.commit()
        
        print(f"✅ Inserted {len(default_balances)} default leave balances for {len(personnel_list)} personnel")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating leave management tables: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("Creating Leave Management tables...")
    try:
        create_leave_management_tables()
        print("\n🎉 Migration completed successfully!")
    except Exception as e:
        print(f"\n💥 Migration failed: {e}")
        sys.exit(1)
