const cron = require('node-cron');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const DailyRecord = require('../models/DailyRecord');
const Intern = require('../models/Intern');
const DailyAttendanceLog = require('../models/DailyAttendanceLog');

class AutoCheckoutScheduler {
  static init() {
    console.log('🕐 Initializing auto-checkout scheduler...');

    // Run every day at 16:30 (4:30 PM) Asia/Colombo
    const cronExpression = '30 16 * * *';

    cron.schedule(cronExpression, async () => {
      console.log(`\n⏰ Auto-checkout triggered at ${new Date().toLocaleString()} (server time)`);
      try {
        await this.runAutoCheckout();
      } catch (error) {
        console.error('❌ Auto-checkout scheduler error:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Colombo'
    });

    console.log('✅ Auto-checkout scheduler initialized (every day 16:30 Asia/Colombo).');
  }

  static async runAutoCheckout() {
    const now = moment.tz('Asia/Colombo');
    const todayStr = now.format('YYYY-MM-DD');
    const isPastTodayCheckoutTime = now.hours() > 16 || (now.hours() === 16 && now.minutes() >= 30);

    console.log(`🔍 Finding interns to auto-checkout...`);

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // 1. Logbook attendance: check-in and check-out MUST be the exact same time.
        // Update any logbook entries (type: 'daily') in Intern.attendance that have checkOutTime: null
        const internsWithLogbookNullCheckout = await Intern.find({
          'attendance': {
            $elemMatch: {
              type: 'daily',
              status: 'Present',
              checkOutTime: null
            }
          }
        }).session(session);

        for (const intern of internsWithLogbookNullCheckout) {
          let modified = false;
          for (const record of intern.attendance) {
            if (record.type === 'daily' && !record.checkOutTime && record.timeMarked) {
              record.checkOutTime = record.timeMarked;
              modified = true;
            }
          }
          if (modified) {
            await intern.save({ session });
          }
        }

        // Also update logbook DailyAttendanceLogs with checkOutTime = attendanceTime
        await DailyAttendanceLog.updateMany(
          {
            markType: 'daily',
            status: 'present',
            $or: [{ checkOutTime: null }, { checkOutTime: { $exists: false } }]
          },
          [
            { $set: { checkOutTime: '$attendanceTime', isCheckout: true } }
          ],
          { session }
        );

        // 2. Physical Attendance: Face, QR, Manual (others)
        // If not checked out by 4:30 PM (or past date), auto checkout at 16:30 Asia/Colombo.
        const PHYSICAL_TYPES = ['daily_qr', 'face', 'manual', 'manual_daily', 'qr'];

        const internsWithPhysicalNullCheckout = await Intern.find({
          'attendance': {
            $elemMatch: {
              type: { $in: PHYSICAL_TYPES },
              status: 'Present',
              checkOutTime: null
            }
          }
        }).session(session);

        const datesToProcessSet = new Set();

        for (const intern of internsWithPhysicalNullCheckout) {
          for (const record of intern.attendance) {
            if (PHYSICAL_TYPES.includes(record.type) && record.status === 'Present' && !record.checkOutTime) {
              const recordDateStr = moment(record.date || record.timeMarked).tz('Asia/Colombo').format('YYYY-MM-DD');
              if (recordDateStr > todayStr) continue;
              if (recordDateStr === todayStr && !isPastTodayCheckoutTime) continue;
              datesToProcessSet.add(recordDateStr);
            }
          }
        }

        // Also check DailyRecord dates that need auto-checkout
        const recordsToCheckout = await DailyRecord.find({
          attendance: 'present',
          checkOutTime: null
        }).session(session);

        for (const record of recordsToCheckout) {
          if (record.date > todayStr) continue;
          if (record.date === todayStr && !isPastTodayCheckoutTime) continue;
          datesToProcessSet.add(record.date);
        }

        const datesToProcess = Array.from(datesToProcessSet);

        if (datesToProcess.length === 0) {
          console.log('✨ No eligible physical attendance entries need auto-checkout at this time.');
          return;
        }

        for (const date of datesToProcess) {
          const autoCheckoutTime = moment.tz(`${date}T16:30:00`, 'Asia/Colombo').toDate();
          const dayStart = moment.tz(date, 'Asia/Colombo').startOf('day').toDate();
          const dayEnd = moment.tz(date, 'Asia/Colombo').endOf('day').toDate();

          // Auto checkout physical attendance in Intern.attendance
          await Intern.updateMany(
            {
              'attendance': {
                $elemMatch: {
                  type: { $in: PHYSICAL_TYPES },
                  status: 'Present',
                  date: { $gte: dayStart, $lte: dayEnd },
                  checkOutTime: null
                }
              }
            },
            {
              $set: { 'attendance.$[record].checkOutTime': autoCheckoutTime }
            },
            {
              session,
              arrayFilters: [
                {
                  'record.type': { $in: PHYSICAL_TYPES },
                  'record.status': 'Present',
                  'record.date': { $gte: dayStart, $lte: dayEnd },
                  'record.checkOutTime': null
                }
              ]
            }
          );

          // Auto checkout physical DailyAttendanceLogs
          await DailyAttendanceLog.updateMany(
            {
              date: date,
              markType: { $in: ['daily_qr', 'face', 'manual', 'manual_daily', 'system'] },
              status: 'present',
              checkOutTime: null
            },
            {
              $set: {
                checkOutTime: autoCheckoutTime,
                isCheckout: true
              }
            },
            { session }
          );

          // Update DailyRecords for this date
          await DailyRecord.updateMany(
            {
              date: date,
              attendance: 'present',
              checkOutTime: null
            },
            {
              $set: {
                checkOutTime: autoCheckoutTime,
                isAutoCheckout: true
              }
            },
            { session }
          );
        }

        console.log(`✅ Successfully auto-checked out eligible interns across ${datesToProcess.length} days.`);
      });
    } finally {
      await session.endSession();
    }
  }
}

module.exports = AutoCheckoutScheduler;
