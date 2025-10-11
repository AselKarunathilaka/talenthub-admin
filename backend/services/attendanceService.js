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

    const emailSubject = "Attendance Updated by Administrator - SLT Mobitel";
    const emailBody = `
      Hello ${internName},

      Your attendance record has been updated by an administrator for ${attendanceDate}.

      Details:
      - Trainee ID: ${internTraineeId}
      - Date: ${attendanceDate}
      - Status: ${status}
      - Updated by: System Administrator

      This change has been made to ensure accurate attendance records. If you believe this is an error or have any questions about this update, please contact your supervisor immediately.

      Please do not reply to this email. This is an automated administrative notification.

      Best regards,
      SLT Mobitel
      Digital Platforms Development Section
      Administrative Services
    `;

    // Send the email notification if the intern has an email address
    if (internEmail) {
      sendEmail(internEmail, emailSubject, emailBody);
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
