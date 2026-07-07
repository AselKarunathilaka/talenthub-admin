const Intern = require("../models/Intern");
const InternTalentTrailSync = require("../models/InternTalentTrailSync");
const DailyRecord = require("../models/DailyRecord");
<<<<<<< HEAD
const FaceAttendanceLog = require("../models/FaceAttendanceLog");
=======
>>>>>>> talenthub/main
const moment = require("moment-timezone");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const WeeklyMeetingAttendanceService = require("../services/weeklymeetingattendanceservice");
const {
  generateMeetingAttendancePdf,
} = require("./meetingAttendancePdfTemplate");
const { generateDailyAttendancePdf } = require("./dailyAttendancePdfTemplate");
<<<<<<< HEAD
const {
  addAuditCheckoutTimes,
  buildDailyAttendanceByDate,
} = require("../utils/attendanceHistory");
=======
>>>>>>> talenthub/main

const TZ = "Asia/Colombo";

// ── Attendance type sets ──────────────────────────────────────────────────────
/**
 * MEETING types: attendance recorded via QR meeting PIN, face recognition
 * at a meeting, a named meeting session, or admin manual meeting mark.
 *
 * "qr" here = the QR code presented at a specific meeting (meeting PIN QR),
 * NOT the daily check-in QR (that is "daily_qr").
 */
const MEETING_ATTENDANCE_TYPES = new Set([
  "qr", // QR scan at a meeting session
  "face_meeting", // Face recognition at a meeting
  "meeting", // Generic meeting attendance
  "manual_meeting", // Admin manually marks meeting attendance
  "manual", // Legacy manual (treated as meeting)
]);

/**
 * DAILY types: regular daily check-in attendance.
 */
const DAILY_ATTENDANCE_TYPES = new Set([
  "daily", // Standard daily check-in
  "daily_qr", // QR-based daily check-in
  "face", // Face recognition daily check-in
  "manual_daily", // Admin manually marks daily attendance
]);

// ---------------------------------------------------------------------------
// Helper: Sri Lankan Public Holidays
// ---------------------------------------------------------------------------
function getSriLankanHolidays(years) {
  const yearList = Array.isArray(years) ? years : [years];
  const holidays = new Set();

  yearList.forEach((y) => {
    const fixed = [`${y}-01-01`, `${y}-02-04`, `${y}-05-01`, `${y}-12-25`];
    fixed.forEach((d) => holidays.add(d));

    const lunarApprox = {
      2024: [
        "2024-01-15",
        "2024-02-23",
        "2024-03-25",
        "2024-04-12",
        "2024-04-13",
        "2024-04-14",
        "2024-05-23",
        "2024-05-24",
        "2024-06-17",
        "2024-06-21",
        "2024-07-20",
        "2024-08-19",
        "2024-09-17",
        "2024-10-02",
        "2024-10-17",
        "2024-10-31",
        "2024-11-15",
        "2024-12-15",
      ],
      2025: [
        "2025-01-14",
        "2025-02-26",
        "2025-03-14",
        "2025-03-31",
        "2025-04-13",
        "2025-04-14",
        "2025-05-12",
        "2025-05-13",
        "2025-06-06",
        "2025-06-07",
        "2025-07-05",
        "2025-08-03",
        "2025-09-01",
        "2025-09-05",
        "2025-10-01",
        "2025-10-20",
        "2025-10-30",
        "2025-11-29",
      ],
      2026: [
        "2026-01-14",
        "2026-02-15",
        "2026-03-03",
        "2026-03-20",
        "2026-04-02",
        "2026-04-13",
        "2026-04-14",
        "2026-05-01",
        "2026-05-02",
        "2026-05-28",
        "2026-05-30",
        "2026-06-29",
        "2026-07-28",
        "2026-08-27",
        "2026-09-10",
        "2026-09-25",
        "2026-11-09",
        "2026-11-24",
        "2026-12-23",
      ],
    };

    if (lunarApprox[y]) lunarApprox[y].forEach((d) => holidays.add(d));
  });

  return holidays;
}

function getWorkingDaysInTwoWeekRange(startDate, endDate) {
  const years = [];
  for (let y = startDate.year(); y <= endDate.year(); y++) years.push(y);
  const holidays = getSriLankanHolidays(years);

  const workingDays = [];
  const cursor = startDate.clone();
  while (cursor.isSameOrBefore(endDate, "day")) {
    const dayOfWeek = cursor.day();
    const dateStr = cursor.format("YYYY-MM-DD");
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateStr)) {
      workingDays.push(cursor.clone());
    }
    cursor.add(1, "day");
  }
  return workingDays;
}

// ---------------------------------------------------------------------------
// Shared intern detail extractor
// ---------------------------------------------------------------------------
const getInternDetails = (intern) => ({
  _id: intern._id,
  name: intern.Trainee_Name || "Unknown",
  id: intern.Trainee_ID || "Unknown",
  email: intern.Trainee_Email || "",
  fieldOfSpecialization: intern.field_of_spec_name || "Not specified",
  institute: intern.Institute || "Not specified",
  team: intern.team || "Not specified",
  trainingStartDate: intern.Training_StartDate
    ? moment(intern.Training_StartDate).tz(TZ).format("MMM DD, YYYY")
    : "Not specified",
  trainingEndDate: intern.Training_EndDate
    ? moment(intern.Training_EndDate).tz(TZ).format("MMM DD, YYYY")
    : "Not specified",
});

const sortByInternId = (interns) =>
  interns.sort((a, b) =>
    String(a.id).toUpperCase() < String(b.id).toUpperCase() ? -1 : 1,
  );

// ---------------------------------------------------------------------------
// Core helper: Get interns present on a specific date filtered by a type set
// ---------------------------------------------------------------------------
async function getPresentsOnDate(dateStr, attendanceTypeSet) {
  const targetDate = moment.tz(dateStr, "YYYY-MM-DD", TZ).startOf("day");
  const nextDate = targetDate.clone().add(1, "day");

<<<<<<< HEAD
  const typeArray = Array.from(attendanceTypeSet);
  const interns = await Intern.find({
    attendance: {
      $elemMatch: {
        date: { $gte: targetDate.toDate(), $lt: nextDate.toDate() },
        status: "Present",
        type: { $in: typeArray }
      }
    }
  }).lean();

=======
  const interns = await Intern.find({});
>>>>>>> talenthub/main
  const presentInterns = [];

  for (const intern of interns) {
    if (!intern.attendance || intern.attendance.length === 0) continue;

    const matchingRecords = intern.attendance.filter((r) => {
      const recDate = moment(r.date).tz(TZ);
      const type = String(r.type || "").toLowerCase();
      return (
        recDate.isSameOrAfter(targetDate) &&
        recDate.isBefore(nextDate) &&
        r.status === "Present" &&
        attendanceTypeSet.has(type)
      );
    });

    if (matchingRecords.length === 0) continue;

    // Sort by time ascending
    const sorted = [...matchingRecords].sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
    const firstRecord = sorted[0];

    const timeFor = (record) =>
      record.timeMarked
        ? moment(record.timeMarked).tz(TZ).format("hh:mm A")
        : record.date
          ? moment(record.date).tz(TZ).format("hh:mm A")
          : "—";

    if (attendanceTypeSet === MEETING_ATTENDANCE_TYPES) {
      // Build per-meeting breakdown
      const meetings = sorted.map((record) => ({
        meetingName: record.meetingName || "General Meeting",
        timeMarked: timeFor(record),
        type: record.type || "meeting",
      }));

      presentInterns.push({
        ...getInternDetails(intern),
        meetingName: meetings.map((m) => m.meetingName).join(", "),
        meetingCount: meetings.length,
        meetings,
        timeMarked: meetings[0]?.timeMarked || "—",
        type: meetings[0]?.type || "meeting",
        attendanceType: "meeting",
      });
    } else {
      // Daily — just the first (or only) check-in record matters
      presentInterns.push({
        ...getInternDetails(intern),
        timeMarked: timeFor(firstRecord),
        type: firstRecord.type || "daily",
        attendanceType: "daily",
      });
    }
  }

  presentInterns.sort((a, b) =>
    String(a.id).toUpperCase() < String(b.id).toUpperCase() ? -1 : 1,
  );

  return presentInterns;
}

// ---------------------------------------------------------------------------
// Daily attendance helper — also checks DailyRecord for older logbook-backed
// records in addition to Intern.attendance
// ---------------------------------------------------------------------------
async function getDailyPresentsOnDate(dateStr) {
  const targetDate = moment.tz(dateStr, "YYYY-MM-DD", TZ).startOf("day");
  const nextDate = targetDate.clone().add(1, "day");
<<<<<<< HEAD
  // Also check DailyRecord for logbook-backed attendance first
  const [dailyRecords, successfulFaceLogs] = await Promise.all([
    DailyRecord.find({
      date: dateStr,
      attendance: { $in: ["present", "late"] },
    }).lean(),
    FaceAttendanceLog.find({
      attendanceDate: dateStr,
      status: "present",
      method: "face",
    }).lean(),
  ]);

  // FaceAttendanceLog is the authoritative audit trail for the scanner used.
  // It also repairs report labels for older records that were successfully
  // scanned by face recognition but remained tagged as daily_qr.
  const dailyFaceInternIds = new Set(
    successfulFaceLogs
      .filter((log) => {
        const attendanceType = String(log.metadata?.attendanceType || "daily").toLowerCase();
        return attendanceType === "daily" || log.metadata?.dailyAttendanceMarked === true;
      })
      .map((log) => String(log.internId)),
  );
  const dailyFaceLogsByIntern = new Map();
  successfulFaceLogs.forEach((log) => {
    const attendanceType = String(
      log.metadata?.attendanceType || "daily",
    ).toLowerCase();
    if (attendanceType !== "daily") return;

    const internId = String(log.internId);
    const internLogs = dailyFaceLogsByIntern.get(internId) || [];
    internLogs.push(log);
    dailyFaceLogsByIntern.set(internId, internLogs);
  });

  const dailyRecordInternIds = dailyRecords.map(r => r.internId);

  const typeArray = Array.from(DAILY_ATTENDANCE_TYPES);
  const interns = await Intern.find({
    $or: [
      {
        attendance: {
          $elemMatch: {
            date: { $gte: targetDate.toDate(), $lt: nextDate.toDate() },
            status: "Present",
            type: { $in: typeArray }
          }
        }
      },
      { _id: { $in: dailyRecordInternIds } }
    ]
  }).lean();

=======
  const interns = await Intern.find({});
>>>>>>> talenthub/main
  const internById = new Map(
    interns.map((intern) => [String(intern._id), intern]),
  );
  const dailyByIntern = new Map();

  for (const intern of interns) {
    const records = (intern.attendance || []).filter((record) => {
      const type = String(record.type || "").toLowerCase();
      const recordDate = moment(record.date).tz(TZ);
      return (
        DAILY_ATTENDANCE_TYPES.has(type) &&
        record.status === "Present" &&
        recordDate.isSameOrAfter(targetDate) &&
        recordDate.isBefore(nextDate)
      );
    });

    if (records.length === 0) continue;
<<<<<<< HEAD
    const internId = String(intern._id);
    const attendanceByDate = buildDailyAttendanceByDate(
      records,
      DAILY_ATTENDANCE_TYPES,
    );
    addAuditCheckoutTimes(
      attendanceByDate,
      dailyFaceLogsByIntern.get(internId),
    );
    const reconciledAttendance = attendanceByDate.get(dateStr);
    if (!reconciledAttendance) continue;

    const latest = reconciledAttendance.entry;
    dailyByIntern.set(internId, {
      ...getInternDetails(intern),
      timeMarked: moment(reconciledAttendance.markedAt || latest.date)
        .tz(TZ)
        .format("hh:mm A"),
      checkOutTime: reconciledAttendance.checkOutTime
        ? moment(reconciledAttendance.checkOutTime).tz(TZ).format("hh:mm A")
=======
    const latest = records.sort(
      (a, b) =>
        new Date(b.timeMarked || b.date).getTime() -
        new Date(a.timeMarked || a.date).getTime(),
    )[0];
    dailyByIntern.set(String(intern._id), {
      ...getInternDetails(intern),
      timeMarked: moment(latest.timeMarked || latest.date)
        .tz(TZ)
        .format("hh:mm A"),
      checkOutTime: latest.checkOutTime
        ? moment(latest.checkOutTime).tz(TZ).format("hh:mm A")
>>>>>>> talenthub/main
        : null,
      type: latest.type || "daily",
      status: "Present",
      attendanceType: "daily",
    });
  }

<<<<<<< HEAD
  // dailyRecords are already fetched at the start of the function
=======
  // Also check DailyRecord for logbook-backed attendance
  const dailyRecords = await DailyRecord.find({
    date: dateStr,
    attendance: { $in: ["present", "late"] },
  });
>>>>>>> talenthub/main

  for (const record of dailyRecords) {
    const key = String(record.internId);
    if (dailyByIntern.has(key)) continue;
    const intern = internById.get(key);
    if (!intern) continue;
    dailyByIntern.set(key, {
      ...getInternDetails(intern),
      timeMarked: record.attendanceTime
        ? moment(record.attendanceTime).tz(TZ).format("hh:mm A")
        : "—",
      checkOutTime: record.checkOutTime
        ? moment(record.checkOutTime).tz(TZ).format("hh:mm A")
        : null,
      type: "daily",
      status: record.attendance === "late" ? "Late" : "Present",
      attendanceType: "daily",
    });
  }

<<<<<<< HEAD
  for (const internId of dailyFaceInternIds) {
    const attendance = dailyByIntern.get(internId);
    if (attendance) {
      dailyByIntern.set(internId, { ...attendance, type: "face" });
    }
  }

=======
>>>>>>> talenthub/main
  return sortByInternId([...dailyByIntern.values()]);
}

// ---------------------------------------------------------------------------
// GET /admin/attendance/by-date?date=YYYY-MM-DD
// Returns BOTH meeting and daily attendance for a date (combined response)
// ---------------------------------------------------------------------------
exports.getAttendanceByDate = async (req, res) => {
  try {
    const dateStr = req.query.date;
    if (!dateStr)
      return res
        .status(400)
        .json({ error: "date query param required (YYYY-MM-DD)" });

    const [meetingInterns, dailyInterns] = await Promise.all([
      getPresentsOnDate(dateStr, MEETING_ATTENDANCE_TYPES),
      getDailyPresentsOnDate(dateStr),
    ]);

    return res.json({
      date: dateStr,
      count: meetingInterns.length,
      interns: meetingInterns,
      meetingCount: meetingInterns.length,
      meetingInterns,
      dailyCount: dailyInterns.length,
      dailyInterns,
    });
  } catch (err) {
    console.error("getAttendanceByDate error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// GET /admin/attendance/by-date-daily?date=YYYY-MM-DD
// Returns DAILY attendance for a date
// ---------------------------------------------------------------------------
exports.getAttendanceByDateDaily = async (req, res) => {
  try {
    const dateStr = req.query.date;
    if (!dateStr)
      return res
        .status(400)
        .json({ error: "date query param required (YYYY-MM-DD)" });

    const presentInterns = await getDailyPresentsOnDate(dateStr);
    return res.json({
      date: dateStr,
      count: presentInterns.length,
      interns: presentInterns,
    });
  } catch (err) {
    console.error("getAttendanceByDateDaily error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// POST /admin/attendance/trigger-report
// ---------------------------------------------------------------------------
exports.triggerAttendanceReport = async (req, res) => {
  try {
    const recipients = req.body?.recipients || ["dimalshacooray@gmail.com"];
    const result =
      await WeeklyMeetingAttendanceService.performWeeklyMeetingAttendanceCheck(
        recipients,
        "manual",
      );
    return res.json({
      success: true,
      message: "Attendance report triggered successfully",
      result,
    });
  } catch (err) {
    console.error("triggerAttendanceReport error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /admin/attendance/export-meeting-pdf?date=YYYY-MM-DD
// Exports MEETING attendance as a PDF matching the SLTMobitel template
// ---------------------------------------------------------------------------
exports.exportMeetingAttendancePdf = async (req, res) => {
  try {
    const dateStr = req.query.date;
    if (!dateStr)
      return res
        .status(400)
        .json({ error: "date query param required (YYYY-MM-DD)" });

    const presentInterns = await getPresentsOnDate(
      dateStr,
      MEETING_ATTENDANCE_TYPES,
    );

    const pdfBuffer = await generateMeetingAttendancePdf({
      date: dateStr,
      interns: presentInterns,
    });

    const filename = `Meeting_Attendance_Report_${dateStr}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("exportMeetingAttendancePdf error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// GET /admin/attendance/export-daily-pdf?date=YYYY-MM-DD
// Exports DAILY attendance as a PDF matching the SLTMobitel template
// ---------------------------------------------------------------------------
exports.exportDailyAttendancePdf = async (req, res) => {
  try {
    const dateStr = req.query.date;
    if (!dateStr)
      return res
        .status(400)
        .json({ error: "date query param required (YYYY-MM-DD)" });

    const presentInterns = await getDailyPresentsOnDate(dateStr);

    const pdfBuffer = await generateDailyAttendancePdf({
      date: dateStr,
      interns: presentInterns,
    });

    const filename = `Daily_Attendance_Report_${dateStr}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("exportDailyAttendancePdf error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// GET /admin/attendance/export-non-attendance-excel
// ---------------------------------------------------------------------------
exports.exportNonAttendanceExcel = async (req, res) => {
  try {
    const { startDate, endDate } =
      WeeklyMeetingAttendanceService.getTwoWeekRange();

    const activeInterns =
      await WeeklyMeetingAttendanceService.getActiveInterns();

    const hasAttendedMeeting = (intern) => {
      if (!intern.attendance || intern.attendance.length === 0) return false;
      const workingDays = getWorkingDaysInTwoWeekRange(startDate, endDate);
      const workingDayStrings = new Set(
        workingDays.map((d) => d.format("YYYY-MM-DD")),
      );
      return intern.attendance.some((record) => {
        const recordDate = moment(record.date).tz(TZ).format("YYYY-MM-DD");
        const recordType = String(record.type || "").toLowerCase();
        return (
          record.status === "Present" &&
          MEETING_ATTENDANCE_TYPES.has(recordType) &&
          workingDayStrings.has(recordDate)
        );
      });
    };

    const talentTrailDocs = await InternTalentTrailSync.find({});
    const projectsByEmail = {};
    for (const doc of talentTrailDocs) {
      const email = String(doc.email || "").toLowerCase();
      const projectNames = (doc.projects || []).map((p) => p.projectName);
      if (!projectsByEmail[email]) projectsByEmail[email] = [];
      projectsByEmail[email].push(...projectNames);
    }

<<<<<<< HEAD
    const workingDays = getWorkingDaysInTwoWeekRange(startDate, endDate);
    const workingDayStrings = workingDays.map((d) => d.format("YYYY-MM-DD"));

    const nonAttendees = [];
    for (const intern of activeInterns) {
      if (WeeklyMeetingAttendanceService.isNewIntern(intern)) continue;

      const hasExtendedLeave = await WeeklyMeetingAttendanceService.hasApprovedExtendedLeaveForPeriod(
        intern._id,
        workingDayStrings,
      );
      if (hasExtendedLeave) continue;

=======
    const nonAttendees = [];
    for (const intern of activeInterns) {
      if (WeeklyMeetingAttendanceService.isNewIntern(intern)) continue;
>>>>>>> talenthub/main
      if (hasAttendedMeeting(intern)) continue;

      const lastRecord =
        WeeklyMeetingAttendanceService.getLastAttendedMeeting(intern);
      const lastMeetingDate = lastRecord
<<<<<<< HEAD
        ? moment(lastRecord.date).tz(TZ).format("MMM DD, YYYY")
=======
        ? `${moment(lastRecord.date).tz(TZ).format("MMM DD, YYYY")}${lastRecord.meetingName ? ` — ${lastRecord.meetingName}` : ""}`
>>>>>>> talenthub/main
        : "No record found";

      const internEmail = String(
        WeeklyMeetingAttendanceService.getInternEmail(intern),
      ).toLowerCase();
      const projectList = projectsByEmail[internEmail] || [];
      const projectsString =
        projectList.length > 0 ? projectList.join(", ") : "Not assigned";

      nonAttendees.push({
        name: WeeklyMeetingAttendanceService.getInternName(intern),
        id: WeeklyMeetingAttendanceService.getInternId(intern),
        email: WeeklyMeetingAttendanceService.getInternEmail(intern),
        fieldOfSpecialization: intern.field_of_spec_name || "Not specified",
        institute: intern.Institute || "Not specified",
        projects: projectsString,
        trainingStartDate: intern.Training_StartDate
          ? moment(intern.Training_StartDate).tz(TZ).format("MMM DD, YYYY")
          : "Not specified",
        trainingEndDate: intern.Training_EndDate
          ? moment(intern.Training_EndDate).tz(TZ).format("MMM DD, YYYY")
          : "Not specified",
        lastMeetingDate,
      });
    }

    nonAttendees.sort((a, b) =>
      String(a.id).toUpperCase() < String(b.id).toUpperCase() ? -1 : 1,
    );

    const excelData = [];
    excelData.push([
      "NON-ATTENDANCE REPORT (MEETING ATTENDANCE - PAST 14 DAYS)",
    ]);
    excelData.push(["TalentHub Intern Management System"]);
    excelData.push([]);
    excelData.push([
      "Report Generated:",
      moment().tz(TZ).format("MMMM DD, YYYY [at] HH:mm"),
    ]);
    excelData.push([
      "Period:",
      `${startDate.format("MMM DD, YYYY")} – ${endDate.format("MMM DD, YYYY")}`,
    ]);
    excelData.push(["Total Non-Attendees (Meetings):", nonAttendees.length]);
    excelData.push([]);
    excelData.push([]);
    excelData.push([
      "No.",
      "Intern Name",
      "Trainee ID",
      "Email Address",
      "Field of Specialization",
      "Institute",
      "Projects",
      "Training Start Date",
      "Training End Date",
      "Last Meeting Attended",
    ]);

    nonAttendees.forEach((intern, index) => {
      excelData.push([
        index + 1,
        intern.name,
        intern.id,
        intern.email,
        intern.fieldOfSpecialization,
        intern.institute,
        intern.projects,
        intern.trainingStartDate,
        intern.trainingEndDate,
        intern.lastMeetingDate,
      ]);
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    worksheet["!cols"] = [
      { wch: 5 },
      { wch: 25 },
      { wch: 15 },
      { wch: 30 },
      { wch: 25 },
      { wch: 30 },
      { wch: 35 },
      { wch: 20 },
      { wch: 20 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Non-Attendance Report");

    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const todayStr = moment().tz(TZ).format("YYYY-MM-DD");
    const filename = `Non_Attendance_Report_${todayStr}.xlsx`;
    const filePath = path.join(tempDir, filename);
    XLSX.writeFile(workbook, filePath);

    res.download(filePath, filename, (err) => {
      if (err) console.error("Non-attendance Excel download error:", err);
      try {
        fs.unlinkSync(filePath);
<<<<<<< HEAD
      } catch (_) { }
=======
      } catch (_) {}
>>>>>>> talenthub/main
    });
  } catch (err) {
    console.error("exportNonAttendanceExcel error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
