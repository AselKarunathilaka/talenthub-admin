const qrCodeService = require("../services/qrCodeService");
const InternService = require("../services/internService"); 
const attendanceService = require("../services/attendanceService");
const InternRepository = require("../repositories/internRepository");  
const sendEmail = require("../utils/emailSender");  

const moment = require("moment");

const QRCode = require("qrcode");



const generateQRCode = async (req, res) => {
  try {
    const sessionId = `attendance_session_${new Date().getTime()}`; 
    const qrCode = await QRCode.toDataURL(sessionId); 

    res.status(200).json({ qrCode });  
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
  const { qrCode, internId } = req.body;

  try {
    
    const isValid = await qrCodeService.verifyQRCode(qrCode);
    if (!isValid) {
      return res.status(400).json({ message: "QR code is expired or invalid." });
    }

   
    const status = "Present";
    const updatedIntern = await attendanceService.markAttendanceAndNotify(internId, status);

    res.status(200).json({ message: "Attendance marked successfully and email sent!" });
  } catch (error) {
    res.status(500).json({ message: "Error processing QR code", error: error.message });
  }
};


module.exports = { generateQRCode, markAttendance, scanQRCode };
