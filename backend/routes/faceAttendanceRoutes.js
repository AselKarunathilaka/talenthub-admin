const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const {
  registerFaceProfile,
  verifyFaceAttendance,
  getFaceProfile,
  getFaceLogs,
  getFaceProfileByIdentifier,
  getAttendanceSettings,
  getCurrentMeetingPin,
  validateCurrentMeetingPin,
  stopCurrentMeetingPin,
} = require("../controllers/faceAttendanceController");

const router = express.Router();

router.use(authenticateUser);

// Get face profile endpoints
router.get("/profile", getFaceProfile);
router.get("/logs", getFaceLogs);
router.get("/settings", getAttendanceSettings);
router.get("/meeting-pin", getCurrentMeetingPin);
router.post("/meeting-pin/validate", validateCurrentMeetingPin);
router.post("/meeting-pin/stop", stopCurrentMeetingPin);
router.get("/profile/:identifier", getFaceProfileByIdentifier);

// Face enrollment and scanning endpoints
router.post("/enroll", registerFaceProfile);
router.post("/scan", verifyFaceAttendance);

// Legacy endpoints for backward compatibility
router.post("/register", registerFaceProfile);
router.post("/verify", verifyFaceAttendance);

module.exports = router;
