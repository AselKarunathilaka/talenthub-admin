const moment = require("moment-timezone");

const holidayStore = require("./holidayStore");

const TZ = "Asia/Colombo";

/**
 * Sri Lankan public holidays for the given year(s), as a Set of "YYYY-MM-DD".
 *
 * Reads our own Holiday collection through the in-memory store — no external
 * call happens here. holidaySyncService is what talks to providers; see
 * services/holidaySyncService.js.
 */
function getSriLankanHolidays(years) {
  return holidayStore.getHolidayDates(years);
}

/**
 * How much the stored holiday data for a year can be trusted:
 * "verified" | "corroborated" | "single-source" | "bundled" | "missing".
 * Anything that can restrict or terminate an intern must check this first.
 */
function getHolidayDataQuality(year) {
  return holidayStore.getYearQuality(year);
}

function isHolidayDataTrusted(year) {
  return holidayStore.isTrustedForEnforcement(year);
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
 * How many days remain in a calendar-based (not working-day) grace period
 * that starts at startDate and runs for `amount` `unit`s (e.g. 21 days).
 *
 * Day 1 of the window (referenceDate === startDate) returns `amount`.
 * Returns 0 or negative once the window has ended, and null if startDate
 * is missing. This is THE single source of truth for the "new-joiner
 * logbook grace period" countdown — both the restriction-skip check and
 * the sticky-banner info the frontend displays are derived from it.
 */
function daysRemainingInCalendarGracePeriod(startDate, amount, unit, referenceDate = new Date()) {
  if (!startDate) return null;
  const start = moment.tz(startDate, TZ).startOf("day");
  const graceEndExclusive = start.clone().add(amount, unit);
  const ref = moment.tz(referenceDate, TZ).startOf("day");
  return graceEndExclusive.diff(ref, "days");
}

/**
 * Calendar-based (not working-day) grace period, counted from startDate.
 * True while daysRemaining is between 1 and `amount` inclusive.
 */
function isWithinCalendarGracePeriod(startDate, amount, unit, referenceDate = new Date()) {
  const daysRemaining = daysRemainingInCalendarGracePeriod(startDate, amount, unit, referenceDate);
  if (daysRemaining === null) return false;
  return daysRemaining >= 1 && daysRemaining <= amount;
}

/**
 * Calendar-based grace period counted BACKWARD from an end date — e.g. an
 * intern whose Training_EndDate is within the next 14 days.
 * Used for the logbook-restriction "leaving intern" grace period.
 *
 * Returns true if referenceDate falls within [endDate - amount(unit), endDate].
 */
function isWithinLeavingGracePeriod(endDate, amount, unit, referenceDate = new Date()) {
  if (!endDate) return false;
  const end = moment.tz(endDate, TZ).endOf("day");
  const graceStart = end.clone().subtract(amount, unit).startOf("day");
  const ref = moment.tz(referenceDate, TZ).startOf("day");
  return ref.isSameOrAfter(graceStart) && ref.isSameOrBefore(end);
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
  getHolidayDataQuality,
  isHolidayDataTrusted,
  isWorkingDay,
  getPastWorkingDays,
  getWorkingDaysInRange,
  calculateGracePeriodEndDate,
  isWithinGracePeriod,
  daysRemainingInCalendarGracePeriod,
  isWithinCalendarGracePeriod,
  isWithinLeavingGracePeriod,
  getActiveInternsQuery,
};
