const InternTalentTrailSync = require("../models/InternTalentTrailSync");
const Intern = require("../models/Intern");
const User = require("../models/User");

/**
 * Blocks logbook submission for interns who have no project team assignments
 * on TalentTrail. Checks the projects array directly rather than the derived
 * hasActiveProject flag, since the flag may be stale or incorrectly set.
 *
 * Admins (users found in the User collection) bypass this check entirely,
 * identified via email from the JWT payload.
 */
const requireActiveProject = async (req, res, next) => {
  try {
    const { id: userId, email: userEmail } = req.user;

    // Admins are identified by presence in the User collection.
    // Using email from the JWT rather than ID avoids cross-collection
    // ObjectId ambiguity (the ID could belong to Intern or User).
    const adminUser = await User.findOne({ email: userEmail });
    if (adminUser) return next();

    // From here on this is definitely an intern request.
    // Use the email from the JWT if present; fall back to a DB lookup
    // only if the token was issued without one (legacy path).
    let email = userEmail;
    if (!email) {
      const intern = await Intern.findById(userId).select("Trainee_Email");
      if (!intern) {
        return res.status(404).json({
          error: "Intern record not found.",
        });
      }
      email = intern.Trainee_Email;
    }

    // Look up the TalentTrail sync record
    const syncRecord = await InternTalentTrailSync.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    }).select("projects lastSyncedAt");

    if (!syncRecord) {
      return res.status(403).json({
        error:
          "You are not registered in the project management system yet. " +
          "Please log in to talenttrail.slt.lk and ensure your account is set up.",
        code: "NO_TALENT_TRAIL_RECORD",
      });
    }

    // Check the projects array directly — the derived hasActiveProject flag
    // can be stale or incorrectly set (e.g. true while projects: []).
    const hasProjects =
      Array.isArray(syncRecord.projects) && syncRecord.projects.length > 0;

    if (!hasProjects) {
      return res.status(403).json({
        error:
          "You must be assigned to a project team before submitting logbook entries.",
        code: "NO_ACTIVE_PROJECT",
        lastSyncedAt: syncRecord.lastSyncedAt,
      });
    }

    // Attach sync record so the controller can use it if needed
    req.talentTrailSync = syncRecord;
    next();
  } catch (err) {
    console.error("[requireActiveProject]", err.message);
    res
      .status(500)
      .json({ error: "Failed to verify project team assignment." });
  }
};

module.exports = requireActiveProject;
