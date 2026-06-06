# POB System API Quick Reference

## Base URL
```
Development: http://localhost:8001/api/v1
```

## Authentication Token
```bash
# Get token
curl -X POST "http://localhost:8001/api/v1/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123"

# Use token in requests
curl -X GET "http://localhost:8001/api/v1/" \
  -H "Authorization: Bearer <token>"
```

## Personnel Endpoints

### Get All Personnel
```bash
curl -X GET "http://localhost:8001/api/v1/" \
  -H "Authorization: Bearer <token>"
```

### Get Personnel with Pagination
```bash
curl -X GET "http://localhost:8001/api/v1/?skip=0&limit=10" \
  -H "Authorization: Bearer <token>"
```

### Create Personnel
```bash
curl -X POST "http://localhost:8001/api/v1/" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "badge_id": "EMP001",
    "full_name": "John Doe",
    "company": "Oil Corp",
    "role": "Engineer"
  }'
```

### Get Dashboard Stats
```bash
curl -X GET "http://localhost:8001/api/v1/dashboard" \
  -H "Authorization: Bearer <token>"
```

## System Endpoints

### Health Check
```bash
curl -X GET "http://localhost:8001/api/v1/health"
```

### API Documentation
```bash
curl -X GET "http://localhost:8001/api/v1/docs"
```

## Response Formats

### Success Response
```json
{
  "id": 1,
  "badge_id": "EMP001",
  "full_name": "John Doe",
  "company": "Oil Corp",
  "role": "Engineer",
  "status": "active"
}
```

### Error Response
```json
{
  "detail": "Error message here",
  "type": "error_type"
}
```

## Common Headers
```bash
# Authentication
Authorization: Bearer <token>

# Content Types
Content-Type: application/json
Content-Type: application/x-www-form-urlencoded
```

## Query Parameters
```bash
# Pagination
?skip=0&limit=20

# Sorting
?sort_by=full_name&sort_order=asc

# Filtering
?status=active&company=Oil Corp
```

## HTTP Status Codes
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 422: Validation Error
- 500: Internal Server Error

## Frontend Integration

### JavaScript Example
```javascript
// Login
const login = async (credentials) => {
  const params = new URLSearchParams();
  params.append('username', credentials.username);
  params.append('password', credentials.password);
  
  const response = await fetch('/api/v1/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });
  
  const { access_token } = await response.json();
  localStorage.setItem('token', access_token);
  return access_token;
};

// Get Personnel
const getPersonnel = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/v1/', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return await response.json();
};
```

### Axios Example
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8001/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth interceptor
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Usage
const getPersonnel = async () => {
  const response = await api.get('/');
  return response.data;
};
```

## Environment Setup

### Backend (.env)
```bash
DATABASE_URL=postgresql://pob_user:pob_password@localhost:5432/pob_system
SECRET_KEY=your-secret-key
DEBUG=True
CORS_ORIGINS=["http://localhost:3000"]
```

### Frontend (.env)
```bash
VITE_API_BASE_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001
```

## Testing Commands

### Health Check
```bash
curl http://localhost:8001/api/v1/health
```

### Login Test
```bash
curl -X POST "http://localhost:8001/api/v1/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123"
```

### Personnel Test
```bash
# Get token first
TOKEN=$(curl -s -X POST "http://localhost:8001/api/v1/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123" | \
  grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

# Use token
curl -X GET "http://localhost:8001/api/v1/" \
  -H "Authorization: Bearer $TOKEN"
```

## Data Models

### Personnel Create
```json
{
  "badge_id": "string (required)",
  "full_name": "string (required)",
  "email": "string (optional)",
  "phone": "string (optional)",
  "company": "string (required)",
  "department": "string (optional)",
  "role": "string (required)",
  "position": "string (optional)"
}
```

### Personnel Response
```json
{
  "id": "integer",
  "badge_id": "string",
  "full_name": "string",
  "email": "string",
  "phone": "string",
  "company": "string",
  "department": "string",
  "role": "string",
  "position": "string",
  "status": "string",
  "current_location": "string",
  "current_zone": "string",
  "is_onboard": "boolean",
  "created_at": "string"
}
```

## Error Handling

### Common Errors
1. **401 Unauthorized**: Token missing or invalid
2. **404 Not Found**: Endpoint doesn't exist
3. **422 Validation Error**: Invalid input data
4. **500 Server Error**: Internal server problem

### Error Response Format
```json
{
  "detail": "Detailed error message",
  "type": "error_type"
}
```

## Rate Limits
- Auth: 5 requests/minute
- Personnel: 100 requests/minute
- System: 60 requests/minute

## WebSocket
```javascript
const ws = new WebSocket('ws://localhost:8001/ws');
ws.onmessage = (event) => {
  console.log('Real-time update:', event.data);
};
```

---

*Quick Reference for POB System API v1.0*
