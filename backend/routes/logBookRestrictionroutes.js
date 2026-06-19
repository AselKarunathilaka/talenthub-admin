const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/logBookRestrictionController");
const authMiddleware = require("../middleware/authMiddleware"); // Add this

// Apply authentication middleware to all routes
router.use(authMiddleware); // Add this

// List all currently restricted interns
router.get("/", ctrl.listRestricted);

// Lift restriction for a specific intern
router.post("/:id/lift", ctrl.liftRestriction);

// Manually restrict a specific intern
router.post("/:id/restrict", ctrl.manuallyRestrict);

// Full restriction/lift history for a specific intern
router.get("/:id/history", ctrl.getHistory);

module.exports = router;
