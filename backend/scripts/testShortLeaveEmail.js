/**
 * Test Short Leave Email Sending
 * Tests if emails can be sent via the passwordless SMTP relay
 */

const ShortLeaveEmailService = require("../services/shortLeaveEmailService");
const mongoose = require("mongoose");
require("dotenv").config();

// Load all required models
require("../models/User");
require("../models/Intern"); 
require("../models/LeaveRequest");

async function testShortLeaveEmail() {
  console.log("\n========================================");
  console.log("🧪 TESTING SHORT LEAVE EMAIL SENDING");
  console.log("========================================\n");

  console.log("📧 Email Configuration:");
  console.log(`   FROM: ${process.env.SHORT_LEAVE_EMAIL}`);
  console.log(`   TO: ${process.env.SHORT_LEAVE_RECIPIENT}`);
  console.log(`   SMTP HOST: ${process.env.SHORT_LEAVE_SMTP_HOST}`);
  console.log(`   SMTP PORT: ${process.env.SHORT_LEAVE_SMTP_PORT}`);
  console.log(`   PASSWORD: ${process.env.SHORT_LEAVE_EMAIL_PASS ? 'SET' : 'NOT SET (Passwordless)'}`);
  console.log();

  try {
    // Connect to MongoDB to fetch real data
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Run the actual email service
    console.log("📤 Attempting to send short leave report email...\n");
    const result = await ShortLeaveEmailService.sendDailyShortLeaveReport();

    console.log("\n========================================");
    console.log("📊 TEST RESULT");
    console.log("========================================");
    console.log(JSON.stringify(result, null, 2));

    if (result.success && !result.skipped) {
      console.log("\n✅ SUCCESS! Email sent successfully!");
      console.log(`📧 Check inbox: ${process.env.SHORT_LEAVE_RECIPIENT}`);
      console.log(`📊 Requests sent: ${result.requestsCount}`);
    } else if (result.skipped) {
      console.log("\n⚠️  SKIPPED: " + result.reason);
      console.log("💡 Tip: Create some leave requests first to test with data");
    } else {
      console.log("\n❌ FAILED: " + result.error);
    }

  } catch (error) {
    console.error("\n❌ TEST FAILED WITH ERROR:");
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  }
}

testShortLeaveEmail();
