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
    const { internId, type, projectName, meetingTitle } = req.query;
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
      const meetingData = {
        type: 'meeting_attendance',
        projectName: normalizedProjectName,
        meetingTitle: normalizedProjectName,
        timestamp: Date.now()
      };

      if (internId) {
        meetingData.internId = internId;
      }

      sessionId = JSON.stringify(meetingData);
    }
    
    const qrCode = await QRCode.toDataURL(sessionId); 

    res.status(200).json({ qrCode, sessionId, type });  
  } catch (error) {
    res.status(500).json({ message: "Error generating QR Code", error: error.message });
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
    // Mark meeting attendance in TalentHub system
    const result = await qrCodeService.markMeetingAttendance(internId, submittedProjectName, qrCode);
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
  scanMeetingQRCode
};
