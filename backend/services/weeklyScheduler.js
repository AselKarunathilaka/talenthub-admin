const cron = require("node-cron");
const WeeklyNonSubmissionExcelService = require("./weeklyNonSubmissionExcelService");
const WeeklyMeetingAttendanceService = require("./weeklymeetingattendanceservice");

class WeeklyScheduler {
  static init() {
    console.log("🕐 Initializing weekly work log compliance scheduler...");

    // Schedule non-submission check to run every Sunday at 9:30 AM
    // Send to both developer and supervisor
    const nonSubmissionCronExpression = "30 9 * * 0";
    const recipients = [
      "dimalshacooray@gmail.com", // Developer
      "mgiri@slt.com.lk", // Supervisor
    ];

    cron.schedule(
      nonSubmissionCronExpression,
      async () => {
        console.log(
          "\n⏰ Weekly logbook non-submission check with Excel attachment triggered by scheduler",
        );
        console.log(`🗓️  Scheduled time: ${new Date().toLocaleString()}`);
        console.log(`📧 Recipients: ${recipients.join(", ")}`);

        try {
          await WeeklyNonSubmissionExcelService.performWeeklyNonSubmissionCheckWithExcel(
            recipients,
          );
        } catch (error) {
          console.error("❌ Non-submission scheduler error:", error);
        }
      },
      {
        scheduled: true,
        timezone: "Asia/Colombo", // Sri Lanka timezone
      },
    );

    // Schedule meeting attendance check — every Sunday at 9:45 AM
    const meetingAttendanceCronExpression = "45 9 * * 0";
    const meetingAttendanceRecipients = [
      "dimalshacooray@gmail.com", // Developer
      "mgiri@slt.com.lk", // Supervisor
    ];

    cron.schedule(
      meetingAttendanceCronExpression,
      async () => {
        console.log(
          "\n⏰ Weekly meeting attendance check triggered by scheduler",
        );
        console.log(`🗓️  Scheduled time: ${new Date().toLocaleString()}`);
        console.log(`📧 Recipients: ${meetingAttendanceRecipients.join(", ")}`);

        try {
          await WeeklyMeetingAttendanceService.performWeeklyMeetingAttendanceCheck(
            meetingAttendanceRecipients,
          );
        } catch (error) {
          console.error("❌ Meeting attendance scheduler error:", error);
        }
      },
      {
        scheduled: true,
        timezone: "Asia/Colombo", // Sri Lanka timezone
      },
    );

    console.log("✅ Weekly scheduler initialized successfully!");
    console.log(
      `📅 Non-submission alert with Excel: Every Sunday at 9:30 AM (Asia/Colombo time)`,
    );
    console.log(
      `📅 Meeting attendance alert: Every Sunday at 9:45 AM (Asia/Colombo time) [⚠️ TESTING: 12:32 AM daily]`,
    );
    console.log(`📧 Email recipients: ${recipients.join(", ")}`);
  }

  /**
   * Manual trigger for non-submission check with Excel (can be called via API endpoint)
   * Can accept custom recipients or use defaults (dev + supervisor)
   */
  static async triggerManualNonSubmissionCheck(recipients = null) {
    console.log("\n🔧 Manual non-submission check with Excel triggered");
    console.log(`⏰ Triggered at: ${new Date().toLocaleString()}`);

    // Use provided recipients or default to both dev and supervisor
    const emailRecipients = recipients || [
      "dimalshacooray@gmail.com", // Developer
      "mgiri@slt.com.lk", // Supervisor
    ];

    console.log(
      `📧 Recipients: ${Array.isArray(emailRecipients) ? emailRecipients.join(", ") : emailRecipients}`,
    );

    try {
      const results =
        await WeeklyNonSubmissionExcelService.performWeeklyNonSubmissionCheckWithExcel(
          emailRecipients,
          "manual",
        );
      return {
        success: true,
        timestamp: new Date(),
        results: results,
      };
    } catch (error) {
      console.error("❌ Manual non-submission trigger error:", error);
      return {
        success: false,
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Manual trigger for meeting attendance check with Excel (can be called via API endpoint)
   * Can accept custom recipients or use defaults (dev + supervisor)
   */
  static async triggerManualMeetingAttendanceCheck(recipients = null) {
    console.log("\n🔧 Manual meeting attendance check triggered");
    console.log(`⏰ Triggered at: ${new Date().toLocaleString()}`);

    const emailRecipients = recipients || [
      "dimalshacooray@gmail.com", // Developer
      "mgiri@slt.com.lk", // Supervisor
    ];

    console.log(
      `📧 Recipients: ${Array.isArray(emailRecipients) ? emailRecipients.join(", ") : emailRecipients}`,
    );

    try {
      const results =
        await WeeklyMeetingAttendanceService.performWeeklyMeetingAttendanceCheck(
          emailRecipients,
          "manual",
        );
      return {
        success: true,
        timestamp: new Date(),
        results: results,
      };
    } catch (error) {
      console.error("❌ Manual meeting attendance trigger error:", error);
      return {
        success: false,
        timestamp: new Date(),
        error: error.message,
      };
    }
  }
}

module.exports = WeeklyScheduler;
