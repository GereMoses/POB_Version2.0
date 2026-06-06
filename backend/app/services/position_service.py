"""
Position Management Service
Handles position CRUD operations, hierarchy management, and assignments
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from ..core.database import get_db
from ..models.position import Position, PositionAssignment, PositionTemplate, PositionLevel
from ..models.personnel import Personnel
from ..models.department import Department

logger = logging.getLogger(__name__)


class PositionService:
    """Service for position management operations"""
    
    async def get_positions(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        department_id: Optional[int] = None,
        position_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        parent_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get positions with filtering and pagination"""
        try:
            query = db.query(Position)
            
            # Apply filters
            if search:
                query = query.filter(
                    or_(
                        Position.position_name.ilike(f"%{search}%"),
                        Position.position_code.ilike(f"%{search}%"),
                        Position.description.ilike(f"%{search}%")
                    )
                )
            
            if department_id:
                query = query.filter(Position.department_id == department_id)
            
            if position_type:
                query = query.filter(Position.position_type == position_type)
            
            if is_active is not None:
                query = query.filter(Position.is_active == is_active)
            
            if parent_id is not None:
                query = query.filter(Position.parent_id == parent_id)
            
            # Get total count
            total_count = query.count()
            
            # Apply pagination
            positions = query.offset(skip).limit(limit).all()
            
            # Enhance with additional data
            result_positions = []
            for position in positions:
                position_data = {
                    "id": position.id,
                    "position_code": position.position_code,
                    "position_name": position.position_name,
                    "description": position.description,
                    "parent_id": position.parent_id,
                    "level": position.level,
                    "sort_order": position.sort_order,
                    "department_id": position.department_id,
                    "position_type": position.position_type,
                    "job_category": position.job_category,
                    "grade_level": position.grade_level,
                    "required_certifications": position.required_certifications,
                    "required_skills": position.required_skills,
                    "min_experience_years": position.min_experience_years,
                    "education_level": position.education_level,
                    "salary_range_min": position.salary_range_min,
                    "salary_range_max": position.salary_range_max,
                    "currency": position.currency,
                    "is_active": position.is_active,
                    "is_safety_critical": position.is_safety_critical,
                    "requires_background_check": position.requires_background_check,
                    "created_at": position.created_at,
                    "updated_at": position.updated_at,
                    "created_by": position.created_by,
                    "updated_by": position.updated_by,
                    "notes": position.notes
                }
                
                # Add parent name
                if position.parent_id:
                    parent = db.query(Position).filter(Position.id == position.parent_id).first()
                    position_data["parent_name"] = parent.position_name if parent else None
                
                # Add department name
                if position.department_id:
                    department = db.query(Department).filter(Department.id == position.department_id).first()
                    position_data["department_name"] = department.name if department else None
                
                # Add statistics
                position_data["personnel_count"] = 0  # Personnel.position is a free-text field, not FK

                position_data["child_positions_count"] = db.query(Position).filter(
                    Position.parent_id == position.id
                ).count()
                
                result_positions.append(position_data)
            
            return {
                "success": True,
                "data": result_positions,
                "total_count": total_count,
                "skip": skip,
                "limit": limit
            }
            
        except Exception as e:
            logger.error(f"Error getting positions: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_position_by_id(
        self,
        position_id: int,
        db: Session
    ) -> Dict[str, Any]:
        """Get position by ID"""
        try:
            position = db.query(Position).filter(Position.id == position_id).first()
            
            if not position:
                return {"success": False, "error": "Position not found"}
            
            # Enhance with additional data
            position_data = {
                "id": position.id,
                "position_code": position.position_code,
                "position_name": position.position_name,
                "description": position.description,
                "parent_id": position.parent_id,
                "level": position.level,
                "sort_order": position.sort_order,
                "department_id": position.department_id,
                "position_type": position.position_type,
                "job_category": position.job_category,
                "grade_level": position.grade_level,
                "required_certifications": position.required_certifications,
                "required_skills": position.required_skills,
                "min_experience_years": position.min_experience_years,
                "education_level": position.education_level,
                "salary_range_min": position.salary_range_min,
                "salary_range_max": position.salary_range_max,
                "currency": position.currency,
                "is_active": position.is_active,
                "is_safety_critical": position.is_safety_critical,
                "requires_background_check": position.requires_background_check,
                "created_at": position.created_at,
                "updated_at": position.updated_at,
                "created_by": position.created_by,
                "updated_by": position.updated_by,
                "notes": position.notes
            }
            
            # Add parent name
            if position.parent_id:
                parent = db.query(Position).filter(Position.id == position.parent_id).first()
                position_data["parent_name"] = parent.position_name if parent else None
            
            # Add department name
            if position.department_id:
                department = db.query(Department).filter(Department.id == position.department_id).first()
                position_data["department_name"] = department.name if department else None
            
            # Add statistics
            position_data["personnel_count"] = db.query(Personnel).filter(
                Personnel.position_id == position.id
            ).count()
            
            position_data["child_positions_count"] = db.query(Position).filter(
                Position.parent_id == position.id
            ).count()
            
            return {
                "success": True,
                "data": position_data
            }
            
        except Exception as e:
            logger.error(f"Error getting position: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def create_position(
        self,
        position_data: dict,
        db: Session,
        created_by: int = 1
    ) -> Dict[str, Any]:
        """Create new position"""
        try:
            # Check if position code already exists
            existing = db.query(Position).filter(
                Position.position_code == position_data["position_code"]
            ).first()
            
            if existing:
                return {"success": False, "error": "Position code already exists"}
            
            # Create position
            position = Position(
                position_code=position_data["position_code"],
                position_name=position_data["position_name"],
                description=position_data.get("description"),
                parent_id=position_data.get("parent_id"),
                level=position_data.get("level", 1),
                sort_order=position_data.get("sort_order", 0),
                department_id=position_data.get("department_id"),
                position_type=position_data.get("position_type"),
                job_category=position_data.get("job_category"),
                grade_level=position_data.get("grade_level"),
                required_certifications=position_data.get("required_certifications"),
                required_skills=position_data.get("required_skills"),
                min_experience_years=position_data.get("min_experience_years", 0),
                education_level=position_data.get("education_level"),
                salary_range_min=position_data.get("salary_range_min"),
                salary_range_max=position_data.get("salary_range_max"),
                currency=position_data.get("currency", "USD"),
                is_safety_critical=position_data.get("is_safety_critical", False),
                requires_background_check=position_data.get("requires_background_check", False),
                created_by=created_by,
                notes=position_data.get("notes")
            )
            
            db.add(position)
            db.commit()
            db.refresh(position)
            
            logger.info(f"Created position {position.position_code}")
            
            return {
                "success": True,
                "data": {
                    "id": position.id,
                    "position_code": position.position_code,
                    "position_name": position.position_name
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating position: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def update_position(
        self,
        position_id: int,
        position_data: dict,
        db: Session,
        updated_by: int = 1
    ) -> Dict[str, Any]:
        """Update existing position"""
        try:
            position = db.query(Position).filter(Position.id == position_id).first()
            
            if not position:
                return {"success": False, "error": "Position not found"}
            
            # Update fields
            for field, value in position_data.items():
                if hasattr(position, field):
                    setattr(position, field, value)
            
            position.updated_by = updated_by
            db.commit()
            
            logger.info(f"Updated position {position.position_code}")
            
            return {
                "success": True,
                "data": {
                    "id": position.id,
                    "position_code": position.position_code,
                    "position_name": position.position_name
                }
            }
            
        except Exception as e:
            logger.error(f"Error updating position: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def delete_position(
        self,
        position_id: int,
        db: Session
    ) -> Dict[str, Any]:
        """Delete position (soft delete)"""
        try:
            position = db.query(Position).filter(Position.id == position_id).first()
            
            if not position:
                return {"success": False, "error": "Position not found"}
            
            # Check if position has assigned personnel
            personnel_count = db.query(Personnel).filter(
                Personnel.position_id == position_id
            ).count()
            
            if personnel_count > 0:
                return {
                    "success": False, 
                    "error": f"Cannot delete position with {personnel_count} assigned personnel"
                }
            
            # Check if position has child positions
            child_count = db.query(Position).filter(
                Position.parent_id == position_id
            ).count()
            
            if child_count > 0:
                return {
                    "success": False, 
                    "error": f"Cannot delete position with {child_count} child positions"
                }
            
            # Soft delete
            position.is_active = False
            db.commit()
            
            logger.info(f"Deleted position {position.position_code}")
            
            return {
                "success": True,
                "message": "Position deleted successfully"
            }
            
        except Exception as e:
            logger.error(f"Error deleting position: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_position_hierarchy(
        self,
        db: Session,
        include_inactive: bool = False
    ) -> Dict[str, Any]:
        """Get position hierarchy tree"""
        try:
            query = db.query(Position)
            
            if not include_inactive:
                query = query.filter(Position.is_active == True)
            
            positions = query.order_by(Position.level, Position.sort_order).all()
            
            # Build hierarchy
            position_map = {pos.id: pos for pos in positions}
            root_positions = []
            
            for position in positions:
                if position.parent_id is None:
                    root_positions.append(position)
                elif position.parent_id in position_map:
                    parent = position_map[position.parent_id]
                    if not hasattr(parent, 'children'):
                        parent.children = []
                    parent.children.append(position)
            
            def build_hierarchy(positions):
                result = []
                for pos in positions:
                    pos_data = {
                        "id": pos.id,
                        "position_code": pos.position_code,
                        "position_name": pos.position_name,
                        "level": pos.level,
                        "parent_id": pos.parent_id,
                        "is_active": pos.is_active,
                        "children": []
                    }
                    
                    if hasattr(pos, 'children'):
                        pos_data["children"] = build_hierarchy(pos.children)
                    
                    result.append(pos_data)
                
                return result
            
            hierarchy = build_hierarchy(root_positions)
            
            return {
                "success": True,
                "data": hierarchy
            }
            
        except Exception as e:
            logger.error(f"Error getting position hierarchy: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_position_statistics(
        self,
        db: Session
    ) -> Dict[str, Any]:
        """Get position statistics"""
        try:
            # Total positions
            total_positions = db.query(Position).count()
            active_positions = db.query(Position).filter(Position.is_active == True).count()
            inactive_positions = total_positions - active_positions
            
            # By type
            positions_by_type = {}
            type_results = db.query(
                Position.position_type, func.count(Position.id)
            ).group_by(Position.position_type).all()
            
            for pos_type, count in type_results:
                positions_by_type[pos_type or "UNSPECIFIED"] = count
            
            # By category
            positions_by_category = {}
            category_results = db.query(
                Position.job_category, func.count(Position.id)
            ).group_by(Position.job_category).all()
            
            for category, count in category_results:
                positions_by_category[category or "UNSPECIFIED"] = count
            
            # By level
            positions_by_level = {}
            level_results = db.query(
                Position.level, func.count(Position.id)
            ).group_by(Position.level).all()
            
            for level, count in level_results:
                positions_by_level[str(level)] = count
            
            # Safety critical
            safety_critical_positions = db.query(Position).filter(
                Position.is_safety_critical == True
            ).count()
            
            # Department distribution
            positions_by_department = {}
            dept_results = db.query(
                Department.name, func.count(Position.id)
            ).join(Position, Department.id == Position.department_id).group_by(Department.name).all()
            
            for dept_name, count in dept_results:
                positions_by_department[dept_name] = count
            
            # Assignments
            total_assignments = db.query(PositionAssignment).count()
            active_assignments = db.query(PositionAssignment).filter(
                PositionAssignment.status == "ACTIVE"
            ).count()
            pending_assignments = db.query(PositionAssignment).filter(
                PositionAssignment.status == "PENDING"
            ).count()
            
            # Vacancies
            vacant_positions = db.query(Position).filter(
                and_(
                    Position.is_active == True,
                    ~Position.id.in_(
                        db.query(Personnel.position_id).filter(
                            Personnel.status == "ACTIVE"
                        ).subquery()
                    )
                )
            ).count()
            
            critical_vacancies = db.query(Position).filter(
                and_(
                    Position.is_active == True,
                    Position.is_safety_critical == True,
                    ~Position.id.in_(
                        db.query(Personnel.position_id).filter(
                            Personnel.status == "ACTIVE"
                        ).subquery()
                    )
                )
            ).count()
            
            return {
                "success": True,
                "data": {
                    "total_positions": total_positions,
                    "active_positions": active_positions,
                    "inactive_positions": inactive_positions,
                    "positions_by_type": positions_by_type,
                    "positions_by_category": positions_by_category,
                    "positions_by_level": positions_by_level,
                    "safety_critical_positions": safety_critical_positions,
                    "positions_by_department": positions_by_department,
                    "total_assignments": total_assignments,
                    "active_assignments": active_assignments,
                    "pending_assignments": pending_assignments,
                    "vacant_positions": vacant_positions,
                    "critical_vacancies": critical_vacancies
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting position statistics: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_position_assignments(
        self,
        db: Session,
        personnel_id: Optional[int] = None,
        position_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get position assignments"""
        try:
            query = db.query(PositionAssignment)
            
            if personnel_id:
                query = query.filter(PositionAssignment.personnel_id == personnel_id)
            
            if position_id:
                query = query.filter(PositionAssignment.position_id == position_id)
            
            if status:
                query = query.filter(PositionAssignment.status == status)
            
            assignments = query.order_by(desc(PositionAssignment.created_at)).all()
            
            result_assignments = []
            for assignment in assignments:
                assignment_data = {
                    "id": assignment.id,
                    "personnel_id": assignment.personnel_id,
                    "position_id": assignment.position_id,
                    "department_id": assignment.department_id,
                    "assignment_type": assignment.assignment_type,
                    "start_date": assignment.start_date,
                    "end_date": assignment.end_date,
                    "status": assignment.status,
                    "is_current": assignment.is_current,
                    "assigned_by": assignment.assigned_by,
                    "approved_by": assignment.approved_by,
                    "approved_at": assignment.approved_at,
                    "created_at": assignment.created_at,
                    "updated_at": assignment.updated_at,
                    "notes": assignment.notes
                }
                
                # Add related data
                if assignment.personnel:
                    assignment_data["personnel_name"] = assignment.personnel.full_name
                    assignment_data["personnel_badge_id"] = assignment.personnel.badge_id
                
                if assignment.position:
                    assignment_data["position_name"] = assignment.position.position_name
                    assignment_data["position_code"] = assignment.position.position_code
                
                if assignment.department:
                    assignment_data["department_name"] = assignment.department.name
                    assignment_data["department_code"] = assignment.department.code
                
                result_assignments.append(assignment_data)
            
            return {
                "success": True,
                "data": result_assignments
            }
            
        except Exception as e:
            logger.error(f"Error getting position assignments: {str(e)}")
            return {"success": False, "error": str(e)}


# Create service instance
position_service = PositionService()
