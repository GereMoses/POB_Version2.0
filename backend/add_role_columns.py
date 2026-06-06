#!/usr/bin/env python3
"""
Add missing columns to roles table for level and permissions
"""

import psycopg2
import os

def add_role_columns():
    """Add level and permissions columns to roles table"""
    
    conn = None
    try:
        # Database connection (use postgres host for Docker)
        conn = psycopg2.connect(
            host='postgres',
            database='pob_system',
            user='pob_user',
            password='pob_password'
        )
        cursor = conn.cursor()
        
        print("Checking current roles table structure...")
        
        # Check if level column exists
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'roles' AND column_name = 'level'
        """)
        level_exists = cursor.fetchone()
        
        # Check if permissions column exists
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'roles' AND column_name = 'permissions'
        """)
        permissions_exists = cursor.fetchone()
        
        # Add level column if it doesn't exist
        if not level_exists:
            print("Adding 'level' column to roles table...")
            cursor.execute("""
                ALTER TABLE roles 
                ADD COLUMN level INTEGER DEFAULT 50
            """)
            print("✅ Level column added successfully")
        else:
            print("ℹ️ Level column already exists")
        
        # Add permissions column if it doesn't exist
        if not permissions_exists:
            print("Adding 'permissions' column to roles table...")
            cursor.execute("""
                ALTER TABLE roles 
                ADD COLUMN permissions JSON DEFAULT '[]'
            """)
            print("✅ Permissions column added successfully")
        else:
            print("ℹ️ Permissions column already exists")
        
        # Commit the changes
        conn.commit()
        
        # Verify the new structure
        cursor.execute("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns 
            WHERE table_name = 'roles' 
            ORDER BY ordinal_position
        """)
        columns = cursor.fetchall()
        
        print("\n✅ Updated roles table structure:")
        for col in columns:
            default_val = f" DEFAULT {col[2]}" if col[2] else ""
            print(f"  - {col[0]}: {col[1]}{default_val}")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 Database migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        if conn:
            conn.rollback()
            conn.close()
        raise

if __name__ == "__main__":
    add_role_columns()
