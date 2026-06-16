const nodemailer = require("nodemailer");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const moment = require("moment");

class ApprovedLeaveNotificationService {
  /**
   * Generate Excel file with approved leave details
   */
  static generateApprovedLeavesExcel(approvedLeaves) {
    try {
      // Prepare data for Excel
      const excelData = [];

      excelData.push(["APPROVED SHORT LEAVE REQUESTS"]);
      excelData.push(["TalentHub Intern Management System"]);
      excelData.push([]);
      excelData.push([
        "Report Generated:",
        moment().utcOffset("+05:30").format("MMMM DD, YYYY [at] h:mm A"),
      ]);
      excelData.push(["Total Approved Interns:", approvedLeaves.length]);
      excelData.push([]);
      excelData.push([]);

      // Add table headers
      excelData.push([
        "No.",
        "Intern Name",
        "National ID",
        "Leave Date",
        "Leave Time",
        "Purpose",
        "Reason",
        "Approved At",
        "Approved By",
      ]);

      // Add intern data rows
      approvedLeaves.forEach((leave, index) => {
        excelData.push([
          index + 1,
          leave.internName || "N/A",
          leave.nationalId || "N/A",
          moment(leave.leaveDate).format("MMM DD, YYYY"),
          leave.leaveTime || "N/A",
          leave.purpose || "N/A",
          leave.reason || "N/A",
          leave.reviewedAt
            ? moment(leave.reviewedAt)
                .utcOffset("+05:30")
                .format("MMM DD, YYYY [at] h:mm A")
            : "N/A",
          leave.reviewedBy?.email || "N/A",
        ]);
      });

      // Add summary section
      excelData.push([]);
      excelData.push([]);
      excelData.push(["SUMMARY"]);
      excelData.push([
        `These ${approvedLeaves.length} intern(s) have been approved for short leave.`,
      ]);
      excelData.push(["Gate staff should be notified accordingly."]);

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // Set column widths
      worksheet["!cols"] = [
        { wch: 5 }, // No.
        { wch: 25 }, // Intern Name
        { wch: 15 }, // National ID
        { wch: 15 }, // Leave Date
        { wch: 12 }, // Leave Time
        { wch: 12 }, // Purpose
        { wch: 35 }, // Reason
        { wch: 25 }, // Approved At
        { wch: 30 }, // Approved By
      ];

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Approved Leaves");

      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, "..", "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const timestamp = moment()
        .utcOffset("+05:30")
        .format("YYYY-MM-DD_HH-mm-ss");
      const filename = `Approved_Short_Leaves_${timestamp}.xlsx`;
      const filePath = path.join(tempDir, filename);

      // Write the Excel file
      XLSX.writeFile(workbook, filePath);
      console.log(`✅ Excel report generated: ${filename}`);
      return filePath;
    } catch (error) {
      console.error("❌ Error generating Excel report:", error);
      throw error;
    }
  }

  /**
   * Build and return the Gmail nodemailer transporter.
   * Reads credentials from GMAIL_USER / GMAIL_PASS env vars.
   */
  static _createTransporter() {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_PASS;

    if (!gmailUser || !gmailPass) {
      throw new Error(
        "Email config missing: GMAIL_USER and/or GMAIL_PASS not set",
      );
    }

    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass, // Gmail App Password (16-char, spaces allowed)
      },
      // Generous timeouts for Azure-hosted environments
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    });
  }

  /**
   * Send the consolidated daily email.
   * Called by the scheduler at 1:30 PM AND when the manual send button is triggered.
   */
  static async sendApprovedLeavesEmail(
    approvedLeaves,
    recipientEmails,
    triggeredBy = "scheduler",
  ) {
    let excelFilePath = null;

    try {
      if (!approvedLeaves || approvedLeaves.length === 0) {
        console.log("📭 No approved leaves for today — skipping email");
        return {
          success: true,
          skipped: true,
          reason: "No approved leaves today",
        };
      }

      console.log("📊 Generating Excel report...");
      excelFilePath = this.generateApprovedLeavesExcel(approvedLeaves);

      const todayStr = moment().utcOffset("+05:30").format("MMM DD, YYYY");
      const subject = "Approved Intern Short Leave Report";

      // Build HTML table rows for interns (showing first 10 in email body)
      let tableRows = "";
      const displayLeaves = approvedLeaves.slice(0, 10);
      displayLeaves.forEach((leave, index) => {
        tableRows += `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 12px 8px; text-align: center; border-right: 1px solid #ddd;">${index + 1}</td>
            <td style="padding: 12px 8px; border-right: 1px solid #ddd;"><strong>${leave.internName}</strong></td>
            <td style="padding: 12px 8px; text-align: center; border-right: 1px solid #ddd;">${leave.nationalId}</td>
            <td style="padding: 12px 8px; border-right: 1px solid #ddd;">${moment(leave.leaveDate).format("MMM DD, YYYY")}</td>
            <td style="padding: 12px 8px; text-align: center; border-right: 1px solid #ddd;">${leave.leaveTime}</td>
            <td style="padding: 12px 8px; border-right: 1px solid #ddd;">${leave.purpose}</td>
            <td style="padding: 12px 8px;">${leave.reason.substring(0, 50)}${leave.reason.length > 50 ? "..." : ""}</td>
          </tr>`;
      });

      // Add "see attached Excel" row if there are more than 10 interns
      if (approvedLeaves.length > 10) {
        tableRows += `
          <tr style="background-color: #d4edda;">
            <td colspan="7" style="padding: 12px 8px; text-align: center;">
              <strong>📎 See attached Excel for all ${approvedLeaves.length} approved interns</strong>
            </td>
          </tr>`;
      }
      const reportTime =
        triggeredBy === "scheduler"
          ? "1:30 PM"
          : moment().utcOffset("+05:30").format("h:mm A");
      const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .summary { background-color: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; }
    .actions { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
    .attachment-notice { background-color: #cce5ff; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0; }
    .footer { background-color: #343a40; color: white; padding: 15px; text-align: center; border-radius: 0 0 5px 5px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; background-color: white; }
    th { background-color: #28a745; color: white; padding: 12px 8px; text-align: left; font-weight: bold; }
    td { padding: 12px 8px; }
    tr:hover { background-color: #f5f5f5; }
    .badge { background-color: #28a745; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">✅ DAILY APPROVED SHORT LEAVE REPORT</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px;">TalentHub Intern Management System — 1:30 PM Summary</p>
    </div>
    <div class="content">
      <h2>Dear Gate Staff & Team,</h2>
      <div class="summary">
        <h3 style="margin-top: 0;">📊 Daily Summary</h3>
        <p><strong>📅 Date:</strong> ${todayStr}</p>
        <p><strong>⏰ Report Time:</strong> ${reportTime} (Sri Lanka Time)</p>
        <p><strong>👥 Total Approved Interns Today:</strong> <span class="badge">${approvedLeaves.length}</span></p>
      </div>
      <div class="attachment-notice">
        <h3 style="margin-top: 0;">📎 Excel Attachment Included</h3>
        <p>A detailed Excel report for all approved interns is attached.</p>
        <p><strong>Filename:</strong> ${path.basename(excelFilePath)}</p>
      </div>
      <h3>📋 Approved Interns (Preview — First ${displayLeaves.length})</h3>
      <div style="overflow-x: auto;">
        <table border="1" style="border: 1px solid #ddd;">
          <thead>
            <tr>
              <th style="text-align: center;">#</th>
              <th>Intern Name</th>
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
        <h3 style="margin-top: 0;">⚡ Required Actions</h3>
        <ul>
          <li><strong>Gate Staff:</strong> Allow the listed interns to exit at their specified leave times</li>
          <li><strong>Supervisors:</strong> Note intern absences during specified times</li>
          <li><strong>HR:</strong> Record approved leaves in the attendance system</li>
        </ul>
      </div>
      <p style="font-size: 14px; color: #666;">This is an automated daily report generated at 1:30 PM by the TalentHub system.</p>
      <p><strong>Best regards,</strong><br>SLT Mobitel — TalentHub System<br>Digital Platforms Development Section</p>
    </div>
    <div class="footer">
      <p>📧 TO: ${recipientEmails.to.join(", ")}</p>
      <p>CC: ${recipientEmails.cc.join(", ")}</p>
      <p>🕐 Generated: ${moment().utcOffset("+05:30").format("MMMM DD, YYYY [at] h:mm A")} (Sri Lanka Time)</p>
      <p>© ${moment().format("YYYY")} SLT Mobitel — All Rights Reserved</p>
    </div>
  </div>
</body>
</html>`.trim();

      // Create mail options with attachment
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: recipientEmails.to.join(", "),
        cc: recipientEmails.cc.join(", "),
        subject,
        html: emailBody,
        attachments: [
          { filename: path.basename(excelFilePath), path: excelFilePath },
        ],
      };

      // Build Gmail transporter (validates env vars internally)
      const transporter = this._createTransporter();

      // Send email with timeout wrapper
      const emailPromise = transporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Email sending timeout after 45 seconds")),
          45000,
        ),
      );

      const info = await Promise.race([emailPromise, timeoutPromise]);
      console.log(`Daily approved leaves email sent! ID: ${info.messageId}`);

      if (fs.existsSync(excelFilePath)) {
        fs.unlinkSync(excelFilePath);
        console.log(`🗑️  Temp Excel file deleted`);
      }

      return {
        success: true,
        messageId: info.messageId,
        internsCount: approvedLeaves.length,
        sentAt: moment().utcOffset("+05:30").format("YYYY-MM-DD HH:mm:ss"),
      };
    } catch (error) {
      console.error("❌ Failed to send daily approved leaves email:", error);
      if (excelFilePath && fs.existsSync(excelFilePath)) {
        try {
          fs.unlinkSync(excelFilePath);
        } catch (_) {}
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch today's approved leaves from DB and send the daily email.
   * Called by the scheduler at 1:30 PM AND by the manual send button.
   */
  static async sendDailyReport(triggeredBy = "scheduler") {
    const sriLankaNow = moment().utcOffset("+05:30");
    console.log("\n========================================");
    console.log("📧 1:30 PM DAILY APPROVED LEAVES REPORT");
    console.log(
      `📅 Date: ${sriLankaNow.format("MMMM DD, YYYY [at] h:mm A")} (SLT)`,
    );
    console.log("========================================");

    try {
      const LeaveRequest = require("../models/LeaveRequest");

      // Build today's date range in UTC (accounting for Sri Lanka UTC+5:30)
      const startOfDaySLT = sriLankaNow.clone().startOf("day");
      const endOfDaySLT = sriLankaNow.clone().endOf("day");

      // Convert to UTC for the MongoDB query
      const startUTC = startOfDaySLT.clone().utc().toDate();
      const endUTC = endOfDaySLT.clone().utc().toDate();

      console.log(
        `🔍 Querying approved leaves for: ${startOfDaySLT.format("YYYY-MM-DD")} (SLT)`,
      );

      const approvedLeaves = await LeaveRequest.find({
        status: "Approved",
        requestType: "short_leave",
        reviewedAt: { $gte: startUTC, $lte: endUTC },
      }).populate("reviewedBy", "email");

      console.log(`📊 Found ${approvedLeaves.length} approved leave(s) today`);

      // ── Recipient list ────────────────────────────────────────────────────────
      // Sending via Gmail (GMAIL_USER / GMAIL_PASS) — Azure-compatible
      const recipientEmails = {
        to: ["mgiri@slt.com.lk"],
        cc: ["dimalshacooray@gmail.com"],
      };
      // ─────────────────────────────────────────────────────────────────────────

      const result = await this.sendApprovedLeavesEmail(
        approvedLeaves,
        recipientEmails,
        triggeredBy,
      );

      if (result.success && !result.skipped) {
        console.log(
          `✅ Daily report sent — ${result.internsCount} intern(s) included`,
        );
      } else if (result.skipped) {
        console.log(`📭 Daily report skipped — ${result.reason}`);
      } else {
        console.log(`❌ Daily report failed — ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error("❌ Fatal error in sendDailyReport:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ApprovedLeaveNotificationService;
