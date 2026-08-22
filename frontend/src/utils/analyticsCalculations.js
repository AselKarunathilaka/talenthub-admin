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
 * Calculate elapsed calendar weeks (expected meetings)
 */
export function calcElapsedWeeks(startDate, endDate = new Date()) {
  if (!startDate) return 1;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return 1;
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return 1;
  const msElapsed = end - start;
  if (msElapsed <= 0) return 1;
  return Math.max(1, Math.ceil(msElapsed / (1000 * 60 * 60 * 24 * 7)));
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
  const expMeets = Math.max(1, Number(expectedMeetings) || 1);
  const count = Number(attendedMeetingWeeksCount) || 0;
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

/**
 * Performance Rate percentage (0-100)
 * baseAvg = (logbookRate + meetingAttendanceRate) / 2
 * - For non-coding roles (QA, BA, PM, DevOps, AI, UI/UX, etc.): Math.min(100, Math.round(baseAvg))
 * - For coding roles (FullStack, Java, Mobile, etc.): Math.min(100, Math.round(baseAvg + commitsCount))
 */
export function calcPerformanceRate({
  logbookRate = 0,
  meetingAttendanceRate = 0,
  commitsCount = 0,
  specialization = "",
}) {
  const baseAvg = (Number(logbookRate) + Number(meetingAttendanceRate)) / 2;
  if (isNoCommitSpecialization(specialization)) {
    return Math.min(100, Math.round(baseAvg)) || 0;
  }
  const commits = Number(commitsCount) || 0;
  return Math.min(100, Math.round(baseAvg + commits)) || 0;
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
