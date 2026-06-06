import apiService from './api';

const meetingApi = {
  // Room Management
  getRooms:            (p = {}) => apiService.get('/api/meeting/rooms/', p),
  getRoomById:         (id)     => apiService.get(`/api/meeting/rooms/${id}`),
  createRoom:          (d)      => apiService.post('/api/meeting/rooms/', d),
  updateRoom:          (id, d)  => apiService.put(`/api/meeting/rooms/${id}`, d),
  deleteRoom:          (id)     => apiService.delete(`/api/meeting/rooms/${id}`),
  getRoomCalendar:     (id, s, e) => apiService.get(`/api/meeting/rooms/${id}/calendar/`, { start: s, end: e }),
  checkRoomAvailability: (s, e, cap = 0) => apiService.get('/api/meeting/rooms/availability/', { start_time: s, end_time: e, capacity: cap }),

  // Booking Management
  getBookings:         (p = {}) => apiService.get('/api/meeting/bookings/', p),
  getBookingById:      (id)     => apiService.get(`/api/meeting/bookings/${id}`),
  createBooking:       (d)      => apiService.post('/api/meeting/bookings/', d),
  updateBooking:       (id, d)  => apiService.put(`/api/meeting/bookings/${id}`, d),
  cancelBooking:       (id, d)  => apiService.post(`/api/meeting/bookings/${id}/cancel/`, d),
  approveBooking:      (id, d)  => apiService.post(`/api/meeting/bookings/${id}/approve/`, d),
  completeBooking:     (id)     => apiService.post(`/api/meeting/bookings/${id}/complete/`, {}),
  getBookingQR:        (id)     => apiService.get(`/api/meeting/bookings/${id}/qr/`),

  // Attendees
  getBookingAttendees: (id)     => apiService.get(`/api/meeting/bookings/${id}/attendees/`),
  addAttendees:        (id, d)  => apiService.post(`/api/meeting/bookings/${id}/attendees/`, d),
  removeAttendee:      (bid, aid) => apiService.delete(`/api/meeting/bookings/${bid}/attendees/${aid}`),
  inviteAttendees:     (id, d)  => apiService.post(`/api/meeting/bookings/${id}/invite/`, d),

  // Check-in
  checkInAttendee:     (d)      => apiService.post('/api/meeting/check-in/', d),
  checkOutAttendee:    (d)      => apiService.post('/api/meeting/check-out/', d),

  // Minutes
  getBookingMinutes:   (id)     => apiService.get(`/api/meeting/bookings/${id}/minutes/`),
  uploadMinutes:       (id, file) => apiService.upload(`/api/meeting/bookings/${id}/minutes/`, file),

  // Action Items
  getBookingActions:   (id)     => apiService.get(`/api/meeting/bookings/${id}/actions/`),
  addActionItem:       (id, d)  => apiService.post(`/api/meeting/bookings/${id}/actions/`, d),
  updateActionItem:    (id, d)  => apiService.put(`/api/meeting/actions/${id}`, d),

  // Equipment
  getEquipment:        (p = {}) => apiService.get('/api/meeting/equipment/', p),
  createEquipment:     (d)      => apiService.post('/api/meeting/equipment/', d),
  updateEquipment:     (id, d)  => apiService.put(`/api/meeting/equipment/${id}`, d),
  deleteEquipment:     (id)     => apiService.delete(`/api/meeting/equipment/${id}`),

  // Reports
  getUtilizationReport:     (p) => apiService.get('/api/meeting/reports/utilization/', p),
  getAttendanceReport:      (id) => apiService.get(`/api/meeting/reports/attendance/${id}`),
  getNoShowReport:          (p) => apiService.get('/api/meeting/reports/no-show/', p),
  getMusteringOverlapReport:(id) => apiService.get('/api/meeting/reports/mustering-overlap/', { event_id: id }),

  // Dashboard
  getDashboardStats:   ()       => apiService.get('/api/meeting/dashboard/'),
};

export { meetingApi };
export default meetingApi;
