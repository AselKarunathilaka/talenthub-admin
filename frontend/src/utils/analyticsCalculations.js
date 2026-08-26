/**
 * Unified Analytics & Rate Calculation Utility
 * Matches the canonical calculation engine from AdminAnalytics.jsx and adminAnalyticsController.js
 */

/**
 * Specialization classifier for non-coding roles (QA, BA, PM, DevOps, AI)
 * Exact match with AdminAnalytics.jsx and adminAnalyticsController.js
 */
export function isNoCommitSpecialization(specName) {
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
 * Returns YYYY-MM-DD string in Asia/Colombo timezone (+05:30)
 * Matches the AdminAnalytics backend toColomboYMD() logic.
 */
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30 in ms

export function toDateStr(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  // Shift to Colombo timezone (+05:30) before extracting YYYY-MM-DD
  const colombo = new Date(d.getTime() + COLOMBO_OFFSET_MS);
  const y = colombo.getUTCFullYear();
  const m = String(colombo.getUTCMonth() + 1).padStart(2, "0");
  const day = String(colombo.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns the Monday calendar week key "YYYY-MM-DD" for grouping meeting attendance.
 * Uses Colombo timezone (+05:30) to match backend weekKey() logic.
 */
export function getMondayWeekKey(dateVal) {
  if (!dateVal) return null;
  const raw = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(raw.getTime())) return null;
  // Convert to Colombo time first
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
 * Calculate working days (Mon-Fri) excluding weekends and public holidays.
 * Uses Colombo timezone (+05:30) to match backend calcWorkingDays().
 */
export function calcWorkingDays(startDate, endDate = new Date(), holidaySet = null) {
  if (!startDate) return 1;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return 1;
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return 1;

  // Work in Colombo timezone: shift both dates
  const startColombo = new Date(start.getTime() + COLOMBO_OFFSET_MS);
  const endColombo = new Date(end.getTime() + COLOMBO_OFFSET_MS);

  // Start from start-of-day in Colombo
  startColombo.setUTCHours(0, 0, 0, 0);
  endColombo.setUTCHours(23, 59, 59, 999);

  if (endColombo <= startColombo) return 1;

  let count = 0;
  const cursor = new Date(startColombo);

  while (cursor <= endColombo) {
    const dow = cursor.getUTCDay(); // day of week in Colombo
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
 * Counts completed full weeks elapsed up to the current week.
 */
export function calcElapsedWeeks(startDate, endDate = new Date()) {
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
 * Daily Attendance Rate percentage (0-100)
 */
export function calcDailyAttendanceRate(dailyCount, workingDays) {
  const wDays = Math.max(1, Number(workingDays) || 1);
  const count = Number(dailyCount) || 0;
  return Math.min(100, Math.round((count / wDays) * 100)) || 0;
}

/**
 * Meeting Attendance Rate percentage (0-100) based on calendar weeks
 */
export function calcMeetingAttendanceRate(attendedMeetingWeeksCount, expectedMeetings) {
  const expMeets = Number(expectedMeetings) || 0;
  const count = Number(attendedMeetingWeeksCount) || 0;
  if (expMeets <= 0) {
    return 100;
  }
  return Math.min(100, Math.round((count / expMeets) * 100)) || 0;
}

/**
 * Logbook Record Rate percentage (0-100)
 */
export function calcLogbookRate(logbookCount, workingDays) {
  const wDays = Math.max(1, Number(workingDays) || 1);
  const count = Number(logbookCount) || 0;
  return Math.min(100, Math.round((count / wDays) * 100)) || 0;
}

export function calcPerformanceRate({
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
 * Performance Status string: "Good" (>=80%), "At Risk" (60-79%), "Poor" (<60%)
 */
export function getPerformanceStatus(performanceRate) {
  const rate = Number(performanceRate) || 0;
  if (rate >= 80) return "Good";
  if (rate >= 60) return "At Risk";
  return "Poor";
}
