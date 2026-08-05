// At the top of adminInternDetailsController.js, add this helper:
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
const TalentTrailService = require("../services/talentTrailService");

// ─── Attendance type classification ─────────────────────────────────────────

const DAILY_ATTENDANCE_TYPES = new Set([
  "daily",
  "daily_qr",
  "face",
  "manual_daily",
]);

const MEETING_ATTENDANCE_TYPES = new Set([
  "qr",
  "face_meeting",
  "meeting",
  "manual_meeting",
  "manual",
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getDateKey = (date) => {
  const parsed = date ? new Date(date) : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toISOString().slice(0, 10)
    : String(date || "");
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
const getAdminInternAttendance = async (req, res) => {
  const { internId } = req.params;

  try {
    // 1. Load intern document
    const intern = await InternService.getInternById(internId);
    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }

    // 2. Load DailyRecord entries (new QR / face system)
    const dailyRecords = await DailyRecord.find({ internId }).sort({
      date: -1,
    });

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
          if (!current || new Date(markedAt) > new Date(current.markedAt)) {
            dailyMethodByDate.set(dateKey, {
              method: normalizeAttendanceMethod(type),
              markedAt,
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

        if (isDailyEntry) return; // handled in Step 6 fallback
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
          attendanceMethod: normalizeAttendanceMethod(type),
          time: entry.date
            ? new Date(entry.date).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : null,
          isMeeting: true,
        });
      });
    }

    // ── Step 4: DailyRecord — daily and meeting rows ──────────────────────────
    dailyRecords.forEach((record) => {
      // Daily
      if (record.attendance && record.attendance !== "absent") {
        const attendanceTime = record.attendanceTime
          ? new Date(record.attendanceTime)
          : null;
        dailyAttendance.push({
          date: record.date,
          status:
            record.attendance === "present"
              ? "Present"
              : record.attendance === "late"
                ? "Late"
                : "Absent",
          type: "Daily",
          recordStatus: record.status,
          attendanceMethod:
            dailyMethodByDate.get(getDateKey(record.date))?.method || "unknown",
          time: attendanceTime
            ? attendanceTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : null,
          attendanceTime: record.attendanceTime,
        });
      }

      // Meeting
      if (record.meetingAttendance && record.meetingAttendance.length > 0) {
        record.meetingAttendance.forEach((meeting) => {
          const attendanceTime = new Date(meeting.attendanceTime);
          const projectName = meeting.projectName || meeting.meetingTitle;
          meetingAttendance.push({
            date: record.date,
            status: "Present",
            meetingName: projectName,
            projectName,
            type: "Meeting",
            attendanceMethod: normalizeAttendanceMethod(
              meeting.method ||
                meetingMethodByKey.get(getMeetingKey(record.date, projectName)),
            ),
            time: attendanceTime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
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
            attendanceMethod: "talenttrail",
            time: at.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
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
        dailyAttendance.map((d) => new Date(d.date).toDateString()),
      );

      if (intern.attendance && intern.attendance.length > 0) {
        intern.attendance.forEach((entry) => {
          const type = (entry.type || "").toLowerCase();
          if (!DAILY_ATTENDANCE_TYPES.has(type)) return;

          const entryDate = entry.date ? new Date(entry.date) : null;
          if (!entryDate || isNaN(entryDate.getTime())) return;

          const dayKey = entryDate.toDateString();
          if (coveredDates.has(dayKey)) return;

          dailyAttendance.push({
            date: entryDate,
            status: entry.status || "Present",
            type: "Daily",
            attendanceMethod: normalizeAttendanceMethod(type),
            time: (entry.timeMarked
              ? new Date(entry.timeMarked)
              : entryDate
            ).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            attendanceTime: entry.timeMarked || entry.date,
          });
          coveredDates.add(dayKey);
        });
      }
    } catch (_) {
      // Non-fatal
    }

    // ── Step 7: Sort + de-duplicate daily, sort meeting ───────────────────────
    dailyAttendance.sort((a, b) => new Date(b.date) - new Date(a.date));

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

module.exports = { getAdminInternAttendance, resolveInternId };
