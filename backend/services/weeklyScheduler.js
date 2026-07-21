const cron = require("node-cron");
const WeeklyNonSubmissionExcelService = require("./weeklyNonSubmissionExcelService");
const WeeklyMeetingAttendanceService = require("./weeklymeetingattendanceservice");
const LogbookRestrictionService = require("./logbookRestrictionService");

// ── Single source of truth for recipients ────────────────────────────────
const DEFAULT_RECIPIENTS = [
  "dimalshacooray@gmail.com", // Developer
  "send2liyanapathirana@gmail.com", // Supervisor
];

class WeeklyScheduler {
  static init() {
    console.log("🕐 Initializing weekly work log compliance scheduler...");

    // ── 9:30 AM — Non-submission report email with Excel ─────────────────
    cron.schedule(
      "30 9 * * 0",
      async () => {
        console.log(
          "\n⏰ Weekly logbook non-submission check triggered by scheduler",
        );
        console.log(`🗓️  Scheduled time: ${new Date().toLocaleString()}`);
        console.log(`📧 Recipients: ${DEFAULT_RECIPIENTS.join(", ")}`);
        try {
          await WeeklyNonSubmissionExcelService.performWeeklyNonSubmissionCheckWithExcel(
            DEFAULT_RECIPIENTS,
          );
        } catch (error) {
          console.error("❌ Non-submission scheduler error:", error);
        }
      },
      { scheduled: true, timezone: "Asia/Colombo" },
    );

    // ── 9:45 AM — Meeting attendance report ──────────────────────────────
    cron.schedule(
      "45 9 * * 0",
      async () => {
        console.log(
          "\n⏰ Weekly meeting attendance check triggered by scheduler",
        );
        console.log(`🗓️  Scheduled time: ${new Date().toLocaleString()}`);
        console.log(`📧 Recipients: ${DEFAULT_RECIPIENTS.join(", ")}`);
        try {
          await WeeklyMeetingAttendanceService.performWeeklyMeetingAttendanceCheck(
            DEFAULT_RECIPIENTS,
          );
        } catch (error) {
          console.error("❌ Meeting attendance scheduler error:", error);
        }
      },
      { scheduled: true, timezone: "Asia/Colombo" },
    );

    // ── 10:00 AM — Logbook restriction enforcement ────────────────────────
    // Runs after the report email so the email and restriction jobs don't race.
    // Restrictions are ONLY lifted manually by an admin — never auto-lifted here.
    cron.schedule(
      "0 10 * * 0",
      async () => {
        console.log(
          "\n⏰ Weekly logbook restriction enforcement triggered by scheduler",
        );
        console.log(`🗓️  Scheduled time: ${new Date().toLocaleString()}`);
        try {
          await LogbookRestrictionService.applyWeeklyLogbookRestrictions();
        } catch (error) {
          console.error("❌ Logbook restriction scheduler error:", error);
        }
      },
      { scheduled: true, timezone: "Asia/Colombo" },
    );

    console.log("✅ Weekly scheduler initialized successfully!");
    console.log(
      "📅 Non-submission report:          Every Sunday at 9:30 AM (Asia/Colombo)",
    );
    console.log(
      "📅 Meeting attendance report:      Every Sunday at 9:45 AM (Asia/Colombo)",
    );
    console.log(
      "📅 Logbook restriction enforcement: Every Sunday at 10:00 AM (Asia/Colombo)",
    );
    console.log(`📧 Email recipients: ${DEFAULT_RECIPIENTS.join(", ")}`);
  }

  // ── Manual triggers ───────────────────────────────────────────────────────

  static async triggerManualNonSubmissionCheck(recipients = null) {
    console.log("\n🔧 Manual non-submission check triggered");
    console.log(`⏰ Triggered at: ${new Date().toLocaleString()}`);
    const emailRecipients = recipients || DEFAULT_RECIPIENTS;
    console.log(`📧 Recipients: ${emailRecipients.join(", ")}`);
    try {
      const results =
        await WeeklyNonSubmissionExcelService.performWeeklyNonSubmissionCheckWithExcel(
          emailRecipients,
          "manual",
        );
      return { success: true, timestamp: new Date(), results };
    } catch (error) {
      console.error("❌ Manual non-submission trigger error:", error);
      return { success: false, timestamp: new Date(), error: error.message };
    }
  }

  static async triggerManualMeetingAttendanceCheck(recipients = null) {
    console.log("\n🔧 Manual meeting attendance check triggered");
    console.log(`⏰ Triggered at: ${new Date().toLocaleString()}`);
    const emailRecipients = recipients || DEFAULT_RECIPIENTS;
    console.log(`📧 Recipients: ${emailRecipients.join(", ")}`);
    try {
      const results =
        await WeeklyMeetingAttendanceService.performWeeklyMeetingAttendanceCheck(
          emailRecipients,
          "manual",
        );
      return { success: true, timestamp: new Date(), results };
    } catch (error) {
      console.error("❌ Manual meeting attendance trigger error:", error);
      return { success: false, timestamp: new Date(), error: error.message };
    }
  }

  static async triggerManualLogbookRestriction() {
    console.log("\n🔧 Manual logbook restriction enforcement triggered");
    console.log(`⏰ Triggered at: ${new Date().toLocaleString()}`);
    try {
      const results =
        await LogbookRestrictionService.applyWeeklyLogbookRestrictions();
      return { success: true, timestamp: new Date(), results };
    } catch (error) {
      console.error("❌ Manual logbook restriction error:", error);
      return { success: false, timestamp: new Date(), error: error.message };
    }
  }
}

module.exports = WeeklyScheduler;
