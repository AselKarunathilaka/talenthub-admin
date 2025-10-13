const qrCodeService = require("../services/qrCodeService");
const InternService = require("../services/internService"); 
const attendanceService = require("../services/attendanceService");
const InternRepository = require("../repositories/internRepository");  
const sendEmail = require("../utils/emailSender");  

const moment = require("moment");

const QRCode = require("qrcode");



const generateQRCode = async (req, res) => {
  try {
    const { internId, type } = req.query; // Get internId and type from query parameters
    
    let sessionId;
    if (type === 'daily') {
      // Generate QR for daily attendance
      if (internId) {
        sessionId = `daily_attendance_${internId}_${new Date().getTime()}`;
      } else {
        sessionId = `daily_attendance_${new Date().getTime()}`;
      }
    } else {
      // Generate QR for meeting attendance (default when no type specified or type='meeting')
      if (internId) {
        sessionId = `attendance_session_${internId}_${new Date().getTime()}`;
      } else {
        sessionId = `attendance_session_${new Date().getTime()}`;
      }
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
  const { qrCode, internId, scanType = 'daily' } = req.body;

  try {
    // Validate QR code format based on scan type
    if (scanType === 'daily') {
      // Accept both daily_attendance_ and attendance_session_ for backward compatibility
      if (!qrCode.includes('daily_attendance_') && !qrCode.includes('attendance_session_')) {
        return res.status(400).json({ message: "Invalid QR code format. This QR code is not for daily attendance." });
      }
    }
    
    const isValid = await qrCodeService.verifyQRCode(qrCode);
    if (!isValid) {
      return res.status(400).json({ message: "QR code is expired or invalid." });
    }

    // For daily attendance scans, only mark in DailyRecord (new system)
    if (scanType === 'daily') {
      await qrCodeService.markInternDailyAttendance(internId, qrCode);
      
      // Send email notification for daily attendance
      const intern = await InternService.getInternById(internId);
      if (intern && intern.email) {
        const moment = require("moment-timezone");
        const attendanceDate = moment.tz("Asia/Colombo").format("MMMM Do YYYY");
        const attendanceTime = moment.tz("Asia/Colombo").format("h:mm A");
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
        sendEmail(intern.email, emailSubject, emailBody);
      }
      
      res.status(200).json({ 
        message: "Daily attendance marked successfully and email sent!",
        dailyAttendanceUpdated: true
      });
    } else {
      // For meeting/general attendance scans, use the old system (intern.attendance)
      const status = "Present";
      const updatedIntern = await attendanceService.markAttendanceAndNotify(internId, status);
      
      res.status(200).json({ 
        message: "Attendance marked successfully and email sent!",
        dailyAttendanceUpdated: false
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Error processing QR code", error: error.message });
  }
};

// Intern scans QR code to mark meeting attendance
const scanMeetingQRCode = async (req, res) => {
  const { qrCode, internId, meetingTitle } = req.body;

  try {
    if (!meetingTitle) {
      return res.status(400).json({ message: "Meeting title is required." });
    }

    // Validate QR code format for meeting attendance
    if (!qrCode.includes('attendance_session_')) {
      return res.status(400).json({ message: "Invalid QR code format. This QR code is not for meeting attendance." });
    }

    // Verify QR code validity
    const isValid = await qrCodeService.verifyQRCode(qrCode);
    if (!isValid) {
      return res.status(400).json({ message: "QR code is expired or invalid." });
    }

    // Mark meeting attendance in TalentHub system
    const result = await qrCodeService.markMeetingAttendance(internId, meetingTitle, qrCode);
    
    // Sync with external Attendance System
    try {
      const axios = require('axios');
      const externalConfig = require('../config/externalSystems');
      
      if (externalConfig.attendanceSystem.enabled) {
        const attendanceSystemUrl = `${externalConfig.attendanceSystem.baseUrl}${externalConfig.attendanceSystem.endpoints.scanMeeting}`;
        
        console.log(`Syncing meeting attendance to external system: ${attendanceSystemUrl}`);
        
        const syncData = {
          qrSessionId: qrCode, // Use the QR code as session ID
          traineeId: result.intern.traineeId
        };
        
        const syncResponse = await axios.post(attendanceSystemUrl, syncData, {
          timeout: externalConfig.attendanceSystem.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Meeting attendance synced successfully:', syncResponse.data);
      }
    } catch (syncError) {
      console.error('Failed to sync meeting attendance to external system:', syncError.message);
      // Don't fail the main request if external sync fails
    }
    
    res.status(200).json({ 
      message: "Meeting attendance marked successfully!",
      intern: result.intern,
      meeting: result.meeting
    });
  } catch (error) {
    res.status(500).json({ message: "Error processing meeting attendance", error: error.message });
  }
};


module.exports = { 
  generateQRCode, 
  markAttendance, 
  scanQRCode, 
  scanMeetingQRCode
};
