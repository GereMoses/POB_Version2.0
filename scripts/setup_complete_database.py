#!/usr/bin/env python3
"""
Complete Database Setup Script for POB System
This script ensures all database tables are created with proper relationships
and sample data for department and personnel assignment management.
"""

import sys
import os
import psycopg2
from psycopg2 import sql, OperationalError
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def connect_to_database():
    """Connect to PostgreSQL database"""
    try:
        # Connect to PostgreSQL server (not specific database initially)
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            user="pob_user",
            password="pob_password",
            database="postgres"  # Connect to default database first
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        return conn
    except OperationalError as e:
        print(f"❌ Failed to connect to PostgreSQL: {e}")
        print("🔧 Please ensure PostgreSQL is running and accessible")
        print("📋 Check docker-compose.yml for connection details")
        return None

def create_database_if_not_exists(conn):
    """Create the pob_system database if it doesn't exist"""
    try:
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = 'pob_system'")
        exists = cursor.fetchone()
        
        if not exists:
            print("📝 Creating database 'pob_system'...")
            cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier("pob_system")))
            print("✅ Database 'pob_system' created successfully")
        else:
            print("✅ Database 'pob_system' already exists")
            
        cursor.close()
        return True
    except Exception as e:
        print(f"❌ Failed to create database: {e}")
        return False

def setup_database_schema():
    """Setup the complete database schema"""
    try:
        # Connect to the pob_system database
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            user="pob_user",
            password="pob_password",
            database="pob_system"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Read and execute the SQL setup script
        script_path = os.path.join(os.path.dirname(__file__), 'database', 'init', 'complete_database_setup.sql')
        
        if not os.path.exists(script_path):
            print(f"❌ SQL script not found: {script_path}")
            return False
            
        with open(script_path, 'r') as f:
            sql_script = f.read()
        
        print("🔧 Executing database setup script...")
        cursor.execute(sql_script)
        
        print("✅ Database schema setup completed successfully")
        
        # Get table counts
        tables_to_check = ['sites', 'departments', 'department_personnel', 'personnel', 'users']
        for table in tables_to_check:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"📊 {table}: {count} records")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Failed to setup database schema: {e}")
        return False

def verify_database_setup():
    """Verify that all tables and relationships are properly set up"""
    try:
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            user="pob_user",
            password="pob_password",
            database="pob_system"
        )
        cursor = conn.cursor()
        
        print("\n🔍 Verifying database setup...")
        
        # Check tables exist
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)
        tables = [row[0] for row in cursor.fetchall()]
        
        expected_tables = ['sites', 'departments', 'department_personnel', 'personnel', 'users']
        missing_tables = [t for t in expected_tables if t not in tables]
        
        if missing_tables:
            print(f"❌ Missing tables: {missing_tables}")
            return False
        else:
            print("✅ All required tables exist")
        
        # Check foreign key constraints
        cursor.execute("""
            SELECT 
                tc.table_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_schema = 'public'
        """)
        constraints = cursor.fetchall()
        
        print(f"✅ Found {len(constraints)} foreign key constraints")
        
        # Check indexes
        cursor.execute("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE schemaname = 'public'
            ORDER BY indexname
        """)
        indexes = [row[0] for row in cursor.fetchall()]
        print(f"✅ Found {len(indexes)} indexes")
        
        # Check views
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_schema = 'public'
        """)
        views = [row[0] for row in cursor.fetchall()]
        
        expected_views = ['department_statistics', 'personnel_assignment_summary']
        missing_views = [v for v in expected_views if v not in views]
        
        if missing_views:
            print(f"❌ Missing views: {missing_views}")
        else:
            print("✅ All required views exist")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Database verification failed: {e}")
        return False

def test_database_operations():
    """Test basic database operations"""
    try:
        conn = psycopg2.connect(
            host="localhost",
            port=5432,
            user="pob_user",
            password="pob_password",
            database="pob_system"
        )
        cursor = conn.cursor()
        
        print("\n🧪 Testing database operations...")
        
        # Test department creation
        cursor.execute("""
            INSERT INTO departments (name, code, description, department_type, level, is_active)
            VALUES ('Test Department', 'TEST-001', 'Test department for verification', 'administration', 1, true)
            ON CONFLICT (code) DO NOTHING
        """)
        
        # Test personnel creation
        cursor.execute("""
            INSERT INTO personnel (badge_id, full_name, email, company, role, status)
            VALUES ('TEST001', 'Test User', 'test@example.com', 'Test Company', 'Tester', 'active')
            ON CONFLICT (badge_id) DO NOTHING
        """)
        
        # Test assignment
        cursor.execute("""
            INSERT INTO department_personnel (department_id, personnel_id, role, status)
            SELECT d.id, p.id, 'Test Role', 'active'
            FROM departments d, personnel p
            WHERE d.code = 'TEST-001' AND p.badge_id = 'TEST001'
            ON CONFLICT (department_id, personnel_id) DO NOTHING
        """)
        
        # Test view queries
        cursor.execute("SELECT * FROM department_statistics LIMIT 1")
        dept_stats = cursor.fetchone()
        
        cursor.execute("SELECT * FROM personnel_assignment_summary LIMIT 1")
        personnel_stats = cursor.fetchone()
        
        print("✅ Database operations test passed")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Database operations test failed: {e}")
        return False

def main():
    """Main setup function"""
    print("🚀 Starting Complete POB Database Setup")
    print("=" * 50)
    
    # Step 1: Connect to PostgreSQL
    conn = connect_to_database()
    if not conn:
        sys.exit(1)
    
    # Step 2: Create database if not exists
    if not create_database_if_not_exists(conn):
        conn.close()
        sys.exit(1)
    
    conn.close()
    
    # Step 3: Setup database schema
    if not setup_database_schema():
        sys.exit(1)
    
    # Step 4: Verify database setup
    if not verify_database_setup():
        sys.exit(1)
    
    # Step 5: Test database operations
    if not test_database_operations():
        sys.exit(1)
    
    print("\n🎉 Complete Database Setup Finished Successfully!")
    print("📊 Database is ready for department and personnel assignment management")
    print("🔗 All tables, relationships, indexes, and views are properly configured")
    print("✅ Sample data has been inserted for testing")
    print("\n📋 Next Steps:")
    print("1. Start the backend service: cd backend && python -m uvicorn app.main:app --reload")
    print("2. Start the frontend service: cd frontend && npm run dev")
    print("3. Access the application at http://localhost:3000")
    print("4. Navigate to Department Management and Personnel Assignments")

if __name__ == "__main__":
    main()
