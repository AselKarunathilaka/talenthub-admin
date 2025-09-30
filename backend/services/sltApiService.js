// services/sltApiService.js
const axios = require('axios');
require('dotenv').config();

class SLTApiService {
  constructor() {
    this.apiUrl = 'https://prohub.slt.com.lk/ProhubTrainees/api/MainApi/AllActiveTrainees';
    this.secretKey = process.env.TRAINEES_API_SECRET_KEY;
    this.timeout = 30000; // 30 seconds
    this.debug = process.env.NODE_ENV === 'development'; // Only debug in development
  }

  async fetchActiveTrainees() {
    const startTime = Date.now();
    
    try {
      if (this.debug) {
        console.log('🔗 Fetching active trainees from SLT API...');
      }

      if (!this.secretKey) {
        throw new Error('API secret key is missing from environment variables');
      }

      const requestBody = { secretKey: this.secretKey };

      const response = await axios.post(this.apiUrl, requestBody, {
        timeout: this.timeout,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Prohub Intern Management System/1.0'
        }
      });

      if (!response.data) {
        throw new Error('No data received from SLT API - Empty response body');
      }

      if (response.data.isSuccess === false) {
        throw new Error(`SLT API returned error: ${response.data.errorMessage || 'Unknown error'}`);
      }

      // Extract trainees data from different possible locations
      let traineesData = null;
      
      if (response.data.dataBundle && Array.isArray(response.data.dataBundle)) {
        traineesData = response.data.dataBundle;
      } else if (response.data && Array.isArray(response.data)) {
        traineesData = response.data;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        traineesData = response.data.data;
      } else {
        throw new Error('Invalid response format from SLT API - No array found in expected locations');
      }

      const duration = Date.now() - startTime;
      
      if (this.debug) {
        console.log(`✅ SLT API: ${traineesData.length} trainees fetched in ${duration}ms`);
      }

      return traineesData;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (this.debug) {
        console.error(`❌ SLT API Error (${duration}ms):`, error.message);
      }

      if (error.response) {
        switch (error.response.status) {
          case 401:
            throw new Error('SLT API Authentication Failed (401) - Please check your secret key');
          case 403:
            throw new Error('SLT API Access Denied (403) - Check permissions or IP whitelisting');
          case 404:
            throw new Error('SLT API Endpoint Not Found (404) - Check the API URL');
          case 500:
            throw new Error('SLT API Server Error (500) - Service might be temporarily down');
          default:
            throw new Error(`SLT API responded with status ${error.response.status}: ${error.response.statusText}`);
        }
      } else if (error.request) {
        throw new Error('No response received from SLT API - Check network connectivity');
      } else {
        throw new Error(`Failed to fetch data from SLT API: ${error.message}`);
      }
    }
  }

  // Quick field presence check (only in debug mode)
  analyzeFieldPresence(traineesData) {
    if (!this.debug || !traineesData || traineesData.length === 0) return;

    const sampleTrainee = traineesData[0];
    const criticalFields = ['Trainee_ID', 'Trainee_Name', 'Trainee_Email'];
    
    console.log('📋 Critical Fields Check:');
    criticalFields.forEach(field => {
      const exists = sampleTrainee.hasOwnProperty(field);
      console.log(`   ${exists ? '✅' : '❌'} ${field}`);
    });
  }

  // Fast data quality analysis
  analyzeDataQuality(traineesData) {
    if (!this.debug || !traineesData || traineesData.length === 0) return;

    const hasTraineeId = traineesData.filter(t => t.Trainee_ID).length;
    const hasTraineeName = traineesData.filter(t => t.Trainee_Name).length;
    const hasEmail = traineesData.filter(t => t.Trainee_Email).length;
    const uniqueIds = new Set(traineesData.map(t => t.Trainee_ID?.toString()).filter(Boolean)).size;

    console.log('📊 Data Quality:');
    console.log(`   Total: ${traineesData.length}`);
    console.log(`   With ID: ${hasTraineeId} (${((hasTraineeId/traineesData.length)*100).toFixed(1)}%)`);
    console.log(`   With Name: ${hasTraineeName} (${((hasTraineeName/traineesData.length)*100).toFixed(1)}%)`);
    console.log(`   With Email: ${hasEmail} (${((hasEmail/traineesData.length)*100).toFixed(1)}%)`);
    console.log(`   Unique IDs: ${uniqueIds}`);
  }

  // Optimized mapper
  mapToInternSchema(apiData) {
    if (!apiData || !Array.isArray(apiData)) {
      if (this.debug) console.log('⚠️ Invalid API data received for mapping');
      return [];
    }

    const mappedTrainees = apiData.map(trainee => ({
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
    }));

    if (this.debug) {
      console.log(`✅ Mapped ${mappedTrainees.length} trainees to internal schema`);
    }

    return mappedTrainees;
  }

  // Fast test method
  async testConnection() {
    try {
      const trainees = await this.fetchActiveTrainees();
      
      return {
        success: true,
        message: 'SLT API connection successful',
        count: trainees.length,
        sample: this.debug ? trainees.slice(0, 2) : [], // Only include sample in debug
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

  // Optimized database comparison
  async compareWithDatabase(internRepository) {
    try {
      const [apiTrainees, dbInterns] = await Promise.all([
        this.fetchActiveTrainees(),
        internRepository.getAllInterns()
      ]);

      const apiTraineeIds = new Set(apiTrainees.map(t => t.Trainee_ID?.toString()).filter(Boolean));
      const dbTraineeIds = new Set(dbInterns.map(i => i.traineeId?.toString()).filter(Boolean));

      const inApiNotInDb = [...apiTraineeIds].filter(id => !dbTraineeIds.has(id));
      const inDbNotInApi = [...dbTraineeIds].filter(id => !apiTraineeIds.has(id));

      if (this.debug) {
        console.log('🔍 Database Comparison:');
        console.log(`   API: ${apiTraineeIds.size}, DB: ${dbTraineeIds.size}`);
        console.log(`   To add: ${inApiNotInDb.length}, To review: ${inDbNotInApi.length}`);
      }

      return {
        apiCount: apiTraineeIds.size,
        dbCount: dbTraineeIds.size,
        toAdd: inApiNotInDb.length,
        toReview: inDbNotInApi.length,
        inBoth: apiTraineeIds.size - inApiNotInDb.length
      };
    } catch (error) {
      if (this.debug) {
        console.error('❌ Database comparison failed:', error.message);
      }
      return null;
    }
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
      return null;
    }
  }

  // Basic email validation
  isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }
}

module.exports = new SLTApiService();