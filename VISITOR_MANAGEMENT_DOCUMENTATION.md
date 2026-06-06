# Visitor Management System Documentation

## Overview

The Visitor Management System is a comprehensive BioTime 9.5 compatible visitor management solution with POB (Personnel & Operations Base) extensions for oil and gas operations. This system provides complete visitor lifecycle management from pre-registration to check-out, with real-time device synchronization and mustering integration.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Schema](#database-schema)
3. [API Documentation](#api-documentation)
4. [Frontend Components](#frontend-components)
5. [Integration Points](#integration-points)
6. [Security Features](#security-features)
7. [Mustering Integration](#mustering-integration)
8. [Device Synchronization](#device-synchronization)
9. [Email/SMS Notifications](#emailsms-notifications)
10. [Reporting & Analytics](#reporting--analytics)
11. [Installation & Setup](#installation--setup)
12. [Troubleshooting](#troubleshooting)

---

## System Architecture

### Backend Components

#### Models
- **VisitorType**: Configurable visitor categories with access levels
- **Visitor**: Core visitor information and status
- **VisitorPreRegistration**: Pre-registration workflow with QR codes
- **VisitorVisitLog**: Complete visit tracking with timestamps
- **VisitorBlacklist**: Security blacklist management

#### Services
- **VisitorService**: Core business logic and visitor management
- **VisitorQRService**: QR code generation and validation
- **BadgeService**: Professional badge printing and templates
- **VisitorDeviceSyncService**: Real-time device synchronization
- **EmailService**: Email notifications and templates

#### API Endpoints
- **REST API**: Complete RESTful API for all visitor operations
- **Authentication**: JWT-based authentication with role-based access
- **Real-time Updates**: WebSocket support for live updates

### Frontend Components

#### Main Interface
- **Visitor.jsx**: Main dashboard with 8 functional tabs
- **Navigation**: Seamless tab navigation with real-time updates

#### Functional Components
- **PreRegistration**: Visitor pre-registration with QR generation
- **CheckInKiosk**: Full-screen check-in with photo capture
- **CheckOutKiosk**: Self-service check-out with card return
- **VisitorRecords**: Complete visitor history and filtering
- **Blacklist**: Security blacklist management
- **HostApproval**: Host approval workflow
- **VisitorTypes**: Visitor type configuration
- **Reports**: Comprehensive reporting and analytics
- **VisitorAnalytics**: Real-time analytics dashboard

---

## Database Schema

### Visitor Tables

#### vis_type
```sql
CREATE TABLE vis_type (
    id SERIAL PRIMARY KEY,
    type_name VARCHAR(100) NOT NULL,
    access_level_id INTEGER REFERENCES acc_level(id),
    badge_template VARCHAR(100),
    induction_required BOOLEAN DEFAULT FALSE,
    default_visit_hours INTEGER DEFAULT 8,
    auto_checkout BOOLEAN DEFAULT TRUE,
    mustering_zone_id INTEGER REFERENCES mustering_zone(id),
    contractor_visitor BOOLEAN DEFAULT FALSE,
    safety_induction_required BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### vis_visitor
```sql
CREATE TABLE vis_visitor (
    id SERIAL PRIMARY KEY,
    visitor_code VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    company VARCHAR(100),
    id_type INTEGER DEFAULT 0, -- 0=NIC,1=Passport,2=License
    id_no VARCHAR(50),
    photo TEXT,
    signature TEXT,
    visitor_type_id INTEGER REFERENCES vis_type(id),
    is_blacklist BOOLEAN DEFAULT FALSE,
    blacklist_reason TEXT,
    vendor_id INTEGER REFERENCES personnel_vendor(id),
    created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### vis_pre_registration
```sql
CREATE TABLE vis_pre_registration (
    id SERIAL PRIMARY KEY,
    visitor_id INTEGER REFERENCES vis_visitor(id),
    host_emp_id INTEGER REFERENCES personnel_employee(id),
    visit_date DATE NOT NULL,
    visit_time_start TIME,
    visit_time_end TIME,
    purpose TEXT,
    area_id INTEGER REFERENCES personnel_area(id),
    vehicle_no VARCHAR(20),
    qr_code VARCHAR(100) UNIQUE NOT NULL,
    status INTEGER DEFAULT 0, -- 0=pending,1=approved,2=rejected,3=checked_in,4=checked_out,5=expired
    approval_time TIMESTAMP,
    approval_by INTEGER REFERENCES personnel_employee(id),
    approval_note TEXT,
    safety_induction_done BOOLEAN DEFAULT FALSE,
    induction_doc TEXT,
    created_by INTEGER REFERENCES auth_user(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### vis_visit_log
```sql
CREATE TABLE vis_visit_log (
    id SERIAL PRIMARY KEY,
    visitor_id INTEGER REFERENCES vis_visitor(id),
    pre_reg_id INTEGER REFERENCES vis_pre_registration(id),
    host_emp_id INTEGER REFERENCES personnel_employee(id),
    check_in_time TIMESTAMP NOT NULL,
    check_out_time TIMESTAMP,
    card_no VARCHAR(20),
    device_sn VARCHAR(50) REFERENCES iclock_terminal(sn),
    badge_printed BOOLEAN DEFAULT FALSE,
    status INTEGER DEFAULT 0, -- 0=in,1=out,2=overstay
    area_id INTEGER REFERENCES personnel_area(id),
    mustering_zone_id INTEGER REFERENCES mustering_zone(id),
    mustering_status INTEGER, -- null,0=missing,1=safe
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### vis_blacklist
```sql
CREATE TABLE vis_blacklist (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    id_no VARCHAR(50) UNIQUE NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    reason TEXT NOT NULL,
    added_by INTEGER REFERENCES auth_user(id),
    added_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_vis_visitor_code ON vis_visitor(visitor_code);
CREATE INDEX idx_vis_visit_log_check_in ON vis_visit_log(check_in_time);
CREATE INDEX idx_vis_visit_log_status ON vis_visit_log(status);
CREATE INDEX idx_vis_pre_registration_qr ON vis_pre_registration(qr_code);
CREATE INDEX idx_vis_pre_registration_status_date ON vis_pre_registration(status, visit_date);
CREATE INDEX idx_vis_blacklist_id_no ON vis_blacklist(id_no);
```

---

## API Documentation

### Base URL
```
http://localhost:8001/api/visitor/
```

### Authentication
All API endpoints require JWT authentication except QR code scanning.

```javascript
Headers:
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Endpoints

#### Visitor Types
```
GET    /api/visitor/types/                    # List all visitor types
POST   /api/visitor/types/                    # Create visitor type
GET    /api/visitor/types/{id}                # Get specific visitor type
PUT    /api/visitor/types/{id}                # Update visitor type
DELETE /api/visitor/types/{id}                # Delete visitor type
```

#### Visitor Management
```
GET    /api/visitor/visitors/                  # List visitors with filters
POST   /api/visitor/visitors/                  # Create visitor
GET    /api/visitor/visitors/{id}              # Get specific visitor
PUT    /api/visitor/visitors/{id}              # Update visitor
POST   /api/visitor/visitors/{id}/blacklist    # Add to blacklist
```

#### Pre-Registration
```
GET    /api/visitor/pre-register/              # List pre-registrations
POST   /api/visitor/pre-register/              # Create pre-registration
GET    /api/visitor/pre-register/{id}          # Get pre-registration
GET    /api/visitor/pre-register/{id}/qr      # Get QR code
POST   /api/visitor/pre-register/{id}/approve  # Approve/reject
POST   /api/visitor/pre-register/{id}/resend   # Resend notification
```

#### Check-In/Check-Out
```
POST   /api/visitor/check-in/                 # Check-in visitor
POST   /api/visitor/check-out/                # Check-out visitor
GET    /api/visitor/records/                  # Get visitor records
GET    /api/visitor/records/on-site/          # Get on-site visitors
```

#### Blacklist Management
```
GET    /api/visitor/blacklist/                 # List blacklist entries
POST   /api/visitor/blacklist/                 # Add to blacklist
PUT    /api/visitor/blacklist/{id}            # Update blacklist
DELETE /api/visitor/blacklist/{id}            # Remove from blacklist
```

#### Reports
```
GET    /api/visitor/reports/daily/             # Daily visitor report
GET    /api/visitor/reports/overstay/           # Overstay report
GET    /api/visitor/reports/mustering-compliance/ # Mustering compliance
```

#### QR Code (Public)
```
GET    /api/visitor/qr/{qr_code}             # Public QR code validation
```

### Response Format

```javascript
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation completed successfully",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

## Frontend Components

### Main Visitor Component

#### File: `src/pages/Visitor/Visitor.jsx`

**Features:**
- Tab navigation for all visitor functions
- Real-time statistics dashboard
- Quick actions for common tasks
- Responsive design for mobile and desktop

**Props:**
- None (uses internal state and API calls)

### Pre-Registration Component

#### File: `src/pages/Visitor/components/PreRegistration.jsx`

**Features:**
- Visitor information form with validation
- Host selection from personnel database
- QR code generation and display
- Email/SMS notification sending
- Contractor visitor workflow
- Safety induction document upload

**State Management:**
```javascript
const [formData, setFormData] = useState({
  visitorName: '',
  phone: '',
  email: '',
  company: '',
  idType: '0',
  idNo: '',
  visitorTypeId: '',
  hostEmpId: '',
  visitDate: '',
  visitTimeStart: '',
  visitTimeEnd: '',
  purpose: '',
  areaId: '',
  vehicleNo: '',
  contractorVisitor: false,
  vendorId: '',
  safetyInductionDone: false,
  inductionDoc: null
});
```

### Check-In Kiosk Component

#### File: `src/pages/Visitor/components/CheckInKiosk.jsx`

**Features:**
- Full-screen kiosk interface
- QR code scanning
- Visitor search functionality
- Walk-in registration
- Photo capture via webcam
- Digital signature pad
- Badge printing
- Auto-timeout (30 seconds)

**Modes:**
- `home`: Main selection screen
- `scan`: QR code scanning
- `search`: Visitor search
- `walk-in`: Walk-in registration
- `check-in`: Check-in confirmation

### Check-Out Kiosk Component

#### File: `src/pages/Visitor/components/CheckOutKiosk.jsx`

**Features:**
- QR code or card number input
- Visitor information display
- Card return instructions
- Check-out confirmation
- Auto-timeout

### Visitor Records Component

#### File: `src/pages/Visitor/components/VisitorRecords.jsx`

**Features:**
- Complete visitor history table
- Advanced filtering (date, host, status)
- Export functionality (Excel/PDF)
- Detailed visit information
- Mustering status display
- Badge reprint capability

### Blacklist Component

#### File: `src/pages/Visitor/components/Blacklist.jsx`

**Features:**
- Blacklist CRUD operations
- Real-time blocking during check-in
- Search and filter functionality
- Active/inactive status management
- Bulk operations support

### Host Approval Component

#### File: `src/pages/Visitor/components/HostApproval.jsx`

**Features:**
- Pending approval dashboard
- Approval/rejection workflow
- Email notifications
- Approval history
- Bulk approval capability

### Visitor Types Component

#### File: `src/pages/Visitor/components/VisitorTypes.jsx`

**Features:**
- Visitor type configuration
- Access level assignment
- Badge template management
- Safety requirements setup
- Mustering zone assignment

### Reports Component

#### File: `src/pages/Visitor/components/Reports.jsx`

**Features:**
- Daily visitor reports
- Overstay reporting
- Mustering compliance reports
- Export functionality
- Interactive charts and graphs

### Visitor Analytics Component

#### File: `src/pages/Visitor/components/VisitorAnalytics.jsx`

**Features:**
- Real-time visitor statistics
- Trend analysis
- Compliance metrics
- Security overview
- Performance indicators
- Interactive dashboards

---

## Integration Points

### Access Control Integration

#### Temporary Card Issuance
```python
# Card number generation
card_no = f"TMP{datetime.now().strftime('%Y%m%d%H%M%S')}"

# Device synchronization
await device_sync_service.sync_visitor_to_devices(visitor, card_no)
```

#### Access Level Assignment
```python
# Get access level from visitor type
access_level = visitor.visitor_type.access_level
```

### Device Integration

#### ZKTeco ADMS Protocol
```python
# User data format for ZKTeco devices
user_data = {
    'Pin': card_no,
    'Password': '',
    'Card': card_no,
    'Group': access_level.group_id,
    'StartTime': start_time,
    'EndTime': end_time,
    'Name': visitor.full_name,
    'Privilege': access_level.privilege,
    'Enabled': True
}
```

#### Real-time Synchronization
- Every 5 minutes sync for active visitors
- Immediate sync on check-in/out
- Automatic cleanup on visitor check-out

### Mustering Integration

#### Automatic Inclusion
```python
# Add visitor to mustering during active events
if mustering_event.status == 0:
    mustering_expected = MusteringExpected(
        event_id=event_id,
        visitor_id=visitor_id,
        mustering_zone_id=zone_id
    )
```

#### Status Tracking
- Real-time mustering status updates
- Automatic safe marking on check-out
- Compliance reporting

### Personnel Integration

#### Host Selection
```python
# Get available hosts from personnel database
hosts = db.query(PersonnelEmployee).filter(
    PersonnelEmployee.is_active == True
).all()
```

#### Department/Area Assignment
```python
# Link visitor to personnel departments
area = db.query(PersonnelArea).filter(
    PersonnelArea.id == area_id
).first()
```

---

## Security Features

### Blacklist Management

#### Real-time Blocking
```python
def check_blacklist(visitor_data):
    blacklist_entry = db.query(VisitorBlacklist).filter(
        VisitorBlacklist.id_no == visitor_data['id_no']
    ).first()
    
    if blacklist_entry and blacklist_entry.is_active:
        return {'blocked': True, 'reason': blacklist_entry.reason}
    
    return {'blocked': False}
```

#### Automatic Alerts
- Email notifications for blacklist hits
- Security dashboard alerts
- Audit trail logging

### Access Control

#### Temporary Access
- Time-limited access cards
- Automatic card deactivation
- Zone-based access restrictions

#### Audit Trail
- Complete visitor history
- Device access logs
- Security event tracking

---

## Mustering Integration

### Event-based Inclusion

#### Automatic Addition
```python
async def add_visitor_to_mustering(visitor_id, event_id):
    """Add visitor to active mustering event"""
    event = db.query(MusteringEvent).filter(
        MusteringEvent.id == event_id,
        MusteringEvent.status == 0
    ).first()
    
    if event:
        mustering_expected = MusteringExpected(
            event_id=event_id,
            visitor_id=visitor_id,
            expected_time=datetime.utcnow()
        )
        db.add(mustering_expected)
        db.commit()
```

### Status Tracking

#### Real-time Updates
- Visitor status changes during mustering
- Automatic safe marking on check-out
- Compliance percentage calculation

### Compliance Reporting

#### Mustering Compliance Metrics
```python
def calculate_mustering_compliance(event_id):
    total_expected = db.query(MusteringExpected).filter(
        MusteringExpected.event_id == event_id
    ).count()
    
    total_safe = db.query(MusteringLog).filter(
        MusteringLog.event_id == event_id,
        MusteringLog.status == 1
    ).count()
    
    return (total_safe / total_expected) * 100 if total_expected > 0 else 0
```

---

## Device Synchronization

### ZKTeco Device Communication

#### ADMS Protocol Implementation
```python
class ZKTecoDevice:
    def __init__(self, device_sn):
        self.device_sn = device_sn
        self.connection = None
    
    async def connect(self):
        """Connect to ZKTeco device"""
        # Implement device connection logic
        pass
    
    async def add_user(self, user_data):
        """Add user to device"""
        command = f"DATA USERINFO PIN={user_data['Pin']}"
        # Send command to device
        response = await self.send_command(command)
        return response
    
    async def delete_user(self, pin):
        """Remove user from device"""
        command = f"DATA DELETE USERINFO PIN={pin}"
        response = await self.send_command(command)
        return response
```

### Real-time Sync

#### Background Tasks
```python
@celery_app.task
def sync_visitor_to_devices(visitor_id, card_no):
    """Background task for device synchronization"""
    db = next(get_db())
    try:
        sync_service = VisitorDeviceSyncService(db)
        result = await sync_service.sync_visitor_to_devices(
            db.query(Visitor).filter(Visitor.id == visitor_id).first(),
            card_no
        )
        logger.info(f"Sync completed: {result}")
    finally:
        db.close()
```

#### Error Handling
- Retry mechanisms for failed sync
- Fallback device selection
- Comprehensive error logging

---

## Email/SMS Notifications

### Email Templates

#### Visitor Registration Confirmation
```html
<!DOCTYPE html>
<html>
<head>
    <title>Visitor Registration Confirmation</title>
</head>
<body>
    <h2>Visit Registration Confirmed</h2>
    <p>Dear {{visitor_name}},</p>
    <p>Your visit has been registered for {{visit_date}} at {{visit_time}}.</p>
    <p>Host: {{host_name}}</p>
    <p>Purpose: {{purpose}}</p>
    <div class="qr-code">
        <img src="{{qr_image}}" alt="QR Code" />
        <p>QR Code: {{qr_code}}</p>
    </div>
</body>
</html>
```

#### Host Approval Request
```html
<!DOCTYPE html>
<html>
<head>
    <title>Visitor Approval Required</title>
</head>
<body>
    <h2>Visitor Approval Required</h2>
    <p>A visitor requires your approval:</p>
    <ul>
        <li>Name: {{visitor_name}}</li>
        <li>Company: {{company}}</li>
        <li>Date: {{visit_date}}</li>
        <li>Time: {{visit_time}}</li>
        <li>Purpose: {{purpose}}</li>
    </ul>
    <div class="approval-buttons">
        <a href="{{approve_url}}">Approve</a>
        <a href="{{reject_url}}">Reject</a>
    </div>
</body>
</html>
```

### SMS Templates

#### Check-in Notification
```
Visitor {{visitor_name}} from {{company}} has checked in. Time: {{check_in_time}}. Host: {{host_name}}.
```

#### Overstay Alert
```
URGENT: Visitor {{visitor_name}} has overstayed by {{hours_overdue}} hours. Please arrange immediate check-out. Host: {{host_name}}.
```

### Notification Triggers

#### Automated Notifications
- Pre-registration confirmation
- Host approval requests
- Approval status updates
- Check-in/out notifications
- Overstay alerts
- Daily reminders

#### Customization
- Template customization per visitor type
- Multi-language support
- Brand customization options

---

## Reporting & Analytics

### Daily Reports

#### Visitor Statistics
```python
def generate_daily_report(date):
    """Generate comprehensive daily visitor report"""
    
    # Get all visits for the date
    visits = db.query(VisitorVisitLog).filter(
        func.date(VisitorVisitLog.check_in_time) == date
    ).all()
    
    # Calculate statistics
    total_visitors = len(set(v.visitor_id for v in visits))
    checked_in = len([v for v in visits if v.status == 0])
    checked_out = len([v for v in visits if v.status == 1])
    overstays = len([v for v in visits if v.status == 2])
    
    # Group by visitor type
    by_type = {}
    for visit in visits:
        type_name = visit.visitor.visitor_type.type_name
        by_type[type_name] = by_type.get(type_name, 0) + 1
    
    # Group by host
    by_host = {}
    for visit in visits:
        host_name = visit.host_employee.full_name
        by_host[host_name] = by_host.get(host_name, 0) + 1
    
    return {
        'date': date,
        'total_visitors': total_visitors,
        'checked_in': checked_in,
        'checked_out': checked_out,
        'overstays': overstays,
        'by_type': by_type,
        'by_host': by_host,
        'peak_hours': calculate_peak_hours(visits)
    }
```

### Overstay Reports

#### Automated Detection
```python
@celery_app.task
def check_overstay_visitors():
    """Check for overstayed visitors and send alerts"""
    
    # Get visitor types with default hours
    visitor_types = db.query(VisitorType).all()
    type_hours = {t.id: t.default_visit_hours for t in visitor_types}
    
    # Check active visits
    active_visits = db.query(VisitorVisitLog).join(Visitor).filter(
        VisitorVisitLog.status == 0
    ).all()
    
    overstays = []
    for visit in active_visits:
        allowed_hours = type_hours.get(visit.visitor.visitor_type_id, 8)
        time_since_checkin = datetime.utcnow() - visit.check_in_time
        hours_overdue = (time_since_checkin.total_seconds() / 3600) - allowed_hours
        
        if hours_overdue > 0:
            overstays.append({
                'visit': visit,
                'hours_overdue': hours_overdue
            })
            
            # Send alert
            send_overstay_alert(visit, hours_overdue)
    
    return overstays
```

### Analytics Dashboard

#### Real-time Metrics
```python
def get_visitor_analytics(date_range):
    """Get comprehensive visitor analytics"""
    
    # Visitor trends
    daily_visits = get_daily_visits(date_range)
    visitor_types = get_visitor_type_distribution(date_range)
    peak_hours = get_peak_hours(date_range)
    
    # Compliance metrics
    compliance_rates = calculate_compliance_metrics(date_range)
    
    # Security metrics
    security_metrics = get_security_metrics(date_range)
    
    # Performance metrics
    performance_metrics = get_performance_metrics(date_range)
    
    return {
        'trends': {
            'daily_visits': daily_visits,
            'visitor_types': visitor_types,
            'peak_hours': peak_hours
        },
        'compliance': compliance_rates,
        'security': security_metrics,
        'performance': performance_metrics
    }
```

---

## Installation & Setup

### Prerequisites

#### Backend Requirements
- Python 3.8+
- PostgreSQL 12+
- Redis 6+
- Celery
- FastAPI

#### Frontend Requirements
- Node.js 16+
- React 18+
- Modern web browser

### Database Setup

#### Run Migration
```bash
cd database
python add_visitor_tables.py
```

#### Verify Tables
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'vis_%';
```

### Backend Setup

#### Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost/pob_visitor

# Redis
REDIS_URL=redis://localhost:6379/0

# Email
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

#### Start Services
```bash
# Start backend
uvicorn app.main:app --host 0.0.0.0 --port 8001

# Start Celery worker
celery -A app.tasks worker --loglevel=info

# Start Celery beat
celery -A app.tasks beat --loglevel=info
```

### Frontend Setup

#### Install Dependencies
```bash
cd frontend-react
npm install
```

#### Environment Variables
```bash
# API URL
REACT_APP_API_URL=http://localhost:8001

# WebSocket URL
REACT_APP_WS_URL=ws://localhost:8001
```

#### Start Development Server
```bash
npm start
```

### Production Deployment

#### Backend Production
```bash
# Use production server
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8001

# Use production process manager
systemctl start pob-visitor-backend
```

#### Frontend Production
```bash
# Build for production
npm run build

# Serve with nginx or apache
# Configure nginx to serve static files
```

---

## Troubleshooting

### Common Issues

#### Database Connection Errors
```
Error: could not connect to database
Solution: Check DATABASE_URL and PostgreSQL service status
```

#### QR Code Not Displaying
```
Error: QR code image not loading
Solution: Check QR service configuration and image permissions
```

#### Device Sync Failures
```
Error: Device synchronization failed
Solution: Check network connectivity and device status
```

#### Email Not Sending
```
Error: Email notification failed
Solution: Verify SMTP settings and firewall rules
```

### Debug Mode

#### Enable Debug Logging
```python
# In backend settings
LOG_LEVEL = DEBUG

# Enable detailed logging
logging.basicConfig(level=logging.DEBUG)
```

#### Frontend Debug
```javascript
// Enable React DevTools
if (process.env.NODE_ENV === 'development') {
  const { ReactQueryDevtools } = require('react-query/devtools');
  // DevTools setup
}
```

### Performance Optimization

#### Database Indexes
```sql
-- Add missing indexes for performance
CREATE INDEX CONCURRENTLY idx_vis_visitor_created ON vis_visitor(created_time);
CREATE INDEX CONCURRENTLY idx_vis_visit_log_visitor_date ON vis_visit_log(visitor_id, check_in_time);
```

#### Caching Strategy
```python
# Redis caching for frequently accessed data
@cache.memoize(timeout=300)
def get_visitor_types():
    return db.query(VisitorType).filter(VisitorType.is_active == True).all()
```

### Monitoring

#### Health Checks
```bash
# Backend health
curl http://localhost:8001/health

# Database health
python -c "from app.core.database import test_db_connection; test_db_connection()"
```

#### Log Analysis
```bash
# Monitor application logs
tail -f logs/visitor-backend.log

# Monitor error logs
grep ERROR logs/visitor-backend.log
```

---

## Support & Maintenance

### Regular Maintenance Tasks

#### Daily
- Review visitor check-ins for anomalies
- Process overstay alerts
- Backup visitor data

#### Weekly
- Review blacklist updates
- Analyze visitor trends
- Update security settings

#### Monthly
- Database performance optimization
- Review and update templates
- Security audit
- System performance review

### Backup Strategy

#### Database Backups
```bash
# Daily backup
pg_dump -h localhost -U postgres pob_visitor > backup_$(date +%Y%m%d).sql

# Automated backup script
0 2 * * * /path/to/backup_script.sh
```

#### Configuration Backups
```bash
# Backup configuration files
tar -czf config_backup_$(date +%Y%m%d).tar.gz config/
```

### Security Considerations

#### Regular Updates
- Keep dependencies updated
- Apply security patches
- Review access logs
- Update blacklist entries

#### Access Control
- Regular password rotation
- Two-factor authentication
- Role-based access control
- Audit trail maintenance

---

## API Reference

### Complete API Documentation

For detailed API documentation with examples, visit:
```
http://localhost:8001/docs
```

### Interactive API Testing

For interactive API testing, use:
```
http://localhost:8001/redoc
```

---

## Conclusion

The Visitor Management System provides a comprehensive solution for managing visitors in oil and gas operations with BioTime 9.5 compatibility and POB extensions. The system ensures security, compliance, and operational efficiency through real-time monitoring, automated workflows, and comprehensive reporting.

For additional support or questions, please refer to the troubleshooting section or contact the development team.
