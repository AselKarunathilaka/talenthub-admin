const DailyRecord = require("../models/DailyRecord");
const Intern = require("../models/Intern");
const User = require("../models/User");
const emailSender = require("../utils/emailSender");

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
      overdueList: overdueInterns.map(intern => ({
        _id: intern._id,
        traineeName: intern.traineeName,
        traineeId: intern.traineeId,
        email: intern.email,
        lastSubmission: getLastSubmissionDate(intern._id, records)
      }))
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
        traineeId: intern.traineeId,
        traineeName: intern.traineeName,
        email: intern.email,
        fieldOfSpecialization: intern.fieldOfSpecialization,
        team: intern.team || 'Unassigned',
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

    // Map records to include stack, task, progress, blockers
    const records = recordsRaw.map(record => ({
      _id: record._id,
      date: record.date,
      createdAt: record.createdAt,
      stack: record.stack,
      task: record.task,
      progress: record.progress,
      blockers: record.blockers
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

    console.log('Search interns called by user:', userId, 'query:', q);

    // Verify admin user
    const adminUser = await User.findById(userId);
    if (!adminUser) {
      console.log('Admin verification failed for user:', userId);
      return res.status(403).json({ error: "Admin access required" });
    }

    console.log('Admin user verified:', adminUser.email);

    if (!q || q.trim().length < 2) {
      console.log('Search query too short or empty:', q);
      return res.status(400).json({ error: "Search query must be at least 2 characters" });
    }

    const searchTerm = q.trim();
    console.log('Searching for:', searchTerm);

    // Create case-insensitive search regex
    const searchRegex = new RegExp(searchTerm, 'i');

    // Search interns by name, trainee ID, or email
    const interns = await Intern.find({
      $or: [
        { traineeName: searchRegex },
        { traineeId: searchRegex },
        { email: searchRegex }
      ]
    });

    console.log(`Found ${interns.length} interns matching search term`);

    // Get records for found interns
    const records = await DailyRecord.find({
      internId: { $in: interns.map(intern => intern._id) }
    }).populate('internId', 'traineeName traineeId email').sort({ createdAt: -1 });

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
        traineeId: intern.traineeId,
        traineeName: intern.traineeName,
        email: intern.email,
        fieldOfSpecialization: intern.fieldOfSpecialization,
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

    console.log('Search results prepared:', searchResults.length, 'results');
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
    const userId = req.user.id;

    // Verify admin user
    const adminUser = await User.findById(userId);
    if (!adminUser) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Get all daily records with intern details
    const records = await DailyRecord.find({})
      .populate('internId', 'traineeName traineeId email fieldOfSpecialization')
      .sort({ createdAt: -1 });

    // Format records for frontend consumption
    const formattedRecords = records.map(record => ({
      _id: record._id,
      date: record.date,
      createdAt: record.createdAt,
      taskDescription: record.tasks ? 
        (Array.isArray(record.tasks) ? record.tasks.join(', ') : record.tasks) : 
        'No description',
      hoursWorked: record.hoursWorked || 0,
      internId: record.internId?._id,
      traineeName: record.internId?.traineeName || 'Unknown',
      traineeId: record.internId?.traineeId || 'Unknown',
      email: record.internId?.email || 'Unknown',
      fieldOfSpecialization: record.internId?.fieldOfSpecialization
    }));

    console.log(`Retrieved ${formattedRecords.length} daily records for admin view`);
    res.status(200).json(formattedRecords);

  } catch (error) {
    console.error("Error getting all daily records:", error);
    res.status(500).json({ error: "Failed to get daily records" });
  }
};

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
    .populate('internId', 'traineeName traineeId email fieldOfSpecialization')
    .sort({ createdAt: -1 });

    // Group by intern to get unique submissions
    const internSubmissions = new Map();
    
    records.forEach(record => {
      if (record.internId) {
        const internId = record.internId._id.toString();
        if (!internSubmissions.has(internId)) {
          internSubmissions.set(internId, {
            _id: record.internId._id,
            traineeName: record.internId.traineeName,
            traineeId: record.internId.traineeId,
            email: record.internId.email,
            fieldOfSpecialization: record.internId.fieldOfSpecialization,
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

module.exports = {
  getDashboardStats,
  getInternReport,
  sendOverdueNotifications,
  getInternDetails,
  searchInterns,
  getAllDailyRecords,
  getPreviousDaySubmissions
};
