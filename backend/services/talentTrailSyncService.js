const axios = require("axios");
const https = require("https");
const InternTalentTrailSync = require("../models/InternTalentTrailSync");
const Intern = require("../models/Intern");

const BASE_URL = "https://talenttrail.slt.lk/api";
const SERVICE_TOKEN = process.env.TALENTHUB_FEDERATION_SECRET || "TH_SK_f8e7d6c5b4a39281z0y9x8w7v6u5t4s3r2q1p0";
const FEDERATED_EMAIL = "admin@slt.lk";

const sslAgent = new https.Agent({ rejectUnauthorized: false });

const talentTrailClient = axios.create({
  baseURL: BASE_URL,
  httpsAgent: sslAgent,
  timeout: 30000,
});

const ghClient = axios.create({
  baseURL: "https://api.github.com",
  timeout: 15000,
  headers: {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "TalentHub-SLT",
  },
});

function formatAxiosError(error, fallbackMessage) {
  const status = error.response?.status;
  const statusText = error.response?.statusText;
  const details =
    typeof error.response?.data === "string"
      ? error.response.data
      : error.response?.data?.message || error.response?.data?.error;

  return [
    fallbackMessage,
    status ? `${status}${statusText ? ` ${statusText}` : ""}` : null,
    details,
  ].filter(Boolean).join(": ");
}

async function getTalentTrailToken() {
  try {
    const res = await talentTrailClient.post(
      "/auth/federated-login",
      {
        email: FEDERATED_EMAIL,
        source: "talenthub",
        timestamp: Date.now(),
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Service-Token": SERVICE_TOKEN,
        },
      },
    );

    return res.data.token;
  } catch (error) {
    throw new Error(formatAxiosError(error, "TalentTrail auth failed"));
  }
}

async function getTalentTrailData(path, token, label) {
  try {
    const res = await talentTrailClient.get(path, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  } catch (error) {
    throw new Error(formatAxiosError(error, `Failed to fetch ${label}`));
  }
}

async function fetchAllInterns(token) {
  return getTalentTrailData("/interns", token, "interns");
}

async function buildInternProjectMap(token) {
  const [teams, projects] = await Promise.all([
    getTalentTrailData("/teams", token, "teams"),
    getTalentTrailData("/projects", token, "projects"),
  ]);

  const projectMap = new Map(projects.map((p) => [p.projectId, p]));

  const teamToProjects = new Map();
  for (const project of projects) {
    for (const teamId of project.assignedTeamIds || []) {
      if (!teamToProjects.has(teamId)) teamToProjects.set(teamId, []);
      teamToProjects.get(teamId).push(project.projectId);
    }
  }

  const teamMembers = await getTalentTrailData("/team-members", token, "team-members");

  const internProjectMap = new Map();

  for (const member of teamMembers) {
    const { internId, teamId } = member;
    if (!internId || !teamId) continue;

    const team = teams.find((t) => t.teamId === teamId);
    if (!team) continue;

    const projectIds = teamToProjects.get(teamId) || [];

    if (!internProjectMap.has(internId))
      internProjectMap.set(internId, new Map());
    const projectsForIntern = internProjectMap.get(internId);

    for (const projectId of projectIds) {
      const project = projectMap.get(projectId);
      if (!project) continue;

      if (!projectsForIntern.has(projectId)) {
        projectsForIntern.set(projectId, {
          projectId: project.projectId,
          projectName: project.projectName,
          description: project.description,
          status: project.status,
          startDate: project.startDate ? new Date(project.startDate) : null,
          targetDate: project.targetDate ? new Date(project.targetDate) : null,
          supervisorName: project.supervisorName,
          projectManagerName: project.projectManagerName,
          teams: [],
        });
      }

      projectsForIntern.get(projectId).teams.push({
        teamId: team.teamId,
        teamName: team.teamName,
        teamLeaderId: team.teamLeaderId,
        teamLeaderName: team.teamLeaderName,
      });
    }
  }

  // Handle direct assignment to projects (no team)
  for (const project of projects) {
    const directInternIds = project.assignedInternIds || project.internIds || project.interns || project.assignedMembers || [];
    for (const internId of directInternIds) {
      if (!internProjectMap.has(internId)) {
        internProjectMap.set(internId, new Map());
      }
      const projectsForIntern = internProjectMap.get(internId);
      
      if (!projectsForIntern.has(project.projectId)) {
        projectsForIntern.set(project.projectId, {
          projectId: project.projectId,
          projectName: project.projectName,
          description: project.description,
          status: project.status,
          startDate: project.startDate ? new Date(project.startDate) : null,
          targetDate: project.targetDate ? new Date(project.targetDate) : null,
          supervisorName: project.supervisorName,
          projectManagerName: project.projectManagerName,
          teams: [],
        });
      }
    }
  }

  const result = new Map();
  for (const [internId, projectsMap] of internProjectMap) {
    result.set(internId, Array.from(projectsMap.values()));
  }

  return result;
}

async function resolveLocalInternRef(talentTrailIntern) {
  const code = String(talentTrailIntern.internCode || talentTrailIntern.id || "").trim();
  const email = String(talentTrailIntern.email || "").trim();

  const query = [];
  if (code) query.push({ Trainee_ID: code });
  if (email) query.push({ Trainee_Email: new RegExp("^" + email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") });
  if (query.length === 0) return null;

  const local = await Intern.findOne({ $or: query }).select("_id");
  return local ? local._id : null;
}

async function syncGitCommits(token, ttInterns, ttProjects, ttModules) {
  try {
    const githubByEmail = new Map();
    ttInterns.forEach((i) => {
      if (i.email) {
        let gh = (i.githubUsername || "").trim();
        gh = gh.replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "").trim();
        githubByEmail.set(i.email.toLowerCase(), gh || null);
      }
    });

    const repoMap = new Map();
    for (const proj of ttProjects) {
      if (proj.repoName && proj.repoAccessToken) {
        repoMap.set(proj.repoName, proj.repoAccessToken);
      }
      const modules = proj.modules || proj.projectModules || proj.moduleList || proj.subModules || proj.children || [];
      for (const mod of modules) {
        if (mod.repoName && mod.repoAccessToken) {
          repoMap.set(mod.repoName, mod.repoAccessToken);
        }
      }
    }
    for (const mod of ttModules) {
      if (mod.repoName && mod.repoAccessToken) {
        repoMap.set(mod.repoName, mod.repoAccessToken);
      }
    }

    const repoCommitsMap = new Map();
    for (const [repoName, repoAccessToken] of repoMap.entries()) {
      try {
        let allCommits = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const ghRes = await ghClient.get(`/repos/${repoName}/commits`, {
            headers: { Authorization: `token ${repoAccessToken}` },
            params: { per_page: 100, page },
          });
          const pageCommits = Array.isArray(ghRes.data) ? ghRes.data : [];
          allCommits = allCommits.concat(pageCommits);
          if (pageCommits.length < 100 || page >= 10) hasMore = false;
          else page++;
        }

        repoCommitsMap.set(repoName, allCommits);
      } catch (err) {
        repoCommitsMap.set(repoName, []);
      }
    }

    const syncRecords = await InternTalentTrailSync.find({}).lean();
    for (const syncRec of syncRecords) {
      if (!syncRec.email || !syncRec.projects || syncRec.projects.length === 0) continue;

      const email = syncRec.email.toLowerCase();
      const githubUser = githubByEmail.get(email);
      const syncProjectIds = new Set(syncRec.projects.map((p) => p.projectId));
      const targetRepos = new Set();

      for (const proj of ttProjects) {
        const isDirect = syncProjectIds.has(proj.projectId);
        const parentId = proj.parentProjectId ?? proj.parentId ?? proj.projectParentId ?? null;
        const isChild = !isDirect && parentId !== null && syncProjectIds.has(parentId);

        if ((isDirect || isChild) && proj.repoName) targetRepos.add(proj.repoName);

        if (isDirect) {
          const modules = proj.modules || proj.projectModules || proj.moduleList || proj.subModules || proj.children || [];
          for (const mod of modules) {
            if (mod.repoName) targetRepos.add(mod.repoName);
          }
        }
      }

      for (const mod of ttModules) {
        const isOwner = mod.ownerInternId === syncRec.talentTrailInternId;
        const isProjectMod = mod.projectId && syncProjectIds.has(mod.projectId);
        if ((isOwner || isProjectMod) && mod.repoName) targetRepos.add(mod.repoName);
      }

      let totalCommits = 0;
      for (const repoName of targetRepos) {
        const commits = repoCommitsMap.get(repoName) || [];
        for (const c of commits) {
          const authorLogin = c.author?.login || null;
          const authorEmail = c.commit?.author?.email || null;

          const isMatch = githubUser
            ? (authorLogin && authorLogin.toLowerCase() === githubUser.toLowerCase()) || (authorEmail && authorEmail.toLowerCase() === email)
            : (authorEmail && authorEmail.toLowerCase() === email);

          if (isMatch) totalCommits++;
        }
      }

      await Promise.all([
        InternTalentTrailSync.updateOne({ _id: syncRec._id }, { $set: { commitsCount: totalCommits } }),
        Intern.updateMany(
          {
            $or: [
              ...(syncRec.internRef ? [{ _id: syncRec.internRef }] : []),
              ...(syncRec.internCode ? [{ Trainee_ID: String(syncRec.internCode).trim() }] : []),
              ...(syncRec.email ? [{ Trainee_Email: new RegExp("^" + syncRec.email.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") }] : []),
            ],
          },
          { $set: { commitsCount: totalCommits } }
        ),
      ]);
    }
  } catch (err) {
    console.warn("[TalentTrailSync] Git commit sync warning:", err.message);
  }
}

let isSyncing = false;
let lastSyncTime = 0;
const SYNC_COOLDOWN_MS = 15 * 1000;

async function syncTalentTrailData(options = {}) {
  const force = options.force || false;
  if (!force && Date.now() - lastSyncTime < SYNC_COOLDOWN_MS) {
    console.log("[TalentTrailSync] Skipped (cooldown)");
    return { skipped: true };
  }
  if (isSyncing) {
    console.log("[TalentTrailSync] Sync already in progress, skipping duplicate call...");
    return { skipped: true, inProgress: true };
  }
  isSyncing = true;

  try {
    console.log("[TalentTrailSync] Starting sync…");
    const startedAt = new Date();

  let token;
  try {
    token = await getTalentTrailToken();
  } catch (err) {
    console.error("[TalentTrailSync] Auth error:", err.message);
    throw err;
  }

  const [interns, internProjectMap, projData, modData] = await Promise.all([
    fetchAllInterns(token),
    buildInternProjectMap(token),
    getTalentTrailData("/projects", token, "projects").catch(() => []),
    getTalentTrailData("/modules", token, "modules").catch(() => []),
  ]);

  console.log(
    `[TalentTrailSync] Fetched ${interns.length} interns from TalentTrail`,
  );

  let updated = 0;
  let errors = 0;

  for (const intern of interns) {
    try {
      const projects = internProjectMap.get(intern.internId) || [];
      const hasProjectAssignment = projects.some(
        (p) => Array.isArray(p.teams) && p.teams.length > 0,
      );
      const internRef = await resolveLocalInternRef(intern);

      await InternTalentTrailSync.findOneAndUpdate(
        { talentTrailInternId: intern.internId },
        {
          $set: {
            internRef,
            talentTrailInternId: intern.internId,
            internCode: intern.internCode,
            name: intern.name,
            email: intern.email,
            projects,
            hasActiveProject: hasProjectAssignment,
            lastSyncedAt: new Date(),
            syncError: null,
          },
        },
        { upsert: true, new: true },
      );

      updated++;
    } catch (err) {
      errors++;
      console.error(
        `[TalentTrailSync] Error syncing intern ${intern.internId}:`,
        err.message,
      );
      await InternTalentTrailSync.findOneAndUpdate(
        { talentTrailInternId: intern.internId },
        { $set: { syncError: err.message, lastSyncedAt: new Date() } },
        { upsert: true },
      ).catch(() => {});
    }
  }

  const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[TalentTrailSync] Done in ${duration}s — processed: ${updated}, errors: ${errors}`,
  );

  // Background sync git commits across repos
  syncGitCommits(token, interns, Array.isArray(projData) ? projData : [], Array.isArray(modData) ? modData : []).catch((e) => {
    console.warn("[TalentTrailSync] Git commit sync failed:", e.message);
  });

  // Background evaluate TalentHub restrictions
  if (!options.skipRestrictionSync) {
    try {
      const talentHubRestrictionService = require("./talentHubRestrictionService");
      talentHubRestrictionService.syncAllRestrictions().catch((e) => {
        console.warn("[TalentTrailSync] Restriction sync error:", e.message);
      });
    } catch (_) {}
  }

  return { processed: updated, errors, duration };
  } finally {
    isSyncing = false;
    lastSyncTime = Date.now();
  }
}

module.exports = { syncTalentTrailData, syncGitCommits };
