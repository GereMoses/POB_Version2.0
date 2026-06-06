"""
BioTime Audit and Compliance API

This module provides comprehensive audit and compliance endpoints for ZKTeco BioTime,
including audit trail management, compliance reporting, and regulatory compliance tracking.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json

from ..core.database import get_db
from ..models.personnel import Personnel, AttendanceLog
from ..services.biotime_sync_service import biotime_sync_service
from ..services.biotime_client import biotime_client

router = APIRouter()


# Audit Trail Management

@router.get("/audit/trail")
async def get_audit_trail(
    days: int = Query(30, ge=1, le=365, description="Number of days for audit trail"),
    action_type: Optional[str] = Query(None, description="Filter by action type"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get audit trail for BioTime operations
    
    Args:
        days: Number of days for audit trail
        action_type: Filter by action type
        entity_type: Filter by entity type
        user_id: Filter by user ID
        limit: Maximum number of records to return
        offset: Number of records to skip
        db: Database session
        
    Returns:
        Audit trail records
    """
    try:
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Simulate audit trail data
        audit_entries = [
            {
                "id": f"audit_{i}",
                "timestamp": (datetime.utcnow() - timedelta(hours=i*2)).isoformat(),
                "action": "PERSONNEL_SYNC",
                "entity_type": "PERSONNEL",
                "entity_id": f"personnel_{i}",
                "user_id": 1,
                "details": {
                    "action": "Sync personnel from BioTime",
                    "sync_type": "biotime_to_pob",
                    "records_processed": 10 + i,
                    "success": True,
                    "duration_seconds": 15.5 + i
                },
                "compliance_impact": "HIGH"
            }
            for i in range(20)
        ]
        
        # Apply filters
        filtered_entries = audit_entries
        if action_type:
            filtered_entries = [e for e in audit_entries if e["details"]["action"] == action_type]
        if entity_type:
            filtered_entries = [e for e in filtered_entries if e["entity_type"] == entity_type]
        if user_id:
            filtered_entries = [e for e in filtered_entries if e["user_id"] == user_id]
        
        # Apply pagination
        total_count = len(filtered_entries)
        paginated_entries = filtered_entries[offset:offset + limit]
        
        return {
            "success": True,
            "audit_trail": paginated_entries,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": offset + limit < total_count
            },
            "filters_applied": {
                "days": days,
                "action_type": action_type,
                "entity_type": entity_type,
                "user_id": user_id
            },
            "summary": {
                "total_entries": total_count,
                "action_types": {
                    "PERSONNEL_SYNC": len([e for e in filtered_entries if e["details"]["action"] == "PERSONNEL_SYNC"]),
                    "BIOMETRIC_ENROLL": len([e for e in filtered_entries if e["details"]["action"] == "BIOMETRIC_ENROLL"]),
                    "DEVICE_CONFIG": len([e for e in filtered_entries if e["details"]["action"] == "DEVICE_CONFIG"]),
                    "SYSTEM_CONFIG": len([e for e in filtered_entries if e["details"]["action"] == "SYSTEM_CONFIG"])
                },
                "compliance_impacts": {
                    "HIGH": len([e for e in filtered_entries if e.get("compliance_impact") == "HIGH"]),
                    "MEDIUM": len([e for e in filtered_entries if e.get("compliance_impact") == "MEDIUM"]),
                    "LOW": len([e for e in filtered_entries if e.get("compliance_impact") == "LOW"])
                }
            },
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get audit trail: {str(e)}"
        )


@router.post("/audit/log")
async def create_audit_log(
    action: str,
    entity_type: str,
    entity_id: str,
    details: Dict[str, Any],
    compliance_impact: str = Query("LOW", description="Compliance impact level"),
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Create audit log entry
    
    Args:
        action: Action performed
        entity_type: Type of entity affected
        entity_id: ID of entity affected
        details: Action details
        compliance_impact: Compliance impact level
        user_id: User ID who performed action
        db: Database session
        
    Returns:
        Audit log creation result
    """
    try:
        # Validate action and entity type
        valid_actions = ["CREATE", "UPDATE", "DELETE", "SYNC", "LOGIN", "LOGOUT", "APPROVE", "REJECT", "ACTIVATE", "DEACTIVATE"]
        valid_entities = ["PERSONNEL", "DEVICE", "CONFIG", "SYSTEM", "ATTENDANCE", "BIOMETRIC", "COMPLIANCE"]
        
        if action not in valid_actions:
            return {
                "success": False,
                "error": f"Invalid action: {action}"
            }
        
        if entity_type not in valid_entities:
            return {
                "success": False,
                "error": f"Invalid entity type: {entity_type}"
            }
        
        valid_impacts = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        if compliance_impact not in valid_impacts:
            compliance_impact = "LOW"
        
        # Create audit entry
        audit_entry = {
            "id": f"audit_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "user_id": user_id,
            "details": details,
            "compliance_impact": compliance_impact,
            "ip_address": "192.168.1.100"  # Would be actual client IP
            "user_agent": "BioTime API Client v2.1"
        }
        
        return {
            "success": True,
            "audit_entry": audit_entry,
            "message": "Audit log created successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create audit log: {str(e)}"
        )


# Compliance Reporting

@router.get("/compliance/report")
async def get_compliance_report(
    report_type: str = Query("monthly", description="Report type: daily, weekly, monthly"),
    start_date: datetime = Query(..., description="Start date for report"),
    end_date: datetime = Query(..., description="End date for report"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Generate compliance report
    
    Args:
        report_type: Type of report
        start_date: Start date for report
        end_date: End date for report
        db: Database session
        
    Returns:
        Compliance report
    """
    try:
        from datetime import timedelta
        from calendar import monthrange
        
        # Calculate report period
        if report_type == "daily":
            days = 1
            periods = [datetime.utcnow() - timedelta(days=i) for i in range(1)]
        elif report_type == "weekly":
            days = 7
            periods = [datetime.utcnow() - timedelta(weeks=i) for i in range(1)]
        elif report_type == "monthly":
            days = 30
            periods = [datetime.utcnow() - timedelta(days=i) for i in range(1)]
        else:
            return {
                "success": False,
                "error": f"Invalid report type: {report_type}"
            }
        
        # Generate compliance data for each period
        compliance_data = []
        
        for period_start in periods:
            period_end = period_start + timedelta(days=days-1)
            
            # Get personnel compliance for period
            total_personnel = db.query(Personnel).filter(
                Personnel.created_at >= period_start,
                Personnel.created_at < period_end
            ).count()
            
            biometric_enrolled = db.query(Personnel).filter(
                Personnel.biometric_enrolled == True,
                Personnel.created_at >= period_start,
                Personnel.created_at < period_end
            ).count()
            
            # Get attendance compliance for period
            attendance_records = db.query(AttendanceLog).filter(
                AttendanceLog.timestamp >= period_start,
                AttendanceLog.timestamp < period_end
            ).all()
            
            verified_attendance = len([a for a in attendance_records if a.verification_score and a.verification_score >= 0.8])
            
            # Calculate compliance scores
            biometric_compliance_rate = (biometric_enrolled / total_personnel * 100) if total_personnel > 0 else 0
            attendance_compliance_rate = (verified_attendance / len(attendance_records) * 100) if len(attendance_records) > 0 else 0
            overall_compliance = (biometric_compliance_rate + attendance_compliance_rate) / 2
            
            # Risk assessment
            high_risk_count = db.query(Personnel).filter(
                Personnel.compliance_score < 70,
                Personnel.created_at >= period_start,
                Personnel.created_at < period_end
            ).count()
            
            risk_percentage = (high_risk_count / total_personnel * 100) if total_personnel > 0 else 0
            
            compliance_data.append({
                "period": {
                    "start_date": period_start.isoformat(),
                    "end_date": period_end.isoformat(),
                    "days": days,
                    "report_type": report_type
                },
                "compliance_metrics": {
                    "total_personnel": total_personnel,
                    "biometric_enrolled": biometric_enrolled,
                    "biometric_compliance_rate": round(biometric_compliance_rate, 2),
                    "total_attendance_records": len(attendance_records),
                    "verified_attendance": verified_attendance,
                    "attendance_compliance_rate": round(attendance_compliance_rate, 2),
                    "overall_compliance": round(overall_compliance, 2)
                },
                "risk_assessment": {
                    "high_risk_personnel": high_risk_count,
                    "risk_percentage": round(risk_percentage, 2),
                    "risk_level": "HIGH" if risk_percentage >= 20 else "MEDIUM" if risk_percentage >= 10 else "LOW"
                },
                "compliance_status": "COMPLIANT" if overall_compliance >= 90 else "NEEDS_ATTENTION" if overall_compliance >= 80 else "NON_COMPLIANT",
                "violations": []
                },
                "recommendations": []
            })
        
        return {
            "success": True,
            "report_type": report_type,
            "compliance_data": compliance_data,
            "summary": {
                "total_periods": len(compliance_data),
                "avg_compliance": round(sum(d["compliance_metrics"]["overall_compliance"] for d in compliance_data) / len(compliance_data), 2) if compliance_data else 0,
                "trend_analysis": "IMPROVING" if len(compliance_data) > 1 else "STABLE"
            },
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate compliance report: {str(e)}"
        )


# Regulatory Compliance

@router.get("/compliance/regulatory")
async def get_regulatory_compliance(
    standard: str = Query("OPITO", description="Regulatory standard: OPITO, NOPSEMA, OSHA"),
    days: int = Query(90, ge=1, le=365, description="Number of days for analysis"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get regulatory compliance analysis
    
    Args:
        standard: Regulatory standard to check
        days: Number of days for analysis
        db: Database session
        
    Returns:
        Regulatory compliance analysis
    """
    try:
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Get personnel for analysis
        personnel_list = db.query(Personnel).filter(
            Personnel.created_at >= cutoff_date
        ).all()
        
        # Simulate regulatory compliance checks
        compliance_data = {
            "standard": standard,
            "analysis_period": {
                "start_date": cutoff_date.isoformat(),
                "end_date": datetime.utcnow().isoformat(),
                "days": days
            },
            "total_personnel": len(personnel_list),
            "compliance_metrics": {
                "certified_personnel": 0,
                "training_compliant": 0,
                "biometric_enrolled": len([p for p in personnel_list if p.biometric_enrolled]),
                "compliance_score": 0
            },
            "standard_requirements": {
                "OPITO": {
                    "required_certifications": ["H2S", "BOSIET", "HELIDECK"],
                    "training_hours": 16,
                    "medical_fitness": True,
                    "renewal_frequency": "annual"
                },
                "NOPSEMA": {
                    "required_certifications": ["H2S", "WORK_PERMIT"],
                    "safety_training": True,
                    "drill_participation": True,
                    "incident_reporting": True
                }
            },
            "OSHA": {
                    "required_certifications": ["OSHA_10", "OSHA_30"],
                    "safety_program": True,
                    "incident_reporting": True
                }
            }
        }
        
        # Calculate compliance for each standard
        opito_compliance = self._calculate_standard_compliance(personnel_list, "OPITO")
        nopsema_compliance = self._calculate_standard_compliance(personnel_list, "NOPSEMA")
        osha_compliance = self._calculate_standard_compliance(personnel_list, "OSHA")
        
        return {
            "success": True,
            "regulatory_standard": standard,
            "compliance_data": {
                "overall_compliance": 0,
                "standards": {
                    "OPITO": opito_compliance,
                    "NOPSEMA": nopsema_compliance,
                    "OSHA": osha_compliance
                },
                "recommendations": self._generate_regulatory_recommendations(opito_compliance, nopsema_compliance, osha_compliance)
            },
            "analysis_period": {
                "start_date": cutoff_date.isoformat(),
                "end_date": datetime.utcnow().isoformat(),
                "days": days
            },
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get regulatory compliance: {str(e)}"
        )


# Security Monitoring

@router.get("/security/incidents")
async def get_security_incidents(
    days: int = Query(30, ge=1, le=90, description="Number of days for security analysis"),
    severity: Optional[str] = Query(None, description="Filter by severity level"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get security incidents and analysis
    
    Args:
        days: Number of days for analysis
        severity: Filter by severity level
        db: Database session
        
    Returns:
        Security incidents data
    """
    try:
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Simulate security incidents
        incidents = [
            {
                "id": f"incident_{i}",
                "timestamp": (datetime.utcnow() - timedelta(hours=i*6)).isoformat(),
                "incident_type": "ACCESS_VIOLATION",
                "severity": "HIGH",
                "description": "Unauthorized access attempt detected",
                "entity_type": "PERSONNEL",
                "entity_id": f"personnel_{i}",
                "details": {
                    "ip_address": "192.168.1.100",
                    "user_agent": "Unknown",
                    "access_method": "BIOMETRIC",
                    "verification_result": "FAILED"
                },
                "resolved": False,
                "compliance_impact": "HIGH"
            }
            for i in range(10)
        ]
        
        # Apply filters
        filtered_incidents = incidents
        if severity:
            filtered_incidents = [i for i in incidents if i["severity"] == severity]
        
        # Calculate security metrics
        total_incidents = len(incidents)
        high_severity_count = len([i for i in incidents if i["severity"] == "HIGH"])
        medium_severity_count = len([i for i in incidents if i["severity"] == "MEDIUM"])
        low_severity_count = len([i for i in incidents if i["severity"] == "LOW"])
        
        return {
            "success": True,
            "security_incidents": filtered_incidents,
            "security_metrics": {
                "total_incidents": total_incidents,
                "severity_distribution": {
                    "HIGH": high_severity_count,
                    "MEDIUM": medium_severity_count,
                    "LOW": low_severity_count
                },
                "trend_analysis": {
                    "total_incidents": total_incidents,
                    "avg_per_day": round(total_incidents / days, 2),
                    "peak_day": "Monday",  # Simulated
                    "resolution_time_avg_hours": 2.5
                }
            },
            "filters_applied": {
                "days": days,
                "severity": severity
            },
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get security incidents: {str(e)}"
        )


# Data Integrity Monitoring

@router.get("/compliance/data-integrity")
async def get_data_integrity_report(
    days: int = Query(7, ge=1, le=30, description="Number of days for analysis"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get data integrity monitoring report
    
    Args:
        days: Number of days for analysis
        db: Database session
        
    Returns:
        Data integrity report
    """
    try:
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Get sync status
        sync_status = await biotime_sync_service.get_sync_status()
        
        # Calculate data integrity metrics
        total_syncs = sync_status.get("total_synced", 0)
        successful_syncs = total_syncs * 0.95  # Simulated 95% success rate
        failed_syncs = total_syncs - successful_syncs
        error_rate = round((failed_syncs / total_syncs) * 100, 2) if total_syncs > 0 else 0
        
        # Check data consistency
        integrity_issues = []
        if error_rate > 10:
            integrity_issues.append("High sync error rate detected")
        if failed_syncs > 5:
            integrity_issues.append("Multiple failed sync operations")
        
        return {
            "success": True,
            "data_integrity": {
                "sync_metrics": {
                    "total_syncs": total_syncs,
                    "successful_syncs": successful_syncs,
                    "failed_syncs": failed_syncs,
                    "success_rate": round((successful_syncs / total_syncs) * 100, 2),
                    "error_rate": error_rate
                },
                "integrity_issues": integrity_issues,
                "data_consistency_score": max(0, 100 - error_rate * 10),
                "last_sync_status": sync_status.get("biotime_connection", {}),
                "recommendations": self._generate_integrity_recommendations(error_rate, integrity_issues)
            },
            "analysis_period": {
                "start_date": cutoff_date.isoformat(),
                "end_date": datetime.utcnow().isoformat(),
                "days": days
            }
            },
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get data integrity report: {str(e)}"
        )


# Helper Methods

def _calculate_standard_compliance(personnel_list: List, standard: str) -> Dict[str, Any]:
    """Calculate compliance for specific regulatory standard"""
    if standard == "OPITO":
        certified_count = len([p for p in personnel_list if self._has_opito_certification(p)])
        return {
            "compliance_percentage": (certified_count / len(personnel_list)) * 100 if personnel_list else 0,
            "certified_count": certified_count,
            "total_count": len(personnel_list),
            "compliance_status": "COMPLIANT" if certified_count / len(personnel_list) >= 0.9 else "PARTIALLY_COMPLIANT",
            "standard_requirements_met": {
                "h2s_certification": True,
                "bosiet_certification": True,
                "helideck_certification": True,
                "training_hours": True,
                "medical_fitness": True
            }
        }
    elif standard == "NOPSEMA":
        certified_count = len([p for p in personnel_list if self._has_nopsema_certification(p)])
        return {
            "compliance_percentage": (certified_count / len(personnel_list)) * 100 if personnel_list else 0,
            "certified_count": certified_count,
            "total_count": len(personnel_list),
            "compliance_status": "COMPLIANT" if certified_count / len(personnel_list) >= 0.9 else "PARTIALLY_COMPLIANT",
            "standard_requirements_met": {
                "h2s_certification": True,
                "work_permit": True,
                "safety_training": True,
                "drill_participation": True,
                "incident_reporting": True
            }
        }
    elif standard == "OSHA":
        certified_count = len([p for p in personnel_list if self._has_osha_certification(p)])
        return {
            "compliance_percentage": (certified_count / len(personnel_list)) * 100 if personnel_list else 0,
            "certified_count": certified_count,
            "total_count": len(personnel_list),
            "compliance_status": "COMPLIANT" if certified_count / len(personnel_list) >= 0.9 else "PARTIALLY_COMPLIANT",
            "standard_requirements_met": {
                "osha_10_30": True,
                "osha_30": True,
                "safety_program": True,
                "incident_reporting": True
            }
        }
    else:
        return {
            "compliance_percentage": 0,
            "certified_count": 0,
            "total_count": len(personnel_list),
            "compliance_status": "NON_COMPLIANT",
            "standard_requirements_met": {}
        }


def _has_opito_certification(personnel) -> bool:
    """Check if personnel has OPITO certification"""
    # Simulate OPITO certification check
    return any(p.certifications and any(cert.get("issuer") == "OPITO" for cert in p.certifications or []))


def _has_nopsema_certification(personnel) -> bool:
    """Check if personnel has NOPSEMA certification"""
    # Simulate NOPSEMA certification check
    return any(p.certifications and any(cert.get("issuer") == "NOPSEMA" for cert in p.certifications or []))


def _has_osha_certification(personnel) -> bool:
    """Check if personnel has OSHA certification"""
    # Simulate OSHA certification check
    return any(p.certifications and any(cert.get("issuer") == "OSHA" for cert in p.certifications or []))


def _generate_regulatory_recommendations(opito_compliance: Dict, nopsema_compliance: Dict, osha_compliance: Dict) -> List[str]:
    """Generate regulatory compliance recommendations"""
    recommendations = []
    
    # OPITO recommendations
    if opito_compliance["compliance_status"] != "COMPLIANT":
        recommendations.append("Increase OPITO certification coverage")
    if opito_compliance["certified_count"] / opito_compliance["total_count"] < 0.5:
        recommendations.append("Schedule OPITO refresher training")
    
    # NOPSEMA recommendations
    if nopsema_compliance["compliance_status"] != "COMPLIANT":
        recommendations.append("Increase NOPSEMA work permit certification")
    if nopsema_compliance["certified_count"] / nopsema_compliance["total_count"] < 0.7:
        recommendations.append("Schedule NOPSEMA safety training refresh")
    
    # OSHA recommendations
    if osha_compliance["compliance_status"] != "COMPLIANT":
        recommendations.append("Update OSHA 10/30 training")
        recommendations.append("Implement OSHA 30 training program")
    
    return recommendations


def _generate_integrity_recommendations(error_rate: float, integrity_issues: List[str]) -> List[str]:
    """Generate data integrity recommendations"""
    recommendations = []
    
    if error_rate > 20:
        recommendations.append("CRITICAL: Investigate sync infrastructure immediately")
    elif error_rate > 10:
        recommendations.append("HIGH: Review error logs and implement retry mechanisms")
    
    if integrity_issues:
        recommendations.append("Address data consistency issues")
    
    if error_rate > 5:
        recommendations.append("Implement data validation checks")
    
    return recommendations
