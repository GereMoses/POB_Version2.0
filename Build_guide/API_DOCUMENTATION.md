# POB System API Documentation

## Overview

The POB (Personnel On Board) System API provides RESTful endpoints for managing personnel, authentication, and system operations. This documentation covers the current implementation and ZKTeco BioTime standards for future integration.

## Base URL

```
Development: http://localhost:8001/api/v1
Production: https://your-domain.com/api/v1
```

## Authentication

All API endpoints (except login) require Bearer token authentication:

```http
Authorization: Bearer <your_jwt_token>
```

## Current API Endpoints

### Authentication

#### Login
```http
POST /api/v1/login
Content-Type: application/x-www-form-urlencoded

username=admin&password=admin123
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": 2,
    "username": "admin",
    "email": "admin@pob.com",
    "is_superuser": true
  }
}
```

### Personnel Management

#### Get Personnel List
```http
GET /api/v1/?skip=0&limit=20&sort_by=full_name&sort_order=asc
```

**Query Parameters:**
- `skip` (integer): Number of records to skip (default: 0)
- `limit` (integer): Number of records to return (default: 100, max: 1000)
- `sort_by` (string): Field to sort by (default: created_at)
- `sort_order` (string): Sort order 'asc' or 'desc' (default: desc)

**Response:**
```json
[
  {
    "id": 1,
    "badge_id": "EMP001",
    "full_name": "John Doe",
    "email": "john.doe@company.com",
    "phone": "+1234567890",
    "company": "Oil Corp",
    "department": "Operations",
    "role": "Engineer",
    "position": "Senior Engineer",
    "status": "active",
    "current_location": "Offshore Platform A",
    "current_zone": "Zone 1",
    "is_onboard": true,
    "created_at": "2024-04-27T10:00:00Z"
  }
]
```

#### Create Personnel
```http
POST /api/v1/
Content-Type: application/json

{
  "badge_id": "EMP002",
  "full_name": "Jane Smith",
  "email": "jane.smith@company.com",
  "phone": "+1234567891",
  "company": "Oil Corp",
  "department": "Safety",
  "role": "Safety Officer",
  "position": "Senior Safety Officer"
}
```

**Response:**
```json
{
  "id": 2,
  "badge_id": "EMP002",
  "full_name": "Jane Smith",
  "email": "jane.smith@company.com",
  "phone": "+1234567891",
  "company": "Oil Corp",
  "department": "Safety",
  "role": "Safety Officer",
  "position": "Senior Safety Officer",
  "status": "active",
  "current_location": null,
  "current_zone": null,
  "is_onboard": false,
  "created_at": "2024-04-27T10:30:00Z"
}
```

#### Get Personnel Dashboard
```http
GET /api/v1/dashboard
```

**Response:**
```json
{
  "total_personnel": 150,
  "by_status": {
    "active": 120,
    "inactive": 20,
    "on_leave": 10
  },
  "by_company": {
    "Oil Corp": 80,
    "Service Co": 50,
    "Consulting Ltd": 20
  },
  "recent_personnel": [
    {
      "full_name": "John Doe",
      "badge_id": "EMP001",
      "company": "Oil Corp",
      "created_at": "2024-04-27T10:00:00Z"
    }
  ]
}
```

### System

#### Health Check
```http
GET /api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "version": "2.0.0",
  "environment": "development"
}
```

#### API Documentation
```http
GET /api/v1/docs
```

Interactive API documentation (Swagger UI).

## Error Responses

All endpoints return consistent error responses:

### 401 Unauthorized
```json
{
  "detail": "Could not validate credentials",
  "type": "authentication_error"
}
```

### 404 Not Found
```json
{
  "detail": "Resource not found",
  "type": "not_found_error"
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "badge_id"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error occurred",
  "type": "server_error"
}
```

## ZKTeco BioTime Integration Standards

### Recommended API Structure

For ZKTeco BioTime compatibility, the following structure is recommended:

```
/api/
├── auth/
│   ├── login               # User authentication
│   ├── logout              # User logout
│   └── refresh             # Token refresh
├── personnel/
│   ├── users               # User CRUD operations
│   ├── departments         # Department management
│   └── roles               # Role management
├── attendance/
│   ├── records             # Attendance logs
│   ├── reports             # Attendance reports
│   └── statistics          # Attendance statistics
├── devices/
│   ├── terminals           # Biometric terminals
│   ├── sync                # Device synchronization
│   └── status              # Device status monitoring
└── system/
    ├── settings            # System configuration
    └── logs                # System logs
```

### ZKTeco Standard Endpoints

#### Device Management
```http
GET /api/devices/terminals
POST /api/devices/terminals/{id}/sync
GET /api/devices/terminals/{id}/status
```

#### Attendance Management
```http
GET /api/attendance/records?date=2024-04-27&user_id=123
POST /api/attendance/upload
GET /api/attendance/reports/summary
```

#### Personnel Management (ZKTeco Standard)
```http
GET /api/personnel/users?limit=20&offset=0
POST /api/personnel/users
PUT /api/personnel/users/{id}
DELETE /api/personnel/users/{id}
```

## Environment Variables

### Backend Configuration
```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/pob_system
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=pob_system
DATABASE_USER=pob_user
DATABASE_PASSWORD=pob_password

# JWT Configuration
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=30
ALGORITHM=HS256

# CORS Configuration
CORS_ORIGINS=["http://localhost:3000", "http://localhost:8080"]

# Redis Configuration
REDIS_URL=redis://localhost:6379/0
```

### Frontend Configuration
```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001

# Environment
NODE_ENV=development
```

## Rate Limiting

- Authentication endpoints: 5 requests per minute
- Personnel endpoints: 100 requests per minute
- System endpoints: 60 requests per minute

## Data Models

### Personnel Model
```json
{
  "id": "integer",
  "badge_id": "string (unique)",
  "full_name": "string (required)",
  "email": "string (unique, optional)",
  "phone": "string (optional)",
  "company": "string (required)",
  "department": "string (optional)",
  "role": "string (required)",
  "position": "string (optional)",
  "status": "enum (active, inactive, on_leave, transit, offshore, onshore)",
  "current_location": "string (optional)",
  "current_zone": "string (optional)",
  "is_onboard": "boolean",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### User Model (Authentication)
```json
{
  "id": "integer",
  "username": "string (unique)",
  "email": "string (unique)",
  "hashed_password": "string",
  "full_name": "string",
  "is_active": "boolean",
  "is_superuser": "boolean",
  "is_verified": "boolean",
  "created_at": "datetime",
  "last_login": "datetime"
}
```

## Testing

### Example cURL Commands

#### Login
```bash
curl -X POST "http://localhost:8001/api/v1/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123"
```

#### Get Personnel
```bash
curl -X GET "http://localhost:8001/api/v1/" \
  -H "Authorization: Bearer <token>"
```

#### Create Personnel
```bash
curl -X POST "http://localhost:8001/api/v1/" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "badge_id": "EMP003",
    "full_name": "Test User",
    "company": "Test Corp",
    "role": "Tester"
  }'
```

## WebSocket Connections

For real-time updates:
```javascript
const ws = new WebSocket('ws://localhost:8001/ws');
ws.onmessage = function(event) {
  console.log('Real-time update:', event.data);
};
```

## API Versioning

- Current version: v1
- Version in URL: `/api/v1/`
- Backward compatibility maintained for minor versions
- Breaking changes require major version increment

## Security Considerations

1. **Authentication**: JWT tokens with expiration
2. **Authorization**: Role-based access control
3. **CORS**: Configured for allowed origins
4. **Input Validation**: All inputs validated and sanitized
5. **SQL Injection**: Parameterized queries used throughout
6. **Rate Limiting**: Implemented to prevent abuse

## Monitoring and Logging

- Request/response logging
- Error tracking and reporting
- Performance metrics collection
- Database query monitoring

## Development Setup

1. Clone repository
2. Install dependencies: `npm install` (frontend), `pip install -r requirements.txt` (backend)
3. Start database: `docker-compose up -d postgres redis`
4. Start backend: `cd backend && python -m uvicorn app.main:app --reload`
5. Start frontend: `cd frontend && npm run dev`
6. Access API docs: `http://localhost:8001/api/v1/docs`

## Production Deployment

1. Environment variables configured
2. Database migrations applied
3. SSL/TLS certificates installed
4. Load balancer configured
5. Monitoring and logging enabled
6. Backup procedures in place

## Support

For API support and questions:
- Check API documentation at `/api/v1/docs`
- Review error messages for troubleshooting
- Check system status at `/api/v1/health`
- Review logs for detailed error information

## Future Enhancements

### Planned Endpoints
- Device management (`/api/v1/devices/*`)
- Attendance tracking (`/api/v1/attendance/*`)
- Report generation (`/api/v1/reports/*`)
- File upload/download (`/api/v1/files/*`)
- Notifications (`/api/v1/notifications/*`)

### ZKTeco Integration
- Biometric device synchronization
- Real-time attendance processing
- Advanced reporting features
- Mobile app API endpoints

---

*Last Updated: April 27, 2026*
*Version: 2.0.0*
