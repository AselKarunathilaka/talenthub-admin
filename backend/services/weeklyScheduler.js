const cron = require('node-cron');
const WeeklyWorkLogService = require('./weeklyWorkLogService');

class WeeklyScheduler {
  static init() {
    console.log('🕐 Initializing weekly work log compliance scheduler...');
    
    // Schedule to run every Sunday at 9:00 AM
    // Cron pattern: '0 9 * * 0' (minute hour day-of-month month day-of-week)
    // day-of-week: 0 = Sunday
    const cronExpression = '0 9 * * 0';
    
    cron.schedule(cronExpression, async () => {
      console.log('\n⏰ Weekly work log compliance check triggered by scheduler');
      console.log(`🗓️  Scheduled time: ${new Date().toLocaleString()}`);
      
      try {
        await WeeklyWorkLogService.performWeeklyCheck();
      } catch (error) {
        console.error('❌ Scheduler error:', error);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Colombo" // Sri Lanka timezone
    });
    
    console.log('✅ Weekly scheduler initialized successfully!');
    console.log(`📅 Next run: Every Sunday at 9:00 AM (Asia/Colombo time)`);
  }
  

  
  /**
   * Manual trigger for testing (can be called via API endpoint)
   */
  static async triggerManualCheck() {
    console.log('\n🔧 Manual compliance check triggered');
    console.log(`⏰ Triggered at: ${new Date().toLocaleString()}`);
    
    try {
      const results = await WeeklyWorkLogService.performWeeklyCheck('manual');
      return {
        success: true,
        timestamp: new Date(),
        results: results
      };
    } catch (error) {
      console.error('❌ Manual trigger error:', error);
      return {
        success: false,
        timestamp: new Date(),
        error: error.message
      };
    }
  }
}

module.exports = WeeklyScheduler;