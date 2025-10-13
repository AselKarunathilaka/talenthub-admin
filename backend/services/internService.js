const InternRepository = require("../repositories/internRepository");
const SLTApiService = require("./sltApiService");
const SLTApiScheduler = require("./sltApiScheduler");
const moment = require("moment");

class InternService {
  async addIntern(data) {
    return await InternRepository.addIntern(data);
  }

  async getAllInterns(date) {
    let interns = await InternRepository.getAllInterns();

    if (date) {
      const formattedDate = moment.tz(date, "Asia/Colombo").startOf('day').toDate();
      const endDate = moment.tz(date, "Asia/Colombo").endOf('day').toDate();

      interns = interns.map((intern) => {
        const attendance = intern.attendance || [];
        const attendanceRecord = attendance.find(att => {
          const attendanceDate = new Date(att.date).setHours(0, 0, 0, 0);
          return attendanceDate >= formattedDate && attendanceDate <= endDate;
        });

        return {
          ...intern,
          attendanceStatus: attendanceRecord ? attendanceRecord.status : "Not Marked"
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
    const attendanceDate = date ? moment.tz(date, "Asia/Colombo").toDate() : moment.tz("Asia/Colombo").toDate();
    return await InternRepository.markAttendance(internId, status, attendanceDate);
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
      throw new Error('Error fetching teams from repository: ' + error.message);
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
      throw new Error("Error fetching attendance stats for today: " + error.message);
    }
  }
  
  async updateAttendanceForSpecificDate(internId, date, status) {
    return await InternRepository.updateAttendanceForSpecificDate(internId, date, status);
  }

  async getWeeklyAttendanceStats() {
    const startOfWeek = moment().startOf('week').toDate();
    const endOfWeek = moment().endOf('week').toDate();

    const interns = await InternRepository.getAllInterns();

    const attendedInterns = interns.filter(intern => {
      return intern.attendance.some(attendance => {
        const attendanceDate = new Date(attendance.date).setHours(0, 0, 0, 0);
        return attendanceDate >= startOfWeek && attendanceDate <= endOfWeek && attendance.status === "Present";
      });
    });

    const notAttendedInterns = interns.filter(intern => {
      return intern.attendance.every(attendance => {
        const attendanceDate = new Date(attendance.date).setHours(0, 0, 0, 0);
        return attendanceDate < startOfWeek || attendanceDate > endOfWeek || attendance.status === "Absent";
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

  async syncWithSLTAPI() {
    try {
      const activeTrainees = await SLTApiService.fetchActiveTrainees();
      
      let addedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      // Process each trainee
      for (const trainee of activeTrainees) {
        try {
          const traineeId = trainee.Trainee_ID?.toString();
          
          if (!traineeId) {
            skippedCount++;
            continue;
          }

          // Map API data to your schema using the service mapper
          const mappedTrainees = SLTApiService.mapToInternSchema([trainee]);
          if (mappedTrainees.length === 0) {
            skippedCount++;
            continue;
          }

          const internData = mappedTrainees[0];

          // Check if intern already exists using the repository method
          const existingIntern = await InternRepository.findByTraineeId(traineeId);

          if (existingIntern) {
            // Update existing intern - only update fields that are missing or have changed
            const updatedData = {};
            
            // Update name if different (support both API keys and camelCase)
            const existingName = existingIntern.traineeName || existingIntern.Trainee_Name || '';
            if (existingName !== internData.traineeName) {
              updatedData.traineeName = internData.traineeName;
            }
            
            // Update training start date if missing or different
            const existingStart = existingIntern.trainingStartDate || existingIntern.Training_StartDate;
            if (!existingStart && internData.trainingStartDate) {
              updatedData.trainingStartDate = internData.trainingStartDate;
            } else if (internData.trainingStartDate && existingStart) {
              const existingDate = new Date(existingStart).getTime();
              const newDate = new Date(internData.trainingStartDate).getTime();
              if (existingDate !== newDate) {
                updatedData.trainingStartDate = internData.trainingStartDate;
              }
            }
            
            // Update training end date if missing or different
            const existingEnd = existingIntern.trainingEndDate || existingIntern.Training_EndDate;
            if (!existingEnd && internData.trainingEndDate) {
              updatedData.trainingEndDate = internData.trainingEndDate;
            } else if (internData.trainingEndDate && existingEnd) {
              const existingDate = new Date(existingEnd).getTime();
              const newDate = new Date(internData.trainingEndDate).getTime();
              if (existingDate !== newDate) {
                updatedData.trainingEndDate = internData.trainingEndDate;
              }
            }
            
            // Update institute if missing or different
            const existingInstitute = existingIntern.institute || existingIntern.Institute || '';
            if ((!existingInstitute || existingInstitute.trim() === '') && internData.institute) {
              updatedData.institute = internData.institute;
            } else if (internData.institute && existingInstitute !== internData.institute) {
              updatedData.institute = internData.institute;
            }
            
            // Update email if missing or different
            const existingEmail = (existingIntern.email || existingIntern.Trainee_Email || '')?.toString().toLowerCase();
            const newEmail = (internData.email || '')?.toString().toLowerCase();
            if ((!existingEmail || existingEmail.trim() === '') && newEmail) {
              updatedData.email = internData.email;
            } else if (newEmail && existingEmail !== newEmail) {
              updatedData.email = internData.email;
            }
            
            // Update field of specialization if missing or different
            const existingField = existingIntern.fieldOfSpecialization || existingIntern.field_of_spec_name || '';
            if ((!existingField || existingField.trim() === '') && internData.fieldOfSpecialization) {
              updatedData.fieldOfSpecialization = internData.fieldOfSpecialization;
            } else if (internData.fieldOfSpecialization && existingField !== internData.fieldOfSpecialization) {
              updatedData.fieldOfSpecialization = internData.fieldOfSpecialization;
            }
            
            // Only update if there are changes
            if (Object.keys(updatedData).length > 0) {
              await InternRepository.updateIntern(existingIntern._id, updatedData);
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else {
            // Create new intern
            await InternRepository.addIntern(internData);
            addedCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      const result = {
        success: true,
        message: `Sync completed: ${addedCount} added, ${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors`,
        stats: {
          added: addedCount,
          updated: updatedCount,
          skipped: skippedCount,
          errors: errorCount,
          totalProcessed: activeTrainees.length
        }
      };

      console.log('✅ Sync completed:', result.message);
      return result;

    } catch (error) {
      console.error('❌ SLT API synchronization failed:', error.message);
      return {
        success: false,
        message: `Sync failed: ${error.message}`,
        stats: {
          added: 0,
          updated: 0,
          skipped: 0,
          errors: 1,
          totalProcessed: 0
        }
      };
    }
  }

  async testSLTAPI() {
    try {
      console.log('🧪 Testing SLT API connection...');
      const trainees = await SLTApiService.fetchActiveTrainees();
      
      const result = {
        success: true,
        message: 'SLT API connection successful',
        count: trainees.length,
        sample: trainees.slice(0, 3),
        total: trainees.length
      };
      
      console.log('✅ SLT API test successful:', result.message);
      return result;
    } catch (error) {
      console.error('❌ SLT API test failed:', error.message);
      return {
        success: false,
        message: `SLT API test failed: ${error.message}`,
        count: 0,
        sample: [],
        total: 0
      };
    }
  }

  async getActiveTraineesFromSLT() {
    try {
      console.log('📡 Fetching active trainees from SLT API...');
      const trainees = await SLTApiService.fetchActiveTrainees();
      const mappedTrainees = SLTApiService.mapToInternSchema(trainees);
      
      const result = {
        success: true,
        data: mappedTrainees,
        count: mappedTrainees.length
      };
      
      console.log('✅ Fetched trainees from SLT API:', result.count);
      return result;
    } catch (error) {
      console.error('❌ Error fetching SLT trainees:', error.message);
      return {
        success: false,
        message: error.message,
        data: [],
        count: 0
      };
    }
  }

  async cleanupInactiveInterns() {
    try {
      console.log('🧹 Starting cleanup of inactive interns...');
      const result = await SLTApiScheduler.performDataCleanup();
      return result;
    } catch (error) {
      console.error('❌ Cleanup service error:', error.message);
      return {
        success: false,
        message: `Cleanup failed: ${error.message}`,
        stats: {
          totalInDb: 0,
          activeInApi: 0,
          removed: 0,
          errors: 1
        }
      };
    }
  }
}

module.exports = new InternService();