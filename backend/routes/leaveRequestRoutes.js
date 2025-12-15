const express = require('express');
const router = express.Router();
const leaveRequestController = require('../controllers/leaveRequestController');
const authenticateUser = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// All routes require authentication
router.use(authenticateUser);

// Intern routes
router.post(
  '/',
  upload.single('proofDocument'),
  leaveRequestController.createLeaveRequest
);

router.get(
  '/my-requests',
  leaveRequestController.getMyLeaveRequests
);

router.delete(
  '/:id',
  leaveRequestController.deleteLeaveRequest
);

// Admin routes
router.get(
  '/all',
  leaveRequestController.getAllLeaveRequests
);

router.get(
  '/stats',
  leaveRequestController.getLeaveRequestStats
);

router.patch(
  '/:id/status',
  leaveRequestController.updateLeaveRequestStatus
);

router.get(
  '/report/approved',
  leaveRequestController.exportApprovedLeavesPdf
);

// Shared routes (both admin and intern can access)
router.get(
  '/:id/document',
  leaveRequestController.getLeaveRequestDocument
);

router.get(
  '/:id',
  leaveRequestController.getLeaveRequestById
);

module.exports = router;
