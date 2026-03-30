const QRCode = require("qrcode");
const InternRepository = require("../repositories/internRepository");

const nodemailer = require("nodemailer");
const dotenv = require("../config/dotenv");

// Store active QR codes with expiry
const activeQRCodes = new Map();

// Generate QR Code for marking attendance (legacy - for backward compatibility)
const generateQRCode = async (internId) => {
  const qrData = `attendance_session_${internId}_${new Date().getTime()}`; 
  const qrCode = await QRCode.toDataURL(qrData); 
  return qrCode;
};

// Generate Meeting QR Code with 10-minute expiry and meetingTitle
const generateMeetingQR = async (meetingTitle = "") => {
  const currentTime = new Date().getTime();
  const sessionId = `meeting_attendance_${currentTime}`;
  // Encode meetingTitle in QR code as JSON
  const qrPayload = JSON.stringify({
    type: 'meeting_attendance',
    sessionId,
    meetingTitle,
    timestamp: currentTime
  });
  const qrData = {
    sessionId,
    type: 'meeting_attendance',
    meetingTitle,
    generatedAt: currentTime,
    expiresAt: currentTime + (10 * 60 * 1000), // 10 minutes
    usedBy: [] // Track which interns have used this QR
  };
  // Store in memory (in production, use Redis or database)
  activeQRCodes.set(sessionId, qrData);
  // Clean up expired QR codes
  cleanupExpiredQRCodes();
  const qrCode = await QRCode.toDataURL(qrPayload);
  return { qrCode, sessionId, expiresAt: qrData.expiresAt, meetingTitle };
};

// Generate Daily Attendance QR Code with 30-second expiry
const generateDailyAttendanceQR = async () => {
  const currentTime = new Date().getTime();
  const sessionId = `daily_attendance_${currentTime}`;
  const qrData = {
    sessionId,
    type: 'daily_attendance',
    generatedAt: currentTime,
    expiresAt: currentTime + (30 * 1000), // 30 seconds
    usedBy: [] // Track which interns have used this QR
  };
  
  // Store in memory (in production, use Redis or database)
  activeQRCodes.set(sessionId, qrData);
  
  // Clean up expired QR codes
  cleanupExpiredQRCodes();
  
  const qrCode = await QRCode.toDataURL(sessionId);
  return { qrCode, sessionId, expiresAt: qrData.expiresAt };
};

// Clean up expired QR codes
const cleanupExpiredQRCodes = () => {
  const now = new Date().getTime();
  for (const [sessionId, data] of activeQRCodes.entries()) {
    if (data.expiresAt < now) {
      activeQRCodes.delete(sessionId);
    }
  }
};


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
  const intern = await InternRepository.getInternById(internId);
  if (!intern) throw new Error("Intern not found");

  const today = new Date().setHours(0, 0, 0, 0);
  const existingAttendance = intern.attendance.find(
    (a) => new Date(a.date).setHours(0, 0, 0, 0) === today
  );

  if (existingAttendance) {
    existingAttendance.status = status;
  } else {
    intern.attendance.push({ date: new Date(), status });
  }

  await intern.save();

  // Send email notification
  await sendAttendanceNotification(intern.email, intern.traineeId);
};

// Verify QR code (check if it's expired or valid)
const verifyQRCode = async (qrCode) => {
  const sessionId = qrCode.split("_")[1];  // Extract sessionId from QR code
  const currentTime = new Date().getTime();
  const qrCodeTime = parseInt(qrCode.split("_")[2]);

  if (currentTime - qrCodeTime > 3600000) {  // QR Code expires in 1 hour
    return false;
  }

  return true;
};

// Verify Meeting QR Code
const verifyMeetingQR = async (qrContent, internId) => {
  // Extract sessionId from QR content
  // Handle both formats: "attendance_session_meeting_attendance_timestamp" and "meeting_attendance_timestamp"
  let sessionId;
  if (qrContent.startsWith('attendance_session_meeting_attendance_')) {
    // New format: attendance_session_meeting_attendance_timestamp
    const timestamp = qrContent.replace('attendance_session_meeting_attendance_', '');
    sessionId = `meeting_attendance_${timestamp}`;
  } else if (qrContent.startsWith('meeting_attendance_')) {
    // Old format: meeting_attendance_timestamp
    sessionId = qrContent;
  } else {
    return { valid: false, message: "Invalid QR code format" };
  }
  
  const qrData = activeQRCodes.get(sessionId);
  
  if (!qrData) {
    return { valid: false, message: "QR code not found or expired" };
  }
  
  const currentTime = new Date().getTime();
  
  if (currentTime > qrData.expiresAt) {
    activeQRCodes.delete(sessionId);
    return { valid: false, message: "QR code has expired" };
  }
  
  if (qrData.type !== 'meeting_attendance') {
    return { valid: false, message: "Invalid QR code type" };
  }
  
  // Check if intern has already used this QR code
  if (qrData.usedBy.includes(internId)) {
    return { valid: false, message: "Attendance already marked with this QR code" };
  }
  
  return { valid: true, qrData, sessionId, message: "QR code is valid" };
};

// Verify Daily Attendance QR Code
const verifyDailyAttendanceQR = async (sessionId, internId) => {
  const qrData = activeQRCodes.get(sessionId);
  
  if (!qrData) {
    return { valid: false, message: "QR code not found or expired" };
  }
  
  const currentTime = new Date().getTime();
  
  // Check if QR code has expired
  if (currentTime > qrData.expiresAt) {
    activeQRCodes.delete(sessionId);
    return { valid: false, message: "QR code has expired" };
  }
  
  // Check if intern has already used this QR code
  if (qrData.usedBy.includes(internId)) {
    return { valid: false, message: "You have already marked attendance with this QR code" };
  }
  
  return { valid: true, qrData };
};

// Mark attendance via Daily QR scan
const markDailyAttendanceQR = async (sessionId, internId) => {
  const verification = await verifyDailyAttendanceQR(sessionId, internId);
  
  if (!verification.valid) {
    throw new Error(verification.message);
  }
  
  // Add intern to used list
  verification.qrData.usedBy.push(internId);
  activeQRCodes.set(sessionId, verification.qrData);
  
  // Mark attendance with timestamp
  const intern = await InternRepository.getInternById(internId);
  if (!intern) throw new Error("Intern not found");

  const moment = require("moment-timezone");
  
  // Use Sri Lankan timezone for all date operations
  const todaySriLanka = moment.tz("Asia/Colombo").startOf('day');
  const attendanceTime = moment.tz("Asia/Colombo").toDate();

  // Find existing attendance for today using Sri Lankan timezone
  const existingAttendance = intern.attendance.find((a) => {
    const attendanceDate = moment.tz(a.date, "Asia/Colombo").startOf('day');
    const isToday = attendanceDate.isSame(todaySriLanka, 'day');
    return isToday;
  });

  if (existingAttendance) {
    existingAttendance.status = "Present";
    existingAttendance.timeMarked = attendanceTime;
    existingAttendance.type = 'daily_qr';
  } else {
    const newAttendance = { 
      date: todaySriLanka.toDate(), // Use the proper Sri Lankan date
      status: "Present",
      timeMarked: attendanceTime,
      type: 'daily_qr'
    };
    intern.attendance.push(newAttendance);
  }

  await intern.save();

  // Send email notification
  await sendAttendanceNotification(intern.email, intern.traineeId);
  
  return {
    intern,
    timeMarked: attendanceTime,
    message: "Daily attendance marked successfully"
  };
};

// Mark Meeting Attendance using QR Code
const markMeetingAttendanceQR = async (qrContent, internId) => {
  const verification = await verifyMeetingQR(qrContent, internId);
  
  if (!verification.valid) {
    throw new Error(verification.message);
  }
  
  // Add intern to used list
  verification.qrData.usedBy.push(internId);
  activeQRCodes.set(verification.sessionId, verification.qrData);
  
  // Mark attendance with timestamp
  const intern = await InternRepository.getInternById(internId);
  if (!intern) throw new Error("Intern not found");

  const moment = require("moment-timezone");
  
  // Use Sri Lankan timezone for all date operations
  const todaySriLanka = moment.tz("Asia/Colombo").startOf('day');
  const attendanceTime = moment.tz("Asia/Colombo").toDate();

  // Find existing meeting attendance for today (qr type only, not daily_qr)
  const existingAttendanceIndex = intern.attendance.findIndex((a) => {
    const attendanceDate = moment.tz(a.date, "Asia/Colombo").startOf('day');
    const isToday = attendanceDate.isSame(todaySriLanka, 'day');
    return isToday && a.type === 'qr';
  });

  if (existingAttendanceIndex !== -1) {
    intern.attendance[existingAttendanceIndex].status = "Present";
    intern.attendance[existingAttendanceIndex].timeMarked = attendanceTime;
  } else {
    const newAttendance = { 
      date: todaySriLanka.toDate(), // Use the proper Sri Lankan date
      status: "Present",
      timeMarked: attendanceTime,
      type: 'qr'
    };
    intern.attendance.push(newAttendance);
  }

  await intern.save();

  // Send email notification
  await sendAttendanceNotification(intern.email, intern.traineeId);
  
  return {
    intern,
    timeMarked: attendanceTime,
    message: "Meeting attendance marked successfully"
  };
};

// Get current active QR code info for daily attendance
const getCurrentQRInfo = () => {
  cleanupExpiredQRCodes();
  const activeQRs = Array.from(activeQRCodes.values())
    .filter(qr => qr.type === 'daily_attendance')
    .sort((a, b) => b.generatedAt - a.generatedAt);
  
  return activeQRs.length > 0 ? activeQRs[0] : null;
};

// Get current active meeting QR code info
const getCurrentMeetingQRInfo = () => {
  cleanupExpiredQRCodes();
  const activeQRs = Array.from(activeQRCodes.values())
    .filter(qr => qr.type === 'meeting_attendance')
    .sort((a, b) => b.generatedAt - a.generatedAt);
  
  return activeQRs.length > 0 ? activeQRs[0] : null;
};

// Mark daily attendance from external system (TalentHub)
const markExternalDailyAttendance = async (internId, qrSessionId) => {
  const intern = await InternRepository.getInternById(internId);
  if (!intern) throw new Error("Intern not found");

  const moment = require("moment-timezone");
  
  // Use Sri Lankan timezone for all date operations
  const todaySriLanka = moment.tz("Asia/Colombo").startOf('day');
  const attendanceTime = moment.tz("Asia/Colombo").toDate();

  // Find existing daily attendance for today (daily_qr type)
  const existingAttendanceIndex = intern.attendance.findIndex((a) => {
    const attendanceDate = moment.tz(a.date, "Asia/Colombo").startOf('day');
    const isToday = attendanceDate.isSame(todaySriLanka, 'day');
    return isToday && a.type === 'daily_qr';
  });

  if (existingAttendanceIndex !== -1) {
    // Update existing daily attendance
    intern.attendance[existingAttendanceIndex].status = "Present";
    intern.attendance[existingAttendanceIndex].timeMarked = attendanceTime;
    intern.attendance[existingAttendanceIndex].markedBy = "external_system"; // Ensure method is set
    intern.attendance[existingAttendanceIndex].sessionId = qrSessionId; // Ensure session ID is set
  } else {
    // Create new daily attendance record
    intern.attendance.push({
      date: todaySriLanka.toDate(),
      status: "Present",
      type: "daily_qr", // Daily QR type
      timeMarked: attendanceTime,
      markedBy: "external_system", // Indicate this came from TalentHub
      sessionId: qrSessionId
    });
  }

  await InternRepository.updateIntern(intern._id, intern);

  return {
    success: true,
    message: "Daily attendance marked successfully via external system",
    intern: {
      traineeId: intern.traineeId,
      traineeName: intern.traineeName
    },
    timeMarked: attendanceTime,
    type: "daily_qr"
  };
};

// Mark meeting attendance from external system (TalentHub)
const markExternalMeetingAttendance = async (internId, qrSessionId) => {
  const intern = await InternRepository.getInternById(internId);
  if (!intern) throw new Error("Intern not found");

  const moment = require("moment-timezone");
  
  // Use Sri Lankan timezone for all date operations
  const todaySriLanka = moment.tz("Asia/Colombo").startOf('day');
  const attendanceTime = moment.tz("Asia/Colombo").toDate();

  // Find existing meeting attendance for today (qr type only, not daily_qr)
  const existingAttendanceIndex = intern.attendance.findIndex((a) => {
    const attendanceDate = moment.tz(a.date, "Asia/Colombo").startOf('day');
    const isToday = attendanceDate.isSame(todaySriLanka, 'day');
    return isToday && a.type === 'qr';
  });

  if (existingAttendanceIndex !== -1) {
    // Update existing meeting attendance
    intern.attendance[existingAttendanceIndex].status = "Present";
    intern.attendance[existingAttendanceIndex].timeMarked = attendanceTime;
    intern.attendance[existingAttendanceIndex].markedBy = "external_system"; // Ensure method is set
    intern.attendance[existingAttendanceIndex].sessionId = qrSessionId; // Ensure session ID is set
  } else {
    // Create new meeting attendance record
    intern.attendance.push({
      date: todaySriLanka.toDate(),
      status: "Present",
      type: "qr", // Meeting QR type
      timeMarked: attendanceTime,
      markedBy: "external_system", // Indicate this came from TalentHub
      sessionId: qrSessionId
    });
  }

  await InternRepository.updateIntern(intern._id, intern);

  return {
    success: true,
    message: "Meeting attendance marked successfully via external system",
    intern: {
      traineeId: intern.traineeId,
      traineeName: intern.traineeName
    },
    timeMarked: attendanceTime,
    type: "qr"
  };
};

module.exports = {
  verifyQRCode,
  generateDailyAttendanceQR,
  verifyDailyAttendanceQR,
  markDailyAttendanceQR,
  generateMeetingQR,
  verifyMeetingQR,
  markMeetingAttendanceQR,
  markExternalDailyAttendance,
  markExternalMeetingAttendance,
  getCurrentQRInfo,
  getCurrentMeetingQRInfo
};
