const moment = require("moment-timezone");
const sendEmail = require("../utils/emailSender");
const InternService = require("../services/internService");

const markAttendanceAndNotify = async (internId, status, date, type = 'manual', timeMarked = null) => {
  try {
    // Check if internId is valid

    console.log("AttendanceService: Status:", status);
    console.log("AttendanceService: Date:", date);
    console.log("AttendanceService: Type:", type);

    // Validate inputs
    if (!internId) {
      throw new Error("Intern ID is required");
    }
    if (!status) {
      throw new Error("Status is required");
    }

    // Format the attendance date
    const attendanceDate = date
      ? moment.tz(date, "Asia/Colombo").format("MMMM Do YYYY")
      : moment.tz("Asia/Colombo").format("MMMM Do YYYY");

    console.log("AttendanceService: Formatted attendance date:", attendanceDate);

    // Mark attendance for the intern
    const updatedIntern = await InternService.markAttendance(internId, status, date, type, timeMarked);
    
    // Check if intern is found
    if (!updatedIntern) {
      console.log(`AttendanceService: Intern with ID ${internId} not found.`);
      throw new Error("Intern not found");
    }

    console.log("AttendanceService: Attendance marked successfully for:", updatedIntern.traineeName);

    // Prepare the email content (only if email exists)
    const internEmail = updatedIntern.email;
    const internName = updatedIntern.traineeName;
    const internTraineeId = updatedIntern.traineeId;

    const emailSubject = "Attendance Marked - SLT Mobitel";
    const emailBody = `
      Hello ${internName},

      This is to inform you that your attendance has been successfully marked for ${attendanceDate}.
      Status: ${status}
      Intern ID: ${internTraineeId}

      If you have any issues or concerns, please do not hesitate to contact your supervisor.

      Please do not reply to this email. This is an auto-generated message.

      Best regards,
      SLT Mobitel
      Digital Platforms Development Section
    `;

    // Send the email notification if the intern has an email address
    if (internEmail) {
      console.log("AttendanceService: Sending email notification to:", internEmail);
      sendEmail(internEmail, emailSubject, emailBody);
    } else {
      // Log the attendance marking without email notification
      console.log(`AttendanceService: No email found for intern ${internName} (ID: ${internTraineeId}). Attendance marked, but no email sent.`);
    }

    return updatedIntern;
  } catch (error) {
    console.error("AttendanceService: Error marking attendance and sending email:", error.message);
    console.error("AttendanceService: Full error:", error);
    throw new Error("Error marking attendance and sending email: " + error.message);
  }
};

module.exports = {
  markAttendanceAndNotify,
};
