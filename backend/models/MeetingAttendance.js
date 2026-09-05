const mongoose = require("mongoose");

/**
 * MeetingAttendance — dedicated collection for every meeting/project attendance mark event.
 *
 * One document is written each time an intern's meeting attendance is recorded
 * (Meeting QR scan, Face meeting scan, Admin manual meeting mark).
 *
 * Fields
 * ──────
 * internId          ObjectId  → ref to Intern (or InactiveIntern)
 * traineeId         String    → human-readable trainee ID (e.g. "1234")
 * traineeName       String    → intern's full name at time of mark
 * date              String    → "YYYY-MM-DD" (Asia/Colombo date)
 * attendanceTime    Date      → exact UTC timestamp when the mark happened
 * markType          String    → "qr" | "face_meeting" | "meeting" | "manual_meeting" | "manual"
 * projectName       String    → project / meeting name
 * meetingTitle      String    → meeting title / label
 * projectKey        String    → normalized project key
 * status            String    → "present" | "absent"
 * sessionId         String    → QR session ID or face meeting session ID
 * source            String    → "qr" | "face" | "manual" | "system"
 */
const MeetingAttendanceSchema = new mongoose.Schema(
  {
    internId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Intern",
      required: true,
      index: true,
    },
    traineeId: {
      type: String,
      trim: true,
    },
    traineeName: {
      type: String,
      trim: true,
    },
    date: {
      type: String, // "YYYY-MM-DD"
      required: true,
    },
    attendanceTime: {
      type: Date,
      required: true,
    },
    markType: {
      type: String,
      enum: [
        "qr",             // meeting QR code scan
        "face_meeting",   // face recognition meeting scan
        "meeting",        // generic meeting mark
        "manual_meeting", // admin manual meeting mark
        "manual",         // generic manual mark
        "system",
      ],
      required: true,
      trim: true,
    },
    projectName: {
      type: String,
      trim: true,
      default: "",
    },
    meetingTitle: {
      type: String,
      trim: true,
      default: "",
    },
    projectKey: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["present", "absent"],
      default: "present",
      trim: true,
    },
    sessionId: {
      type: String,
      default: null,
    },
    source: {
      type: String,
      enum: ["qr", "face", "manual", "system"],
      default: "system",
    },
  },
  {
    timestamps: true,
    collection: "meetingattendance",
  },
);

// Indexes
MeetingAttendanceSchema.index({ internId: 1, date: 1 });
MeetingAttendanceSchema.index({ traineeId: 1, date: 1 });
MeetingAttendanceSchema.index({ projectName: 1, date: 1 });
MeetingAttendanceSchema.index({ date: 1 });
MeetingAttendanceSchema.index({ internId: 1, attendanceTime: -1 });

module.exports = mongoose.model("MeetingAttendance", MeetingAttendanceSchema);
