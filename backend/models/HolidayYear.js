const mongoose = require("mongoose");

/**
 * HolidayYear — sync + trust metadata for one calendar year of holidays.
 *
 * `dataQuality` is what the logbook restriction cron consults before it is
 * willing to restrict anyone:
 *
 *   verified      an admin checked the year against the gazette — always trusted
 *   corroborated  two independent providers reported the same set — trusted
 *   single-source only one provider answered — NOT enough to auto-restrict
 *   bundled       served from the offline seed data — NOT enough to auto-restrict
 *   missing       no holidays stored for this year at all — NOT enough
 *
 * Being wrong in the "missing holiday" direction marks a real holiday as a
 * working day, which can restrict — and ultimately get terminated — an intern
 * who did nothing wrong. So anything short of corroborated pauses enforcement
 * and asks an admin to look, rather than guessing.
 */
const DATA_QUALITY = [
  "verified",
  "corroborated",
  "single-source",
  "bundled",
  "missing",
];

const holidayYearSchema = new mongoose.Schema(
  {
    year: {
      type: Number,
      required: true,
      unique: true,
    },
    dataQuality: {
      type: String,
      enum: DATA_QUALITY,
      default: "missing",
    },
    holidayCount: {
      type: Number,
      default: 0,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
    // One entry per provider attempt in the last sync
    sources: [
      {
        _id: false,
        name: String,
        ok: Boolean,
        count: Number,
        error: String,
        fetchedAt: Date,
      },
    ],
    // Dates the providers disagreed on — an admin resolves these
    conflicts: [
      {
        _id: false,
        date: String,
        name: String,
        kind: {
          type: String,
          enum: ["only-in-one-source", "name-mismatch"],
        },
        reportedBy: [String],
        detail: String,
      },
    ],
    verifiedBy: {
      type: String,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("HolidayYear", holidayYearSchema);
module.exports.DATA_QUALITY = DATA_QUALITY;
