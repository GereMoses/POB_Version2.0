-- Create sample departments
INSERT INTO departments (name, code, description, department_type, status, site_name, manager_id, parent_id, level, is_active, created_at, updated_at) VALUES
('Operations Department', 'OPS-001', 'Main operations department for platform activities', 'operations', 'active', 'Platform Alpha', 1, NULL, 1, true, NOW(), NOW()),
('Safety Department', 'SAF-001', 'Safety and compliance department', 'safety', 'active', 'Platform Alpha', 2, NULL, 1, true, NOW(), NOW()),
('Maintenance Department', 'MAINT-001', 'Equipment maintenance and repairs', 'maintenance', 'active', 'Platform Alpha', 3, NULL, 1, true, NOW(), NOW()),
('Logistics Department', 'LOG-001', 'Supply chain and logistics management', 'logistics', 'active', 'Platform Alpha', 4, NULL, 1, true, NOW(), NOW()),
('Medical Department', 'MED-001', 'Medical services and emergency response', 'medical', 'active', 'Platform Alpha', 5, NULL, 1, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
