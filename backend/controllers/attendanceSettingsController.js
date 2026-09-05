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
    const { sltLocationRequired, securityPin } = req.body;

    // If trying to disable location security, require the Master PIN
    if (sltLocationRequired === false) {
      const requiredPin = process.env.ATTENDANCE_SECURITY_PIN;
      if (!requiredPin) {
        return res.status(500).json({ message: "Security PIN is not configured on the server." });
      }
      if (securityPin !== requiredPin) {
        return res.status(401).json({ message: "Invalid Security PIN." });
      }
    }

    const settings = await AttendanceSettingsService.updateAttendanceSettings({
      sltLocationRequired,
      updatedBy: req.user?.id || null,
    });

    // Send high-priority alert email when disabled
    if (sltLocationRequired === false) {
      const { sendSecurityAlertEmail } = require("../utils/emailSender");
      sendSecurityAlertEmail({
        adminName: req.user?.name || "Unknown Admin",
        adminEmail: req.user?.email || "Unknown Email",
      }).catch((err) => console.error("Failed to send security alert email:", err));
    }

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
