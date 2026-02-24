const cron = require("node-cron");
const ApprovedLeaveNotificationService = require("./approvedLeaveNotificationService");
const ShortLeaveEmailService = require("./shortLeaveEmailService");

/**
 * Initializes all scheduled jobs for the application.
 * Call this once from server.js / app.js after DB connection is ready.
 */
function initScheduler() {
  // Cron: "0 13 * * *" = every day at 13:00 (1:00 PM)
  // timezone: 'Asia/Colombo' = Sri Lanka Standard Time (UTC+5:30)
  // Send short leave requests submitted between 8 AM - 1 PM to digital platforms team
  cron.schedule(
    "0 13 * * *",
    async () => {
      console.log(
        "\n⏰ [Scheduler] 1:00 PM Sri Lanka Time — triggering short leave requests report...",
      );
      try {
        await ShortLeaveEmailService.sendDailyShortLeaveReport();
      } catch (err) {
        console.error("[Scheduler] Error running short leave report:", err);
      }
    },
    { timezone: "Asia/Colombo" },
  );

  console.log(
    "✅ [Scheduler] Daily 1 PM short leave report job registered (Asia/Colombo timezone)",
  );

  // Cron: "0 16 * * *" = every day at 16:00 (4:00 PM)
  // timezone: 'Asia/Colombo' = Sri Lanka Standard Time (UTC+5:30)
  cron.schedule(
    "0 16 * * *",
    async () => {
      console.log(
        "\n⏰ [Scheduler] 4:00 PM Sri Lanka Time — triggering daily approved leave report...",
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
    "✅ [Scheduler] Daily 4 PM approved leave report job registered (Asia/Colombo timezone)",
  );
}

module.exports = { initScheduler };
