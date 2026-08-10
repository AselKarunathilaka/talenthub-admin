const moment = require("moment-timezone");
const axios = require("axios");

const { getFallbackHolidayDates } = require("./holidayData");

const TZ = "Asia/Colombo";

// In-memory cache for API holiday responses: year -> { holidays: Set<string>, fetchedAt: number }
const holidayCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// year -> Promise, so concurrent callers share one outgoing request
const inFlightRefreshes = new Map();
// year -> timestamp of the last failed fetch, to avoid retrying on every call
const failedFetchAt = new Map();
const FAILURE_BACKOFF_MS = 15 * 60 * 1000; // 15 minutes

// Built-in Sri Lankan Public Holidays fallback, from the bundled dataset
// (backend/data/holidays) — same source as the holiday API.
function getBuiltInHolidays(years) {
  return getFallbackHolidayDates(years);
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

      const lastFailure = failedFetchAt.get(y);
      if (!lastFailure || Date.now() - lastFailure > FAILURE_BACKOFF_MS) {
        refreshHolidaysFromApi(y).catch(() => {});
      }
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
  // One refresh per year at a time — getSriLankanHolidays is called many times
  // per request, and without this every call fires its own external request.
  if (inFlightRefreshes.has(year)) return inFlightRefreshes.get(year);

  const refresh = (async () => {
    try {
      const response = await axios.get(
        `${process.env.HOLIDAY_API_URL}/api/v1/holidays`,
        {
          params: { year, format: "full" },
          headers: { "X-API-Key": process.env.HOLIDAY_API_KEY },
          timeout: 5000,
        },
      );
      if (response.data && Array.isArray(response.data.holidays)) {
        const dates = new Set();
        response.data.holidays.forEach((item) => {
          if (item.date) dates.add(item.date);
        });
        if (dates.size > 0) {
          holidayCache.set(year, { holidays: dates, fetchedAt: Date.now() });
        }
      }
    } catch (err) {
      // Fail quietly and use the bundled fallback; back off before retrying.
      failedFetchAt.set(year, Date.now());
    } finally {
      inFlightRefreshes.delete(year);
    }
  })();

  inFlightRefreshes.set(year, refresh);
  return refresh;
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
