const Intern = require("../models/Intern");
const InactiveIntern = require("../models/InactiveIntern");

// Normalize incoming data (camelCase from services) to API-style keys stored in DB
function normalizeToApiFields(data = {}) {
  const normalized = {};

  // Canonical API-style fields
  if (data.Trainee_ID || data.traineeId)
    normalized.Trainee_ID = (data.Trainee_ID || data.traineeId)?.toString();
  if (data.Trainee_Name || data.traineeName)
    normalized.Trainee_Name = data.Trainee_Name || data.traineeName;
  if (data.Trainee_HomeAddress || data.homeAddress)
    normalized.Trainee_HomeAddress =
      data.Trainee_HomeAddress || data.homeAddress;
  if (data.Training_StartDate || data.trainingStartDate)
    normalized.Training_StartDate =
      data.Training_StartDate || data.trainingStartDate;
  if (data.Training_EndDate || data.trainingEndDate)
    normalized.Training_EndDate = data.Training_EndDate || data.trainingEndDate;
  if (data.Trainee_Email || data.email)
    normalized.Trainee_Email = (data.Trainee_Email || data.email || "")
      .toString()
      .trim();
  if (data.Institute || data.institute)
    normalized.Institute = data.Institute || data.institute;
  if (data.field_of_spec_name || data.fieldOfSpecialization)
    normalized.field_of_spec_name =
      data.field_of_spec_name || data.fieldOfSpecialization;

  // App-specific fields (keep as-is)
  if (data.team !== undefined) normalized.team = data.team;
  if (data.attendance !== undefined) normalized.attendance = data.attendance;
  if (data.availableDays !== undefined)
    normalized.availableDays = data.availableDays;

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

  static async markAttendance(internId, status, date) {
    const intern = await Intern.findById(internId);
    if (!intern) throw new Error("Intern not found");

    const existingAttendance = intern.attendance.find(
      (entry) =>
        new Date(entry.date).setHours(0, 0, 0, 0) === date.setHours(0, 0, 0, 0),
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
      (entry) =>
        new Date(entry.date).setHours(0, 0, 0, 0) ===
        new Date(date).setHours(0, 0, 0, 0),
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
        $lt: endDate,
      },
    });
  }

  static async assignToTeam(internIds, teamName) {
    return await Intern.updateMany(
      { _id: { $in: internIds } },
      { $set: { team: teamName } },
    );
  }

  static async removeFromTeam(internId) {
    const updatedIntern = await Intern.findByIdAndUpdate(
      internId,
      { $set: { team: "" } },
      { new: true },
    );
    return updatedIntern;
  }

  /**
   * Archive a single intern to InactiveInterns using the native MongoDB driver,
   * bypassing Mongoose schema validation and 2dsphere index checks entirely.
   * The document is stored exactly as-is, plus archival metadata.
   */
  static async removeIntern(internId, reason = "not_in_api") {
    const intern = await Intern.findById(internId);
    if (!intern) return null;

    if (intern.isTestAccount) {
      console.log(
        `🛡️ Skipping removal of test account: ${intern.Trainee_Name} (${intern.Trainee_ID})`,
      );
      return null;
    }

    const doc = intern.toObject();

    // Use native collection driver — skips Mongoose validation, middleware,
    // and 2dsphere index enforcement (fixes "Can't extract geo keys" error)
    await InactiveIntern.collection.findOneAndReplace(
      { _id: doc._id },
      {
        ...doc,
        archiveReason: reason,
        archivedAt: new Date(),
        originalCreatedAt: doc.createdAt,
        originalUpdatedAt: doc.updatedAt,
      },
      { upsert: true },
    );

    return await Intern.findByIdAndDelete(internId);
  }

  /**
   * Archive multiple interns to InactiveInterns using the native MongoDB driver,
   * bypassing Mongoose schema validation and 2dsphere index checks entirely.
   */
  static async removeMultipleInterns(internIds, reason = "not_in_api") {
    const interns = await Intern.find({
      _id: { $in: internIds },
      isTestAccount: { $ne: true },
    });

    if (interns.length === 0) {
      return { deletedCount: 0, acknowledged: true };
    }

    const archiveDocs = interns.map((intern) => {
      const doc = intern.toObject();
      return {
        replaceOne: {
          filter: { _id: doc._id },
          replacement: {
            ...doc,
            archiveReason: reason,
            archivedAt: new Date(),
            originalCreatedAt: doc.createdAt,
            originalUpdatedAt: doc.updatedAt,
          },
          upsert: true,
        },
      };
    });

    // Native bulkWrite — bypasses Mongoose schema validation and index checks
    await InactiveIntern.collection.bulkWrite(archiveDocs);

    const result = await Intern.deleteMany({ _id: { $in: internIds } });

    return {
      deletedCount: result.deletedCount,
      acknowledged: result.acknowledged,
      archivedCount: interns.length,
    };
  }

  static async updateIntern(internId, data) {
    const normalized = normalizeToApiFields(data);
    return await Intern.findByIdAndUpdate(
      internId,
      { $set: normalized },
      { new: true },
    );
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
      { $set: { team: newTeamName } },
    );
    return {
      modifiedCount: result.modifiedCount,
      message: `Successfully updated ${result.modifiedCount} interns from ${oldTeamName} to ${newTeamName}`,
    };
  }

  static async deleteTeam(teamName) {
    const result = await Intern.updateMany(
      { team: teamName },
      { $set: { team: "" } },
    );
    return {
      deletedCount: result.modifiedCount,
      message: `Team "${teamName}" deleted - ${result.modifiedCount} interns removed`,
    };
  }

  static async assignSingleToTeam(internId, teamName) {
    const updatedIntern = await Intern.findByIdAndUpdate(
      internId,
      { $set: { team: teamName } },
      { new: true },
    );
    return updatedIntern;
  }

  static async getAttendanceStatsForToday() {
    const today = new Date().setHours(0, 0, 0, 0);
    const interns = await Intern.find();
    const stats = { present: 0, absent: 0 };

    interns.forEach((intern) => {
      const todayAttendance = intern.attendance.find(
        (entry) => new Date(entry.date).setHours(0, 0, 0, 0) === today,
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
      (entry) =>
        new Date(entry.date).setHours(0, 0, 0, 0) ===
        new Date(date).setHours(0, 0, 0, 0),
    );

    if (existingAttendance) {
      existingAttendance.status = status;
    } else {
      intern.attendance.push({ date: new Date(date), status });
    }

    return await intern.save();
  }

  static async addAvailableDay(id, day) {
    const intern = await this.getInternById(id);
    if (!intern) throw new Error("Intern not found");

    if (!intern.availableDays.includes(day)) {
      intern.availableDays.push(day);
      await intern.save();
    }

    return intern;
  }

  static async removeAvailableDay(id, day) {
    const intern = await this.getInternById(id);
    if (!intern) throw new Error("Intern not found");

    intern.availableDays = intern.availableDays.filter((d) => d !== day);
    await intern.save();

    return intern;
  }

  static async findByTraineeId(traineeId) {
    return await Intern.findOne({ Trainee_ID: traineeId?.toString() });
  }

  // ==================== INACTIVE INTERN METHODS ====================

  static async getAllInactiveInterns() {
    return await InactiveIntern.find().sort({ archivedAt: -1 });
  }

  /**
   * Get inactive interns with server-side pagination and optional text search.
   * Searched fields: Trainee_Name, Trainee_ID, Trainee_Email
   *
   * @param {{ skip: number, limit: number, search: string }} options
   * @returns {{ interns: Document[], total: number }}
   */
  static async getAllInactiveInternsPaginated({
    skip = 0,
    limit = 15,
    search = "",
  } = {}) {
    // Build the filter — if there's a search term, apply a case-insensitive
    // regex across the three most useful identifier fields.
    const filter = search
      ? {
          $or: [
            { Trainee_Name: { $regex: search, $options: "i" } },
            { Trainee_ID: { $regex: search, $options: "i" } },
            { Trainee_Email: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    // Run count and page fetch in parallel to keep latency low
    const [total, interns] = await Promise.all([
      InactiveIntern.countDocuments(filter),
      InactiveIntern.find(filter)
        .sort({ archivedAt: -1 })
        .skip(skip)
        .limit(limit)
        // Only project the fields needed for the list card — avoids pulling
        // the full attendance array (potentially huge) for every list item.
        .select(
          "_id Trainee_ID Trainee_Name Trainee_Email Institute field_of_spec_name " +
            "Training_StartDate Training_EndDate archiveReason archivedAt originalCreatedAt",
        ),
    ]);

    return { interns, total };
  }

  static async getInactiveInternById(internId) {
    return await InactiveIntern.findById(internId);
  }

  static async restoreInactiveIntern(internId) {
    const archived = await InactiveIntern.findById(internId);
    if (!archived) throw new Error("Archived intern not found");

    const doc = archived.toObject();

    // Strip archive-specific metadata
    delete doc.archivedAt;
    delete doc.archiveReason;
    delete doc.originalCreatedAt;
    delete doc.originalUpdatedAt;

    // ✅ FIX 1: Strip location if coordinates are empty/invalid
    // This is the most common cause of "Can't extract geo keys" on restore
    if (
      !doc.location?.coordinates ||
      doc.location.coordinates.length === 0 ||
      doc.location.coordinates.some((c) => c == null || isNaN(c))
    ) {
      delete doc.location;
    }

    // ✅ FIX 2: Strip __v added by Mongoose to avoid conflicts
    delete doc.__v;

    // Delete any shell doc with same Trainee_ID but different _id
    await Intern.deleteMany({
      Trainee_ID: doc.Trainee_ID,
      _id: { $ne: doc._id },
    });

    // ✅ FIX 3: Use native collection driver (same approach as archiving)
    // This bypasses Mongoose schema validation and 2dsphere index checks entirely
    await Intern.collection.findOneAndReplace({ _id: doc._id }, doc, {
      upsert: true,
    });

    await InactiveIntern.findByIdAndDelete(internId);

    // Return the restored document
    return await Intern.findById(doc._id);
  }
}

module.exports = InternRepository;
