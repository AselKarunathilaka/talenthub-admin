const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');

// Import Application Models
const Intern = require('../models/Intern');
const User = require('../models/User');
const Staff = require('../models/Staff');
const DailyRecord = require('../models/DailyRecord');
const DailyAttendanceLog = require('../models/DailyAttendanceLog');
const LeaveRequest = require('../models/LeaveRequest');
const Project = require('../models/Project');
const Holiday = require('../models/Holiday');
const AttendanceSetting = require('../models/AttendanceSetting');
const SecuritySetting = require('../models/SecuritySetting');

async function testAppRead() {
  console.log("================================================================================");
  console.log("     VERIFYING APPLICATION READ ON TESTING SERVER MONGODB");
  console.log("================================================================================");

  console.log("Checking MONGO_URI in environment...");
  const uri = process.env.MONGO_URI;
  console.log("MONGO_URI:", uri.replace(/:[^:]*@/, ':****@'));

  if (!uri.includes("124.43.216.137") || !uri.includes("talenthub")) {
    throw new Error("FAIL: Environment MONGO_URI is not pointing to Testing MongoDB!");
  }
  console.log(" PASS: Confirmed MONGO_URI is the Testing Server MongoDB URI.");

  console.log("\nConnecting to Testing MongoDB via Mongoose...");
  await mongoose.connect(uri);
  console.log(" PASS: Mongoose connected successfully!");
  console.log("Connected Database Name:", mongoose.connection.name);

  if (mongoose.connection.name !== "talenthub") {
    throw new Error(`FAIL: Connected to database '${mongoose.connection.name}', expected 'talenthub'`);
  }

  console.log("\nTesting Application Models reading cloned data:");

  // 1. Intern model
  const internCount = await Intern.countDocuments();
  const sampleInterns = await Intern.find({}).limit(2).select('Trainee_ID name email batch');
  console.log(`- Intern Model: ${internCount} documents found.`);
  console.log(`  Sample:`, sampleInterns.map(i => ({ id: i._id, Trainee_ID: i.Trainee_ID, name: i.name })));

  // 2. User model
  const userCount = await User.countDocuments();
  const sampleUsers = await User.find({}).limit(2).select('email role status');
  console.log(`- User Model: ${userCount} documents found.`);
  console.log(`  Sample:`, sampleUsers.map(u => ({ id: u._id, email: u.email, role: u.role })));

  // 3. Staff model
  const staffCount = await Staff.countDocuments();
  const sampleStaff = await Staff.find({}).limit(2).select('email role status');
  console.log(`- Staff Model: ${staffCount} documents found.`);
  console.log(`  Sample:`, sampleStaff.map(s => ({ id: s._id, email: s.email, role: s.role })));

  // 4. DailyRecord model
  const dailyRecordCount = await DailyRecord.countDocuments();
  const sampleDailyRecord = await DailyRecord.findOne().select('traineeId date');
  console.log(`- DailyRecord Model: ${dailyRecordCount} documents found.`);
  console.log(`  Sample:`, sampleDailyRecord ? { id: sampleDailyRecord._id, traineeId: sampleDailyRecord.traineeId } : 'none');

  // 5. DailyAttendanceLog model
  const dailyAttendanceCount = await DailyAttendanceLog.countDocuments();
  const sampleDailyAttendance = await DailyAttendanceLog.findOne().select('traineeId date');
  console.log(`- DailyAttendanceLog Model: ${dailyAttendanceCount} documents found.`);
  console.log(`  Sample:`, sampleDailyAttendance ? { id: sampleDailyAttendance._id, traineeId: sampleDailyAttendance.traineeId } : 'none');

  // 6. LeaveRequest model
  const leaveCount = await LeaveRequest.countDocuments();
  const sampleLeave = await LeaveRequest.findOne().select('requestType status');
  console.log(`- LeaveRequest Model: ${leaveCount} documents found.`);
  console.log(`  Sample:`, sampleLeave ? { id: sampleLeave._id, requestType: sampleLeave.requestType, status: sampleLeave.status } : 'none');

  // 7. Project model
  const projectCount = await Project.countDocuments();
  console.log(`- Project Model: ${projectCount} documents found.`);

  // 8. Holiday model
  const holidayCount = await Holiday.countDocuments();
  console.log(`- Holiday Model: ${holidayCount} documents found.`);

  // 9. AttendanceSetting model
  const setting = await AttendanceSetting.findOne();
  console.log(`- AttendanceSetting Model:`, setting ? { id: setting._id, key: setting.key, sltLocationRequired: setting.sltLocationRequired } : 'none');

  // 10. SecuritySetting model
  const security = await SecuritySetting.findOne();
  console.log(`- SecuritySetting Model:`, security ? { id: security._id, functionName: security.functionName } : 'none');

  await mongoose.disconnect();
  console.log("\nMongoose disconnected.");
  console.log("\n================================================================================");
  console.log(" RESULT: Application can connect and read all cloned data correctly!");
  console.log("================================================================================");
}

testAppRead().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
