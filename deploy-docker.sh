#!/bin/bash

# POB System Docker Deployment Script
# This script will deploy the entire POB system on Docker Desktop

set -e

echo "🚀 POB System Docker Deployment"
echo "=================================="
echo "This will deploy the complete POB system including:"
echo "  • PostgreSQL Database"
echo "  • Redis Cache"
echo "  • Backend API (FastAPI)"
echo "  • Frontend (React)"
echo "  • Enhanced Authentication"
echo "  • Report Module"
echo "  • Advanced Header System"
echo ""

# Check if Docker is running
echo "🐳 Checking Docker Desktop..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker Desktop is not running. Please start Docker Desktop first."
    echo "   Open Docker Desktop and wait for it to be fully started."
    exit 1
fi

echo "✅ Docker Desktop is running"

# Check if Docker Compose is available
echo "🔧 Checking Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed."
    echo "   Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker Compose is available"

# Navigate to project directory
cd "$(dirname "$0")"
PROJECT_DIR=$(pwd)
echo "📁 Project directory: $PROJECT_DIR"

# Create necessary directories
echo "📂 Creating necessary directories..."
mkdir -p database
mkdir -p logs
mkdir -p uploads
mkdir -p nginx
mkdir -p config

# Create nginx configuration for frontend
echo "⚙️ Creating nginx configuration..."
cat > nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    # Basic settings
    sendfile        on;
    tcp_nopush      on;
    keepalive_timeout  65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Upstream backend
    upstream backend {
        server backend:8001;
    }

    server {
        listen 80;
        server_name localhost;

        # Frontend static files
        location / {
            root /usr/share/nginx/html;
            index index.html index.htm;
            try_files $uri $uri/ /index.html;
            
            # Security headers
            add_header X-Frame-Options "SAMEORIGIN" always;
            add_header X-Content-Type-Options "nosniff" always;
            add_header X-XSS-Protection "1; mode=block" always;
            add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        }

        # API proxy
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket support
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # WebSocket support
        location /ws/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        # Error pages
        error_page 404 /index.html;
        error_page 500 502 503 504 /50x.html;
        location = /50x.html {
            root /usr/share/nginx/html;
        }
    }
}
EOF

# Create PostgreSQL configuration
echo "🗄️ Creating PostgreSQL configuration..."
cat > database/postgresql.conf << 'EOF'
# PostgreSQL Configuration for POB System
# Optimized for production use

# Connection Settings
listen_addresses = '*'
port = 5432
max_connections = 200

# Memory Settings
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100

# Performance Tuning
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_messages_statement = 'all'
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

# Security
ssl = off
password_encryption = scram-sha-256

# Performance
checkpoint_timeout = 10min
wal_writer_delay = 200ms
commit_delay = 0
max_wal_size = 1GB
min_wal_size = 80MB
EOF

# Create environment file
echo "🔐 Creating environment configuration..."
cat > .env << 'EOF'
# Database Configuration
POSTGRES_DB=pob_system
POSTGRES_USER=pob_user
POSTGRES_PASSWORD=pob_password
DATABASE_URL=postgresql://pob_user:pob_password@postgres:5432/pob_system

# Redis Configuration
REDIS_URL=redis://redis:6379/0

# Backend Configuration
DEBUG=True
LOG_LEVEL=INFO
SECRET_KEY=your-secret-key-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Frontend Configuration
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000/ws

# Email Configuration (for reports)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_TLS=True

# File Upload Configuration
MAX_FILE_SIZE=50MB
UPLOAD_PATH=/app/uploads

# Security Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

# Production Settings
ENVIRONMENT=production
SENTRY_DSN=your-sentry-dsn
EOF

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down --remove-orphans || true

# Clean up old images and containers
echo "🧹 Cleaning up old Docker resources..."
docker system prune -f --volumes || true

# Build and start services
echo "🏗️ Building and starting services..."
echo "This may take a few minutes on first run..."

# Build images with no cache for fresh build
docker-compose build --no-cache --parallel

# Start services
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
echo ""

# Function to check service health
check_service() {
    local service_name=$1
    local health_check=$2
    local max_attempts=$3
    local attempt=1
    
    echo "🔍 Checking $service_name health..."
    
    while [ $attempt -le $max_attempts ]; do
        if eval "$health_check" > /dev/null 2>&1; then
            echo "✅ $service_name is healthy (attempt $attempt)"
            return 0
        fi
        
        echo "⏳ Waiting for $service_name... (attempt $attempt/$max_attempts)"
        sleep 5
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name failed to become healthy after $max_attempts attempts"
    return 1
}

# Check PostgreSQL
check_service "PostgreSQL" "docker exec pob_postgres pg_isready -U pob_user -d pob_system -q" 12

# Check Redis
check_service "Redis" "docker exec pob_redis redis-cli ping" 6

# Check Backend
check_service "Backend API" "curl -f http://localhost:8001/health" 20

# Check Frontend
check_service "Frontend" "curl -f http://localhost:3000/health" 15

# Display service URLs
echo ""
echo "🎉 POB System Deployment Complete!"
echo "=================================="
echo ""
echo "📱 Access URLs:"
echo "  • Frontend (React): http://localhost:3000"
echo "  • Backend API: http://localhost:8001"
echo "  • API Documentation: http://localhost:8001/docs"
echo "  • Database: localhost:5432"
echo "  • Redis: localhost:6379"
echo ""
echo "🔐 Default Login Credentials:"
echo "  • Username: admin"
echo "  • Password: admin123"
echo ""
echo "📊 Available Features:"
echo "  • Enhanced Authentication System"
echo "  • Advanced Header with Notifications"
echo "  • Custom Report Builder"
echo "  • Real-time WebSocket Updates"
echo "  • Personnel Management"
echo "  • Attendance Tracking"
echo "  • Mustering System"
echo "  • Emergency Management"
echo "  • Report Generation"
echo "  • ZKTeco Device Integration"
echo ""
echo "🛠️ Management Commands:"
echo "  • View logs: docker-compose logs -f [service_name]"
echo "  • Stop services: docker-compose down"
echo "  • Restart services: docker-compose restart [service_name]"
echo "  • View status: docker-compose ps"
echo ""
echo "📁 Important Files:"
echo "  • Environment: .env"
echo "  • Database Config: database/postgresql.conf"
echo "  • Nginx Config: nginx/nginx.conf"
echo "  • Docker Compose: docker-compose.yml"
echo ""
echo "🔍 Troubleshooting:"
echo "  • If frontend doesn't load: Check nginx logs with 'docker-compose logs frontend'"
echo "  • If API errors: Check backend logs with 'docker-compose logs backend'"
echo "  • If database issues: Check postgres logs with 'docker-compose logs postgres'"
echo "  • To rebuild: docker-compose build --no-cache"
echo ""

# Show running containers
echo "📋 Running Containers:"
docker-compose ps

echo ""
echo "🚀 The POB System is now running on Docker Desktop!"
echo "   Open http://localhost:3000 in your browser to access the system."
echo ""

# Optional: Open browser automatically
if command -v cmd.exe &> /dev/null; then
    echo "🌐 Opening browser..."
    cmd.exe /c start http://localhost:3000
elif command -v open &> /dev/null; then
    echo "🌐 Opening browser..."
    open http://localhost:3000
fi

echo "✅ Deployment completed successfully!"
echo "   For support, check the logs or run: docker-compose logs"
