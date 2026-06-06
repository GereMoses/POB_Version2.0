"""
API Keys and Webhooks Service

This service provides comprehensive API key and webhook management including:
- API key generation and management
- Webhook creation and delivery
- Rate limiting and IP whitelisting
- HMAC signature verification
- Retry logic and failure handling
- Delivery tracking and analytics
"""

import logging
import json
import hashlib
import hmac
import secrets
import requests
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Callable
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from urllib.parse import urlparse

from ..models.system import ApiKey, Webhook, WebhookDelivery, SystemParameter
from ..core.config import settings

logger = logging.getLogger(__name__)


class APIWebhookService:
    """Comprehensive API key and webhook management service"""
    
    def __init__(self, db: Session):
        self.db = db
        self.webhook_timeout = 30  # seconds
        self.max_retries = 3
        self.retry_delays = [60, 300, 900]  # 1min, 5min, 15min
    
    # API Key Management
    async def create_api_key(self, key_data: Dict[str, Any], 
                           created_by: str = None) -> Dict[str, Any]:
        """Create new API key"""
        try:
            # Generate secure API key
            api_key = secrets.token_urlsafe(64)
            
            # Hash the key for storage
            key_hash = self._hash_api_key(api_key)
            
            api_key_record = ApiKey(
                name=key_data["name"],
                api_key=key_hash,
                permissions=key_data.get("permissions", []),
                ip_whitelist=key_data.get("ip_whitelist", []),
                rate_limit=key_data.get("rate_limit", 1000),
                expiry_date=datetime.strptime(key_data["expiry_date"], "%Y-%m-%d").date() if key_data.get("expiry_date") else None,
                is_active=key_data.get("is_active", True),
                created_by=created_by
            )
            
            self.db.add(api_key_record)
            self.db.commit()
            
            logger.info(f"API key created: {api_key_record.name}")
            return {
                "success": True,
                "api_key_id": api_key_record.id,
                "api_key": api_key,  # Return only once during creation
                "name": api_key_record.name,
                "expires_at": api_key_record.expiry_date
            }
            
        except Exception as e:
            logger.error(f"Error creating API key: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    async def validate_api_key(self, api_key: str, ip_address: str = None) -> Optional[Dict[str, Any]]:
        """Validate API key and return permissions"""
        try:
            # Hash the provided key
            key_hash = self._hash_api_key(api_key)
            
            # Find API key record
            key_record = self.db.query(ApiKey).filter(
                ApiKey.api_key == key_hash,
                ApiKey.is_active == True
            ).first()
            
            if not key_record:
                return None
            
            # Check expiry
            if key_record.expiry_date and key_record.expiry_date < datetime.now().date():
                logger.warning(f"API key expired: {key_record.name}")
                return None
            
            # Check IP whitelist
            if key_record.ip_whitelist and ip_address:
                if ip_address not in key_record.ip_whitelist:
                    logger.warning(f"API key IP not whitelisted: {key_record.name}, IP: {ip_address}")
                    return None
            
            # Check rate limit
            current_usage = await self._get_api_key_usage(key_record.id)
            if current_usage >= key_record.rate_limit:
                logger.warning(f"API key rate limit exceeded: {key_record.name}")
                return None
            
            # Update usage statistics
            await self._update_api_key_usage(key_record.id)
            
            return {
                "key_id": key_record.id,
                "name": key_record.name,
                "permissions": key_record.permissions,
                "rate_limit": key_record.rate_limit,
                "current_usage": current_usage
            }
            
        except Exception as e:
            logger.error(f"Error validating API key: {e}")
            return None
    
    async def get_api_keys(self, created_by: str = None) -> List[Dict[str, Any]]:
        """Get API keys"""
        try:
            query = self.db.query(ApiKey)
            
            if created_by:
                query = query.filter(ApiKey.created_by == created_by)
            
            api_keys = query.order_by(ApiKey.created_at.desc()).all()
            
            result = []
            for key in api_keys:
                result.append({
                    "id": key.id,
                    "name": key.name,
                    "permissions": key.permissions,
                    "ip_whitelist": key.ip_whitelist,
                    "rate_limit": key.rate_limit,
                    "expiry_date": key.expiry_date,
                    "is_active": key.is_active,
                    "usage_count": key.usage_count,
                    "last_used": key.last_used,
                    "created_at": key.created_at,
                    "created_by": key.created_by
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting API keys: {e}")
            return []
    
    async def update_api_key(self, key_id: int, 
                           key_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update API key"""
        try:
            key_record = self.db.query(ApiKey).filter(
                ApiKey.id == key_id
            ).first()
            
            if not key_record:
                return {"success": False, "error": "API key not found"}
            
            # Update fields
            for field, value in key_data.items():
                if hasattr(key_record, field) and field != "api_key":
                    if field == "expiry_date" and isinstance(value, str):
                        value = datetime.strptime(value, "%Y-%m-%d").date()
                    setattr(key_record, field, value)
            
            key_record.updated_at = datetime.now(timezone.utc)
            self.db.commit()
            
            logger.info(f"API key updated: {key_record.name}")
            return {"success": True, "name": key_record.name}
            
        except Exception as e:
            logger.error(f"Error updating API key: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    async def revoke_api_key(self, key_id: str) -> Dict[str, Any]:
        """Revoke API key"""
        try:
            key_record = self.db.query(ApiKey).filter(
                ApiKey.id == key_id
            ).first()
            
            if not key_record:
                return {"success": False, "error": "API key not found"}
            
            key_record.is_active = False
            key_record.updated_at = datetime.now(timezone.utc)
            self.db.commit()
            
            logger.info(f"API key revoked: {key_record.name}")
            return {"success": True, "message": "API key revoked"}
            
        except Exception as e:
            logger.error(f"Error revoking API key: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    # Webhook Management
    async def create_webhook(self, webhook_data: Dict[str, Any], 
                           created_by: str = None) -> Dict[str, Any]:
        """Create webhook"""
        try:
            # Validate webhook URL
            if not self._validate_webhook_url(webhook_data["url"]):
                return {"success": False, "error": "Invalid webhook URL"}
            
            # Generate webhook secret
            webhook_secret = secrets.token_urlsafe(32)
            
            webhook = Webhook(
                name=webhook_data["name"],
                url=webhook_data["url"],
                events=webhook_data.get("events", []),
                secret=webhook_secret,
                headers=webhook_data.get("headers", {}),
                is_active=webhook_data.get("is_active", True),
                retry_count=webhook_data.get("retry_count", self.max_retries),
                timeout=webhook_data.get("timeout", self.webhook_timeout),
                created_by=created_by
            )
            
            self.db.add(webhook)
            self.db.commit()
            
            logger.info(f"Webhook created: {webhook.name}")
            return {
                "success": True,
                "webhook_id": webhook.id,
                "name": webhook.name,
                "secret": webhook_secret,  # Return only once during creation
                "url": webhook.url
            }
            
        except Exception as e:
            logger.error(f"Error creating webhook: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    async def trigger_webhook(self, event: str, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Trigger webhooks for event"""
        try:
            # Find active webhooks for this event
            webhooks = self.db.query(Webhook).filter(
                Webhook.is_active == True,
                Webhook.events.contains([event])
            ).all()
            
            results = []
            for webhook in webhooks:
                result = await self._deliver_webhook(webhook, event, data)
                results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Error triggering webhooks: {e}")
            return []
    
    async def _deliver_webhook(self, webhook: Webhook, event: str, 
                             data: Dict[str, Any]) -> Dict[str, Any]:
        """Deliver webhook to endpoint"""
        try:
            # Prepare webhook payload
            payload = {
                "event": event,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": data
            }
            
            # Add signature header
            headers = webhook.headers.copy()
            if webhook.secret:
                signature = self._generate_webhook_signature(
                    json.dumps(payload, sort_keys=True),
                    webhook.secret
                )
                headers["X-Webhook-Signature"] = f"sha256={signature}"
            
            headers.update({
                "Content-Type": "application/json",
                "User-Agent": f"POB-Webhook/1.0 ({webhook.name})"
            })
            
            # Create delivery record
            delivery = WebhookDelivery(
                webhook_id=webhook.id,
                event=event,
                payload=payload,
                status="pending",
                attempt_count=0
            )
            self.db.add(delivery)
            self.db.commit()
            
            # Attempt delivery
            success = await self._send_webhook_request(
                webhook.url, headers, payload, delivery.id
            )
            
            return {
                "webhook_id": webhook.id,
                "webhook_name": webhook.name,
                "delivery_id": delivery.id,
                "success": success
            }
            
        except Exception as e:
            logger.error(f"Error delivering webhook: {e}")
            return {
                "webhook_id": webhook.id,
                "success": False,
                "error": str(e)
            }
    
    async def _send_webhook_request(self, url: str, headers: Dict[str, str], 
                                  payload: Dict[str, Any], 
                                  delivery_id: int) -> bool:
        """Send webhook HTTP request"""
        try:
            response = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=self.webhook_timeout
            )
            
            # Update delivery record
            delivery = self.db.query(WebhookDelivery).filter(
                WebhookDelivery.id == delivery_id
            ).first()
            
            if delivery:
                delivery.status_code = response.status_code
                delivery.response_body = response.text[:1000]  # Limit response size
                delivery.attempt_count += 1
                
                if response.status_code in [200, 201, 202, 204]:
                    delivery.status = "delivered"
                    delivery.delivered_at = datetime.now(timezone.utc)
                    success = True
                else:
                    delivery.status = "failed"
                    delivery.error_message = f"HTTP {response.status_code}"
                    success = False
                
                self.db.commit()
            
            return success
            
        except requests.exceptions.Timeout:
            await self._handle_webhook_failure(delivery_id, "timeout")
            return False
        except requests.exceptions.RequestException as e:
            await self._handle_webhook_failure(delivery_id, str(e))
            return False
        except Exception as e:
            logger.error(f"Webhook request error: {e}")
            return False
    
    async def _handle_webhook_failure(self, delivery_id: int, error: str):
        """Handle webhook delivery failure and schedule retry"""
        try:
            delivery = self.db.query(WebhookDelivery).filter(
                WebhookDelivery.id == delivery_id
            ).first()
            
            if not delivery:
                return
            
            webhook = self.db.query(Webhook).filter(
                Webhook.id == delivery.webhook_id
            ).first()
            
            if not webhook:
                return
            
            delivery.error_message = error
            delivery.attempt_count += 1
            
            # Check if we should retry
            if delivery.attempt_count <= webhook.retry_count:
                delivery.status = "retrying"
                delivery.next_retry_at = datetime.now(timezone.utc) + timedelta(
                    seconds=self.retry_delays[min(delivery.attempt_count - 1, len(self.retry_delays) - 1)]
                )
                
                # Schedule retry (in production, this would use a task queue)
                logger.info(f"Scheduling webhook retry #{delivery.attempt_count} for {webhook.name}")
            else:
                delivery.status = "failed"
                delivery.failed_at = datetime.now(timezone.utc)
                logger.error(f"Webhook delivery failed permanently: {webhook.name}")
            
            self.db.commit()
            
        except Exception as e:
            logger.error(f"Error handling webhook failure: {e}")
    
    async def get_webhooks(self, created_by: str = None) -> List[Dict[str, Any]]:
        """Get webhooks"""
        try:
            query = self.db.query(Webhook)
            
            if created_by:
                query = query.filter(Webhook.created_by == created_by)
            
            webhooks = query.order_by(Webhook.created_at.desc()).all()
            
            result = []
            for webhook in webhooks:
                # Get delivery statistics
                stats = self._get_webhook_stats(webhook.id)
                
                result.append({
                    "id": webhook.id,
                    "name": webhook.name,
                    "url": webhook.url,
                    "events": webhook.events,
                    "is_active": webhook.is_active,
                    "retry_count": webhook.retry_count,
                    "timeout": webhook.timeout,
                    "created_at": webhook.created_at,
                    "created_by": webhook.created_by,
                    "delivery_stats": stats
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting webhooks: {e}")
            return []
    
    async def get_webhook_deliveries(self, webhook_id: int, 
                                   limit: int = 100) -> List[Dict[str, Any]]:
        """Get webhook delivery history"""
        try:
            deliveries = self.db.query(WebhookDelivery).filter(
                WebhookDelivery.webhook_id == webhook_id
            ).order_by(WebhookDelivery.created_at.desc()).limit(limit).all()
            
            result = []
            for delivery in deliveries:
                result.append({
                    "id": delivery.id,
                    "event": delivery.event,
                    "status": delivery.status,
                    "status_code": delivery.status_code,
                    "attempt_count": delivery.attempt_count,
                    "created_at": delivery.created_at,
                    "delivered_at": delivery.delivered_at,
                    "failed_at": delivery.failed_at,
                    "next_retry_at": delivery.next_retry_at,
                    "error_message": delivery.error_message
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting webhook deliveries: {e}")
            return []
    
    async def test_webhook(self, webhook_id: int) -> Dict[str, Any]:
        """Test webhook with sample data"""
        try:
            webhook = self.db.query(Webhook).filter(
                Webhook.id == webhook_id
            ).first()
            
            if not webhook:
                return {"success": False, "error": "Webhook not found"}
            
            # Send test payload
            test_data = {
                "test": True,
                "webhook_id": webhook_id,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            result = await self._deliver_webhook(webhook, "webhook.test", test_data)
            
            return {
                "success": result["success"],
                "delivery_id": result.get("delivery_id"),
                "message": "Test webhook sent" if result["success"] else "Test webhook failed"
            }
            
        except Exception as e:
            logger.error(f"Error testing webhook: {e}")
            return {"success": False, "error": str(e)}
    
    # Utility Methods
    def _hash_api_key(self, api_key: str) -> str:
        """Hash API key for secure storage"""
        return hashlib.sha256(api_key.encode()).hexdigest()
    
    def _validate_webhook_url(self, url: str) -> bool:
        """Validate webhook URL"""
        try:
            result = urlparse(url)
            return all([result.scheme in ['http', 'https'], result.netloc])
        except Exception as e:
            return False
    
    def _generate_webhook_signature(self, payload: str, secret: str) -> str:
        """Generate HMAC signature for webhook"""
        return hmac.new(
            secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
    
    async def _get_api_key_usage(self, key_id: int) -> int:
        """Get current API key usage"""
        try:
            # This would typically use Redis for rate limiting
            # For now, return usage count from database
            key_record = self.db.query(ApiKey).filter(ApiKey.id == key_id).first()
            return key_record.usage_count if key_record else 0
        except Exception as e:
            return 0
    
    async def _update_api_key_usage(self, key_id: int):
        """Update API key usage statistics"""
        try:
            key_record = self.db.query(ApiKey).filter(ApiKey.id == key_id).first()
            if key_record:
                key_record.usage_count += 1
                key_record.last_used = datetime.now(timezone.utc)
                self.db.commit()
        except Exception as e:
            logger.warning(f"Unexpected error: {e}")
    
    def _get_webhook_stats(self, webhook_id: int) -> Dict[str, Any]:
        """Get webhook delivery statistics"""
        try:
            total = self.db.query(WebhookDelivery).filter(
                WebhookDelivery.webhook_id == webhook_id
            ).count()
            
            delivered = self.db.query(WebhookDelivery).filter(
                WebhookDelivery.webhook_id == webhook_id,
                WebhookDelivery.status == "delivered"
            ).count()
            
            failed = self.db.query(WebhookDelivery).filter(
                WebhookDelivery.webhook_id == webhook_id,
                WebhookDelivery.status == "failed"
            ).count()
            
            # Recent deliveries (last 24 hours)
            recent = self.db.query(WebhookDelivery).filter(
                WebhookDelivery.webhook_id == webhook_id,
                WebhookDelivery.created_at >= datetime.now(timezone.utc) - timedelta(hours=24)
            ).count()
            
            return {
                "total_deliveries": total,
                "successful_deliveries": delivered,
                "failed_deliveries": failed,
                "success_rate": (delivered / total * 100) if total > 0 else 0,
                "recent_deliveries": recent
            }
            
        except Exception as e:
            logger.error(f"Error getting webhook stats: {e}")
            return {
                "total_deliveries": 0,
                "successful_deliveries": 0,
                "failed_deliveries": 0,
                "success_rate": 0,
                "recent_deliveries": 0
            }
    
    async def get_api_webhook_statistics(self) -> Dict[str, Any]:
        """Get API key and webhook statistics"""
        try:
            # API key statistics
            total_keys = self.db.query(ApiKey).count()
            active_keys = self.db.query(ApiKey).filter(ApiKey.is_active == True).count()
            expired_keys = self.db.query(ApiKey).filter(
                ApiKey.expiry_date < datetime.now().date()
            ).count()
            
            # Webhook statistics
            total_webhooks = self.db.query(Webhook).count()
            active_webhooks = self.db.query(Webhook).filter(Webhook.is_active == True).count()
            
            # Delivery statistics
            total_deliveries = self.db.query(WebhookDelivery).count()
            successful_deliveries = self.db.query(WebhookDelivery).filter(
                WebhookDelivery.status == "delivered"
            ).count()
            
            return {
                "api_keys": {
                    "total": total_keys,
                    "active": active_keys,
                    "expired": expired_keys
                },
                "webhooks": {
                    "total": total_webhooks,
                    "active": active_webhooks
                },
                "deliveries": {
                    "total": total_deliveries,
                    "successful": successful_deliveries,
                    "success_rate": (successful_deliveries / total_deliveries * 100) if total_deliveries > 0 else 0
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting API/webhook statistics: {e}")
            return {}


# API/Webhook service factory
def get_api_webhook_service(db: Session) -> APIWebhookService:
    """Get API/webhook service instance"""
    return APIWebhookService(db)
