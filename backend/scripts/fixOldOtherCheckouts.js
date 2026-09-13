const mongoose = require('mongoose');
const moment = require('moment-timezone');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Intern = require('../models/Intern');
const DailyRecord = require('../models/DailyRecord');
const DailyAttendanceLog = require('../models/DailyAttendanceLog');

const TZ = "Asia/Colombo";

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB');

  let updatedInternsCount = 0;
  
  const interns1 = await Intern.find({ 'attendance.checkOutTime': { $exists: false } });
  const interns2 = await Intern.find({ 'attendance.checkOutTime': null });
  
  const allInternsToUpdate = [...new Set([...interns1, ...interns2].map(i => i._id.toString()))];
  
  for (const internId of allInternsToUpdate) {
    const intern = await Intern.findById(internId);
    let modified = false;
    for (const record of intern.attendance) {
      if (record.type && !['meeting', 'manual_meeting'].includes(record.type) && !record.checkOutTime) {
        const dateStr = moment(record.date).tz(TZ).format("YYYY-MM-DD");
        record.checkOutTime = moment.tz(`${dateStr}T16:30:00`, TZ).toDate();
        modified = true;
      }
    }
    if (modified) {
      await intern.save();
      updatedInternsCount++;
    }
  }

  // Update DailyAttendanceLog
  const logs = await DailyAttendanceLog.find({ 
    $or: [{ checkOutTime: null }, { checkOutTime: { $exists: false } }],
    markType: { $nin: ['meeting', 'manual_meeting'] }
  });
  
  let updatedLogs = 0;
  for (const log of logs) {
    const dateStr = log.date || moment(log.attendanceTime).tz(TZ).format("YYYY-MM-DD");
    log.checkOutTime = moment.tz(`${dateStr}T16:30:00`, TZ).toDate();
    log.isCheckout = true;
    await log.save();
    updatedLogs++;
  }

  // Update DailyRecords
  const records = await DailyRecord.find({ 
    $or: [{ checkOutTime: null }, { checkOutTime: { $exists: false } }]
  });
  
  let updatedDailyRecords = 0;
  for (const rec of records) {
    if (rec.date) {
      rec.checkOutTime = moment.tz(`${rec.date}T16:30:00`, TZ).toDate();
      await rec.save();
      updatedDailyRecords++;
    }
  }

  console.log(`Updated ${updatedInternsCount} Intern documents.`);
  console.log(`Updated ${updatedLogs} DailyAttendanceLog documents.`);
  console.log(`Updated ${updatedDailyRecords} DailyRecord documents.`);
  console.log('Done');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
