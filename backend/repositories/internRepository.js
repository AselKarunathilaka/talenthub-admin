const Intern = require("../models/Intern");

// Normalize incoming data (camelCase from services) to API-style keys stored in DB
function normalizeToApiFields(data = {}) {
  const normalized = {};

  // Canonical API-style fields
  if (data.Trainee_ID || data.traineeId) normalized.Trainee_ID = (data.Trainee_ID || data.traineeId)?.toString();
  if (data.Trainee_Name || data.traineeName) normalized.Trainee_Name = data.Trainee_Name || data.traineeName;
  if (data.Trainee_HomeAddress || data.homeAddress) normalized.Trainee_HomeAddress = data.Trainee_HomeAddress || data.homeAddress;
  if (data.Training_StartDate || data.trainingStartDate) normalized.Training_StartDate = data.Training_StartDate || data.trainingStartDate;
  if (data.Training_EndDate || data.trainingEndDate) normalized.Training_EndDate = data.Training_EndDate || data.trainingEndDate;
  if (data.Trainee_Email || data.email) normalized.Trainee_Email = (data.Trainee_Email || data.email || '').toString().trim();
  if (data.Institute || data.institute) normalized.Institute = data.Institute || data.institute;
  if (data.field_of_spec_name || data.fieldOfSpecialization) normalized.field_of_spec_name = data.field_of_spec_name || data.fieldOfSpecialization;

  // App-specific fields (keep as-is)
  if (data.team !== undefined) normalized.team = data.team;
  if (data.attendance !== undefined) normalized.attendance = data.attendance;
  if (data.availableDays !== undefined) normalized.availableDays = data.availableDays;

  return normalized;
}

class InternRepository {

  static async addIntern(data) {
    const intern = new Intern(normalizeToApiFields(data));
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
    const escaped = String(email).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return await Intern.findOne({ Trainee_Email: { $regex: `^${escaped}$`, $options: 'i' } });
  }


  static async getAttendanceStats() {
    const interns = await Intern.find();
    const stats = { present: 0, absent: 0 };

    interns.forEach((intern) => {
      if (intern.attendance.length > 0) {
        const latestAttendance = intern.attendance[intern.attendance.length - 1];
        if (latestAttendance.status === "Present") {
          stats.present++;
        } else {
          stats.absent++;
        }
      }
    });

    return stats;
  }


  static async markAttendance(internId, status, date) {
    const intern = await Intern.findById(internId);
    if (!intern) throw new Error("Intern not found");

    const existingAttendance = intern.attendance.find(
      (entry) => new Date(entry.date).setHours(0, 0, 0, 0) === date.setHours(0, 0, 0, 0)
    );

    if (existingAttendance) {
      existingAttendance.status = status;
    } else {
      intern.attendance.push({ date: date, status });
    }

    return await intern.save();
  }


  static async updateAttendance(internId, date, status) {
    const intern = await Intern.findById(internId);
    if (!intern) throw new Error("Intern not found");

    const attendanceIndex = intern.attendance.findIndex(
      (entry) => new Date(entry.date).setHours(0, 0, 0, 0) === new Date(date).setHours(0, 0, 0, 0)
    );

    if (attendanceIndex !== -1) {
      intern.attendance[attendanceIndex].status = status;
    } else {
      intern.attendance.push({ date: new Date(date), status });
    }

    return await intern.save();
  }

  static async getAllInternsForDate(startDate, endDate) {

    return await Intern.find({
      "attendance.date": {
        $gte: startDate,
        $lt: endDate
      }
    });
  }

  static async assignToTeam(internIds, teamName) {
    return await Intern.updateMany({ _id: { $in: internIds } }, { $set: { team: teamName } });
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

  static async removeMultipleInterns(internIds) {
    const result = await Intern.deleteMany({ _id: { $in: internIds } });
    return {
      deletedCount: result.deletedCount,
      acknowledged: result.acknowledged
    };
  }

  static async updateIntern(internId, data) {
    const normalized = normalizeToApiFields(data);
    return await Intern.findByIdAndUpdate(internId, { $set: normalized }, { new: true });
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
          }
        }
      ]);
      return teams;
    } catch (error) {
      throw new Error('Error fetching teams: ' + error.message);
    }
  }


  static async updateTeamName(oldTeamName, newTeamName) {
    const result = await Intern.updateMany(
      { team: oldTeamName },
      { $set: { team: newTeamName } }
    );
    return {
      modifiedCount: result.modifiedCount,
      message: `Successfully updated ${result.modifiedCount} interns from ${oldTeamName} to ${newTeamName}`
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

  static async getAttendanceStatsForToday() {
    const today = new Date().setHours(0, 0, 0, 0);  // Start of today
    const interns = await Intern.find();
    const stats = { present: 0, absent: 0 };

    interns.forEach((intern) => {
      const todayAttendance = intern.attendance.find(
        (entry) => new Date(entry.date).setHours(0, 0, 0, 0) === today
      );
      if (todayAttendance) {
        if (todayAttendance.status === "Present") {
          stats.present++;
        } else {
          stats.absent++;
        }
      }
    });

    return stats;
  }

  static async updateAttendanceForSpecificDate(internId, date, status) {
    const intern = await Intern.findById(internId);
    if (!intern) throw new Error("Intern not found");

    const existingAttendance = intern.attendance.find(
      (entry) => new Date(entry.date).setHours(0, 0, 0, 0) === new Date(date).setHours(0, 0, 0, 0)
    );

    if (existingAttendance) {
      existingAttendance.status = status; // Update the existing attendance status
    } else {
      intern.attendance.push({ date: new Date(date), status }); // Add new attendance entry
    }

    return await intern.save();
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
      await intern.save();
    }

    return intern;
  }

  // Remove an available day using ObjectId
  static async removeAvailableDay(id, day) {
    const intern = await this.getInternById(id);
    if (!intern) throw new Error("Intern not found");

    intern.availableDays = intern.availableDays.filter(d => d !== day);
    await intern.save();

    return intern;
  }

  static async findByTraineeId(traineeId) {
    // DB is canonical with Trainee_ID
    return await Intern.findOne({ Trainee_ID: traineeId?.toString() });
  }
  
}



module.exports = InternRepository;
