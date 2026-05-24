const fetch = require("node-fetch");
const https = require("https");
const InternTalentTrailSync = require("../models/InternTalentTrailSync");
const Intern = require("../models/Intern");

const BASE_URL = "https://talenttrail.slt.lk/api";
const SERVICE_TOKEN = "TH_SK_f8e7d6c5b4a39281z0y9x8w7v6u5t4s3r2q1p0";
const FEDERATED_EMAIL = "admin@slt.lk";

const sslAgent = new https.Agent({ rejectUnauthorized: false });

async function getTalentTrailToken() {
  const res = await fetch(`${BASE_URL}/auth/federated-login`, {
    method: "POST",
    agent: sslAgent,
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": SERVICE_TOKEN,
    },
    body: JSON.stringify({
      email: FEDERATED_EMAIL,
      source: "talenthub",
      timestamp: Date.now(),
    }),
  });

  if (!res.ok) {
    throw new Error(`TalentTrail auth failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.token;
}

async function fetchAllInterns(token) {
  const res = await fetch(`${BASE_URL}/interns`, {
    agent: sslAgent,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch interns: ${res.status}`);
  return res.json();
}

async function buildInternProjectMap(token) {
  const [teamsRes, projectsRes] = await Promise.all([
    fetch(`${BASE_URL}/teams`, {
      agent: sslAgent,
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${BASE_URL}/projects`, {
      agent: sslAgent,
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  if (!teamsRes.ok)
    throw new Error(`Failed to fetch teams: ${teamsRes.status}`);
  if (!projectsRes.ok)
    throw new Error(`Failed to fetch projects: ${projectsRes.status}`);

  const teams = await teamsRes.json();
  const projects = await projectsRes.json();

  const projectMap = new Map(projects.map((p) => [p.projectId, p]));

  const teamToProjects = new Map();
  for (const project of projects) {
    for (const teamId of project.assignedTeamIds || []) {
      if (!teamToProjects.has(teamId)) teamToProjects.set(teamId, []);
      teamToProjects.get(teamId).push(project.projectId);
    }
  }

  const teamMembersRes = await fetch(`${BASE_URL}/team-members`, {
    agent: sslAgent,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!teamMembersRes.ok)
    throw new Error(`Failed to fetch team-members: ${teamMembersRes.status}`);
  const teamMembers = await teamMembersRes.json();

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
