#!/usr/bin/env python3
"""
Database Initialization Script for POB System
Creates all database tables using SQLAlchemy models
"""

import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app.core.config import settings
from app.models import *

def create_database_tables():
    """Create all database tables"""
    print("🔧 Creating database tables...")
    
    # Create engine - use localhost for external script
    database_url = "postgresql://pob_user:pob_password@localhost:5432/pob_system"
    engine = create_engine(database_url)
    print(f"✅ Connected to database: {database_url}")
    
    # Create all tables
    from app.core.database import Base
    Base.metadata.create_all(bind=engine)
    print("✅ All database tables created successfully!")
    
    # Create session
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create sample departments if none exist
        from app.models.department import Department
        
        dept_count = db.query(Department).count()
        print(f"📊 Current department count: {dept_count}")
        
        if dept_count == 0:
            print("📝 Creating sample departments...")
            sample_departments = [
                Department(
                    name="Operations Department",
                    code="OPS-001",
                    description="Main operations department for platform activities",
                    department_type="operations",
                    status="active",
                    site_name="Platform Alpha",
                    manager_id=1,
                    parent_id=None,
                    level=1,
                    is_active=True
                ),
                Department(
                    name="Safety Department",
                    code="SAF-001",
                    description="Safety and compliance department",
                    department_type="safety",
                    status="active",
                    site_name="Platform Alpha",
                    manager_id=2,
                    parent_id=None,
                    level=1,
                    is_active=True
                ),
                Department(
                    name="Maintenance Department",
                    code="MAINT-001",
                    description="Equipment maintenance and repairs",
                    department_type="maintenance",
                    status="active",
                    site_name="Platform Alpha",
                    manager_id=3,
                    parent_id=None,
                    level=1,
                    is_active=True
                ),
                Department(
                    name="Logistics Department",
                    code="LOG-001",
                    description="Supply chain and logistics management",
                    department_type="logistics",
                    status="active",
                    site_name="Platform Alpha",
                    manager_id=4,
                    parent_id=None,
                    level=1,
                    is_active=True
                ),
                Department(
                    name="Medical Department",
                    code="MED-001",
                    description="Medical services and emergency response",
                    department_type="medical",
                    status="active",
                    site_name="Platform Alpha",
                    manager_id=5,
                    parent_id=None,
                    level=1,
                    is_active=True
                )
            ]
            
            for dept in sample_departments:
                db.add(dept)
            
            db.commit()
            print("✅ Sample departments created successfully!")
        else:
            print("✅ Departments already exist in database")
            
    except Exception as e:
        print(f"❌ Error creating sample data: {e}")
        db.rollback()
    finally:
        db.close()
    
    print("🎉 Database initialization complete!")

if __name__ == "__main__":
    create_database_tables()
