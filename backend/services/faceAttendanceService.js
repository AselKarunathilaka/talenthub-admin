const moment = require("moment-timezone");
const Intern = require("../models/Intern");
const InternFaceProfile = require("../models/InternFaceProfile");
const FaceAttendanceLog = require("../models/FaceAttendanceLog");
const AttendanceSettingsService = require("./attendanceSettingsService");
const FaceMeetingPinService = require("./faceMeetingPinService");
const AttendanceWorkflowService = require("./attendanceWorkflowService");
const externalConfig = require("../config/externalSystems");

const FACE_MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || 0.48);
const VALID_FACE_ATTENDANCE_TYPES = new Set(["daily", "meeting"]);

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

  return descriptor.length > 0 ? descriptor : null;
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

    let profile = await InternFaceProfile.findOne({ internId });
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
      const isDuplicateSample = profile.embeddings.some(
        (existingEmbedding) => euclideanDistance(existingEmbedding, normalizedDescriptor) < 0.01,
      );

      if (!isDuplicateSample) {
        profile.embeddings.push(normalizedDescriptor);
        profile.sampleCount = profile.embeddings.length;
      }

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

    let bestMatch = null;

    for (const profile of profiles) {
      if (!Array.isArray(profile.embeddings) || profile.embeddings.length === 0) {
        continue;
      }

      for (const sample of profile.embeddings) {
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
    meetingTitle = "",
    meetingPin = "",
    expectedInternId = null,
  }) {
    const normalizedAttendanceType = VALID_FACE_ATTENDANCE_TYPES.has(String(attendanceType).toLowerCase())
      ? String(attendanceType).toLowerCase()
      : "daily";
    const normalizedMeetingTitle = String(meetingTitle || metadata.meetingTitle || "").trim();
    const location = metadata.location || {};

    if (normalizedAttendanceType === "meeting" && !normalizedMeetingTitle) {
      const error = new Error("Meeting title is required for meeting attendance.");
      error.statusCode = 400;
      throw error;
    }

    const locationPayload = {
      lat: location.latitude ?? location.lat,
      lng: location.longitude ?? location.lng,
      label: normalizedAttendanceType === "meeting" ? "Face meeting attendance" : "Face attendance",
    };

    await AttendanceSettingsService.validateSltLocationIfRequired(locationPayload);

    let meetingPinData = null;
    if (normalizedAttendanceType === "meeting") {
      meetingPinData = FaceMeetingPinService.validatePin({
        meetingTitle: normalizedMeetingTitle,
        pin: meetingPin || metadata.meetingPin,
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

    if (normalizedAttendanceType === "meeting") {
      const result = await AttendanceWorkflowService.markMeetingAttendance({
        internId: intern._id,
        meetingTitle: normalizedMeetingTitle,
        sessionId: faceSessionId,
        method: "face_meeting",
        meetingSessionId: meetingPinData?.meetingSessionId,
        attendanceDate,
        duplicateMessage: "Duplicate face meeting attendance detected. Please wait before scanning again.",
        syncEndpoint: externalConfig.attendanceSystem.endpoints.scanMeeting,
        dailySyncEndpoint: externalConfig.attendanceSystem.endpoints.scanDaily,
        autoMarkDaily: true,
        dailyMethod: "face",
      });
      dailyAttendanceMarked = result.dailyAttendanceMarked;
    } else {
      await AttendanceWorkflowService.markDailyAttendance({
        internId: intern._id,
        sessionId: faceSessionId,
        method: "face",
        attendanceDate,
        duplicateMessage: "Duplicate face attendance detected. Please wait before scanning again.",
        syncEndpoint: externalConfig.attendanceSystem.endpoints.scanDaily,
      });
      dailyAttendanceMarked = true;
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
        meetingTitle: normalizedMeetingTitle || undefined,
        meetingSessionId: meetingPinData?.meetingSessionId,
        dailyAttendanceMarked,
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
