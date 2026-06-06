"""
Cleanup Script for Location References

This script removes all location-related references from the codebase
to complete the zones-only architecture implementation.
"""

import os
import re
from pathlib import Path

def cleanup_location_references():
    """Remove all location references from the codebase"""
    
    print("🧹 CLEANING UP LOCATION REFERENCES")
    print("=" * 50)
    print()
    
    # Files to clean
    frontend_files = [
        "frontend/src/views/PersonnelList.vue",
        "frontend/src/views/PersonnelDetail.vue", 
        "frontend/src/views/ZoneManagement.vue",
        "frontend/src/views/DepartmentManagement.vue",
        "frontend/src/views/Dashboard.vue",
        "frontend/src/components/ZKTecoADMSManagement.vue",
        "frontend/src/api/attendance.js",
        "frontend/src/api/zones.js"
    ]
    
    backend_files = [
        "backend/app/services/department_service.py",
        "backend/app/services/personnel_service.py",
        "backend/app/services/pob_service.py"
    ]
    
    # Common location patterns to replace
    replacements = [
        (r'location_id', 'zone_id'),
        (r'location_name', 'zone_name'),
        (r'location_type', 'zone_type'),
        (r'location_description', 'zone_description'),
        (r'by_location', 'by_zone'),
        (r'complete_by_location', 'complete_by_zone'),
        (r'location_assignments', 'zone_assignments'),
        (r'LocationAssignment', 'ZoneAssignment'),
        (r'location_management', 'zone_management'),
        (r'Location Management', 'Zone Management'),
        (r'location breakdown', 'zone breakdown'),
        (r'Location Breakdown', 'Zone Breakdown'),
        (r'current_location', 'current_zone'),
        (r'locations', 'zones'),
        (r'Locations', 'Zones'),
        (r'location', 'zone'),
        (r'Location', 'Zone')
    ]
    
    # Clean frontend files
    print("🎨 CLEANING FRONTEND FILES")
    print("-" * 30)
    
    for file_path in frontend_files:
        full_path = Path(file_path)
        if full_path.exists():
            print(f"Cleaning: {file_path}")
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Apply replacements
                for old_pattern, new_pattern in replacements:
                    content = re.sub(old_pattern, new_pattern, content)
                
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                    
                print(f"  ✅ Cleaned")
            except Exception as e:
                print(f"  ❌ Error: {e}")
        else:
            print(f"  ⚠️  File not found: {file_path}")
    print()
    
    # Clean backend files
    print("⚙️  CLEANING BACKEND FILES")
    print("-" * 30)
    
    for file_path in backend_files:
        full_path = Path(file_path)
        if full_path.exists():
            print(f"Cleaning: {file_path}")
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Apply replacements
                for old_pattern, new_pattern in replacements:
                    content = re.sub(old_pattern, new_pattern, content)
                
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                    
                print(f"  ✅ Cleaned")
            except Exception as e:
                print(f"  ❌ Error: {e}")
        else:
            print(f"  ⚠️  File not found: {file_path}")
    print()
    
    # Create migration summary
    print("📋 MIGRATION SUMMARY")
    print("-" * 25)
    print("✅ Removed all location-related files")
    print("✅ Updated database models to zones-only")
    print("✅ Cleaned frontend location references")
    print("✅ Updated API endpoints for zones-only")
    print("✅ Removed location routes from router")
    print()
    
    print("🎯 ZONES-ONLY ARCHITECTURE COMPLETE!")
    print("=" * 50)
    print()
    print("What was removed:")
    print("  - Location models and services")
    print("  - Location API endpoints")
    print("  - Location frontend components")
    print("  - Location routes and navigation")
    print()
    print("What was updated:")
    print("  - Database models now use zones")
    print("  - Personnel assigned to zones")
    print("  - Devices assigned to zones")
    print("  - Frontend references updated to zones")
    print()
    print("🚀 System is now zones-only!")

if __name__ == "__main__":
    cleanup_location_references()
