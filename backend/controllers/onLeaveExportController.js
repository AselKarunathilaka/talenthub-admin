const xlsx = require("xlsx");
const Intern = require("../models/Intern");
const DailyRecord = require("../models/DailyRecord");

const { getPastWorkingDays } = require("../utils/workingDays");

const exportOnLeaveExcel = async (req, res) => {
  try {
    // Get the most recent working day (Mon-Fri excl. public holidays)
    const targetDateStr = req.query.date || getPastWorkingDays(1)[0];


    // Get yesterday's daily records where status is 'leave' OR task is 'On Leave' OR stack is 'On Leave'
    const leaveRecords = await DailyRecord.find({
      date: targetDateStr,
      $or: [
        { status: 'leave' },
        { task: 'On Leave' },
        { stack: 'On Leave' }
      ]
    }).populate('internId');

    // Prepare data for Excel
    let data;
    if (leaveRecords.length === 0) {
      data = [{ Message: 'No interns were on leave for the previous day.' }];
    } else {
      data = leaveRecords.map(record => ({
        Date: record.date || '',
        TraineeID: record.internId?.Trainee_ID || '',
        Name: record.internId?.Trainee_Name || '',
        Email: record.internId?.Trainee_Email || '',
        Field: record.internId?.field_of_spec_name || '',
        Institute: record.internId?.Institute || '',
        Team: record.internId?.team || '',
        LeaveReason: record.task || 'On Leave'
      }));
    }

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "OnLeave");

    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", "attachment; filename=on_leave_interns.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err) {
    console.error("Error exporting on-leave interns:", err);
    res.status(500).json({ error: "Failed to export on-leave interns" });
  }
};

module.exports = { exportOnLeaveExcel };
