-- Fix zones table and complete setup
-- Fix updated_at constraint and populate zones

-- 1. Insert zones with proper values including updated_at
INSERT INTO zones (name, zone_type, location, max_capacity, hazard_level, is_active, state, created_at, updated_at) VALUES
('Alpha Production Zone', 'PUBLIC', 'Lagos Offshore Platform Alpha', 100, 'HIGH', true, 'Lagos State', NOW(), NOW()),
('Alpha Safety Zone', 'SAFE_HAVEN', 'Lagos Offshore Platform Alpha', 50, 'LOW', true, 'Lagos State', NOW(), NOW()),
('Alpha Restricted Area', 'RESTRICTED', 'Lagos Offshore Platform Alpha', 25, 'CRITICAL', true, 'Lagos State', NOW(), NOW()),
('Alpha Safe Haven', 'SAFE_HAVEN', 'Lagos Offshore Platform Alpha', 200, 'LOW', true, 'Lagos State', NOW(), NOW()),
('Beta Production Zone', 'PUBLIC', 'Lagos Offshore Platform Beta', 80, 'HIGH', true, 'Lagos State', NOW(), NOW()),
('Beta Safety Zone', 'SAFE_HAVEN', 'Lagos Offshore Platform Beta', 40, 'LOW', true, 'Lagos State', NOW(), NOW()),
('Lagos Admin Zone', 'PUBLIC', 'Lagos Onshore Base', 150, 'LOW', true, 'Lagos State', NOW(), NOW()),
('Lagos Warehouse Zone', 'PUBLIC', 'Lagos Onshore Base', 80, 'MEDIUM', true, 'Lagos State', NOW(), NOW()),
('Lagos Transport Zone', 'PUBLIC', 'Lagos Onshore Base', 60, 'MEDIUM', true, 'Lagos State', NOW(), NOW()),
('Port Harcourt Production Zone', 'PUBLIC', 'Port Harcourt Platform Alpha', 90, 'HIGH', true, 'Rivers State', NOW(), NOW()),
('Port Harcourt Safety Zone', 'SAFE_HAVEN', 'Port Harcourt Platform Alpha', 45, 'LOW', true, 'Rivers State', NOW(), NOW()),
('Port Harcourt Admin Zone', 'PUBLIC', 'Port Harcourt Onshore Base', 120, 'LOW', true, 'Rivers State', NOW(), NOW()),
('Port Harcourt Warehouse Zone', 'PUBLIC', 'Port Harcourt Onshore Base', 70, 'MEDIUM', true, 'Rivers State', NOW(), NOW()),
('Warri Production Zone', 'PUBLIC', 'Warri Platform Alpha', 70, 'HIGH', true, 'Delta State', NOW(), NOW()),
('Warri Safety Zone', 'SAFE_HAVEN', 'Warri Platform Alpha', 35, 'LOW', true, 'Delta State', NOW(), NOW()),
('Warri Admin Zone', 'PUBLIC', 'Warri Onshore Base', 100, 'LOW', true, 'Delta State', NOW(), NOW()),
('Warri Warehouse Zone', 'PUBLIC', 'Warri Onshore Base', 60, 'MEDIUM', true, 'Delta State', NOW(), NOW()),
('Ibom Production Zone', 'PUBLIC', 'Ibom Platform Alpha', 60, 'HIGH', true, 'Akwa Ibom State', NOW(), NOW()),
('Ibom Safety Zone', 'SAFE_HAVEN', 'Ibom Platform Alpha', 30, 'LOW', true, 'Akwa Ibom State', NOW(), NOW()),
('Uyo Admin Zone', 'PUBLIC', 'Uyo Onshore Base', 80, 'LOW', true, 'Akwa Ibom State', NOW(), NOW()),
('Uyo Warehouse Zone', 'PUBLIC', 'Uyo Onshore Base', 50, 'MEDIUM', true, 'Akwa Ibom State', NOW(), NOW());

-- Display final summary
SELECT 'Multi-State Structure Setup Complete!' as status;
SELECT COUNT(*) as total_sites FROM sites;
SELECT COUNT(*) as total_zones FROM zones;
SELECT COUNT(*) as total_personnel FROM personnel;
