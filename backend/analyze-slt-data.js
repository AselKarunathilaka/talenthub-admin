// backend/analyze-slt-data.js
require('dotenv').config();
const SLTApiService = require('./services/sltApiService');
const InternRepository = require('./repositories/internRepository'); // Adjust path as needed

async function comprehensiveAnalysis() {
  console.log('📈 ========== COMPREHENSIVE SLT API ANALYSIS ==========\n');
  
  try {
    // 1. Test API Connection
    console.log('1. 🔗 TESTING API CONNECTION...');
    const testResult = await SLTApiService.testConnection();
    
    if (!testResult.success) {
      console.log('❌ API Test Failed:', testResult.message);
      return;
    }
    
    console.log('✅ API Connection Successful');
    console.log(`   Total trainees from API: ${testResult.count}`);
    
    // 2. Show analytics
    if (testResult.analytics) {
      console.log(`\n2. 📊 API DATA ANALYTICS:`);
      console.log(`   Unique Trainee IDs: ${testResult.analytics.uniqueTraineeIds}`);
      console.log(`   With Emails: ${testResult.analytics.withEmails}`);
      console.log(`   With Valid Emails: ${testResult.analytics.withValidEmails}`);
      console.log(`   Email Completeness: ${testResult.analytics.emailCompleteness}%`);
    }
    
    // 3. Compare with database if repository is available
    try {
      console.log(`\n3. 🔍 COMPARING WITH DATABASE...`);
      const comparison = await SLTApiService.compareWithDatabase(InternRepository);
      
      if (comparison) {
        console.log(`   📈 SYNC STATUS:`);
        console.log(`      API: ${comparison.apiCount} trainees`);
        console.log(`      DB: ${comparison.dbCount} interns`);
        console.log(`      To Add: ${comparison.toAdd}`);
        console.log(`      To Review: ${comparison.toReview}`);
        
        const syncPercentage = ((comparison.inBoth / comparison.apiCount) * 100).toFixed(1);
        console.log(`      Sync Status: ${syncPercentage}% synchronized`);
      }
    } catch (dbError) {
      console.log('   ⚠️  Database comparison skipped:', dbError.message);
    }
    
    console.log('\n🎉 ANALYSIS COMPLETED SUCCESSFULLY!');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

comprehensiveAnalysis();