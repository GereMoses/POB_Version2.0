"""
Emergency WebSocket Manager - POB v2.0
Real-time emergency updates and notifications
"""

import json
import asyncio
import logging
from typing import List, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class EmergencyWebSocketManager:
    """Manages WebSocket connections for real-time emergency updates"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_metadata: Dict[WebSocket, Dict[str, Any]] = {}
        
    async def connect(self, websocket: WebSocket, user_info: Dict[str, Any] = None):
        """Accept and register WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        
        # Store connection metadata
        self.connection_metadata[websocket] = {
            "connected_at": datetime.now(timezone.utc),
            "user_info": user_info or {},
            "last_ping": datetime.now(timezone.utc)
        }
        
        logger.info(f"Emergency WebSocket connected. Total connections: {len(self.active_connections)}")
        
        # Send initial status
        await self.send_to_connection(websocket, {
            "type": "connection_established",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": "Emergency WebSocket connection established"
        })
    
    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        if websocket in self.connection_metadata:
            del self.connection_metadata[websocket]
        
        logger.info(f"Emergency WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_to_connection(self, websocket: WebSocket, data: Dict[str, Any]):
        """Send data to specific WebSocket connection"""
        try:
            await websocket.send_text(json.dumps(data))
        except Exception as e:
            logger.error(f"Error sending to WebSocket: {str(e)}")
            # Remove dead connection
            self.disconnect(websocket)
    
    async def broadcast(self, data: Dict[str, Any]):
        """Broadcast data to all active connections"""
        if not self.active_connections:
            return
        
        message = json.dumps(data)
        dead_connections = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to connection: {str(e)}")
                dead_connections.append(connection)
        
        # Remove dead connections
        for connection in dead_connections:
            self.disconnect(connection)
        
        logger.info(f"Broadcasted emergency update to {len(self.active_connections)} connections")
    
    async def broadcast_emergency_event(self, event_data: Dict[str, Any]):
        """Broadcast emergency event update"""
        await self.broadcast({
            "type": "emergency_event",
            "data": event_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_lockdown_update(self, lockdown_data: Dict[str, Any]):
        """Broadcast lockdown status update"""
        await self.broadcast({
            "type": "lockdown_update",
            "data": lockdown_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_fire_mode_update(self, fire_data: Dict[str, Any]):
        """Broadcast fire mode update"""
        await self.broadcast({
            "type": "fire_mode_update",
            "data": fire_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_device_status(self, device_data: Dict[str, Any]):
        """Broadcast emergency device status update"""
        await self.broadcast({
            "type": "device_status",
            "data": device_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_mustering_update(self, mustering_data: Dict[str, Any]):
        """Broadcast mustering update"""
        await self.broadcast({
            "type": "mustering_update",
            "data": mustering_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_notification_status(self, notification_data: Dict[str, Any]):
        """Broadcast notification status update"""
        await self.broadcast({
            "type": "notification_status",
            "data": notification_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_system_status(self, status_data: Dict[str, Any]):
        """Broadcast system status update"""
        await self.broadcast({
            "type": "system_status",
            "data": status_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def ping_all_connections(self):
        """Send ping to all connections to check connectivity"""
        if not self.active_connections:
            return
        
        ping_message = {
            "type": "ping",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await self.broadcast(ping_message)
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics"""
        return {
            "total_connections": len(self.active_connections),
            "connections": [
                {
                    "connected_at": metadata["connected_at"].isoformat(),
                    "last_ping": metadata["last_ping"].isoformat(),
                    "user_info": metadata["user_info"]
                }
                for metadata in self.connection_metadata.values()
            ]
        }
    
    async def cleanup_stale_connections(self, max_age_minutes: int = 30):
        """Remove stale connections"""
        if not self.active_connections:
            return
        
        current_time = datetime.now(timezone.utc)
        stale_connections = []
        
        for connection, metadata in self.connection_metadata.items():
            age = current_time - metadata["last_ping"]
            if age.total_seconds() > (max_age_minutes * 60):
                stale_connections.append(connection)
        
        for connection in stale_connections:
            self.disconnect(connection)
        
        if stale_connections:
            logger.info(f"Cleaned up {len(stale_connections)} stale emergency WebSocket connections")

# Create singleton instance
emergency_websocket_manager = EmergencyWebSocketManager()

# Background task for connection maintenance
async def emergency_websocket_maintenance():
    """Background task for WebSocket connection maintenance"""
    while True:
        try:
            # Ping all connections
            await emergency_websocket_manager.ping_all_connections()
            
            # Cleanup stale connections
            await emergency_websocket_manager.cleanup_stale_connections()
            
            # Wait before next maintenance cycle
            await asyncio.sleep(60)  # Every minute
            
        except Exception as e:
            logger.error(f"Error in emergency WebSocket maintenance: {str(e)}")
            await asyncio.sleep(60)
