/**
 * Test Script for Weekly Non-Submission Check with Excel Attachment
 * Sends the non-submission report with Excel attachment to lakindunaveesha263@gmail.com for testing
 * 
 * This script tests:
 * 1. Fetching all active interns
 * 2. Checking their log submissions for the past 5 working days
 * 3. Generating an Excel file with non-submitting interns
 * 4. Sending an email with the Excel file as an attachment
 * 
 * Run this script with:
 * node backend/scripts/testWeeklyNonSubmissionExcelToTestEmail.js
 */

const path = require('path');
require("dotenv").config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require("mongoose");
const WeeklyNonSubmissionExcelService = require("../services/weeklyNonSubmissionExcelService");

// Test email address
const TEST_EMAIL = 'lakindunaveesha263@gmail.com';

async function testWeeklyNonSubmissionWithExcel() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  WEEKLY NON-SUBMISSION CHECK WITH EXCEL ATTACHMENT - TEST MODE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n🎯 Test Email Recipient: ${TEST_EMAIL}`);
  console.log('📊 Excel Attachment: Will be generated and attached to email');
  console.log('\nℹ️  This is a TEST. No emails will be sent to mgiri@slt.com.lk');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
    });
    console.log('✅ Connected to MongoDB\n');

    // Verify email configuration
    console.log('📧 Email Configuration Check:');
    console.log(`   Gmail User: ${process.env.GMAIL_USER || '❌ NOT SET'}`);
    console.log(`   Gmail Pass: ${process.env.GMAIL_PASS ? '✅ SET (hidden)' : '❌ NOT SET'}`);
    
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      throw new Error('Gmail credentials not configured in .env file');
    }
    console.log('');

    // Perform the weekly non-submission check with Excel attachment
    console.log('🚀 Starting weekly non-submission check with Excel generation...\n');
    
    const result = await WeeklyNonSubmissionExcelService.performWeeklyNonSubmissionCheckWithExcel(
      TEST_EMAIL,  // Send to test email instead of manager
      'manual-test' // Indicate this is a manual test
    );

    // Display results
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (result.emailSent) {
      console.log('✅ SUCCESS - Email with Excel attachment sent!');
      console.log(`\n📧 Email Details:`);
      console.log(`   To: ${TEST_EMAIL}`);
      console.log(`   Message ID: ${result.emailMessageId}`);
      console.log(`   Attachment: ${result.attachmentName || 'N/A'}`);
      console.log(`   Total Interns Checked: ${result.total}`);
      console.log(`   Submitted Logs: ${result.submitted}`);
      console.log(`   Did NOT Submit: ${result.notSubmitted}`);
      console.log(`   Execution Time: ${result.executionTime}ms`);
      
      if (result.errors && result.errors.length > 0) {
        console.log(`\n⚠️  Errors Encountered: ${result.errors.length}`);
        result.errors.forEach((err, index) => {
          console.log(`   ${index + 1}. ${err.internName}: ${err.error}`);
        });
      }

      console.log('\n📬 Please check your email at: lakindunaveesha263@gmail.com');
      console.log('   Look for an email with the subject containing "Weekly Logbook Non-Submission Alert"');
      console.log('   The email should have an Excel file (.xlsx) attached');

    } else {
      console.log('❌ FAILED - Email was not sent');
      console.log(`   Error: ${result.emailError || 'Unknown error'}`);
      
      if (result.nonSubmittedList && result.nonSubmittedList.length === 0) {
        console.log('\nℹ️  Note: All interns have submitted logs, so no alert was necessary');
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  WHAT TO CHECK IN THE EMAIL');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n1. ✉️  Email should be received in inbox (check spam folder too)');
    console.log('2. 📎 Email should have an Excel (.xlsx) attachment');
    console.log('3. 📊 Excel file should contain:');
    console.log('      - Report header with date and summary');
    console.log('      - Table with all non-submitting interns');
    console.log('      - Columns: No., Name, ID, Email, Field, Institute, Team, Dates');
    console.log('4. 📧 Email body should show:');
    console.log('      - Summary of non-submissions');
    console.log('      - Preview table (first 10 interns)');
    console.log('      - Notice about the Excel attachment');
    console.log('      - Recommended actions');
    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERROR during test execution:', error);
    console.error('\nStack trace:');
    console.error(error.stack);
  } finally {
    // Disconnect from MongoDB
    console.log('\n📡 Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    console.log('\n🏁 Test completed!\n');
    process.exit(0);
  }
}

// Run the test
testWeeklyNonSubmissionWithExcel();
