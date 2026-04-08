const express = require("express");
const upload = require("../middleware/uploadMiddleware");
const authenticateUser = require("../middleware/authMiddleware");
const attendanceService = require("../services/attendanceService");
const {
  addIntern,
  addExternalIntern,
  getAllInterns,
  getActiveInternsExternal,
  syncActiveInterns,
  getInternById,
  getInternByIdEach,
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

  // Availability
  addAvailableDay,
  removeAvailableDay,

  // File Upload
  uploadInterns,
  uploadTXT,

  // Optional Filters
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
router.get("/external/active", authenticateUser, getActiveInternsExternal);
router.post("/external/sync", authenticateUser, syncActiveInterns);
router.get("/page/:id", getInternByIdEach);
router.get("/:id", authenticateUser, getInternById);
router.put("/update/:id", authenticateUser, updateIntern);
router.delete("/:id", authenticateUser, removeIntern);

// =========================== ATTENDANCE MANAGEMENT ===========================
router.get("/attendance/:id", authenticateUser, getAttendanceByInternId);
router.get("/attendance-history/:id", authenticateUser, getAttendanceByInternId);
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

// =========================== AVAILABILITY MANAGEMENT ===========================
router.post("/:id/availability/add", authenticateUser, addAvailableDay);
router.post("/:id/availability/remove", authenticateUser, removeAvailableDay);

// =========================== FILE UPLOAD ===========================
router.post("/upload", authenticateUser, upload.single("file"), uploadInterns);
router.post("/upload-txt", upload.single("file"), uploadTXT);

// =========================== BULK ATTENDANCE COMPATIBILITY ===========================
router.post("/attendance/bulk-mark", authenticateUser, async (req, res) => {
  try {
    const attendanceItems = Array.isArray(req.body) ? req.body : req.body?.attendanceData;
    if (!Array.isArray(attendanceItems) || attendanceItems.length === 0) {
      return res.status(400).json({ message: "Attendance data array is required" });
    }

    for (const item of attendanceItems) {
      await attendanceService.markAttendanceAndNotify(
        item.internId,
        item.status,
        item.date,
        item.type || "manual",
        item.timeMarked || new Date()
      );
    }

    return res.status(200).json({ message: "Bulk attendance processed", count: attendanceItems.length });
  } catch (error) {
    return res.status(500).json({ message: "Error processing bulk attendance", error: error.message });
  }
});

// =========================== OPTIONAL FILTERS ===========================
// router.get("/filter/by-day/:day", getInternsByDay);
// router.get("/filter/by-count/:count", getInternsByDayCount);

module.exports = router;