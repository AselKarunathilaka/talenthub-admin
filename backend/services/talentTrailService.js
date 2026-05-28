const axios = require("axios");

const TALENTTRAIL_BASE_URL = "https://talenttrail.slt.lk/api";
const SERVICE_TOKEN = "TH_SK_f8e7d6c5b4a39281z0y9x8w7v6u5t4s3r2q1p0";

/**
 * Service to interact with the TalentTrail API.
 * Handles federated login + data fetching for certificate generation.
 */
class TalentTrailService {
  constructor() {
    this._token = null;
    this._tokenExpiry = null;
    this.client = axios.create({
      baseURL: TALENTTRAIL_BASE_URL,
      timeout: 15000,
      headers: { "Content-Type": "application/json" },
    });
  }

  /** Get a valid TalentTrail token (cached until near expiry) */
  async getToken() {
    if (this._token && this._tokenExpiry && Date.now() < this._tokenExpiry) {
      return this._token;
    }

    try {
      const res = await this.client.post("/auth/federated-login", {
        email: "admin@slt.lk",
        source: "talenthub",
        timestamp: Date.now(),
      }, {
        headers: { "X-Service-Token": SERVICE_TOKEN },
      });

      this._token = res.data.token;
      // Refresh 10 min before expiry (token lasts ~24h)
      this._tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
      return this._token;
    } catch (err) {
      console.error("TalentTrail federated login failed:", err.message);
      throw new Error("Failed to authenticate with TalentTrail");
    }
  }

  /** Authenticated GET helper */
  async authGet(endpoint) {
    const token = await this.getToken();
    const res = await this.client.get(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }

  /** Get all interns from TalentTrail */
  async getInterns() {
    return this.authGet("/interns");
  }

  /** Get intern by TalentTrail ID */
  async getInternById(id) {
    return this.authGet(`/interns/${id}`);
  }

  /** Get intern by intern code (e.g. INT-2026-001) */
  async getInternByCode(code) {
    return this.authGet(`/interns/code/${code}`);
  }

  /** Get all projects */
  async getProjects() {
    return this.authGet("/projects");
  }

  /** Get all teams */
  async getTeams() {
    return this.authGet("/teams");
  }

  /** Get all team members */
  async getTeamMembers() {
    return this.authGet("/team-members");
  }

  /** Get project-team assignments for a project */
  async getProjectTeams(projectId) {
    return this.authGet(`/project-teams/project/${projectId}`);
  }

  /** Get projects assigned to a team */
  async getTeamProjects(teamId) {
    return this.authGet(`/project-teams/team/${teamId}`);
  }

  /** Get project attendance records */
  async getProjectAttendance() {
    return this.authGet("/project-attendance");
  }

  /**
   * Get enriched certificate data for a specific intern.
   * Aggregates: intern details, projects, modules, attendance count.
   *
   * @param {string} internCode – Trainee ID / intern code (e.g. "INT-2026-001")
   * @param {string} email – Intern email (fallback lookup)
   */
  async getCertificateData(internCode, email) {
    try {
      // ── Step 1: Find the intern in TalentTrail ────────────────────────
      let ttIntern = null;

      if (internCode) {
        try {
          ttIntern = await this.getInternByCode(internCode);
        } catch { /* not found by code */ }
      }

      // Fallback: match by email from full intern list
      if (!ttIntern && email) {
        try {
          const allInterns = await this.getInterns();
          ttIntern = Array.isArray(allInterns)
            ? allInterns.find(
                (i) => i.email?.toLowerCase() === email.toLowerCase()
              )
            : null;
        } catch { /* ignore */ }
      }

      if (!ttIntern) {
        return { talentTrailIntern: null, projects: [], attendanceCount: 0 };
      }

      // ── Step 2: Find teams this intern belongs to ─────────────────────
      // GET /team-members → filter by internId
      let internTeamIds = [];
      try {
        const allMembers = await this.getTeamMembers();
        internTeamIds = Array.isArray(allMembers)
          ? allMembers
              .filter((tm) => tm.internId === ttIntern.internId)
              .map((tm) => tm.teamId)
          : [];
      } catch (err) {
        console.warn("Failed to fetch team members:", err.message);
      }

      // ── Step 3: Find all projects via team assignments ─────────────────
      // Use GET /project-teams/team/{teamId} for each team (direct endpoint)
      let internProjects = [];
      try {
        if (internTeamIds.length > 0) {
          // Fetch project-team records for each team in parallel
          const teamProjectResults = await Promise.all(
            internTeamIds.map((tid) =>
              this.getTeamProjects(tid).catch(() => [])
            )
          );

          // Collect unique project IDs from team assignments
          const projectIds = new Set();
          teamProjectResults.flat().forEach((pt) => {
            if (pt.projectId) projectIds.add(pt.projectId);
          });

          if (projectIds.size > 0) {
            // Fetch full project details in parallel
            const projectDetails = await Promise.all(
              [...projectIds].map((pid) =>
                this.authGet(`/projects/${pid}`).catch(() => null)
              )
            );

            internProjects = projectDetails.filter(Boolean).map((p) => ({
              projectId: p.projectId,
              projectName: p.projectName || "N/A",
              supervisorName: p.supervisorName || "N/A",
              status: p.status || "N/A",
              description: p.description || "",
              startDate: p.startDate || null,
              targetDate: p.targetDate || null,
            }));
          }
        }
      } catch (err) {
        console.warn("Failed to fetch intern projects:", err.message);
      }

      // ── Step 4: Count meeting attendance ──────────────────────────────
      // GET /project-attendance returns records for the authenticated context.
      // Since we use an admin token, it returns all records — we count PRESENT
      // records that belong to the projects this intern is assigned to.
      let attendanceCount = 0;
      let attendanceRecords = [];
      try {
        const attendance = await this.getProjectAttendance();
        if (Array.isArray(attendance) && internProjects.length > 0) {
          const internProjectIds = new Set(
            internProjects.map((p) => p.projectId)
          );
          attendanceRecords = attendance.filter(
            (a) => internProjectIds.has(a.projectId)
          );
          attendanceCount = attendanceRecords.filter((a) => a.status === "PRESENT").length;
        } else if (Array.isArray(attendance)) {
          // No project info — return all records as best-effort
          attendanceRecords = attendance;
          attendanceCount = attendance.filter(
            (a) => a.status === "PRESENT"
          ).length;
        }
      } catch (err) {
        console.warn("Failed to fetch attendance:", err.message);
      }

      return {
        talentTrailIntern: ttIntern,
        projects: internProjects,
        attendanceCount,
        attendanceRecords,
      };
    } catch (err) {
      console.error("getCertificateData error:", err.message);
      return {
        talentTrailIntern: null,
        projects: [],
        attendanceCount: 0,
        attendanceRecords: [],
        error: err.message,
      };
    }
  }
}

module.exports = new TalentTrailService();
