const FaceAttendanceService = require("../services/faceAttendanceService");
const Intern = require("../models/Intern");
const mongoose = require("mongoose");
const AttendanceSettingsService = require("../services/attendanceSettingsService");
const FaceMeetingPinService = require("../services/faceMeetingPinService");

const resolveInternId = (req) => {
  return req.user?.id || req.body.internId || req.params.internId || null;
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
      profile: result.profile,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Failed to save face profile.",
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
      meetingTitle,
      meetingPin,
    } = req.body;
    const result = await FaceAttendanceService.markAttendanceWithFace({
      descriptor,
      source: metadata.source || "browser-camera",
      metadata,
      qrBackupUsed,
      attendanceType,
      meetingTitle,
      meetingPin,
      expectedInternId: req.user?.id,
    });

    if (!result.matched) {
      return res.status(404).json({
        message: "No matching face profile found. Try again or use QR backup.",
        matched: false,
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
      message: "Face attendance marked successfully.",
      matched: true,
      alreadyMarked: false,
      confidence: result.confidence,
      distance: result.distance,
      intern: result.intern,
      profile: result.profile,
      log: result.log,
      attendanceDate: result.attendanceDateKey,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.locationRequired || error.statusCode ? error.message : "Failed to verify face attendance.",
      error: error.message,
      locationRequired: Boolean(error.locationRequired),
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
    return res.status(200).json({ profile });
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
    return res.status(200).json({ profile: faceProfile });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load face profile.",
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
    const { meetingTitle } = req.query;
    const pinData = FaceMeetingPinService.getCurrentPin(meetingTitle);
    return res.status(200).json(pinData);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to generate face attendance PIN.",
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
  getAttendanceSettings,
  getCurrentMeetingPin,
};
