const qrCodeService = require("../services/qrCodeService");
const InternService = require("../services/internService"); 
const attendanceService = require("../services/attendanceService");
const InternRepository = require("../repositories/internRepository");  
const sendEmail = require("../utils/emailSender");  

const moment = require("moment");

const QRCode = require("qrcode");



const generateQRCode = async (req, res) => {
  try {
    const { internId } = req.query; // Get internId from query parameters
    
    let sessionId;
    if (internId) {
      // Generate QR with intern ID for admin scanning
      sessionId = `attendance_session_${internId}_${new Date().getTime()}`;
    } else {
      // Generate generic QR for regular use
      sessionId = `attendance_session_${new Date().getTime()}`;
    }
    
    const qrCode = await QRCode.toDataURL(sessionId); 

    res.status(200).json({ qrCode, sessionId });  
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
    
    const isValid = await qrCodeService.verifyQRCode(qrCode);
    if (!isValid) {
      return res.status(400).json({ message: "QR code is expired or invalid." });
    }

    // Mark attendance in intern's attendance array (existing functionality)
    const status = "Present";
    const updatedIntern = await attendanceService.markAttendanceAndNotify(internId, status);

    // Also mark daily attendance in DailyRecord
    if (scanType === 'daily') {
      await qrCodeService.markInternDailyAttendance(internId);
    }

    res.status(200).json({ 
      message: "Attendance marked successfully and email sent!",
      dailyAttendanceUpdated: scanType === 'daily'
    });
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

    // Verify QR code validity
    const isValid = await qrCodeService.verifyQRCode(qrCode);
    if (!isValid) {
      return res.status(400).json({ message: "QR code is expired or invalid." });
    }

    // Mark meeting attendance
    const result = await qrCodeService.markMeetingAttendance(internId, meetingTitle);
    
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
