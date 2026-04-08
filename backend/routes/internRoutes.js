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
  getInternByIdEach,
  updateIntern,
  removeIntern,
  getAttendanceByInternId,
  getAttendanceStats,
  getAttendanceStatsForToday,
  getAttendanceStatsByType,
  getTodayAttendanceByType,
  getWeeklyAttendanceStats,
  markAttendance,
  updateAttendance,
  clearAttendance,
  updateAttendanceForSpecificDate,
  assignToTeam,
  assignSingleToTeam,
  removeFromTeam,
  updateTeamName,
  deleteTeam,
  getAllTeams,
  addAvailableDay,
  removeAvailableDay,
  uploadInterns,
  uploadTXT,
  getInternsByDay,
  getInternsByDayCount,
} = require("../controllers/internController");

const router = express.Router();

router.get("/attendance-stats-today", authenticateUser, getAttendanceStatsForToday);
router.get("/attendance-stats-by-type", authenticateUser, getAttendanceStatsByType);
router.get("/today-attendance-by-type", authenticateUser, getTodayAttendanceByType);
router.get("/attendance-stats", authenticateUser, getAttendanceStats);
router.get("/weekly-attendance-stats", authenticateUser, getWeeklyAttendanceStats);

router.post("/add", authenticateUser, addIntern);
router.post("/add-external", addExternalIntern);
router.get("/", authenticateUser, getAllInterns);
router.get("/external/active", authenticateUser, getActiveInternsExternal);
router.post("/external/sync", authenticateUser, syncActiveInterns);
router.get("/page/:id", getInternByIdEach);
router.get("/:id", authenticateUser, getInternById);
router.put("/update/:id", authenticateUser, updateIntern);
router.delete("/:id", authenticateUser, removeIntern);

router.get("/attendance/:id", getAttendanceByInternId);
router.post("/mark-attendance/:id", authenticateUser, markAttendance);
router.post("/mark-attendance", authenticateUser, markAttendance);
router.put("/update-attendance/:id", authenticateUser, updateAttendance);
router.post("/attendance/:id/clear", authenticateUser, clearAttendance);
router.put("/attendance/:id/update", authenticateUser, updateAttendanceForSpecificDate);

router.post("/assign-to-team", authenticateUser, assignToTeam);
router.put("/teams/:oldTeamName", authenticateUser, updateTeamName);
router.delete("/teams/:teamName", authenticateUser, deleteTeam);
router.put("/teams/:teamName/assign-single", authenticateUser, assignSingleToTeam);
router.put("/teams/:teamName/remove", authenticateUser, removeFromTeam);
router.get("/teams/all", authenticateUser, getAllTeams);

router.post("/:id/availability/add", addAvailableDay);
router.post("/:id/availability/remove", removeAvailableDay);

router.post("/upload", authenticateUser, upload.single("file"), uploadInterns);
router.post("/upload-txt", upload.single("file"), uploadTXT);

// router.get("/filter/by-day/:day", getInternsByDay);
// router.get("/filter/by-count/:count", getInternsByDayCount);

module.exports = router;