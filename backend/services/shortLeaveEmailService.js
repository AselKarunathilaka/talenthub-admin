const nodemailer = require("nodemailer");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const moment = require("moment");

class ShortLeaveEmailService {
  /**
   * Generate Excel file with short leave requests submitted today (8:30 AM - 4:30 PM submission window)
   */
  static generateShortLeaveRequestsExcel(shortLeaveRequests) {
    try {
      // Prepare data for Excel
      const excelData = [];

      excelData.push(["SHORT LEAVE REQUESTS"]);
      excelData.push(["TalentHub Intern Management System"]);
      excelData.push([]);
      excelData.push([
        "Report Generated:",
        moment().utcOffset("+05:30").format("MMMM DD, YYYY [at] h:mm A"),
      ]);
      excelData.push([
        "Request Window:",
        "8:30 AM to 4:30 PM (submission allowed during this time)",
      ]);
      excelData.push([
        "Total Short Leave Requests:",
        shortLeaveRequests.length,
      ]);
      excelData.push([]);
      excelData.push([]);

      // Add table headers
      excelData.push([
        "No.",
        "Intern Name",
        "Trainee ID",
        "National ID",
        "Leave Date",
        "Leave Time",
        "Purpose",
        "Reason",
        "Submitted At",
        "Status",
      ]);

      // Add intern data rows
      shortLeaveRequests.forEach((leave, index) => {
        excelData.push([
          index + 1,
          leave.internName || "N/A",
          leave.internTraineeId || "N/A",
          leave.nationalId || "N/A",
          moment(leave.leaveDate).format("MMM DD, YYYY"),
          leave.leaveTime || "N/A",
          leave.purpose || "N/A",
          leave.reason || "N/A",
          leave.submittedAt
            ? moment(leave.submittedAt)
                .utcOffset("+05:30")
                .format("MMM DD, YYYY [at] h:mm A")
            : "N/A",
          leave.status || "N/A",
        ]);
      });

      // Add summary section
      excelData.push([]);
      excelData.push([]);
      excelData.push(["SUMMARY"]);
      excelData.push([
        `These ${shortLeaveRequests.length} intern(s) have submitted short leave requests for today.`,
      ]);
      excelData.push([
        "These requests are pending admin approval (expected after 1:30 PM).",
      ]);

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // Set column widths
      worksheet["!cols"] = [
        { wch: 5 }, // No.
        { wch: 25 }, // Intern Name
        { wch: 15 }, // Trainee ID
        { wch: 15 }, // National ID
        { wch: 15 }, // Leave Date
        { wch: 12 }, // Leave Time
        { wch: 12 }, // Purpose
        { wch: 35 }, // Reason
        { wch: 25 }, // Submitted At
        { wch: 12 }, // Status
      ];

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Short Leave Requests");

      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, "..", "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const timestamp = moment()
        .utcOffset("+05:30")
        .format("YYYY-MM-DD_HH-mm-ss");
      const filename = `Short_Leave_Requests_${timestamp}.xlsx`;
      const filePath = path.join(tempDir, filename);

      // Write the Excel file
      XLSX.writeFile(workbook, filePath);
      console.log(`✅ Short leave Excel report generated: ${filename}`);
      return filePath;
    } catch (error) {
      console.error("❌ Error generating short leave Excel report:", error);
      throw error;
    }
  }

  /**
   * Send short leave requests email to the digital platforms team
   */
  static async sendShortLeaveRequestsEmail(shortLeaveRequests, recipientEmail) {
    let excelFilePath = null;

    try {
      if (!shortLeaveRequests || shortLeaveRequests.length === 0) {
        console.log(
          "📝 No short leave requests submitted today — skipping email",
        );
        return {
          success: true,
          skipped: true,
          reason: "No short leave requests today",
        };
      }

      console.log("📊 Generating short leave Excel report...");
      excelFilePath = this.generateShortLeaveRequestsExcel(shortLeaveRequests);

      const todayStr = moment().utcOffset("+05:30").format("MMM DD, YYYY");
      const subject = `📋 Short Leave Requests — ${shortLeaveRequests.length} Intern(s) — ${todayStr}`;

      // Build HTML table rows for interns (showing first 10 in email body)
      let tableRows = "";
      const displayLeaves = shortLeaveRequests.slice(0, 10);
      displayLeaves.forEach((leave, index) => {
        tableRows += `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 12px 8px; text-align: center; border-right: 1px solid #ddd;">${index + 1}</td>
            <td style="padding: 12px 8px; border-right: 1px solid #ddd;"><strong>${leave.internName}</strong></td>
            <td style="padding: 12px 8px; text-align: center; border-right: 1px solid #ddd;">${leave.internTraineeId || "N/A"}</td>
            <td style="padding: 12px 8px; text-align: center; border-right: 1px solid #ddd;">${leave.nationalId}</td>
            <td style="padding: 12px 8px; border-right: 1px solid #ddd;">${moment(leave.leaveDate).format("MMM DD, YYYY")}</td>
            <td style="padding: 12px 8px; text-align: center; border-right: 1px solid #ddd;">${leave.leaveTime}</td>
            <td style="padding: 12px 8px; border-right: 1px solid #ddd;">${leave.purpose}</td>
            <td style="padding: 12px 8px;">${leave.reason.substring(0, 50)}${leave.reason.length > 50 ? "..." : ""}</td>
          </tr>`;
      });

      // Add "see attached Excel" row if there are more than 10 interns
      if (shortLeaveRequests.length > 10) {
        tableRows += `
          <tr style="background-color: #cce5ff;">
            <td colspan="8" style="padding: 12px 8px; text-align: center;">
              <strong>📎 See attached Excel for all ${shortLeaveRequests.length} short leave requests</strong>
            </td>
          </tr>`;
      }

      const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .summary { background-color: #cce5ff; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0; }
    .actions { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
    .attachment-notice { background-color: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; }
    .footer { background-color: #343a40; color: white; padding: 15px; text-align: center; border-radius: 0 0 5px 5px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; background-color: white; }
    th { background-color: #007bff; color: white; padding: 12px 8px; text-align: left; font-weight: bold; }
    td { padding: 12px 8px; }
    tr:hover { background-color: #f5f5f5; }
    .badge { background-color: #007bff; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">📋 SHORT LEAVE REQUESTS REPORT</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px;">TalentHub Intern Management System — 1:30 PM Daily Summary</p>
    </div>
    <div class="content">
      <h2>Dear Digital Platforms Development Team,</h2>
      <div class="summary">
        <h3 style="margin-top: 0;">📊 Request Summary</h3>
        <p><strong>📅 Date:</strong> ${todayStr}</p>
        <p><strong>⏰ Request Window:</strong> 8:30 AM - 4:30 PM (Sri Lanka Time)</p>
        <p><strong>👥 Total Short Leave Requests:</strong> <span class="badge">${shortLeaveRequests.length}</span></p>
      </div>
      <div class="attachment-notice">
        <h3 style="margin-top: 0;">📎 Excel Attachment Included</h3>
        <p>A detailed Excel report for all short leave requests is attached.</p>
        <p><strong>Filename:</strong> ${path.basename(excelFilePath)}</p>
      </div>
      <h3>📋 Short Leave Requests (Preview — First ${displayLeaves.length})</h3>
      <div style="overflow-x: auto;">
        <table border="1" style="border: 1px solid #ddd;">
          <thead>
            <tr>
              <th style="text-align: center;">#</th>
              <th>Intern Name</th>
              <th style="text-align: center;">Trainee ID</th>
              <th style="text-align: center;">National ID</th>
              <th>Leave Date</th>
              <th style="text-align: center;">Leave Time</th>
              <th>Purpose</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <div class="actions">
        <h3 style="margin-top: 0;">⚡ Next Steps</h3>
        <ul>
          <li><strong>Admin:</strong> Already reviewed (1:00 PM - 1:30 PM approval window)</li>
          <li><strong>Gate Staff:</strong> Will receive approved list at 4:00 PM</li>
          <li><strong>Supervisors:</strong> Monitor intern attendance accordingly</li>
        </ul>
      </div>
      <p style="font-size: 14px; color: #666;">This is an automated daily report generated at 1:30 PM by the TalentHub system.</p>
      <p><strong>Best regards,</strong><br>SLT Mobitel — TalentHub Intern Management System<br>Digital Platforms Development Section</p>
    </div>
    <div class="footer">
      <p>📧 TO: ${recipientEmail}</p>
      <p>🕐 Generated: ${moment().utcOffset("+05:30").format("MMMM DD, YYYY [at] h:mm A")} (Sri Lanka Time)</p>
      <p>© ${moment().format("YYYY")} SLT Mobitel — All Rights Reserved</p>
    </div>
  </div>
</body>
</html>`.trim();

      // Create mail options with attachment
      const mailOptions = {
        from:
          process.env.SHORT_LEAVE_EMAIL ||
          "internship-management-systems@slt.com.lk",
        to: recipientEmail,
        subject,
        html: emailBody,
        attachments: [
          { filename: path.basename(excelFilePath), path: excelFilePath },
        ],
      };

      // Validate email configuration
      if (!process.env.SHORT_LEAVE_EMAIL) {
        throw new Error("Email config missing: SHORT_LEAVE_EMAIL not set");
      }

      // Configure transporter based on SMTP port
      const smtpPort = parseInt(process.env.SHORT_LEAVE_SMTP_PORT || "25");
      const smtpHost = process.env.SHORT_LEAVE_SMTP_HOST || "mail.slt.com.lk";

      const transportConfig = {
        host: smtpHost,
        port: smtpPort,
        secure: false, // true for 465, false for other ports
      };

      // Port 25 typically doesn't need authentication (internal relay)
      // Ports 587/465 require authentication
      if (smtpPort !== 25 && process.env.SHORT_LEAVE_EMAIL_PASS) {
        transportConfig.auth = {
          user: process.env.SHORT_LEAVE_EMAIL,
          pass: process.env.SHORT_LEAVE_EMAIL_PASS,
        };
        console.log(`📧 Using authenticated SMTP on port ${smtpPort}`);
      } else {
        console.log(`📧 Using passwordless SMTP relay on port ${smtpPort}`);
      }

      const transporter = nodemailer.createTransport(transportConfig);

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Short leave requests email sent! ID: ${info.messageId}`);

      // Clean up temp file
      if (fs.existsSync(excelFilePath)) {
        fs.unlinkSync(excelFilePath);
        console.log(`🗑️  Temp Excel file deleted`);
      }

      return {
        success: true,
        messageId: info.messageId,
        requestsCount: shortLeaveRequests.length,
        sentAt: moment().utcOffset("+05:30").format("YYYY-MM-DD HH:mm:ss"),
      };
    } catch (error) {
      console.error("❌ Failed to send short leave requests email:", error);
      if (excelFilePath && fs.existsSync(excelFilePath)) {
        try {
          fs.unlinkSync(excelFilePath);
        } catch (_) {}
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch today's short leave requests submitted so far and send email.
   * Called by the scheduler at 1 PM daily.
   * Note: Interns can submit from 8:30 AM - 4:30 PM throughout the day.
   */
  static async sendDailyShortLeaveReport() {
    const sriLankaNow = moment().utcOffset("+05:30");
    console.log("\n========================================");
    console.log("📧 1:30 PM SHORT LEAVE REQUESTS REPORT");
    console.log(
      `📅 Date: ${sriLankaNow.format("MMMM DD, YYYY [at] h:mm A")} (SLT)`,
    );
    console.log("========================================");

    try {
      const LeaveRequest = require("../models/LeaveRequest");

      // Build today's date range for Sri Lanka timezone
      const startOfDaySLT = sriLankaNow
        .clone()
        .startOf("day")
        .hour(8)
        .minute(30); // 8:30 AM today
      const endOfRequestWindow = sriLankaNow.clone().startOf("day").hour(13); // 1:00 PM today

      // Convert to UTC for the MongoDB query
      const startUTC = startOfDaySLT.clone().utc().toDate();
      const endUTC = endOfRequestWindow.clone().utc().toDate();

      // Get today's date for leave date matching (requests for TODAY)
      const todayStart = sriLankaNow.clone().startOf("day").utc().toDate();
      const todayEnd = sriLankaNow.clone().endOf("day").utc().toDate();

      console.log(
        `🔍 Querying short leave requests submitted between: ${startOfDaySLT.format("YYYY-MM-DD HH:mm")} - ${endOfRequestWindow.format("YYYY-MM-DD HH:mm")} (SLT)`,
      );
      console.log(
        `🔍 For leave date: ${sriLankaNow.format("YYYY-MM-DD")} (today)`,
      );

      // Query for leave requests submitted between 8:30 AM - 1:00 PM for TODAY's date
      const shortLeaveRequests = await LeaveRequest.find({
        requestType: "short_leave",
        submittedAt: { $gte: startUTC, $lte: endUTC },
        leaveDate: { $gte: todayStart, $lte: todayEnd },
      }).populate("reviewedBy", "email");

      console.log(
        `📊 Found ${shortLeaveRequests.length} short leave request(s) submitted so far today`,
      );

      // Recipient email group (configurable via environment variable)
      const recipientEmail =
        process.env.SHORT_LEAVE_RECIPIENT || "digitalplatformsdev@slt.com.lk";

      const result = await this.sendShortLeaveRequestsEmail(
        shortLeaveRequests,
        recipientEmail,
      );

      if (result.success && !result.skipped) {
        console.log(
          `✅ Short leave report sent to ${recipientEmail} — ${result.requestsCount} request(s) included`,
        );
      } else if (result.skipped) {
        console.log(`📭 Short leave report skipped — ${result.reason}`);
      } else {
        console.log(`❌ Short leave report failed — ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error("❌ Fatal error in sendDailyShortLeaveReport:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ShortLeaveEmailService;
