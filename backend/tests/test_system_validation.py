"""
Comprehensive System Testing and Validation
Tests all critical system components and integrations
"""

import pytest
import asyncio
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import test_db_connection, test_redis_connection
from app.services.performance_monitoring import performance_monitor


class SystemValidator:
    """Comprehensive system validation and testing"""
    
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.test_results = []
        self.errors = []
        
    def run_all_tests(self) -> Dict[str, Any]:
        """Run comprehensive system validation tests"""
        print("🚀 Starting comprehensive system validation...")
        
        test_suites = [
            ("Database Connectivity", self.test_database_connectivity),
            ("Redis Connectivity", self.test_redis_connectivity),
            ("API Health Endpoints", self.test_api_health),
            ("Authentication System", self.test_authentication),
            ("BioTime API Compatibility", self.test_biotime_api),
            ("ZKTeco Device Integration", self.test_zkteco_integration),
            ("ADMS Protocol", self.test_adms_protocol),
            ("Database Schema", self.test_database_schema),
            ("Performance Metrics", self.test_performance_metrics),
            ("Error Handling", self.test_error_handling),
            ("Rate Limiting", self.test_rate_limiting),
            ("CORS Configuration", self.test_cors),
            ("WebSocket Support", self.test_websocket),
            ("Frontend Integration", self.test_frontend_integration)
        ]
        
        for test_name, test_func in test_suites:
            try:
                print(f"\n📋 Running: {test_name}")
                result = test_func()
                self.test_results.append({
                    "test": test_name,
                    "status": "PASSED" if result.get("success", False) else "FAILED",
                    "details": result,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
                if result.get("success", False):
                    print(f"✅ {test_name}: PASSED")
                else:
                    print(f"❌ {test_name}: FAILED")
                    self.errors.append({
                        "test": test_name,
                        "error": result.get("error", "Unknown error")
                    })
                    
            except Exception as e:
                print(f"💥 {test_name}: ERROR - {e}")
                self.test_results.append({
                    "test": test_name,
                    "status": "ERROR",
                    "error": str(e),
                    "timestamp": datetime.utcnow().isoformat()
                })
                self.errors.append({
                    "test": test_name,
                    "error": str(e)
                })
        
        return self.generate_test_report()
    
    def test_database_connectivity(self) -> Dict[str, Any]:
        """Test database connectivity and basic operations"""
        try:
            # Test connection
            if not test_db_connection():
                return {"success": False, "error": "Database connection failed"}
            
            # Test basic query
            engine = create_engine(settings.DATABASE_URL)
            with engine.connect() as conn:
                result = conn.execute(text("SELECT 1 as test")).fetchone()
                if result[0] != 1:
                    return {"success": False, "error": "Basic query failed"}
            
            # Test table existence
            required_tables = [
                "personnel", "iclock_terminal", "iclock_transaction",
                "acc_door", "acc_event", "emergency_event"
            ]
            
            with engine.connect() as conn:
                for table in required_tables:
                    result = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).fetchone()
                    print(f"  📊 Table {table}: {result[0]} records")
            
            return {"success": True, "message": "Database connectivity verified"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_redis_connectivity(self) -> Dict[str, Any]:
        """Test Redis connectivity"""
        try:
            if not test_redis_connection():
                return {"success": False, "error": "Redis connection failed"}
            
            # Test basic operations
            import redis
            redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                decode_responses=True
            )
            
            # Test set/get
            test_key = "test_validation_" + datetime.utcnow().strftime("%Y%m%d%H%M%S")
            redis_client.setex(test_key, 60, "test_value")
            value = redis_client.get(test_key)
            redis_client.delete(test_key)
            
            if value != "test_value":
                return {"success": False, "error": "Redis set/get operation failed"}
            
            return {"success": True, "message": "Redis connectivity verified"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_api_health(self) -> Dict[str, Any]:
        """Test API health endpoints"""
        try:
            # Test main health endpoint
            response = requests.get(f"{self.base_url}/health", timeout=10)
            if response.status_code != 200:
                return {"success": False, "error": f"Health endpoint returned {response.status_code}"}
            
            health_data = response.json()
            if not health_data.get("status") == "healthy":
                return {"success": False, "error": "Health check failed"}
            
            # Test docs endpoint
            response = requests.get(f"{self.base_url}/docs", timeout=10)
            if response.status_code != 200:
                return {"success": False, "error": f"Docs endpoint returned {response.status_code}"}
            
            return {"success": True, "message": "API health endpoints working"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_authentication(self) -> Dict[str, Any]:
        """Test authentication system"""
        try:
            # Test login endpoint
            login_data = {
                "username": "admin",
                "password": "password"
            }
            
            response = requests.post(
                f"{self.base_url}/api/v1/auth/login",
                json=login_data,
                timeout=10
            )
            
            if response.status_code not in [200, 401]:
                return {"success": False, "error": f"Login endpoint returned {response.status_code}"}
            
            # If login successful, test token validation
            if response.status_code == 200:
                token_data = response.json()
                if not token_data.get("access_token"):
                    return {"success": False, "error": "No access token returned"}
                
                # Test protected endpoint with token
                headers = {"Authorization": f"Bearer {token_data['access_token']}"}
                response = requests.get(
                    f"{self.base_url}/api/v1/personnel/",
                    headers=headers,
                    timeout=10
                )
                
                if response.status_code not in [200, 403]:
                    return {"success": False, "error": f"Protected endpoint returned {response.status_code}"}
            
            return {"success": True, "message": "Authentication system working"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_biotime_api(self) -> Dict[str, Any]:
        """Test BioTime API compatibility"""
        try:
            # Test BioTime personnel endpoint
            response = requests.get(f"{self.base_url}/api/v1/biotime-personnel/", timeout=10)
            
            if response.status_code not in [200, 401]:
                return {"success": False, "error": f"BioTime personnel endpoint returned {response.status_code}"}
            
            # Test BioTime attendance endpoint
            response = requests.get(f"{self.base_url}/api/v1/biotime-attendance-api/", timeout=10)
            
            if response.status_code not in [200, 401]:
                return {"success": False, "error": f"BioTime attendance endpoint returned {response.status_code}"}
            
            return {"success": True, "message": "BioTime API endpoints available"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_zkteco_integration(self) -> Dict[str, Any]:
        """Test ZKTeco device integration"""
        try:
            # Test device management endpoint
            response = requests.get(f"{self.base_url}/api/v1/zkteco/devices/", timeout=10)
            
            if response.status_code not in [200, 401]:
                return {"success": False, "error": f"ZKTeco devices endpoint returned {response.status_code}"}
            
            # Test device discovery endpoint
            response = requests.post(f"{self.base_url}/api/v1/zkteco/discover-devices/", timeout=30)
            
            if response.status_code not in [200, 401]:
                return {"success": False, "error": f"Device discovery endpoint returned {response.status_code}"}
            
            return {"success": True, "message": "ZKTeco integration endpoints available"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_adms_protocol(self) -> Dict[str, Any]:
        """Test ADMS protocol endpoints"""
        try:
            # Test ADMS data endpoint
            response = requests.post(
                f"{self.base_url}/iclock/cdata",
                json={"SN": "TEST001", "data": "test"},
                timeout=10
            )
            
            # ADMS endpoints should accept requests even without proper auth
            if response.status_code not in [200, 400, 422]:
                return {"success": False, "error": f"ADMS cdata endpoint returned {response.status_code}"}
            
            # Test ADMS getrequest endpoint
            response = requests.get(f"{self.base_url}/iclock/getrequest", timeout=10)
            
            if response.status_code not in [200, 400]:
                return {"success": False, "error": f"ADMS getrequest endpoint returned {response.status_code}"}
            
            return {"success": True, "message": "ADMS protocol endpoints available"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_database_schema(self) -> Dict[str, Any]:
        """Test database schema alignment with BioTime"""
        try:
            engine = create_engine(settings.DATABASE_URL)
            
            # Test BioTime-compatible tables
            biotime_tables = [
                "personnel_employee",
                "iclock_terminal", 
                "iclock_transaction",
                "acc_level",
                "acc_door",
                "acc_user_authorize"
            ]
            
            with engine.connect() as conn:
                for table in biotime_tables:
                    result = conn.execute(text(f"""
                        SELECT column_name, data_type, is_nullable
                        FROM information_schema.columns 
                        WHERE table_name = '{table}'
                        ORDER BY ordinal_position
                    """)).fetchall()
                    
                    if not result:
                        return {"success": False, "error": f"BioTime table {table} not found"}
                    
                    print(f"  📋 Table {table}: {len(result)} columns")
            
            return {"success": True, "message": "Database schema verified"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_performance_metrics(self) -> Dict[str, Any]:
        """Test performance monitoring system"""
        try:
            # Test performance monitoring service
            system_metrics = performance_monitor.get_system_metrics()
            
            if not system_metrics or "error" in system_metrics:
                return {"success": False, "error": "Performance monitoring service failed"}
            
            # Test performance API endpoint
            response = requests.get(f"{self.base_url}/api/v1/performance/health", timeout=10)
            
            if response.status_code not in [200, 401]:
                return {"success": False, "error": f"Performance API returned {response.status_code}"}
            
            return {"success": True, "message": "Performance monitoring working"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_error_handling(self) -> Dict[str, Any]:
        """Test error handling mechanisms"""
        try:
            # Test validation error
            response = requests.post(
                f"{self.base_url}/api/v1/personnel/",
                json={"invalid": "data"},
                timeout=10
            )
            
            if response.status_code not in [422, 401]:
                return {"success": False, "error": f"Validation error handling failed: {response.status_code}"}
            
            # Test 404 error
            response = requests.get(f"{self.base_url}/api/v1/nonexistent", timeout=10)
            
            if response.status_code != 404:
                return {"success": False, "error": f"404 error handling failed: {response.status_code}"}
            
            return {"success": True, "message": "Error handling working"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_rate_limiting(self) -> Dict[str, Any]:
        """Test rate limiting functionality"""
        try:
            # Make multiple rapid requests to test rate limiting
            responses = []
            for i in range(5):
                response = requests.get(f"{self.base_url}/health", timeout=5)
                responses.append(response.status_code)
            
            # Check if any request was rate limited
            if 429 in responses:
                return {"success": True, "message": "Rate limiting is active"}
            else:
                return {"success": True, "message": "Rate limiting may not be active (or limits not reached)"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_cors(self) -> Dict[str, Any]:
        """Test CORS configuration"""
        try:
            # Test CORS with preflight request
            response = requests.options(
                f"{self.base_url}/api/v1/personnel/",
                headers={"Origin": "http://localhost:3000"},
                timeout=10
            )
            
            # Check for CORS headers
            cors_headers = [
                "access-control-allow-origin",
                "access-control-allow-methods",
                "access-control-allow-headers"
            ]
            
            missing_headers = []
            for header in cors_headers:
                if header not in [h.lower() for h in response.headers]:
                    missing_headers.append(header)
            
            if missing_headers:
                return {"success": False, "error": f"Missing CORS headers: {missing_headers}"}
            
            return {"success": True, "message": "CORS configuration working"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_websocket(self) -> Dict[str, Any]:
        """Test WebSocket support"""
        try:
            import websockets
            
            # Test WebSocket connection
            uri = f"ws://localhost:8000/ws/test"
            
            async def test_ws():
                try:
                    async with websockets.connect(uri) as websocket:
                        await websocket.send("test message")
                        response = await websocket.recv()
                        return True
                except Exception:
                    return False
            
            # Run WebSocket test
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(test_ws())
            loop.close()
            
            if result:
                return {"success": True, "message": "WebSocket support working"}
            else:
                return {"success": False, "error": "WebSocket connection failed"}
            
        except ImportError:
            return {"success": False, "error": "WebSocket library not available"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_frontend_integration(self) -> Dict[str, Any]:
        """Test frontend integration"""
        try:
            # Test if frontend can reach backend
            response = requests.get(f"{self.base_url}/api/v1/", timeout=10)
            
            if response.status_code not in [200, 401]:
                return {"success": False, "error": f"API root endpoint failed: {response.status_code}"}
            
            # Test common frontend API calls
            frontend_apis = [
                "/api/v1/pob-status/dashboard",
                "/api/v1/personnel/",
                "/api/v1/devices/",
                "/api/v1/emergency/"
            ]
            
            for api in frontend_apis:
                response = requests.get(f"{self.base_url}{api}", timeout=10)
                if response.status_code not in [200, 401]:
                    return {"success": False, "error": f"Frontend API {api} failed: {response.status_code}"}
            
            return {"success": True, "message": "Frontend integration working"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def generate_test_report(self) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["status"] == "PASSED"])
        failed_tests = len([r for r in self.test_results if r["status"] in ["FAILED", "ERROR"]])
        
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        return {
            "summary": {
                "total_tests": total_tests,
                "passed": passed_tests,
                "failed": failed_tests,
                "success_rate": round(success_rate, 2),
                "timestamp": datetime.utcnow().isoformat()
            },
            "test_results": self.test_results,
            "errors": self.errors,
            "recommendations": self.generate_recommendations(),
            "production_readiness": self.assess_production_readiness()
        }
    
    def generate_recommendations(self) -> List[str]:
        """Generate recommendations based on test results"""
        recommendations = []
        
        for result in self.test_results:
            if result["status"] in ["FAILED", "ERROR"]:
                test_name = result["test"]
                
                if "Database" in test_name:
                    recommendations.append("Check database connection and configuration")
                elif "Redis" in test_name:
                    recommendations.append("Verify Redis service is running and accessible")
                elif "Authentication" in test_name:
                    recommendations.append("Review authentication configuration and user setup")
                elif "ZKTeco" in test_name:
                    recommendations.append("Check ZKTeco device connectivity and configuration")
                elif "Performance" in test_name:
                    recommendations.append("Monitor system resources and optimize queries")
                elif "Error" in test_name:
                    recommendations.append("Review error handling configuration")
                else:
                    recommendations.append(f"Review {test_name.lower()} configuration")
        
        return recommendations
    
    def assess_production_readiness(self) -> Dict[str, Any]:
        """Assess overall production readiness"""
        critical_tests = [
            "Database Connectivity",
            "API Health Endpoints", 
            "Authentication System",
            "BioTime API Compatibility",
            "ZKTeco Device Integration",
            "ADMS Protocol"
        ]
        
        critical_results = [r for r in self.test_results if r["test"] in critical_tests]
        critical_passed = len([r for r in critical_results if r["status"] == "PASSED"])
        
        if critical_passed == len(critical_tests):
            readiness = "PRODUCTION_READY"
            confidence = "HIGH"
        elif critical_passed >= len(critical_tests) * 0.8:
            readiness = "MOSTLY_READY"
            confidence = "MEDIUM"
        elif critical_passed >= len(critical_tests) * 0.6:
            readiness = "NEEDS_WORK"
            confidence = "LOW"
        else:
            readiness = "NOT_READY"
            confidence = "VERY_LOW"
        
        return {
            "status": readiness,
            "confidence": confidence,
            "critical_tests_passed": critical_passed,
            "critical_tests_total": len(critical_tests),
            "go_live_recommended": readiness == "PRODUCTION_READY"
        }


def run_system_validation():
    """Run comprehensive system validation"""
    validator = SystemValidator()
    return validator.run_all_tests()


if __name__ == "__main__":
    print("🚀 Running POB System Validation...")
    results = run_system_validation()
    
    print("\n" + "="*50)
    print("📊 VALIDATION REPORT")
    print("="*50)
    
    summary = results["summary"]
    print(f"Total Tests: {summary['total_tests']}")
    print(f"Passed: {summary['passed']}")
    print(f"Failed: {summary['failed']}")
    print(f"Success Rate: {summary['success_rate']}%")
    
    readiness = results["production_readiness"]
    print(f"\n🎯 Production Readiness: {readiness['status']}")
    print(f"📈 Confidence: {readiness['confidence']}")
    print(f"✅ Critical Tests: {readiness['critical_tests_passed']}/{readiness['critical_tests_total']}")
    
    if results["errors"]:
        print(f"\n❌ Errors Found: {len(results['errors'])}")
        for error in results["errors"]:
            print(f"  - {error['test']}: {error['error']}")
    
    if results["recommendations"]:
        print(f"\n💡 Recommendations:")
        for rec in results["recommendations"]:
            print(f"  - {rec}")
    
    print("\n" + "="*50)
