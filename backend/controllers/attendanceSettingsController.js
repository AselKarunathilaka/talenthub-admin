const AttendanceSettingsService = require("../services/attendanceSettingsService");

const getAttendanceSettings = async (req, res) => {
  try {
    const settings = await AttendanceSettingsService.getAttendanceSettings();
    return res.status(200).json({ settings });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load attendance settings.",
      error: error.message,
    });
  }
};

const updateAttendanceSettings = async (req, res) => {
  try {
    const settings = await AttendanceSettingsService.updateAttendanceSettings({
      sltLocationRequired: req.body.sltLocationRequired,
      updatedBy: req.user?.id || null,
    });

    return res.status(200).json({
      message: "Attendance settings updated successfully.",
      settings,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update attendance settings.",
      error: error.message,
    });
  }
};

module.exports = {
  getAttendanceSettings,
  updateAttendanceSettings,
};
