const fs = require('fs');
const path = require('path');

const files = [
  'AdminDailyRecords.jsx',
  'Admininternattendance.jsx',
  'AdminFaceAttendance.jsx',
  'AdminLeaveManagement.jsx',
  'AdminStudyLeaveRequests.jsx',
  'AdminInternLocations.jsx',
  'AdminSeatManagement.jsx',
  'AdminQRManagement.jsx',
  'AdminInactiveInterns.jsx',
  'LogbookRestrictions.jsx',
  'AdminFeatureTips.jsx'
];

for (const file of files) {
  const filePath = path.join('frontend/src/pages', file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Regex to match the button
  // It handles <button ...>...</button> and <motion.button ...>...</motion.button>
  // containing "Back to Dashboard" or "navigate(-1)" or "Go back"
  // We want to remove the button and its surrounding <div className="... mb-8"> if it is the only thing inside it.
  
  // First, let's remove specific known blocks.
  
  // 1. The wrapper div with flex items-center space-x-4 mb-8 around the button
  const regex1 = /<div className="flex items-center space-x-4 mb-8">\s*<motion\.button[^>]*onClick=\{\(\) => navigate\(['"`]\/admin\/dashboard['"`]\)\}[^>]*>[\s\S]*?<\/motion\.button>\s*<\/div>/g;
  content = content.replace(regex1, '');

  // 2. Just the motion.button
  const regex2 = /<motion\.button[^>]*onClick=\{\(\) => navigate\(['"`]\/admin\/dashboard['"`]\)\}[^>]*>[\s\S]*?<\/motion\.button>/g;
  content = content.replace(regex2, '');

  // 3. Just the button with navigate(-1)
  const regex3 = /<button[^>]*onClick=\{\(\) => navigate\(-1\)\}[^>]*>[\s\S]*?<\/button>/g;
  content = content.replace(regex3, '');

  // 4. Just the button with navigate('/admin/dashboard')
  const regex4 = /<button[^>]*onClick=\{\(\) => navigate\(['"`]\/admin\/dashboard['"`]\)\}[^>]*>[\s\S]*?<\/button>/g;
  content = content.replace(regex4, '');

  // 5. The Link with Back to Dashboard
  const regex5 = /<Link[^>]*to=['"`]\/admin\/dashboard['"`][^>]*>[\s\S]*?<\/Link>/g;
  content = content.replace(regex5, '');

  // 6. FaArrowLeft icon with Back to Dashboard text outside button if any
  // Some places might have it as <div><FaArrowLeft/> Back to Dashboard</div>

  fs.writeFileSync(filePath, content);
  console.log(`Processed ${filePath}`);
}
