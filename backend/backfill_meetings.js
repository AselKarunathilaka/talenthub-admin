const mongoose = require('mongoose');
const DailyRecord = require('./models/DailyRecord');
const Intern = require('./models/Intern');

require('dotenv').config();

const missingDates = [
  '2026-02-16', // Last 2 weeks in Feb
  '2026-02-23',
  '2026-03-02', // 3 weeks in March
  '2026-03-09',
  '2026-03-16'
];

async function backfillMeetings() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Find active interns in Feb and Mar
    const activeInterns = await Intern.find({
      Training_StartDate: { $lt: new Date('2026-04-01T00:00:00Z') },
      Training_EndDate: { $gt: new Date('2026-01-31T23:59:59Z') }
    });

    console.log(`Starting backfill for ${activeInterns.length} interns...`);

    let recordsUpdated = 0;
    let recordsCreated = 0;

    for (const intern of activeInterns) {
      for (const dateStr of missingDates) {
        const attendanceTime = new Date(`${dateStr}T09:00:00Z`);

        // Check if the intern was active on this specific date
        const startDate = new Date(intern.Training_StartDate);
        const endDate = intern.Training_EndDate ? new Date(intern.Training_EndDate) : new Date('2099-01-01');
        
        if (attendanceTime < startDate || attendanceTime > endDate) {
          continue; // Intern wasn't active on this date
        }

        const meetingObj = {
          projectName: "Weekly Review (Recovered)",
          meetingTitle: "Weekly Review (Recovered)",
          method: "manual",
          attendanceStatus: "present",
          attendanceTime: attendanceTime
        };

        // Try to find an existing DailyRecord for this intern and date
        let record = await DailyRecord.findOne({ internId: intern._id, date: dateStr });

        if (record) {
          // Add meeting to existing daily record if not already there
          const hasMeeting = record.meetingAttendance && record.meetingAttendance.some(m => m.meetingTitle === meetingObj.meetingTitle);
          if (!hasMeeting) {
            if (!record.meetingAttendance) record.meetingAttendance = [];
            record.meetingAttendance.push(meetingObj);
            await record.save();
            recordsUpdated++;
          }
        } else {
          // Create new daily record just to hold this meeting
          record = new DailyRecord({
            internId: intern._id,
            date: dateStr,
            stack: "N/A",
            task: "Meeting attendance recovered from system issue",
            progress: "No challenges faced",
            blockers: "No specific plans",
            status: "working",
            attendance: "absent", // Don't mark as present for daily work, just meeting
            meetingAttendance: [meetingObj]
          });
          await record.save();
          recordsCreated++;
        }
      }
    }

    console.log('--- Backfill Complete ---');
    console.log(`Daily Records Updated: ${recordsUpdated}`);
    console.log(`Daily Records Created: ${recordsCreated}`);

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

backfillMeetings();
