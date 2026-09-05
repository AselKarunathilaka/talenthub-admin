const mongoose = require("mongoose");
const Intern = require("../models/Intern");

const resolveInternId = async (req, res, next) => {
  const { internId } = req.params;

  // If it looks like a 4-digit Trainee_ID (not a MongoDB ObjectId)
  if (!/^[a-f\d]{24}$/i.test(internId)) {
    const intern = await Intern.findOne({ Trainee_ID: internId }).select("_id");
    if (!intern) return res.status(404).json({ message: "Intern not found" });
    req.params.internId = intern._id.toString(); // swap it in-place
  }

  next();
};

const InternService = require("../services/internService");
const DailyRecord = require("../models/DailyRecord");
const DailyAttendanceLog = require("../models/DailyAttendanceLog");
const MeetingAttendance = require("../models/MeetingAttendance");
const FaceAttendanceLog = require("../models/FaceAttendanceLog");
const TalentTrailService = require("../services/talentTrailService");

// ─── Attendance type classification ─────────────────────────────────────────

const DAILY_ATTENDANCE_TYPES = new Set([
  "daily",
  "daily_qr",
  "face",
  "manual_daily",
  "manual",  // matches AdminAnalytics
  "qr",      // matches AdminAnalytics
]);

const MEETING_ATTENDANCE_TYPES = new Set([
  "qr",
  "face_meeting",
  "meeting",
  "manual_meeting",
  "manual",
]);

const { getColomboDateKey, getDailyTypePriority } = require("../utils/attendanceHistory");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getDateKey = (date) => {
  return getColomboDateKey(date);
};

/** Format a Date (or date-string/timestamp) as hh:mm AM/PM in Sri Lanka time. */
const formatColomboTime = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Colombo",
  });
};

const getMeetingKey = (date, meetingName) =>
  `${getDateKey(date)}::${String(meetingName || "General Meeting")
    .trim()
    .toLowerCase()}`;

const normalizeAttendanceMethod = (type) => {
  const t = String(type || "").toLowerCase();
  if (t === "face" || t === "face_meeting") return "face recognition";
  if (t === "qr" || t === "daily_qr") return "qr";
  if (["meeting", "manual_meeting", "manual", "manual_daily"].includes(t))
    return "manual";
  return t || "unknown";
};

// ─── Controller ──────────────────────────────────────────────────────────────

/**
 * GET /admin/intern/:internId/attendance
 *
 * Returns { dailyAttendance, meetingAttendance, attendance (combined), stats }
 */
const formatAttendanceTypeLabel = (type, isMeeting = false) => {
  const t = String(type || "").toLowerCase();
  if (t === "face") return "Face Attendance";
  if (t === "daily_qr") return "QR Attendance";
  if (t === "daily") return "Logbook Attendance";
  if (t === "manual_daily") return "Manual Daily";
  if (t === "face_meeting") return "Face Meeting";
  if (t === "qr") return "QR Meeting";
  if (t === "meeting" || t === "manual_meeting" || t === "manual")
    return "Meeting Attendance";
  if (t === "face recognition") return isMeeting ? "Face Meeting" : "Face Attendance";
  return isMeeting ? "Meeting Attendance" : "Daily Attendance";
};

const getAdminInternAttendance = async (req, res) => {
  const { internId } = req.params;

  try {
    // 1. Load intern document (by ObjectId, Trainee_ID, Trainee_Email, or InactiveIntern)
    let intern = null;
    if (mongoose.Types.ObjectId.isValid(internId)) {
      intern = await Intern.findById(internId);
      if (!intern) {
        const InactiveIntern = require("../models/InactiveIntern");
        intern = await InactiveIntern.findById(internId);
      }
    }
    if (!intern) {
      intern = await Intern.findOne({
        $or: [
          { Trainee_ID: internId },
          { Trainee_Email: { $regex: new RegExp(`^${internId}$`, "i") } },
        ],
      });
    }
    if (!intern) {
      const InactiveIntern = require("../models/InactiveIntern");
      intern = await InactiveIntern.findOne({
        $or: [
          { Trainee_ID: internId },
          { Trainee_Email: { $regex: new RegExp(`^${internId}$`, "i") } },
        ],
      });
    }
    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }

    const idOr = [
      { internId: intern._id },
      ...(mongoose.Types.ObjectId.isValid(internId) ? [{ internId }] : []),
      ...(intern.Trainee_ID ? [{ traineeId: intern.Trainee_ID }] : []),
    ];

    // 2. Load DailyRecord entries, FaceAttendanceLog, DailyAttendanceLog, and MeetingAttendance
    const [dailyRecords, successfulFaceLogs, standaloneDailyLogs, standaloneMeetingLogs] = await Promise.all([
      DailyRecord.find({ $or: idOr }).sort({
        date: -1,
      }),
      FaceAttendanceLog.find({
        $or: idOr,
        status: "present",
        method: "face",
        qrBackupUsed: { $ne: true },
      })
        .select("attendanceDate attendanceTime method qrBackupUsed metadata")
        .lean(),
      DailyAttendanceLog.find({ $or: idOr }).sort({ date: -1 }).lean().catch(() => []),
      MeetingAttendance.find({ $or: idOr }).sort({ date: -1 }).lean().catch(() => []),
    ]);

    // Build a set of ISO date keys where a genuine face (non-QR-backup) daily scan exists
    // (Matches AdminAnalytics which includes all valid face attendance logs)
    const faceDates = new Set(
      successfulFaceLogs.map((log) => getDateKey(log.attendanceDate || log.attendanceTime)),
    );

    const dailyAttendance = [];
    const meetingAttendance = [];

    const meetingMethodByKey = new Map();
    const dailyMethodByDate = new Map();
    const dailyRecordMeetingKeys = new Set();

    // ── Step 1: Build method-lookup maps from intern.attendance[] ─────────────
    if (intern.attendance && intern.attendance.length > 0) {
      intern.attendance.forEach((entry) => {
        const type = (entry.type || "").toLowerCase();

        if (DAILY_ATTENDANCE_TYPES.has(type)) {
          const markedAt = entry.timeMarked || entry.date;
          const dateKey = getDateKey(entry.date);
          const current = dailyMethodByDate.get(dateKey);
          const entryPriority = getDailyTypePriority(type);
          const currentPriority = current ? getDailyTypePriority(current.rawType) : 0;

          if (!current || entryPriority > currentPriority) {
            dailyMethodByDate.set(dateKey, {
              method: normalizeAttendanceMethod(type),
              rawType: type,
              markedAt,
              checkInTime: entry.timeMarked || entry.date,
              checkOutTime: entry.checkOutTime || null,
            });
          } else if (entryPriority === currentPriority && markedAt && current.markedAt && new Date(markedAt) < new Date(current.markedAt)) {
            dailyMethodByDate.set(dateKey, {
              method: normalizeAttendanceMethod(type),
              rawType: type,
              markedAt,
              checkInTime: entry.timeMarked || entry.date,
              checkOutTime: entry.checkOutTime || current.checkOutTime || null,
            });
          }
        }

        if (MEETING_ATTENDANCE_TYPES.has(type)) {
          const meetingName =
            entry.projectName ||
            entry.meetingName ||
            entry.meeting ||
            entry.title ||
            entry.subject ||
            entry.topic ||
            "General Meeting";
          meetingMethodByKey.set(
            getMeetingKey(entry.date, meetingName),
            normalizeAttendanceMethod(type),
          );
        }
      });
    }

    // ── Step 2: Track meeting keys covered by DailyRecord ────────────────────
    dailyRecords.forEach((record) => {
      if (record.meetingAttendance && record.meetingAttendance.length > 0) {
        record.meetingAttendance.forEach((m) => {
          const name = m.projectName || m.meetingTitle;
          dailyRecordMeetingKeys.add(getMeetingKey(record.date, name));
        });
      }
    });

    // ── Step 3: Legacy meeting entries from intern.attendance[] ──────────────
    if (intern.attendance && intern.attendance.length > 0) {
      intern.attendance.forEach((entry) => {
        const type = (entry.type || "").toLowerCase();
        const isDailyEntry = DAILY_ATTENDANCE_TYPES.has(type);
        const isMeetingEntry = MEETING_ATTENDANCE_TYPES.has(type);

        // Skip purely-daily types that are NOT also meeting types (daily, daily_qr, face, manual_daily).
        // "qr" and "manual" are in BOTH sets (like AdminAnalytics) — they count for daily AND meeting.
        if (isDailyEntry && !isMeetingEntry) return; // purely daily — handled in Step 6 fallback
        if (!isMeetingEntry) return; // unknown type — skip

        const legacyName =
          entry.projectName ||
          entry.meetingName ||
          entry.meeting ||
          entry.title ||
          entry.subject ||
          entry.topic;

        if (dailyRecordMeetingKeys.has(getMeetingKey(entry.date, legacyName)))
          return;

        meetingAttendance.push({
          date: entry.date,
          status: entry.status || "Present",
          meetingName: legacyName || "General Meeting",
          type: "Meeting",
          rawType: type,
          attendanceTypeLabel: formatAttendanceTypeLabel(type, true),
          attendanceMethod: normalizeAttendanceMethod(type),
          time: formatColomboTime(entry.date),
          isMeeting: true,
        });
      });
    }

    // ── Step 4: DailyRecord — daily and meeting rows ──────────────────────────
    dailyRecords.forEach((record) => {
      const dateKey = getDateKey(record.date);
      // Daily — every logbook submission counts as a daily attendance entry.
      // DailyRecord has NO 'attendance' field; derive status from record.status:
      //   working / wfh  → Present
      //   leave / study_leave → Absent
      {
        const recordStatus = (record.status || "working").toLowerCase();
        const derivedAttendanceStatus =
          recordStatus === "leave" || recordStatus === "study_leave"
            ? "Absent"
            : "Present";

        const matchingMethodInfo = dailyMethodByDate.get(dateKey);
        const attendanceTime = record.attendanceTime
          ? new Date(record.attendanceTime)
          : matchingMethodInfo?.checkInTime
            ? new Date(matchingMethodInfo.checkInTime)
            : null;
        const checkOutTime = record.checkOutTime
          ? new Date(record.checkOutTime)
          : matchingMethodInfo?.checkOutTime
            ? new Date(matchingMethodInfo.checkOutTime)
            : null;
        const rawType = matchingMethodInfo?.rawType || "daily";

        dailyAttendance.push({
          date: record.date,
          status: derivedAttendanceStatus,
          type: "Daily",
          rawType,
          attendanceTypeLabel: formatAttendanceTypeLabel(rawType, false),
          recordStatus: record.status,
          attendanceMethod:
            matchingMethodInfo?.method || normalizeAttendanceMethod(rawType),
          time: formatColomboTime(attendanceTime),
          checkOutTime: formatColomboTime(checkOutTime),
          attendanceTime: attendanceTime,
        });
      }

      // Meeting
      if (record.meetingAttendance && record.meetingAttendance.length > 0) {
        record.meetingAttendance.forEach((meeting) => {
          const attendanceTime = new Date(meeting.attendanceTime);
          const projectName = meeting.projectName || meeting.meetingTitle;
          const meetingMethod = meeting.method || meetingMethodByKey.get(getMeetingKey(record.date, projectName));

          meetingAttendance.push({
            date: record.date,
            status: "Present",
            meetingName: projectName,
            projectName,
            type: "Meeting",
            rawType: meetingMethod,
            attendanceTypeLabel: formatAttendanceTypeLabel(meetingMethod, true),
            attendanceMethod: normalizeAttendanceMethod(meetingMethod),
            time: formatColomboTime(attendanceTime),
            isMeeting: true,
          });
        });
      }
    });

    // ── Step 5: TalentTrail external project-attendance ───────────────────────
    // Use canonical Intern schema fields (Trainee_ID / Trainee_Email)
    try {
      const ttData = await TalentTrailService.getCertificateData(
        intern.Trainee_ID,
        intern.Trainee_Email,
      );
      if (ttData?.attendanceRecords?.length > 0) {
        ttData.attendanceRecords.forEach((record) => {
          const at = record.date ? new Date(record.date) : new Date();
          const projectName = record.projectName || "External Project";
          if (dailyRecordMeetingKeys.has(getMeetingKey(at, projectName)))
            return;

          meetingAttendance.push({
            date: at,
            status:
              record.status === "PRESENT"
                ? "Present"
                : record.status === "LATE"
                  ? "Late"
                  : "Absent",
            meetingName: projectName,
            projectName,
            type: "Meeting",
            rawType: "talenttrail",
            attendanceTypeLabel: "External Project",
            attendanceMethod: "talenttrail",
            time: formatColomboTime(at),
            isMeeting: true,
          });
          dailyRecordMeetingKeys.add(getMeetingKey(at, projectName));
        });
      }
    } catch (e) {
      console.error(
        "[AdminInternDetails] TalentTrail fetch failed:",
        e.message,
      );
    }

    // ── Step 6: Fallback — daily scans in intern.attendance[] not in DailyRecord
    try {
      const coveredDates = new Set(
        dailyAttendance.map((d) => getDateKey(d.date)),
      );

      if (intern.attendance && intern.attendance.length > 0) {
        intern.attendance.forEach((entry) => {
          const type = (entry.type || "").toLowerCase();
          if (!DAILY_ATTENDANCE_TYPES.has(type)) return;

          const entryDate = entry.date ? new Date(entry.date) : null;
          if (!entryDate || isNaN(entryDate.getTime())) return;

          const dayKey = getDateKey(entryDate);
          if (coveredDates.has(dayKey)) return;

          const isFaceScan = faceDates.has(dayKey);
          const rawType = isFaceScan ? "face" : type;
          const checkInDate = entry.timeMarked ? new Date(entry.timeMarked) : entryDate;
          const checkOutDate = entry.checkOutTime ? new Date(entry.checkOutTime) : null;

          dailyAttendance.push({
            date: dayKey,
            status: entry.status || "Present",
            type: "Daily",
            rawType,
            attendanceTypeLabel: formatAttendanceTypeLabel(rawType, false),
            attendanceMethod: isFaceScan ? "face recognition" : normalizeAttendanceMethod(type),
            time: formatColomboTime(checkInDate),
            checkOutTime: formatColomboTime(checkOutDate),
            attendanceTime: entry.timeMarked || entry.date,
          });
          coveredDates.add(dayKey);
        });
      }

      // Also merge standalone MeetingAttendance documents if not already in meetingAttendance
      (standaloneMeetingLogs || []).forEach((entry) => {
        const at = entry.date ? new Date(entry.date) : (entry.attendanceTime ? new Date(entry.attendanceTime) : new Date());
        const meetingName = entry.projectName || entry.meetingTitle || "General Meeting";
        const meetingKey = getMeetingKey(at, meetingName);
        if (dailyRecordMeetingKeys.has(meetingKey)) return;

        meetingAttendance.push({
          date: at,
          status: (entry.status || "present").toLowerCase() === "absent" ? "Absent" : "Present",
          meetingName,
          projectName: meetingName,
          type: "Meeting",
          rawType: entry.markType || "meeting",
          attendanceTypeLabel: formatAttendanceTypeLabel(entry.markType || "meeting", true),
          attendanceMethod: normalizeAttendanceMethod(entry.markType || "meeting"),
          time: formatColomboTime(entry.attendanceTime || at),
          isMeeting: true,
        });
        dailyRecordMeetingKeys.add(meetingKey);
      });

      // Also ensure all faceDates are present even if not in DailyRecord or intern.attendance
      faceDates.forEach((faceDateKey) => {
        const currentCovered = new Set(
          dailyAttendance.map((d) => getDateKey(d.date)),
        );
        if (!currentCovered.has(faceDateKey)) {
          const matchingMethodInfo = dailyMethodByDate.get(faceDateKey);
          const faceLog = successfulFaceLogs.find(
            (log) => getDateKey(log.attendanceDate || log.attendanceTime) === faceDateKey,
          );
          const checkInTime = faceLog?.attendanceTime || matchingMethodInfo?.checkInTime;

          dailyAttendance.push({
            date: faceDateKey,
            status: "Present",
            type: "Daily",
            rawType: "face",
            attendanceTypeLabel: "Face Attendance",
            attendanceMethod: "face recognition",
            time: formatColomboTime(checkInTime),
            checkOutTime: formatColomboTime(matchingMethodInfo?.checkOutTime),
            attendanceTime: checkInTime || faceDateKey,
          });
          coveredDates.add(faceDateKey);
        }
      });

      // Also merge standalone DailyAttendanceLog entries if date not yet covered
      (standaloneDailyLogs || []).forEach((entry) => {
        const entryDate = entry.date ? new Date(entry.date) : (entry.attendanceTime ? new Date(entry.attendanceTime) : null);
        if (!entryDate || isNaN(entryDate.getTime())) return;
        const dayKey = getDateKey(entryDate);
        if (coveredDates.has(dayKey)) return;

        const rawType = entry.markType || "daily";
        dailyAttendance.push({
          date: dayKey,
          status: (entry.status || "present").toLowerCase() === "absent" ? "Absent" : "Present",
          type: "Daily",
          rawType,
          attendanceTypeLabel: formatAttendanceTypeLabel(rawType, false),
          attendanceMethod: normalizeAttendanceMethod(rawType),
          time: formatColomboTime(entry.attendanceTime || entryDate),
          checkOutTime: formatColomboTime(entry.checkOutTime),
          attendanceTime: entry.attendanceTime || entryDate,
        });
        coveredDates.add(dayKey);
      });
    } catch (_) {
      // Non-fatal
    }

    // ── Step 7: Sort + de-duplicate daily, sort meeting ───────────────────────
    dailyAttendance.sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) return dateDiff;
      const pA = getDailyTypePriority(a.rawType || a.attendanceMethod);
      const pB = getDailyTypePriority(b.rawType || b.attendanceMethod);
      return pB - pA;
    });

    const uniqueDailyAttendance = [];
    const seenDailyDates = new Set();
    dailyAttendance.forEach((entry) => {
      const key = getDateKey(entry.date);
      if (seenDailyDates.has(key)) return;
      seenDailyDates.add(key);
      uniqueDailyAttendance.push(entry);
    });

    meetingAttendance.sort((a, b) => new Date(b.date) - new Date(a.date));

    const combinedAttendance = [
      ...uniqueDailyAttendance,
      ...meetingAttendance,
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log(
      `[AdminInternDetails] internId=${internId}  ` +
        `daily=${uniqueDailyAttendance.length}  meeting=${meetingAttendance.length}`,
    );

    return res.status(200).json({
      attendance: combinedAttendance,
      dailyAttendance: uniqueDailyAttendance,
      meetingAttendance,
      stats: {
        present: meetingAttendance.filter((e) => e.status === "Present").length,
        absent: meetingAttendance.filter((e) => e.status === "Absent").length,
      },
    });
  } catch (error) {
    console.error("[AdminInternDetails] Error fetching attendance:", error);
    return res.status(500).json({
      message: "Error fetching intern attendance",
      error: error.message,
    });
  }
};

/**
 * GET /admin/intern/:internId/record-counts
 *
 * Returns direct collection counts:
 *  { totalDailyAttendance, totalMeetingAttendance, totalLogbook }
 */
const getInternRecordCounts = async (req, res) => {
  const { internId } = req.params;
  try {
    let intern = null;
    if (mongoose.Types.ObjectId.isValid(internId)) {
      intern = await Intern.findById(internId);
      if (!intern) {
        const InactiveIntern = require("../models/InactiveIntern");
        intern = await InactiveIntern.findById(internId);
      }
    }
    if (!intern) {
      intern = await Intern.findOne({
        $or: [
          { Trainee_ID: internId },
          { Trainee_Email: { $regex: new RegExp(`^${internId}$`, "i") } },
        ],
      });
    }
    if (!intern) {
      const InactiveIntern = require("../models/InactiveIntern");
      intern = await InactiveIntern.findOne({
        $or: [
          { Trainee_ID: internId },
          { Trainee_Email: { $regex: new RegExp(`^${internId}$`, "i") } },
        ],
      });
    }

    const idOr = [
      ...(intern ? [{ internId: intern._id }] : []),
      ...(mongoose.Types.ObjectId.isValid(internId) ? [{ internId }] : []),
      ...(intern?.Trainee_ID ? [{ traineeId: intern.Trainee_ID }] : [{ traineeId: internId }]),
    ];

    const [dailyCount, meetingCount, logbookCount] = await Promise.all([
      DailyAttendanceLog.countDocuments({ $or: idOr }),
      MeetingAttendance.countDocuments({ $or: idOr }),
      DailyRecord.countDocuments({ $or: idOr }),
    ]);

    return res.status(200).json({
      totalDailyAttendance: dailyCount,
      totalMeetingAttendance: meetingCount,
      totalLogbook: logbookCount,
    });
  } catch (error) {
    console.error("[AdminInternDetails] Error fetching record counts:", error);
    return res.status(500).json({
      message: "Error fetching intern record counts",
      error: error.message,
    });
  }
};

module.exports = { getAdminInternAttendance, resolveInternId, getInternRecordCounts };
