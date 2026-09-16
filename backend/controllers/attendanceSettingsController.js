const AttendanceSettingsService = require("../services/attendanceSettingsService");
const SecuritySetting = require("../models/SecuritySetting");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

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

    // Find the master security setting document
    let securityConfig = await SecuritySetting.findOne({ functionName: "Location on/off" });
    if (!securityConfig) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("TalentHub@2026", salt);
      securityConfig = await SecuritySetting.create({
        functionName: "Location on/off",
        password: hashedPassword,
        history: [],
      });
    }

    // If trying to disable location security, require the Master PIN
    if (sltLocationRequired === false) {
      if (!securityPin) {
        return res.status(400).json({ message: "Security Password is required." });
      }

      const isMatch = await bcrypt.compare(securityPin, securityConfig.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid Security Password." });
      }
    }

    // Fetch current settings to check if it's a state transition
    const currentSettings = await AttendanceSettingsService.getAttendanceSettings();
    const wasLocationRequired = currentSettings.sltLocationRequired !== false;

    const settings = await AttendanceSettingsService.updateAttendanceSettings({
      sltLocationRequired,
      updatedBy: req.user?.id || null,
    });

    // Format date as yyyy/mm/dd
    const now = new Date();
    const dateStr = now.getFullYear() + "/" + String(now.getMonth() + 1).padStart(2, "0") + "/" + String(now.getDate()).padStart(2, "0");
    
    // Format time as 12h
    let hours = now.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const timeStr = hours + ":" + minutes + " " + ampm;

    // Retrieve real user name from DB
    let adminName = req.user?.name || "Unknown User";
    let adminEmail = req.user?.email || "Unknown Email";
    
    if (req.user && req.user.email) {
      const actualUser = await User.findOne({ email: req.user.email });
      if (actualUser && actualUser.name) {
        adminName = actualUser.name;
      }
    }

    // Push usage log to the array
    securityConfig.history.push({
      activity: sltLocationRequired ? "location on" : "location off",
      userName: adminName,
      userMail: adminEmail,
      date: dateStr,
      time: timeStr,
    });
    await securityConfig.save();

    // Send high-priority alert email and WhatsApp message when toggled
    const { sendSecurityAlertEmail } = require("../utils/emailSender");
    const { sendWhatsAppMessage } = require("../utils/whatsappSender");
    const SecurityAlert = require("../models/SecurityAlert");

    const statusText = sltLocationRequired ? "Enabled" : "Disabled";

    // Send Email (which dynamically fetches from SecurityAlert)
    sendSecurityAlertEmail({
      adminName: adminName,
      adminEmail: adminEmail,
      statusText: statusText
    }).catch((err) => console.error("Failed to send security alert email:", err));

    // Fetch recipients for WhatsApp and send
    SecurityAlert.find({}).then(alerts => {
      alerts.forEach(alert => {
        if (alert.phoneNumber) {
          const message = `⚠️ *SECURITY ALERT*\nLocation Geofencing ${statusText}\n\nAction Performed By: ${adminName} (${adminEmail})\nTimestamp: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`;
          sendWhatsAppMessage(alert.phoneNumber, message).catch(err => 
            console.error(`Failed to send WhatsApp to ${alert.phoneNumber}:`, err)
          );
        }
      });
    }).catch(err => console.error("Failed to fetch security alerts for WhatsApp:", err));

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

const verifySecurityPassword = async (req, res) => {
  try {
    const { securityPin, action } = req.body;
    if (!securityPin) {
      return res.status(400).json({ message: "Security Password is required." });
    }
    
    const securityConfig = await SecuritySetting.findOne({ functionName: "Location on/off" });
    if (!securityConfig) {
      return res.status(401).json({ message: "Invalid Security Password." });
    }
    
    const isMatch = await bcrypt.compare(securityPin, securityConfig.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid Security Password." });
    }
    
    let adminName = req.user?.name || "Unknown User";
    let adminEmail = req.user?.email || "Unknown Email";
    if (req.user && req.user.email) {
      const actualUser = await User.findOne({ email: req.user.email });
      if (actualUser && actualUser.name) adminName = actualUser.name;
    }
    
    const now = new Date();
    const dateStr = now.getFullYear() + "/" + String(now.getMonth() + 1).padStart(2, "0") + "/" + String(now.getDate()).padStart(2, "0");
    let hours = now.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const timeStr = hours + ":" + minutes + " " + ampm;
    
    securityConfig.history.push({
      activity: action || "security verification",
      userName: adminName,
      userMail: adminEmail,
      date: dateStr,
      time: timeStr,
    });
    await securityConfig.save();
    
    const { sendSecurityAlertEmail } = require("../utils/emailSender");
    const { sendWhatsAppMessage } = require("../utils/whatsappSender");
    const SecurityAlert = require("../models/SecurityAlert");
    
    let statusText = "Security Verification Passed";
    if (action === "manual attendance") {
      statusText = "Manual Attendance Admin Tool Accessed";
    } else if (action === "face attendance scanner initialization") {
      statusText = "Face Attendance Access in Admin Side";
    } else if (action === "daily qr code generation") {
      statusText = "Daily QR Code Generated in Admin Side";
    } else if (action === "meeting qr code generation") {
      statusText = "Meeting QR Code Generated in Admin Side";
    } else if (action === "pin code generation") {
      statusText = "PIN Code Generated in Admin Side";
    }
    
    sendSecurityAlertEmail({
      adminName: adminName,
      adminEmail: adminEmail,
      statusText: statusText
    }).catch(err => console.error("Failed to send security alert email:", err));
    
    SecurityAlert.find({}).then(alerts => {
      alerts.forEach(alert => {
        if (alert.phoneNumber) {
          const message = `⚠️ *SECURITY ALERT*\n${statusText}\n\nAction Performed By: ${adminName} (${adminEmail})\nTimestamp: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`;
          sendWhatsAppMessage(alert.phoneNumber, message).catch(err => 
            console.error(`Failed to send WhatsApp to ${alert.phoneNumber}:`, err)
          );
        }
      });
    }).catch(err => console.error("Failed to fetch security alerts for WhatsApp:", err));
    
    return res.status(200).json({ message: "Verification successful." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to verify password.", error: error.message });
  }
};

module.exports = {
  getAttendanceSettings,
  updateAttendanceSettings,
  verifySecurityPassword
};
