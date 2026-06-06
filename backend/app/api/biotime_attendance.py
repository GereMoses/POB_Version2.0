"""
BioTime Attendance Integration API

This module provides comprehensive attendance integration with ZKTeco BioTime,
including real-time attendance processing, reporting, and analytics.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json

from ..core.database import get_db
from ..services.biotime_sync_service import biotime_sync_service
from ..services.biotime_client import biotime_client
from ..models.personnel import AttendanceLog, Personnel

router = APIRouter()


# Attendance Synchronization

@router.post("/sync/from-biotime")
async def sync_attendance_from_biotime(
    date_from: Optional[datetime] = Query(None, description="Start date for attendance sync"),
    date_to: Optional[datetime] = Query(None, description="End date for attendance sync"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Sync attendance records from BioTime to POB system
    
    Args:
        date_from: Start date for attendance sync
        date_to: End date for attendance sync
        db: Database session
        
    Returns:
        Sync result with statistics
    """
    try:
        result = await biotime_sync_service.sync_attendance_from_biotime(db, date_from=date_from)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync attendance from BioTime: {str(e)}"
        )


@router.post("/sync/to-biotime")
async def sync_attendance_to_biotime(
    date_from: datetime = Query(..., description="Start date for attendance sync"),
    date_to: datetime = Query(..., description="End date for attendance sync"),
    personnel_ids: Optional[List[int]] = Query(None, description="Specific personnel IDs to sync"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Sync attendance records from POB to BioTime
    
    Args:
        date_from: Start date for attendance sync
        date_to: End date for attendance sync
        personnel_ids: Specific personnel IDs to sync
        db: Database session
        
    Returns:
        Sync result with statistics
    """
    try:
        # Get attendance records from POB database
        query = db.query(AttendanceLog).join(Personnel)
        
        if date_from:
            query = query.filter(AttendanceLog.timestamp >= date_from)
        if date_to:
            query = query.filter(AttendanceLog.timestamp <= date_to)
        if personnel_ids:
            query = query.filter(AttendanceLog.personnel_id.in_(personnel_ids))
        
        attendance_records = query.all()
        
        synced_count = 0
        errors = []
        
        for record in attendance_records:
            try:
                # Map to BioTime format
                biotime_data = {
                    "employee_id": record.personnel.badge_id if record.personnel else "",
                    "timestamp": record.timestamp.isoformat() if record.timestamp else None,
                    "device_id": record.device_id or "",
                    "device_type": record.device_type or "",
                    "punch_type": record.event_type.upper() if record.event_type else "CHECKIN",
                    "verification_method": record.verification_method or "",
                    "verification_score": record.verification_score,
                    "network_type": record.network_type or "",
                    "raw_data": record.raw_data or {}
                }
                
                # Send to BioTime
                result = await biotime_client.create_attendance_record(biotime_data)
                
                if result.get("success", False):
                    synced_count += 1
                else:
                    error_msg = f"Failed to sync attendance for {record.personnel.badge_id}: {result.get('error', 'Unknown error')}"
                    errors.append(error_msg)
                    
            except Exception as e:
                error_msg = f"Error syncing attendance record: {str(e)}"
                errors.append(error_msg)
        
        return {
            "success": len(errors) == 0,
            "synced_count": synced_count,
            "total_count": len(attendance_records),
            "errors": errors,
            "sync_period": {
                "from": date_from.isoformat(),
                "to": date_to.isoformat()
            },
            "sync_time": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync attendance to BioTime: {str(e)}"
        )


@router.get("/records")
async def get_attendance_records(
    date_from: Optional[datetime] = Query(None, description="Start date for records"),
    date_to: Optional[datetime] = Query(None, description="End date for records"),
    personnel_ids: Optional[List[int]] = Query(None, description="Filter by personnel IDs"),
    device_ids: Optional[List[str]] = Query(None, description="Filter by device IDs"),
    event_types: Optional[List[str]] = Query(None, description="Filter by event types"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get attendance records with filtering options
    
    Args:
        date_from: Start date for records
        date_to: End date for records
        personnel_ids: Filter by personnel IDs
        device_ids: Filter by device IDs
        event_types: Filter by event types
        limit: Maximum number of records to return
        offset: Number of records to skip
        db: Database session
        
    Returns:
        Attendance records
    """
    try:
        query = db.query(AttendanceLog).join(Personnel)
        
        # Apply filters
        if date_from:
            query = query.filter(AttendanceLog.timestamp >= date_from)
        if date_to:
            query = query.filter(AttendanceLog.timestamp <= date_to)
        if personnel_ids:
            query = query.filter(AttendanceLog.personnel_id.in_(personnel_ids))
        if device_ids:
            query = query.filter(AttendanceLog.device_id.in_(device_ids))
        if event_types:
            query = query.filter(AttendanceLog.event_type.in_(event_types))
        
        # Get total count
        total_count = query.count()
        
        # Apply pagination
        records = query.offset(offset).limit(limit).all()
        
        # Format records
        formatted_records = []
        for record in records:
            formatted_records.append({
                "id": record.id,
                "personnel_id": record.personnel_id,
                "badge_id": record.personnel.badge_id if record.personnel else "",
                "personnel_name": record.personnel.full_name if record.personnel else "",
                "timestamp": record.timestamp.isoformat() if record.timestamp else None,
                "device_id": record.device_id,
                "device_type": record.device_type,
                "event_type": record.event_type,
                "verification_method": record.verification_method,
                "verification_score": record.verification_score,
                "network_type": record.network_type,
                "raw_data": record.raw_data or {},
                "processed": record.is_processed,
                "created_at": record.created_at.isoformat() if record.created_at else None
            })
        
        return {
            "success": True,
            "records": formatted_records,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": offset + limit < total_count
            },
            "filters_applied": {
                "date_from": date_from.isoformat() if date_from else None,
                "date_to": date_to.isoformat() if date_to else None,
                "personnel_ids": personnel_ids,
                "device_ids": device_ids,
                "event_types": event_types
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get attendance records: {str(e)}"
        )


@router.get("/summary/daily")
async def get_daily_attendance_summary(
    date: datetime = Query(..., description="Date for daily summary"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get daily attendance summary
    
    Args:
        date: Date for daily summary
        db: Database session
        
    Returns:
        Daily attendance summary
    """
    try:
        # Get attendance records for the specified date
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        query = db.query(AttendanceLog).join(Personnel).filter(
            AttendanceLog.timestamp >= start_of_day,
            AttendanceLog.timestamp < end_of_day
        )
        
        records = query.all()
        
        # Calculate summary statistics
        total_records = len(records)
        check_ins = len([r for r in records if r.event_type == "check_in"])
        check_outs = len([r for r in records if r.event_type == "check_out"])
        
        # Unique personnel count
        unique_personnel = len(set([r.personnel_id for r in records]))
        
        # Device breakdown
        device_breakdown = {}
        for record in records:
            device = record.device_id or "unknown"
            device_breakdown[device] = device_breakdown.get(device, 0) + 1
        
        # Verification method breakdown
        verification_breakdown = {}
        for record in records:
            method = record.verification_method or "unknown"
            verification_breakdown[method] = verification_breakdown.get(method, 0) + 1
        
        return {
            "success": True,
            "date": date.isoformat(),
            "summary": {
                "total_records": total_records,
                "check_ins": check_ins,
                "check_outs": check_outs,
                "unique_personnel": unique_personnel,
                "device_breakdown": device_breakdown,
                "verification_breakdown": verification_breakdown
            },
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get daily attendance summary: {str(e)}"
        )


@router.get("/summary/weekly")
async def get_weekly_attendance_summary(
    start_date: datetime = Query(..., description="Start date for weekly summary"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get weekly attendance summary
    
    Args:
        start_date: Start date for weekly summary
        db: Database session
        
    Returns:
        Weekly attendance summary
    """
    try:
        end_date = start_date + timedelta(days=7)
        
        # Get attendance records for the week
        query = db.query(AttendanceLog).join(Personnel).filter(
            AttendanceLog.timestamp >= start_date,
            AttendanceLog.timestamp < end_date
        )
        
        records = query.all()
        
        # Calculate daily breakdown
        daily_breakdown = {}
        for i in range(7):
            current_date = start_date + timedelta(days=i)
            day_start = current_date.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            day_records = [r for r in records if day_start <= r.timestamp < day_end]
            daily_breakdown[current_date.isoformat()] = {
                "total_records": len(day_records),
                "check_ins": len([r for r in day_records if r.event_type == "check_in"]),
                "check_outs": len([r for r in day_records if r.event_type == "check_out"]),
                "unique_personnel": len(set([r.personnel_id for r in day_records]))
            }
        
        # Weekly totals
        total_records = len(records)
        unique_personnel = len(set([r.personnel_id for r in records]))
        
        return {
            "success": True,
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": 7
            },
            "daily_breakdown": daily_breakdown,
            "weekly_summary": {
                "total_records": total_records,
                "unique_personnel": unique_personnel,
                "avg_daily_records": round(total_records / 7, 2)
            },
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get weekly attendance summary: {str(e)}"
        )


@router.post("/report")
async def generate_attendance_report(
    report_type: str = Query("daily", description="Type of report: daily, weekly, monthly"),
    date_from: datetime = Query(..., description="Start date for report"),
    date_to: datetime = Query(..., description="End date for report"),
    personnel_ids: Optional[List[int]] = Query(None, description="Filter by personnel IDs"),
    device_ids: Optional[List[str]] = Query(None, description="Filter by device IDs"),
    format_type: str = Query("json", description="Report format: json, csv, excel"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Generate attendance report
    
    Args:
        report_type: Type of report
        date_from: Start date for report
        date_to: End date for report
        personnel_ids: Filter by personnel IDs
        device_ids: Filter by device IDs
        format_type: Report format
        db: Database session
        
    Returns:
        Attendance report
    """
    try:
        result = await biotime_client.get_attendance_report(
            report_type=report_type,
            from_date=date_from,
            to_date=date_to,
            filters={
                "personnel_ids": personnel_ids,
                "device_ids": device_ids
            }
        )
        
        return {
            "success": True,
            "report_type": report_type,
            "period": {
                "from": date_from.isoformat(),
                "to": date_to.isoformat()
            },
            "filters": {
                "personnel_ids": personnel_ids,
                "device_ids": device_ids
            },
            "format": format_type,
            "data": result,
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate attendance report: {str(e)}"
        )


@router.get("/analytics/verification-methods")
async def get_verification_method_analytics(
    date_from: datetime = Query(..., description="Start date for analytics"),
    date_to: datetime = Query(..., description="End date for analytics"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get verification method analytics
    
    Args:
        date_from: Start date for analytics
        date_to: End date for analytics
        db: Database session
        
    Returns:
        Verification method analytics
    """
    try:
        # Get attendance records for the period
        query = db.query(AttendanceLog).filter(
            AttendanceLog.timestamp >= date_from,
            AttendanceLog.timestamp <= date_to
        )
        
        records = query.all()
        
        # Calculate verification method breakdown
        verification_stats = {}
        total_records = len(records)
        
        for record in records:
            method = record.verification_method or "unknown"
            if method not in verification_stats:
                verification_stats[method] = {
                    "count": 0,
                    "percentage": 0,
                    "avg_score": 0,
                    "scores": []
                }
            
            verification_stats[method]["count"] += 1
            verification_stats[method]["scores"].append(record.verification_score or 0)
        
        # Calculate percentages and averages
        for method, stats in verification_stats.items():
            stats["percentage"] = round((stats["count"] / total_records) * 100, 2) if total_records > 0 else 0
            scores = [s for s in stats["scores"] if s is not None]
            stats["avg_score"] = round(sum(scores) / len(scores), 2) if scores else 0
            del stats["scores"]  # Remove raw scores from response
        
        return {
            "success": True,
            "period": {
                "from": date_from.isoformat(),
                "to": date_to.isoformat(),
                "days": (date_to - date_from).days
            },
            "total_records": total_records,
            "verification_methods": verification_stats,
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get verification method analytics: {str(e)}"
        )
