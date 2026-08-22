const Intern = require("../models/Intern");
const DailyRecord = require("../models/DailyRecord");
const Project = require("../models/Project");
const FaceAttendanceLog = require("../models/FaceAttendanceLog");
const InternTalentTrailSync = require("../models/InternTalentTrailSync");
const { getActiveInternsQuery, getSriLankanHolidays } = require("../utils/workingDays");
const { gitCommitsCache } = require("./adminController");
const moment = require("moment-timezone");

const TZ = "Asia/Colombo";
const DAILY_ATTENDANCE_TYPES = new Set(["daily", "daily_qr", "face", "manual_daily", "manual", "qr"]);
const MEETING_ATTENDANCE_TYPES = new Set(["qr", "face_meeting", "meeting", "manual_meeting", "manual"]);

// ── Timezone-aware working day analyzer (Excludes Weekends & Sri Lankan Public Holidays) ─
const getColomboDateInfo = (date, holidays) => {
  if (!date) return null;
  const m = moment.tz(date, TZ);
  if (!m.isValid()) return null;
  const dateStr = m.format("YYYY-MM-DD");
  const dow = m.day(); // 0 = Sunday, 6 = Saturday
  const isWeekend = dow === 0 || dow === 6;
  const isHoliday = holidays ? holidays.has(dateStr) : false;
  const isWorkingDay = !isWeekend && !isHoliday;
  return { dateStr, dow, isWeekend, isHoliday, isWorkingDay };
};

// ── Working days calculation (Elapsed Mon–Fri weekdays minus Dynamic Sri Lankan Public Holidays) ─
const calcWorkingDays = (startDate, endDate = new Date(), holidays) => {
  if (!startDate) return 1;
  const start = moment.tz(startDate, TZ).startOf("day");
  if (!start.isValid()) return 1;
  const end = moment.tz(endDate, TZ).startOf("day");
  if (end.isSameOrBefore(start)) return 1;

  let count = 0;
  const cursor = start.clone();

  while (cursor.isSameOrBefore(end, "day")) {
    const dow = cursor.day();
    const dateStr = cursor.format("YYYY-MM-DD");
    if (dow !== 0 && dow !== 6 && (!holidays || !holidays.has(dateStr))) {
      count++;
    }
    cursor.add(1, "day");
  }
  return Math.max(1, count);
};

// ── Elapsed weeks calculation ────────────────────────────────────────────────
const calcElapsedWeeks = (startDate, endDate = new Date()) => {
  if (!startDate) return 1;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return 1;
  const msElapsed = new Date(endDate) - start;
  if (msElapsed <= 0) return 1;
  return Math.max(1, Math.ceil(msElapsed / (1000 * 60 * 60 * 24 * 7)));
};

// ── Meeting and Week key helpers ─────────────────────────────────────────────
const getMeetingKey = (dateStr, meetingName) =>
  `${dateStr}::${String(meetingName || "General Meeting")
    .trim()
    .toLowerCase()}`;

function weekKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
}

// ── Specialization classifier for Group 1 (QA, BA, PM, DevOps, AI) ───────────
function isNoCommitSpecialization(spec) {
  if (!spec) return false;
  const s = spec.trim().toLowerCase();
  return (
    s === "qa" ||
    s.includes("quality assurance") ||
    s.includes("qa engineer") ||
    s === "ba" ||
    s.includes("business analyst") ||
    s.includes("business analysis") ||
    s === "pm" ||
    s.includes("project manager") ||
    s.includes("project management") ||
    s === "devops" ||
    s.includes("devops") ||
    s === "ai" ||
    s.includes("artificial intelligence") ||
    s.includes("machine learning") ||
    s.includes("data science") ||
    s.startsWith("ai ") ||
    s.endsWith(" ai") ||
    s.includes(" ai ")
  );
}

// ── Helper: Format real project status ────────────────────────────────────────
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

// ── Helper: Extract commits count ─────────────────────────────────────────────
function getInternCommitsCount(intern) {
  let count = 0;
  const cached = gitCommitsCache ? gitCommitsCache.get(`git_commits_${intern._id}`) : null;
  if (cached && cached.data) {
    if (cached.data.totalCommits !== undefined) {
      count = Number(cached.data.totalCommits) || 0;
    } else {
      const all = [];
      const projects = Array.isArray(cached.data) ? cached.data : (cached.data.projectCommits || []);
      function walk(node) {
        if (!node) return;
        if (Array.isArray(node.commits)) all.push(...node.commits);
        if (Array.isArray(node.modules)) node.modules.forEach(walk);
        if (Array.isArray(node.children)) node.children.forEach(walk);
        if (Array.isArray(node.subProjects)) node.subProjects.forEach(walk);
      }
      projects.forEach(walk);
      count = all.length;
    }
  } else if (typeof intern.commitsCount === "number") {
    count = intern.commitsCount;
  } else if (Array.isArray(intern.gitCommits)) {
    count = intern.gitCommits.length;
  }
  return count;
}

// ── In-Memory Analytics Cache (TTL = 60 seconds) ──────────────────────────────
const analyticsCache = new Map();
const ANALYTICS_CACHE_TTL_MS = 60 * 1000;

function getCachedAnalytics(key) {
  const entry = analyticsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ANALYTICS_CACHE_TTL_MS) {
    analyticsCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedAnalytics(key, data) {
  analyticsCache.set(key, { data, timestamp: Date.now() });
  if (analyticsCache.size > 50) {
    const oldestKey = analyticsCache.keys().next().value;
    analyticsCache.delete(oldestKey);
  }
}

// Fast date formatting in Colombo timezone without moment overhead
const COLOMBO_OFFSET_MS = 330 * 60 * 1000; // +05:30 in ms

function toColomboYMD(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  const colomboTime = new Date(d.getTime() + COLOMBO_OFFSET_MS);
  return colomboTime.toISOString().slice(0, 10);
}

// ── Main Controller: GET /api/admin/analytics ─────────────────────────────────
const getAdminAnalytics = async (req, res) => {
  try {
    const isRefresh = req.query.refresh === "true";
    const filterStartDateStr = req.query.startDate ? String(req.query.startDate).trim() : null;
    const filterEndDateStr = req.query.endDate ? String(req.query.endDate).trim() : null;
    const useInternStartDate = req.query.useInternStartDate === "true" || req.query.useInternStartDate === true;

    const cacheKey = `${filterStartDateStr || "all"}_${filterEndDateStr || "all"}_${useInternStartDate}`;

    // Return cached response if valid and not a manual refresh
    if (!isRefresh) {
      const cached = getCachedAnalytics(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    const activeQuery = getActiveInternsQuery();

    // 1. Fetch active interns
    const interns = await Intern.find(activeQuery)
      .select("Trainee_ID Trainee_Name Trainee_Email Institute field_of_spec_name team Training_StartDate Training_EndDate gitCommits commitsCount attendance")
      .lean();

    if (!interns || interns.length === 0) {
      setCachedAnalytics(cacheKey, []);
      return res.status(200).json([]);
    }

    const internIds = interns.map((i) => i._id);
    const internEmails = interns.map((i) => i.Trainee_Email).filter(Boolean);

    // 2. High-performance queries in parallel
    const [dailyRecords, faceLogs, talentTrailSyncRecords, projectRecords] = await Promise.all([
      // (A) DailyRecords
      DailyRecord.find({ internId: { $in: internIds } })
        .select("internId date status meetingAttendance")
        .lean(),

      // (B) FaceAttendanceLog (authoritative audit for face scans)
      FaceAttendanceLog.find({
        internId: { $in: internIds },
        status: "present",
        method: "face",
        qrBackupUsed: { $ne: true },
      })
        .select("internId attendanceDate attendanceTime")
        .lean(),

      // (C) TalentTrail sync projects
      InternTalentTrailSync.find({
        $or: [
          { internRef: { $in: internIds } },
          { email: { $in: internEmails } },
        ],
      })
        .select("internRef email projects")
        .lean(),

      // (D) System projects
      Project.find({})
        .select("projectName status team tasks.assignedTo")
        .lean(),
    ]);

    // 3. Build fast lookup maps by internId
    const drMap = new Map();
    for (const dr of dailyRecords) {
      if (!dr.internId) continue;
      const idStr = dr.internId.toString();
      if (!drMap.has(idStr)) drMap.set(idStr, []);
      drMap.get(idStr).push(dr);
    }

    const faceMap = new Map();
    for (const fl of faceLogs) {
      if (!fl.internId) continue;
      const idStr = fl.internId.toString();
      if (!faceMap.has(idStr)) faceMap.set(idStr, []);
      const rawDate = fl.attendanceDate || fl.attendanceTime;
      if (rawDate) {
        faceMap.get(idStr).push(rawDate);
      }
    }

    const talentTrailMap = new Map();
    const talentTrailByEmail = new Map();
    for (const sync of talentTrailSyncRecords) {
      if (sync.internRef) {
        talentTrailMap.set(sync.internRef.toString(), sync.projects || []);
      }
      if (sync.email) {
        talentTrailByEmail.set(sync.email.toLowerCase(), sync.projects || []);
      }
    }

    // Map projects by team and assigned intern
    const projectsByInternId = new Map();
    const projectsByTeam = new Map();

    for (const proj of projectRecords) {
      const formattedStatus = formatProjectStatus(proj.status);
      if (proj.team) {
        if (!projectsByTeam.has(proj.team)) projectsByTeam.set(proj.team, []);
        projectsByTeam.get(proj.team).push({
          name: proj.projectName,
          status: formattedStatus,
        });
      }
      if (Array.isArray(proj.tasks)) {
        for (const task of proj.tasks) {
          if (Array.isArray(task.assignedTo)) {
            for (const assignedId of task.assignedTo) {
              const idStr = assignedId.toString();
              if (!projectsByInternId.has(idStr)) projectsByInternId.set(idStr, []);
              projectsByInternId.get(idStr).push({
                name: proj.projectName,
                status: formattedStatus,
              });
            }
          }
        }
      }
    }

    // 4. Construct final analytics records
    const currentDate = new Date();
    const currentStr = moment.tz(currentDate, TZ).format("YYYY-MM-DD");

    const currentYear = currentDate.getFullYear();
    const holidays = getSriLankanHolidays([currentYear - 2, currentYear - 1, currentYear, currentYear + 1]) || new Set();

    const rawAnalyticsData = interns.map((intern) => {
      const idStr = intern._id.toString();
      const internDrs = drMap.get(idStr) || [];
      const internFaceRawDates = faceMap.get(idStr) || [];

      const internStartDate = intern.Training_StartDate;
      const internEndDate = intern.Training_EndDate;

      const internStartStr = internStartDate ? moment.tz(internStartDate, TZ).format("YYYY-MM-DD") : "1970-01-01";
      const internEndStr = internEndDate ? moment.tz(internEndDate, TZ).format("YYYY-MM-DD") : "2099-12-31";

      // If date range is specified, check if intern was active in that period
      if (filterStartDateStr && internEndStr < filterStartDateStr) {
        return null;
      }
      if (filterEndDateStr && internStartStr > filterEndDateStr) {
        return null;
      }

      // Compute effective calculation window
      let effectiveEndStr = filterEndDateStr
        ? (internEndStr < filterEndDateStr ? internEndStr : filterEndDateStr)
        : (internEndStr < currentStr ? internEndStr : currentStr);

      // Do not exceed current date for attendance calculation
      if (effectiveEndStr > currentStr) {
        effectiveEndStr = currentStr;
      }

      let effectiveStartStr;
      if (useInternStartDate) {
        // Calculate from intern's internship start date up to selected range end
        effectiveStartStr = internStartStr;
      } else if (filterStartDateStr) {
        // Calculate from first day of selected month/range (or intern start if intern started later in that month)
        effectiveStartStr = internStartStr > filterStartDateStr ? internStartStr : filterStartDateStr;
      } else {
        effectiveStartStr = internStartStr;
      }

      // If effectiveStartStr > effectiveEndStr (e.g. intern started after the calculation period ended)
      if (effectiveStartStr > effectiveEndStr) {
        return null;
      }

      const effectiveStartDate = moment.tz(effectiveStartStr, TZ).toDate();
      const effectiveEndDate = moment.tz(effectiveEndStr, TZ).toDate();

      const workingDays = calcWorkingDays(effectiveStartDate, effectiveEndDate, holidays);
      const expectedMeetings = calcElapsedWeeks(effectiveStartDate, effectiveEndDate);

      // ── Attendance Collections (Working Days Only: Mon–Fri, excluding weekends & public holidays) ──
      const dailyAttendanceDates = new Set();
      const dailyRecordMeetingKeys = new Set();
      const meetingWeeksSet = new Set();
      let logbookCount = 0;

      // 1. Process DailyRecords (Valid working days only — Weekends & Holidays excluded)
      for (const record of internDrs) {
        const info = getColomboDateInfo(record.date, holidays);
        if (info && info.dateStr >= effectiveStartStr && info.dateStr <= effectiveEndStr && info.isWorkingDay) {
          const recordStatus = (record.status || "working").toLowerCase();
          const isLeave = recordStatus === "leave" || recordStatus === "study_leave";

          if (!isLeave) {
            logbookCount++;
            dailyAttendanceDates.add(info.dateStr);
          }

          if (record.meetingAttendance && record.meetingAttendance.length > 0) {
            for (const meeting of record.meetingAttendance) {
              const meetingName = meeting.projectName || meeting.meetingTitle;
              dailyRecordMeetingKeys.add(getMeetingKey(info.dateStr, meetingName));
              const wk = weekKey(info.dateStr);
              if (wk) meetingWeeksSet.add(wk);
            }
          }
        }
      }

      // 2. Process intern.attendance for Meetings & Daily (Valid working days only — Weekends & Holidays excluded)
      const attList = intern.attendance || [];
      for (const entry of attList) {
        const info = getColomboDateInfo(entry.date, holidays);
        if (info && info.dateStr >= effectiveStartStr && info.dateStr <= effectiveEndStr && info.isWorkingDay) {
          const type = (entry.type || "").toLowerCase();
          const status = (entry.status || "").toLowerCase();
          const isPresent = status === "present" || status === "late" || !entry.status;

          if (isPresent) {
            if (MEETING_ATTENDANCE_TYPES.has(type)) {
              const legacyName =
                entry.projectName ||
                entry.meetingName ||
                entry.meeting ||
                entry.title ||
                entry.subject ||
                entry.topic;
              const key = getMeetingKey(info.dateStr, legacyName);
              if (!dailyRecordMeetingKeys.has(key)) {
                const wk = weekKey(info.dateStr);
                if (wk) meetingWeeksSet.add(wk);
              }
            }

            if (DAILY_ATTENDANCE_TYPES.has(type)) {
              dailyAttendanceDates.add(info.dateStr);
            }
          }
        }
      }

      // 3. Process FaceAttendanceLog dates (Valid working days only — Weekends & Holidays excluded)
      for (const rawDate of internFaceRawDates) {
        const info = getColomboDateInfo(rawDate, holidays);
        if (info && info.dateStr >= effectiveStartStr && info.dateStr <= effectiveEndStr && info.isWorkingDay) {
          dailyAttendanceDates.add(info.dateStr);
        }
      }

      const dailyAttendanceCount = dailyAttendanceDates.size;
      // Meeting attendance count: Maximum 1 count per calendar week (number of unique attended weeks)
      const meetingAttendanceCount = meetingWeeksSet.size;
      const attendedMeetingWeeks = meetingWeeksSet.size;
      const commitCount = getInternCommitsCount(intern);

      // ── Rates ──────────────────────────────────────────────────────────────
      const dailyAttendanceRate = Math.min(100, Math.round((dailyAttendanceCount / workingDays) * 100)) || 0;
      const meetingAttendanceRate = Math.min(100, Math.round((attendedMeetingWeeks / expectedMeetings) * 100)) || 0;
      const logbookRecordRate = Math.min(100, Math.round((logbookCount / workingDays) * 100)) || 0;

      // ── Specialization-Based Performance Rate ──────────────────────────────
      const baseAvg = (logbookRecordRate + meetingAttendanceRate) / 2;
      let performanceRate = 0;

      if (isNoCommitSpecialization(intern.field_of_spec_name)) {
        performanceRate = Math.min(100, Math.round(baseAvg));
      } else {
        performanceRate = Math.min(100, Math.round(baseAvg + commitCount));
      }

      // Status text
      let internStatus = "Good";
      if (performanceRate < 60) internStatus = "Poor";
      else if (performanceRate < 80) internStatus = "At Risk";

      // ── Assigned Projects ──────────────────────────────────────────────────
      const projectsList = [];
      const seenProjectNames = new Set();

      // 1. From TalentTrail sync
      const ttProjects =
        talentTrailMap.get(idStr) ||
        talentTrailByEmail.get((intern.Trainee_Email || "").toLowerCase()) ||
        [];
      ttProjects.forEach((p) => {
        if (p.projectName && !seenProjectNames.has(p.projectName)) {
          seenProjectNames.add(p.projectName);
          const pStatus = formatProjectStatus(p.status);
          projectsList.push({ name: p.projectName, status: pStatus });
        }
      });

      // 2. From assigned tasks in Project model
      const assignedProjects = projectsByInternId.get(idStr) || [];
      assignedProjects.forEach((p) => {
        if (p.name && !seenProjectNames.has(p.name)) {
          seenProjectNames.add(p.name);
          projectsList.push(p);
        }
      });

      // 3. From team in Project model
      if (intern.team) {
        const teamProjects = projectsByTeam.get(intern.team) || [];
        teamProjects.forEach((p) => {
          if (p.name && !seenProjectNames.has(p.name)) {
            seenProjectNames.add(p.name);
            projectsList.push(p);
          }
        });
      }

      // Default project badge if none found
      if (projectsList.length === 0 && intern.team) {
        projectsList.push({
          name: `${intern.team} Project`,
          status: "In Progress",
        });
      }

      return {
        id: idStr,
        traineeId: String(intern.Trainee_ID || `TR-${idStr.slice(-4).toUpperCase()}`),
        name: intern.Trainee_Name || "Unnamed Intern",
        email: intern.Trainee_Email || "N/A",
        institute: intern.Institute || "Not Specified",
        university: intern.Institute || "Not Specified",
        specialization: intern.field_of_spec_name || "Software Engineering",
        team: intern.team || "Unassigned",
        dailyAttendanceCount,
        meetingAttendanceCount,
        logbookCount,
        commitCount,
        workingDays,
        expectedMeetings,
        startDate: intern.Training_StartDate || null,
        endDate: intern.Training_EndDate || null,
        dailyAttendanceRate,
        meetingAttendanceRate,
        logbookRecordRate,
        performanceRate,
        internStatus,
        projects: projectsList,
      };
    });

    const analyticsData = rawAnalyticsData.filter(Boolean);

    setCachedAnalytics(cacheKey, analyticsData);

    return res.status(200).json(analyticsData);
  } catch (error) {
    console.error("[getAdminAnalytics] Error:", error);
    return res.status(500).json({ message: "Failed to fetch analytics data", error: error.message });
  }
};

module.exports = {
  getAdminAnalytics,
};
