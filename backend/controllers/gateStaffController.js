// gateStaffController.js
const LeaveRequest = require("../models/LeaveRequest");
const Intern = require("../models/Intern");

// Helper function to convert time to 24-hour format
function convertTo24Hour(timeStr) {
  if (!timeStr) return "00:00";

  timeStr = timeStr.trim().toUpperCase();

  if (/^\d{2}:\d{2}$/.test(timeStr)) {
    return timeStr;
  }

  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return "00:00";

  let hours = parseInt(match[1], 10);
  const minutes = match[2].padStart(2, "0");
  const period = match[3] ? match[3].toUpperCase() : null;

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, "0")}:${minutes}`;
}

// Get all approved short leave requests for gate staff 
const getApprovedLeaves = async (req, res) => {
  try {
    // Verify user is gate staff
    if (req.user.role !== "gatestaff") {
      return res.status(403).json({
        message: "Access denied. Gate staff only.",
      });
    }

    // Fetch all approved leave requests and populate intern details
    const approvedLeaves = await LeaveRequest.find({
      status: "Approved",
      requestType: "short_leave",
    })
      .populate("intern", "Trainee_ID Trainee_Name Trainee_Email nationalId") 
      .sort({ leaveDate: -1, submittedAt: -1 }) // Sort by leave date (most recent first)
      .lean();

    // Transform data to match frontend expectations
    const transformedLeaves = approvedLeaves.map((leave) => {
      // Extract intern fields
      const intern = leave.intern || {};

      // Parse leaveTime to extract start and end times
      let startTime = "00:00";
      let endTime = "00:00";

      const timeMatch = leave.leaveTime?.match(
        /(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:-|to)\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i
      );

      if (timeMatch) {
        startTime = convertTo24Hour(timeMatch[1].trim());
        endTime = convertTo24Hour(timeMatch[2].trim());
      } else if (leave.leaveTime) {
        startTime = convertTo24Hour(leave.leaveTime);
      }

      return {
        id: leave._id.toString(),
        internId: intern.Trainee_ID || "N/A",
        name: intern.Trainee_Name || leave.internName || "N/A",
        nationalId: intern.nationalId || leave.nationalId || "N/A",
        email: intern.Trainee_Email || "N/A",
        leaveDate: leave.leaveDate.toISOString().split("T")[0], // Format as YYYY-MM-DD
        startTime,
        endTime,
        reason: leave.reason,
        purpose: leave.purpose,
        status: leave.status,
        reviewedAt: leave.reviewedAt,
        adminResponse: leave.adminResponse,
      };
    });

    res.status(200).json(transformedLeaves);
  } catch (error) {
    console.error("Error fetching approved leaves:", error);
    res.status(500).json({
      message: "Failed to fetch approved leave requests",
      error: error.message,
    });
  }
};

// Get approved leaves filtered by date
const getApprovedLeavesByDate = async (req, res) => {
  try {
    // Verify user is gate staff
    if (req.user.role !== "gatestaff") {
      return res.status(403).json({
        message: "Access denied. Gate staff only.",
      });
    }

    const { date } = req.params;

    // Validate date format
    if (!date || isNaN(Date.parse(date))) {
      return res.status(400).json({
        message: "Invalid date format. Use YYYY-MM-DD.",
      });
    }

    // Create date range for the entire day
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Fetch approved leaves for the specific date
    const approvedLeaves = await LeaveRequest.find({
      status: "Approved",
      requestType: "short_leave",
      leaveDate: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .populate("intern", "Trainee_ID Trainee_Name Trainee_Email nationalId")
      .sort({ submittedAt: -1 })
      .lean();

    // Transform data
    const transformedLeaves = approvedLeaves.map((leave) => {
      const intern = leave.intern || {};

      const timeMatch = leave.leaveTime?.match(
        /(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:-|to)\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i
      );

      let startTime = "00:00";
      let endTime = "00:00";

      if (timeMatch) {
        startTime = convertTo24Hour(timeMatch[1].trim());
        endTime = convertTo24Hour(timeMatch[2].trim());
      } else if (leave.leaveTime) {
        startTime = convertTo24Hour(leave.leaveTime);
      }

      return {
        id: leave._id.toString(),
        internId: intern.Trainee_ID || "N/A",
        name: intern.Trainee_Name || leave.internName || "N/A",
        nationalId: intern.nationalId || leave.nationalId || "N/A",
        email: intern.Trainee_Email || "N/A",
        leaveDate: leave.leaveDate.toISOString().split("T")[0],
        startTime,
        endTime,
        reason: leave.reason,
        purpose: leave.purpose,
        status: leave.status,
      };
    });

    res.status(200).json(transformedLeaves);
  } catch (error) {
    console.error("Error fetching approved leaves by date:", error);
    res.status(500).json({
      message: "Failed to fetch approved leave requests",
      error: error.message,
    });
  }
};

module.exports = {
  getApprovedLeaves,
  getApprovedLeavesByDate,
};
