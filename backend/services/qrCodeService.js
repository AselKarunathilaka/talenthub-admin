const QRCode = require("qrcode");
const InternRepository = require("../repositories/internRepository");

const nodemailer = require("nodemailer");
const dotenv = require("../config/dotenv");

// Generate QR Code for marking attendance
const generateQRCode = async (internId) => {
  const qrData = `attendance_session_${internId}_${new Date().getTime()}`; 
  const qrCode = await QRCode.toDataURL(qrData); 
  return qrCode;
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
  
  // Sync with Attendance System if QR code is provided
  if (qrCode && intern && intern.Trainee_ID) {
    try {
      // Direct axios call to ensure external sync works
      const axios = require('axios');
      const externalConfig = require('../config/externalSystems');
      
      if (externalConfig.attendanceSystem.enabled) {
        const attendanceSystemUrl = `${externalConfig.attendanceSystem.baseUrl}${externalConfig.attendanceSystem.endpoints.scanDaily}`;
        
        const syncData = {
          qrSessionId: qrCode,
          traineeId: intern.Trainee_ID
        };
        
        const syncResponse = await axios.post(attendanceSystemUrl, syncData, {
          timeout: externalConfig.attendanceSystem.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        // External sync successful - no need to log in production
      }
    } catch (error) {
      // Continue with local processing even if external sync fails
      // Error handling without console logs to avoid production noise
    }
  }
  
  return {
    intern: {
      id: intern._id,
      traineeId: intern.Trainee_ID,
      traineeName: intern.Trainee_Name,
      email: intern.Trainee_Email
    },
    attendance: {
      date: today,
      status: "present",
      time: new Date()
    }
  };
};

// Mark meeting attendance
const markMeetingAttendance = async (internId, meetingTitle, qrCode = null) => {
  const DailyRecord = require("../models/DailyRecord");
  const Intern = require("../models/Intern");
  const externalSystemService = require("./externalSystemService");
  
  const intern = await Intern.findById(internId);
  if (!intern) throw new Error("Intern not found");
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Find or create daily record for today
  let dailyRecord = await DailyRecord.findOne({ internId, date: today });
  
  if (!dailyRecord) {
    // Create new daily record if doesn't exist
    dailyRecord = new DailyRecord({
      internId,
      date: today,
      stack: "Default",
      task: "Meeting attendance marked via QR scan",
      meetingAttendance: [{
        meetingTitle,
        attendanceStatus: "present",
        attendanceTime: new Date()
      }]
    });
  } else {
    // Check if meeting attendance already exists
    const existingMeeting = dailyRecord.meetingAttendance.find(
      meeting => meeting.meetingTitle === meetingTitle
    );
    
    if (existingMeeting) {
      existingMeeting.attendanceStatus = "present";
      existingMeeting.attendanceTime = new Date();
    } else {
      dailyRecord.meetingAttendance.push({
        meetingTitle,
        attendanceStatus: "present",
        attendanceTime: new Date()
      });
    }
  }
  
  await dailyRecord.save();
  
  // Sync with Attendance System if QR code is provided
  if (qrCode && intern && intern.Trainee_ID) {
    try {
      // Direct axios call to ensure external sync works
      const axios = require('axios');
      const externalConfig = require('../config/externalSystems');
      
      if (externalConfig.attendanceSystem.enabled) {
        const attendanceSystemUrl = `${externalConfig.attendanceSystem.baseUrl}${externalConfig.attendanceSystem.endpoints.scanMeeting}`;
        
        const syncData = {
          qrSessionId: qrCode,
          traineeId: intern.Trainee_ID
        };
        
        const syncResponse = await axios.post(attendanceSystemUrl, syncData, {
          timeout: externalConfig.attendanceSystem.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        // External sync successful - no need to log in production
      }
    } catch (error) {
      // Continue with local processing even if external sync fails
      // Error handling without console logs to avoid production noise
    }
  }
  
  // Send email notification for meeting attendance
  if (intern.Trainee_Email) {
    const sendEmail = require("../utils/emailSender");
    const moment = require("moment-timezone");
    const attendanceDate = moment.tz("Asia/Colombo").format("MMMM Do YYYY");
    const attendanceTime = moment.tz("Asia/Colombo").format("h:mm A");
    
    const emailSubject = "Meeting Attendance Marked - SLT Mobitel";
    const emailBody = `
      Hello ${intern.Trainee_Name},

      This is to confirm that your meeting attendance has been successfully recorded.
      
      📅 Date: ${attendanceDate}
      ⏰ Time: ${attendanceTime}
      🏢 Meeting: ${meetingTitle}
      ✅ Status: Present
      🆔 Intern ID: ${intern.Trainee_ID}

      Your attendance has been recorded via QR code scan for the specified meeting.

      If you have any issues or concerns, please do not hesitate to contact your supervisor.

      Please do not reply to this email. This is an auto-generated message.

      Best regards,
      SLT Mobitel
      Digital Platforms Development Section
    `;
    sendEmail(intern.Trainee_Email, emailSubject, emailBody);
  }
  
  return {
    intern: {
      id: intern._id,
      traineeId: intern.Trainee_ID,
      traineeName: intern.Trainee_Name,
      email: intern.Trainee_Email
    },
    meeting: {
      title: meetingTitle,
      status: "present",
      time: new Date()
    }
  };
};

// Mark daily attendance for an intern
const markInternDailyAttendance = async (internId, qrCode) => {
  const DailyRecord = require("../models/DailyRecord");
  const Intern = require("../models/Intern");
  const externalSystemService = require("./externalSystemService");
  
  const intern = await Intern.findById(internId);
  if (!intern) throw new Error("Intern not found");

  const moment = require("moment-timezone");
  
  // Use Sri Lankan timezone for all date operations
  const todaySriLanka = moment.tz("Asia/Colombo").startOf('day');
  const attendanceTime = moment.tz("Asia/Colombo").toDate();
  const today = todaySriLanka.format('YYYY-MM-DD'); // YYYY-MM-DD format

  // Create or update daily record in TalentHub's DailyRecord system
  let dailyRecord = await DailyRecord.findOne({ internId, date: today });
  
  if (!dailyRecord) {
    // Create new daily record - this should ALWAYS be allowed for daily attendance
    dailyRecord = new DailyRecord({
      internId,
      date: today,
      stack: "Default",
      task: "Daily attendance marked via QR scan",
      attendance: "present",
      attendanceTime: attendanceTime
    });
  } else {
    // Update existing daily record
    dailyRecord.attendance = "present";
    dailyRecord.attendanceTime = attendanceTime;
  }
  
  await dailyRecord.save();

  // Also update the old intern.attendance system for backward compatibility
  const existingAttendanceIndex = intern.attendance.findIndex((a) => {
    const attendanceDate = moment.tz(a.date, "Asia/Colombo").startOf('day');
    const isToday = attendanceDate.isSame(todaySriLanka, 'day');
    return isToday && (a.type === 'daily' || a.type === 'daily_qr' || !a.type);
  });

  if (existingAttendanceIndex !== -1) {
    intern.attendance[existingAttendanceIndex].status = "Present";
    intern.attendance[existingAttendanceIndex].timeMarked = attendanceTime;
    intern.attendance[existingAttendanceIndex].type = "daily_qr";
  } else {
    intern.attendance.push({
      date: todaySriLanka.toDate(),
      status: "Present",
      type: "daily_qr",
      timeMarked: attendanceTime,
      qrCode: qrCode
    });
  }

  await intern.save();

  // Sync with external Attendance System
  if (qrCode && intern.Trainee_ID) {
    try {
      // Direct axios call to ensure external sync works
      const axios = require('axios');
      const externalConfig = require('../config/externalSystems');
      
      if (externalConfig.attendanceSystem.enabled) {
        const attendanceSystemUrl = `${externalConfig.attendanceSystem.baseUrl}${externalConfig.attendanceSystem.endpoints.scanDaily}`;
        
        const syncData = {
          qrSessionId: qrCode,
          traineeId: intern.Trainee_ID
        };
        
        const syncResponse = await axios.post(attendanceSystemUrl, syncData, {
          timeout: externalConfig.attendanceSystem.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        // External sync successful - no need to log in production
      }
    } catch (error) {
      // Continue with local processing even if external sync fails
      // Error handling without console logs to avoid production noise
    }
  }

  return {
    success: true,
    message: "Daily attendance marked successfully",
    intern: {
      traineeId: intern.Trainee_ID,
      traineeName: intern.Trainee_Name
    },
    timeMarked: attendanceTime,
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
