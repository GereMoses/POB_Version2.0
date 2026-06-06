"""
Enhanced WebSocket Service for Mustering
High-performance WebSocket management with reconnection, heartbeat, and reliability features
"""

import asyncio
import json
import logging
from typing import Dict, List, Set, Optional, Any
from datetime import datetime, timedelta
import weakref

logger = logging.getLogger(__name__)

class EnhancedMusteringConnectionManager:
    """Enhanced WebSocket connection manager with reliability features"""
    
    def __init__(self):
        # Event-based connections: {event_id: {connection_id: connection}}
        self.event_connections: Dict[int, Dict[str, weakref.ref]] = {}
        
        # Connection metadata
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}
        
        # Performance metrics
        self.metrics = {
            'total_connections': 0,
            'active_connections': 0,
            'messages_sent': 0,
            'messages_received': 0,
            'reconnections': 0,
            'errors': 0,
            'last_cleanup': datetime.utcnow()
        }
        
        # Configuration
        self.config = {
            'max_connections_per_event': 1000,
            'heartbeat_interval': 30,  # seconds
            'connection_timeout': 300,  # seconds
            'message_queue_size': 100,
            'cleanup_interval': 60  # seconds
        }
        
        # Start background tasks
        self._cleanup_task = None
        self._heartbeat_task = None
    
    async def connect_to_event(self, websocket, event_id: int, connection_id: str, user_info: Optional[Dict] = None):
        """Connect to specific mustering event"""
        try:
            # Check connection limits
            event_connections = self.event_connections.get(event_id, {})
            if len(event_connections) >= self.config['max_connections_per_event']:
                logger.warning(f"Event {event_id} has reached max connections: {len(event_connections)}")
                await websocket.close(code=1008, reason="Too many connections")
                return False
            
            # Add connection
            if event_id not in self.event_connections:
                self.event_connections[event_id] = {}
            
            self.event_connections[event_id][connection_id] = weakref.ref(websocket)
            
            # Store connection metadata
            self.connection_metadata[connection_id] = {
                'event_id': event_id,
                'connected_at': datetime.utcnow(),
                'last_heartbeat': datetime.utcnow(),
                'user_info': user_info or {},
                'message_count': 0,
                'is_active': True
            }
            
            # Update metrics
            self.metrics['total_connections'] += 1
            self.metrics['active_connections'] += 1
            
            logger.info(f"WebSocket connected to event {event_id}: {connection_id}")
            
            # Send welcome message
            await self._send_to_connection(connection_id, {
                'type': 'connection_established',
                'data': {
                    'event_id': event_id,
                    'connection_id': connection_id,
                    'timestamp': datetime.utcnow().isoformat(),
                    'server_time': datetime.utcnow().isoformat()
                }
            })
            
            return True
            
        except Exception as e:
            logger.error(f"Error connecting WebSocket to event {event_id}: {e}")
            return False
    
    async def disconnect_from_event(self, connection_id: str, reason: Optional[str] = None):
        """Disconnect from mustering event"""
        try:
            # Find and remove connection
            event_id = None
            for evt_id, connections in self.event_connections.items():
                if connection_id in connections:
                    event_id = evt_id
                    del connections[connection_id]
                    break
            
            if event_id and connection_id in self.connection_metadata:
                del self.connection_metadata[connection_id]
                self.metrics['active_connections'] -= 1
            
            logger.info(f"WebSocket disconnected from event {event_id}: {connection_id} - {reason}")
            
        except Exception as e:
            logger.error(f"Error disconnecting WebSocket {connection_id}: {e}")
    
    async def broadcast_to_event(self, event_id: int, message: Dict[str, Any], exclude_connections: Optional[Set[str]] = None):
        """Broadcast message to all connections in an event"""
        try:
            if event_id not in self.event_connections:
                logger.warning(f"No connections for event {event_id}")
                return 0
            
            event_connections = self.event_connections[event_id]
            active_connections = {
                conn_id: weakref_ref() 
                for conn_id, weakref_ref in event_connections.items()
                if weakref_ref() and conn_id not in (exclude_connections or set())
            }
            
            if not active_connections:
                logger.warning(f"No active connections for event {event_id}")
                return 0
            
            # Prepare message with metadata
            enhanced_message = {
                **message,
                'metadata': {
                    'event_id': event_id,
                    'timestamp': datetime.utcnow().isoformat(),
                    'message_id': f"msg_{datetime.utcnow().timestamp()}",
                    'connection_count': len(active_connections)
                }
            }
            
            # Send to all active connections
            message_json = json.dumps(enhanced_message)
            sent_count = 0
            
            for conn_id, connection_ref in event_connections.items():
                if conn_id not in (exclude_connections or set()):
                    connection = connection_ref()
                    if connection and not connection.closed:
                        try:
                            await connection.send_text(message_json)
                            sent_count += 1
                            
                            # Update connection metadata
                            if conn_id in self.connection_metadata:
                                self.connection_metadata[conn_id]['message_count'] += 1
                                self.connection_metadata[conn_id]['last_activity'] = datetime.utcnow()
                        
                        except Exception as e:
                            logger.error(f"Error sending to connection {conn_id}: {e}")
                            self.metrics['errors'] += 1
            
            self.metrics['messages_sent'] += sent_count
            logger.info(f"Broadcast to event {event_id}: {sent_count} connections, message type: {message.get('type')}")
            
            return sent_count
            
        except Exception as e:
            logger.error(f"Error broadcasting to event {event_id}: {e}")
            self.metrics['errors'] += 1
            return 0
    
    async def send_to_connection(self, connection_id: str, message: Dict[str, Any]):
        """Send message to specific connection"""
        try:
            if connection_id not in self.event_connections:
                logger.warning(f"Connection {connection_id} not found")
                return False
            
            event_connections = self.event_connections.get(next(iter(self.event_connections.keys())), {})
            connection_ref = event_connections.get(connection_id)
            connection = connection_ref() if connection_ref else None
            
            if not connection or connection.closed:
                logger.warning(f"Connection {connection_id} is not active")
                return False
            
            # Prepare message with metadata
            enhanced_message = {
                **message,
                'metadata': {
                    'connection_id': connection_id,
                    'timestamp': datetime.utcnow().isoformat(),
                    'message_id': f"msg_{datetime.utcnow().timestamp()}",
                    'direct_message': True
                }
            }
            
            await connection.send_text(json.dumps(enhanced_message))
            
            # Update connection metadata
            if connection_id in self.connection_metadata:
                self.connection_metadata[connection_id]['message_count'] += 1
                self.connection_metadata[connection_id]['last_activity'] = datetime.utcnow()
            
            self.metrics['messages_sent'] += 1
            logger.debug(f"Sent direct message to connection {connection_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending to connection {connection_id}: {e}")
            self.metrics['errors'] += 1
            return False
    
    async def get_event_connections(self, event_id: int) -> Dict[str, Dict[str, Any]]:
        """Get all connections for an event"""
        try:
            if event_id not in self.event_connections:
                return {}
            
            event_connections = self.event_connections[event_id]
            connections_info = {}
            
            for conn_id, connection_ref in event_connections.items():
                connection = connection_ref()
                metadata = self.connection_metadata.get(conn_id, {})
                
                connections_info[conn_id] = {
                    'is_connected': connection and not connection.closed,
                    'connected_at': metadata.get('connected_at'),
                    'last_heartbeat': metadata.get('last_heartbeat'),
                    'message_count': metadata.get('message_count', 0),
                    'user_info': metadata.get('user_info', {}),
                    'last_activity': metadata.get('last_activity'),
                    'is_active': metadata.get('is_active', False)
                }
            
            return connections_info
            
        except Exception as e:
            logger.error(f"Error getting event connections: {e}")
            return {}
    
    async def get_connection_metrics(self) -> Dict[str, Any]:
        """Get connection manager metrics"""
        try:
            # Calculate uptime
            uptime = datetime.utcnow() - self.metrics.get('start_time', datetime.utcnow())
            
            # Clean up dead connections
            await self._cleanup_dead_connections()
            
            return {
                'total_connections': self.metrics['total_connections'],
                'active_connections': self.metrics['active_connections'],
                'messages_sent': self.metrics['messages_sent'],
                'messages_received': self.metrics['messages_received'],
                'reconnections': self.metrics['reconnections'],
                'errors': self.metrics['errors'],
                'uptime_seconds': uptime.total_seconds(),
                'events_with_connections': len(self.event_connections),
                'total_event_connections': sum(len(conns) for conns in self.event_connections.values()),
                'last_cleanup': self.metrics['last_cleanup'].isoformat(),
                'config': self.config
            }
            
        except Exception as e:
            logger.error(f"Error getting connection metrics: {e}")
            return {}
    
    async def _send_to_connection(self, connection_id: str, message: Dict[str, Any]):
        """Send message to specific connection (internal method)"""
        try:
            if connection_id not in self.event_connections:
                return
            
            event_connections = self.event_connections.get(next(iter(self.event_connections.keys())), {})
            connection_ref = event_connections.get(connection_id)
            connection = connection_ref() if connection_ref else None
            
            if connection and not connection.closed:
                await connection.send_text(json.dumps(message))
                
                # Update metadata
                if connection_id in self.connection_metadata:
                    self.connection_metadata[connection_id]['message_count'] += 1
                    self.connection_metadata[connection_id]['last_activity'] = datetime.utcnow()
            
        except Exception as e:
            logger.error(f"Error sending to connection {connection_id}: {e}")
    
    async def _cleanup_dead_connections(self):
        """Clean up dead connections"""
        try:
            current_time = datetime.utcnow()
            cleanup_count = 0
            
            for event_id, connections in list(self.event_connections.items()):
                dead_connections = []
                
                for conn_id, connection_ref in list(connections.items()):
                    connection = connection_ref()
                    
                    # Check if connection is dead
                    is_dead = (
                        not connection or 
                        connection.closed or
                        (current_time - self.connection_metadata.get(conn_id, {}).get('last_heartbeat', current_time)).total_seconds() > self.config['connection_timeout']
                    )
                    
                    if is_dead:
                        dead_connections.append(conn_id)
                        if conn_id in self.connection_metadata:
                            del self.connection_metadata[conn_id]
                        del connections[conn_id]
                        cleanup_count += 1
                
                # Remove dead connections from event
                for conn_id in dead_connections:
                    if conn_id in connections:
                        del connections[conn_id]
                
                if dead_connections:
                    self.metrics['active_connections'] -= len(dead_connections)
                    logger.info(f"Cleaned up {len(dead_connections)} dead connections for event {event_id}")
            
            if cleanup_count > 0:
                self.metrics['last_cleanup'] = current_time
            
        except Exception as e:
            logger.error(f"Error cleaning up dead connections: {e}")
    
    async def start_background_tasks(self):
        """Start background tasks for heartbeat and cleanup"""
        try:
            # Start heartbeat task
            if self._heartbeat_task is None:
                self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
            
            # Start cleanup task
            if self._cleanup_task is None:
                self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            
            logger.info("Started WebSocket background tasks")
            
        except Exception as e:
            logger.error(f"Error starting background tasks: {e}")
    
    async def stop_background_tasks(self):
        """Stop background tasks"""
        try:
            if self._heartbeat_task:
                self._heartbeat_task.cancel()
                self._heartbeat_task = None
            
            if self._cleanup_task:
                self._cleanup_task.cancel()
                self._cleanup_task = None
            
            logger.info("Stopped WebSocket background tasks")
            
        except Exception as e:
            logger.error(f"Error stopping background tasks: {e}")
    
    async def _heartbeat_loop(self):
        """Background task for sending heartbeats"""
        while True:
            try:
                await asyncio.sleep(self.config['heartbeat_interval'])
                
                current_time = datetime.utcnow()
                heartbeat_message = {
                    'type': 'heartbeat',
                    'timestamp': current_time.isoformat(),
                    'server_time': current_time.isoformat()
                }
                
                # Send heartbeat to all connections
                for event_id, connections in self.event_connections.items():
                    for conn_id, connection_ref in connections.items():
                        connection = connection_ref()
                        if connection and not connection.closed:
                            await connection.send_text(json.dumps(heartbeat_message))
                            
                            # Update heartbeat timestamp
                            if conn_id in self.connection_metadata:
                                self.connection_metadata[conn_id]['last_heartbeat'] = current_time
                
                self.metrics['messages_sent'] += sum(len(conns) for conns in self.event_connections.values())
                
            except asyncio.CancelledError:
                logger.info("Heartbeat task cancelled")
                break
            except Exception as e:
                logger.error(f"Error in heartbeat loop: {e}")
                await asyncio.sleep(5)  # Wait before retrying
    
    async def _cleanup_loop(self):
        """Background task for cleaning up dead connections"""
        while True:
            try:
                await asyncio.sleep(self.config['cleanup_interval'])
                await self._cleanup_dead_connections()
                
            except asyncio.CancelledError:
                logger.info("Cleanup task cancelled")
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
                await asyncio.sleep(10)  # Brief pause before retry

# Global enhanced connection manager
enhanced_manager = EnhancedMusteringConnectionManager()

# Compatibility functions for existing code
async def connect_to_event(websocket, event_id: int):
    """Connect to event (compatibility function)"""
    connection_id = f"conn_{datetime.utcnow().timestamp()}_{id(websocket)}"
    return await enhanced_manager.connect_to_event(websocket, event_id, connection_id)

async def disconnect_from_event(websocket, event_id: int):
    """Disconnect from event (compatibility function)"""
    # Find connection ID for this websocket
    for evt_id, connections in enhanced_manager.event_connections.items():
        if evt_id == event_id:
            for conn_id, connection_ref in connections.items():
                if connection_ref() == websocket:
                    await enhanced_manager.disconnect_from_event(conn_id)
                    return
    
    # If not found, disconnect all connections for this event
    if event_id in enhanced_manager.event_connections:
        for conn_id in list(enhanced_manager.event_connections[event_id].keys()):
            await enhanced_manager.disconnect_from_event(conn_id)

async def broadcast_to_event(event_id: int, message: str):
    """Broadcast to event (compatibility function)"""
    message_dict = json.loads(message) if isinstance(message, str) else message
    await enhanced_manager.broadcast_to_event(event_id, message_dict)

def get_connection_metrics():
    """Get connection metrics (compatibility function)"""
    return asyncio.run(enhanced_manager.get_connection_metrics())
