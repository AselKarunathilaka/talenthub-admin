const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Intern = require('../models/Intern');
const DailyRecord = require('../models/DailyRecord');
const DailyAttendanceLog = require('../models/DailyAttendanceLog');

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB');

  let updatedInternsCount = 0;
  
  const interns1 = await Intern.find({ 'attendance.type': 'daily', 'attendance.checkOutTime': { $exists: false } });
  const interns2 = await Intern.find({ 'attendance.type': 'daily', 'attendance.checkOutTime': null });
  
  const allInternsToUpdate = [...new Set([...interns1, ...interns2].map(i => i._id.toString()))];
  
  for (const internId of allInternsToUpdate) {
    const intern = await Intern.findById(internId);
    let modified = false;
    for (const record of intern.attendance) {
      if (record.type === 'daily' && !record.checkOutTime && record.timeMarked) {
        record.checkOutTime = record.timeMarked;
        modified = true;
      }
    }
    if (modified) {
      await intern.save();
      updatedInternsCount++;
    }
  }

  const logUpdateResult = await DailyAttendanceLog.updateMany(
    { markType: 'daily', $or: [{ checkOutTime: null }, { checkOutTime: { $exists: false } }] },
    [
      { $set: { checkOutTime: '$attendanceTime', isCheckout: true } }
    ]
  );
  
  let updatedDailyRecords = 0;
  const logs = await DailyAttendanceLog.find({ markType: 'daily' });
  for (const log of logs) {
    if (log.attendanceTime) {
      const res = await DailyRecord.updateOne(
        { internId: log.internId, date: log.date, $or: [{ checkOutTime: null }, { checkOutTime: { $exists: false } }] },
        { $set: { checkOutTime: log.attendanceTime } }
      );
      updatedDailyRecords += res.modifiedCount;
    }
  }

  console.log(`Updated ${updatedInternsCount} Intern documents.`);
  console.log(`Updated ${logUpdateResult.modifiedCount} DailyAttendanceLog documents.`);
  console.log(`Updated ${updatedDailyRecords} DailyRecord documents.`);
  console.log('Done');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
