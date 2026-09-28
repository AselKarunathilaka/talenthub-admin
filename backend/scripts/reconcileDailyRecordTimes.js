/**
 * reconcileDailyRecordTimes.js
 *
 * Fast bulk reconciliation for DailyRecord only (Intern.attendance and
 * DailyAttendanceLog are already reconciled by the previous script run).
 *
 * Rules:
 *  - DailyRecords where a physical scan exists for that intern+date
 *    → checkOutTime = 16:30 Asia/Colombo  (if not already exactly that)
 *  - DailyRecords where only a logbook submission exists (no physical scan)
 *    → checkOutTime = attendanceTime       (same as check-in)
 *
 * We determine "physical scan exists" by joining with FaceAttendanceLog and
 * the Intern.attendance array (for QR / manual types).
 */
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const DailyRecord = require('../models/DailyRecord');
const FaceAttendanceLog = require('../models/FaceAttendanceLog');
const Intern = require('../models/Intern');
const { getColomboDateKey } = require('../utils/attendanceHistory');

const TZ = 'Asia/Colombo';
const PHYSICAL_TYPES = ['daily_qr', 'face', 'manual', 'manual_daily', 'qr'];

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
  console.log('🔄 Reconciling DailyRecord checkOutTime values...');

  const now = moment.tz(TZ);
  const todayStr = now.format('YYYY-MM-DD');
  const isPast1630Today = now.hours() > 16 || (now.hours() === 16 && now.minutes() >= 30);

  // Build set of (internId::date) keys that have a physical scan
  console.log('  Loading face logs...');
  const faceLogs = await FaceAttendanceLog
    .find({ status: 'present', method: 'face', qrBackupUsed: { $ne: true } })
    .select('internId attendanceDate attendanceTime')
    .lean();

  const physicalKeys = new Set(
    faceLogs.map(f => `${f.internId}::${getColomboDateKey(f.attendanceDate || f.attendanceTime)}`)
  );
  console.log(`  Face log keys: ${physicalKeys.size}`);

  // Also pull QR/manual entries from Intern.attendance
  console.log('  Loading intern attendance for physical types...');
  const internsWithPhysical = await Intern
    .find({ 'attendance.type': { $in: PHYSICAL_TYPES } })
    .select('_id attendance')
    .lean();

  for (const intern of internsWithPhysical) {
    for (const rec of intern.attendance || []) {
      if (PHYSICAL_TYPES.includes((rec.type || '').toLowerCase())) {
        const dStr = getColomboDateKey(rec.date || rec.timeMarked);
        physicalKeys.add(`${intern._id}::${dStr}`);
      }
    }
  }
  console.log(`  Total physical keys: ${physicalKeys.size}`);

  // Get distinct eligible dates (past dates + today if past 16:30)
  let eligibleDates = await DailyRecord.distinct('date');
  eligibleDates = eligibleDates.filter(d => {
    if (d > todayStr) return false;
    if (d === todayStr && !isPast1630Today) return false;
    return true;
  });
  console.log(`  Eligible dates to process: ${eligibleDates.length}`);

  let physicalUpdated = 0;
  let logbookUpdated = 0;

  // Process date by date
  for (const date of eligibleDates) {
    const autoCheckout = moment.tz(`${date}T16:30:00`, TZ).toDate();

    // 1. Physical scan records for this date → 16:30
    const physicalInternIds = [];
    for (const [key] of physicalKeys.entries()) {
      const [iid, dKey] = key.split('::');
      if (dKey === date) physicalInternIds.push(mongoose.Types.ObjectId.createFromHexString(iid));
    }

    if (physicalInternIds.length > 0) {
      const res1 = await DailyRecord.updateMany(
        {
          date,
          internId: { $in: physicalInternIds },
          $or: [
            { checkOutTime: null },
            { checkOutTime: { $ne: autoCheckout } },
          ],
        },
        { $set: { checkOutTime: autoCheckout } }
      );
      physicalUpdated += res1.modifiedCount;
    }

    // 2. Logbook-only records for this date → attendanceTime (same as check-in)
    //    These are DailyRecords whose internId is NOT in physicalInternIds
    const res2 = await DailyRecord.updateMany(
      {
        date,
        internId: physicalInternIds.length > 0 ? { $nin: physicalInternIds } : { $exists: true },
        $expr: {
          $or: [
            { $eq: ['$checkOutTime', null] },
            { $ne: ['$checkOutTime', '$attendanceTime'] },
          ],
        },
      },
      [{ $set: { checkOutTime: '$attendanceTime' } }]
    );
    logbookUpdated += res2.modifiedCount;
  }

  console.log(`✅ Updated ${physicalUpdated} physical DailyRecord docs → 04:30 PM`);
  console.log(`✅ Updated ${logbookUpdated} logbook DailyRecord docs → same as check-in`);
  console.log('✨ DailyRecord reconciliation complete!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
