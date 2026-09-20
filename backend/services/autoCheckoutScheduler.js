const cron = require('node-cron');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const DailyRecord = require('../models/DailyRecord');
const Intern = require('../models/Intern');

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
        // 1. Find all active DailyRecords that haven't been checked out
        const recordsToCheckout = await DailyRecord.find({
          attendance: 'present',
          checkOutTime: null
        }).session(session);

        if (recordsToCheckout.length === 0) {
          console.log('✨ No interns need auto-checkout.');
          return;
        }

        const recordsByDate = {};
        for (const record of recordsToCheckout) {
          // If the record is from a future date, skip it
          if (record.date > todayStr) continue;
          
          // If the record is from today, skip if we haven't reached 16:30 yet
          if (record.date === todayStr && !isPastTodayCheckoutTime) continue;

          if (!recordsByDate[record.date]) {
            recordsByDate[record.date] = [];
          }
          recordsByDate[record.date].push(record);
        }

        const datesToProcess = Object.keys(recordsByDate);
        if (datesToProcess.length === 0) {
          console.log('✨ No eligible interns need auto-checkout at this time.');
          return;
        }

        let totalCheckedOut = 0;

        for (const date of datesToProcess) {
          const recordsForDate = recordsByDate[date];
          const internIds = recordsForDate.map(r => r.internId);
          
          console.log(`⚙️ Auto-checking out ${internIds.length} interns for date ${date}...`);

          const autoCheckoutTime = moment.tz(`${date}T16:30:00`, 'Asia/Colombo').toDate();
          const dayStart = moment.tz(date, 'Asia/Colombo').startOf('day').toDate();
          const dayEnd = moment.tz(date, 'Asia/Colombo').endOf('day').toDate();

          // 2. Update DailyRecords for this date
          await DailyRecord.updateMany(
            {
              date: date,
              attendance: 'present',
              checkOutTime: null,
              internId: { $in: internIds }
            },
            {
              $set: {
                checkOutTime: autoCheckoutTime,
                isAutoCheckout: true
              }
            },
            { session }
          );

          // 3. Update Intern attendance arrays to reflect checkOutTime
          await Intern.updateMany(
            {
              _id: { $in: internIds },
              'attendance': {
                $elemMatch: {
                  type: { $in: ['daily_qr', 'face', 'manual', 'manual_daily', 'daily'] },
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
                  'record.type': { $in: ['daily_qr', 'face', 'manual', 'manual_daily', 'daily'] },
                  'record.status': 'Present',
                  'record.date': { $gte: dayStart, $lte: dayEnd },
                  'record.checkOutTime': null
                }
              ]
            }
          );
          
          totalCheckedOut += internIds.length;
        }

        console.log(`✅ Successfully auto-checked out ${totalCheckedOut} interns across ${datesToProcess.length} days.`);
      });
    } finally {
      await session.endSession();
    }
  }
}

module.exports = AutoCheckoutScheduler;
