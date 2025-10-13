const axios = require('axios');
const config = require('../config/externalSystems');

/**
 * Service for making external API calls to Attendance System
 */
class ExternalSystemService {
  constructor() {
    this.attendanceSystemConfig = config.attendanceSystem;
    this.axiosInstance = axios.create({
      baseURL: this.attendanceSystemConfig.baseUrl,
      timeout: this.attendanceSystemConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }

  /**
   * Sync daily attendance to Attendance System
   * @param {string} qrSessionId - QR session ID that was scanned
   * @param {string} traineeId - Trainee ID from intern record
   * @returns {Promise<Object>} Response from attendance system
   */
  async syncDailyAttendance(qrSessionId, traineeId) {
    if (!this.attendanceSystemConfig.enabled) {
      console.log('Attendance system sync is disabled');
      return { success: true, message: 'Sync disabled' };
    }

    try {
      const response = await this.axiosInstance.post(
        this.attendanceSystemConfig.endpoints.scanDaily,
        {
          qrSessionId,
          traineeId
        }
      );

      console.log(`Daily attendance synced to attendance system for trainee ${traineeId}`);
      return response.data;
    } catch (error) {
      console.error('Error syncing daily attendance to attendance system:', error.message);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        // Don't throw error for client errors (4xx) as these are expected business logic errors
        if (error.response.status >= 400 && error.response.status < 500) {
          return {
            success: false,
            error: error.response.data.message || 'Client error',
            code: error.response.data.code
          };
        }
      }
      
      // For network errors and server errors, we still want to continue with local processing
      // but log the issue
      console.error('Failed to sync with attendance system, continuing with local processing');
      return {
        success: false,
        error: 'External system unavailable',
        localProcessingContinued: true
      };
    }
  }

  /**
   * Sync meeting attendance to Attendance System
   * @param {string} qrSessionId - QR session ID that was scanned
   * @param {string} traineeId - Trainee ID from intern record
   * @returns {Promise<Object>} Response from attendance system
   */
  async syncMeetingAttendance(qrSessionId, traineeId) {
    if (!this.attendanceSystemConfig.enabled) {
      console.log('Attendance system sync is disabled');
      return { success: true, message: 'Sync disabled' };
    }

    try {
      const response = await this.axiosInstance.post(
        this.attendanceSystemConfig.endpoints.scanMeeting,
        {
          qrSessionId,
          traineeId
        }
      );

      console.log(`Meeting attendance synced to attendance system for trainee ${traineeId}`);
      return response.data;
    } catch (error) {
      console.error('Error syncing meeting attendance to attendance system:', error.message);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        // Don't throw error for client errors (4xx) as these are expected business logic errors
        if (error.response.status >= 400 && error.response.status < 500) {
          return {
            success: false,
            error: error.response.data.message || 'Client error',
            code: error.response.data.code
          };
        }
      }
      
      // For network errors and server errors, we still want to continue with local processing
      // but log the issue
      console.error('Failed to sync with attendance system, continuing with local processing');
      return {
        success: false,
        error: 'External system unavailable',
        localProcessingContinued: true
      };
    }
  }
}

module.exports = new ExternalSystemService();