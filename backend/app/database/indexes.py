"""
Database Indexes for Query Optimization
Creates optimized indexes for improved database performance
"""

from sqlalchemy import text

# Index definitions for PostgreSQL optimization
INDEXES = [
    # Personnel indexes
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_badge_id ON personnel(badge_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_email ON personnel(email);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_company ON personnel(company);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_department ON personnel(department);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_status ON personnel(is_active, status);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_location ON personnel(current_location);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_created ON personnel(created_at);
    """,
    
    # BioTime personnel employee indexes
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_employee_emp_code ON personnel_employee(emp_code);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_employee_badge_number ON personnel_employee(badge_number);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_employee_dept_id ON personnel_employee(dept_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_employee_status ON personnel_employee(status);
    """,
    
    # Device indexes
    """
    CREATE INDEX IF NOT EXISTS idx_iclock_terminal_sn ON iclock_terminal(sn);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_iclock_terminal_alias ON iclock_terminal(alias);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_iclock_terminal_state ON iclock_terminal(state);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_iclock_terminal_last_activity ON iclock_terminal(last_activity);
    """,
    
    # Attendance/Transaction indexes
    """
    CREATE INDEX IF NOT EXISTS idx_iclock_transaction_sn ON iclock_transaction(sn);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_iclock_transaction_emp_code ON iclock_transaction(emp_code);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_iclock_transaction_punch_time ON iclock_transaction(punch_time);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_iclock_transaction_punch_time_emp ON iclock_transaction(punch_time, emp_code);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_iclock_transaction_punch_time_sn ON iclock_transaction(punch_time, sn);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_iclock_transaction_verify_type ON iclock_transaction(verify_type);
    """,
    
    # Access control indexes
    """
    CREATE INDEX IF NOT EXISTS idx_acc_event_door_id ON acc_event(door_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_acc_event_user_id ON acc_event(user_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_acc_event_event_time ON acc_event(event_time);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_acc_event_event_time_door ON acc_event(event_time, door_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_acc_event_event_type ON acc_event(event_type);
    """,
    
    """
    CREATE INDEX IF NOT EXISTS idx_acc_door_door_name ON acc_door(door_name);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_acc_door_terminal_sn ON acc_door(terminal_sn);
    """,
    
    """
    CREATE INDEX IF NOT EXISTS idx_acc_user_authorize_user_id ON acc_user_authorize(user_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_acc_user_authorize_level_id ON acc_user_authorize(level_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_acc_user_authorize_door_id ON acc_user_authorize(door_id);
    """,
    
    # Emergency management indexes
    """
    CREATE INDEX IF NOT EXISTS idx_emergency_event_status ON emergency_event(status);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_emergency_event_event_type ON emergency_event(event_type);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_emergency_event_initiated_at ON emergency_event(initiated_at);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_emergency_event_scope ON emergency_event(scope);
    """,
    
    """
    CREATE INDEX IF NOT EXISTS idx_emergency_notification_status ON emergency_notification(status);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_emergency_notification_channel ON emergency_notification(channel);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_emergency_notification_created_at ON emergency_notification(created_at);
    """,
    
    # Transport indexes
    """
    CREATE INDEX IF NOT EXISTS idx_transport_status ON transport(status);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_transport_transport_type ON transport(transport_type);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_transport_departure_time ON transport(departure_time);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_transport_arrival_location ON transport(arrival_location);
    """,
    
    # Mustering indexes
    """
    CREATE INDEX IF NOT EXISTS idx_mustering_event_status ON mustering_event(status);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_mustering_event_muster_time ON mustering_event(muster_time);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_mustering_zone_name ON mustering_zone(name);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_mustering_zone_location ON mustering_zone(location);
    """,
    
    # Audit trail indexes
    """
    CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_audit_log_table_action ON audit_log(table_name, action);
    """,
    
    # Rotation management indexes
    """
    CREATE INDEX IF NOT EXISTS idx_rotation_schedule_status ON rotation_schedule(is_active);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_rotation_schedule_dates ON rotation_schedule(start_date, end_date);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_rotation_assignment_personnel ON rotation_assignment(personnel_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_rotation_assignment_status ON rotation_assignment(status);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_rotation_assignment_dates ON rotation_assignment(start_date, end_date);
    """,
    
    # Permit-to-work indexes
    """
    CREATE INDEX IF NOT EXISTS idx_permits_to_work_status ON permits_to_work(status);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_permits_to_work_permit_type ON permits_to_work(permit_type);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_permits_to_work_priority ON permits_to_work(priority);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_permits_to_work_risk_level ON permits_to_work(risk_level);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_permits_to_work_dates ON permits_to_work(start_date, end_date);
    """,
    
    """
    CREATE INDEX IF NOT EXISTS idx_permit_personnel_assignments_permit ON permit_personnel_assignments(permit_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_permit_personnel_assignments_personnel ON permit_personnel_assignments(personnel_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_permit_personnel_assignments_status ON permit_personnel_assignments(status);
    """,
    
    # Industry training indexes
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_h2s_training ON personnel(h2s_training_expiry);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_t_water_training ON personnel(t_water_training_expiry);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_survival_training ON personnel(survival_training_expiry);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_fire_safety_training ON personnel(fire_safety_training_expiry);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_confined_space_training ON personnel(confined_space_training_expiry);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_safety_passport ON personnel(safety_passport_expiry);
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_medical_fitness ON personnel(medical_fitness_expiry);
    """,
    
    # Composite indexes for common queries
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_active_company ON personnel(is_active, company) WHERE is_active = true;
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_personnel_active_department ON personnel(is_active, department) WHERE is_active = true;
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_iclock_transaction_recent ON iclock_transaction(punch_time DESC, emp_code) WHERE punch_time >= NOW() - INTERVAL '30 days';
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_acc_event_recent ON acc_event(event_time DESC, door_id) WHERE event_time >= NOW() - INTERVAL '7 days';
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_emergency_event_active ON emergency_event(status, initiated_at DESC) WHERE status = 'ACTIVE';
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_transport_active ON transport(status, departure_time) WHERE status IN ('SCHEDULED', 'IN_FLIGHT');
    """,
]

def create_indexes(db_session):
    """Create all database indexes for performance optimization"""
    try:
        for index_sql in INDEXES:
            db_session.execute(text(index_sql))
        
        db_session.commit()
        print("✅ Database indexes created successfully")
        return True
    except Exception as e:
        print(f"❌ Error creating database indexes: {e}")
        db_session.rollback()
        return False

def analyze_indexes(db_session):
    """Analyze database index usage and provide recommendations"""
    try:
        # Get index usage statistics
        index_stats = db_session.execute(text("""
            SELECT 
                schemaname,
                tablename,
                indexname,
                idx_scan as index_scans,
                idx_tup_read as tuples_read,
                idx_tup_fetch as tuples_fetched,
                pg_size_pretty(pg_relation_size(indexrelid::regclass)) as index_size
            FROM pg_stat_user_indexes 
            WHERE schemaname = 'public'
            ORDER BY idx_scan DESC, idx_tup_read DESC
        """)).fetchall()
        
        # Get unused indexes
        unused_indexes = db_session.execute(text("""
            SELECT 
                schemaname,
                tablename,
                indexname,
                pg_size_pretty(pg_relation_size(indexrelid::regclass)) as index_size
            FROM pg_stat_user_indexes 
            WHERE idx_scan = 0 
            AND schemaname = 'public'
            ORDER BY pg_relation_size(indexrelid::regclass) DESC
        """)).fetchall()
        
        # Get table sizes
        table_sizes = db_session.execute(text("""
            SELECT 
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
                pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        """)).fetchall()
        
        return {
            "index_usage": [
                {
                    "schema": row[0],
                    "table": row[1],
                    "index": row[2],
                    "scans": row[3],
                    "tuples_read": row[4],
                    "tuples_fetched": row[5],
                    "size": row[6]
                }
                for row in index_stats
            ],
            "unused_indexes": [
                {
                    "schema": row[0],
                    "table": row[1],
                    "index": row[2],
                    "size": row[3]
                }
                for row in unused_indexes
            ],
            "table_sizes": [
                {
                    "table": row[0],
                    "total_size": row[1],
                    "table_size": row[2],
                    "indexes_size": row[3]
                }
                for row in table_sizes
            ]
        }
    except Exception as e:
        print(f"❌ Error analyzing indexes: {e}")
        return {"error": str(e)}
