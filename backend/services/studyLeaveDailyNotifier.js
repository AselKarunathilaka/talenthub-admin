const cron = require("node-cron");
const LeaveRequest = require("../models/LeaveRequest");
const emailSender = require("../utils/emailSender");

class StudyLeaveDailyNotifier {
  constructor() {
    this.cronTask = null;
    this.RECIPIENTS = {
      to: ["mgiri@slt.com.lk"],
      cc: ["send2liyanapathirana@gmail.com"],
    };
  }

  start() {
    if (this.cronTask) {
      console.log("StudyLeaveDailyNotifier is already running.");
      return;
    }

    // Run at 8:00 AM every day
    // "0 8 * * *" in Sri Lanka time
    this.cronTask = cron.schedule(
      "0 8 * * *",
      async () => {
        try {
          await this.notifyAdminsExtendedLeaves();
        } catch (error) {
          console.error("Error in studyLeaveDailyNotifier cron job:", error);
        }
      },
      {
        scheduled: true,
        timezone: "Asia/Colombo",
      }
    );

    console.log("StudyLeaveDailyNotifier initialized and scheduled for 8:00 AM Asia/Colombo.");
  }

  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
      console.log("StudyLeaveDailyNotifier stopped.");
    }
  }

  async notifyAdminsExtendedLeaves() {
    const sriLankaTime = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Colombo",
    });
    const today = new Date(sriLankaTime);
    today.setHours(0, 0, 0, 0);

    console.log(`[StudyLeaveDailyNotifier] Checking for active extended leaves for ${today.toISOString().split("T")[0]}`);

    // Find all approved study leaves that intersect with today
    const activeLeaves = await LeaveRequest.find({
      requestType: "study_leave",
      status: "Approved",
      leaveDate: { $lte: today },
      studyEndDate: { $gte: today },
    }).populate("intern", "Trainee_Name Trainee_ID Trainee_Email");

    if (!activeLeaves || activeLeaves.length === 0) {
      console.log("[StudyLeaveDailyNotifier] No active extended leaves today. Skipping email.");
      return;
    }

    console.log(`[StudyLeaveDailyNotifier] Found ${activeLeaves.length} active extended leaves today.`);

    const dateStr = today.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const subject = `Daily Reminder: Interns on Extended Leave (${dateStr})`;

    let rowsHtml = "";
    activeLeaves.forEach((leave, index) => {
      const internName = leave.intern?.Trainee_Name || leave.internName || "Unknown";
      const traineeId = leave.intern?.Trainee_ID || leave.internTraineeId || "N/A";
      const startDate = new Date(leave.leaveDate).toLocaleDateString("en-US");
      const endDate = new Date(leave.studyEndDate).toLocaleDateString("en-US");

      rowsHtml += `
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${index + 1}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${internName}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${traineeId}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${startDate} to ${endDate}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${leave.reason || "N/A"}</td>
        </tr>
      `;
    });

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: auto;">
        <h2 style="color: #0b5394; border-bottom: 2px solid #0b5394; padding-bottom: 10px;">Extended Leave Daily Reminder</h2>
        <p>Hello Admin,</p>
        <p>Here is the list of interns who are on <strong>Approved Extended Leave</strong> today (${dateStr}):</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 5%;">No.</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left; width: 25%;">Intern Name</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 15%;">Trainee ID</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: center; width: 25%;">Duration</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left; width: 30%;">Reason</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        
        <p style="margin-top: 30px; font-size: 12px; color: #777;">
          This is an automated notification from TalentHub.
        </p>
      </div>
    `;

    // Send the email
    try {
      await emailSender.sendEmail({
        to: this.RECIPIENTS.to,
        cc: this.RECIPIENTS.cc,
        subject: subject,
        html: html
      });
      console.log("[StudyLeaveDailyNotifier] Successfully sent daily extended leave email.");
    } catch (error) {
      console.error("[StudyLeaveDailyNotifier] Failed to send email:", error);
    }
  }
}

module.exports = new StudyLeaveDailyNotifier();
