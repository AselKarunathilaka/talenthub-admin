const axios = require("axios");

const Holiday = require("../models/Holiday");
const HolidayYear = require("../models/HolidayYear");
const { getFallbackHolidays } = require("../utils/holidayData");

/**
 * holidaySyncService — pulls Sri Lankan public holidays from every provider we
 * trust, reconciles them, and writes the result into our own Holiday collection.
 *
 * Nothing else in the system talks to an external holiday provider. If every
 * provider is unreachable the bundled offline dataset is used so the year is
 * never left empty — but it is marked `bundled`, which is not good enough to
 * drive automatic logbook restrictions on its own.
 *
 * Providers:
 *   gazette-api  srilanka-holidays.vercel.app — mirrors the official gazette
 *   google       Google's official "Holidays in Sri Lanka" calendar (ICS, no key)
 */

const REQUEST_TIMEOUT_MS = 15000;

const GOOGLE_ICS_URL =
  "https://calendar.google.com/calendar/ical/" +
  "en.lk.official%23holiday%40group.v.calendar.google.com/public/basic.ics";

// ── Providers ───────────────────────────────────────────────────────────────

async function fetchFromGazetteApi(year) {
  // Fetch directly from the open-source repo's JSON data to avoid API key limits/revocations
  const { data } = await axios.get(
    `https://raw.githubusercontent.com/Dilshan-H/srilanka-holidays/main/json/${year}.json`,
    {
      timeout: REQUEST_TIMEOUT_MS,
    }
  );

  if (!Array.isArray(data)) {
    throw new Error("Response contained no holidays array");
  }

  // The GitHub JSON format uses different keys: { "start": "...", "summary": "...", "categories": [...] }
  return data
    .filter((h) => h?.start && h?.summary)
    .map((h) => ({
      date: h.start,
      name: h.summary,
      type: Array.isArray(h.categories) && h.categories.length ? h.categories : ["Public"],
    }));
}

/**
 * Google publishes two Sri Lanka calendars. The general one mixes in
 * observances (Valentine's Day, Mother's Day, …) which are ordinary working
 * days — treating those as holidays would silently delete working days from
 * the logbook window. We use the "official" calendar AND still require the
 * event to be described as a public holiday.
 */
function parseGoogleIcs(ics, year) {
  // Unfold RFC 5545 line continuations before matching
  const text = ics.replace(/\r\n[ \t]/g, "");
  const events = [...text.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)];

  const holidays = [];
  for (const [, body] of events) {
    const rawDate = body.match(/DTSTART;VALUE=DATE:(\d{8})/)?.[1];
    const summary = body.match(/SUMMARY:(.*)/)?.[1]?.trim();
    const description = body.match(/DESCRIPTION:(.*)/)?.[1]?.trim() || "";

    if (!rawDate || !summary) continue;
    if (!/public holiday/i.test(description)) continue; // drop observances

    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    if (Number(rawDate.slice(0, 4)) !== Number(year)) continue;

    holidays.push({
      date,
      name: summary.replace(/\\,/g, ","),
      type: ["Public"],
      tentative: /tentative/i.test(description),
    });
  }
  return holidays;
}

async function fetchFromGoogle(year) {
  const { data } = await axios.get(GOOGLE_ICS_URL, {
    timeout: REQUEST_TIMEOUT_MS,
    responseType: "text",
    transformResponse: [(body) => body],
  });

  const holidays = parseGoogleIcs(String(data), year);
  if (holidays.length === 0) {
    throw new Error(`Google calendar has no public holidays for ${year}`);
  }
  return holidays;
}

const PROVIDERS = [
  { name: "gazette-api", fetch: fetchFromGazetteApi },
  { name: "google", fetch: fetchFromGoogle },
];

// ── Reconciliation ──────────────────────────────────────────────────────────

/**
 * Merge the providers' answers.
 *
 * Where they disagree we take the UNION rather than the intersection. Dropping
 * a real holiday marks it a working day and can restrict an innocent intern;
 * carrying an extra day only removes a day from the window, which is the
 * forgiving direction. Every single-source date is still recorded as a conflict
 * so an admin can delete it if it is wrong.
 */
function reconcile(results) {
  const byDate = new Map();
  const conflicts = [];

  for (const { name: source, holidays } of results) {
    for (const h of holidays) {
      const existing = byDate.get(h.date);
      if (!existing) {
        byDate.set(h.date, { ...h, sources: [source] });
        continue;
      }
      existing.sources.push(source);
      // Prefer the longer, more descriptive name when providers differ
      if (existing.name !== h.name) {
        conflicts.push({
          date: h.date,
          name: existing.name,
          kind: "name-mismatch",
          reportedBy: [...existing.sources],
          detail: `"${existing.name}" vs "${h.name}"`,
        });
        if (h.name.length > existing.name.length) existing.name = h.name;
      }
      existing.type = [...new Set([...(existing.type || []), ...(h.type || [])])];
    }
  }

  if (results.length > 1) {
    for (const h of byDate.values()) {
      if (h.sources.length < results.length) {
        conflicts.push({
          date: h.date,
          name: h.name,
          kind: "only-in-one-source",
          reportedBy: [...h.sources],
          detail: `Only ${h.sources.join(", ")} reported this date — kept, but please confirm against the gazette`,
        });
      }
    }
  }

  return {
    holidays: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    conflicts,
  };
}

function classify({ okProviders, holidayCount, usedBundled, wasVerified }) {
  if (wasVerified) return "verified";
  if (holidayCount === 0) return "missing";
  if (usedBundled) return "bundled";
  if (okProviders >= 2) return "corroborated";
  return "single-source";
}

// ── Sync ────────────────────────────────────────────────────────────────────

/**
 * Refresh one year from all providers and persist the result.
 * Manually-entered holidays are never touched.
 */
async function syncYear(year, { triggeredBy = "scheduler" } = {}) {
  const numericYear = Number(year);
  const sourceReports = [];
  const results = [];

  for (const provider of PROVIDERS) {
    try {
      const holidays = await provider.fetch(numericYear);
      results.push({ name: provider.name, holidays });
      sourceReports.push({
        name: provider.name,
        ok: true,
        count: holidays.length,
        error: null,
        fetchedAt: new Date(),
      });
    } catch (error) {
      sourceReports.push({
        name: provider.name,
        ok: false,
        count: 0,
        error: error.response?.status
          ? `HTTP ${error.response.status}`
          : error.message,
        fetchedAt: new Date(),
      });
      console.error(
        `[holidaySync] ${provider.name} failed for ${numericYear}:`,
        error.response?.status || error.message,
      );
    }
  }

  let usedBundled = false;
  if (results.length === 0) {
    const bundled = getFallbackHolidays(numericYear);
    if (bundled.length > 0) {
      usedBundled = true;
      results.push({
        name: "bundled",
        holidays: bundled.map((h) => ({
          date: h.date,
          name: h.name,
          type: h.type,
        })),
      });
      sourceReports.push({
        name: "bundled",
        ok: true,
        count: bundled.length,
        error: "Used offline seed data — every provider was unreachable",
        fetchedAt: new Date(),
      });
    }
  }

  const { holidays, conflicts } = reconcile(results);

  // ── Persist ───────────────────────────────────────────────────────────────
  const existing = await Holiday.find({ year: numericYear });
  const manualDates = new Set(
    existing.filter((h) => h.isManual).map((h) => h.date),
  );

  for (const h of holidays) {
    if (manualDates.has(h.date)) continue; // admin's version wins
    await Holiday.updateOne(
      { date: h.date },
      {
        $set: {
          year: numericYear,
          name: h.name,
          type: h.type,
          sources: h.sources,
        },
        $setOnInsert: { isManual: false, addedBy: `sync:${triggeredBy}` },
      },
      { upsert: true },
    );
  }

  // Drop synced rows the providers no longer report (e.g. a corrected date),
  // but never touch anything an admin entered by hand.
  const syncedDates = new Set(holidays.map((h) => h.date));
  if (syncedDates.size > 0) {
    await Holiday.deleteMany({
      year: numericYear,
      isManual: false,
      date: { $nin: [...syncedDates] },
    });
  }

  const holidayCount = await Holiday.countDocuments({ year: numericYear });
  const previous = await HolidayYear.findOne({ year: numericYear });

  // A year that was verified stays verified only if the data did not change
  // underneath the admin who verified it.
  const dataChanged =
    previous?.holidayCount != null && previous.holidayCount !== holidayCount;
  const wasVerified = previous?.dataQuality === "verified" && !dataChanged;

  const dataQuality = classify({
    okProviders: sourceReports.filter((s) => s.ok && s.name !== "bundled").length,
    holidayCount,
    usedBundled,
    wasVerified,
  });

  await HolidayYear.updateOne(
    { year: numericYear },
    {
      $set: {
        dataQuality,
        holidayCount,
        lastSyncedAt: new Date(),
        sources: sourceReports,
        conflicts,
        ...(wasVerified
          ? {}
          : { verifiedBy: null, verifiedAt: null }),
      },
    },
    { upsert: true },
  );

  console.log(
    `[holidaySync] ${numericYear}: ${holidayCount} holidays, quality=${dataQuality}` +
      (conflicts.length ? `, ${conflicts.length} conflict(s)` : ""),
  );

  return { year: numericYear, holidayCount, dataQuality, conflicts, sources: sourceReports };
}

/**
 * Keep the current year and the next two topped up. Providers publish roughly a
 * year ahead, so the far year usually stays `missing` until it is gazetted —
 * that is expected, and it is what the admin screen nags about.
 */
async function syncUpcomingYears({ triggeredBy = "scheduler" } = {}) {
  const thisYear = new Date().getFullYear();
  const summaries = [];
  for (const year of [thisYear, thisYear + 1, thisYear + 2]) {
    try {
      summaries.push(await syncYear(year, { triggeredBy }));
    } catch (error) {
      console.error(`[holidaySync] sync failed for ${year}:`, error.message);
    }
  }
  return summaries;
}

module.exports = {
  syncYear,
  syncUpcomingYears,
  parseGoogleIcs,
  GOOGLE_ICS_URL,
};
