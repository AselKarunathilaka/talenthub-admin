const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Intern = require('../models/Intern');
const DailyRecord = require('../models/DailyRecord');
const DailyAttendanceLog = require('../models/DailyAttendanceLog');

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
  const nullInterns = await Intern.countDocuments({ 'attendance.checkOutTime': { $in: [null, undefined] } });
  const nullLogs = await DailyAttendanceLog.countDocuments({ checkOutTime: { $in: [null, undefined] } });
  const nullRecords = await DailyRecord.countDocuments({ checkOutTime: { $in: [null, undefined] } });

  console.log(`Null checkOutTimes - Interns: ${nullInterns}, Logs: ${nullLogs}, Records: ${nullRecords}`);
  
  if (nullRecords > 0) {
    const sample = await DailyRecord.findOne({ checkOutTime: { $in: [null, undefined] } });
    console.log('Sample null DailyRecord:', sample);
  }

  process.exit(0);
});
