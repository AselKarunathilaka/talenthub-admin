/*
  Manual script to run SLT API sync with cleanup.
  This will:
  1. Fetch active trainees from SLT API
  2. Add/update interns in DB
  3. Remove interns from DB who are no longer in API (like terminated ones)
  
  Usage:
    node syncAndCleanup.js
*/

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const InternService = require('../services/internService');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not found in .env — cannot connect to DB.');
    process.exit(1);
  }

  console.log('🔌 Connecting to database...');
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('✅ Connected to DB');

  console.log('\n🚀 Starting manual SLT API sync with cleanup...\n');
  
  try {
    const result = await InternService.syncWithSLTAPI();
    
    console.log('\n📊 Final Results:');
    console.log('================');
    console.log(`Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`Message: ${result.message}`);
    console.log('\nDetailed Stats:');
    console.log(`  📥 Added: ${result.stats.added}`);
    console.log(`  📝 Updated: ${result.stats.updated}`);
    console.log(`  🗑️  Removed: ${result.stats.removed}`);
    console.log(`  ⏭️  Skipped: ${result.stats.skipped}`);
    console.log(`  ❌ Errors: ${result.stats.errors}`);
    console.log(`  🎯 Total API Trainees: ${result.stats.totalProcessed}`);
    
    if (result.stats.removed > 0) {
      console.log('\n🎉 Successfully cleaned up terminated/inactive interns!');
      console.log('   Database is now synchronized with the API.');
    }
    
  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from database');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});