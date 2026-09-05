const Intern = require("../models/Intern");
const InternTalentTrailSync = require("../models/InternTalentTrailSync");
const Project = require("../models/Project");
const { getActiveInternsQuery } = require("../utils/workingDays");
const { gitCommitsCache } = require("../controllers/adminController");

const OVERRIDE_DEFAULT_DAYS = 5;

/**
 * Escape special characters for regex matching
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Format project status consistently.
 */
function formatProjectStatus(status) {
  if (!status) return "In Progress";
  const s = String(status).trim().toUpperCase();
  if (s === "IN_PROGRESS" || s === "INPROGRESS" || s === "IN PROGRESS" || s === "ACTIVE") return "In Progress";
  if (s === "COMPLETED" || s === "COMPLETE" || s === "DONE") return "Completed";
  if (s === "ON_HOLD" || s === "ONHOLD" || s === "ON HOLD" || s === "HOLD") return "On Hold";
  if (s === "RETIRED") return "Retired";
  if (s === "DELAYED") return "Delayed";
  if (s === "AT_RISK" || s === "AT RISK" || s === "RISK") return "At Risk";
  if (s === "PLANNING" || s === "PLANNED") return "Planning";
  if (s === "CANCELLED" || s === "CANCELED") return "Cancelled";
  if (s === "TESTING" || s === "IN_TESTING") return "Testing";
  return status;
}

/**
 * Resolves all active projects for a given intern document across
 * TalentTrail sync records, local Project model, and git cache.
 */
async function getInternProjects(intern) {
  if (!intern) return [];

  const idStr = String(intern._id || "");
  const internEmailNorm = (intern.Trainee_Email || "").trim().toLowerCase();
  const internIdNorm = String(intern.Trainee_ID || "").trim().toLowerCase();
  const internDigits = String(intern.Trainee_ID || "").replace(/\D/g, "");
  const internNameNorm = (intern.Trainee_Name || "").trim().toLowerCase();
  const internTeamNorm = (intern.team || "").trim().toLowerCase();

  const [talentTrailSyncRecords, projectRecords] = await Promise.all([
    InternTalentTrailSync.find({
      $or: [
        ...(idStr ? [{ internRef: intern._id }] : []),
        ...(internEmailNorm ? [{ email: { $regex: new RegExp(`^${escapeRegex(internEmailNorm)}$`, "i") } }] : []),
        ...(internIdNorm ? [{ internCode: { $regex: new RegExp(`^${escapeRegex(internIdNorm)}$`, "i") } }] : []),
        ...(internDigits ? [{ talentTrailInternId: Number(internDigits) || -1 }] : []),
      ],
    }).lean().catch(() => []),

    Project.find({
      $or: [
        ...(idStr ? [{ "tasks.assignedTo": intern._id }] : []),
        ...(idStr ? [{ "feedback.internId": intern._id }] : []),
        ...(internTeamNorm ? [{ team: { $regex: new RegExp(internTeamNorm, "i") } }] : []),
      ],
    }).lean().catch(() => []),
  ]);

  const projectsList = [];
  const seenProjectNames = new Set();

  const addProject = (pName, pStatus, pDesc, pSupervisor) => {
    if (!pName) return;
    const trimmedName = String(pName).trim();
    if (!trimmedName) return;
    const normalizedKey = trimmedName.toLowerCase();
    if (seenProjectNames.has(normalizedKey)) return;
    seenProjectNames.add(normalizedKey);
    projectsList.push({
      name: trimmedName,
      status: formatProjectStatus(pStatus),
      description: pDesc || "",
      supervisor: pSupervisor || "",
    });
  };

  // 1. TalentTrail projects
  for (const sync of talentTrailSyncRecords) {
    const projects = Array.isArray(sync.projects) ? sync.projects : [];
    for (const p of projects) {
      if (p && p.projectName) {
        addProject(p.projectName, p.status, p.description, p.supervisorName);
      }
    }
  }

  // 2. Local Project collection
  for (const proj of projectRecords) {
    let isMatch = false;

    if (Array.isArray(proj.tasks)) {
      if (proj.tasks.some(t => Array.isArray(t.assignedTo) && t.assignedTo.some(uid => uid && String(uid) === idStr))) {
        isMatch = true;
      }
    }

    if (!isMatch && Array.isArray(proj.feedback)) {
      if (proj.feedback.some(f => f && f.internId && String(f.internId) === idStr)) {
        isMatch = true;
      }
    }

    if (!isMatch && proj.team) {
      const projTeamRaw = String(proj.team).trim().toLowerCase();
      const teamTokens = projTeamRaw.split(/[,;\/|]+/).map(t => t.trim()).filter(Boolean);
      if (
        (internTeamNorm && (teamTokens.includes(internTeamNorm) || projTeamRaw === internTeamNorm || internTeamNorm.includes(projTeamRaw))) ||
        (internIdNorm && (teamTokens.includes(internIdNorm) || projTeamRaw === internIdNorm)) ||
        (internNameNorm && (teamTokens.includes(internNameNorm) || projTeamRaw === internNameNorm))
      ) {
        isMatch = true;
      }
    }

    if (isMatch && proj.projectName) {
      addProject(proj.projectName, proj.status, proj.description);
    }
  }

  // 3. Git cache
  if (idStr && gitCommitsCache) {
    const cached = gitCommitsCache.get(`git_commits_${idStr}`);
    if (cached && cached.data) {
      const pCommits = Array.isArray(cached.data)
        ? cached.data
        : (cached.data.projectCommits || []);
      for (const p of pCommits) {
        if (p && (p.projectName || p.name)) {
          addProject(p.projectName || p.name, p.status || "In Progress");
        }
      }
    }
  }

  return projectsList;
}

/**
 * Real-time evaluation of an intern's TalentHub access.
 * Automatically synchronizes restriction status in database.
 *
 * Rules:
 *  - If intern has >=1 project -> Not restricted. (Auto lifts if previously restricted).
 *  - If intern has 0 projects:
 *      - If talentHubOverride === true AND overrideExpiresAt > now -> Access allowed (temporary 5-day grace period).
 *      - If talentHubOverride === true AND overrideExpiresAt <= now -> Re-restricted with "Temporary 5-day access expired: still not enrolled in any project".
 *      - If no override -> Restricted with "No project assigned".
 */
async function evaluateInternAccess(internDocOrId) {
  let intern = internDocOrId;
  if (!intern || !intern._id || typeof intern.save !== "function") {
    intern = await Intern.findById(internDocOrId);
  }
  if (!intern) {
    return { restricted: true, reason: "Intern not found", projects: [], projectCount: 0 };
  }

  let projects = await getInternProjects(intern);
  let hasProjects = projects.length > 0;

  if (!hasProjects) {
    try {
      // Re-fetch from Talent Trail to ensure we have the absolute latest data before restricting
      const { syncTalentTrailData } = require("./talentTrailSyncService");
      const syncRes = await syncTalentTrailData({ skipRestrictionSync: true });
      if (!syncRes.skipped) {
        projects = await getInternProjects(intern);
        hasProjects = projects.length > 0;
      }
    } catch (e) {
      console.warn("Failed to retrieve latest Talent Trail data during evaluation:", e.message);
    }
  }

  const now = new Date();

  let stateChanged = false;

  // Case A: Intern has at least 1 valid project
  if (hasProjects) {
    if (intern.talentHubRestricted) {
      intern.talentHubRestricted = false;
      intern.talentHubRestrictedAt = null;
      intern.talentHubRestrictionReason = null;

      // Close open restriction history entry
      if (Array.isArray(intern.talentHubRestrictionHistory)) {
        const openEntry = intern.talentHubRestrictionHistory.find(h => !h.liftedAt);
        if (openEntry) {
          openEntry.liftedAt = now;
          openEntry.liftedBy = "System";
          openEntry.liftReason = `Automatically restored: enrolled in project (${projects.map(p => p.name).join(", ")})`;
        }
      }
      stateChanged = true;
    }

    // Clear override if active since intern now has real project
    if (intern.talentHubOverride) {
      intern.talentHubOverride = false;
      intern.talentHubOverrideExpiresAt = null;
      intern.talentHubOverrideBy = null;
      intern.talentHubOverrideReason = null;
      stateChanged = true;
    }

    if (stateChanged) {
      await intern.save();
    }

    return {
      restricted: false,
      isOverride: false,
      reason: null,
      projects,
      projectCount: projects.length,
      overrideExpiresAt: null,
      daysRemaining: null,
    };
  }

  // Case B: Intern has 0 projects
  // Check if Admin Override is active
  if (intern.talentHubOverride) {
    const expiresAt = intern.talentHubOverrideExpiresAt ? new Date(intern.talentHubOverrideExpiresAt) : null;
    const isOverrideActive = expiresAt && expiresAt > now;

    if (isOverrideActive) {
      const msLeft = expiresAt - now;
      const daysRemaining = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

      if (intern.talentHubRestricted) {
        intern.talentHubRestricted = false;
        intern.talentHubRestrictedAt = null;
        intern.talentHubRestrictionReason = null;
        stateChanged = true;
      }

      if (stateChanged) {
        await intern.save();
      }

      return {
        restricted: false,
        isOverride: true,
        daysRemaining,
        overrideExpiresAt: expiresAt,
        overrideBy: intern.talentHubOverrideBy || "Admin",
        overrideReason: intern.talentHubOverrideReason || "Temporary access granted",
        reason: null,
        projects: [],
        projectCount: 0,
      };
    }

    // Override has EXPIRED (> 5 days passed without project enrollment)
    intern.talentHubOverride = false;
    intern.talentHubOverrideExpiresAt = null;
    intern.talentHubRestricted = true;
    intern.talentHubRestrictedAt = now;
    intern.talentHubRestrictionReason = "Temporary 5-day access expired: still not enrolled in any project";

    if (!Array.isArray(intern.talentHubRestrictionHistory)) {
      intern.talentHubRestrictionHistory = [];
    }
    intern.talentHubRestrictionHistory.push({
      restrictedAt: now,
      restrictionReason: intern.talentHubRestrictionReason,
      autoRestricted: true,
      isOverride: false,
    });

    await intern.save();

    return {
      restricted: true,
      isOverride: false,
      reason: intern.talentHubRestrictionReason,
      projects: [],
      projectCount: 0,
      overrideExpiresAt: null,
      daysRemaining: null,
    };
  }

  // Case C: Intern has 0 projects and no override
  if (!intern.talentHubRestricted) {
    intern.talentHubRestricted = true;
    intern.talentHubRestrictedAt = now;
    intern.talentHubRestrictionReason = "No project assigned";

    if (!Array.isArray(intern.talentHubRestrictionHistory)) {
      intern.talentHubRestrictionHistory = [];
    }
    intern.talentHubRestrictionHistory.push({
      restrictedAt: now,
      restrictionReason: intern.talentHubRestrictionReason,
      autoRestricted: true,
      isOverride: false,
    });

    await intern.save();
  }

  return {
    restricted: true,
    isOverride: false,
    reason: intern.talentHubRestrictionReason || "No project assigned",
    projects: [],
    projectCount: 0,
    overrideExpiresAt: null,
    daysRemaining: null,
  };
}

/**
 * Admin manually lifts restriction for an intern, granting a temporary 5-day override.
 */
async function liftRestriction(internId, adminUser = {}, reason = "Admin granted 5-day temporary access", days = OVERRIDE_DEFAULT_DAYS) {
  const intern = await Intern.findById(internId);
  if (!intern) {
    throw new Error("Intern not found");
  }

  const now = new Date();
  const overrideDays = Number(days) > 0 ? Number(days) : OVERRIDE_DEFAULT_DAYS;
  const expiresAt = new Date(now.getTime() + overrideDays * 24 * 60 * 60 * 1000);
  const adminName = adminUser.name || adminUser.email || adminUser.username || "Admin";

  intern.talentHubRestricted = false;
  intern.talentHubRestrictedAt = null;
  intern.talentHubRestrictionReason = null;
  intern.talentHubOverride = true;
  intern.talentHubOverrideAt = now;
  intern.talentHubOverrideExpiresAt = expiresAt;
  intern.talentHubOverrideBy = adminName;
  intern.talentHubOverrideReason = String(reason || "").trim() || "Temporary access granted by admin";

  if (!Array.isArray(intern.talentHubRestrictionHistory)) {
    intern.talentHubRestrictionHistory = [];
  }

  const openEntry = intern.talentHubRestrictionHistory.find(h => !h.liftedAt);
  if (openEntry) {
    openEntry.liftedAt = now;
    openEntry.liftedBy = adminName;
    openEntry.liftReason = `Admin Override (${overrideDays} days): ${intern.talentHubOverrideReason}`;
    openEntry.isOverride = true;
    openEntry.overrideExpiresAt = expiresAt;
  } else {
    intern.talentHubRestrictionHistory.push({
      restrictedAt: now,
      restrictionReason: "Admin temporary override granted",
      liftedAt: now,
      liftedBy: adminName,
      liftReason: `Admin Override (${overrideDays} days): ${intern.talentHubOverrideReason}`,
      autoRestricted: false,
      isOverride: true,
      overrideExpiresAt: expiresAt,
    });
  }

  await intern.save();
  return intern;
}

/**
 * Admin manually revokes override / re-applies restriction.
 */
async function reApplyRestriction(internId, adminUser = {}, reason = "Admin manually restricted access") {
  const intern = await Intern.findById(internId);
  if (!intern) {
    throw new Error("Intern not found");
  }

  const now = new Date();
  const adminName = adminUser.name || adminUser.email || adminUser.username || "Admin";

  intern.talentHubOverride = false;
  intern.talentHubOverrideExpiresAt = null;
  intern.talentHubOverrideBy = null;
  intern.talentHubOverrideReason = null;
  intern.talentHubRestricted = true;
  intern.talentHubRestrictedAt = now;
  intern.talentHubRestrictionReason = String(reason || "").trim() || "Admin manually restricted access";

  if (!Array.isArray(intern.talentHubRestrictionHistory)) {
    intern.talentHubRestrictionHistory = [];
  }

  intern.talentHubRestrictionHistory.push({
    restrictedAt: now,
    restrictionReason: intern.talentHubRestrictionReason,
    autoRestricted: false,
    isOverride: false,
  });

  await intern.save();
  return intern;
}

/**
 * Comprehensive background sweep across all active interns to keep
 * restriction states fully synchronized with project assignments and override expirations.
 */
async function syncAllRestrictions() {
  const activeQuery = getActiveInternsQuery();
  const interns = await Intern.find(activeQuery);

  let updatedCount = 0;
  let restrictedCount = 0;
  let restoredCount = 0;

  for (const intern of interns) {
    try {
      const prevRestricted = intern.talentHubRestricted;
      const prevOverride = intern.talentHubOverride;
      const res = await evaluateInternAccess(intern);

      if (res.restricted !== prevRestricted || res.isOverride !== prevOverride) {
        updatedCount++;
        if (res.restricted) restrictedCount++;
        else restoredCount++;
      }
    } catch (err) {
      console.warn(`[syncAllRestrictions] Error evaluating intern ${intern._id}:`, err.message);
    }
  }

  return { total: interns.length, updatedCount, restrictedCount, restoredCount };
}

module.exports = {
  getInternProjects,
  evaluateInternAccess,
  liftRestriction,
  reApplyRestriction,
  syncAllRestrictions,
  formatProjectStatus,
};
