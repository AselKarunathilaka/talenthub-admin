// test-slt-debug.js
require('dotenv').config();
const SLTApiService = require('./services/sltApiService');

async function debug401Issue() {
  console.log('🔧 ========== DEBUGGING 401 ISSUE ==========\n');
  
  // Test 1: Check environment variables
  console.log('1. 🔍 CHECKING ENVIRONMENT VARIABLES:');
  console.log('   TRAINEES_API_SECRET_KEY:', process.env.TRAINEES_API_SECRET_KEY ? 'PRESENT' : 'MISSING ❌');
  
  if (process.env.TRAINEES_API_SECRET_KEY) {
    console.log('   Key Length:', process.env.TRAINEES_API_SECRET_KEY.length);
    console.log('   Key Preview:', 
      process.env.TRAINEES_API_SECRET_KEY.substring(0, 8) + 
      '...' + 
      process.env.TRAINEES_API_SECRET_KEY.substring(process.env.TRAINEES_API_SECRET_KEY.length - 4)
    );
  }
  
  // Test 2: Test API connection
  console.log('\n2. 🧪 TESTING API CONNECTION:');
  try {
    const result = await SLTApiService.testConnection();
    console.log('   Result:', result.success ? 'SUCCESS ✅' : 'FAILED ❌');
    console.log('   Message:', result.message);
    
    if (result.success) {
      console.log('   Trainees Found:', result.count);
    }
  } catch (error) {
    console.log('   Error:', error.message);
  }
  
  // Test 3: Get raw response for detailed analysis
  console.log('\n3. 📡 GETTING RAW RESPONSE:');
  try {
    const rawResponse = await SLTApiService.getRawResponse();
    console.log('   Success:', rawResponse.success);
    
    if (rawResponse.success) {
      console.log('   Status:', rawResponse.status);
      console.log('   Data Type:', typeof rawResponse.data);
      console.log('   Data Keys:', rawResponse.data ? Object.keys(rawResponse.data) : 'No data');
    } else {
      console.log('   Error:', rawResponse.error);
      if (rawResponse.response) {
        console.log('   Response Status:', rawResponse.response.status);
        console.log('   Response Data:', rawResponse.response.data);
      }
    }
  } catch (error) {
    console.log('   Raw response error:', error.message);
  }
  
  console.log('\n🔧 ========== DEBUGGING COMPLETE ==========');
}

debug401Issue();