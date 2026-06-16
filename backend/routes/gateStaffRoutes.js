const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getApprovedLeaves,
  getApprovedLeavesByDate,
} = require("../controllers/gateStaffController");

//Get all approved short leave requests
router.get("/approved-leaves", authMiddleware, getApprovedLeaves);

//Get approved leaves for a specific date
router.get(
  "/approved-leaves/by-date/:date",
  authMiddleware,
  getApprovedLeavesByDate,
);

module.exports = router;
