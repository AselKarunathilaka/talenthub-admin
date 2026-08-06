const qrCodeService = require("../services/qrCodeService");
const InternService = require("../services/internService"); 
const attendanceService = require("../services/attendanceService");
const InternRepository = require("../repositories/internRepository");  
const sendEmail = require("../utils/emailSender");  
const AttendanceSettingsService = require("../services/attendanceSettingsService");
const FaceAttendanceLog = require("../models/FaceAttendanceLog");
const Intern = require("../models/Intern");

const moment = require("moment-timezone");

const QRCode = require("qrcode");

const normalizeProjectName = (value) => String(value || "").trim().replace(/\s+/g, " ");
const getProjectKey = (value) => normalizeProjectName(value);

// In-memory store for active QR sessions
const activeQrSessions = new Map();

// Helper to calculate overall attendance rate (Presents / Total)
const calculateAttendanceRate = (intern) => {
  if (!intern || !intern.attendance || intern.attendance.length === 0) return 0;
  const totalDays = intern.attendance.length;
  const presentDays = intern.attendance.filter(a => a.status === "Present").length;
  return Math.round((presentDays / totalDays) * 100);
};

// Helper to calculate meeting attendance rate based on weeks present vs weeks held (like Dashboard)
const calculateMeetingAttendanceRate = (intern) => {
  if (!intern || !intern.Training_StartDate || !intern.attendance) return 0;
  
  const meetingAttendance = intern.attendance.filter(a => 
    ["qr", "face_meeting", "meeting", "manual_meeting"].includes(String(a.type || ""))
  );

  if (meetingAttendance.length === 0) return 0;

  const toWeekKey = (entry) => {
    const date = entry.date ? new Date(entry.date) : null;
    if (!date || isNaN(date.getTime())) return null;
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(new Date(d).setDate(diff));
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  };

  const weeksPresent = new Set(
    meetingAttendance
      .filter((e) => e.status === "Present")
      .map(toWeekKey)
      .filter(Boolean)
  ).size;

  const start = new Date(intern.Training_StartDate);
  const now = new Date();
  if (isNaN(start.getTime()) || now <= start) return 0;

  const weeksHeld = Math.max(
    1,
    Math.ceil((now - start) / (1000 * 60 * 60 * 24 * 7))
  );

  return Math.min(100, Math.round((weeksPresent / weeksHeld) * 100));
};


// Helper to count total meeting attendances
const countMeetingAttendances = (intern) => {
  if (!intern || !intern.attendance) return 0;
  const MEETING_TYPES = ["qr", "face_meeting", "meeting", "manual_meeting"];
  return intern.attendance.filter(a => MEETING_TYPES.includes(String(a.type || "")) && a.status === "Present").length;
};

const saveQrAttendanceAudit = async ({
  internId,
  attendanceType,
  locationValidation,
  deviceTime,
  deviceTimeZone,
  deviceUtcOffsetMinutes,
  projectName,
  attendanceAction,
}) => {
  try {
    const intern = await Intern.findById(internId);
    if (!intern) return;

    const attendanceTime = new Date();
    await FaceAttendanceLog.create({
      internId: intern._id,
      traineeId: intern.Trainee_ID,
      traineeName: intern.Trainee_Name,
      attendanceDate: moment.tz(attendanceTime, "Asia/Colombo").format("YYYY-MM-DD"),
      attendanceTime,
      status: "present",
      method: "qr",
      qrBackupUsed: false,
      source: "browser-qr",
      metadata: {
        attendanceType,
        attendanceAction,
        projectName: projectName || undefined,
        deviceTime,
        deviceTimeZone,
        deviceUtcOffsetMinutes,
        locationValidation,
      },
    });
  } catch (error) {
    console.warn("Failed to save QR attendance audit:", error.message);
  }
};


const generateQRCode = async (req, res) => {
  try {
    const { internId, type, projectName, meetingTitle, limit } = req.query;
    const normalizedProjectName = normalizeProjectName(projectName || meetingTitle || "General Meeting");
    
    let sessionId;
    if (type === 'daily') {
      // Generate QR for daily attendance
      if (internId) {
        sessionId = `daily_attendance_${internId}_${Date.now()}`;
      } else {
        sessionId = `daily_attendance_${Date.now()}`;
      }
    } else {
      // Generate QR for meeting attendance (JSON format expected by scanner)
      // Keep meetingTitle for backward compatibility with older scanners.
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const meetingData = {
        type: 'meeting_attendance',
        projectName: normalizedProjectName,
        meetingTitle: normalizedProjectName,
        timestamp: Date.now(),
        sessionId: sessionId
      };

      if (internId) {
        meetingData.internId = internId;
      }

      sessionId = JSON.stringify(meetingData);
    }
    
    const qrCode = await QRCode.toDataURL(sessionId); 

    // Store in memory
    const extractedSessionId = type === 'daily' ? sessionId : JSON.parse(sessionId).sessionId;
    activeQrSessions.set(extractedSessionId, {
      sessionId: extractedSessionId,
      type,
      projectName: normalizedProjectName,
      meetingTitle: normalizedProjectName,
      limit: limit ? parseInt(limit, 10) : null,
      status: "Active",
      expiresAt: Date.now() + 5 * 60 * 1000,
      attendees: []
    });

    res.status(200).json({ qrCode, sessionId: extractedSessionId, type });  
  } catch (error) {
    res.status(500).json({ message: "Error generating QR Code", error: error.message });
  }
};

const getSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = activeQrSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Check expiry
    if (session.status === "Active" && Date.now() > session.expiresAt) {
      session.status = "Expired";
    }

    // Always query the real DB for attendees so the panel works even after restarts
    try {
      const now = moment.tz("Asia/Colombo");
      const todayStart = now.clone().startOf("day").toDate();
      const todayEnd = now.clone().endOf("day").toDate();

      const MEETING_ATTENDANCE_TYPES = ["qr", "face_meeting", "meeting", "manual_meeting"];

      // Use a regex to match meetingName case-insensitively (handles any normalization drift)
      const projectNameRegex = new RegExp(`^${session.projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

      const internsWithAttendance = await Intern.find({
        $or: [
          {
            attendance: {
              $elemMatch: {
                type: { $in: MEETING_ATTENDANCE_TYPES },
                status: "Present",
                meetingName: projectNameRegex,
                date: { $gte: todayStart, $lte: todayEnd }
              }
            }
          },
          {
            attendance: {
              $elemMatch: {
                type: { $in: MEETING_ATTENDANCE_TYPES },
                status: "Present",
                projectName: projectNameRegex,
                date: { $gte: todayStart, $lte: todayEnd }
              }
            }
          }
        ]
      }).select("_id Trainee_ID Trainee_Name field_of_spec_name attendance googlePictureUrl Training_StartDate");

      const dbAttendees = internsWithAttendance.map(intern => {
        // Find the most recent matching attendance entry
        const entry = [...(intern.attendance || [])]
          .filter(a =>
            MEETING_ATTENDANCE_TYPES.includes(String(a.type || "")) &&
            a.status === "Present" &&
            (
              projectNameRegex.test(a.meetingName || "") ||
              projectNameRegex.test(a.projectName || "")
            ) &&
            new Date(a.date) >= todayStart &&
            new Date(a.date) <= todayEnd
          )
          .sort((a, b) => new Date(b.timeMarked || b.date) - new Date(a.timeMarked || a.date))[0];

        return {
          internId: intern._id,
          traineeId: intern.Trainee_ID,
          traineeName: intern.Trainee_Name,
          stack: intern.field_of_spec_name,
          profileImage: intern.googlePictureUrl,
          attendanceRate: calculateAttendanceRate(intern),
          meetingAttendanceRate: calculateMeetingAttendanceRate(intern),
          totalMeetings: countMeetingAttendances(intern),
          timeMarked: entry?.timeMarked || entry?.date || new Date()
        };
      });

      // Merge DB attendees into in-memory list (DB is the source of truth)
      const mergedMap = new Map();
      // Start with in-memory
      for (const a of session.attendees) {
        mergedMap.set(String(a.internId), a);
      }
      // Overwrite/add with DB results
      for (const a of dbAttendees) {
        mergedMap.set(String(a.internId), a);
      }
      session.attendees = Array.from(mergedMap.values());

      // Auto-close session if limit reached
      if (session.limit !== null && session.attendees.length >= session.limit && session.status === "Active") {
        session.status = "Ended";
      }
    } catch (dbErr) {
      console.warn("Failed to query DB attendees for session:", dbErr.message);
    }

    res.status(200).json(session);
  } catch (error) {
    res.status(500).json({ message: "Error fetching session status", error: error.message });
  }
};

const expireSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = activeQrSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    session.status = "Ended";
    res.status(200).json({ message: "Session ended successfully", session });
  } catch (error) {
    res.status(500).json({ message: "Error expiring session", error: error.message });
  }
};



const markAttendance = async (req, res) => {
  const { internId, status } = req.body; 

  try {
    await qrCodeService.markAttendance(internId, status);
    res.status(200).json({ message: "Attendance marked successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error marking attendance", error: error.message });
  }
};


const scanQRCode = async (req, res) => {
  const {
    qrCode,
    internId: bodyInternId,
    scanType = 'daily',
    attendanceAction,
    lat,
    lng,
    accuracy,
    capturedAt,
    deviceTime,
    deviceTimeZone,
    deviceUtcOffsetMinutes,
  } = req.body;

  // Identity verification: use token identity, reject mismatches
  const tokenInternId = req.user?.id;
  const internId = bodyInternId || tokenInternId;

  if (!internId) {
    return res.status(400).json({ message: "Intern ID is required." });
  }

  if (bodyInternId && bodyInternId !== tokenInternId) {
    return res.status(403).json({ message: "You can only mark your own attendance." });
  }

  try {
    // Validate QR code format based on scan type
    if (scanType === 'daily') {
      // Accept both daily_attendance_ and attendance_session_ for backward compatibility
      if (!qrCode.includes('daily_attendance_') && !qrCode.includes('attendance_session_')) {
        return res.status(400).json({ message: "Invalid QR code format. This QR code is not for daily attendance." });
      }
      var locationValidation = await AttendanceSettingsService.validateSltLocationIfRequired({
        lat,
        lng,
        accuracy,
        capturedAt,
        label: "Attendance",
      });
    }
    const isValid = await qrCodeService.verifyQRCode(qrCode);
    if (!isValid) {
      return res.status(400).json({ message: "QR code is expired or invalid." });
    }

    // For daily attendance scans, only update existing DailyRecord attendance fields (if any).
    // DO NOT create a new logbook entry or set its task from QR scans.
    if (scanType === 'daily') {
      const attendanceResult = await qrCodeService.markInternDailyAttendance(
        internId,
        qrCode,
        { attendanceAction },
      );
      await saveQrAttendanceAudit({
        internId,
        attendanceType: "daily",
        locationValidation,
        deviceTime,
        deviceTimeZone,
        deviceUtcOffsetMinutes,
        attendanceAction,
      });
      // Get intern info for email notification
      const intern = await InternService.getInternById(internId);
      // Send email notification for daily attendance
      const emailAddress = intern?.Trainee_Email || intern?.email;
      if (intern && emailAddress) {
        const moment = require("moment-timezone");
        const attendanceDate = moment.tz("Asia/Colombo").format("MMMM Do YYYY");
        const attendanceTime = moment.tz("Asia/Colombo").format("HH:mm");
        const emailSubject = "Daily Attendance Marked - SLT Mobitel";
        const emailBody = `
          Hello ${intern.traineeName},

          This is to inform you that your daily attendance has been successfully marked.
          
          📅 Date: ${attendanceDate}
          ⏰ Time: ${attendanceTime}
          ✅ Status: Present
          🆔 Intern ID: ${intern.traineeId}

          Your attendance has been recorded via QR code scan for daily attendance tracking.

          If you have any issues or concerns, please do not hesitate to contact your supervisor.

          Please do not reply to this email. This is an auto-generated message.

          Best regards,
          SLT Mobitel
          Digital Platforms Development Section
        `;
        // --- TEMPORARILY DISABLED EMAIL NOTIFICATION ---
        // sendEmail(emailAddress, emailSubject, emailBody);
      }

      // Update in-memory session for real-time presentation panel
      let extractedSessionId = qrCode;
      try {
        const payload = JSON.parse(qrCode);
        if (payload.sessionId) extractedSessionId = payload.sessionId;
      } catch (e) {}

      const session = activeQrSessions.get(extractedSessionId);
      if (session) {
        const internData = await Intern.findById(internId);
        if (internData && !session.attendees.some(a => a.internId.toString() === internData._id.toString())) {
          session.attendees.push({
            internId: internData._id,
            traineeId: internData.Trainee_ID,
            traineeName: internData.Trainee_Name,
            stack: internData.field_of_spec_name,
            profileImage: internData.googlePictureUrl,
            attendanceRate: calculateAttendanceRate(internData),
            meetingAttendanceRate: calculateMeetingAttendanceRate(internData),
            totalMeetings: countMeetingAttendances(internData),
            timeMarked: new Date()
          });
          if (session.limit !== null && session.attendees.length >= session.limit) {
            session.status = "Ended";
          }
        }
      }

      res.status(200).json({ 
        message: attendanceResult.message,
        dailyAttendanceUpdated: true,
        checkedOut: attendanceResult.checkedOut,
        timeMarked: attendanceResult.timeMarked
      });
    } else {
      // For meeting/general attendance scans, use the old system (intern.attendance)
      const status = "Present";
      const updatedIntern = await attendanceService.markAttendanceAndNotify(internId, status);

      // Also attempt to mark daily attendance
      let dailyAttendanceUpdated = false;
      try {
        const attendanceResult = await qrCodeService.markInternDailyAttendance(internId, qrCode, {
          allowCheckout: false,
        });
        dailyAttendanceUpdated = Boolean(attendanceResult.dailyAttendanceMarked);
      } catch (e) {
        // Ignore errors (like duplicates) for the automatic part
      }

      // Update in-memory session for real-time presentation panel
      let extractedSessionId = qrCode;
      try {
        const payload = JSON.parse(qrCode);
        if (payload.sessionId) extractedSessionId = payload.sessionId;
      } catch (e) {}

      const session = activeQrSessions.get(extractedSessionId);
      if (session) {
        const internData = await Intern.findById(internId);
        if (internData && !session.attendees.some(a => a.internId.toString() === internData._id.toString())) {
          session.attendees.push({
            internId: internData._id,
            traineeId: internData.Trainee_ID,
            traineeName: internData.Trainee_Name,
            stack: internData.field_of_spec_name,
            profileImage: internData.googlePictureUrl,
            attendanceRate: calculateAttendanceRate(internData),
            meetingAttendanceRate: calculateMeetingAttendanceRate(internData),
            totalMeetings: countMeetingAttendances(internData),
            timeMarked: new Date()
          });
          if (session.limit !== null && session.attendees.length >= session.limit) {
            session.status = "Ended";
          }
        }
      }

      res.status(200).json({ 
        message: "Attendance marked successfully",
        dailyAttendanceUpdated: dailyAttendanceUpdated
      });
    }
  } catch (error) {
    const rawMessage = error.message || "";
    const shouldShowSpecificMessage =
      Boolean(error.locationRequired) ||
      Boolean(error.statusCode) ||
      rawMessage.includes("Duplicate") ||
      rawMessage.includes("already marked") ||
      rawMessage.includes("Invalid QR code") ||
      rawMessage.includes("Meeting title") ||
      rawMessage.includes("Project name") ||
      rawMessage.includes("expired");

    res.status(error.statusCode || (error.message?.includes("Duplicate") ? 400 : 500)).json({
      message: shouldShowSpecificMessage ? error.message : "Error processing QR code",
      error: error.message,
      locationRequired: Boolean(error.locationRequired),
      code: error.code,
      retryAfterMinutes: error.retryAfterMinutes,
    });
  }
};

// Intern scans QR code to mark meeting attendance
const scanMeetingQRCode = async (req, res) => {
  const {
    qrCode,
    internId: bodyInternId,
    projectName,
    meetingTitle,
    lat,
    lng,
    accuracy,
    capturedAt,
    deviceTime,
    deviceTimeZone,
    deviceUtcOffsetMinutes,
  } = req.body;
  const submittedProjectName = normalizeProjectName(projectName || meetingTitle || "");

  // Identity verification: use token identity, reject mismatches
  const tokenInternId = req.user?.id;
  const internId = bodyInternId || tokenInternId;

  if (!internId) {
    return res.status(400).json({ message: "Intern ID is required." });
  }

  if (bodyInternId && bodyInternId !== tokenInternId) {
    return res.status(403).json({ message: "You can only mark your own attendance." });
  }
  try {
    const locationValidation = await AttendanceSettingsService.validateSltLocationIfRequired({
      lat,
      lng,
      accuracy,
      capturedAt,
      label: "Meeting attendance",
    });

    if (!submittedProjectName) {
      return res.status(400).json({ message: "Project name is required." });
    }
    // Try to parse QR code as JSON
    let qrPayload;
    try {
      qrPayload = JSON.parse(qrCode);
    } catch (e) {
      return res.status(400).json({ message: "Invalid QR code format. Please scan a valid meeting attendance QR code." });
    }
    // Validate QR code type
    if (qrPayload.type !== "meeting_attendance") {
      return res.status(400).json({ message: "Invalid QR code type. Please scan a valid meeting attendance QR code." });
    }
    const qrProjectName = normalizeProjectName(qrPayload.projectName || qrPayload.meetingTitle || "");
    if (getProjectKey(qrProjectName) !== getProjectKey(submittedProjectName)) {
      return res.status(400).json({ message: `Project name mismatch. QR code is for '${qrProjectName}', but you entered '${submittedProjectName}'.` });
    }
    // Optionally, check expiry (1 hour)
    const now = Date.now();
    if (qrPayload.timestamp && now - qrPayload.timestamp > 60 * 60 * 1000) {
      return res.status(400).json({ message: "QR code is expired." });
    }

    // Check session limit and status if sessionId exists in the payload
    let session = null;
    if (qrPayload.sessionId) {
      session = activeQrSessions.get(qrPayload.sessionId);
      if (session) {
        if (session.status === "Ended") {
          return res.status(400).json({ message: "This QR session has been ended by the admin." });
        }
        if (now > session.expiresAt || session.status === "Expired") {
          session.status = "Expired";
          return res.status(400).json({ message: "QR code is expired." });
        }
        // Check if already in attendees
        if (session.attendees.some(a => a.internId.toString() === internId.toString())) {
          return res.status(400).json({ message: "Attendance for this meeting is already marked." });
        }
        // Check limit
        if (session.limit !== null && session.attendees.length >= session.limit) {
          session.status = "Ended";
          return res.status(400).json({ message: "Attendance limit reached." });
        }
      }
    }

    // Mark meeting attendance in TalentHub system
    const result = await qrCodeService.markMeetingAttendance(internId, submittedProjectName, qrCode);
    
    if (session) {
      // Add intern to active session attendees
      const internData = await Intern.findById(internId);
      if (internData) {
        session.attendees.push({
          internId: internData._id,
          traineeId: internData.Trainee_ID,
          traineeName: internData.Trainee_Name,
          stack: internData.field_of_spec_name,
          profileImage: internData.googlePictureUrl,
          attendanceRate: calculateAttendanceRate(internData),
          meetingAttendanceRate: calculateMeetingAttendanceRate(internData),
          totalMeetings: countMeetingAttendances(internData),
          timeMarked: new Date()
        });
        if (session.limit !== null && session.attendees.length >= session.limit) {
          session.status = "Ended";
        }
      }
    }

    await saveQrAttendanceAudit({
      internId,
      attendanceType: "meeting",
      locationValidation,
      deviceTime,
      deviceTimeZone,
      deviceUtcOffsetMinutes,
      projectName: submittedProjectName,
    });
    const message = result.dailyAttendanceMarked
      ? "Meeting attendance marked successfully. Daily attendance also recorded."
      : "Meeting attendance marked successfully.";
    res.status(200).json({ 
      message,
      intern: result.intern,
      meeting: result.meeting,
      dailyAttendanceMarked: result.dailyAttendanceMarked
    });
  } catch (error) {
    const rawMessage = error.message || "";
    const shouldShowSpecificMessage =
      Boolean(error.locationRequired) ||
      Boolean(error.statusCode) ||
      rawMessage.includes("Duplicate") ||
      rawMessage.includes("already marked") ||
      rawMessage.includes("Project name");

    res.status(error.statusCode || (error.message?.includes("Duplicate") ? 400 : 500)).json({
      message: shouldShowSpecificMessage
        ? error.message
        : "Error processing meeting attendance",
      error: error.message,
      locationRequired: Boolean(error.locationRequired),
    });
  }
};


module.exports = { 
  generateQRCode, 
  markAttendance, 
  scanQRCode, 
  scanMeetingQRCode,
  getSessionStatus,
  expireSession
};
