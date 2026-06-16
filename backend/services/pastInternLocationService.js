/**
 * pastInternLocationService.js
 *
 * Serves past/inactive intern locations from the PastInternLocation DB collection.
 * Always cross-checks against the active Intern collection so that any intern
 * who re-joins as active is automatically excluded from the past interns layer.
 */

const PastInternLocation = require("../models/PastInternLocation");
const Intern = require("../models/Intern");

/**
 * Returns geocoded past/inactive intern locations.
 * Excludes any intern whose Trainee_ID exists in the active Intern collection.
 *
 * @param {string} district - "All" or a specific district name
 */
async function getPastInternLocations(district = "All") {
  // Get current active IDs to exclude
  const activeInterns = await Intern.find({}, { Trainee_ID: 1 }).lean();
  const activeIds = new Set(
    activeInterns.map((i) => i.Trainee_ID?.toString()).filter(Boolean)
  );

  const filter = {
    geocodeFailed: { $ne: true },
    "location.coordinates.0": { $exists: true },
  };

  if (district && district !== "All") {
    filter.district = district;
  }

  const docs = await PastInternLocation.find(filter).lean();

  // Exclude anyone who is currently active
  return docs
    .filter((d) => !activeIds.has(d.Trainee_ID?.toString()))
    .map((d) => ({
      id: d.Trainee_ID,
      name: d.Trainee_Name,
      address: d.Trainee_HomeAddress,
      district: d.district,
      email: d.Trainee_Email,
      institute: d.Institute,
      coordinates: d.location.coordinates, // [longitude, latitude]
      isPast: true,
    }));
}

/**
 * Returns counts per district for past interns (excluding active ones).
 */
async function getPastInternDistrictCounts() {
  const activeInterns = await Intern.find({}, { Trainee_ID: 1 }).lean();
  const activeIds = activeInterns
    .map((i) => i.Trainee_ID?.toString())
    .filter(Boolean);

  return await PastInternLocation.aggregate([
    {
      $match: {
        geocodeFailed: { $ne: true },
        "location.coordinates.0": { $exists: true },
        Trainee_ID: { $nin: activeIds },
      },
    },
    {
      $group: {
        _id: "$district",
        count: { $sum: 1 },
      },
    },
  ]);
}

/**
 * Returns a summary for the admin sync status panel.
 */
async function getSyncStats() {
  const activeInterns = await Intern.find({}, { Trainee_ID: 1 }).lean();
  const activeIds = activeInterns
    .map((i) => i.Trainee_ID?.toString())
    .filter(Boolean);

  const [total, failed, geocoded] = await Promise.all([
    PastInternLocation.countDocuments({ Trainee_ID: { $nin: activeIds } }),
    PastInternLocation.countDocuments({
      geocodeFailed: true,
      Trainee_ID: { $nin: activeIds },
    }),
    PastInternLocation.countDocuments({
      geocodeFailed: { $ne: true },
      Trainee_ID: { $nin: activeIds },
    }),
  ]);

  return { total, geocoded, failed };
}

module.exports = {
  getPastInternLocations,
  getPastInternDistrictCounts,
  getSyncStats,
};