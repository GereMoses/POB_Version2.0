/**
 * Notification Service
 * Manages global notifications, real-time updates, and notification preferences
 */

import axios from 'axios';
import { message } from 'antd';

class NotificationService {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.listeners = [];
    this.websocket = null;
    this.preferences = this.loadPreferences();
    this.soundEnabled = this.preferences.soundEnabled !== false;
    this.desktopEnabled = this.preferences.desktopEnabled !== false;
    
    // Initialize WebSocket connection
    this.initializeWebSocket();
  }

  /**
   * Load notification preferences from localStorage
   */
  loadPreferences() {
    try {
      const stored = localStorage.getItem('notification_preferences');
      return stored ? JSON.parse(stored) : {
        soundEnabled: true,
        desktopEnabled: true,
        emailEnabled: true,
        pushEnabled: true,
        categories: {
          system: true,
          reports: true,
          personnel: true,
          security: true,
          emergency: true
        }
      };
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Get default notification preferences
   */
  getDefaultPreferences() {
    return {
      soundEnabled: true,
      desktopEnabled: true,
      emailEnabled: true,
      pushEnabled: true,
      categories: {
        system: true,
        reports: true,
        personnel: true,
        security: true,
        emergency: true
      }
    };
  }

  /**
   * Save notification preferences to localStorage
   */
  savePreferences(preferences) {
    try {
      localStorage.setItem('notification_preferences', JSON.stringify(preferences));
      this.preferences = preferences;
      this.soundEnabled = preferences.soundEnabled;
      this.desktopEnabled = preferences.desktopEnabled;
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  }

  /**
   * Initialize WebSocket connection for real-time notifications
   */
  initializeWebSocket() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/notifications`;
      
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('Notification WebSocket connected');
        this.notifyListeners('websocket_connected');
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data);
          this.handleRealtimeNotification(notification);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.websocket.onclose = () => {
        console.log('Notification WebSocket disconnected');
        this.notifyListeners('websocket_disconnected');
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.initializeWebSocket(), 5000);
      };
      
      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.notifyListeners('websocket_error', error);
      };
      
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  /**
   * Handle real-time notification from WebSocket
   */
  handleRealtimeNotification(notification) {
    // Check if notification category is enabled
    if (!this.preferences.categories[notification.category]) {
      return;
    }

    // Add to notifications list
    this.notifications.unshift({
      ...notification,
      id: notification.id || Date.now().toString(),
      timestamp: notification.timestamp || new Date().toISOString(),
      read: false
    });

    // Update unread count
    this.unreadCount++;
    
    // Show notification
    this.showNotification(notification);
    
    // Play sound if enabled
    if (this.soundEnabled) {
      this.playNotificationSound();
    }

    // Show desktop notification if enabled
    if (this.desktopEnabled) {
      this.showDesktopNotification(notification);
    }

    // Notify listeners
    this.notifyListeners('new_notification', notification);
  }

  /**
   * Show browser notification
   */
  showNotification(notification) {
    const { type, title, message, duration = 4.5 } = notification;
    
    // Determine notification type and styling
    const notificationConfig = {
      success: {
        message: 'success',
        icon: '✅',
        className: 'notification-success'
      },
      error: {
        message: 'error',
        icon: '❌',
        className: 'notification-error'
      },
      warning: {
        message: 'warning',
        icon: '⚠️',
        className: 'notification-warning'
      },
      info: {
        message: 'info',
        icon: 'ℹ️',
        className: 'notification-info'
      }
    };

    const config = notificationConfig[type] || notificationConfig.info;

    // Show Ant Design message
    message({
      content: title,
      description: message,
      duration: duration * 1000,
      type: config.message,
      icon: React.createElement('span', { style: { fontSize: '16px' } }, config.icon),
      className: config.className,
      style: {
        marginTop: 80,
        marginRight: 24
      }
    });
  }

  /**
   * Play notification sound
   */
  playNotificationSound() {
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(error => {
        console.log('Failed to play notification sound:', error);
      });
    } catch (error) {
      console.log('Notification sound not available:', error);
    }
  }

  /**
   * Show desktop notification
   */
  showDesktopNotification(notification) {
    if (!('Notification' in window)) {
      return;
    }

    // Request permission if not granted
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          this.createDesktopNotification(notification);
        }
      });
    } else if (Notification.permission === 'granted') {
      this.createDesktopNotification(notification);
    }
  }

  /**
   * Create desktop notification
   */
  createDesktopNotification(notification) {
    const { title, message, icon, tag } = notification;
    
    const notification = new Notification(title, {
      body: message,
      icon: icon || '/favicon.ico',
      tag: tag || 'pob-notification',
      requireInteraction: false,
      silent: false
    });

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);

    // Handle click
    notification.onclick = () => {
      window.focus();
      this.handleNotificationClick(notification);
    };
  }

  /**
   * Handle notification click
   */
  handleNotificationClick(notification) {
    // Mark as read
    this.markAsRead(notification.id);
    
    // Navigate to relevant page
    if (notification.action_url) {
      window.location.href = notification.action_url;
    } else if (notification.module) {
      const moduleRoutes = {
        reports: '/reports',
        personnel: '/personnel',
        attendance: '/attendance',
        mustering: '/mustering',
        emergency: '/emergency',
        payroll: '/payroll',
        visitor: '/visitor',
        mtd: '/mtd',
        system: '/settings'
      };
      
      const route = moduleRoutes[notification.module];
      if (route) {
        window.location.href = route;
      }
    }

    // Notify listeners
    this.notifyListeners('notification_clicked', notification);
  }

  /**
   * Fetch notifications from server
   */
  async fetchNotifications(options = {}) {
    try {
      const { 
        limit = 50, 
        offset = 0, 
        unread_only = false,
        category = null 
      } = options;

      let url = '/api/v1/notifications';
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });

      if (unread_only) {
        params.append('unread_only', 'true');
      }

      if (category) {
        params.append('category', category);
      }

      const response = await axios.get(`${url}?${params}`);
      
      if (response.data) {
        this.notifications = response.data.notifications || [];
        this.unreadCount = response.data.unread_count || 0;
        this.notifyListeners('notifications_loaded', response.data);
      }

      return response.data;
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId) {
    try {
      await axios.put(`/api/v1/notifications/${notificationId}/read`);
      
      // Update local state
      const notificationIndex = this.notifications.findIndex(n => n.id === notificationId);
      if (notificationIndex !== -1) {
        this.notifications[notificationIndex].read = true;
        this.unreadCount = Math.max(0, this.unreadCount - 1);
      }

      this.notifyListeners('notification_read', { notificationId });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    try {
      await axios.put('/api/v1/notifications/mark-all-read');
      
      // Update local state
      this.notifications.forEach(notification => {
        notification.read = true;
      });
      this.unreadCount = 0;

      this.notifyListeners('all_notifications_read');
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId) {
    try {
      await axios.delete(`/api/v1/notifications/${notificationId}`);
      
      // Update local state
      const notificationIndex = this.notifications.findIndex(n => n.id === notificationId);
      if (notificationIndex !== -1) {
        const notification = this.notifications[notificationIndex];
        if (!notification.read) {
          this.unreadCount = Math.max(0, this.unreadCount - 1);
        }
        this.notifications.splice(notificationIndex, 1);
      }

      this.notifyListeners('notification_deleted', { notificationId });
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }

  /**
   * Archive notification
   */
  async archiveNotification(notificationId) {
    try {
      await axios.put(`/api/v1/notifications/${notificationId}/archive`);
      
      // Update local state
      const notificationIndex = this.notifications.findIndex(n => n.id === notificationId);
      if (notificationIndex !== -1) {
        this.notifications[notificationIndex].archived = true;
        if (!this.notifications[notificationIndex].read) {
          this.unreadCount = Math.max(0, this.unreadCount - 1);
        }
      }

      this.notifyListeners('notification_archived', { notificationId });
    } catch (error) {
      console.error('Failed to archive notification:', error);
    }
  }

  /**
   * Create custom notification
   */
  createNotification(notification) {
    const notificationWithDefaults = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      read: false,
      type: 'info',
      category: 'system',
      ...notification
    };

    this.notifications.unshift(notificationWithDefaults);
    this.unreadCount++;
    this.showNotification(notificationWithDefaults);
    this.notifyListeners('custom_notification', notificationWithDefaults);

    return notificationWithDefaults;
  }

  /**
   * Get notification statistics
   */
  getStatistics() {
    const stats = {
      total: this.notifications.length,
      unread: this.unreadCount,
      read: this.notifications.filter(n => n.read).length,
      archived: this.notifications.filter(n => n.archived).length,
      by_type: {},
      by_category: {}
    };

    // Count by type
    this.notifications.forEach(notification => {
      stats.by_type[notification.type] = (stats.by_type[notification.type] || 0) + 1;
      stats.by_category[notification.category] = (stats.by_category[notification.category] || 0) + 1;
    });

    return stats;
  }

  /**
   * Update notification preferences
   */
  updatePreferences(newPreferences) {
    const updatedPreferences = { ...this.preferences, ...newPreferences };
    this.savePreferences(updatedPreferences);
    this.notifyListeners('preferences_updated', updatedPreferences);
  }

  /**
   * Add event listener
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove event listener
   */
  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }

  /**
   * Get unread notifications by category
   */
  getUnreadByCategory(category) {
    return this.notifications.filter(n => 
      !n.read && 
      n.category === category
    );
  }

  /**
   * Get recent notifications (last 24 hours)
   */
  getRecentNotifications(hours = 24) {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.notifications.filter(n => 
      new Date(n.timestamp) > cutoffTime
    );
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    this.notifications = [];
    this.unreadCount = 0;
    this.notifyListeners('notifications_cleared');
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;
