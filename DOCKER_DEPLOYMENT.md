# POB System Docker Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- At least 8GB RAM available
- 10GB free disk space
- Windows 10/11, macOS, or Linux

### One-Click Deployment

#### Windows Users:
```bash
# Run the deployment script
deploy-docker.bat
```

#### Linux/macOS Users:
```bash
# Make the script executable
chmod +x deploy-docker.sh

# Run the deployment script
./deploy-docker.sh
```

## 📋 System Components

### Services Deployed
1. **PostgreSQL Database** (Port 5432)
   - Optimized for production
   - Connection pooling enabled
   - Performance tuned for POB operations

2. **Redis Cache** (Port 6379)
   - Session storage
   - Real-time notifications
   - API response caching

3. **Backend API** (Port 8001)
   - FastAPI application
   - Enhanced authentication
   - Custom report builder
   - WebSocket support

4. **Frontend** (Port 3000)
   - React application
   - Advanced header system
   - Real-time notifications
   - Responsive design

## 🌐 Access URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Main application |
| Backend API | http://localhost:8001 | API endpoints |
| API Docs | http://localhost:8001/docs | Swagger documentation |
| Database | localhost:5432 | PostgreSQL connection |
| Redis | localhost:6379 | Redis connection |

## 🔐 Default Credentials

```
Username: admin
Password: admin123
```

## 📊 Features Available

### ✅ **Enhanced Authentication System**
- Professional login interface
- JWT token management
- Role-based access control
- Session management
- Password security

### ✅ **Advanced Header System**
- Real-time notifications
- Global search (Ctrl+K)
- System statistics
- User profile management
- Theme switching

### ✅ **Custom Report Builder**
- Drag-and-drop interface
- Dynamic SQL generation
- Real-time preview
- Save/load reports
- Export functionality

### ✅ **Core POB Features**
- Personnel management
- Attendance tracking
- Mustering system
- Emergency management
- Report generation
- ZKTeco integration

## 🛠️ Management Commands

### Docker Compose Commands
```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f [service_name]

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart [service_name]

# Rebuild images
docker-compose build --no-cache

# Clean up resources
docker system prune -f
```

### Service-Specific Commands
```bash
# Backend logs
docker-compose logs -f backend

# Frontend logs
docker-compose logs -f frontend

# Database logs
docker-compose logs -f postgres

# Redis logs
docker-compose logs -f redis
```

## 📁 Configuration Files

### Environment Variables (.env)
```bash
# Database
DATABASE_URL=postgresql://pob_user:pob_password@postgres:5432/pob_system

# Redis
REDIS_URL=redis://redis:6379/0

# Backend
DEBUG=True
SECRET_KEY=your-secret-key-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Frontend
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000/ws
VITE_ENABLE_NOTIFICATIONS=true
VITE_ENABLE_DARK_MODE=true

# Email (for reports)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Database Configuration (database/postgresql.conf)
- Optimized for production use
- Connection pooling enabled
- Memory settings tuned
- Performance optimizations

### Nginx Configuration (nginx/nginx.conf)
- Static file serving
- API proxy
- WebSocket support
- Security headers
- Gzip compression

## 🔍 Troubleshooting

### Common Issues

#### 1. Frontend Not Loading
**Problem**: Browser shows connection refused
**Solution**:
```bash
# Check frontend logs
docker-compose logs frontend

# Restart frontend service
docker-compose restart frontend

# Check nginx configuration
docker exec pob_frontend cat /etc/nginx/nginx.conf
```

#### 2. API Not Responding
**Problem**: 504 Gateway Timeout
**Solution**:
```bash
# Check backend logs
docker-compose logs backend

# Restart backend service
docker-compose restart backend

# Check database connection
docker exec pob_backend python -c "from app.core.database import get_db; print('DB OK')"
```

#### 3. Database Connection Issues
**Problem**: Connection refused or timeout
**Solution**:
```bash
# Check database logs
docker-compose logs postgres

# Test database connection
docker exec pob_postgres pg_isready -U pob_user -d pob_system

# Restart database service
docker-compose restart postgres
```

#### 4. Redis Connection Issues
**Problem**: Cache not working
**Solution**:
```bash
# Check Redis logs
docker-compose logs redis

# Test Redis connection
docker exec pob_redis redis-cli ping

# Restart Redis service
docker-compose restart redis
```

#### 5. WebSocket Not Working
**Problem**: Real-time notifications not updating
**Solution**:
```bash
# Check WebSocket configuration
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Key: test" \
     -H "Sec-WebSocket-Version: 13" \
     http://localhost:3000/ws/notifications

# Check nginx WebSocket support
docker exec pob_frontend grep -i websocket /etc/nginx/nginx.conf
```

### Performance Optimization

#### Database Optimization
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE n_distinct > 1;
```

#### Application Optimization
```bash
# Monitor resource usage
docker stats

# Check memory usage
docker exec pob_backend free -h

# Monitor logs for errors
docker-compose logs -f | grep ERROR
```

## 🔒 Security Considerations

### Production Deployment
1. **Change Default Credentials**
   ```bash
   # Update .env file
   POSTGRES_PASSWORD=your-secure-password
   SECRET_KEY=your-secure-secret-key
   ```

2. **Enable HTTPS**
   ```bash
   # Add SSL certificates to nginx
   # Update nginx.conf for HTTPS
   # Update VITE_API_BASE_URL to https://
   ```

3. **Network Security**
   ```bash
   # Use Docker networks
   # Limit exposed ports
   # Configure firewall rules
   ```

4. **Database Security**
   ```bash
   # Enable SSL in PostgreSQL
   # Use strong passwords
   # Regular backups
   ```

## 📈 Monitoring and Maintenance

### Health Checks
- **Database**: `docker exec pob_postgres pg_isready -U pob_user -d pob_system`
- **Redis**: `docker exec pob_redis redis-cli ping`
- **Backend**: `curl -f http://localhost:8001/health`
- **Frontend**: `curl -f http://localhost:3000/health`

### Log Management
```bash
# Rotate logs
docker-compose logs --tail=1000 > logs/pob-$(date +%Y%m%d).log

# Monitor errors
docker-compose logs -f | grep -i error

# Monitor performance
docker stats --no-stream
```

### Backup Strategy
```bash
# Database backup
docker exec pob_postgres pg_dump -U pob_user pob_system > backup-$(date +%Y%m%d).sql

# Volume backup
docker run --rm -v pob_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-$(date +%Y%m%d).tar.gz -C /data .

# Configuration backup
tar czf config-backup-$(date +%Y%m%d).tar.gz .env nginx/ database/
```

## 🚀 Production Deployment

### Scaling Considerations
1. **Database Scaling**
   - Read replicas
   - Connection pooling
   - Query optimization

2. **Application Scaling**
   - Multiple backend instances
   - Load balancing
   - Session affinity

3. **Frontend Scaling**
   - CDN integration
   - Asset optimization
   - Browser caching

### High Availability
1. **Database HA**
   - PostgreSQL streaming replication
   - Automatic failover
   - Backup strategies

2. **Application HA**
   - Multiple backend instances
   - Health monitoring
   - Graceful degradation

3. **Infrastructure HA**
   - Multi-zone deployment
   - Load balancing
   - Disaster recovery

## 📞 Support

### Getting Help
1. **Check Logs**: Always check service logs first
2. **Documentation**: Refer to this guide and API docs
3. **Community**: Check GitHub issues and discussions
4. **Professional**: Contact support for production issues

### Common Commands Reference
```bash
# Quick restart
docker-compose restart

# Full rebuild
docker-compose down && docker-compose build --no-cache && docker-compose up -d

# Clean start
docker-compose down -v && docker system prune -f && docker-compose up -d

# Debug mode
docker-compose -f docker-compose.yml -f docker-compose.debug.yml up
```

---

## 🎉 Success!

Your POB System is now running with:
- ✅ Enhanced Authentication
- ✅ Advanced Header System
- ✅ Custom Report Builder
- ✅ Real-time Notifications
- ✅ Professional UI/UX
- ✅ Production-Ready Architecture

**Access the system at: http://localhost:3000**
