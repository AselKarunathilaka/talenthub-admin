const DailyRecord = require("../models/DailyRecord");
const Intern = require("../models/Intern");
const { checkLeaveSubmissionAllowed } = require("../utils/timeRestriction");
const { validateEntry } = require("../utils/heuristics");
const { validateWithGemini, validateBatchWithGemini } = require("../utils/llmValidator");

const BATCH_FIELDS = ["tasks", "challenges", "plans"];

function failOpenBatchResult() {
  return {
    tasks: { valid: true, reason: "" },
    challenges: { valid: true, reason: "" },
    plans: { valid: true, reason: "" },
  };
}
// ── Shared helper: resolve internId from request user ────────────────────────
const resolveIntern = async (userId, userEmail) => {
  let intern = await Intern.findById(userId);
  if (!intern) intern = await Intern.findOne({ email: userEmail });
  if (!intern) intern = await Intern.findOne({ userId });
  return intern;
};

// ── POST / ────────────────────────────────────────────────────────────────────
const createDailyRecord = async (req, res) => {
  try {
    const { date, stack, task, progress, blockers, status } = req.body;
    const { id: userId, email: userEmail } = req.user;

    if (status === "leave") {
      const leaveCheck = checkLeaveSubmissionAllowed();
      if (!leaveCheck.allowed) {
        return res.status(403).json({
          error: leaveCheck.message,
          timeRestriction: true,
          currentTime: leaveCheck.currentTime,
        });
      }
    }

    const intern = await resolveIntern(userId, userEmail);
    if (!intern) {
      return res.status(404).json({
        error:
          "Intern record not found. Please contact your administrator to set up your intern profile.",
        details: `No intern found for email: ${userEmail}`,
      });
    }

    const internId = intern._id;

    // Upsert by internId + date
    const existing = await DailyRecord.findOne({ internId, date });

    if (existing) {
      existing.stack = stack;
      existing.task = task;
      existing.progress = progress || "No challenges faced";
      existing.blockers = blockers || "No specific plans";
      if (status) existing.status = status;
      await existing.save();
      await existing.populate(
        "internId",
        "Trainee_Name Trainee_ID Trainee_Email",
      );
      return res.status(200).json(existing);
    }

    const newRecord = new DailyRecord({
      internId,
      date,
      stack,
      task,
      progress: progress || "No challenges faced",
      blockers: blockers || "No specific plans",
      status: status || "working",
    });

    await newRecord.save();

    // Populate the intern details
    await newRecord.populate(
      "internId",
      "Trainee_Name Trainee_ID Trainee_Email",
    );
    return res.status(201).json(newRecord);
  } catch (error) {
    console.error("Error creating daily record:", error);

    if (error.code === 11000) {
      return res
        .status(400)
        .json({ error: "A record for this date already exists" });
    }

    // Check for validation errors (e.g., field too long)
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: Object.values(error.errors).map((e) => e.message),
        message: "Please check that your entries are not too long.",
      });
    }

    // Check for payload too large error
    if (error.type === "entity.too.large") {
      return res.status(413).json({
        error: "Request too large",
        message: "Please reduce the length of your entries.",
      });
    }

    res.status(500).json({
      error: "Failed to create daily record",
      message:
        "Please try submitting with shorter entries. If the problem persists, contact support.",
    });
  }
};

// Get all daily records (for admin) or user's own records
const getDailyRecords = async (req, res) => {
  try {
    const { id: userId, email: userEmail } = req.user;
    const query = {};
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
          details: `No intern found for email: ${userEmail}`,
        });
      }
      query.internId = intern._id;
    }

    const records = await DailyRecord.find(query)
      .populate("internId", "Trainee_Name Trainee_ID Trainee_Email")
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
    const { id: userId } = req.user;

    const record = await DailyRecord.findById(id).populate(
      "internId",
      "traineeName traineeId email",
    );

    if (!record)
      return res.status(404).json({ error: "Daily record not found" });

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
    const { id: userId } = req.user;

    // Check if leave status update is allowed (time restriction check)
    if (status === "leave") {
      const leaveCheck = checkLeaveSubmissionAllowed();
      if (!leaveCheck.allowed) {
        return res.status(403).json({
          error: leaveCheck.message,
          timeRestriction: true,
          currentTime: leaveCheck.currentTime,
        });
      }
    }

    const record = await DailyRecord.findById(id);
    if (!record)
      return res.status(404).json({ error: "Daily record not found" });

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
    await record.populate("internId", "traineeName traineeId email");
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
    const { id: userId } = req.user;

    const record = await DailyRecord.findById(id);
    if (!record)
      return res.status(404).json({ error: "Daily record not found" });

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

// Validate a logbook entry string
const validateLogbookEntry = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text string is required" });
    }

    // First do a fast local heuristics check
    const localCheck = validateEntry(text);
    if (!localCheck.isValid) {
      // It failed basic rules (RED)
      return res.status(200).json({ passes: false, isWorkRelated: null, reason: "Heuristics failed" });
    }

    // Now call Gemini to determine if it's work-related
    const llmCheck = await validateWithGemini(text);

    return res.status(200).json({
      passes: true,
      isWorkRelated: llmCheck.isWorkRelated,
      reason: llmCheck.reason
    });
  } catch (error) {
    console.error("Error validating logbook entry:", error);
    res.status(500).json({ error: "Validation failed" });
  }
};

// Validate all three logbook fields in one Gemini call (submit-time only)
const validateBatchEntries = async (req, res) => {
  try {
    const { tasks, challenges, plans } = req.body;

    if (
      typeof tasks !== "string" ||
      typeof challenges !== "string" ||
      typeof plans !== "string"
    ) {
      return res.status(400).json({
        error: "tasks, challenges, and plans must be strings",
      });
    }

    if (!tasks.trim()) {
      return res.status(400).json({ error: "tasks is required" });
    }

    for (const field of BATCH_FIELDS) {
      const text = req.body[field];
      if (!text || !text.trim()) continue;

      const localCheck = validateEntry(text);
      if (!localCheck.isValid) {
        const reason =
          localCheck.checks.tooShort.reason ||
          localCheck.checks.placeholder.reason ||
          localCheck.checks.repetitive.reason ||
          localCheck.checks.keyboardSmash.reason ||
          "Entry failed basic quality checks.";
        const response = failOpenBatchResult();
        response[field] = { valid: false, reason };
        return res.status(200).json(response);
      }
    }

    const result = await validateBatchWithGemini(tasks, challenges, plans);
    console.log("[BATCH VALIDATE] Gemini result:", JSON.stringify(result));
    return res.status(200).json(result);
  } catch (error) {
    console.error("[BATCH VALIDATE] ❌ Gemini validation failed:", error.message);
    // Do NOT fail-open. Return 503 so the frontend blocks submission.
    return res.status(503).json({
      error: "AI validation is temporarily unavailable. Please try again in a moment.",
      details: error.message,
      stack: error.stack
    });
  }
};

module.exports = {
  createDailyRecord,
  getDailyRecords,
  getDailyRecordById,
  updateDailyRecord,
  deleteDailyRecord,
  validateLogbookEntry,
  validateBatchEntries,
};
