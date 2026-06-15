const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const fs = require("fs");
const path = require("path");

const {
  getDashboardStats,
  getInternReport,
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
  getInternGitCommits,
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
  getAttendanceByDateDaily,
  triggerAttendanceReport,
  exportNonAttendanceExcel,
  exportMeetingAttendancePdf,
  exportDailyAttendancePdf,
} = require("../controllers/admininternAttendanceController");
const {
  getAttendanceSettings,
  updateAttendanceSettings,
} = require("../controllers/attendanceSettingsController");
const {
  getCurrentMeetingPin,
  validateCurrentMeetingPin,
  stopCurrentMeetingPin,
  getFaceProfileEnrollmentSummary,
  scanInternFaceByAdmin,
  registerFaceProfileByAdmin,
} = require("../controllers/faceAttendanceController");

const {
  getCertificateData,
  issueCertificate,
} = require("../controllers/certificateController");

const { syncTalentTrailData } = require("../services/talentTrailSyncService");

const {
  searchInternForAttendance,
  markManualAttendance,
  bulkMarkAttendance,
} = require("../controllers/manualAttendanceController");

// Admin intern details — attendance (own controller, admin-only feature)
const {
  resolveInternId,
  getAdminInternAttendance,
} = require("../controllers/adminInternDetailsController");

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

// Get individual intern details
router.get("/intern/:internId", getInternDetails);

// Get individual intern's separated attendance (daily + meeting)
router.get("/intern/:internId/attendance", getAdminInternAttendance);
// New route for external system using Trainee_ID (4-digit number)
router.get(
  "/intern/by-trainee-id/:internId/attendance",
  resolveInternId,
  getAdminInternAttendance,
);

// Get individual intern's real GitHub commits (per TalentTrail project repos)
router.get("/intern/:internId/git-commits", getInternGitCommits);

// Get certificate data (enriched from TalentTrail)
router.get("/intern/:internId/certificate-data", getCertificateData);

// Issue a certificate — generates a unique verification token and saves a record
router.post("/intern/:internId/issue-certificate", issueCertificate);

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

// GET  /admin/attendance/by-date?date=YYYY-MM-DD  → list of present interns (meeting + daily combined)
router.get("/attendance/by-date", getAttendanceByDate);

// GET  /admin/attendance/by-date-daily?date=YYYY-MM-DD
//      → JSON list of interns present at DAILY attendance on that date
router.get("/attendance/by-date-daily", getAttendanceByDateDaily);

// POST /admin/attendance/trigger-report            → fire the weekly non-attendance email
router.post("/attendance/trigger-report", triggerAttendanceReport);

// GET /admin/attendance/export-non-attendance-excel → download non-attendance Excel (past 14 days)
router.get("/attendance/export-non-attendance-excel", exportNonAttendanceExcel);

// GET  /admin/attendance/export-meeting-pdf?date=YYYY-MM-DD
//      → Download Meeting Attendance PDF (SLTMobitel template)
router.get("/attendance/export-meeting-pdf", exportMeetingAttendancePdf);

// GET  /admin/attendance/export-daily-pdf?date=YYYY-MM-DD
//      → Download Daily Attendance PDF (SLTMobitel template)
router.get("/attendance/export-daily-pdf", exportDailyAttendancePdf);

// Admin controlled attendance policy used by intern face/QR attendance flows
router.get("/attendance/settings", getAttendanceSettings);
router.put("/attendance/settings", updateAttendanceSettings);

// Attendance — face/QR meeting pin
router.get("/face-attendance/meeting-pin", getCurrentMeetingPin);
router.post("/face-attendance/meeting-pin/validate", validateCurrentMeetingPin);
router.post("/face-attendance/meeting-pin/stop", stopCurrentMeetingPin);
router.get("/face-attendance/profiles", getFaceProfileEnrollmentSummary);
router.post("/face-attendance/scan-intern", scanInternFaceByAdmin);
router.post("/face-attendance/enroll-intern", registerFaceProfileByAdmin);

// Manual attendance ────────────────────────────────────────────────────
router.get("/manual-attendance/search", searchInternForAttendance);
router.post("/manual-attendance/mark", markManualAttendance);
router.post("/manual-attendance/bulk-mark", bulkMarkAttendance);

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
