const QRCode = require("qrcode");
const InternRepository = require("../repositories/internRepository");

const nodemailer = require("nodemailer");
const dotenv = require("../config/dotenv");
const sendEmail = require("../utils/emailSender");

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
const markMeetingAttendance = async (internId, meetingTitle, qrCode = null) => {
  const DailyRecord = require("../models/DailyRecord");
  const Intern = require("../models/Intern");
  const mongoose = require("mongoose");
  
  const intern = await Intern.findById(internId);
  if (!intern) throw new Error("Intern not found");
  
  const moment = require('moment-timezone');
  const now = moment.tz('Asia/Colombo');
  const attendanceTime = now.toDate();
  const today = now.format('YYYY-MM-DD'); // YYYY-MM-DD format using Sri Lanka timezone
  const oneMinuteAgo = moment(now).subtract(60, 'seconds').toDate();
  
  let dailyRecord = await DailyRecord.findOne({ internId, date: today });
  
  if (dailyRecord) {
    // DailyRecord exists — use a transaction to atomically update both stores
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Step 1: Duplicate check — fail if a recent scan exists for this meeting
        const hasDuplicate = await DailyRecord.findOne(
          {
            _id: dailyRecord._id,
            meetingAttendance: {
              $elemMatch: {
                meetingTitle,
                attendanceStatus: 'present',
                attendanceTime: { $gte: oneMinuteAgo }
              }
            }
          }
        ).session(session);

        if (hasDuplicate) {
          throw new Error("Duplicate meeting QR scan detected. Please wait before scanning again.");
        }

        // Step 2: Remove old entry for this meeting and push new one in a single operation
        // First pull old entry
        await DailyRecord.updateOne(
          { _id: dailyRecord._id },
          { $pull: { meetingAttendance: { meetingTitle } } },
          { session }
        );

        // Then push the new attendance record
        await DailyRecord.updateOne(
          { _id: dailyRecord._id },
          { 
            $push: { 
              meetingAttendance: {
                meetingTitle,
                attendanceStatus: 'present',
                attendanceTime
              }
            }
          },
          { session }
        );

        // Step 3: Also write to Intern.attendance for admin dashboard compatibility
        // Remove any existing meeting entry for today, then push fresh one
        const today_start = moment.tz('Asia/Colombo').startOf('day').toDate();
        const today_end = moment.tz('Asia/Colombo').endOf('day').toDate();

        await Intern.updateOne(
          { _id: internId },
          {
            $pull: {
              attendance: {
                type: 'qr',
                meetingName: meetingTitle,
                date: { $gte: today_start, $lte: today_end }
              }
            }
          },
          { session }
        );

        await Intern.updateOne(
          { _id: internId },
          {
            $push: {
              attendance: {
                date: attendanceTime,
                status: 'Present',
                type: 'qr',
                timeMarked: attendanceTime,
                meetingName: meetingTitle,
                qrCode: qrCode
              }
            }
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    dailyRecord = await DailyRecord.findById(dailyRecord._id);
  } else {
    // No DailyRecord exists — write only to Intern.attendance (legacy path)
    const today_start = moment.tz('Asia/Colombo').startOf('day').toDate();
    const today_end = moment.tz('Asia/Colombo').endOf('day').toDate();
    
    const updatedIntern = await Intern.findOneAndUpdate(
      {
        _id: internId,
        // Condition: NO recent present QR attendance for this meeting exists today
        $nor: [
          {
            attendance: {
              $elemMatch: {
                type: 'qr',
                status: 'Present',
                meetingName: meetingTitle,
                date: { $gte: today_start, $lte: today_end },
                timeMarked: { $gte: oneMinuteAgo }
              }
            }
          }
        ]
      },
      {
        $push: {
          attendance: {
            date: attendanceTime,
            status: 'Present',
            type: 'qr',
            timeMarked: attendanceTime,
            meetingName: meetingTitle,
            qrCode: qrCode
          }
        }
      },
      { new: true }
    );
    
    if (!updatedIntern) {
      throw new Error("Duplicate meeting QR scan detected. Please wait before scanning again.");
    }
  }
  
  // Sync with external Attendance System if QR code is provided
  if (qrCode && intern && intern.Trainee_ID) {
    try {
      const axios = require('axios');
      const externalConfig = require('../config/externalSystems');
      
      if (externalConfig.attendanceSystem.enabled) {
        const attendanceSystemUrl = `${externalConfig.attendanceSystem.baseUrl}${externalConfig.attendanceSystem.endpoints.scanMeeting}`;

        const syncData = {
          qrSessionId: qrCode,
          traineeId: intern.Trainee_ID
        };

        await axios.post(attendanceSystemUrl, syncData, {
          timeout: externalConfig.attendanceSystem.timeout,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      // Continue with local processing even if external sync fails
    }
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
  }
};

// Mark daily attendance for an intern (do NOT auto-create DailyRecord/logbook)
// Note: The logbook (DailyRecord) must be filled by the intern manually.
// On QR scan, we only update attendance fields if a DailyRecord for today already exists.
//
// Uses a MongoDB transaction when updating both DailyRecord and Intern.attendance
// to ensure atomic consistency — both writes succeed or both roll back.
const markInternDailyAttendance = async (internId, qrCode) => {
  const DailyRecord = require("../models/DailyRecord");
  const Intern = require("../models/Intern");
  const mongoose = require("mongoose");
  
  const intern = await Intern.findById(internId);
  if (!intern) throw new Error("Intern not found");

  const moment = require("moment-timezone");
  
  // Use Sri Lankan timezone for all date operations
  const todaySriLanka = moment.tz("Asia/Colombo").startOf('day');
  const attendanceTime = moment.tz("Asia/Colombo").toDate();
  const today = todaySriLanka.format('YYYY-MM-DD'); // YYYY-MM-DD format
  const oneMinuteAgo = moment.tz("Asia/Colombo").subtract(60, 'seconds').toDate();

  // Check for duplicate scans before starting the transaction
  const existingDailyRecord = await DailyRecord.findOne({ internId, date: today });
  if (existingDailyRecord && existingDailyRecord.attendance === "present") {
    if (existingDailyRecord.attendanceTime && existingDailyRecord.attendanceTime >= oneMinuteAgo) {
      throw new Error("Duplicate daily QR scan detected. Please wait before scanning again.");
    }
  }

  // Use a transaction to atomically update BOTH DailyRecord and Intern.attendance
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Step 1: Update DailyRecord (only if one exists for today)
      if (existingDailyRecord) {
        await DailyRecord.updateOne(
          {
            internId,
            date: today,
            $or: [
              { attendance: { $ne: "present" } },
              { attendanceTime: { $lt: oneMinuteAgo } },
              { attendanceTime: null }
            ]
          },
          {
            $set: {
              attendance: "present",
              attendanceTime: attendanceTime
            }
          },
          { session }
        );
      }

      // Step 2: Push to Intern.attendance - prevent duplicates
      const duplicateCheck = await Intern.findOne(
        {
          _id: internId,
          attendance: {
            $elemMatch: {
              type: 'daily_qr',
              status: 'Present',
              date: { $gte: todaySriLanka.toDate(), $lte: todaySriLanka.clone().endOf('day').toDate() },
              timeMarked: { $gte: oneMinuteAgo }
            }
          }
        }
      ).session(session);

      if (duplicateCheck) {
        throw new Error("Duplicate daily QR scan detected. Please wait before scanning again.");
      }

      await Intern.updateOne(
        { _id: internId },
        {
          $push: {
            attendance: {
              date: todaySriLanka.toDate(),
              status: "Present",
              type: "daily_qr",
              timeMarked: attendanceTime,
              qrCode: qrCode
            }
          }
        },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  // Sync with external Attendance System (fire-and-forget, outside transaction)
  if (qrCode && intern.Trainee_ID) {
    try {
      const axios = require('axios');
      const externalConfig = require('../config/externalSystems');
      
      if (externalConfig.attendanceSystem.enabled) {
        const attendanceSystemUrl = `${externalConfig.attendanceSystem.baseUrl}${externalConfig.attendanceSystem.endpoints.scanDaily}`;
        
        const syncData = {
          qrSessionId: qrCode,
          traineeId: intern.Trainee_ID
        };
        
        await axios.post(attendanceSystemUrl, syncData, {
          timeout: externalConfig.attendanceSystem.timeout,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      // Continue with local processing even if external sync fails
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
