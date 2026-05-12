const moment = require("moment-timezone");
const sendEmail = require("../utils/emailSender");
const InternService = require("../services/internService");

const markAttendanceAndNotify = async (internId, status, date) => {
  try {
    // Check if internId is valid
    console.log("Attempting to mark attendance for Intern ID:", internId);

    // Format the attendance date
    const attendanceDate = date
      ? moment.tz(date, "Asia/Colombo").format("MMMM Do YYYY")
      : moment.tz("Asia/Colombo").format("MMMM Do YYYY");

    // Mark attendance for the intern
    const updatedIntern = await InternService.markAttendance(internId, status, date);
    
    // Check if intern is found
    if (!updatedIntern) {
      console.log(`Intern with ID ${internId} not found.`);
      throw new Error("Intern not found");
    }

    console.log("Attendance marked:", updatedIntern);

    // Prepare the email content (only if email exists)
    const internEmail = updatedIntern.email;
    const internName = updatedIntern.traineeName;
    const internTraineeId = updatedIntern.traineeId;

    const currentTime = moment.tz("Asia/Colombo").format("HH:mm");
    const emailSubject = "General Attendance Marked - SLT Mobitel";
    const emailBody = `
      Hello ${internName},

      This is to inform you that your general attendance has been successfully marked.
      
      📅 Date: ${attendanceDate}
      ⏰ Time: ${currentTime}
      ✅ Status: ${status}
      🆔 Intern ID: ${internTraineeId}

      Your attendance has been recorded in the system.

      If you have any issues or concerns, please do not hesitate to contact your supervisor.

      Please do not reply to this email. This is an auto-generated message.

      Best regards,
      SLT Mobitel
      Digital Platforms Development Section
    `;

    // Send the email notification if the intern has an email address
    if (internEmail) {
      // --- TEMPORARILY DISABLED EMAIL NOTIFICATION ---
      // sendEmail(internEmail, emailSubject, emailBody);
      console.log(`Email feature temporarily disabled. Would have sent to: ${internEmail}`);
    } else {
      // Log the attendance marking without email notification
      console.log(`No email found for intern ${internName} (ID: ${internTraineeId}). Attendance marked, but no email sent.`);
    }

    return updatedIntern;
  } catch (error) {
    console.error("Error marking attendance and sending email:", error.message);
    throw new Error("Error marking attendance and sending email: " + error.message);
  }
};

module.exports = {
  markAttendanceAndNotify,
};
