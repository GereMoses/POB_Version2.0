"""
SQLite to PostgreSQL Migration Script for POB System
Migrates data from SQLite to PostgreSQL with proper PostgreSQL optimizations
"""

import sys
import os
import json
from datetime import datetime
from typing import Dict, Any, List
import logging

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class PostgreSQLMigrator:
    """Migrates POB system data from SQLite to PostgreSQL"""
    
    def __init__(self):
        # SQLite connection
        self.sqlite_engine = create_engine("sqlite:///./pob_system.db", echo=False)
        self.sqlite_session = sessionmaker(bind=self.sqlite_engine)()
        
        # PostgreSQL connection
        self.postgres_engine = create_engine(settings.DATABASE_URL, echo=False)
        self.postgres_session = sessionmaker(bind=self.postgres_engine)()
        
        logger.info("Migration engines initialized")
    
    def migrate_all_data(self) -> Dict[str, Any]:
        """Perform complete migration from SQLite to PostgreSQL"""
        try:
            migration_results = {
                "start_time": datetime.now().isoformat(),
                "tables_migrated": {},
                "total_records": 0,
                "errors": [],
                "success": True
            }
            
            # Migration order respecting foreign keys
            migration_order = [
                'users',
                'roles', 
                'user_roles',
                'personnel',
                'personnel_assignments',
                'attendance_logs',
                'devices',
                'access_logs',
                'device_events',
                'certifications',
                'certification_templates',
                'certification_audits'
            ]
            
            for table_name in migration_order:
                try:
                    result = self.migrate_table(table_name)
                    migration_results["tables_migrated"][table_name] = result
                    migration_results["total_records"] += result["migrated_count"]
                    logger.info(f"✅ Migrated {table_name}: {result['migrated_count']} records")
                except Exception as e:
                    error_msg = f"Failed to migrate {table_name}: {str(e)}"
                    logger.error(error_msg)
                    migration_results["errors"].append(error_msg)
                    migration_results["success"] = False
            
            migration_results["end_time"] = datetime.now().isoformat()
            
            return migration_results
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "start_time": datetime.now().isoformat()
            }
    
    def migrate_table(self, table_name: str) -> Dict[str, Any]:
        """Migrate a single table from SQLite to PostgreSQL"""
        try:
            # Get data from SQLite
            sqlite_result = self.sqlite_session.execute(text(f"SELECT * FROM {table_name}"))
            columns = [col[0] for col in sqlite_result.cursor.description]
            rows = sqlite_result.fetchall()
            
            if not rows:
                return {
                    "migrated_count": 0,
                    "status": "no_data",
                    "message": f"No data found in {table_name}"
                }
            
            # Prepare data for PostgreSQL
            migrated_count = 0
            errors = []
            
            for row in rows:
                try:
                    # Convert row to dict
                    row_data = dict(zip(columns, row))
                    
                    # Transform data for PostgreSQL
                    transformed_data = self.transform_row_data(table_name, row_data)
                    
                    # Insert into PostgreSQL
                    self.insert_postgres_row(table_name, transformed_data)
                    migrated_count += 1
                    
                except Exception as e:
                    errors.append(f"Row {migrated_count + 1}: {str(e)}")
                    logger.warning(f"Failed to migrate row {migrated_count + 1} in {table_name}: {e}")
            
            self.postgres_session.commit()
            
            return {
                "migrated_count": migrated_count,
                "total_rows": len(rows),
                "errors": errors,
                "status": "completed" if errors else "completed_with_errors"
            }
            
        except Exception as e:
            self.postgres_session.rollback()
            raise Exception(f"Table migration failed for {table_name}: {str(e)}")
    
    def transform_row_data(self, table_name: str, row_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform row data for PostgreSQL compatibility"""
        transformed = row_data.copy()
        
        # Handle JSON fields - convert to PostgreSQL JSONB
        json_fields = {
            'personnel': ['biometric_data', 'fingerprint_templates', 'certifications', 
                         'training_records', 'emergency_contact'],
            'personnel_assignments': ['transport_details'],
            'attendance_logs': ['raw_data'],
            'devices': ['supported_biometrics', 'authorized_personnel', 'access_schedule', 
                        'zkteco_config', 'settings', 'custom_fields'],
            'access_logs': ['biometric_data'],
            'device_events': ['event_data', 'old_values', 'new_values'],
            'certifications': ['verification_data'],
            'device_schedules': ['time_ranges', 'authorized_personnel'],
            'device_maintenance': ['parts_used', 'test_results']
        }
        
        if table_name in json_fields:
            for field in json_fields[table_name]:
                if field in transformed and transformed[field]:
                    # Convert JSON string to dict if needed
                    if isinstance(transformed[field], str):
                        try:
                            transformed[field] = json.loads(transformed[field])
                        except json.JSONDecodeError:
                            transformed[field] = {}
                    elif not isinstance(transformed[field], dict):
                        transformed[field] = {}
        
        # Handle timestamp fields - ensure proper format
        timestamp_fields = ['created_at', 'updated_at', 'last_seen', 'timestamp', 
                           'start_date', 'end_date', 'last_login', 'expires_at', 
                           'scheduled_date', 'started_at', 'completed_at', 
                           'verified_date', 'issue_date', 'expire_date']
        
        for field in timestamp_fields:
            if field in transformed and transformed[field]:
                if isinstance(transformed[field], str):
                    try:
                        # Parse various timestamp formats
                        if 'T' in transformed[field]:
                            # ISO format
                            transformed[field] = datetime.fromisoformat(transformed[field].replace('Z', '+00:00'))
                        else:
                            # SQLite format
                            transformed[field] = datetime.strptime(transformed[field], '%Y-%m-%d %H:%M:%S')
                    except (ValueError, TypeError):
                        transformed[field] = None
                elif isinstance(transformed[field], (int, float)):
                    # Unix timestamp
                    transformed[field] = datetime.fromtimestamp(transformed[field])
        
        # Handle boolean fields - ensure proper boolean type
        boolean_fields = ['is_active', 'is_superuser', 'is_verified', 'is_onboard', 
                          'safety_critical', 'biometric_enrolled', 'is_processed',
                          'encryption_enabled', 'verified', 'renewal_required', 'is_mandatory']
        
        for field in boolean_fields:
            if field in transformed:
                if transformed[field] in (0, '0', False, 'false'):
                    transformed[field] = False
                elif transformed[field] in (1, '1', True, 'true'):
                    transformed[field] = True
                else:
                    transformed[field] = bool(transformed[field])
        
        return transformed
    
    def insert_postgres_row(self, table_name: str, data: Dict[str, Any]) -> None:
        """Insert a row into PostgreSQL with proper error handling"""
        try:
            # Build INSERT statement dynamically
            columns = list(data.keys())
            placeholders = [f":{col}" for col in columns]
            
            # Handle JSONB fields for PostgreSQL
            jsonb_fields = ['biometric_data', 'fingerprint_templates', 'certifications',
                           'training_records', 'emergency_contact', 'transport_details',
                           'raw_data', 'supported_biometrics', 'authorized_personnel',
                           'access_schedule', 'zkteco_config', 'settings', 'custom_fields',
                           'biometric_data', 'event_data', 'old_values', 'new_values',
                           'verification_data', 'time_ranges', 'parts_used', 'test_results']
            
            # Convert JSON fields to proper PostgreSQL format
            insert_data = data.copy()
            for field in jsonb_fields:
                if field in insert_data and isinstance(insert_data[field], dict):
                    insert_data[field] = json.dumps(insert_data[field])
            
            sql = f"""
                INSERT INTO {table_name} ({', '.join(columns)}) 
                VALUES ({', '.join(placeholders)})
                ON CONFLICT DO NOTHING
            """
            
            self.postgres_session.execute(text(sql), insert_data)
            
        except Exception as e:
            raise Exception(f"Failed to insert row into {table_name}: {str(e)}")
    
    def create_postgres_indexes(self) -> None:
        """Create PostgreSQL-specific indexes for performance"""
        logger.info("Creating PostgreSQL indexes...")
        
        indexes = [
            # Personnel indexes
            "CREATE INDEX IF NOT EXISTS idx_personnel_badge_id ON personnel(badge_id)",
            "CREATE INDEX IF NOT EXISTS idx_personnel_status ON personnel(status)",
            "CREATE INDEX IF NOT EXISTS idx_personnel_location ON personnel(current_location)",
            "CREATE INDEX IF NOT EXISTS idx_personnel_company ON personnel(company)",
            "CREATE INDEX IF NOT EXISTS idx_personnel_biometric ON personnel(biometric_enrolled)",
            
            # Attendance logs indexes (critical for ZKTeco ADMS)
            "CREATE INDEX IF NOT EXISTS idx_attendance_logs_timestamp ON attendance_logs(timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_attendance_logs_personnel_timestamp ON attendance_logs(personnel_id, timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_attendance_logs_device_timestamp ON attendance_logs(device_id, timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_attendance_logs_event_type ON attendance_logs(event_type)",
            "CREATE INDEX IF NOT EXISTS idx_attendance_logs_processed ON attendance_logs(is_processed)",
            
            # Device indexes
            "CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id)",
            "CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status)",
            "CREATE INDEX IF NOT EXISTS idx_devices_location ON devices(location)",
            "CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen)",
            
            # Access logs indexes
            "CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_access_logs_personnel ON access_logs(personnel_id)",
            "CREATE INDEX IF NOT EXISTS idx_access_logs_device ON access_logs(device_id)",
            "CREATE INDEX IF NOT EXISTS idx_access_logs_event_type ON access_logs(event_type)",
            
            # Certification indexes
            "CREATE INDEX IF NOT EXISTS idx_certifications_personnel ON certifications(personnel_id)",
            "CREATE INDEX IF NOT EXISTS idx_certifications_expire_date ON certifications(expire_date)",
            "CREATE INDEX IF NOT EXISTS idx_certifications_status ON certifications(status)",
            "CREATE INDEX IF NOT EXISTS idx_certifications_type ON certifications(certification_type)"
        ]
        
        for index_sql in indexes:
            try:
                self.postgres_session.execute(text(index_sql))
                logger.info(f"✅ Created index: {index_sql.split('idx_')[1].split(' ')[0]}")
            except Exception as e:
                logger.warning(f"Failed to create index: {e}")
        
        self.postgres_session.commit()
        logger.info("PostgreSQL indexes creation completed")
    
    def verify_migration(self) -> Dict[str, Any]:
        """Verify migration by comparing record counts"""
        verification = {
            "sqlite_counts": {},
            "postgres_counts": {},
            "differences": {},
            "success": True
        }
        
        tables = ['users', 'personnel', 'attendance_logs', 'devices', 'certifications']
        
        for table in tables:
            try:
                # SQLite count
                sqlite_count = self.sqlite_session.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                verification["sqlite_counts"][table] = sqlite_count
                
                # PostgreSQL count
                postgres_count = self.postgres_session.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                verification["postgres_counts"][table] = postgres_count
                
                # Check differences
                difference = sqlite_count - postgres_count
                verification["differences"][table] = difference
                
                if difference != 0:
                    verification["success"] = False
                    logger.warning(f"Count mismatch in {table}: SQLite={sqlite_count}, PostgreSQL={postgres_count}")
                else:
                    logger.info(f"✅ {table}: {sqlite_count} records verified")
                    
            except Exception as e:
                logger.error(f"Failed to verify {table}: {e}")
                verification["success"] = False
        
        return verification
    
    def close_connections(self):
        """Close database connections"""
        self.sqlite_session.close()
        self.postgres_session.close()
        self.sqlite_engine.dispose()
        self.postgres_engine.dispose()


def main():
    """Main migration function"""
    logger.info("🚀 Starting SQLite to PostgreSQL migration...")
    
    migrator = PostgreSQLMigrator()
    
    try:
        # Perform migration
        migration_result = migrator.migrate_all_data()
        
        # Create PostgreSQL indexes
        migrator.create_postgres_indexes()
        
        # Verify migration
        verification = migrator.verify_migration()
        
        # Print results
        print("\n" + "="*60)
        print("🎉 MIGRATION RESULTS")
        print("="*60)
        
        if migration_result["success"]:
            print(f"✅ Migration completed successfully!")
            print(f"📊 Total records migrated: {migration_result['total_records']}")
            print(f"📋 Tables migrated: {len(migration_result['tables_migrated'])}")
            
            for table, result in migration_result['tables_migrated'].items():
                print(f"   - {table}: {result['migrated_count']} records")
        else:
            print(f"❌ Migration completed with errors!")
            for error in migration_result['errors']:
                print(f"   Error: {error}")
        
        print("\n🔍 VERIFICATION RESULTS")
        print("-"*40)
        
        if verification["success"]:
            print("✅ All tables verified successfully!")
            for table in verification["sqlite_counts"]:
                sqlite_count = verification["sqlite_counts"][table]
                postgres_count = verification["postgres_counts"][table]
                print(f"   {table}: {sqlite_count} → {postgres_count} ✓")
        else:
            print("❌ Verification found discrepancies!")
            for table, diff in verification["differences"].items():
                if diff != 0:
                    print(f"   {table}: difference of {diff} records")
        
        print("\n📈 Migration completed at:", datetime.now().isoformat())
        print("="*60)
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        print(f"\n❌ Migration failed: {e}")
    
    finally:
        migrator.close_connections()


if __name__ == "__main__":
    main()
