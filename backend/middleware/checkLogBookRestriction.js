/**
 * checkLogbookRestriction.middleware.js
 *
 * Drop this middleware onto your POST /api/records route (or wherever the
 * logbook submission is handled) so restricted interns cannot submit.
 *
 * Usage in your records router:
 *
 *   const { checkLogbookRestriction } = require("../middleware/checkLogbookRestriction");
 *   router.post("/", authMiddleware, checkLogbookRestriction, createRecordHandler);
 */

const Intern = require("../models/Intern"); // adjust path as needed

/**
 * Resolves the intern's MongoDB ObjectId from the authenticated request.
 * Adjust `req.intern._id` / `req.intern.id` to match your auth middleware's shape.
 */
function getInternId(req) {
  // Common patterns — pick whichever your auth middleware sets:
  return (
    req.intern?._id || req.intern?.id || req.user?._id || req.user?.id || null
  );
}

/**
 * Express middleware.
 * Responds with 403 + structured payload if the intern's logbook is restricted.
 */
async function checkLogbookRestriction(req, res, next) {
  try {
    const internId = getInternId(req);
    if (!internId) {
      // Let the main handler deal with unauthenticated requests
      return next();
    }

    const intern = await Intern.findById(internId).select(
      "logbookRestricted logbookRestrictedAt logbookRestrictionReason Trainee_Name",
    );

    if (!intern) return next(); // fallthrough — main handler will 404

    if (intern.logbookRestricted) {
      return res.status(403).json({
        code: "LOGBOOK_RESTRICTED",
        logbookRestricted: true,
        error:
          "Your logbook access has been restricted due to missing submissions " +
          "for the past week. Please speak with your supervisor to have your " +
          "access reinstated.",
        reason: intern.logbookRestrictionReason || null,
        restrictedAt: intern.logbookRestrictedAt || null,
      });
    }

    return next();
  } catch (err) {
    console.error("checkLogbookRestriction middleware error:", err);
    // Non-blocking: if we can't check, let the request through and log the issue
    return next();
  }
}

module.exports = { checkLogbookRestriction };
