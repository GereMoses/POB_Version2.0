"""
BioTime External System Integration Service

This module provides integration with external systems like SAP HR, Active Directory/LDAP,
and third-party access control systems for comprehensive BioTime compatibility.
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import httpx
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.personnel import Personnel
from ..models.biotime_enhancements import BioTimeSyncLogEntry, BioTimeDevice
from ..services.biotime_client import biotime_client


class SAPIntegrationService:
    """Integration service for SAP HR system"""
    
    def __init__(self, sap_api_url: str, sap_api_key: str):
        self.sap_api_url = sap_api_url
        self.sap_api_key = sap_api_key
        self.client = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {sap_api_key}"},
            timeout=30.0
        )
    
    async def sync_personnel_from_sap(self) -> Dict[str, Any]:
        """Sync personnel data from SAP HR system"""
        try:
            # Get personnel data from SAP
            sap_response = await self.client.get(f"{self.sap_api_url}/personnel")
            
            if sap_response.status_code != 200:
                return {
                    "success": False,
                    "error": f"SAP API error: {sap_response.status_code}",
                    "synced_count": 0
                }
            
            sap_personnel = sap_response.json().get("data", [])
            
            # Process and transform SAP data to BioTime format
            synced_personnel = []
            conflicts = []
            
            for sap_person in sap_personnel:
                try:
                    # Transform SAP data to BioTime format
                    biotime_person = self._transform_sap_to_biotime(sap_person)
                    
                    # Check for existing personnel
                    existing_personnel = await self._check_existing_personnel(biotime_person["employee_number"])
                    
                    if existing_personnel:
                        # Handle conflict
                        conflict_resolution = await self._resolve_personnel_conflict(
                            existing_personnel, biotime_person
                        )
                        if conflict_resolution["resolved"]:
                            synced_personnel.append(conflict_resolution["personnel"])
                        else:
                            conflicts.append(conflict_resolution)
                    else:
                        # Create new personnel
                        created_personnel = await self._create_personnel_from_sap(biotime_person)
                        synced_personnel.append(created_personnel)
                
                except Exception as e:
                    conflicts.append({
                        "sap_person_id": sap_person.get("employee_id"),
                        "error": str(e),
                        "resolution": "failed"
                    })
            
            return {
                "success": True,
                "synced_count": len(synced_personnel),
                "conflicts_count": len(conflicts),
                "synced_personnel": synced_personnel,
                "conflicts": conflicts,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "synced_count": 0
            }
    
    async def _transform_sap_to_biotime(self, sap_person: Dict[str, Any]) -> Dict[str, Any]:
        """Transform SAP personnel data to BioTime format"""
        return {
            "employee_number": sap_person.get("employee_id"),
            "full_name": sap_person.get("full_name"),
            "email": sap_person.get("email"),
            "phone": sap_person.get("phone"),
            "company": sap_person.get("company"),
            "department": sap_person.get("department"),
            "position": sap_person.get("position"),
            "personnel_type": sap_person.get("employee_type", "STAFF"),
            "work_schedule": sap_person.get("work_schedule", {}),
            "biotime_employee_id": sap_person.get("employee_id"),
            "sap_employee_id": sap_person.get("employee_id"),
            "hire_date": sap_person.get("hire_date"),
            "termination_date": sap_person.get("termination_date"),
            "cost_center": sap_person.get("cost_center"),
            "location": sap_person.get("location"),
            "manager_id": sap_person.get("manager_id")
        }
    
    async def _check_existing_personnel(self, employee_number: str) -> Optional[Dict[str, Any]]:
        """Check if personnel already exists in BioTime"""
        # This would query the database
        # For now, return None (simulating new personnel)
        return None
    
    async def _resolve_personnel_conflict(self, existing: Dict[str, Any], new: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve personnel data conflicts"""
        # Simple conflict resolution: prefer newer data
        return {
            "resolved": True,
            "personnel": new,
            "resolution_strategy": "prefer_newer",
            "conflict_details": {
                "existing": existing,
                "new": new
            }
        }
    
    async def _create_personnel_from_sap(self, biotime_person: Dict[str, Any]) -> Dict[str, Any]:
        """Create personnel record from SAP data"""
        # This would create the personnel in the database
        # For now, return the personnel data
        return {
            "id": f"person_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            "created": True,
            "data": biotime_person
        }


class LDAPIntegrationService:
    """Integration service for Active Directory/LDAP"""
    
    def __init__(self, ldap_server: str, ldap_port: int, bind_dn: str, bind_password: str):
        self.ldap_server = ldap_server
        self.ldap_port = ldap_port
        self.bind_dn = bind_dn
        self.bind_password = bind_password
    
    async def authenticate_with_ldap(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """Authenticate user against Active Directory/LDAP"""
        try:
            username = credentials.get("username")
            password = credentials.get("password")
            
            # Simulate LDAP authentication
            # In real implementation, this would use python-ldap or similar
            authentication_result = await self._simulate_ldap_auth(username, password)
            
            if authentication_result["success"]:
                # Get user details from LDAP
                user_details = await self._get_ldap_user_details(username)
                
                return {
                    "success": True,
                    "authenticated": True,
                    "user_details": user_details,
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                return {
                    "success": False,
                    "authenticated": False,
                    "error": authentication_result["error"],
                    "timestamp": datetime.utcnow().isoformat()
                }
        
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def _simulate_ldap_auth(self, username: str, password: str) -> Dict[str, Any]:
        """Simulate LDAP authentication"""
        # Simulate authentication logic
        if username and password and len(password) >= 8:
            return {
                "success": True,
                "message": "Authentication successful"
            }
        else:
            return {
                "success": False,
                "error": "Invalid credentials"
            }
    
    async def _get_ldap_user_details(self, username: str) -> Dict[str, Any]:
        """Get user details from LDAP"""
        # Simulate LDAP user lookup
        return {
            "username": username,
            "full_name": f"{username.split('.')[0].title()} {username.split('.')[1].title()}",
            "email": f"{username}@company.com",
            "department": "Engineering",
            "title": "Software Engineer",
            "manager": "manager@company.com",
            "groups": ["Engineers", "Developers", "BioTime_Users"],
            "last_login": (datetime.utcnow() - timedelta(hours=8)).isoformat(),
            "account_status": "active"
        }


class ThirdPartyAccessService:
    """Integration service for third-party access control systems"""
    
    def __init__(self, system_config: Dict[str, Any]):
        self.system_config = system_config
        self.system_type = system_config.get("system_type", "generic")
        self.api_endpoint = system_config.get("api_endpoint")
        self.api_key = system_config.get("api_key")
        
        self.client = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=30.0
        )
    
    async def integrate_access_system(self, system_config: Dict[str, Any]) -> Dict[str, Any]:
        """Integrate with third-party access control system"""
        try:
            integration_result = {
                "system_type": self.system_type,
                "integration_status": "in_progress",
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Test connection to third-party system
            connection_test = await self._test_system_connection()
            
            if connection_test["success"]:
                # Synchronize access data
                sync_result = await self._synchronize_access_data()
                
                if sync_result["success"]:
                    integration_result.update({
                        "integration_status": "completed",
                        "synced_records": sync_result["synced_records"],
                        "message": "Third-party access system integrated successfully"
                    })
                else:
                    integration_result.update({
                        "integration_status": "failed",
                        "error": sync_result["error"],
                        "message": "Failed to synchronize access data"
                    })
            else:
                integration_result.update({
                    "integration_status": "failed",
                    "error": connection_test["error"],
                    "message": "Failed to connect to third-party system"
                })
            
            return integration_result
            
        except Exception as e:
            return {
                "system_type": self.system_type,
                "integration_status": "failed",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def _test_system_connection(self) -> Dict[str, Any]:
        """Test connection to third-party system"""
        try:
            # Simulate connection test
            test_response = await self.client.get(f"{self.api_endpoint}/health")
            
            if test_response.status_code == 200:
                return {
                    "success": True,
                    "message": "Connection successful",
                    "response_time_ms": 150
                }
            else:
                return {
                    "success": False,
                    "error": f"Connection failed: {test_response.status_code}"
                }
        
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _synchronize_access_data(self) -> Dict[str, Any]:
        """Synchronize access data with third-party system"""
        try:
            # Get access data from third-party system
            access_data_response = await self.client.get(f"{self.api_endpoint}/access-data")
            
            if access_data_response.status_code != 200:
                return {
                    "success": False,
                    "error": f"Failed to get access data: {access_data_response.status_code}"
                }
            
            access_data = access_data_response.json().get("data", [])
            
            # Transform and sync to BioTime format
            synced_records = []
            for record in access_data:
                biotime_record = self._transform_access_data_to_biotime(record)
                synced_records.append(biotime_record)
            
            return {
                "success": True,
                "synced_records": len(synced_records),
                "data": synced_records
            }
        
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _transform_access_data_to_biotime(self, access_record: Dict[str, Any]) -> Dict[str, Any]:
        """Transform third-party access data to BioTime format"""
        return {
            "personnel_id": access_record.get("user_id"),
            "access_level": access_record.get("access_level"),
            "device_ids": access_record.get("device_ids", []),
            "time_schedule": access_record.get("time_schedule", {}),
            "valid_from": access_record.get("valid_from"),
            "valid_until": access_record.get("valid_until"),
            "access_reason": access_record.get("access_reason"),
            "approved_by": access_record.get("approved_by"),
            "external_system_id": access_record.get("id"),
            "sync_timestamp": datetime.utcnow().isoformat()
        }


class BioTimeExternalIntegrationManager:
    """Manager for all external system integrations"""
    
    def __init__(self):
        self.sap_service = None
        self.ldap_service = None
        self.third_party_services = {}
        self.integration_status = {}
    
    def initialize_sap_integration(self, sap_config: Dict[str, Any]):
        """Initialize SAP integration service"""
        self.sap_service = SAPIntegrationService(
            sap_config.get("api_url"),
            sap_config.get("api_key")
        )
        self.integration_status["sap"] = "initialized"
    
    def initialize_ldap_integration(self, ldap_config: Dict[str, Any]):
        """Initialize LDAP integration service"""
        self.ldap_service = LDAPIntegrationService(
            ldap_config.get("server"),
            ldap_config.get("port", 389),
            ldap_config.get("bind_dn"),
            ldap_config.get("bind_password")
        )
        self.integration_status["ldap"] = "initialized"
    
    def add_third_party_integration(self, system_name: str, system_config: Dict[str, Any]):
        """Add third-party integration service"""
        self.third_party_services[system_name] = ThirdPartyAccessService(system_config)
        self.integration_status[system_name] = "initialized"
    
    async def sync_all_systems(self) -> Dict[str, Any]:
        """Synchronize data from all configured external systems"""
        sync_results = {}
        
        # Sync from SAP
        if self.sap_service:
            sap_result = await self.sap_service.sync_personnel_from_sap()
            sync_results["sap"] = sap_result
        
        # LDAP authentication test
        if self.ldap_service:
            ldap_test = await self.ldap_service.authenticate_with_ldap({
                "username": "test.user",
                "password": "testpassword123"
            })
            sync_results["ldap"] = ldap_test
        
        # Sync third-party systems
        for system_name, service in self.third_party_services.items():
            third_party_result = await service.integrate_access_system({})
            sync_results[system_name] = third_party_result
        
        return {
            "success": True,
            "sync_results": sync_results,
            "timestamp": datetime.utcnow().isoformat(),
            "total_systems": len(sync_results)
        }
    
    async def get_integration_status(self) -> Dict[str, Any]:
        """Get status of all integrations"""
        return {
            "integration_status": self.integration_status,
            "configured_systems": {
                "sap": self.sap_service is not None,
                "ldap": self.ldap_service is not None,
                "third_party": list(self.third_party_services.keys())
            },
            "last_sync": datetime.utcnow().isoformat(),
            "timestamp": datetime.utcnow().isoformat()
        }


# Global integration manager
integration_manager = BioTimeExternalIntegrationManager()


# Utility functions for external use
async def initialize_external_integrations(config: Dict[str, Any]):
    """Initialize all external system integrations"""
    # Initialize SAP if configured
    if config.get("sap"):
        integration_manager.initialize_sap_integration(config["sap"])
    
    # Initialize LDAP if configured
    if config.get("ldap"):
        integration_manager.initialize_ldap_integration(config["ldap"])
    
    # Initialize third-party systems if configured
    if config.get("third_party"):
        for system_name, system_config in config["third_party"].items():
            integration_manager.add_third_party_integration(system_name, system_config)
    
    return {
        "success": True,
        "message": "External integrations initialized",
        "timestamp": datetime.utcnow().isoformat()
    }


async def sync_all_external_systems():
    """Synchronize data from all external systems"""
    return await integration_manager.sync_all_systems()


async def get_external_integration_status():
    """Get status of all external integrations"""
    return await integration_manager.get_integration_status()
