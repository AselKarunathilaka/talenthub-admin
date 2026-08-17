const mongoose = require("mongoose");

/**
 * Holiday — one Sri Lankan public holiday, owned by us.
 *
 * This collection is the single source of truth for every holiday-aware part of
 * the system (calendars, working-day counts, the 5-working-day logbook window
 * and the Sunday restriction cron). External APIs only ever *propose* rows here
 * via holidaySyncService; they are never read in the request path.
 *
 * `sources` records which providers reported the date. A holiday confirmed by
 * two independent providers is treated as corroborated; anything less is
 * surfaced to an admin for review before it can drive auto-restrictions.
 */
const holidaySchema = new mongoose.Schema(
  {
    // "YYYY-MM-DD" in Asia/Colombo — the key every other module joins on
    date: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // e.g. ["Public", "Bank", "Poya"]
    type: {
      type: [String],
      default: ["Public"],
    },
    // Providers that reported this date: "gazette-api", "google", "bundled", "manual"
    sources: {
      type: [String],
      default: [],
    },
    // A manual row is authoritative: sync may never overwrite or delete it.
    isManual: {
      type: Boolean,
      default: false,
    },
    addedBy: {
      type: String,
      default: null,
    },
    updatedBy: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

holidaySchema.index({ year: 1, date: 1 });

module.exports = mongoose.model("Holiday", holidaySchema);
