const axios = require("axios");
const https = require("https");
const InternTalentTrailSync = require("../models/InternTalentTrailSync");
const Intern = require("../models/Intern");

const BASE_URL = "https://talenttrail.slt.lk/api";
const SERVICE_TOKEN = "TH_SK_f8e7d6c5b4a39281z0y9x8w7v6u5t4s3r2q1p0";
const FEDERATED_EMAIL = "admin@slt.lk";

const sslAgent = new https.Agent({ rejectUnauthorized: false });

const talentTrailClient = axios.create({
  baseURL: BASE_URL,
  httpsAgent: sslAgent,
  timeout: 30000,
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

  const result = new Map();
  for (const [internId, projectsMap] of internProjectMap) {
    result.set(internId, Array.from(projectsMap.values()));
  }

  return result;
}

async function resolveLocalInternRef(talentTrailIntern) {
  const local = await Intern.findOne({
    Trainee_Email: talentTrailIntern.email,
  }).select("_id");
  return local ? local._id : null;
}

async function syncTalentTrailData() {
  console.log("[TalentTrailSync] Starting sync…");
  const startedAt = new Date();

  let token;
  try {
    token = await getTalentTrailToken();
  } catch (err) {
    console.error("[TalentTrailSync] Auth error:", err.message);
    throw err;
  }

  const [interns, internProjectMap] = await Promise.all([
    fetchAllInterns(token),
    buildInternProjectMap(token),
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

  return { processed: updated, errors, duration };
}

module.exports = { syncTalentTrailData };
