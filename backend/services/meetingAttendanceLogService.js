/**
 * meetingAttendanceLogService.js
 *
 * Thin write-only helper that records a meeting attendance event into the
 * dedicated `meetingattendance` collection.
 *
 * Rules:
 *  - Never throws — errors are logged but never propagate to callers.
 *  - Called from attendanceWorkflowService and manualAttendanceController.
 */

const MeetingAttendance = require("../models/MeetingAttendance");

/**
 * Record a meeting attendance event.
 *
 * @param {object} params
 * @param {string|import("mongoose").Types.ObjectId} params.internId    Mongo _id of the intern
 * @param {string}  params.traineeId     Human-readable trainee ID (e.g. "1234")
 * @param {string}  [params.traineeName] Intern's display name
 * @param {string}  params.date          "YYYY-MM-DD" (Asia/Colombo date)
 * @param {Date}    params.attendanceTime Exact UTC timestamp of the mark
 * @param {string}  params.markType      One of the MeetingAttendance.markType enum values
 * @param {string}  [params.projectName] Name of the project/meeting
 * @param {string}  [params.meetingTitle] Title of the meeting
 * @param {string}  [params.projectKey]  Normalized project key
 * @param {string}  [params.status]      "present" | "absent"  (default: "present")
 * @param {string}  [params.sessionId]   QR session ID or face session ID
 * @param {string}  [params.source]      "qr" | "face" | "manual" | "system"
 */
async function recordMeetingAttendance({
  internId,
  traineeId,
  traineeName,
  date,
  attendanceTime,
  markType,
  projectName = "",
  meetingTitle = "",
  projectKey = "",
  status = "present",
  sessionId = null,
  source = "system",
}) {
  try {
    await MeetingAttendance.create({
      internId,
      traineeId: traineeId || "",
      traineeName: traineeName || "",
      date,
      attendanceTime: attendanceTime || new Date(),
      markType,
      projectName: projectName || "",
      meetingTitle: meetingTitle || projectName || "",
      projectKey: projectKey || "",
      status,
      sessionId: sessionId || null,
      source,
    });
  } catch (err) {
    // Log but never crash caller
    console.error("[MeetingAttendance] Failed to record meeting attendance event:", err.message);
  }
}

module.exports = { recordMeetingAttendance };
