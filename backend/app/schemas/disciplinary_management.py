from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime


INCIDENT_TYPES = [
    "safety_violation", "hse_breach", "misconduct", "attendance",
    "substance_abuse", "theft", "harassment", "insubordination",
    "negligence", "policy_violation", "other",
]

SEVERITY_LEVELS = ["minor", "moderate", "major", "critical"]

ACTION_TYPES = [
    "verbal_warning", "written_warning", "final_warning",
    "suspension", "demotion", "termination", "retraining", "fine", "other",
]

CASE_STATUSES  = ["open", "under_investigation", "resolved", "appealed", "closed"]
APPEAL_STATUSES = ["pending", "upheld", "dismissed"]


# ── Case schemas ──────────────────────────────────────────────────────────────

class DisciplinaryCaseCreate(BaseModel):
    personnel_id:     int
    case_number:      Optional[str]  = Field(None, max_length=50)   # auto-generated if blank
    incident_date:    date
    incident_type:    Optional[str]  = Field(None, max_length=50)
    description:      Optional[str]  = None
    severity_level:   Optional[str]  = Field(None, max_length=20)
    action_type:      Optional[str]  = Field(None, max_length=20)
    status:           str            = "open"
    reported_by:      Optional[int]  = None
    assigned_to:      Optional[int]  = None
    resolution_date:  Optional[date] = None
    resolution_notes: Optional[str]  = None
    appeal_status:    Optional[str]  = Field(None, max_length=20)


class DisciplinaryCaseUpdate(BaseModel):
    incident_date:    Optional[date] = None
    incident_type:    Optional[str]  = Field(None, max_length=50)
    description:      Optional[str]  = None
    severity_level:   Optional[str]  = Field(None, max_length=20)
    action_type:      Optional[str]  = Field(None, max_length=20)
    status:           Optional[str]  = Field(None, max_length=20)
    assigned_to:      Optional[int]  = None
    resolution_date:  Optional[date] = None
    resolution_notes: Optional[str]  = None
    appeal_status:    Optional[str]  = Field(None, max_length=20)


class DisciplinaryCaseResponse(BaseModel):
    id:               int
    personnel_id:     int
    case_number:      str
    incident_date:    Optional[date] = None
    incident_type:    Optional[str]  = None
    description:      Optional[str]  = None
    severity_level:   Optional[str]  = None
    action_type:      Optional[str]  = None
    status:           str
    reported_by:      Optional[int]  = None
    assigned_to:      Optional[int]  = None
    resolution_date:  Optional[date] = None
    resolution_notes: Optional[str]  = None
    appeal_status:    Optional[str]  = None
    created_at:       datetime
    updated_at:       datetime
    # enriched
    personnel_name:   Optional[str]  = None
    personnel_emp_code: Optional[str] = None
    personnel_type:   Optional[str]  = None
    personnel_company: Optional[str] = None
    reporter_name:    Optional[str]  = None
    assignee_name:    Optional[str]  = None
    # cross-module context
    open_cases_count: Optional[int]  = None   # total open cases for this person
    has_active_training_gap: Optional[bool] = None  # any mandatory cert expired?

    class Config:
        from_attributes = True


# ── Summary schema ────────────────────────────────────────────────────────────

class DisciplinarySummary(BaseModel):
    total:          int
    open:           int
    under_investigation: int
    resolved:       int
    by_severity:    dict
    by_type:        dict
    by_action:      dict
    repeat_offenders: List[dict]   # personnel with 2+ open/active cases
