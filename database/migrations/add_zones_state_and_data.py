"""
Add state column to zones table and populate zones data
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.app.core.database import get_db, Base

def add_zones_state_and_data():
    """Add state column to zones table and populate with proper data"""
    
    # Database connection
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://pob_user:pob_password@127.0.0.1:5432/pob_system")
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("🌍 Adding state column to zones table and populating data...")
        
        # 1. Add state column to zones table if it doesn't exist
        alter_zones_sql = """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'zones' AND column_name = 'state'
            ) THEN
                ALTER TABLE zones ADD COLUMN state VARCHAR(100);
            END IF;
        END $$;
        """
        
        db.execute(text(alter_zones_sql))
        print("✅ Added state column to zones table")
        
        # 2. Clear existing zones data (since they were incomplete)
        db.execute(text("DELETE FROM zones"))
        print("✅ Cleared existing zones data")
        
        # 3. Insert zones with proper state assignment based on location
        zones_data = [
            # Lagos Offshore Platform Alpha Zones
            {
                'name': 'Alpha Production Zone',
                'code': 'LG-OS-001-PZ',
                'zone_type': 'WORK_AREA',
                'location': 'Lagos Offshore Platform Alpha',
                'max_capacity': 100,
                'hazard_level': 'HIGH',
                'state': 'Lagos State'
            },
            {
                'name': 'Alpha Safety Zone',
                'code': 'LG-OS-001-SZ',
                'zone_type': 'SAFETY_ZONE',
                'location': 'Lagos Offshore Platform Alpha',
                'max_capacity': 50,
                'hazard_level': 'LOW',
                'state': 'Lagos State'
            },
            {
                'name': 'Alpha Restricted Area',
                'code': 'LG-OS-001-RA',
                'zone_type': 'RESTRICTED',
                'location': 'Lagos Offshore Platform Alpha',
                'max_capacity': 25,
                'hazard_level': 'CRITICAL',
                'state': 'Lagos State'
            },
            {
                'name': 'Alpha Safe Haven',
                'code': 'LG-OS-001-SH',
                'zone_type': 'SAFE_HAVEN',
                'location': 'Lagos Offshore Platform Alpha',
                'max_capacity': 200,
                'hazard_level': 'LOW',
                'state': 'Lagos State'
            },
            # Lagos Offshore Platform Beta Zones
            {
                'name': 'Beta Production Zone',
                'code': 'LG-OS-002-PZ',
                'zone_type': 'WORK_AREA',
                'location': 'Lagos Offshore Platform Beta',
                'max_capacity': 80,
                'hazard_level': 'HIGH',
                'state': 'Lagos State'
            },
            {
                'name': 'Beta Safety Zone',
                'code': 'LG-OS-002-SZ',
                'zone_type': 'SAFETY_ZONE',
                'location': 'Lagos Offshore Platform Beta',
                'max_capacity': 40,
                'hazard_level': 'LOW',
                'state': 'Lagos State'
            },
            # Lagos Onshore Base Zones
            {
                'name': 'Lagos Admin Zone',
                'code': 'LG-ON-001-AZ',
                'zone_type': 'WORK_AREA',
                'location': 'Lagos Onshore Base',
                'max_capacity': 150,
                'hazard_level': 'LOW',
                'state': 'Lagos State'
            },
            {
                'name': 'Lagos Warehouse Zone',
                'code': 'LG-ON-001-WZ',
                'zone_type': 'WORK_AREA',
                'location': 'Lagos Onshore Base',
                'max_capacity': 80,
                'hazard_level': 'MEDIUM',
                'state': 'Lagos State'
            },
            {
                'name': 'Lagos Transport Zone',
                'code': 'LG-ON-001-TZ',
                'zone_type': 'WORK_AREA',
                'location': 'Lagos Onshore Base',
                'max_capacity': 60,
                'hazard_level': 'MEDIUM',
                'state': 'Lagos State'
            },
            # Port Harcourt Platform Alpha Zones
            {
                'name': 'Port Harcourt Production Zone',
                'code': 'RV-OS-001-PZ',
                'zone_type': 'WORK_AREA',
                'location': 'Port Harcourt Platform Alpha',
                'max_capacity': 90,
                'hazard_level': 'HIGH',
                'state': 'Rivers State'
            },
            {
                'name': 'Port Harcourt Safety Zone',
                'code': 'RV-OS-001-SZ',
                'zone_type': 'SAFETY_ZONE',
                'location': 'Port Harcourt Platform Alpha',
                'max_capacity': 45,
                'hazard_level': 'LOW',
                'state': 'Rivers State'
            },
            # Port Harcourt Onshore Base Zones
            {
                'name': 'Port Harcourt Admin Zone',
                'code': 'RV-ON-001-AZ',
                'zone_type': 'WORK_AREA',
                'location': 'Port Harcourt Onshore Base',
                'max_capacity': 120,
                'hazard_level': 'LOW',
                'state': 'Rivers State'
            },
            {
                'name': 'Port Harcourt Warehouse Zone',
                'code': 'RV-ON-001-WZ',
                'zone_type': 'WORK_AREA',
                'location': 'Port Harcourt Onshore Base',
                'max_capacity': 70,
                'hazard_level': 'MEDIUM',
                'state': 'Rivers State'
            },
            # Warri Platform Alpha Zones
            {
                'name': 'Warri Production Zone',
                'code': 'DT-OS-001-PZ',
                'zone_type': 'WORK_AREA',
                'location': 'Warri Platform Alpha',
                'max_capacity': 70,
                'hazard_level': 'HIGH',
                'state': 'Delta State'
            },
            {
                'name': 'Warri Safety Zone',
                'code': 'DT-OS-001-SZ',
                'zone_type': 'SAFETY_ZONE',
                'location': 'Warri Platform Alpha',
                'max_capacity': 35,
                'hazard_level': 'LOW',
                'state': 'Delta State'
            },
            # Warri Onshore Base Zones
            {
                'name': 'Warri Admin Zone',
                'code': 'DT-ON-001-AZ',
                'zone_type': 'WORK_AREA',
                'location': 'Warri Onshore Base',
                'max_capacity': 100,
                'hazard_level': 'LOW',
                'state': 'Delta State'
            },
            {
                'name': 'Warri Warehouse Zone',
                'code': 'DT-ON-001-WZ',
                'zone_type': 'WORK_AREA',
                'location': 'Warri Onshore Base',
                'max_capacity': 60,
                'hazard_level': 'MEDIUM',
                'state': 'Delta State'
            },
            # Ibom Platform Alpha Zones
            {
                'name': 'Ibom Production Zone',
                'code': 'AK-OS-001-PZ',
                'zone_type': 'WORK_AREA',
                'location': 'Ibom Platform Alpha',
                'max_capacity': 60,
                'hazard_level': 'HIGH',
                'state': 'Akwa Ibom State'
            },
            {
                'name': 'Ibom Safety Zone',
                'code': 'AK-OS-001-SZ',
                'zone_type': 'SAFETY_ZONE',
                'location': 'Ibom Platform Alpha',
                'max_capacity': 30,
                'hazard_level': 'LOW',
                'state': 'Akwa Ibom State'
            },
            # Uyo Onshore Base Zones
            {
                'name': 'Uyo Admin Zone',
                'code': 'AK-ON-001-AZ',
                'zone_type': 'WORK_AREA',
                'location': 'Uyo Onshore Base',
                'max_capacity': 80,
                'hazard_level': 'LOW',
                'state': 'Akwa Ibom State'
            },
            {
                'name': 'Uyo Warehouse Zone',
                'code': 'AK-ON-001-WZ',
                'zone_type': 'WORK_AREA',
                'location': 'Uyo Onshore Base',
                'max_capacity': 50,
                'hazard_level': 'MEDIUM',
                'state': 'Akwa Ibom State'
            }
        ]
        
        # 4. Insert zones data
        for zone_data in zones_data:
            insert_sql = text("""
                INSERT INTO zones (name, zone_type, location, max_capacity, hazard_level, is_active, state, created_at)
                VALUES (:name, :zone_type, :location, :max_capacity, :hazard_level, :is_active, :state, NOW())
            """)
            
            db.execute(insert_sql, {
                'name': zone_data['name'],
                'zone_type': zone_data['zone_type'],
                'location': zone_data['location'],
                'max_capacity': zone_data['max_capacity'],
                'hazard_level': zone_data['hazard_level'],
                'is_active': True,
                'state': zone_data['state']
            })
        
        db.commit()
        print(f"✅ Created {len(zones_data)} zones with state assignments")
        
        # 5. Update devices with state information
        update_devices_sql = text("""
            UPDATE devices 
            SET state = CASE 
                WHEN location LIKE '%Lagos%' OR location LIKE 'PF-%' THEN 'Lagos State'
                WHEN location LIKE '%Port Harcourt%' OR location LIKE 'PH-%' THEN 'Rivers State'
                WHEN location LIKE '%Warri%' OR location LIKE 'WR-%' THEN 'Delta State'
                WHEN location LIKE '%Ibom%' OR location LIKE 'IB-%' THEN 'Akwa Ibom State'
                WHEN location LIKE 'Platform Alpha%' THEN 'Lagos State'
                WHEN location LIKE 'Platform Beta%' THEN 'Lagos State'
                WHEN location LIKE 'Onshore Base%' THEN 'Lagos State'
                ELSE 'Lagos State'
            END
            WHERE state IS NULL OR state = ''
        """)
        
        result = db.execute(update_devices_sql)
        db.commit()
        print(f"✅ Updated {result.rowcount} devices with state information")
        
        # 6. Update personnel with state information
        update_personnel_sql = text("""
            UPDATE personnel 
            SET assigned_state = CASE 
                WHEN current_location LIKE '%Lagos%' OR current_location LIKE 'PF-%' THEN 'Lagos State'
                WHEN current_location LIKE '%Port Harcourt%' OR current_location LIKE 'PH-%' THEN 'Rivers State'
                WHEN current_location LIKE '%Warri%' OR current_location LIKE 'WR-%' THEN 'Delta State'
                WHEN current_location LIKE '%Ibom%' OR current_location LIKE 'IB-%' THEN 'Akwa Ibom State'
                WHEN current_location LIKE 'Platform Alpha%' THEN 'Lagos State'
                WHEN current_location LIKE 'Platform Beta%' THEN 'Lagos State'
                WHEN current_location LIKE 'Onshore Base%' THEN 'Lagos State'
                ELSE 'Lagos State'
            END
            WHERE assigned_state IS NULL OR assigned_state = ''
        """)
        
        result = db.execute(update_personnel_sql)
        db.commit()
        print(f"✅ Updated {result.rowcount} personnel with state information")
        
        print("\n🎉 Multi-State Structure Setup Complete!")
        print(f"📊 Summary:")
        print(f"   - Sites: 18 (4 states + 14 platforms/bases)")
        print(f"   - Zones: {len(zones_data)}")
        print(f"   - Devices Updated: {result.rowcount}")
        
    except Exception as e:
        print(f"❌ Error setting up multi-state structure: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    add_zones_state_and_data()
