"""
Visitor Management API - BioTime 9.5 Compatible + POB Extensions
REST API endpoints for visitor management with pre-registration, check-in/out,
blacklist, host approval, and mustering integration.
"""

from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.visitor_service import VisitorService
from app.schemas.visitor import (
    VisitorType, VisitorTypeCreate, VisitorTypeUpdate,
    Visitor, VisitorCreate, VisitorUpdate,
    VisitorPreRegistration, VisitorPreRegistrationCreate, VisitorPreRegistrationUpdate,
    VisitorVisitLog, VisitorCheckIn, VisitorCheckOut,
    VisitorBlacklist, VisitorBlacklistCreate, VisitorBlacklistUpdate,
    VisitorApprovalRequest, VisitorQRResponse,
    VisitorDailyReport, VisitorOverstayReport,
    VisitorTypeResponse, VisitorTypeListResponse,
    VisitorResponse, VisitorListResponse,
    VisitorPreRegistrationResponse, VisitorPreRegistrationListResponse,
    VisitorVisitLogResponse, VisitorVisitLogListResponse,
    VisitorBlacklistResponse, VisitorBlacklistListResponse,
    VisitorQRResponseWrapper, VisitorDailyReportResponse,
    VisitorOverstayReportListResponse
)
from app.core.exceptions import ValidationError, NotFoundError

router = APIRouter(prefix="/api/visitor", tags=["Visitor Management"])


# Helper function to get visitor service
def get_visitor_service(db: Session = Depends(get_db)) -> VisitorService:
    return VisitorService(db)


# Dashboard Stats
@router.get("/dashboard/stats/")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get dashboard summary statistics"""
    try:
        service = get_visitor_service(db)
        stats = service.get_dashboard_stats()
        return {"success": True, "data": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Visitor Type Endpoints
@router.get("/types/", response_model=VisitorTypeListResponse)
async def get_visitor_types(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all visitor types"""
    try:
        service = get_visitor_service(db)
        types = service.get_visitor_types(include_inactive)
        return VisitorTypeListResponse(
            success=True,
            message="Visitor types retrieved successfully",
            data=types
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/types/", response_model=VisitorTypeResponse)
async def create_visitor_type(
    type_data: VisitorTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new visitor type"""
    try:
        service = get_visitor_service(db)
        visitor_type = service.create_visitor_type(type_data.dict())
        return VisitorTypeResponse(
            success=True,
            message="Visitor type created successfully",
            data=visitor_type
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/types/{type_id}", response_model=VisitorTypeResponse)
async def update_visitor_type(
    type_id: int,
    type_data: VisitorTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update visitor type"""
    try:
        service = get_visitor_service(db)
        visitor_type = service.update_visitor_type(type_id, type_data.dict(exclude_unset=True))
        return VisitorTypeResponse(
            success=True,
            message="Visitor type updated successfully",
            data=visitor_type
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/types/{type_id}")
async def delete_visitor_type(
    type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete visitor type"""
    try:
        service = get_visitor_service(db)
        service.update_visitor_type(type_id, {"is_active": False})
        return {"success": True, "message": "Visitor type deleted successfully"}
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


# Visitor CRUD Endpoints
@router.get("/visitors/", response_model=VisitorListResponse)
async def get_visitors(
    search: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    id_no: Optional[str] = Query(None),
    blacklist: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get visitors with filters"""
    try:
        service = get_visitor_service(db)
        visitors = service.get_visitors(search, phone, id_no, blacklist, skip, limit)
        return VisitorListResponse(
            success=True,
            message="Visitors retrieved successfully",
            data=visitors
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/visitors/", response_model=VisitorResponse)
async def create_visitor(
    visitor_data: VisitorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new visitor"""
    try:
        service = get_visitor_service(db)
        visitor = service.create_visitor(visitor_data)
        return VisitorResponse(
            success=True,
            message="Visitor created successfully",
            data=visitor
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/visitors/{visitor_id}", response_model=VisitorResponse)
async def get_visitor(
    visitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get visitor by ID"""
    try:
        service = get_visitor_service(db)
        visitors = service.get_visitors()
        visitor = next((v for v in visitors if v.id == visitor_id), None)
        if not visitor:
            raise HTTPException(status_code=404, detail="Visitor not found")
        
        return VisitorResponse(
            success=True,
            message="Visitor retrieved successfully",
            data=visitor
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/visitors/{visitor_id}", response_model=VisitorResponse)
async def update_visitor(
    visitor_id: int,
    visitor_data: VisitorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update visitor information"""
    try:
        service = get_visitor_service(db)
        visitor = service.update_visitor(visitor_id, visitor_data)
        return VisitorResponse(
            success=True,
            message="Visitor updated successfully",
            data=visitor
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/visitors/{visitor_id}/blacklist")
async def blacklist_visitor(
    visitor_id: int,
    reason: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Blacklist a visitor"""
    try:
        service = get_visitor_service(db)
        visitor = service.blacklist_visitor(visitor_id, reason.get("reason", ""))
        return VisitorResponse(
            success=True,
            message="Visitor blacklisted successfully",
            data=visitor
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Pre-Registration Endpoints
@router.get("/pre-register/", response_model=VisitorPreRegistrationListResponse)
async def get_pre_registrations(
    status: Optional[int] = Query(None),
    host_id: Optional[int] = Query(None),
    visit_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get pre-registrations with filters"""
    try:
        service = get_visitor_service(db)
        pre_regs = service.get_pre_registrations(status, host_id, visit_date)
        return VisitorPreRegistrationListResponse(
            success=True,
            message="Pre-registrations retrieved successfully",
            data=pre_regs
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pre-register/", response_model=VisitorPreRegistrationResponse)
async def create_pre_registration(
    pre_reg_data: VisitorPreRegistrationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create visitor pre-registration"""
    try:
        service = get_visitor_service(db)
        pre_reg = service.create_pre_registration(pre_reg_data, current_user.id)
        return VisitorPreRegistrationResponse(
            success=True,
            message="Pre-registration created successfully",
            data=pre_reg
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/pre-register/{pre_reg_id}", response_model=VisitorPreRegistrationResponse)
async def get_pre_registration(
    pre_reg_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get pre-registration by ID"""
    try:
        service = get_visitor_service(db)
        pre_regs = service.get_pre_registrations()
        pre_reg = next((pr for pr in pre_regs if pr.id == pre_reg_id), None)
        if not pre_reg:
            raise HTTPException(status_code=404, detail="Pre-registration not found")
        
        return VisitorPreRegistrationResponse(
            success=True,
            message="Pre-registration retrieved successfully",
            data=pre_reg
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pre-register/{pre_reg_id}/qr", response_model=VisitorQRResponseWrapper)
async def get_qr_code(
    pre_reg_id: int,
    db: Session = Depends(get_db)
):
    """Get QR code for pre-registration"""
    try:
        service = get_visitor_service(db)
        pre_regs = service.get_pre_registrations()
        pre_reg = next((pr for pr in pre_regs if pr.id == pre_reg_id), None)
        if not pre_reg:
            raise HTTPException(status_code=404, detail="Pre-registration not found")
        
        qr_data = VisitorQRResponse(
            qr_code=pre_reg.qr_code,
            visitor_name=pre_reg.visitor.full_name if pre_reg.visitor else "Unknown",
            company=pre_reg.visitor.company if pre_reg.visitor else None,
            host_name=pre_reg.host_employee.full_name if pre_reg.host_employee else None,
            visit_date=pre_reg.visit_date,
            visit_time_start=pre_reg.visit_time_start,
            visit_time_end=pre_reg.visit_time_end,
            purpose=pre_reg.purpose,
            status=pre_reg.status
        )
        
        return VisitorQRResponseWrapper(
            success=True,
            message="QR code retrieved successfully",
            data=qr_data
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pre-register/{pre_reg_id}/approve")
async def approve_pre_registration(
    pre_reg_id: int,
    approval_data: VisitorApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve or reject pre-registration"""
    try:
        service = get_visitor_service(db)
        pre_reg = service.approve_pre_registration(pre_reg_id, approval_data, current_user.id)
        return VisitorPreRegistrationResponse(
            success=True,
            message=f"Pre-registration {approval_data.status == 1 and 'approved' or 'rejected'} successfully",
            data=pre_reg
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/pre-register/{pre_reg_id}/resend")
async def resend_pre_registration(
    pre_reg_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Resend pre-registration email/SMS"""
    try:
        # TODO: Implement email/SMS resend logic
        return {"success": True, "message": "Pre-registration resent successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Public QR Scan Endpoint (No auth required)
@router.get("/qr/{qr_code}", response_model=VisitorQRResponseWrapper)
async def scan_qr_code(
    qr_code: str,
    db: Session = Depends(get_db)
):
    """Public endpoint to scan QR code and get pre-registration data"""
    try:
        service = get_visitor_service(db)
        pre_reg = service.get_pre_registration_by_qr(qr_code)
        if not pre_reg:
            raise HTTPException(status_code=404, detail="QR code not found")
        
        qr_data = VisitorQRResponse(
            qr_code=pre_reg.qr_code,
            visitor_name=pre_reg.visitor.full_name if pre_reg.visitor else "Unknown",
            company=pre_reg.visitor.company if pre_reg.visitor else None,
            host_name=pre_reg.host_employee.full_name if pre_reg.host_employee else None,
            visit_date=pre_reg.visit_date,
            visit_time_start=pre_reg.visit_time_start,
            visit_time_end=pre_reg.visit_time_end,
            purpose=pre_reg.purpose,
            status=pre_reg.status
        )
        
        return VisitorQRResponseWrapper(
            success=True,
            message="QR code scanned successfully",
            data=qr_data
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Check-In/Check-Out Endpoints
@router.post("/check-in/", response_model=VisitorVisitLogResponse)
async def check_in_visitor(
    check_in_data: VisitorCheckIn,
    device_sn: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check-in visitor"""
    try:
        service = get_visitor_service(db)
        visit_log = service.check_in_visitor(check_in_data, device_sn, current_user.id)
        return VisitorVisitLogResponse(
            success=True,
            message="Visitor checked in successfully",
            data=visit_log
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/check-out/", response_model=VisitorVisitLogResponse)
async def check_out_visitor(
    check_out_data: VisitorCheckOut,
    device_sn: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check-out visitor"""
    try:
        service = get_visitor_service(db)
        visit_log = service.check_out_visitor(check_out_data, device_sn)
        return VisitorVisitLogResponse(
            success=True,
            message="Visitor checked out successfully",
            data=visit_log
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Records Endpoints
@router.get("/records/", response_model=VisitorVisitLogListResponse)
async def get_visitor_records(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    host_id: Optional[int] = Query(None),
    status: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get visitor records"""
    try:
        service = get_visitor_service(db)
        visit_logs = service.get_visit_records(start_date, end_date, host_id, status, search, skip, limit)
        return VisitorVisitLogListResponse(
            success=True,
            message="Visitor records retrieved successfully",
            data=visit_logs
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/records/on-site/", response_model=VisitorVisitLogListResponse)
async def get_on_site_visitors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get visitors currently on site"""
    try:
        service = get_visitor_service(db)
        visitors = service.get_on_site_visitors()
        return VisitorVisitLogListResponse(
            success=True,
            message="On-site visitors retrieved successfully",
            data=visitors
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Blacklist Endpoints
@router.get("/blacklist/", response_model=VisitorBlacklistListResponse)
async def get_blacklist(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get blacklist entries"""
    try:
        service = get_visitor_service(db)
        blacklist = service.get_blacklist(search)
        return VisitorBlacklistListResponse(
            success=True,
            message="Blacklist retrieved successfully",
            data=blacklist
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/blacklist/", response_model=VisitorBlacklistResponse)
async def add_to_blacklist(
    blacklist_data: VisitorBlacklistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add entry to blacklist"""
    try:
        service = get_visitor_service(db)
        blacklist = service.add_to_blacklist(blacklist_data.dict(), current_user.id)
        return VisitorBlacklistResponse(
            success=True,
            message="Added to blacklist successfully",
            data=blacklist
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/blacklist/{blacklist_id}", response_model=VisitorBlacklistResponse)
async def update_blacklist(
    blacklist_id: int,
    blacklist_data: VisitorBlacklistUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update blacklist entry"""
    try:
        service = get_visitor_service(db)
        entry = service.update_blacklist_entry(blacklist_id, blacklist_data.dict(exclude_unset=True))
        return VisitorBlacklistResponse(success=True, message="Blacklist updated successfully", data=entry)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/blacklist/{blacklist_id}")
async def remove_from_blacklist(
    blacklist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove from blacklist"""
    try:
        service = get_visitor_service(db)
        service.remove_from_blacklist(blacklist_id)
        return {"success": True, "message": "Removed from blacklist successfully"}
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Reports Endpoints
@router.get("/reports/daily/", response_model=VisitorDailyReportResponse)
async def get_daily_report(
    report_date: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate daily visitor report"""
    try:
        service = get_visitor_service(db)
        report = service.get_daily_report(report_date)
        return VisitorDailyReportResponse(
            success=True,
            message="Daily report generated successfully",
            data=report
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/overstay/", response_model=VisitorOverstayReportListResponse)
async def get_overstay_report(
    hours: int = Query(8, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get overstay report"""
    try:
        service = get_visitor_service(db)
        overstays = service.get_overstay_report(hours)
        return VisitorOverstayReportListResponse(
            success=True,
            message="Overstay report generated successfully",
            data=overstays
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/mustering-compliance/")
async def get_mustering_compliance_report(
    event_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate mustering compliance report for visitors"""
    try:
        # TODO: Implement mustering compliance report
        return {"success": True, "message": "Mustering compliance report generated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
