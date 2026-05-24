const InternTalentTrailSync = require("../models/InternTalentTrailSync");
const Intern = require("../models/Intern");

/**
 * Blocks logbook submission for interns who have no project team assignments
 * on TalentTrail. Checks the projects array directly rather than the derived
 * hasActiveProject flag, since the flag may be stale or incorrectly set.
 *
 * Admins (users found in the User collection) bypass this check entirely.
 */
const requireActiveProject = async (req, res, next) => {
  try {
    const { id: userId, email: userEmail } = req.user;

    // Let admins through without any project check
    const User = require("../models/User");
    const adminUser = await User.findById(userId);
    if (adminUser) return next();

    // Resolve this request to an intern email
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
          "You must be assigned to a project team before submitting logbook entries. ",
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
