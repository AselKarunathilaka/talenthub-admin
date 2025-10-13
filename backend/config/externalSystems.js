// Configuration for external systems integration
module.exports = {
  // Attendance System Admin API configuration
  attendanceSystem: {
    baseUrl: process.env.ATTENDANCE_SYSTEM_URL || 'http://localhost:3000',
    endpoints: {
      scanDaily: '/api/qr-code/external/scan-daily',
      scanMeeting: '/api/qr-code/external/scan-meeting'
    },
    timeout: 10000, // 10 seconds timeout
    enabled: process.env.ATTENDANCE_SYSTEM_SYNC_ENABLED !== 'false' // Default enabled, can be disabled via env var
  }
};