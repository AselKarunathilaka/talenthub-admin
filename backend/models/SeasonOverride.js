const mongoose = require("mongoose");

/**
 * SeasonOverride — Singleton document that stores the admin-configured
 * season override for the Login page background.
 *
 * When activeSeasonKey is null, the frontend uses date-based auto-detection.
 * When set to a valid season key, the frontend renders that season's background
 * regardless of the current date.
 */
const seasonOverrideSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "config",
    },
    activeSeasonKey: {
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

module.exports = mongoose.model("SeasonOverride", seasonOverrideSchema);
