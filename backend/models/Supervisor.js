const mongoose = require("mongoose");

const supervisorSchema = new mongoose.Schema(
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Supervisor", supervisorSchema);
