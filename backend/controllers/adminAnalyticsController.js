const mongoose = require("mongoose");
const Intern = require("../models/Intern");
const DailyRecord = require("../models/DailyRecord");
const DailyAttendanceLog = require("../models/DailyAttendanceLog");
const MeetingAttendance = require("../models/MeetingAttendance");
const Project = require("../models/Project");
const FaceAttendanceLog = require("../models/FaceAttendanceLog");
const InternTalentTrailSync = require("../models/InternTalentTrailSync");
const { getActiveInternsQuery, getSriLankanHolidays } = require("../utils/workingDays");
const { gitCommitsCache } = require("./adminController");

// Fast Colombo timezone offset: +05:30 = 19,800,000 ms
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Convert any date value to Colombo YYYY-MM-DD string
 */
function toDateStr(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  const colombo = new Date(d.getTime() + COLOMBO_OFFSET_MS);
  const y = colombo.getUTCFullYear();
  const m = String(colombo.getUTCMonth() + 1).padStart(2, "0");
  const day = String(colombo.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns Monday calendar week key "YYYY-MM-DD" in Colombo timezone
 */
function getMondayWeekKey(dateVal) {
  if (!dateVal) return null;
  const raw = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(raw.getTime())) return null;
  const d = new Date(raw.getTime() + COLOMBO_OFFSET_MS);
  const day = d.getUTCDay(); // 0=Sun, 6=Sat in Colombo
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setUTCDate(diff);
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const dayStr = String(monday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dayStr}`;
}

/**
 * Calculate working days (Mon-Fri) excluding weekends and public holidays
 * Exact match with analyticsCalculations.js & AdminInternDetails.jsx
 */
function calcWorkingDays(startDate, endDate = new Date(), holidaySet = null) {
  if (!startDate) return 1;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return 1;
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return 1;

  const startColombo = new Date(start.getTime() + COLOMBO_OFFSET_MS);
  const endColombo = new Date(end.getTime() + COLOMBO_OFFSET_MS);

  startColombo.setUTCHours(0, 0, 0, 0);
  endColombo.setUTCHours(23, 59, 59, 999);

  if (endColombo <= startColombo) return 1;

  let count = 0;
  const cursor = new Date(startColombo);

  while (cursor <= endColombo) {
    const dow = cursor.getUTCDay();
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cursor.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidaySet ? holidaySet.has(dateStr) : false;

    if (!isWeekend && !isHoliday) {
      count++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return Math.max(1, count);
}

/**
 * Calculate elapsed calendar weeks (expected meetings) from start date to end date
 * Exact match with analyticsCalculations.js & AdminInternDetails.jsx
 */
function calcElapsedWeeks(startDate, endDate = new Date()) {
  if (!startDate) return 0;
  const startMondayKey = getMondayWeekKey(startDate);
  const endMondayKey = getMondayWeekKey(endDate);
  if (!startMondayKey || !endMondayKey) return 0;

  const startMon = new Date(startMondayKey + "T12:00:00Z");
  const endMon = new Date(endMondayKey + "T12:00:00Z");
  if (endMon < startMon) return 0;

  const diffWeeks = Math.round((endMon.getTime() - startMon.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, diffWeeks);
}

/**
 * Specialization classifier for non-coding roles (QA, BA, PM, DevOps, AI)
 */
function isNoCommitSpecialization(specName) {
  if (!specName) return false;
  const s = String(specName).trim().toLowerCase();

  if (/\b(qa|sqa|ba|pm|apm|devops|ai|ml|genai|sre|nlp)\b/i.test(s)) {
    return true;
  }

  return (
    s === "qa" ||
    s.includes("quality assurance") ||
    s.includes("software quality") ||
    s.includes("qa engineer") ||
    s === "ba" ||
    s.includes("business analyst") ||
    s.includes("business analysis") ||
    s.includes("business analytics") ||
    s === "pm" ||
    s.includes("project manager") ||
    s.includes("project management") ||
    s.includes("product manager") ||
    s.includes("product management") ||
    s === "devops" ||
    s.includes("devops") ||
    s.includes("dev ops") ||
    s === "ai" ||
    s.includes("artificial intelligence") ||
    s.includes("machine learning") ||
    s.includes("data science") ||
    s.includes("data scientist") ||
    s.includes("deep learning") ||
    s.includes("computer vision") ||
    s.includes("generative ai") ||
    s.startsWith("ai ") ||
    s.endsWith(" ai") ||
    s.includes(" ai ") ||
    s.includes("ai/") ||
    s.includes("/ai")
  );
}

/**
 * Specialization-aware performance rate calculation
 * Exact match with analyticsCalculations.js & AdminInternDetails.jsx
 */
function calcPerformanceRate({
  logbookRate = 0,
  meetingAttendanceRate = 0,
  commitsCount = 0,
  workingDays = 0,
  specialization = "",
}) {
  const baseAvg = (Number(logbookRate) + Number(meetingAttendanceRate)) / 2;
  if (isNoCommitSpecialization(specialization)) {
    return Math.max(0, Math.min(100, Math.round(baseAvg))) || 0;
  }

  const commits = Number(commitsCount) || 0;
  const wDays = Number(workingDays) || 0;
  const commitBonus = Math.max(0, commits - wDays);

  return Math.max(0, Math.min(100, Math.round(baseAvg + commitBonus))) || 0;
}

/**
 * Helper: Format project status
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
 * Helper: Extract commits count
 */
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

const DAILY_ATTENDANCE_TYPES = new Set(["daily", "daily_qr", "face", "manual_daily", "manual", "qr"]);
const MEETING_ATTENDANCE_TYPES = new Set(["qr", "face_meeting", "meeting", "manual_meeting", "manual"]);

// ── In-Memory Analytics Cache (TTL = 5 minutes for instant search/load) ──────
const analyticsCache = new Map();
const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;

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

// ── Helper to calculate all analytics data for a given date window ───────────
async function computeAllAnalytics({ filterStartDateStr, filterEndDateStr, useInternStartDate }) {
  const activeQuery = getActiveInternsQuery();

  // 1. Fetch active interns
  const interns = await Intern.find(activeQuery)
    .select("Trainee_ID Trainee_Name Trainee_Email Institute university field_of_spec_name fieldOfSpecialization specialization team Training_StartDate Training_EndDate startDate endDate gitCommits commitsCount attendance")
    .lean();

  if (!interns || interns.length === 0) {
    return [];
  }

  const internObjectIds = interns.map((i) => i._id).filter((id) => mongoose.Types.ObjectId.isValid(id));
  const internIdStrings = interns.map((i) => i._id.toString());
  const internTraineeStrings = interns.map((i) => (i.Trainee_ID ? String(i.Trainee_ID).trim() : null)).filter(Boolean);
  const internTraineeNumbers = internTraineeStrings.map((t) => parseInt(t, 10)).filter((n) => !isNaN(n));
  const internEmails = interns.map((i) => (i.Trainee_Email ? String(i.Trainee_Email).trim().toLowerCase() : null)).filter(Boolean);

  // Build comprehensive $or query covering ObjectIds, String IDs, numeric/string trainee IDs, and emails
  const internIdOrQuery = [
    { internId: { $in: [...internObjectIds, ...internIdStrings] } },
    ...(internTraineeStrings.length > 0 ? [{ traineeId: { $in: [...internTraineeStrings, ...internTraineeNumbers] } }] : []),
    ...(internEmails.length > 0 ? [{ traineeEmail: { $in: internEmails } }, { email: { $in: internEmails } }] : []),
  ];

  // 2. High-performance queries in parallel across all relevant collections
  const [
    dailyRecords,
    faceLogs,
    standaloneDailyLogs,
    standaloneMeetingLogs,
    talentTrailSyncRecords,
    projectRecords,
  ] = await Promise.all([
    // (A) DailyRecords (Logbook submissions - minimal payload)
    DailyRecord.find({})
      .select("internId traineeId date status meetingAttendance.projectName meetingAttendance.attendanceTime")
      .lean(),

    // (B) FaceAttendanceLog (Authoritative audit for face scans)
    FaceAttendanceLog.find({
      status: "present",
      method: "face",
      qrBackupUsed: { $ne: true },
    })
      .select("internId traineeId attendanceDate attendanceTime")
      .lean(),

    // (C) DailyAttendanceLog (Standalone QR/Manual daily scans)
    DailyAttendanceLog.find({})
      .select("internId traineeId date status")
      .lean()
      .catch(() => []),

    // (D) MeetingAttendance (Standalone QR/Manual meeting scans)
    MeetingAttendance.find({})
      .select("internId traineeId date status markType projectName")
      .lean()
      .catch(() => []),

    // (E) TalentTrail sync projects
    InternTalentTrailSync.find({})
      .select("internRef email internCode name talentTrailInternId projects")
      .lean(),

    // (F) System projects
    Project.find({})
      .select("projectName status description team tasks.assignedTo feedback.internId")
      .lean(),
  ]);

  // 3. Fast indexing by intern ObjectId, Trainee_ID, and email
  const addToMultiMap = (map, internId, traineeId, item, email) => {
    if (internId) {
      const k = internId.toString();
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    }
    if (traineeId) {
      const k = `tid:${String(traineeId).trim().toLowerCase()}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    }
    if (email) {
      const k = `em:${String(email).trim().toLowerCase()}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    }
  };

  const drMap = new Map();
  for (const dr of dailyRecords) {
    addToMultiMap(drMap, dr.internId, dr.traineeId, dr, dr.traineeEmail || dr.email);
  }

  const faceMap = new Map();
  for (const fl of faceLogs) {
    const rawDate = fl.attendanceDate || fl.attendanceTime;
    if (rawDate) {
      addToMultiMap(faceMap, fl.internId, fl.traineeId, rawDate, fl.traineeEmail || fl.email);
    }
  }

  const dalMap = new Map();
  for (const dal of standaloneDailyLogs) {
    addToMultiMap(dalMap, dal.internId, dal.traineeId, dal, dal.traineeEmail || dal.email);
  }

  const maMap = new Map();
  for (const ma of standaloneMeetingLogs) {
    addToMultiMap(maMap, ma.internId, ma.traineeId, ma, ma.traineeEmail || ma.email);
  }

  // Build TalentTrail lookup maps
  const ttByInternRef = new Map();
  const ttByEmail = new Map();
  const ttByInternCode = new Map();
  const ttByNumericId = new Map();
  const ttByName = new Map();

  const appendToMap = (map, key, items) => {
    if (!key || !Array.isArray(items) || items.length === 0) return;
    const k = String(key).trim().toLowerCase();
    if (!k) return;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(...items);
  };

  for (const sync of talentTrailSyncRecords) {
    const syncProjects = Array.isArray(sync.projects) ? sync.projects : [];
    if (syncProjects.length === 0) continue;

    if (sync.internRef) appendToMap(ttByInternRef, String(sync.internRef), syncProjects);
    if (sync.email) appendToMap(ttByEmail, sync.email, syncProjects);
    if (sync.internCode) appendToMap(ttByInternCode, sync.internCode, syncProjects);
    if (sync.talentTrailInternId !== undefined && sync.talentTrailInternId !== null) {
      appendToMap(ttByNumericId, String(sync.talentTrailInternId), syncProjects);
    }
    if (sync.name) appendToMap(ttByName, sync.name, syncProjects);
  }

  // Map projects by intern ID and feedback intern ID
  const projectsByInternId = new Map();
  const projectsByFeedbackInternId = new Map();

  const addProjectForIntern = (map, internId, projObj) => {
    const id = String(internId);
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(projObj);
  };

  for (const proj of projectRecords) {
    const formattedStatus = formatProjectStatus(proj.status);
    const projObj = {
      name: proj.projectName,
      status: formattedStatus,
      description: proj.description || "",
    };

    if (Array.isArray(proj.tasks)) {
      for (const task of proj.tasks) {
        if (Array.isArray(task.assignedTo)) {
          for (const assignedId of task.assignedTo) {
            if (assignedId) addProjectForIntern(projectsByInternId, assignedId, projObj);
          }
        }
      }
    }

    if (Array.isArray(proj.feedback)) {
      for (const fb of proj.feedback) {
        if (fb && fb.internId) {
          addProjectForIntern(projectsByFeedbackInternId, fb.internId, projObj);
        }
      }
    }
  }

  // 4. Construct final analytics records
  const now = new Date();
  const todayStr = toDateStr(now);

  const Holiday = require("../models/Holiday");
  const dbHolidays = await Holiday.find({}, { _id: 0, date: 1 }).lean().catch(() => []);
  const holidays = new Set(dbHolidays.map((h) => h.date));
  const currentYear = now.getFullYear();
  const fallbackHolidays = getSriLankanHolidays([currentYear - 2, currentYear - 1, currentYear, currentYear + 1]) || new Set();
  fallbackHolidays.forEach((h) => holidays.add(h));

  const rawAnalyticsData = interns.map((intern) => {
    const idStr = intern._id.toString();
    const tidStr = intern.Trainee_ID ? String(intern.Trainee_ID).trim().toLowerCase() : null;
    const tidKey = tidStr ? `tid:${tidStr}` : null;
    const emailStr = intern.Trainee_Email ? String(intern.Trainee_Email).trim().toLowerCase() : null;
    const emailKey = emailStr ? `em:${emailStr}` : null;

    // Helper to merge and deduplicate records by _id
    const getMergedList = (map) => {
      const listById = map.get(idStr) || [];
      const listByTid = tidKey ? (map.get(tidKey) || []) : [];
      const listByEmail = emailKey ? (map.get(emailKey) || []) : [];
      if (listByTid.length === 0 && listByEmail.length === 0) return listById;
      const seen = new Set();
      const merged = [];
      for (const item of [...listById, ...listByTid, ...listByEmail]) {
        const k = item._id ? item._id.toString() : (item.date ? `${item.date}_${item.status || item.rawType || ""}` : JSON.stringify(item));
        if (!seen.has(k)) {
          seen.add(k);
          merged.push(item);
        }
      }
      return merged;
    };

    const internDrs = getMergedList(drMap);
    const internDals = getMergedList(dalMap);
    const internMas = getMergedList(maMap);
    const internFaceDates = getMergedList(faceMap);

    const internStartDate = intern.Training_StartDate || intern.startDate;
    const internEndDate = intern.Training_EndDate || intern.endDate;
    const internSpec = intern.field_of_spec_name || intern.fieldOfSpecialization || intern.specialization || "Software Engineering";

    const internStartStr = toDateStr(internStartDate) || "1970-01-01";
    const internEndStr = toDateStr(internEndDate) || "2099-12-31";

    // If date range filter is specified, check active window
    if (filterStartDateStr && internEndStr < filterStartDateStr) return null;
    if (filterEndDateStr && internStartStr > filterEndDateStr) return null;

    // Calculation bounds — identical to AdminInternDetails.jsx (from intern start date to current date)
    let effectiveStart = internStartDate;
    let effectiveEnd = now;
    let effectiveStartStr = internStartStr;
    let effectiveEndStr = todayStr;

    if (filterStartDateStr || filterEndDateStr) {
      if (useInternStartDate) {
        effectiveStart = internStartDate;
        effectiveStartStr = internStartStr;
      } else if (filterStartDateStr) {
        effectiveStart = internStartStr > filterStartDateStr ? internStartDate : filterStartDateStr;
        effectiveStartStr = internStartStr > filterStartDateStr ? internStartStr : filterStartDateStr;
      }
      if (filterEndDateStr) {
        effectiveEnd = filterEndDateStr < todayStr ? filterEndDateStr : now;
        effectiveEndStr = filterEndDateStr < todayStr ? filterEndDateStr : todayStr;
      }
    }

    if (effectiveStartStr > effectiveEndStr) return null;

    const workingDays = calcWorkingDays(effectiveStart, effectiveEnd, holidays);
    const expectedMeetings = calcElapsedWeeks(effectiveStart, effectiveEnd);

    const startMondayKey = getMondayWeekKey(effectiveStart);
    const endMondayKey = getMondayWeekKey(effectiveEnd);

    // ── Attended counts matching AdminInternDetails.jsx exactly ──
    // KEY PRINCIPLE (from adminInternDetailsController.js):
    //   - dailyAttendance = merged list of: DailyRecord-derived entries + intern.attendance[] daily types
    //                       + FaceAttendanceLog + standalone DailyAttendanceLog
    //     Then the FRONTEND counts unique working-day dates where status is "present"/"late"
    //   - meetingAttendance = DailyRecord.meetingAttendance + intern.attendance[] meeting types
    //                       + standalone MeetingAttendance collection
    //     Then the FRONTEND counts unique Monday-week-keys where status is "present"/"late"
    //   - logbookCount = DailyRecord entries on working days excluding leave/study_leave

    const dailyAttendanceDates = new Set();
    const meetingWeeksSet = new Set();
    let logbookCount = 0;

    // Helper to check if a Colombo date string is a valid working day
    const isWorkingDay = (dStr) => {
      if (!dStr) return false;
      if (dStr < effectiveStartStr || dStr > effectiveEndStr) return false;
      const dow = new Date(dStr + "T12:00:00Z").getUTCDay();
      return dow !== 0 && dow !== 6 && !holidays.has(dStr);
    };

    // Track which dates are covered by DailyRecord (to avoid double-counting in fallback)
    const drCoveredDates = new Set();

    // 1. Process DailyRecords — logbook count + derived daily attendance + meeting attendance
    //    (Matches adminInternDetailsController.js Step 4)
    for (const record of internDrs) {
      if (!record.date) continue;
      const dStr = toDateStr(record.date);
      if (!dStr) continue;

      drCoveredDates.add(dStr);

      if (isWorkingDay(dStr)) {
        const recordStatus = (record.status || "working").toLowerCase();
        const isLeave = recordStatus === "leave" || recordStatus === "study_leave";

        // Logbook count: non-leave DailyRecord on working days
        if (!isLeave) {
          logbookCount++;
        }

        // Daily attendance: DailyRecord-derived status (working/wfh → Present, leave → Absent)
        // Matches adminInternDetailsController.js line 272-275: derivedAttendanceStatus
        const derivedStatus = isLeave ? "absent" : "present";
        if (derivedStatus === "present") {
          dailyAttendanceDates.add(dStr);
        }
      }

      // Meeting attendance inside DailyRecord
      // Matches adminInternDetailsController.js Step 4 lines 306-325
      if (Array.isArray(record.meetingAttendance) && record.meetingAttendance.length > 0) {
        const wKey = getMondayWeekKey(record.date);
        if (wKey && (!startMondayKey || wKey >= startMondayKey) && (!endMondayKey || wKey < endMondayKey)) {
          meetingWeeksSet.add(wKey);
        }
      }
    }

    // 2. Process intern.attendance[] — legacy attendance entries
    //    Meeting entries: matches adminInternDetailsController.js Step 3
    //    Daily entries (fallback for dates not in DailyRecord): matches Step 6
    const attList = Array.isArray(intern.attendance) ? intern.attendance : [];
    for (const entry of attList) {
      if (!entry.date) continue;
      const dStr = toDateStr(entry.date);
      if (!dStr) continue;

      const type = (entry.type || "").toLowerCase();
      const status = (entry.status || "").toLowerCase();
      const isPresent = status === "present" || status === "late" || !entry.status;

      if (isPresent) {
        // Daily attendance from intern.attendance[] — only for dates NOT already covered by DailyRecord
        // Matches adminInternDetailsController.js Step 6 (fallback)
        if (DAILY_ATTENDANCE_TYPES.has(type) && isWorkingDay(dStr) && !drCoveredDates.has(dStr)) {
          dailyAttendanceDates.add(dStr);
        }
        // Meeting attendance from intern.attendance[]
        // Matches adminInternDetailsController.js Step 3
        if (MEETING_ATTENDANCE_TYPES.has(type)) {
          const wKey = getMondayWeekKey(entry.date);
          if (wKey && (!startMondayKey || wKey >= startMondayKey) && (!endMondayKey || wKey < endMondayKey)) {
            meetingWeeksSet.add(wKey);
          }
        }
      }
    }

    // 3. Process FaceAttendanceLog dates — for dates not already covered
    //    Matches adminInternDetailsController.js Step 6 face fallback (lines 429-453)
    for (const rawDate of internFaceDates) {
      const dStr = toDateStr(rawDate);
      if (isWorkingDay(dStr) && !dailyAttendanceDates.has(dStr)) {
        dailyAttendanceDates.add(dStr);
      }
    }

    // 4. Process standalone DailyAttendanceLog entries — for dates not already covered
    //    Matches adminInternDetailsController.js Step 6 (lines 456-475)
    for (const dal of internDals) {
      if (!dal.date) continue;
      const s = (dal.status || "present").toLowerCase();
      if (s === "absent") continue;
      const dStr = toDateStr(dal.date);
      if (isWorkingDay(dStr) && !dailyAttendanceDates.has(dStr)) {
        dailyAttendanceDates.add(dStr);
      }
    }

    // 5. Process standalone MeetingAttendance entries
    //    Matches adminInternDetailsController.js Step 6 (lines 407-426)
    for (const ma of internMas) {
      if (!ma.date) continue;
      const s = (ma.status || "present").toLowerCase();
      if (s === "absent") continue;
      const wKey = getMondayWeekKey(ma.date);
      if (wKey && (!startMondayKey || wKey >= startMondayKey) && (!endMondayKey || wKey < endMondayKey)) {
        meetingWeeksSet.add(wKey);
      }
    }

    const dailyAttendanceCount = dailyAttendanceDates.size;
    const meetingAttendanceCount = meetingWeeksSet.size;
    const commitCount = getInternCommitsCount(intern);

    // ── Rates ──
    const dailyAttendanceRate = Math.min(100, Math.round((dailyAttendanceCount / workingDays) * 100)) || 0;
    const meetingAttendanceRate = expectedMeetings <= 0 ? 100 : Math.min(100, Math.round((meetingAttendanceCount / expectedMeetings) * 100)) || 0;
    const logbookRecordRate = Math.min(100, Math.round((logbookCount / workingDays) * 100)) || 0;

    // Specialization-based performance rate
    const performanceRate = calcPerformanceRate({
      logbookRate: logbookRecordRate,
      meetingAttendanceRate,
      commitsCount: commitCount,
      workingDays,
      specialization: internSpec,
    });

    let internStatus = "Good";
    if (performanceRate < 60) internStatus = "Poor";
    else if (performanceRate < 80) internStatus = "At Risk";

    // ── Assigned Projects ──
    const projectsList = [];
    const seenProjectNames = new Set();

    const addProject = (pName, pStatus) => {
      if (!pName) return;
      const trimmedName = String(pName).trim();
      if (!trimmedName) return;
      const normalizedKey = trimmedName.toLowerCase();
      if (seenProjectNames.has(normalizedKey)) return;
      seenProjectNames.add(normalizedKey);
      projectsList.push({
        name: trimmedName,
        status: formatProjectStatus(pStatus),
      });
    };

    const internEmailNorm = (intern.Trainee_Email || "").trim().toLowerCase();
    const internIdNorm = String(intern.Trainee_ID || "").trim().toLowerCase();
    const internDigits = String(intern.Trainee_ID || "").replace(/\D/g, "");
    const internNameNorm = (intern.Trainee_Name || "").trim().toLowerCase();
    const internTeamNorm = (intern.team || "").trim().toLowerCase();

    const allMatchedTTProjects = [
      ...(ttByInternRef.get(idStr.toLowerCase()) || []),
      ...(internEmailNorm ? (ttByEmail.get(internEmailNorm) || []) : []),
      ...(internIdNorm ? (ttByInternCode.get(internIdNorm) || []) : []),
      ...(internDigits ? (ttByNumericId.get(internDigits) || []) : []),
      ...(internNameNorm ? (ttByName.get(internNameNorm) || []) : []),
    ];

    for (const p of allMatchedTTProjects) {
      if (p && p.projectName) addProject(p.projectName, p.status);
    }

    const assignedTaskProjects = projectsByInternId.get(idStr) || [];
    for (const p of assignedTaskProjects) addProject(p.name, p.status);

    const assignedFeedbackProjects = projectsByFeedbackInternId.get(idStr) || [];
    for (const p of assignedFeedbackProjects) addProject(p.name, p.status);

    if (internTeamNorm || internIdNorm || internNameNorm) {
      for (const proj of projectRecords) {
        if (!proj.team) continue;
        const projTeamRaw = String(proj.team).trim().toLowerCase();
        const teamTokens = projTeamRaw.split(/[,;\/|]+/).map((t) => t.trim()).filter(Boolean);

        const isTeamMatch =
          (internTeamNorm && (teamTokens.includes(internTeamNorm) || projTeamRaw === internTeamNorm || internTeamNorm.includes(projTeamRaw))) ||
          (internIdNorm && (teamTokens.includes(internIdNorm) || projTeamRaw === internIdNorm)) ||
          (internNameNorm && (teamTokens.includes(internNameNorm) || projTeamRaw === internNameNorm));

        if (isTeamMatch && proj.projectName) {
          addProject(proj.projectName, proj.status);
        }
      }
    }

    const gitCached = gitCommitsCache ? gitCommitsCache.get(`git_commits_${intern._id}`) : null;
    if (gitCached && gitCached.data) {
      const pCommits = Array.isArray(gitCached.data)
        ? gitCached.data
        : (gitCached.data.projectCommits || []);
      for (const p of pCommits) {
        if (p && (p.projectName || p.name)) {
          addProject(p.projectName || p.name, p.status || "In Progress");
        }
      }
    }

    return {
      id: idStr,
      traineeId: String(intern.Trainee_ID || `TR-${idStr.slice(-4).toUpperCase()}`),
      name: intern.Trainee_Name || "Unnamed Intern",
      email: intern.Trainee_Email || "N/A",
      institute: intern.Institute || "Not Specified",
      university: intern.Institute || "Not Specified",
      specialization: internSpec,
      team: intern.team || "Unassigned",
      dailyAttendanceCount,
      meetingAttendanceCount,
      logbookCount,
      commitCount,
      workingDays,
      expectedMeetings,
      startDate: internStartDate || null,
      endDate: internEndDate || null,
      dailyAttendanceRate,
      meetingAttendanceRate,
      logbookRecordRate,
      performanceRate,
      internStatus,
      projects: projectsList,
    };
  });

  return rawAnalyticsData.filter(Boolean);
}

// ── Main Controller: GET /api/admin/analytics ─────────────────────────────────
const getAdminAnalytics = async (req, res) => {
  try {
    const isRefresh = req.query.refresh === "true";
    const filterStartDateStr = req.query.startDate ? String(req.query.startDate).trim() : null;
    const filterEndDateStr = req.query.endDate ? String(req.query.endDate).trim() : null;
    const useInternStartDate = req.query.useInternStartDate === "true" || req.query.useInternStartDate === true;

    const cacheKey = `${filterStartDateStr || "all"}_${filterEndDateStr || "all"}_${useInternStartDate}`;

    let allAnalyticsData = null;
    if (!isRefresh) {
      allAnalyticsData = getCachedAnalytics(cacheKey);
    }

    if (!allAnalyticsData) {
      allAnalyticsData = await computeAllAnalytics({
        filterStartDateStr,
        filterEndDateStr,
        useInternStartDate,
      });
      setCachedAnalytics(cacheKey, allAnalyticsData);
    }

    // Extract all unique specializations across the entire dataset
    const specSet = new Set();
    allAnalyticsData.forEach((item) => {
      if (item.specialization) specSet.add(item.specialization);
    });
    const specializations = Array.from(specSet).sort();

    // Global summary across all computed interns
    const globalSummary = {
      total: allAnalyticsData.length,
      good: allAnalyticsData.filter((i) => i.performanceRate >= 80).length,
      atRisk: allAnalyticsData.filter((i) => i.performanceRate >= 60 && i.performanceRate < 80).length,
      poor: allAnalyticsData.filter((i) => i.performanceRate < 60).length,
    };

    // ── Apply Server-Side Search and Filtering ──
    const searchTerm = req.query.search ? String(req.query.search).trim().toLowerCase() : "";
    const statusFilter = req.query.status ? String(req.query.status).trim() : "all";
    const specFilter = req.query.specialization ? String(req.query.specialization).trim() : "all";

    let filtered = allAnalyticsData;

    if (searchTerm) {
      filtered = filtered.filter((item) => {
        const name = (item.name || "").toLowerCase();
        const email = (item.email || "").toLowerCase();
        const traineeId = String(item.traineeId || "").toLowerCase();
        const spec = (item.specialization || "").toLowerCase();
        const institute = (item.institute || item.university || "").toLowerCase();
        const projectMatches = (item.projects || []).some(
          (p) =>
            (p?.name || p?.projectName || "").toLowerCase().includes(searchTerm) ||
            (p?.status || "").toLowerCase().includes(searchTerm)
        );

        return (
          name.includes(searchTerm) ||
          email.includes(searchTerm) ||
          traineeId.includes(searchTerm) ||
          spec.includes(searchTerm) ||
          institute.includes(searchTerm) ||
          projectMatches
        );
      });
    }

    if (statusFilter && statusFilter !== "all") {
      filtered = filtered.filter((item) => {
        const perf = Number(item.performanceRate) || 0;
        if (statusFilter === "Good") return perf >= 80;
        if (statusFilter === "At Risk") return perf >= 60 && perf < 80;
        if (statusFilter === "Poor") return perf < 60;
        return true;
      });
    }

    if (specFilter && specFilter !== "all") {
      filtered = filtered.filter(
        (item) => (item.specialization || "").toLowerCase() === specFilter.toLowerCase()
      );
    }

    // ── Filtered Summary for Matching Users (Strictly reflects active search/filters) ──
    const filteredSummary = {
      total: filtered.length,
      good: filtered.filter((i) => i.performanceRate >= 80).length,
      atRisk: filtered.filter((i) => i.performanceRate >= 60 && i.performanceRate < 80).length,
      poor: filtered.filter((i) => i.performanceRate < 60).length,
    };

    // ── Apply Sorting ──
    const sortBy = req.query.sortBy || "traineeId";
    const sortOrder = req.query.sortOrder === "desc" ? "desc" : "asc";

    if (sortBy) {
      filtered.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];

        if (sortBy === "traineeId") {
          const aNum = parseInt(aValue, 10);
          const bNum = parseInt(bValue, 10);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
          }
        }

        if (typeof aValue === "string" || typeof bValue === "string") {
          aValue = String(aValue || "").toLowerCase();
          bValue = String(bValue || "").toLowerCase();
          return sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }

        const aNum = Number(aValue) || 0;
        const bNum = Number(bValue) || 0;
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      });
    }

    // ── Full Export Handler (PDF / CSV) ──
    const exportAll = req.query.exportAll === "true" || req.query.limit === "all";
    if (exportAll) {
      return res.status(200).json({
        interns: filtered,
        total: filtered.length,
        summary: filteredSummary,
        globalSummary,
        specializations,
      });
    }

    // ── Server-Side Pagination (default 25 items) ──
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const paginatedInterns = filtered.slice(start, start + limit);

    return res.status(200).json({
      interns: paginatedInterns,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      },
      summary: filteredSummary,
      globalSummary,
      specializations,
    });
  } catch (error) {
    console.error("[getAdminAnalytics] Error:", error);
    return res.status(500).json({ message: "Failed to fetch analytics data", error: error.message });
  }
};

module.exports = {
  getAdminAnalytics,
  computeAllAnalytics,
};

