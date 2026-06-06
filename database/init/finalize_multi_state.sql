-- Finalize Multi-State Setup
-- Add state column to zones and populate data

-- 1. Add state column to zones table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zones' AND column_name = 'state'
    ) THEN
        ALTER TABLE zones ADD COLUMN state VARCHAR(100);
    END IF;
END $$;

-- 2. Clear existing zones data
DELETE FROM zones;

-- 3. Insert zones with state assignment
INSERT INTO zones (name, zone_type, location, max_capacity, hazard_level, is_active, state, created_at) VALUES
('Alpha Production Zone', 'WORK_AREA', 'Lagos Offshore Platform Alpha', 100, 'HIGH', true, 'Lagos State', NOW()),
('Alpha Safety Zone', 'SAFETY_ZONE', 'Lagos Offshore Platform Alpha', 50, 'LOW', true, 'Lagos State', NOW()),
('Alpha Restricted Area', 'RESTRICTED', 'Lagos Offshore Platform Alpha', 25, 'CRITICAL', true, 'Lagos State', NOW()),
('Alpha Safe Haven', 'SAFE_HAVEN', 'Lagos Offshore Platform Alpha', 200, 'LOW', true, 'Lagos State', NOW()),
('Beta Production Zone', 'WORK_AREA', 'Lagos Offshore Platform Beta', 80, 'HIGH', true, 'Lagos State', NOW()),
('Beta Safety Zone', 'SAFETY_ZONE', 'Lagos Offshore Platform Beta', 40, 'LOW', true, 'Lagos State', NOW()),
('Lagos Admin Zone', 'WORK_AREA', 'Lagos Onshore Base', 150, 'LOW', true, 'Lagos State', NOW()),
('Lagos Warehouse Zone', 'WORK_AREA', 'Lagos Onshore Base', 80, 'MEDIUM', true, 'Lagos State', NOW()),
('Lagos Transport Zone', 'WORK_AREA', 'Lagos Onshore Base', 60, 'MEDIUM', true, 'Lagos State', NOW()),
('Port Harcourt Production Zone', 'WORK_AREA', 'Port Harcourt Platform Alpha', 90, 'HIGH', true, 'Rivers State', NOW()),
('Port Harcourt Safety Zone', 'SAFETY_ZONE', 'Port Harcourt Platform Alpha', 45, 'LOW', true, 'Rivers State', NOW()),
('Port Harcourt Admin Zone', 'WORK_AREA', 'Port Harcourt Onshore Base', 120, 'LOW', true, 'Rivers State', NOW()),
('Port Harcourt Warehouse Zone', 'WORK_AREA', 'Port Harcourt Onshore Base', 70, 'MEDIUM', true, 'Rivers State', NOW()),
('Warri Production Zone', 'WORK_AREA', 'Warri Platform Alpha', 70, 'HIGH', true, 'Delta State', NOW()),
('Warri Safety Zone', 'SAFETY_ZONE', 'Warri Platform Alpha', 35, 'LOW', true, 'Delta State', NOW()),
('Warri Admin Zone', 'WORK_AREA', 'Warri Onshore Base', 100, 'LOW', true, 'Delta State', NOW()),
('Warri Warehouse Zone', 'WORK_AREA', 'Warri Onshore Base', 60, 'MEDIUM', true, 'Delta State', NOW()),
('Ibom Production Zone', 'WORK_AREA', 'Ibom Platform Alpha', 60, 'HIGH', true, 'Akwa Ibom State', NOW()),
('Ibom Safety Zone', 'SAFETY_ZONE', 'Ibom Platform Alpha', 30, 'LOW', true, 'Akwa Ibom State', NOW()),
('Uyo Admin Zone', 'WORK_AREA', 'Uyo Onshore Base', 80, 'LOW', true, 'Akwa Ibom State', NOW()),
('Uyo Warehouse Zone', 'WORK_AREA', 'Uyo Onshore Base', 50, 'MEDIUM', true, 'Akwa Ibom State', NOW());

-- 4. Update devices with state information
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

-- 5. Update personnel with state information
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
