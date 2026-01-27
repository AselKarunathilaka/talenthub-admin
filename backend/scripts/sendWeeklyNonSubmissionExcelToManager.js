/**
 * Send Weekly Non-Submission Report with Excel Attachment to Manager
 * 
 * This script sends the weekly logbook non-submission report with Excel attachment
 * directly to the supervisor (mgiri@slt.com.lk)
 * 
 * Purpose:
 * - Check all active interns for log submissions over the past 5 working days
 * - Generate an Excel file with complete list of non-submitting interns
 * - Send email to mgiri@slt.com.lk with Excel attachment
 * 
 * Excel File Contains:
 * - Report header with date and summary statistics
 * - Complete table with all non-submitting interns
 * - Columns: No., Name, ID, Email, Field, Institute, Team, Training Dates
 * 
 * Email Structure:
 * - HTML formatted email body
 * - Summary of non-submissions
 * - Preview table showing first 10 interns
 * - Excel file attached with complete data
 * - Recommended actions for follow-up
 * 
 * Run this script with:
 * node backend/scripts/sendWeeklyNonSubmissionExcelToManager.js
 * 
 * Author: TalentHub System
 * Date: January 27, 2026
 */

const path = require('path');
require("dotenv").config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require("mongoose");
const WeeklyNonSubmissionExcelService = require("../services/weeklyNonSubmissionExcelService");

// Production email address - Supervisor
const MANAGER_EMAIL = 'mgiri@slt.com.lk';

async function sendWeeklyNonSubmissionExcelToManager() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  WEEKLY NON-SUBMISSION REPORT WITH EXCEL - PRODUCTION MODE         ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\n📧 Supervisor Email: ${MANAGER_EMAIL}`);
  console.log('📊 Report Format: HTML Email + Excel Attachment');
  console.log('📅 Check Period: Past 5 Working Days');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
    });
    console.log('✅ Connected to MongoDB\n');

    // Verify email configuration
    console.log('📧 Email Configuration Check:');
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      throw new Error('❌ Email credentials not found in environment variables');
    }
    console.log(`   Gmail User: ${process.env.GMAIL_USER}`);
    console.log('   Gmail Pass: ✅ SET (hidden)\n');

    console.log('🚀 Starting weekly non-submission check with Excel generation...\n');
    
    const startTime = Date.now();

    // Perform the weekly non-submission check and send email with Excel to manager
    const result = await WeeklyNonSubmissionExcelService.performWeeklyNonSubmissionCheckWithExcel(MANAGER_EMAIL);

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // Display results
    console.log('\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║  WEEKLY NON-SUBMISSION REPORT - SUMMARY                            ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');
    console.log('📊 Statistics:');
    console.log(`   Total Interns Checked:        ${result.totalInterns || 'N/A'}`);
    console.log(`   Submitted Logs (5 days):      ${result.submittedCount || 'N/A'}`);
    console.log(`   Did NOT Submit:               ${result.nonSubmittedCount || 'N/A'}`);
    console.log(`   Processing Errors:            ${result.errors || 0}\n`);
    
    console.log('📧 Email Delivery:');
    console.log(`   Recipient:                    ${MANAGER_EMAIL}`);
    console.log(`   Email Sent:                   ${result.emailSent ? '✅ YES' : '❌ NO'}`);
    if (result.messageId) {
      console.log(`   Message ID:                   ${result.messageId}`);
    }
    if (result.excelFileName) {
      console.log(`   📎 Excel Attachment:          ${result.excelFileName}`);
    }
    console.log(`   Execution Time:               ${executionTime}ms (${(executionTime / 1000).toFixed(2)}s)\n`);

    if (result.nonSubmittedCount > 0) {
      console.log('⚠️  Action Required:');
      console.log('   - Follow up with non-submitting interns');
      console.log('   - Send reminders for log submission');
      console.log('   - Check for valid reasons (leave, sick, etc.)');
      console.log('   - Escalate persistent non-compliance\n');
    } else {
      console.log('✅ All interns are compliant with log submission requirements!\n');
    }

    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('✅ Weekly non-submission report with Excel sent successfully to manager!');
    console.log('═══════════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ ERROR during weekly non-submission report generation:');
    console.error(`   Error Type: ${error.name}`);
    console.error(`   Error Message: ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // Disconnect from MongoDB
    console.log('\n📡 Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
    console.log('🏁 Script execution completed!\n');
  }
}

// Execute the script
console.log('\n════════════════════════════════════════════════════════════════════════');
console.log('  WEEKLY LOGBOOK NON-SUBMISSION REPORT WITH EXCEL ATTACHMENT');
console.log('  Production Script - Sends to Supervisor (mgiri@slt.com.lk)');
console.log('════════════════════════════════════════════════════════════════════════\n');

sendWeeklyNonSubmissionExcelToManager();
