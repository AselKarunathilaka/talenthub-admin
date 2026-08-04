const moment = require("moment-timezone");
const axios = require("axios");

const TZ = "Asia/Colombo";

// In-memory cache for API holiday responses: year -> { holidays: Set<string>, fetchedAt: number }
const holidayCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Built-in Sri Lankan Public Holidays fallback dataset (2024–2027)
function getBuiltInHolidays(years) {
  const yearList = Array.isArray(years) ? years : [years];
  const holidays = new Set();

  yearList.forEach((y) => {
    // Fixed public holidays
    const fixed = [`${y}-01-01`, `${y}-02-04`, `${y}-05-01`, `${y}-12-25`];
    fixed.forEach((d) => holidays.add(d));

    // Poya & Mercantile / Public Holidays per year
    const lunarApprox = {
      2024: [
        "2024-01-15", "2024-02-23", "2024-03-25", "2024-04-12", "2024-04-13",
        "2024-04-14", "2024-05-23", "2024-05-24", "2024-06-17", "2024-06-21",
        "2024-07-20", "2024-08-19", "2024-09-17", "2024-10-02", "2024-10-17",
        "2024-10-31", "2024-11-15", "2024-12-15",
      ],
      2025: [
        "2025-01-14", "2025-02-26", "2025-03-14", "2025-03-31", "2025-04-13",
        "2025-04-14", "2025-05-12", "2025-05-13", "2025-06-06", "2025-06-07",
        "2025-07-05", "2025-08-03", "2025-09-01", "2025-09-05", "2025-10-01",
        "2025-10-20", "2025-10-30", "2025-11-29",
      ],
      2026: [
        "2026-01-14", "2026-02-15", "2026-03-03", "2026-03-20", "2026-04-02",
        "2026-04-13", "2026-04-14", "2026-05-01", "2026-05-02", "2026-05-28",
        "2026-05-30", "2026-06-29", "2026-07-28", "2026-08-27", "2026-09-10",
        "2026-09-25", "2026-11-09", "2026-11-24", "2026-12-23",
      ],
      2027: [
        "2027-01-15", "2027-02-04", "2027-02-20", "2027-03-22", "2027-04-13",
        "2027-04-14", "2027-05-01", "2027-05-20", "2027-05-21", "2027-06-18",
        "2027-07-17", "2027-08-16", "2027-09-15", "2027-10-14", "2027-11-13",
        "2027-12-13", "2027-12-25",
      ],
    };

    if (lunarApprox[y]) lunarApprox[y].forEach((d) => holidays.add(d));
  });

  return holidays;
}

/**
 * Fetch holidays for a given year using external API if available, fallback to built-in list.
 * Synchronous return using cached data or fallback, with async background refresh.
 */
function getSriLankanHolidays(years) {
  const yearList = Array.isArray(years) ? years : [years];
  const combinedHolidays = new Set();

  for (const y of yearList) {
    const cached = holidayCache.get(y);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      cached.holidays.forEach((d) => combinedHolidays.add(d));
    } else {
      // Return built-in fallback while triggering background API refresh
      const builtIn = getBuiltInHolidays(y);
      builtIn.forEach((d) => combinedHolidays.add(d));
      refreshHolidaysFromApi(y).catch(() => {});
    }
  }

  return combinedHolidays;
}

/**
 * Background refresh of Holiday API
 */
async function refreshHolidaysFromApi(year) {
  if (!process.env.HOLIDAY_API_URL || !process.env.HOLIDAY_API_KEY) {
    return;
  }
  try {
    const response = await axios.get(
      `${process.env.HOLIDAY_API_URL}/api/v1/holidays`,
      {
        params: { year, format: "full" },
        headers: { "X-API-Key": process.env.HOLIDAY_API_KEY },
        timeout: 5000,
      },
    );
    if (response.data && response.data.holidays) {
      const dates = new Set();
      response.data.holidays.forEach((item) => {
        if (item.date) dates.add(item.date);
      });
      holidayCache.set(year, { holidays: dates, fetchedAt: Date.now() });
    }
  } catch (err) {
    // Fail quietly and use fallback
  }
}

/**
 * Check if a date string ("YYYY-MM-DD") or Date object is a working day.
 */
function isWorkingDay(inputDate) {
  const m = moment.tz(inputDate, TZ);
  const dow = m.day();
  if (dow === 0 || dow === 6) return false; // Weekend

  const dateStr = m.format("YYYY-MM-DD");
  const holidays = getSriLankanHolidays([m.year()]);
  return !holidays.has(dateStr);
}

/**
 * Get the past N working days (excluding weekends & holidays) going backward from referenceDate.
 * Returns array of YYYY-MM-DD strings, most-recent first.
 */
function getPastWorkingDays(count, referenceDate = new Date()) {
  const ref = moment.tz(referenceDate, TZ).startOf("day");
  const years = new Set([ref.year(), ref.year() - 1]);
  const holidays = getSriLankanHolidays([...years]);

  const days = [];
  const cursor = ref.clone().subtract(1, "day"); // start from yesterday

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

/**
 * Get all working days between startDate and endDate inclusive.
 */
function getWorkingDaysInRange(startDate, endDate) {
  const start = moment.tz(startDate, TZ).startOf("day");
  const end = moment.tz(endDate, TZ).endOf("day");

  const years = [];
  for (let y = start.year(); y <= end.year(); y++) years.push(y);
  const holidays = getSriLankanHolidays(years);

  const workingDays = [];
  const cursor = start.clone();
  while (cursor.isSameOrBefore(end, "day")) {
    const dow = cursor.day();
    const dateStr = cursor.format("YYYY-MM-DD");
    if (dow !== 0 && dow !== 6 && !holidays.has(dateStr)) {
      workingDays.push(cursor.clone());
    }
    cursor.add(1, "day");
  }
  return workingDays;
}

/**
 * Calculate the grace period end date (5 working days starting from Training_StartDate).
 */
function calculateGracePeriodEndDate(startDate, graceWorkingDays = 5) {
  if (!startDate) return null;
  const cursor = moment.tz(startDate, TZ).startOf("day");
  const years = new Set([cursor.year(), cursor.year() + 1]);
  const holidays = getSriLankanHolidays([...years]);

  let workingDaysCount = 0;
  // If startDate itself is a working day, count it as day 1
  if (cursor.day() !== 0 && cursor.day() !== 6 && !holidays.has(cursor.format("YYYY-MM-DD"))) {
    workingDaysCount = 1;
  }

  while (workingDaysCount < graceWorkingDays) {
    cursor.add(1, "day");
    const dow = cursor.day();
    const dateStr = cursor.format("YYYY-MM-DD");
    if (dow !== 0 && dow !== 6 && !holidays.has(dateStr)) {
      workingDaysCount++;
    }
  }

  return cursor.endOf("day").toDate();
}

/**
 * Return boolean if intern is within 5-working-day grace period.
 */
function isWithinGracePeriod(startDate, referenceDate = new Date()) {
  if (!startDate) return false;
  const graceEnd = calculateGracePeriodEndDate(startDate, 5);
  if (!graceEnd) return false;
  const ref = moment.tz(referenceDate, TZ).endOf("day").toDate();
  return ref <= graceEnd;
}

/**
 * Standardized Mongoose query object for active, non-test, non-terminated interns.
 */
function getActiveInternsQuery(referenceDate = new Date()) {
  const ref = moment.tz(referenceDate, TZ).toDate();
  return {
    isTestAccount: { $ne: true },
    $and: [
      {
        $or: [
          { Training_StartDate: { $lte: ref } },
          { Training_StartDate: { $exists: false } },
          { Training_StartDate: null },
        ],
      },
      {
        $or: [
          { Training_EndDate: { $gte: ref } },
          { Training_EndDate: { $exists: false } },
          { Training_EndDate: null },
        ],
      },
    ],
  };
}

module.exports = {
  getSriLankanHolidays,
  isWorkingDay,
  getPastWorkingDays,
  getWorkingDaysInRange,
  calculateGracePeriodEndDate,
  isWithinGracePeriod,
  getActiveInternsQuery,
};
