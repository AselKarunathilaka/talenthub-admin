/*
  Run a dry-run of the daily reminder logic.
  - Loads backend/.env
  - Connects to MongoDB
  - Executes DailyReminderService in dryRun mode (no emails sent)
  - Prints concise summary and exits
*/

const path = require('path');
const mongoose = require('mongoose');

// Ensure we load the correct .env from backend directory
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const connectDB = require('../config/database');
const DailyReminderService = require('../services/dailyReminderService');

(async () => {
  try {
    await connectDB();
    const result = await DailyReminderService.runDailyReminder('manual', { dryRun: true, sampleSize: 10 });
    console.log('\n--- Daily Reminder Dry-Run Result ---');
    console.log(JSON.stringify(result, null, 2));
    if (Array.isArray(result.pendingSample)) {
      console.log('\nSample of pending interns (first 10):');
      for (const s of result.pendingSample) {
        console.log(` - ${s.traineeId} | ${s.name} | ${s.email || 'no-email'}`);
      }
    }
  } catch (err) {
    console.error('Failed to run daily reminder dry-run:', err);
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.connection.close();
    } catch (e) {
      // ignore
    }
  }
})();
