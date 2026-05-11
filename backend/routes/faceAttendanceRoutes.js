const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const {
  registerFaceProfile,
  verifyFaceAttendance,
  getFaceProfile,
  getFaceLogs,
  getFaceProfileByIdentifier,
  getAttendanceSettings,
} = require("../controllers/faceAttendanceController");

const router = express.Router();

router.use(authenticateUser);

// Get face profile endpoints
router.get("/profile", getFaceProfile);
router.get("/logs", getFaceLogs);
router.get("/settings", getAttendanceSettings);
router.get("/profile/:identifier", getFaceProfileByIdentifier);

// Face enrollment and scanning endpoints
router.post("/enroll", registerFaceProfile);
router.post("/scan", verifyFaceAttendance);

// Legacy endpoints for backward compatibility
router.post("/register", registerFaceProfile);
router.post("/verify", verifyFaceAttendance);

module.exports = router;
