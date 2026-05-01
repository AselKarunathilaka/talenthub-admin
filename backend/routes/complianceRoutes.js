const express = require("express");
const WeeklyScheduler = require("../services/weeklyScheduler");
const ComplianceCheck = require("../models/ComplianceCheck");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * Manual trigger for compliance check (Admin only)
 * POST /api/compliance/trigger-check
 */
router.post("/trigger-check", authMiddleware, async (req, res) => {
  try {
    console.log(
      `🔧 Manual compliance check triggered by user: ${req.user?.email || "Unknown"}`,
    );

    const results = await WeeklyScheduler.triggerManualCheck();

    res.json({
      success: true,
      message: "Manual compliance check completed",
      timestamp: new Date(),
      results: results,
    });
  } catch (error) {
    console.error("❌ Manual compliance check failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to execute compliance check",
      error: error.message,
    });
  }
});

// Deprecated feature route removed intentionally to prevent accidental use.

/**
 * Get compliance check history
 * GET /api/compliance/history?limit=10&page=1
 */
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const [checks, total] = await Promise.all([
      ComplianceCheck.find()
        .sort({ checkDate: -1 })
        .skip(skip)
        .limit(limit)
        .select("-results.emailsSent.emailId -results.emailsFailed.error"),
      ComplianceCheck.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        checks: checks,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          recordsPerPage: limit,
        },
      },
    });
  } catch (error) {
    console.error("❌ Failed to fetch compliance history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch compliance check history",
      error: error.message,
    });
  }
});

/**
 * Get detailed compliance check by ID
 * GET /api/compliance/check/:id
 */
router.get("/check/:id", authMiddleware, async (req, res) => {
  try {
    const check = await ComplianceCheck.findById(req.params.id)
      .populate("results.emailsSent.internId", "traineeName traineeId email")
      .populate("results.emailsFailed.internId", "traineeName traineeId email")
      .populate(
        "results.processingErrors.internId",
        "traineeName traineeId email",
      );

    if (!check) {
      return res.status(404).json({
        success: false,
        message: "Compliance check not found",
      });
    }

    res.json({
      success: true,
      data: check,
    });
  } catch (error) {
    console.error("❌ Failed to fetch compliance check details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch compliance check details",
      error: error.message,
    });
  }
});

/**
 * Get compliance statistics
 * GET /api/compliance/stats
 */
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalChecks,
      recentChecks,
      totalTerminations,
      recentTerminations,
      lastCheck,
    ] = await Promise.all([
      ComplianceCheck.countDocuments(),
      ComplianceCheck.countDocuments({ checkDate: { $gte: thirtyDaysAgo } }),
      ComplianceCheck.aggregate([
        {
          $group: { _id: null, total: { $sum: "$results.terminatedInterns" } },
        },
      ]),
      ComplianceCheck.aggregate([
        { $match: { checkDate: { $gte: thirtyDaysAgo } } },
        {
          $group: { _id: null, total: { $sum: "$results.terminatedInterns" } },
        },
      ]),
      ComplianceCheck.findOne().sort({ checkDate: -1 }),
    ]);

    res.json({
      success: true,
      data: {
        totalChecks: totalChecks,
        recentChecks: recentChecks,
        totalTerminations: totalTerminations[0]?.total || 0,
        recentTerminations: recentTerminations[0]?.total || 0,
        lastCheckDate: lastCheck?.checkDate || null,
        lastCheckStatus: lastCheck?.status || null,
        systemStatus: lastCheck ? "operational" : "no_checks_performed",
      },
    });
  } catch (error) {
    console.error("❌ Failed to fetch compliance statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch compliance statistics",
      error: error.message,
    });
  }
});

module.exports = router;
