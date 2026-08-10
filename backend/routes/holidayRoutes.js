const express = require("express");
const axios = require("axios");

const { getFallbackHolidays } = require("../utils/holidayData");

const router = express.Router();

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const FAILURE_BACKOFF_MS = 15 * 60 * 1000; // don't retry a dead API on every page load
const REQUEST_TIMEOUT_MS = 8000;

// year -> { holidays, fetchedAt }
const cache = new Map();
// year -> timestamp of the last failed upstream fetch
const failedFetchAt = new Map();

//Holiday API GET
router.get("/:year", async (req, res) => {
  const year = Number(req.params.year);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: "Invalid year" });
  }

  const cached = cache.get(year);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return res.json({ year, source: "cache", holidays: cached.holidays });
  }

  const lastFailure = failedFetchAt.get(year);
  if (lastFailure && Date.now() - lastFailure < FAILURE_BACKOFF_MS) {
    return res.json({ year, source: "fallback", holidays: getFallbackHolidays(year) });
  }

  try {
    if (!process.env.HOLIDAY_API_URL || !process.env.HOLIDAY_API_KEY) {
      throw new Error("HOLIDAY_API_URL / HOLIDAY_API_KEY is not configured in .env");
    }

    const response = await axios.get(
      `${process.env.HOLIDAY_API_URL}/api/v1/holidays`,
      {
        params: {
          year,
          format: "full",
        },
        headers: {
          "X-API-Key": process.env.HOLIDAY_API_KEY,
        },
        timeout: REQUEST_TIMEOUT_MS,
      }
    );

    // The upstream API answers 200 with an { error } body for some failures,
    // so check for the payload we actually need rather than the status code.
    const holidays = response.data?.holidays;
    if (!Array.isArray(holidays) || holidays.length === 0) {
      throw new Error(
        response.data?.error || "Holiday API returned no holidays"
      );
    }

    cache.set(year, { holidays, fetchedAt: Date.now() });
    failedFetchAt.delete(year);
    res.json({ year, source: "api", holidays });
  } catch (error) {
    console.error(
      `Holiday API Error (${year}):`,
      error.response?.status || "",
      error.response?.data || error.message
    );
    failedFetchAt.set(year, Date.now());

    // Never leave the calendars holiday-less because the upstream API is down —
    // serve the bundled dataset instead and say so in the payload.
    const holidays = getFallbackHolidays(year);
    res.json({ year, source: "fallback", holidays });
  }
});

module.exports = router;
