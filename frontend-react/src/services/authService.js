/**
 * Authentication Service
 * Handles authentication state, token management, and user session
 */

import axios from 'axios';
import { message } from 'antd';

class AuthService {
  constructor() {
    this.token = localStorage.getItem('access_token');
    this.user = this.getUserFromStorage();
    this.refreshTokenPromise = null;
    
    // Configure axios defaults
    this.setupAxiosInterceptors();
  }

  /**
   * Setup axios interceptors for automatic token handling
   */
  setupAxiosInterceptors() {
    // Request interceptor - add token to all requests
    axios.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle token expiration
    axios.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          this.logout();
          message.error('Session expired. Please login again.');
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get current token from storage
   */
  getToken() {
    return localStorage.getItem('access_token');
  }

  /**
   * Get user info from storage
   */
  getUserFromStorage() {
    try {
      const userStr = localStorage.getItem('user_info');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error parsing user info:', error);
      return null;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  /**
   * Check if user has specific role
   */
  hasRole(role) {
    if (!this.user) return false;
    if (this.user.is_superuser) return true;
    const userRoles = this.user.roles || [];
    return userRoles.includes(role);
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(roles) {
    if (!this.user) return false;
    if (this.user.is_superuser) return true;
    const userRoles = this.user.roles || [];
    return roles.some(role => userRoles.includes(role));
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission) {
    if (!this.user) return false;
    if (this.user.is_superuser) return true;
    const userPermissions = this.user.permissions || [];
    return userPermissions.includes(permission);
  }

  /**
   * Login user
   */
  async login(credentials) {
    try {
      // Determine which login endpoint to use
      const isProduction = process.env.NODE_ENV === 'production';
      const endpoint = isProduction ? '/api/v1/auth/production-login' : '/api/v1/auth/simple-login';
      
      const response = await axios.post(endpoint, credentials);
      
      if (response.data.access_token) {
        this.setSession(response.data);
        return {
          success: true,
          user: response.data.user,
          token: response.data.access_token
        };
      } else {
        throw new Error('No access token received');
      }
      
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      // Call logout endpoint if available
      if (this.token) {
        await axios.post('/api/v1/auth/logout');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearSession();
    }
  }

  /**
   * Set user session
   */
  setSession(authData) {
    this.token = authData.access_token;
    this.user = authData.user;
    
    // Store in localStorage
    localStorage.setItem('access_token', authData.access_token);
    localStorage.setItem('user_info', JSON.stringify(authData.user));
    
    // Store token expiry if available
    if (authData.expires_in) {
      const expiryTime = new Date().getTime() + (authData.expires_in * 1000);
      localStorage.setItem('token_expiry', expiryTime);
    }
  }

  /**
   * Clear user session
   */
  clearSession() {
    this.token = null;
    this.user = null;
    
    // Clear localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    localStorage.removeItem('token_expiry');
    localStorage.removeItem('remember_username');
  }

  /**
   * Check if token is expired
   */
  isTokenExpired() {
    const expiryTime = localStorage.getItem('token_expiry');
    if (!expiryTime) return false;
    
    return new Date().getTime() > parseInt(expiryTime);
  }

  /**
   * Refresh token if needed
   */
  async refreshTokenIfNeeded() {
    if (!this.token || !this.isTokenExpired()) {
      return this.token;
    }

    // Prevent multiple refresh attempts
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }

    this.refreshTokenPromise = this.refreshToken();
    
    try {
      const response = await this.refreshTokenPromise;
      this.setSession(response.data);
      return response.data.access_token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearSession();
      throw error;
    } finally {
      this.refreshTokenPromise = null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData) {
    try {
      const response = await axios.put('/api/v1/auth/profile', profileData);
      
      if (response.data) {
        // Update stored user info
        this.user = { ...this.user, ...response.data };
        localStorage.setItem('user_info', JSON.stringify(this.user));
        
        message.success('Profile updated successfully');
        return { success: true, user: this.user };
      }
    } catch (error) {
      console.error('Profile update error:', error);
      message.error('Failed to update profile');
      return { success: false, error: this.getErrorMessage(error) };
    }
  }

  /**
   * Change password
   */
  async changePassword(passwordData) {
    try {
      const response = await axios.post('/api/v1/auth/change-password', passwordData);
      
      message.success('Password changed successfully');
      return { success: true };
    } catch (error) {
      console.error('Password change error:', error);
      const errorMsg = this.getErrorMessage(error);
      message.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    try {
      const response = await axios.post('/api/v1/auth/forgot-password', { email });
      
      message.success('Password reset link sent to your email');
      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error);
      const errorMsg = this.getErrorMessage(error);
      message.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Validate current session
   */
  async validateSession() {
    if (!this.token) return false;
    
    try {
      const response = await axios.get('/api/v1/auth/me');
      
      if (response.data) {
        this.user = response.data;
        localStorage.setItem('user_info', JSON.stringify(this.user));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Session validation error:', error);
      this.clearSession();
      return false;
    }
  }

  /**
   * Get user permissions from the login/me response
   */
  getUserPermissions() {
    if (!this.user) return [];
    if (this.user.is_superuser) return ['*'];
    return this.user.permissions || [];
  }

  /**
   * Check if user can access specific module
   */
  canAccessModule(module) {
    if (!this.user) return false;
    if (this.user.is_superuser) return true;

    const modulePermissions = {
      dashboard:      [],
      personnel:      ['personnel.view'],
      attendance:     ['attendance.view'],
      reports:        ['reports.view'],
      mustering:      ['mustering.view'],
      emergency:      ['emergency.view'],
      devices:        ['devices.view'],
      access_control: ['access_control.view'],
      visitors:       ['visitors.view'],
      pob:            ['pob.view'],
      settings:       ['settings.view'],
    };

    const required = modulePermissions[module] || [];
    if (required.length === 0) return true;

    const userPerms = this.getUserPermissions();
    return required.some(perm => userPerms.includes(perm));
  }

  /**
   * Extract meaningful error message
   */
  getErrorMessage(error) {
    if (error.response) {
      const status = error.response.status;
      const detail = error.response.data?.detail;

      switch (status) {
        case 400:
          return detail || 'Invalid request data';
        case 401:
          if (detail?.includes('inactive')) {
            return 'Your account is inactive';
          }
          return 'Invalid username or password';
        case 403:
          return 'Access denied';
        case 404:
          return 'Resource not found';
        case 429:
          return 'Too many requests. Please try again later';
        case 500:
          return 'Server error. Please try again later';
        default:
          return detail || 'An error occurred';
      }
    }

    if (error.message) {
      return error.message;
    }

    return 'Network error. Please check your connection';
  }

  /**
   * Get login statistics
   */
  getLoginStats() {
    const loginCount = parseInt(localStorage.getItem('login_count') || '0');
    const lastLogin = localStorage.getItem('last_login');
    const failedAttempts = parseInt(localStorage.getItem('failed_attempts') || '0');

    return {
      loginCount,
      lastLogin: lastLogin ? new Date(lastLogin) : null,
      failedAttempts,
      isBlocked: failedAttempts >= 5
    };
  }

  /**
   * Update login statistics
   */
  updateLoginStats(success) {
    if (success) {
      const loginCount = parseInt(localStorage.getItem('login_count') || '0') + 1;
      localStorage.setItem('login_count', loginCount);
      localStorage.setItem('last_login', new Date().toISOString());
      localStorage.setItem('failed_attempts', '0');
    } else {
      const failedAttempts = parseInt(localStorage.getItem('failed_attempts') || '0') + 1;
      localStorage.setItem('failed_attempts', failedAttempts);
    }
  }
}

// Create singleton instance
const authService = new AuthService();

export default authService;
