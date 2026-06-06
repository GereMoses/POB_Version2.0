"""
Temporary personnel endpoint using raw SQL
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.core.database import get_db

router = APIRouter()

class PersonnelResponse(BaseModel):
    id: int
    badge_id: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: str
    department: Optional[str] = None
    role: str
    position: Optional[str] = None
    status: str
    current_location: Optional[str] = None
    current_zone: Optional[str] = None
    is_onboard: bool
    created_at: str

class PersonnelCreate(BaseModel):
    badge_id: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: str
    department: Optional[str] = None
    role: str
    position: Optional[str] = None

@router.get("/", response_model=List[PersonnelResponse])
async def get_personnel(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: Session = Depends(get_db)
) -> Any:
    """Get personnel list using raw SQL"""
    try:
        # Validate sort_by parameter
        valid_sort_fields = ["id", "badge_id", "full_name", "email", "company", "department", "role", "position", "status", "created_at"]
        if sort_by not in valid_sort_fields:
            sort_by = "created_at"
        
        # Validate sort_order
        if sort_order not in ["asc", "desc"]:
            sort_order = "desc"
        
        query = text(f"""
            SELECT id, badge_id, full_name, email, phone, company, department, role, position,
                   status, current_location, current_zone, is_onboard, created_at
            FROM personnel 
            ORDER BY {sort_by} {sort_order.upper()}
            LIMIT :limit OFFSET :skip
        """)
        
        result = db.execute(query, {"limit": limit, "skip": skip})
        personnel_list = result.fetchall()
        
        return [
            PersonnelResponse(
                id=row[0],
                badge_id=row[1],
                full_name=row[2],
                email=row[3],
                phone=row[4],
                company=row[5],
                department=row[6],
                role=row[7],
                position=row[8],
                status=row[9],
                current_location=row[10],
                current_zone=row[11],
                is_onboard=row[12],
                created_at=row[13].isoformat() if row[13] else ""
            )
            for row in personnel_list
        ]
        
    except Exception as e:
        print(f"Get personnel error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting personnel: {str(e)}"
        )

@router.get("/dashboard")
async def get_personnel_dashboard(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get personnel dashboard statistics using raw SQL"""
    try:
        # Get total personnel count
        total_query = text("SELECT COUNT(*) FROM personnel")
        total_result = db.execute(total_query)
        total_personnel = total_result.scalar() or 0
        
        # Get personnel by status
        status_query = text("""
            SELECT status, COUNT(*) as count
            FROM personnel
            GROUP BY status
        """)
        status_result = db.execute(status_query)
        status_counts = {row[0]: row[1] for row in status_result.fetchall()}
        
        # Get personnel by company
        company_query = text("""
            SELECT company, COUNT(*) as count
            FROM personnel
            GROUP BY company
            ORDER BY count DESC
            LIMIT 10
        """)
        company_result = db.execute(company_query)
        company_counts = {row[0]: row[1] for row in company_result.fetchall()}
        
        return {
            "total_personnel": total_personnel,
            "by_status": status_counts,
            "by_company": company_counts,
            "recent_personnel": []
        }
        
    except Exception as e:
        print(f"Personnel dashboard error: {e}")
        return {
            "total_personnel": 0,
            "by_status": {},
            "by_company": {},
            "recent_personnel": []
        }

@router.post("/", response_model=PersonnelResponse)
async def create_personnel(
    personnel_data: PersonnelCreate,
    db: Session = Depends(get_db)
) -> Any:
    """Create personnel using raw SQL"""
    try:
        # Check if badge_id already exists
        check_query = text("SELECT id FROM personnel WHERE badge_id = :badge_id")
        existing = db.execute(check_query, {"badge_id": personnel_data.badge_id}).fetchone()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Badge ID already exists"
            )
        
        # Insert new personnel
        insert_query = text("""
            INSERT INTO personnel (badge_id, full_name, email, phone, company, department, role, position, status, is_onboard)
            VALUES (:badge_id, :full_name, :email, :phone, :company, :department, :role, :position, 'active', false)
            RETURNING id, badge_id, full_name, email, phone, company, department, role, position, status, current_location, current_zone, is_onboard, created_at
        """)
        
        result = db.execute(insert_query, {
            "badge_id": personnel_data.badge_id,
            "full_name": personnel_data.full_name,
            "email": personnel_data.email,
            "phone": personnel_data.phone,
            "company": personnel_data.company,
            "department": personnel_data.department,
            "role": personnel_data.role,
            "position": personnel_data.position
        })
        
        row = result.fetchone()
        db.commit()
        
        return PersonnelResponse(
            id=row[0],
            badge_id=row[1],
            full_name=row[2],
            email=row[3],
            phone=row[4],
            company=row[5],
            department=row[6],
            role=row[7],
            position=row[8],
            status=row[9],
            current_location=row[10],
            current_zone=row[11],
            is_onboard=row[12],
            created_at=row[13].isoformat() if row[13] else ""
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create personnel error: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating personnel: {str(e)}"
        )
