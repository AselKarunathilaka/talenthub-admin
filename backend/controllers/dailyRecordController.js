const DailyRecord = require("../models/DailyRecord");
const Intern = require("../models/Intern");
const { checkLeaveSubmissionAllowed } = require("../utils/timeRestriction");

// Create a new daily record
const createDailyRecord = async (req, res) => {
  try {
  const { date, stack, task, progress, blockers, status } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;



    // Check if leave submission is allowed (time restriction check)
    if (status === 'leave') {
      const leaveCheck = checkLeaveSubmissionAllowed();
      if (!leaveCheck.allowed) {
        return res.status(403).json({ 
          error: leaveCheck.message,
          timeRestriction: true,
          currentTime: leaveCheck.currentTime
        });
      }
    }

    // The user ID could be either a User (admin) or Intern ID directly
    // For daily records, we need to find the intern
    let internId;
    
    // First, try to find intern by ID directly (for Google login case)
    let intern = await Intern.findById(userId);
    
    if (!intern) {
      // If not found by ID, try to find by email (for cases where user logged in with email)
      intern = await Intern.findOne({ email: userEmail });
    }
    
    if (!intern) {
      // If still not found, try to find intern by userId (for admin login case - though admins shouldn't create records)
      intern = await Intern.findOne({ userId: userId });
    }
    
    if (!intern) {
      return res.status(404).json({ 
        error: "Intern record not found. Please contact your administrator to set up your intern profile.",
        details: `No intern found for email: ${userEmail}`
      });
    }

    internId = intern._id;

    // Check if a record already exists for this date
    const existingRecord = await DailyRecord.findOne({ 
      internId: internId, 
      date: date 
    });

    if (existingRecord) {
      // Update existing record
      existingRecord.stack = stack;
      existingRecord.task = task;
      existingRecord.progress = progress || "No challenges faced";
      existingRecord.blockers = blockers || "No specific plans";
      if (status) existingRecord.status = status;

      await existingRecord.save();

      // Populate the intern details
  await existingRecord.populate('internId', 'Trainee_Name Trainee_ID Trainee_Email');

      return res.status(200).json(existingRecord);
    } else {
      // Create new record
      const newRecord = new DailyRecord({
        internId: internId,
        date,
        stack,
        task,
        progress: progress || "No challenges faced",
        blockers: blockers || "No specific plans",
        status: status || "working"
      });

      await newRecord.save();

      // Populate the intern details
  await newRecord.populate('internId', 'Trainee_Name Trainee_ID Trainee_Email');

      return res.status(201).json(newRecord);
    }
  } catch (error) {
    console.error("Error creating daily record:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({ error: "A record for this date already exists" });
    }
    
    // Check for validation errors (e.g., field too long)
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationErrors,
        message: "Please check that your entries are not too long. Each field has a maximum character limit."
      });
    }
    
    // Check for payload too large error
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ 
        error: "Request too large", 
        message: "Your submission contains too much data. Please reduce the length of your entries."
      });
    }
    
    res.status(500).json({ 
      error: "Failed to create daily record",
      message: "Please try submitting with shorter entries. If the problem persists, contact support."
    });
  }
};

// Get all daily records (for admin) or user's own records
const getDailyRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    let query = {};
    
    // Check if this is an admin or intern request
    // If the user ID corresponds to a User (admin), show all records
    // If the user ID corresponds to an Intern, show only their records
    
    // First check if this is an admin user
    const adminUser = await require("../models/User").findById(userId);
    
    if (!adminUser) {
      // This is likely an intern login, filter by their records
      
      // Try to find intern by ID first (Google login case)
      let intern = await Intern.findById(userId);
      
      if (!intern) {
        // Try to find by email (backup case)
        intern = await Intern.findOne({ email: userEmail });
      }
      
      if (!intern) {
        return res.status(404).json({ 
          error: "Intern record not found. Please contact your administrator.",
          details: `No intern found for email: ${userEmail}`
        });
      }
      
      query.internId = intern._id;
    } else {
      // Admin can see all records - no filter needed
    }

    const records = await DailyRecord.find(query)
      .populate('internId', 'traineeName traineeId email')
      .sort({ createdAt: -1 });

    res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching daily records:", error);
    res.status(500).json({ error: "Failed to fetch daily records" });
  }
};

// Get a specific daily record by ID
const getDailyRecordById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const record = await DailyRecord.findById(id).populate('internId', 'traineeName traineeId email');
    
    if (!record) {
      return res.status(404).json({ error: "Daily record not found" });
    }

    // Check if user has permission to view this record
    const adminUser = await require("../models/User").findById(userId);
    
    if (!adminUser) {
      // This is an intern user, check if they own this record
      const intern = await Intern.findById(userId);
      if (!intern || !record.internId._id.equals(intern._id)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    // Admin users can view any record

    res.status(200).json(record);
  } catch (error) {
    console.error("Error fetching daily record:", error);
    res.status(500).json({ error: "Failed to fetch daily record" });
  }
};

// Update a daily record
const updateDailyRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { task, progress, blockers, status } = req.body;
    const userId = req.user.id;

    // Check if leave status update is allowed (time restriction check)
    if (status === 'leave') {
      const leaveCheck = checkLeaveSubmissionAllowed();
      if (!leaveCheck.allowed) {
        return res.status(403).json({ 
          error: leaveCheck.message,
          timeRestriction: true,
          currentTime: leaveCheck.currentTime
        });
      }
    }

    const record = await DailyRecord.findById(id);
    
    if (!record) {
      return res.status(404).json({ error: "Daily record not found" });
    }

    // Check if user has permission to update this record
    const adminUser = await require("../models/User").findById(userId);
    
    if (!adminUser) {
      // This is an intern user, check if they own this record
      const intern = await Intern.findById(userId);
      if (!intern || !record.internId.equals(intern._id)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    // Admin users can update any record

    // Update the record
    if (task !== undefined) record.task = task;
    if (progress !== undefined) record.progress = progress;
    if (blockers !== undefined) record.blockers = blockers;
    if (status !== undefined) record.status = status;

    await record.save();
    await record.populate('internId', 'traineeName traineeId email');

    res.status(200).json(record);
  } catch (error) {
    console.error("Error updating daily record:", error);
    res.status(500).json({ error: "Failed to update daily record" });
  }
};

// Delete a daily record
const deleteDailyRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const record = await DailyRecord.findById(id);
    
    if (!record) {
      return res.status(404).json({ error: "Daily record not found" });
    }

    // Check if user has permission to delete this record
    const adminUser = await require("../models/User").findById(userId);
    
    if (!adminUser) {
      // This is an intern user, check if they own this record
      const intern = await Intern.findById(userId);
      if (!intern || !record.internId.equals(intern._id)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    // Admin users can delete any record

    await DailyRecord.findByIdAndDelete(id);
    res.status(200).json({ message: "Daily record deleted successfully" });
  } catch (error) {
    console.error("Error deleting daily record:", error);
    res.status(500).json({ error: "Failed to delete daily record" });
  }
};

module.exports = {
  createDailyRecord,
  getDailyRecords,
  getDailyRecordById,
  updateDailyRecord,
  deleteDailyRecord
};
