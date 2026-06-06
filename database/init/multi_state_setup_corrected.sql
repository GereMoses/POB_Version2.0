-- Multi-State Nigerian Deployment Setup (Corrected for existing tables)
-- Creates hierarchical location structure for Nigerian states using existing tables

-- 1. Create Country Level (Nigeria) in sites table
INSERT INTO sites (name, code, description, city, state, country, site_type, capacity, status, created_at)
SELECT 
    'Nigeria',
    'NG-001',
    'Federal Republic of Nigeria - Oil & Gas Operations',
    'Abuja',
    'FCT',
    'Nigeria',
    'COUNTRY',
    10000,
    'active',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'NG-001');

-- 2. Create State Level Locations in sites table
INSERT INTO sites (site_manager_id, name, code, description, city, state, country, site_type, capacity, status, created_at)
SELECT 
    (SELECT id FROM sites WHERE code = 'NG-001'),
    'Lagos State',
    'LG-001',
    'Lagos State - Oil & Gas Operations',
    'Lagos',
    'Lagos',
    'Nigeria',
    'STATE',
    3000,
    'active',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'LG-001');

INSERT INTO sites (site_manager_id, name, code, description, city, state, country, site_type, capacity, status, created_at)
SELECT 
    (SELECT id FROM sites WHERE code = 'NG-001'),
    'Rivers State',
    'RV-001',
    'Rivers State - Oil & Gas Operations',
    'Port Harcourt',
    'Rivers',
    'Nigeria',
    'STATE',
    2500,
    'active',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'RV-001');

INSERT INTO sites (site_manager_id, name, code, description, city, state, country, site_type, capacity, status, created_at)
SELECT 
    (SELECT id FROM sites WHERE code = 'NG-001'),
    'Delta State',
    'DT-001',
    'Delta State - Oil & Gas Operations',
    'Warri',
    'Delta',
    'Nigeria',
    'STATE',
    2000,
    'active',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'DT-001');

INSERT INTO sites (site_manager_id, name, code, description, city, state, country, site_type, capacity, status, created_at)
SELECT 
    (SELECT id FROM sites WHERE code = 'NG-001'),
    'Akwa Ibom State',
    'AK-001',
    'Akwa Ibom State - Oil & Gas Operations',
    'Uyo',
    'Akwa Ibom',
    'Nigeria',
    'STATE',
    1500,
    'active',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'AK-001');

-- 3. Create Platform/Base Locations under each state
-- Lagos State Platforms
INSERT INTO sites (site_manager_id, name, code, description, city, state, country, site_type, capacity, status, created_at)
SELECT 
    (SELECT id FROM sites WHERE code = 'LG-001'),
    'Lagos Offshore Platform Alpha',
    'LG-OS-001',
    'Lagos Offshore Platform Alpha - Primary Production Facility',
    'Lagos',
    'Lagos',
    'Nigeria',
    'PLATFORM',
    500,
    'active',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'LG-OS-001');

INSERT INTO sites (site_manager_id, name, code, description, city, state, country, site_type, capacity, status, created_at)
SELECT 
    (SELECT id FROM sites WHERE code = 'LG-001'),
    'Lagos Offshore Platform Beta',
    'LG-OS-002',
    'Lagos Offshore Platform Beta - Secondary Production Facility',
    'Lagos',
    'Lagos',
    'Nigeria',
    'PLATFORM',
    400,
    'active',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'LG-OS-002');

INSERT INTO sites (site_manager_id, name, code, description, city, state, country, site_type, capacity, status, created_at)
SELECT 
    (SELECT id FROM sites WHERE code = 'LG-001'),
    'Lagos Onshore Base',
    'LG-ON-001',
    'Lagos Onshore Base - Administrative and Logistics Facility',
    'Lagos',
    'Lagos',
    'Nigeria',
    'BASE',
    800,
    'active',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'LG-ON-001');

-- Rivers State Platforms
INSERT INTO sites (site_manager_id, name, code, description, city, state, country, site_type, capacity, status, created_at)
SELECT 
    (SELECT id FROM sites WHERE code = 'RV-001'),
    'Port Harcourt Platform Alpha',
    'RV-OS-001',
    'Port Harcourt Platform Alpha - Primary Production Facility',
    'Port Harcourt',
    'Rivers',
    'Nigeria',
    'PLATFORM',
    450,
    'active',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'RV-OS-001');

INSERT INTO sites (site_manager_id, name, code, description, city, state, country, site_type, capacity, status, created_at)
SELECT 
    (SELECT id FROM sites WHERE code = 'RV-001'),
    'Port Harcourt Onshore Base',
    'RV-ON-001',
    'Port Harcourt Onshore Base - Administrative and Logistics Facility',
    'Port Harcourt',
    'Rivers',
    'Nigeria',
    'BASE',
    600,
    'active',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'RV-ON-001');

-- Delta State Platforms
INSERT INTO sites (site_manager_id, name, code, description, city, state, country, site_type, capacity, status, created_at)
SELECT 
    (SELECT id FROM sites WHERE code = 'DT-001'),
    'Warri Platform Alpha',
    'DT-OS-001',
    'Warri Platform Alpha - Primary Production Facility',
    'Warri',
    'Delta',
    'Nigeria',
    'PLATFORM',
    350,
    'active',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'DT-OS-001');

INSERT INTO sites (site_manager_id, name, code, description, city, state, country, site_type, capacity, status, created_at)
SELECT 
    (SELECT id FROM sites WHERE code = 'DT-001'),
    'Warri Onshore Base',
    'DT-ON-001',
    'Warri Onshore Base - Administrative and Logistics Facility',
    'Warri',
    'Delta',
    'Nigeria',
    'BASE',
    400,
    'active',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'DT-ON-001');

-- Akwa Ibom State Platforms
INSERT INTO sites (site_manager_id, name, code, description, city, state, country, site_type, capacity, status, created_at)
SELECT 
    (SELECT id FROM sites WHERE code = 'AK-001'),
    'Ibom Platform Alpha',
    'AK-OS-001',
    'Ibom Platform Alpha - Primary Production Facility',
    'Uyo',
    'Akwa Ibom',
    'Nigeria',
    'PLATFORM',
    300,
    'active',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'AK-OS-001');

INSERT INTO sites (site_manager_id, name, code, description, city, state, country, site_type, capacity, status, created_at)
SELECT 
    (SELECT id FROM sites WHERE code = 'AK-001'),
    'Uyo Onshore Base',
    'AK-ON-001',
    'Uyo Onshore Base - Administrative and Logistics Facility',
    'Uyo',
    'Akwa Ibom',
    'Nigeria',
    'BASE',
    350,
    'active',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'AK-ON-001');

-- 4. Create Zones under each platform using existing zones table
-- Lagos Offshore Platform Alpha Zones
INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Alpha Production Zone',
    'LG-OS-001-PZ',
    'WORK_AREA',
    'Lagos Offshore Platform Alpha',
    100,
    'HIGH',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'LG-OS-001-PZ');

INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Alpha Safety Zone',
    'LG-OS-001-SZ',
    'SAFETY_ZONE',
    'Lagos Offshore Platform Alpha',
    50,
    'LOW',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'LG-OS-001-SZ');

INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Alpha Restricted Area',
    'LG-OS-001-RA',
    'RESTRICTED',
    'Lagos Offshore Platform Alpha',
    25,
    'CRITICAL',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'LG-OS-001-RA');

INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Alpha Safe Haven',
    'LG-OS-001-SH',
    'SAFE_HAVEN',
    'Lagos Offshore Platform Alpha',
    200,
    'LOW',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'LG-OS-001-SH');

-- Lagos Offshore Platform Beta Zones
INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Beta Production Zone',
    'LG-OS-002-PZ',
    'WORK_AREA',
    'Lagos Offshore Platform Beta',
    80,
    'HIGH',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'LG-OS-002-PZ');

INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Beta Safety Zone',
    'LG-OS-002-SZ',
    'SAFETY_ZONE',
    'Lagos Offshore Platform Beta',
    40,
    'LOW',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'LG-OS-002-SZ');

-- Lagos Onshore Base Zones
INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Lagos Admin Zone',
    'LG-ON-001-AZ',
    'WORK_AREA',
    'Lagos Onshore Base',
    150,
    'LOW',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'LG-ON-001-AZ');

INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Lagos Warehouse Zone',
    'LG-ON-001-WZ',
    'WORK_AREA',
    'Lagos Onshore Base',
    80,
    'MEDIUM',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'LG-ON-001-WZ');

INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Lagos Transport Zone',
    'LG-ON-001-TZ',
    'WORK_AREA',
    'Lagos Onshore Base',
    60,
    'MEDIUM',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'LG-ON-001-TZ');

-- Port Harcourt Platform Alpha Zones
INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Port Harcourt Production Zone',
    'RV-OS-001-PZ',
    'WORK_AREA',
    'Port Harcourt Platform Alpha',
    90,
    'HIGH',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'RV-OS-001-PZ');

INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Port Harcourt Safety Zone',
    'RV-OS-001-SZ',
    'SAFETY_ZONE',
    'Port Harcourt Platform Alpha',
    45,
    'LOW',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'RV-OS-001-SZ');

-- Port Harcourt Onshore Base Zones
INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Port Harcourt Admin Zone',
    'RV-ON-001-AZ',
    'WORK_AREA',
    'Port Harcourt Onshore Base',
    120,
    'LOW',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'RV-ON-001-AZ');

INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Port Harcourt Warehouse Zone',
    'RV-ON-001-WZ',
    'WORK_AREA',
    'Port Harcourt Onshore Base',
    70,
    'MEDIUM',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'RV-ON-001-WZ');

-- Warri Platform Alpha Zones
INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Warri Production Zone',
    'DT-OS-001-PZ',
    'WORK_AREA',
    'Warri Platform Alpha',
    70,
    'HIGH',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'DT-OS-001-PZ');

INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Warri Safety Zone',
    'DT-OS-001-SZ',
    'SAFETY_ZONE',
    'Warri Platform Alpha',
    35,
    'LOW',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'DT-OS-001-SZ');

-- Warri Onshore Base Zones
INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Warri Admin Zone',
    'DT-ON-001-AZ',
    'WORK_AREA',
    'Warri Onshore Base',
    100,
    'LOW',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'DT-ON-001-AZ');

INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Warri Warehouse Zone',
    'DT-ON-001-WZ',
    'WORK_AREA',
    'Warri Onshore Base',
    60,
    'MEDIUM',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'DT-ON-001-WZ');

-- Ibom Platform Alpha Zones
INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Ibom Production Zone',
    'AK-OS-001-PZ',
    'WORK_AREA',
    'Ibom Platform Alpha',
    60,
    'HIGH',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'AK-OS-001-PZ');

INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Ibom Safety Zone',
    'AK-OS-001-SZ',
    'SAFETY_ZONE',
    'Ibom Platform Alpha',
    30,
    'LOW',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'AK-OS-001-SZ');

-- Uyo Onshore Base Zones
INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Uyo Admin Zone',
    'AK-ON-001-AZ',
    'WORK_AREA',
    'Uyo Onshore Base',
    80,
    'LOW',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'AK-ON-001-AZ');

INSERT INTO zones (name, code, zone_type, location, max_capacity, hazard_level, is_active, created_at)
SELECT 
    'Uyo Warehouse Zone',
    'AK-ON-001-WZ',
    'WORK_AREA',
    'Uyo Onshore Base',
    50,
    'MEDIUM',
    true,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM zones WHERE code = 'AK-ON-001-WZ');

-- 5. Add state column to devices table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' AND column_name = 'state'
    ) THEN
        ALTER TABLE devices ADD COLUMN state VARCHAR(100);
    END IF;
END $$;

-- 6. Update existing devices to include state information
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
WHERE state IS NULL OR state = '';

-- 7. Add state column to personnel table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'personnel' AND column_name = 'assigned_state'
    ) THEN
        ALTER TABLE personnel ADD COLUMN assigned_state VARCHAR(100);
    END IF;
END $$;

-- 8. Update personnel with state information based on their current location
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
WHERE assigned_state IS NULL OR assigned_state = '';

-- Display summary
SELECT 'Multi-State Structure Setup Complete!' as status;
SELECT COUNT(*) as total_sites FROM sites;
SELECT COUNT(*) as total_zones FROM zones;
SELECT COUNT(*) as total_devices FROM devices;
SELECT COUNT(*) as total_personnel FROM personnel;
