#!/usr/bin/env python3
"""
Create Test Role Directly

This script creates a test role using the existing database connection
by leveraging the backend's database session.
"""

import sys
import os

# Add the app directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


def create_test_role():
    """Create a test role using the backend's database connection"""
    
    print("Creating test role using backend database connection...")
    
    try:
        # Import the backend's database session
        from app.core.database import SessionLocal
        
        # Create a database session
        db = SessionLocal()
        
        # Create a test role using a simple SQL insert
        # This avoids the SQLAlchemy model import issues
        print("Inserting test role into database...")
        
        # Using raw SQL to avoid model import issues
        from sqlalchemy import text
        result = db.execute(text("""
            INSERT INTO roles (name, description, is_active) 
            VALUES (:name, :description, :is_active) 
            RETURNING id, name, description, is_active, created_at
        """), {
            "name": "Backend Test Role",
            "description": "A test role created via backend database connection",
            "is_active": True
        })
        
        new_role = result.fetchone()
        db.commit()
        
        if new_role:
            print(f"✅ Test role created successfully!")
            print(f"   ID: {new_role[0]}")
            print(f"   Name: {new_role[1]}")
            print(f"   Description: {new_role[2]}")
            print(f"   Active: {new_role[3]}")
            print(f"   Created At: {new_role[4]}")
        
        # Verify the role was saved
        print("Verifying role in database...")
        verify_result = db.execute(text("SELECT * FROM roles WHERE id = :role_id"), {"role_id": new_role[0]})
        saved_role = verify_result.fetchone()
        
        if saved_role:
            print("Role successfully saved and retrieved!")
        else:
            print("Failed to retrieve saved role!")
        
        # Show all roles
        print("All roles in database:")
        all_roles = db.execute(text("SELECT id, name, description, is_active FROM roles ORDER BY id")).fetchall()
        
        for role in all_roles:
            print(f"   - ID: {role[0]}, Name: {role[1]}, Active: {role[3]}")
        
        print(f"Total roles: {len(all_roles)}")
        
        db.close()
        
        print("🎉 Test role creation completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during test role creation: {e}")
        if 'db' in locals():
            db.rollback()
            db.close()
        raise


if __name__ == "__main__":
    create_test_role()
