"""
Add Oil & Gas specific fields to Personnel table
Migration script for POB Version 2.0 enhancement
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import sys
import os

# Add the parent directory to the path to import database config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def add_oil_gas_fields():
    """Add oil & gas specific fields to personnel table"""
    
    # Database connection
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/pob_db")
    engine = create_engine(DATABASE_URL)
    
    # Create session
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Add oil & gas specific fields to personnel table
        migration_sql = """
        -- Add oil & gas specific fields to personnel table
        ALTER TABLE personnel 
        ADD COLUMN IF NOT EXISTS personnel_type VARCHAR(20) DEFAULT 'STAFF',
        ADD COLUMN IF NOT EXISTS safety_critical BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS biometric_enrolled BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS compliance_score FLOAT DEFAULT 0.0;
        
        -- Add comments to explain the new fields
        COMMENT ON COLUMN personnel.personnel_type IS 'Personnel type: STAFF, CONTRACTOR, or VISITOR';
        COMMENT ON COLUMN personnel.safety_critical IS 'Safety critical personnel designation';
        COMMENT ON COLUMN personnel.biometric_enrolled IS 'Biometric enrollment status';
        COMMENT ON COLUMN personnel.compliance_score IS 'Compliance score percentage (0-100)';
        
        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_personnel_personnel_type ON personnel(personnel_type);
        CREATE INDEX IF NOT EXISTS idx_personnel_safety_critical ON personnel(safety_critical);
        CREATE INDEX IF NOT EXISTS idx_personnel_biometric_enrolled ON personnel(biometric_enrolled);
        CREATE INDEX IF NOT EXISTS idx_personnel_compliance_score ON personnel(compliance_score);
        
        -- Update existing records with default values
        UPDATE personnel 
        SET 
            personnel_type = 'STAFF',
            safety_critical = FALSE,
            biometric_enrolled = FALSE,
            compliance_score = 85.0
        WHERE personnel_type IS NULL OR safety_critical IS NULL OR biometric_enrolled IS NULL OR compliance_score IS NULL;
        """
        
        # Execute migration
        db.execute(text(migration_sql))
        db.commit()
        
        print("✅ Oil & Gas fields migration completed successfully!")
        print("📊 Added fields:")
        print("   - personnel_type (VARCHAR(20))")
        print("   - safety_critical (BOOLEAN)")
        print("   - biometric_enrolled (BOOLEAN)")
        print("   - compliance_score (FLOAT)")
        print("🔍 Created indexes for performance optimization")
        print("📝 Updated existing records with default values")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Migration failed: {str(e)}")
        raise e
    finally:
        db.close()

def verify_migration():
    """Verify that the migration was successful"""
    
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/pob_db")
    engine = create_engine(DATABASE_URL)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Check if new columns exist
        result = db.execute(text("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns 
            WHERE table_name = 'personnel' 
            AND column_name IN ('personnel_type', 'safety_critical', 'biometric_enrolled', 'compliance_score')
            ORDER BY column_name;
        """))
        
        columns = result.fetchall()
        
        print("\n🔍 Migration Verification:")
        print("New columns added to personnel table:")
        for column in columns:
            print(f"   - {column[0]} ({column[1]}) - Default: {column[2]}")
        
        # Check data integrity
        result = db.execute(text("""
            SELECT 
                COUNT(*) as total_personnel,
                COUNT(CASE WHEN personnel_type IS NOT NULL THEN 1 END) as with_type,
                COUNT(CASE WHEN safety_critical IS NOT NULL THEN 1 END) as with_safety,
                COUNT(CASE WHEN biometric_enrolled IS NOT NULL THEN 1 END) as with_biometric,
                COUNT(CASE WHEN compliance_score IS NOT NULL THEN 1 END) as with_compliance,
                AVG(compliance_score) as avg_compliance
            FROM personnel;
        """))
        
        stats = result.fetchone()
        
        print(f"\n📊 Data Integrity Check:")
        print(f"   - Total personnel: {stats[0]}")
        print(f"   - With personnel type: {stats[1]}")
        print(f"   - With safety critical: {stats[2]}")
        print(f"   - With biometric enrolled: {stats[3]}")
        print(f"   - With compliance score: {stats[4]}")
        print(f"   - Average compliance score: {stats[5]:.1f}%")
        
        if stats[1] == stats[0] and stats[2] == stats[0] and stats[3] == stats[0] and stats[4] == stats[0]:
            print("\n✅ Migration verification successful - all records updated!")
        else:
            print("\n⚠️  Some records may not have been updated properly")
        
    except Exception as e:
        print(f"❌ Verification failed: {str(e)}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Starting Oil & Gas Personnel Fields Migration")
    print("=" * 60)
    
    try:
        add_oil_gas_fields()
        verify_migration()
        print("\n🎉 Migration completed successfully!")
        print("📋 Your POB system is now ready for oil & gas operations!")
    except Exception as e:
        print(f"\n💥 Migration failed: {str(e)}")
        print("🔧 Please check the error above and try again")
        sys.exit(1)
