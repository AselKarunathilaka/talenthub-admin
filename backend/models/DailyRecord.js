const mongoose = require("mongoose");

// One meeting/project scan recorded against a day's logbook entry.
const MeetingAttendanceSchema = new mongoose.Schema(
  {
    projectName: { type: String, trim: true },
    // Normalised projectName (collapsed whitespace) used for duplicate lookups.
    projectKey: { type: String, trim: true },
    meetingTitle: { type: String, trim: true },
    meetingSessionId: { type: String },
    method: { type: String }, // qr | face_meeting | manual
    attendanceStatus: { type: String, default: "present" },
    attendanceTime: { type: Date },
  },
  { _id: true },
);

const DailyRecordSchema = new mongoose.Schema(
  {
    internId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Intern",
      required: true,
    },
    traineeId: {
      type: String,
    },
    date: {
      type: String,
      required: true,
    },
    stack: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000, // Allow up to 2000 characters for stack/technology descriptions
    },
    task: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000, // Allow up to 5000 characters for detailed task descriptions
    },
    progress: {
      type: String,
      default: "No challenges faced",
      trim: true,
      maxlength: 5000, // Allow up to 5000 characters for detailed progress notes
    },
    blockers: {
      type: String,
      default: "No specific plans",
      trim: true,
      maxlength: 5000, // Allow up to 5000 characters for detailed blocker descriptions
    },
    status: {
      type: String,
      enum: ["working", "leave", "wfh", "study_leave"],
      default: "working",
    },
    // ── Attendance ────────────────────────────────────────────────────────────
    // Written by attendanceWorkflowService (QR / face scans) and read by the
    // admin attendance views. These must stay declared here: Mongoose strips
    // undeclared paths out of update operations, so omitting them turns every
    // attendance write into a silent no-op.
    attendance: {
      type: String, // "present" | "absent" | "late" | ""
      trim: true,
    },
    // First daily check-in for this date. Not overwritten by later scans.
    attendanceTime: {
      type: Date,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    meetingAttendance: {
      type: [MeetingAttendanceSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Create compound index for intern and date to prevent duplicates per day
DailyRecordSchema.index({ internId: 1, date: 1 }, { unique: true });
DailyRecordSchema.index({ internId: 1, createdAt: -1 });
DailyRecordSchema.index({ createdAt: -1 }); // Standalone index for fast date range queries

module.exports = mongoose.model("DailyRecord", DailyRecordSchema);
