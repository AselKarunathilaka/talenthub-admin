const FaceAttendanceService = require("../services/faceAttendanceService");
const Intern = require("../models/Intern");
const mongoose = require("mongoose");
const AttendanceSettingsService = require("../services/attendanceSettingsService");
const FaceMeetingPinService = require("../services/faceMeetingPinService");
const InternFaceProfile = require("../models/InternFaceProfile");
<<<<<<< HEAD
const AttendanceWorkflowService = require("../services/attendanceWorkflowService");

const resolveInternId = (req) => {
  return req.user?.id || req.body?.internId || req.params?.internId || null;
};

const sanitizeFaceProfile = (profile) => {
  if (!profile) return null;
  const profileObject = typeof profile.toObject === "function" ? profile.toObject() : profile;
  return {
    _id: profileObject._id,
    internId: profileObject.internId,
    traineeId: profileObject.traineeId,
    traineeName: profileObject.traineeName,
    sampleCount: Number(profileObject.sampleCount || profileObject.embeddings?.length || 0),
    isActive: profileObject.isActive,
    lastMatchedAt: profileObject.lastMatchedAt,
    createdAt: profileObject.createdAt,
    updatedAt: profileObject.updatedAt,
  };
=======

const resolveInternId = (req) => {
  return req.user?.id || req.body.internId || req.params.internId || null;
>>>>>>> talenthub/main
};

const registerFaceProfile = async (req, res) => {
  try {
    const internId = resolveInternId(req);
    const { descriptor, metadata = {} } = req.body;

    if (!internId) {
      return res.status(400).json({ message: "Intern ID is required." });
    }

    const result = await FaceAttendanceService.registerFaceProfile({
      internId,
      descriptor,
      source: metadata.source || "browser-camera",
      metadata,
    });

    return res.status(201).json({
      message: "Face profile saved successfully.",
<<<<<<< HEAD
      profile: sanitizeFaceProfile(result.profile),
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Failed to save face profile.",
=======
      profile: result.profile,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Failed to save face profile.",
>>>>>>> talenthub/main
      error: error.message,
    });
  }
};

const verifyFaceAttendance = async (req, res) => {
  try {
      const {
        descriptor,
        metadata = {},
        qrBackupUsed = false,
        attendanceType = "daily",
        projectName,
        meetingTitle,
        meetingPin,
<<<<<<< HEAD
        attendanceAction = "check_in",
=======
>>>>>>> talenthub/main
      } = req.body;

      // Allow `internId` to be provided from body/params when the mobile client
      // doesn't have a login flow. Resolve string trainee IDs to ObjectId when possible.
      const expectedInternIdRaw = resolveInternId(req);
      let expectedInternId = null;
      if (expectedInternIdRaw) {
        if (mongoose.Types.ObjectId.isValid(expectedInternIdRaw)) {
          expectedInternId = expectedInternIdRaw;
        } else {
          const internRecord = await Intern.findOne({ Trainee_ID: expectedInternIdRaw });
          if (internRecord) expectedInternId = internRecord._id;
        }
      }

      // Ensure metadata carries the submitted intern identifier for logging/debugging
      metadata.internId = metadata.internId || req.body.internId || expectedInternIdRaw || metadata.internId;

      const result = await FaceAttendanceService.markAttendanceWithFace({
        descriptor,
        source: metadata.source || "browser-camera",
        metadata,
        qrBackupUsed,
        attendanceType,
        projectName,
        meetingTitle,
        meetingPin,
        expectedInternId,
<<<<<<< HEAD
        attendanceAction,
=======
>>>>>>> talenthub/main
      });

    if (!result.matched) {
      const messageByReason = {
        profile_missing_for_intern: "No face profile is registered for your account. Please enroll your face first.",
        profile_missing: "No active face profile found. Please enroll your face first.",
        profile_has_no_embeddings: "Your face profile is incomplete. Please re-enroll your face.",
        face_not_recognized: "Face did not match your registered profile. Try again with better lighting or re-enroll your face.",
      };

      return res.status(404).json({
        message: messageByReason[result.reason] || "No matching face profile found. Try again or use QR backup.",
        matched: false,
        reason: result.reason,
        threshold: result.threshold,
        bestDistance: result.bestDistance,
      });
    }

    if (result.alreadyMarked) {
      return res.status(400).json({
        message: "Already marked today attendance",
        matched: true,
        alreadyMarked: true,
        confidence: result.confidence,
        distance: result.distance,
        intern: result.intern,
      });
    }

    return res.status(200).json({
      message:
        attendanceType === "meeting"
          ? result.dailyAttendanceMarked
            ? "Face meeting attendance marked successfully. Daily attendance also recorded."
            : "Face meeting attendance marked successfully."
<<<<<<< HEAD
          : result.checkedOut
            ? "Checked out successfully."
            : "Checked in successfully.",
=======
          : "Face attendance marked successfully.",
>>>>>>> talenthub/main
      matched: true,
      alreadyMarked: false,
      confidence: result.confidence,
      distance: result.distance,
      intern: result.intern,
      profile: result.profile,
      log: result.log,
      attendanceDate: result.attendanceDateKey,
      dailyAttendanceMarked: result.dailyAttendanceMarked,
      checkedOut: result.checkedOut,
<<<<<<< HEAD
      attendanceAction,
=======
>>>>>>> talenthub/main
    });
  } catch (error) {
    console.error("DEBUG CATCH ERROR:", error);
    const rawMessage = error.message || "";
    const isUserActionError =
      Boolean(error.locationRequired) ||
      Boolean(error.statusCode) ||
      rawMessage.includes("Duplicate") ||
      rawMessage.includes("already marked") ||
      rawMessage.includes("Project name");

    return res.status(error.statusCode || (isUserActionError ? 400 : 500)).json({
      message:
        isUserActionError
          ? error.message
          : "Failed to verify face attendance.",
      error: error.message,
      locationRequired: Boolean(error.locationRequired),
      alreadyMarked: Boolean(error.alreadyMarked),
<<<<<<< HEAD
      code: error.code,
      retryAfterMinutes: error.retryAfterMinutes,
    });
  }
};

const getDailyAttendanceStatus = async (req, res) => {
  try {
    const internId = resolveInternId(req);
    if (!internId) {
      return res.status(400).json({ message: "Intern ID is required." });
    }

    const status =
      await AttendanceWorkflowService.getDailyAttendanceStatus(internId);
    return res.status(200).json(status);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to load daily attendance status.",
      code: error.code,
=======
>>>>>>> talenthub/main
    });
  }
};

const getFaceProfile = async (req, res) => {
  try {
    const internId = resolveInternId(req);
    if (!internId) {
      return res.status(400).json({ message: "Intern ID is required." });
    }

    const profile = await FaceAttendanceService.getProfileByInternId(internId);
<<<<<<< HEAD
    return res.status(200).json({ profile: sanitizeFaceProfile(profile) });
=======
    return res.status(200).json({ profile });
>>>>>>> talenthub/main
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load face profile.",
      error: error.message,
    });
  }
};

const getFaceLogs = async (req, res) => {
  try {
    const internId = resolveInternId(req);
    if (!internId) {
      return res.status(400).json({ message: "Intern ID is required." });
    }

    const limit = req.query.limit || 25;
    const logs = await FaceAttendanceService.getLogsByInternId(internId, limit);
    return res.status(200).json({ logs });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load face attendance logs.",
      error: error.message,
    });
  }
};

const getFaceProfileByIdentifier = async (req, res) => {
  try {
    const identifier = req.params.identifier || req.params.traineeId;
    const intern = mongoose.Types.ObjectId.isValid(identifier)
      ? await Intern.findById(identifier)
      : await Intern.findOne({ Trainee_ID: identifier });

    if (!intern) {
      return res.status(404).json({ message: "Intern not found." });
    }

    const faceProfile = await FaceAttendanceService.getProfileByInternId(intern._id);
<<<<<<< HEAD
    return res.status(200).json({ profile: sanitizeFaceProfile(faceProfile) });
=======
    return res.status(200).json({ profile: faceProfile });
>>>>>>> talenthub/main
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load face profile.",
      error: error.message,
    });
  }
};

const getFaceProfileEnrollmentSummary = async (req, res) => {
  try {
    const [profiles, totalInterns] = await Promise.all([
      InternFaceProfile.find({})
        .populate(
          "internId",
          "Trainee_ID Trainee_Name Trainee_Email Institute field_of_spec_name team Training_StartDate Training_EndDate",
        )
        .sort({ updatedAt: -1 })
        .lean(),
      Intern.countDocuments({}),
    ]);

    const enrollmentProfiles = profiles.map((profile) => {
      const intern = profile.internId || {};
      const sampleCount = Number(profile.sampleCount || profile.embeddings?.length || 0);

      return {
        _id: profile._id,
        internId: intern._id || null,
        traineeId: intern.Trainee_ID || profile.traineeId,
        traineeName: intern.Trainee_Name || profile.traineeName,
        email: intern.Trainee_Email || "",
        institute: intern.Institute || "",
        fieldOfSpecialization: intern.field_of_spec_name || "",
        team: intern.team || "",
        isActive: profile.isActive !== false,
        sampleCount,
        isComplete: profile.isActive !== false && sampleCount > 0,
        enrolledAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        lastMatchedAt: profile.lastMatchedAt,
      };
    });

    const activeProfiles = enrollmentProfiles.filter((profile) => profile.isActive);
    const completedProfiles = enrollmentProfiles.filter((profile) => profile.isComplete);

    return res.status(200).json({
      stats: {
        enrolled: enrollmentProfiles.length,
        totalInterns,
        notEnrolled: Math.max(totalInterns - enrollmentProfiles.length, 0),
        active: activeProfiles.length,
        completed: completedProfiles.length,
        incomplete: activeProfiles.length - completedProfiles.length,
        inactive: enrollmentProfiles.length - activeProfiles.length,
      },
      profiles: enrollmentProfiles,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load face enrollment profiles.",
      error: error.message,
    });
  }
};

const getAttendanceSettings = async (req, res) => {
  try {
    const settings = await AttendanceSettingsService.getAttendanceSettings();
    return res.status(200).json({ settings });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load attendance settings.",
      error: error.message,
    });
  }
};

const getCurrentMeetingPin = async (req, res) => {
  try {
    const { projectName, meetingTitle, rotate } = req.query;
    const pinData = FaceMeetingPinService.getCurrentPin(projectName || meetingTitle, Date.now(), {
      rotate: rotate === "true",
    });
    return res.status(200).json(pinData);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to generate face attendance PIN.",
      error: error.message,
    });
  }
};

const validateCurrentMeetingPin = async (req, res) => {
  try {
    const { projectName, meetingTitle, meetingPin, pin } = req.body || {};
    const pinData = FaceMeetingPinService.validatePin({
      projectName: projectName || meetingTitle,
      pin: meetingPin || pin,
    });

    return res.status(200).json({
      valid: true,
      projectName: pinData.projectName,
      expiresAt: pinData.expiresAt,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      valid: false,
      message: error.message || "Invalid or expired face attendance PIN.",
      error: error.message,
    });
  }
};

const stopCurrentMeetingPin = async (req, res) => {
  try {
    const { projectName, meetingTitle } = req.body || {};
    const submittedProjectName = projectName || meetingTitle;
    FaceMeetingPinService.rotatePin(submittedProjectName);
    return res.status(200).json({
      message: "Current face attendance PIN stopped.",
      projectName: String(submittedProjectName || "").trim(),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to stop face attendance PIN.",
      error: error.message,
    });
  }
};

const scanInternFaceByAdmin = async (req, res) => {
  try {
    const {
      internId, // the intern's ID
      descriptor,
      metadata = {},
      attendanceType = "daily",
      projectName,
      meetingTitle,
      meetingPin,
<<<<<<< HEAD
      attendanceAction = "check_in",
=======
>>>>>>> talenthub/main
    } = req.body;

    if (!internId) {
      return res.status(400).json({ message: "internId is required." });
    }

    let expectedInternId = null;
    if (mongoose.Types.ObjectId.isValid(internId)) {
      expectedInternId = internId;
    } else {
      const internRecord = await Intern.findOne({ Trainee_ID: internId });
      if (internRecord) expectedInternId = internRecord._id;
      else return res.status(404).json({ message: "Intern not found." });
    }

    metadata.internId = expectedInternId;
    metadata.adminId = req.user?.id;
    metadata.markedByAdmin = true;

    const result = await FaceAttendanceService.markAttendanceWithFace({
      descriptor,
      source: metadata.source || "admin-mobile-app",
      metadata,
      qrBackupUsed: false,
      attendanceType,
      projectName,
      meetingTitle,
      meetingPin,
      expectedInternId,
<<<<<<< HEAD
      attendanceAction,
=======
>>>>>>> talenthub/main
    });

    if (!result.matched) {
      const messageByReason = {
        profile_missing_for_intern: "No face profile is registered for this intern. Please have them enroll their face first.",
        profile_missing: "No active face profile found.",
        profile_has_no_embeddings: "The intern's face profile is incomplete. Please have them re-enroll.",
        face_not_recognized: "Face did not match the registered profile for this intern. Try again with better lighting.",
      };

      return res.status(404).json({
        message: messageByReason[result.reason] || "No matching face profile found.",
        matched: false,
        reason: result.reason,
        threshold: result.threshold,
        bestDistance: result.bestDistance,
      });
    }

    if (result.alreadyMarked) {
      return res.status(400).json({
        message: "Already marked today attendance",
        matched: true,
        alreadyMarked: true,
        confidence: result.confidence,
        distance: result.distance,
        intern: result.intern,
      });
    }

    return res.status(200).json({
      message:
        attendanceType === "meeting"
          ? result.dailyAttendanceMarked
            ? "Face meeting attendance marked successfully. Daily attendance also recorded."
            : "Face meeting attendance marked successfully."
<<<<<<< HEAD
          : result.checkedOut
            ? "Checked out successfully."
            : "Checked in successfully.",
=======
          : "Face attendance marked successfully.",
>>>>>>> talenthub/main
      matched: true,
      alreadyMarked: false,
      confidence: result.confidence,
      distance: result.distance,
      intern: result.intern,
      profile: result.profile,
      log: result.log,
      attendanceDate: result.attendanceDateKey,
      dailyAttendanceMarked: result.dailyAttendanceMarked,
      checkedOut: result.checkedOut,
<<<<<<< HEAD
      attendanceAction,
=======
>>>>>>> talenthub/main
    });
  } catch (error) {
    const rawMessage = error.message || "";
    const isUserActionError =
      Boolean(error.locationRequired) ||
      Boolean(error.statusCode) ||
      rawMessage.includes("Duplicate") ||
      rawMessage.includes("already marked") ||
      rawMessage.includes("Project name");

    return res.status(error.statusCode || (isUserActionError ? 400 : 500)).json({
      message: isUserActionError ? error.message : "Failed to verify face attendance.",
      error: error.message,
      locationRequired: Boolean(error.locationRequired),
      alreadyMarked: Boolean(error.alreadyMarked),
<<<<<<< HEAD
      code: error.code,
      retryAfterMinutes: error.retryAfterMinutes,
=======
>>>>>>> talenthub/main
    });
  }
};

const registerFaceProfileByAdmin = async (req, res) => {
  try {
    const { internId, descriptor, metadata = {} } = req.body;

    if (!internId) {
      return res.status(400).json({ message: "internId is required." });
    }

    let expectedInternId = null;
    if (mongoose.Types.ObjectId.isValid(internId)) {
      expectedInternId = internId;
    } else {
      const internRecord = await Intern.findOne({ Trainee_ID: internId });
      if (internRecord) expectedInternId = internRecord._id;
      else return res.status(404).json({ message: "Intern not found." });
    }

    metadata.internId = expectedInternId;
    metadata.adminId = req.user?.id;
    metadata.enrolledByAdmin = true;

    const result = await FaceAttendanceService.registerFaceProfile({
      internId: expectedInternId,
      descriptor,
      source: metadata.source || "admin-browser-camera",
      metadata,
    });

    return res.status(201).json({
      message: "Face profile saved successfully by admin.",
<<<<<<< HEAD
      profile: sanitizeFaceProfile(result.profile),
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Failed to save face profile.",
=======
      profile: result.profile,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Failed to save face profile.",
>>>>>>> talenthub/main
      error: error.message,
    });
  }
};

module.exports = {
  registerFaceProfile,
  verifyFaceAttendance,
  getFaceProfile,
  getFaceLogs,
  getFaceProfileByIdentifier,
  getFaceProfileEnrollmentSummary,
  getAttendanceSettings,
  getCurrentMeetingPin,
  validateCurrentMeetingPin,
  stopCurrentMeetingPin,
  scanInternFaceByAdmin,
  registerFaceProfileByAdmin,
<<<<<<< HEAD
  getDailyAttendanceStatus,
=======
>>>>>>> talenthub/main
};
