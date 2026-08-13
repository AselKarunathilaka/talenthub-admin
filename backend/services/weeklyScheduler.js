const cron = require("node-cron");
const WeeklyNonSubmissionExcelService = require("./weeklyNonSubmissionExcelService");
const WeeklyMeetingAttendanceService = require("./weeklymeetingattendanceservice");
const LogbookRestrictionService = require("./logbookRestrictionService");
const ScheduledEmailGuard = require("./scheduledEmailGuard");

// ── Single source of truth for recipients ────────────────────────────────
const DEFAULT_RECIPIENTS = [
  "send2liyanapathirana@gmail.com", // Developer
  "mgiri@slt.com.lk", // Supervisor
  "hjanaka@gmail.com", // Supervisor
];

// ── Job keys used by the once-per-period send guard ──────────────────────
const JOB_NON_SUBMISSION = "weekly-non-submission";
const JOB_MEETING_ATTENDANCE = "weekly-meeting-attendance";

/**
 * Local/dev machines share the production MongoDB and the production Gmail
 * account, so a developer who happens to have the backend running on a Sunday
 * morning would fire these crons too and supervisors would receive the report
 * twice. Set SCHEDULER_EMAILS_ENABLED=false in any non-production .env to keep
 * that machine from mailing anyone.
 *
 * Unset (the production case) means enabled — this flag can never silently
 * switch the real reports off.
 */
function schedulerEmailsEnabled() {
  return (
    String(process.env.SCHEDULER_EMAILS_ENABLED ?? "true").toLowerCase() !==
    "false"
  );
}

class WeeklyScheduler {
  static init() {
    console.log("🕐 Initializing weekly work log compliance scheduler...");

    if (!schedulerEmailsEnabled()) {
      console.log(
        "🚫 SCHEDULER_EMAILS_ENABLED=false — weekly report emails are DISABLED on this instance.",
      );
      console.log(
        "   (Logbook restriction enforcement still runs; report emails do not.)",
      );
    }

    // ── 9:30 AM — Non-submission report email with Excel ─────────────────
    cron.schedule(
      "30 9 * * 0",
      async () => {
        console.log(
          "\n⏰ Weekly logbook non-submission check triggered by scheduler",
        );
        console.log(`🗓️  Scheduled time: ${new Date().toLocaleString()}`);
        console.log(`📧 Recipients: ${DEFAULT_RECIPIENTS.join(", ")}`);

        if (!schedulerEmailsEnabled()) {
          console.log(
            "🚫 Skipped — report emails are disabled on this instance.",
          );
          return;
        }

        try {
          // runOnce guarantees a single send per day across every backend
          // process pointed at this database.
          await ScheduledEmailGuard.runOnce(
            JOB_NON_SUBMISSION,
            ScheduledEmailGuard.todayKey(),
            async () => {
              const results =
                await WeeklyNonSubmissionExcelService.performWeeklyNonSubmissionCheckWithExcel(
                  DEFAULT_RECIPIENTS,
                );
              return {
                sent: !!results?.emailSent,
                meta: {
                  recipients: DEFAULT_RECIPIENTS,
                  internsCount: results?.notSubmitted ?? 0,
                  messageId: results?.emailMessageId || null,
                },
              };
            },
          );
        } catch (error) {
          console.error("❌ Non-submission scheduler error:", error);
        }
      },
      { timezone: "Asia/Colombo", noOverlap: true },
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

        if (!schedulerEmailsEnabled()) {
          console.log(
            "🚫 Skipped — report emails are disabled on this instance.",
          );
          return;
        }

        try {
          await ScheduledEmailGuard.runOnce(
            JOB_MEETING_ATTENDANCE,
            ScheduledEmailGuard.todayKey(),
            async () => {
              const results =
                await WeeklyMeetingAttendanceService.performWeeklyMeetingAttendanceCheck(
                  DEFAULT_RECIPIENTS,
                );
              return {
                sent: !!results?.emailSent,
                meta: {
                  recipients: DEFAULT_RECIPIENTS,
                  internsCount: results?.notAttended ?? 0,
                  messageId: results?.emailMessageId || null,
                },
              };
            },
          );
        } catch (error) {
          console.error("❌ Meeting attendance scheduler error:", error);
        }
      },
      { timezone: "Asia/Colombo", noOverlap: true },
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
      { timezone: "Asia/Colombo", noOverlap: true },
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
    console.log(
      `🔒 Duplicate protection: report emails are claimed once per day in MongoDB (owner: ${ScheduledEmailGuard.owner()})`,
    );
  }

  // ── Manual triggers ───────────────────────────────────────────────────────
  // Manual triggers are deliberately NOT covered by the once-per-period guard:
  // an admin asking for the report again is an explicit, intentional re-send.

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
