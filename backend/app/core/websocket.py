"""
WebSocket Connection Manager
Basic WebSocket connection management for real-time features
"""

import json
import logging
from typing import Dict, List, Optional
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections for real-time communication"""
    
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.user_connections: Dict[WebSocket, str] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str, room: str = "default"):
        """Connect a WebSocket client"""
        await websocket.accept()
        
        if room not in self.active_connections:
            self.active_connections[room] = []
        
        self.active_connections[room].append(websocket)
        self.user_connections[websocket] = user_id
        
        logger.info(f"User {user_id} connected to room {room}")
        
        # Notify others in the room
        await self.broadcast_to_room(room, {
            "type": "user_connected",
            "user_id": user_id,
            "message": f"User {user_id} joined the room"
        }, exclude_websocket=websocket)
    
    async def disconnect(self, websocket: WebSocket):
        """Disconnect a WebSocket client"""
        user_id = self.user_connections.get(websocket, "unknown")
        
        # Find and remove from all rooms
        for room, connections in self.active_connections.items():
            if websocket in connections:
                connections.remove(websocket)
                logger.info(f"User {user_id} disconnected from room {room}")
                
                # Notify others in the room
                await self.broadcast_to_room(room, {
                    "type": "user_disconnected",
                    "user_id": user_id,
                    "message": f"User {user_id} left the room"
                })
        
        # Remove from user connections
        if websocket in self.user_connections:
            del self.user_connections[websocket]
    
    async def send_personal_message(self, websocket: WebSocket, message: dict):
        """Send a message to a specific WebSocket client"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)
    
    async def broadcast_to_room(self, room: str, message: dict, exclude_websocket: Optional[WebSocket] = None):
        """Broadcast a message to all clients in a room"""
        if room not in self.active_connections:
            return
        
        disconnected = []
        for connection in self.active_connections[room]:
            if connection == exclude_websocket:
                continue
            
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting to room {room}: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected connections
        for connection in disconnected:
            self.disconnect(connection)
    
    async def broadcast_to_all(self, message: dict):
        """Broadcast a message to all connected clients"""
        for room in self.active_connections:
            await self.broadcast_to_room(room, message)
    
    def get_room_connections(self, room: str) -> List[WebSocket]:
        """Get all connections in a specific room"""
        return self.active_connections.get(room, [])
    
    def get_connection_count(self, room: str = None) -> int:
        """Get number of connections in a room or total"""
        if room:
            return len(self.active_connections.get(room, []))
        return len(self.user_connections)
    
    def get_user_rooms(self, user_id: str) -> List[str]:
        """Get all rooms a user is connected to"""
        rooms = []
        for room, connections in self.active_connections.items():
            for connection in connections:
                if self.user_connections.get(connection) == user_id:
                    rooms.append(room)
                    break
        return rooms

# Global connection manager instance
manager = ConnectionManager()

# ── Zone live-count broadcast ─────────────────────────────────────────────────

_zone_connections: list = []  # List[WebSocket]


async def zone_ws_connect(websocket) -> None:
    await websocket.accept()
    _zone_connections.append(websocket)


def zone_ws_disconnect(websocket) -> None:
    if websocket in _zone_connections:
        _zone_connections.remove(websocket)


async def broadcast_zone_update(zone_id: int, count: int, zone_name: str = "") -> None:
    """Push a single zone occupancy update to every connected POB dashboard."""
    if not _zone_connections:
        return
    import json
    payload = json.dumps({"type": "zone_update", "zone_id": zone_id,
                          "count": count, "zone_name": zone_name})
    dead = []
    for ws in list(_zone_connections):
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        zone_ws_disconnect(ws)
