const InternTalentTrailSync = require("../models/InternTalentTrailSync");
const Intern = require("../models/Intern");
const User = require("../models/User");

/**
 * Blocks logbook submission for interns who have no project team assignments
 * on TalentTrail. Checks the projects array across ALL sync documents for the
 * intern's email, since duplicate records can exist for the same email.
 * If ANY document has at least one project, the intern is allowed through.
 *
 * Admins (users found in the User collection) bypass this check entirely,
 * identified via email from the JWT payload.
 */
const requireActiveProject = async (req, res, next) => {
  try {
    const { id: userId, email: userEmail } = req.user;

    // Admins are identified by presence in the User collection.
    const adminUser = await User.findOne({ email: userEmail });
    if (adminUser) return next();

    // From here on this is definitely an intern request.
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

    // Look up ALL TalentTrail sync records for this email.
    // Duplicates can exist when the same intern appears under multiple
    // talentTrailInternId values — we must check across all of them.
    const syncRecords = await InternTalentTrailSync.find({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    }).select("projects lastSyncedAt");

    if (!syncRecords || syncRecords.length === 0) {
      return res.status(403).json({
        error:
          "You are not registered in the project management system yet. " +
          "Please log in to talenttrail.slt.lk and ensure your account is set up.",
        code: "NO_TALENT_TRAIL_RECORD",
      });
    }

    // Check if ANY of the sync records has at least one project.
    // This handles the duplicate-document case where one record may have
    // projects and another may not.
    const hasProjects = syncRecords.some(
      (record) => Array.isArray(record.projects) && record.projects.length > 0,
    );

    if (!hasProjects) {
      // Use the most recently synced record's timestamp for the error response
      const latestRecord = syncRecords.reduce((latest, record) =>
        !latest.lastSyncedAt ||
        (record.lastSyncedAt && record.lastSyncedAt > latest.lastSyncedAt)
          ? record
          : latest,
      );

      return res.status(403).json({
        error:
          "You must be assigned to a project team before submitting logbook entries.",
        code: "NO_ACTIVE_PROJECT",
        lastSyncedAt: latestRecord.lastSyncedAt,
      });
    }

    // Attach the record that has projects so the controller can use it if needed
    req.talentTrailSync = syncRecords.find(
      (record) => Array.isArray(record.projects) && record.projects.length > 0,
    );
    next();
  } catch (err) {
    console.error("[requireActiveProject]", err.message);
    res
      .status(500)
      .json({ error: "Failed to verify project team assignment." });
  }
};

module.exports = requireActiveProject;
