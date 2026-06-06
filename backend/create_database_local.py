#!/usr/bin/env python3
"""
Local Database Initialization Script
For running from Windows host to connect to Docker PostgreSQL container
"""

import sys
import os

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from sqlalchemy import create_engine, text
from app.core.database import Base
from app.models import *  # Import all models
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_local_database():
    """Create database tables locally connecting to Docker container via localhost"""
    
    # Connect to PostgreSQL via localhost (Windows host to Docker container)
    database_url = "postgresql://pob_user:pob_password@localhost:5432/pob_system"
    
    try:
        logger.info("🚀 Initializing POB System Database (Local Connection)...")
        
        # Create engine
        engine = create_engine(database_url)
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            logger.info("✅ Database connection successful")
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables created successfully")
        
        # Create initial admin user if not exists
        with engine.connect() as conn:
            # Check if admin user exists
            result = conn.execute(text("SELECT COUNT(*) FROM users WHERE username = 'admin'"))
            admin_exists = result.scalar()
            
            if admin_exists == 0:
                # Create admin user
                hashed_password = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6QJw/2EJa"  # admin
                conn.execute(text("""
                    INSERT INTO users (username, email, hashed_password, full_name, is_superuser, is_active, is_verified)
                    VALUES ('admin', 'admin@pob.com', :password, 'System Administrator', true, true, true)
                """), {"password": hashed_password})
                conn.commit()
                logger.info("✅ Admin user created successfully")
            else:
                logger.info("ℹ️ Admin user already exists")
        
        logger.info("🎉 Database initialization completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        return False

if __name__ == "__main__":
    success = create_local_database()
    if success:
        logger.info("✅ Database setup completed successfully!")
        sys.exit(0)
    else:
        logger.error("❌ Database setup failed!")
        sys.exit(1)
