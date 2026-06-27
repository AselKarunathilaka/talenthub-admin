const SeasonOverride = require("../models/SeasonOverride");

/**
 * Valid season keys — must match the frontend SEASONS registry.
 */
const VALID_SEASON_KEYS = [
  "new-year",
  "independence-day",
  "sinhala-tamil-new-year",
  "vesak-festival",
  "poson-festival",
  "halloween",
  "christmas",
];

/**
 * GET /api/login-season
 * Public endpoint (no auth required).
 * Returns the currently active season override, if any.
 */
const getActiveSeason = async (req, res) => {
  try {
    const config = await SeasonOverride.findOne({ key: "config" });
    res.json({
      seasonKey: config?.activeSeasonKey || null,
      updatedAt: config?.updatedAt || null,
    });
  } catch (err) {
    console.error("[SeasonOverride] getActiveSeason error:", err.message);
    res.status(500).json({ message: "Failed to fetch season config" });
  }
};

/**
 * PUT /api/login-season/override
 * Admin-only endpoint (auth required).
 * Sets the active season key for testing purposes.
 *
 * Body: { "seasonKey": "poson-festival" }
 */
const setSeasonOverride = async (req, res) => {
  try {
    const { seasonKey } = req.body;

    if (!seasonKey) {
      return res
        .status(400)
        .json({ message: "seasonKey is required. Use DELETE to clear." });
    }

    if (!VALID_SEASON_KEYS.includes(seasonKey)) {
      return res.status(400).json({
        message: `Invalid seasonKey "${seasonKey}". Valid keys: ${VALID_SEASON_KEYS.join(", ")}`,
      });
    }

    const config = await SeasonOverride.findOneAndUpdate(
      { key: "config" },
      {
        activeSeasonKey: seasonKey,
        updatedBy: req.user?.email || req.user?.id || "admin",
      },
      { upsert: true, new: true },
    );

    res.json({
      message: `Season override set to "${seasonKey}"`,
      seasonKey: config.activeSeasonKey,
      updatedAt: config.updatedAt,
    });
  } catch (err) {
    console.error("[SeasonOverride] setSeasonOverride error:", err.message);
    res.status(500).json({ message: "Failed to set season override" });
  }
};

/**
 * DELETE /api/login-season/override
 * Admin-only endpoint (auth required).
 * Clears the override so the frontend auto-detects from the date.
 */
const clearSeasonOverride = async (req, res) => {
  try {
    const config = await SeasonOverride.findOneAndUpdate(
      { key: "config" },
      {
        activeSeasonKey: null,
        updatedBy: req.user?.email || req.user?.id || "admin",
      },
      { upsert: true, new: true },
    );

    res.json({
      message: "Season override cleared. Frontend will auto-detect from date.",
      seasonKey: null,
      updatedAt: config.updatedAt,
    });
  } catch (err) {
    console.error("[SeasonOverride] clearSeasonOverride error:", err.message);
    res.status(500).json({ message: "Failed to clear season override" });
  }
};

module.exports = {
  getActiveSeason,
  setSeasonOverride,
  clearSeasonOverride,
};
