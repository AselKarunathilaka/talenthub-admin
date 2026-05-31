const Intern = require("../models/Intern");
const InternTalentTrailSync = require("../models/InternTalentTrailSync");
const DailyRecord = require("../models/DailyRecord");
const moment = require("moment-timezone");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const WeeklyMeetingAttendanceService = require("../services/weeklymeetingattendanceservice");

const TZ = "Asia/Colombo";
const DAILY_ATTENDANCE_TYPES = new Set(["daily", "daily_qr", "face"]);

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

// Daily QR and face records are stored on Intern. DailyRecord is also checked
// so logbook-backed attendance remains visible for older records.
async function getDailyPresentsOnDate(dateStr) {
  const targetDate = moment.tz(dateStr, "YYYY-MM-DD", TZ).startOf("day");
  const nextDate = targetDate.clone().add(1, "day");
  const interns = await Intern.find({});
  const internById = new Map(interns.map((intern) => [String(intern._id), intern]));
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
    const latest = records.sort(
      (a, b) =>
        new Date(b.timeMarked || b.date).getTime() -
        new Date(a.timeMarked || a.date).getTime(),
    )[0];
    dailyByIntern.set(String(intern._id), {
      ...getInternDetails(intern),
      timeMarked: moment(latest.timeMarked || latest.date).tz(TZ).format("HH:mm"),
      type: latest.type || "daily",
      status: "Present",
    });
  }

  const dailyRecords = await DailyRecord.find({
    date: dateStr,
    attendance: { $in: ["present", "late"] },
  });

  for (const record of dailyRecords) {
    const key = String(record.internId);
    if (dailyByIntern.has(key)) continue;
    const intern = internById.get(key);
    if (!intern) continue;
    dailyByIntern.set(key, {
      ...getInternDetails(intern),
      timeMarked: record.attendanceTime
        ? moment(record.attendanceTime).tz(TZ).format("HH:mm")
        : "—",
      type: "daily",
      status: record.attendance === "late" ? "Late" : "Present",
    });
  }

  return sortByInternId([...dailyByIntern.values()]);
}

// Meeting attendance types (excludes daily/face recognition only)
const MEETING_ATTENDANCE_TYPES = new Set([
  "qr",
  "face_meeting",
  "meeting",
  "manual_meeting",
  "manual",
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

    if (lunarApprox[y]) {
      lunarApprox[y].forEach((d) => holidays.add(d));
    }
  });

  return holidays;
}

// Helper: Get working days in two-week range
function getWorkingDaysInTwoWeekRange(startDate, endDate) {
  const years = [];
  for (let y = startDate.year(); y <= endDate.year(); y++) years.push(y);
  const holidays = getSriLankanHolidays(years);

  const workingDays = [];
  const cursor = startDate.clone();

  while (cursor.isSameOrBefore(endDate, "day")) {
    const dayOfWeek = cursor.day();
    const dateStr = cursor.format("YYYY-MM-DD");
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidays.has(dateStr);

    if (!isWeekend && !isHoliday) {
      workingDays.push(cursor.clone());
    }

    cursor.add(1, "day");
  }

  return workingDays;
}

// ---------------------------------------------------------------------------
// Helper: Get interns present on a specific date (LKT-aware)
// ---------------------------------------------------------------------------
async function getPresentsOnDate(dateStr) {
  const targetDate = moment.tz(dateStr, "YYYY-MM-DD", TZ).startOf("day");
  const nextDate = targetDate.clone().add(1, "day");

  const interns = await Intern.find({});
  const presentInterns = [];

  for (const intern of interns) {
    if (!intern.attendance || intern.attendance.length === 0) continue;

    const meetingRecords = intern.attendance.filter((r) => {
      const recDate = moment(r.date).tz(TZ);
      const type = String(r.type || "").toLowerCase();
      return (
        recDate.isSameOrAfter(targetDate) &&
        recDate.isBefore(nextDate) &&
        r.status === "Present" &&
        MEETING_ATTENDANCE_TYPES.has(type)
      );
    });

    if (meetingRecords.length > 0) {
      const meetings = meetingRecords
        .map((record) => ({
          meetingName: record.meetingName || "General Meeting",
          timeMarked: record.timeMarked
            ? moment(record.timeMarked).tz(TZ).format("HH:mm")
            : record.date
              ? moment(record.date).tz(TZ).format("HH:mm")
              : "—",
          type: record.type || "meeting",
        }))
        .sort((a, b) => a.timeMarked.localeCompare(b.timeMarked));
      const firstMeeting = meetings[0];

      presentInterns.push({
        ...getInternDetails(intern),
        meetingName: meetings.map((meeting) => meeting.meetingName).join(", "),
        meetingCount: meetings.length,
        meetings,
        timeMarked: firstMeeting?.timeMarked || "—",
        type: firstMeeting?.type || "meeting",
      });
    }
  }

  return sortByInternId(presentInterns);
}

// ---------------------------------------------------------------------------
// GET /admin/attendance/by-date?date=YYYY-MM-DD
// ---------------------------------------------------------------------------
exports.getAttendanceByDate = async (req, res) => {
  try {
    const dateStr = req.query.date;
    if (!dateStr) {
      return res
        .status(400)
        .json({ error: "date query param required (YYYY-MM-DD)" });
    }

    const [meetingInterns, dailyInterns] = await Promise.all([
      getPresentsOnDate(dateStr),
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
// POST /admin/attendance/trigger-report
// Manually triggers the same weekly non-attendance email + Excel that the
// cron job sends. Accepts an optional { recipients: [...] } body.
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
// GET /admin/attendance/export-excel?date=YYYY-MM-DD
// Downloads an Excel file of all interns present on the given date.
// ---------------------------------------------------------------------------
exports.exportAttendanceExcel = async (req, res) => {
  try {
    const dateStr = req.query.date;
    if (!dateStr) {
      return res
        .status(400)
        .json({ error: "date query param required (YYYY-MM-DD)" });
    }

    const presentInterns = await getPresentsOnDate(dateStr);

    const excelData = [];
    excelData.push(["MEETING ATTENDANCE REPORT"]);
    excelData.push(["TalentHub Intern Management System"]);
    excelData.push([]);
    excelData.push([
      "Report Generated:",
      moment().tz(TZ).format("MMMM DD, YYYY [at] HH:mm"),
    ]);
    excelData.push([
      "Date:",
      moment.tz(dateStr, "YYYY-MM-DD", TZ).format("MMMM DD, YYYY"),
    ]);
    excelData.push(["Total Present:", presentInterns.length]);
    excelData.push([]);
    excelData.push([]);
    excelData.push([
      "No.",
      "Intern Name",
      "Trainee ID",
      "Email Address",
      "Field of Specialization",
      "Institute",
      "Team",
      "Training Start Date",
      "Training End Date",
      "Meeting Count",
      "Meeting Names",
      "Meeting Times",
    ]);

    presentInterns.forEach((intern, index) => {
      excelData.push([
        index + 1,
        intern.name,
        intern.id,
        intern.email,
        intern.fieldOfSpecialization,
        intern.institute,
        intern.team,
        intern.trainingStartDate,
        intern.trainingEndDate,
        intern.meetingCount,
        intern.meetingName,
        intern.meetings.map((meeting) => meeting.timeMarked).join(", "),
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
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 25 },
      { wch: 12 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report");

    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const filename = `Attendance_Report_${dateStr}.xlsx`;
    const filePath = path.join(tempDir, filename);
    XLSX.writeFile(workbook, filePath);

    res.download(filePath, filename, (err) => {
      if (err) console.error("Excel download error:", err);
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
    });
  } catch (err) {
    console.error("exportAttendanceExcel error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// GET /admin/attendance/export-non-attendance-excel
// Downloads an Excel file of interns who missed meetings in the past 14
// working days. Only checks MEETING attendance types (qr, face_meeting, meeting,
// manual_meeting, manual). Includes projects from InternTalentTrailSync.
// ---------------------------------------------------------------------------
exports.exportNonAttendanceExcel = async (req, res) => {
  try {
    // ── 1. Reuse the service's date-range helper ──────────────────────────
    const { startDate, endDate } =
      WeeklyMeetingAttendanceService.getTwoWeekRange();

    // ── 2. Fetch active interns ────────────────────────────────────────────
    const activeInterns =
      await WeeklyMeetingAttendanceService.getActiveInterns();

    // ── 3. Helper function to check meeting attendance ────────────────────
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

    // ── 4. Build project lookup from InternTalentTrailSync ────────────────
    const talentTrailDocs = await InternTalentTrailSync.find({});
    const projectsByEmail = {};

    for (const doc of talentTrailDocs) {
      const email = String(doc.email || "").toLowerCase();
      const projectNames = (doc.projects || []).map((p) => p.projectName);

      if (!projectsByEmail[email]) {
        projectsByEmail[email] = [];
      }
      projectsByEmail[email].push(...projectNames);
    }

    // ── 5. Filter non-attendees ────────────────────────────────────────────
    const nonAttendees = [];

    for (const intern of activeInterns) {
      // Skip new interns
      if (WeeklyMeetingAttendanceService.isNewIntern(intern)) continue;

      // Skip interns who attended at least one meeting in the window
      if (hasAttendedMeeting(intern)) continue;

      // Build the last-attended label (from any meeting type)
      const lastRecord =
        WeeklyMeetingAttendanceService.getLastAttendedMeeting(intern);
      const lastMeetingDate = lastRecord
        ? `${moment(lastRecord.date).tz(TZ).format("MMM DD, YYYY")}${lastRecord.meetingName ? ` — ${lastRecord.meetingName}` : ""}`
        : "No record found";

      // Get projects from InternTalentTrailSync
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

    // Sort by Trainee ID ascending
    nonAttendees.sort((a, b) =>
      String(a.id).toUpperCase() < String(b.id).toUpperCase() ? -1 : 1,
    );

    // ── 6. Build Excel ────────────────────────────────────────────────────
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
    excelData.push([
      "Note: This report only considers MEETING attendance. Weekends, Sri Lankan public holidays, and new interns (training started within the period) are excluded.",
    ]);
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
      } catch (_) {}
    });
  } catch (err) {
    console.error("exportNonAttendanceExcel error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
