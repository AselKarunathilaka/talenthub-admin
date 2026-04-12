const mongoose = require("mongoose");

/**
 * PastInternLocation
 *
 * Stores geocoded location data for past/completed interns.
 * The location field is entirely optional — stubs for interns with no
 * address or failed geocoding are saved without it to avoid the
 * "unknown GeoJSON type" error from the 2dsphere index.
 */
const pastInternLocationSchema = new mongoose.Schema(
  {
    Trainee_ID: { type: String, required: true, unique: true },
    Trainee_Name: { type: String, default: "" },
    Trainee_HomeAddress: { type: String, default: "" },
    Trainee_Email: { type: String, default: "" },
    Institute: { type: String, default: "" },
    district: { type: String, default: "" },

    // Optional — only present when geocoding succeeded.
    // Do NOT set a default here; an empty coordinates array breaks the 2dsphere index.
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },

    geocodeFailed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// sparse: true means the index ignores documents where location is missing,
// so stubs (no address / geocode failed) don't cause index errors.
pastInternLocationSchema.index({ location: "2dsphere" }, { sparse: true });
pastInternLocationSchema.index({ district: 1 });

module.exports = mongoose.model("PastInternLocation", pastInternLocationSchema);