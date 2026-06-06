from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
import logging

from ..core.database import get_db
from ..core.dependencies import get_current_active_user
from ..services.zone_service import ZoneService
from ..models.user import User

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/zone-assignments", tags=["zone-assignments"])

# Initialize service
zone_service = ZoneService()

# Public endpoints (no authentication required)
@router.get("/public-assignments", response_model=Dict[str, Any])
async def get_public_zone_reader_assignments(
    zone_id: Optional[int] = Query(None, description="Filter by zone ID"),
    reader_id: Optional[int] = Query(None, description="Filter by reader ID"),
    assignment_status: Optional[str] = Query(None, description="Filter by assignment status"),
    db: Session = Depends(get_db)
):
    """
    Get zone reader assignments with filtering options (public endpoint - no authentication)
    
    Args:
        zone_id: Filter by zone ID
        reader_id: Filter by reader ID
        assignment_status: Filter by assignment status
        db: Database session
        
    Returns:
        Zone reader assignments data
    """
    try:
        result = await zone_service.get_zone_reader_assignments(
            db=db,
            zone_id=zone_id,
            reader_id=reader_id,
            assignment_status=assignment_status
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting zone reader assignments: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/available-readers", response_model=Dict[str, Any])
async def get_public_available_readers(
    zone_id: Optional[int] = Query(None, description="Filter by zone (exclude readers already assigned to this zone)"),
    db: Session = Depends(get_db)
):
    """
    Get available readers for zone assignment (public endpoint - no authentication)
    
    Args:
        zone_id: Filter by zone (exclude readers already assigned to this zone)
        db: Database session
        
    Returns:
        Available readers list
    """
    try:
        result = await zone_service.get_available_readers_for_assignment(
            db=db,
            zone_id=zone_id
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting available readers: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/statistics", response_model=Dict[str, Any])
async def get_public_zone_reader_assignment_statistics(
    db: Session = Depends(get_db)
):
    """
    Get zone reader assignment statistics (public endpoint - no authentication)
    
    Args:
        db: Database session
        
    Returns:
        Reader assignment statistics
    """
    try:
        result = await zone_service.get_zone_reader_assignment_statistics(db=db)
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting reader assignment statistics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Authenticated endpoints
@router.get("/assignments", response_model=Dict[str, Any])
async def get_zone_reader_assignments(
    zone_id: Optional[int] = Query(None, description="Filter by zone ID"),
    reader_id: Optional[int] = Query(None, description="Filter by reader ID"),
    assignment_status: Optional[str] = Query(None, description="Filter by assignment status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get zone reader assignments with filtering options
    
    Args:
        zone_id: Filter by zone ID
        reader_id: Filter by reader ID
        assignment_status: Filter by assignment status
        db: Database session
        current_user: Current authenticated user
        
    Returns:
        Zone reader assignments data
    """
    try:
        result = await zone_service.get_zone_reader_assignments(
            db=db,
            zone_id=zone_id,
            reader_id=reader_id,
            assignment_status=assignment_status
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting zone assignments: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/assignments", response_model=Dict[str, Any])
async def create_zone_reader_assignment(
    assignment_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new zone reader assignment
    
    Args:
        assignment_data: Assignment creation data
        db: Database session
        current_user: Current authenticated user
        
    Returns:
        Creation result
    """
    try:
        # Validate required fields
        required_fields = ["reader_id", "zone_id"]
        for field in required_fields:
            if field not in assignment_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        result = await zone_service.create_zone_reader_assignment(
            db=db,
            assignment_data=assignment_data
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating zone reader assignment: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/assignments/{assignment_id}", response_model=Dict[str, Any])
async def update_zone_reader_assignment(
    assignment_id: int,
    assignment_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update an existing zone reader assignment
    
    Args:
        assignment_id: Assignment ID
        assignment_data: Updated assignment data
        db: Database session
        current_user: Current authenticated user
        
    Returns:
        Update result
    """
    try:
        result = await zone_service.update_zone_reader_assignment(
            db=db,
            assignment_id=assignment_id,
            assignment_data=assignment_data
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating zone reader assignment: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/assignments/{assignment_id}", response_model=Dict[str, Any])
async def delete_zone_reader_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a zone reader assignment
    
    Args:
        assignment_id: Assignment ID
        db: Database session
        current_user: Current authenticated user
        
    Returns:
        Deletion result
    """
    try:
        result = await zone_service.delete_zone_reader_assignment(
            db=db,
            assignment_id=assignment_id
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting zone assignment: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/statistics", response_model=Dict[str, Any])
async def get_zone_reader_assignment_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get zone reader assignment statistics
    
    Args:
        db: Database session
        current_user: Current authenticated user
        
    Returns:
        Reader assignment statistics
    """
    try:
        result = await zone_service.get_zone_reader_assignment_statistics(db=db)
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting reader assignment statistics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/available-readers", response_model=Dict[str, Any])
async def get_available_readers_for_assignment(
    zone_id: Optional[int] = Query(None, description="Filter by zone (exclude readers already assigned to this zone)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get available readers for zone assignment
    
    Args:
        zone_id: Filter by zone (exclude readers already assigned to this zone)
        db: Database session
        current_user: Current authenticated user
        
    Returns:
        Available readers list
    """
    try:
        result = await zone_service.get_available_readers_for_assignment(
            db=db,
            zone_id=zone_id
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting available personnel: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/zone-overview", response_model=Dict[str, Any])
async def get_zone_overview_with_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get zone overview with reader assignments
    
    Args:
        db: Database session
        current_user: Current authenticated user
        
    Returns:
        Zone overview with assignments data
    """
    try:
        # get_zones returns a list directly
        zones = await zone_service.get_zones(db=db)
        if not isinstance(zones, list):
            zones = []

        # get_zone_reader_assignments returns {"success": ..., "data": [...]}
        assignments_result = await zone_service.get_zone_reader_assignments(db=db)
        assignments = assignments_result.get("data", []) if isinstance(assignments_result, dict) else []
        
        # Combine zone data with assignments
        zone_overview = []
        for zone in zones:
            zone_assignments = [a for a in assignments if a["zone_id"] == zone["id"]]
            zone_readers = [a["reader"] for a in zone_assignments]
            online_readers = [r for r in zone_readers if r.get("status") == "online"]
            
            zone_overview.append({
                **zone,
                "assigned_readers": zone_readers,
                "reader_count": len(zone_readers),
                "online_readers": len(online_readers),
                "assignments": zone_assignments
            })
        
        return {
            "success": True,
            "data": zone_overview,
            "total_zones": len(zone_overview)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting zone overview: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/bulk-assignments", response_model=Dict[str, Any])
async def bulk_create_zone_reader_assignments(
    assignments_data: List[Dict[str, Any]],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create multiple zone reader assignments in bulk
    
    Args:
        assignments_data: List of assignment creation data
        db: Database session
        current_user: Current authenticated user
        
    Returns:
        Bulk creation result
    """
    try:
        # Validate required fields for each assignment
        for assignment in assignments_data:
            required_fields = ["reader_id", "zone_id"]
            for field in required_fields:
                if field not in assignment:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Missing required field: {field} in assignment"
                    )
        
        result = await zone_service.bulk_create_zone_reader_assignments(
            db=db,
            assignments_data=assignments_data
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating bulk zone reader assignments: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
