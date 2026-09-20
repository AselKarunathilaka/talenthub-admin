/**
 * dailyAttendanceLogService.js
 *
 * Thin write-only helper that records a daily attendance event into the
 * dedicated `dailyattendancelogs` collection.
 *
 * Rules:
 *  - Never throws — errors are logged but never propagate to callers.
 *  - Never mutates any existing document; always inserts a new one.
 *  - Called from attendanceWorkflowService, qrCodeService,
 *    manualAttendanceController, and dailyRecordController.
 */

const DailyAttendanceLog = require("../models/DailyAttendanceLog");

/**
 * Record a daily attendance event.
 *
 * @param {object} params
 * @param {string|import("mongoose").Types.ObjectId} params.internId    Mongo _id of the intern
 * @param {string}  params.traineeId     Human-readable trainee ID (e.g. "1234")
 * @param {string}  [params.traineeName] Intern's display name
 * @param {string}  params.date          "YYYY-MM-DD" (Asia/Colombo date)
 * @param {Date}    params.attendanceTime Exact UTC timestamp of the mark
 * @param {string}  params.markType      One of the DailyAttendanceLog.markType enum values
 * @param {string}  [params.status]      "present" | "absent"  (default: "present")
 * @param {boolean} [params.isCheckout]  true when this is a checkout event
 * @param {Date}    [params.checkOutTime] Checkout timestamp (when isCheckout === true)
 * @param {string}  [params.sessionId]   QR session ID or face-log reference
 * @param {string}  [params.source]      "qr" | "face" | "manual" | "logbook" | "system"
 */
async function recordDailyAttendance({
  internId,
  traineeId,
  traineeName,
  date,
  attendanceTime,
  markType,
  status = "present",
  isCheckout = false,
  checkOutTime = null,
  sessionId = null,
  source = "system",
}) {
  try {
    await DailyAttendanceLog.create({
      internId,
      traineeId: traineeId || "",
      traineeName: traineeName || "",
      date,
      attendanceTime: attendanceTime || new Date(),
      markType,
      status,
      isCheckout,
      checkOutTime: checkOutTime || null,
      sessionId: sessionId || null,
      source,
    });
  } catch (err) {
    // Log but never crash the caller — attendance marking must not be blocked
    // by a failure in this secondary write.
    console.error("[DailyAttendanceLog] Failed to record attendance event:", err.message);
  }
}

module.exports = { recordDailyAttendance };
