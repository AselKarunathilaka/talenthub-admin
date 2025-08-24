const InternRepository = require("../repositories/internRepository");
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


  // async addAvailableDay(traineeId, day) {
  //   const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  //   if (!validDays.includes(day)) {
  //     throw new Error("Invalid day provided");
  //   }

  //   return await InternRepository.addAvailableDay(traineeId, day);
  // }

  // async removeAvailableDay(traineeId, day) {
  //   const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  //   if (!validDays.includes(day)) {
  //     throw new Error("Invalid day provided");
  //   }

  //   return await InternRepository.removeAvailableDay(traineeId, day);
  // }

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

}

module.exports = new InternService();
