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
  const { qrCode, internId, scanType = 'daily', lat, lng } = req.body;

  try {
    // Validate QR code format based on scan type
    if (scanType === 'daily') {
      // Accept both daily_attendance_ and attendance_session_ for backward compatibility
      if (!qrCode.includes('daily_attendance_') && !qrCode.includes('attendance_session_')) {
        return res.status(400).json({ message: "Invalid QR code format. This QR code is not for daily attendance." });
      }
      // Location validation for SLT premises
      const SLT_LAT = 6.9271;
      const SLT_LNG = 79.8612;
      const MAX_DISTANCE_METERS = 2000;
      function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
        function deg2rad(deg) { return deg * (Math.PI/180); }
        const R = 6371000; // Radius of the earth in meters
        const dLat = deg2rad(lat2-lat1);
        const dLon = deg2rad(lon2-lon1);
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
          Math.sin(dLon/2) * Math.sin(dLon/2)
          ;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const d = R * c; // Distance in meters
        return d;
      }
      if (!lat || !lng) {
        return res.status(400).json({ message: "Location data is required to mark attendance." });
      }
      const distance = getDistanceFromLatLonInMeters(Number(lat), Number(lng), SLT_LAT, SLT_LNG);
      if (distance > MAX_DISTANCE_METERS) {
        return res.status(403).json({ message: `Attendance can only be marked within SLT premises. Your location is ${Math.round(distance)} meters away.` });
      }
    }
    const isValid = await qrCodeService.verifyQRCode(qrCode);
    if (!isValid) {
      return res.status(400).json({ message: "QR code is expired or invalid." });
    }

    // For daily attendance scans, only update existing DailyRecord attendance fields (if any).
    // DO NOT create a new logbook entry or set its task from QR scans.
    if (scanType === 'daily') {
      await qrCodeService.markInternDailyAttendance(internId, qrCode);
      // Get intern info for email notification
      const intern = await InternService.getInternById(internId);
      // Send email notification for daily attendance
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
    // Validate meeting title matches
    if (qrPayload.meetingTitle !== meetingTitle) {
      return res.status(400).json({ message: `Meeting title mismatch. QR code is for '${qrPayload.meetingTitle}', but you entered '${meetingTitle}'.` });
    }
    // Optionally, check expiry (10 min)
    const now = Date.now();
    if (qrPayload.timestamp && now - qrPayload.timestamp > 10 * 60 * 1000) {
      return res.status(400).json({ message: "QR code is expired." });
    }
    // Mark meeting attendance in TalentHub system
    const result = await qrCodeService.markMeetingAttendance(internId, meetingTitle, qrCode);
    res.status(200).json({ 
      message: "Meeting attendance marked successfully",
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
