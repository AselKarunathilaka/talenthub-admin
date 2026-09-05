const express = require("express");
const upload = require("../middleware/uploadMiddleware");
const authenticateUser = require("../middleware/authMiddleware");
const {
  addIntern,
  addExternalIntern,
  getAllInterns,
  getInternById,
  getInternByIdEach,
  updateIntern,
  removeIntern,

  // Attendance
  getAttendanceByInternId,
  getAttendanceStats,
  getAttendanceStatsForToday,
  getWeeklyAttendanceStats,
  markAttendance,
  updateAttendance,
  updateAttendanceForSpecificDate,

  // Team
  assignToTeam,
  assignSingleToTeam,
  removeFromTeam,
  updateTeamName,
  deleteTeam,
  getAllTeams,

  // Availability
  addAvailableDay,
  removeAvailableDay,

  // File Upload
  uploadInterns,
  uploadTXT,

  // SLT API Integration
  syncWithSLTAPI,
  testSLTAPI,
  getActiveTraineesFromSLT,
  cleanupInactiveInterns,

  // SLT API Scheduler
  triggerManualSLTSync,
  triggerComprehensiveUpdate,

  // Agreement
  acceptAgreement,

  // Optional Filters (if you ever need them)
  getInternsByDay,
  getInternsByDayCount,

  // Project check
  checkInternProjects,

  // Profile Picture
  uploadProfilePicture,
  getProfilePicture,

  // Tour
  markTourSeen,

  // University Feedback
  getInternUniversityFeedback,
  
  submitManualCheckInRequest,
} = require("../controllers/internController");

const { getInternGitCommits } = require("../controllers/adminController");

const router = express.Router();

// =========================== UNIVERSITY FEEDBACK ===========================
router.get("/:id/university-feedback", authenticateUser, getInternUniversityFeedback);

// =========================== ONBOARDING TOUR ===========================
router.patch("/:id/tour-seen", authenticateUser, markTourSeen);

// =========================== AGREEMENT ===========================
router.put("/:id/accept-agreement", acceptAgreement);

// =========================== GIT COMMITS (Intern self-access) ===========================
// Intern can only fetch their own commits; internId is validated against the auth token.
router.get("/:id/git-commits", authenticateUser, (req, res, next) => {
  // Map :id → :internId which getInternGitCommits reads from req.params
  req.params.internId = req.params.id;
  return getInternGitCommits(req, res, next);
});

// =========================== PROJECT CHECK ===========================
router.get("/:id/projects/check", checkInternProjects);

// =========================== PROFILE PICTURE ===========================
router.post(
  "/:id/profile-picture",
  authenticateUser,
  upload.single("image"),
  uploadProfilePicture,
);
router.get("/:id/profile-picture", getProfilePicture);

// =========================== AVAILABILITY MANAGEMENT ===========================
router.post("/:id/availability/add", addAvailableDay);
router.post("/:id/availability/remove", removeAvailableDay);

// =========================== ATTENDANCE STATS ===========================
router.get(
  "/attendance-stats-today",
  authenticateUser,
  getAttendanceStatsForToday,
);
router.get("/attendance-stats", authenticateUser, getAttendanceStats);
router.get(
  "/weekly-attendance-stats",
  authenticateUser,
  getWeeklyAttendanceStats,
);

// =========================== ATTENDANCE MANAGEMENT ===========================
router.put(
  "/attendance/:id/update",
  authenticateUser,
  updateAttendanceForSpecificDate,
);
router.get("/attendance/:id", getAttendanceByInternId);
const { getInternRecordCounts } = require("../controllers/adminInternDetailsController");
router.get("/:id/record-counts", authenticateUser, (req, res) => {
  req.params.internId = req.params.id;
  return getInternRecordCounts(req, res);
});
router.post("/mark-attendance/:id", authenticateUser, markAttendance);
router.post("/mark-attendance", authenticateUser, markAttendance);
router.post("/manual-checkin-request", authenticateUser, submitManualCheckInRequest);
router.put("/update-attendance/:id", authenticateUser, updateAttendance);

// =========================== INTERN MANAGEMENT ===========================
router.post("/add", authenticateUser, addIntern);
router.post("/add-external", addExternalIntern);
router.get("/", authenticateUser, getAllInterns);
router.get("/page/:id", getInternByIdEach);
router.get("/:id", authenticateUser, getInternById);
router.put("/update/:id", authenticateUser, updateIntern);
router.delete("/:id", authenticateUser, removeIntern);

// =========================== TEAM MANAGEMENT ===========================
router.post("/assign-to-team", authenticateUser, assignToTeam);
router.put("/teams/:oldTeamName", authenticateUser, updateTeamName);
router.delete("/teams/:teamName", authenticateUser, deleteTeam);
router.put(
  "/teams/:teamName/assign-single",
  authenticateUser,
  assignSingleToTeam,
);
router.put("/teams/:teamName/remove", authenticateUser, removeFromTeam);
router.get("/teams/all", authenticateUser, getAllTeams);

// =========================== SLT API INTEGRATION ===========================
router.post("/slt/sync", authenticateUser, syncWithSLTAPI);
router.get("/slt/test", authenticateUser, testSLTAPI);
router.get("/slt/trainees", authenticateUser, getActiveTraineesFromSLT);
router.post("/slt/cleanup", authenticateUser, cleanupInactiveInterns);

// =========================== SLT API SCHEDULER ===========================
router.post("/slt/sync/manual", authenticateUser, triggerManualSLTSync);
router.post(
  "/slt/update/comprehensive",
  authenticateUser,
  triggerComprehensiveUpdate,
);

// =========================== FILE UPLOAD ===========================
router.post("/upload", authenticateUser, upload.single("file"), uploadInterns);
router.post("/upload-txt", upload.single("file"), uploadTXT);

// =========================== OPTIONAL FILTERS ===========================
// router.get("/filter/by-day/:day", getInternsByDay);
// router.get("/filter/by-count/:count", getInternsByDayCount);

module.exports = router;
