"""
BioTime API Client

This module provides a comprehensive HTTP client for interacting with ZKTeco BioTime API endpoints,
handling authentication, data formatting, and error management for seamless integration.
"""

import logging
import httpx
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import json
import base64
from urllib.parse import urljoin

logger = logging.getLogger(__name__)


class BioTimeClient:
    """HTTP client for ZKTeco BioTime API"""
    
    def __init__(self):
        self.base_url = "https://biotime-server:8080/api"  # Default BioTime URL
        self.api_key = None
        self.access_token = None
        self.token_expires_at = None
        self.timeout = 30.0
        self.client = None
        
    def configure(self, base_url: str, api_key: str):
        """Configure BioTime client with connection details"""
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        )
    
    async def _ensure_auth(self) -> bool:
        """Ensure we have a valid authentication token"""
        if not self.api_key:
            logger.error("BioTime API key not configured")
            return False
        
        # Check if token is still valid
        if (self.access_token and self.token_expires_at and 
            datetime.utcnow() < self.token_expires_at):
            return True
        
        # Authenticate with API key
        try:
            auth_data = {
                "api_key": self.api_key,
                "grant_type": "api_key"
            }
            
            response = await self.client.post("/auth/token", json=auth_data)
            
            if response.status_code == 200:
                auth_result = response.json()
                self.access_token = auth_result.get("access_token")
                expires_in = auth_result.get("expires_in", 3600)
                self.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in - 60)  # 1 min buffer
                
                # Update client headers with token
                self.client.headers["Authorization"] = f"Bearer {self.access_token}"
                
                logger.info("BioTime authentication successful")
                return True
            else:
                logger.error(f"BioTime authentication failed: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"BioTime authentication error: {str(e)}")
            return False
    
    async def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                          params: Optional[Dict] = None) -> Dict[str, Any]:
        """Make authenticated request to BioTime API"""
        if not await self._ensure_auth():
            return {
                "success": False,
                "error": "Authentication failed",
                "status_code": 401
            }
        
        try:
            url = endpoint if endpoint.startswith('/') else f'/{endpoint}'
            
            if method.upper() == "GET":
                response = await self.client.get(url, params=params)
            elif method.upper() == "POST":
                response = await self.client.post(url, json=data)
            elif method.upper() == "PUT":
                response = await self.client.put(url, json=data)
            elif method.upper() == "DELETE":
                response = await self.client.delete(url)
            else:
                return {
                    "success": False,
                    "error": f"Unsupported HTTP method: {method}"
                }
            
            # Handle response
            if response.status_code in [200, 201]:
                return {
                    "success": True,
                    "data": response.json(),
                    "status_code": response.status_code
                }
            elif response.status_code == 401:
                # Token expired, try to refresh
                self.access_token = None
                if await self._ensure_auth():
                    return await self._make_request(method, endpoint, data, params)
                else:
                    return {
                        "success": False,
                        "error": "Authentication failed",
                        "status_code": 401
                    }
            else:
                error_data = response.json() if response.content else {"error": response.text}
                return {
                    "success": False,
                    "error": error_data.get("error", f"HTTP {response.status_code}"),
                    "status_code": response.status_code,
                    "details": error_data
                }
                
        except httpx.TimeoutException:
            return {
                "success": False,
                "error": "Request timeout",
                "status_code": 408
            }
        except httpx.ConnectError:
            return {
                "success": False,
                "error": "Connection failed",
                "status_code": 503
            }
        except Exception as e:
            logger.error(f"BioTime API request error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "status_code": 500
            }
    
    async def health_check(self) -> Dict[str, Any]:
        """Check BioTime API health status"""
        try:
            response = await self._make_request("GET", "/health")
            return response
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "status": "unhealthy"
            }
    
    # Personnel Management Endpoints
    async def get_personnel(self, updated_since: Optional[datetime] = None, 
                          limit: int = 1000, offset: int = 0) -> Dict[str, Any]:
        """Get personnel from BioTime"""
        params = {"limit": limit, "offset": offset}
        if updated_since:
            params["updated_since"] = updated_since.isoformat()
        
        return await self._make_request("GET", "/personnel/users", params=params)
    
    async def get_personnel_by_id(self, employee_id: str) -> Dict[str, Any]:
        """Get specific personnel by employee ID"""
        return await self._make_request("GET", f"/personnel/users/{employee_id}")
    
    async def create_or_update_personnel(self, personnel_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update personnel in BioTime"""
        return await self._make_request("POST", "/personnel/users", data=personnel_data)
    
    async def delete_personnel(self, employee_id: str) -> Dict[str, Any]:
        """Delete personnel from BioTime"""
        return await self._make_request("DELETE", f"/personnel/users/{employee_id}")
    
    # Biometric Management Endpoints
    async def get_biometric_templates(self, employee_id: str) -> Dict[str, Any]:
        """Get biometric templates for personnel"""
        return await self._make_request("GET", f"/personnel/{employee_id}/biometrics")
    
    async def enroll_biometric(self, biometric_data: Dict[str, Any]) -> Dict[str, Any]:
        """Enroll biometric template"""
        return await self._make_request("POST", "/personnel/biometrics/enroll", data=biometric_data)
    
    async def delete_biometric_template(self, template_id: str) -> Dict[str, Any]:
        """Delete biometric template"""
        return await self._make_request("DELETE", f"/personnel/biometrics/{template_id}")
    
    async def verify_biometric(self, verification_data: Dict[str, Any]) -> Dict[str, Any]:
        """Verify biometric data"""
        return await self._make_request("POST", "/personnel/biometrics/verify", data=verification_data)
    
    # Attendance Management Endpoints
    async def get_attendance(self, from_date: Optional[datetime] = None, 
                          to_date: Optional[datetime] = None, 
                          employee_id: Optional[str] = None,
                          limit: int = 1000) -> Dict[str, Any]:
        """Get attendance records from BioTime"""
        params = {"limit": limit}
        if from_date:
            params["from_date"] = from_date.isoformat()
        if to_date:
            params["to_date"] = to_date.isoformat()
        if employee_id:
            params["employee_id"] = employee_id
        
        return await self._make_request("GET", "/attendance/records", params=params)
    
    async def create_attendance_record(self, attendance_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create attendance record in BioTime"""
        return await self._make_request("POST", "/attendance/records", data=attendance_data)
    
    async def get_attendance_summary(self, date: datetime) -> Dict[str, Any]:
        """Get daily attendance summary"""
        params = {"date": date.isoformat()}
        return await self._make_request("GET", "/attendance/summary", params=params)
    
    # Device Management Endpoints
    async def get_devices(self) -> Dict[str, Any]:
        """Get all BioTime devices"""
        return await self._make_request("GET", "/devices/terminals")
    
    async def get_device_status(self, device_id: str) -> Dict[str, Any]:
        """Get device status"""
        return await self._make_request("GET", f"/devices/terminals/{device_id}/status")
    
    async def configure_device(self, device_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Configure device settings"""
        return await self._make_request("PUT", f"/devices/terminals/{device_id}/config", data=config)
    
    # Access Control Endpoints
    async def get_access_levels(self) -> Dict[str, Any]:
        """Get access levels"""
        return await self._make_request("GET", "/access/levels")
    
    async def assign_access_level(self, employee_id: str, access_level_id: str) -> Dict[str, Any]:
        """Assign access level to personnel"""
        data = {
            "employee_id": employee_id,
            "access_level_id": access_level_id
        }
        return await self._make_request("POST", "/access/assign", data=data)
    
    async def revoke_access(self, employee_id: str, device_id: str) -> Dict[str, Any]:
        """Revoke access for personnel"""
        data = {
            "employee_id": employee_id,
            "device_id": device_id
        }
        return await self._make_request("POST", "/access/revoke", data=data)
    
    # Reporting Endpoints
    async def get_attendance_report(self, report_type: str, from_date: datetime, 
                                to_date: datetime, filters: Optional[Dict] = None) -> Dict[str, Any]:
        """Generate attendance report"""
        data = {
            "report_type": report_type,
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
            "filters": filters or {}
        }
        return await self._make_request("POST", "/reports/attendance", data=data)
    
    async def get_biometric_usage_report(self, from_date: datetime, 
                                     to_date: datetime) -> Dict[str, Any]:
        """Get biometric usage report"""
        params = {
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat()
        }
        return await self._make_request("GET", "/reports/biometric-usage", params=params)
    
    # Synchronization Endpoints
    async def get_sync_status(self) -> Dict[str, Any]:
        """Get synchronization status"""
        return await self._make_request("GET", "/sync/status")
    
    async def trigger_sync(self, sync_type: str) -> Dict[str, Any]:
        """Trigger manual synchronization"""
        data = {"sync_type": sync_type}
        return await self._make_request("POST", "/sync/trigger", data=data)
    
    async def close(self):
        """Close HTTP client"""
        if self.client:
            await self.client.aclose()


# Global BioTime client instance
biotime_client = BioTimeClient()
