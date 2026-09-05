const mongoose = require("mongoose");

/**
 * DailyAttendanceLog — dedicated collection for every daily attendance mark event.
 *
 * One document is written each time an intern's daily attendance is recorded
 * (QR scan, face scan, admin manual mark, or logbook submission).
 * It is append-only: existing documents are never mutated by new scans.
 *
 * Fields
 * ──────
 * internId          ObjectId  → ref to Intern (or InactiveIntern)
 * traineeId         String    → human-readable trainee ID (e.g. "1234")
 * traineeName       String    → intern's full name at time of mark
 * date              String    → "YYYY-MM-DD" (Asia/Colombo date)
 * attendanceTime    Date      → exact UTC timestamp when the mark happened
 * markType          String    → scan/mark method (see enum below)
 * status            String    → "present" | "absent"
 * checkOutTime      Date      → filled by checkout scan (nullable)
 * isCheckout        Boolean   → true when this document records a checkout
 * sessionId         String    → QR session ID or face log reference (optional)
 * source            String    → "qr" | "face" | "manual" | "logbook" | "system"
 */
const DailyAttendanceLogSchema = new mongoose.Schema(
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
    // The method/type used to mark attendance
    markType: {
      type: String,
      enum: [
        "daily_qr",    // intern scanned daily QR code
        "face",        // face recognition daily check-in
        "daily",       // logbook submission triggered attendance
        "manual_daily",// admin manually marked daily attendance
        "manual",      // generic manual mark
        "system",      // automated / scheduler action
      ],
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["present", "absent"],
      default: "present",
      trim: true,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    isCheckout: {
      type: Boolean,
      default: false,
    },
    sessionId: {
      type: String, // QR session or face log reference
      default: null,
    },
    source: {
      type: String,
      enum: ["qr", "face", "manual", "logbook", "system"],
      default: "system",
    },
  },
  {
    timestamps: true,
    collection: "dailyattendance",
  },
);

// Fast look-up: all logs for an intern on a given date
DailyAttendanceLogSchema.index({ internId: 1, date: 1 });
// Trainee-ID + date for reporting queries
DailyAttendanceLogSchema.index({ traineeId: 1, date: 1 });
// Date-only for bulk date-range reports
DailyAttendanceLogSchema.index({ date: 1 });
// Chronological queries per intern
DailyAttendanceLogSchema.index({ internId: 1, attendanceTime: -1 });

module.exports = mongoose.model("DailyAttendanceLog", DailyAttendanceLogSchema);
