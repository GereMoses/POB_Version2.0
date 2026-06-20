/**
 * Custom hook for WebSocket functionality
 * Provides WebSocket connection management and real-time data handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { websocketService } from '../services/websocketService';

const _defaultWsBase = () =>
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

export const useWebSocket = (url = _defaultWsBase(), options = {}) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);
  const listenersRef = useRef(new Map());

  useEffect(() => {
    let mounted = true;

    const connectWebSocket = async () => {
      try {
        if (mounted) {
          setConnectionStatus('connecting');
          setError(null);
        }
        
        await websocketService.connect(url, options);
        
        if (mounted) {
          setConnectionStatus('connected');
        }
      } catch (err) {
        if (mounted) {
          setConnectionStatus('error');
          setError(err);
        }
      }
    };

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      mounted = false;
      listenersRef.current.forEach((unsub, event) => {
        unsub();
      });
      listenersRef.current.clear();
    };
  }, [url, options]);

  const sendMessage = useCallback((event, data) => {
    return websocketService.send(event, data);
  }, []);

  const subscribe = useCallback((event, callback) => {
    const unsubscribe = websocketService.on(event, callback);
    
    // Store unsubscribe for cleanup
    const existingUnsubs = listenersRef.current.get(event) || [];
    existingUnsubs.push(unsubscribe);
    listenersRef.current.set(event, existingUnsubs);
    
    return unsubscribe;
  }, []);

  const subscribeToPersonnel = useCallback((personnelId = null) => {
    return websocketService.subscribeToPersonnel(personnelId);
  }, []);

  const subscribeToDevices = useCallback((deviceId = null) => {
    return websocketService.subscribeToDevices(deviceId);
  }, []);

  const subscribeToPOBStatus = useCallback(() => {
    return websocketService.subscribeToPOBStatus();
  }, []);

  const subscribeToEmergencyEvents = useCallback(() => {
    return websocketService.subscribeToEmergencyEvents();
  }, []);

  const joinRoom = useCallback((room) => {
    return websocketService.joinRoom(room);
  }, []);

  const leaveRoom = useCallback((room) => {
    return websocketService.leaveRoom(room);
  }, []);

  const disconnect = useCallback(() => {
    websocketService.disconnect();
  }, []);

  return {
    connectionStatus,
    lastMessage,
    error,
    sendMessage,
    subscribe,
    subscribeToPersonnel,
    subscribeToDevices,
    subscribeToPOBStatus,
    subscribeToEmergencyEvents,
    joinRoom,
    leaveRoom,
    disconnect,
    isConnected: connectionStatus === 'connected',
    isConnecting: connectionStatus === 'connecting',
    hasError: connectionStatus === 'error',
    websocketService
  };
};

export default useWebSocket;
