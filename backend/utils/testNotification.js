/**
 * Test script for internship end date notification functionality
 */

const { calculateInternshipEndNotification } = require('./internshipNotification');

console.log('=== Testing Internship End Date Notification Logic ===\n');

// Test cases with different scenarios
const testCases = [
  {
    name: 'Internship ends today',
    endDate: new Date(), // Today
  },
  {
    name: 'Internship ends tomorrow',
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
  },
  {
    name: 'Internship ends in 3 days (high urgency)',
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  },
  {
    name: 'Internship ends in 7 days (medium urgency)',
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  {
    name: 'Internship ends in 15 days (low urgency)',
    endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
  },
  {
    name: 'Internship ends in 30 days (boundary case)',
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
  {
    name: 'Internship ends in 31 days (should not notify)',
    endDate: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
  },
  {
    name: 'Internship ended yesterday (should not notify)',
    endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    name: 'No end date provided',
    endDate: null,
  }
];

testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. ${testCase.name}`);
  console.log(`   End Date: ${testCase.endDate ? testCase.endDate.toDateString() : 'null'}`);
  
  const result = calculateInternshipEndNotification(testCase.endDate);
  
  console.log(`   Should Notify: ${result.shouldNotify}`);
  if (result.shouldNotify) {
    console.log(`   Days Remaining: ${result.daysRemaining}`);
    console.log(`   Urgency: ${result.urgency}`);
    console.log(`   Message: "${result.message}"`);
  }
  console.log('');
});

console.log('=== Test Complete ===');
