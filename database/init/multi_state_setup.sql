-- Multi-State Nigerian Deployment Setup
-- Creates hierarchical location structure for Nigerian states (Lagos, Rivers, Delta, Akwa Ibom)

-- 1. Create Country Level (Nigeria)
INSERT INTO locations (name, code, location_type, description, level, max_capacity, status, latitude, longitude, created_at)
SELECT 
    'Nigeria',
    'NG-001',
    'COUNTRY',
    'Federal Republic of Nigeria - Oil & Gas Operations',
    1,
    10000,
    'ACTIVE',
    '9.0820',
    '8.6753',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'NG-001');

-- 2. Create State Level Locations
INSERT INTO locations (parent_location_id, name, code, location_type, description, level, max_capacity, status, latitude, longitude, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'NG-001'),
    'Lagos State',
    'LG-001',
    'STATE',
    'Lagos State - Oil & Gas Operations',
    2,
    3000,
    'ACTIVE',
    '6.5244',
    '3.3792',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'LG-001');

INSERT INTO locations (parent_location_id, name, code, location_type, description, level, max_capacity, status, latitude, longitude, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'NG-001'),
    'Rivers State',
    'RV-001',
    'STATE',
    'Rivers State - Oil & Gas Operations',
    2,
    2500,
    'ACTIVE',
    '4.8156',
    '7.0498',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'RV-001');

INSERT INTO locations (parent_location_id, name, code, location_type, description, level, max_capacity, status, latitude, longitude, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'NG-001'),
    'Delta State',
    'DT-001',
    'STATE',
    'Delta State - Oil & Gas Operations',
    2,
    2000,
    'ACTIVE',
    '5.4885',
    '5.7427',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'DT-001');

INSERT INTO locations (parent_location_id, name, code, location_type, description, level, max_capacity, status, latitude, longitude, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'NG-001'),
    'Akwa Ibom State',
    'AK-001',
    'STATE',
    'Akwa Ibom State - Oil & Gas Operations',
    2,
    1500,
    'ACTIVE',
    '4.9375',
    '7.9518',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'AK-001');

-- 3. Create Platform/Base Locations under each state
-- Lagos State Platforms
INSERT INTO locations (parent_location_id, name, code, location_type, description, level, max_capacity, status, latitude, longitude, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'LG-001'),
    'Lagos Offshore Platform Alpha',
    'LG-OS-001',
    'PLATFORM',
    'Lagos Offshore Platform Alpha - Primary Production Facility',
    3,
    500,
    'ACTIVE',
    '6.4234',
    '3.4123',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'LG-OS-001');

INSERT INTO locations (parent_location_id, name, code, location_type, description, level, max_capacity, status, latitude, longitude, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'LG-001'),
    'Lagos Offshore Platform Beta',
    'LG-OS-002',
    'PLATFORM',
    'Lagos Offshore Platform Beta - Secondary Production Facility',
    3,
    400,
    'ACTIVE',
    '6.4456',
    '3.4234',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'LG-OS-002');

INSERT INTO locations (parent_location_id, name, code, location_type, description, level, max_capacity, status, latitude, longitude, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'LG-001'),
    'Lagos Onshore Base',
    'LG-ON-001',
    'BASE',
    'Lagos Onshore Base - Administrative and Logistics Facility',
    3,
    800,
    'ACTIVE',
    '6.5244',
    '3.3792',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'LG-ON-001');

-- Rivers State Platforms
INSERT INTO locations (parent_location_id, name, code, location_type, description, level, max_capacity, status, latitude, longitude, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'RV-001'),
    'Port Harcourt Platform Alpha',
    'RV-OS-001',
    'PLATFORM',
    'Port Harcourt Platform Alpha - Primary Production Facility',
    3,
    450,
    'ACTIVE',
    '4.8156',
    '7.0498',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'RV-OS-001');

INSERT INTO locations (parent_location_id, name, code, location_type, description, level, max_capacity, status, latitude, longitude, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'RV-001'),
    'Port Harcourt Onshore Base',
    'RV-ON-001',
    'BASE',
    'Port Harcourt Onshore Base - Administrative and Logistics Facility',
    3,
    600,
    'ACTIVE',
    '4.8156',
    '7.0498',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'RV-ON-001');

-- Delta State Platforms
INSERT INTO locations (parent_location_id, name, code, location_type, description, level, max_capacity, status, latitude, longitude, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'DT-001'),
    'Warri Platform Alpha',
    'DT-OS-001',
    'PLATFORM',
    'Warri Platform Alpha - Primary Production Facility',
    3,
    350,
    'ACTIVE',
    '5.4885',
    '5.7427',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'DT-OS-001');

INSERT INTO locations (parent_location_id, name, code, location_type, description, level, max_capacity, status, latitude, longitude, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'DT-001'),
    'Warri Onshore Base',
    'DT-ON-001',
    'BASE',
    'Warri Onshore Base - Administrative and Logistics Facility',
    3,
    400,
    'ACTIVE',
    '5.4885',
    '5.7427',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'DT-ON-001');

-- Akwa Ibom State Platforms
INSERT INTO locations (parent_location_id, name, code, location_type, description, level, max_capacity, status, latitude, longitude, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'AK-001'),
    'Ibom Platform Alpha',
    'AK-OS-001',
    'PLATFORM',
    'Ibom Platform Alpha - Primary Production Facility',
    3,
    300,
    'ACTIVE',
    '4.9375',
    '7.9518',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'AK-OS-001');

INSERT INTO locations (parent_location_id, name, code, location_type, description, level, max_capacity, status, latitude, longitude, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'AK-001'),
    'Uyo Onshore Base',
    'AK-ON-001',
    'BASE',
    'Uyo Onshore Base - Administrative and Logistics Facility',
    3,
    350,
    'ACTIVE',
    '4.9375',
    '7.9518',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE code = 'AK-ON-001');

-- 4. Create Zones under each platform
-- Lagos Offshore Platform Alpha Zones
INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'LG-OS-001'),
    'Alpha Production Zone',
    'LG-OS-001-PZ',
    'WORK_AREA',
    'Primary production area for Lagos Offshore Platform Alpha',
    100,
    'HIGH',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'LG-OS-001-PZ');

INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'LG-OS-001'),
    'Alpha Safety Zone',
    'LG-OS-001-SZ',
    'SAFETY_ZONE',
    'Designated safety area for Lagos Offshore Platform Alpha',
    50,
    'LOW',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'LG-OS-001-SZ');

INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'LG-OS-001'),
    'Alpha Restricted Area',
    'LG-OS-001-RA',
    'RESTRICTED',
    'Restricted access area for Lagos Offshore Platform Alpha',
    25,
    'CRITICAL',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'LG-OS-001-RA');

INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'LG-OS-001'),
    'Alpha Safe Haven',
    'LG-OS-001-SH',
    'SAFE_HAVEN',
    'Emergency safe haven for Lagos Offshore Platform Alpha',
    200,
    'LOW',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'LG-OS-001-SH');

-- Lagos Offshore Platform Beta Zones
INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'LG-OS-002'),
    'Beta Production Zone',
    'LG-OS-002-PZ',
    'WORK_AREA',
    'Primary production area for Lagos Offshore Platform Beta',
    80,
    'HIGH',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'LG-OS-002-PZ');

INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'LG-OS-002'),
    'Beta Safety Zone',
    'LG-OS-002-SZ',
    'SAFETY_ZONE',
    'Designated safety area for Lagos Offshore Platform Beta',
    40,
    'LOW',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'LG-OS-002-SZ');

-- Lagos Onshore Base Zones
INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'LG-ON-001'),
    'Lagos Admin Zone',
    'LG-ON-001-AZ',
    'WORK_AREA',
    'Administrative area for Lagos Onshore Base',
    150,
    'LOW',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'LG-ON-001-AZ');

INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'LG-ON-001'),
    'Lagos Warehouse Zone',
    'LG-ON-001-WZ',
    'WORK_AREA',
    'Warehouse and storage area for Lagos Onshore Base',
    80,
    'MEDIUM',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'LG-ON-001-WZ');

INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'LG-ON-001'),
    'Lagos Transport Zone',
    'LG-ON-001-TZ',
    'WORK_AREA',
    'Transport and logistics area for Lagos Onshore Base',
    60,
    'MEDIUM',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'LG-ON-001-TZ');

-- Port Harcourt Platform Alpha Zones
INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'RV-OS-001'),
    'Port Harcourt Production Zone',
    'RV-OS-001-PZ',
    'WORK_AREA',
    'Primary production area for Port Harcourt Platform Alpha',
    90,
    'HIGH',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'RV-OS-001-PZ');

INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'RV-OS-001'),
    'Port Harcourt Safety Zone',
    'RV-OS-001-SZ',
    'SAFETY_ZONE',
    'Designated safety area for Port Harcourt Platform Alpha',
    45,
    'LOW',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'RV-OS-001-SZ');

-- Port Harcourt Onshore Base Zones
INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'RV-ON-001'),
    'Port Harcourt Admin Zone',
    'RV-ON-001-AZ',
    'WORK_AREA',
    'Administrative area for Port Harcourt Onshore Base',
    120,
    'LOW',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'RV-ON-001-AZ');

INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'RV-ON-001'),
    'Port Harcourt Warehouse Zone',
    'RV-ON-001-WZ',
    'WORK_AREA',
    'Warehouse and storage area for Port Harcourt Onshore Base',
    70,
    'MEDIUM',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'RV-ON-001-WZ');

-- Warri Platform Alpha Zones
INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'DT-OS-001'),
    'Warri Production Zone',
    'DT-OS-001-PZ',
    'WORK_AREA',
    'Primary production area for Warri Platform Alpha',
    70,
    'HIGH',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'DT-OS-001-PZ');

INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'DT-OS-001'),
    'Warri Safety Zone',
    'DT-OS-001-SZ',
    'SAFETY_ZONE',
    'Designated safety area for Warri Platform Alpha',
    35,
    'LOW',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'DT-OS-001-SZ');

-- Warri Onshore Base Zones
INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'DT-ON-001'),
    'Warri Admin Zone',
    'DT-ON-001-AZ',
    'WORK_AREA',
    'Administrative area for Warri Onshore Base',
    100,
    'LOW',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'DT-ON-001-AZ');

INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'DT-ON-001'),
    'Warri Warehouse Zone',
    'DT-ON-001-WZ',
    'WORK_AREA',
    'Warehouse and storage area for Warri Onshore Base',
    60,
    'MEDIUM',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'DT-ON-001-WZ');

-- Ibom Platform Alpha Zones
INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'AK-OS-001'),
    'Ibom Production Zone',
    'AK-OS-001-PZ',
    'WORK_AREA',
    'Primary production area for Ibom Platform Alpha',
    60,
    'HIGH',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'AK-OS-001-PZ');

INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'AK-OS-001'),
    'Ibom Safety Zone',
    'AK-OS-001-SZ',
    'SAFETY_ZONE',
    'Designated safety area for Ibom Platform Alpha',
    30,
    'LOW',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'AK-OS-001-SZ');

-- Uyo Onshore Base Zones
INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'AK-ON-001'),
    'Uyo Admin Zone',
    'AK-ON-001-AZ',
    'WORK_AREA',
    'Administrative area for Uyo Onshore Base',
    80,
    'LOW',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'AK-ON-001-AZ');

INSERT INTO location_zones (location_id, name, code, zone_type, description, max_occupancy, hazard_level, status, created_at)
SELECT 
    (SELECT id FROM locations WHERE code = 'AK-ON-001'),
    'Uyo Warehouse Zone',
    'AK-ON-001-WZ',
    'WORK_AREA',
    'Warehouse and storage area for Uyo Onshore Base',
    50,
    'MEDIUM',
    'ACTIVE',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM location_zones WHERE code = 'AK-ON-001-WZ');

-- 5. Update existing devices to include state information
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

-- 6. Add state column to devices table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' AND column_name = 'state'
    ) THEN
        ALTER TABLE devices ADD COLUMN state VARCHAR(100);
    END IF;
END $$;

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
SELECT COUNT(*) as total_locations FROM locations;
SELECT COUNT(*) as total_zones FROM location_zones;
SELECT COUNT(*) as total_devices FROM devices;
SELECT COUNT(*) as total_personnel FROM personnel;
