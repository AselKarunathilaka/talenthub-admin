const cron = require("node-cron");
const ApprovedLeaveNotificationService = require("./approvedLeaveNotificationService");

/**
 * Initializes all scheduled jobs for the application.
 * Call this once from server.js / app.js after DB connection is ready.
 */
function initScheduler() {
  // Cron: "0 16 * * *" = every day at 16:00 (4:00 PM)
  // timezone: 'Asia/Colombo' = Sri Lanka Standard Time (UTC+5:30)
  cron.schedule(
    "0 16 * * *",
    async () => {
      console.log(
        "\n⏰ [Scheduler] 4:00 PM Sri Lanka Time — triggering daily leave report...",
      );
      try {
        await ApprovedLeaveNotificationService.sendDailyReport();
      } catch (err) {
        console.error("[Scheduler] Error running daily leave report:", err);
      }
    },
    { timezone: "Asia/Colombo" },
  );

  console.log(
    " [Scheduler] Daily 4 PM leave report job registered (Asia/Colombo timezone)",
  );
}

module.exports = { initScheduler };
