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




// Function to send email notification for daily attendance
const sendDailyAttendanceNotification = async (internEmail, traineeId, traineeName, attendanceTime) => {
  const transporter = nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const formattedTime = new Date(attendanceTime).toLocaleString('en-US', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: internEmail,
    subject: "Daily Attendance Marked - SLT Mobitel",
    text: `Hello ${traineeName},

Your daily attendance has been successfully marked via QR code scan.

Details:
- Trainee ID: ${traineeId}
- Date & Time: ${formattedTime}
- Status: Present
- Type: Daily Attendance

This confirms your presence for today's work session. Please ensure you continue to scan the QR code daily to maintain accurate attendance records.

If you have any questions, please contact your supervisor.

Best regards,
SLT Mobitel
Digital Platforms Development Section

---
This is an automated message. Please do not reply to this email.`,
  };

  await transporter.sendMail(mailOptions);
};

// Function to send email notification for meeting attendance
const sendMeetingAttendanceNotification = async (internEmail, traineeId, traineeName, meetingTitle, attendanceTime) => {
  const transporter = nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const formattedTime = new Date(attendanceTime).toLocaleString('en-US', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: internEmail,
    subject: `Meeting Attendance Confirmed - ${meetingTitle}`,
    text: `Hello ${traineeName},

Your attendance has been successfully recorded for the following meeting:

Meeting Details:
- Meeting Title: ${meetingTitle}
- Trainee ID: ${traineeId}
- Date & Time: ${formattedTime}
- Status: Present

Thank you for attending this meeting. Your participation has been noted in our records.

If you have any questions about this meeting or attendance record, please contact your supervisor.

Best regards,
SLT Mobitel
Digital Platforms Development Section

---
This is an automated message. Please do not reply to this email.`,
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

  // Send generic attendance notification (legacy system)
  if (intern.email) {
    try {
      await sendLegacyAttendanceNotification(intern.email, intern.traineeId, intern.traineeName, status);
      console.log(`✅ Legacy attendance email sent to ${intern.traineeName} (${intern.traineeId})`);
    } catch (emailError) {
      console.error(`❌ Failed to send legacy attendance email to ${intern.traineeName}:`, emailError.message);
    }
  }
};

// Function to send email notification for legacy attendance system
const sendLegacyAttendanceNotification = async (internEmail, traineeId, traineeName, status) => {
  const transporter = nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const currentTime = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: internEmail,
    subject: "Attendance Status Updated - SLT Mobitel",
    text: `Hello ${traineeName},

Your attendance status has been updated in our system.

Details:
- Trainee ID: ${traineeId}
- Date & Time: ${currentTime}
- Status: ${status}

If you have any questions about your attendance record, please contact your supervisor.

Best regards,
SLT Mobitel
Digital Platforms Development Section

---
This is an automated message. Please do not reply to this email.`,
  };

  await transporter.sendMail(mailOptions);
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
  const attendanceTime = new Date();
  
  // Find existing daily record for today
  let dailyRecord = await DailyRecord.findOne({ internId, date: today });
  
  if (dailyRecord) {
    // Update existing record with attendance
    dailyRecord.attendance = "present";
    dailyRecord.attendanceTime = attendanceTime;
    await dailyRecord.save();
  }
  // Note: We don't create a new daily record if one doesn't exist
  // The intern should fill their daily log first
  
  // Send daily attendance email notification
  if (intern.email) {
    try {
      await sendDailyAttendanceNotification(
        intern.email, 
        intern.traineeId, 
        intern.traineeName, 
        attendanceTime
      );
      console.log(`✅ Daily attendance email sent to ${intern.traineeName} (${intern.traineeId})`);
    } catch (emailError) {
      console.error(`❌ Failed to send daily attendance email to ${intern.traineeName}:`, emailError.message);
    }
  }
  
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
      time: attendanceTime
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
  const attendanceTime = new Date();
  
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
        attendanceTime: attendanceTime
      }]
    });
  } else {
    // Check if meeting attendance already exists
    const existingMeeting = dailyRecord.meetingAttendance.find(
      meeting => meeting.meetingTitle === meetingTitle
    );
    
    if (existingMeeting) {
      existingMeeting.attendanceStatus = "present";
      existingMeeting.attendanceTime = attendanceTime;
    } else {
      dailyRecord.meetingAttendance.push({
        meetingTitle,
        attendanceStatus: "present",
        attendanceTime: attendanceTime
      });
    }
  }
  
  await dailyRecord.save();
  
  // Send meeting attendance email notification
  if (intern.email) {
    try {
      await sendMeetingAttendanceNotification(
        intern.email, 
        intern.traineeId, 
        intern.traineeName, 
        meetingTitle,
        attendanceTime
      );
      console.log(`✅ Meeting attendance email sent to ${intern.traineeName} (${intern.traineeId}) for meeting: ${meetingTitle}`);
    } catch (emailError) {
      console.error(`❌ Failed to send meeting attendance email to ${intern.traineeName}:`, emailError.message);
    }
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
      time: attendanceTime
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
