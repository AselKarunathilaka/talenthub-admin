const Intern = require("../models/Intern");
const moment = require("moment-timezone");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const WeeklyMeetingAttendanceService = require("../services/weeklymeetingattendanceservice");

const TZ = "Asia/Colombo";

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

    const record = intern.attendance.find((r) => {
      const recDate = moment(r.date).tz(TZ);
      return (
        recDate.isSameOrAfter(targetDate) &&
        recDate.isBefore(nextDate) &&
        r.status === "Present"
      );
    });

    if (record) {
      presentInterns.push({
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
        meetingName: record.meetingName || "—",
        timeMarked: record.timeMarked
          ? moment(record.timeMarked).tz(TZ).format("hh:mm A")
          : "—",
        type: record.type || "manual",
      });
    }
  }

  presentInterns.sort((a, b) =>
    String(a.id).toUpperCase() < String(b.id).toUpperCase() ? -1 : 1,
  );

  return presentInterns;
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

    const presentInterns = await getPresentsOnDate(dateStr);

    return res.json({
      date: dateStr,
      count: presentInterns.length,
      interns: presentInterns,
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
      moment().tz(TZ).format("MMMM DD, YYYY [at] h:mm A"),
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
      "Meeting Name",
      "Time Marked",
      "Type",
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
        intern.meetingName,
        intern.timeMarked,
        intern.type,
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
// working days. Delegates all filtering logic to WeeklyMeetingAttendanceService
// so there is a single source of truth for holidays, working-day calculation,
// new-intern exclusion, and non-attendance detection.
// ---------------------------------------------------------------------------
exports.exportNonAttendanceExcel = async (req, res) => {
  try {
    // ── 1. Reuse the service's date-range helper ──────────────────────────
    const { startDate, endDate } =
      WeeklyMeetingAttendanceService.getTwoWeekRange();

    // ── 2. Fetch and filter interns via the service ───────────────────────
    const activeInterns =
      await WeeklyMeetingAttendanceService.getActiveInterns();

    const nonAttendees = [];

    for (const intern of activeInterns) {
      // Skip interns whose training started within the review window
      if (WeeklyMeetingAttendanceService.isNewIntern(intern)) continue;

      // Skip interns who attended at least one meeting in the window
      if (
        WeeklyMeetingAttendanceService.hasAttendedMeetingInPastTwoWeeks(intern)
      )
        continue;

      // Build the last-attended label (same logic as the service's main loop)
      const lastRecord =
        WeeklyMeetingAttendanceService.getLastAttendedMeeting(intern);
      const lastMeetingDate = lastRecord
        ? `${moment(lastRecord.date).tz(TZ).format("MMM DD, YYYY")}${lastRecord.meetingName ? ` — ${lastRecord.meetingName}` : ""}`
        : "No record found";

      nonAttendees.push({
        name: WeeklyMeetingAttendanceService.getInternName(intern),
        id: WeeklyMeetingAttendanceService.getInternId(intern),
        email: WeeklyMeetingAttendanceService.getInternEmail(intern),
        fieldOfSpecialization: intern.field_of_spec_name || "Not specified",
        institute: intern.Institute || "Not specified",
        team: intern.team || "Not specified",
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

    // ── 3. Build Excel ────────────────────────────────────────────────────
    const excelData = [];
    excelData.push(["NON-ATTENDANCE REPORT (PAST 14 DAYS)"]);
    excelData.push(["TalentHub Intern Management System"]);
    excelData.push([]);
    excelData.push([
      "Report Generated:",
      moment().tz(TZ).format("MMMM DD, YYYY [at] h:mm A"),
    ]);
    excelData.push([
      "Period:",
      `${startDate.format("MMM DD, YYYY")} – ${endDate.format("MMM DD, YYYY")}`,
    ]);
    excelData.push(["Total Non-Attendees:", nonAttendees.length]);
    excelData.push([]);
    excelData.push([
      "Note: Weekends, Sri Lankan public holidays, and new interns (training started within the period) are excluded.",
    ]);
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
        intern.team,
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
      { wch: 20 },
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
