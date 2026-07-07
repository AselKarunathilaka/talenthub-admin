const moment = require("moment-timezone");
const Intern = require("../models/Intern");
const InternFaceProfile = require("../models/InternFaceProfile");
const FaceAttendanceLog = require("../models/FaceAttendanceLog");
const AttendanceSettingsService = require("./attendanceSettingsService");
const FaceMeetingPinService = require("./faceMeetingPinService");
const AttendanceWorkflowService = require("./attendanceWorkflowService");
const externalConfig = require("../config/externalSystems");

const FACE_MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || 0.48);
const FACE_DESCRIPTOR_LENGTH = 128;
const VALID_FACE_ATTENDANCE_TYPES = new Set(["daily", "meeting"]);
const normalizeProjectName = (value) => String(value || "").trim().replace(/\s+/g, " ");

function normalizeDescriptor(descriptorInput) {
  const rawDescriptor = Array.isArray(descriptorInput)
    ? descriptorInput
    : descriptorInput?.descriptor || descriptorInput?.embedding || descriptorInput?.data;

  if (!rawDescriptor) {
    return null;
  }

  const descriptor = Array.from(rawDescriptor, (value) => Number(value)).filter(
    (value) => Number.isFinite(value),
  );

  return descriptor.length === FACE_DESCRIPTOR_LENGTH ? descriptor : null;
}

function euclideanDistance(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return Number.POSITIVE_INFINITY;
  }

  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    sum += difference * difference;
  }

  return Math.sqrt(sum);
}

function toAttendanceDateKey(date = new Date()) {
  return moment.tz(date, "Asia/Colombo").format("YYYY-MM-DD");
}

class FaceAttendanceService {
  static normalizeDescriptor(descriptorInput) {
    return normalizeDescriptor(descriptorInput);
  }

  static calculateDistance(leftDescriptor, rightDescriptor) {
    return euclideanDistance(leftDescriptor, rightDescriptor);
  }

  static async registerFaceProfile({ internId, descriptor, source = "browser-camera", metadata = {} }) {
    const normalizedDescriptor = normalizeDescriptor(descriptor);
    if (!normalizedDescriptor) {
      throw new Error("A valid face descriptor is required.");
    }

    const intern = await Intern.findById(internId);
    if (!intern) {
      throw new Error("Intern not found.");
    }

    let profile = await InternFaceProfile.findOne({
      $or: [{ internId }, { traineeId: intern.Trainee_ID }],
    });
    if (!profile) {
      profile = new InternFaceProfile({
        internId,
        traineeId: intern.Trainee_ID,
        traineeName: intern.Trainee_Name,
        embeddings: [normalizedDescriptor],
        sampleCount: 1,
        isActive: true,
      });
    } else {
      if (metadata.replaceExisting === true) {
        profile.embeddings = [];
        profile.sampleCount = 0;
      }

      const isDuplicateSample = profile.embeddings.some(
        (existingEmbedding) => euclideanDistance(existingEmbedding, normalizedDescriptor) < 0.01,
      );

      if (!isDuplicateSample) {
        profile.embeddings.push(normalizedDescriptor);
        profile.sampleCount = profile.embeddings.length;
      }

      // Intern records can be re-imported from SLT, changing the Mongo _id
      // while keeping the same Trainee_ID. Re-link the old face profile instead
      // of creating a duplicate traineeId profile and failing with E11000.
      profile.internId = intern._id;
      profile.traineeId = intern.Trainee_ID;
      profile.traineeName = intern.Trainee_Name;
      profile.isActive = true;
    }

    profile.lastMatchedAt = new Date();
    await profile.save();

    return {
      profile,
      source,
      metadata,
    };
  }

  static async findBestMatch(descriptor, { expectedInternId = null } = {}) {
    const normalizedDescriptor = normalizeDescriptor(descriptor);
    if (!normalizedDescriptor) {
      throw new Error("A valid face descriptor is required.");
    }

    const profileQuery = { isActive: true };
    if (expectedInternId) {
      profileQuery.internId = expectedInternId;
    }

    const profiles = await InternFaceProfile.find(profileQuery).populate(
      "internId",
      "Trainee_Name Trainee_ID Trainee_Email attendance",
    );

    if (!profiles.length) {
      return {
        matched: false,
        reason: expectedInternId ? "profile_missing_for_intern" : "profile_missing",
        threshold: FACE_MATCH_THRESHOLD,
        bestDistance: null,
      };
    }

    let bestMatch = null;
    let hasUsableEmbedding = false;

    for (const profile of profiles) {
      if (!Array.isArray(profile.embeddings) || profile.embeddings.length === 0) {
        continue;
      }

      for (const sample of profile.embeddings) {
        hasUsableEmbedding = true;
        const distance = euclideanDistance(sample, normalizedDescriptor);
        if (!bestMatch || distance < bestMatch.distance) {
          bestMatch = {
            profile,
            distance,
          };
        }
      }
    }

    if (!bestMatch || bestMatch.distance > FACE_MATCH_THRESHOLD) {
      return {
        matched: false,
        reason: hasUsableEmbedding ? "face_not_recognized" : "profile_has_no_embeddings",
        threshold: FACE_MATCH_THRESHOLD,
        bestDistance: bestMatch ? bestMatch.distance : null,
      };
    }

    const confidence = Math.max(0, Math.round((1 - bestMatch.distance) * 100));

    return {
      matched: true,
      threshold: FACE_MATCH_THRESHOLD,
      distance: bestMatch.distance,
      confidence,
      profile: bestMatch.profile,
      intern: bestMatch.profile.internId,
    };
  }

  static async markAttendanceWithFace({
    descriptor,
    source = "browser-camera",
    metadata = {},
    qrBackupUsed = false,
    attendanceType = "daily",
    projectName = "",
    meetingTitle = "",
    meetingPin = "",
    expectedInternId = null,
    attendanceAction = "check_in",
  }) {
    const normalizedAttendanceType = VALID_FACE_ATTENDANCE_TYPES.has(String(attendanceType).toLowerCase())
      ? String(attendanceType).toLowerCase()
      : "daily";
    const normalizedProjectName = normalizeProjectName(
      projectName || metadata.projectName || meetingTitle || metadata.meetingTitle || "",
    );
    const location = metadata.location || {};

    if (normalizedAttendanceType === "meeting" && !normalizedProjectName) {
      const error = new Error("Project name is required for meeting attendance.");
      error.statusCode = 400;
      throw error;
    }

    const locationPayload = {
      lat: location.latitude ?? location.lat,
      lng: location.longitude ?? location.lng,
      accuracy: location.accuracy,
      capturedAt: location.capturedAt,
      label: normalizedAttendanceType === "meeting" ? "Face meeting attendance" : "Face attendance",
    };

    const locationValidation = await AttendanceSettingsService.validateSltLocationIfRequired(locationPayload);

    let meetingPinData = null;
    if (normalizedAttendanceType === "meeting") {
      meetingPinData = FaceMeetingPinService.validatePin({
        projectName: normalizedProjectName,
        pin: meetingPin || metadata.meetingPin,
        bypassValidation: metadata.markedByAdmin === true,
      });
    }

    const match = await this.findBestMatch(descriptor, { expectedInternId });

    if (!match.matched) {
      await FaceAttendanceLog.create({
        internId: expectedInternId || metadata.internId || null,
        faceProfileId: null,
        traineeId: metadata.traineeId || "unknown",
        traineeName: metadata.traineeName || "Unknown",
        attendanceDate: toAttendanceDateKey(new Date()),
        attendanceTime: new Date(),
        status: "absent",
        method: qrBackupUsed ? "qr" : "face",
        matchDistance: match.bestDistance,
        confidence: null,
        qrBackupUsed,
        source,
        metadata: {
          ...metadata,
          reason: expectedInternId ? "logged_in_face_not_recognized" : "face_not_recognized",
          attendanceType: normalizedAttendanceType,
          locationValidation,
        },
      });

      return match;
    }

    const intern = await Intern.findById(match.intern._id);
    if (!intern) {
      throw new Error("Matched intern record is unavailable.");
    }

    const attendanceDate = moment.tz("Asia/Colombo").toDate();
    const attendanceDateKey = toAttendanceDateKey(attendanceDate);

    const faceSessionId =
      normalizedAttendanceType === "meeting"
        ? meetingPinData?.meetingSessionId
        : `face_daily_${intern._id}_${attendanceDate.getTime()}`;
    let dailyAttendanceMarked = false;
    let checkedOut = false;

    if (normalizedAttendanceType === "meeting") {
      const result = await AttendanceWorkflowService.markMeetingAttendance({
        internId: intern._id,
        projectName: normalizedProjectName,
        sessionId: faceSessionId,
        method: "face_meeting",
        meetingSessionId: meetingPinData?.meetingSessionId,
        attendanceDate,
        duplicateMessage: "Attendance for this project is already marked today.",
        syncEndpoint: externalConfig.attendanceSystem.endpoints.scanMeeting,
        dailySyncEndpoint: externalConfig.attendanceSystem.endpoints.scanDaily,
        autoMarkDaily: true,
        dailyMethod: "face",
      });
      dailyAttendanceMarked = result.dailyAttendanceMarked;
    } else {
      const result = await AttendanceWorkflowService.markDailyAttendance({
        internId: intern._id,
        sessionId: faceSessionId,
        method: "face",
        attendanceDate,
        duplicateMessage: "Duplicate face attendance detected. Please wait before scanning again.",
        syncEndpoint: externalConfig.attendanceSystem.endpoints.scanDaily,
        attendanceAction,
      });
      dailyAttendanceMarked = true;
      checkedOut = result.checkedOut || false;
    }

    const log = await FaceAttendanceLog.create({
      internId: intern._id,
      faceProfileId: match.profile._id,
      traineeId: intern.Trainee_ID,
      traineeName: intern.Trainee_Name,
      attendanceDate: attendanceDateKey,
      attendanceTime: attendanceDate,
      status: "present",
      method: qrBackupUsed ? "qr" : "face",
      matchDistance: match.distance,
      confidence: match.confidence,
      qrBackupUsed,
      source,
      metadata: {
        ...metadata,
        attendanceType: normalizedAttendanceType,
        attendanceAction:
          normalizedAttendanceType === "daily"
            ? attendanceAction
            : undefined,
        projectName: normalizedProjectName || undefined,
        meetingTitle: normalizedProjectName || undefined,
        meetingSessionId: meetingPinData?.meetingSessionId,
        dailyAttendanceMarked,
        locationValidation,
      },
    });

    match.profile.lastMatchedAt = attendanceDate;
    await match.profile.save();

    return {
      ...match,
      alreadyMarked: false,
      log,
      attendanceDate,
      attendanceDateKey,
      dailyAttendanceMarked,
      checkedOut,
      intern: {
        _id: intern._id,
        traineeId: intern.Trainee_ID,
        traineeName: intern.Trainee_Name,
        email: intern.Trainee_Email,
      },
      profile: match.profile,
    };
  }

  static async getProfileByInternId(internId) {
    return InternFaceProfile.findOne({ internId }).populate(
      "internId",
      "Trainee_Name Trainee_ID Trainee_Email",
    );
  }

  static async getLogsByInternId(internId, limit = 50) {
    return FaceAttendanceLog.find({ internId })
      .sort({ attendanceTime: -1 })
      .limit(Math.max(1, Math.min(Number(limit) || 50, 200)));
  }
}

module.exports = FaceAttendanceService;
