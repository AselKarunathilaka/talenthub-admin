const cron = require('node-cron');
const moment = require('moment-timezone');
const LeaveRequest = require('../models/LeaveRequest');
const Holiday = require('../models/Holiday');
const emailSender = require('../utils/emailSender');

class PendingExtendedLeaveNotifier {
  static init() {
    console.log('🕐 Initializing pending extended leave notification scheduler...');

    // Run every day at 09:00 AM Asia/Colombo
    const cronExpression = '0 9 * * *';

    cron.schedule(cronExpression, async () => {
      console.log(`\n⏰ Pending extended leave notification triggered at ${new Date().toLocaleString()} (server time)`);
      try {
        await this.runNotification();
      } catch (error) {
        console.error('❌ Pending extended leave notification error:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Colombo'
    });

    console.log('✅ Pending extended leave notification scheduler initialized (every day 09:00 AM Asia/Colombo).');
  }

  static async runNotification() {
    const today = moment.tz('Asia/Colombo').format('YYYY-MM-DD');
    
    // Skip weekends
    const dayOfWeek = moment.tz('Asia/Colombo').day();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log(`✨ Skipping pending extended leave notification for ${today} (Weekend).`);
      return;
    }

    // Skip holidays
    const isHoliday = await Holiday.findOne({ date: today });
    if (isHoliday) {
      console.log(`✨ Skipping pending extended leave notification for ${today} (Holiday: ${isHoliday.name}).`);
      return;
    }

    console.log(`🔍 Finding pending extended leave requests for ${today}...`);

    try {
      // Find all Pending Extended Leave requests
      // Note: Extended Leave uses requestType "study_leave"
      const pendingLeaves = await LeaveRequest.find({
        status: "Pending",
        requestType: "study_leave"
      }).populate('intern', 'Trainee_Name Trainee_ID Trainee_Email');

      if (!pendingLeaves || pendingLeaves.length === 0) {
        console.log("✅ No pending extended leave requests found. Skipping email.");
        return;
      }

      console.log(`📊 Found ${pendingLeaves.length} pending extended leave request(s)`);

      // Recipient list as requested
      const recipients = {
        to: ["mgiri@slt.com.lk"],
        cc: ["send2liyanapathirana@gmail.com"],
      };

      await this.sendSummaryEmail(pendingLeaves, recipients);
      console.log(`✅ Pending extended leave report sent — ${pendingLeaves.length} request(s) included`);

    } catch (error) {
      console.error('❌ Error processing pending extended leaves:', error);
    }
  }

  static async sendSummaryEmail(pendingLeaves, recipients) {
    const dateStr = moment.tz('Asia/Colombo').format('dddd, MMMM D, YYYY');
    const subject = `Pending Extended Leave Requests Summary - ${dateStr}`;

    let rowsHtml = "";
    pendingLeaves.forEach((leave, index) => {
      const internName = leave.intern?.Trainee_Name || leave.internName || "Unknown";
      const traineeId = leave.intern?.Trainee_ID || leave.internTraineeId || "N/A";
      const startDate = new Date(leave.leaveDate).toLocaleDateString("en-US");
      const endDate = leave.studyEndDate ? new Date(leave.studyEndDate).toLocaleDateString("en-US") : "N/A";
      const submittedDate = new Date(leave.submittedAt || leave.createdAt || leave.leaveDate).toLocaleDateString("en-US");

      rowsHtml += `
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${index + 1}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${internName}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${traineeId}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${startDate} to ${endDate}</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${leave.purpose || "N/A"}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${submittedDate}</td>
        </tr>
      `;
    });

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 900px; margin: auto;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
          Pending Extended Leave Requests
        </h2>
        <p style="font-size: 16px;">
          Hello Admin,<br><br>
          There are currently <strong>${pendingLeaves.length} pending extended leave requests</strong> that require your review. 
          Please log in to the TalentHub dashboard to process them.
        </p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">#</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Intern Name</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">Trainee ID</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">Requested Period</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Purpose</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">Submitted On</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        
        <p style="margin-top: 30px; font-size: 14px; color: #7f8c8d;">
          This is an automated notification from TalentHub.
        </p>
      </div>
    `;

    // emailSender util
    const allRecipients = [...recipients.to, ...(recipients.cc || [])];
    
    for (const email of allRecipients) {
        await emailSender(email, subject, html);
    }
  }
}

module.exports = PendingExtendedLeaveNotifier;
