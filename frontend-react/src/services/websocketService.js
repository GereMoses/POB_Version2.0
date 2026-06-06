/**
 * WebSocket Service for Real-time Updates
 * Uses native WebSocket API (no socket.io dependency).
 */

import { message } from 'antd';
import { useState, useEffect, useCallback } from 'react';

const _wsBase = () => `ws://${window.location.hostname}:8000`;
const _token = () =>
  localStorage.getItem('token') || sessionStorage.getItem('token') || '';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.connectionPromise = null;
    this._url = null;
    this._options = {};
    this._reconnectTimer = null;
  }

  connect(url = _wsBase(), options = {}) {
    if (this.connectionPromise) return this.connectionPromise;

    this._url = url;
    this._options = options;

    this.connectionPromise = new Promise((resolve, reject) => {
      this._open(resolve, reject);
    });

    return this.connectionPromise;
  }

  _open(resolve, reject) {
    const urlWithToken = this._url.includes('?')
      ? `${this._url}&token=${_token()}`
      : `${this._url}?token=${_token()}`;

    try {
      this.socket = new WebSocket(urlWithToken);
    } catch (err) {
      reject(err);
      return;
    }

    this.socket.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      message.success('Real-time connection established');
      if (resolve) { resolve(this.socket); resolve = null; }
      this.emit('connection_status', 'connected');
    };

    this.socket.onclose = (ev) => {
      this.isConnected = false;
      this.emit('connection_status', 'disconnected');
      if (ev.wasClean) {
        message.warning('Real-time connection closed');
      } else {
        message.error('Real-time connection lost, reconnecting…');
        this._scheduleReconnect(resolve, reject);
      }
    };

    this.socket.onerror = () => {
      this.isConnected = false;
      this.emit('connection_status', 'error');
    };

    this.socket.onmessage = (ev) => {
      this._handleMessage(ev.data);
    };
  }

  _scheduleReconnect(resolve, reject) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      message.error('Failed to establish real-time connection');
      if (reject) { reject(new Error('Max reconnect attempts reached')); reject = null; }
      return;
    }
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
    this._reconnectTimer = setTimeout(() => this._open(resolve, reject), delay);
  }

  _handleMessage(raw) {
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (data.type) this.emit(data.type, data.data ?? data);
      this.emit('message', data);
    } catch (err) {
      console.error('WebSocket message parse error:', err);
    }
  }

  disconnect() {
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    if (this.socket) {
      this.socket.onclose = null; // prevent reconnect on intentional close
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.connectionPromise = null;
    message.info('Real-time connection closed');
  }

  send(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.send(JSON.stringify({ type: event, data }));
      return true;
    }
    console.warn('WebSocket not connected, message not sent:', event);
    return false;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
    return () => {
      const cbs = this.listeners.get(event);
      if (!cbs) return;
      const i = cbs.indexOf(callback);
      if (i > -1) cbs.splice(i, 1);
      if (cbs.length === 0) this.listeners.delete(event);
    };
  }

  emit(event, data) {
    (this.listeners.get(event) || []).forEach(cb => {
      try { cb(data); } catch (err) { console.error('WebSocket listener error:', err); }
    });
  }

  getConnectionStatus() {
    return { isConnected: this.isConnected, reconnectAttempts: this.reconnectAttempts };
  }

  joinRoom(room) { return this.send('join_room', { room }); }
  leaveRoom(room) { return this.send('leave_room', { room }); }
  subscribeToPersonnel(id = null) { return this.send(id ? 'subscribe_personnel' : 'subscribe_all_personnel', id ? { personnel_id: id } : {}); }
  subscribeToDevices(id = null) { return this.send(id ? 'subscribe_device' : 'subscribe_all_devices', id ? { device_id: id } : {}); }
  subscribeToPOBStatus() { return this.send('subscribe_pob_status', {}); }
  subscribeToEmergencyEvents() { return this.send('subscribe_emergency_events', {}); }
}

export const websocketService = new WebSocketService();

export const useWebSocket = (url, options = {}) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        setConnectionStatus('connecting');
        await websocketService.connect(url || _wsBase(), options);
        setConnectionStatus('connected');
        setError(null);
      } catch (err) {
        setConnectionStatus('error');
        setError(err);
      }
    };
    connectWebSocket();
    const unsubStatus = websocketService.on('connection_status', setConnectionStatus);
    const unsubMsg = websocketService.on('message', setLastMessage);
    return () => {
      unsubStatus();
      unsubMsg();
      websocketService.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const sendMessage = useCallback((event, data) => websocketService.send(event, data), []);
  const subscribe = useCallback((event, cb) => websocketService.on(event, cb), []);

  return {
    connectionStatus,
    lastMessage,
    error,
    sendMessage,
    subscribe,
    isConnected: connectionStatus === 'connected',
    websocketService,
  };
};

export default websocketService;
