const InternService = require("../services/internService");
const attendanceService = require("../services/attendanceService");
const { parseXLSX, addInternsFromXLSX } = require("../utils/xlsxHandler");
const sendEmail = require("../utils/emailSender");
const SLTApiScheduler = require("../services/sltApiScheduler");
const DailyRecord = require("../models/DailyRecord");
const FaceAttendanceLog = require("../models/FaceAttendanceLog");
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const TalentTrailService = require("../services/talentTrailService");
const ProfilePicture = require("../models/ProfilePicture");
const {
  addAuditCheckoutTimes,
  buildDailyAttendanceByDate,
  getColomboDateKey,
} = require("../utils/attendanceHistory");

// Doc 3 sets (more complete — includes manual_daily and manual_meeting)
const DAILY_ATTENDANCE_TYPES = new Set([
  "daily",
  "daily_qr",
  "face",
  "manual_daily",
  "manual",  // matches AdminAnalytics
  "qr",      // matches AdminAnalytics
]);

const MEETING_ATTENDANCE_TYPES = new Set([
  "qr",
  "face_meeting",
  "meeting",
  "manual_meeting",
  "manual",
]);

const getDateKey = (date) => {
  return getColomboDateKey(date);
};

const getMeetingKey = (date, meetingName) =>
  `${getDateKey(date)}::${String(meetingName || "General Meeting")
    .trim()
    .toLowerCase()}`;

// Doc 3 normalizeAttendanceMethod (more complete — covers manual_meeting, manual_daily, face recognition)
const normalizeAttendanceMethod = (type) => {
  const normalizedType = String(type || "").toLowerCase();

  // Face recognition attendance
  if (normalizedType === "face" || normalizedType === "face_meeting") {
    return "face recognition";
  }

  // QR attendance
  if (normalizedType === "qr" || normalizedType === "daily_qr") {
    return "qr";
  }

  // Manual attendance
  if (
    normalizedType === "meeting" ||
    normalizedType === "manual_meeting" ||
    normalizedType === "manual" ||
    normalizedType === "manual_daily"
  ) {
    return "manual";
  }

  return normalizedType || "unknown";
};

const formatColomboTime = (date) =>
  new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Colombo",
  });

const addIntern = async (req, res) => {
  try {
    const { Trainee_HomeAddress } = req.body;

    let location, district;

    if (Trainee_HomeAddress) {
      const geo = await geocodeAddress(Trainee_HomeAddress);
      if (geo) {
        location = geo.location;
        district = geo.district;
      }
    }

    const newIntern = await InternService.addIntern({
      ...req.body,
      location,
      district,
    });
    res
      .status(201)
      .json({ message: "Intern added successfully!", intern: newIntern });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const addExternalIntern = async (req, res) => {
  try {
    const newInternData = req.body;
    let location = undefined;
    let district = "";

    if (newInternData.Trainee_HomeAddress) {
      const geo = await geocodeAddress(newInternData.Trainee_HomeAddress);

      if (geo) {
        location = {
          type: "Point",
          coordinates: [geo.longitude, geo.latitude],
        };
        district = geo.district;
      }
    }
    console.log("Received intern data from external system:", newInternData);

    const newIntern = await InternService.addIntern({
      ...newInternData,
      location,
      district,
    });

    res
      .status(201)
      .json({ message: "Intern added successfully!", intern: newIntern });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding intern", error: error.message });
  }
};

const getAllInterns = async (req, res) => {
  const { date } = req.query; // If date is missing, it will be undefined
  try {
    const interns = await InternService.getAllInterns(date);
    res.status(200).json(interns);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching interns", error: error.message });
  }
};

const getInternById = async (req, res) => {
  try {
    const intern = await InternService.getInternById(req.params.id);
    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }

    const mongoose = require("mongoose");
    const internId = req.params.id;
    const recordQuery = {
      $or: [
        { internId: intern._id },
        ...(intern.Trainee_ID ? [{ traineeId: intern.Trainee_ID }] : []),
        ...(mongoose.Types.ObjectId.isValid(internId) ? [{ internId }] : []),
      ],
    };
    const DailyRecord = require("../models/DailyRecord");
    const records = await DailyRecord.find(recordQuery)
      .populate("internId", "Trainee_Name Trainee_ID Trainee_Email")
      .sort({ date: -1 });

    const internObj = intern.toObject ? intern.toObject() : { ...intern };
    internObj.records = records;

    res.status(200).json(internObj);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching intern", error: error.message });
  }
};

const getInternByIdEach = async (req, res) => {
  try {
    const intern = await InternService.getInternById(req.params.id);
    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }

    // Evaluate TalentHub project restriction in real-time
    const talentHubRestrictionService = require("../services/talentHubRestrictionService");
    const access = await talentHubRestrictionService.evaluateInternAccess(intern);

    const internObj = intern.toObject ? intern.toObject() : { ...intern };
    internObj.talentHubRestricted = access.restricted;
    internObj.talentHubRestrictionReason = access.reason;
    internObj.talentHubOverride = access.isOverride;
    internObj.talentHubOverrideExpiresAt = access.overrideExpiresAt || intern.talentHubOverrideExpiresAt || null;
    internObj.daysRemaining = access.daysRemaining || null;
    internObj.enrolledProjects = access.projects || [];
    internObj.enrolledProjectCount = access.projectCount || 0;

    res.status(200).json(internObj);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching intern", error: error.message });
  }
};

const getAttendanceStats = async (req, res) => {
  try {
    const stats = await InternService.getAttendanceStats();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: "Error fetching attendance stats" });
  }
};

const markAttendance = async (req, res) => {
  const { internId, status, date } = req.body;
  try {
    const updatedIntern = await attendanceService.markAttendanceAndNotify(
      internId,
      status,
      date,
    );
    res.status(200).json({
      message: "Attendance marked successfully",
      intern: updatedIntern,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error marking attendance", error: error.message });
  }
};

const updateAttendance = async (req, res) => {
  try {
    const { date, status } = req.body;
    const updatedIntern = await InternService.updateAttendance(
      req.params.id,
      date,
      status,
    );
    res.status(200).json({
      message: "Attendance updated successfully",
      intern: updatedIntern,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating attendance", error: error.message });
  }
};

const assignToTeam = async (req, res) => {
  try {
    await InternService.assignToTeam(req.body.internIds, req.body.teamName);
    res
      .status(200)
      .json({ message: "Interns successfully assigned to the team" });
  } catch (error) {
    res.status(500).json({
      message: "Error assigning interns to team",
      error: error.message,
    });
  }
};

const removeFromTeam = async (req, res) => {
  try {
    const { internId } = req.body;
    const { teamName } = req.params;

    if (!internId || !teamName) {
      return res
        .status(400)
        .json({ message: "Intern ID and Team Name are required." });
    }

    const decodedTeamName = decodeURIComponent(teamName);
    const result = await InternService.removeFromTeam(
      internId,
      decodedTeamName,
    );
    if (result) {
      return res.status(200).json({ message: "Intern removed from the team." });
    } else {
      return res.status(404).json({ message: "Intern not found." });
    }
  } catch (error) {
    console.error("Error removing intern:", error);
    res.status(500).json({ message: "Error removing intern from the team" });
  }
};

const removeIntern = async (req, res) => {
  try {
    const deletedIntern = await InternService.removeIntern(req.params.id);
    if (!deletedIntern) {
      return res.status(404).json({ message: "Intern not found" });
    }
    res.status(200).json({ message: "Intern removed successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error removing intern", error: error.message });
  }
};

const updateIntern = async (req, res) => {
  try {
    const updatedIntern = await InternService.updateIntern(
      req.params.id,
      req.body,
    );
    if (!updatedIntern) {
      return res.status(404).json({ message: "Intern not found" });
    }
    res
      .status(200)
      .json({ message: "Intern updated successfully", intern: updatedIntern });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating intern", error: error.message });
  }
};

const uploadInterns = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log("📂 File received:", req.file.path);
    const interns = parseXLSX(req.file.path);
    console.log("✅ Parsed Interns:", interns);

    const { addedCount, skippedCount } = await addInternsFromXLSX(interns);

    res.status(201).json({
      message: `Upload Complete: ${addedCount} new interns added, ${skippedCount} duplicates skipped.`,
      addedCount,
      skippedCount,
    });
  } catch (error) {
    console.error("❌ Error uploading file:", error);
    res
      .status(500)
      .json({ message: "Error processing file", error: error.message });
  }
};

const getAllTeams = async (req, res) => {
  try {
    const teams = await InternService.getAllTeams();
    res.status(200).json(teams);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching teams", error: error.message });
  }
};

const updateTeamName = async (req, res) => {
  try {
    const { oldTeamName } = req.params;
    const { newTeamName } = req.body;

    if (!newTeamName) {
      return res.status(400).json({ message: "New team name is required" });
    }

    const decodedOldTeamName = decodeURIComponent(oldTeamName);
    const result = await InternService.updateTeamName(
      decodedOldTeamName,
      newTeamName,
    );
    res.status(200).json(result);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating team", error: error.message });
  }
};

const assignSingleToTeam = async (req, res) => {
  try {
    const { internId } = req.body;
    const { teamName } = req.params;

    if (!internId || !teamName) {
      return res
        .status(400)
        .json({ message: "Intern ID and Team Name are required." });
    }

    const decodedTeamName = decodeURIComponent(teamName);
    const result = await InternService.assignSingleToTeam(
      internId,
      decodedTeamName,
    );
    if (result) {
      return res.status(200).json({ message: "Intern added to the team!" });
    } else {
      return res.status(404).json({ message: "Intern not found." });
    }
  } catch (error) {
    console.error("Error adding intern:", error);
    res.status(500).json({ message: "Error adding intern to the team" });
  }
};

const deleteTeam = async (req, res) => {
  try {
    const teamName = decodeURIComponent(req.params.teamName);
    const result = await InternService.deleteTeam(teamName);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      message: "Error deleting team",
      error: error.message,
    });
  }
};

const getAttendanceStatsForToday = async (req, res) => {
  try {
    const stats = await InternService.getAttendanceStatsForToday();
    res.status(200).json(stats); // Returns { present: 10, absent: 5 }
  } catch (error) {
    console.error("Error fetching today's attendance stats:", error);
    res
      .status(500)
      .json({ message: "Error fetching today's attendance stats." });
  }
};

const updateAttendanceForSpecificDate = async (req, res) => {
  const { id } = req.params;
  const { date, status } = req.body; // Date and status (Present/Absent)

  try {
    const updatedIntern = await InternService.updateAttendanceForSpecificDate(
      id,
      date,
      status,
    );
    res.status(200).json(updatedIntern);
  } catch (error) {
    res.status(500).json({
      message: "Error updating attendance for the selected date",
      error: error.message,
    });
  }
};

const getWeeklyAttendanceStats = async (req, res) => {
  try {
    const { attendedInterns, notAttendedInterns } =
      await InternService.getWeeklyAttendanceStats();
    res.status(200).json({
      attendedInterns,
      notAttendedInterns,
    });
  } catch (error) {
    console.error("Error fetching weekly attendance stats:", error.message);
    res.status(500).json({ message: "Error fetching weekly attendance stats" });
  }
};

const { getAdminInternAttendance } = require("./adminInternDetailsController");

const getAttendanceByInternId = async (req, res) => {
  req.params.internId = req.params.internId || req.params.id;
  return getAdminInternAttendance(req, res);
};

const addAvailableDay = async (req, res) => {
  const { id } = req.params;
  const { day } = req.body;

  if (!day) {
    return res.status(400).json({ message: "Day is required" });
  }

  try {
    const intern = await InternService.addAvailableDay(id, day);
    res.status(200).json({
      message: "Day added successfully",
      availableDays: intern.availableDays,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const removeAvailableDay = async (req, res) => {
  const { id } = req.params;
  const { day } = req.body;

  if (!day) {
    return res.status(400).json({ message: "Day is required" });
  }

  try {
    const intern = await InternService.removeAvailableDay(id, day);
    res.status(200).json({
      message: "Day removed successfully",
      availableDays: intern.availableDays,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const uploadTXT = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    let fileContent = fs
      .readFileSync(req.file.path, "utf8")
      .replace(/\uFEFF/g, "") // remove BOM
      .replace(/\r\n/g, "\n"); // unify Windows ↔ Unix

    const rows = fileContent
      .split("\n")
      .slice(1)
      .filter((line) => line.trim().length > 0);

    const updates = rows.map((row) => {
      const [rawId, rawEmail] = row.split("\t");
      const Trainee_ID = rawId.trim();
      const Trainee_Email = rawEmail.trim().replace(/^['"]+|['"]+$/g, ""); // strip surrounding quotes if any

      return { Trainee_ID, Trainee_Email };
    });

    for (const { Trainee_ID, Trainee_Email } of updates) {
      try {
        const intern = await InternService.updateInternEmail(
          Trainee_ID,
          Trainee_Email,
        );
        if (intern) {
          console.log(`✅ ${Trainee_ID} → ${Trainee_Email}`);
        } else {
          console.log(`⚠️  ${Trainee_ID} not found, skipping.`);
        }
      } catch (err) {
        console.error(`❌ Error for ${Trainee_ID}: ${err.message}`);
      }
    }

    res.status(200).json({ message: "Intern emails updated successfully!" });
  } catch (error) {
    console.error("❌ Error uploading file:", error);
    res
      .status(500)
      .json({ message: "Error processing file", error: error.message });
  }
};

// ==================== SLT API INTEGRATION CONTROLLERS ====================

const syncWithSLTAPI = async (req, res) => {
  try {
    console.log("🔄 SLT API sync requested via controller...");
    const result = await InternService.syncWithSLTAPI();

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        stats: result.stats,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        stats: result.stats,
      });
    }
  } catch (error) {
    console.error("❌ Controller error during SLT sync:", error);
    res.status(500).json({
      success: false,
      message: `Internal server error: ${error.message}`,
      stats: {
        added: 0,
        updated: 0,
        skipped: 0,
        errors: 1,
        totalProcessed: 0,
      },
    });
  }
};

const testSLTAPI = async (req, res) => {
  try {
    const result = await InternService.testSLTAPI();

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        count: result.count,
        sample: result.sample,
        total: result.total,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        count: result.count,
        sample: result.sample,
        total: result.total,
      });
    }
  } catch (error) {
    console.error("❌ Controller error during SLT API test:", error);
    res.status(500).json({
      success: false,
      message: `Internal server error: ${error.message}`,
      count: 0,
      sample: [],
      total: 0,
    });
  }
};

const getActiveTraineesFromSLT = async (req, res) => {
  try {
    const result = await InternService.getActiveTraineesFromSLT();

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        count: result.count,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        data: [],
        count: 0,
      });
    }
  } catch (error) {
    console.error("❌ Controller error fetching SLT trainees:", error);
    res.status(500).json({
      success: false,
      message: `Internal server error: ${error.message}`,
      data: [],
      count: 0,
    });
  }
};

const cleanupInactiveInterns = async (req, res) => {
  try {
    console.log("🧹 Cleanup of inactive interns requested via controller...");
    const result = await InternService.cleanupInactiveInterns();

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        stats: result.stats,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        stats: result.stats,
      });
    }
  } catch (error) {
    console.error("❌ Controller error during inactive intern cleanup:", error);
    res.status(500).json({
      success: false,
      message: `Internal server error: ${error.message}`,
      stats: {
        totalInDb: 0,
        activeInApi: 0,
        removed: 0,
        errors: 1,
      },
    });
  }
};

// ==================== SLT API SCHEDULER CONTROLLERS ====================

const triggerManualSLTSync = async (req, res) => {
  try {
    console.log("🔧 Manual SLT API sync requested via controller...");
    const result = await SLTApiScheduler.triggerManualSync();

    if (result.success) {
      res.status(200).json({
        success: true,
        message: "Manual sync completed successfully",
        timestamp: result.timestamp,
        type: result.type,
        results: result.results,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Manual sync failed",
        timestamp: result.timestamp,
        type: result.type,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("❌ Controller error during manual SLT sync:", error);
    res.status(500).json({
      success: false,
      message: `Internal server error: ${error.message}`,
      timestamp: new Date(),
      type: "manual_sync",
      error: error.message,
    });
  }
};

const triggerComprehensiveUpdate = async (req, res) => {
  try {
    console.log("🔧 Comprehensive update requested via controller...");
    const result = await SLTApiScheduler.triggerManualUpdate();

    if (result.success) {
      res.status(200).json({
        success: true,
        message: "Comprehensive update completed successfully",
        timestamp: result.timestamp,
        type: result.type,
        results: result.results,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Comprehensive update failed",
        timestamp: result.timestamp,
        type: result.type,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("❌ Controller error during comprehensive update:", error);
    res.status(500).json({
      success: false,
      message: `Internal server error: ${error.message}`,
      timestamp: new Date(),
      type: "comprehensive_update",
      error: error.message,
    });
  }
};

const acceptAgreement = async (req, res) => {
  try {
    const internId = req.params.id;
    const { digitalAgreement } = req.body;
    const updatedIntern = await InternService.acceptAgreement(internId, digitalAgreement);
    res.status(200).json({
      message: "Agreement accepted successfully",
      agreementAccepted: updatedIntern.agreementAccepted,
      agreementAcceptedDate: updatedIntern.agreementAcceptedDate,
      digitalAgreement: updatedIntern.digitalAgreement,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error accepting agreement", error: error.message });
  }
};

const checkInternProjects = async (req, res) => {
  try {
    const internId = req.params.id;
    const intern = await InternService.getInternById(internId);

    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }

    // Look up the locally-synced TalentTrail record by email
    const InternTalentTrailSync = require("../models/InternTalentTrailSync");
    const syncRecord = await InternTalentTrailSync.findOne({
      email: { $regex: new RegExp(`^${intern.Trainee_Email}$`, "i") },
    }).select("projects lastSyncedAt");

    if (!syncRecord) {
      // No TalentTrail record yet — intern hasn't been synced
      return res.status(200).json({ projects: null, projectCount: 0 });
    }

    // Check the projects array directly
    const projects = Array.isArray(syncRecord.projects)
      ? syncRecord.projects
      : [];
    return res.status(200).json({
      projects: projects.length > 0 ? projects : null,
      projectCount: projects.length,
    });
  } catch (error) {
    console.error("Error checking intern projects:", error);
    res.status(500).json({
      message: "Error checking intern projects",
      error: error.message,
    });
  }
};

// =========================== PROFILE PICTURE MANAGEMENT ===========================

// Upload or update profile picture
const uploadProfilePicture = async (req, res) => {
  try {
    const { id } = req.params;
    let imageBuffer = null;
    let contentType = "image/jpeg";

    if (req.file) {
      imageBuffer = fs.readFileSync(req.file.path);
      contentType = req.file.mimetype;
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Failed to delete temp file:", err);
      }
    } else if (req.body.imageBase64) {
      let base64Data = req.body.imageBase64;
      if (base64Data.includes("base64,")) {
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          contentType = matches[1];
          base64Data = matches[2];
        }
      }
      imageBuffer = Buffer.from(base64Data, "base64");
    } else {
      return res
        .status(400)
        .json({ error: "No image file or base64 data provided" });
    }

    await ProfilePicture.findOneAndUpdate(
      { internId: id },
      { internId: id, imageBuffer, contentType },
      { upsert: true, new: true },
    );

    res.status(200).json({ message: "Profile picture uploaded successfully" });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    res.status(500).json({ error: "Failed to upload profile picture" });
  }
};

// Retrieve profile picture (streams directly to browser)
const getProfilePicture = async (req, res) => {
  try {
    const { id } = req.params;
    let internId = id;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      const mongoose = require("mongoose");
      const Intern = mongoose.model("Intern");
      const intern = await Intern.findOne({ Trainee_ID: id });
      if (!intern) {
        return res.status(404).json({ error: "Intern not found" });
      }
      internId = intern._id;
    }

    // 1. Check for custom upload first
    const profilePic = await ProfilePicture.findOne({ internId });
    if (profilePic && profilePic.imageBuffer) {
      res.writeHead(200, {
        "Content-Type": profilePic.contentType,
        "Content-Length": profilePic.imageBuffer.length,
        "Cache-Control": "public, max-age=86400",
      });
      return res.end(profilePic.imageBuffer);
    }

    // 2. Check active Intern for Google profile picture
    const mongoose = require("mongoose");
    const Intern = mongoose.model("Intern");
    const internDoc = await Intern.findById(internId).select("googlePictureUrl");
    if (internDoc && internDoc.googlePictureUrl) {
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.redirect(302, internDoc.googlePictureUrl);
    }

    // 3. Check InactiveIntern for Google profile picture (archived interns)
    const InactiveIntern = require("../models/InactiveIntern");
    const inactiveDoc = await InactiveIntern.findById(internId).select("googlePictureUrl");
    if (inactiveDoc && inactiveDoc.googlePictureUrl) {
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.redirect(302, inactiveDoc.googlePictureUrl);
    }

    // 4. Fallback to 404
    res.status(404).json({ error: "Profile picture not found" });
  } catch (error) {
    console.error("Error fetching profile picture:", error);
    res.status(500).json({ error: "Failed to fetch profile picture" });
  }
};

// =========================== TOUR / ONBOARDING ===========================

/**
 * PATCH /interns/:id/tour-seen
 * Body: { version: "v1.0-initial" }
 * Saves the tour version the intern has seen so the tour is not shown again.
 */
const markTourSeen = async (req, res) => {
  try {
    const { id } = req.params;
    const { version } = req.body;

    if (!version) {
      return res.status(400).json({ message: "version is required" });
    }

    const Intern = require("../models/Intern");

    const intern = await Intern.findByIdAndUpdate(
      id,
      { $set: { tourSeenVersion: version } },
      { new: true },
    );

    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }

    res.status(200).json({ ok: true, tourSeenVersion: intern.tourSeenVersion });
  } catch (error) {
    console.error("Error marking tour as seen:", error);
    res
      .status(500)
      .json({ message: "Error marking tour as seen", error: error.message });
  }
};

const getInternUniversityFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    let query = { internId: id };

    const UniversityStudentFeedback = require("../models/UniversityStudentFeedback");
    const UniversityUser = require("../models/UniversityUser");

    if (!/^[a-f\d]{24}$/i.test(id)) {
      const intern = await InternService.getInternById(id);
      if (intern) {
        query = {
          $or: [
            { internId: intern._id },
            { traineeId: intern.Trainee_ID },
          ],
        };
      }
    }

    const rawFeedbacks = await UniversityStudentFeedback.find(query)
      .populate("universitySupervisorId", "picture")
      .sort({ createdAt: -1 })
      .lean();

    const feedbacks = await Promise.all(
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

    return res.status(200).json({ success: true, feedbacks: feedbacks || [] });
  } catch (error) {
    console.error("Error fetching university feedback for intern:", error);
    return res
      .status(500)
      .json({ message: "Error fetching university feedback", error: error.message });
  }
};

const submitManualCheckInRequest = async (req, res) => {
  try {
    const internId = req.user?.id || req.body?.internId;
    if (!internId) {
      return res.status(401).json({ message: "Unauthorized: intern identity not found." });
    }

    const { requestType = "check_in", attendanceType = "daily", projectName, reason, location } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: "Reason is required for manual check-in request." });
    }

    if (!["check_in", "check_out"].includes(requestType)) {
      return res.status(400).json({ message: "Invalid requestType. Must be 'check_in' or 'check_out'." });
    }

    if (!["daily", "meeting"].includes(attendanceType)) {
      return res.status(400).json({ message: "Invalid attendanceType. Must be 'daily' or 'meeting'." });
    }

    const Intern = require("../models/Intern");
    const ManualCheckInRequest = require("../models/ManualCheckInRequest");

    const intern = await Intern.findById(internId);
    if (!intern) {
      return res.status(404).json({ message: "Intern not found." });
    }

    const newRequest = new ManualCheckInRequest({
      internId: intern._id,
      requestType,
      attendanceType,
      projectName: attendanceType === "meeting" ? projectName?.trim() || null : null,
      reason: reason.trim(),
      location: location ? {
        latitude: location.latitude ?? null,
        longitude: location.longitude ?? null,
        accuracy: location.accuracy ?? null,
        capturedAt: location.capturedAt ? new Date(location.capturedAt) : new Date(),
      } : undefined,
      status: "pending",
      requestedAt: new Date(),
    });

    await newRequest.save();

    return res.status(201).json({
      success: true,
      message: "Manual check-in request submitted successfully.",
      request: newRequest,
    });
  } catch (error) {
    console.error("Error in submitManualCheckInRequest:", error);
    return res.status(500).json({
      message: "Failed to submit manual check-in request.",
      error: error.message,
    });
  }
};

module.exports = {
  addIntern,
  addExternalIntern,
  getAllInterns,
  getInternById,
  getAttendanceStats,
  markAttendance,
  updateAttendance,
  assignToTeam,
  removeFromTeam,
  removeIntern,
  updateIntern,
  uploadInterns,
  getAllTeams,
  updateTeamName,
  assignSingleToTeam,
  deleteTeam,
  getAttendanceStatsForToday,
  updateAttendanceForSpecificDate,
  getWeeklyAttendanceStats,
  getAttendanceByInternId,
  uploadTXT,
  addAvailableDay,
  removeAvailableDay,
  getInternByIdEach,
  // SLT API Integration endpoints
  syncWithSLTAPI,
  testSLTAPI,
  getActiveTraineesFromSLT,
  cleanupInactiveInterns,
  // SLT API Scheduler endpoints
  triggerManualSLTSync,
  triggerComprehensiveUpdate,
  acceptAgreement,
  checkInternProjects,
  uploadProfilePicture,
  getProfilePicture,
  markTourSeen,
  getInternUniversityFeedback,
  submitManualCheckInRequest,
};

