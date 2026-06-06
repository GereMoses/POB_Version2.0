"""
BioTime 9.5 Compatible Attendance API
Implements attendance management endpoints matching BioTime REST patterns
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date

from app.core.database import get_db
from app.models.biotime_models import (
    IClockTransaction, IClockTerminal, PersonnelEmployee, 
    AttLeave, AttTimetable, AttShift, AttSchedule
)
from app.core.dependencies import get_current_user
from app.models.user import User as AuthUser
try:
    from app.api.biotime_auth import log_operation
except Exception:
    async def log_operation(*args, **kwargs): pass

# Router
router = APIRouter()

# Pydantic Models
class TransactionResponse(BaseModel):
    id: int
    emp_code: str
    punch_time: datetime
    punch_state: Optional[int] = None
    verify_type: Optional[int] = None
    work_code: Optional[int] = None
    terminal_sn: Optional[str] = None
    area_alias: Optional[str] = None
    upload_time: datetime

class ManualLogRequest(BaseModel):
    emp_code: str
    punch_time: datetime
    punch_state: int  # 0=check-in, 1=check-out, 2=break-out, 3=break-in
    verify_type: Optional[int] = 0
    work_code: Optional[int] = None
    terminal_sn: Optional[str] = None

class LeaveRequest(BaseModel):
    emp_code: str
    leave_type: str
    start_date: date
    end_date: date
    days_count: Optional[float] = None

class LeaveResponse(BaseModel):
    id: int
    emp_code: str
    leave_type: str
    start_date: date
    end_date: date
    days_count: float
    status: int  # 0=pending, 1=approved, 2=rejected
    approved_by: Optional[str] = None
    approved_time: Optional[datetime] = None
    created_at: datetime

class AccrualBalanceRequest(BaseModel):
    emp_code: str
    leave_type: str

class AccrualBalanceResponse(BaseModel):
    emp_code: str
    leave_type: str
    balance: float
    used: float
    available: float

class TransactionListResponse(BaseModel):
    count: int
    next: Optional[str] = None
    previous: Optional[str] = None
    results: List[TransactionResponse]

# Helper Functions
def get_transaction_dict(transaction: IClockTransaction) -> dict:
    """Convert transaction to dict"""
    return {
        "id": transaction.id,
        "emp_code": transaction.emp_code,
        "punch_time": transaction.punch_time,
        "punch_state": transaction.punch_state,
        "verify_type": transaction.verify_type,
        "work_code": transaction.work_code,
        "terminal_sn": transaction.terminal_sn,
        "area_alias": transaction.area_alias,
        "upload_time": transaction.upload_time
    }

# API Endpoints

@router.get("/attendance/api/transactions/", response_model=TransactionListResponse)
async def list_transactions(
    emp_code: Optional[str] = Query(None, description="Filter by employee code"),
    start_time: Optional[datetime] = Query(None, description="Start time filter"),
    end_time: Optional[datetime] = Query(None, description="End time filter"),
    terminal_sn: Optional[str] = Query(None, description="Filter by terminal SN"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List attendance transactions with pagination and filtering
    BioTime compatible endpoint: GET /attendance/api/transactions/
    """
    query = db.query(IClockTransaction)
    
    # Apply filters
    if emp_code:
        query = query.filter(IClockTransaction.emp_code == emp_code)
    
    if start_time:
        query = query.filter(IClockTransaction.punch_time >= start_time)
    
    if end_time:
        query = query.filter(IClockTransaction.punch_time <= end_time)
    
    if terminal_sn:
        query = query.filter(IClockTransaction.terminal_sn == terminal_sn)
    
    # Order by punch time descending
    query = query.order_by(IClockTransaction.punch_time.desc())
    
    # Count total results
    total_count = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    transactions = query.offset(offset).limit(page_size).all()
    
    # Convert to response format
    results = [get_transaction_dict(txn) for txn in transactions]
    
    # Calculate pagination info
    next_page = page + 1 if offset + page_size < total_count else None
    previous_page = page - 1 if page > 1 else None
    
    return TransactionListResponse(
        count=total_count,
        next=f"/attendance/api/transactions/?page={next_page}&page_size={page_size}" if next_page else None,
        previous=f"/attendance/api/transactions/?page={previous_page}&page_size={page_size}" if previous_page else None,
        results=results
    )

@router.post("/attendance/api/manual-log/", response_model=TransactionResponse)
async def create_manual_log(
    log_data: ManualLogRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create manual attendance log
    BioTime compatible endpoint: POST /attendance/api/manual-log/
    """
    # Validate employee exists
    employee = db.query(PersonnelEmployee).filter(
        PersonnelEmployee.emp_code == log_data.emp_code
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    # Validate terminal exists if provided
    if log_data.terminal_sn:
        terminal = db.query(IClockTerminal).filter(
            IClockTerminal.sn == log_data.terminal_sn
        ).first()
        
        if not terminal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Terminal not found"
            )
    
    # Create transaction
    new_transaction = IClockTransaction(
        emp_code=log_data.emp_code,
        punch_time=log_data.punch_time,
        punch_state=log_data.punch_state,
        verify_type=log_data.verify_type,
        work_code=log_data.work_code,
        terminal_sn=log_data.terminal_sn,
        area_alias=terminal.alias if log_data.terminal_sn else None
    )
    
    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)
    
    # Log manual entry creation
    log_operation(
        db=db,
        user_id=current_user.id,
        action="MANUAL_LOG",
        table_name="iclock_transaction",
        record_id=new_transaction.id,
        new_values=str(log_data.dict())
    )
    
    return TransactionResponse(**get_transaction_dict(new_transaction))

@router.get("/attendance/api/leave/", response_model=List[LeaveResponse])
async def list_leave_requests(
    emp_code: Optional[str] = Query(None, description="Filter by employee code"),
    status: Optional[int] = Query(None, description="Filter by status (0=pending, 1=approved, 2=rejected)"),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List leave requests
    BioTime compatible endpoint: GET /attendance/api/leave/
    """
    query = db.query(AttLeave)
    
    if emp_code:
        query = query.filter(AttLeave.emp_code == emp_code)
    
    if status is not None:
        query = query.filter(AttLeave.status == status)
    
    leaves = query.order_by(AttLeave.created_at.desc()).all()
    
    return [
        LeaveResponse(
            id=leave.id,
            emp_code=leave.emp_code,
            leave_type=leave.leave_type,
            start_date=leave.start_date,
            end_date=leave.end_date,
            days_count=leave.days_count or 0,
            status=leave.status,
            approved_by=leave.approved_by,
            approved_time=leave.approved_time,
            created_at=leave.created_at
        )
        for leave in leaves
    ]

@router.post("/attendance/api/leave/", response_model=LeaveResponse)
async def create_leave_request(
    leave_data: LeaveRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create leave request
    BioTime compatible endpoint: POST /attendance/api/leave/
    """
    # Validate employee exists
    employee = db.query(PersonnelEmployee).filter(
        PersonnelEmployee.emp_code == leave_data.emp_code
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    # Calculate days count if not provided
    days_count = leave_data.days_count
    if days_count is None:
        delta = leave_data.end_date - leave_data.start_date
        days_count = delta.days + 1  # Include both start and end dates
    
    # Create leave request
    new_leave = AttLeave(
        emp_code=leave_data.emp_code,
        leave_type=leave_data.leave_type,
        start_date=leave_data.start_date,
        end_date=leave_data.end_date,
        days_count=days_count,
        status=0  # Pending
    )
    
    db.add(new_leave)
    db.commit()
    db.refresh(new_leave)
    
    # Log leave request creation
    log_operation(
        db=db,
        user_id=current_user.id,
        action="CREATE_LEAVE",
        table_name="att_leave",
        record_id=new_leave.id,
        new_values=str(leave_data.dict())
    )
    
    return LeaveResponse(
        id=new_leave.id,
        emp_code=new_leave.emp_code,
        leave_type=new_leave.leave_type,
        start_date=new_leave.start_date,
        end_date=new_leave.end_date,
        days_count=new_leave.days_count,
        status=new_leave.status,
        approved_by=new_leave.approved_by,
        approved_time=new_leave.approved_time,
        created_at=new_leave.created_at
    )

@router.post("/attendance/api/accrual-balance/", response_model=AccrualBalanceResponse)
async def get_accrual_balance(
    request: AccrualBalanceRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get leave accrual balance
    BioTime compatible endpoint: POST /attendance/api/accrual-balance/
    """
    # Validate employee exists
    employee = db.query(PersonnelEmployee).filter(
        PersonnelEmployee.emp_code == request.emp_code
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    # Calculate used leave days
    used_leave = db.query(func.sum(AttLeave.days_count)).filter(
        and_(
            AttLeave.emp_code == request.emp_code,
            AttLeave.leave_type == request.leave_type,
            AttLeave.status == 1  # Approved
        )
    ).scalar() or 0
    
    # Default accrual rates (can be configured per leave type)
    accrual_rates = {
        "annual": 21,  # 21 days per year
        "sick": 10,   # 10 days per year
        "maternity": 90,  # 90 days
        "paternity": 14,   # 14 days
    }
    
    # Calculate total accrued (simplified - in real system would consider hire date)
    total_accrued = accrual_rates.get(request.leave_type.lower(), 0)
    
    # Calculate available balance
    available = total_accrued - used_leave
    
    return AccrualBalanceResponse(
        emp_code=request.emp_code,
        leave_type=request.leave_type,
        balance=total_accrued,
        used=used_leave,
        available=available
    )

@router.get("/attendance/api/summary/")
async def get_attendance_summary(
    emp_code: Optional[str] = Query(None, description="Filter by employee code"),
    start_date: Optional[date] = Query(None, description="Start date for summary"),
    end_date: Optional[date] = Query(None, description="End date for summary"),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get attendance summary
    BioTime compatible endpoint: GET /attendance/api/summary/
    """
    query = db.query(IClockTransaction)
    
    if emp_code:
        query = query.filter(IClockTransaction.emp_code == emp_code)
    
    if start_date:
        query = query.filter(IClockTransaction.punch_time >= datetime.combine(start_date, datetime.min.time()))
    
    if end_date:
        query = query.filter(IClockTransaction.punch_time <= datetime.combine(end_date, datetime.max.time()))
    
    # Get all transactions
    transactions = query.order_by(IClockTransaction.punch_time).all()
    
    # Calculate summary statistics
    total_transactions = len(transactions)
    unique_employees = len(set(txn.emp_code for txn in transactions))
    
    # Group by employee
    employee_summary = {}
    for txn in transactions:
        if txn.emp_code not in employee_summary:
            employee_summary[txn.emp_code] = {
                "total_punches": 0,
                "check_ins": 0,
                "check_outs": 0,
                "first_punch": txn.punch_time,
                "last_punch": txn.punch_time
            }
        
        emp_stats = employee_summary[txn.emp_code]
        emp_stats["total_punches"] += 1
        
        if txn.punch_state == 0:  # Check-in
            emp_stats["check_ins"] += 1
        elif txn.punch_state == 1:  # Check-out
            emp_stats["check_outs"] += 1
        
        if txn.punch_time < emp_stats["first_punch"]:
            emp_stats["first_punch"] = txn.punch_time
        if txn.punch_time > emp_stats["last_punch"]:
            emp_stats["last_punch"] = txn.punch_time
    
    return {
        "summary": {
            "total_transactions": total_transactions,
            "unique_employees": unique_employees,
            "date_range": {
                "start_date": start_date,
                "end_date": end_date
            }
        },
        "employee_breakdown": employee_summary
    }

@router.get("/attendance/api/terminals/")
async def get_attendance_terminals(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get terminals for attendance
    BioTime compatible endpoint: GET /attendance/api/terminals/
    """
    terminals = db.query(IClockTerminal).filter(IClockTerminal.state == 1).all()
    
    return [
        {
            "id": terminal.id,
            "sn": terminal.sn,
            "alias": terminal.alias,
            "ip_address": terminal.ip_address,
            "area_id": terminal.area_id,
            "last_activity": terminal.last_activity,
            "state": terminal.state
        }
        for terminal in terminals
    ]
