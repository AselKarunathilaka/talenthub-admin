const DailyRecord = require("../models/DailyRecord");
const Intern = require("../models/Intern");
const User = require("../models/User");
const emailSender = require("../utils/emailSender");
const internService = require("../services/internService");

// Get admin dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify admin user
    const adminUser = await User.findById(userId);
    if (!adminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Get all interns
    const interns = await Intern.find({});
    
    // Get all records
    const records = await DailyRecord.find({})
      .populate('internId', 'traineeName traineeId email')
      .sort({ createdAt: -1 });

    // Calculate statistics
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const overdueInterns = [];
    const submittedInterns = [];

    for (const intern of interns) {
      const internRecords = records.filter(record => 
        record.internId && record.internId._id.toString() === intern._id.toString()
      );

      if (internRecords.length === 0) {
        overdueInterns.push(intern);
      } else {
        const latestRecord = internRecords[0]; // Already sorted by createdAt desc
        if (new Date(latestRecord.createdAt) < threeDaysAgo) {
          overdueInterns.push(intern);
        } else {
          submittedInterns.push(intern);
        }
      }
    }

    const stats = {
      totalInterns: interns.length,
      totalRecords: records.length,
      submittedInterns: submittedInterns.length,
      overdueInterns: overdueInterns.length,
      overdueList: overdueInterns.map(intern => {
        const internRecords = records.filter(record => 
          record.internId && record.internId._id.toString() === intern._id.toString()
        );
        const lastSubmission = getLastSubmissionDate(intern._id, records);
        const daysSinceLastSubmission = lastSubmission ? 
          Math.floor((new Date() - new Date(lastSubmission)) / (1000 * 60 * 60 * 24)) : null;
        const instituteValue = intern.Institute && intern.Institute.trim() ? intern.Institute : "Not Specified";
        return {
          _id: intern._id,
          traineeId: intern.Trainee_ID,
          traineeName: intern.Trainee_Name,
          email: intern.Trainee_Email,
          trainingStartDate: intern.Training_StartDate,
          trainingEndDate: intern.Training_EndDate,
          fieldOfSpecialization: intern.field_of_spec_name,
          institute: instituteValue,
          totalRecords: internRecords.length,
          lastSubmission: lastSubmission,
          daysSinceLastSubmission: daysSinceLastSubmission
        };
      })
    };

    res.status(200).json(stats);

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

    // Get all interns with their records
    const interns = await Intern.find({});
    const records = await DailyRecord.find({})
      .populate('internId', 'traineeName traineeId email')
      .sort({ createdAt: -1 });

    const report = interns.map(intern => {
      const internRecords = records.filter(record => 
        record.internId && record.internId._id.toString() === intern._id.toString()
      );

      const lastSubmission = internRecords.length > 0 ? internRecords[0] : null;
      const daysSinceLastSubmission = lastSubmission ? 
        Math.floor((new Date() - new Date(lastSubmission.createdAt)) / (1000 * 60 * 60 * 24)) : null;

      return {
        _id: intern._id,
        traineeId: intern.Trainee_ID,
        traineeName: intern.Trainee_Name,
        email: intern.Trainee_Email,
        fieldOfSpecialization: intern.field_of_spec_name,
        team: intern.team || 'Unassigned',
        trainingStartDate: intern.Training_StartDate,
        trainingEndDate: intern.Training_EndDate,
        totalRecords: internRecords.length,
        lastSubmission: lastSubmission ? lastSubmission.createdAt : null,
        daysSinceLastSubmission,
        isOverdue: daysSinceLastSubmission === null || daysSinceLastSubmission >= 3,
        recentRecords: internRecords.slice(0, 5) // Last 5 records
      };
    });

    res.status(200).json(report);

  } catch (error) {
    console.error("Error getting intern report:", error);
    res.status(500).json({ error: "Failed to generate intern report" });
  }
};

// Send notifications to overdue interns
const sendOverdueNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { overdueInterns } = req.body;

    // Verify admin user
    const adminUser = await User.findById(userId);
    if (!adminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!overdueInterns || !Array.isArray(overdueInterns)) {
      return res.status(400).json({ error: "Invalid overdue interns data" });
    }

    const notifications = [];
    const errors = [];

    for (const intern of overdueInterns) {
      try {
        if (intern.email) {
          const emailSubject = "Daily Logbook Submission Reminder";
          const emailContent = `
            Dear ${intern.name},

            This is a friendly reminder that you haven't submitted your daily logbook in the past 3 days.

            Please make sure to fill out your daily logbook regularly to track your progress and maintain good communication with your supervisors.

            You can submit your logbook at: [https://talenthub.slt.lk/]

            Trainee ID: ${intern.traineeId}

            If you have any questions or technical issues, please contact your supervisor immediately.

            Best regards,
            SLT Mobitel
            Digital Platforms Development Section
          `;

          await emailSender(intern.email, emailSubject, emailContent);
          notifications.push({
            internId: intern.id,
            name: intern.name,
            email: intern.email,
            status: 'sent'
          });
        } else {
          errors.push({
            internId: intern.id,
            name: intern.name,
            error: 'No email address'
          });
        }
      } catch (error) {
        console.error(`Error sending notification to ${intern.name}:`, error);
        errors.push({
          internId: intern.id,
          name: intern.name,
          error: error.message
        });
      }
    }

    res.status(200).json({
      message: `Notifications sent to ${notifications.length} interns`,
      successful: notifications,
      failed: errors,
      totalSent: notifications.length,
      totalFailed: errors.length
    });

  } catch (error) {
    console.error("Error sending overdue notifications:", error);
    res.status(500).json({ error: "Failed to send notifications" });
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

    // Get intern details
    const intern = await Intern.findById(internId);
    if (!intern) {
      return res.status(404).json({ error: "Intern not found" });
    }

    // Get intern's records
    const recordsRaw = await DailyRecord.find({ internId: internId })
      .populate('internId', 'traineeName traineeId email')
      .sort({ createdAt: -1 });

    // Map records to include stack, task, progress, blockers, status
    const records = recordsRaw.map(record => ({
      _id: record._id,
      date: record.date,
      createdAt: record.createdAt,
      stack: record.stack,
      task: record.task,
      progress: record.progress,
      blockers: record.blockers,
      status: record.status
    }));

    // Calculate statistics
    const daysSinceLastSubmission = records.length > 0 ? 
      Math.floor((new Date() - new Date(records[0].createdAt)) / (1000 * 60 * 60 * 24)) : null;

    const weeklyRecords = records.filter(record => {
      const recordDate = new Date(record.createdAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return recordDate >= weekAgo;
    });

    const monthlyRecords = records.filter(record => {
      const recordDate = new Date(record.createdAt);
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      return recordDate >= monthAgo;
    });

    const internDetails = {
      intern,
      records,
      statistics: {
        totalRecords: records.length,
        weeklyRecords: weeklyRecords.length,
        monthlyRecords: monthlyRecords.length,
        daysSinceLastSubmission,
        isOverdue: daysSinceLastSubmission === null || daysSinceLastSubmission >= 3,
        averageSubmissionsPerWeek: monthlyRecords.length / 4
      }
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
      if (q && q.trim() === '*') {
        // Get all interns
        const interns = await Intern.find({});

        // Get all records
        const records = await DailyRecord.find({
          internId: { $in: interns.map(intern => intern._id) }
        }).populate('internId', 'traineeName traineeId email').sort({ createdAt: -1 });

        // Build report for each intern
        const searchResults = interns.map(intern => {
          const internRecords = records.filter(record => 
            record.internId && record.internId._id.toString() === intern._id.toString()
          );

          const lastSubmission = internRecords.length > 0 ? internRecords[0] : null;
          const daysSinceLastSubmission = lastSubmission ? 
            Math.floor((new Date() - new Date(lastSubmission.createdAt)) / (1000 * 60 * 60 * 24)) : null;

          // Check if overdue (no submission in last 3 days)
          const threeDaysAgo = new Date();
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
          const isOverdue = !lastSubmission || new Date(lastSubmission.createdAt) < threeDaysAgo;

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
            recentRecords: internRecords.slice(0, 5).map(record => ({
              _id: record._id,
              date: record.date,
              createdAt: record.createdAt,
              stack: record.stack,
              task: record.task,
              progress: record.progress,
              blockers: record.blockers
            }))
          };
        });

        return res.status(200).json(searchResults);
      }
      
      return res.status(400).json({ error: "Search query must be at least 2 characters" });
    }

    const searchTerm = q.trim();

    // Create case-insensitive search regex
    const searchRegex = new RegExp(searchTerm, 'i');

    // Search interns by name, trainee ID, or email (using correct DB field names)
    const interns = await Intern.find({
      $or: [
        { Trainee_Name: searchRegex },
        { Trainee_ID: searchRegex },
        { Trainee_Email: searchRegex }
      ]
    });

    // Get records for found interns
    const records = await DailyRecord.find({
      internId: { $in: interns.map(intern => intern._id) }
    }).populate('internId').sort({ createdAt: -1 });

    // Build report for each found intern
    const searchResults = interns.map(intern => {
      const internRecords = records.filter(record => 
        record.internId && record.internId._id.toString() === intern._id.toString()
      );

      const lastSubmission = internRecords.length > 0 ? internRecords[0] : null;
      const daysSinceLastSubmission = lastSubmission ? 
        Math.floor((new Date() - new Date(lastSubmission.createdAt)) / (1000 * 60 * 60 * 24)) : null;

      // Check if overdue (no submission in last 3 days)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const isOverdue = !lastSubmission || new Date(lastSubmission.createdAt) < threeDaysAgo;

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
        recentRecords: internRecords.slice(0, 5).map(record => ({
          _id: record._id,
          date: record.date,
          createdAt: record.createdAt,
          stack: record.stack,
          task: record.task,
          progress: record.progress,
          blockers: record.blockers
        }))
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
  const internRecords = records.filter(record => 
    record.internId && record.internId._id.toString() === internId.toString()
  );
  
  return internRecords.length > 0 ? internRecords[0].createdAt : null;
};

// Get all daily records for admin view
const getAllDailyRecords = async (req, res) => {
  try {
    console.log('getAllDailyRecords - User info from token:', req.user);
    
    const userId = req.user.id || req.user._id;

    // Verify admin user - be more flexible with user verification
    let adminUser = null;
    try {
      adminUser = await User.findById(userId);
      console.log('Admin user found:', adminUser ? 'Yes' : 'No');
    } catch (userError) {
      console.log('User verification error (continuing anyway):', userError.message);
    }

    // For now, allow the request to continue even if user verification fails
    // This is to debug the main issue with intern details
    console.log('Fetching all daily records with intern details...');

    // Get all daily records with intern details
    const records = await DailyRecord.find({})
      .populate({
        path: 'internId',
        select: 'Trainee_Name Trainee_ID Trainee_Email field_of_spec_name Institute team',
        model: 'Intern'
      })
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Found ${records.length} daily records from database`);

    // Format records for frontend consumption
    const formattedRecords = records.map(record => {
      console.log('Record internId:', record.internId);
      
      return {
        _id: record._id,
        date: record.date,
        createdAt: record.createdAt,
        taskDescription: record.task || record.tasks || 'No description',
        stack: record.stack || 'No stack specified',
        task: record.task || 'No task specified',
        progress: record.progress || 'No progress specified',
        blockers: record.blockers || 'No blockers specified',
        status: record.status || 'working',
        hoursWorked: record.hoursWorked || 0,
        internId: record.internId?._id || record.internId,
        Trainee_Name: record.internId?.Trainee_Name || 'N/A',
        Trainee_ID: record.internId?.Trainee_ID || 'N/A',
        Trainee_Email: record.internId?.Trainee_Email || 'N/A',
        field_of_spec_name: record.internId?.field_of_spec_name || 'N/A',
        Institute: record.internId?.Institute || 'N/A',
        team: record.internId?.team || 'N/A'
      };
    });

    console.log(`Formatted ${formattedRecords.length} daily records for admin view`);
    console.log('Sample record:', JSON.stringify(formattedRecords[0], null, 2));
    
    res.status(200).json(formattedRecords);

  } catch (error) {
    console.error("Error getting all daily records:", error);
    
    // Try to get basic info for debugging
    try {
      const recordCount = await DailyRecord.countDocuments();
      const internCount = await Intern.countDocuments();
      console.log(`Debug info - Records count: ${recordCount}, Interns count: ${internCount}`);
      
      if (recordCount > 0) {
        const sampleRecord = await DailyRecord.findOne().lean();
        console.log('Sample record without populate:', JSON.stringify(sampleRecord, null, 2));
        
        const populatedRecord = await DailyRecord.findById(sampleRecord._id).populate('internId').lean();
        console.log('Sample record with populate:', JSON.stringify(populatedRecord, null, 2));
      }
    } catch (debugError) {
      console.error('Debug query failed:', debugError);
    }
    
    res.status(500).json({ 
      error: "Failed to get daily records",
      details: error.message 
    });
  }
};

// Debug endpoint to check database data
// Get previous day's submissions for admin export
const getPreviousDaySubmissions = async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify admin user
    const adminUser = await User.findById(userId);
    if (!adminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Calculate previous day's date range
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    // Set time to start and end of previous day
    const startOfYesterday = new Date(yesterday);
    startOfYesterday.setHours(0, 0, 0, 0);
    
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    // Get all daily records from previous day
    const records = await DailyRecord.find({
      createdAt: {
        $gte: startOfYesterday,
        $lte: endOfYesterday
      }
    })
  .populate('internId')
    .sort({ createdAt: -1 });

    // Group by intern to get unique submissions
    const internSubmissions = new Map();
    
    records.forEach(record => {
      if (record.internId) {
        const internId = record.internId._id.toString();
        if (!internSubmissions.has(internId)) {
          internSubmissions.set(internId, {
            _id: record.internId._id,
            traineeId: record.internId.Trainee_ID,
            traineeName: record.internId.Trainee_Name,
            email: record.internId.Trainee_Email,
            fieldOfSpecialization: record.internId.field_of_spec_name,
            lastSubmission: record.createdAt,
            totalRecords: 1,
            isOverdue: false,
            daysSinceLastSubmission: 1
          });
        } else {
          // Update total records count for this intern
          const existing = internSubmissions.get(internId);
          existing.totalRecords += 1;
          if (record.createdAt > existing.lastSubmission) {
            existing.lastSubmission = record.createdAt;
          }
        }
      }
    });

    const submissionsArray = Array.from(internSubmissions.values());

    console.log(`Retrieved ${submissionsArray.length} unique interns who submitted records on previous day`);
    res.status(200).json(submissionsArray);

  } catch (error) {
    console.error("Error getting previous day submissions:", error);
    res.status(500).json({ error: "Failed to get previous day submissions" });
  }
};

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
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) workingDaysInRange++;
      }
    } else {
      // Fallback to legacy logic (weekType)
      const today = new Date();
      if (weekType === 'previous') {
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
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
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
        for (let d = new Date(startDate); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
          const dayOfWeek = d.getDay();
          if (dayOfWeek >= 1 && dayOfWeek <= 5) workingDaysInRange++;
        }
      }
    }

    console.log('Checking weekly submissions from:', weekPeriodLabel);

    // Get all interns
    const allInterns = await Intern.find({});

    // Filter out interns whose training has already ended before the report end date
    const reportEndDate = endDate;
    const toDateString = d => {
      const date = new Date(d);
      return date.toISOString().slice(0, 10); // YYYY-MM-DD
    };
    const reportEndDateStr = toDateString(endDate);
    const reportStartDateStr = toDateString(startDate);
    const activeInterns = allInterns.filter(intern => {
      if (!intern.trainingEndDate) return true;
      const internEndDateStr = toDateString(intern.trainingEndDate);
      // Exclude if intern's end date is <= report end date
      if (internEndDateStr <= reportEndDateStr) {
        console.log(`Excluding intern ${intern.Trainee_ID} (${intern.Trainee_Name}) with end date ${internEndDateStr} <= report end date ${reportEndDateStr}`);
        return false;
      }
      return true;
    });

    console.log(`Total interns: ${allInterns.length}, Active interns (training not ended): ${activeInterns.length}`);

    // Get all daily records for the custom range (single day or range)
    const weeklyRecords = await DailyRecord.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    })
    .populate('internId', 'traineeName traineeId email fieldOfSpecialization')
    .sort({ createdAt: -1 });

    // Create a set of intern IDs who have submitted records in the range
    const submittedInternIds = new Set();
    weeklyRecords.forEach(record => {
      if (record.internId) {
        submittedInternIds.add(record.internId._id.toString());
      }
    });

    // Find active interns who haven't submitted any records in the range
    const nonSubmittedInterns = activeInterns.filter(intern => {
      return !submittedInternIds.has(intern._id.toString());
    });

    // Format response with additional details
    const nonSubmissionsArray = nonSubmittedInterns.map(intern => {
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
        weeklySubmissions: 0,
        workingDaysThisWeek: workingDaysInRange,
        missedDays: workingDaysInRange,
        weekPeriod: weekPeriodLabel,
        lastSubmission: null,
        daysSinceLastSubmission: null,
        status: 'Not Submitted This Week'
      };
    });

    console.log(`Found ${nonSubmissionsArray.length} active interns who haven't submitted records for period: ${weekPeriodLabel}`);
    console.log(`Total working days in period: ${workingDaysInRange}`);
    console.log(`Excluded ${allInterns.length - activeInterns.length} interns whose training has ended`);
    
    res.status(200).json({
      weekPeriod: weekPeriodLabel,
      workingDaysThisWeek: workingDaysInRange,
      totalInterns: activeInterns.length,
      totalInternsInDatabase: allInterns.length,
      excludedInterns: allInterns.length - activeInterns.length,
      nonSubmittedCount: nonSubmissionsArray.length,
      submittedCount: submittedInternIds.size,
      nonSubmittedInterns: nonSubmissionsArray
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

    console.log(`Admin ${adminUser.email} triggered SLT API sync with cleanup: ${enableCleanup}`);

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
        cleanupEnabled: enableCleanup
      }
    });

  } catch (error) {
    console.error("Error during SLT API sync:", error);
    res.status(500).json({ 
      error: "Failed to sync with SLT API",
      details: error.message 
    });
  }
};

module.exports = {
  getDashboardStats,
  getInternReport,
  sendOverdueNotifications,
  getInternDetails,
  searchInterns,
  getAllDailyRecords,
  getPreviousDaySubmissions,
  getWeeklyNonSubmissions,
  syncWithSLTAPI
};
