from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from ..core.database import get_db
from ..models.department import Department, DepartmentPersonnel
from ..models.personnel import Personnel
from ..services.department_service import department_service
from ..schemas.assignment import (
    AssignmentCreate, AssignmentResponse, AssignmentUpdate,
    BulkAssignmentCreate, TransferCreate, AssignmentStats,
    AssignmentListResponse
)

router = APIRouter()

# Public endpoints that don't require authentication (must come before parameterized routes)
@router.get("/public", response_model=List[dict])
async def get_public_assignments(db: Session = Depends(get_db)):
    """Get public assignment information without authentication"""
    try:
        return [
            {
                "id": 1,
                "personnel_id": 1,
                "department_id": 1,
                "role": "Engineer",
                "position": "Senior Engineer",
                "is_primary": True,
                "is_manager": False,
                "status": "ACTIVE",
                "assigned_at": "2024-01-15T08:00:00Z"
            },
            {
                "id": 2,
                "personnel_id": 2,
                "department_id": 2,
                "role": "Safety Officer",
                "position": "Safety Manager",
                "is_primary": False,
                "is_manager": True,
                "status": "ACTIVE",
                "assigned_at": "2024-01-10T08:00:00Z"
            },
            {
                "id": 3,
                "personnel_id": 3,
                "department_id": 1,
                "role": "Technician",
                "position": "Junior Technician",
                "is_primary": False,
                "is_manager": False,
                "status": "ACTIVE",
                "assigned_at": "2024-01-12T08:00:00Z"
            }
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get public assignments: {str(e)}")

@router.get("/stats/public", response_model=AssignmentStats)
async def get_public_assignment_stats(db: Session = Depends(get_db)):
    """Get public assignment statistics without authentication"""
    try:
        return {
            "total_personnel": 5,
            "total_departments": 3,
            "assigned_personnel": 3,
            "unassigned_personnel": 2,
            "active_assignments": 3,
            "pending_transfers": 0,
            "department_utilization": {
                "Engineering": 2,
                "Safety": 1,
                "Operations": 0
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get public assignment stats: {str(e)}")

@router.get("/", response_model=AssignmentListResponse)
async def get_assignments(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    department: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get all assignments with filtering and pagination
    """
    try:
        result = await department_service.get_assignments(
            db=db,
            skip=skip,
            limit=limit,
            search=search,
            department_id=department,
            status=status,
            role=role
        )
        
        return {
            "assignments": result["assignments"],
            "total": result["total"],
            "page": skip // limit + 1,
            "pages": (result["total"] + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch assignments: {str(e)}"
        )

@router.get("/stats", response_model=AssignmentStats)
async def get_assignment_stats(db: Session = Depends(get_db)) -> AssignmentStats:
    """
    Get assignment statistics
    """
    try:
        stats = await department_service.get_assignment_statistics(db)
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch assignment statistics: {str(e)}"
        )

@router.get("/department/{department_id}")
async def get_department_assignments(
    department_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get all assignments for a specific department
    """
    try:
        result = await department_service.get_department_with_assignments(department_id, db)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch department assignments: {str(e)}"
        )

@router.get("/personnel/{personnel_id}")
async def get_personnel_assignments(
    personnel_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get all assignments for a specific personnel
    """
    try:
        assignments = db.query(DepartmentPersonnel).filter(
            DepartmentPersonnel.personnel_id == personnel_id
        ).all()
        
        result = []
        for assignment in assignments:
            dept = db.query(Department).filter(
                Department.id == assignment.department_id
            ).first()
            
            result.append({
                "id": assignment.id,
                "department_id": assignment.department_id,
                "department": dept.name if dept else "Unknown",
                "role": assignment.role,
                "position": assignment.position,
                "is_primary": assignment.is_primary,
                "is_manager": assignment.is_manager,
                "status": assignment.status,
                "assigned_at": assignment.assigned_at,
                "unassigned_at": assignment.unassigned_at
            })
        
        return {"assignments": result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch personnel assignments: {str(e)}"
        )

@router.post("/", response_model=AssignmentResponse)
async def create_assignment(
    assignment: AssignmentCreate,
    db: Session = Depends(get_db)
) -> AssignmentResponse:
    """
    Create a new assignment
    """
    try:
        result = await department_service.assign_personnel_to_department(
            db=db,
            department_id=assignment.department_id,
            personnel_id=assignment.personnel_id,
            role=assignment.role,
            position=assignment.position,
            is_primary=assignment.is_primary,
            is_manager=assignment.is_manager,
            assigned_by=assignment.assigned_by
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to create assignment")
            )
        
        return AssignmentResponse(**result["assignment"])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create assignment: {str(e)}"
        )

@router.put("/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: int,
    assignment: AssignmentUpdate,
    db: Session = Depends(get_db)
) -> AssignmentResponse:
    """
    Update an existing assignment
    """
    try:
        # Get existing assignment
        existing = db.query(DepartmentPersonnel).filter(
            DepartmentPersonnel.id == assignment_id
        ).first()
        
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignment not found"
            )
        
        # Update fields
        if assignment.role is not None:
            existing.role = assignment.role
        if assignment.position is not None:
            existing.position = assignment.position
        if assignment.is_primary is not None:
            existing.is_primary = assignment.is_primary
        if assignment.is_manager is not None:
            existing.is_manager = assignment.is_manager
        if assignment.status is not None:
            existing.status = assignment.status
        
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        
        return AssignmentResponse(
            id=existing.id,
            department_id=existing.department_id,
            personnel_id=existing.personnel_id,
            role=existing.role,
            position=existing.position,
            is_primary=existing.is_primary,
            is_manager=existing.is_manager,
            status=existing.status,
            assigned_at=existing.assigned_at,
            unassigned_at=existing.unassigned_at
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update assignment: {str(e)}"
        )

@router.delete("/{assignment_id}")
async def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """
    Delete an assignment
    """
    try:
        result = await department_service.remove_personnel_from_department(
            db=db,
            assignment_id=assignment_id
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to delete assignment")
            )
        
        return {"message": "Assignment deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete assignment: {str(e)}"
        )

@router.post("/bulk-assign")
async def bulk_assign_personnel(
    bulk_data: BulkAssignmentCreate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Bulk assign personnel to a department
    """
    try:
        results = []
        
        for personnel_id in bulk_data.personnel_ids:
            result = await department_service.assign_personnel_to_department(
                db=db,
                department_id=bulk_data.department_id,
                personnel_id=personnel_id,
                role=bulk_data.role,
                position=bulk_data.position,
                is_primary=bulk_data.is_primary,
                is_manager=bulk_data.is_manager if bulk_data.is_manager is not None else False,
                assigned_by=bulk_data.assigned_by
            )
            
            if result["success"]:
                results.append({
                    "personnel_id": personnel_id,
                    "assignment_id": result["assignment"]["id"],
                    "status": "success"
                })
            else:
                results.append({
                    "personnel_id": personnel_id,
                    "status": "failed",
                    "error": result.get("error", "Unknown error")
                })
        
        success_count = sum(1 for r in results if r["status"] == "success")
        
        return {
            "message": f"Bulk assignment completed. {success_count}/{len(bulk_data.personnel_ids)} personnel assigned successfully.",
            "results": results,
            "success_count": success_count,
            "total_count": len(bulk_data.personnel_ids)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk assign personnel: {str(e)}"
        )

@router.post("/transfer")
async def transfer_personnel(
    transfer_data: TransferCreate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Transfer personnel between departments
    """
    try:
        # Get current assignment
        current_assignment = db.query(DepartmentPersonnel).filter(
            DepartmentPersonnel.personnel_id == transfer_data.personnel_id,
            DepartmentPersonnel.status == "active"
        ).first()
        
        if not current_assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active assignment found for personnel"
            )
        
        # Create transfer record
        transfer_record = {
            "personnel_id": transfer_data.personnel_id,
            "from_department_id": current_assignment.department_id,
            "to_department_id": transfer_data.to_department_id,
            "reason": transfer_data.reason,
            "effective_date": transfer_data.effective_date,
            "status": "pending",
            "requested_at": datetime.utcnow()
        }
        
        # Update current assignment
        current_assignment.status = "transferred"
        current_assignment.unassigned_at = transfer_data.effective_date or datetime.utcnow()
        
        # Create new assignment
        new_assignment = await department_service.assign_personnel_to_department(
            db=db,
            department_id=transfer_data.to_department_id,
            personnel_id=transfer_data.personnel_id,
            role=current_assignment.role,
            position=current_assignment.position,
            is_primary=current_assignment.is_primary,
            is_manager=current_assignment.is_manager,
            assigned_by=transfer_data.requested_by
        )
        
        db.commit()
        
        return {
            "message": "Personnel transfer completed successfully",
            "transfer_record": transfer_record,
            "new_assignment": new_assignment.get("assignment")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to transfer personnel: {str(e)}"
        )

@router.get("/history/{personnel_id}")
async def get_assignment_history(
    personnel_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get assignment history for personnel
    """
    try:
        assignments = db.query(DepartmentPersonnel).filter(
            DepartmentPersonnel.personnel_id == personnel_id
        ).order_by(DepartmentPersonnel.assigned_at.desc()).all()
        
        history = []
        for assignment in assignments:
            dept = db.query(Department).filter(
                Department.id == assignment.department_id
            ).first()
            
            history.append({
                "id": assignment.id,
                "department": dept.name if dept else "Unknown",
                "role": assignment.role,
                "position": assignment.position,
                "is_primary": assignment.is_primary,
                "status": assignment.status,
                "assigned_at": assignment.assigned_at,
                "unassigned_at": assignment.unassigned_at
            })
        
        return {"history": history}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch assignment history: {str(e)}"
        )

@router.get("/transfers/pending")
async def get_pending_transfers(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Get pending transfer requests
    """
    try:
        # This would typically query a transfers table
        # For now, return empty list
        return {"transfers": []}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch pending transfers: {str(e)}"
        )

@router.get("/analytics")
async def get_assignment_analytics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    department: Optional[int] = Query(None),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get assignment analytics
    """
    try:
        # Base query
        query = db.query(DepartmentPersonnel)
        
        # Apply filters
        if start_date:
            query = query.filter(DepartmentPersonnel.assigned_at >= start_date)
        if end_date:
            query = query.filter(DepartmentPersonnel.assigned_at <= end_date)
        if department:
            query = query.filter(DepartmentPersonnel.department_id == department)
        
        assignments = query.all()
        
        # Calculate analytics
        total_assignments = len(assignments)
        active_assignments = len([a for a in assignments if a.status == "active"])
        primary_assignments = len([a for a in assignments if a.is_primary])
        
        # Department breakdown
        dept_breakdown = {}
        for assignment in assignments:
            dept_id = assignment.department_id
            if dept_id not in dept_breakdown:
                dept_breakdown[dept_id] = 0
            dept_breakdown[dept_id] += 1
        
        return {
            "total_assignments": total_assignments,
            "active_assignments": active_assignments,
            "primary_assignments": primary_assignments,
            "department_breakdown": dept_breakdown,
            "period": {
                "start_date": start_date,
                "end_date": end_date
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch analytics: {str(e)}"
        )

@router.get("/export")
async def export_assignments(
    format: str = Query("csv", pattern="^(csv|excel|pdf)$"),
    department: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Export assignments data
    """
    try:
        # Get assignments data
        query = db.query(DepartmentPersonnel)
        
        if department:
            query = query.filter(DepartmentPersonnel.department_id == department)
        if status:
            query = query.filter(DepartmentPersonnel.status == status)
        
        assignments = query.all()
        
        # Convert to export format
        export_data = []
        for assignment in assignments:
            dept = db.query(Department).filter(
                Department.id == assignment.department_id
            ).first()
            personnel = db.query(Personnel).filter(
                Personnel.id == assignment.personnel_id
            ).first()
            
            if dept and personnel:
                export_data.append({
                    "Badge ID": personnel.badge_id,
                    "Name": personnel.full_name,
                    "Department": dept.name,
                    "Role": assignment.role,
                    "Position": assignment.position,
                    "Assignment Type": "Primary" if assignment.is_primary else "Secondary",
                    "Status": assignment.status,
                    "Assigned Date": assignment.assigned_at.strftime("%Y-%m-%d"),
                    "Unassigned Date": assignment.unassigned_at.strftime("%Y-%m-%d") if assignment.unassigned_at else ""
                })
        
        # This would typically generate and return a file
        # For now, return the data
        return {
            "message": f"Export data prepared in {format} format",
            "data": export_data,
            "count": len(export_data)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export assignments: {str(e)}"
        )
