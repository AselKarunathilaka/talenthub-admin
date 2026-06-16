const cron = require('node-cron');
const DailyReminderService = require('./dailyReminderService');

class DailyScheduler {
  static init() {
    console.log('🕐 Initializing daily reminder scheduler...');

    // Weekdays at 17:30 (5:30 PM) Asia/Colombo
    // Cron: m h dom mon dow => 30 17 * * 1-5
    const cronExpression = '30 17 * * 1-5';

    cron.schedule(cronExpression, async () => {
      console.log(`\n⏰ Daily reminder triggered at ${new Date().toLocaleString()} (server time)`);
      try {
        await DailyReminderService.runDailyReminder('scheduled');
      } catch (error) {
        console.error('❌ Daily scheduler error:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Colombo'
    });

    console.log('✅ Daily scheduler initialized (weekdays 17:30 Asia/Colombo).');
  }

  static async triggerManualReminder(options = {}) {
    return DailyReminderService.runDailyReminder('manual', options);
  }
}

module.exports = DailyScheduler;
