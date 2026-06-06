@echo off
setlocal enabledelayedexpansion

:: POB System Docker Deployment Script for Windows
:: This script will deploy the complete POB system on Docker Desktop

echo 🚀 POB System Docker Deployment
echo ==================================
echo This will deploy the complete POB system including:
echo   • PostgreSQL Database
echo   • Redis Cache
echo   • Backend API (FastAPI)
echo   • Frontend (React)
echo   • Enhanced Authentication
echo   • Report Module
echo   • Advanced Header System
echo.

:: Check if Docker is running
echo 🐳 Checking Docker Desktop...
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Desktop is not running. Please start Docker Desktop first.
    echo    Open Docker Desktop and wait for it to be fully started.
    pause
    exit /b 1
)
echo ✅ Docker Desktop is running

:: Check if Docker Compose is available
echo 🔧 Checking Docker Compose...
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose is not installed.
    echo    Please install Docker Compose first.
    pause
    exit /b 1
)
echo ✅ Docker Compose is available

:: Navigate to project directory
cd /d "%~dp0"
set PROJECT_DIR=%CD%
echo 📁 Project directory: %PROJECT_DIR%

:: Create necessary directories
echo 📂 Creating necessary directories...
if not exist "database" mkdir database
if not exist "logs" mkdir logs
if not exist "uploads" mkdir uploads
if not exist "nginx" mkdir nginx
if not exist "config" mkdir config

:: Create nginx configuration for frontend
echo ⚙️ Creating nginx configuration...
(
echo events {
echo     worker_connections 1024;
echo }
echo.
echo http {
echo     include       /etc/nginx/mime.types;
echo     default_type  application/octet-stream;
echo.
echo     # Logging
echo     log_format main '$remote_addr - $remote_user [$time_local] "$request" '
echo                     '$status $body_bytes_sent "$http_referer" '
echo                     '"$http_user_agent" "$http_x_forwarded_for"';
echo     access_log /var/log/nginx/access.log main;
echo.
echo     # Basic settings
echo     sendfile        on;
echo     tcp_nopush      on;
echo     keepalive_timeout  65;
echo     types_hash_max_size 2048;
echo.
echo     # Gzip compression
echo     gzip on;
echo     gzip_vary on;
echo     gzip_min_length 1024;
echo     gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
echo.
echo     # Upstream backend
echo     upstream backend {
echo         server backend:8001;
echo     }
echo.
echo     server {
echo         listen 80;
echo         server_name localhost;
echo.
echo         # Frontend static files
echo         location / {
echo             root /usr/share/nginx/html;
echo             index index.html index.htm;
echo             try_files $uri $uri/ /index.html;
echo             
echo             # Security headers
echo             add_header X-Frame-Options "SAMEORIGIN" always;
echo             add_header X-Content-Type-Options "nosniff" always;
echo             add_header X-XSS-Protection "1; mode=block" always;
echo             add_header Referrer-Policy "strict-origin-when-cross-origin" always;
echo         }
echo.
echo         # API proxy
echo         location /api/ {
echo             proxy_pass http://backend;
echo             proxy_set_header Host $host;
echo             proxy_set_header X-Real-IP $remote_addr;
echo             proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
echo             proxy_set_header X-Forwarded-Proto $scheme;
echo             
echo             # WebSocket support
echo             proxy_http_version 1.1;
echo             proxy_set_header Upgrade $http_upgrade;
echo             proxy_set_header Connection "upgrade";
echo         }
echo.
echo         # WebSocket support
echo         location /ws/ {
echo             proxy_pass http://backend;
echo             proxy_http_version 1.1;
echo             proxy_set_header Upgrade $http_upgrade;
echo             proxy_set_header Connection "upgrade";
echo             proxy_set_header Host $host;
echo             proxy_set_header X-Real-IP $remote_addr;
echo             proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
echo             proxy_set_header X-Forwarded-Proto $scheme;
echo         }
echo.
echo         # Health check
echo         location /health {
echo             access_log off;
echo             return 200 "healthy\n";
echo             add_header Content-Type text/plain;
echo         }
echo.
echo         # Error pages
echo         error_page 404 /index.html;
echo         error_page 500 502 503 504 /50x.html;
echo         location = /50x.html {
echo             root /usr/share/nginx/html;
echo         }
echo     }
echo }
) > nginx\nginx.conf

:: Create PostgreSQL configuration
echo 🗄️ Creating PostgreSQL configuration...
(
echo # PostgreSQL Configuration for POB System
echo # Optimized for production use
echo.
echo # Connection Settings
echo listen_addresses = '*'
echo port = 5432
echo max_connections = 200
echo.
echo # Memory Settings
echo shared_buffers = 256MB
echo effective_cache_size = 1GB
echo maintenance_work_mem = 64MB
echo checkpoint_completion_target = 0.9
echo wal_buffers = 16MB
echo default_statistics_target = 100
echo.
echo # Performance Tuning
echo random_page_cost = 1.1
echo effective_io_concurrency = 200
echo.
echo # Logging
echo log_destination = 'stderr'
echo logging_collector = on
echo log_directory = 'pg_log'
echo log_filename = 'postgresql-%%Y-%%m-%%d_%%H%%M%%S.log'
echo log_rotation_age = 1d
echo log_rotation_size = 100MB
echo log_min_messages_statement = 'all'
echo log_line_prefix = '%%t [%%p]: [%%l-1] user=%%u,db=%%d,app=%%a,client=%%h '
echo.
echo # Security
echo ssl = off
echo password_encryption = scram-sha-256
echo.
echo # Performance
echo checkpoint_timeout = 10min
echo wal_writer_delay = 200ms
echo commit_delay = 0
echo max_wal_size = 1GB
echo min_wal_size = 80MB
) > database\postgresql.conf

:: Create environment file
echo 🔐 Creating environment configuration...
(
echo # Database Configuration
echo POSTGRES_DB=pob_system
echo POSTGRES_USER=pob_user
echo POSTGRES_PASSWORD=pob_password
echo DATABASE_URL=postgresql://pob_user:pob_password@postgres:5432/pob_system
echo.
echo # Redis Configuration
echo REDIS_URL=redis://redis:6379/0
echo.
echo # Backend Configuration
echo DEBUG=True
echo LOG_LEVEL=INFO
echo SECRET_KEY=your-secret-key-change-in-production
echo ACCESS_TOKEN_EXPIRE_MINUTES=30
echo.
echo # Frontend Configuration
echo VITE_API_BASE_URL=http://localhost:3000/api/v1
echo VITE_WS_URL=ws://localhost:3000/ws
echo.
echo # Email Configuration (for reports)
echo SMTP_HOST=smtp.gmail.com
echo SMTP_PORT=587
echo SMTP_USER=your-email@gmail.com
echo SMTP_PASSWORD=your-app-password
echo SMTP_TLS=True
echo.
echo # File Upload Configuration
echo MAX_FILE_SIZE=50MB
echo UPLOAD_PATH=/app/uploads
echo.
echo # Security Configuration
echo CORS_ORIGINS=http://localhost:3000,http://localhost:3001
echo ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0
echo.
echo # Production Settings
echo ENVIRONMENT=production
echo SENTRY_DSN=your-sentry-dsn
) > .env

:: Stop existing containers
echo 🛑 Stopping existing containers...
docker-compose down --remove-orphans >nul 2>&1

:: Clean up old images and containers
echo 🧹 Cleaning up old Docker resources...
docker system prune -f --volumes >nul 2>&1

:: Build and start services
echo 🏗️ Building and starting services...
echo This may take a few minutes on first run...

:: Build images with no cache for fresh build
docker-compose build --no-cache --parallel

:: Start services
docker-compose up -d

:: Wait for services to be ready
echo ⏳ Waiting for services to be ready...
echo.

:: Function to check service health
:check_service
set service_name=%1
set health_check=%2
set max_attempts=%3
set attempt=1

:check_loop
echo 🔍 Checking %service_name% health...

:: Execute health check
%health_check% >nul 2>&1
if errorlevel 1 (
    if %attempt% geq %max_attempts% (
        echo ❌ %service_name% failed to become healthy after %max_attempts% attempts
        goto :continue
    )
    echo ⏳ Waiting for %service_name%... (attempt %attempt%/%max_attempts%)
    timeout /t 5 /nobreak >nul
    set /a attempt=%attempt%+1
    goto :check_loop
) else (
    echo ✅ %service_name% is healthy (attempt %attempt%)
)

:continue
goto :eof

:: Check PostgreSQL
echo :check_service "PostgreSQL" "docker exec pob_postgres pg_isready -U pob_user -d pob_system -q" "12"
call :check_service "PostgreSQL" "docker exec pob_postgres pg_isready -U pob_user -d pob_system -q" 12

:: Check Redis
echo :check_service "Redis" "docker exec pob_redis redis-cli ping" "6"
call :check_service "Redis" "docker exec pob_redis redis-cli ping" 6

:: Check Backend
echo :check_service "Backend API" "curl -f http://localhost:8001/health" "20"
call :check_service "Backend API" "curl -f http://localhost:8001/health" 20

:: Check Frontend
echo :check_service "Frontend" "curl -f http://localhost:3000/health" "15"
call :check_service "Frontend" "curl -f http://localhost:3000/health" 15

:: Display service URLs
echo.
echo 🎉 POB System Deployment Complete!
echo ==================================
echo.
echo 📱 Access URLs:
echo   • Frontend ^(React^): http://localhost:3000
echo   • Backend API: http://localhost:8001
echo   • API Documentation: http://localhost:8001/docs
echo   • Database: localhost:5432
echo   • Redis: localhost:6379
echo.
echo 🔐 Default Login Credentials:
echo   • Username: admin
echo   • Password: admin123
echo.
echo 📊 Available Features:
echo   • Enhanced Authentication System
echo   • Advanced Header with Notifications
echo   • Custom Report Builder
echo   • Real-time WebSocket Updates
echo   • Personnel Management
echo   • Attendance Tracking
echo   • Mustering System
echo   • Emergency Management
echo   • Report Generation
echo   • ZKTeco Device Integration
echo.
echo 🛠️ Management Commands:
echo   • View logs: docker-compose logs -f [service_name]
echo   • Stop services: docker-compose down
echo   • Restart services: docker-compose restart [service_name]
echo   • View status: docker-compose ps
echo.
echo 📁 Important Files:
echo   • Environment: .env
echo   • Database Config: database\postgresql.conf
echo   • Nginx Config: nginx\nginx.conf
echo   • Docker Compose: docker-compose.yml
echo.
echo 🔍 Troubleshooting:
echo   • If frontend doesn't load: Check nginx logs with 'docker-compose logs frontend'
echo   • If API errors: Check backend logs with 'docker-compose logs backend'
echo   • If database issues: Check postgres logs with 'docker-compose logs postgres'
echo   • To rebuild: docker-compose build --no-cache
echo.

:: Show running containers
echo 📋 Running Containers:
docker-compose ps

echo.
echo 🚀 The POB System is now running on Docker Desktop!
echo    Open http://localhost:3000 in your browser to access the system.
echo.

:: Open browser automatically
echo 🌐 Opening browser...
start http://localhost:3000

echo ✅ Deployment completed successfully!
echo    For support, check the logs or run: docker-compose logs
pause
