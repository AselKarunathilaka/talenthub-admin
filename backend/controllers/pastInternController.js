/**
 * pastInternController.js
 *
 * Handles all past intern location API endpoints.
 * Data is served from the PastInternLocation MongoDB collection — instant responses.
 * The syncPastInternLocations.js script populates/updates that collection.
 */

const pastInternLocationService = require("../services/pastInternLocationService");

/* ── GET /admin/past-intern-locations ──────────────────────────────────────── */
const getPastInternLocations = async (req, res) => {
  try {
    const { district } = req.query;
    const data = await pastInternLocationService.getPastInternLocations(
      district || "All"
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching past intern locations:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch past intern locations",
    });
  }
};

/* ── GET /admin/past-intern-district-counts ────────────────────────────────── */
const getPastInternDistrictCounts = async (req, res) => {
  try {
    const data = await pastInternLocationService.getPastInternDistrictCounts();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching past intern district counts:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ── GET /admin/past-intern-sync-stats ─────────────────────────────────────── */
// Shows how many past interns are in the DB, geocoded, failed — useful for
// a status indicator in the admin panel so you know when to re-run the script.
const getPastInternSyncStats = async (req, res) => {
  try {
    const stats = await pastInternLocationService.getSyncStats();
    return res.status(200).json({ success: true, stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPastInternLocations,
  getPastInternDistrictCounts,
  getPastInternSyncStats,
};