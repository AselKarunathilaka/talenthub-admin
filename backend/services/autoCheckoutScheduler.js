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
    const today = moment.tz('Asia/Colombo').format('YYYY-MM-DD');
    
    // Skip weekends
    const dayOfWeek = moment.tz('Asia/Colombo').day();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log(`✨ Skipping auto-checkout for ${today} (Weekend).`);
      return;
    }

    // Skip holidays
    const Holiday = require('../models/Holiday');
    const isHoliday = await Holiday.findOne({ date: today });
    if (isHoliday) {
      console.log(`✨ Skipping auto-checkout for ${today} (Holiday: ${isHoliday.name}).`);
      return;
    }

    const autoCheckoutTime = moment.tz(`${today}T16:30:00`, 'Asia/Colombo').toDate();
    const todayStart = moment.tz(today, 'Asia/Colombo').startOf('day').toDate();
    const todayEnd = moment.tz(today, 'Asia/Colombo').endOf('day').toDate();

    console.log(`🔍 Finding interns to auto-checkout for ${today}...`);

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // 1. Find all active DailyRecords for today that haven't been checked out
        const recordsToCheckout = await DailyRecord.find({
          date: today,
          attendance: 'present',
          checkOutTime: null
        }).session(session);

        if (recordsToCheckout.length === 0) {
          console.log('✨ No interns need auto-checkout today.');
          return;
        }

        const internIds = recordsToCheckout.map(r => r.internId);
        
        console.log(`⚙️ Auto-checking out ${internIds.length} interns...`);

        // 2. Update DailyRecords
        await DailyRecord.updateMany(
          {
            date: today,
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

        // 3. Update Intern attendance arrays to reflect checkOutTime
        await Intern.updateMany(
          {
            _id: { $in: internIds },
            'attendance': {
              $elemMatch: {
                type: { $in: ['daily_qr', 'face'] },
                status: 'Present',
                date: { $gte: todayStart, $lte: todayEnd },
                checkOutTime: { $exists: false }
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
                'record.type': { $in: ['daily_qr', 'face'] },
                'record.status': 'Present',
                'record.date': { $gte: todayStart, $lte: todayEnd },
                'record.checkOutTime': { $exists: false }
              }
            ]
          }
        );

        console.log(`✅ Successfully auto-checked out ${internIds.length} interns.`);
      });
    } finally {
      await session.endSession();
    }
  }
}

module.exports = AutoCheckoutScheduler;
