const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ["Present", "Absent"], default: "Absent" },
  type: {
    type: String,
    enum: [
      "manual",
      "qr",
      "daily_qr",
      "daily",
      "face",
      "meeting",
      "face_meeting",
      // ── Added for admin manual marking ───────────────────────────────────
      "manual_daily", // Admin manually marks a daily check-in
      "manual_meeting", // Admin manually marks meeting attendance
    ],
    default: "manual",
  },
  timeMarked: { type: Date },
  checkOutTime: { type: Date },
  qrCode: { type: String },
  projectName: { type: String },
  projectKey: { type: String },
  meetingName: { type: String },
  meetingSessionId: { type: String },
});

// Store API-style keys as the canonical document shape so DB contains Trainee_* fields.
const internSchema = new mongoose.Schema(
  {
    Trainee_ID: { type: String, required: true, unique: true },
    Trainee_Name: { type: String, required: true },
    Trainee_HomeAddress: { type: String, default: "" },
    district: { type: String, default: "" },

    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },

    Training_StartDate: { type: Date },
    Training_EndDate: { type: Date },
    Trainee_Email: { type: String, default: "" },
    Institute: { type: String, default: "" },
    field_of_spec_name: { type: String, required: true },

    team: { type: String, default: "" },
    attendance: [attendanceSchema],
    availableDays: {
      type: [String],
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      default: [],
    },
    agreementAccepted: { type: Boolean, default: false },
    agreementAcceptedDate: { type: Date },
    isTestAccount: { type: Boolean, default: false },
    password: { type: String, default: "" },
  },
  { timestamps: true },
);

// IMPORTANT: GEO INDEX
internSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Intern", internSchema);
