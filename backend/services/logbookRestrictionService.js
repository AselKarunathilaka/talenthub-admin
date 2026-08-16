const Intern = require("../models/Intern");
const DailyRecord = require("../models/DailyRecord");
const moment = require("moment");
const {
  getPastWorkingDays,
  isWithinGracePeriod,
  getActiveInternsQuery,
  getHolidayDataQuality,
  isHolidayDataTrusted,
} = require("../utils/workingDays");

// ── Minimum number of daily logs an intern must submit within the check
// window (past 5 working days) to avoid restriction. Kept in sync with
// WeeklyNonSubmissionExcelService.MIN_LOGS_REQUIRED. ─────────────────────────
const MIN_LOGS_REQUIRED = 3;

class LogbookRestrictionService {
  static getCheckWindow() {
    return getPastWorkingDays(5);
  }

  /**
   * Is the holiday data covering the check window trustworthy enough to
   * restrict someone on?
   *
   * A missing holiday turns a day nobody could have logged into a working day,
   * pushing an intern who did nothing wrong below the 3-log threshold — and a
   * restriction is the first step toward termination. So unless every year the
   * window touches is verified by an admin or corroborated by two independent
   * providers, we refuse to restrict and ask for a human instead.
   */
  static checkHolidayDataQuality(window) {
    const years = [...new Set(window.map((d) => Number(String(d).slice(0, 4))))];
    const untrusted = years
      .filter((year) => !isHolidayDataTrusted(year))
      .map((year) => ({ year, dataQuality: getHolidayDataQuality(year) }));

    return {
      trusted: untrusted.length === 0,
      years: years.map((year) => ({
        year,
        dataQuality: getHolidayDataQuality(year),
      })),
      untrusted,
    };
  }

  static isNewIntern(intern) {
    if (!intern.Training_StartDate) return false;
    return isWithinGracePeriod(intern.Training_StartDate);
  }

  // ── Log-submission check (count-based, matches WeeklyNonSubmissionExcelService) ──
  /**
   * Returns the number of daily logs the intern submitted within the
   * past 5 working days (weekends + SL public holidays excluded).
   */
  static async getLogsCountForPastWeek(internId) {
    try {
      const workingDays = this.getCheckWindow();
      const count = await DailyRecord.countDocuments({
        internId,
        date: { $in: workingDays },
      });
      return count;
    } catch (error) {
      console.error(`Error checking logs for intern ${internId}:`, error);
      return 0;
    }
  }

  // ── Active interns ────────────────────────────────────────────────────────

  static async getActiveInterns() {
    return Intern.find(getActiveInternsQuery());
  }

  // ── Core logic ────────────────────────────────────────────────────────────

  static async applyWeeklyLogbookRestrictions() {
    const startTime = Date.now();
    const window = this.getCheckWindow();
    const periodStart = moment(window[window.length - 1]).format("YYYY-MM-DD");
    const periodEnd = moment(window[0]).format("YYYY-MM-DD");
    const weekLabel = `week of ${periodStart}`;

    const holidayData = this.checkHolidayDataQuality(window);
    const enforcementPaused = !holidayData.trusted;

    console.log("\n🔒 Starting weekly logbook restriction enforcement...");
    console.log(`📅 Review period: ${periodStart} to ${periodEnd}`);
    console.log(`✅ Minimum logs required: ${MIN_LOGS_REQUIRED}`);
    console.log(
      `🎌 Holiday data: ${holidayData.years
        .map((y) => `${y.year}=${y.dataQuality}`)
        .join(", ")}`,
    );

    if (enforcementPaused) {
      console.warn("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.warn("⛔ AUTO-RESTRICTION PAUSED — holiday data is not trustworthy");
      holidayData.untrusted.forEach(({ year, dataQuality }) =>
        console.warn(`   ${year}: ${dataQuality}`),
      );
      console.warn(
        "   The 5-working-day window may include real public holidays, which",
      );
      console.warn(
        "   would restrict interns who did nothing wrong. Verify the year at",
      );
      console.warn(
        "   Admin → Holidays, then re-run from the restriction screen.",
      );
      console.warn("   Reporting who WOULD be restricted instead.");
      console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    }

    const results = {
      total: 0,
      restricted: 0, // newly restricted this run
      alreadyRestricted: 0, // already restricted, still below requirement
      skipped: 0, // new interns
      submittedButRestricted: 0, // met requirement this week but still restricted (admin must lift)
      metRequirement: 0, // met requirement, not restricted
      wouldRestrict: [], // populated instead of restricting when enforcement is paused
      errors: [],
    };

    try {
      const activeInterns = await this.getActiveInterns();
      results.total = activeInterns.length;
      console.log(`👥 Processing ${activeInterns.length} active intern(s)...`);

      for (const intern of activeInterns) {
        const name = intern.Trainee_Name || "Unknown";
        const tid = intern.Trainee_ID || "Unknown";

        try {
          // ── Skip new interns ────────────────────────────────────────────
          if (this.isNewIntern(intern)) {
            results.skipped++;
            console.log(
              `🆕 ${name} (${tid}) — SKIPPED (joined within review period)`,
            );
            continue;
          }

          const logsSubmitted = await this.getLogsCountForPastWeek(intern._id);
          const meetsRequirement = logsSubmitted >= MIN_LOGS_REQUIRED;

          if (!meetsRequirement) {
            // ── Apply restriction ─────────────────────────────────────────
            if (intern.logbookRestricted) {
              // Already restricted from a previous week — still below requirement.
              // Do not add a duplicate history entry; just log it.
              results.alreadyRestricted++;
              console.log(
                `⚠️  ${name} (${tid}) — already restricted, only ${logsSubmitted}/${MIN_LOGS_REQUIRED} log(s) submitted`,
              );
            } else if (enforcementPaused) {
              // Holiday data can't be trusted this week — record the candidate
              // for admin review instead of restricting on possibly-wrong days.
              results.wouldRestrict.push({
                internId: intern._id,
                name,
                tid,
                logsSubmitted,
              });
              console.log(
                `⏸️  ${name} (${tid}) — WOULD be restricted (${logsSubmitted}/${MIN_LOGS_REQUIRED}), held for admin review`,
              );
            } else {
              const now = new Date();
              const reason = `Only ${logsSubmitted}/${MIN_LOGS_REQUIRED} required logbook entries submitted for the past 5 working days (${weekLabel})`;

              await Intern.updateOne(
                { _id: intern._id },
                {
                  $set: {
                    logbookRestricted: true,
                    logbookRestrictedAt: now,
                    logbookRestrictionReason: reason,
                  },
                  $push: {
                    logbookRestrictionHistory: {
                      restrictedAt: now,
                      restrictionReason: reason,
                      liftedAt: null,
                      liftedBy: null,
                      liftReason: null,
                      autoRestricted: true,
                    },
                  },
                },
              );

              results.restricted++;
              console.log(`🔒 ${name} (${tid}) — RESTRICTED (${reason})`);
            }
          } else {
            // ── Intern met the minimum-logs requirement this week ─────────
            // Restriction is NOT auto-lifted — only an admin can lift it.
            results.metRequirement++;
            if (intern.logbookRestricted) {
              results.submittedButRestricted++;
              console.log(
                `📝 ${name} (${tid}) — submitted ${logsSubmitted}/${MIN_LOGS_REQUIRED} log(s) this week but still RESTRICTED (awaiting admin review)`,
              );
            } else {
              console.log(
                `✅ ${name} (${tid}) — submitted ${logsSubmitted}/${MIN_LOGS_REQUIRED} log(s), no restriction`,
              );
            }
          }
        } catch (err) {
          console.error(`❌ Error processing ${name} (${tid}):`, err);
          results.errors.push({
            internId: intern._id,
            name,
            tid,
            error: err.message,
          });
        }
      }

      // ── Summary ──────────────────────────────────────────────────────────
      console.log("\n📊 LOGBOOK RESTRICTION SUMMARY");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`📋 Total checked:                  ${results.total}`);
      console.log(`🆕 New interns skipped:            ${results.skipped}`);
      console.log(
        `✅ Met requirement (>=${MIN_LOGS_REQUIRED} logs):        ${results.metRequirement}`,
      );
      console.log(`🔒 Newly restricted:               ${results.restricted}`);
      if (enforcementPaused) {
        console.log(
          `⏸️  Held for admin review:          ${results.wouldRestrict.length} (auto-restriction paused)`,
        );
      }
      console.log(
        `⚠️  Already restricted:            ${results.alreadyRestricted}`,
      );
      console.log(
        `📝 Met requirement but still restricted: ${results.submittedButRestricted}`,
      );
      console.log(
        `❌ Errors:                         ${results.errors.length}`,
      );
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ Logbook restriction enforcement complete!\n");

      return {
        success: true,
        executionTime: Date.now() - startTime,
        periodStart,
        periodEnd,
        minLogsRequired: MIN_LOGS_REQUIRED,
        enforcementPaused,
        holidayData,
        ...results,
      };
    } catch (err) {
      console.error(
        "❌ Fatal error during logbook restriction enforcement:",
        err,
      );
      return { success: false, error: err.message };
    }
  }
}

module.exports = LogbookRestrictionService;
