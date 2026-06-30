const mongoose = require("mongoose");
const Intern = require("../models/Intern");

require("dotenv").config();

// Each entry = the Wednesday of that week (used as the representative day).
// Week ranges (Monday–Sunday):
//   Week 1: Feb 16–22  → rep date Feb 18
//   Week 2: Feb 23–Mar 1 → rep date Feb 25
//   Week 3: Mar 2–8    → rep date Mar 4
//   Week 4: Mar 9–15   → rep date Mar 11
//   Week 5: Mar 16     → rep date Mar 16 (single day, boundary week)

const RECOVERY_WEEKS = [
  { start: "2026-02-16", end: "2026-02-22", repDate: "2026-02-18" },
  { start: "2026-02-23", end: "2026-03-01", repDate: "2026-02-25" },
  { start: "2026-03-02", end: "2026-03-08", repDate: "2026-03-04" },
  { start: "2026-03-09", end: "2026-03-15", repDate: "2026-03-11" },
  { start: "2026-03-16", end: "2026-03-16", repDate: "2026-03-16" },
];

function toUTCDayStart(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function toUTCDayEnd(dateStr) {
  return new Date(`${dateStr}T23:59:59.999Z`);
}

async function backfillMeetings() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Only interns who started before March 17 2026 (affected by the data loss window)
    const affectedInterns = await Intern.find({
      Training_StartDate: { $lt: new Date("2026-03-17T00:00:00.000Z") },
      isTestAccount: { $ne: true },
    });

    console.log(
      `Found ${affectedInterns.length} potentially affected interns.`,
    );

    let internsPatched = 0;
    let recordsInserted = 0;

    for (const intern of affectedInterns) {
      const internStart = new Date(intern.Training_StartDate);
      const internEnd = intern.Training_EndDate
        ? new Date(intern.Training_EndDate)
        : new Date("2099-01-01T00:00:00.000Z");

      let patchedThisIntern = false;

      for (const week of RECOVERY_WEEKS) {
        const weekStart = toUTCDayStart(week.start);
        const weekEnd = toUTCDayEnd(week.end);
        const repDate = toUTCDayStart(week.repDate);

        // Skip if intern wasn't active during this week
        if (internEnd < weekStart || internStart > weekEnd) {
          continue;
        }

        // Count existing attendance entries whose date falls within this week
        const weekAttendanceCount = intern.attendance.filter((a) => {
          const d = new Date(a.date);
          return d >= weekStart && d <= weekEnd;
        }).length;

        if (weekAttendanceCount > 0) {
          // Data exists for this week — nothing to recover
          continue;
        }

        // No attendance at all for this week → insert one recovery record
        // timeMarked set to 09:00 UTC on the rep date (keeps it realistic)
        const timeMarked = new Date(repDate.getTime() + 9 * 60 * 60 * 1000);

        intern.attendance.push({
          date: repDate,
          status: "Present",
          type: "manual_meeting",
          timeMarked: timeMarked,
          meetingName: "Weekly Review (Recovered)",
        });

        recordsInserted++;
        patchedThisIntern = true;

        console.log(
          `  [${intern.Trainee_ID}] ${intern.Trainee_Name} — inserted recovery record for week ${week.start}`,
        );
      }

      if (patchedThisIntern) {
        await intern.save();
        internsPatched++;
      }
    }

    console.log("\n--- Backfill Complete ---");
    console.log(`Interns patched : ${internsPatched}`);
    console.log(`Records inserted: ${recordsInserted}`);
  } catch (err) {
    console.error("Backfill failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

backfillMeetings();
