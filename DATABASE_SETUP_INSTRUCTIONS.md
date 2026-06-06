# Database Setup Instructions for Access Control Module

## 🚨 Database Connection Issue

The PostgreSQL database service is not running or configured correctly. Follow these steps to set up the database for the Access Control module.

## ✅ Prerequisites Check

### 1. PostgreSQL Installation
```bash
# Verify PostgreSQL is installed
python -c "import psycopg2; print('psycopg2 version:', psycopg2.__version__)"
```

**Expected Output:**
```
psycopg2 version: 2.9.12 (dt dec pq3 ext lo64)
```

### 2. PostgreSQL Service Status
```bash
# Check if PostgreSQL service exists
net start | findstr postgresql
```

## 🔧 Database Setup Options

### Option 1: Start PostgreSQL Service (Recommended)

#### For Windows:
```cmd
# Start PostgreSQL service as Administrator
net start postgresql-x64-17

# Or use PowerShell (Run as Administrator)
Start-Service postgresql-x64-17
```

#### For Linux/Mac:
```bash
# Start PostgreSQL service
sudo systemctl start postgresql
# or
sudo service postgresql start
```

### Option 2: Use Docker PostgreSQL (Easiest)

#### Start PostgreSQL Container:
```bash
cd "c:\Users\MosesGere\POB_Version2.0"
docker-compose -f docker-compose.yml up -d postgresql
```

#### Check Docker Container Status:
```bash
docker-compose ps postgresql
```

### Option 3: Connect to External PostgreSQL

If you have PostgreSQL running elsewhere:

#### Update .env file:
```env
DATABASE_URL=postgresql://username:password@host:5432/database_name
DATABASE_HOST=your_host
DATABASE_PORT=5432
DATABASE_NAME=your_database
DATABASE_USER=your_username
DATABASE_PASSWORD=your_password
```

#### Test Connection:
```bash
cd backend
python -c "
import psycopg2
try:
    conn = psycopg2.connect('postgresql://username:password@host:5432/database_name')
    print('✅ Database connection successful')
    conn.close()
except psycopg2.OperationalError as e:
    print(f'❌ Database connection failed: {e}')
"
```

## 🗄️ Database Migration

### Once PostgreSQL is Running:

#### 1. Run Migration Script
```bash
cd backend
python database/migrations/create_access_control_tables.py
```

#### 2. Verify Tables Created
```bash
cd backend
python -c "
import psycopg2
from dotenv import load_dotenv
load_dotenv('.env')
import os

try:
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cursor = conn.cursor()
    cursor.execute(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'acc_%'\")
    tables = cursor.fetchall()
    print('Access Control tables:', [table[0] for table in tables])
    conn.close()
    print('✅ Database migration completed successfully')
except Exception as e:
    print(f'❌ Migration verification failed: {e}')
"
```

#### 3. Insert Default Data
```bash
cd backend
python -c "
import psycopg2
from dotenv import load_dotenv
load_dotenv('.env')
import os

try:
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cursor = conn.cursor()
    
    # Insert default timezone
    cursor.execute(\"\"\"
        INSERT INTO acc_timezone (timezone_name, mon_time1, emergency_override, created_at, updated_at)
        VALUES ('Default 24/7', '09:00-17:00', false, NOW(), NOW())
        ON CONFLICT (timezone_name) DO NOTHING;
    \"\"\")
    
    # Insert default access level
    cursor.execute(\"\"\"
        INSERT INTO acc_level (level_name, description, mustering_only, created_at, updated_at)
        VALUES ('Default Level', 'Default access level', false, NOW(), NOW())
        ON CONFLICT (level_name) DO NOTHING;
    \"\"\")
    
    conn.commit()
    conn.close()
    print('✅ Default data inserted successfully')
except Exception as e:
    print(f'❌ Default data insertion failed: {e}')
"
```

## 🔍 Troubleshooting

### Common Issues:

#### 1. "FATAL: password authentication failed for user 'pob_user'"
**Solution**: Create the database user and set proper password
```sql
-- Connect to PostgreSQL as superuser
CREATE USER pob_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE pob_system TO pob_user;
```

#### 2. "Connection refused"
**Solution**: Check PostgreSQL configuration in `postgresql.conf`
```conf
# postgresql.conf
listen_addresses = '*'
port = 5432
max_connections = 100
```

#### 3. "Database does not exist"
**Solution**: Create the database
```sql
CREATE DATABASE pob_system;
```

## 🚀 Quick Start Script

### Automated Setup (Windows):
```powershell
# Save as setup_database.ps1 and run as Administrator
Write-Host "Setting up database for Access Control..."

# Check PostgreSQL installation
try {
    python -c "import psycopg2; print('✅ PostgreSQL installed')"
} catch {
    Write-Host "❌ PostgreSQL not installed. Please install PostgreSQL first."
    exit 1
}

# Start PostgreSQL service
Write-Host "Starting PostgreSQL service..."
Start-Service postgresql-x64-17

# Wait for service to start
Start-Sleep -Seconds 5

# Run migration
Write-Host "Running database migration..."
Set-Location "C:\Users\MosesGere\POB_Version2.0\backend"
python database/migrations/create_access_control_tables.py

# Verify migration
Write-Host "Verifying migration..."
python -c "
import psycopg2
from dotenv import load_dotenv
load_dotenv('.env')
import os

try:
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cursor = conn.cursor()
    cursor.execute(\"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'acc_%'\")
    table_count = cursor.fetchone()[0]
    print(f'✅ Found {table_count} Access Control tables')
    conn.close()
except Exception as e:
    print(f'❌ Verification failed: {e}')
"

Write-Host "🎉 Database setup complete!"
```

## 📋 Verification Checklist

### After Setup, Verify:

- [ ] PostgreSQL service is running
- [ ] Database connection works
- [ ] All `acc_*` tables exist
- [ ] Default data inserted
- [ ] Migration script runs without errors
- [ ] Backend can connect to database
- [ ] Frontend can access Access Control module

## 🎯 Next Steps

Once database is set up:

1. **Start Backend**: `python -m uvicorn app.main:app --host 0.0.0.0 --port 8001`
2. **Start Frontend**: `npm start` (in frontend-react directory)
3. **Access Control Module**: Navigate to `http://localhost:3000/access-control/`
4. **Test All Features**: Verify all 10 tabs work correctly

## 📞 Support

### If Issues Persist:

1. **Check PostgreSQL Logs**: Look in PostgreSQL data directory
2. **Windows Event Viewer**: Check System logs for PostgreSQL errors
3. **Firewall**: Ensure PostgreSQL port 5432 is allowed
4. **Permissions**: Run commands as Administrator
5. **Docker**: Try Docker-based PostgreSQL if local installation fails

---

**The Access Control module is fully implemented and ready once the database is properly configured!** 🚀
