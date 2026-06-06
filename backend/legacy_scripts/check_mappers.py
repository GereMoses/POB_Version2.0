"""Comprehensive mapper validation — run inside container"""
import sys, os
sys.path.insert(0, '/app')
os.environ.setdefault('DATABASE_URL', 'postgresql://pob_user:pob_password@postgres:5432/pob_system')

import warnings
warnings.filterwarnings('ignore')

model_modules = [
    'app.models',
    'app.models.access_control',
    'app.models.emergency',
    'app.models.emergency_enhanced',
    'app.models.event',
    'app.models.mtd',
    'app.models.onboarding',
    'app.models.certification',
    'app.models.system',
    'app.models.custom_attributes',
]

print("Importing model modules...")
for mod in model_modules:
    try:
        __import__(mod)
        print(f"  ✅ {mod}")
    except Exception as e:
        print(f"  ❌ {mod}: {e}")

print("\nRunning configure_mappers()...")
try:
    from sqlalchemy.orm import configure_mappers
    configure_mappers()
    print("✅ ALL MAPPERS CONFIGURED SUCCESSFULLY")
except Exception as e:
    print(f"❌ MAPPER ERROR: {e}")
