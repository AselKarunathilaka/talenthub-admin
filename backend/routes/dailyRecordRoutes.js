const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const {
  createDailyRecord,
  getDailyRecords,
  getDailyRecordById,
  updateDailyRecord,
  deleteDailyRecord
} = require("../controllers/dailyRecordController");

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Create a new daily record
router.post("/", createDailyRecord);

// Get all daily records (filtered by user role)
router.get("/", getDailyRecords);

// Get a specific daily record by ID
router.get("/:id", getDailyRecordById);

// Update a daily record
router.put("/:id", updateDailyRecord);

// Delete a daily record
router.delete("/:id", deleteDailyRecord);

module.exports = router;
