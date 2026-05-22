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
   * Aggregates: intern details, projects, attendance count.
   *
   * @param {string} internCode – Trainee ID / intern code (e.g. "INT-2026-001")
   * @param {string} email – Intern email (fallback lookup)
   */
  async getCertificateData(internCode, email) {
    try {
      // 1. Find the intern in TalentTrail
      let ttIntern = null;

      if (internCode) {
        try {
          ttIntern = await this.getInternByCode(internCode);
        } catch { /* not found by code, try list */ }
      }

      // Fallback: search by email in full list
      if (!ttIntern && email) {
        try {
          const allInterns = await this.getInterns();
          ttIntern = allInterns.find(
            (i) => i.email?.toLowerCase() === email.toLowerCase()
          );
        } catch { /* ignore */ }
      }

      // 2. Get projects the intern is involved in
      let internProjects = [];
      try {
        if (ttIntern) {
          const [allTeams, allTeamMembers, allProjects] = await Promise.all([
            this.getTeams(),
            this.getTeamMembers(),
            this.getProjects(),
          ]);

          // Find teams this intern belongs to
          const internTeamIds = allTeamMembers
            .filter((tm) => tm.internId === ttIntern.internId)
            .map((tm) => tm.teamId);

          // Find projects assigned to those teams
          const projectIds = new Set();
          allProjects.forEach((p) => {
            if (p.assignedTeamIds?.some((tid) => internTeamIds.includes(tid))) {
              projectIds.add(p.projectId);
            }
          });

          internProjects = allProjects.filter((p) =>
            projectIds.has(p.projectId)
          );
        }
      } catch (err) {
        console.warn("Failed to fetch projects for intern:", err.message);
      }

      // 3. Get meeting attendance count
      let attendanceCount = 0;
      try {
        const attendance = await this.getProjectAttendance();
        if (Array.isArray(attendance)) {
          attendanceCount = attendance.filter(
            (a) => a.status === "PRESENT"
          ).length;
        }
      } catch (err) {
        console.warn("Failed to fetch attendance:", err.message);
      }

      return {
        talentTrailIntern: ttIntern || null,
        projects: internProjects,
        attendanceCount,
      };
    } catch (err) {
      console.error("getCertificateData error:", err.message);
      return {
        talentTrailIntern: null,
        projects: [],
        attendanceCount: 0,
        error: err.message,
      };
    }
  }
}

module.exports = new TalentTrailService();
