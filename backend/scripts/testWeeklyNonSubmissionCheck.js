/**
 * Test script for Weekly Non-Submission Check
 * 
 * This script tests the weekly non-submission check feature that:
 * 1. Checks if interns have submitted logs for the past 5 working days
 * 2. Sends an email to mgiri@slt.com.lk with the list of non-submitting interns
 * 
 * Run this script to test the feature manually:
 * node backend/scripts/testWeeklyNonSubmissionCheck.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const WeeklyNonSubmissionService = require("../services/weeklyNonSubmissionService");

async function testWeeklyNonSubmissionCheck() {
  try {
    console.log("🧪 Starting Weekly Non-Submission Check Test...\n");
    
    // Connect to MongoDB
    console.log("📦 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB\n");
    
    // Perform the weekly non-submission check
    console.log("🔍 Performing weekly non-submission check...\n");
    const results = await WeeklyNonSubmissionService.performWeeklyNonSubmissionCheck("manual-test");
    
    // Display results
    console.log("\n" + "=".repeat(70));
    console.log("TEST RESULTS");
    console.log("=".repeat(70));
    console.log(`Total Interns Checked: ${results.total}`);
    console.log(`Interns Who Submitted: ${results.submitted}`);
    console.log(`Interns Who DID NOT Submit: ${results.notSubmitted}`);
    console.log(`Email Sent: ${results.emailSent ? "YES" : "NO"}`);
    console.log(`Email Message ID: ${results.emailMessageId || "N/A"}`);
    console.log(`Errors: ${results.errors.length}`);
    console.log(`Execution Time: ${results.executionTime}ms`);
    console.log("=".repeat(70));
    
    if (results.nonSubmittedList && results.nonSubmittedList.length > 0) {
      console.log("\n📋 Non-Submitting Interns:");
      console.log("-".repeat(70));
      results.nonSubmittedList.forEach((intern, index) => {
        console.log(`${index + 1}. ${intern.name} (${intern.id})`);
        console.log(`   Email: ${intern.email}`);
        console.log(`   Field: ${intern.fieldOfSpecialization}`);
        console.log(`   Institute: ${intern.institute}`);
        console.log("");
      });
    }
    
    if (results.errors && results.errors.length > 0) {
      console.log("\n⚠️  Errors Encountered:");
      console.log("-".repeat(70));
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.internName}: ${error.error}`);
      });
    }
    
    console.log("\n✅ Test completed successfully!");
    
  } catch (error) {
    console.error("\n❌ Test failed with error:");
    console.error(error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log("\n📦 MongoDB connection closed");
    process.exit(0);
  }
}

// Run the test
testWeeklyNonSubmissionCheck();
