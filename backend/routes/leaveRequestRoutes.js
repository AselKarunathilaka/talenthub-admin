const express = require("express");
const router = express.Router();
const leaveRequestController = require("../controllers/leaveRequestController");
const authenticateUser = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

// PUBLIC ROUTES (no authentication) - for leave pass validation
router.get("/pass/validate/:token", leaveRequestController.validateLeavePass);

router.post("/pass/mark-used/:token", leaveRequestController.markPassAsUsed);

// All other routes require authentication
router.use(authenticateUser);

// Intern routes
router.post(
  "/",
  upload.single("proofDocument"),
  leaveRequestController.createLeaveRequest,
);

router.get("/my-requests", leaveRequestController.getMyLeaveRequests);

router.delete("/:id", leaveRequestController.deleteLeaveRequest);

// Admin routes
router.get("/all", leaveRequestController.getAllLeaveRequests);

router.get("/stats", leaveRequestController.getLeaveRequestStats);

router.get("/report/approved", leaveRequestController.exportApprovedLeavesPdf);

// Bulk update status (Admin only) - MUST be before /:id routes
router.patch(
  "/bulk/status",
  leaveRequestController.bulkUpdateLeaveRequestStatus,
);

router.patch("/:id/status", leaveRequestController.updateLeaveRequestStatus);

// Shared routes (both admin and intern can access)
router.get("/:id/document", leaveRequestController.getLeaveRequestDocument);

router.get("/:id", leaveRequestController.getLeaveRequestById);

module.exports = router;
