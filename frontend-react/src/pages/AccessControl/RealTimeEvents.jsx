/**
 * Real-time Events - BioTime 9.5 Compatible + POB Extensions
 * WebSocket-based live access control event monitoring
 */

import React, { useState, useEffect, useRef } from 'react';
import { Activity, Filter, RefreshCw, AlertTriangle, CheckCircle, XCircle, Users, Lock, DoorOpen } from 'lucide-react';
import apiService from '../../services/api';

const RealTimeEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    start_time: '',
    end_time: '',
    door_id: '',
    emp_code: '',
    event_type: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const eventListRef = useRef(null);
  const wsRef = useRef(null);

  const eventTypes = [
    { value: 0, label: 'Normal Access', icon: CheckCircle, color: 'green' },
    { value: 1, label: 'Door Open', icon: DoorOpen, color: 'blue' },
    { value: 2, label: 'Door Alarm', icon: AlertTriangle, color: 'red' },
    { value: 3, label: 'Anti-passback', icon: XCircle, color: 'yellow' },
    { value: 4, label: 'Duress', icon: AlertTriangle, color: 'red' },
    { value: 5, label: 'Fire Unlock', icon: Lock, color: 'orange' },
    { value: 6, label: 'Emergency Lock', icon: Lock, color: 'red' },
    { value: 7, label: 'Mustering Check', icon: Users, color: 'purple' }
  ];

  useEffect(() => {
    fetchEvents();
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (autoScroll && eventListRef.current) {
      eventListRef.current.scrollTop = eventListRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/api/access-control/events/', {
        params: {
          limit: 100,
          ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
        }
      });
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
      const wsUrl = `ws://${window.location.hostname}:8000/ws/access-control/events/?token=${token}`;
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setConnectionStatus('connected');
        console.log('WebSocket connected');
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const newEvents = JSON.parse(event.data);
          if (Array.isArray(newEvents) && newEvents.length > 0) {
            setEvents(prev => [...newEvents, ...prev].slice(0, 200)); // Keep last 200 events
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      wsRef.current.onclose = () => {
        setConnectionStatus('disconnected');
        console.log('WebSocket disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };
      
      wsRef.current.onerror = (error) => {
        setConnectionStatus('error');
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      setConnectionStatus('error');
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => {
    fetchEvents();
  };

  const clearFilters = () => {
    setFilters({
      start_time: '',
      end_time: '',
      door_id: '',
      emp_code: '',
      event_type: ''
    });
    fetchEvents();
  };

  const getEventTypeInfo = (eventType) => {
    return eventTypes.find(type => type.value === eventType) || eventTypes[0];
  };

  const formatEventTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getEventRowClass = (eventType) => {
    const typeInfo = getEventTypeInfo(eventType);
    switch (typeInfo.color) {
      case 'green': return 'bg-green-50 hover:bg-green-100';
      case 'red': return 'bg-red-50 hover:bg-red-100';
      case 'yellow': return 'bg-yellow-50 hover:bg-yellow-100';
      case 'orange': return 'bg-orange-50 hover:bg-orange-100';
      case 'purple': return 'bg-purple-50 hover:bg-purple-100';
      default: return 'bg-gray-50 hover:bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Real-time Events</h3>
          <p className="text-sm text-gray-600">Live access control event monitoring</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'connecting' ? 'bg-yellow-500' :
              'bg-red-500'
            }`}></div>
            <span className="text-sm text-gray-600">
              {connectionStatus === 'connected' ? 'Connected' :
               connectionStatus === 'connecting' ? 'Connecting...' :
               'Disconnected'}
            </span>
          </div>
          
          {/* Auto Scroll Toggle */}
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-600">Auto Scroll</span>
          </label>
          
          {/* Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors duration-200 ${
              showFilters 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
          
          {/* Refresh */}
          <button
            onClick={fetchEvents}
            className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Event Filters</h4>
          <div className="grid grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={filters.start_time}
                onChange={(e) => handleFilterChange('start_time', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time
              </label>
              <input
                type="datetime-local"
                value={filters.end_time}
                onChange={(e) => handleFilterChange('end_time', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Door ID
              </label>
              <input
                type="text"
                value={filters.door_id}
                onChange={(e) => handleFilterChange('door_id', e.target.value)}
                placeholder="Door ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee Code
              </label>
              <input
                type="text"
                value={filters.emp_code}
                onChange={(e) => handleFilterChange('emp_code', e.target.value)}
                placeholder="Employee Code"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Type
              </label>
              <select
                value={filters.event_type}
                onChange={(e) => handleFilterChange('event_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                {eventTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Apply Filters
            </button>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Events List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Activity className="w-5 h-5 mr-2 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">
                Live Events ({events.length} total)
              </span>
            </div>
            <div className="flex space-x-4 text-xs text-gray-500">
              {eventTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <div key={type.value} className="flex items-center">
                    <Icon className="w-3 h-3 mr-1" />
                    <span>{type.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <div 
          ref={eventListRef}
          className="h-96 overflow-auto"
          onMouseEnter={() => setAutoScroll(false)}
          onMouseLeave={() => setAutoScroll(true)}
        >
          {events.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No events found</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {events.map((event, index) => {
                const typeInfo = getEventTypeInfo(event.event_type);
                const Icon = typeInfo.icon;
                
                return (
                  <div 
                    key={`${event.id}-${index}`} 
                    className={`px-6 py-4 transition-colors duration-200 ${getEventRowClass(event.event_type)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {/* Event Type Icon */}
                        <div className={`p-2 rounded-full bg-${typeInfo.color}-100`}>
                          <Icon className={`w-5 h-5 text-${typeInfo.color}-600`} />
                        </div>
                        
                        {/* Employee Photo */}
                        {event.emp_code && (
                          <div className="flex-shrink-0">
                            {event.employee_photo
                              ? <img src={event.employee_photo} alt=""
                                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e8e8e8' }} />
                              : <div style={{
                                  width: 36, height: 36, borderRadius: '50%',
                                  background: '#1890ff', display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14,
                                }}>
                                  {(event.emp_name || event.emp_code || '?')[0].toUpperCase()}
                                </div>}
                          </div>
                        )}

                        {/* Event Details */}
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">
                              {typeInfo.label}
                            </span>
                            <span className="text-gray-500">•</span>
                            <span className="text-sm text-gray-600">
                              {formatEventTime(event.event_time)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {event.emp_name && (
                              <span className="mr-3">
                                {event.emp_name} ({event.emp_code})
                              </span>
                            )}
                            {event.door_id && (
                              <span className="mr-3">
                                Door {event.door_id}
                              </span>
                            )}
                            <span className="text-gray-500">
                              {event.terminal_sn}
                            </span>
                          </div>
                          {event.description && (
                            <div className="text-sm text-gray-500 mt-1">
                              {event.description}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center space-x-2">
                        {event.event_type === 2 && ( // Door Alarm
                          <button
                            className="text-red-600 hover:text-red-900 text-sm"
                            title="Acknowledge Alarm"
                          >
                            Acknowledge
                          </button>
                        )}
                        {event.event_type === 0 && event.door_id && ( // Normal Access
                          <button
                            className="text-blue-600 hover:text-blue-900 text-sm"
                            title="Remote Open"
                          >
                            Open
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealTimeEvents;
