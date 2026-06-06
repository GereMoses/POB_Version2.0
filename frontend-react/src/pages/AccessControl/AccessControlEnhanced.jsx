/**
 * Access Control Enhanced - BioTime 9.5 Compatible + POB Extensions
 * Enhanced UI with animations, better UX, and advanced features
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, Clock, Users, DoorOpen, AlertTriangle, Settings, 
  Activity, TrendingUp, Eye, Zap, BarChart3, 
  CheckCircle, XCircle, RefreshCw, Download
} from 'lucide-react';
import { message as toast } from 'antd'; toast.success = (msg) => message.success(msg); toast.error = (msg) => message.error(msg);

import AccessControlDashboard from './AccessControlDashboard';
import EnhancedRealTimeEvents from './EnhancedRealTimeEvents';
import TimeZoneManagement from './TimeZoneManagement';
import AccessLevelManagement from './AccessLevelManagement';
import DoorSettings from './DoorSettings';
import RealTimeEvents from './RealTimeEvents';
import AntiPassbackSettings from './AntiPassbackSettings';
import FirstCardSettings from './FirstCardSettings';
import InterlockManagement from './InterlockManagement';
import LinkageManagement from './LinkageManagement';
import EmergencyLockdown from './EmergencyLockdown';
import AccessReports from './AccessReports';

const AccessControlEnhanced = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [theme, setTheme] = useState('light');
  const [notifications, setNotifications] = useState([]);

  const tabs = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: BarChart3,
      component: AccessControlDashboard
    },
    {
      id: 'timezone',
      name: 'Time Zone',
      icon: Clock,
      component: TimeZoneManagement
    },
    {
      id: 'levels',
      name: 'Access Levels',
      icon: Shield,
      component: AccessLevelManagement
    },
    {
      id: 'doors',
      name: 'Door Settings',
      icon: DoorOpen,
      component: DoorSettings
    },
    {
      id: 'events',
      name: 'Real-time Events',
      icon: Activity,
      component: RealTimeEvents
    },
    {
      id: 'events-enhanced',
      name: 'Enhanced Events',
      icon: Zap,
      component: EnhancedRealTimeEvents
    },
    {
      id: 'interlock',
      name: 'Interlock',
      icon: Link,
      component: InterlockManagement
    },
    {
      id: 'antipassback',
      name: 'Anti-passback',
      icon: XCircle,
      component: AntiPassbackSettings
    },
    {
      id: 'firstcard',
      name: 'First-Card Open',
      icon: Eye,
      component: FirstCardSettings
    },
    {
      id: 'linkage',
      name: 'Linkage',
      icon: Zap,
      component: LinkageManagement
    },
    {
      id: 'reports',
      name: 'Reports',
      icon: Download,
      component: AccessReports
    },
    {
      id: 'emergency',
      name: 'Emergency',
      icon: AlertTriangle,
      component: EmergencyLockdown
    }
  ];

  // Add notification
  const addNotification = (type, message, description) => {
    const notification = {
      id: Date.now(),
      type,
      message,
      description,
      read: false,
      timestamp: new Date().toISOString()
    };
    
    setNotifications(prev => [notification, ...prev]);
    toast.success(message);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  // Toggle animations
  const toggleAnimations = () => {
    setAnimationsEnabled(!animationsEnabled);
    toast.success(animationsEnabled ? 'Animations enabled' : 'Animations disabled');
  };

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    toast.success(`Switched to ${newTheme} theme`);
  };

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const renderTabContent = () => {
    const TabComponent = tabs.find(tab => tab.id === activeTab)?.component;
    
    if (TabComponent) {
      return <TabComponent key={activeTab} />;
    }
    
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Tab Not Found</h3>
          <p className="text-gray-600">The selected tab could not be loaded.</p>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${theme === 'dark' ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Shield className={`w-8 h-8 mr-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
              <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Enhanced Access Control
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Controls */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleSidebar}
                  className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                
                <button
                  onClick={() => setAnimationsEnabled(!animationsEnabled)}
                  className={`p-2 rounded-lg ${animationsEnabled ? 'bg-green-600 text-white' : theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
                >
                  {animationsEnabled ? '✓' : '○'}
                </button>
                
                <button
                  onClick={toggleTheme}
                  className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
                >
                  {theme === 'dark' ? '☀️' : '🌙'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-screen pt-16">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-lg transition-all duration-300 ease-in-out`}>
          <div className="h-full overflow-y-auto">
            {/* Navigation */}
            <nav className="p-4 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <div key={tab.id} className="mb-2">
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
                        isActive 
                          ? 'bg-blue-600 text-white shadow-lg' 
                          : theme === 'dark' 
                            ? 'text-gray-300 hover:bg-gray-700' 
                            : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-white' : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} />
                      <div className="text-left">
                        <span className="block text-sm font-medium">{tab.name}</span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden">
          <div className={`h-full overflow-auto ${animationsEnabled ? 'transition-all duration-300' : ''}`}>
            {renderTabContent()}
          </div>
        </main>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className="bg-white rounded-lg shadow-lg p-4 max-h-96 overflow-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
            <div className="space-y-3">
              {notifications.slice(0, 5).map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border-l-4 cursor-pointer transition-all duration-200 ${
                    notification.type === 'error' ? 'bg-red-50 border-red-200' : 
                    notification.type === 'warning' ? 'bg-yellow-50 border-yellow-200' : 
                    'bg-blue-50 border-blue-200'
                  } ${notification.read ? 'opacity-50' : 'opacity-100'}`}
                  onClick={() => {
                    setNotifications(prev => prev.map(n => 
                      n.id === notification.id ? { ...n, read: true } : n
                    ));
                  }}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-3">
                      {notification.type === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
                      {notification.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                      {notification.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {notification.message}
                      </p>
                      {notification.description && (
                        <p className="text-xs mt-1 text-gray-500">
                          {notification.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Clear Notifications */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => setNotifications([])}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
              >
                Clear All Notifications
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessControlEnhanced;
