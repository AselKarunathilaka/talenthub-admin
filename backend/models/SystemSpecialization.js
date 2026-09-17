const mongoose = require("mongoose");

const systemSpecializationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    isNonCoding: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: "system_specializations",
    timestamps: true,
  }
);

module.exports = mongoose.model("SystemSpecialization", systemSpecializationSchema);
