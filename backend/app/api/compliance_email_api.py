"""
Compliance Email API — manual trigger for the daily digest.
Admin-only endpoint so operators can test or force-send outside the schedule.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/compliance-email", tags=["Compliance Email"])


@router.post("/trigger")
async def trigger_compliance_digest(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Manually trigger the compliance email digest (admin only)."""
    if not getattr(current_user, "is_superuser", False):
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        from ..tasks.compliance_email_task import send_compliance_digest
        result = send_compliance_digest(db=db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/preview")
async def preview_compliance_digest(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return the compliance data without sending an email — useful for checking."""
    if not getattr(current_user, "is_superuser", False):
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        from ..tasks.compliance_email_task import _fetch_data
        permits, medicals, training = _fetch_data(db)
        return {
            "permits_expiring": len(permits),
            "medical_issues":   len(medicals),
            "training_expiring": len(training),
            "permits":  [dict(r._mapping) for r in permits],
            "medicals": [dict(r._mapping) for r in medicals],
            "training": [dict(r._mapping) for r in training],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
