const Intern = require("../models/Intern");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
//const sendEmail = require("../utils/emailSender");

/**
 * Process Teams attendance CSV data and update database
 * Only marks attendance as "Present" for interns who appear in the CSV
 */
const processTeamsAttendance = async (csvData, attendanceDate, meetingName) => {
  try {
    const results = {
      success: 0,
      failed: 0,
      errors: [],
      processedInterns: [],
    };

    if (!meetingName || meetingName.trim() === "") {
      throw new Error("Meeting name is required");
    }

    const targetDate = new Date(attendanceDate);
    targetDate.setHours(0, 0, 0, 0);

    // Current timestamp for timeMarked field
    const currentTime = new Date();

    for (const record of csvData) {
      try {
        const { traineeId, status, name } = record;

        if (!traineeId || traineeId === "UNKNOWN") {
          results.failed++;
          results.errors.push({
            traineeId: traineeId || "N/A",
            name: name || "N/A",
            error: "Invalid or missing trainee ID",
          });
          continue;
        }

        // Find intern by Trainee_ID only
        const intern = await Intern.findOne({ Trainee_ID: traineeId.trim() });

        if (!intern) {
          results.failed++;
          results.errors.push({
            traineeId,
            name,
            error: "Intern not found in database",
          });
          continue;
        }

        // Only mark as "Present" if the status is "Present"
        if (status !== "Present") {
          continue;
        }

        // Mark online attendance as Present with additional fields
        await markOnlineAttendance(
          intern._id,
          meetingName.trim(),
          "Present",
          targetDate,
          currentTime,
          "online_attendance",
          "csv_upload_system"
        );

        // await sendAttendanceNotification(
        //   intern,
        //   "Present",
        //   targetDate,
        //   meetingName
        // );

        results.success++;
        results.processedInterns.push({
          traineeId: intern.Trainee_ID,
          name: intern.Trainee_Name,
          status: "Present",
          meetingName: meetingName,
          timeMarked: currentTime,
          type: "online_attendance",
          markedBy: "csv_upload_system",
        });
      } catch (recordError) {
        console.error("Error processing record:", recordError);
        results.failed++;
        results.errors.push({
          traineeId: record.traineeId || "N/A",
          name: record.name || "N/A",
          error: recordError.message,
        });
      }
    }

    return results;
  } catch (error) {
    console.error(
      "OnlineAttendanceService: Error processing Teams attendance:",
      error
    );
    throw new Error("Failed to process Teams attendance: " + error.message);
  }
};

/**
 * Mark online attendance for an intern
 */
const markOnlineAttendance = async (
  internId,
  meetingName,
  status,
  date,
  timeMarked,
  type,
  markedBy
) => {
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const intern = await Intern.findById(internId);
    if (!intern) {
      throw new Error("Intern not found");
    }

    // Check if attendance already exists for this meeting and date
    const existingEntry = intern.onlineAttendance.find(
      (entry) =>
        entry.meetingName.toLowerCase() === meetingName.toLowerCase() &&
        new Date(entry.date).setHours(0, 0, 0, 0) === targetDate.getTime()
    );

    if (existingEntry) {
      // Update existing entry
      existingEntry.status = status;
      existingEntry.timeMarked = timeMarked;
      existingEntry.type = type;
      existingEntry.markedBy = markedBy;
    } else {
      // Add new entry
      intern.onlineAttendance.push({
        meetingName: meetingName,
        date: targetDate,
        status: status,
        timeMarked: timeMarked,
        type: type,
        markedBy: markedBy,
      });
    }

    // Save without validation
    await intern.save({ validateBeforeSave: false });
    return intern;
  } catch (error) {
    console.error(
      "OnlineAttendanceService: Error marking online attendance:",
      error
    );
    throw error;
  }
};

/**
 * Send email notification for attendance marking
 */
const sendAttendanceNotification = async (
  intern,
  status,
  date,
  meetingName
) => {
  try {
    const email = intern.Trainee_Email;
    const traineeName = intern.Trainee_Name;
    const traineeId = intern.Trainee_ID;

    if (!email) {
      console.log(`No email found for intern ${traineeId}`);
      return;
    }

    const attendanceDate = moment
      .tz(date, "Asia/Colombo")
      .format("MMMM Do YYYY");

    const emailSubject = "Online Meeting Attendance Marked - SLT Mobitel";
    const emailBody = `
Hello ${traineeName},

This is to inform you that your online meeting attendance has been successfully marked for ${attendanceDate}.

Meeting Name: ${meetingName}
Status: ${status}
Intern ID: ${traineeId}
Meeting Type: Microsoft Teams

If you have any issues or concerns, please do not hesitate to contact your supervisor.

Please do not reply to this email. This is an auto-generated message.

Best regards,
SLT Mobitel
Digital Platforms Development Section
    `;

    await sendEmail(email, emailSubject, emailBody);
  } catch (error) {
    console.error("Error sending attendance notification:", error);
  }
};

/**
 * Get online attendance statistics for a specific date
 */
const getOnlineAttendanceStatistics = async (targetDate) => {
  try {
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const interns = await Intern.find({
      "onlineAttendance.date": {
        $gte: startDate,
        $lt: endDate,
      },
    });

    const stats = {
      totalInterns: 0,
      present: 0,
      absent: 0,
      date: startDate,
      meetings: [],
    };

    const meetingMap = new Map();
    const processedInterns = new Set();

    interns.forEach((intern) => {
      intern.onlineAttendance.forEach((entry) => {
        const entryDate = new Date(entry.date);
        entryDate.setHours(0, 0, 0, 0);

        if (entryDate.getTime() === startDate.getTime()) {
          const internKey = `${intern._id}-${entry.meetingName}`;

          if (!processedInterns.has(internKey)) {
            processedInterns.add(internKey);
            stats.totalInterns++;

            if (entry.status === "Present") {
              stats.present++;
            } else {
              stats.absent++;
            }
          }

          if (!meetingMap.has(entry.meetingName)) {
            meetingMap.set(entry.meetingName, {
              meetingName: entry.meetingName,
              present: 0,
              absent: 0,
            });
          }

          const meetingStats = meetingMap.get(entry.meetingName);
          if (entry.status === "Present") {
            meetingStats.present++;
          } else {
            meetingStats.absent++;
          }
        }
      });
    });

    stats.meetings = Array.from(meetingMap.values());

    return stats;
  } catch (error) {
    console.error("OnlineAttendanceService: Error getting statistics:", error);
    throw new Error("Failed to get attendance statistics: " + error.message);
  }
};

/**
 * Update online attendance status (for manual marking)
 */
const updateOnlineAttendanceStatus = async (
  internId,
  meetingName,
  status,
  date
) => {
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Current timestamp for timeMarked field
    const currentTime = new Date();

    let intern = null;

    // Try finding by Mongo _id
    if (mongoose.Types.ObjectId.isValid(internId)) {
      intern = await Intern.findById(internId);
    }

    // Fallback to Trainee_ID
    if (!intern) {
      intern = await Intern.findOne({ Trainee_ID: internId.trim() });
    }

    if (!intern) {
      throw new Error(`Intern not found for ID: ${internId}`);
    }

    // Find existing attendance entry
    let attendanceEntry = intern.onlineAttendance.find(
      (entry) =>
        entry.meetingName.toLowerCase() === meetingName.toLowerCase() &&
        new Date(entry.date).setHours(0, 0, 0, 0) === targetDate.getTime()
    );

    if (attendanceEntry) {
      attendanceEntry.status = status;
      attendanceEntry.timeMarked = currentTime;
      attendanceEntry.type = "online_attendance";
      attendanceEntry.markedBy = "manual_system";
    } else {
      intern.onlineAttendance.push({
        meetingName,
        date: targetDate,
        status,
        timeMarked: currentTime,
        type: "online_attendance",
        markedBy: "manual_system",
      });
    }

    await intern.save({ validateBeforeSave: false });

    // Send notification using the intern document directly
    // await sendAttendanceNotification(intern, status, targetDate, meetingName);

    return intern;
  } catch (error) {
    console.error("OnlineAttendanceService: Error updating attendance:", error);
    throw new Error("Failed to update attendance: " + error.message);
  }
};

/**
 * Get attendance records by meeting name
 */
const getAttendanceByMeeting = async (meetingName, startDate, endDate) => {
  try {
    const query = { "onlineAttendance.meetingName": meetingName };

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      query["onlineAttendance.date"] = { $gte: start, $lte: end };
    }

    const interns = await Intern.find(query).lean();

    const records = [];
    interns.forEach((intern) => {
      intern.onlineAttendance
        .filter((entry) => entry.meetingName === meetingName)
        .forEach((entry) => {
          if (!startDate || !endDate) {
            records.push({
              traineeId: intern.Trainee_ID,
              traineeName: intern.Trainee_Name,
              email: intern.Trainee_Email,
              meetingName: entry.meetingName,
              status: entry.status,
              date: entry.date,
              timeMarked: entry.timeMarked || null,
              type: entry.type || "online_attendance",
              markedBy: entry.markedBy || "unknown",
            });
          } else {
            const entryDate = new Date(entry.date);
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            if (entryDate >= start && entryDate <= end) {
              records.push({
                traineeId: intern.Trainee_ID,
                traineeName: intern.Trainee_Name,
                email: intern.Trainee_Email,
                meetingName: entry.meetingName,
                status: entry.status,
                date: entry.date,
                timeMarked: entry.timeMarked || null,
                type: entry.type || "online_attendance",
                markedBy: entry.markedBy || "unknown",
              });
            }
          }
        });
    });

    return records;
  } catch (error) {
    console.error(
      "OnlineAttendanceService: Error getting attendance by meeting:",
      error
    );
    throw new Error("Failed to get attendance by meeting: " + error.message);
  }
};

module.exports = {
  processTeamsAttendance,
  getOnlineAttendanceStatistics,
  updateOnlineAttendanceStatus,
  sendAttendanceNotification,
  getAttendanceByMeeting,
};
