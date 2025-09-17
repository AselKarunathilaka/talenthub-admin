const axios = require('axios');
require('dotenv').config();

class SLTApiService {
  constructor() {
    this.apiUrl = 'https://prohub.slt.com.lk/ProhubTrainees/api/MainApi/AllActiveTrainees';
    this.secretKey = process.env.API_SECRET_KEY;
    this.timeout = 15000; // 15 seconds timeout
  }

  async fetchActiveTrainees() {
    try {
      console.log('🔗 Fetching active trainees from SLT API...');
      
      const response = await axios.post(this.apiUrl, {
        secretKey: this.secretKey
      }, {
        timeout: this.timeout,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Prohub Intern Management System/1.0'
        }
      });

      console.log('📋 Raw API Response structure:', {
        isSuccess: response.data.isSuccess,
        errorShow: response.data.errorShow,
        errorMessage: response.data.errorMessage,
        dataBundleLength: response.data.dataBundle ? response.data.dataBundle.length : 'undefined'
      });
      
      // Check if the API call was successful
      if (!response.data.isSuccess) {
        throw new Error(`SLT API error: ${response.data.errorMessage || 'Unknown error'}`);
      }
      
      // The data is in the dataBundle property
      if (response.data.dataBundle && Array.isArray(response.data.dataBundle)) {
        console.log(`✅ Successfully fetched ${response.data.dataBundle.length} trainees from SLT API`);
        return response.data.dataBundle;
      } else if (response.data && Array.isArray(response.data)) {
        console.log(`✅ Successfully fetched ${response.data.length} trainees from SLT API`);
        return response.data;
      } else {
        console.log('🔍 Available keys in response:', Object.keys(response.data));
        throw new Error('Invalid response format from SLT API - Expected array in dataBundle, but found: ' + typeof response.data.dataBundle);
      }
    } catch (error) {
      console.error('❌ Error fetching from SLT API:', error.message);
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('SLT API request timeout - Service might be unavailable');
      }
      
      if (error.response) {
        console.error('📊 API Response status:', error.response.status);
        console.error('📋 API Response data:', error.response.data);
        throw new Error(`SLT API responded with status ${error.response.status}`);
      }
      
      if (error.request) {
        throw new Error('No response received from SLT API - Network issue');
      }
      
      throw new Error(`Failed to fetch data from SLT API: ${error.message}`);
    }
  }

  // Helper method to map API data to your schema
  mapToInternSchema(apiData) {
    return apiData.map(trainee => ({
      traineeId: trainee.Trainee_ID?.toString() || '',
      traineeName: trainee.Trainee_Name || '',
      fieldOfSpecialization: '', // Default empty - you can map this if available
      trainingStartDate: trainee.Training_StartDate ? new Date(trainee.Training_StartDate) : null,
      trainingEndDate: trainee.Training_EndDate ? new Date(trainee.Training_EndDate) : null,
      institute: trainee.Institute || '',
      email: trainee.Trainee_Email || '',
      team: '',
      attendance: [],
      availableDays: []
    }));
  }
}

module.exports = new SLTApiService();