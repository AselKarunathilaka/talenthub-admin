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

    // Mark daily attendance in DailyRecord with proper email notification
    if (scanType === 'daily') {
      const result = await qrCodeService.markInternDailyAttendance(internId);
      
      res.status(200).json({ 
        message: "Daily attendance marked successfully and email sent!",
        intern: result.intern,
        attendance: result.attendance,
        dailyAttendanceUpdated: true
      });
    } else {
      // For other scan types, fall back to original functionality
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

    // Mark meeting attendance with email notification
    const result = await qrCodeService.markMeetingAttendance(internId, meetingTitle);
    
    res.status(200).json({ 
      message: "Meeting attendance marked successfully and email sent!",
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
