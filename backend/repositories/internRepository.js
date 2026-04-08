const Intern = require("../models/Intern");
const mongoose = require("mongoose");
const moment = require("moment-timezone");

const getColomboDayRange = () => {
  const start = moment().tz("Asia/Colombo").startOf("day").toDate();
  const end = moment().tz("Asia/Colombo").endOf("day").toDate();
  return { start, end };
};

const isWithinRange = (value, start, end) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= start && date <= end;
};

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
    const escaped = String(email)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return await Intern.findOne({
      Trainee_Email: { $regex: `^${escaped}$`, $options: "i" },
    });
  }

  static async findByTraineeId(traineeId) {
    return await Intern.findOne({ Trainee_ID: traineeId });
  }

  static async getAttendanceStats() {
    const interns = await Intern.find();
    const stats = { present: 0, absent: 0 };

    interns.forEach((intern) => {
      const attendance = Array.isArray(intern.attendance) ? intern.attendance : [];
      if (attendance.length > 0) {
        const latestAttendance = attendance[attendance.length - 1];
        if (latestAttendance.status === "Present") stats.present++;
        else if (latestAttendance.status === "Absent") stats.absent++;
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
      if (!internId) throw new Error("Intern ID is required");

      if (!mongoose.Types.ObjectId.isValid(internId)) {
        throw new Error("Invalid intern ID format");
      }

      const intern = await Intern.findById(internId);
      if (!intern) throw new Error("Intern not found");

      if (!Array.isArray(intern.attendance)) {
        intern.attendance = [];
      }

      const attendanceDate = new Date(date).setHours(0, 0, 0, 0);
      const actualTimeMarked = timeMarked || new Date();

      const existingAttendanceIndex = intern.attendance.findIndex((entry) => {
        const sameDate =
          new Date(entry.date).setHours(0, 0, 0, 0) === attendanceDate;
        const sameType = (entry.type || "manual") === type;
        return sameDate && sameType;
      });

      if (existingAttendanceIndex !== -1) {
        intern.attendance[existingAttendanceIndex].status = status;
        intern.attendance[existingAttendanceIndex].timeMarked =
          actualTimeMarked;
        intern.attendance[existingAttendanceIndex].type = type;
      } else {
        intern.attendance.push({
          date,
          status,
          type,
          timeMarked: actualTimeMarked,
        });
      }

      return await intern.save({ validateBeforeSave: false });
    } catch (error) {
      throw error;
    }
  }

  static async updateAttendance(internId, date, status) {
    const intern = await Intern.findById(internId);
    if (!intern) throw new Error("Intern not found");

    if (!Array.isArray(intern.attendance)) {
      intern.attendance = [];
    }

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

    return await intern.save({ validateBeforeSave: false });
  }

  static async clearAttendance(internId, date, type = "manual") {
    const intern = await Intern.findById(internId);
    if (!intern) throw new Error("Intern not found");

    if (!Array.isArray(intern.attendance)) {
      intern.attendance = [];
    }

    const targetDate = new Date(date).setHours(0, 0, 0, 0);

    const originalLength = intern.attendance.length;

    intern.attendance = intern.attendance.filter((entry) => {
      const sameDate =
        new Date(entry.date).setHours(0, 0, 0, 0) === targetDate;
      const sameType = (entry.type || "manual") === type;
      return !(sameDate && sameType);
    });

    if (intern.attendance.length === originalLength) {
      return intern;
    }

    return await intern.save({ validateBeforeSave: false });
  }

  static async updateAttendanceForSpecificDate(
    internId,
    date,
    status,
    type = null,
    clear = false
  ) {
    const intern = await Intern.findById(internId);
    if (!intern) throw new Error("Intern not found");

    if (!Array.isArray(intern.attendance)) {
      intern.attendance = [];
    }

    const targetDate = new Date(date).setHours(0, 0, 0, 0);

    if (clear) {
      const originalLength = intern.attendance.length;

      intern.attendance = intern.attendance.filter((entry) => {
        const entryDate = new Date(entry.date).setHours(0, 0, 0, 0);
        const sameDate = entryDate === targetDate;
        const sameType = type ? (entry.type || "manual") === type : true;
        return !(sameDate && sameType);
      });

      if (intern.attendance.length === originalLength) {
        return intern;
      }

      return await intern.save({ validateBeforeSave: false });
    }

    const existingAttendance = intern.attendance.find((entry) => {
      const entryDate = new Date(entry.date).setHours(0, 0, 0, 0);
      const sameDate = entryDate === targetDate;
      const sameType = type ? (entry.type || "manual") === type : true;
      return sameDate && sameType;
    });

    if (existingAttendance) {
      existingAttendance.status = status;
      if (type) existingAttendance.type = type;
    } else {
      intern.attendance.push({
        date: new Date(date),
        status,
        ...(type ? { type } : {}),
      });
    }

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
    return await Intern.findByIdAndUpdate(
      internId,
      { $set: { team: "" } },
      { new: true }
    );
  }

  static async removeIntern(internId) {
    return await Intern.findByIdAndDelete(internId);
  }

  static async updateIntern(internId, data) {
    return await Intern.findByIdAndUpdate(internId, data, { new: true });
  }

  static async getAllTeams() {
    try {
      return await Intern.aggregate([
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
    return await Intern.findByIdAndUpdate(
      internId,
      { $set: { team: teamName } },
      { new: true }
    );
  }

  static async getAttendanceStatsForToday() {
    const { start, end } = getColomboDayRange();
    const interns = await Intern.find();
    const stats = { present: 0, absent: 0 };

    interns.forEach((intern) => {
      const attendance = Array.isArray(intern.attendance) ? intern.attendance : [];
      const onlineAttendance = Array.isArray(intern.onlineAttendance)
        ? intern.onlineAttendance
        : [];

      const todayPhysicalAttendance = attendance.find((entry) =>
        isWithinRange(entry?.date, start, end)
      );
      const todayOnlineAttendance = onlineAttendance.find((entry) =>
        isWithinRange(entry?.date, start, end)
      );

      const isPresent =
        todayPhysicalAttendance?.status === "Present" ||
        todayOnlineAttendance?.status === "Present";
      const isAbsent =
        todayPhysicalAttendance?.status === "Absent" ||
        todayOnlineAttendance?.status === "Absent";

      if (isPresent) stats.present++;
      else if (isAbsent) stats.absent++;
    });

    return stats;
  }

  static async getAttendanceStatsByType(attendanceType = null) {
    const { start, end } = getColomboDayRange();
    const interns = await Intern.find();
    const stats = {
      dailyAttendance: { present: 0, absent: 0 },
      meetingAttendance: { present: 0, absent: 0 },
      total: { present: 0, absent: 0 },
    };

    interns.forEach((intern) => {
      const attendance = Array.isArray(intern.attendance) ? intern.attendance : [];
      const onlineAttendance = Array.isArray(intern.onlineAttendance)
        ? intern.onlineAttendance
        : [];

      const todayPhysicalAttendance = attendance.filter((entry) =>
        isWithinRange(entry?.date, start, end)
      );
      const todayOnlineAttendance = onlineAttendance.filter((entry) =>
        isWithinRange(entry?.date, start, end)
      );

      const dailyAttendance = todayPhysicalAttendance.find(
        (entry) => entry?.type === "daily_qr"
      );

      if (dailyAttendance?.status === "Present") stats.dailyAttendance.present++;
      else if (dailyAttendance?.status === "Absent") stats.dailyAttendance.absent++;

      const physicalMeetingAttendance = todayPhysicalAttendance.find(
        (entry) => entry?.type === "qr" || entry?.type === "manual"
      );
      const onlineMeetingAttendance = todayOnlineAttendance.find(
        (entry) => entry?.type === "online_attendance"
      );

      const hasMeetingPresent =
        physicalMeetingAttendance?.status === "Present" ||
        onlineMeetingAttendance?.status === "Present";
      const hasMeetingAbsent =
        physicalMeetingAttendance?.status === "Absent" ||
        onlineMeetingAttendance?.status === "Absent";

      if (hasMeetingPresent) stats.meetingAttendance.present++;
      else if (hasMeetingAbsent) stats.meetingAttendance.absent++;

      const hasAnyAttendance =
        todayPhysicalAttendance.some((entry) => entry?.status === "Present") ||
        todayOnlineAttendance.some((entry) => entry?.status === "Present");
      const hasAnyAbsent =
        todayPhysicalAttendance.length > 0 || todayOnlineAttendance.length > 0;

      if (hasAnyAttendance) stats.total.present++;
      else if (hasAnyAbsent) stats.total.absent++;
    });

    if (attendanceType === "daily") return stats.dailyAttendance;
    if (attendanceType === "meeting") return stats.meetingAttendance;
    return stats;
  }

  static async getTodayAttendanceByType(attendanceType = null) {
    const { start, end } = getColomboDayRange();
    const interns = await Intern.find();
    const attendedInterns = [];

    interns.forEach((intern) => {
      const attendance = Array.isArray(intern.attendance) ? intern.attendance : [];
      const onlineAttendance = Array.isArray(intern.onlineAttendance)
        ? intern.onlineAttendance
        : [];

      const todayPhysicalAttendance = attendance.filter((entry) =>
        isWithinRange(entry?.date, start, end)
      );
      const todayOnlineAttendance = onlineAttendance.filter((entry) =>
        isWithinRange(entry?.date, start, end)
      );

      let hasRelevantAttendance = false;
      let attendanceInfo = null;

      if (attendanceType === "daily") {
        const dailyAttendance = todayPhysicalAttendance.find(
          (entry) => entry?.type === "daily_qr" && entry?.status === "Present"
        );

        if (dailyAttendance) {
          hasRelevantAttendance = true;
          attendanceInfo = {
            type: "Daily",
            rawType: "daily_qr",
            time: dailyAttendance.timeMarked || dailyAttendance.date,
            method:
              dailyAttendance.markedBy === "external_system"
                ? "QR Code Scan"
                : "Manual Entry",
          };
        }
      } else if (attendanceType === "meeting") {
        const physicalMeetingAttendance = todayPhysicalAttendance.find(
          (entry) =>
            (entry?.type === "qr" || entry?.type === "manual") &&
            entry?.status === "Present"
        );

        const onlineMeetingAttendances = todayOnlineAttendance.filter(
          (entry) =>
            entry?.type === "online_attendance" &&
            entry?.status === "Present"
        );

        const infoList = [];

        if (physicalMeetingAttendance) {
          infoList.push({
            type: physicalMeetingAttendance.type === "manual" ? "Manual" : "Meeting",
            rawType: physicalMeetingAttendance.type,
            time:
              physicalMeetingAttendance.timeMarked || physicalMeetingAttendance.date,
            method:
              physicalMeetingAttendance.markedBy === "external_system"
                ? "QR Code Scan"
                : "Manual Method",
          });
        }

        onlineMeetingAttendances.forEach((entry) => {
          infoList.push({
            type: "Online Meeting",
            rawType: "online_attendance",
            time: entry.timeMarked || entry.date,
            method:
              entry.markedBy === "csv_upload_system"
                ? "CSV Upload"
                : "Manual Entry",
            meetingName: entry.meetingName || "N/A",
          });
        });

        if (infoList.length > 0) {
          hasRelevantAttendance = true;
          attendanceInfo = infoList.length === 1 ? infoList[0] : infoList;
        }
      } else {
        const infoList = [];

        todayPhysicalAttendance
          .filter((entry) => entry?.status === "Present")
          .forEach((entry) => {
            infoList.push({
              type:
                entry.type === "daily_qr"
                  ? "Daily"
                  : entry.type === "manual"
                  ? "Manual"
                  : "Meeting",
              rawType: entry.type,
              time: entry.timeMarked || entry.date,
              method:
                entry.markedBy === "external_system"
                  ? "QR Code Scan"
                  : entry.type === "manual"
                  ? "Manual Method"
                  : "Manual Entry",
            });
          });

        todayOnlineAttendance
          .filter((entry) => entry?.status === "Present")
          .forEach((entry) => {
            infoList.push({
              type: "Online Meeting",
              rawType: "online_attendance",
              time: entry.timeMarked || entry.date,
              method:
                entry.markedBy === "csv_upload_system"
                  ? "CSV Upload"
                  : "Manual Entry",
              meetingName: entry.meetingName || "N/A",
            });
          });

        if (infoList.length > 0) {
          hasRelevantAttendance = true;
          attendanceInfo = infoList.length === 1 ? infoList[0] : infoList;
        }
      }

      if (hasRelevantAttendance) {
        const traineeId = String(intern.Trainee_ID || intern.traineeId || "");
        const traineeName = intern.Trainee_Name || intern.traineeName || "";
        const fieldOfSpecialization =
          intern.field_of_spec_name || intern.fieldOfSpecialization || "";
        const institute = intern.Institute || intern.institute || "";

        attendedInterns.push({
          _id: intern._id,
          internId: String(intern._id),
          traineeId,
          Trainee_ID: traineeId,
          traineeName,
          Trainee_Name: traineeName,
          fieldOfSpecialization,
          field_of_spec_name: fieldOfSpecialization,
          institute,
          Institute: institute,
          attendanceInfo,
        });
      }
    });

    return attendedInterns;
  }

  static async addAvailableDay(id, day) {
    return await Intern.findByIdAndUpdate(
      id,
      { $addToSet: { availableDays: day } },
      { new: true }
    );
  }

  static async removeAvailableDay(id, day) {
    return await Intern.findByIdAndUpdate(
      id,
      { $pull: { availableDays: day } },
      { new: true }
    );
  }
}

module.exports = InternRepository;