/*
  Check which interns exist in database but not in SLT API.
  This helps identify terminated/inactive interns before cleanup.
  
  Usage:
    node checkInactiveInterns.js
*/

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const InternRepository = require('../repositories/internRepository');
const SLTApiService = require('../services/sltApiService');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not found in .env — cannot connect to DB.');
    process.exit(1);
  }

  console.log('🔌 Connecting to database...');
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('✅ Connected to DB');

  try {
    console.log('📡 Fetching active trainees from SLT API...');
    const activeTrainees = await SLTApiService.fetchActiveTrainees();
    console.log(`✅ Found ${activeTrainees.length} active trainees in API`);

    console.log('🗃️  Fetching all interns from database...');
    const allDbInterns = await InternRepository.getAllInterns();
    console.log(`✅ Found ${allDbInterns.length} interns in database`);

    // Create set of active trainee IDs from API
    const activeTraineeIds = new Set(
      activeTrainees
        .map(t => t.Trainee_ID?.toString())
        .filter(Boolean)
    );

    // Find interns in DB that are not in API
    const inactiveInterns = allDbInterns.filter(intern => {
      const traineeId = intern.Trainee_ID?.toString();
      return traineeId && !activeTraineeIds.has(traineeId);
    });

    console.log('\n📊 Analysis Results:');
    console.log('===================');
    console.log(`🔢 Total interns in database: ${allDbInterns.length}`);
    console.log(`🔢 Active trainees in API: ${activeTrainees.length}`);
    console.log(`🔢 Inactive interns (in DB but not API): ${inactiveInterns.length}`);

    if (inactiveInterns.length > 0) {
      console.log('\n🚨 Inactive Interns (will be removed in sync):');
      console.log('===============================================');
      inactiveInterns.forEach((intern, index) => {
        console.log(`${index + 1}. Trainee_ID: ${intern.Trainee_ID}`);
        console.log(`   Name: ${intern.Trainee_Name || 'N/A'}`);
        console.log(`   Email: ${intern.Trainee_Email || 'N/A'}`);
        console.log(`   Institute: ${intern.Institute || 'N/A'}`);
        console.log(`   Training Period: ${intern.Training_StartDate ? new Date(intern.Training_StartDate).toLocaleDateString() : 'N/A'} to ${intern.Training_EndDate ? new Date(intern.Training_EndDate).toLocaleDateString() : 'N/A'}`);
        console.log('   ---');
      });

      console.log('\n⚠️  WARNING: These interns will be REMOVED from the database');
      console.log('   when you run the sync cleanup process.');
      console.log('   Make sure this is expected before proceeding.');
      
      // Check if 3097 is in the list
      const intern3097 = inactiveInterns.find(intern => intern.Trainee_ID === '3097');
      if (intern3097) {
        console.log('\n🎯 CONFIRMED: Trainee_ID 3097 is in the removal list');
        console.log(`   Name: ${intern3097.Trainee_Name}`);
        console.log(`   This matches your reported case!`);
      }
    } else {
      console.log('\n✅ Great! All database interns are still active in the API.');
      console.log('   No cleanup needed.');
    }

  } catch (error) {
    console.error('💥 Error:', error.message);
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