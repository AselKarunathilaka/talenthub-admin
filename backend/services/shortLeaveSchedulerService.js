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
  // Send short leave requests submitted so far today to digital platforms team
  // This gives admins time to review between 1:00 PM - 1:30 PM
  // Note: Interns can submit from 8:30 AM - 4:30 PM throughout the day
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
    "✅ [Scheduler] Daily 1:00 PM short leave report job registered (Asia/Colombo timezone)",
  );

  // Cron: "30 13 * * *" = every day at 13:30 (1:30 PM)
  // timezone: 'Asia/Colombo' = Sri Lanka Standard Time (UTC+5:30)
  // Send approved short leave requests after admin approval (1:00 PM - 1:30 PM window)
  cron.schedule(
    "30 13 * * *",
    async () => {
      console.log(
        "\n⏰ [Scheduler] 1:30 PM Sri Lanka Time — triggering daily approved leave report...",
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
    "✅ [Scheduler] Daily 1:30 PM approved leave report job registered (Asia/Colombo timezone)",
  );
}

module.exports = { initScheduler };
