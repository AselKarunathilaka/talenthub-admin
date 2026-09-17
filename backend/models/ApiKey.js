const mongoose = require("mongoose");

const apiKeySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: "api_keys",
    timestamps: true,
  }
);

module.exports = mongoose.model("ApiKey", apiKeySchema);
