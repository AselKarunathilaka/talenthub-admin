/**
 * logbookRestriction.controller.js
 *
 * Handles all CRUD for the intern logbook-restriction feature:
 *   GET  /api/admin/logbook-restrictions            – list all restricted interns
 *   POST /api/admin/logbook-restrictions/:id/lift   – lift a restriction with a reason
 *   POST /api/admin/logbook-restrictions/:id/restrict – manually restrict an intern
 */

const Intern = require("../models/Intern"); // adjust path as needed
const moment = require("moment");

/* ─────────────────────────────────────────────────────────────────────────── */
/*  GET /api/admin/logbook-restrictions                                        */
/*  Returns all interns that are currently restricted.                         */
/* ─────────────────────────────────────────────────────────────────────────── */
exports.listRestricted = async (req, res) => {
  try {
    const restricted = await Intern.find(
      { logbookRestricted: true },
      {
        Trainee_ID: 1,
        Trainee_Name: 1,
        Trainee_Email: 1,
        field_of_spec_name: 1,
        Institute: 1,
        Training_StartDate: 1,
        Training_EndDate: 1,
        logbookRestricted: 1,
        logbookRestrictedAt: 1,
        logbookRestrictionReason: 1,
        logbookRestrictionHistory: 1,
      },
    ).sort({ logbookRestrictedAt: -1 });

    return res.json({
      success: true,
      count: restricted.length,
      data: restricted.map(mapInternToResponse),
    });
  } catch (err) {
    console.error("listRestricted error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  POST /api/admin/logbook-restrictions/:id/lift                              */
/*  Body: { liftReason: string, liftedBy?: string }                            */
/* ─────────────────────────────────────────────────────────────────────────── */
exports.liftRestriction = async (req, res) => {
  try {
    const { id } = req.params;
    const { liftReason, liftedBy = "Admin" } = req.body;

    if (!liftReason || !liftReason.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "A lift reason is required." });
    }

    const now = new Date();

    // Atomic: find intern that is restricted AND has an open history entry,
    // update both in one operation — safe against race conditions
    const intern = await Intern.findOneAndUpdate(
      {
        _id: id,
        logbookRestricted: true,
        "logbookRestrictionHistory.liftedAt": null, // open entry exists
      },
      {
        $set: {
          logbookRestricted: false,
          logbookRestrictedAt: null,
          logbookRestrictionReason: null,
          "logbookRestrictionHistory.$.liftedAt": now,
          "logbookRestrictionHistory.$.liftedBy": liftedBy,
          "logbookRestrictionHistory.$.liftReason": liftReason.trim(),
        },
      },
      { new: true }, // return updated document
    );

    if (!intern) {
      // Either intern not found, not restricted, or no open history entry
      const exists = await Intern.findById(id);
      if (!exists) {
        return res
          .status(404)
          .json({ success: false, error: "Intern not found." });
      }
      return res.status(400).json({
        success: false,
        error: "This intern's logbook is not currently restricted.",
      });
    }

    return res.json({
      success: true,
      message: `Logbook access restored for ${intern.Trainee_Name}.`,
      data: mapInternToResponse(intern),
    });
  } catch (err) {
    console.error("liftRestriction error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  POST /api/admin/logbook-restrictions/:id/restrict                          */
/*  Manual restriction by admin.                                               */
/*  Body: { reason: string }                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */
exports.manuallyRestrict = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "Manually restricted by administrator" } = req.body;

    const intern = await Intern.findById(id);
    if (!intern) {
      return res
        .status(404)
        .json({ success: false, error: "Intern not found." });
    }

    if (intern.logbookRestricted) {
      return res.status(400).json({
        success: false,
        error: "This intern's logbook is already restricted.",
      });
    }

    const now = new Date();
    intern.logbookRestricted = true;
    intern.logbookRestrictedAt = now;
    intern.logbookRestrictionReason = reason.trim();
    intern.logbookRestrictionHistory.push({
      restrictedAt: now,
      restrictionReason: reason.trim(),
      autoRestricted: false,
    });

    await intern.save();

    return res.json({
      success: true,
      message: `Logbook access restricted for ${intern.Trainee_Name}.`,
      data: mapInternToResponse(intern),
    });
  } catch (err) {
    console.error("manuallyRestrict error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  GET /api/admin/logbook-restrictions/:id/history                            */
/* ─────────────────────────────────────────────────────────────────────────── */
exports.getHistory = async (req, res) => {
  try {
    const intern = await Intern.findById(req.params.id, {
      Trainee_Name: 1,
      Trainee_ID: 1,
      logbookRestrictionHistory: 1,
    });

    if (!intern) {
      return res
        .status(404)
        .json({ success: false, error: "Intern not found." });
    }

    return res.json({
      success: true,
      traineeName: intern.Trainee_Name,
      traineeId: intern.Trainee_ID,
      history: intern.logbookRestrictionHistory.sort(
        (a, b) => b.restrictedAt - a.restrictedAt,
      ),
    });
  } catch (err) {
    console.error("getHistory error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helper: shape intern document for API responses                            */
/* ─────────────────────────────────────────────────────────────────────────── */
function mapInternToResponse(intern) {
  return {
    _id: intern._id,
    traineeId: intern.Trainee_ID,
    traineeName: intern.Trainee_Name,
    email: intern.Trainee_Email,
    fieldOfSpecialization: intern.field_of_spec_name,
    institute: intern.Institute,
    trainingStartDate: intern.Training_StartDate,
    trainingEndDate: intern.Training_EndDate,
    logbookRestricted: intern.logbookRestricted,
    logbookRestrictedAt: intern.logbookRestrictedAt,
    logbookRestrictionReason: intern.logbookRestrictionReason,
    restrictionHistory: (intern.logbookRestrictionHistory || []).sort(
      (a, b) => b.restrictedAt - a.restrictedAt,
    ),
  };
}
