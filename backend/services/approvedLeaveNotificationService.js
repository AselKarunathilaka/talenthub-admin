const nodemailer = require("nodemailer");
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

class ApprovedLeaveNotificationService {
  /**
   * Check if current time is after 12 PM (noon) in Sri Lanka timezone
   * Set BYPASS_TIME_CHECK=true in .env to disable time restriction for testing
   */
  static isAfter12PM() {
    // Allow bypass for testing
    if (process.env.BYPASS_TIME_CHECK === 'true') {
      console.log('⚠️  TIME CHECK BYPASSED (BYPASS_TIME_CHECK=true)');
      return true;
    }
    
    const sriLankanTime = moment().utcOffset('+05:30');
    const currentHour = sriLankanTime.hour();
    const currentMinute = sriLankanTime.minute();
    
    console.log(`🕐 Time check details:`);
    console.log(`   Sri Lankan time: ${sriLankanTime.format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`   Current hour: ${currentHour}`);
    console.log(`   Current minute: ${currentMinute}`);
    console.log(`   Is >= 12: ${currentHour >= 12}`);
    
    return currentHour >= 12;
  }

  /**
   * Generate Excel file with approved leave details
   */
  static generateApprovedLeavesExcel(approvedLeaves) {
    try {
      // Prepare data for Excel
      const excelData = [];
      
      // Add header information
      excelData.push(['APPROVED SHORT LEAVE REQUESTS']);
      excelData.push(['TalentHub Intern Management System']);
      excelData.push([]);
      excelData.push(['Report Generated:', moment().format('MMMM DD, YYYY [at] h:mm A')]);
      excelData.push(['Total Approved Interns:', approvedLeaves.length]);
      excelData.push([]);
      excelData.push([]);

      // Add table headers
      excelData.push([
        'No.',
        'Intern Name',
        'National ID',
        'Leave Date',
        'Leave Time',
        'Purpose',
        'Reason',
        'Approved At',
        'Approved By'
      ]);

      // Add intern data rows
      approvedLeaves.forEach((leave, index) => {
        excelData.push([
          index + 1,
          leave.internName || 'N/A',
          leave.nationalId || 'N/A',
          moment(leave.leaveDate).format('MMM DD, YYYY'),
          leave.leaveTime || 'N/A',
          leave.purpose || 'N/A',
          leave.reason || 'N/A',
          leave.reviewedAt ? moment(leave.reviewedAt).format('MMM DD, YYYY [at] h:mm A') : 'N/A',
          leave.reviewedBy?.email || 'N/A'
        ]);
      });

      // Add summary section
      excelData.push([]);
      excelData.push([]);
      excelData.push(['SUMMARY']);
      excelData.push([`These ${approvedLeaves.length} intern(s) have been approved for short leave.`]);
      excelData.push(['Gate staff should be notified accordingly.']);

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // Set column widths
      worksheet['!cols'] = [
        { wch: 5 },   // No.
        { wch: 25 },  // Intern Name
        { wch: 15 },  // National ID
        { wch: 15 },  // Leave Date
        { wch: 12 },  // Leave Time
        { wch: 12 },  // Purpose
        { wch: 35 },  // Reason
        { wch: 25 },  // Approved At
        { wch: 30 }   // Approved By
      ];

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Approved Leaves');

      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Generate filename with timestamp
      const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
      const filename = `Approved_Short_Leaves_${timestamp}.xlsx`;
      const filePath = path.join(tempDir, filename);

      // Write the Excel file
      XLSX.writeFile(workbook, filePath);

      console.log(`✅ Approved leaves Excel report generated: ${filename}`);
      return filePath;

    } catch (error) {
      console.error('❌ Error generating approved leaves Excel report:', error);
      throw error;
    }
  }

  /**
   * Send email with approved leaves Excel attachment
   */
  static async sendApprovedLeavesEmail(approvedLeaves, recipientEmails) {
    let excelFilePath = null;

    try {
      if (approvedLeaves.length === 0) {
        console.log('✅ No approved leaves to send - skipping email');
        return {
          success: true,
          skipped: true,
          reason: 'No approved leaves'
        };
      }

      // Check if it's after 12 PM
      if (!this.isAfter12PM()) {
        console.log('⏰ Current time is before 12 PM - skipping email notification');
        return {
          success: true,
          skipped: true,
          reason: 'Before 12 PM - email not sent'
        };
      }

      // Generate Excel file
      console.log('📊 Generating approved leaves Excel report...');
      excelFilePath = this.generateApprovedLeavesExcel(approvedLeaves);

      const subject = `✅ Approved Short Leave Notification - ${approvedLeaves.length} Intern(s) - ${moment().format('MMM DD, YYYY')}`;
      
      // Build HTML table rows for interns (showing first 10 in email body)
      let tableRows = '';
      const displayLeaves = approvedLeaves.slice(0, 10);
      displayLeaves.forEach((leave, index) => {
        tableRows += `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 12px 8px; text-align: center; border-right: 1px solid #ddd;">${index + 1}</td>
            <td style="padding: 12px 8px; border-right: 1px solid #ddd;"><strong>${leave.internName}</strong></td>
            <td style="padding: 12px 8px; text-align: center; border-right: 1px solid #ddd;">${leave.nationalId}</td>
            <td style="padding: 12px 8px; border-right: 1px solid #ddd;">${moment(leave.leaveDate).format('MMM DD, YYYY')}</td>
            <td style="padding: 12px 8px; text-align: center; border-right: 1px solid #ddd;">${leave.leaveTime}</td>
            <td style="padding: 12px 8px; border-right: 1px solid #ddd;">${leave.purpose}</td>
            <td style="padding: 12px 8px;">${leave.reason.substring(0, 50)}${leave.reason.length > 50 ? '...' : ''}</td>
          </tr>`;
      });

      // Add "see attached Excel" row if there are more than 10 interns
      if (approvedLeaves.length > 10) {
        tableRows += `
          <tr style="background-color: #d4edda;">
            <td colspan="7" style="padding: 12px 8px; text-align: center;">
              <strong>📎 See attached Excel file for complete list of all ${approvedLeaves.length} approved interns</strong>
            </td>
          </tr>`;
      }

      // Build HTML email body
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
      <h1 style="margin: 0;">✅ APPROVED SHORT LEAVE NOTIFICATION</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px;">TalentHub Intern Management System</p>
    </div>
    
    <div class="content">
      <h2>Dear Team,</h2>
      
      <div class="summary">
        <h3 style="margin-top: 0;">📊 Approval Summary</h3>
        <p><strong>📅 Date:</strong> ${moment().format('MMMM DD, YYYY')}</p>
        <p><strong>⏰ Time:</strong> ${moment().format('h:mm A')}</p>
        <p><strong>👥 Total Approved Interns:</strong> <span class="badge">${approvedLeaves.length}</span></p>
      </div>

      <div class="attachment-notice">
        <h3 style="margin-top: 0;">📎 Excel Attachment Included</h3>
        <p>A detailed Excel report with all approved intern leave details is attached to this email.</p>
        <p><strong>Filename:</strong> ${path.basename(excelFilePath)}</p>
        <p>The Excel file contains complete information for all ${approvedLeaves.length} approved intern(s).</p>
      </div>
      
      <h3>📋 Approved Interns (Preview - First ${displayLeaves.length})</h3>
      <p>The following interns have been <strong>APPROVED</strong> for short leave today:</p>
      
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
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      
      <div class="actions">
        <h3 style="margin-top: 0;">⚡ Required Actions</h3>
        <ul style="margin: 10px 0;">
          <li><strong>Gate Staff:</strong> Please allow the listed interns to exit at their specified leave times</li>
          <li><strong>Supervisors:</strong> Be aware of intern absences during specified times</li>
          <li><strong>HR:</strong> Record these approved leaves in the attendance system</li>
          <li>Review the attached Excel file for complete details and proof documents (if any)</li>
        </ul>
      </div>
      
      <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
      
      <p style="font-size: 14px; color: #666;">
        This is an automated notification generated by the TalentHub Intern Management System.<br>
        For questions or concerns, please contact the admin or system administrator.
      </p>
      
      <p style="margin-top: 20px;">
        <strong>Best regards,</strong><br>
        SLT Mobitel - TalentHub System<br>
        Digital Platforms Development Section
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 5px 0;">📧 This email was sent to: ${recipientEmails.to.join(', ')}</p>
      <p style="margin: 5px 0;">CC: ${recipientEmails.cc.join(', ')}</p>
      <p style="margin: 5px 0;">🕐 Generated: ${moment().format('MMMM DD, YYYY [at] h:mm A')}</p>
      <p style="margin: 5px 0;">© ${moment().format('YYYY')} SLT Mobitel - All Rights Reserved</p>
    </div>
  </div>
</body>
</html>
      `.trim();

      // Create mail options with attachment
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: recipientEmails.to.join(', '),
        cc: recipientEmails.cc.join(', '),
        subject: subject,
        html: emailBody,
        attachments: [
          {
            filename: path.basename(excelFilePath),
            path: excelFilePath
          }
        ]
      };

      // Validate email configuration
      if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
        throw new Error('Email configuration missing: GMAIL_USER or GMAIL_PASS not set in environment variables');
      }

      console.log(`📧 Sending email from: ${process.env.GMAIL_USER}`);
      console.log(`📧 Sending to: ${recipientEmails.to.join(', ')}`);
      console.log(`📧 CC: ${recipientEmails.cc.join(', ')}`);

      // Send email using transporter
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
      });

      console.log(`📧 Transporter created, sending email...`);
      const info = await transporter.sendMail(mailOptions);
      
      console.log(`✅ Approved leaves notification email sent successfully!`);
      console.log(`📧 Email ID: ${info.messageId}`);
      console.log(`📎 Attachment: ${path.basename(excelFilePath)}`);
      console.log(`📊 Interns listed: ${approvedLeaves.length}`);
      console.log(`👥 Recipients: ${recipientEmails.to.length} TO, ${recipientEmails.cc.length} CC`);

      // Clean up: Delete the temporary Excel file after sending
      if (fs.existsSync(excelFilePath)) {
        fs.unlinkSync(excelFilePath);
        console.log(`🗑️  Temporary Excel file deleted: ${path.basename(excelFilePath)}`);
      }
      
      return {
        success: true,
        messageId: info.messageId,
        recipients: recipientEmails,
        internsCount: approvedLeaves.length,
        attachmentName: path.basename(excelFilePath),
        sentAt: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ Failed to send approved leaves notification email:`, error);
      
      // Clean up Excel file on error too
      if (excelFilePath && fs.existsSync(excelFilePath)) {
        try {
          fs.unlinkSync(excelFilePath);
          console.log(`🗑️  Cleaned up Excel file after error`);
        } catch (cleanupError) {
          console.error(`⚠️  Could not delete temp file: ${cleanupError.message}`);
        }
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Main function to process and send approved leaves notification
   */
  static async notifyApprovedLeaves(approvedLeaves) {
    const startTime = new Date();
    console.log('\n� ========================================');
    console.log('📧 APPROVED LEAVES NOTIFICATION SERVICE');
    console.log('========================================');
    console.log(`📅 Current time: ${moment().format('MMMM DD, YYYY [at] h:mm A')}`);
    console.log(`⏰ After 12 PM check: ${this.isAfter12PM() ? 'YES ✅' : 'NO ❌'}`);
    console.log(`📊 Approved leaves count: ${approvedLeaves.length}`);

    try {
      // Validate input
      if (!approvedLeaves || approvedLeaves.length === 0) {
        console.log('⚠️  No approved leaves provided');
        return {
          success: true,
          skipped: true,
          reason: 'No approved leaves to notify'
        };
      }

      // Define recipient emails
      const recipientEmails = {
        to: [
          'tharushi.20232322@iit.ac.lk',
          'tharushicooray1@gmail.com',
          'dimalshacooray@gmail.com',
          'lakindu.20221402@iit.ac.lk'
        ],
        cc: [
          'lakindunaveesha263@gmail.com'
        ]
      };

      console.log(`📧 Recipients configured:`);
      console.log(`   TO: ${recipientEmails.to.join(', ')}`);
      console.log(`   CC: ${recipientEmails.cc.join(', ')}`);

      // Send email with Excel attachment
      console.log(`\n🚀 Initiating email send process...`);
      const emailResult = await this.sendApprovedLeavesEmail(approvedLeaves, recipientEmails);
      
      if (emailResult.success && !emailResult.skipped) {
        console.log(`\n✅ ========================================`);
        console.log(`✅ EMAIL SENT SUCCESSFULLY!`);
        console.log(`========================================`);
        console.log(`📊 Interns included: ${emailResult.internsCount}`);
        console.log(`📎 Attachment: ${emailResult.attachmentName}`);
        console.log(`📧 Message ID: ${emailResult.messageId}`);
        console.log(`⏰ Sent at: ${emailResult.sentAt}`);
        console.log(`========================================\n`);
      } else if (emailResult.skipped) {
        console.log(`\n⏭️  ========================================`);
        console.log(`⏭️  EMAIL SKIPPED`);
        console.log(`========================================`);
        console.log(`📝 Reason: ${emailResult.reason}`);
        console.log(`========================================\n`);
      } else {
        console.log(`\n❌ ========================================`);
        console.log(`❌ EMAIL FAILED`);
        console.log(`========================================`);
        console.log(`📝 Error: ${emailResult.error}`);
        console.log(`========================================\n`);
      }

      const endTime = new Date();
      return {
        ...emailResult,
        executionTime: endTime.getTime() - startTime.getTime()
      };

    } catch (error) {
      console.error('\n❌ ========================================');
      console.error('❌ FATAL ERROR IN NOTIFICATION SERVICE');
      console.error('========================================');
      console.error('Error details:', error);
      console.error('Stack trace:', error.stack);
      console.error('========================================\n');
      
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }
}

module.exports = ApprovedLeaveNotificationService;
