const onlineAttendanceService = require("../services/onlineAttendanceService");
const Intern = require("../models/Intern");

/**
 * Upload and process Teams CSV attendance report
 */
const uploadTeamsReport = async (req, res) => {
  try {
    const { csvData, date, meetingName } = req.body;

    // Validate input
    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({
        message:
          "Invalid CSV data format. Expected an array of attendance records.",
      });
    }

    if (!meetingName || meetingName.trim() === "") {
      return res.status(400).json({
        message: "Meeting name is required",
      });
    }

    // Convert CSV rows to { traineeId, name, status }
    const mappedData = csvData.map((row) => {
      const rawFullName = row["Full Name"]?.trim();

      if (!rawFullName) return null;

      const parts = rawFullName.split("_");
      const name = parts[0]?.trim();
      const traineeId = parts[1]?.trim() || "UNKNOWN";

      const userAction = row["User Action"]?.trim().toLowerCase() || "";
      const status =
        userAction.includes("join") || userAction.includes("present")
          ? "Present"
          : null;

      return status ? { traineeId, name, status } : null;
    });

    // Filter out invalid/empty rows and non-present ones
    const validData = mappedData.filter(
      (item) => item && item.traineeId !== "UNKNOWN" && item.name
    );

    if (validData.length === 0) {
      return res.status(400).json({
        message: "No valid Present records found in the uploaded CSV.",
      });
    }

    // Attendance date
    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    // Send 'Present' data to the service layer
    const result = await onlineAttendanceService.processTeamsAttendance(
      validData,
      attendanceDate,
      meetingName
    );

    res.status(200).json({
      message: "Online attendance processed successfully",
      meetingName,
      success: result.success,
      failed: result.failed,
      errors: result.errors,
      processedInterns: result.processedInterns,
    });
  } catch (error) {
    console.error(
      "OnlineAttendanceController: Error uploading Teams report:",
      error
    );
    res.status(500).json({
      message: "Error processing attendance report",
      error: error.message,
    });
  }
};

/**
 * Get online attendance records for a specific date
 */
const getOnlineAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date parameter is required" });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const interns = await Intern.find({
      "onlineAttendance.date": {
        $gte: targetDate,
        $lt: nextDay,
      },
    }).lean();

    const attendanceRecords = [];

    interns.forEach((intern) => {
      intern.onlineAttendance.forEach((entry) => {
        const entryDate = new Date(entry.date);
        entryDate.setHours(0, 0, 0, 0);

        if (entryDate.getTime() === targetDate.getTime()) {
          attendanceRecords.push({
            traineeId: intern.Trainee_ID,
            traineeName: intern.Trainee_Name,
            email: intern.Trainee_Email,
            meetingName: entry.meetingName,
            date: entry.date,
            timeMarked: entry.timeMarked || null,
            status: entry.status,
            type: entry.type || "online_attendance",
            markedBy: entry.markedBy || "unknown",
          });
        }
      });
    });

    res.status(200).json({
      date: targetDate,
      totalRecords: attendanceRecords.length,
      records: attendanceRecords,
    });
  } catch (error) {
    console.error(
      "OnlineAttendanceController: Error fetching attendance:",
      error
    );
    res.status(500).json({
      message: "Error fetching attendance records",
      error: error.message,
    });
  }
};

/**
 * Get online attendance statistics for a specific date
 */
const getOnlineAttendanceStats = async (req, res) => {
  try {
    const { date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const stats = await onlineAttendanceService.getOnlineAttendanceStatistics(
      targetDate
    );

    res.status(200).json(stats);
  } catch (error) {
    console.error("OnlineAttendanceController: Error fetching stats:", error);
    res.status(500).json({
      message: "Error fetching attendance statistics",
      error: error.message,
    });
  }
};

/**
 * Manually mark online attendance for a specific intern
 */
const markManualOnlineAttendance = async (req, res) => {
  try {
    const { internId, meetingName, status, date } = req.body;

    if (!internId || !meetingName || !status) {
      return res.status(400).json({
        message: "Intern ID, meeting name, and status are required",
      });
    }

    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    const updatedIntern =
      await onlineAttendanceService.updateOnlineAttendanceStatus(
        internId,
        meetingName,
        status,
        attendanceDate
      );

    // Find the marked attendance entry to return complete details
    const markedEntry = updatedIntern.onlineAttendance.find(
      (entry) =>
        entry.meetingName.toLowerCase() === meetingName.toLowerCase() &&
        new Date(entry.date).setHours(0, 0, 0, 0) === attendanceDate.getTime()
    );

    res.status(200).json({
      message: "Online attendance marked successfully",
      id: markedEntry?._id || null,
      internId: updatedIntern.Trainee_ID,
      meetingName: meetingName,
      status: status,
      date: attendanceDate,
      timeMarked: markedEntry?.timeMarked || new Date(),
      type: "online_attendance",
      markedBy: "manual_system",
      createdAt: markedEntry?.createdAt || new Date(),
    });
  } catch (error) {
    console.error(
      "OnlineAttendanceController: Error marking attendance:",
      error
    );
    res.status(500).json({
      message: "Error marking attendance",
      error: error.message,
    });
  }
};

/**
 * Get attendance records by meeting name
 */
const getAttendanceByMeeting = async (req, res) => {
  try {
    const { meetingName, startDate, endDate } = req.query;

    if (!meetingName) {
      return res.status(400).json({
        message: "Meeting name is required",
      });
    }

    const records = await onlineAttendanceService.getAttendanceByMeeting(
      meetingName,
      startDate,
      endDate
    );

    res.status(200).json({
      meetingName: meetingName,
      totalRecords: records.length,
      records: records,
    });
  } catch (error) {
    console.error(
      "OnlineAttendanceController: Error fetching attendance by meeting:",
      error
    );
    res.status(500).json({
      message: "Error fetching attendance by meeting",
      error: error.message,
    });
  }
};

module.exports = {
  uploadTeamsReport,
  getOnlineAttendanceByDate,
  getOnlineAttendanceStats,
  markManualOnlineAttendance,
  getAttendanceByMeeting,
};
