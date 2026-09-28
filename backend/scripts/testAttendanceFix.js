const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const moment = require('moment-timezone');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Intern = require('../models/Intern');
const DailyRecord = require('../models/DailyRecord');
const FaceAttendanceLog = require('../models/FaceAttendanceLog');
const DailyAttendanceLog = require('../models/DailyAttendanceLog');
const { getColomboDateKey, getDailyTypePriority } = require('../utils/attendanceHistory');

const getDateKey = (date) => getColomboDateKey(date);

const formatColomboTime = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Colombo',
  });
};

const resolveAttendanceTimes = (rawDate, rawType, checkInInput, checkOutInput) => {
  const dateStr = getDateKey(rawDate);
  const isLogbook = (rawType || '').toLowerCase() === 'daily';
  const inTime = checkInInput ? new Date(checkInInput) : null;
  let outTime = checkOutInput ? new Date(checkOutInput) : null;

  if (isLogbook) {
    return {
      checkInTime: inTime,
      checkOutTime: inTime,
    };
  }

  const nowColombo = moment.tz('Asia/Colombo');
  const todayColomboStr = nowColombo.format('YYYY-MM-DD');
  const isPast430Today =
    nowColombo.hours() > 16 ||
    (nowColombo.hours() === 16 && nowColombo.minutes() >= 30);

  const isSameAsIn =
    inTime &&
    outTime &&
    Math.abs(outTime.getTime() - inTime.getTime()) <= 2 * 60 * 1000;

  const needsAutoCheckout = !outTime || isSameAsIn;

  if (needsAutoCheckout) {
    if (dateStr < todayColomboStr || (dateStr === todayColomboStr && isPast430Today)) {
      outTime = moment.tz(dateStr + 'T16:30:00', 'Asia/Colombo').toDate();
    } else {
      outTime = null;
    }
  }

  return {
    checkInTime: inTime,
    checkOutTime: outTime,
  };
};

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
  const intern = await Intern.findOne({ Trainee_ID: '3722' });

  const idOr = [
    { internId: intern._id },
    { traineeId: intern.Trainee_ID }
  ];

  const [dailyRecords, successfulFaceLogs, standaloneDailyLogs] = await Promise.all([
    DailyRecord.find({ $or: idOr }).sort({ date: -1 }),
    FaceAttendanceLog.find({
      $or: idOr,
      status: 'present',
      method: 'face',
      qrBackupUsed: { $ne: true },
    }).lean(),
    DailyAttendanceLog.find({ $or: idOr }).sort({ date: -1 }).lean().catch(() => []),
  ]);

  const faceDates = new Set(
    successfulFaceLogs.map((log) => getDateKey(log.attendanceDate || log.attendanceTime))
  );

  const dailyAttendance = [];
  const dailyMethodByDate = new Map();

  const DAILY_ATTENDANCE_TYPES = new Set(['daily', 'daily_qr', 'face', 'manual_daily', 'manual', 'qr']);

  (intern.attendance || []).forEach((entry) => {
    const type = (entry.type || '').toLowerCase();
    if (DAILY_ATTENDANCE_TYPES.has(type)) {
      const markedAt = entry.timeMarked || entry.date;
      const dateKey = getDateKey(entry.date);
      const current = dailyMethodByDate.get(dateKey);
      const entryPriority = getDailyTypePriority(type);
      const currentPriority = current ? getDailyTypePriority(current.rawType) : 0;

      if (!current || entryPriority > currentPriority) {
        dailyMethodByDate.set(dateKey, {
          method: type === 'face' ? 'face recognition' : type === 'daily_qr' ? 'qr' : type,
          rawType: type,
          markedAt,
          checkInTime: entry.timeMarked || entry.date,
          checkOutTime: entry.checkOutTime || null,
        });
      }
    }
  });

  // Step 4: DailyRecord
  dailyRecords.forEach((record) => {
    const dateKey = getDateKey(record.date);
    const matchingMethodInfo = dailyMethodByDate.get(dateKey);
    const rawType = matchingMethodInfo?.rawType || 'daily';

    const attendanceTime = record.attendanceTime
      ? new Date(record.attendanceTime)
      : matchingMethodInfo?.checkInTime
        ? new Date(matchingMethodInfo.checkInTime)
        : null;

    const checkOutTime = matchingMethodInfo?.checkOutTime
      ? new Date(matchingMethodInfo.checkOutTime)
      : record.checkOutTime
        ? new Date(record.checkOutTime)
        : null;

    const { checkInTime: resolvedIn, checkOutTime: resolvedOut } =
      resolveAttendanceTimes(dateKey, rawType, attendanceTime, checkOutTime);

    dailyAttendance.push({
      date: record.date,
      rawType,
      method: matchingMethodInfo?.method || rawType,
      time: formatColomboTime(resolvedIn),
      checkOutTime: formatColomboTime(resolvedOut),
    });
  });

  // Step 6: Fallback for dates in intern.attendance not covered by DailyRecord
  const coveredDates = new Set(dailyAttendance.map((d) => getDateKey(d.date)));

  (intern.attendance || []).forEach((entry) => {
    const type = (entry.type || '').toLowerCase();
    if (!DAILY_ATTENDANCE_TYPES.has(type)) return;
    const entryDate = entry.date ? new Date(entry.date) : null;
    if (!entryDate || isNaN(entryDate.getTime())) return;
    const dayKey = getDateKey(entryDate);
    if (coveredDates.has(dayKey)) return;

    const isFaceScan = faceDates.has(dayKey);
    const rawType = isFaceScan ? 'face' : type;
    const rawCheckIn = entry.timeMarked || entryDate;
    const rawCheckOut = entry.checkOutTime || null;

    const { checkInTime: resolvedIn, checkOutTime: resolvedOut } =
      resolveAttendanceTimes(dayKey, rawType, rawCheckIn, rawCheckOut);

    dailyAttendance.push({
      date: dayKey,
      rawType,
      method: isFaceScan ? 'face recognition' : type,
      time: formatColomboTime(resolvedIn),
      checkOutTime: formatColomboTime(resolvedOut),
    });
    coveredDates.add(dayKey);
  });

  dailyAttendance.sort((a, b) => new Date(b.date) - new Date(a.date));

  console.log('RESULTS FOR TOP 10 ENTRIES:');
  dailyAttendance.slice(0, 10).forEach(d => {
    console.log(d.date, '| IN:', d.time, '| OUT:', d.checkOutTime, '| METHOD:', d.method, '| TYPE:', d.rawType);
  });

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
