const fs = require("fs");
const path = require("path");

/**
 * Offline Sri Lankan public holiday dataset.
 *
 * Bundled copy of the data behind HOLIDAY_API_URL (see data/holidays/README.md).
 * Used as the fallback whenever the upstream holiday API cannot be reached, so
 * that calendars and working-day maths keep behaving instead of silently
 * treating every public holiday as an ordinary working day.
 */

const DATA_DIR = path.join(__dirname, "..", "data", "holidays");

// year -> normalised holiday array (parsed once, then reused)
const loadedYears = new Map();

// Fixed-date holidays, used only for years with no bundled data file.
const FIXED_HOLIDAYS = [
  { month: "02", day: "04", name: "Independence Day" },
  { month: "05", day: "01", name: "May Day" },
  { month: "12", day: "25", name: "Christmas Day" },
];

function buildFixedFallback(year) {
  return FIXED_HOLIDAYS.map(({ month, day, name }) => {
    const date = `${year}-${month}-${day}`;
    return {
      date,
      name,
      type: ["Public"],
      start: date,
      end: date,
      id: `fixed_${date}`,
    };
  });
}

/**
 * Holidays for a year in the exact shape the upstream API returns for
 * `format=full`: { date, name, type[], start, end, id }.
 */
function getFallbackHolidays(year) {
  const y = Number(year);
  if (!Number.isInteger(y)) return [];

  if (loadedYears.has(y)) return loadedYears.get(y);

  let holidays;
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, `${y}.json`), "utf-8"),
    );
    holidays = raw
      .filter((item) => item && item.start && item.summary)
      .map((item) => ({
        date: item.start,
        name: item.summary,
        type: Array.isArray(item.categories) ? item.categories : [],
        start: item.start,
        end: item.end || item.start,
        id: item.uid || `sl_${item.start}`,
      }));
  } catch {
    // No bundled file for this year — keep the fixed-date holidays at least.
    holidays = buildFixedFallback(y);
  }

  loadedYears.set(y, holidays);
  return holidays;
}

/**
 * Just the "YYYY-MM-DD" dates, as a Set — what the working-day helpers need.
 */
function getFallbackHolidayDates(years) {
  const yearList = Array.isArray(years) ? years : [years];
  const dates = new Set();
  yearList.forEach((y) => {
    getFallbackHolidays(y).forEach((h) => dates.add(h.date));
  });
  return dates;
}

module.exports = { getFallbackHolidays, getFallbackHolidayDates };
