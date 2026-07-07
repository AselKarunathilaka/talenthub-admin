const QRCode = require("qrcode");
const InternRepository = require("../repositories/internRepository");

const nodemailer = require("nodemailer");
const dotenv = require("../config/dotenv");
const sendEmail = require("../utils/emailSender");
const AttendanceWorkflowService = require("./attendanceWorkflowService");
const externalConfig = require("../config/externalSystems");

// Generate QR Code for marking attendance
const generateQRCode = async (internId) => {
  const qrData = `attendance_session_${internId}_${new Date().getTime()}`; 
  const qrCode = await QRCode.toDataURL(qrData); 
  return qrCode;
};
// ...existing code...




// Function to send email notification on attendance marking
const sendAttendanceNotification = async (internEmail, traineeId) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: internEmail,
    subject: "Attendance Marked",
    text: `Your attendance for trainee ID: ${traineeId} has been marked successfully.`,
  };

  await transporter.sendMail(mailOptions);
};

const markAttendance = async (internId, status) => {
  // Use InternRepository to get intern
  const intern = await InternRepository.getInternById(internId);
  if (!intern) throw new Error("Intern not found");

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const existingAttendance = intern.attendance.find(
    (a) => {
      const aDate = new Date(a.date);
      return aDate.getFullYear() === todayStart.getFullYear() &&
             aDate.getMonth() === todayStart.getMonth() &&
             aDate.getDate() === todayStart.getDate();
    }
  );

  if (existingAttendance) {
    existingAttendance.status = status;
  } else {
    intern.attendance.push({ date: today, status });
  }

  await intern.save();

  // Optionally, send attendance notification email
  if (intern.Trainee_Email && intern.Trainee_ID) {
    await sendAttendanceNotification(intern.Trainee_Email, intern.Trainee_ID);
  }

  return {
    success: true,
    message: "Attendance marked successfully",
    intern: {
      traineeId: intern.Trainee_ID,
      traineeName: intern.Trainee_Name,
      email: intern.Trainee_Email
    },
    status
  };
};
  
// ...existing code...

// Verify QR code (check if it's expired or valid)
const verifyQRCode = async (qrCode) => {
  if (!qrCode || typeof qrCode !== 'string') {
    return false;
  }

  let qrCodeTime;
  
  // Check for daily attendance QR code format: daily_attendance_{internId}_{timestamp}
  if (qrCode.includes('daily_attendance_')) {
    const qrCodeParts = qrCode.split("_");
    
    // Validate format: ['daily', 'attendance', 'internId', 'timestamp'] or ['daily', 'attendance', 'timestamp']
    if (qrCodeParts.length < 3 || qrCodeParts[0] !== 'daily' || qrCodeParts[1] !== 'attendance') {
      return false;
    }
    
    // Extract timestamp (last part)
    qrCodeTime = parseInt(qrCodeParts[qrCodeParts.length - 1]);
  }
  // Check for meeting attendance QR code format: attendance_session_{internId}_{timestamp}
  else if (qrCode.includes('attendance_session_')) {
    const qrCodeParts = qrCode.split("_");
    
    // Validate format: ['attendance', 'session', 'internId', 'timestamp'] or ['attendance', 'session', 'timestamp']
    if (qrCodeParts.length < 3 || qrCodeParts[0] !== 'attendance' || qrCodeParts[1] !== 'session') {
      return false;
    }
    
    // Extract timestamp (last part)
    qrCodeTime = parseInt(qrCodeParts[qrCodeParts.length - 1]);
  }
  // Invalid QR code format
  else {
    return false;
  }

  // Validate that timestamp is a valid number
  if (isNaN(qrCodeTime)) {
    return false;
  }

  const currentTime = new Date().getTime();
  
  // QR Code expires in 1 hour (3600000 milliseconds)
  if (currentTime - qrCodeTime > 3600000) {
    return false;
  }

  return true;
};





// Mark intern daily attendance (for intern-side scanning)
const markInternDailyAttendanceLegacy = async (internId, qrCode = null) => {
  const DailyRecord = require("../models/DailyRecord");
  const Intern = require("../models/Intern");
  const externalSystemService = require("./externalSystemService");
  
  const intern = await Intern.findById(internId);
  if (!intern) throw new Error("Intern not found");
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Find existing daily record for today
  let dailyRecord = await DailyRecord.findOne({ internId, date: today });
  
  if (dailyRecord) {
    // Update existing record with attendance
    dailyRecord.attendance = "present";
    dailyRecord.attendanceTime = new Date();
    await dailyRecord.save();
  }
  // Note: We don't create a new daily record if one doesn't exist
  // The intern should fill their daily log first
};
  
// Mark meeting attendance
// Uses a MongoDB transaction to ensure DailyRecord and Intern.attendance writes
// are atomic — both succeed or both roll back, preventing data inconsistency.
const markMeetingAttendance = async (internId, projectName, qrCode = null) => {
  const result = await AttendanceWorkflowService.markMeetingAttendance({
    internId,
    projectName,
    sessionId: qrCode,
    method: "qr",
    duplicateMessage: "Attendance for this project is already marked today.",
    syncEndpoint: externalConfig.attendanceSystem.endpoints.scanMeeting,
    dailySyncEndpoint: externalConfig.attendanceSystem.endpoints.scanDaily,
    autoMarkDaily: true,
    dailyMethod: "daily_qr",
  });
  const { intern } = result;

  return {
    intern: {
      id: intern._id,
      traineeId: intern.Trainee_ID,
      traineeName: intern.Trainee_Name,
      email: intern.Trainee_Email
    },
    meeting: {
      title: result.meeting.title,
      status: "present",
      time: result.meeting.time
    },
    dailyAttendanceMarked: result.dailyAttendanceMarked
  }
};

// Mark daily attendance for an intern (do NOT auto-create DailyRecord/logbook)
// Note: The logbook (DailyRecord) must be filled by the intern manually.
// On QR scan, we only update attendance fields if a DailyRecord for today already exists.
//
// Uses a MongoDB transaction when updating both DailyRecord and Intern.attendance
// to ensure atomic consistency — both writes succeed or both roll back.
<<<<<<< HEAD
const markInternDailyAttendance = async (internId, qrCode, options = {}) => {
=======
const markInternDailyAttendance = async (internId, qrCode) => {
>>>>>>> talenthub/main
  const result = await AttendanceWorkflowService.markDailyAttendance({
    internId,
    sessionId: qrCode,
    method: "daily_qr",
    duplicateMessage: "Duplicate daily QR scan detected. Please wait before scanning again.",
    syncEndpoint: externalConfig.attendanceSystem.endpoints.scanDaily,
<<<<<<< HEAD
    allowCheckout: options.allowCheckout !== false,
    attendanceAction: options.attendanceAction || "check_in",
=======
>>>>>>> talenthub/main
  });
  const { intern } = result;

  return {
    success: true,
<<<<<<< HEAD
    message: result.checkedOut
      ? "Checked out successfully"
      : "Checked in successfully",
=======
    message: "Daily attendance marked successfully",
>>>>>>> talenthub/main
    intern: {
      traineeId: intern.Trainee_ID,
      traineeName: intern.Trainee_Name
    },
    timeMarked: result.timeMarked,
<<<<<<< HEAD
    checkedOut: result.checkedOut,
    dailyAttendanceMarked: result.dailyAttendanceMarked,
=======
>>>>>>> talenthub/main
    type: "daily_qr"
  };
};

module.exports = { 
  generateQRCode, 
  markAttendance, 
  markInternDailyAttendance,
  markInternDailyAttendanceLegacy,
  markMeetingAttendance, 
  verifyQRCode 
};
