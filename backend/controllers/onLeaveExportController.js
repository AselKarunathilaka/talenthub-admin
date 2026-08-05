const xlsx = require("xlsx");
const Intern = require("../models/Intern");
const DailyRecord = require("../models/DailyRecord");

const exportOnLeaveExcel = async (req, res) => {
  try {
  // Always use local time for 'yesterday' (previous day)
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const yyyy = yesterday.getFullYear();
  const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
  const dd = String(yesterday.getDate()).padStart(2, '0');
  const yesterdayStr = `${yyyy}-${mm}-${dd}`;


    // Get yesterday's daily records where status is 'leave' OR task is 'On Leave' OR stack is 'On Leave'
    const leaveRecords = await DailyRecord.find({
      date: yesterdayStr,
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
