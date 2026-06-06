#!/usr/bin/env python3
"""
Database Migration Script for Role Management Tables

This script creates the necessary database tables for the role-based access control (RBAC) system.
"""

import sys
import os
from sqlalchemy import create_engine, text

# Add the app directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.models.roles import Base, Role, RoleAssignment, Permission, RolePermission, DEFAULT_PERMISSIONS
from app.models.personnel import Personnel


def create_role_tables():
    """Create all role-related tables and insert default data"""
    
    print("Starting role tables creation...")
    
    try:
        # Create database engine
        engine = create_engine(settings.DATABASE_URL)
        print(f"Connected to database: {settings.DATABASE_URL}")
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("Role management tables created successfully")
        
        # Insert default permissions
        from sqlalchemy.orm import sessionmaker
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            # Check if permissions already exist
            existing_permissions = db.query(Permission).count()
            if existing_permissions == 0:
                print("Inserting default permissions...")
                for perm_data in DEFAULT_PERMISSIONS:
                    permission = Permission(**perm_data)
                    db.add(permission)
                db.commit()
                print(f"Inserted {len(DEFAULT_PERMISSIONS)} default permissions")
            else:
                print(f"Permissions already exist ({existing_permissions} found)")
            
            # Check if default roles exist
            from app.services.role_permission_service import role_permission_service
            existing_roles = db.query(Role).count()
            if existing_roles == 0:
                print("Inserting default system roles...")
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
                print(f"Inserted {len(role_permission_service.default_roles)} default system roles")
            else:
                print(f"Roles already exist ({existing_roles} found)")
                
        except Exception as e:
            print(f"Error inserting default data: {e}")
            db.rollback()
            raise
        finally:
            db.close()
        
        print("Role management system setup completed successfully!")
        
        # Print summary
        print("\nDatabase Summary:")
        print("  - Roles table: created")
        print("  - Role assignments table: created")
        print("  - Permissions table: created")
        print("  - Role permissions table: created")
        
    except Exception as e:
        print(f"Error creating role tables: {e}")
        raise


if __name__ == "__main__":
    create_role_tables()
