const InternRepository = require("../repositories/internRepository");
const DailyRecord = require("../models/DailyRecord");

/* ─── Attendance type classification ──────────────────────────── */
const MEETING_ATTENDANCE_TYPES = new Set([
  "qr",
  "face_meeting",
  "meeting",
  "manual_meeting",
  "manual",
]);

const DAILY_ATTENDANCE_TYPES = new Set([
  "daily",
  "daily_qr",
  "face",
  "manual_daily",
]);

function classifyAttendance(records = []) {
  const daily = [];
  const meeting = [];

  for (const r of records) {
    if (DAILY_ATTENDANCE_TYPES.has(r.type)) {
      daily.push(r);
    } else if (MEETING_ATTENDANCE_TYPES.has(r.type)) {
      meeting.push(r);
    }
  }

  return { daily, meeting };
}

class InactiveInternController {
  /**
   * Get all inactive interns — paginated & searchable
   * Query params: page (default 1), limit (default 15), search (optional)
   */
  static async getAllInactiveInterns(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
      const search = (req.query.search || "").trim();
      const skip = (page - 1) * limit;

      const { interns, total } =
        await InternRepository.getAllInactiveInternsPaginated({
          skip,
          limit,
          search,
        });

      const enrichedInterns = interns.map((intern) => ({
        id: intern._id,
        traineeId: intern.Trainee_ID,
        traineeName: intern.Trainee_Name,
        email: intern.Trainee_Email,
        institute: intern.Institute,
        fieldOfSpecialization: intern.field_of_spec_name,
        trainingStartDate: intern.Training_StartDate,
        trainingEndDate: intern.Training_EndDate,
        archiveReason: intern.archiveReason,
        archivedAt: intern.archivedAt,
        createdAt: intern.originalCreatedAt,
      }));

      res.json({
        success: true,
        data: enrichedInterns,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error("Error fetching inactive interns:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch inactive interns",
      });
    }
  }

  /**
   * Get details of an inactive intern — now includes classified attendance
   */
  static async getInactiveInternDetails(req, res) {
    try {
      const { internId } = req.params;

      const inactiveIntern =
        await InternRepository.getInactiveInternById(internId);

      if (!inactiveIntern) {
        return res.status(404).json({
          success: false,
          error: "Inactive intern not found",
        });
      }

      const attendanceRecords = inactiveIntern.attendance || [];
      const { daily, meeting } = classifyAttendance(attendanceRecords);

      // Build calendar-friendly maps: "YYYY-MM-DD" → count / details
      const dailyMap = {};
      for (const r of daily) {
        const key = new Date(r.date).toISOString().slice(0, 10);
        if (!dailyMap[key]) dailyMap[key] = [];
        dailyMap[key].push({
          status: r.status,
          type: r.type,
          timeMarked: r.timeMarked,
        });
      }

      const meetingMap = {};
      for (const r of meeting) {
        const key = new Date(r.date).toISOString().slice(0, 10);
        if (!meetingMap[key]) meetingMap[key] = [];
        meetingMap[key].push({
          status: r.status,
          type: r.type,
          timeMarked: r.timeMarked,
          meetingName: r.meetingName,
        });
      }

      // Training duration
      const startDate = inactiveIntern.Training_StartDate
        ? new Date(inactiveIntern.Training_StartDate)
        : null;
      const endDate = inactiveIntern.Training_EndDate
        ? new Date(inactiveIntern.Training_EndDate)
        : null;
      const daysInTraining =
        startDate && endDate
          ? Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24))
          : 0;

      const enrichedData = {
        id: inactiveIntern._id,
        traineeId: inactiveIntern.Trainee_ID,
        traineeName: inactiveIntern.Trainee_Name,
        email: inactiveIntern.Trainee_Email,
        institute: inactiveIntern.Institute,
        fieldOfSpecialization: inactiveIntern.field_of_spec_name,
        trainingStartDate: inactiveIntern.Training_StartDate,
        trainingEndDate: inactiveIntern.Training_EndDate,
        homeAddress: inactiveIntern.Trainee_HomeAddress,
        archiveReason: inactiveIntern.archiveReason,
        archivedAt: inactiveIntern.archivedAt,
        totalDays: daysInTraining,
        // Attendance summary
        attendance: {
          daily: {
            count: daily.length,
            presentCount: daily.filter((r) => r.status === "Present").length,
            map: dailyMap,
          },
          meeting: {
            count: meeting.length,
            presentCount: meeting.filter((r) => r.status === "Present").length,
            map: meetingMap,
          },
        },
        // Keep legacy statistics for backwards compat
        statistics: {
          totalMarked: attendanceRecords.length,
          present: attendanceRecords.filter((r) => r.status === "Present")
            .length,
          attendancePercentage:
            attendanceRecords.length > 0
              ? (
                  (attendanceRecords.filter((r) => r.status === "Present")
                    .length /
                    attendanceRecords.length) *
                  100
                ).toFixed(2)
              : 0,
        },
      };

      res.json({
        success: true,
        data: enrichedData,
      });
    } catch (error) {
      console.error("Error fetching inactive intern details:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch inactive intern details",
      });
    }
  }

  /**
   * Get attendance statistics for an inactive intern
   */
  static async getInactiveInternAttendanceStats(req, res) {
    try {
      const { internId } = req.params;

      const inactiveIntern =
        await InternRepository.getInactiveInternById(internId);

      if (!inactiveIntern) {
        return res.status(404).json({
          success: false,
          error: "Inactive intern not found",
        });
      }

      const attendanceRecords = inactiveIntern.attendance || [];
      const { daily, meeting } = classifyAttendance(attendanceRecords);

      res.json({
        success: true,
        data: {
          daily: {
            count: daily.length,
            presentCount: daily.filter((r) => r.status === "Present").length,
          },
          meeting: {
            count: meeting.length,
            presentCount: meeting.filter((r) => r.status === "Present").length,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching attendance stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch attendance statistics",
      });
    }
  }

  /**
   * Get daily records for an inactive intern — returns a date-indexed map
   * so the frontend can quickly look up records by date.
   */
  static async getInactiveInternDailyRecords(req, res) {
    try {
      const { internId } = req.params;
      const { startDate, endDate } = req.query;

      const inactiveIntern =
        await InternRepository.getInactiveInternById(internId);

      if (!inactiveIntern) {
        return res.status(404).json({
          success: false,
          error: "Inactive intern not found",
        });
      }

      const query = { internId: inactiveIntern._id };

      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) {
          // Include the entire end day
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          query.date.$lte = end;
        }
      }

      const dailyRecords = await DailyRecord.find(query)
        .sort({ date: -1 })
        .limit(200); // higher limit since we index by date

      // Build a date → record map for O(1) lookup in the calendar
      const recordsByDate = {};
      for (const r of dailyRecords) {
        const key = new Date(r.date).toISOString().slice(0, 10);
        recordsByDate[key] = r;
      }

      res.json({
        success: true,
        data: dailyRecords,
        recordsByDate,
      });
    } catch (error) {
      console.error("Error fetching daily records:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch daily records",
      });
    }
  }

  /**
   * Reactivate an inactive intern (move back to active Interns collection)
   */
  static async reactivateInactiveIntern(req, res) {
    try {
      const { internId } = req.params;

      const inactiveIntern =
        await InternRepository.getInactiveInternById(internId);

      if (!inactiveIntern) {
        return res.status(404).json({
          success: false,
          error: "Inactive intern not found",
        });
      }

      await InternRepository.restoreInactiveIntern(internId);

      res.json({
        success: true,
        message: `${inactiveIntern.Trainee_Name} has been reactivated successfully`,
        data: {
          traineeId: inactiveIntern.Trainee_ID,
          traineeName: inactiveIntern.Trainee_Name,
        },
      });
    } catch (error) {
      console.error("Error reactivating inactive intern:", error);
      res.status(500).json({
        success: false,
        error: "Failed to reactivate inactive intern",
      });
    }
  }
}

module.exports = InactiveInternController;
