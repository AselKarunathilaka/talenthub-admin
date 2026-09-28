const mongoose = require('mongoose');
const moment = require('moment-timezone');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Intern = require('../models/Intern');
const DailyRecord = require('../models/DailyRecord');
const DailyAttendanceLog = require('../models/DailyAttendanceLog');
const FaceAttendanceLog = require('../models/FaceAttendanceLog');
const { getColomboDateKey } = require('../utils/attendanceHistory');

const TZ = 'Asia/Colombo';

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
  console.log('🔄 Reconciling database attendance records...');

  const now = moment.tz(TZ);
  const todayStr = now.format('YYYY-MM-DD');
  const isPast1630Today = now.hours() > 16 || (now.hours() === 16 && now.minutes() >= 30);
  const PHYSICAL_TYPES = ['daily_qr', 'face', 'manual', 'manual_daily', 'qr'];

  // 1. Intern.attendance records
  const allInterns = await Intern.find({ 'attendance.0': { $exists: true } });
  let updatedInterns = 0;

  for (const intern of allInterns) {
    let modified = false;
    for (const record of intern.attendance) {
      const type = (record.type || '').toLowerCase();
      const recordDateStr = getColomboDateKey(record.date || record.timeMarked);

      if (type === 'daily') {
        // Logbook: check-in and check-out MUST be the exact same time
        if (record.timeMarked) {
          const expectedTime = new Date(record.timeMarked);
          if (!record.checkOutTime || new Date(record.checkOutTime).getTime() !== expectedTime.getTime()) {
            record.checkOutTime = expectedTime;
            modified = true;
          }
        }
      } else if (PHYSICAL_TYPES.includes(type)) {
        // Physical attendance
        const isEligible = recordDateStr < todayStr || (recordDateStr === todayStr && isPast1630Today);
        if (isEligible) {
          const inTime = record.timeMarked ? new Date(record.timeMarked) : new Date(record.date);
          const outTime = record.checkOutTime ? new Date(record.checkOutTime) : null;
          const isSameAsIn = inTime && outTime && Math.abs(outTime.getTime() - inTime.getTime()) <= 2 * 60 * 1000;

          if (!outTime || isSameAsIn) {
            record.checkOutTime = moment.tz(`${recordDateStr}T16:30:00`, TZ).toDate();
            modified = true;
          }
        }
      }
    }

    if (modified) {
      await intern.save();
      updatedInterns++;
    }
  }
  console.log(`✅ Reconciled ${updatedInterns} Intern attendance documents.`);

  // 2. DailyAttendanceLog records (Fast bulk update)
  // Logbook: checkOutTime = attendanceTime
  const logbookRes = await DailyAttendanceLog.updateMany(
    { markType: 'daily' },
    [{ $set: { checkOutTime: '$attendanceTime', isCheckout: true } }]
  );
  console.log(`✅ Reconciled ${logbookRes.modifiedCount} logbook DailyAttendanceLog documents.`);

  // Physical DailyAttendanceLogs:
  const distinctPhysicalDates = await DailyAttendanceLog.distinct('date', {
    markType: { $in: ['daily_qr', 'face', 'manual', 'manual_daily', 'system'] }
  });

  let updatedPhysicalLogs = 0;
  for (const d of distinctPhysicalDates) {
    if (d < todayStr || (d === todayStr && isPast1630Today)) {
      const outDate = moment.tz(`${d}T16:30:00`, TZ).toDate();
      const res = await DailyAttendanceLog.updateMany(
        {
          date: d,
          markType: { $in: ['daily_qr', 'face', 'manual', 'manual_daily', 'system'] },
          $or: [
            { checkOutTime: null },
            { checkOutTime: { $exists: false } },
            { $expr: { $lte: [{ $abs: { $subtract: ['$checkOutTime', '$attendanceTime'] } }, 120000] } }
          ]
        },
        { $set: { checkOutTime: outDate, isCheckout: true } }
      );
      updatedPhysicalLogs += res.modifiedCount;
    }
  }
  console.log(`✅ Reconciled ${updatedPhysicalLogs} physical DailyAttendanceLog documents.`);

  // 3. DailyRecord (Fast bulkWrite)
  const allFaceLogs = await FaceAttendanceLog.find({ status: 'present', method: 'face', qrBackupUsed: { $ne: true } })
    .select('internId attendanceDate attendanceTime')
    .lean();
  const faceKeys = new Set(allFaceLogs.map(f => `${f.internId}::${getColomboDateKey(f.attendanceDate || f.attendanceTime)}`));

  const physicalInternKeys = new Set();
  for (const intern of allInterns) {
    for (const record of intern.attendance || []) {
      if (PHYSICAL_TYPES.includes((record.type || '').toLowerCase())) {
        const dStr = getColomboDateKey(record.date || record.timeMarked);
        physicalInternKeys.add(`${intern._id}::${dStr}`);
      }
    }
  }

  const allDailyRecords = await DailyRecord.find({}).lean();
  const bulkOps = [];

  for (const rec of allDailyRecords) {
    const dStr = rec.date;
    const isEligible = dStr < todayStr || (dStr === todayStr && isPast1630Today);
    if (!isEligible) continue;

    const internKey = `${rec.internId}::${dStr}`;
    const hasPhysicalScan = faceKeys.has(internKey) || physicalInternKeys.has(internKey);

    let expectedOut;
    if (hasPhysicalScan) {
      expectedOut = moment.tz(`${dStr}T16:30:00`, TZ).toDate();
    } else {
      expectedOut = rec.attendanceTime ? new Date(rec.attendanceTime) : moment.tz(`${dStr}T16:30:00`, TZ).toDate();
    }

    if (!rec.checkOutTime || Math.abs(new Date(rec.checkOutTime).getTime() - expectedOut.getTime()) > 60000) {
      bulkOps.push({
        updateOne: {
          filter: { _id: rec._id },
          update: { $set: { checkOutTime: expectedOut } }
        }
      });
    }
  }

  if (bulkOps.length > 0) {
    for (let i = 0; i < bulkOps.length; i += 1000) {
      await DailyRecord.bulkWrite(bulkOps.slice(i, i + 1000));
    }
  }
  console.log(`✅ Reconciled ${bulkOps.length} DailyRecord documents.`);

  console.log('✨ All database attendance records reconciled successfully!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Reconcile error:', err);
  process.exit(1);
});
