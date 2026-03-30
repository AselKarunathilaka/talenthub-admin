const Intern = require("../models/Intern");
const mongoose = require("mongoose");

class InternRepository {
  static async addIntern(data) {
    const intern = new Intern(data);
    return await intern.save();
  }

  static async getAllInterns() {
    return await Intern.find();
  }

  static async getInternById(internId) {
    return await Intern.findById(internId);
  }

  static async findByEmail(email) {
    if (!email) return null;
    // DB stores email under Trainee_Email (canonical). Use case-insensitive match to be robust.
    const escaped = String(email)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return await Intern.findOne({
      Trainee_Email: { $regex: `^${escaped}$`, $options: "i" },
    });
  }

  static async getAttendanceStats() {
    const interns = await Intern.find();
    const stats = { present: 0, absent: 0 };

    interns.forEach((intern) => {
      if (intern.attendance.length > 0) {
        const latestAttendance =
          intern.attendance[intern.attendance.length - 1];
        if (latestAttendance.status === "Present") {
          stats.present++;
        } else {
          stats.absent++;
        }
      }
    });

    return stats;
  }

  static async markAttendance(
    internId,
    status,
    date,
    type = "manual",
    timeMarked = null
  ) {
    try {
      console.log("Repository: Marking attendance for intern:", internId);

      if (!internId) {
        throw new Error("Intern ID is required");
      }

      // Validate if internId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(internId)) {
        console.error("Invalid ObjectId format:", internId);
        throw new Error("Invalid intern ID format");
      }

      const intern = await Intern.findById(internId);
      if (!intern) {
        console.error("Intern not found with ID:", internId);
        throw new Error("Intern not found");
      }

      console.log("Found intern:", intern.Trainee_Name);

      const attendanceDate = new Date(date).setHours(0, 0, 0, 0);
      const actualTimeMarked = timeMarked || new Date();

      // Check if attendance for this type already exists for today
      const existingAttendanceIndex = intern.attendance.findIndex(
        (entry) =>
          new Date(entry.date).setHours(0, 0, 0, 0) === attendanceDate &&
          entry.type === type
      );

      if (existingAttendanceIndex !== -1) {
        console.log("Updating existing attendance entry for type:", type);
        intern.attendance[existingAttendanceIndex].status = status;
        intern.attendance[existingAttendanceIndex].timeMarked =
          actualTimeMarked;
      } else {
        console.log("Adding new attendance entry for type:", type);
        intern.attendance.push({
          date: date,
          status,
          type,
          timeMarked: actualTimeMarked,
        });
      }

      // Save without validation to avoid fieldOfSpecialization validation issues
      const savedIntern = await intern.save({ validateBeforeSave: false });
      console.log("Attendance saved successfully");
      return savedIntern;
    } catch (error) {
      console.error("Error in markAttendance repository:", error);
      throw error;
    }
  }

  static async updateAttendance(internId, date, status) {
    const intern = await Intern.findById(internId);
    if (!intern) throw new Error("Intern not found");

    const attendanceIndex = intern.attendance.findIndex(
      (entry) =>
        new Date(entry.date).setHours(0, 0, 0, 0) ===
        new Date(date).setHours(0, 0, 0, 0)
    );

    if (attendanceIndex !== -1) {
      intern.attendance[attendanceIndex].status = status;
    } else {
      intern.attendance.push({ date: new Date(date), status });
    }

    // Save without validation to avoid fieldOfSpecialization validation issues
    return await intern.save({ validateBeforeSave: false });
  }

  static async getAllInternsForDate(startDate, endDate) {
    return await Intern.find({
      "attendance.date": {
        $gte: startDate,
        $lt: endDate,
      },
    });
  }

  static async assignToTeam(internIds, teamName) {
    return await Intern.updateMany(
      { _id: { $in: internIds } },
      { $set: { team: teamName } }
    );
  }

  static async removeFromTeam(internId) {
    const updatedIntern = await Intern.findByIdAndUpdate(
      internId,
      { $set: { team: "" } },
      { new: true }
    );
    return updatedIntern;
  }

  static async removeIntern(internId) {
    return await Intern.findByIdAndDelete(internId);
  }

  static async updateIntern(internId, data) {
    return await Intern.findByIdAndUpdate(internId, data, { new: true });
  }

  static async getAllTeams() {
    try {
      const teams = await Intern.aggregate([
        { $match: { team: { $ne: "" } } },
        { $group: { _id: "$team", members: { $push: "$$ROOT" } } },
        {
          $project: {
            name: "$_id",
            members: 1,
            _id: 0,
          },
        },
      ]);
      return teams;
    } catch (error) {
      throw new Error("Error fetching teams: " + error.message);
    }
  }

  static async updateTeamName(oldTeamName, newTeamName) {
    const result = await Intern.updateMany(
      { team: oldTeamName },
      { $set: { team: newTeamName } }
    );
    return {
      modifiedCount: result.modifiedCount,
      message: `Successfully updated ${result.modifiedCount} interns from ${oldTeamName} to ${newTeamName}`,
    };
  }

  static async deleteTeam(teamName) {
    const result = await Intern.updateMany(
      { team: teamName },
      { $set: { team: "" } }
    );
    return {
      deletedCount: result.modifiedCount,
      message: `Team "${teamName}" deleted - ${result.modifiedCount} interns removed`,
    };
  }

  static async assignSingleToTeam(internId, teamName) {
    // Find the intern by ID and update their team
    const updatedIntern = await Intern.findByIdAndUpdate(
      internId,
      { $set: { team: teamName } },
      { new: true }
    );
    return updatedIntern;
  }

  // Updated to include online attendance
  static async getAttendanceStatsForToday() {
    const today = new Date().setHours(0, 0, 0, 0);
    const interns = await Intern.find();
    const stats = { present: 0, absent: 0 };

    interns.forEach((intern) => {
      // Check physical attendance
      const todayPhysicalAttendance = intern.attendance.find(
        (entry) => new Date(entry.date).setHours(0, 0, 0, 0) === today
      );

      // Check online attendance
      const todayOnlineAttendance = intern.onlineAttendance?.find(
        (entry) => new Date(entry.date).setHours(0, 0, 0, 0) === today
      );

      // Count as present if either physical or online attendance is marked as Present
      const isPresent =
        (todayPhysicalAttendance &&
          todayPhysicalAttendance.status === "Present") ||
        (todayOnlineAttendance && todayOnlineAttendance.status === "Present");

      const isAbsent =
        (todayPhysicalAttendance &&
          todayPhysicalAttendance.status === "Absent") ||
        (todayOnlineAttendance && todayOnlineAttendance.status === "Absent");

      if (isPresent) {
        stats.present++;
      } else if (isAbsent) {
        stats.absent++;
      }
    });

    return stats;
  }

  // Updated to include online attendance for meeting stats
  static async getAttendanceStatsByType(attendanceType = null) {
    const today = new Date().setHours(0, 0, 0, 0);
    const interns = await Intern.find();
    const stats = {
      dailyAttendance: { present: 0, absent: 0 },
      meetingAttendance: { present: 0, absent: 0 },
      total: { present: 0, absent: 0 },
    };

    interns.forEach((intern) => {
      const todayPhysicalAttendance = intern.attendance.filter(
        (entry) => new Date(entry.date).setHours(0, 0, 0, 0) === today
      );

      const todayOnlineAttendance =
        intern.onlineAttendance?.filter(
          (entry) => new Date(entry.date).setHours(0, 0, 0, 0) === today
        ) || [];

      // Check for daily attendance (daily_qr type)
      const dailyAttendance = todayPhysicalAttendance.find(
        (entry) => entry.type === "daily_qr"
      );
      if (dailyAttendance && dailyAttendance.status === "Present") {
        stats.dailyAttendance.present++;
      } else if (dailyAttendance && dailyAttendance.status === "Absent") {
        stats.dailyAttendance.absent++;
      }

      // Check for meeting attendance (qr, manual, or online_attendance type)
      const physicalMeetingAttendance = todayPhysicalAttendance.find(
        (entry) => entry.type === "qr" || entry.type === "manual"
      );
      const onlineMeetingAttendance = todayOnlineAttendance.find(
        (entry) => entry.type === "online_attendance"
      );

      // Count as present if either physical meeting or online meeting attendance is Present
      const hasMeetingPresent =
        (physicalMeetingAttendance &&
          physicalMeetingAttendance.status === "Present") ||
        (onlineMeetingAttendance &&
          onlineMeetingAttendance.status === "Present");

      const hasMeetingAbsent =
        (physicalMeetingAttendance &&
          physicalMeetingAttendance.status === "Absent") ||
        (onlineMeetingAttendance &&
          onlineMeetingAttendance.status === "Absent");

      if (hasMeetingPresent) {
        stats.meetingAttendance.present++;
      } else if (hasMeetingAbsent) {
        stats.meetingAttendance.absent++;
      }

      // Total stats (any attendance type including online)
      const hasAnyAttendance =
        todayPhysicalAttendance.some((entry) => entry.status === "Present") ||
        todayOnlineAttendance.some((entry) => entry.status === "Present");

      const hasAnyAbsent =
        todayPhysicalAttendance.length > 0 || todayOnlineAttendance.length > 0;

      if (hasAnyAttendance) {
        stats.total.present++;
      } else if (hasAnyAbsent) {
        stats.total.absent++;
      }
    });

    if (attendanceType === "daily") {
      return stats.dailyAttendance;
    } else if (attendanceType === "meeting") {
      return stats.meetingAttendance;
    }

    return stats;
  }

  // Updated to include online attendance records
  static async getTodayAttendanceByType(attendanceType = null) {
    const today = new Date().setHours(0, 0, 0, 0);
    const interns = await Intern.find();
    const attendedInterns = [];

    interns.forEach((intern) => {
      const todayPhysicalAttendance = intern.attendance.filter(
        (entry) => new Date(entry.date).setHours(0, 0, 0, 0) === today
      );

      const todayOnlineAttendance =
        intern.onlineAttendance?.filter(
          (entry) => new Date(entry.date).setHours(0, 0, 0, 0) === today
        ) || [];

      let hasRelevantAttendance = false;
      let attendanceInfo = null;

      if (attendanceType === "daily") {
        const dailyAttendance = todayPhysicalAttendance.find(
          (entry) => entry.type === "daily_qr" && entry.status === "Present"
        );
        if (dailyAttendance) {
          hasRelevantAttendance = true;
          attendanceInfo = {
            type: "Daily",
            time: dailyAttendance.timeMarked || dailyAttendance.date,
            method:
              dailyAttendance.markedBy === "external_system"
                ? "QR Code Scan"
                : "Manual Entry",
          };
        }
      } else if (attendanceType === "meeting") {
        // Include both physical meeting attendance and ALL online attendance records
        const physicalMeetingAttendance = todayPhysicalAttendance.find(
          (entry) =>
            (entry.type === "qr" || entry.type === "manual") &&
            entry.status === "Present"
        );
        const onlineMeetingAttendances = todayOnlineAttendance.filter(
          (entry) =>
            entry.type === "online_attendance" && entry.status === "Present"
        );

        const infoList = [];

        if (physicalMeetingAttendance) {
          infoList.push({
            type:
              physicalMeetingAttendance.type === "manual"
                ? "Manual"
                : "Meeting",
            time:
              physicalMeetingAttendance.timeMarked ||
              physicalMeetingAttendance.date,
            method:
              physicalMeetingAttendance.markedBy === "external_system"
                ? "QR Code Scan"
                : "Manual Entry",
          });
        }

        // Add ALL online meeting attendance records instead of just one
        onlineMeetingAttendances.forEach((onlineMeetingAttendance) => {
          infoList.push({
            type: "Online Meeting",
            time:
              onlineMeetingAttendance.timeMarked ||
              onlineMeetingAttendance.date,
            method:
              onlineMeetingAttendance.markedBy === "csv_upload_system"
                ? "CSV Upload"
                : "Manual Entry",
            meetingName: onlineMeetingAttendance.meetingName || "N/A",
          });
        });

        if (infoList.length > 0) {
          hasRelevantAttendance = true;
          attendanceInfo = infoList.length === 1 ? infoList[0] : infoList;
        }
      } else {
        // Return all applicable attendance types for "All" view
        const presentPhysicalAttendance = todayPhysicalAttendance.filter(
          (entry) => entry.status === "Present"
        );
        const presentOnlineAttendance = todayOnlineAttendance.filter(
          (entry) => entry.status === "Present"
        );
        const infoList = [];

        const dailyAttendance = presentPhysicalAttendance.find(
          (entry) => entry.type === "daily_qr"
        );
        const meetingQRAttendance = presentPhysicalAttendance.find(
          (entry) => entry.type === "qr"
        );
        const manualAttendance = presentPhysicalAttendance.find(
          (entry) => entry.type === "manual"
        );
        const onlineAttendances = presentOnlineAttendance.filter(
          (entry) => entry.type === "online_attendance"
        );

        // Add Daily if present
        if (dailyAttendance) {
          infoList.push({
            type: "Daily",
            time: dailyAttendance.timeMarked || dailyAttendance.date,
            method:
              dailyAttendance.markedBy === "external_system"
                ? "QR Code Scan"
                : "Manual Entry",
          });
        }

        // Add Meeting (QR) only when Daily is present
        if (dailyAttendance && meetingQRAttendance) {
          infoList.push({
            type: "Meeting",
            time: meetingQRAttendance.timeMarked || meetingQRAttendance.date,
            method:
              meetingQRAttendance.markedBy === "external_system"
                ? "QR Code Scan"
                : "Manual Entry",
          });
        }

        // Always include Manual if present, as a separate type
        if (manualAttendance) {
          infoList.push({
            type: "Manual",
            time: manualAttendance.timeMarked || manualAttendance.date,
            method:
              manualAttendance.markedBy === "external_system"
                ? "QR Code Scan"
                : "Manual Entry",
          });
        }

        // Add ALL online attendance records if present
        onlineAttendances.forEach((onlineAttendance) => {
          infoList.push({
            type: "Online Meeting",
            time: onlineAttendance.timeMarked || onlineAttendance.date,
            method:
              onlineAttendance.markedBy === "csv_upload_system"
                ? "CSV Upload"
                : "Manual Entry",
            meetingName: onlineAttendance.meetingName || "N/A",
          });
        });

        if (infoList.length > 0) {
          hasRelevantAttendance = true;
          attendanceInfo = infoList;
        }
      }

      if (hasRelevantAttendance) {
        attendedInterns.push({
          Trainee_ID: intern.Trainee_ID,
          Trainee_Name: intern.Trainee_Name,
          field_of_spec_name: intern.field_of_spec_name,
          Institute: intern.Institute,
          Training_StartDate: intern.Training_StartDate,
          Training_EndDate: intern.Training_EndDate,
          Trainee_Email: intern.Trainee_Email,
          Trainee_HomeAddress: intern.Trainee_HomeAddress,
          attendanceInfo: attendanceInfo,
        });
      }
    });

    return attendedInterns;
  }

  static async updateAttendanceForSpecificDate(internId, date, status) {
    const intern = await Intern.findById(internId);
    if (!intern) throw new Error("Intern not found");

    const existingAttendance = intern.attendance.find(
      (entry) =>
        new Date(entry.date).setHours(0, 0, 0, 0) ===
        new Date(date).setHours(0, 0, 0, 0)
    );

    if (existingAttendance) {
      existingAttendance.status = status; // Update the existing attendance status
    } else {
      intern.attendance.push({ date: new Date(date), status }); // Add new attendance entry
    }

    // Save without validation to avoid fieldOfSpecialization validation issues
    return await intern.save({ validateBeforeSave: false });
  }

  // Add an available day
  // static async addAvailableDay(traineeId, day) {
  //   const intern = await this.getInternByTraineeId(traineeId);
  //   if (!intern) throw new Error("Intern not found");

  //   if (!intern.availableDays.includes(day)) {
  //     intern.availableDays.push(day);
  //     await intern.save();
  //   }

  //   return intern;
  // }

  // // Remove an available day
  // static async removeAvailableDay(traineeId, day) {
  //   const intern = await this.getInternByTraineeId(traineeId);
  //   if (!intern) throw new Error("Intern not found");

  //   intern.availableDays = intern.availableDays.filter(d => d !== day);
  //   await intern.save();

  //   return intern;
  // }

  // Add an available day using ObjectId
  static async addAvailableDay(id, day) {
    const intern = await this.getInternById(id);
    if (!intern) throw new Error("Intern not found");

    if (!intern.availableDays.includes(day)) {
      intern.availableDays.push(day);
      // Save without validation to avoid fieldOfSpecialization validation issues
      await intern.save({ validateBeforeSave: false });
    }

    return intern;
  }

  // Remove an available day using ObjectId
  static async removeAvailableDay(id, day) {
    const intern = await this.getInternById(id);
    if (!intern) throw new Error("Intern not found");

    intern.availableDays = intern.availableDays.filter((d) => d !== day);
    // Save without validation to avoid fieldOfSpecialization validation issues
    await intern.save({ validateBeforeSave: false });

    return intern;
  }

  static async findByTraineeId(traineeId) {
    // DB is canonical with Trainee_ID
    return await Intern.findOne({ Trainee_ID: traineeId?.toString() });
  }
}

module.exports = InternRepository;
