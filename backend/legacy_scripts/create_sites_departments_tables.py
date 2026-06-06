#!/usr/bin/env python3
"""
Migration script to create sites and departments tables
"""
import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.core.database import get_db
from sqlalchemy import text

def create_sites_table():
    """Create the sites table"""
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS sites (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100),
        postal_code VARCHAR(20),
        site_manager_id INTEGER,
        contact_person VARCHAR(255),
        contact_email VARCHAR(255),
        contact_phone VARCHAR(20),
        site_type VARCHAR(50),
        capacity INTEGER,
        current_occupancy INTEGER DEFAULT 0,
        zkteco_site_id VARCHAR(50),
        zkteco_sync_enabled BOOLEAN DEFAULT TRUE,
        last_sync_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_by INTEGER,
        is_active BOOLEAN DEFAULT TRUE
    );
    """
    
    db = next(get_db())
    try:
        db.execute(text(create_table_sql))
        db.commit()
        print("✅ Sites table created successfully")
    except Exception as e:
        print(f"❌ Error creating sites table: {e}")
        db.rollback()
        raise

def create_departments_table():
    """Create the departments table"""
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        department_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        parent_id INTEGER REFERENCES departments(id),
        level INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        site_id INTEGER REFERENCES sites(id),
        site_name VARCHAR(255),
        location VARCHAR(255),
        zone VARCHAR(100),
        manager_id INTEGER,
        contact_person VARCHAR(255),
        contact_email VARCHAR(255),
        contact_phone VARCHAR(20),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_by INTEGER,
        is_active BOOLEAN DEFAULT TRUE
    );
    """
    
    db = next(get_db())
    try:
        db.execute(text(create_table_sql))
        db.commit()
        print("✅ Departments table created successfully")
    except Exception as e:
        print(f"❌ Error creating departments table: {e}")
        db.rollback()
        raise

def create_department_personnel_table():
    """Create the department_personnel table"""
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS department_personnel (
        id SERIAL PRIMARY KEY,
        department_id INTEGER NOT NULL REFERENCES departments(id),
        personnel_id INTEGER NOT NULL REFERENCES personnel(id),
        role VARCHAR(100) NOT NULL,
        position VARCHAR(100),
        is_primary BOOLEAN DEFAULT FALSE,
        is_manager BOOLEAN DEFAULT FALSE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        unassigned_at TIMESTAMP WITH TIME ZONE,
        approved_by INTEGER,
        approved_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20) DEFAULT 'active'
    );
    """
    
    db = next(get_db())
    try:
        db.execute(text(create_table_sql))
        db.commit()
        print("✅ Department_personnel table created successfully")
    except Exception as e:
        print(f"❌ Error creating department_personnel table: {e}")
        db.rollback()
        raise

if __name__ == "__main__":
    print("Creating sites and departments tables...")
    try:
        create_sites_table()
        create_departments_table()
        create_department_personnel_table()
        print("\n🎉 All tables created successfully!")
    except Exception as e:
        print(f"\n💥 Migration failed: {e}")
        sys.exit(1)
