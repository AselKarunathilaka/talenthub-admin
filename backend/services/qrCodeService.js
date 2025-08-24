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
  const sessionId = qrCode.split("_")[1];  // Extract sessionId from QR code
  const currentTime = new Date().getTime();
  const qrCodeTime = parseInt(qrCode.split("_")[2]);

  if (currentTime - qrCodeTime > 3600000) {  // QR Code expires in 1 hour
    return false;
  }

  return true;
};



module.exports = { generateQRCode, markAttendance, verifyQRCode };
