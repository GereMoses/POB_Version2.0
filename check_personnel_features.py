#!/usr/bin/env python3
"""
Personnel Module Feature Verification Script
Check BioTime 9.5 + POB personnel module implementation
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def check_routes():
    """Check if BioTime 9.5 routes exist"""
    print("=== ROUTE CHECK ===")
    try:
        from app.api.personnel import router
        routes = [route.path for route in router.routes]
        
        bio_time_routes = [
            '/employees/',
            '/departments/',
            '/areas/',
            '/resignation/',
            '/vendors/',
            '/onboarding/',
            '/batch-import/',
            '/export/',
            '/enroll/',
            '/bio-data/'
        ]
        
        for route in bio_time_routes:
            if any(route.path.endswith(bio_time_route) for bio_time_route in bio_time_routes):
                print(f"✅ BioTime route exists: {route.path}")
            else:
                print(f"❌ Missing BioTime route: {route.path}")
        
        print(f"Total routes found: {len(routes)}")
        return True
    except Exception as e:
        print(f"❌ Route check error: {e}")
        return False

def check_database_tables():
    """Check if BioTime tables exist"""
    print("\n=== DATABASE TABLES CHECK ===")
    try:
        from core.database import get_db
        from sqlalchemy import text
        
        db = next(get_db())
        
        # Check for personnel table
        result = db.execute(text("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'personnel' AND table_schema = 'public'"))
        personnel_exists = result.scalar() > 0
        print(f"✅ Personnel table exists: {personnel_exists}")
        
        # Check for BioTime-specific tables
        biotime_tables = [
            'personnel_employee',
            'personnel_department', 
            'personnel_position',
            'personnel_area',
            'personnel_resignation',
            'personnel_vendor',
            'onboarding_task',
            'onboarding_template'
        ]
        
        for table in biotime_tables:
            result = db.execute(text(f"SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '{table}' AND table_schema = 'public'"))
            exists = result.scalar() > 0
            if exists:
                print(f"✅ BioTime table exists: {table}")
            else:
                print(f"❌ Missing BioTime table: {table}")
        
        return True
    except Exception as e:
        print(f"❌ Database check error: {e}")
        return False

def check_api_endpoints():
    """Test key API endpoints"""
    print("\n=== API ENDPOINTS CHECK ===")
    import requests
    import json
    
    base_url = "http://localhost:8001"
    
    endpoints = [
        "/api/personnel/employees/",
        "/api/personnel/departments/",
        "/api/personnel/areas/",
        "/api/personnel/batch-import/",
        "/api/personnel/export/"
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{base_url}{endpoint}")
            if response.status_code == 200:
                print(f"✅ API endpoint works: {endpoint}")
            else:
                print(f"❌ API endpoint failed: {endpoint} - Status: {response.status_code}")
        except Exception as e:
            print(f"❌ API endpoint error: {endpoint} - {str(e)}")

def check_frontend_files():
    """Check if frontend components exist"""
    print("\n=== FRONTEND FILES CHECK ===")
    
    frontend_files = [
        "frontend-react/src/pages/Personnel/index.jsx",
        "frontend-react/src/pages/Personnel/PersonnelList.jsx",
        "frontend-react/src/pages/Personnel/Department/DepartmentTree.jsx",
        "frontend-react/src/pages/Personnel/Onboarding/OnboardingManagement.jsx",
        "frontend-react/src/pages/Personnel/Vendor/VendorManagement.jsx"
    ]
    
    for file_path in frontend_files:
        if os.path.exists(file_path):
            print(f"✅ Frontend file exists: {file_path}")
        else:
            print(f"❌ Frontend file missing: {file_path}")

def check_mock_data():
    """Check for hardcoded/mock data"""
    print("\n=== MOCK DATA CHECK ===")
    
    frontend_dir = "frontend-react/src"
    mock_patterns = [
        "MOCK_",
        "FAKE_",
        "DUMMY_",
        "const employees = [",
        "const mockData ="
    ]
    
    for root, dirs, files in os.walk(frontend_dir):
        for file in files:
            if file.endswith('.jsx') or file.endswith('.js'):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        for pattern in mock_patterns:
                            if pattern in content:
                                print(f"❌ Mock data found in: {file_path} - Pattern: {pattern}")
                                return False
                except:
                    pass
    
    print("✅ No mock data patterns found")
    return True

def main():
    print("PERSONNEL MODULE BIOIME 9.5 + POB FEATURE AUDIT")
    print("=" * 50)
    
    # Check all components
    route_check = check_routes()
    db_check = check_database_tables()
    api_check = check_api_endpoints()
    frontend_check = check_frontend_files()
    mock_check = check_mock_data()
    
    print("\n" + "=" * 50)
    print("SUMMARY:")
    
    if route_check and db_check and api_check and frontend_check and mock_check:
        print("🎉 ALL CHECKS PASSED - Personnel module is BioTime 9.5 + POB ready!")
        print("✅ Routes exist")
        print("✅ Database tables exist")
        print("✅ API endpoints work")
        print("✅ Frontend components exist")
        print("✅ No mock data found")
    else:
        print("❌ ISSUES FOUND:")
        if not route_check:
            print("❌ Route issues")
        if not db_check:
            print("❌ Database table issues")
        if not api_check:
            print("❌ API endpoint issues")
        if not frontend_check:
            print("❌ Frontend file issues")
        if not mock_check:
            print("❌ Mock data found")
    
    print("=" * 50)

if __name__ == "__main__":
    main()
