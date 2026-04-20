const Intern = require("../models/Intern");
const moment = require("moment");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const WeeklyMeetingAttendanceService = require("../services/weeklymeetingattendanceservice");

// ---------------------------------------------------------------------------
// Helper: Get interns present on a specific date
// ---------------------------------------------------------------------------
async function getPresentsOnDate(dateStr) {
  const targetDate = moment(dateStr, "YYYY-MM-DD").startOf("day");
  const nextDate = targetDate.clone().add(1, "day");

  const interns = await Intern.find({});

  const presentInterns = [];

  for (const intern of interns) {
    if (!intern.attendance || intern.attendance.length === 0) continue;

    const record = intern.attendance.find((r) => {
      const recDate = moment(r.date);
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
          ? moment(intern.Training_StartDate).format("MMM DD, YYYY")
          : "Not specified",
        trainingEndDate: intern.Training_EndDate
          ? moment(intern.Training_EndDate).format("MMM DD, YYYY")
          : "Not specified",
        meetingName: record.meetingName || "—",
        timeMarked: record.timeMarked
          ? moment(record.timeMarked).format("hh:mm A")
          : "—",
        type: record.type || "manual",
      });
    }
  }

  // Sort by Trainee ID ascending
  presentInterns.sort((a, b) => {
    const idA = String(a.id).toUpperCase();
    const idB = String(b.id).toUpperCase();
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });

  return presentInterns;
}

// ---------------------------------------------------------------------------
// GET /admin/attendance/by-date?date=YYYY-MM-DD
// Returns the list of interns who were marked Present on the given date.
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
    const recipients = req.body?.recipients || ["dimalshacooray@gmail.com"]; // default dev address

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
      moment().format("MMMM DD, YYYY [at] h:mm A"),
    ]);
    excelData.push(["Date:", moment(dateStr).format("MMMM DD, YYYY")]);
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
exports.exportNonAttendanceExcel = async (req, res) => {
  try {
    const today = moment().startOf("day");
    const fourteenDaysAgo = today.clone().subtract(14, "days");

    // ── Mirror the exact working-day + holiday logic from the service ──────
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

    const years = [];
    for (let y = fourteenDaysAgo.year(); y <= today.year(); y++) years.push(y);
    const holidays = getSriLankanHolidays(years);

    const workingDayStrings = new Set();
    const cursor = fourteenDaysAgo.clone();
    while (cursor.isSameOrBefore(today, "day")) {
      const dow = cursor.day();
      const dateStr = cursor.format("YYYY-MM-DD");
      if (dow !== 0 && dow !== 6 && !holidays.has(dateStr)) {
        workingDayStrings.add(dateStr);
      }
      cursor.add(1, "day");
    }
    // ───────────────────────────────────────────────────────────────────────

    const interns = await Intern.find({});
    const nonAttendees = [];

    for (const intern of interns) {
      // ── Skip new interns whose training started within the 14-day window ─
      // Identical to WeeklyMeetingAttendanceService.isNewIntern()
      if (intern.Training_StartDate) {
        const trainingStart = moment(intern.Training_StartDate).startOf("day");
        if (trainingStart.isSameOrAfter(fourteenDaysAgo)) continue;
      }

      // ── Check attendance on working days only (mirrors the service) ───────
      const attendedOnWorkingDay = (intern.attendance || []).some((r) => {
        const dateStr = moment(r.date).format("YYYY-MM-DD");
        return workingDayStrings.has(dateStr) && r.status === "Present";
      });

      if (!attendedOnWorkingDay) {
        // Find the most recent Present record across ALL time
        const allPresentRecords = (intern.attendance || []).filter(
          (r) => r.status === "Present",
        );

        let lastMeetingDate = "No record";
        if (allPresentRecords.length > 0) {
          const latest = allPresentRecords.reduce((a, b) =>
            moment(a.date).isAfter(moment(b.date)) ? a : b,
          );
          // Mirror the service label: date + meeting name if available
          lastMeetingDate = moment(latest.date).format("MMM DD, YYYY");
          if (latest.meetingName) {
            lastMeetingDate += ` — ${latest.meetingName}`;
          }
        }

        nonAttendees.push({
          name: intern.Trainee_Name || "Unknown",
          id: intern.Trainee_ID || "Unknown",
          email: intern.Trainee_Email || "",
          fieldOfSpecialization: intern.field_of_spec_name || "Not specified",
          institute: intern.Institute || "Not specified",
          team: intern.team || "Not specified",
          trainingStartDate: intern.Training_StartDate
            ? moment(intern.Training_StartDate).format("MMM DD, YYYY")
            : "Not specified",
          trainingEndDate: intern.Training_EndDate
            ? moment(intern.Training_EndDate).format("MMM DD, YYYY")
            : "Not specified",
          lastMeetingDate,
        });
      }
    }

    // Sort by Trainee ID ascending — same as the service
    nonAttendees.sort((a, b) =>
      String(a.id).toUpperCase() < String(b.id).toUpperCase() ? -1 : 1,
    );

    const excelData = [];
    excelData.push(["NON-ATTENDANCE REPORT (PAST 14 DAYS)"]);
    excelData.push(["TalentHub Intern Management System"]);
    excelData.push([]);
    excelData.push([
      "Report Generated:",
      moment().format("MMMM DD, YYYY [at] h:mm A"),
    ]);
    excelData.push([
      "Period:",
      `${fourteenDaysAgo.format("MMM DD, YYYY")} – ${today.format("MMM DD, YYYY")}`,
    ]);
    excelData.push(["Working Days in Window:", workingDayStrings.size]);
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
      { wch: 30 }, // wider to fit "MMM DD, YYYY — Meeting Name"
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Non-Attendance Report");

    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const today_str = moment().format("YYYY-MM-DD");
    const filename = `Non_Attendance_Report_${today_str}.xlsx`;
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
