const DailyRecord = require("../models/DailyRecord");
const Intern = require("../models/Intern");
const { encrypt } = require("../utils/dbEncryption");
const { validateEntry } = require("../utils/heuristics");
const {
  checkLeaveSubmissionAllowed,
  getSriLankanDateString,
} = require("../utils/timeRestriction");
const {
  validateWithGemini,
  validateBatchWithGemini,
} = require("../utils/llmValidator");
const {
  addAuditCheckoutTimes,
  buildDailyAttendanceByDate,
  getColomboDateKey,
} = require("../utils/attendanceHistory");
const { recordDailyAttendance } = require("../services/dailyAttendanceLogService");

const BATCH_FIELDS = ["tasks", "challenges", "plans"];

function failOpenBatchResult() {
  return {
    tasks: { valid: true, reason: "" },
    challenges: { valid: true, reason: "" },
    plans: { valid: true, reason: "" },
  };
}

const DAILY_ATTENDANCE_TYPES = new Set([
  "daily",
  "daily_qr",
  "face",
  "manual_daily",
]);

// Checks whether the intern already has a daily attendance entry for this date.
// `dateStr` is expected in "YYYY-MM-DD" form.
function hasDailyAttendanceForDate(intern, dateStr) {
  return (intern.attendance || []).some((a) => {
    if (!DAILY_ATTENDANCE_TYPES.has(String(a.type || "").toLowerCase())) return false;
    const aDateStr = getColomboDateKey(a.date);
    return aDateStr === dateStr;
  });
}

// Marks a "daily" attendance entry for the intern if one doesn't already exist.
async function ensureDailyAttendance(intern, dateStr) {
  if (hasDailyAttendanceForDate(intern, dateStr)) return;

  const now = new Date();
  intern.attendance.push({
    date: new Date(dateStr),
    status: "Present",
    type: "daily",
    timeMarked: now,
    checkOutTime: now,
  });
  await intern.save();

  // ── Write to dedicated daily attendance log collection ─────────────────────
  recordDailyAttendance({
    internId: intern._id,
    traineeId: intern.Trainee_ID || intern.traineeId || "",
    traineeName: intern.Trainee_Name || "",
    date: dateStr,
    attendanceTime: now,
    markType: "daily",
    status: "present",
    isCheckout: true,
    checkOutTime: now,
    sessionId: null,
    source: "logbook",
  });
}

// ── Shared helper: resolve intern record (active or inactive special access) ──
const findInternRecord = async (userId, userEmail) => {
  const mongoose = require("mongoose");
  const Intern = require("../models/Intern");
  const InactiveIntern = require("../models/InactiveIntern");
  const SpecialAccessIntern = require("../models/SpecialAccessIntern");

  let intern = null;

  // 1. Try finding by ObjectId in Intern, then InactiveIntern
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    intern = await Intern.findById(userId);
    if (!intern) {
      intern = await InactiveIntern.findById(userId);
    }
  }

  // 2. Try finding by email in Intern, then InactiveIntern
  if (!intern && userEmail) {
    const cleanEmail = String(userEmail).trim();
    const emailRegex = new RegExp(`^${cleanEmail}$`, "i");
    intern = await Intern.findOne({
      $or: [{ Trainee_Email: emailRegex }, { email: emailRegex }],
    });
    if (!intern) {
      intern = await InactiveIntern.findOne({
        $or: [{ Trainee_Email: emailRegex }, { email: emailRegex }],
      });
    }
  }

  // 3. Try finding by Trainee_ID
  if (!intern && userId) {
    const cleanId = String(userId).trim();
    intern = await Intern.findOne({ Trainee_ID: cleanId });
    if (!intern) {
      intern = await InactiveIntern.findOne({ Trainee_ID: cleanId });
    }
  }

  // 4. Special access check in SpecialAccessIntern
  if (!intern && (userEmail || userId)) {
    const cleanEmail = userEmail ? String(userEmail).trim().toLowerCase() : "";
    const cleanId = userId ? String(userId).trim() : "";

    const specialInterns = await SpecialAccessIntern.find({});
    for (const spec of specialInterns) {
      const specEmail = spec.email ? String(spec.email).trim().toLowerCase() : "";
      const specId = spec.internId ? String(spec.internId).trim() : "";
      const matchEmail = cleanEmail && specEmail === cleanEmail;
      const matchId = cleanId && specId === cleanId;

      if (matchEmail || matchId) {
        intern = await InactiveIntern.findOne({
          $or: [
            ...(specEmail ? [{ Trainee_Email: new RegExp(`^${specEmail}$`, "i") }] : []),
            ...(specId ? [{ Trainee_ID: specId }] : []),
          ],
        });
        if (!intern) {
          intern = await Intern.findOne({
            $or: [
              ...(specEmail ? [{ Trainee_Email: new RegExp(`^${specEmail}$`, "i") }] : []),
              ...(specId ? [{ Trainee_ID: specId }] : []),
            ],
          });
        }
        if (intern) break;
      }
    }
  }

  return intern;
};

const resolveIntern = async (userId, userEmail) => {
  return await findInternRecord(userId, userEmail);
};

// ── POST / ────────────────────────────────────────────────────────────────────
const DAILY_ATTENDANCE_STATUSES = new Set(["working", "wfh"]);

const createDailyRecord = async (req, res) => {
  try {
    const { stack, task, progress, blockers, status } = req.body; // ★ no longer reading `date` from body
    const { id: userId, email: userEmail } = req.user;

    const date = getSriLankanDateString(); // ★ server-authoritative date

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
    const traineeId = intern.Trainee_ID || intern.traineeId || "";

    // ★ Only mark daily attendance for working / wfh submissions
    const effectiveStatus = status || "working";
    if (DAILY_ATTENDANCE_STATUSES.has(effectiveStatus)) {
      await ensureDailyAttendance(intern, date);
    }

    // Find any existing daily attendance in intern.attendance for this date (e.g. face attendance)
    const existingAttendance = (intern.attendance || []).find((a) => {
      return (
        DAILY_ATTENDANCE_TYPES.has(String(a.type || "").toLowerCase()) &&
        getColomboDateKey(a.date) === date
      );
    });

    const now = new Date();
    const existing = await DailyRecord.findOne({ internId, date });
    if (existing) {
      existing.stack = stack;
      existing.task = task;
      existing.progress = progress || "No challenges faced";
      existing.blockers = blockers || "No specific plans";
      existing.traineeId = traineeId || existing.traineeId; // ★ keep in sync
      if (status) existing.status = status;
      if (!existing.attendanceTime) {
        existing.attendanceTime = existingAttendance?.timeMarked || now;
      }
      if (!existing.checkOutTime && existingAttendance?.checkOutTime) {
        existing.checkOutTime = existingAttendance.checkOutTime;
      }
      await existing.save();
      await existing.populate(
        "internId",
        "Trainee_Name Trainee_ID Trainee_Email Institute",
      );
      return res.status(200).json(existing);
    }

    const newRecord = new DailyRecord({
      internId,
      traineeId,
      date,
      stack,
      task,
      progress: progress || "No challenges faced",
      blockers: blockers || "No specific plans",
      status: status || "working",
      attendance: "present",
      attendanceTime: existingAttendance?.timeMarked || now,
      checkOutTime: existingAttendance?.checkOutTime || (existingAttendance ? null : now),
    });

    await newRecord.save();

    await newRecord.populate(
      "internId",
      "Trainee_Name Trainee_ID Trainee_Email Institute",
    );
    
    // Invalidate cache
    dailyRecordsCache.delete(`records_${userId}`);
    
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

// Simple in-memory cache for daily records
const dailyRecordsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const clearDailyRecordsCache = () => {
  dailyRecordsCache.clear();
};

// Get all daily records (for admin) or user's own records
const getDailyRecords = async (req, res) => {
  try {
    const { id: userId, email: userEmail } = req.user;
    
    // Check cache
    const cacheKey = `records_${userId}`;
    const cached = dailyRecordsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.status(200).json(cached.data);
    }

    const query = {};
    const mongoose = require("mongoose");
    const User = require("../models/User");

    // Safe admin check: findById only if userId is a valid ObjectId
    let adminUser = null;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      adminUser = await User.findById(userId);
    }

    let internInfo = null;

    if (!adminUser) {
      // Find intern in active Intern or InactiveIntern (special access)
      const intern = await findInternRecord(userId, userEmail);

      if (!intern) {
        return res.status(404).json({
          error: "Intern record not found. Please contact your administrator.",
          details: `No intern found for id: ${userId}, email: ${userEmail}`,
        });
      }

      internInfo = {
        _id: intern._id,
        Trainee_ID: intern.Trainee_ID || intern.traineeId || "",
        traineeId: intern.Trainee_ID || intern.traineeId || "",
        Trainee_Name: intern.Trainee_Name || intern.traineeName || "Intern",
        traineeName: intern.Trainee_Name || intern.traineeName || "Intern",
        Trainee_Email: intern.Trainee_Email || intern.email || userEmail || "",
        email: intern.Trainee_Email || intern.email || userEmail || "",
        Institute: intern.Institute || "NSBM Green University",
      };

      const orClauses = [{ internId: intern._id }];
      if (intern.Trainee_ID) {
        orClauses.push({ traineeId: String(intern.Trainee_ID).trim() });
      }
      if (intern.traineeId) {
        orClauses.push({ traineeId: String(intern.traineeId).trim() });
      }
      query.$or = orClauses;
    }

    let rawRecords = await DailyRecord.find(query)
      .populate("internId", "Trainee_Name Trainee_ID Trainee_Email Institute")
      .sort({ createdAt: -1 });

    // Auto-clean any orphaned study_leave records that lack an active Approved LeaveRequest
    const studyLeaveRecords = rawRecords.filter((r) => r.status === "study_leave");
    if (studyLeaveRecords.length > 0) {
      try {
        const LeaveRequest = require("../models/LeaveRequest");
        const targetInternId = internInfo ? internInfo._id : null;
        const approvedLeaves = await LeaveRequest.find({
          ...(targetInternId ? { intern: targetInternId } : {}),
          requestType: "study_leave",
          status: "Approved",
        }).lean();

        const validKeys = new Set();
        for (const leave of approvedLeaves) {
          const start = new Date(leave.leaveDate);
          const end = new Date(leave.studyEndDate || leave.leaveDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          const cur = new Date(start);
          const lInternId = (leave.intern?._id || leave.intern).toString();
          while (cur <= end) {
            validKeys.add(`${lInternId}_${cur.toISOString().split("T")[0]}`);
            cur.setDate(cur.getDate() + 1);
          }
        }

        const orphanedIds = [];
        for (const rec of studyLeaveRecords) {
          const recInternId = (rec.internId?._id || rec.internId || internInfo?._id || "").toString();
          const key = `${recInternId}_${rec.date}`;
          if (!validKeys.has(key)) {
            orphanedIds.push(rec._id);
          }
        }

        if (orphanedIds.length > 0) {
          await DailyRecord.deleteMany({ _id: { $in: orphanedIds } });
          console.log(`[DailyRecord] Auto-purged ${orphanedIds.length} orphaned study_leave DailyRecord(s)`);
          const orphanedSet = new Set(orphanedIds.map((id) => id.toString()));
          rawRecords = rawRecords.filter((r) => !orphanedSet.has(r._id.toString()));
        }
      } catch (cleanErr) {
        console.error("Error auto-cleaning orphaned study_leave records:", cleanErr);
      }
    }

    // Format records and ensure internId is populated even for inactive/special access interns
    let records;
    if (!adminUser && internInfo) {
      records = rawRecords.map((record) => {
        const obj = record.toObject();
        if (!obj.internId || typeof obj.internId !== "object" || !obj.internId.Trainee_Name) {
          obj.internId = internInfo;
        }
        if (!obj.Trainee_ID) {
          obj.Trainee_ID = internInfo.Trainee_ID;
        }
        if (!obj.traineeId) {
          obj.traineeId = internInfo.traineeId;
        }
        return obj;
      });
    } else {
      // For admin view, populate any missing internId from InactiveIntern if needed
      const missingTraineeIds = new Set();
      rawRecords.forEach((r) => {
        if (!r.internId && r.traineeId) {
          missingTraineeIds.add(r.traineeId);
        }
      });

      if (missingTraineeIds.size > 0) {
        const InactiveIntern = require("../models/InactiveIntern");
        const inactives = await InactiveIntern.find({
          Trainee_ID: { $in: Array.from(missingTraineeIds) },
        }).lean();
        const inactMap = new Map(inactives.map((i) => [i.Trainee_ID, i]));

        records = rawRecords.map((record) => {
          const obj = record.toObject();
          if (!obj.internId && obj.traineeId && inactMap.has(obj.traineeId)) {
            const inact = inactMap.get(obj.traineeId);
            obj.internId = {
              _id: inact._id,
              Trainee_ID: inact.Trainee_ID,
              traineeId: inact.Trainee_ID,
              Trainee_Name: inact.Trainee_Name,
              traineeName: inact.Trainee_Name,
              Trainee_Email: inact.Trainee_Email,
              email: inact.Trainee_Email,
              Institute: inact.Institute || "NSBM Green University",
            };
          }
          return obj;
        });
      } else {
        records = rawRecords;
      }
    }

    // Update cache
    dailyRecordsCache.set(cacheKey, { data: records, timestamp: Date.now() });

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
      return res.status(200).json({
        passes: false,
        isWorkRelated: null,
        reason: "Heuristics failed",
      });
    }

    // Now call Gemini to determine if it's work-related
    const llmCheck = await validateWithGemini(text);

    return res.status(200).json({
      passes: true,
      isWorkRelated: llmCheck.isWorkRelated,
      reason: llmCheck.reason,
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
    console.error(
      "[BATCH VALIDATE] ❌ Gemini validation failed:",
      error.message,
    );
    // TEMPORARY FIX: Fail-open so interns can submit their logbooks even if the AI is down on the live server
    return res.status(200).json({
      tasks: { valid: true, reason: "" },
      challenges: { valid: true, reason: "" },
      plans: { valid: true, reason: "" },
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
  findInternRecord,
  clearDailyRecordsCache,
};
