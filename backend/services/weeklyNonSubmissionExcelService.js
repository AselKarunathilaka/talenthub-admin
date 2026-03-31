const DailyRecord = require('../models/DailyRecord');
const Intern = require('../models/Intern');
const nodemailer = require("nodemailer");
const moment = require('moment');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

class WeeklyNonSubmissionExcelService {
  /**
   * Check if an intern has submitted daily logs for the past 5 working days
   * Returns true if at least one log exists for the 5-day period
   */
  static async hasSubmittedLogsForPastWeek(internId) {
    try {
      // Get the past 5 working days (Monday to Friday)
      const workingDays = [];
      let daysCount = 0;
      let currentDay = moment();

      // Go back and collect 5 working days (excluding weekends)
      while (daysCount < 5) {
        currentDay = currentDay.subtract(1, 'day');
        const dayOfWeek = currentDay.day();
        
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workingDays.push(currentDay.format('YYYY-MM-DD'));
          daysCount++;
        }
      }

      // Check if intern has submitted any logs in these 5 working days
      const logsCount = await DailyRecord.countDocuments({
        internId: internId,
        date: { $in: workingDays }
      });

      return logsCount > 0;
    } catch (error) {
      console.error(`Error checking logs for intern ${internId}:`, error);
      return false; // Assume no logs on error
    }
  }

  /**
   * Get intern name (supports both API-style and legacy fields)
   */
  static getInternName(intern) {
    return intern.Trainee_Name || intern.traineeName || 'Unknown';
  }

  /**
   * Get intern ID (supports both API-style and legacy fields)
   */
  static getInternId(intern) {
    return intern.Trainee_ID || intern.traineeId || 'Unknown';
  }

  /**
   * Get intern email (supports both API-style and legacy fields)
   */
  static getInternEmail(intern) {
    return intern.Trainee_Email || intern.email || '';
  }

  /**
   * Get all active interns who should be monitored
   */
  static async getActiveInterns() {
    try {
      const currentDate = new Date();
      
      // Get interns whose training period is active
      const activeInterns = await Intern.find({
        $and: [
          {
            $or: [
              { Training_StartDate: { $lte: currentDate } },
              { Training_StartDate: { $exists: false } }
            ]
          },
          {
            $or: [
              { Training_EndDate: { $gte: currentDate } },
              { Training_EndDate: { $exists: false } }
            ]
          }
        ]
      });

      return activeInterns;
    } catch (error) {
      console.error('Error fetching active interns:', error);
      return [];
    }
  }

  /**
   * Generate Excel file from non-submitted interns data
   * Returns the file path to the generated Excel file
   */
  static generateExcelReport(nonSubmittedInterns) {
    try {
      // Get the past 5 working days for reference
      const workingDays = [];
      let daysCount = 0;
      let currentDay = moment();
      
      while (daysCount < 5) {
        currentDay = currentDay.subtract(1, 'day');
        const dayOfWeek = currentDay.day();
        
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workingDays.push(currentDay.format('MMM DD, YYYY'));
          daysCount++;
        }
      }
      
      workingDays.reverse(); // Display in chronological order

      // Prepare data for Excel
      const excelData = [];
      
      // Add header information
      excelData.push(['WEEKLY LOGBOOK NON-SUBMISSION REPORT']);
      excelData.push(['TalentHub Intern Management System']);
      excelData.push([]);
      excelData.push(['Report Generated:', moment().format('MMMM DD, YYYY [at] h:mm A')]);
      excelData.push(['Week Period:', `${workingDays[0]} - ${workingDays[4]}`]);
      excelData.push(['Total Non-Submitting Interns:', nonSubmittedInterns.length]);
      excelData.push([]);
      excelData.push([]);

      // Add table headers
      excelData.push([
        'No.',
        'Intern Name',
        'Trainee ID',
        'Email Address',
        'Field of Specialization',
        'Institute',
        'Team',
        'Training Start Date',
        'Training End Date'
      ]);

      // Add intern data rows
      nonSubmittedInterns.forEach((intern, index) => {
        excelData.push([
          index + 1,
          intern.name,
          intern.id,
          intern.email,
          intern.fieldOfSpecialization,
          intern.institute,
          intern.team,
          intern.trainingStartDate,
          intern.trainingEndDate
        ]);
      });

      // Add summary section
      excelData.push([]);
      excelData.push([]);
      excelData.push(['SUMMARY']);
      excelData.push(['These interns have NOT submitted any daily logbook entries for the past 5 working days.']);
      excelData.push(['Immediate follow-up action is recommended.']);

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // Set column widths
      worksheet['!cols'] = [
        { wch: 5 },   // No.
        { wch: 25 },  // Intern Name
        { wch: 15 },  // Trainee ID
        { wch: 30 },  // Email
        { wch: 25 },  // Field of Specialization
        { wch: 30 },  // Institute
        { wch: 20 },  // Team
        { wch: 20 },  // Training Start Date
        { wch: 20 }   // Training End Date
      ];

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Non-Submission Report');

      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Generate filename with timestamp
      const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
      const filename = `Weekly_Non_Submission_Report_${timestamp}.xlsx`;
      const filePath = path.join(tempDir, filename);

      // Write the Excel file
      XLSX.writeFile(workbook, filePath);

      console.log(`✅ Excel report generated: ${filename}`);
      return filePath;

    } catch (error) {
      console.error('❌ Error generating Excel report:', error);
      throw error;
    }
  }

  /**
   * Send email with Excel attachment
   * @param {Array} nonSubmittedInterns - List of interns who haven't submitted logs
   * @param {Array|String} recipients - Email recipient(s) - can be array ['email1@example.com', 'email2@example.com'] or comma-separated string
   */
  static async sendNonSubmissionEmailWithExcel(nonSubmittedInterns, recipients = 'mgiri@slt.com.lk') {
    let excelFilePath = null;

    try {
      if (nonSubmittedInterns.length === 0) {
        console.log('✅ All interns have submitted logs - no email to send');
        return {
          success: true,
          skipped: true,
          reason: 'All interns have submitted logs'
        };
      }

      // Convert recipients to comma-separated string if it's an array
      const recipientEmail = Array.isArray(recipients) ? recipients.join(', ') : recipients;
      const recipientList = Array.isArray(recipients) ? recipients : [recipients];
      console.log(`📧 Recipients: ${recipientList.join(', ')}`);

      // Generate Excel file
      console.log('📊 Generating Excel report...');
      excelFilePath = this.generateExcelReport(nonSubmittedInterns);

      // Get the past 5 working days for reference
      const workingDays = [];
      let daysCount = 0;
      let currentDay = moment();
      
      while (daysCount < 5) {
        currentDay = currentDay.subtract(1, 'day');
        const dayOfWeek = currentDay.day();
        
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workingDays.push(currentDay.format('MMM DD, YYYY'));
          daysCount++;
        }
      }
      
      workingDays.reverse(); // Display in chronological order

      const subject = `⚠️ Weekly Logbook Non-Submission Alert - ${nonSubmittedInterns.length} Interns - ${moment().format('MMM DD, YYYY')}`;
      
      // Build HTML table rows for interns (showing first 10 in email body)
      let tableRows = '';
      const displayInterns = nonSubmittedInterns.slice(0, 10);
      displayInterns.forEach((intern, index) => {
        tableRows += `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 12px 8px; text-align: center; border-right: 1px solid #ddd;">${index + 1}</td>
            <td style="padding: 12px 8px; border-right: 1px solid #ddd;"><strong>${intern.name}</strong></td>
            <td style="padding: 12px 8px; text-align: center; border-right: 1px solid #ddd;">${intern.id}</td>
            <td style="padding: 12px 8px; border-right: 1px solid #ddd;">${intern.email}</td>
            <td style="padding: 12px 8px; border-right: 1px solid #ddd;">${intern.fieldOfSpecialization}</td>
            <td style="padding: 12px 8px; border-right: 1px solid #ddd;">${intern.institute}</td>
            <td style="padding: 12px 8px; border-right: 1px solid #ddd;">${intern.team}</td>
            <td style="padding: 12px 8px;">${intern.trainingStartDate} to ${intern.trainingEndDate}</td>
          </tr>`;
      });

      // Add "see attached Excel" row if there are more than 10 interns
      if (nonSubmittedInterns.length > 10) {
        tableRows += `
          <tr style="background-color: #fff3cd;">
            <td colspan="8" style="padding: 12px 8px; text-align: center;">
              <strong>📎 See attached Excel file for complete list of all ${nonSubmittedInterns.length} interns</strong>
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
    .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .summary { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
    .actions { background-color: #d1ecf1; padding: 15px; border-left: 4px solid #17a2b8; margin: 20px 0; }
    .attachment-notice { background-color: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; }
    .footer { background-color: #343a40; color: white; padding: 15px; text-align: center; border-radius: 0 0 5px 5px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; background-color: white; }
    th { background-color: #2c3e50; color: white; padding: 12px 8px; text-align: left; font-weight: bold; }
    td { padding: 12px 8px; }
    tr:hover { background-color: #f5f5f5; }
    .badge { background-color: #d32f2f; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">⚠️ WEEKLY LOGBOOK NON-SUBMISSION ALERT</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px;">TalentHub Intern Management System</p>
    </div>
    
    <div class="content">
      <h2>Dear Mr. Giridharan,</h2>
      
      <div class="summary">
        <h3 style="margin-top: 0;">📊 Report Summary</h3>
        <p><strong>📅 Week Period:</strong> ${workingDays[0]} - ${workingDays[4]}</p>
        <p><strong>📊 Total Non-Submitting Interns:</strong> <span class="badge">${nonSubmittedInterns.length}</span></p>
        <p><strong>⏰ Generated On:</strong> ${moment().format('MMMM DD, YYYY [at] h:mm A')}</p>
      </div>

      <div class="attachment-notice">
        <h3 style="margin-top: 0;">📎 Excel Attachment Included</h3>
        <p>A detailed Excel report with all non-submitting interns is attached to this email.</p>
        <p><strong>Filename:</strong> ${path.basename(excelFilePath)}</p>
        <p>The Excel file contains complete information for all ${nonSubmittedInterns.length} interns who have not submitted logs.</p>
      </div>
      
      <h3>📋 Non-Submitting Interns (Preview - First ${displayInterns.length})</h3>
      <p>The following interns have <strong>NOT</strong> submitted any daily logbook entries for the past 5 working days:</p>
      
      <div style="overflow-x: auto;">
        <table border="1" style="border: 1px solid #ddd;">
          <thead>
            <tr>
              <th style="text-align: center;">#</th>
              <th>Intern Name</th>
              <th style="text-align: center;">ID</th>
              <th>Email</th>
              <th>Field of Specialization</th>
              <th>Institute</th>
              <th>Team</th>
              <th>Training Period</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      
      <div class="summary">
        <h3 style="margin-top: 0;">📋 Summary</h3>
        <ul style="margin: 10px 0;">
          <li><strong>Total active interns:</strong> Visible in system logs</li>
          <li><strong>Interns who submitted logs:</strong> Compliant with logbook requirements</li>
          <li><strong>Interns who DID NOT submit logs:</strong> ${nonSubmittedInterns.length} (see attached Excel file)</li>
        </ul>
      </div>
      
      <div class="actions">
        <h3 style="margin-top: 0;">⚡ Recommended Actions</h3>
        <ul style="margin: 10px 0;">
          <li>Review the attached Excel file for complete details</li>
          <li>Follow up with non-submitting interns immediately</li>
          <li>Remind them of the daily logbook submission requirement</li>
          <li>Consider disciplinary action for repeated non-compliance</li>
        </ul>
      </div>
      
      <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
      
      <p style="font-size: 14px; color: #666;">
        This is an automated weekly report generated by the TalentHub Intern Management System.<br>
        For questions or concerns, please review the system logs or contact the system administrator.
      </p>
      
      <p style="margin-top: 20px;">
        <strong>Best regards,</strong><br>
        SLT Mobitel - TalentHub System<br>
        Digital Platforms Development Section
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 5px 0;">📧 Recipients: ${recipientList.join(', ')}</p>
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
        to: recipientEmail,
        subject: subject,
        html: emailBody,
        attachments: [
          {
            filename: path.basename(excelFilePath),
            path: excelFilePath
          }
        ]
      };

      // Send email using transporter
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
      });

      const info = await transporter.sendMail(mailOptions);
      
      console.log(`✅ Non-submission alert email sent to ${recipientList.length} recipient(s)`);
      recipientList.forEach(email => console.log(`   📧 ${email}`));
      console.log(`📧 Email ID: ${info.messageId}`);
      console.log(`📎 Attachment: ${path.basename(excelFilePath)}`);
      console.log(`📊 Interns listed: ${nonSubmittedInterns.length}`);

      // Clean up: Delete the temporary Excel file after sending
      if (fs.existsSync(excelFilePath)) {
        fs.unlinkSync(excelFilePath);
        console.log(`🗑️  Temporary Excel file deleted: ${path.basename(excelFilePath)}`);
      }
      
      return {
        success: true,
        messageId: info.messageId,
        recipients: recipientList,
        recipientCount: recipientList.length,
        internsCount: nonSubmittedInterns.length,
        attachmentName: path.basename(excelFilePath)
      };

    } catch (error) {
      console.error(`❌ Failed to send non-submission alert email:`, error);
      
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
   * Main function to check all interns and send alert with Excel attachment
   * @param {Array|String} recipients - Email recipient(s) - can be array or comma-separated string
   * @param {String} triggerType - Type of trigger ('scheduled' or 'manual')
   */
  static async performWeeklyNonSubmissionCheckWithExcel(recipients = 'mgiri@slt.com.lk', triggerType = 'scheduled') {
    const startTime = new Date();
    console.log('\n🔍 Starting weekly logbook non-submission check (with Excel attachment)...');
    console.log(`📅 Checking past 5 working days from: ${moment().format('MMMM DD, YYYY')}`);

    try {
      const activeInterns = await this.getActiveInterns();
      console.log(`👥 Found ${activeInterns.length} active interns to check`);

      const results = {
        total: activeInterns.length,
        submitted: 0,
        notSubmitted: 0,
        emailSent: false,
        emailMessageId: null,
        emailError: null,
        errors: [],
        nonSubmittedList: [] // Detailed list of non-submitting interns
      };

      // Check each intern
      for (const intern of activeInterns) {
        try {
          const internName = this.getInternName(intern);
          const internId = this.getInternId(intern);
          const internEmail = this.getInternEmail(intern);

          // Check if intern has submitted logs for past 5 working days
          const hasSubmitted = await this.hasSubmittedLogsForPastWeek(intern._id);
          
          if (hasSubmitted) {
            results.submitted++;
            console.log(`✅ ${internName} (${internId}) - has submitted logs`);
          } else {
            results.notSubmitted++;
            
            // Add to non-submitted list with detailed information
            const nonSubmittedInfo = {
              internId: intern._id,
              name: internName,
              id: internId,
              email: internEmail,
              fieldOfSpecialization: intern.field_of_spec_name || 'Not specified',
              institute: intern.Institute || 'Not specified',
              team: intern.team || 'Not specified',
              trainingStartDate: intern.Training_StartDate ? moment(intern.Training_StartDate).format('MMM DD, YYYY') : 'Not specified',
              trainingEndDate: intern.Training_EndDate ? moment(intern.Training_EndDate).format('MMM DD, YYYY') : 'Not specified'
            };
            
            results.nonSubmittedList.push(nonSubmittedInfo);
            console.log(`❌ ${internName} (${internId}) - NO logs submitted for past 5 working days`);
          }

        } catch (error) {
          const internName = this.getInternName(intern);
          const internId = this.getInternId(intern);
          console.error(`❌ Error processing intern ${internName}:`, error);
          results.errors.push({
            internId: intern._id,
            internName: internName,
            traineeId: internId,
            error: error.message,
            occurredAt: new Date()
          });
        }
      }

      // Send email with Excel attachment
      const recipientList = Array.isArray(recipients) ? recipients : [recipients];
      console.log(`\n📧 Sending alert with Excel attachment to ${recipientList.length} recipient(s)...`);
      const emailResult = await this.sendNonSubmissionEmailWithExcel(results.nonSubmittedList, recipients);
      
      if (emailResult.success) {
        results.emailSent = true;
        results.emailMessageId = emailResult.messageId;
        results.attachmentName = emailResult.attachmentName;
        if (!emailResult.skipped) {
          console.log(`✅ Alert email with Excel attachment sent successfully`);
        }
      } else {
        results.emailSent = false;
        results.emailError = emailResult.error;
        console.log(`❌ Failed to send alert email: ${emailResult.error}`);
      }

      // Generate summary
      console.log('\n📊 WEEKLY NON-SUBMISSION CHECK SUMMARY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📋 Total interns checked: ${results.total}`);
      console.log(`✅ Submitted logs (past 5 working days): ${results.submitted}`);
      console.log(`❌ Did NOT submit logs: ${results.notSubmitted}`);
      console.log(`📧 Alert email sent: ${results.emailSent ? 'YES' : 'NO'}`);
      console.log(`📎 Excel attachment: ${results.attachmentName || 'N/A'}`);
      console.log(`⚠️  Processing errors: ${results.errors.length}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (results.nonSubmittedList.length > 0) {
        console.log('\n📋 DETAILED LIST OF NON-SUBMITTING INTERNS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        results.nonSubmittedList.forEach((intern, index) => {
          console.log(`\n  ${index + 1}. ${intern.name} (${intern.id})`);
          console.log(`     📧 Email: ${intern.email}`);
          console.log(`     🎓 Field: ${intern.fieldOfSpecialization}`);
          console.log(`     🏫 Institute: ${intern.institute}`);
          console.log(`     👥 Team: ${intern.team}`);
          console.log(`     📅 Training: ${intern.trainingStartDate} - ${intern.trainingEndDate}`);
        });
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }

      console.log('\n✅ Weekly non-submission check with Excel attachment completed!\n');

      const endTime = new Date();
      return {
        ...results,
        executionTime: endTime.getTime() - startTime.getTime(),
        triggerType: triggerType
      };

    } catch (error) {
      console.error('❌ Fatal error during weekly non-submission check:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = WeeklyNonSubmissionExcelService;
