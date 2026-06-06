#!/usr/bin/env python3
"""
Initialize Role Management System

This script initializes the role management system with default roles and permissions.
Run this script after creating the role tables to populate them with default data.
"""

import sys
import os
from sqlalchemy.orm import sessionmaker

# Add the app directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.models.roles import Role, Permission, DEFAULT_PERMISSIONS
from app.services.role_permission_service import role_permission_service


def init_role_system():
    """Initialize the role management system with default data"""
    
    print("🚀 Initializing role management system...")
    
    try:
        # Create database session
        from sqlalchemy import create_engine
        engine = create_engine(settings.DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        print("✅ Database connection established")
        
        # Check if permissions already exist
        existing_permissions = db.query(Permission).count()
        if existing_permissions == 0:
            print("📝 Creating default permissions...")
            for perm_data in DEFAULT_PERMISSIONS:
                permission = Permission(**perm_data)
                db.add(permission)
            db.commit()
            print(f"✅ Created {len(DEFAULT_PERMISSIONS)} default permissions")
        else:
            print(f"ℹ️  Permissions already exist ({existing_permissions} found)")
        
        # Check if roles already exist
        existing_roles = db.query(Role).count()
        if existing_roles == 0:
            print("📝 Creating default system roles...")
            for role_key, role_data in role_permission_service.default_roles.items():
                role = Role(
                    id=role_key,
                    name=role_data["name"],
                    description=role_data["description"],
                    level=role_data["level"],
                    permissions=role_data["permissions"],
                    is_system=role_data["is_system"],
                    is_active=True
                )
                db.add(role)
            db.commit()
            print(f"✅ Created {len(role_permission_service.default_roles)} default system roles")
        else:
            print(f"ℹ️  Roles already exist ({existing_roles} found)")
        
        # Print summary
        print("\n📊 System Summary:")
        total_permissions = db.query(Permission).count()
        total_roles = db.query(Role).count()
        system_roles = db.query(Role).filter(Role.is_system == True).count()
        custom_roles = db.query(Role).filter(Role.is_system == False).count()
        
        print(f"  - Total Permissions: {total_permissions}")
        print(f"  - Total Roles: {total_roles}")
        print(f"  - System Roles: {system_roles}")
        print(f"  - Custom Roles: {custom_roles}")
        
        print("\n🎉 Role management system initialized successfully!")
        
        db.close()
        
    except Exception as e:
        print(f"❌ Error initializing role system: {e}")
        if 'db' in locals():
            db.rollback()
            db.close()
        raise


if __name__ == "__main__":
    init_role_system()
