const Intern = require("../models/Intern");
const DailyRecord = require("../models/DailyRecord");
const { getActiveInternsQuery } = require("../utils/workingDays");
const { gitCommitsCache } = require("./adminController");

const TZ = "Asia/Colombo";

const MEETING_TYPES = ["qr", "face_meeting", "meeting", "manual_meeting", "manual"];
const DAILY_TYPES   = ["daily", "daily_qr", "face", "manual_daily"];
const ALL_ATT_TYPES = [...MEETING_TYPES, ...DAILY_TYPES];

// ── Exact working days loop matching Dashboard.jsx ────────────────────────────
const calcWorkingDays = (startDate, endDate = new Date()) => {
  if (!startDate) return 1;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return 1;
  const now = new Date(endDate);
  if (now <= start) return 1;
  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endCap = new Date(now);
  endCap.setHours(23, 59, 59, 999);
  while (cursor <= endCap) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.max(1, count);
};

// ── Exact elapsed weeks matching Dashboard.jsx ──────────────────────────────
const calcElapsedWeeks = (startDate, endDate = new Date()) => {
  if (!startDate) return 0;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return 0;
  const msElapsed = new Date(endDate) - start;
  if (msElapsed <= 0) return 0;
  return Math.max(0, Math.floor(msElapsed / (1000 * 60 * 60 * 24 * 7)));
};

// ── Week key (Monday of the week) ────────────────────────────────────────────
function weekKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const day  = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon  = new Date(d);
  mon.setDate(diff);
  return `${mon.getFullYear()}-${mon.getMonth()}-${mon.getDate()}`;
}

// ── Shared aggregation runner ─────────────────────────────────────────────────
// Runs the two DB aggregations in parallel for a given set of intern IDs.
async function runAggregations(internIds) {
  return Promise.all([
    // (A) DailyRecord — logbook count, daily present days, meeting dates from DR
    DailyRecord.aggregate([
      { $match: { internId: { $in: internIds } } },
      {
        $group: {
          _id: "$internId",
          logbookCount: { $sum: 1 },
          dailyDates: {
            $addToSet: {
              $cond: [
                {
                  $not: {
                    $in: [
                      { $toLower: { $ifNull: ["$status", "working"] } },
                      ["leave", "study_leave"]
                    ]
                  }
                },
                "$date",
                null,
              ],
            },
          },
          drMeetingDates: {
            $addToSet: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ["$meetingAttendance", []] } }, 0] },
                "$date",
                null,
              ],
            },
          },
        },
      },
    ]),

    // (B) intern.attendance[] — meeting + daily supplement via $filter+$unwind in MongoDB
    Intern.aggregate([
      { $match: { _id: { $in: internIds } } },
      {
        $project: {
          attendance: {
            $filter: {
              input: { $ifNull: ["$attendance", []] },
              as:    "a",
              cond: {
                $and: [
                  {
                    $in: [
                      { $toLower: { $ifNull: ["$$a.status", ""] } },
                      ["present", "late"]
                    ]
                  },
                  { $in: ["$$a.type", ALL_ATT_TYPES] },
                  { $ne: ["$$a.date", null] },
                ],
              },
            },
          },
        },
      },
      { $unwind: { path: "$attendance", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$_id",
          meetingDates: {
            $addToSet: {
              $cond: [
                { $in: ["$attendance.type", MEETING_TYPES] },
                { $dateToString: { format: "%Y-%m-%d", date: "$attendance.date", timezone: TZ } },
                null,
              ],
            },
          },
          dailyDates: {
            $addToSet: {
              $cond: [
                { $in: ["$attendance.type", DAILY_TYPES] },
                { $dateToString: { format: "%Y-%m-%d", date: "$attendance.date", timezone: TZ } },
                null,
              ],
            },
          },
        },
      },
    ]),
  ]);
}

// ── Build lookup maps from aggregation results ────────────────────────────────
function buildMaps(drAgg, attAgg) {
  const drMap = new Map();
  for (const row of drAgg) {
    if (!row._id) continue;
    drMap.set(row._id.toString(), {
      logbookCount:   row.logbookCount || 0,
      dailyDates:     new Set((row.dailyDates     || []).filter(Boolean)),
      drMeetingDates: new Set((row.drMeetingDates || []).filter(Boolean)),
    });
  }
  const attMap = new Map();
  for (const row of attAgg) {
    if (!row._id) continue;
    attMap.set(row._id.toString(), {
      meetingDates: new Set((row.meetingDates || []).filter(Boolean)),
      dailyDates:   new Set((row.dailyDates   || []).filter(Boolean)),
    });
  }
  return { drMap, attMap };
}

// ── Helper: Extract commits count for an intern ──────────────────────────────
function getInternCommitsCount(intern) {
  let count = 0;
  const cached = gitCommitsCache ? gitCommitsCache.get(`git_commits_${intern._id}`) : null;
  if (cached && cached.data) {
    if (cached.data.totalCommits !== undefined) {
      count = Number(cached.data.totalCommits) || 0;
    } else {
      let all = [];
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
  } else if (Array.isArray(intern.gitCommits)) {
    count = intern.gitCommits.length;
  } else if (typeof intern.commitsCount === "number") {
    count = intern.commitsCount;
  }
  return count;
}

// ── Compute metrics for one intern (both data maps already built) ─────────────
function buildMetrics(intern, drMap, attMap) {
  const key = intern._id.toString();
  const dr  = drMap.get(key)  || { logbookCount: 0, dailyDates: new Set(), drMeetingDates: new Set() };
  const att = attMap.get(key) || { meetingDates: new Set(), dailyDates: new Set() };

  const endDate = intern.Training_EndDate ? Math.min(new Date(), new Date(intern.Training_EndDate)) : new Date();
  const weekdays = calcWorkingDays(intern.Training_StartDate, endDate);
  const weeks    = calcElapsedWeeks(intern.Training_StartDate, endDate);

  // Union daily dates (DailyRecord primary + intern.attendance supplement)
  const dailyDateSet = new Set(dr.dailyDates);
  for (const d of att.dailyDates) dailyDateSet.add(d);

  // Union meeting dates (DailyRecord.meetingAttendance + intern.attendance MEETING types)
  const meetingDateSet = new Set(dr.drMeetingDates);
  for (const d of att.meetingDates) meetingDateSet.add(d);

  // ── Rates (mirrors AdminInternDetails.jsx exactly) ──────────────────────
  // Daily rate: unique present days / weekdays
  const dailyAttendanceRate = Math.min(100, Math.round((dailyDateSet.size / weekdays) * 100)) || 0;

  // Meeting rate: unique weeks with ≥1 meeting / elapsed weeks
  const currentWk = weekKey(endDate);
  const meetingWeeks = new Set();
  for (const d of meetingDateSet) {
    const wk = weekKey(d);
    if (wk && (!currentWk || wk < currentWk)) meetingWeeks.add(wk);
  }
  const meetingAttendanceRate = weeks <= 0 ? 100 : Math.min(100, Math.round((meetingWeeks.size / weeks) * 100)) || 0;

  // Work quality rate: Average of daily, meeting, logbook, and commits rates (matches UniversityDashboard EXACTLY)
  const logbookRate = Math.min(100, Math.round((dr.logbookCount / weekdays) * 100)) || 0;
  
  const expectedCommits = Math.max(1, Math.ceil(weekdays / 5) * 2);
  const commitsCount = getInternCommitsCount(intern);
  const commitRate = commitsCount > 0 ? Math.min(100, Math.round((commitsCount / expectedCommits) * 100)) : 0;
  
  const performanceQuality = Math.round((dailyAttendanceRate + meetingAttendanceRate + logbookRate + commitRate) / 4);

  return {
    _id:                  intern._id,
    traineeId:            intern.Trainee_ID,
    traineeName:          intern.Trainee_Name,
    email:                intern.Trainee_Email,
    institute:            intern.Institute || "",
    fieldOfSpecialization: intern.field_of_spec_name || "",
    team:                 intern.team || "",
    trainingStartDate:    intern.Training_StartDate || null,
    trainingEndDate:      intern.Training_EndDate   || null,
    weekdays,
    weeks,
    dailyAttendanceRate,
    meetingAttendanceRate,
    performanceQuality,
    dailyDaysPresent:    dailyDateSet.size,
    meetingDaysPresent:  meetingDateSet.size,
    meetingWeeksPresent: meetingWeeks.size,
    logbookEntries:      dr.logbookCount,
    logbookRate,
    commitRate,
    commitsCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/intern-performance/summary
//
// Returns summary counts for ALL active interns in a SINGLE fast response.
// Used by the 4 stat cards so they show correct totals immediately.
// ─────────────────────────────────────────────────────────────────────────────
const getInternPerformanceSummary = async (req, res) => {
  try {
    const activeQuery = getActiveInternsQuery();

    // Fetch only the fields we need for rate computation (no attendance[])
    const allInterns = await Intern.find(activeQuery)
      .select("_id Training_StartDate Training_EndDate")
      .lean();

    const total = allInterns.length;
    if (total === 0) {
      return res.json({ total: 0, meetingAbove: 0, dailyAbove: 0, perfAbove: 0 });
    }

    const allIds = allInterns.map((i) => i._id);

    // Run both aggregations in parallel for ALL active interns
    const [drAgg, attAgg] = await runAggregations(allIds);
    const { drMap, attMap } = buildMaps(drAgg, attAgg);

    // Count how many interns are ≥80% for each metric
    let meetingAbove = 0, dailyAbove = 0, perfAbove = 0;

    for (const intern of allInterns) {
      const m = buildMetrics(intern, drMap, attMap);
      if (m.meetingAttendanceRate >= 80) meetingAbove++;
      if (m.dailyAttendanceRate   >= 80) dailyAbove++;
      if (m.performanceQuality    >= 80) perfAbove++;
    }

    return res.json({ total, meetingAbove, dailyAbove, perfAbove });
  } catch (err) {
    console.error("[internPerformanceSummary] Error:", err);
    return res.status(500).json({ error: "Failed to fetch summary" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/intern-performance[?page=1&limit=30]
//
// Phase 1 (parallel): countDocuments + current-page interns (no attendance[])
// Phase 2 (parallel): DailyRecord agg + Intern.attendance agg
// ─────────────────────────────────────────────────────────────────────────────
const getInternPerformance = async (req, res) => {
  try {
    const activeQuery = getActiveInternsQuery();

    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 30));
    const skip  = (page - 1) * limit;

    // Phase 1: count + slice (no attendance[]) in parallel
    const [total, sliceInterns] = await Promise.all([
      Intern.countDocuments(activeQuery),
      Intern.find(activeQuery)
        .sort({ Trainee_ID: 1 })
        .skip(skip)
        .limit(limit)
        .select(
          "Trainee_ID Trainee_Name Trainee_Email " +
          "Institute field_of_spec_name team " +
          "Training_StartDate Training_EndDate"
        )
        .lean(),
    ]);

    const pages   = Math.ceil(total / limit) || 1;
    const hasMore = page < pages;

    if (sliceInterns.length === 0) {
      return res.json({ interns: [], total, page, pages, hasMore: false });
    }

    const sliceIds = sliceInterns.map((i) => i._id);

    // Phase 2: aggregations for this slice in parallel
    const [drAgg, attAgg] = await runAggregations(sliceIds);
    const { drMap, attMap } = buildMaps(drAgg, attAgg);

    const result = sliceInterns.map((intern) => buildMetrics(intern, drMap, attMap));

    return res.json({ interns: result, total, page, pages, hasMore });
  } catch (err) {
    console.error("[internPerformanceController] Error:", err);
    return res.status(500).json({ error: "Failed to fetch intern performance data" });
  }
};

module.exports = { getInternPerformance, getInternPerformanceSummary };
