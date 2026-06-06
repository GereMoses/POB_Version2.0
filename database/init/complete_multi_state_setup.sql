-- Complete Multi-State Nigerian Deployment Setup
-- Works with existing database structure

-- 1. Add state column to zones table if it doesn't exist
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

-- 3. Insert zones with correct enum values and state assignment
INSERT INTO zones (name, zone_type, location, max_capacity, hazard_level, is_active, state, created_at) VALUES
('Alpha Production Zone', 'PUBLIC', 'Lagos Offshore Platform Alpha', 100, 'HIGH', true, 'Lagos State', NOW()),
('Alpha Safety Zone', 'SAFE_HAVEN', 'Lagos Offshore Platform Alpha', 50, 'LOW', true, 'Lagos State', NOW()),
('Alpha Restricted Area', 'RESTRICTED', 'Lagos Offshore Platform Alpha', 25, 'CRITICAL', true, 'Lagos State', NOW()),
('Alpha Safe Haven', 'SAFE_HAVEN', 'Lagos Offshore Platform Alpha', 200, 'LOW', true, 'Lagos State', NOW()),
('Beta Production Zone', 'PUBLIC', 'Lagos Offshore Platform Beta', 80, 'HIGH', true, 'Lagos State', NOW()),
('Beta Safety Zone', 'SAFE_HAVEN', 'Lagos Offshore Platform Beta', 40, 'LOW', true, 'Lagos State', NOW()),
('Lagos Admin Zone', 'PUBLIC', 'Lagos Onshore Base', 150, 'LOW', true, 'Lagos State', NOW()),
('Lagos Warehouse Zone', 'PUBLIC', 'Lagos Onshore Base', 80, 'MEDIUM', true, 'Lagos State', NOW()),
('Lagos Transport Zone', 'PUBLIC', 'Lagos Onshore Base', 60, 'MEDIUM', true, 'Lagos State', NOW()),
('Port Harcourt Production Zone', 'PUBLIC', 'Port Harcourt Platform Alpha', 90, 'HIGH', true, 'Rivers State', NOW()),
('Port Harcourt Safety Zone', 'SAFE_HAVEN', 'Port Harcourt Platform Alpha', 45, 'LOW', true, 'Rivers State', NOW()),
('Port Harcourt Admin Zone', 'PUBLIC', 'Port Harcourt Onshore Base', 120, 'LOW', true, 'Rivers State', NOW()),
('Port Harcourt Warehouse Zone', 'PUBLIC', 'Port Harcourt Onshore Base', 70, 'MEDIUM', true, 'Rivers State', NOW()),
('Warri Production Zone', 'PUBLIC', 'Warri Platform Alpha', 70, 'HIGH', true, 'Delta State', NOW()),
('Warri Safety Zone', 'SAFE_HAVEN', 'Warri Platform Alpha', 35, 'LOW', true, 'Delta State', NOW()),
('Warri Admin Zone', 'PUBLIC', 'Warri Onshore Base', 100, 'LOW', true, 'Delta State', NOW()),
('Warri Warehouse Zone', 'PUBLIC', 'Warri Onshore Base', 60, 'MEDIUM', true, 'Delta State', NOW()),
('Ibom Production Zone', 'PUBLIC', 'Ibom Platform Alpha', 60, 'HIGH', true, 'Akwa Ibom State', NOW()),
('Ibom Safety Zone', 'SAFE_HAVEN', 'Ibom Platform Alpha', 30, 'LOW', true, 'Akwa Ibom State', NOW()),
('Uyo Admin Zone', 'PUBLIC', 'Uyo Onshore Base', 80, 'LOW', true, 'Akwa Ibom State', NOW()),
('Uyo Warehouse Zone', 'PUBLIC', 'Uyo Onshore Base', 50, 'MEDIUM', true, 'Akwa Ibom State', NOW());

-- 4. Add state column to personnel table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'personnel' AND column_name = 'assigned_state'
    ) THEN
        ALTER TABLE personnel ADD COLUMN assigned_state VARCHAR(100);
    END IF;
END $$;

-- 5. Update personnel with state information based on their current location
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
SELECT COUNT(*) as total_personnel FROM personnel;
