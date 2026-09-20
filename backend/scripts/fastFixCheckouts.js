const mongoose = require('mongoose');
const dotenv = require('dotenv');
const moment = require('moment-timezone');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Intern = require('../models/Intern');
const DailyRecord = require('../models/DailyRecord');
const DailyAttendanceLog = require('../models/DailyAttendanceLog');

const TZ = "Asia/Colombo";

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB');

  const drResult = await DailyRecord.updateMany(
    { checkOutTime: { $in: [null, undefined] } },
    [
      { $set: { checkOutTime: { $ifNull: ["$attendanceTime", "$createdAt"] } } }
    ]
  );
  console.log(`Updated ${drResult.modifiedCount} DailyRecords (Logbooks) with checkOutTime = attendanceTime`);

  let updatedInternsCount = 0;
  const interns = await Intern.find({ 'attendance.checkOutTime': { $in: [null, undefined] } });
  
  for (const intern of interns) {
    let modified = false;
    for (const record of intern.attendance) {
      if (!record.checkOutTime && !['meeting', 'manual_meeting'].includes(record.type)) {
        if (record.type === 'daily') {
          record.checkOutTime = record.timeMarked || record.date;
        } else {
          const dateStr = moment(record.date).tz(TZ).format("YYYY-MM-DD");
          record.checkOutTime = moment.tz(`${dateStr}T16:30:00`, TZ).toDate();
        }
        modified = true;
      }
    }
    if (modified) {
      await intern.save();
      updatedInternsCount++;
    }
  }
  console.log(`Updated ${updatedInternsCount} Interns`);

  const logbookLogsResult = await DailyAttendanceLog.updateMany(
    { markType: 'daily', checkOutTime: { $in: [null, undefined] } },
    [ { $set: { checkOutTime: "$attendanceTime", isCheckout: true } } ]
  );
  console.log(`Updated ${logbookLogsResult.modifiedCount} DailyAttendanceLog (Logbooks)`);

  const otherLogs = await DailyAttendanceLog.find({
    markType: { $nin: ['daily', 'meeting', 'manual_meeting'] },
    checkOutTime: { $in: [null, undefined] }
  });
  let updatedOtherLogsCount = 0;
  for (const log of otherLogs) {
    const dateStr = moment(log.attendanceTime || log.createdAt).tz(TZ).format("YYYY-MM-DD");
    log.checkOutTime = moment.tz(`${dateStr}T16:30:00`, TZ).toDate();
    log.isCheckout = true;
    await log.save();
    updatedOtherLogsCount++;
  }
  console.log(`Updated ${updatedOtherLogsCount} DailyAttendanceLog (Others to 16:30)`);

  console.log('Done');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
