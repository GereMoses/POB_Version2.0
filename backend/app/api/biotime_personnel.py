"""
BioTime 9.5 Compatible Personnel API
Implements personnel management endpoints matching BioTime REST patterns
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, datetime

from app.core.database import get_db
from app.models.biotime_models import PersonnelEmployee, PersonnelDepartment, PersonnelArea, BaseOperationLog
from app.core.dependencies import get_current_user
from app.models.user import User as AuthUser
try:
    from app.api.biotime_auth import log_operation
except Exception:
    async def log_operation(*args, **kwargs): pass

# Router
router = APIRouter()

# Pydantic Models
class EmployeeCreate(BaseModel):
    emp_code: str
    first_name: Optional[str] = None
    last_name: str
    dept_id: Optional[int] = None
    area_id: Optional[int] = None
    position_id: Optional[int] = None
    hire_date: Optional[date] = None
    birthday: Optional[date] = None
    sex: Optional[str] = None  # M, F, O
    photo: Optional[str] = None
    card_no: Optional[str] = None
    pwd: Optional[str] = None
    status: Optional[int] = 0

class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    dept_id: Optional[int] = None
    area_id: Optional[int] = None
    position_id: Optional[int] = None
    hire_date: Optional[date] = None
    birthday: Optional[date] = None
    sex: Optional[str] = None
    photo: Optional[str] = None
    card_no: Optional[str] = None
    pwd: Optional[str] = None
    status: Optional[int] = None

class EmployeeResponse(BaseModel):
    id: int
    emp_code: str
    first_name: Optional[str] = None
    last_name: str
    dept_id: Optional[int] = None
    area_id: Optional[int] = None
    position_id: Optional[int] = None
    hire_date: Optional[date] = None
    birthday: Optional[date] = None
    sex: Optional[str] = None
    photo: Optional[str] = None
    card_no: Optional[str] = None
    status: int
    created_at: datetime
    updated_at: datetime
    
    # Include related data
    department: Optional[dict] = None
    area: Optional[dict] = None

class EmployeeListResponse(BaseModel):
    count: int
    next: Optional[str] = None
    previous: Optional[str] = None
    results: List[EmployeeResponse]

class DepartmentCreate(BaseModel):
    dept_code: Optional[str] = None
    dept_name: str
    parent_id: Optional[int] = None

class DepartmentResponse(BaseModel):
    id: int
    dept_code: Optional[str] = None
    dept_name: str
    parent_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

class AreaCreate(BaseModel):
    area_code: Optional[str] = None
    area_name: str

class AreaResponse(BaseModel):
    id: int
    area_code: Optional[str] = None
    area_name: str
    created_at: datetime
    updated_at: datetime

# Helper Functions
def get_employee_dict(employee: PersonnelEmployee, db: Session) -> dict:
    """Convert employee to dict with related data"""
    result = {
        "id": employee.id,
        "emp_code": employee.emp_code,
        "first_name": employee.first_name,
        "last_name": employee.last_name,
        "dept_id": employee.dept_id,
        "area_id": employee.area_id,
        "position_id": employee.position_id,
        "hire_date": employee.hire_date,
        "birthday": employee.birthday,
        "sex": employee.sex,
        "photo": employee.photo,
        "card_no": employee.card_no,
        "status": employee.status,
        "created_at": employee.created_at,
        "updated_at": employee.updated_at
    }
    
    # Include department info
    if employee.dept_id:
        dept = db.query(PersonnelDepartment).filter(PersonnelDepartment.id == employee.dept_id).first()
        if dept:
            result["department"] = {
                "id": dept.id,
                "dept_code": dept.dept_code,
                "dept_name": dept.dept_name
            }
    
    # Include area info
    if employee.area_id:
        area = db.query(PersonnelArea).filter(PersonnelArea.id == employee.area_id).first()
        if area:
            result["area"] = {
                "id": area.id,
                "area_code": area.area_code,
                "area_name": area.area_name
            }
    
    return result

# API Endpoints

@router.get("/personnel/api/employees/", response_model=EmployeeListResponse)
async def list_employees(
    search: Optional[str] = Query(None, description="Search by name or emp_code"),
    dept_id: Optional[int] = Query(None, description="Filter by department ID"),
    area_id: Optional[int] = Query(None, description="Filter by area ID"),
    status: Optional[int] = Query(None, description="Filter by status (0=active, 1=inactive)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List employees with pagination and filtering
    BioTime compatible endpoint: GET /personnel/api/employees/
    """
    query = db.query(PersonnelEmployee)
    
    # Apply filters
    if search:
        search_filter = or_(
            PersonnelEmployee.emp_code.ilike(f"%{search}%"),
            PersonnelEmployee.first_name.ilike(f"%{search}%"),
            PersonnelEmployee.last_name.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)
    
    if dept_id:
        query = query.filter(PersonnelEmployee.dept_id == dept_id)
    
    if area_id:
        query = query.filter(PersonnelEmployee.area_id == area_id)
    
    if status is not None:
        query = query.filter(PersonnelEmployee.status == status)
    
    # Count total results
    total_count = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    employees = query.offset(offset).limit(page_size).all()
    
    # Convert to response format
    results = [get_employee_dict(emp, db) for emp in employees]
    
    # Calculate pagination info
    next_page = page + 1 if offset + page_size < total_count else None
    previous_page = page - 1 if page > 1 else None
    
    return EmployeeListResponse(
        count=total_count,
        next=f"/personnel/api/employees/?page={next_page}&page_size={page_size}" if next_page else None,
        previous=f"/personnel/api/employees/?page={previous_page}&page_size={page_size}" if previous_page else None,
        results=results
    )

@router.post("/personnel/api/employees/", response_model=EmployeeResponse)
async def create_employee(
    employee_data: EmployeeCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create or update employee
    BioTime compatible endpoint: POST /personnel/api/employees/
    """
    # Check if employee already exists
    existing_employee = db.query(PersonnelEmployee).filter(
        PersonnelEmployee.emp_code == employee_data.emp_code
    ).first()
    
    if existing_employee:
        # Update existing employee
        update_data = employee_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(existing_employee, field, value)
        
        existing_employee.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_employee)
        
        # Log update operation
        log_operation(
            db=db,
            user_id=current_user.id,
            action="UPDATE",
            table_name="personnel_employee",
            record_id=existing_employee.id,
            new_values=str(update_data)
        )
        
        return EmployeeResponse(**get_employee_dict(existing_employee, db))
    else:
        # Create new employee
        new_employee = PersonnelEmployee(**employee_data.dict())
        db.add(new_employee)
        db.commit()
        db.refresh(new_employee)
        
        # Log creation operation
        log_operation(
            db=db,
            user_id=current_user.id,
            action="CREATE",
            table_name="personnel_employee",
            record_id=new_employee.id,
            new_values=str(employee_data.dict())
        )
        
        return EmployeeResponse(**get_employee_dict(new_employee, db))

@router.get("/personnel/api/employees/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get employee by ID
    BioTime compatible endpoint: GET /personnel/api/employees/{id}/
    """
    employee = db.query(PersonnelEmployee).filter(PersonnelEmployee.id == employee_id).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    return EmployeeResponse(**get_employee_dict(employee, db))

@router.put("/personnel/api/employees/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    employee_data: EmployeeUpdate,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update employee
    BioTime compatible endpoint: PUT /personnel/api/employees/{id}/
    """
    employee = db.query(PersonnelEmployee).filter(PersonnelEmployee.id == employee_id).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    # Store old values for audit
    old_values = get_employee_dict(employee, db)
    
    # Update employee
    update_data = employee_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(employee, field, value)
    
    employee.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(employee)
    
    # Log update operation
    log_operation(
        db=db,
        user_id=current_user.id,
        action="UPDATE",
        table_name="personnel_employee",
        record_id=employee.id,
        old_values=str(old_values),
        new_values=str(get_employee_dict(employee, db))
    )
    
    return EmployeeResponse(**get_employee_dict(employee, db))

@router.delete("/personnel/api/employees/{employee_id}")
async def delete_employee(
    employee_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete employee
    BioTime compatible endpoint: DELETE /personnel/api/employees/{id}/
    """
    employee = db.query(PersonnelEmployee).filter(PersonnelEmployee.id == employee_id).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    # Store old values for audit
    old_values = get_employee_dict(employee, db)
    
    # Delete employee
    db.delete(employee)
    db.commit()
    
    # Log deletion operation
    log_operation(
        db=db,
        user_id=current_user.id,
        action="DELETE",
        table_name="personnel_employee",
        record_id=employee_id,
        old_values=str(old_values)
    )
    
    return {"message": "Employee deleted successfully"}

# Department Endpoints

@router.get("/personnel/api/departments/", response_model=List[DepartmentResponse])
async def list_departments(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all departments
    BioTime compatible endpoint: GET /personnel/api/departments/
    """
    departments = db.query(PersonnelDepartment).all()
    return [
        DepartmentResponse(
            id=dept.id,
            dept_code=dept.dept_code,
            dept_name=dept.dept_name,
            parent_id=dept.parent_id,
            created_at=dept.created_at,
            updated_at=dept.updated_at
        )
        for dept in departments
    ]

@router.post("/personnel/api/departments/", response_model=DepartmentResponse)
async def create_department(
    dept_data: DepartmentCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create department
    BioTime compatible endpoint: POST /personnel/api/departments/
    """
    new_department = PersonnelDepartment(**dept_data.dict())
    db.add(new_department)
    db.commit()
    db.refresh(new_department)
    
    # Log creation operation
    log_operation(
        db=db,
        user_id=current_user.id,
        action="CREATE",
        table_name="personnel_department",
        record_id=new_department.id,
        new_values=str(dept_data.dict())
    )
    
    return DepartmentResponse(
        id=new_department.id,
        dept_code=new_department.dept_code,
        dept_name=new_department.dept_name,
        parent_id=new_department.parent_id,
        created_at=new_department.created_at,
        updated_at=new_department.updated_at
    )

# Area Endpoints

@router.get("/personnel/api/areas/", response_model=List[AreaResponse])
async def list_areas(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all areas
    BioTime compatible endpoint: GET /personnel/api/areas/
    """
    areas = db.query(PersonnelArea).all()
    return [
        AreaResponse(
            id=area.id,
            area_code=area.area_code,
            area_name=area.area_name,
            created_at=area.created_at,
            updated_at=area.updated_at
        )
        for area in areas
    ]

@router.post("/personnel/api/areas/", response_model=AreaResponse)
async def create_area(
    area_data: AreaCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create area
    BioTime compatible endpoint: POST /personnel/api/areas/
    """
    new_area = PersonnelArea(**area_data.dict())
    db.add(new_area)
    db.commit()
    db.refresh(new_area)
    
    # Log creation operation
    log_operation(
        db=db,
        user_id=current_user.id,
        action="CREATE",
        table_name="personnel_area",
        record_id=new_area.id,
        new_values=str(area_data.dict())
    )
    
    return AreaResponse(
        id=new_area.id,
        area_code=new_area.area_code,
        area_name=new_area.area_name,
        created_at=new_area.created_at,
        updated_at=new_area.updated_at
    )

@router.put("/personnel/api/areas/{area_id}", response_model=AreaResponse)
async def update_area(
    area_id: int,
    area_data: AreaCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    area = db.query(PersonnelArea).filter(PersonnelArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")
    area.area_code = area_data.area_code
    area.area_name = area_data.area_name
    db.commit()
    db.refresh(area)
    return AreaResponse(
        id=area.id, area_code=area.area_code, area_name=area.area_name,
        created_at=area.created_at, updated_at=area.updated_at
    )


@router.delete("/personnel/api/areas/{area_id}")
async def delete_area(
    area_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    area = db.query(PersonnelArea).filter(PersonnelArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")
    # Block if devices are assigned
    from sqlalchemy import text as _text
    count = db.execute(
        _text("SELECT COUNT(*) FROM iclock_terminal WHERE area_id = :aid"), {"aid": area_id}
    ).scalar()
    if count:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: {count} device(s) assigned to this area. Reassign them first."
        )
    db.delete(area)
    db.commit()
    return {"message": f"Area '{area.area_name}' deleted"}
