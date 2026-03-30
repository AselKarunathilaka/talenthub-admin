const InternService = require("../services/internService");
const attendanceService = require("../services/attendanceService");
const { parseXLSX, addInternsFromXLSX } = require("../utils/xlsxHandler");
const sendEmail = require("../utils/emailSender");
const moment = require("moment");
const fs = require("fs");
const path = require("path");

const addIntern = async (req, res) => {
  try {
    const newIntern = await InternService.addIntern(req.body);
    res
      .status(201)
      .json({ message: "Intern added successfully!", intern: newIntern });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const addExternalIntern = async (req, res) => {
  try {
    const newInternData = req.body;

    const newIntern = await InternService.addIntern(newInternData);

    res
      .status(201)
      .json({ message: "Intern added successfully!", intern: newIntern });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding intern", error: error.message });
  }
};

const getAllInterns = async (req, res) => {
  const { date } = req.query; // If date is missing, it will be undefined
  try {
    const interns = await InternService.getAllInterns(date);
    res.status(200).json(interns);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching interns", error: error.message });
  }
};

// GET active interns directly from external API (without DB persistence)
const getActiveInternsExternal = async (req, res) => {
  try {
    const interns = await InternService.getActiveInternsFromExternal();
    res.status(200).json(interns);
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Error fetching interns from external API",
        error: error.message,
      });
  }
};

// POST sync external interns into local DB (upsert)
const syncActiveInterns = async (req, res) => {
  try {
    const result = await InternService.syncActiveInterns();
    res.status(200).json({ message: "Sync complete", ...result });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Error syncing interns from external API",
        error: error.message,
      });
  }
};

const getInternById = async (req, res) => {
  try {
    const intern = await InternService.getInternById(req.params.id);
    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }
    res.status(200).json(intern);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching intern", error: error.message });
  }
};

const getInternByIdEach = async (req, res) => {
  try {
    const intern = await InternService.getInternById(req.params.id);
    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }
    res.status(200).json(intern);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching intern", error: error.message });
  }
};

const getAttendanceStats = async (req, res) => {
  try {
    const stats = await InternService.getAttendanceStats();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: "Error fetching attendance stats" });
  }
};

const markAttendance = async (req, res) => {
  const { internId, status, date, type, timeMarked } = req.body;

  try {
    // Validate required fields
    if (!internId) {
      console.error("Missing internId in request body");
      return res.status(400).json({ message: "Intern ID is required" });
    }
    if (!status) {
      console.error("Missing status in request body");
      return res.status(400).json({ message: "Status is required" });
    }

    const attendanceType = type || "manual";
    const markedTime = timeMarked || new Date();

    const updatedIntern = await attendanceService.markAttendanceAndNotify(
      internId,
      status,
      date,
      attendanceType,
      markedTime
    );
    res
      .status(200)
      .json({
        message: "Attendance marked successfully",
        intern: updatedIntern,
      });
  } catch (error) {
    console.error("Error in markAttendance controller:", error);
    res.status(500).json({
      message: "Error marking attendance",
      error: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

const updateAttendance = async (req, res) => {
  try {
    const { date, status } = req.body;
    const updatedIntern = await InternService.updateAttendance(
      req.params.id,
      date,
      status
    );
    res
      .status(200)
      .json({
        message: "Attendance updated successfully",
        intern: updatedIntern,
      });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating attendance", error: error.message });
  }
};

const assignToTeam = async (req, res) => {
  try {
    await InternService.assignToTeam(req.body.internIds, req.body.teamName);
    res
      .status(200)
      .json({ message: "Interns successfully assigned to the team" });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Error assigning interns to team",
        error: error.message,
      });
  }
};

const removeFromTeam = async (req, res) => {
  try {
    const { internId } = req.body;
    const { teamName } = req.params;

    if (!internId || !teamName) {
      return res
        .status(400)
        .json({ message: "Intern ID and Team Name are required." });
    }

    const decodedTeamName = decodeURIComponent(teamName);

    const result = await InternService.removeFromTeam(
      internId,
      decodedTeamName
    );
    if (result) {
      return res.status(200).json({ message: "Intern removed from the team." });
    } else {
      return res.status(404).json({ message: "Intern not found." });
    }
  } catch (error) {
    console.error("Error removing intern:", error);
    res.status(500).json({ message: "Error removing intern from the team" });
  }
};

const removeIntern = async (req, res) => {
  try {
    const deletedIntern = await InternService.removeIntern(req.params.id);
    if (!deletedIntern) {
      return res.status(404).json({ message: "Intern not found" });
    }
    res.status(200).json({ message: "Intern removed successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error removing intern", error: error.message });
  }
};

const updateIntern = async (req, res) => {
  try {
    const updatedIntern = await InternService.updateIntern(
      req.params.id,
      req.body
    );
    if (!updatedIntern) {
      return res.status(404).json({ message: "Intern not found" });
    }
    res
      .status(200)
      .json({ message: "Intern updated successfully", intern: updatedIntern });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating intern", error: error.message });
  }
};

const uploadInterns = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const interns = parseXLSX(req.file.path);

    const { addedCount, skippedCount } = await addInternsFromXLSX(interns);

    res.status(201).json({
      message: `Upload Complete: ${addedCount} new interns added, ${skippedCount} duplicates skipped.`,
      addedCount,
      skippedCount,
    });
  } catch (error) {
    console.error("❌ Error uploading file:", error);
    res
      .status(500)
      .json({ message: "Error processing file", error: error.message });
  }
};

const getAllTeams = async (req, res) => {
  try {
    const teams = await InternService.getAllTeams();
    res.status(200).json(teams);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching teams", error: error.message });
  }
};

const updateTeamName = async (req, res) => {
  try {
    const { oldTeamName } = req.params;
    const { newTeamName } = req.body;

    if (!newTeamName) {
      return res.status(400).json({ message: "New team name is required" });
    }

    const decodedOldTeamName = decodeURIComponent(oldTeamName);

    const result = await InternService.updateTeamName(
      decodedOldTeamName,
      newTeamName
    );
    res.status(200).json(result);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating team", error: error.message });
  }
};

const assignSingleToTeam = async (req, res) => {
  try {
    const { internId } = req.body;
    const { teamName } = req.params;

    if (!internId || !teamName) {
      return res
        .status(400)
        .json({ message: "Intern ID and Team Name are required." });
    }

    const decodedTeamName = decodeURIComponent(teamName);

    const result = await InternService.assignSingleToTeam(
      internId,
      decodedTeamName
    );
    if (result) {
      return res.status(200).json({ message: "Intern added to the team!" });
    } else {
      return res.status(404).json({ message: "Intern not found." });
    }
  } catch (error) {
    console.error("Error adding intern:", error);
    res.status(500).json({ message: "Error adding intern to the team" });
  }
};

const deleteTeam = async (req, res) => {
  try {
    const teamName = decodeURIComponent(req.params.teamName);

    const result = await InternService.deleteTeam(teamName);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      message: "Error deleting team",
      error: error.message,
    });
  }
};

const getAttendanceStatsForToday = async (req, res) => {
  try {
    const stats = await InternService.getAttendanceStatsForToday();
    res.status(200).json(stats); // Returns { present: 10, absent: 5 }
  } catch (error) {
    console.error("Error fetching today's attendance stats:", error);
    res
      .status(500)
      .json({ message: "Error fetching today's attendance stats." });
  }
};

const getAttendanceStatsByType = async (req, res) => {
  try {
    const { type } = req.query; // 'daily', 'meeting', or null for all
    const stats = await InternService.getAttendanceStatsByType(type);
    res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching attendance stats by type:", error);
    res
      .status(500)
      .json({ message: "Error fetching attendance stats by type." });
  }
};

const getTodayAttendanceByType = async (req, res) => {
  try {
    const { type } = req.query; // 'daily', 'meeting', or null for all
    const attendanceList = await InternService.getTodayAttendanceByType(type);
    res.status(200).json(attendanceList);
  } catch (error) {
    console.error("Error fetching today's attendance list by type:", error);
    res
      .status(500)
      .json({ message: "Error fetching today's attendance list." });
  }
};

const updateAttendanceForSpecificDate = async (req, res) => {
  const { id } = req.params;
  const { date, status } = req.body; // Date and status (Present/Absent)

  try {
    const updatedIntern = await InternService.updateAttendanceForSpecificDate(
      id,
      date,
      status
    );
    res.status(200).json(updatedIntern);
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Error updating attendance for the selected date",
        error: error.message,
      });
  }
};

const getWeeklyAttendanceStats = async (req, res) => {
  try {
    const { attendedInterns, notAttendedInterns } =
      await InternService.getWeeklyAttendanceStats();

    res.status(200).json({
      attendedInterns,
      notAttendedInterns,
    });
  } catch (error) {
    console.error("Error fetching weekly attendance stats:", error.message);
    res.status(500).json({ message: "Error fetching weekly attendance stats" });
  }
};

const getAttendanceByInternId = async (req, res) => {
  const internId = req.params.id;

  try {
    const intern = await InternService.getInternById(internId);
    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }

    // Log the intern data

    // Combine physical and online attendance
    const combinedAttendance = [
      ...(intern.attendance || []),
      ...(intern.onlineAttendance || []),
    ];

    // Sort combined attendance by date (most recent first)
    combinedAttendance.sort((a, b) => new Date(b.date) - new Date(a.date));

    const response = {
      attendance: combinedAttendance,
      stats: {
        present: combinedAttendance.filter(
          (entry) => entry.status === "Present"
        ).length,
        absent: combinedAttendance.filter((entry) => entry.status === "Absent")
          .length,
      },
    };

    res.status(200).json(response); // Sending the structured response
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    res
      .status(500)
      .json({
        message: "Error fetching intern's attendance",
        error: error.message,
      });
  }
};

// const addAvailableDay = async (req, res) => {
//   const { traineeId } = req.params;
//   const { day } = req.body;

//   try {
//     const intern = await InternService.addAvailableDay(traineeId, day);
//     res.status(200).json({
//       message: "Day added successfully",
//       availableDays: intern.availableDays,
//     });
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// };

// const removeAvailableDay = async (req, res) => {
//   const { traineeId } = req.params;
//   const { day } = req.body;

//   try {
//     const intern = await InternService.removeAvailableDay(traineeId, day);
//     res.status(200).json({
//       message: "Day removed successfully",
//       availableDays: intern.availableDays,
//     });
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// };

const addAvailableDay = async (req, res) => {
  const { id } = req.params;
  const { day } = req.body;

  if (!day) {
    return res.status(400).json({ message: "Day is required" });
  }

  try {
    const intern = await InternService.addAvailableDay(id, day);
    res.status(200).json({
      message: "Day added successfully",
      availableDays: intern.availableDays,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const removeAvailableDay = async (req, res) => {
  const { id } = req.params;
  const { day } = req.body;

  if (!day) {
    return res.status(400).json({ message: "Day is required" });
  }

  try {
    const intern = await InternService.removeAvailableDay(id, day);
    res.status(200).json({
      message: "Day removed successfully",
      availableDays: intern.availableDays,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /api/interns/filter/by-day/:day
// const getInternsByDay = async (req, res) => {
//   const { day } = req.params;
//   try {
//     const interns = await Intern.find({ availableDays: day });
//     res.status(200).json(interns);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// GET /api/interns/filter/by-count/:count
// const getInternsByDayCount = async (req, res) => {
//   const count = parseInt(req.params.count);
//   try {
//     const interns = await Intern.find({ $expr: { $eq: [{ $size: "$availableDays" }, count] } });
//     res.status(200).json(interns);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

const uploadTXT = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Read and normalize line endings, remove BOM if present
    let fileContent = fs
      .readFileSync(req.file.path, "utf8")
      .replace(/\uFEFF/g, "") // remove BOM
      .replace(/\r\n/g, "\n"); // unify Windows ↔ Unix

    // Split off header then non-empty rows
    const rows = fileContent
      .split("\n")
      .slice(1)
      .filter((line) => line.trim().length > 0);

    // Map & trim
    const updates = rows.map((row) => {
      const [rawId, rawEmail] = row.split("\t");
      const Trainee_ID = rawId.trim();
      const Trainee_Email = rawEmail
        .trim() // cut out whitespace
        .replace(/^['"]+|['"]+$/g, ""); // strip surrounding quotes if any

      return { Trainee_ID, Trainee_Email };
    });

    for (const { Trainee_ID, Trainee_Email } of updates) {
      try {
        const intern = await InternService.updateInternEmail(
          Trainee_ID,
          Trainee_Email
        );
        if (intern) {
        } else {
        }
      } catch (err) {
        console.error(`❌ Error for ${Trainee_ID}: ${err.message}`);
      }
    }

    res.status(200).json({ message: "Intern emails updated successfully!" });
  } catch (error) {
    console.error("❌ Error uploading file:", error);
    res
      .status(500)
      .json({ message: "Error processing file", error: error.message });
  }
};

module.exports = {
  addIntern,
  addExternalIntern,
  getAllInterns,
  getActiveInternsExternal,
  syncActiveInterns,
  getInternById,
  getAttendanceStats,
  markAttendance,
  updateAttendance,
  assignToTeam,
  removeFromTeam,
  removeIntern,
  updateIntern,
  uploadInterns,
  getAllTeams,
  updateTeamName,
  assignSingleToTeam,
  deleteTeam,
  getAttendanceStatsForToday,
  getAttendanceStatsByType,
  getTodayAttendanceByType,
  updateAttendanceForSpecificDate,
  getWeeklyAttendanceStats,
  getAttendanceByInternId,
  uploadTXT,
  addAvailableDay,
  removeAvailableDay,
  getInternByIdEach,
  // getInternsByDay,
  // getInternsByDayCount
};
