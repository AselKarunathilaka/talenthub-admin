const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const fs = require("fs");
const path = require("path");

const {
  getDashboardStats,
  getInternReport,
  sendOverdueNotifications,
  getInternDetails,
  searchInterns,
  getAllDailyRecords,
  getNonSubmissionsWithinAWeek,
  getWeeklyNonSubmissions,
  syncWithSLTAPI,
  triggerWeeklyNonSubmissionCheck,
  triggerWeeklyNonSubmissionCheckWithExcel,
  getAdminInternLocations,
  getDistrictCounts,
  getInternLocationById,
  triggerApprovedShortLeaveEmail,
} = require("../controllers/adminController");
const {
  getPastInternLocations,
  getPastInternDistrictCounts,
  getPastInternSyncStats,
} = require("../controllers/pastInternController");
const {
  exportOnLeaveExcel,
} = require("../controllers/onLeaveExportController");
const {
  createAnnouncement,
  getAllAnnouncements,
  deleteAnnouncement,
} = require("../controllers/AnnouncementController");

const {
  getAttendanceByDate,
  triggerAttendanceReport,
  exportAttendanceExcel,
  exportNonAttendanceExcel,
} = require("../controllers/admininternAttendanceController");
const {
  getAttendanceSettings,
  updateAttendanceSettings,
} = require("../controllers/attendanceSettingsController");
const {
  getCurrentMeetingPin,
  stopCurrentMeetingPin,
} = require("../controllers/faceAttendanceController");

const { getCertificateData } = require("../controllers/certificateController");

const { syncTalentTrailData } = require("../services/talentTrailSyncService");

// ── Public routes (no auth) ───────────────────────────────────────────────────
// Export on-leave interns as Excel
router.get("/on-leave/export", exportOnLeaveExcel);

// ── All routes below require authentication ───────────────────────────────────
router.use(authMiddleware);

// Dashboard statistics
router.get("/dashboard/stats", getDashboardStats);

// Search interns
router.get("/search/interns", searchInterns);

// Intern report (for CSV export)
router.get("/report/interns", getInternReport);

// Get all daily records
router.get("/daily-records", getAllDailyRecords);

// Get non-submissions within a week from current date (last 5 working days)
router.get("/non-submissions-within-week", getNonSubmissionsWithinAWeek);

// Get weekly non-submissions (Monday to Friday of current week)
router.get("/weekly-non-submissions", getWeeklyNonSubmissions);

// Send notifications to overdue interns
router.post("/notifications/overdue", sendOverdueNotifications);

// Get individual intern details
router.get("/intern/:internId", getInternDetails);

// Get certificate data (enriched from TalentTrail)
router.get("/intern/:internId/certificate-data", getCertificateData);

// Manually trigger SLT API sync
router.post("/sync/slt-api", syncWithSLTAPI);

// Manually trigger weekly non-submission check
router.post(
  "/trigger/weekly-non-submission-check",
  triggerWeeklyNonSubmissionCheck,
);

// Manually trigger weekly non-submission check with Excel attachment
router.post(
  "/trigger/weekly-non-submission-check-excel",
  triggerWeeklyNonSubmissionCheckWithExcel,
);

// Manually trigger approved short leave email (1:30 PM report)
router.post(
  "/trigger/approved-short-leave-email",
  triggerApprovedShortLeaveEmail,
);

router.get("/intern-locations", getAdminInternLocations);
router.get("/district-counts", getDistrictCounts);
router.get("/intern-location/:traineeId", getInternLocationById);

// Past intern locations (served from DB — instant)
router.get("/past-intern-locations", getPastInternLocations);
router.get("/past-intern-district-counts", getPastInternDistrictCounts);
router.get("/past-intern-sync-stats", getPastInternSyncStats);

// Announcement routes (admin only)
router.get("/announcements", getAllAnnouncements);
router.post("/announcements", createAnnouncement);
router.delete("/announcements/:id", deleteAnnouncement);

// GET  /admin/attendance/by-date?date=YYYY-MM-DD  → list of present interns
router.get("/attendance/by-date", getAttendanceByDate);

// POST /admin/attendance/trigger-report            → fire the weekly non-attendance email
router.post("/attendance/trigger-report", triggerAttendanceReport);

// GET  /admin/attendance/export-excel?date=YYYY-MM-DD → download Excel for a day
router.get("/attendance/export-excel", exportAttendanceExcel);

// GET /admin/attendance/export-non-attendance-excel → download non-attendance Excel (past 14 days)
router.get("/attendance/export-non-attendance-excel", exportNonAttendanceExcel);

// Admin controlled attendance policy used by intern face/QR attendance flows
router.get("/attendance/settings", getAttendanceSettings);
router.put("/attendance/settings", updateAttendanceSettings);
router.get("/face-attendance/meeting-pin", getCurrentMeetingPin);
router.post("/face-attendance/meeting-pin/stop", stopCurrentMeetingPin);

// Debug: test SMTP connection and send a test email
router.get("/debug/smtp-test", async (req, res) => {
  const nodemailer = require("nodemailer");
  const logs = [];

  logs.push(`SMTP_HOST: ${process.env.SHORT_LEAVE_SMTP_HOST || "NOT SET"}`);
  logs.push(`SMTP_PORT: ${process.env.SHORT_LEAVE_SMTP_PORT || "NOT SET"}`);
  logs.push(`FROM_EMAIL: ${process.env.SHORT_LEAVE_EMAIL || "NOT SET"}`);
  logs.push(`RECIPIENT: ${process.env.SHORT_LEAVE_RECIPIENT || "NOT SET"}`);

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SHORT_LEAVE_SMTP_HOST || "mail.slt.com.lk",
      port: parseInt(process.env.SHORT_LEAVE_SMTP_PORT || "25"),
      secure: false,
      tls: { rejectUnauthorized: false },
      connectionTimeout: 5000,
    });

    logs.push("Attempting SMTP verify...");
    await transporter.verify();
    logs.push("SMTP verify SUCCESS");

    const info = await transporter.sendMail({
      from: process.env.SHORT_LEAVE_EMAIL,
      to: req.query.to || process.env.SHORT_LEAVE_EMAIL,
      subject: "TalentHub SMTP Debug Test",
      text: `Test sent at ${new Date().toISOString()}`,
    });

    logs.push(`Email sent! MessageId: ${info.messageId}`);
    logs.push(`Response: ${info.response}`);

    res.json({ success: true, logs });
  } catch (err) {
    logs.push(`ERROR: ${err.message}`);
    logs.push(`CODE: ${err.code}`);
    logs.push(`COMMAND: ${err.command}`);
    res.json({ success: false, logs, error: err.message, code: err.code });
  }
});

// Manually trigger TalentTrail sync
router.post("/sync/talent-trail", async (req, res) => {
  try {
    const result = await syncTalentTrailData();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
