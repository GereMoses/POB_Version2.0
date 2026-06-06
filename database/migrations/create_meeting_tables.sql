-- Meeting Management Tables for BioTime 9.5 + POB Extensions
-- Execute this when PostgreSQL is running

-- Create meeting rooms table
CREATE TABLE IF NOT EXISTS mtg_room (
    id serial PRIMARY KEY,
    room_name varchar(100) NOT NULL UNIQUE,
    capacity int NOT NULL CHECK (capacity > 0),
    location varchar(100),
    area_id int REFERENCES personnel_area(id),
    door_id int REFERENCES acc_door(id),
    equipment text, -- JSON array of equipment
    status smallint DEFAULT 0 CHECK (status IN (0,1)), -- 0=available,1=maintenance
    require_approval boolean DEFAULT false,
    mustering_zone_id int REFERENCES mustering_zone(id),
    is_emergency_assembly boolean DEFAULT false,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Create meeting bookings table
CREATE TABLE IF NOT EXISTS mtg_booking (
    id bigserial PRIMARY KEY,
    room_id int NOT NULL REFERENCES mtg_room(id),
    title varchar(200) NOT NULL,
    start_time timestamp NOT NULL,
    end_time timestamp NOT NULL CHECK (end_time > start_time),
    organizer_emp_id int NOT NULL REFERENCES personnel_employee(id),
    attendee_count int DEFAULT 0,
    agenda text,
    attachments text, -- JSON array of file paths
    repeat_type smallint DEFAULT 0 CHECK (repeat_type IN (0,1,2,3)), -- 0=none,1=daily,2=weekly,3=monthly
    repeat_until date,
    status smallint DEFAULT 0 CHECK (status IN (0,1,2,3,4)), -- 0=pending,1=approved,2=rejected,3=completed,4=cancelled
    approval_by int REFERENCES personnel_employee(id),
    approval_time timestamp,
    approval_note varchar(255),
    meeting_code varchar(20) UNIQUE,
    qr_code varchar(100) UNIQUE,
    auto_unlock boolean DEFAULT true,
    created_time timestamp DEFAULT CURRENT_TIMESTAMP,
    updated_time timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Create meeting attendees table
CREATE TABLE IF NOT EXISTS mtg_attendee (
    id bigserial PRIMARY KEY,
    booking_id bigint NOT NULL REFERENCES mtg_booking(id),
    attendee_type smallint NOT NULL CHECK (attendee_type IN (0,1,2)), -- 0=employee,1=visitor,2=external
    emp_id int REFERENCES personnel_employee(id),
    visitor_id bigint REFERENCES vis_visitor(id),
    ext_name varchar(100),
    ext_email varchar(100),
    ext_phone varchar(20),
    is_required boolean DEFAULT true,
    pre_reg_id bigint REFERENCES vis_pre_registration(id),
    invitation_sent boolean DEFAULT false,
    invitation_sent_time timestamp,
    UNIQUE(booking_id, emp_id, visitor_id, ext_email)
);

-- Create meeting attendance table
CREATE TABLE IF NOT EXISTS mtg_attendance (
    id bigserial PRIMARY KEY,
    booking_id bigint NOT NULL REFERENCES mtg_booking(id),
    attendee_id bigint NOT NULL REFERENCES mtg_attendee(id),
    check_in_time timestamp DEFAULT CURRENT_TIMESTAMP,
    check_out_time timestamp,
    device_sn varchar(20) REFERENCES iclock_terminal(sn),
    verify_type smallint, -- 1=card,15=face,25=palm,100=manual
    status smallint DEFAULT 0 CHECK (status IN (0,1,2)), -- 0=present,1=late,2=absent
    notes text
);

-- Create meeting minutes table
CREATE TABLE IF NOT EXISTS mtg_minutes (
    id bigserial PRIMARY KEY,
    booking_id bigint NOT NULL REFERENCES mtg_booking(id),
    minutes_path varchar(255),
    uploaded_by int NOT NULL REFERENCES personnel_employee(id),
    uploaded_time timestamp DEFAULT CURRENT_TIMESTAMP,
    file_size bigint,
    file_type varchar(10)
);

-- Create meeting action items table
CREATE TABLE IF NOT EXISTS mtg_action_item (
    id bigserial PRIMARY KEY,
    booking_id bigint NOT NULL REFERENCES mtg_booking(id),
    action_desc varchar(500) NOT NULL,
    assignee_emp_id int NOT NULL REFERENCES personnel_employee(id),
    due_date date,
    status smallint DEFAULT 0 CHECK (status IN (0,1,2)), -- 0=open,1=done,2=overdue
    completed_time timestamp,
    created_time timestamp DEFAULT CURRENT_TIMESTAMP,
    created_by int REFERENCES personnel_employee(id)
);

-- Create meeting equipment table
CREATE TABLE IF NOT EXISTS mtg_equipment (
    id serial PRIMARY KEY,
    equip_name varchar(100) NOT NULL,
    equip_type varchar(50),
    room_id int REFERENCES mtg_room(id),
    status smallint DEFAULT 0 CHECK (status IN (0,1)), -- 0=available,1=maintenance
    serial_no varchar(50),
    purchase_date date,
    warranty_expiry date,
    last_maintenance date,
    notes text
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mtg_booking_room_time ON mtg_booking(room_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_mtg_booking_status_time ON mtg_booking(status, start_time);
CREATE INDEX IF NOT EXISTS idx_mtg_attendee_booking ON mtg_attendee(booking_id);
CREATE INDEX IF NOT EXISTS idx_mtg_attendance_booking_time ON mtg_attendance(booking_id, check_in_time);
CREATE INDEX IF NOT EXISTS idx_mtg_attendee_emp_id ON mtg_attendee(emp_id);
CREATE INDEX IF NOT EXISTS idx_mtg_attendee_visitor_id ON mtg_attendee(visitor_id);
CREATE INDEX IF NOT EXISTS idx_mtg_equipment_room ON mtg_equipment(room_id);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_time = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_mtg_room_updated_at BEFORE UPDATE ON mtg_room 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mtg_booking_updated_at BEFORE UPDATE ON mtg_booking 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample meeting room for testing
INSERT INTO mtg_room (room_name, capacity, location, status, require_approval) 
VALUES ('Boardroom', 10, 'Floor 1', 0, true)
ON CONFLICT (room_name) DO NOTHING;
