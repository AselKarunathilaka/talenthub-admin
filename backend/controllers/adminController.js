const mongoose = require("mongoose");
const DailyRecord = require("../models/DailyRecord");
const Intern = require("../models/Intern");
const User = require("../models/User");
const InternTalentTrailSync = require("../models/InternTalentTrailSync");
const emailSender = require("../utils/emailSender");
const internService = require("../services/internService");
const WeeklyScheduler = require("../services/weeklyScheduler");
const WeeklyNonSubmissionExcelService = require("../services/weeklyNonSubmissionExcelService");
const axios = require("axios");
const https = require("https");
const talentTrailSyncSvc = require("../services/talentTrailSyncService");
const {
  getPastWorkingDays,
  isWithinGracePeriod,
  getActiveInternsQuery,
} = require("../utils/workingDays");

// Minimum number of daily logs an intern must submit within a weekly review
// window to be considered compliant. Used by getNonSubmissionsWithinAWeek
// and getWeeklyNonSubmissions (kept in sync with weeklyNonSubmissionExcelService).
const MIN_WEEKLY_LOGS_REQUIRED = 3;

// In-memory cache for dashboard stats (60 seconds TTL)
let dashboardStatsCache = null;
let dashboardStatsCacheTime = 0;
const STATS_CACHE_TTL = 60 * 1000;

// Get admin dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify admin user
    const adminUser = await User.findById(userId).lean();
    if (!adminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Check cache
    const now = Date.now();
    if (
      dashboardStatsCache &&
      now - dashboardStatsCacheTime < STATS_CACHE_TTL
    ) {
      return res.status(200).json(dashboardStatsCache);
    }

    // Past 5 working days (excluding weekends + SL public holidays)
    const checkWindow = getPastWorkingDays(5);

    // Fetch active non-test, non-terminated interns
    const activeQuery = getActiveInternsQuery();

    const [interns, periodSummary, allTimeSummary] = await Promise.all([
      // 1. Active interns only
      Intern.find(activeQuery).lean(),

      // 2. Count logs submitted within past 5 working days per intern
      DailyRecord.aggregate([
        {
          $match: {
            date: { $in: checkWindow },
          },
        },
        {
          $group: {
            _id: "$internId",
            periodLogsCount: { $sum: 1 },
          },
        },
      ]),

      // 3. Aggregate all-time records for totalRecords & latest submission
      DailyRecord.aggregate([
        {
          $group: {
            _id: "$internId",
            latestSubmission: { $max: "$createdAt" },
            totalRecords: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Build O(1) lookup maps
    const periodMap = new Map();
    for (const p of periodSummary) {
      if (p._id) periodMap.set(p._id.toString(), p.periodLogsCount);
    }

    const allTimeMap = new Map();
    for (const a of allTimeSummary) {
      if (a._id) {
        allTimeMap.set(a._id.toString(), {
          latestSubmission: a.latestSubmission,
          totalRecords: a.totalRecords,
        });
      }
    }

    const nonSubmissionsList = [];
    let submittedCount = 0;
    let excusedCount = 0;
    let totalRecords = 0;

    for (const intern of interns) {
      const key = intern._id.toString();
      const summary = allTimeMap.get(key);
      const latestSubmission = summary?.latestSubmission ?? null;
      const internTotalRec = summary?.totalRecords ?? 0;
      totalRecords += internTotalRec;

      const logsSubmittedInPeriod = periodMap.get(key) || 0;
      const inGrace = isWithinGracePeriod(intern.Training_StartDate);

      if (inGrace) {
        excusedCount++;
        submittedCount++; // Excused new interns count towards compliant active interns
        continue;
      }

      if (logsSubmittedInPeriod >= MIN_WEEKLY_LOGS_REQUIRED) {
        submittedCount++;
      } else {
        const daysSince = latestSubmission
          ? Math.floor(
              (Date.now() - new Date(latestSubmission).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;

        nonSubmissionsList.push({
          _id: intern._id,
          traineeId: intern.Trainee_ID,
          traineeName: intern.Trainee_Name,
          email: intern.Trainee_Email,
          trainingStartDate: intern.Training_StartDate,
          trainingEndDate: intern.Training_EndDate,
          fieldOfSpecialization: intern.field_of_spec_name,
          institute: intern.Institute?.trim()
            ? intern.Institute
            : "Not Specified",
          totalRecords: internTotalRec,
          logsSubmitted: logsSubmittedInPeriod,
          requiredLogs: MIN_WEEKLY_LOGS_REQUIRED,
          lastSubmission: latestSubmission,
          daysSinceLastSubmission: daysSince,
        });
      }
    }

    const responseData = {
      totalInterns: interns.length,
      totalRecords,
      submittedInterns: submittedCount,
      nonSubmittingInterns: nonSubmissionsList.length,
      overdueInterns: nonSubmissionsList.length, // Backwards compatibility
      excusedInterns: excusedCount,
      nonSubmissionsList,
      overdueList: nonSubmissionsList, // Backwards compatibility
    };

    // Update cache
    dashboardStatsCache = responseData;
    dashboardStatsCacheTime = now;

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    res.status(500).json({ error: "Failed to get dashboard statistics" });
  }
};

// Get detailed intern report
const getInternReport = async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify admin user
    const adminUser = await User.findById(userId);
    if (!adminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Calculate 5 working days ago for accurate overdue status (matching getDashboardStats)
    let workingDaysCount = 0;
    let fiveWorkingDaysAgo = new Date();
    while (workingDaysCount < 5) {
      fiveWorkingDaysAgo.setDate(fiveWorkingDaysAgo.getDate() - 1);
      const dayOfWeek = fiveWorkingDaysAgo.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDaysCount++;
      }
    }
    fiveWorkingDaysAgo.setHours(0, 0, 0, 0);

    // 1. Fetch all interns
    const interns = await Intern.find({}).lean();

    // 2. Fetch record summaries using aggregation (optimized: no $push to avoid memory bloat)
    const submissionSummary = await DailyRecord.aggregate([
      {
        $group: {
          _id: "$internId",
          lastSubmission: { $max: "$createdAt" },
          totalRecords: { $sum: 1 },
        },
      },
    ]);

    // Build O(1) lookup map
    const submissionMap = new Map();
    for (const s of submissionSummary) {
      if (s._id) {
        submissionMap.set(s._id.toString(), s);
      }
    }

    // 3. Construct the report
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const report = interns.map((intern) => {
      const summary = submissionMap.get(intern._id.toString());
      const lastSubmission = summary?.lastSubmission || null;

      const daysSinceLastSubmission = lastSubmission
        ? Math.floor(
            (new Date() - new Date(lastSubmission)) / (1000 * 60 * 60 * 24),
          )
        : null;

      // New-intern grace period: interns still within their first 5
      // working days are never marked overdue.
      const internStartDate = intern.Training_StartDate
        ? new Date(intern.Training_StartDate)
        : null;
      const gracePeriodEndDate = internStartDate
        ? calculateGracePeriodEndDate(internStartDate)
        : null;
      const isWithinGracePeriod =
        gracePeriodEndDate && todayEnd <= gracePeriodEndDate;

      // Overdue = never submitted, OR latest submission older than 5 working days ago
      // (unless the intern is still within their new-intern grace period)
      const isOverdue =
        !isWithinGracePeriod &&
        (!lastSubmission || new Date(lastSubmission) < fiveWorkingDaysAgo);

      return {
        _id: intern._id,
        traineeId: intern.Trainee_ID,
        traineeName: intern.Trainee_Name,
        email: intern.Trainee_Email,
        fieldOfSpecialization: intern.field_of_spec_name,
        team: intern.team || "Unassigned",
        trainingStartDate: intern.Training_StartDate,
        trainingEndDate: intern.Training_EndDate,
        totalRecords: summary?.totalRecords || 0,
        lastSubmission: lastSubmission,
        daysSinceLastSubmission,
        isOverdue: isOverdue,
        isWithinGracePeriod: !!isWithinGracePeriod,
      };
    });

    res.status(200).json(report);
  } catch (error) {
    console.error("Error getting intern report:", error);
    res.status(500).json({ error: "Failed to generate intern report" });
  }
};

// Get individual intern details with records
const getInternDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { internId } = req.params;

    // Verify admin user
    const adminUser = await User.findById(userId);
    if (!adminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Get intern details (search by ObjectId, Trainee_ID, Trainee_Email or in InactiveIntern)
    let intern = null;
    if (mongoose.Types.ObjectId.isValid(internId)) {
      intern = await Intern.findById(internId);
      if (!intern) {
        const InactiveIntern = require("../models/InactiveIntern");
        intern = await InactiveIntern.findById(internId);
      }
    }
    if (!intern) {
      intern = await Intern.findOne({
        $or: [
          { Trainee_ID: internId },
          { Trainee_Email: { $regex: new RegExp(`^${internId}$`, "i") } },
        ],
      });
    }
    if (!intern) {
      const InactiveIntern = require("../models/InactiveIntern");
      intern = await InactiveIntern.findOne({
        $or: [
          { Trainee_ID: internId },
          { Trainee_Email: { $regex: new RegExp(`^${internId}$`, "i") } },
        ],
      });
    }

    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }

    // Get intern's records (match by ObjectId or traineeId)
    const recordQuery = {
      $or: [
        { internId: intern._id },
        ...(intern.Trainee_ID ? [{ traineeId: intern.Trainee_ID }] : []),
        ...(mongoose.Types.ObjectId.isValid(internId) ? [{ internId }] : []),
      ],
    };
    const recordsRaw = await DailyRecord.find(recordQuery)
      .populate("internId", "traineeName traineeId email")
      .sort({ createdAt: -1 });

    // Map records to include stack, task, progress, blockers, status
    const records = recordsRaw.map((record) => ({
      _id: record._id,
      date: record.date,
      createdAt: record.createdAt,
      stack: record.stack,
      task: record.task,
      progress: record.progress,
      blockers: record.blockers,
      status: record.status,
    }));

    // Calculate statistics
    const daysSinceLastSubmission =
      records.length > 0
        ? Math.floor(
            (new Date() - new Date(records[0].createdAt)) /
              (1000 * 60 * 60 * 24),
          )
        : null;

    // ── Real Mon–Sun week boundaries ──────────────────────────────────────
    const now = new Date();

    const weekStart = new Date(now);
    const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon … 6 = Sat
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(now.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // ── Real calendar month boundaries ────────────────────────────────────
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const weeklyRecords = records.filter((record) => {
      const d = new Date(record.createdAt);
      return d >= weekStart && d <= weekEnd;
    });

    const monthlyRecords = records.filter((record) => {
      const d = new Date(record.createdAt);
      return d >= monthStart && d <= monthEnd;
    });

    // Fetch TalentTrail sync record for projects
    const syncRecord = await InternTalentTrailSync.findOne({
      email: { $regex: new RegExp(`^${intern.Trainee_Email}$`, "i") },
    }).lean();
    const projects = syncRecord ? syncRecord.projects || [] : [];

    // Fetch university supervisor feedbacks
    const UniversityStudentFeedback = require("../models/UniversityStudentFeedback");
    const UniversityUser = require("../models/UniversityUser");
    const rawFeedbacks = await UniversityStudentFeedback.find({
      $or: [
        { internId: intern._id },
        { traineeId: intern.Trainee_ID },
      ],
    })
      .populate("universitySupervisorId", "picture")
      .sort({ createdAt: -1 })
      .lean()
      .catch(() => []);

    const universityFeedbacks = await Promise.all(
      (rawFeedbacks || []).map(async (fb) => {
        let pic = fb.supervisorPicture || fb.universitySupervisorId?.picture || "";
        if (!pic && fb.supervisorEmail) {
          const sup = await UniversityUser.findOne({ email: fb.supervisorEmail })
            .select("picture")
            .lean();
          if (sup && sup.picture) pic = sup.picture;
        }
        return {
          ...fb,
          picture: pic,
          supervisorPicture: pic,
        };
      })
    );

    // New-intern grace period: interns still within their first 5
    // working days are never marked overdue.
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const internStartDate = intern.Training_StartDate
      ? new Date(intern.Training_StartDate)
      : null;
    const gracePeriodEndDate = internStartDate
      ? calculateGracePeriodEndDate(internStartDate)
      : null;
    const isWithinGracePeriod =
      gracePeriodEndDate && todayEnd <= gracePeriodEndDate;

    const internDetails = {
      intern: {
        _id: intern._id,
        traineeId: intern.Trainee_ID,
        traineeName: intern.Trainee_Name,
        email: intern.Trainee_Email,
        fieldOfSpecialization: intern.field_of_spec_name,
        homeAddress: intern.Trainee_HomeAddress,
        startDate: intern.Training_StartDate,
        endDate: intern.Training_EndDate,
        institute: intern.Institute,
        team: intern.team,
        availableDays: intern.availableDays,
        agreementAccepted: intern.agreementAccepted,
        agreementAcceptedDate: intern.agreementAcceptedDate,
        digitalAgreement: intern.digitalAgreement,
        projects,
      },
      records,
      statistics: {
        totalRecords: records.length,
        weeklyRecords: weeklyRecords.length,
        monthlyRecords: monthlyRecords.length,
        daysSinceLastSubmission,
        isOverdue:
          !isWithinGracePeriod &&
          (daysSinceLastSubmission === null || daysSinceLastSubmission >= 3),
        isWithinGracePeriod: !!isWithinGracePeriod,
        averageSubmissionsPerWeek: monthlyRecords.length / 4,
      },
      universityFeedbacks: universityFeedbacks || [],
    };

    res.status(200).json(internDetails);
  } catch (error) {
    console.error("Error getting intern details:", error);
    res.status(500).json({ error: "Failed to get intern details" });
  }
};

// Search interns by name, trainee ID, or email
const searchInterns = async (req, res) => {
  try {
    const userId = req.user.id;
    const { q } = req.query;

    // Verify admin user
    const adminUser = await User.findById(userId);
    if (!adminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Handle special case for getting all interns
    if (!q || q.trim().length < 2) {
      if (q && q.trim() === "*") {
        // Get all interns
        const interns = await Intern.find({});

        // Get all records
        const records = await DailyRecord.find({
          internId: { $in: interns.map((intern) => intern._id) },
        })
          .populate("internId", "traineeName traineeId email")
          .sort({ createdAt: -1 });

        // Build report for each intern
        const searchResults = interns.map((intern) => {
          const internRecords = records.filter(
            (record) =>
              record.internId &&
              record.internId._id.toString() === intern._id.toString(),
          );

          const lastSubmission =
            internRecords.length > 0 ? internRecords[0] : null;
          const daysSinceLastSubmission = lastSubmission
            ? Math.floor(
                (new Date() - new Date(lastSubmission.createdAt)) /
                  (1000 * 60 * 60 * 24),
              )
            : null;

          const checkWindow = getPastWorkingDays(5);
          const periodLogsCount = internRecords.filter((r) =>
            checkWindow.includes(r.date),
          ).length;
          const inGrace = isWithinGracePeriod(intern.Training_StartDate);
          const isNonSubmitting = !inGrace && periodLogsCount < MIN_WEEKLY_LOGS_REQUIRED;

          return {
            _id: intern._id,
            traineeId: intern.Trainee_ID,
            traineeName: intern.Trainee_Name,
            email: intern.Trainee_Email,
            fieldOfSpecialization: intern.field_of_spec_name,
            team: intern.team,
            totalRecords: internRecords.length,
            lastSubmission: lastSubmission ? lastSubmission.createdAt : null,
            daysSinceLastSubmission,
            isOverdue: isNonSubmitting,
            isNonSubmitting,
            isWithinGracePeriod: !!inGrace,
            recentRecords: internRecords.slice(0, 5).map((record) => ({
              _id: record._id,
              date: record.date,
              createdAt: record.createdAt,
              stack: record.stack,
              task: record.task,
              progress: record.progress,
              blockers: record.blockers,
            })),
          };
        });

        return res.status(200).json(searchResults);
      }

      return res
        .status(400)
        .json({ error: "Search query must be at least 2 characters" });
    }

    const searchTerm = q.trim();

    // Create case-insensitive search regex
    const searchRegex = new RegExp(searchTerm, "i");

    // Search interns by name, trainee ID, or email (using correct DB field names)
    const interns = await Intern.find({
      $or: [
        { Trainee_Name: searchRegex },
        { Trainee_ID: searchRegex },
        { Trainee_Email: searchRegex },
      ],
    });

    // Get records for found interns
    const records = await DailyRecord.find({
      internId: { $in: interns.map((intern) => intern._id) },
    })
      .populate("internId")
      .sort({ createdAt: -1 });

    // Build report for each found intern
    const searchResults = interns.map((intern) => {
      const internRecords = records.filter(
        (record) =>
          record.internId &&
          record.internId._id.toString() === intern._id.toString(),
      );

      const lastSubmission = internRecords.length > 0 ? internRecords[0] : null;
      const daysSinceLastSubmission = lastSubmission
        ? Math.floor(
            (new Date() - new Date(lastSubmission.createdAt)) /
              (1000 * 60 * 60 * 24),
          )
        : null;

      // Check if overdue (no submission in last 3 days), unless the
      // intern is still within their new-intern grace period
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const internStartDate = intern.Training_StartDate
        ? new Date(intern.Training_StartDate)
        : null;
      const gracePeriodEndDate = internStartDate
        ? calculateGracePeriodEndDate(internStartDate)
        : null;
      const isWithinGracePeriod =
        gracePeriodEndDate && todayEnd <= gracePeriodEndDate;
      const isOverdue =
        !isWithinGracePeriod &&
        (!lastSubmission || new Date(lastSubmission.createdAt) < threeDaysAgo);

      return {
        _id: intern._id,
        traineeId: intern.Trainee_ID,
        traineeName: intern.Trainee_Name,
        email: intern.Trainee_Email,
        fieldOfSpecialization: intern.field_of_spec_name,
        team: intern.team,
        totalRecords: internRecords.length,
        lastSubmission: lastSubmission ? lastSubmission.createdAt : null,
        daysSinceLastSubmission,
        isOverdue,
        isWithinGracePeriod: !!isWithinGracePeriod,
        recentRecords: internRecords.slice(0, 5).map((record) => ({
          _id: record._id,
          date: record.date,
          createdAt: record.createdAt,
          stack: record.stack,
          task: record.task,
          progress: record.progress,
          blockers: record.blockers,
        })),
      };
    });

    res.status(200).json(searchResults);
  } catch (error) {
    console.error("Error searching interns:", error);
    res.status(500).json({ error: "Failed to search interns" });
  }
};

// Helper function to get last submission date
const getLastSubmissionDate = (internId, records) => {
  const internRecords = records.filter(
    (record) =>
      record.internId && record.internId._id.toString() === internId.toString(),
  );

  return internRecords.length > 0 ? internRecords[0].createdAt : null;
};

// Get all daily records for admin view
const getAllDailyRecords = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const date = (req.query.date || "").trim(); // "YYYY-MM-DD"
    const search = (req.query.search || "").trim();

    // 1. Build record-level filter
    const recordFilter = {};

    // Always filter by date so we only load one day at a time
    if (date) {
      recordFilter.date = date;
    }

    // 2. Resolve intern IDs when search term present
    if (search) {
      const Intern = require("../models/Intern");
      const matchingInterns = await Intern.find(
        {
          $or: [
            { Trainee_Name: { $regex: search, $options: "i" } },
            { Trainee_ID: { $regex: search, $options: "i" } },
          ],
        },
        "_id",
      ).lean();

      if (matchingInterns.length === 0) {
        // Short-circuit — no interns matched the search
        return res.status(200).json({
          records: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }

      recordFilter.internId = { $in: matchingInterns.map((i) => i._id) };
    }

    // 3. Count + paginated fetch (parallel)
    const [total, records] = await Promise.all([
      DailyRecord.countDocuments(recordFilter),
      DailyRecord.find(recordFilter)
        .populate("internId", "Trainee_Name Trainee_ID Trainee_Email")
        .sort({ createdAt: -1 }) // newest submission first within the day
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching daily records:", error);
    res.status(500).json({ error: "Failed to fetch daily records" });
  }
};

// Helper function to calculate working days (excluding weekends)
const getWorkingDays = (startDate, endDate) => {
  const workingDays = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday - exclude weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
};

// Helper function to normalize date to start of day for comparison
const normalizeDateToDay = (date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

// Helper function to calculate grace period end date (5 working days after start date)
const calculateGracePeriodEndDate = (startDate) => {
  if (!startDate) return null;

  let workingDaysCount = 0;
  let currentDate = new Date(startDate);

  // Count 5 working days forward from start date
  while (workingDaysCount < 5) {
    currentDate.setDate(currentDate.getDate() + 1);
    const dayOfWeek = currentDate.getDay();

    // If it's a weekday (Mon-Fri), count it
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDaysCount++;
    }
  }

  // Set to end of the 5th working day
  currentDate.setHours(23, 59, 59, 999);
  return currentDate;
};

// Get non-submissions within a week from current date (last 5 working days)
const getNonSubmissionsWithinAWeek = async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify admin user
    const adminUser = await User.findById(userId);
    if (!adminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    // Calculate the start date (going back enough days to get 5 working days)
    let workingDaysCount = 0;
    let currentDate = new Date(today);
    let startDate = null;

    // Go back day by day until we have 5 working days
    while (workingDaysCount < 5) {
      currentDate.setDate(currentDate.getDate() - 1);
      const dayOfWeek = currentDate.getDay();

      // If it's a weekday (Mon-Fri), count it
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDaysCount++;
        if (workingDaysCount === 5) {
          startDate = new Date(currentDate);
          startDate.setHours(0, 0, 0, 0);
        }
      }
    }

    console.log(
      `Checking non-submissions from ${startDate.toDateString()} to ${today.toDateString()}`,
    );

    // Get all working days in the range
    const workingDays = getWorkingDays(startDate, today);
    console.log(`Working days in range: ${workingDays.length}`);

    // Get all interns
    const allInterns = await Intern.find({});
    console.log(`Total interns in database: ${allInterns.length}`);

    // Get all daily records within the date range
    const records = await DailyRecord.find({
      createdAt: {
        $gte: startDate,
        $lte: today,
      },
    })
      .populate("internId")
      .sort({ createdAt: -1 });

    console.log(`Found ${records.length} records in date range`);

    // Build a map of intern submissions by day
    const internSubmissionsByDay = new Map();

    records.forEach((record) => {
      if (record.internId) {
        const internId = record.internId._id.toString();
        const recordDate = normalizeDateToDay(record.createdAt);
        const dateKey = recordDate.toISOString().split("T")[0];

        if (!internSubmissionsByDay.has(internId)) {
          internSubmissionsByDay.set(internId, new Set());
        }
        internSubmissionsByDay.get(internId).add(dateKey);
      }
    });

    // Batch-fetch each intern's most recent submission ever (not just within
    // the review window) so the export shows a real date instead of "Never".
    const lastSubmissionSummary = await DailyRecord.aggregate([
      { $group: { _id: "$internId", lastSubmission: { $max: "$createdAt" } } },
    ]);
    const lastSubmissionMap = new Map();
    lastSubmissionSummary.forEach((s) => {
      if (s._id) lastSubmissionMap.set(s._id.toString(), s.lastSubmission);
    });

    // Filter interns who haven't submitted the required minimum number of logs
    const nonSubmittedInterns = [];
    const excusedInterns = [];

    for (const intern of allInterns) {
      const internId = intern._id.toString();
      const internStartDate = intern.Training_StartDate
        ? new Date(intern.Training_StartDate)
        : null;
      const internEndDate = intern.Training_EndDate
        ? new Date(intern.Training_EndDate)
        : null;

      // Skip if intern's training has ended before the report period
      if (internEndDate && internEndDate < startDate) {
        console.log(
          `Skipping intern ${intern.Trainee_ID} - training ended before period`,
        );
        continue;
      }

      // Calculate grace period end date (5 working days after start date)
      const gracePeriodEndDate = internStartDate
        ? calculateGracePeriodEndDate(internStartDate)
        : null;

      // Check if intern is still within grace period
      if (gracePeriodEndDate && today <= gracePeriodEndDate) {
        console.log(
          `Excusing intern ${intern.Trainee_ID} - within 5-day grace period (started ${internStartDate.toDateString()}, grace ends ${gracePeriodEndDate.toDateString()})`,
        );
        excusedInterns.push({
          traineeId: intern.Trainee_ID,
          traineeName: intern.Trainee_Name,
          startDate: internStartDate,
          gracePeriodEnd: gracePeriodEndDate,
          reason: "Within 5-day grace period for new interns",
        });
        continue;
      }

      // Calculate which working days this intern should have submitted for
      const applicableWorkingDays = workingDays.filter((workDay) => {
        // If intern started during this week, only check days after start date
        if (internStartDate && workDay < internStartDate) {
          return false;
        }
        // If intern is within grace period, exclude days within that period
        if (gracePeriodEndDate && workDay <= gracePeriodEndDate) {
          return false;
        }
        // If intern ended during this week, only check days before end date
        if (internEndDate && workDay > internEndDate) {
          return false;
        }
        return true;
      });

      // If intern started this week and all applicable days are excused, skip them
      if (applicableWorkingDays.length === 0) {
        console.log(
          `Excusing intern ${intern.Trainee_ID} - no applicable days after grace period`,
        );
        excusedInterns.push({
          traineeId: intern.Trainee_ID,
          traineeName: intern.Trainee_Name,
          startDate: internStartDate,
          gracePeriodEnd: gracePeriodEndDate,
          reason: "No applicable days after grace period",
        });
        continue;
      }

      // Check how many of the applicable working days the intern submitted for
      const submittedDays = internSubmissionsByDay.get(internId) || new Set();
      const submittedApplicableDays = applicableWorkingDays.filter(
        (workDay) => {
          const dateKey = normalizeDateToDay(workDay)
            .toISOString()
            .split("T")[0];
          return submittedDays.has(dateKey);
        },
      );

      // Calculate how many logs are still needed, relative to the minimum
      // required, capped by how many days actually apply to this intern
      // (e.g. an intern with only 2 applicable days this week can't
      // reasonably be held to a 3-log minimum).
      const submittedCount = submittedApplicableDays.length;
      const requiredCount = Math.min(
        MIN_WEEKLY_LOGS_REQUIRED,
        applicableWorkingDays.length,
      );
      const missingDaysCount = requiredCount - submittedCount;

      // Flag interns who submitted fewer than the required number of logs
      if (missingDaysCount > 0) {
        nonSubmittedInterns.push({
          _id: intern._id,
          traineeId: intern.Trainee_ID,
          traineeName: intern.Trainee_Name,
          email: intern.Trainee_Email,
          fieldOfSpecialization: intern.field_of_spec_name,
          institute: intern.Institute || "Not Specified",
          team: intern.team || "Unassigned",
          trainingStartDate: intern.Training_StartDate,
          trainingEndDate: intern.Training_EndDate,
          logsSubmitted: submittedCount,
          lastSubmission: lastSubmissionMap.get(internId) || null,
          submittedDaysCount: submittedCount,
          requiredDaysCount: requiredCount,
          missingDaysCount: missingDaysCount,
          applicableDaysCount: applicableWorkingDays.length,
          gracePeriodEnd: gracePeriodEndDate
            ? gracePeriodEndDate.toISOString().split("T")[0]
            : null,
          status: "Below Required Weekly Submissions",
        });
      }
    }

    const weekPeriodLabel = `${startDate.toISOString().split("T")[0]} to ${today.toISOString().split("T")[0]}`;

    console.log(
      `Found ${nonSubmittedInterns.length} interns below the required ${MIN_WEEKLY_LOGS_REQUIRED} logs for the review period`,
    );
    console.log(
      `Excused ${excusedInterns.length} interns (grace period or no applicable days) - excluded from report`,
    );

    res.status(200).json({
      weekPeriod: weekPeriodLabel,
      startDate: startDate.toISOString().split("T")[0],
      endDate: today.toISOString().split("T")[0],
      workingDaysChecked: 5,
      requiredSubmissions: MIN_WEEKLY_LOGS_REQUIRED,
      totalInterns: allInterns.length,
      totalActiveInterns: allInterns.length - excusedInterns.length, // Active interns not in grace period
      nonSubmittedCount: nonSubmittedInterns.length,
      excusedCount: excusedInterns.length, // For logging purposes only
      nonSubmittedInterns: nonSubmittedInterns,
      // excusedInterns array removed - not included in response
    });
  } catch (error) {
    console.error("Error getting non-submissions within a week:", error);
    res
      .status(500)
      .json({ error: "Failed to get non-submissions within a week" });
  }
};

// Get weekly non-submissions (Monday to Friday of current week)
// Get weekly non-submissions (Monday to Friday of current week)
const getWeeklyNonSubmissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const weekType = req.query.week;
    const startDateParam = req.query.startDate;
    const endDateParam = req.query.endDate;

    // Verify admin user
    const adminUser = await User.findById(userId);
    if (!adminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }

    let startDate, endDate, weekPeriodLabel, workingDaysInRange;
    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
      weekPeriodLabel = `${startDate.toDateString()} to ${endDate.toDateString()}`;
      // Count working days (Mon-Fri) in custom range
      workingDaysInRange = 0;
      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) workingDaysInRange++;
      }
    } else {
      // Fallback to legacy logic (weekType)
      const today = new Date();
      if (weekType === "previous") {
        const prevWeek = new Date(today);
        prevWeek.setDate(today.getDate() - 7);
        const prevDayOfWeek = prevWeek.getDay();
        const prevMonday = new Date(prevWeek);
        const daysFromMonday = prevDayOfWeek === 0 ? 6 : prevDayOfWeek - 1;
        prevMonday.setDate(prevWeek.getDate() - daysFromMonday);
        prevMonday.setHours(0, 0, 0, 0);
        const prevSunday = new Date(prevMonday);
        prevSunday.setDate(prevMonday.getDate() + 6);
        prevSunday.setHours(23, 59, 59, 999);
        startDate = prevMonday;
        endDate = prevSunday;
        weekPeriodLabel = `${startDate.toDateString()} to ${endDate.toDateString()}`;
        workingDaysInRange = 0;
        for (
          let d = new Date(startDate);
          d <= endDate;
          d.setDate(d.getDate() + 1)
        ) {
          const dayOfWeek = d.getDay();
          if (dayOfWeek >= 1 && dayOfWeek <= 5) workingDaysInRange++;
        }
      } else {
        const dayOfWeek = today.getDay();
        const currMonday = new Date(today);
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        currMonday.setDate(today.getDate() - daysFromMonday);
        currMonday.setHours(0, 0, 0, 0);
        const currFriday = new Date(currMonday);
        currFriday.setDate(currMonday.getDate() + 4);
        currFriday.setHours(23, 59, 59, 999);
        startDate = currMonday;
        endDate = currFriday;
        weekPeriodLabel = `${startDate.toDateString()} to ${endDate.toDateString()}`;
        // Count working days from Monday to today (or Friday if today is after Friday)
        workingDaysInRange = 0;
        const todayDate = new Date();
        const rangeEnd = todayDate > endDate ? endDate : todayDate;
        for (
          let d = new Date(startDate);
          d <= rangeEnd;
          d.setDate(d.getDate() + 1)
        ) {
          const dayOfWeek = d.getDay();
          if (dayOfWeek >= 1 && dayOfWeek <= 5) workingDaysInRange++;
        }
      }
    }

    // Custom date range = strict "submitted nothing at all" check.
    // Legacy current/previous full-week view keeps the weekly quota check
    // (must submit at least MIN_WEEKLY_LOGS_REQUIRED of the working days).
    const isCustomRange = Boolean(startDateParam && endDateParam);

    console.log("Checking weekly submissions from:", weekPeriodLabel);

    // Get all interns
    const allInterns = await Intern.find({});

    // Filter out interns whose training has already ended before the report
    // end date, AND interns still within their new-intern grace period
    // (5 working days from Training_StartDate) as of the report end date.
    const reportEndDate = endDate;
    const toDateString = (d) => {
      const date = new Date(d);
      return date.toISOString().slice(0, 10); // YYYY-MM-DD
    };
    const reportEndDateStr = toDateString(endDate);
    const reportStartDateStr = toDateString(startDate);
    let excusedForGracePeriodCount = 0;
    const activeInterns = allInterns.filter((intern) => {
      if (intern.Training_EndDate) {
        const internEndDateStr = toDateString(intern.Training_EndDate);
        // Exclude if intern's end date is <= report end date
        if (internEndDateStr <= reportEndDateStr) {
          console.log(
            `Excluding intern ${intern.Trainee_ID} (${intern.Trainee_Name}) with end date ${internEndDateStr} <= report end date ${reportEndDateStr}`,
          );
          return false;
        }
      }

      // New-intern grace period: exclude interns whose 5-working-day grace
      // period (from Training_StartDate) hasn't ended by the report's end date.
      if (intern.Training_StartDate) {
        const gracePeriodEndDate = calculateGracePeriodEndDate(
          new Date(intern.Training_StartDate),
        );
        if (reportEndDate <= gracePeriodEndDate) {
          console.log(
            `Excusing intern ${intern.Trainee_ID} (${intern.Trainee_Name}) - within 5-day grace period`,
          );
          excusedForGracePeriodCount++;
          return false;
        }
      }

      return true;
    });

    console.log(
      `Total interns: ${allInterns.length}, Active interns (training not ended, not in grace period): ${activeInterns.length}`,
    );

    // Get all daily records for the custom range (single day or range)
    const weeklyRecords = await DailyRecord.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .populate("internId", "traineeName traineeId email fieldOfSpecialization")
      .sort({ createdAt: -1 });

    // Build a map of intern ID -> submission count in the range
    const submissionCountMap = new Map();
    weeklyRecords.forEach((record) => {
      if (record.internId) {
        const id = record.internId._id.toString();
        submissionCountMap.set(id, (submissionCountMap.get(id) || 0) + 1);
      }
    });

    // Batch-fetch each intern's most recent submission ever (not just within
    // this custom range) so the export shows a real date instead of "Never".
    const lastSubmissionSummary = await DailyRecord.aggregate([
      { $group: { _id: "$internId", lastSubmission: { $max: "$createdAt" } } },
    ]);
    const lastSubmissionMap = new Map();
    lastSubmissionSummary.forEach((s) => {
      if (s._id) lastSubmissionMap.set(s._id.toString(), s.lastSubmission);
    });

    // How many logs are required for this range, capped by how many working
    // days are actually in it (handles short/custom ranges sanely).
    // For an explicit custom date range this is purely informational — the
    // actual filter below uses "0 submissions" instead of this quota.
    const requiredSubmissions = isCustomRange
      ? 1
      : Math.min(MIN_WEEKLY_LOGS_REQUIRED, workingDaysInRange);

    // Find active interns who are non-submitters for the period.
    // - Custom range: intern submitted ZERO logs during the selected dates.
    // - Legacy week view: intern submitted fewer than the weekly quota.
    const nonSubmittedInterns = activeInterns.filter((intern) => {
      const count = submissionCountMap.get(intern._id.toString()) || 0;
      return isCustomRange ? count === 0 : count < requiredSubmissions;
    });

    // Format response with additional details
    const nonSubmissionsArray = nonSubmittedInterns.map((intern) => {
      const count = submissionCountMap.get(intern._id.toString()) || 0;
      const lastSub = lastSubmissionMap.get(intern._id.toString()) || null;
      return {
        _id: intern._id,
        traineeId: intern.Trainee_ID,
        traineeName: intern.Trainee_Name,
        email: intern.Trainee_Email,
        fieldOfSpecialization: intern.field_of_spec_name,
        institute: intern.Institute || "Not Specified",
        team: intern.team || "Unassigned",
        trainingStartDate: intern.Training_StartDate,
        trainingEndDate: intern.Training_EndDate,
        weeklySubmissions: count,
        logsSubmitted: count,
        requiredSubmissions: requiredSubmissions,
        workingDaysThisWeek: workingDaysInRange,
        missedDays: requiredSubmissions - count,
        weekPeriod: weekPeriodLabel,
        lastSubmission: lastSub,
        daysSinceLastSubmission: lastSub
          ? Math.floor((Date.now() - new Date(lastSub).getTime()) / 86400000)
          : null,
        status: isCustomRange
          ? "No Submissions In Selected Range"
          : "Below Required Weekly Submissions",
      };
    });

    console.log(
      `Found ${nonSubmissionsArray.length} active interns ${
        isCustomRange
          ? "with zero submissions"
          : `below the required ${requiredSubmissions} submissions`
      } for period: ${weekPeriodLabel}`,
    );
    console.log(`Total working days in period: ${workingDaysInRange}`);
    console.log(
      `Excluded ${allInterns.length - activeInterns.length - excusedForGracePeriodCount} interns whose training has ended`,
    );
    console.log(
      `Excused ${excusedForGracePeriodCount} interns still in new-intern grace period`,
    );

    res.status(200).json({
      weekPeriod: weekPeriodLabel,
      workingDaysThisWeek: workingDaysInRange,
      requiredSubmissions,
      isCustomRange,
      totalInterns: activeInterns.length,
      totalInternsInDatabase: allInterns.length,
      excludedInterns:
        allInterns.length - activeInterns.length - excusedForGracePeriodCount,
      excusedInterns: excusedForGracePeriodCount,
      nonSubmittedCount: nonSubmissionsArray.length,
      submittedCount: activeInterns.length - nonSubmissionsArray.length,
      nonSubmittedInterns: nonSubmissionsArray,
    });
  } catch (error) {
    console.error("Error getting weekly non-submissions:", error);
    res.status(500).json({ error: "Failed to get weekly non-submissions" });
  }
};

// Manually trigger SLT API sync with optional cleanup
const syncWithSLTAPI = async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify admin user
    const adminUser = await User.findById(userId);
    if (!adminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { enableCleanup = false } = req.body;

    console.log(
      `Admin ${adminUser.email} triggered SLT API sync with cleanup: ${enableCleanup}`,
    );

    // Perform the sync
    const syncResult = await internService.syncWithSLTAPI(enableCleanup);

    res.json({
      success: syncResult.success,
      message: syncResult.message,
      data: {
        totalProcessed: syncResult.stats.totalProcessed,
        newInterns: syncResult.stats.added,
        updatedInterns: syncResult.stats.updated,
        removedInterns: syncResult.stats.removed,
        skippedInterns: syncResult.stats.skipped,
        errors: syncResult.stats.errors,
        cleanupEnabled: enableCleanup,
      },
    });
  } catch (error) {
    console.error("Error during SLT API sync:", error);
    res.status(500).json({
      error: "Failed to sync with SLT API",
      details: error.message,
    });
  }
};

// Manually trigger weekly non-submission check
const triggerWeeklyNonSubmissionCheck = async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify admin user
    const adminUser = await User.findById(userId);
    if (!adminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }

    console.log(
      `🔧 Manual weekly non-submission check triggered by admin: ${adminUser.email}`,
    );

    // Trigger the manual check
    const result = await WeeklyScheduler.triggerManualNonSubmissionCheck();

    if (result.success) {
      res.status(200).json({
        message: "Weekly non-submission check completed successfully",
        timestamp: result.timestamp,
        results: result.results,
      });
    } else {
      res.status(500).json({
        error: "Weekly non-submission check failed",
        details: result.error,
        timestamp: result.timestamp,
      });
    }
  } catch (error) {
    console.error("Error triggering weekly non-submission check:", error);
    res.status(500).json({
      error: "Failed to trigger weekly non-submission check",
      details: error.message,
    });
  }
};

// Manually trigger weekly non-submission check with Excel attachment
const triggerWeeklyNonSubmissionCheckWithExcel = async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify admin user
    const adminUser = await User.findById(userId);
    if (!adminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }

    console.log(
      `🔧 Manual weekly non-submission check (with Excel) triggered by admin: ${adminUser.email}`,
    );

    // Get recipient email from request body (optional, defaults to manager email)
    const recipientEmail = req.body.recipientEmail || "mgiri@slt.com.lk";

    // Trigger the check with Excel attachment
    const result =
      await WeeklyNonSubmissionExcelService.performWeeklyNonSubmissionCheckWithExcel(
        recipientEmail,
        "manual-admin",
      );

    if (result.emailSent) {
      res.status(200).json({
        message:
          "Weekly non-submission check with Excel attachment completed successfully",
        timestamp: new Date().toISOString(),
        results: {
          totalInterns: result.total,
          submittedLogs: result.submitted,
          notSubmitted: result.notSubmitted,
          emailSent: result.emailSent,
          recipient: recipientEmail,
          attachmentName: result.attachmentName,
          messageId: result.emailMessageId,
          executionTime: result.executionTime,
        },
      });
    } else {
      res.status(500).json({
        error: "Weekly non-submission check failed",
        details: result.emailError || result.error,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error(
      "Error triggering weekly non-submission check with Excel:",
      error,
    );
    res.status(500).json({
      error: "Failed to trigger weekly non-submission check with Excel",
      details: error.message,
    });
  }
};

const getAdminInternLocations = async (req, res) => {
  try {
    const { district } = req.query;

    const filter = {
      location: { $exists: true },
      "location.coordinates.0": { $exists: true },
    };

    // Only apply district filter if it exists and not All
    if (district && district !== "All") {
      filter.district = district;
    }

    const interns = await Intern.find(filter);

    const formatted = interns.map((intern) => ({
      id: intern.Trainee_ID,
      name: intern.Trainee_Name,
      address: intern.Trainee_HomeAddress,
      district: intern.district || "Unknown",
      coordinates: intern.location.coordinates,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching intern locations:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

const getDistrictCounts = async (req, res) => {
  try {
    const counts = await Intern.aggregate([
      {
        $match: {
          "location.coordinates.0": { $exists: true },
        },
      },
      {
        $group: {
          _id: "$district",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: counts,
    });
  } catch (error) {
    console.error("Error getting district counts:", error);
    res.status(500).json({
      success: false,
    });
  }
};

// Get a single intern's location by Trainee_ID (for the map search feature)
const getInternLocationById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { traineeId } = req.params;

    const adminUser = await User.findById(userId).lean();
    if (!adminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!traineeId) {
      return res.status(400).json({ error: "Trainee ID is required" });
    }

    // Case-insensitive search by Trainee_ID
    const intern = await Intern.findOne({
      Trainee_ID: { $regex: new RegExp(`^${traineeId.trim()}$`, "i") },
    }).lean();

    if (!intern) {
      return res
        .status(404)
        .json({ success: false, error: "Intern not found" });
    }

    const hasLocation =
      intern.location &&
      Array.isArray(intern.location.coordinates) &&
      intern.location.coordinates.length === 2;

    return res.status(200).json({
      success: true,
      data: {
        id: intern.Trainee_ID,
        name: intern.Trainee_Name,
        address: intern.Trainee_HomeAddress || "",
        district: intern.district || "",
        // coordinates is [longitude, latitude] — same shape as getAdminInternLocations
        coordinates: hasLocation ? intern.location.coordinates : null,
      },
    });
  } catch (error) {
    console.error("Error fetching intern location by ID:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch intern location" });
  }
};

// Manually trigger approved short leave email
const triggerApprovedShortLeaveEmail = async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify admin user
    const adminUser = await User.findById(userId);
    if (!adminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }

    console.log("\n========================================");
    console.log("📧 MANUAL TRIGGER - APPROVED SHORT LEAVE EMAIL");
    console.log(`Triggered by admin: ${adminUser.email}`);
    console.log("========================================");

    const ApprovedLeaveNotificationService = require("../services/approvedLeaveNotificationService");

    // Respond immediately to prevent gateway timeout
    res.status(202).json({
      success: true,
      message: "Email sending initiated. Processing in background...",
      processing: true,
    });

    // Process email in background (fire and forget)
    setImmediate(async () => {
      try {
        const result =
          await ApprovedLeaveNotificationService.sendDailyReport("manual");

        if (result.success && !result.skipped) {
          console.log(
            `✅ Background email sent to ${result.internsCount} intern(s)`,
          );
        } else if (result.skipped) {
          console.log(`📭 Background email skipped: ${result.reason}`);
        } else {
          console.error(`❌ Background email failed: ${result.error}`);
        }
      } catch (error) {
        console.error("❌ Background email error:", error);
      }
    });
  } catch (error) {
    console.error("Error triggering approved short leave email:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ─── GET /admin/intern/:internId/git-commits ─────────────────────────────────
/**
 * Fetches real GitHub commits for an intern across all their TalentTrail projects.
 * Each project in TalentTrail stores repoName + repoAccessToken.
 * The intern's githubUsername is stored in TalentTrail's /interns endpoint.
 * We filter commits by author.login === githubUsername OR author.email matches intern email.
 */
// Simple in-memory cache for git commits to reduce API rate limits and improve load time
const gitCommitsCache = new Map();
const GIT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const fetchInternGitCommitsData = async (internId) => {
  const cacheKey = `git_commits_${internId}`;
  const cached = gitCommitsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GIT_CACHE_TTL) {
    return cached.data;
  }

  let intern = null;
  if (mongoose.Types.ObjectId.isValid(internId)) {
    intern = await Intern.findById(internId);
    if (!intern) {
      const InactiveIntern = require("../models/InactiveIntern");
      intern = await InactiveIntern.findById(internId);
    }
  }
  if (!intern) {
    intern = await Intern.findOne({
      $or: [
        { Trainee_ID: internId },
        { Trainee_Email: { $regex: new RegExp(`^${internId}$`, "i") } },
      ],
    });
  }
  if (!intern) {
    const InactiveIntern = require("../models/InactiveIntern");
    intern = await InactiveIntern.findOne({
      $or: [
        { Trainee_ID: internId },
        { Trainee_Email: { $regex: new RegExp(`^${internId}$`, "i") } },
      ],
    });
  }
  if (!intern) return null;

  const syncRecord = await InternTalentTrailSync.findOne({
    email: { $regex: new RegExp(`^${intern.Trainee_Email}$`, "i") },
  }).lean();

  if (
    !syncRecord ||
    !syncRecord.projects ||
    syncRecord.projects.length === 0
  ) {
    const data = {
      githubUsername: null,
      internEmail: intern.Trainee_Email,
      projectCommits: [],
      totalCommits: 0,
      message: "No TalentTrail projects found for this intern",
    };
    gitCommitsCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  const sslAgent = new https.Agent({ rejectUnauthorized: false });
  const ttClient = axios.create({
    baseURL: "https://talenttrail.slt.lk/api",
    httpsAgent: sslAgent,
    timeout: 20000,
  });

  let ttToken;
  try {
    const loginRes = await ttClient.post(
      "/auth/federated-login",
      {
        email: "admin@slt.lk",
        source: "talenthub",
        timestamp: Date.now(),
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Service-Token": "TH_SK_f8e7d6c5b4a39281z0y9x8w7v6u5t4s3r2q1p0",
        },
      },
    );
    ttToken = loginRes.data.token;
  } catch (err) {
    console.error("[GitCommits] TalentTrail auth failed:", err.message);
    return {
      githubUsername: null,
      internEmail: intern.Trainee_Email,
      projectCommits: [],
      totalCommits: 0,
      message: "TalentTrail authentication failed",
    };
  }

  const authHeader = { Authorization: `Bearer ${ttToken}` };

  let githubUsername = null;
  try {
    const internsRes = await ttClient.get("/interns", {
      headers: authHeader,
    });
    const ttIntern = Array.isArray(internsRes.data)
      ? internsRes.data.find(
          (i) =>
            i.email?.toLowerCase() === intern.Trainee_Email?.toLowerCase(),
        )
      : null;
    githubUsername = ttIntern?.githubUsername || null;
  } catch (err) {
    console.warn(
      "[GitCommits] Could not fetch TalentTrail intern list:",
      err.message,
    );
  }

  let ttProjects = [];
  let ttModules = [];
  try {
    const [projRes, modRes] = await Promise.all([
      ttClient.get("/projects", { headers: authHeader }).catch((e) => {
        console.warn("[GitCommits] Could not fetch TalentTrail projects:", e.message);
        return { data: [] };
      }),
      ttClient.get("/modules", { headers: authHeader }).catch((e) => {
        console.warn("[GitCommits] Could not fetch TalentTrail modules:", e.message);
        return { data: [] };
      }),
    ]);
    ttProjects = Array.isArray(projRes.data) ? projRes.data : [];
    ttModules = Array.isArray(modRes.data) ? modRes.data : [];
  } catch (err) {
    console.warn(
      "[GitCommits] Could not fetch TalentTrail projects/modules:",
      err.message,
    );
  }

  const syncProjectIds = new Set(syncRecord.projects.map((p) => p.projectId));
  const getSyncProj = (id) =>
    syncRecord.projects.find((sp) => sp.projectId === id);

  const repoTargets = [];

  for (const proj of ttProjects) {
    const isDirectProject = syncProjectIds.has(proj.projectId);
    const parentId =
      proj.parentProjectId ?? proj.parentId ?? proj.projectParentId ?? null;
    const isChildProject =
      !isDirectProject &&
      parentId !== null &&
      syncProjectIds.has(parentId) &&
      proj.repoName &&
      proj.repoAccessToken;

    const syncProj =
      getSyncProj(proj.projectId) || (parentId ? getSyncProj(parentId) : null);
    const projStatus = syncProj?.status || proj.status;

    if (isDirectProject && proj.repoName && proj.repoAccessToken) {
      repoTargets.push({
        key: `proj-${proj.projectId}`,
        projectId: proj.projectId,
        projectName: proj.projectName,
        repoName: proj.repoName,
        repoAccessToken: proj.repoAccessToken,
        status: projStatus,
        moduleName: null,
        moduleId: null,
      });
    }

    if (isChildProject) {
      const parentProj = ttProjects.find((p) => p.projectId === parentId);
      repoTargets.push({
        key: `child-${proj.projectId}`,
        projectId: parentId,
        projectName: parentProj?.projectName || `Project ${parentId}`,
        repoName: proj.repoName,
        repoAccessToken: proj.repoAccessToken,
        status: projStatus,
        moduleName: proj.projectName || proj.moduleName || proj.name || proj.repoName,
        moduleId: proj.projectId,
      });
    }

    if (isDirectProject) {
      const modules =
        proj.modules ||
        proj.projectModules ||
        proj.moduleList ||
        proj.subModules ||
        proj.children ||
        [];

      for (const mod of modules) {
        if (mod.repoName && mod.repoAccessToken) {
          repoTargets.push({
            key: `mod-${proj.projectId}-${mod.moduleId || mod.id || mod.repoName}`,
            projectId: proj.projectId,
            projectName: proj.projectName,
            repoName: mod.repoName,
            repoAccessToken: mod.repoAccessToken,
            status: projStatus,
            moduleName: mod.moduleName || mod.name || mod.repoName,
            moduleId: mod.moduleId || mod.id || null,
          });
        }
      }
    }
  }

  const talentTrailInternId = syncRecord.talentTrailInternId;
  for (const mod of ttModules) {
    const isOwner = mod.ownerInternId === talentTrailInternId;
    const isProjectMod = mod.projectId && syncProjectIds.has(mod.projectId);
    
    if ((isOwner || isProjectMod) && mod.repoName && mod.repoAccessToken) {
      if (!repoTargets.some((t) => t.repoName === mod.repoName)) {
        const modKey = `mod-endpoint-${mod.moduleId || mod.id || mod.repoName}`;
        const parentProj = ttProjects.find((p) => p.projectId === mod.projectId);
        const syncProj = mod.projectId ? getSyncProj(mod.projectId) : null;
        
        repoTargets.push({
          key: modKey,
          projectId: mod.projectId || `mod-${mod.moduleId || Date.now()}`,
          projectName: parentProj?.projectName || mod.projectName || `Module ${mod.moduleName || mod.repoName}`,
          repoName: mod.repoName,
          repoAccessToken: mod.repoAccessToken,
          status: mod.status || syncProj?.status || parentProj?.status || "IN_PROGRESS",
          moduleName: mod.moduleName || mod.name || mod.repoName,
          moduleId: mod.moduleId || mod.id || null,
        });
      }
    }
  }

  if (repoTargets.length === 0) {
    const data = {
      githubUsername,
      internEmail: intern.Trainee_Email,
      projectCommits: [],
      totalCommits: 0,
      message: "No projects with GitHub repositories configured",
    };
    gitCommitsCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  const ghClient = axios.create({
    baseURL: "https://api.github.com",
    timeout: 15000,
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "TalentHub-SLT",
    },
  });

  const commitResults = await Promise.all(
    repoTargets.map(async (target) => {
      try {
        const params = { per_page: 100 };
        if (githubUsername) params.author = githubUsername;

        let allCommits = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const ghRes = await ghClient.get(
            `/repos/${target.repoName}/commits`,
            {
              headers: { Authorization: `token ${target.repoAccessToken}` },
              params: { ...params, page },
            },
          );
          const pageCommits = Array.isArray(ghRes.data) ? ghRes.data : [];
          allCommits = allCommits.concat(pageCommits);
          if (pageCommits.length < 100 || page >= 10) hasMore = false;
          else page++;
        }

        const commits = allCommits.map((c) => ({
          sha: c.sha,
          shortSha: c.sha.slice(0, 7),
          message: c.commit.message.split("\n")[0],
          authorName: c.commit.author.name,
          authorEmail: c.commit.author.email,
          authorLogin: c.author?.login || null,
          authorAvatar: c.author?.avatar_url || null,
          date: c.commit.author.date,
          url: c.html_url,
        }));

        const filtered = githubUsername
          ? commits
          : commits.filter(
              (c) =>
                c.authorEmail?.toLowerCase() ===
                intern.Trainee_Email?.toLowerCase(),
            );

        return { ...target, commits: filtered, totalCommits: filtered.length, error: null };
      } catch (err) {
        console.warn(
          `[GitCommits] Failed for repo ${target.repoName} (${target.key}):`,
          err.message,
        );
        return {
          ...target,
          commits: [],
          totalCommits: 0,
          error:
            err.response?.status === 403
              ? "repository_access_denied"
              : "fetch_failed",
        };
      }
    }),
  );

  const projectMap = new Map();

  for (const result of commitResults) {
    const { projectId, projectName, status } = result;
    if (!projectMap.has(projectId)) {
      projectMap.set(projectId, {
        projectId,
        projectName,
        status,
        repoName: null,
        commits: [],
        totalCommits: 0,
        modules: [],
      });
    }

    const entry = projectMap.get(projectId);

    if (result.moduleName) {
      entry.modules.push({
        moduleId: result.moduleId,
        moduleName: result.moduleName,
        repoName: result.repoName,
        commits: result.commits,
        totalCommits: result.totalCommits,
        error: result.error,
      });
      entry.commits.push(...result.commits);
      entry.totalCommits += result.totalCommits;
    } else {
      entry.repoName = result.repoName;
      entry.commits.push(...result.commits);
      entry.totalCommits += result.totalCommits;
      if (result.error) entry.error = result.error;
    }
  }

  const projectCommits = Array.from(projectMap.values());

  const coveredProjectIds = new Set(repoTargets.map((t) => t.projectId));
  syncRecord.projects
    .filter((sp) => !coveredProjectIds.has(sp.projectId))
    .forEach((sp) => {
      projectCommits.push({
        projectId: sp.projectId,
        projectName: sp.projectName,
        repoName: null,
        status: sp.status,
        commits: [],
        totalCommits: 0,
        modules: [],
        error: "no_repo_configured",
      });
    });

  const totalCommits = projectCommits.reduce((sum, p) => sum + p.totalCommits, 0);
  const responseData = {
    githubUsername,
    internEmail: intern.Trainee_Email,
    projectCommits,
    totalCommits,
  };

  gitCommitsCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
  Intern.findByIdAndUpdate(internId, { commitsCount: totalCommits }).catch(() => {});
  return responseData;
};

const getInternGitCommits = async (req, res) => {
  try {
    const { internId } = req.params;
    const data = await fetchInternGitCommitsData(internId);
    if (!data) return res.status(404).json({ error: "Intern not found" });
    return res.status(200).json(data);
  } catch (error) {
    console.error("[getInternGitCommits] Error:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getInternReport,
  getInternDetails,
  searchInterns,
  getAllDailyRecords,
  getNonSubmissionsWithinAWeek,
  getWeeklyNonSubmissions,
  syncWithSLTAPI,
  triggerWeeklyNonSubmissionCheck,
  triggerWeeklyNonSubmissionCheckWithExcel,
  getAdminInternLocations,
  getDistrictCounts,
  getInternLocationById,
  triggerApprovedShortLeaveEmail,
  getInternGitCommits,
  fetchInternGitCommitsData,
  gitCommitsCache,
};
