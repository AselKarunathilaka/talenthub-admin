const cron = require("node-cron");

const Holiday = require("../models/Holiday");
const holidayStore = require("../utils/holidayStore");
const { syncUpcomingYears } = require("./holidaySyncService");

/**
 * holidayScheduler — keeps the Holiday collection warm.
 *
 * Holidays change rarely (a gazette is published once a year, plus the
 * occasional ad-hoc declaration), so a weekly sync is plenty. The value of
 * running it often is catching an ad-hoc holiday before the Sunday restriction
 * cron acts on a week that contained it.
 */
class HolidayScheduler {
  static async init() {
    // Load the in-memory store and keep it refreshed for workingDays.js
    holidayStore.startAutoRefresh();

    // First boot on a fresh database: pull everything straight away so the
    // calendars and the restriction window are never left empty.
    try {
      const stored = await Holiday.estimatedDocumentCount();
      if (stored === 0) {
        console.log("🎌 No holidays stored yet — running first sync...");
        await syncUpcomingYears({ triggeredBy: "startup" });
        await holidayStore.refresh();
      }
    } catch (error) {
      console.error("❌ Holiday startup sync failed:", error.message);
    }

    // ── Every Wednesday at 03:15 — refresh this year and the next two ────────
    cron.schedule(
      "15 3 * * 3",
      async () => {
        console.log("\n🎌 Weekly holiday sync triggered by scheduler");
        try {
          await syncUpcomingYears({ triggeredBy: "scheduler" });
          await holidayStore.refresh();
        } catch (error) {
          console.error("❌ Holiday sync scheduler error:", error.message);
        }
      },
      { timezone: "Asia/Colombo", noOverlap: true },
    );

    console.log("✅ Holiday scheduler initialized successfully!");
    console.log(
      "📅 Holiday provider sync:          Every Wednesday at 3:15 AM (Asia/Colombo)",
    );
  }

  static async triggerManualSync() {
    console.log("\n🔧 Manual holiday sync triggered");
    try {
      const summaries = await syncUpcomingYears({ triggeredBy: "manual" });
      await holidayStore.refresh();
      return { success: true, timestamp: new Date(), summaries };
    } catch (error) {
      console.error("❌ Manual holiday sync error:", error.message);
      return { success: false, timestamp: new Date(), error: error.message };
    }
  }
}

module.exports = HolidayScheduler;
