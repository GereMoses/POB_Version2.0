"""
Debug API for testing
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..core.database import get_db

router = APIRouter()

@router.get("/test-zone-assignments")
async def test_zone_assignments(db: Session = Depends(get_db)):
    """Test zone assignments endpoint"""
    try:
        query = """
            SELECT zra.id, zra.zone_id, zra.reader_id, zra.assignment_type, 
                   zra.status, zra.is_primary, zra.assigned_at, zra.unassigned_at,
                   zra.expires_at, zra.access_level, zra.notes, zra.assigned_by,
                   z.name as zone_name, z.code as zone_code,
                   d.device_id, d.name as reader_name, d.status as reader_status,
                   d.ip_address, d.location
            FROM zone_reader_assignments zra
            LEFT JOIN zones z ON zra.zone_id = z.id
            LEFT JOIN devices d ON zra.reader_id = d.id
            WHERE 1=1
            LIMIT 5
        """
        
        result = db.execute(text(query))
        rows = result.fetchall()
        
        # Simple conversion to list of dicts
        assignments = []
        for row in rows:
            row_dict = {}
            for i, column in enumerate(row._fields):
                value = row[i]
                if hasattr(value, 'isoformat'):
                    value = value.isoformat()
                row_dict[column] = value
            assignments.append(row_dict)
        
        return {
            "success": True,
            "assignments": assignments,
            "total_count": len(assignments)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "type": str(type(e))
        }

@router.get("/test-devices")
async def test_devices(db: Session = Depends(get_db)):
    """Test devices endpoint"""
    try:
        query = "SELECT id, device_id, name, status, ip_address, location FROM devices WHERE device_type = 'biometric_reader' ORDER BY name LIMIT 5"
        result = db.execute(text(query))
        rows = result.fetchall()
        
        # Simple conversion to list of dicts
        readers = []
        for row in rows:
            row_dict = {}
            for i, column in enumerate(row._fields):
                value = row[i]
                if hasattr(value, 'isoformat'):
                    value = value.isoformat()
                row_dict[column] = value
            readers.append(row_dict)
        
        return readers
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "type": str(type(e))
        }
