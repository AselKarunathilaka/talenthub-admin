// Configuration for external systems integration
module.exports = {
  // Attendance System Admin API configuration
  attendanceSystem: {
    baseUrl: process.env.ATTENDANCE_SYSTEM_URL || 'http://localhost:5001',
    endpoints: {
      scanDaily: '/api/qrcode/external/scan-daily',
      scanMeeting: '/api/qrcode/external/scan-meeting'
    },
    timeout: 10000, // 10 seconds timeout
    enabled: process.env.ATTENDANCE_SYSTEM_SYNC_ENABLED !== 'false' // Default enabled, can be disabled via env var
  }
};