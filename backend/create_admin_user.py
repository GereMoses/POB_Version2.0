"""
Create default admin user for POB System
"""

import sys
import os

# Add the parent directory to the path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine
from sqlalchemy.orm import sessionmaker
from app.models.biotime_models import AuthUser
from app.core.security import get_password_hash

def create_admin_user():
    """Create default admin user"""
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # Check if admin user already exists
        existing_admin = db.query(AuthUser).filter(AuthUser.username == "admin").first()
        
        if existing_admin:
            print(f"✅ Admin user already exists: {existing_admin.username}")
            print(f"   Email: {existing_admin.email}")
            print(f"   Active: {existing_admin.is_active}")
            print(f"   Superuser: {existing_admin.is_superuser}")
            return
        
        # Create admin user
        admin_user = AuthUser(
            username="admin",
            password=get_password_hash("admin"),  # Default password
            email="admin@pob.com",
            first_name="System",
            last_name="Administrator",
            is_superuser=True,
            is_active=True
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print("✅ Default admin user created successfully!")
        print("=" * 50)
        print("🔐 ADMIN CREDENTIALS")
        print("=" * 50)
        print(f"Username: admin")
        print(f"Password: admin")
        print(f"Email: admin@pob.com")
        print("=" * 50)
        print("⚠️  CHANGE THIS PASSWORD IMMEDIATELY!")
        print("=" * 50)
        
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin_user()
