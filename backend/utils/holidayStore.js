const Holiday = require("../models/Holiday");
const HolidayYear = require("../models/HolidayYear");
const { getFallbackHolidayDates } = require("./holidayData");

/**
 * holidayStore — in-memory mirror of the Holiday collection.
 *
 * `workingDays.js` is synchronous and is called many times per request from
 * controllers, reports and the restriction cron, so holiday lookups cannot do
 * IO. The store is loaded once at boot, refreshed after every admin edit or
 * sync, and re-read periodically as a safety net for multi-instance deploys.
 */

const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// year -> Set<"YYYY-MM-DD">
let datesByYear = new Map();
// year -> dataQuality string
let qualityByYear = new Map();
let loadedAt = null;
let loading = null;

async function load() {
  if (loading) return loading;

  loading = (async () => {
    try {
      const [holidays, years] = await Promise.all([
        Holiday.find({}, { date: 1, year: 1 }).lean(),
        HolidayYear.find({}, { year: 1, dataQuality: 1 }).lean(),
      ]);

      const nextDates = new Map();
      holidays.forEach(({ year, date }) => {
        if (!nextDates.has(year)) nextDates.set(year, new Set());
        nextDates.get(year).add(date);
      });

      const nextQuality = new Map();
      years.forEach(({ year, dataQuality }) => nextQuality.set(year, dataQuality));

      datesByYear = nextDates;
      qualityByYear = nextQuality;
      loadedAt = Date.now();
    } catch (error) {
      console.error("[holidayStore] load failed:", error.message);
    } finally {
      loading = null;
    }
  })();

  return loading;
}

/** Re-read from the DB after a write. */
async function refresh() {
  loadedAt = null;
  return load();
}

function isStale() {
  return loadedAt === null || Date.now() - loadedAt > REFRESH_INTERVAL_MS;
}

/**
 * Holiday dates for the given year(s), as a Set. Synchronous by design.
 *
 * Falls back to the bundled seed data for any year the store has nothing for —
 * which covers the window between process start and the first load, and any
 * year that was never synced. `getYearQuality` is what callers should consult
 * when the answer actually matters.
 */
function getHolidayDates(years) {
  const yearList = Array.isArray(years) ? years : [years];
  const dates = new Set();

  if (isStale()) load(); // fire-and-forget; this call uses what we already have

  for (const year of yearList) {
    const known = datesByYear.get(Number(year));
    if (known && known.size > 0) {
      known.forEach((d) => dates.add(d));
    } else {
      getFallbackHolidayDates(year).forEach((d) => dates.add(d));
    }
  }

  return dates;
}

/**
 * "verified" | "corroborated" | "single-source" | "bundled" | "missing"
 * — see models/HolidayYear.js. Years the store has no row for report "missing".
 */
function getYearQuality(year) {
  const stored = qualityByYear.get(Number(year));
  if (stored) return stored;
  return datesByYear.get(Number(year))?.size > 0 ? "single-source" : "missing";
}

/** Quality levels good enough to automatically restrict an intern. */
const TRUSTED_QUALITY = new Set(["verified", "corroborated"]);

function isTrustedForEnforcement(year) {
  return TRUSTED_QUALITY.has(getYearQuality(year));
}

function startAutoRefresh() {
  load();
  const timer = setInterval(() => load(), REFRESH_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

module.exports = {
  load,
  refresh,
  getHolidayDates,
  getYearQuality,
  isTrustedForEnforcement,
  startAutoRefresh,
  TRUSTED_QUALITY,
};
