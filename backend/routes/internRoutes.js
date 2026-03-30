const express = require("express");
const upload = require("../middleware/uploadMiddleware");
const authenticateUser = require("../middleware/authMiddleware");
const {
  addIntern,
  addExternalIntern,
  getAllInterns,
  getActiveInternsExternal,
  syncActiveInterns,
  getInternById,
  getInternByIdEach,              // ← from v2
  updateIntern,
  removeIntern,

  // Attendance
  getAttendanceByInternId,
  getAttendanceStats,
  getAttendanceStatsForToday,
  getAttendanceStatsByType,
  getTodayAttendanceByType,
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

  // Availability  ← from v2
  addAvailableDay,
  removeAvailableDay,

  // File Upload
  uploadInterns,
  uploadTXT,                     // ← from v2

  // Optional Filters (if you ever need them)
  getInternsByDay,
  getInternsByDayCount,
} = require("../controllers/internController");

const router = express.Router();

// =========================== ATTENDANCE STATS ===========================
router.get("/attendance-stats-today", authenticateUser, getAttendanceStatsForToday);
router.get("/attendance-stats-by-type", authenticateUser, getAttendanceStatsByType);
router.get("/today-attendance-by-type", authenticateUser, getTodayAttendanceByType);
router.get("/attendance-stats", authenticateUser, getAttendanceStats);
router.get("/weekly-attendance-stats", authenticateUser, getWeeklyAttendanceStats);

// =========================== INTERN MANAGEMENT ===========================
router.post("/add", authenticateUser, addIntern);
router.post("/add-external", addExternalIntern);
router.get("/", authenticateUser, getAllInterns);
// External trainees API
router.get("/external/active", authenticateUser, getActiveInternsExternal);
router.post("/external/sync", authenticateUser, syncActiveInterns);
router.get("/page/:id", getInternByIdEach);           // ← insertion from v2
router.get("/:id", authenticateUser, getInternById);
router.put("/update/:id", authenticateUser, updateIntern);
router.delete("/:id", authenticateUser, removeIntern);

// =========================== ATTENDANCE MANAGEMENT ===========================
router.get("/attendance/:id", getAttendanceByInternId);
router.post("/mark-attendance/:id", authenticateUser, markAttendance);
router.post("/mark-attendance", authenticateUser, markAttendance);
router.put("/update-attendance/:id", authenticateUser, updateAttendance);
router.put("/attendance/:id/update", authenticateUser, updateAttendanceForSpecificDate);

// =========================== TEAM MANAGEMENT ===========================
router.post("/assign-to-team", authenticateUser, assignToTeam);
router.put("/teams/:oldTeamName", authenticateUser, updateTeamName);
router.delete("/teams/:teamName", authenticateUser, deleteTeam);
router.put("/teams/:teamName/assign-single", authenticateUser, assignSingleToTeam);
router.put("/teams/:teamName/remove", authenticateUser, removeFromTeam);
router.get("/teams/all", authenticateUser, getAllTeams);

// =========================== AVAILABILITY MANAGEMENT ===========================  ← from v2
router.post("/:id/availability/add", addAvailableDay);
router.post("/:id/availability/remove", removeAvailableDay);

// =========================== FILE UPLOAD ===========================
router.post("/upload", authenticateUser, upload.single("file"), uploadInterns);
router.post("/upload-txt", upload.single("file"), uploadTXT);    // ← from v2

// =========================== OPTIONAL FILTERS ===========================
// router.get("/filter/by-day/:day", getInternsByDay);
// router.get("/filter/by-count/:count", getInternsByDayCount);

module.exports = router;
