"""
Multi-State Nigerian Deployment Setup
Creates hierarchical location structure for Nigerian states (Lagos, Rivers, Delta, Akwa Ibom)
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.app.core.database import get_db, Base
from backend.app.models.location import Location, LocationZone
from backend.app.models.device import Device
from backend.app.models.personnel import Personnel
from datetime import datetime

def create_multi_state_structure():
    """Create hierarchical location structure for Nigerian states"""
    
    # Database connection
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://pob_user:pob_password@127.0.0.1:5432/pob_system")
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("🌍 Setting up Multi-State Nigerian Deployment Structure...")
        
        # 1. Create Country Level (Nigeria)
        nigeria = db.query(Location).filter(Location.code == "NG-001").first()
        if not nigeria:
            nigeria = Location(
                name="Nigeria",
                code="NG-001",
                location_type="COUNTRY",
                description="Federal Republic of Nigeria - Oil & Gas Operations",
                level=1,
                max_capacity=10000,
                status="ACTIVE",
                latitude="9.0820",
                longitude="8.6753"
            )
            db.add(nigeria)
            db.flush()
            print(f"✅ Created Country: {nigeria.name}")
        else:
            print(f"✅ Country already exists: {nigeria.name}")
        
        # 2. Create State Level Locations
        states_data = [
            {
                "name": "Lagos State",
                "code": "LG-001", 
                "location_type": "STATE",
                "description": "Lagos State - Oil & Gas Operations",
                "level": 2,
                "max_capacity": 3000,
                "latitude": "6.5244",
                "longitude": "3.3792"
            },
            {
                "name": "Rivers State",
                "code": "RV-001",
                "location_type": "STATE", 
                "description": "Rivers State - Oil & Gas Operations",
                "level": 2,
                "max_capacity": 2500,
                "latitude": "4.8156",
                "longitude": "7.0498"
            },
            {
                "name": "Delta State",
                "code": "DT-001",
                "location_type": "STATE",
                "description": "Delta State - Oil & Gas Operations", 
                "level": 2,
                "max_capacity": 2000,
                "latitude": "5.4885",
                "longitude": "5.7427"
            },
            {
                "name": "Akwa Ibom State", 
                "code": "AK-001",
                "location_type": "STATE",
                "description": "Akwa Ibom State - Oil & Gas Operations",
                "level": 2, 
                "max_capacity": 1500,
                "latitude": "4.9375",
                "longitude": "7.9518"
            }
        ]
        
        created_states = {}
        for state_data in states_data:
            existing_state = db.query(Location).filter(Location.code == state_data["code"]).first()
            if not existing_state:
                state = Location(
                    parent_location_id=nigeria.id,
                    **state_data
                )
                db.add(state)
                db.flush()
                created_states[state_data["code"]] = state
                print(f"✅ Created State: {state.name}")
            else:
                created_states[state_data["code"]] = existing_state
                print(f"✅ State already exists: {existing_state.name}")
        
        # 3. Create Platform/Base Locations under each state
        platforms_data = [
            # Lagos State Platforms
            {
                "parent_code": "LG-001",
                "name": "Lagos Offshore Platform Alpha",
                "code": "LG-OS-001",
                "location_type": "PLATFORM",
                "description": "Lagos Offshore Platform Alpha - Primary Production Facility",
                "level": 3,
                "max_capacity": 500,
                "latitude": "6.4234",
                "longitude": "3.4123"
            },
            {
                "parent_code": "LG-001", 
                "name": "Lagos Offshore Platform Beta",
                "code": "LG-OS-002",
                "location_type": "PLATFORM",
                "description": "Lagos Offshore Platform Beta - Secondary Production Facility", 
                "level": 3,
                "max_capacity": 400,
                "latitude": "6.4456",
                "longitude": "3.4234"
            },
            {
                "parent_code": "LG-001",
                "name": "Lagos Onshore Base",
                "code": "LG-ON-001", 
                "location_type": "BASE",
                "description": "Lagos Onshore Base - Administrative and Logistics Facility",
                "level": 3,
                "max_capacity": 800,
                "latitude": "6.5244",
                "longitude": "3.3792"
            },
            # Rivers State Platforms
            {
                "parent_code": "RV-001",
                "name": "Port Harcourt Platform Alpha", 
                "code": "RV-OS-001",
                "location_type": "PLATFORM",
                "description": "Port Harcourt Platform Alpha - Primary Production Facility",
                "level": 3,
                "max_capacity": 450,
                "latitude": "4.8156",
                "longitude": "7.0498"
            },
            {
                "parent_code": "RV-001",
                "name": "Port Harcourt Onshore Base",
                "code": "RV-ON-001",
                "location_type": "BASE", 
                "description": "Port Harcourt Onshore Base - Administrative and Logistics Facility",
                "level": 3,
                "max_capacity": 600,
                "latitude": "4.8156",
                "longitude": "7.0498"
            },
            # Delta State Platforms
            {
                "parent_code": "DT-001",
                "name": "Warri Platform Alpha",
                "code": "DT-OS-001", 
                "location_type": "PLATFORM",
                "description": "Warri Platform Alpha - Primary Production Facility",
                "level": 3,
                "max_capacity": 350,
                "latitude": "5.4885",
                "longitude": "5.7427"
            },
            {
                "parent_code": "DT-001",
                "name": "Warri Onshore Base",
                "code": "DT-ON-001",
                "location_type": "BASE",
                "description": "Warri Onshore Base - Administrative and Logistics Facility", 
                "level": 3,
                "max_capacity": 400,
                "latitude": "5.4885",
                "longitude": "5.7427"
            },
            # Akwa Ibom State Platforms
            {
                "parent_code": "AK-001",
                "name": "Ibom Platform Alpha",
                "code": "AK-OS-001",
                "location_type": "PLATFORM", 
                "description": "Ibom Platform Alpha - Primary Production Facility",
                "level": 3,
                "max_capacity": 300,
                "latitude": "4.9375",
                "longitude": "7.9518"
            },
            {
                "parent_code": "AK-001",
                "name": "Uyo Onshore Base", 
                "code": "AK-ON-001",
                "location_type": "BASE",
                "description": "Uyo Onshore Base - Administrative and Logistics Facility",
                "level": 3,
                "max_capacity": 350,
                "latitude": "4.9375", 
                "longitude": "7.9518"
            }
        ]
        
        created_platforms = {}
        for platform_data in platforms_data:
            existing_platform = db.query(Location).filter(Location.code == platform_data["code"]).first()
            if not existing_platform:
                parent_state = created_states[platform_data["parent_code"]]
                platform = Location(
                    parent_location_id=parent_state.id,
                    **{k: v for k, v in platform_data.items() if k != "parent_code"}
                )
                db.add(platform)
                db.flush()
                created_platforms[platform_data["code"]] = platform
                print(f"✅ Created Platform: {platform.name}")
            else:
                created_platforms[platform_data["code"]] = existing_platform
                print(f"✅ Platform already exists: {existing_platform.name}")
        
        # 4. Create Zones under each platform
        zones_data = []
        for platform_code, platform in created_platforms.items():
            if "PLATFORM" in platform.location_type:
                # Offshore platform zones
                zones_data.extend([
                    {
                        "parent_code": platform_code,
                        "name": f"{platform.name.split(' ')[-1]} Production Zone",
                        "code": f"{platform_code}-PZ",
                        "zone_type": "WORK_AREA",
                        "description": f"Primary production area for {platform.name}",
                        "max_occupancy": 100,
                        "hazard_level": "HIGH"
                    },
                    {
                        "parent_code": platform_code,
                        "name": f"{platform.name.split(' ')[-1]} Safety Zone", 
                        "code": f"{platform_code}-SZ",
                        "zone_type": "SAFETY_ZONE",
                        "description": f"Designated safety area for {platform.name}",
                        "max_occupancy": 50,
                        "hazard_level": "LOW"
                    },
                    {
                        "parent_code": platform_code,
                        "name": f"{platform.name.split(' ')[-1]} Restricted Area",
                        "code": f"{platform_code}-RA",
                        "zone_type": "RESTRICTED", 
                        "description": f"Restricted access area for {platform.name}",
                        "max_occupancy": 25,
                        "hazard_level": "CRITICAL"
                    },
                    {
                        "parent_code": platform_code,
                        "name": f"{platform.name.split(' ')[-1]} Safe Haven",
                        "code": f"{platform_code}-SH",
                        "zone_type": "SAFE_HAVEN",
                        "description": f"Emergency safe haven for {platform.name}",
                        "max_occupancy": 200,
                        "hazard_level": "LOW"
                    }
                ])
            else:
                # Onshore base zones
                zones_data.extend([
                    {
                        "parent_code": platform_code,
                        "name": f"{platform.name.split(' ')[-1]} Admin Zone",
                        "code": f"{platform_code}-AZ",
                        "zone_type": "WORK_AREA",
                        "description": f"Administrative area for {platform.name}",
                        "max_occupancy": 150,
                        "hazard_level": "LOW"
                    },
                    {
                        "parent_code": platform_code,
                        "name": f"{platform.name.split(' ')[-1]} Warehouse Zone",
                        "code": f"{platform_code}-WZ",
                        "zone_type": "WORK_AREA",
                        "description": f"Warehouse and storage area for {platform.name}",
                        "max_occupancy": 80,
                        "hazard_level": "MEDIUM"
                    },
                    {
                        "parent_code": platform_code,
                        "name": f"{platform.name.split(' ')[-1]} Transport Zone",
                        "code": f"{platform_code}-TZ",
                        "zone_type": "WORK_AREA",
                        "description": f"Transport and logistics area for {platform.name}",
                        "max_occupancy": 60,
                        "hazard_level": "MEDIUM"
                    }
                ])
        
        created_zones = {}
        for zone_data in zones_data:
            existing_zone = db.query(LocationZone).filter(LocationZone.code == zone_data["code"]).first()
            if not existing_zone:
                parent_platform = created_platforms[zone_data["parent_code"]]
                zone = LocationZone(
                    location_id=parent_platform.id,
                    **{k: v for k, v in zone_data.items() if k != "parent_code"}
                )
                db.add(zone)
                db.flush()
                created_zones[zone_data["code"]] = zone
                print(f"✅ Created Zone: {zone.name}")
            else:
                created_zones[zone_data["code"]] = existing_zone
                print(f"✅ Zone already exists: {existing_zone.name}")
        
        # 5. Update existing devices to include state information
        devices = db.query(Device).all()
        for device in devices:
            # Try to determine state from existing location
            if device.location:
                if "Lagos" in device.location or "PF-" in device.location:
                    device.state = "Lagos State"
                elif "Port Harcourt" in device.location or "PH-" in device.location:
                    device.state = "Rivers State"
                elif "Warri" in device.location or "WR-" in device.location:
                    device.state = "Delta State"
                elif "Ibom" in device.location or "IB-" in device.location:
                    device.state = "Akwa Ibom State"
                else:
                    # Default assignment based on existing location codes
                    if device.location.startswith("PF"):
                        device.state = "Lagos State"
                    elif device.location.startswith("PH"):
                        device.state = "Rivers State"
                    elif device.location.startswith("WR"):
                        device.state = "Delta State"
                    else:
                        device.state = "Lagos State"  # Default fallback
        
        db.commit()
        print("\n🎉 Multi-State Structure Setup Complete!")
        print(f"📊 Summary:")
        print(f"   - Country: 1 (Nigeria)")
        print(f"   - States: 4 (Lagos, Rivers, Delta, Akwa Ibom)")
        print(f"   - Platforms/Bases: 10")
        print(f"   - Zones: {len(created_zones)}")
        print(f"   - Devices Updated: {len(devices)}")
        
    except Exception as e:
        print(f"❌ Error setting up multi-state structure: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_multi_state_structure()
