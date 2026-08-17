const express = require("express");

const Holiday = require("../models/Holiday");
const HolidayYear = require("../models/HolidayYear");
const { getFallbackHolidays } = require("../utils/holidayData");

const router = express.Router();

/**
 * GET /api/holidays/:year — public read used by every calendar in the app.
 *
 * Served from our own Holiday collection; no external provider is contacted in
 * the request path. holidaySyncService keeps the collection fresh.
 */
router.get("/:year", async (req, res) => {
  const year = Number(req.params.year);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: "Invalid year" });
  }

  try {
    const [stored, meta] = await Promise.all([
      Holiday.find({ year }, { _id: 0, date: 1, name: 1, type: 1 })
        .sort({ date: 1 })
        .lean(),
      HolidayYear.findOne({ year }, { dataQuality: 1, lastSyncedAt: 1 }).lean(),
    ]);

    if (stored.length > 0) {
      return res.json({
        year,
        source: "database",
        dataQuality: meta?.dataQuality || "single-source",
        lastSyncedAt: meta?.lastSyncedAt || null,
        holidays: stored,
      });
    }

    // Nothing stored yet (fresh install, or a year nobody has synced) — serve
    // the offline seed so calendars still mark holidays.
    return res.json({
      year,
      source: "bundled",
      dataQuality: "bundled",
      lastSyncedAt: null,
      holidays: getFallbackHolidays(year),
    });
  } catch (error) {
    console.error(`Holiday lookup failed (${year}):`, error.message);
    return res.json({
      year,
      source: "bundled",
      dataQuality: "bundled",
      lastSyncedAt: null,
      holidays: getFallbackHolidays(year),
    });
  }
});

module.exports = router;
