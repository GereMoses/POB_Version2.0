"""
BioTime WebSocket API Endpoints

This module provides WebSocket endpoints for real-time BioTime integration,
including device status streaming, attendance monitoring, and biometric verification updates.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional, Dict, Any
import json
from datetime import datetime

from ..services.biotime_websocket_service import (
    websocket_manager, event_streamer, handle_websocket_connection,
    start_biotime_websocket_service, stop_biotime_websocket_service,
    broadcast_device_alert, broadcast_attendance_alert, broadcast_emergency_alert
)

router = APIRouter()


# WebSocket Endpoints

@router.websocket("/ws/device-status")
async def websocket_device_status(websocket: WebSocket, device_ids: Optional[str] = Query(None)):
    """WebSocket connection for real-time device status streaming"""
    metadata = {
        "connection_type": "device_status",
        "device_ids": device_ids.split(",") if device_ids else None,
        "client_info": {
            "user_agent": websocket.headers.get("user-agent", "unknown"),
            "client_ip": websocket.client.host if websocket.client else "unknown"
        }
    }
    
    await handle_websocket_connection(websocket, "device_status", metadata)


@router.websocket("/ws/attendance-live")
async def websocket_attendance_live(websocket: WebSocket, location: Optional[str] = Query(None)):
    """WebSocket connection for live attendance monitoring"""
    metadata = {
        "connection_type": "attendance_live",
        "location_filter": location,
        "client_info": {
            "user_agent": websocket.headers.get("user-agent", "unknown"),
            "client_ip": websocket.client.host if websocket.client else "unknown"
        }
    }
    
    await handle_websocket_connection(websocket, "attendance_live", metadata)


@router.websocket("/ws/biometric-updates")
async def websocket_biometric_updates(websocket: WebSocket, verification_type: Optional[str] = Query(None)):
    """WebSocket connection for biometric verification updates"""
    metadata = {
        "connection_type": "biometric_updates",
        "verification_type_filter": verification_type,
        "client_info": {
            "user_agent": websocket.headers.get("user-agent", "unknown"),
            "client_ip": websocket.client.host if websocket.client else "unknown"
        }
    }
    
    await handle_websocket_connection(websocket, "biometric_updates", metadata)


@router.websocket("/ws/system-health")
async def websocket_system_health(websocket: WebSocket):
    """WebSocket connection for system health monitoring"""
    metadata = {
        "connection_type": "system_health",
        "client_info": {
            "user_agent": websocket.headers.get("user-agent", "unknown"),
            "client_ip": websocket.client.host if websocket.client else "unknown"
        }
    }
    
    await handle_websocket_connection(websocket, "system_health", metadata)


@router.websocket("/ws/emergency-alerts")
async def websocket_emergency_alerts(websocket: WebSocket, alert_level: Optional[str] = Query(None)):
    """WebSocket connection for emergency alerts"""
    metadata = {
        "connection_type": "emergency_alerts",
        "alert_level_filter": alert_level,
        "client_info": {
            "user_agent": websocket.headers.get("user-agent", "unknown"),
            "client_ip": websocket.client.host if websocket.client else "unknown"
        }
    }
    
    await handle_websocket_connection(websocket, "emergency_alerts", metadata)


@router.websocket("/ws/comprehensive")
async def websocket_comprehensive(websocket: WebSocket):
    """Comprehensive WebSocket connection for all BioTime events"""
    metadata = {
        "connection_type": "comprehensive",
        "subscribed_streams": [
            "device_status",
            "attendance_live", 
            "biometric_updates",
            "system_health",
            "emergency_alerts"
        ],
        "client_info": {
            "user_agent": websocket.headers.get("user-agent", "unknown"),
            "client_ip": websocket.client.host if websocket.client else "unknown"
        }
    }
    
    await handle_websocket_connection(websocket, "comprehensive", metadata)


# WebSocket Service Management

@router.post("/websocket/start")
async def start_websocket_service():
    """Start the BioTime WebSocket service"""
    try:
        await start_biotime_websocket_service()
        
        return {
            "success": True,
            "message": "BioTime WebSocket service started successfully",
            "timestamp": datetime.utcnow().isoformat(),
            "active_streams": list(websocket_manager.active_connections.keys())
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.post("/websocket/stop")
async def stop_websocket_service():
    """Stop the BioTime WebSocket service"""
    try:
        await stop_biotime_websocket_service()
        
        return {
            "success": True,
            "message": "BioTime WebSocket service stopped successfully",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.get("/websocket/status")
async def get_websocket_status():
    """Get current WebSocket service status"""
    try:
        active_connections = {}
        for connection_type, connections in websocket_manager.active_connections.items():
            active_connections[connection_type] = {
                "count": len(connections),
                "connections": [
                    {
                        "connected_at": websocket_manager.connection_metadata.get(conn, {}).get("connected_at"),
                        "metadata": websocket_manager.connection_metadata.get(conn, {}).get("metadata", {})
                    }
                    for conn in connections
                ]
            }
        
        return {
            "success": True,
            "service_status": "running" if event_streamer.streaming_active else "stopped",
            "active_connections": active_connections,
            "total_connections": sum(len(connections) for connections in websocket_manager.active_connections.values()),
            "streaming_tasks": len(event_streamer.stream_tasks),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# Alert Broadcasting

@router.post("/websocket/alert/device")
async def broadcast_device_alert_endpoint(alert_data: Dict[str, Any]):
    """Broadcast device alert to all connected clients"""
    try:
        await broadcast_device_alert(alert_data)
        
        return {
            "success": True,
            "message": "Device alert broadcasted successfully",
            "alert_data": alert_data,
            "timestamp": datetime.utcnow().isoformat(),
            "broadcast_to": len(websocket_manager.active_connections.get("device_status", []))
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.post("/websocket/alert/attendance")
async def broadcast_attendance_alert_endpoint(alert_data: Dict[str, Any]):
    """Broadcast attendance alert to all connected clients"""
    try:
        await broadcast_attendance_alert(alert_data)
        
        return {
            "success": True,
            "message": "Attendance alert broadcasted successfully",
            "alert_data": alert_data,
            "timestamp": datetime.utcnow().isoformat(),
            "broadcast_to": len(websocket_manager.active_connections.get("attendance_live", []))
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.post("/websocket/alert/emergency")
async def broadcast_emergency_alert_endpoint(alert_data: Dict[str, Any]):
    """Broadcast emergency alert to all connected clients"""
    try:
        await broadcast_emergency_alert(alert_data)
        
        return {
            "success": True,
            "message": "Emergency alert broadcasted successfully",
            "alert_data": alert_data,
            "timestamp": datetime.utcnow().isoformat(),
            "broadcast_to": len(websocket_manager.active_connections.get("emergency_alerts", []))
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# Connection Management

@router.get("/websocket/connections")
async def get_active_connections():
    """Get information about active WebSocket connections"""
    try:
        connections_info = {}
        
        for connection_type, connections in websocket_manager.active_connections.items():
            connections_info[connection_type] = {
                "count": len(connections),
                "connections": []
            }
            
            for websocket in connections:
                metadata = websocket_manager.connection_metadata.get(websocket, {})
                connections_info[connection_type]["connections"].append({
                    "connected_at": metadata.get("connected_at"),
                    "client_info": metadata.get("client_info", {}),
                    "metadata": metadata.get("metadata", {})
                })
        
        return {
            "success": True,
            "connections": connections_info,
            "total_connections": sum(len(connections) for connections in websocket_manager.active_connections.values()),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.post("/websocket/disconnect/{connection_type}")
async def disconnect_connections_by_type(connection_type: str):
    """Disconnect all WebSocket connections of specific type"""
    try:
        if connection_type not in websocket_manager.active_connections:
            return {
                "success": False,
                "error": f"Invalid connection type: {connection_type}",
                "timestamp": datetime.utcnow().isoformat()
            }
        
        connections_to_disconnect = websocket_manager.active_connections[connection_type].copy()
        disconnected_count = 0
        
        for websocket in connections_to_disconnect:
            try:
                await websocket.close()
                websocket_manager.disconnect(websocket, connection_type)
                disconnected_count += 1
            except Exception as e:
                print(f"Error disconnecting WebSocket: {e}")
        
        return {
            "success": True,
            "message": f"Disconnected {disconnected_count} connections of type {connection_type}",
            "disconnected_count": disconnected_count,
            "connection_type": connection_type,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# Testing and Debugging

@router.post("/websocket/test/message")
async def test_websocket_message(test_data: Dict[str, Any]):
    """Send test message to all WebSocket connections"""
    try:
        test_message = {
            "type": "test_message",
            "data": test_data,
            "timestamp": datetime.utcnow().isoformat(),
            "source": "test_endpoint"
        }
        
        await websocket_manager.broadcast_to_all(test_message)
        
        return {
            "success": True,
            "message": "Test message broadcasted successfully",
            "test_data": test_data,
            "total_connections": sum(len(connections) for connections in websocket_manager.active_connections.values()),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.get("/websocket/metrics")
async def get_websocket_metrics():
    """Get WebSocket service metrics"""
    try:
        total_connections = sum(len(connections) for connections in websocket_manager.active_connections.values())
        
        # Calculate connection statistics
        connection_stats = {}
        for connection_type, connections in websocket_manager.active_connections.items():
            connection_stats[connection_type] = {
                "count": len(connections),
                "percentage": round((len(connections) / total_connections) * 100, 2) if total_connections > 0 else 0
            }
        
        return {
            "success": True,
            "metrics": {
                "total_connections": total_connections,
                "connection_types": connection_stats,
                "service_status": "running" if event_streamer.streaming_active else "stopped",
                "streaming_tasks": len(event_streamer.stream_tasks),
                "uptime_seconds": 3600,  # Would be calculated from service start time
                "messages_sent": 1000,    # Would be tracked
                "messages_received": 500,  # Would be tracked
                "errors_count": 10,       # Would be tracked
                "last_activity": datetime.utcnow().isoformat()
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
