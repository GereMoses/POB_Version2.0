import apiService from './api';

const visitorAPI = {
  // Dashboard
  getDashboardStats: ()                      => apiService.get('/api/visitor/dashboard/stats/'),

  // Visitor Types
  getVisitorTypes:   (p = {})               => apiService.get('/api/visitor/types/', p),
  createVisitorType: (d)                     => apiService.post('/api/visitor/types/', d),
  updateVisitorType: (id, d)                 => apiService.put(`/api/visitor/types/${id}`, d),
  deleteVisitorType: (id)                    => apiService.delete(`/api/visitor/types/${id}`),

  // Visitor Profiles
  getVisitors:       (p = {})               => apiService.get('/api/visitor/visitors/', p),
  createVisitor:     (d)                     => apiService.post('/api/visitor/visitors/', d),
  getVisitor:        (id)                    => apiService.get(`/api/visitor/visitors/${id}`),
  updateVisitor:     (id, d)                 => apiService.put(`/api/visitor/visitors/${id}`, d),
  blacklistVisitor:  (id, reason)            => apiService.post(`/api/visitor/visitors/${id}/blacklist`, { reason }),
  lookupVisitor:     (p = {})               => apiService.get('/api/visitor/visitors/lookup/', p),

  // Pre-Registration
  getPreRegistrations: (p = {})             => apiService.get('/api/visitor/pre-register/', p),
  createPreRegistration: (d)                => apiService.post('/api/visitor/pre-register/', d),
  getPreRegistration:  (id)                 => apiService.get(`/api/visitor/pre-register/${id}`),
  getQRData:           (qrCode)             => apiService.get(`/api/visitor/qr/${qrCode}`),
  approvePreRegistration: (id, d)           => apiService.post(`/api/visitor/pre-register/${id}/approve`, d),
  resendPreRegistration:  (id)              => apiService.post(`/api/visitor/pre-register/${id}/resend`),

  // Check-In / Check-Out
  checkInVisitor:    (d, deviceSn)          => apiService.post(`/api/visitor/check-in/${deviceSn ? `?device_sn=${deviceSn}` : ''}`, d),
  checkOutVisitor:   (d, deviceSn)          => apiService.post(`/api/visitor/check-out/${deviceSn ? `?device_sn=${deviceSn}` : ''}`, d),
  forceCheckOut:     (logId)               => apiService.post(`/api/visitor/check-out/${logId}/force/`),

  // Records
  getVisitorRecords: (p = {})              => apiService.get('/api/visitor/records/', p),
  getOnSiteVisitors: ()                     => apiService.get('/api/visitor/records/on-site/'),
  exportVisitorRecords: (p = {}) => apiService.downloadFile('/api/visitor/records/export/', p),

  // Blacklist
  getBlacklist:         (p = {})           => apiService.get('/api/visitor/blacklist/', p),
  addToBlacklist:       (d)                => apiService.post('/api/visitor/blacklist/', d),
  updateBlacklist:      (id, d)            => apiService.put(`/api/visitor/blacklist/${id}`, d),
  removeFromBlacklist:  (id)               => apiService.delete(`/api/visitor/blacklist/${id}`),

  // Reports
  getDailyReport:            (date)        => apiService.get('/api/visitor/reports/daily/', { report_date: date }),
  getOverstayReport:         (hours = 8)   => apiService.get('/api/visitor/reports/overstay/', { hours }),
  getMusteringComplianceReport: (eventId)  => apiService.get('/api/visitor/reports/mustering-compliance/', { event_id: eventId }),
  getAnalytics:              (days = 30)   => apiService.get('/api/visitor/reports/analytics/', { days }),
  getVisitorFrequency:       (limit = 50)  => apiService.get('/api/visitor/reports/frequency/', { limit }),
};

export { visitorAPI };
export default visitorAPI;
