// services/sltApiService.js
const axios = require('axios');
require('dotenv').config();

class SLTApiService {
  constructor() {
    this.apiUrl = 'https://prohub.slt.com.lk/ProhubTrainees/api/MainApi/AllActiveTrainees';
    this.secretKey = process.env.TRAINEES_API_SECRET_KEY;
    this.timeout = 30000; // 30 seconds
  }

  async fetchActiveTrainees() {
    try {
      console.log('\n🎯 ========== SLT API REQUEST START ==========');
      console.log('🔗 Fetching active trainees from SLT API...');
      console.log('📝 API URL:', this.apiUrl);
      console.log('🔑 Secret Key Present:', !!this.secretKey);
      console.log('🔑 Secret Key Length:', this.secretKey ? this.secretKey.length : 0);
      
      // Log first and last few characters of the key for verification (without exposing full key)
      if (this.secretKey) {
        console.log('🔑 Key Preview:', 
          this.secretKey.substring(0, 6) + 
          '...' + 
          this.secretKey.substring(this.secretKey.length - 3)
        );
      }
      
      if (!this.secretKey) {
        throw new Error('API secret key is missing from environment variables. Check your .env file');
      }

      const requestBody = {
        secretKey: this.secretKey
      };

      console.log('\n📤 REQUEST DETAILS:');
      console.log('   URL:', this.apiUrl);
      console.log('   Method: POST');
      console.log('   Timeout:', this.timeout + 'ms');
      console.log('   Request Body:', JSON.stringify(requestBody));
      console.log('   Headers:', {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Prohub Intern Management System/1.0'
      });

      const response = await axios.post(this.apiUrl, requestBody, {
        timeout: this.timeout,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Prohub Intern Management System/1.0'
        },
        // Add request transformation for debugging
        transformRequest: [(data, headers) => {
          console.log('   🔍 Actual headers being sent:', {
            'Content-Type': headers['Content-Type'],
            'Accept': headers['Accept'],
            'User-Agent': headers['User-Agent']
          });
          return JSON.stringify(data);
        }],
        // Add response interception for debugging
        transformResponse: [(data) => {
          console.log('   🔍 Raw response data:', data);
          try {
            return data ? JSON.parse(data) : data;
          } catch (e) {
            return data;
          }
        }]
      });

      console.log('\n✅ RESPONSE RECEIVED:');
      console.log('   Status:', response.status);
      console.log('   Status Text:', response.statusText);
      console.log('   Headers:', {
        'content-type': response.headers['content-type'],
        'server': response.headers['server'],
        'date': response.headers['date']
      });
      
      // Check if we got any response data
      if (!response.data) {
        console.log('   ❌ Response data: EMPTY');
        throw new Error('No data received from SLT API - Empty response body');
      }

      console.log('   Response Data Type:', typeof response.data);
      console.log('   Response Data Keys:', response.data ? Object.keys(response.data) : 'No keys');
      
      // Handle different possible response formats
      if (response.data.isSuccess === false) {
        const errorMsg = `SLT API returned error: ${response.data.errorMessage || 'Unknown error'}`;
        console.log('   ❌ API Error Flag:', errorMsg);
        throw new Error(errorMsg);
      }

      // Try different possible data locations
      let traineesData = null;
      
      if (response.data.dataBundle && Array.isArray(response.data.dataBundle)) {
        traineesData = response.data.dataBundle;
        console.log('   📦 Data Source: dataBundle array');
      } else if (response.data && Array.isArray(response.data)) {
        traineesData = response.data;
        console.log('   📦 Data Source: root array');
      } else if (response.data.data && Array.isArray(response.data.data)) {
        traineesData = response.data.data;
        console.log('   📦 Data Source: data array');
      } else {
        console.log('   🔍 Available keys in response:', Object.keys(response.data));
        console.log('   🔍 Full response structure:', JSON.stringify(response.data, null, 2));
        throw new Error('Invalid response format from SLT API - No array found in expected locations');
      }

      console.log(`\n📊 DATA SUMMARY:`);
      console.log(`   ✅ Successfully fetched ${traineesData.length} trainees from SLT API`);
      
      // Log first few items to verify structure
      if (traineesData.length > 0) {
        console.log('   📝 Sample trainee data (first item):');
        console.log(JSON.stringify(traineesData[0], null, 2));
        
        // Log all available fields from the first trainee
        console.log('   🔍 Available fields in trainee object:');
        console.log('      ' + Object.keys(traineesData[0]).join(', '));
      } else {
        console.log('   ⚠️  No trainees found in response');
      }

      console.log('🎯 ========== SLT API REQUEST COMPLETED ==========\n');
      
      return traineesData;
    } catch (error) {
      console.log('\n❌ ========== SLT API ERROR ==========');
      console.error('   Error Message:', error.message);
      
      if (error.code === 'ECONNABORTED') {
        console.error('   ❌ Request timeout - Service might be unavailable or slow');
        throw new Error('SLT API request timeout - Service might be unavailable');
      }
      
      if (error.response) {
        // Server responded with error status
        console.error('   📊 Response Status:', error.response.status);
        console.error('   📋 Response Status Text:', error.response.statusText);
        console.error('   📦 Response Headers:', error.response.headers);
        console.error('   📄 Response Data:', error.response.data);
        
        switch (error.response.status) {
          case 401:
            console.error('   🔐 401 Unauthorized - Invalid secret key or authentication failed');
            throw new Error('SLT API Authentication Failed (401) - Please check your secret key');
          case 403:
            console.error('   🚫 403 Forbidden - Access denied');
            throw new Error('SLT API Access Denied (403) - Check permissions or IP whitelisting');
          case 404:
            console.error('   🔍 404 Not Found - API endpoint might be incorrect');
            throw new Error('SLT API Endpoint Not Found (404) - Check the API URL');
          case 500:
            console.error('   💥 500 Internal Server Error - SLT API server issue');
            throw new Error('SLT API Server Error (500) - Service might be temporarily down');
          default:
            console.error('   ❌ Unexpected HTTP status:', error.response.status);
            throw new Error(`SLT API responded with status ${error.response.status}: ${error.response.statusText}`);
        }
      } else if (error.request) {
        // Request was made but no response received
        console.error('   🌐 No response received - Network issue or CORS problem');
        console.error('   📡 Request details:', {
          method: error.request.method,
          url: error.request.url,
          headers: error.request.headers
        });
        throw new Error('No response received from SLT API - Check network connectivity or CORS settings');
      } else {
        // Something else happened
        console.error('   ⚠️  Configuration error:', error.message);
        throw new Error(`Failed to fetch data from SLT API: ${error.message}`);
      }
    }
  }

  // Enhanced mapper with better field mapping and fallbacks
  mapToInternSchema(apiData) {
    if (!apiData || !Array.isArray(apiData)) {
      console.log('⚠️  mapToInternSchema: Invalid API data received');
      return [];
    }

    console.log(`\n🔄 Mapping ${apiData.length} trainees to internal schema...`);
    
    const mappedTrainees = apiData.map((trainee, index) => {
      // Log the structure of first trainee for debugging
      if (index === 0) {
        console.log('   🔍 Raw trainee structure (first item):', Object.keys(trainee));
      }
      
      const mappedTrainee = {
        traineeId: this.getFieldValue(trainee, ['Trainee_ID', 'traineeId', 'id'])?.toString() || '',
        traineeName: this.getFieldValue(trainee, ['Trainee_Name', 'traineeName', 'name', 'TraineeName']) || '',
        fieldOfSpecialization: this.getFieldValue(trainee, ['Field', 'Specialization', 'fieldOfSpecialization', 'FieldOfStudy']) || 'General Training',
        trainingStartDate: this.parseDate(this.getFieldValue(trainee, ['Training_StartDate', 'startDate', 'StartDate'])),
        trainingEndDate: this.parseDate(this.getFieldValue(trainee, ['Training_EndDate', 'endDate', 'EndDate'])),
        institute: this.getFieldValue(trainee, ['Institute', 'institute', 'University', 'College']) || '',
        email: this.getFieldValue(trainee, ['Trainee_Email', 'email', 'Email']) || '',
        team: '',
        attendance: [],
        availableDays: []
      };

      // Log mapping result for first item
      if (index === 0) {
        console.log('   ✅ Mapped trainee (first item):', JSON.stringify(mappedTrainee, null, 2));
      }

      return mappedTrainee;
    });

    console.log(`   ✅ Successfully mapped ${mappedTrainees.length} trainees`);
    return mappedTrainees;
  }

  // Helper method to get field value with fallbacks
  getFieldValue(obj, possibleKeys) {
    for (const key of possibleKeys) {
      if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        return obj[key];
      }
    }
    return '';
  }

  // Helper method to parse dates safely
  parseDate(dateString) {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      console.log('   ⚠️  Date parsing error for:', dateString, error.message);
      return null;
    }
  }

  // Test method to verify API connection
  async testConnection() {
    try {
      console.log('\n🧪 Testing SLT API Connection...');
      const trainees = await this.fetchActiveTrainees();
      
      return {
        success: true,
        message: 'SLT API connection successful',
        count: trainees.length,
        sample: trainees.slice(0, 2), // Return first 2 as sample
        total: trainees.length
      };
    } catch (error) {
      return {
        success: false,
        message: `SLT API connection failed: ${error.message}`,
        count: 0,
        sample: [],
        total: 0
      };
    }
  }

  // Method to get raw API response for debugging
  async getRawResponse() {
    try {
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

      return {
        success: true,
        status: response.status,
        headers: response.headers,
        data: response.data,
        raw: response
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        response: error.response ? {
          status: error.response.status,
          headers: error.response.headers,
          data: error.response.data
        } : null
      };
    }
  }
}

module.exports = new SLTApiService();