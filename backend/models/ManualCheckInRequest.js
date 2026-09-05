const mongoose = require("mongoose");

const manualCheckInRequestSchema = new mongoose.Schema({
  internId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Intern",
    required: true,
  },
  requestType: {
    type: String,
    enum: ["check_in", "check_out"],
    required: true,
  },
  attendanceType: {
    type: String,
    enum: ["daily", "meeting"],
    required: true,
  },
  projectName: {
    type: String,
    default: null,
  },
  reason: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    capturedAt: { type: Date, default: null },
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
  resolvedBy: {
    type: String, // email of the admin who approved/rejected
    default: null,
  },
});

module.exports = mongoose.model("ManualCheckInRequest", manualCheckInRequestSchema);
