const Intern = require("../models/Intern");
const talentHubRestrictionService = require("../services/talentHubRestrictionService");
const { getActiveInternsQuery } = require("../utils/workingDays");

/**
 * GET /api/admin/talenthub-restrictions
 * Lists interns with their project enrollment and TalentHub restriction status.
 */
exports.listRestrictions = async (req, res) => {
  try {
    const { filter = "restricted", search = "" } = req.query;
    const activeQuery = getActiveInternsQuery();

    const interns = await Intern.find(activeQuery)
      .select("Trainee_ID Trainee_Name Trainee_Email field_of_spec_name Institute team talentHubRestricted talentHubRestrictedAt talentHubRestrictionReason talentHubOverride talentHubOverrideAt talentHubOverrideExpiresAt talentHubOverrideBy talentHubOverrideReason talentHubRestrictionHistory googlePictureUrl")
      .lean();

    const now = new Date();

    // Evaluate each intern to ensure live real-time accuracy
    const enrichedList = await Promise.all(
      interns.map(async (intern) => {
        const access = await talentHubRestrictionService.evaluateInternAccess(intern);

        const idStr = String(intern._id);
        const expiresAt = intern.talentHubOverrideExpiresAt ? new Date(intern.talentHubOverrideExpiresAt) : null;
        let daysRemaining = null;
        if (intern.talentHubOverride && expiresAt && expiresAt > now) {
          daysRemaining = Math.max(1, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)));
        }

        return {
          id: idStr,
          _id: idStr,
          traineeId: intern.Trainee_ID || "N/A",
          name: intern.Trainee_Name || "Unnamed Intern",
          email: intern.Trainee_Email || "",
          specialization: intern.field_of_spec_name || "Not Specified",
          institute: intern.Institute || "Not Specified",
          team: intern.team || "",
          googlePictureUrl: intern.googlePictureUrl || "",
          talentHubRestricted: access.restricted,
          talentHubRestrictedAt: intern.talentHubRestrictedAt || null,
          talentHubRestrictionReason: access.reason || (access.restricted ? "No project assigned" : null),
          talentHubOverride: access.isOverride,
          talentHubOverrideAt: intern.talentHubOverrideAt || null,
          talentHubOverrideExpiresAt: intern.talentHubOverrideExpiresAt || null,
          talentHubOverrideBy: intern.talentHubOverrideBy || null,
          talentHubOverrideReason: intern.talentHubOverrideReason || null,
          daysRemaining,
          projects: access.projects || [],
          projectCount: access.projectCount || 0,
          restrictionHistory: intern.talentHubRestrictionHistory || [],
        };
      })
    );

    // Apply filtering
    let filtered = enrichedList;

    if (filter === "restricted") {
      filtered = filtered.filter(i => i.talentHubRestricted);
    } else if (filter === "overridden") {
      filtered = filtered.filter(i => i.talentHubOverride);
    } else if (filter === "enrolled") {
      filtered = filtered.filter(i => i.projectCount > 0);
    }

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter(i => {
        const nameMatch = i.name.toLowerCase().includes(term);
        const idMatch = i.traineeId.toLowerCase().includes(term);
        const emailMatch = i.email.toLowerCase().includes(term);
        const specMatch = i.specialization.toLowerCase().includes(term);
        const instMatch = i.institute.toLowerCase().includes(term);
        const projectMatch = i.projects.some(p => (p.name || "").toLowerCase().includes(term));
        return nameMatch || idMatch || emailMatch || specMatch || instMatch || projectMatch;
      });
    }

    // Compute overview stats
    const totalInterns = enrichedList.length;
    const restrictedCount = enrichedList.filter(i => i.talentHubRestricted).length;
    const overriddenCount = enrichedList.filter(i => i.talentHubOverride).length;
    const enrolledCount = enrichedList.filter(i => i.projectCount > 0).length;

    return res.status(200).json({
      success: true,
      stats: {
        totalInterns,
        restrictedCount,
        overriddenCount,
        enrolledCount,
      },
      data: filtered,
    });
  } catch (err) {
    console.error("listRestrictions error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch TalentHub restrictions" });
  }
};

/**
 * POST /api/admin/talenthub-restrictions/:id/lift
 * Admin action to lift restriction, granting temporary 5-day access.
 */
exports.liftRestriction = async (req, res) => {
  try {
    const { id } = req.params;
    const { liftReason, days = 5 } = req.body;

    if (!liftReason || !liftReason.trim()) {
      return res.status(400).json({ success: false, error: "A reason is required to lift the restriction." });
    }

    const updatedIntern = await talentHubRestrictionService.liftRestriction(
      id,
      req.user || { name: "Admin" },
      liftReason.trim(),
      days
    );

    return res.status(200).json({
      success: true,
      message: `Temporary ${days}-day access granted successfully.`,
      intern: {
        id: updatedIntern._id,
        talentHubRestricted: updatedIntern.talentHubRestricted,
        talentHubOverride: updatedIntern.talentHubOverride,
        talentHubOverrideExpiresAt: updatedIntern.talentHubOverrideExpiresAt,
      },
    });
  } catch (err) {
    console.error("liftRestriction error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to lift restriction" });
  }
};

/**
 * POST /api/admin/talenthub-restrictions/:id/restrict
 * Admin action to manually re-restrict an intern / revoke override.
 */
exports.restrictIntern = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "Admin manually restricted access" } = req.body;

    const updatedIntern = await talentHubRestrictionService.reApplyRestriction(
      id,
      req.user || { name: "Admin" },
      reason
    );

    return res.status(200).json({
      success: true,
      message: "Intern TalentHub access restricted successfully.",
      intern: {
        id: updatedIntern._id,
        talentHubRestricted: updatedIntern.talentHubRestricted,
        talentHubOverride: updatedIntern.talentHubOverride,
      },
    });
  } catch (err) {
    console.error("restrictIntern error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to restrict intern" });
  }
};

/**
 * POST /api/admin/talenthub-restrictions/sync
 * Triggers background real-time sync across all interns.
 */
exports.syncRestrictions = async (req, res) => {
  try {
    const result = await talentHubRestrictionService.syncAllRestrictions();
    return res.status(200).json({
      success: true,
      message: "TalentHub restrictions synchronized successfully.",
      result,
    });
  } catch (err) {
    console.error("syncRestrictions error:", err);
    return res.status(500).json({ success: false, error: "Failed to sync restrictions" });
  }
};
