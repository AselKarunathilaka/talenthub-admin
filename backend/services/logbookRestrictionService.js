const Intern = require("../models/Intern");
const DailyRecord = require("../models/DailyRecord");
const moment = require("moment");

// ── Reuse the same holiday + working-day helpers ──────────────────────────

function getSriLankanHolidays(years) {
  const yearList = Array.isArray(years) ? years : [years];
  const holidays = new Set();

  yearList.forEach((y) => {
    const fixed = [`${y}-01-01`, `${y}-02-04`, `${y}-05-01`, `${y}-12-25`];
    fixed.forEach((d) => holidays.add(d));

    const lunarApprox = {
      2024: [
        "2024-01-15",
        "2024-02-23",
        "2024-03-25",
        "2024-04-12",
        "2024-04-13",
        "2024-04-14",
        "2024-05-23",
        "2024-05-24",
        "2024-06-17",
        "2024-06-21",
        "2024-07-20",
        "2024-08-19",
        "2024-09-17",
        "2024-10-02",
        "2024-10-17",
        "2024-10-31",
        "2024-11-15",
        "2024-12-15",
      ],
      2025: [
        "2025-01-14",
        "2025-02-26",
        "2025-03-14",
        "2025-03-31",
        "2025-04-13",
        "2025-04-14",
        "2025-05-12",
        "2025-05-13",
        "2025-06-06",
        "2025-06-07",
        "2025-07-05",
        "2025-08-03",
        "2025-09-01",
        "2025-09-05",
        "2025-10-01",
        "2025-10-20",
        "2025-10-30",
        "2025-11-29",
      ],
      2026: [
        "2026-01-14",
        "2026-02-15",
        "2026-03-03",
        "2026-03-20",
        "2026-04-02",
        "2026-04-13",
        "2026-04-14",
        "2026-05-01",
        "2026-05-02",
        "2026-05-28",
        "2026-05-30",
        "2026-06-29",
        "2026-07-28",
        "2026-08-27",
        "2026-09-10",
        "2026-09-25",
        "2026-11-09",
        "2026-11-24",
        "2026-12-23",
      ],
    };

    if (lunarApprox[y]) lunarApprox[y].forEach((d) => holidays.add(d));
  });

  return holidays;
}

function getPastWorkingDays(count) {
  const today = moment().startOf("day");
  const years = new Set([today.year(), today.year() - 1]);
  const holidays = getSriLankanHolidays([...years]);

  const days = [];
  const cursor = today.clone().subtract(1, "day");

  while (days.length < count) {
    const dow = cursor.day();
    const dateStr = cursor.format("YYYY-MM-DD");
    if (dow !== 0 && dow !== 6 && !holidays.has(dateStr)) {
      days.push(dateStr);
    }
    cursor.subtract(1, "day");
  }

  return days;
}

class LogbookRestrictionService {
  static getCheckWindow() {
    return getPastWorkingDays(5);
  }

  static isNewIntern(intern) {
    if (!intern.Training_StartDate) return false;
    const window = this.getCheckWindow();
    const windowStart = moment(window[window.length - 1]);
    const trainingStart = moment(intern.Training_StartDate).startOf("day");
    return trainingStart.isSameOrAfter(windowStart);
  }

  static async hasSubmittedLogsForPastWeek(internId) {
    const workingDays = this.getCheckWindow();
    const count = await DailyRecord.countDocuments({
      internId,
      date: { $in: workingDays },
    });
    return count > 0;
  }

  // ── Active interns ────────────────────────────────────────────────────────

  static async getActiveInterns() {
    const currentDate = new Date();
    return Intern.find({
      $and: [
        {
          $or: [
            { Training_StartDate: { $lte: currentDate } },
            { Training_StartDate: { $exists: false } },
          ],
        },
        {
          $or: [
            { Training_EndDate: { $gte: currentDate } },
            { Training_EndDate: { $exists: false } },
          ],
        },
      ],
    });
  }

  // ── Core logic ────────────────────────────────────────────────────────────

  static async applyWeeklyLogbookRestrictions() {
    const startTime = Date.now();
    const window = this.getCheckWindow();
    const periodStart = moment(window[window.length - 1]).format("YYYY-MM-DD");
    const periodEnd = moment(window[0]).format("YYYY-MM-DD");
    const weekLabel = `week of ${periodStart}`;

    console.log("\n🔒 Starting weekly logbook restriction enforcement...");
    console.log(`📅 Review period: ${periodStart} to ${periodEnd}`);

    const results = {
      total: 0,
      restricted: 0, // newly restricted this run
      alreadyRestricted: 0, // already restricted, still not submitting
      skipped: 0, // new interns
      submittedButRestricted: 0, // submitted this week but still restricted (admin must lift)
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

          const submitted = await this.hasSubmittedLogsForPastWeek(intern._id);

          if (!submitted) {
            // ── Apply restriction ─────────────────────────────────────────
            if (intern.logbookRestricted) {
              // Already restricted from a previous week — still not submitting.
              // Do not add a duplicate history entry; just log it.
              results.alreadyRestricted++;
              console.log(
                `⚠️  ${name} (${tid}) — already restricted, still not submitting`,
              );
            } else {
              const now = new Date();
              const reason = `No logbook submissions for 5 consecutive working days (${weekLabel})`;

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
            // ── Intern submitted this week ────────────────────────────────
            // Restriction is NOT auto-lifted — only an admin can lift it.
            if (intern.logbookRestricted) {
              results.submittedButRestricted++;
              console.log(
                `📝 ${name} (${tid}) — submitted this week but still RESTRICTED (awaiting admin review)`,
              );
            } else {
              console.log(`✅ ${name} (${tid}) — submitted, no restriction`);
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
      console.log(`🔒 Newly restricted:               ${results.restricted}`);
      console.log(
        `⚠️  Already restricted:            ${results.alreadyRestricted}`,
      );
      console.log(
        `📝 Submitted but still restricted: ${results.submittedButRestricted}`,
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
