/**
 * Script to test internship end date notification by finding/creating test data
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Intern = require('../models/Intern');

async function testEndDateNotifications() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check current interns with end dates
    const internsWithEndDates = await Intern.find({ 
      Training_EndDate: { $exists: true, $ne: null } 
    }).select('Trainee_ID Trainee_Name Training_EndDate');

    console.log('\n=== Current Interns with End Dates ===');
    internsWithEndDates.forEach(intern => {
      const endDate = new Date(intern.Training_EndDate);
      const now = new Date();
      const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      
      console.log(`ID: ${intern.Trainee_ID}, Name: ${intern.Trainee_Name}`);
      console.log(`End Date: ${endDate.toDateString()}, Days Remaining: ${daysRemaining}`);
      console.log('---');
    });

    // Find an intern to update for testing (or create one)
    let testIntern = await Intern.findOne({ Trainee_ID: { $exists: true } });
    
    if (testIntern) {
      console.log(`\n=== Updating Test Intern (ID: ${testIntern.Trainee_ID}) ===`);
      
      // Set end date to 15 days from now for testing
      const testEndDate = new Date();
      testEndDate.setDate(testEndDate.getDate() + 15);
      
      testIntern.Training_EndDate = testEndDate;
      await testIntern.save();
      
      console.log(`Updated intern ${testIntern.Trainee_ID} end date to: ${testEndDate.toDateString()}`);
      console.log('This intern should now show a notification when logging in.');
    } else {
      console.log('No interns found in database.');
    }

    // Close connection
    await mongoose.connection.close();
    console.log('\nTest complete - Database connection closed.');
    
  } catch (error) {
    console.error('Error testing end date notifications:', error);
    process.exit(1);
  }
}

testEndDateNotifications();