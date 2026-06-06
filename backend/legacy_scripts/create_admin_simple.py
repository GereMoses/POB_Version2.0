"""
Create default admin user using direct SQL
"""

import sys
import os

# Add the parent directory to the path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine
from sqlalchemy import text
from app.core.security import get_password_hash

def create_admin_user():
    """Create default admin user using direct SQL"""
    
    try:
        with engine.connect() as connection:
            # Check if admin user already exists
            result = connection.execute(text("SELECT username FROM auth_user WHERE username = 'admin'"))
            existing = result.fetchone()
            
            if existing:
                print(f"✅ Admin user already exists: {existing.username}")
                return
            
            # Create admin user with hashed password
            hashed_password = get_password_hash("admin")
            
            # Insert admin user
            connection.execute(text("""
                INSERT INTO auth_user (username, password, email, first_name, last_name, is_superuser, is_active, created_at, updated_at)
                VALUES ('admin', :password, 'admin@pob.com', 'System', 'Administrator', true, true, NOW(), NOW())
            """), {"password": hashed_password})
            
            connection.commit()
            
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

if __name__ == "__main__":
    create_admin_user()
