const InternRepository = require("../repositories/internRepository");
const SLTApiService = require("./sltApiService"); // Add this import
const moment = require("moment");

class InternService {
  async addIntern(data) {
    return await InternRepository.addIntern(data);
  }

  // Update the getAllInterns method
  async getAllInterns(date) {
    let interns = await InternRepository.getAllInterns();

    if (date) {
      const formattedDate = moment.tz(date, "Asia/Colombo").startOf('day').toDate();
      const endDate = moment.tz(date, "Asia/Colombo").endOf('day').toDate();

      interns = interns.map((intern) => {
        const attendance = intern.attendance || []; // Ensure attendance is an array
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
      return await InternRepository.getAttendanceStatsForToday(); // Fetches today's attendance stats
    } catch (error) {
      throw new Error("Error fetching attendance stats for today: " + error.message);
    }
  }
  
  async updateAttendanceForSpecificDate(internId, date, status) {
    return await InternRepository.updateAttendanceForSpecificDate(internId, date, status);
  }

  async getWeeklyAttendanceStats() {
    const startOfWeek = moment().startOf('week').toDate();  // Start of the current week (Sunday)
    const endOfWeek = moment().endOf('week').toDate();      // End of the current week (Saturday)

    // Fetch all interns and filter based on attendance status for the current week
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
    // Find the intern by traineeId and update the email
    const intern = await InternRepository.findByTraineeId(traineeId);
    if (!intern) throw new Error("Intern not found");

    // Update the intern's email
    intern.email = email;
    await intern.save();

    return intern;
  }

  // ==================== SLT API INTEGRATION METHODS ====================

  async syncWithSLTAPI() {
    try {
      console.log('🔄 Starting SLT API synchronization...');
      
      // Fetch active trainees from SLT API
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
            console.log('⚠️ Skipping trainee without ID:', trainee);
            skippedCount++;
            continue;
          }

          // Map API data to your schema
          const internData = {
            traineeId: traineeId,
            traineeName: trainee.Trainee_Name || '',
            fieldOfSpecialization: 'General Training', // Default value since SLT API doesn't provide this
            trainingStartDate: trainee.Training_StartDate ? new Date(trainee.Training_StartDate) : null,
            trainingEndDate: trainee.Training_EndDate ? new Date(trainee.Training_EndDate) : null,
            institute: trainee.Institute || '',
            email: trainee.Trainee_Email || '',
            team: '',
            attendance: [],
            availableDays: []
          };

          // Check if intern already exists
          const existingIntern = await InternRepository.findByTraineeId(internData.traineeId);

          if (existingIntern) {
            // Update existing intern (preserve team, attendance, and availableDays)
            const updatedData = {
              traineeName: internData.traineeName,
              trainingStartDate: internData.trainingStartDate,
              trainingEndDate: internData.trainingEndDate,
              institute: internData.institute,
              email: internData.email
            };
            
            await InternRepository.updateIntern(existingIntern._id, updatedData);
            updatedCount++;
            console.log(`📝 Updated intern: ${internData.traineeName} (${internData.traineeId})`);
          } else {
            // Create new intern
            await InternRepository.addIntern(internData);
            addedCount++;
            console.log(`➕ Added new intern: ${internData.traineeName} (${internData.traineeId})`);
          }
        } catch (error) {
          console.error(`❌ Error processing trainee ${trainee.Trainee_ID}:`, error.message);
          errorCount++;
        }
      }

      return {
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

    } catch (error) {
      console.error('❌ Sync failed:', error.message);
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
      const trainees = await SLTApiService.fetchActiveTrainees();
      return {
        success: true,
        message: 'SLT API connection successful',
        count: trainees.length,
        sample: trainees.slice(0, 3), // Return first 3 as sample
        total: trainees.length
      };
    } catch (error) {
      return {
        success: false,
        message: `SLT API test failed: ${error.message}`,
        count: 0,
        sample: [],
        total: 0
      };
    }
  }

  // Helper method to get raw data from SLT API
  async getActiveTraineesFromSLT() {
    try {
      const trainees = await SLTApiService.fetchActiveTrainees();
      return {
        success: true,
        data: trainees,
        count: trainees.length
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: [],
        count: 0
      };
    }
  }
}

module.exports = new InternService();