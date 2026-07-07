const InternService = require("../services/internService");
const attendanceService = require("../services/attendanceService");
const { parseXLSX, addInternsFromXLSX } = require("../utils/xlsxHandler");
const sendEmail = require("../utils/emailSender");
const SLTApiScheduler = require("../services/sltApiScheduler");
const DailyRecord = require("../models/DailyRecord");
const FaceAttendanceLog = require("../models/FaceAttendanceLog");
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const TalentTrailService = require("../services/talentTrailService");
const ProfilePicture = require("../models/ProfilePicture");
const {
  addAuditCheckoutTimes,
  buildDailyAttendanceByDate,
  getColomboDateKey,
} = require("../utils/attendanceHistory");

// Doc 3 sets (more complete — includes manual_daily and manual_meeting)
const DAILY_ATTENDANCE_TYPES = new Set([
  "daily",
  "daily_qr",
  "face",
  "manual_daily",
]);

const MEETING_ATTENDANCE_TYPES = new Set([
  "qr",
  "face_meeting",
  "meeting",
  "manual_meeting",
  "manual",
]);

const getDateKey = (date) => {
  return getColomboDateKey(date);
};

const getMeetingKey = (date, meetingName) =>
  `${getDateKey(date)}::${String(meetingName || "General Meeting")
    .trim()
    .toLowerCase()}`;

// Doc 3 normalizeAttendanceMethod (more complete — covers manual_meeting, manual_daily, face recognition)
const normalizeAttendanceMethod = (type) => {
  const normalizedType = String(type || "").toLowerCase();

  // Face recognition attendance
  if (normalizedType === "face" || normalizedType === "face_meeting") {
    return "face recognition";
  }

  // QR attendance
  if (normalizedType === "qr" || normalizedType === "daily_qr") {
    return "qr";
  }

  // Manual attendance
  if (
    normalizedType === "meeting" ||
    normalizedType === "manual_meeting" ||
    normalizedType === "manual" ||
    normalizedType === "manual_daily"
  ) {
    return "manual";
  }

  return normalizedType || "unknown";
};

const formatColomboTime = (date) =>
  new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Colombo",
  });

const addIntern = async (req, res) => {
  try {
    const { Trainee_HomeAddress } = req.body;

    let location, district;

    if (Trainee_HomeAddress) {
      const geo = await geocodeAddress(Trainee_HomeAddress);
      if (geo) {
        location = geo.location;
        district = geo.district;
      }
    }

    const newIntern = await InternService.addIntern({
      ...req.body,
      location,
      district,
    });
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
    let location = undefined;
    let district = "";

    if (newInternData.Trainee_HomeAddress) {
      const geo = await geocodeAddress(newInternData.Trainee_HomeAddress);

      if (geo) {
        location = {
          type: "Point",
          coordinates: [geo.longitude, geo.latitude],
        };
        district = geo.district;
      }
    }
    console.log("Received intern data from external system:", newInternData);

    const newIntern = await InternService.addIntern({
      ...newInternData,
      location,
      district,
    });

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
  const { internId, status, date } = req.body;
  try {
    const updatedIntern = await attendanceService.markAttendanceAndNotify(
      internId,
      status,
      date,
    );
    res.status(200).json({
      message: "Attendance marked successfully",
      intern: updatedIntern,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error marking attendance", error: error.message });
  }
};

const updateAttendance = async (req, res) => {
  try {
    const { date, status } = req.body;
    const updatedIntern = await InternService.updateAttendance(
      req.params.id,
      date,
      status,
    );
    res.status(200).json({
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
    res.status(500).json({
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
      decodedTeamName,
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
      req.body,
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

    console.log("📂 File received:", req.file.path);
    const interns = parseXLSX(req.file.path);
    console.log("✅ Parsed Interns:", interns);

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
      newTeamName,
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
      decodedTeamName,
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

const updateAttendanceForSpecificDate = async (req, res) => {
  const { id } = req.params;
  const { date, status } = req.body; // Date and status (Present/Absent)

  try {
    const updatedIntern = await InternService.updateAttendanceForSpecificDate(
      id,
      date,
      status,
    );
    res.status(200).json(updatedIntern);
  } catch (error) {
    res.status(500).json({
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

    // Get daily records for this intern to include meeting attendance
    const [dailyRecords, successfulDailyFaceLogs] = await Promise.all([
      DailyRecord.find({ internId }).sort({ date: -1 }),
      FaceAttendanceLog.find({
        internId,
        status: "present",
        "metadata.attendanceType": "daily",
      })
        .sort({ attendanceTime: 1 })
        .select("attendanceDate attendanceTime method qrBackupUsed metadata.attendanceAction")
        .lean(),
    ]);

    // Prepare daily attendance from BOTH sources (DailyRecord first, then fallback to intern.attendance)
    const dailyAttendance = [];
    const meetingAttendance = [];

    const meetingMethodByKey = new Map();
    const dailyAttendanceByDate = buildDailyAttendanceByDate(
      intern.attendance,
      DAILY_ATTENDANCE_TYPES,
    );
    addAuditCheckoutTimes(dailyAttendanceByDate, successfulDailyFaceLogs);
    const directFaceDates = new Set(
      successfulDailyFaceLogs
        .filter((log) => log.method === "face" && !log.qrBackupUsed)
        .map((log) => getDateKey(log.attendanceDate || log.attendanceTime)),
    );
    dailyAttendanceByDate.forEach((attendance, dateKey) => {
      attendance.method = directFaceDates.has(dateKey)
        ? "face recognition"
        : normalizeAttendanceMethod(attendance.entry.type);
    });
    const dailyRecordMeetingKeys = new Set();

    if (intern.attendance && intern.attendance.length > 0) {
      intern.attendance.forEach((entry) => {
        const type = (entry.type || "").toLowerCase();
        if (!MEETING_ATTENDANCE_TYPES.has(type)) return;

        const meetingName =
          entry.projectName ||
          entry.meetingName ||
          entry.meeting ||
          entry.title ||
          entry.subject ||
          entry.topic ||
          "General Meeting";
        meetingMethodByKey.set(
          getMeetingKey(entry.date, meetingName),
          normalizeAttendanceMethod(type),
        );
      });
    }

    dailyRecords.forEach((record) => {
      if (record.meetingAttendance && record.meetingAttendance.length > 0) {
        record.meetingAttendance.forEach((meeting) => {
          const projectName = meeting.projectName || meeting.meetingTitle;
          dailyRecordMeetingKeys.add(getMeetingKey(record.date, projectName));
        });
      }
    });

    // Add legacy meeting attendance from intern.attendance when no DailyRecord meeting exists.
    // Skip daily/face attendance entries so they do not appear as meetings.
    if (intern.attendance && intern.attendance.length > 0) {
      intern.attendance.forEach((entry) => {
        const type = (entry.type || "").toLowerCase();
        const isDailyEntry = DAILY_ATTENDANCE_TYPES.has(type);
        if (isDailyEntry) return; // skip daily QR/daily entries

        // All other legacy entries are preserved as meeting attendance
        const legacyMeetingName =
          entry.projectName ||
          entry.meetingName ||
          entry.meeting ||
          entry.title ||
          entry.subject ||
          entry.topic;
        if (
          dailyRecordMeetingKeys.has(
            getMeetingKey(entry.date, legacyMeetingName),
          )
        )
          return;

        meetingAttendance.push({
          date: entry.date,
          status: entry.status || "Present",
          meetingName: legacyMeetingName || "General Meeting",
          type: "Meeting",
          attendanceMethod: normalizeAttendanceMethod(type),
          checkInTime: entry.date ? formatColomboTime(entry.date) : null,
          isMeeting: true,
        });
      });
    }

    // Add recent attendance from dailyRecords (new QR system)
    dailyRecords.forEach((record) => {
      // Add daily attendance if it exists (NEW QR scanned daily attendance goes to Daily section)
      if (record.attendance && record.attendance !== "absent") {
        const matchingInternAttendance = dailyAttendanceByDate.get(
          getDateKey(record.date),
        );
        const attendanceTimeValue =
          record.attendanceTime ||
          matchingInternAttendance?.markedAt ||
          matchingInternAttendance?.entry?.date;
        const attendanceTime = attendanceTimeValue
          ? new Date(attendanceTimeValue)
          : null;
        const checkOutTime =
          record.checkOutTime ||
          matchingInternAttendance?.checkOutTime;
        const meetingDerivedMethod = record.meetingAttendance
          ?.map((meeting) => {
            const projectName = meeting.projectName || meeting.meetingTitle;
            return (
              meeting.method ||
              meetingMethodByKey.get(getMeetingKey(record.date, projectName))
            );
          })
          .find(Boolean);
        dailyAttendance.push({
          date: record.date,
          status:
            record.attendance === "present"
              ? "Present"
              : record.attendance === "late"
                ? "Late"
                : "Absent",
          type: "Daily",
          recordStatus: record.status, // working | leave | wfh — used for Extended Leave / WFH colour coding (from doc4)
          attendanceMethod:
            matchingInternAttendance?.method ||
            normalizeAttendanceMethod(meetingDerivedMethod) ||
            "unknown",
          checkInTime: attendanceTime
            ? formatColomboTime(attendanceTime)
            : null,
          checkOutTime: checkOutTime
            ? formatColomboTime(checkOutTime)
            : null,
          attendanceTime: attendanceTimeValue,
        });
      }

      // Add meeting attendance if it exists (NEW QR scanned meeting attendance goes to Meeting section)
      if (record.meetingAttendance && record.meetingAttendance.length > 0) {
        record.meetingAttendance.forEach((meeting) => {
          const attendanceTime = new Date(meeting.attendanceTime);
          const projectName = meeting.projectName || meeting.meetingTitle;
          meetingAttendance.push({
            date: record.date,
            status: "Present",
            meetingName: projectName,
            projectName,
            type: "Meeting",
            attendanceMethod: normalizeAttendanceMethod(
              meeting.method ||
                meetingMethodByKey.get(getMeetingKey(record.date, projectName)),
            ),
            checkInTime: formatColomboTime(attendanceTime),
            isMeeting: true,
          });
        });
      }
    });

    // --- TALENTTRAIL EXTERNAL API INTEGRATION (from doc4) ---
    try {
      const ttData = await TalentTrailService.getCertificateData(
        intern.Trainee_ID,
        intern.Trainee_Email,
      );
      if (
        ttData &&
        ttData.attendanceRecords &&
        ttData.attendanceRecords.length > 0
      ) {
        ttData.attendanceRecords.forEach((record) => {
          const attendanceTime = record.date
            ? new Date(record.date)
            : new Date();
          const projectName = record.projectName || "External Project";
          // Avoid duplicating if we already have it from DailyRecord
          if (
            !dailyRecordMeetingKeys.has(
              getMeetingKey(attendanceTime, projectName),
            )
          ) {
            meetingAttendance.push({
              date: attendanceTime,
              status:
                record.status === "PRESENT"
                  ? "Present"
                  : record.status === "LATE"
                    ? "Late"
                    : "Absent",
              meetingName: projectName,
              projectName: projectName,
              type: "Meeting",
              attendanceMethod: "talenttrail", // Mark source as external
              checkInTime: attendanceTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              isMeeting: true,
            });
            dailyRecordMeetingKeys.add(
              getMeetingKey(attendanceTime, projectName),
            );
          }
        });
      }
    } catch (e) {
      console.error(
        "Failed to fetch external TalentTrail meeting attendance:",
        e.message,
      );
    }

    // Fallback: include daily/face scans from intern.attendance if DailyRecord doesn't exist for that date
    try {
      const datesWithDailyRecord = new Set(
        dailyAttendance.map((d) => getDateKey(d.date)),
      );

      dailyAttendanceByDate.forEach(
        ({ entry, markedAt, method, checkOutTime }, dayKey) => {
          const entryDate = entry.date ? new Date(entry.date) : null;
          if (!entryDate || isNaN(entryDate.getTime())) return;
          if (datesWithDailyRecord.has(dayKey)) return; // already covered by DailyRecord

          dailyAttendance.push({
            date: entryDate,
            status: entry.status || "Present",
            type: "Daily",
            attendanceMethod: method || normalizeAttendanceMethod(entry.type),
            checkInTime: formatColomboTime(markedAt || entryDate),
            checkOutTime: checkOutTime
              ? formatColomboTime(checkOutTime)
              : null,
            attendanceTime: markedAt || entry.date,
          });
          datesWithDailyRecord.add(dayKey);
        },
      );
    } catch (e) {
      // Non-fatal: if fallback merge fails, continue with what we have
    }

    // Sort daily attendance by date (newest first)
    dailyAttendance.sort((a, b) => new Date(b.date) - new Date(a.date));
    const uniqueDailyAttendance = [];
    const seenDailyDates = new Set();
    dailyAttendance.forEach((entry) => {
      const dayKey = getDateKey(entry.date);
      if (seenDailyDates.has(dayKey)) return;
      seenDailyDates.add(dayKey);
      uniqueDailyAttendance.push(entry);
    });

    // Sort meeting attendance by date (newest first)
    meetingAttendance.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Combine for backward compatibility
    const combinedAttendance = [...uniqueDailyAttendance, ...meetingAttendance];
    combinedAttendance.sort((a, b) => new Date(b.date) - new Date(a.date));

    const response = {
      attendance: combinedAttendance, // Keep for backward compatibility
      dailyAttendance: uniqueDailyAttendance,
      meetingAttendance: meetingAttendance,
      stats: {
        present: meetingAttendance.filter((entry) => entry.status === "Present")
          .length,
        absent: meetingAttendance.filter((entry) => entry.status === "Absent")
          .length,
      },
    };

    console.log("Backend Response:", {
      dailyAttendanceCount: uniqueDailyAttendance.length,
      meetingAttendanceCount: meetingAttendance.length,
      dailyAttendanceSample: uniqueDailyAttendance.slice(0, 2),
      meetingAttendanceSample: meetingAttendance.slice(0, 2),
      combinedCount: combinedAttendance.length,
    });

    res.status(200).json(response); // Sending the structured response
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    res.status(500).json({
      message: "Error fetching intern's attendance",
      error: error.message,
    });
  }
};

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

const uploadTXT = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    let fileContent = fs
      .readFileSync(req.file.path, "utf8")
      .replace(/\uFEFF/g, "") // remove BOM
      .replace(/\r\n/g, "\n"); // unify Windows ↔ Unix

    const rows = fileContent
      .split("\n")
      .slice(1)
      .filter((line) => line.trim().length > 0);

    const updates = rows.map((row) => {
      const [rawId, rawEmail] = row.split("\t");
      const Trainee_ID = rawId.trim();
      const Trainee_Email = rawEmail.trim().replace(/^['"]+|['"]+$/g, ""); // strip surrounding quotes if any

      return { Trainee_ID, Trainee_Email };
    });

    for (const { Trainee_ID, Trainee_Email } of updates) {
      try {
        const intern = await InternService.updateInternEmail(
          Trainee_ID,
          Trainee_Email,
        );
        if (intern) {
          console.log(`✅ ${Trainee_ID} → ${Trainee_Email}`);
        } else {
          console.log(`⚠️  ${Trainee_ID} not found, skipping.`);
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

// ==================== SLT API INTEGRATION CONTROLLERS ====================

const syncWithSLTAPI = async (req, res) => {
  try {
    console.log("🔄 SLT API sync requested via controller...");
    const result = await InternService.syncWithSLTAPI();

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        stats: result.stats,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        stats: result.stats,
      });
    }
  } catch (error) {
    console.error("❌ Controller error during SLT sync:", error);
    res.status(500).json({
      success: false,
      message: `Internal server error: ${error.message}`,
      stats: {
        added: 0,
        updated: 0,
        skipped: 0,
        errors: 1,
        totalProcessed: 0,
      },
    });
  }
};

const testSLTAPI = async (req, res) => {
  try {
    const result = await InternService.testSLTAPI();

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        count: result.count,
        sample: result.sample,
        total: result.total,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        count: result.count,
        sample: result.sample,
        total: result.total,
      });
    }
  } catch (error) {
    console.error("❌ Controller error during SLT API test:", error);
    res.status(500).json({
      success: false,
      message: `Internal server error: ${error.message}`,
      count: 0,
      sample: [],
      total: 0,
    });
  }
};

const getActiveTraineesFromSLT = async (req, res) => {
  try {
    const result = await InternService.getActiveTraineesFromSLT();

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        count: result.count,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        data: [],
        count: 0,
      });
    }
  } catch (error) {
    console.error("❌ Controller error fetching SLT trainees:", error);
    res.status(500).json({
      success: false,
      message: `Internal server error: ${error.message}`,
      data: [],
      count: 0,
    });
  }
};

const cleanupInactiveInterns = async (req, res) => {
  try {
    console.log("🧹 Cleanup of inactive interns requested via controller...");
    const result = await InternService.cleanupInactiveInterns();

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        stats: result.stats,
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        stats: result.stats,
      });
    }
  } catch (error) {
    console.error("❌ Controller error during inactive intern cleanup:", error);
    res.status(500).json({
      success: false,
      message: `Internal server error: ${error.message}`,
      stats: {
        totalInDb: 0,
        activeInApi: 0,
        removed: 0,
        errors: 1,
      },
    });
  }
};

// ==================== SLT API SCHEDULER CONTROLLERS ====================

const triggerManualSLTSync = async (req, res) => {
  try {
    console.log("🔧 Manual SLT API sync requested via controller...");
    const result = await SLTApiScheduler.triggerManualSync();

    if (result.success) {
      res.status(200).json({
        success: true,
        message: "Manual sync completed successfully",
        timestamp: result.timestamp,
        type: result.type,
        results: result.results,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Manual sync failed",
        timestamp: result.timestamp,
        type: result.type,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("❌ Controller error during manual SLT sync:", error);
    res.status(500).json({
      success: false,
      message: `Internal server error: ${error.message}`,
      timestamp: new Date(),
      type: "manual_sync",
      error: error.message,
    });
  }
};

const triggerComprehensiveUpdate = async (req, res) => {
  try {
    console.log("🔧 Comprehensive update requested via controller...");
    const result = await SLTApiScheduler.triggerManualUpdate();

    if (result.success) {
      res.status(200).json({
        success: true,
        message: "Comprehensive update completed successfully",
        timestamp: result.timestamp,
        type: result.type,
        results: result.results,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Comprehensive update failed",
        timestamp: result.timestamp,
        type: result.type,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("❌ Controller error during comprehensive update:", error);
    res.status(500).json({
      success: false,
      message: `Internal server error: ${error.message}`,
      timestamp: new Date(),
      type: "comprehensive_update",
      error: error.message,
    });
  }
};

const acceptAgreement = async (req, res) => {
  try {
    const internId = req.params.id;
    const updatedIntern = await InternService.acceptAgreement(internId);
    res.status(200).json({
      message: "Agreement accepted successfully",
      agreementAccepted: updatedIntern.agreementAccepted,
      agreementAcceptedDate: updatedIntern.agreementAcceptedDate,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error accepting agreement", error: error.message });
  }
};

const checkInternProjects = async (req, res) => {
  try {
    const internId = req.params.id;
    const intern = await InternService.getInternById(internId);

    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }

    // Look up the locally-synced TalentTrail record by email
    const InternTalentTrailSync = require("../models/InternTalentTrailSync");
    const syncRecord = await InternTalentTrailSync.findOne({
      email: { $regex: new RegExp(`^${intern.Trainee_Email}$`, "i") },
    }).select("projects lastSyncedAt");

    if (!syncRecord) {
      // No TalentTrail record yet — intern hasn't been synced
      return res.status(200).json({ projects: null, projectCount: 0 });
    }

    // Check the projects array directly
    const projects = Array.isArray(syncRecord.projects)
      ? syncRecord.projects
      : [];
    return res.status(200).json({
      projects: projects.length > 0 ? projects : null,
      projectCount: projects.length,
    });
  } catch (error) {
    console.error("Error checking intern projects:", error);
    res.status(500).json({
      message: "Error checking intern projects",
      error: error.message,
    });
  }
};

// =========================== PROFILE PICTURE MANAGEMENT ===========================

// Upload or update profile picture
const uploadProfilePicture = async (req, res) => {
  try {
    const { id } = req.params;
    let imageBuffer = null;
    let contentType = "image/jpeg";

    if (req.file) {
      imageBuffer = fs.readFileSync(req.file.path);
      contentType = req.file.mimetype;
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Failed to delete temp file:", err);
      }
    } else if (req.body.imageBase64) {
      let base64Data = req.body.imageBase64;
      if (base64Data.includes("base64,")) {
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          contentType = matches[1];
          base64Data = matches[2];
        }
      }
      imageBuffer = Buffer.from(base64Data, "base64");
    } else {
      return res
        .status(400)
        .json({ error: "No image file or base64 data provided" });
    }

    await ProfilePicture.findOneAndUpdate(
      { internId: id },
      { internId: id, imageBuffer, contentType },
      { upsert: true, new: true },
    );

    res.status(200).json({ message: "Profile picture uploaded successfully" });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    res.status(500).json({ error: "Failed to upload profile picture" });
  }
};

// Retrieve profile picture (streams directly to browser)
const getProfilePicture = async (req, res) => {
  try {
    const { id } = req.params;
    let internId = id;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      const mongoose = require("mongoose");
      const Intern = mongoose.model("Intern");
      const intern = await Intern.findOne({ Trainee_ID: id });
      if (!intern) {
        return res.status(404).json({ error: "Intern not found" });
      }
      internId = intern._id;
    }

    // 1. Check for custom upload first
    const profilePic = await ProfilePicture.findOne({ internId });
    if (profilePic && profilePic.imageBuffer) {
      res.writeHead(200, {
        "Content-Type": profilePic.contentType,
        "Content-Length": profilePic.imageBuffer.length,
        "Cache-Control": "public, max-age=86400",
      });
      return res.end(profilePic.imageBuffer);
    }

    // 2. Check for Google profile picture fallback
    const mongoose = require("mongoose");
    const Intern = mongoose.model("Intern");
    const internDoc = await Intern.findById(internId);
    if (internDoc && internDoc.googlePictureUrl) {
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.redirect(302, internDoc.googlePictureUrl);
    }

    // 3. Fallback to 404
    res.status(404).json({ error: "Profile picture not found" });
  } catch (error) {
    console.error("Error fetching profile picture:", error);
    res.status(500).json({ error: "Failed to fetch profile picture" });
  }
};

// =========================== TOUR / ONBOARDING ===========================

/**
 * PATCH /interns/:id/tour-seen
 * Body: { version: "v1.0-initial" }
 * Saves the tour version the intern has seen so the tour is not shown again.
 */
const markTourSeen = async (req, res) => {
  try {
    const { id } = req.params;
    const { version } = req.body;

    if (!version) {
      return res.status(400).json({ message: "version is required" });
    }

    const Intern = require("../models/Intern");

    const intern = await Intern.findByIdAndUpdate(
      id,
      { $set: { tourSeenVersion: version } },
      { new: true },
    );

    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }

    res.status(200).json({ ok: true, tourSeenVersion: intern.tourSeenVersion });
  } catch (error) {
    console.error("Error marking tour as seen:", error);
    res
      .status(500)
      .json({ message: "Error marking tour as seen", error: error.message });
  }
};

module.exports = {
  addIntern,
  addExternalIntern,
  getAllInterns,
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
  updateAttendanceForSpecificDate,
  getWeeklyAttendanceStats,
  getAttendanceByInternId,
  uploadTXT,
  addAvailableDay,
  removeAvailableDay,
  getInternByIdEach,
  // SLT API Integration endpoints
  syncWithSLTAPI,
  testSLTAPI,
  getActiveTraineesFromSLT,
  cleanupInactiveInterns,
  // SLT API Scheduler endpoints
  triggerManualSLTSync,
  triggerComprehensiveUpdate,
  acceptAgreement,
  checkInternProjects,
  uploadProfilePicture,
  getProfilePicture,
  markTourSeen,
};
