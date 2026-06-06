"""
Database initialization script for POB System
Creates all tables and initial data
"""

import sys
import os

# Add the parent directory to the path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine, Base
from app.models.user import User, Role, UserRole
from app.models.personnel import Personnel, PersonnelAssignment, AttendanceLog
from app.models.certification import Certification


def create_tables():
    """Create all database tables"""
    print("🔧 Creating database tables...")
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    print("✅ Database tables created successfully!")


def create_initial_data():
    """Create initial data for the system"""
    from sqlalchemy.orm import sessionmaker
    
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # Create default roles
        print("👥 Creating default roles...")
        
        roles = [
            Role(name="admin", description="System Administrator"),
            Role(name="manager", description="Operations Manager"),
            Role(name="supervisor", description="Site Supervisor"),
            Role(name="operator", description="System Operator"),
            Role(name="viewer", description="Read-only access")
        ]
        
        for role in roles:
            existing_role = db.query(Role).filter(Role.name == role.name).first()
            if not existing_role:
                db.add(role)
        
        # Create default admin user ONLY if no users exist and environment allows it
        print("👤 Checking admin user setup...")
        
        existing_users = db.query(User).count()
        admin_user = db.query(User).filter(User.email == "admin@pob.com").first()
        
        if existing_users == 0 and not admin_user:
            # Only create admin if NO users exist and in development mode
            import os
            if os.getenv("CREATE_DEFAULT_ADMIN", "false").lower() == "true":
                from app.core.security import get_password_hash
                import secrets
                
                # Generate secure random password
                default_password = secrets.token_urlsafe(16)
                
                admin_user = User(
                    email="admin@pob.com",
                    username="admin",
                    full_name="System Administrator",
                    hashed_password=get_password_hash(default_password),
                    is_active=True,
                    is_superuser=True,
                    is_verified=True
                )
                
                print("\n" + "="*60)
                print("🔐 DEFAULT ADMIN USER CREATED")
                print("="*60)
                print(f"Email: admin@pob.com")
                print(f"Username: admin")
                print(f"Password: {default_password}")
                print("="*60)
                print("⚠️  CHANGE THIS PASSWORD IMMEDIATELY!")
                print("="*60)
            else:
                print("ℹ️  Default admin user not created (CREATE_DEFAULT_ADMIN=false)")
        else:
            # Admin user was created, proceed with role assignment
            if admin_user:
                db.add(admin_user)
                db.commit()
                db.refresh(admin_user)
                
                # Assign admin role
                admin_role = db.query(Role).filter(Role.name == "admin").first()
                if admin_role:
                    user_role = UserRole(
                        user_id=admin_user.id,
                        role_id=admin_role.id
                    )
                    db.add(user_role)
        
        db.commit()
        print("✅ Initial data created successfully!")
        
        print("\n" + "="*50)
        print("🎉 POB SYSTEM SETUP COMPLETE!")
        print("="*50)
        print("✅ Database tables and initial data created")
        print("ℹ️  No default admin user created for security")
        print("📝 Please create admin users through proper channels")
        print("="*50)
        
    except Exception as e:
        print(f"❌ Error creating initial data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def main():
    """Main function"""
    print("🚀 Initializing POB System Database...")
    
    try:
        # Test database connection
        from app.core.database import test_db_connection
        
        if not test_db_connection():
            print("❌ Database connection failed!")
            print("Please check your database configuration in .env file")
            return
        
        print("✅ Database connection successful!")
        
        # Create tables
        create_tables()
        
        # Create initial data
        create_initial_data()
        
        print("\n🎉 Database initialization completed successfully!")
        
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
