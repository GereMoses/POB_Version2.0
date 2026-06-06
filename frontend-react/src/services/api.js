// API Configuration — relative URLs go through CRA proxy (dev) or nginx (prod)
export const API_BASE_URL = '';

const API_CONFIG = {
  baseURL: '',  // Relative URLs — routed via CRA proxy (dev) or nginx (prod)
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// API Endpoints
const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',
  VERIFY: '/auth/verify',
  
  // Dashboard
  DASHBOARD: '/dashboard/analytics',
  
  // Personnel
  PERSONNEL: '/personnel',
  PERSONNEL_LIST: '/personnel/list',
  PERSONNEL_CREATE: '/personnel/create',
  PERSONNEL_UPDATE: '/personnel/update',
  PERSONNEL_DELETE: '/personnel/delete',
  
  // POB Status
  POB_STATUS: '/pob-status/dashboard',
  POB_STATS: '/pob-status/stats',
  
  // Meeting Management
  MEETING_ROOMS: '/api/meeting/rooms/',
  MEETING_BOOKINGS: '/api/meeting/bookings/',
  MEETING_EQUIPMENT: '/api/meeting/equipment/',
  
  // Emergency Management
  EMERGENCY: '/emergencies',
  EMERGENCY_ACTIVE: '/emergencies/active',
  EMERGENCY_PERSONNEL: '/emergencies/personnel',
  
  // Safety
  SAFETY_INCIDENTS: '/safety/incidents',
  SAFETY_PASSENGER: '/safety/passenger',
  
  // Reports
  REPORTS: '/reports',
  
  // Analytics
  ANALYTICS: '/analytics',
};

// API Service Class
class ApiService {
  constructor() {
    this.baseURL = API_CONFIG.baseURL;
    this.timeout = API_CONFIG.timeout;
  }

  // Get auth token — canonical key is 'token'; legacy aliases checked as fallback
  getAuthToken() {
    return localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('access_token');
  }

  // Set auth token
  setAuthToken(token) {
    localStorage.setItem('token', token);
    localStorage.removeItem('authToken');
    localStorage.removeItem('access_token');
  }

  // Remove auth token — clears all alias keys
  removeAuthToken() {
    ['token', 'authToken', 'access_token', 'user_info'].forEach(k => localStorage.removeItem(k));
  }

  // Get headers
  getHeaders() {
    const token = this.getAuthToken();
    return {
      ...API_CONFIG.headers,
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  // Handle response
  async handleResponse(response) {
    if (!response.ok) {
      if (response.status === 401) {
        this.removeAuthToken();
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
      if (response.status === 402) {
        const body = await response.json().catch(() => ({}));
        window.dispatchEvent(new CustomEvent('license:expired', { detail: body }));
        const err = new Error(body.message || 'Subscription expired');
        err.status = 402;
        throw err;
      }
      const error = await response.json().catch(() => ({}));
      // FastAPI default detail (string or array) OR custom error handler (message + details)
      let message = error.message || (typeof error.detail === 'string' ? error.detail : null) || `HTTP ${response.status}`;
      if (error.details?.validation_errors?.length) {
        const fields = error.details.validation_errors.map(e => `${e.field}: ${e.message}`).join('; ');
        message = `${message} — ${fields}`;
      } else if (Array.isArray(error.detail)) {
        const fields = error.detail.map(e => `${e.loc?.slice(-1)[0] ?? 'field'}: ${e.msg}`).join('; ');
        message = `Validation error — ${fields}`;
      }
      const err = new Error(message);
      err.status = response.status;
      throw err;
    }
    if (response.status === 204 || response.headers.get('content-length') === '0') return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      return await this.handleResponse(response);
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  // GET request
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  // POST request
  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT request
  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // DELETE request (data optional — sent as JSON body when provided)
  async delete(endpoint, data) {
    const opts = { method: 'DELETE' };
    if (data !== undefined) opts.body = JSON.stringify(data);
    return this.request(endpoint, opts);
  }

  // PATCH request
  async patch(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // File upload
  async upload(endpoint, file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.getAuthToken();
    const headers = {
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.baseURL}${endpoint}`);
      
      Object.keys(headers).forEach(key => {
        xhr.setRequestHeader(key, headers[key]);
      });

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.send(formData);
    });
  }
}

// Create API service instance
const apiService = new ApiService();

// Meeting API specific methods
const meetingApi = {
  // Rooms
  getRooms: () => apiService.get('/api/meeting/rooms/'),
  createRoom: (data) => apiService.post('/api/meeting/rooms/', data),
  updateRoom: (id, data) => apiService.put(`/api/meeting/rooms/${id}`, data),
  deleteRoom: (id) => apiService.delete(`/api/meeting/rooms/${id}`),
  getRoomCalendar: (roomId, params = {}) => apiService.get(`/api/meeting/rooms/${roomId}/calendar/`, params),

  // Bookings
  getBookings: (params = {}) => {
    const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null));
    return apiService.get('/api/meeting/bookings/', filtered);
  },
  createBooking: (data) => apiService.post('/api/meeting/bookings/', data),
  updateBooking: (id, data) => apiService.put(`/api/meeting/bookings/${id}`, data),
  cancelBooking: (id, data) => apiService.post(`/api/meeting/bookings/${id}/cancel/`, data),
  approveBooking: (id, data) => apiService.post(`/api/meeting/bookings/${id}/approve/`, data),
  getBookingQR: (id) => apiService.get(`/api/meeting/bookings/${id}/qr/`),

  // Attendees
  getBookingAttendees: (bookingId) => apiService.get(`/api/meeting/bookings/${bookingId}/attendees/`),
  checkInAttendee: (data) => apiService.post('/api/meeting/check-in/', data),

  // Minutes
  getBookingMinutes: (bookingId) => apiService.get(`/api/meeting/bookings/${bookingId}/minutes/`),
  uploadMinutes: (bookingId, data) => apiService.post(`/api/meeting/bookings/${bookingId}/minutes/`, data),

  // Action items
  getBookingActions: (bookingId) => apiService.get(`/api/meeting/bookings/${bookingId}/actions/`),
  addActionItem: (bookingId, data) => apiService.post(`/api/meeting/bookings/${bookingId}/actions/`, data),
  updateActionItem: (id, data) => apiService.put(`/api/meeting/actions/${id}`, data),

  // Equipment
  getEquipment: () => apiService.get('/api/meeting/equipment/'),
  createEquipment: (data) => apiService.post('/api/meeting/equipment/', data),
  updateEquipment: (id, data) => apiService.put(`/api/meeting/equipment/${id}`, data),
  deleteEquipment: (id) => apiService.delete(`/api/meeting/equipment/${id}`),

  // Reports
  getUtilizationReport: (params = {}) => apiService.get('/api/meeting/reports/utilization/', params),
  getNoShowReport: (params = {}) => apiService.get('/api/meeting/reports/no-show/', params),

  // Dashboard stats (aggregated from rooms endpoint)
  getDashboardStats: () => apiService.get('/api/meeting/rooms/'),
};

// Export both the class and instance
export { apiService, meetingApi, API_ENDPOINTS, API_CONFIG };
export const api = apiService;
export default apiService;
