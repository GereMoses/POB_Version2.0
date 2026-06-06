/**
 * Device API Service — wraps all /api/device/* endpoints using apiService.
 * Covers: terminals, commands, firmware, enrollment, access control,
 *         schedules, maintenance, live transactions, extended commands.
 */

import apiService from './api';

const deviceAPI = {
  // ─── Terminals ────────────────────────────────────────────────────────────
  getTerminals:       (params = {}) => apiService.get('/api/device/terminals/', params),
  getTerminal:        (id)          => apiService.get(`/api/device/terminals/${id}`),
  createTerminal:     (data)        => apiService.post('/api/device/terminals/', data),
  updateTerminal:     (id, data)    => apiService.put(`/api/device/terminals/${id}`, data),
  deleteTerminal:     (id, force)   => apiService.delete(`/api/device/terminals/${id}?force=${!!force}`),
  batchImport:        (data)        => apiService.post('/api/device/terminals/batch-import/', data),

  // ─── Device Commands ──────────────────────────────────────────────────────
  getDeviceCommands:  (params = {}) => apiService.get('/api/device/devcmd/', params),
  sendCommand:        (data)        => apiService.post('/api/device/devcmd/', data),
  deleteCommand:      (id)          => apiService.delete(`/api/device/devcmd/${id}`),
  syncUserToDevice:   (sn, emp)     => apiService.post(`/api/device/devcmd/sync-user/?sn=${sn}&emp_code=${emp}`),
  syncAllUsersToDevice:    (sn)           => apiService.post(`/api/device/devcmd/sync-all-users/?sn=${sn}`),
  syncDepartmentToDevice:  (sn, dept)     => apiService.post(`/api/device/devcmd/sync-department/?sn=${encodeURIComponent(sn)}&department=${encodeURIComponent(dept)}`),
  emergencyCommand:   (sn, action)  => apiService.post(`/api/device/devcmd/emergency/?sn=${sn}&action=${action}`),
  extendedCommand:    (data)        => apiService.post('/api/device/devcmd/extended/', data),

  // ─── Real-time & Stats ────────────────────────────────────────────────────
  getRealTimeDevices: ()            => apiService.get('/api/device/real-time/'),
  getHealth:          ()            => apiService.get('/api/device/health'),
  getWebSocketStats:  ()            => apiService.get('/api/device/websocket/stats'),

  // ─── Live Transactions ────────────────────────────────────────────────────
  getLiveTransactions: (params = {}) => apiService.get('/api/device/transactions/live/', params),

  // ─── Firmware ─────────────────────────────────────────────────────────────
  pushFirmware:       (data)        => apiService.post('/api/device/firmware/push/', data),
  uploadFirmware:     (formData, deviceTypes) => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    return fetch(`/api/device/firmware/upload/?device_types=${deviceTypes}`, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    }).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(new Error(e.detail || 'Upload failed'))));
  },

  // ─── Biometric Enrollment ─────────────────────────────────────────────────
  getEnrollmentStatus:  (params = {}) => apiService.get('/api/device/enrollment/status/', params),
  getEnrollmentReport:  ()            => apiService.get('/api/device/enrollment/report/'),
  enableEnrollmentMode: (sn, emp)     => apiService.post(`/api/device/enrollment/enable/?sn=${sn}${emp ? `&emp_code=${emp}` : ''}`),
  pushTemplates:        (data)        => apiService.post('/api/device/enrollment/push/', data),
  pushTemplatesToArea:  (data)        => apiService.post('/api/device/enrollment/push-to-area/', data),
  deleteTemplate:       (emp, finger, pushToDevices = true) =>
    apiService.delete(`/api/device/enrollment/template/?emp_code=${emp}${finger != null ? `&finger_id=${finger}` : ''}&push_to_devices=${pushToDevices}`),
  pullTemplatesFromDevice: (sn) =>
    apiService.post(`/api/device/enrollment/pull-from-device/?sn=${encodeURIComponent(sn)}`),
  enrollDirect: (data) =>
    apiService.post('/api/device/enrollment/enroll-direct/', data),
  cancelEnrollment: (sn) =>
    apiService.post(`/api/device/enrollment/cancel/?sn=${encodeURIComponent(sn)}`),
  assignCard:       (data) => apiService.post('/api/device/enrollment/card/assign', data),
  syncCard:         (data) => apiService.post('/api/device/enrollment/card/sync', data),
  getCardStatus:    ()     => apiService.get('/api/device/enrollment/card/status'),

  // ─── Access Control ───────────────────────────────────────────────────────
  // Time Zones
  getTimeZones:         (params = {}) => apiService.get('/api/device/access/timezones/', params),
  createTimeZone:       (data)        => apiService.post('/api/device/access/timezones/', data),
  updateTimeZone:       (id, data)    => apiService.put(`/api/device/access/timezones/${id}`, data),
  deleteTimeZone:       (id)          => apiService.delete(`/api/device/access/timezones/${id}`),

  // Access Levels
  getAccessLevels:      (params = {}) => apiService.get('/api/device/access/levels/', params),
  createAccessLevel:    (data)        => apiService.post('/api/device/access/levels/', data),
  updateAccessLevel:    (id, data)    => apiService.put(`/api/device/access/levels/${id}`, data),
  deleteAccessLevel:    (id)          => apiService.delete(`/api/device/access/levels/${id}`),

  // Doors
  getDoors:             (params = {}) => apiService.get('/api/device/access/doors/', params),
  createDoor:           (data)        => apiService.post('/api/device/access/doors/', data),
  updateDoor:           (id, data)    => apiService.put(`/api/device/access/doors/${id}`, data),
  deleteDoor:           (id)          => apiService.delete(`/api/device/access/doors/${id}`),
  openDoor:             (id)          => apiService.post(`/api/device/access/doors/${id}/open`),

  // User Access Authorizations
  getUserAuthorizations: (params = {}) => apiService.get('/api/device/access/users/', params),
  createUserAuthorization: (data)      => apiService.post('/api/device/access/users/', data),
  deleteUserAuthorization: (id)        => apiService.delete(`/api/device/access/users/${id}`),

  // Anti-Passback (no update endpoint — create/delete only)
  getAntiPassback:      (params = {}) => apiService.get('/api/device/access/anti-passback/', params),
  createAntiPassback:   (data)        => apiService.post('/api/device/access/anti-passback/', data),
  deleteAntiPassback:   (id)          => apiService.delete(`/api/device/access/anti-passback/${id}`),

  // Blacklist
  getBlacklist:         (params = {}) => apiService.get('/api/device/access/blacklist/', params),
  addToBlacklist:       (data)        => apiService.post('/api/device/access/blacklist/', data),
  removeFromBlacklist:  (id)          => apiService.delete(`/api/device/access/blacklist/${id}`),

  // ─── Device Schedules ─────────────────────────────────────────────────────
  // params: { terminal_sn }
  getSchedules:         (params = {}) => apiService.get('/api/device/schedules/', params),
  createSchedule:       (data)        => apiService.post('/api/device/schedules/', data),
  updateSchedule:       (id, data)    => apiService.put(`/api/device/schedules/${id}`, data),
  deleteSchedule:       (id)          => apiService.delete(`/api/device/schedules/${id}`),

  // ─── Maintenance Tracking ─────────────────────────────────────────────────
  // params: { terminal_sn, status }
  getMaintenance:       (params = {}) => apiService.get('/api/device/maintenance/', params),
  createMaintenance:    (data)        => apiService.post('/api/device/maintenance/', data),
  updateMaintenance:    (id, data)    => apiService.put(`/api/device/maintenance/${id}`, data),
  deleteMaintenance:    (id)          => apiService.delete(`/api/device/maintenance/${id}`),

  // ─── ZKTeco Direct IP (port 4370 / ZKLib) ────────────────────────────────
  zkQuickPing:          (data)        => apiService.post('/api/v1/zkteco/direct/quick-ping', data),
  zkQuickGetTime:       (data)        => apiService.post('/api/v1/zkteco/direct/quick-get-time', data),
  zkQuickSyncTime:      (data)        => apiService.post('/api/v1/zkteco/direct/quick-sync-time', data),
  admsSyncTime:         (sn)          => apiService.post('/iclock/cmd/sync-time', { sn }),
  zkRegisterDevice:     (data)        => apiService.post('/api/v1/zkteco/direct/devices', data),
  zkListDirectDevices:  ()            => apiService.get('/api/v1/zkteco/direct/devices'),
  zkPingDevice:         (id)          => apiService.get(`/api/v1/zkteco/direct/devices/${id}/ping`),
  zkSyncPersonnel:      (id, data)    => apiService.post(`/api/v1/zkteco/direct/devices/${id}/sync-personnel`, data),
  zkPollNow:            (id)          => apiService.post(`/api/v1/zkteco/direct/devices/${id}/poll-now`),
  zkOpenDoor:           (id, data)    => apiService.post(`/api/v1/zkteco/direct/devices/${id}/open-door`, data),
  zkSyncTime:           (id, data)    => apiService.post(`/api/v1/zkteco/direct/devices/${id}/sync-time`, data),
  zkRestartDevice:      (id, data)    => apiService.post(`/api/v1/zkteco/direct/devices/${id}/restart`, data),
  zkSetPollConfig:      (id, data)    => apiService.patch(`/api/v1/zkteco/direct/devices/${id}/poll-config`, data),
};

export { deviceAPI };
export default deviceAPI;
