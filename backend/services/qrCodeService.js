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
const markInternDailyAttendance = async (internId) => {
  const DailyRecord = require("../models/DailyRecord");
  const Intern = require("../models/Intern");
  
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
  
  return {
    intern: {
      id: intern._id,
      traineeId: intern.traineeId,
      traineeName: intern.traineeName,
      email: intern.email
    },
    attendance: {
      date: today,
      status: "present",
      time: new Date()
    }
  };
};

// Mark meeting attendance
const markMeetingAttendance = async (internId, meetingTitle) => {
  const DailyRecord = require("../models/DailyRecord");
  const Intern = require("../models/Intern");
  
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
  
  // Send email notification for meeting attendance
  if (intern.email) {
    const sendEmail = require("../utils/emailSender");
    const moment = require("moment-timezone");
    const attendanceDate = moment.tz("Asia/Colombo").format("MMMM Do YYYY");
    const attendanceTime = moment.tz("Asia/Colombo").format("h:mm A");
    
    const emailSubject = "Meeting Attendance Marked - SLT Mobitel";
    const emailBody = `
      Hello ${intern.traineeName},

      This is to confirm that your meeting attendance has been successfully recorded.
      
      📅 Date: ${attendanceDate}
      ⏰ Time: ${attendanceTime}
      🏢 Meeting: ${meetingTitle}
      ✅ Status: Present
      🆔 Intern ID: ${intern.traineeId}

      Your attendance has been recorded via QR code scan for the specified meeting.

      If you have any issues or concerns, please do not hesitate to contact your supervisor.

      Please do not reply to this email. This is an auto-generated message.

      Best regards,
      SLT Mobitel
      Digital Platforms Development Section
    `;
    sendEmail(intern.email, emailSubject, emailBody);
  }
  
  return {
    intern: {
      id: intern._id,
      traineeId: intern.traineeId,
      traineeName: intern.traineeName,
      email: intern.email
    },
    meeting: {
      title: meetingTitle,
      status: "present",
      time: new Date()
    }
  };
};

module.exports = { 
  generateQRCode, 
  markAttendance, 
  markInternDailyAttendance,
  markMeetingAttendance, 
  verifyQRCode 
};
