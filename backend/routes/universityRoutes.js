const express = require("express");
const router = express.Router();
const universityAuth = require("../middleware/universityAuth");
const authMiddleware = require("../middleware/authMiddleware");
const {
  universityGoogleLogin,
  registerUniversityRequest,
  checkUniversityStatus,
  getAdminUniversityRequests,
  approveUniversityRequest,
  rejectUniversityRequest,
  revokeUniversityAccess,
  deleteUniversityRequest,
  getSupervisorProfile,
  getUniversityStudents,
  getUniversityStudentDetails,
  getUniversityStudentGitCommits,
  addStudentFeedback,
  updateStudentFeedback,
  deleteStudentFeedback,
} = require("../controllers/universityController");

// ─── Public Authentication & Registration Routes ────────────────────────────
router.post("/google-login", universityGoogleLogin);
router.post("/login", universityGoogleLogin);
router.post("/register", registerUniversityRequest);
router.get("/status", checkUniversityStatus);

// ─── University Supervisor Protected Routes ─────────────────────────────────
router.get("/profile", universityAuth, getSupervisorProfile);
router.get("/students", universityAuth, getUniversityStudents);
router.get("/students/:internId", universityAuth, getUniversityStudentDetails);
router.get("/students/:internId/git-commits", universityAuth, getUniversityStudentGitCommits);
router.post("/students/:internId/feedback", universityAuth, addStudentFeedback);
router.put("/students/:internId/feedback/:feedbackId", universityAuth, updateStudentFeedback);
router.delete("/students/:internId/feedback/:feedbackId", universityAuth, deleteStudentFeedback);
router.put("/feedback/:feedbackId", universityAuth, updateStudentFeedback);
router.delete("/feedback/:feedbackId", universityAuth, deleteStudentFeedback);

// ─── Admin Management Routes ────────────────────────────────────────────────
// Supports admin auth or authMiddleware
router.get("/admin/requests", authMiddleware, getAdminUniversityRequests);
router.post("/admin/requests/:id/approve", authMiddleware, approveUniversityRequest);
router.post("/admin/requests/:id/reject", authMiddleware, rejectUniversityRequest);
router.post("/admin/requests/:id/revoke", authMiddleware, revokeUniversityAccess);
router.delete("/admin/requests/:id", authMiddleware, deleteUniversityRequest);

module.exports = router;
