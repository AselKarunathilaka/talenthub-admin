const Holiday = require("../models/Holiday");
const HolidayYear = require("../models/HolidayYear");
const holidayStore = require("../utils/holidayStore");
const { syncYear } = require("../services/holidaySyncService");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const actorOf = (req) =>
  req.admin?.email || req.admin?.name || req.user?.id || "admin";

const parseYear = (value) => {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
};

/**
 * Recompute a year's trust level after a manual edit. An admin changing the
 * data invalidates any earlier "verified" stamp — they have to confirm again.
 */
async function markYearEdited(year, actor) {
  const holidayCount = await Holiday.countDocuments({ year });
  await HolidayYear.updateOne(
    { year },
    {
      $set: {
        holidayCount,
        dataQuality: holidayCount === 0 ? "missing" : "single-source",
        verifiedBy: null,
        verifiedAt: null,
      },
      $setOnInsert: { sources: [], conflicts: [] },
    },
    { upsert: true },
  );
  await holidayStore.refresh();
  console.log(`[holidays] ${year} edited by ${actor} — verification cleared`);
}

// ── Read ────────────────────────────────────────────────────────────────────

exports.getYear = async (req, res, next) => {
  try {
    const year = parseYear(req.params.year);
    if (!year) return res.status(400).json({ message: "Invalid year" });

    const [holidays, meta] = await Promise.all([
      Holiday.find({ year }).sort({ date: 1 }).lean(),
      HolidayYear.findOne({ year }).lean(),
    ]);

    res.json({
      year,
      holidays,
      meta: meta || {
        year,
        dataQuality: holidays.length ? "single-source" : "missing",
        holidayCount: holidays.length,
        lastSyncedAt: null,
        sources: [],
        conflicts: [],
      },
      enforcementReady: holidayStore.isTrustedForEnforcement(year),
    });
  } catch (error) {
    next(error);
  }
};

/** Year-by-year overview for the admin screen's header strip. */
exports.getOverview = async (_req, res, next) => {
  try {
    const thisYear = new Date().getFullYear();
    const years = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2];

    const metas = await HolidayYear.find({ year: { $in: years } }).lean();
    const counts = await Holiday.aggregate([
      { $match: { year: { $in: years } } },
      { $group: { _id: "$year", count: { $sum: 1 } } },
    ]);
    const countByYear = new Map(counts.map((c) => [c._id, c.count]));

    res.json({
      years: years.map((year) => {
        const meta = metas.find((m) => m.year === year);
        return {
          year,
          dataQuality: meta?.dataQuality || "missing",
          holidayCount: countByYear.get(year) || 0,
          lastSyncedAt: meta?.lastSyncedAt || null,
          conflictCount: meta?.conflicts?.length || 0,
          enforcementReady: holidayStore.isTrustedForEnforcement(year),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

// ── Write ───────────────────────────────────────────────────────────────────

exports.createHoliday = async (req, res, next) => {
  try {
    const { date, name, type } = req.body || {};

    if (!DATE_RE.test(date || "")) {
      return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "name is required" });
    }

    const existing = await Holiday.findOne({ date });
    if (existing) {
      return res
        .status(409)
        .json({ message: `${date} is already marked as "${existing.name}"` });
    }

    const actor = actorOf(req);
    const holiday = await Holiday.create({
      date,
      year: Number(date.slice(0, 4)),
      name: String(name).trim(),
      type: Array.isArray(type) && type.length ? type : ["Public"],
      sources: ["manual"],
      isManual: true,
      addedBy: actor,
      updatedBy: actor,
    });

    await markYearEdited(holiday.year, actor);
    res.status(201).json({ holiday });
  } catch (error) {
    next(error);
  }
};

exports.updateHoliday = async (req, res, next) => {
  try {
    const { name, type } = req.body || {};
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) return res.status(404).json({ message: "Holiday not found" });

    const actor = actorOf(req);
    if (name !== undefined) holiday.name = String(name).trim();
    if (Array.isArray(type) && type.length) holiday.type = type;
    // An edited row is the admin's now — sync must stop overwriting it.
    holiday.isManual = true;
    if (!holiday.sources.includes("manual")) holiday.sources.push("manual");
    holiday.updatedBy = actor;
    await holiday.save();

    await markYearEdited(holiday.year, actor);
    res.json({ holiday });
  } catch (error) {
    next(error);
  }
};

exports.deleteHoliday = async (req, res, next) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) return res.status(404).json({ message: "Holiday not found" });

    const { year } = holiday;
    await holiday.deleteOne();

    const actor = actorOf(req);
    await markYearEdited(year, actor);
    res.json({ message: `Removed ${holiday.date} (${holiday.name})` });
  } catch (error) {
    next(error);
  }
};

// ── Sync & verification ─────────────────────────────────────────────────────

exports.syncYear = async (req, res, next) => {
  try {
    const year = parseYear(req.params.year);
    if (!year) return res.status(400).json({ message: "Invalid year" });

    const summary = await syncYear(year, { triggeredBy: actorOf(req) });
    await holidayStore.refresh();

    res.json({
      ...summary,
      enforcementReady: holidayStore.isTrustedForEnforcement(year),
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyYear = async (req, res, next) => {
  try {
    const year = parseYear(req.params.year);
    if (!year) return res.status(400).json({ message: "Invalid year" });

    const holidayCount = await Holiday.countDocuments({ year });
    if (holidayCount === 0) {
      return res.status(400).json({
        message: `No holidays stored for ${year} — add them before verifying`,
      });
    }

    const actor = actorOf(req);
    await HolidayYear.updateOne(
      { year },
      {
        $set: {
          dataQuality: "verified",
          holidayCount,
          verifiedBy: actor,
          verifiedAt: new Date(),
        },
      },
      { upsert: true },
    );
    await holidayStore.refresh();

    console.log(`[holidays] ${year} verified by ${actor} (${holidayCount} holidays)`);
    res.json({ year, dataQuality: "verified", holidayCount, verifiedBy: actor });
  } catch (error) {
    next(error);
  }
};

exports.unverifyYear = async (req, res, next) => {
  try {
    const year = parseYear(req.params.year);
    if (!year) return res.status(400).json({ message: "Invalid year" });

    const holidayCount = await Holiday.countDocuments({ year });
    await HolidayYear.updateOne(
      { year },
      {
        $set: {
          dataQuality: holidayCount === 0 ? "missing" : "single-source",
          verifiedBy: null,
          verifiedAt: null,
        },
      },
      { upsert: true },
    );
    await holidayStore.refresh();

    res.json({ year, dataQuality: holidayStore.getYearQuality(year) });
  } catch (error) {
    next(error);
  }
};
