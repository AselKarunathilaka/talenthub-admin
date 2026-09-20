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
    let securityConfig = await SecuritySetting.findOne({ functionName: "Security Check" });
    if (!securityConfig) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("TalentHub@2026", salt);
      securityConfig = await SecuritySetting.create({
        functionName: "Security Check",
        password: hashedPassword,
        history: [],
      });
    }

    // If trying to disable location security, require the Master PIN
    if (sltLocationRequired === false) {
      let requireSecurityCheck = true;
      if (req.user && (req.user.id || req.user._id)) {
        const userId = req.user.id || req.user._id;
        const user = await User.findById(userId);
        if (user && user.requireSecurityCheck === false) {
          requireSecurityCheck = false;
        }
      }

      if (requireSecurityCheck) {
        if (!securityPin) {
          return res.status(400).json({ message: "Security Password is required." });
        }

        const isMatch = await bcrypt.compare(securityPin, securityConfig.password);
        if (!isMatch) {
          return res.status(400).json({ message: "Invalid Security Password." });
        }
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

    const t = securityConfig.toggles || {};
    if (t.location !== false) {
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
    }

    return res.status(200).json({ message: "Settings updated successfully.", settings });
  } catch (error) {
    return res.status(500).json({ message: "Failed to verify password.", error: error.message });
  }
};

const verifySecurityPassword = async (req, res) => {
  try {
    const { securityPin, action, extraInfo } = req.body;
    if (!securityPin) {
      return res.status(400).json({ message: "Security Password is required." });
    }
    
    const securityConfig = await SecuritySetting.findOne({ functionName: "Security Check" });
    if (!securityConfig) {
      return res.status(400).json({ message: "Invalid Security Password." });
    }
    
    const isMatch = await bcrypt.compare(securityPin, securityConfig.password);
    
    let adminName = req.user?.name || "Unknown User";
    let adminEmail = req.user?.email || "Unknown Email";
    if (req.user && req.user.email) {
      const actualUser = await User.findOne({ email: req.user.email });
      if (actualUser && actualUser.name) adminName = actualUser.name;
    }

    if (!isMatch) {
      let attemptedAction = "Security Verification";
      if (action === "Get access to settings page in admin side" || action === "Settings page accessed") {
        attemptedAction = "Settings page to get access in admin side";
      } else if (action) {
        attemptedAction = action;
      }

      const failureMessage = `⚠️ *SECURITY ALERT*\nFailed Security Verification Attempt\n\nAction: ${attemptedAction}\n\nAction Performed By: ${adminName} (${adminEmail})\nTimestamp: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`;

      const { sendSecurityAlertEmail } = require("../utils/emailSender");
      const { sendWhatsAppMessage } = require("../utils/whatsappSender");
      const SecurityAlert = require("../models/SecurityAlert");

      SecurityAlert.find({}).then(alerts => {
        alerts.forEach(alert => {
          if (alert.phoneNumber) {
            sendWhatsAppMessage(alert.phoneNumber, failureMessage).catch(err => 
              console.error(`Failed to send WhatsApp to ${alert.phoneNumber}:`, err)
            );
          }
        });
      }).catch(err => console.error("Failed to fetch security alerts for WhatsApp:", err));

      sendSecurityAlertEmail({
        adminName: adminName,
        adminEmail: adminEmail,
        statusText: `Failed Verification Attempt: ${attemptedAction}`,
        actionData: extraInfo
      }).catch(err => console.error("Failed to send security alert email:", err));

      return res.status(400).json({ message: "Invalid Security Password." });
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
    } else if (action === "short leave approve") {
      statusText = "Short Leave Approved in Admin Side";
    } else if (action === "short leave deny") {
      statusText = "Short Leave Denied in Admin Side";
    } else if (action === "short leave restore") {
      statusText = "Short Leave Restored to Pending in Admin Side";
    } else if (action === "extended leave approve") {
      statusText = "Extended Leave Approved in Admin Side";
    } else if (action === "extended leave deny") {
      statusText = "Extended Leave Denied in Admin Side";
    } else if (action === "extended leave restore") {
      statusText = "Extended Leave Restored to Pending in Admin Side";
    } else if (action === "past intern locations visibility toggled on") {
      statusText = "Past Intern Locations Visibility Toggled On in Admin Side";
    } else if (action === "past intern locations visibility toggled off") {
      statusText = "Past Intern Locations Visibility Toggled Off in Admin Side";
    } else if (action === "seat book") {
      statusText = "Seat Booked in Admin Side";
    } else if (action === "seat lock") {
      statusText = "Seat Locked in Admin Side";
    } else if (action === "seat unlock") {
      statusText = "Seat Unlocked in Admin Side";
    } else if (action === "booking cancel") {
      statusText = "Seat Booking Cancelled in Admin Side";
    } else if (action === "university approve") {
      statusText = "University Access Approved in Admin Side";
    } else if (action === "university reject") {
      statusText = "University Request Rejected in Admin Side";
    } else if (action === "university remove") {
      statusText = "University Access Removed in Admin Side";
    } else if (action === "university document remove") {
      statusText = "University Verification Document Removed in Admin Side";
    } else if (action === "intern reactivate") {
      statusText = "Reactivate Intern in Admin Side";
    } else if (action === "logbook restriction lift") {
      statusText = "Logbook Restriction lift in admin side";
    } else if (action === "talenthub restriction lift") {
      statusText = "TalentHub Restriction lift in admin side";
        } else if (action === "talenthub restriction revoke") {
      statusText = "TalentHub Restriction revoke in admin side";
    } else if (action === "Send announcemt for all interns in admin side" || action === "send mass announcement") {
      statusText = "Send announcemt for all interns in admin side";
        } else if (action === "Delete anncounement in admin side" || action === "delete announcement") {
      statusText = "Delete anncounement in admin side";
    } else if (action === "add holiday") {
      statusText = "Add Holiday in admin side";
    } else if (action === "delete holiday") {
      statusText = "Delete Holiday in admin side";
    } else if (action === "update holiday") {
      statusText = "Update Holiday in admin side";
    } else if (action === "verify holiday") {
      statusText = "Verify Holidays in admin side";
    } else if (action === "unverify holiday") {
      statusText = "Unverify Holidays in admin side";
    } else if (action === "Get access to settings page in admin side" || action === "Settings page accessed") {
      statusText = "Settings page to get access in admin side";
    }
    
    let emailStatusText = statusText;
    let whatsappMessage = `⚠️ *SECURITY ALERT*\n${statusText}`;
    
    if (extraInfo) {
      whatsappMessage += `\n\nAction Data:\n${extraInfo.replace(/, /g, '\n')}`;
    }
    
    whatsappMessage += `\n\nAction Performed By: ${adminName} (${adminEmail})\nTimestamp: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`;
    
    // Check toggles before sending alerts
    const t = securityConfig.toggles || {};
    let shouldSendAlert = true;
    
    if (action.includes("location") && t.location === false) shouldSendAlert = false;
    else if (action.includes("attendance") && t.attendance === false) shouldSendAlert = false;
    else if (action.includes("logbook") && t.logbook === false) shouldSendAlert = false;
    else if (action.includes("holiday") && t.holiday === false) shouldSendAlert = false;
    else if (action.includes("lift") && t.lift === false) shouldSendAlert = false;

    if (shouldSendAlert) {
      sendSecurityAlertEmail({
        adminName: adminName,
        adminEmail: adminEmail,
        statusText: emailStatusText,
        actionData: extraInfo // Pass extraInfo directly to format cleanly in email
      }).catch(err => console.error("Failed to send security alert email:", err));
      
      SecurityAlert.find({}).then(alerts => {
        alerts.forEach(alert => {
          if (alert.phoneNumber) {
            sendWhatsAppMessage(alert.phoneNumber, whatsappMessage).catch(err => 
              console.error(`Failed to send WhatsApp to ${alert.phoneNumber}:`, err)
            );
          }
        });
      }).catch(err => console.error("Failed to fetch security alerts for WhatsApp:", err));
    }

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
