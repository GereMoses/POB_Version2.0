# ZKTeco BioTime Integration Guide

## Overview

This guide explains how to integrate ZKTeco BioTime devices and APIs with the POB System for comprehensive personnel and attendance management.

## ZKTeco BioTime API Standards

### Base URL Structure
```
https://biotime-server:port/api/
```

### Authentication Methods
1. **API Key Authentication**: For server-to-server communication
2. **OAuth 2.0**: For user authentication
3. **JWT Tokens**: For session management

### Standard Endpoints

#### Authentication
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password",
  "client_id": "your_client_id",
  "client_secret": "your_client_secret"
}
```

#### Device Management
```http
GET /api/devices/terminals
GET /api/devices/terminals/{serial_number}
POST /api/devices/terminals/{serial_number}/sync
GET /api/devices/terminals/{serial_number}/status
```

#### Personnel Management
```http
GET /api/personnel/users
POST /api/personnel/users
PUT /api/personnel/users/{user_id}
DELETE /api/personnel/users/{user_id}
GET /api/personnel/departments
GET /api/personnel/roles
```

#### Attendance Management
```http
GET /api/attendance/records
POST /api/attendance/upload
GET /api/attendance/reports/daily
GET /api/attendance/reports/monthly
GET /api/attendance/statistics
```

## Integration Architecture

### System Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   POB System    │    │  ZKTeco BioTime │    │  ZKTeco Devices │
│   (Backend)     │◄──►│    (Server)     │◄──►│   (Terminals)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Flow
1. **Device → BioTime**: Biometric data capture
2. **BioTime → POB**: API synchronization
3. **POB → Frontend**: Real-time updates
4. **Frontend → POB**: User interactions
5. **POB → BioTime**: Configuration commands

## Implementation Steps

### 1. ZKTeco Device Setup

#### Device Configuration
```bash
# Terminal IP Configuration
IP Address: 192.168.1.100
Subnet Mask: 255.255.255.0
Gateway: 192.168.1.1
DNS: 192.168.1.1

# BioTime Server Configuration
Server IP: your-server-ip
Port: 8080
Communication: TCP/IP
```

#### Device Registration
```http
POST /api/devices/register
{
  "serial_number": "ZK123456789",
  "device_name": "Main Entrance",
  "location": "Building A",
  "device_type": "biometric_terminal"
}
```

### 2. API Integration

#### Connection Setup
```python
# ZKTeco API Client
import requests
import json

class ZKTecoAPI:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.api_key = api_key
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
    def get_devices(self):
        response = requests.get(
            f'{self.base_url}/api/devices/terminals',
            headers=self.headers
        )
        return response.json()
    
    def sync_device(self, serial_number):
        response = requests.post(
            f'{self.base_url}/api/devices/terminals/{serial_number}/sync',
            headers=self.headers
        )
        return response.json()
```

#### Authentication Integration
```python
# POB System Integration
class POBSystemIntegration:
    def __init__(self, zkteco_api):
        self.zkteco_api = zkteco_api
        self.pob_api = "http://localhost:8001/api/v1"
    
    def sync_personnel_from_zkteco(self):
        """Sync personnel data from ZKTeco to POB"""
        zkteco_users = self.zkteco_api.get_personnel()
        
        for user in zkteco_users['users']:
            # Map ZKTeco user to POB personnel
            personnel_data = {
                'badge_id': user['employee_id'],
                'full_name': f"{user['first_name']} {user['last_name']}",
                'email': user.get('email'),
                'phone': user.get('phone'),
                'company': user.get('department', 'Unknown'),
                'role': user.get('position', 'Employee'),
                'department': user.get('department')
            }
            
            # Create or update in POB system
            self.create_or_update_personnel(personnel_data)
    
    def sync_attendance_from_zkteco(self, date):
        """Sync attendance data from ZKTeco to POB"""
        attendance_data = self.zkteco_api.get_attendance(date=date)
        
        for record in attendance_data['records']:
            # Process attendance record
            attendance_record = {
                'badge_id': record['employee_id'],
                'timestamp': record['punch_time'],
                'device': record['device_name'],
                'type': record['punch_type']  # IN/OUT
            }
            
            # Store in POB system
            self.store_attendance_record(attendance_record)
```

### 3. Database Schema Extensions

#### ZKTeco Integration Tables
```sql
-- Device Management
CREATE TABLE zkteco_devices (
    id SERIAL PRIMARY KEY,
    serial_number VARCHAR(50) UNIQUE NOT NULL,
    device_name VARCHAR(100),
    device_type VARCHAR(50),
    location VARCHAR(100),
    ip_address INET,
    status VARCHAR(20) DEFAULT 'active',
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Attendance Records
CREATE TABLE attendance_records (
    id SERIAL PRIMARY KEY,
    badge_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    device_serial VARCHAR(50),
    punch_type VARCHAR(10),  -- IN/OUT
    verification_method VARCHAR(20), -- fingerprint, face, card
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (badge_id) REFERENCES personnel(badge_id)
);

-- Sync Logs
CREATE TABLE sync_logs (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(50),  -- personnel, attendance, devices
    source VARCHAR(50),      -- zkteco, manual, import
    status VARCHAR(20),      -- success, failed, partial
    records_processed INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    sync_started TIMESTAMP,
    sync_completed TIMESTAMP
);
```

### 4. Real-time Synchronization

#### WebSocket Integration
```python
# Real-time sync service
class SyncService:
    def __init__(self):
        self.zkteco_api = ZKTecoAPI(zkteco_url, zkteco_key)
        self.sync_interval = 300  # 5 minutes
    
    def start_sync_scheduler(self):
        """Start periodic synchronization"""
        import threading
        import time
        
        def sync_worker():
            while True:
                try:
                    self.sync_all_data()
                    time.sleep(self.sync_interval)
                except Exception as e:
                    print(f"Sync error: {e}")
                    time.sleep(60)  # Wait 1 minute on error
        
        sync_thread = threading.Thread(target=sync_worker, daemon=True)
        sync_thread.start()
    
    def sync_all_data(self):
        """Sync all data from ZKTeco"""
        # Sync devices
        self.sync_devices()
        
        # Sync personnel
        self.sync_personnel()
        
        # Sync attendance
        self.sync_attendance()
        
        # Log sync completion
        self.log_sync_completion()
```

#### Event-driven Updates
```python
# Event handlers for real-time updates
class EventHandler:
    def __init__(self):
        self.event_handlers = {
            'device_connected': self.handle_device_connected,
            'device_disconnected': self.handle_device_disconnected,
            'attendance_captured': self.handle_attendance_captured,
            'user_enrolled': self.handle_user_enrolled
        }
    
    def handle_attendance_captured(self, event_data):
        """Handle real-time attendance capture"""
        # Process attendance record
        attendance_record = {
            'badge_id': event_data['employee_id'],
            'timestamp': event_data['timestamp'],
            'device': event_data['device_name'],
            'type': event_data['punch_type']
        }
        
        # Store in database
        self.store_attendance_record(attendance_record)
        
        # Send real-time notification
        self.send_websocket_notification({
            'type': 'attendance',
            'data': attendance_record
        })
    
    def send_websocket_notification(self, notification):
        """Send real-time notification via WebSocket"""
        # Implementation depends on your WebSocket setup
        pass
```

## API Endpoint Mapping

### ZKTeco → POB Mapping

| ZKTeco Endpoint | POB Endpoint | Description |
|----------------|-------------|-------------|
| `/api/personnel/users` | `/api/v1/personnel` | User data sync |
| `/api/attendance/records` | `/api/v1/attendance` | Attendance sync |
| `/api/devices/terminals` | `/api/v1/devices` | Device management |
| `/api/reports/summary` | `/api/v1/reports` | Report generation |

### Data Field Mapping

| ZKTeco Field | POB Field | Transformation |
|---------------|-----------|----------------|
| `employee_id` | `badge_id` | Direct mapping |
| `first_name` + `last_name` | `full_name` | Concatenation |
| `department` | `department` | Direct mapping |
| `position` | `role` | Direct mapping |
| `punch_time` | `timestamp` | Direct mapping |
| `device_name` | `device` | Direct mapping |
| `punch_type` | `type` | Direct mapping |

## Configuration

### Environment Variables
```bash
# ZKTeco BioTime Configuration
ZKTECO_API_URL=https://your-biotime-server:8080/api
ZKTECO_API_KEY=your_api_key_here
ZKTECO_SYNC_INTERVAL=300
ZKTECO_AUTO_SYNC=true

# POB System Configuration
POB_API_URL=http://localhost:8001/api/v1
POB_WS_URL=ws://localhost:8001/ws
```

### Configuration File
```yaml
# zkteco_config.yaml
zkteco:
  api_url: "https://biotime-server:8080/api"
  api_key: "${ZKTECO_API_KEY}"
  sync_interval: 300
  auto_sync: true
  retry_attempts: 3
  timeout: 30

  devices:
    - serial_number: "ZK123456789"
      name: "Main Entrance"
      location: "Building A"
      sync_enabled: true
    
  sync:
    personnel:
      enabled: true
      schedule: "0 2 * * *"  # Daily at 2 AM
    attendance:
      enabled: true
      schedule: "*/5 * * * *"  # Every 5 minutes
    devices:
      enabled: true
      schedule: "*/10 * * * *"  # Every 10 minutes
```

## Testing and Validation

### Unit Tests
```python
import unittest
from zkteco_integration import ZKTecoAPI

class TestZKTecoIntegration(unittest.TestCase):
    def setUp(self):
        self.api = ZKTecoAPI("http://test-server:8080/api", "test-key")
    
    def test_get_devices(self):
        devices = self.api.get_devices()
        self.assertIsInstance(devices, dict)
        self.assertIn('devices', devices)
    
    def test_sync_device(self):
        result = self.api.sync_device("ZK123456789")
        self.assertEqual(result['status'], 'success')
    
    def test_get_personnel(self):
        personnel = self.api.get_personnel()
        self.assertIsInstance(personnel, dict)
        self.assertIn('users', personnel)
```

### Integration Tests
```python
def test_end_to_end_sync():
    """Test complete synchronization workflow"""
    # 1. Get devices from ZKTeco
    devices = zkteco_api.get_devices()
    assert len(devices['devices']) > 0
    
    # 2. Sync personnel data
    sync_result = sync_service.sync_personnel()
    assert sync_result['status'] == 'success'
    
    # 3. Verify data in POB system
    personnel = pob_api.get_personnel()
    assert len(personnel) > 0
    
    # 4. Test attendance sync
    attendance = zkteco_api.get_attendance(date="2024-04-27")
    sync_result = sync_service.sync_attendance(attendance)
    assert sync_result['status'] == 'success'
```

## Monitoring and Logging

### Sync Metrics
```python
class SyncMetrics:
    def __init__(self):
        self.metrics = {
            'sync_count': 0,
            'success_count': 0,
            'failed_count': 0,
            'last_sync': None,
            'avg_sync_time': 0
        }
    
    def record_sync(self, success, duration):
        self.metrics['sync_count'] += 1
        if success:
            self.metrics['success_count'] += 1
        else:
            self.metrics['failed_count'] += 1
        
        self.metrics['last_sync'] = datetime.now()
        
        # Update average sync time
        total_time = self.metrics['avg_sync_time'] * (self.metrics['sync_count'] - 1) + duration
        self.metrics['avg_sync_time'] = total_time / self.metrics['sync_count']
    
    def get_health_status(self):
        success_rate = self.metrics['success_count'] / self.metrics['sync_count'] * 100
        return {
            'status': 'healthy' if success_rate > 95 else 'degraded',
            'success_rate': success_rate,
            'last_sync': self.metrics['last_sync'],
            'avg_sync_time': self.metrics['avg_sync_time']
        }
```

### Error Handling
```python
class SyncErrorHandler:
    def __init__(self):
        self.error_handlers = {
            'connection_error': self.handle_connection_error,
            'authentication_error': self.handle_authentication_error,
            'data_error': self.handle_data_error,
            'rate_limit_error': self.handle_rate_limit_error
        }
    
    def handle_sync_error(self, error, context):
        error_type = self.classify_error(error)
        
        if error_type in self.error_handlers:
            return self.error_handlers[error_type](error, context)
        else:
            return self.handle_unknown_error(error, context)
    
    def handle_connection_error(self, error, context):
        """Handle connection errors"""
        # Implement retry logic
        return {
            'action': 'retry',
            'retry_after': 60,
            'max_retries': 3
        }
```

## Security Considerations

### API Security
1. **API Key Management**: Secure storage and rotation
2. **Data Encryption**: Encrypt sensitive data in transit
3. **Access Control**: Role-based permissions
4. **Audit Logging**: Log all API interactions
5. **Rate Limiting**: Prevent API abuse

### Data Privacy
1. **Data Minimization**: Only sync necessary data
2. **Consent Management**: User consent for data processing
3. **Data Retention**: Define retention policies
4. **Anonymization**: Anonymize sensitive data when possible

## Troubleshooting

### Common Issues

#### Connection Problems
```bash
# Test ZKTeco server connectivity
curl -I https://your-biotime-server:8080/api/health

# Check API key validity
curl -H "Authorization: Bearer your-api-key" \
     https://your-biotime-server:8080/api/personnel/users
```

#### Sync Failures
```bash
# Check sync logs
tail -f /var/log/pob/sync.log

# Check device status
curl -H "Authorization: Bearer your-api-key" \
     https://your-biotime-server:8080/api/devices/terminals/ZK123456789/status
```

#### Data Mapping Issues
```python
# Debug data mapping
def debug_data_mapping(zkteco_data):
    print("ZKTeco Data:", zkteco_data)
    mapped_data = map_zkteco_to_pob(zkteco_data)
    print("Mapped Data:", mapped_data)
    return mapped_data
```

## Performance Optimization

### Sync Optimization
1. **Batch Processing**: Process records in batches
2. **Parallel Processing**: Use multiple threads for large datasets
3. **Incremental Sync**: Only sync changed data
4. **Caching**: Cache frequently accessed data
5. **Compression**: Compress large datasets

### Database Optimization
```sql
-- Indexes for performance
CREATE INDEX idx_attendance_timestamp ON attendance_records(timestamp);
CREATE INDEX idx_attendance_badge_id ON attendance_records(badge_id);
CREATE INDEX idx_personnel_badge_id ON personnel(badge_id);

-- Partitioning for large tables
CREATE TABLE attendance_records_2024 PARTITION OF attendance_records
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

## Future Enhancements

### Planned Features
1. **Mobile App API**: Native mobile application support
2. **Advanced Analytics**: Machine learning insights
3. **Multi-tenant Support**: Multiple organization support
4. **Advanced Reporting**: Custom report generation
5. **IoT Integration**: Additional device support

### Scalability Considerations
1. **Microservices Architecture**: Split into smaller services
2. **Load Balancing**: Distribute API load
3. **Database Sharding**: Partition large datasets
4. **Caching Layer**: Redis implementation
5. **Message Queue**: Asynchronous processing

---

*ZKTeco BioTime Integration Guide v1.0*
