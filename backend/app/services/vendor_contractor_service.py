"""
Vendor/Contractor Management Service
Handles vendor and contractor management operations
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
import asyncio

from ..core.database import get_db
from ..models.vendor_contractor import (
    Vendor, VendorContract, Contractor, ContractAssignment, VendorCompliance, ContractorCompliance
)
from ..models.personnel import Personnel
from ..models.department import Department

logger = logging.getLogger(__name__)


class VendorContractorService:
    """Service for vendor and contractor management operations"""
    
    def __init__(self):
        self.active_contracts = {}
        
    async def create_vendor(
        self,
        vendor_data: dict,
        db: Session,
        created_by: int
    ) -> Dict[str, Any]:
        """Create new vendor"""
        try:
            # Check if vendor code already exists
            existing = db.query(Vendor).filter(
                Vendor.vendor_code == vendor_data["vendor_code"]
            ).first()
            
            if existing:
                return {"success": False, "error": "Vendor code already exists"}
            
            # Create vendor
            vendor = Vendor(
                vendor_code=vendor_data["vendor_code"],
                vendor_name=vendor_data["vendor_name"],
                vendor_type=vendor_data["vendor_type"],
                description=vendor_data.get("description"),
                contact_person=vendor_data.get("contact_person"),
                email=vendor_data.get("email"),
                phone=vendor_data.get("phone"),
                mobile=vendor_data.get("mobile"),
                fax=vendor_data.get("fax"),
                address_line1=vendor_data.get("address_line1"),
                address_line2=vendor_data.get("address_line2"),
                city=vendor_data.get("city"),
                state=vendor_data.get("state"),
                country=vendor_data.get("country"),
                postal_code=vendor_data.get("postal_code"),
                business_registration=vendor_data.get("business_registration"),
                tax_id=vendor_data.get("tax_id"),
                website=vendor_data.get("website"),
                services_offered=vendor_data.get("services_offered"),
                service_areas=vendor_data.get("service_areas"),
                certifications=vendor_data.get("certifications"),
                payment_terms=vendor_data.get("payment_terms"),
                credit_limit=vendor_data.get("credit_limit"),
                currency=vendor_data.get("currency", "USD"),
                created_by=created_by,
                notes=vendor_data.get("notes")
            )
            
            db.add(vendor)
            db.commit()
            db.refresh(vendor)
            
            logger.info(f"Created vendor {vendor_data['vendor_code']}")
            
            return {
                "success": True,
                "data": {
                    "id": vendor.id,
                    "vendor_code": vendor.vendor_code,
                    "vendor_name": vendor.vendor_name
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating vendor: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def update_vendor(
        self,
        vendor_id: int,
        update_data: dict,
        db: Session,
        updated_by: int
    ) -> Dict[str, Any]:
        """Update existing vendor"""
        try:
            vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
            
            if not vendor:
                return {"success": False, "error": "Vendor not found"}
            
            # Update fields
            for field, value in update_data.items():
                if hasattr(vendor, field):
                    setattr(vendor, field, value)
            
            vendor.updated_by = updated_by
            db.commit()
            
            logger.info(f"Updated vendor {vendor_id}")
            
            return {
                "success": True,
                "data": {
                    "id": vendor.id,
                    "vendor_code": vendor.vendor_code,
                    "vendor_name": vendor.vendor_name
                }
            }
            
        except Exception as e:
            logger.error(f"Error updating vendor: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_vendors(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        vendor_type: Optional[str] = None,
        status: Optional[str] = None,
        service_area: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get vendors with filtering and pagination"""
        try:
            query = db.query(Vendor)
            
            # Apply filters
            if search:
                query = query.filter(
                    or_(
                        Vendor.vendor_name.ilike(f"%{search}%"),
                        Vendor.vendor_code.ilike(f"%{search}%"),
                        Vendor.description.ilike(f"%{search}%")
                    )
                )
            
            if vendor_type:
                query = query.filter(Vendor.vendor_type == vendor_type)
            
            if status:
                query = query.filter(Vendor.status == status)
            
            if service_area:
                query = query.filter(
                    Vendor.service_areas.contains([service_area])
                )
            
            # Get total count
            total_count = query.count()
            
            # Apply pagination
            vendors = query.order_by(Vendor.vendor_name).offset(skip).limit(limit).all()
            
            # Enhance with additional data
            result_vendors = []
            for vendor in vendors:
                vendor_data = {
                    "id": vendor.id,
                    "vendor_code": vendor.vendor_code,
                    "vendor_name": vendor.vendor_name,
                    "vendor_type": vendor.vendor_type.value,
                    "status": vendor.status.value,
                    "description": vendor.description,
                    "contact_person": vendor.contact_person,
                    "email": vendor.email,
                    "phone": vendor.phone,
                    "mobile": vendor.mobile,
                    "fax": vendor.fax,
                    "address_line1": vendor.address_line1,
                    "address_line2": vendor.address_line2,
                    "city": vendor.city,
                    "state": vendor.state,
                    "country": vendor.country,
                    "postal_code": vendor.postal_code,
                    "business_registration": vendor.business_registration,
                    "tax_id": vendor.tax_id,
                    "website": vendor.website,
                    "services_offered": vendor.services_offered,
                    "service_areas": vendor.service_areas,
                    "certifications": vendor.certifications,
                    "payment_terms": vendor.payment_terms,
                    "credit_limit": vendor.credit_limit,
                    "currency": vendor.currency,
                    "compliance_status": vendor.compliance_status.value if vendor.compliance_status else None,
                    "last_compliance_check": vendor.last_compliance_check,
                    "next_compliance_due": vendor.next_compliance_due,
                    "risk_rating": vendor.risk_rating,
                    "performance_score": vendor.performance_score,
                    "total_contracts": vendor.total_contracts,
                    "active_contracts": vendor.active_contracts,
                    "created_by": vendor.created_by,
                    "created_at": vendor.created_at,
                    "updated_by": vendor.updated_by,
                    "updated_at": vendor.updated_at,
                    "notes": vendor.notes
                }
                
                # Calculate contract statistics
                vendor_data["total_contracts"] = self._get_vendor_contract_count(vendor.id, db)
                vendor_data["active_contracts"] = self._get_vendor_active_contract_count(vendor.id, db)
                
                result_vendors.append(vendor_data)
            
            return {
                "success": True,
                "data": result_vendors,
                "total_count": total_count,
                "skip": skip,
                "limit": limit
            }
            
        except Exception as e:
            logger.error(f"Error getting vendors: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def create_vendor_contract(
        self,
        contract_data: dict,
        db: Session,
        created_by: int
    ) -> Dict[str, Any]:
        """Create vendor contract"""
        try:
            # Check if contract number already exists
            existing = db.query(VendorContract).filter(
                VendorContract.contract_number == contract_data["contract_number"]
            ).first()
            
            if existing:
                return {"success": False, "error": "Contract number already exists"}
            
            # Create contract
            contract = VendorContract(
                vendor_id=contract_data["vendor_id"],
                contract_number=contract_data["contract_number"],
                contract_name=contract_data["contract_name"],
                contract_type=contract_data["contract_type"],
                start_date=contract_data["start_date"],
                end_date=contract_data["end_date"],
                renewal_date=contract_data.get("renewal_date"),
                notice_period_days=contract_data.get("notice_period_days", 30),
                total_value=contract_data.get("total_value"),
                currency=contract_data.get("currency", "USD"),
                payment_terms=contract_data.get("payment_terms"),
                billing_frequency=contract_data.get("billing_frequency"),
                sla_requirements=contract_data.get("sla_requirements"),
                penalty_clauses=contract_data.get("penalty_clauses"),
                scope_of_work=contract_data.get("scope_of_work"),
                deliverables=contract_data.get("deliverables"),
                key_performance_indicators=contract_data.get("key_performance_indicators"),
                contract_manager=contract_data.get("contract_manager"),
                legal_reviewer=contract_data.get("legal_reviewer"),
                created_by=created_by,
                notes=contract_data.get("notes")
            )
            
            db.add(contract)
            db.commit()
            db.refresh(contract)
            
            # Update vendor contract count
            vendor = db.query(Vendor).filter(Vendor.id == contract_data["vendor_id"]).first()
            if vendor:
                vendor.total_contracts = vendor.total_contracts + 1
                vendor.active_contracts = vendor.active_contracts + 1
                db.commit()
            
            logger.info(f"Created vendor contract {contract_data['contract_number']}")
            
            return {
                "success": True,
                "data": {
                    "id": contract.id,
                    "contract_number": contract.contract_number,
                    "vendor_id": contract.vendor_id
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating vendor contract: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def create_contractor(
        self,
        contractor_data: dict,
        db: Session,
        created_by: int
    ) -> Dict[str, Any]:
        """Create new contractor"""
        try:
            # Check if contractor code already exists
            existing = db.query(Contractor).filter(
                Contractor.contractor_code == contractor_data["contractor_code"]
            ).first()
            
            if existing:
                return {"success": False, "error": "Contractor code already exists"}
            
            # Create contractor
            contractor = Contractor(
                vendor_id=contractor_data.get("vendor_id"),
                contractor_code=contractor_data["contractor_code"],
                first_name=contractor_data["first_name"],
                last_name=contractor_data["last_name"],
                email=contractor_data.get("email"),
                phone=contractor_data.get("phone"),
                date_of_birth=contractor_data.get("date_of_birth"),
                national_id=contractor_data.get("national_id"),
                passport_number=contractor_data.get("passport_number"),
                work_permit_number=contractor_data.get("work_permit_number"),
                work_permit_expiry=contractor_data.get("work_permit_expiry"),
                job_title=contractor_data.get("job_title"),
                specialization=contractor_data.get("specialization"),
                experience_years=contractor_data.get("experience_years", 0),
                hourly_rate=contractor_data.get("hourly_rate"),
                daily_rate=contractor_data.get("daily_rate"),
                currency=contractor_data.get("currency", "USD"),
                skills=contractor_data.get("skills"),
                certifications=contractor_data.get("certifications"),
                security_clearance=contractor_data.get("security_clearance"),
                availability_status=contractor_data.get("availability_status", "AVAILABLE"),
                preferred_work_locations=contractor_data.get("preferred_work_locations"),
                created_by=created_by,
                notes=contractor_data.get("notes")
            )
            
            db.add(contractor)
            db.commit()
            db.refresh(contractor)
            
            logger.info(f"Created contractor {contractor_data['contractor_code']}")
            
            return {
                "success": True,
                "data": {
                    "id": contractor.id,
                    "contractor_code": contractor.contractor_code,
                    "first_name": contractor.first_name,
                    "last_name": contractor.last_name
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating contractor: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def create_contract_assignment(
        self,
        assignment_data: dict,
        db: Session,
        created_by: int
    ) -> Dict[str, Any]:
        """Create contract assignment"""
        try:
            # Create assignment
            assignment = ContractAssignment(
                contract_id=assignment_data["contract_id"],
                contractor_id=assignment_data["contractor_id"],
                personnel_id=assignment_data.get("personnel_id"),
                project_name=assignment_data.get("project_name"),
                project_code=assignment_data.get("project_code"),
                role=assignment_data["role"],
                department_id=assignment_data.get("department_id"),
                start_date=assignment_data["start_date"],
                end_date=assignment_data.get("end_date"),
                hourly_rate=assignment_data.get("hourly_rate"),
                daily_rate=assignment_data.get("daily_rate"),
                overtime_rate=assignment_data.get("overtime_rate"),
                currency=assignment_data.get("currency", "USD"),
                assigned_by=assignment_data.get("assigned_by"),
                supervisor_id=assignment_data.get("supervisor_id"),
                created_by=created_by,
                notes=assignment_data.get("notes")
            )
            
            db.add(assignment)
            db.commit()
            db.refresh(assignment)
            
            logger.info(f"Created contract assignment for contractor {assignment_data['contractor_id']}")
            
            return {
                "success": True,
                "data": {
                    "id": assignment.id,
                    "contract_id": assignment.contract_id,
                    "contractor_id": assignment.contractor_id
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating contract assignment: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_vendor_statistics(
        self,
        db: Session
    ) -> Dict[str, Any]:
        """Get vendor management statistics"""
        try:
            # Total vendors
            total_vendors = db.query(Vendor).count()
            active_vendors = db.query(Vendor).filter(Vendor.status == "ACTIVE").count()
            
            # By type
            type_results = db.query(
                Vendor.vendor_type, func.count(Vendor.id)
            ).group_by(Vendor.vendor_type).all()
            
            vendors_by_type = {}
            for vendor_type, count in type_results:
                vendors_by_type[vendor_type.value] = count
            
            # By status
            status_results = db.query(
                Vendor.status, func.count(Vendor.id)
            ).group_by(Vendor.status).all()
            
            vendors_by_status = {}
            for status, count in status_results:
                vendors_by_status[status.value] = count
            
            # Contract statistics
            total_contracts = db.query(VendorContract).count()
            active_contracts = db.query(VendorContract).filter(
                VendorContract.status == "ACTIVE"
            ).count()
            expired_contracts = db.query(VendorContract).filter(
                VendorContract.status == "EXPIRED"
            ).count()
            
            # Contractor statistics
            total_contractors = db.query(Contractor).count()
            active_contractors = db.query(Contractor).filter(
                Contractor.status == "ACTIVE"
            ).count()
            
            # Compliance statistics
            compliance_overdue = db.query(Vendor).filter(
                and_(
                    Vendor.next_compliance_due < datetime.utcnow(),
                    Vendor.status == "ACTIVE"
                )
            ).count()
            
            return {
                "success": True,
                "data": {
                    "total_vendors": total_vendors,
                    "active_vendors": active_vendors,
                    "vendors_by_type": vendors_by_type,
                    "vendors_by_status": vendors_by_status,
                    "total_contracts": total_contracts,
                    "active_contracts": active_contracts,
                    "expired_contracts": expired_contracts,
                    "total_contractors": total_contractors,
                    "active_contractors": active_contractors,
                    "compliance_overdue": compliance_overdue
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting vendor statistics: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def create_vendor_compliance(
        self,
        compliance_data: dict,
        db: Session,
        created_by: int
    ) -> Dict[str, Any]:
        """Create vendor compliance record"""
        try:
            # Create compliance record
            compliance = VendorCompliance(
                vendor_id=compliance_data["vendor_id"],
                compliance_type=compliance_data["compliance_type"],
                compliance_status=compliance_data["compliance_status"],
                compliance_date=compliance_data["compliance_date"],
                expiry_date=compliance_data.get("expiry_date"),
                certifying_authority=compliance_data.get("certifying_authority"),
                certificate_number=compliance_data.get("certificate_number"),
                assessment_score=compliance_data.get("assessment_score"),
                assessment_notes=compliance_data.get("assessment_notes"),
                corrective_actions=compliance_data.get("corrective_actions"),
                follow_up_date=compliance_data.get("follow_up_date"),
                assessed_by=created_by,
                notes=compliance_data.get("notes")
            )
            
            db.add(compliance)
            db.commit()
            db.refresh(compliance)
            
            # Update vendor compliance status
            vendor = db.query(Vendor).filter(Vendor.id == compliance_data["vendor_id"]).first()
            if vendor:
                vendor.compliance_status = compliance_data["compliance_status"]
                vendor.last_compliance_check = compliance_data["compliance_date"]
                vendor.next_compliance_due = compliance_data.get("expiry_date")
                db.commit()
            
            logger.info(f"Created vendor compliance record for vendor {compliance_data['vendor_id']}")
            
            return {
                "success": True,
                "data": {
                    "id": compliance.id,
                    "vendor_id": compliance.vendor_id,
                    "compliance_status": compliance.compliance_status.value
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating vendor compliance: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def bulk_vendor_action(
        self,
        vendor_ids: List[int],
        action: str,
        reason: Optional[str] = None,
        notes: Optional[str] = None,
        db: Session = None,
        updated_by: int = 1
    ) -> Dict[str, Any]:
        """Perform bulk action on vendors"""
        try:
            successful_actions = 0
            failed_actions = 0
            action_results = []
            errors = []
            
            for vendor_id in vendor_ids:
                try:
                    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
                    
                    if not vendor:
                        failed_actions += 1
                        errors.append({
                            "vendor_id": vendor_id,
                            "error": "Vendor not found"
                        })
                        continue
                    
                    # Apply action
                    if action == "ACTIVATE":
                        vendor.status = "ACTIVE"
                    elif action == "DEACTIVATE":
                        vendor.status = "INACTIVE"
                    elif action == "SUSPEND":
                        vendor.status = "SUSPENDED"
                    elif action == "BLACKLIST":
                        vendor.status = "BLACKLISTED"
                    else:
                        failed_actions += 1
                        errors.append({
                            "vendor_id": vendor_id,
                            "error": f"Unknown action: {action}"
                        })
                        continue
                    
                    vendor.updated_by = updated_by
                    db.commit()
                    
                    successful_actions += 1
                    action_results.append({
                        "vendor_id": vendor_id,
                        "status": "success",
                        "action": action,
                        "new_status": vendor.status.value
                    })
                    
                except Exception as e:
                    failed_actions += 1
                    errors.append({
                        "vendor_id": vendor_id,
                        "error": str(e)
                    })
            
            return {
                "success": True,
                "total_vendors": len(vendor_ids),
                "successful_actions": successful_actions,
                "failed_actions": failed_actions,
                "action_results": action_results,
                "errors": errors
            }
            
        except Exception as e:
            logger.error(f"Error in bulk vendor action: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def _get_vendor_contract_count(self, vendor_id: int, db: Session) -> int:
        """Get total contract count for vendor"""
        try:
            return db.query(VendorContract).filter(
                VendorContract.vendor_id == vendor_id
            ).count()
        except Exception as e:
            logger.error(f"Error getting vendor contract count: {str(e)}")
            return 0
    
    def _get_vendor_active_contract_count(self, vendor_id: int, db: Session) -> int:
        """Get active contract count for vendor"""
        try:
            return db.query(VendorContract).filter(
                and_(
                    VendorContract.vendor_id == vendor_id,
                    VendorContract.status == "ACTIVE"
                )
            ).count()
        except Exception as e:
            logger.error(f"Error getting vendor active contract count: {str(e)}")
            return 0
    
    async def check_contract_expiry_alerts(self, db: Session) -> List[Dict[str, Any]]:
        """Check for contracts expiring soon"""
        try:
            # Get contracts expiring in next 30 days
            expiry_threshold = datetime.utcnow() + timedelta(days=30)
            
            expiring_contracts = db.query(VendorContract).filter(
                and_(
                    VendorContract.end_date <= expiry_threshold,
                    VendorContract.status == "ACTIVE"
                )
            ).all()
            
            alerts = []
            for contract in expiring_contracts:
                days_until_expiry = (contract.end_date - datetime.utcnow()).days
                
                alerts.append({
                    "contract_id": contract.id,
                    "contract_number": contract.contract_number,
                    "vendor_id": contract.vendor_id,
                    "vendor_name": contract.vendor.vendor_name if contract.vendor else None,
                    "end_date": contract.end_date,
                    "days_until_expiry": days_until_expiry,
                    "alert_level": "CRITICAL" if days_until_expiry <= 7 else "WARNING"
                })
            
            return alerts
            
        except Exception as e:
            logger.error(f"Error checking contract expiry alerts: {str(e)}")
            return []
    
    async def check_compliance_expiry_alerts(self, db: Session) -> List[Dict[str, Any]]:
        """Check for compliance records expiring soon"""
        try:
            # Get compliance records expiring in next 30 days
            expiry_threshold = datetime.utcnow() + timedelta(days=30)
            
            expiring_compliance = db.query(VendorCompliance).filter(
                VendorCompliance.expiry_date <= expiry_threshold
            ).all()
            
            alerts = []
            for compliance in expiring_compliance:
                days_until_expiry = (compliance.expiry_date - datetime.utcnow()).days
                
                alerts.append({
                    "compliance_id": compliance.id,
                    "vendor_id": compliance.vendor_id,
                    "vendor_name": compliance.vendor.vendor_name if compliance.vendor else None,
                    "compliance_type": compliance.compliance_type,
                    "expiry_date": compliance.expiry_date,
                    "days_until_expiry": days_until_expiry,
                    "alert_level": "CRITICAL" if days_until_expiry <= 7 else "WARNING"
                })
            
            return alerts
            
        except Exception as e:
            logger.error(f"Error checking compliance expiry alerts: {str(e)}")
            return []


# Create service instance
vendor_contractor_service = VendorContractorService()
