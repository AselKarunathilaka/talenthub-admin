const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    role: { type: String, required: true, trim: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Staff", staffSchema);
