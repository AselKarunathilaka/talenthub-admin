const InternRepository = require("../repositories/internRepository");
const SLTApiService = require("./sltApiService");
const SLTApiScheduler = require("./sltApiScheduler");
const moment = require("moment");
const geocodeAddress = require("../utils/geocode");

class InternService {
  async addIntern(data) {
    const geo = await geocodeAddress(data.Trainee_HomeAddress);

    if (geo) {
      data.location = geo.location;
      data.district = geo.district;
    } else {
      data.location = null;
      data.district = "";
    }

    return await InternRepository.addIntern(data);
  }

  async getAllInterns(date) {
    let interns = await InternRepository.getAllInterns();

    if (date) {
      const formattedDate = moment
        .tz(date, "Asia/Colombo")
        .startOf("day")
        .toDate();
      const endDate = moment.tz(date, "Asia/Colombo").endOf("day").toDate();

      interns = interns.map((intern) => {
        const attendance = intern.attendance || [];
        const attendanceRecord = attendance.find((att) => {
          const attendanceDate = new Date(att.date).setHours(0, 0, 0, 0);
          return attendanceDate >= formattedDate && attendanceDate <= endDate;
        });

        return {
          ...intern,
          attendanceStatus: attendanceRecord
            ? attendanceRecord.status
            : "Not Marked",
        };
      });
    }

    return interns;
  }

  async getInternById(internId) {
    return await InternRepository.getInternById(internId);
  }

  async getAttendanceStats() {
    return await InternRepository.getAttendanceStats();
  }

  async markAttendance(internId, status, date) {
    const attendanceDate = date
      ? moment.tz(date, "Asia/Colombo").toDate()
      : moment.tz("Asia/Colombo").toDate();
    return await InternRepository.markAttendance(
      internId,
      status,
      attendanceDate,
    );
  }

  async updateAttendance(internId, date, status) {
    return await InternRepository.updateAttendance(internId, date, status);
  }

  async assignToTeam(internIds, teamName) {
    return await InternRepository.assignToTeam(internIds, teamName);
  }

  async removeFromTeam(internId) {
    return await InternRepository.removeFromTeam(internId);
  }

  async removeIntern(internId) {
    return await InternRepository.removeIntern(internId);
  }

  async updateIntern(internId, data) {
    return await InternRepository.updateIntern(internId, data);
  }

  async getAllTeams() {
    try {
      const teams = await InternRepository.getAllTeams();
      return teams;
    } catch (error) {
      throw new Error("Error fetching teams from repository: " + error.message);
    }
  }

  async updateTeamName(oldTeamName, newTeamName) {
    return await InternRepository.updateTeamName(oldTeamName, newTeamName);
  }

  async assignSingleToTeam(internId, teamName) {
    return await InternRepository.assignSingleToTeam(internId, teamName);
  }

  async deleteTeam(teamName) {
    return await InternRepository.deleteTeam(teamName);
  }

  async getAttendanceStatsForToday() {
    try {
      return await InternRepository.getAttendanceStatsForToday();
    } catch (error) {
      throw new Error(
        "Error fetching attendance stats for today: " + error.message,
      );
    }
  }

  async updateAttendanceForSpecificDate(internId, date, status) {
    return await InternRepository.updateAttendanceForSpecificDate(
      internId,
      date,
      status,
    );
  }

  async getWeeklyAttendanceStats() {
    const startOfWeek = moment().startOf("week").toDate();
    const endOfWeek = moment().endOf("week").toDate();

    const interns = await InternRepository.getAllInterns();

    const attendedInterns = interns.filter((intern) => {
      return intern.attendance.some((attendance) => {
        const attendanceDate = new Date(attendance.date).setHours(0, 0, 0, 0);
        return (
          attendanceDate >= startOfWeek &&
          attendanceDate <= endOfWeek &&
          attendance.status === "Present"
        );
      });
    });

    const notAttendedInterns = interns.filter((intern) => {
      return intern.attendance.every((attendance) => {
        const attendanceDate = new Date(attendance.date).setHours(0, 0, 0, 0);
        return (
          attendanceDate < startOfWeek ||
          attendanceDate > endOfWeek ||
          attendance.status === "Absent"
        );
      });
    });

    return {
      attendedInterns,
      notAttendedInterns,
    };
  }

  async addAvailableDay(id, day) {
    const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    if (!validDays.includes(day)) {
      throw new Error("Invalid day provided");
    }

    return await InternRepository.addAvailableDay(id, day);
  }

  async removeAvailableDay(id, day) {
    const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    if (!validDays.includes(day)) {
      throw new Error("Invalid day provided");
    }

    return await InternRepository.removeAvailableDay(id, day);
  }

  async updateInternEmail(traineeId, email) {
    // Use the repository method if it exists, otherwise implement it
    const intern = await InternRepository.findByTraineeId(traineeId);
    if (!intern) throw new Error("Intern not found");

    intern.email = email;
    await intern.save();

    return intern;
  }

  // ==================== SLT API INTEGRATION METHODS ====================

  async syncWithSLTAPI(options = {}) {
    try {
      console.log("🔄 Starting SLT API synchronization...");

      const {
        enableCleanup = process.env.AUTO_CLEANUP_INACTIVE_INTERNS === "true",
      } = options;

      // Fetch active trainees from SLT API
      const activeTrainees = await SLTApiService.fetchActiveTrainees();

      console.log(`📥 Received ${activeTrainees.length} trainees from SLT API`);
      console.log(`🧹 Cleanup mode: ${enableCleanup ? "ENABLED" : "DISABLED"}`);

      let addedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let removedCount = 0;

      // Process each trainee
      for (const trainee of activeTrainees) {
        try {
          const traineeId = trainee.Trainee_ID?.toString();

          if (!traineeId) {
            console.log("⚠️ Skipping trainee without ID:", trainee);
            skippedCount++;
            continue;
          }

          // Map API data to your schema using the service mapper
          const mappedTrainees = SLTApiService.mapToInternSchema([trainee]);
          if (mappedTrainees.length === 0) {
            console.log("⚠️ Skipping trainee - mapping failed:", traineeId);
            skippedCount++;
            continue;
          }

          const internData = mappedTrainees[0];

          // Check if intern already exists using the repository method
          const existingIntern =
            await InternRepository.findByTraineeId(traineeId);

          if (existingIntern) {
            // Update existing intern - only update fields that are missing or have changed
            const updatedData = {};

            // Update name if different
            if (existingIntern.traineeName !== internData.traineeName) {
              updatedData.traineeName = internData.traineeName;
            }

            // Update training start date if missing or different
            if (
              !existingIntern.trainingStartDate &&
              internData.trainingStartDate
            ) {
              updatedData.trainingStartDate = internData.trainingStartDate;
            } else if (
              internData.trainingStartDate &&
              existingIntern.trainingStartDate
            ) {
              const existingDate = new Date(
                existingIntern.trainingStartDate,
              ).getTime();
              const newDate = new Date(internData.trainingStartDate).getTime();
              if (existingDate !== newDate) {
                updatedData.trainingStartDate = internData.trainingStartDate;
              }
            }

            // Update training end date if missing or different
            if (!existingIntern.trainingEndDate && internData.trainingEndDate) {
              updatedData.trainingEndDate = internData.trainingEndDate;
            } else if (
              internData.trainingEndDate &&
              existingIntern.trainingEndDate
            ) {
              const existingDate = new Date(
                existingIntern.trainingEndDate,
              ).getTime();
              const newDate = new Date(internData.trainingEndDate).getTime();
              if (existingDate !== newDate) {
                updatedData.trainingEndDate = internData.trainingEndDate;
              }
            }

            // Update institute if missing or different
            if (
              (!existingIntern.institute ||
                existingIntern.institute.trim() === "") &&
              internData.institute
            ) {
              updatedData.institute = internData.institute;
            } else if (
              internData.institute &&
              existingIntern.institute !== internData.institute
            ) {
              updatedData.institute = internData.institute;
            }

            // Update email if missing or different
            if (
              (!existingIntern.email || existingIntern.email.trim() === "") &&
              internData.email
            ) {
              updatedData.email = internData.email;
            } else if (
              internData.email &&
              existingIntern.email !== internData.email
            ) {
              updatedData.email = internData.email;
            }

            // Update field of specialization if missing or different
            if (
              (!existingIntern.fieldOfSpecialization ||
                existingIntern.fieldOfSpecialization.trim() === "") &&
              internData.fieldOfSpecialization
            ) {
              updatedData.fieldOfSpecialization =
                internData.fieldOfSpecialization;
            } else if (
              internData.fieldOfSpecialization &&
              existingIntern.fieldOfSpecialization !==
                internData.fieldOfSpecialization
            ) {
              updatedData.fieldOfSpecialization =
                internData.fieldOfSpecialization;
            }

            // Update home address if missing or different
            if (
              (!existingIntern.homeAddress ||
                existingIntern.homeAddress.trim() === "") &&
              internData.homeAddress
            ) {
              updatedData.homeAddress = internData.homeAddress;
            } else if (
              internData.homeAddress &&
              existingIntern.homeAddress !== internData.homeAddress
            ) {
              updatedData.homeAddress = internData.homeAddress;
            }

            // Only update if there are changes
            if (Object.keys(updatedData).length > 0) {
              await InternRepository.updateIntern(
                existingIntern._id,
                updatedData,
              );
              updatedCount++;
              if (process.env.DEBUG_SYNC === "true") {
                console.log(
                  `📝 Updated intern: ${internData.traineeName} (${internData.traineeId}) - Updated: ${Object.keys(updatedData).join(", ")}`,
                );
              }
            } else {
              skippedCount++;
              if (process.env.DEBUG_SYNC === "true") {
                console.log(
                  `⏭️ Skipped intern: ${internData.traineeName} (${internData.traineeId}) - No changes needed`,
                );
              }
            }
          } else {
            // Create new intern
            await InternRepository.addIntern(internData);
            addedCount++;
            if (process.env.DEBUG_SYNC === "true") {
              console.log(
                `➕ Added new intern: ${internData.traineeName} (${internData.traineeId})`,
              );
            }
          }
        } catch (error) {
          console.error(
            `❌ Error processing trainee ${trainee.Trainee_ID}:`,
            error.message,
          );
          errorCount++;
        }
      }

      // After processing all API trainees, check for interns in DB that are no longer in API
      if (enableCleanup) {
        console.log("🔍 Checking for interns to remove (no longer in API)...");

        try {
          // Get all interns from database
          const allDbInterns = await InternRepository.getAllInterns();

          // Create set of active trainee IDs from API
          const activeTraineeIds = new Set(
            activeTrainees.map((t) => t.Trainee_ID?.toString()).filter(Boolean),
          );

          // Find interns in DB that are not in API
          const internsToRemove = allDbInterns.filter((intern) => {
            if (intern.isTestAccount) return false;
            const traineeId = intern.Trainee_ID?.toString();
            return traineeId && !activeTraineeIds.has(traineeId);
          });

          if (internsToRemove.length > 0) {
            if (process.env.DEBUG_SYNC === "true") {
              console.log(
                `🗑️  Found ${internsToRemove.length} interns to remove (no longer in API):`,
              );
              internsToRemove.forEach((intern) => {
                console.log(
                  `   - ${intern.Trainee_ID}: ${intern.Trainee_Name} (${intern.Trainee_Email || "No email"})`,
                );
              });
            }

            // Remove the interns that are no longer in API
            for (const intern of internsToRemove) {
              try {
                await InternRepository.removeIntern(intern._id);
                removedCount++;
                if (process.env.DEBUG_SYNC === "true") {
                  console.log(
                    `✅ Removed: ${intern.Trainee_Name} (${intern.Trainee_ID})`,
                  );
                }
              } catch (error) {
                console.error(
                  `❌ Failed to remove ${intern.Trainee_Name} (${intern.Trainee_ID}):`,
                  error.message,
                );
                errorCount++;
              }
            }
          } else {
            console.log(
              "✅ No interns need to be removed - all DB interns are still active in API",
            );
          }
        } catch (error) {
          console.error("❌ Error during cleanup phase:", error.message);
          errorCount++;
        }
      } else {
        console.log("⏭️  Cleanup phase skipped (disabled)");
      }

      const result = {
        success: true,
        message: `Sync completed: ${addedCount} added, ${updatedCount} updated, ${removedCount} removed, ${skippedCount} skipped, ${errorCount} errors`,
        stats: {
          added: addedCount,
          updated: updatedCount,
          removed: removedCount,
          skipped: skippedCount,
          errors: errorCount,
          totalProcessed: activeTrainees.length,
        },
      };

      console.log("✅ SLT API synchronization completed:", result.message);
      return result;
    } catch (error) {
      console.error("❌ SLT API synchronization failed:", error.message);
      return {
        success: false,
        message: `Sync failed: ${error.message}`,
        stats: {
          added: 0,
          updated: 0,
          removed: 0,
          skipped: 0,
          errors: 1,
          totalProcessed: 0,
        },
      };
    }
  }

  async testSLTAPI() {
    try {
      console.log("🧪 Testing SLT API connection...");
      const trainees = await SLTApiService.fetchActiveTrainees();

      const result = {
        success: true,
        message: "SLT API connection successful",
        count: trainees.length,
        sample: trainees.slice(0, 3),
        total: trainees.length,
      };

      console.log("✅ SLT API test successful:", result.message);
      return result;
    } catch (error) {
      console.error("❌ SLT API test failed:", error.message);
      return {
        success: false,
        message: `SLT API test failed: ${error.message}`,
        count: 0,
        sample: [],
        total: 0,
      };
    }
  }

  async getActiveTraineesFromSLT() {
    try {
      console.log("📡 Fetching active trainees from SLT API...");
      const trainees = await SLTApiService.fetchActiveTrainees();
      const mappedTrainees = SLTApiService.mapToInternSchema(trainees);

      const result = {
        success: true,
        data: mappedTrainees,
        count: mappedTrainees.length,
      };

      console.log("✅ Fetched trainees from SLT API:", result.count);
      return result;
    } catch (error) {
      console.error("❌ Error fetching SLT trainees:", error.message);
      return {
        success: false,
        message: error.message,
        data: [],
        count: 0,
      };
    }
  }

  async cleanupInactiveInterns() {
    try {
      console.log("🧹 Starting cleanup of inactive interns...");
      const result = await SLTApiScheduler.performDataCleanup();
      return result;
    } catch (error) {
      console.error("❌ Cleanup service error:", error.message);
      return {
        success: false,
        message: `Cleanup failed: ${error.message}`,
        stats: {
          totalInDb: 0,
          activeInApi: 0,
          removed: 0,
          errors: 1,
        },
      };
    }
  }

  async acceptAgreement(internId) {
    const intern = await InternRepository.getInternById(internId);
    if (!intern) {
      throw new Error("Intern not found");
    }

    intern.agreementAccepted = true;
    intern.agreementAcceptedDate = new Date();
    await intern.save();

    return intern;
  }
}

module.exports = new InternService();
