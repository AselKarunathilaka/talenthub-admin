/**
 * Production Test Script for Weekly Non-Submission Check
 * Sends the non-submission report directly to mgiri@slt.com.lk for manager review
 * 
 * Run this script to verify the report before full production deployment:
 * node backend/scripts/sendWeeklyNonSubmissionToManager.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const moment = require('moment');
const nodemailer = require("nodemailer");
const DailyRecord = require("../models/DailyRecord");
const Intern = require("../models/Intern");

const MANAGER_EMAIL = 'mgiri@slt.com.lk';

class WeeklyNonSubmissionToManager {
  /**
   * Check if an intern has submitted daily logs for the past 5 working days
   */
  static async hasSubmittedLogsForPastWeek(internId) {
    try {
      const workingDays = [];
      let daysCount = 0;
      let currentDay = moment();

      while (daysCount < 5) {
        currentDay = currentDay.subtract(1, 'day');
        const dayOfWeek = currentDay.day();
        
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workingDays.push(currentDay.format('YYYY-MM-DD'));
          daysCount++;
        }
      }

      const logsCount = await DailyRecord.countDocuments({
        internId: internId,
        date: { $in: workingDays }
      });

      return logsCount > 0;
    } catch (error) {
      console.error(`Error checking logs for intern ${internId}:`, error);
      return false;
    }
  }

  static getInternName(intern) {
    return intern.Trainee_Name || intern.traineeName || 'Unknown';
  }

  static getInternId(intern) {
    return intern.Trainee_ID || intern.traineeId || 'Unknown';
  }

  static getInternEmail(intern) {
    return intern.Trainee_Email || intern.email || '';
  }

  static async getActiveInterns() {
    try {
      const currentDate = new Date();
      
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
   * Send email to manager with non-submission report
   */
  static async sendManagerEmail(nonSubmittedInterns) {
    try {
      if (nonSubmittedInterns.length === 0) {
        console.log('✅ All interns have submitted logs - no email to send');
        return {
          success: true,
          skipped: true,
          reason: 'All interns have submitted logs'
        };
      }

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
      
      workingDays.reverse();

      // Build table rows
      let tableRows = '';
      nonSubmittedInterns.forEach((intern, index) => {
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

      const subject = `⚠️ Weekly Logbook Non-Submission Alert - ${nonSubmittedInterns.length} Interns - ${moment().format('MMM DD, YYYY')}`;
      
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
      
      <h3>📋 Non-Submitting Interns (Past 5 Working Days)</h3>
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
          <li><strong>Interns who DID NOT submit logs:</strong> ${nonSubmittedInterns.length} (listed above)</li>
        </ul>
      </div>
      
      <div class="actions">
        <h3 style="margin-top: 0;">⚡ Recommended Actions</h3>
        <ul style="margin: 10px 0;">
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
      <p style="margin: 5px 0;">📧 Recipient: Mr. Giridharan (mgiri@slt.com.lk)</p>
      <p style="margin: 5px 0;">🕐 Generated: ${moment().format('MMMM DD, YYYY [at] h:mm A')}</p>
      <p style="margin: 5px 0;">© ${moment().format('YYYY')} SLT Mobitel - All Rights Reserved</p>
    </div>
  </div>
</body>
</html>
      `.trim();

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: MANAGER_EMAIL,
        subject: subject,
        html: emailBody
      };

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
      });

      const info = await transporter.sendMail(mailOptions);
      
      console.log(`\n✅ Email sent to ${MANAGER_EMAIL}`);
      console.log(`📧 Email ID: ${info.messageId}`);
      console.log(`📊 Interns listed: ${nonSubmittedInterns.length}`);
      
      return {
        success: true,
        messageId: info.messageId,
        recipient: MANAGER_EMAIL,
        internsCount: nonSubmittedInterns.length
      };

    } catch (error) {
      console.error(`❌ Failed to send email:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Main execution
   */
  static async run() {
    const startTime = new Date();
    console.log('\n📧 Sending Weekly Non-Submission Report to Manager');
    console.log(`📅 Sent at: ${moment().format('MMMM DD, YYYY [at] h:mm A')}\n`);

    try {
      console.log("📦 Connecting to MongoDB...");
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("✅ Connected to MongoDB\n");

      const activeInterns = await this.getActiveInterns();
      console.log(`👥 Found ${activeInterns.length} active interns to check\n`);

      const results = {
        total: activeInterns.length,
        submitted: 0,
        notSubmitted: 0,
        nonSubmittedList: []
      };

      console.log("🔍 Checking logbook submissions for past 5 working days...\n");

      for (const intern of activeInterns) {
        const internName = this.getInternName(intern);
        const internId = this.getInternId(intern);
        const internEmail = this.getInternEmail(intern);

        const hasSubmitted = await this.hasSubmittedLogsForPastWeek(intern._id);
        
        if (hasSubmitted) {
          results.submitted++;
        } else {
          results.notSubmitted++;
          
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
        }
      }

      console.log('📊 RESULTS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📋 Total interns checked: ${results.total}`);
      console.log(`✅ Submitted logs: ${results.submitted}`);
      console.log(`❌ Did NOT submit logs: ${results.notSubmitted}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Send email to manager
      const emailResult = await this.sendManagerEmail(results.nonSubmittedList);
      
      if (!emailResult.success) {
        console.log(`❌ Failed: ${emailResult.error}\n`);
      }

      const endTime = new Date();
      const executionTime = endTime.getTime() - startTime.getTime();

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ REPORT SENT TO MANAGER');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`⏱️  Execution Time: ${executionTime}ms`);
      console.log(`📧 Recipient: ${MANAGER_EMAIL}`);
      console.log(`📊 Non-submitting interns: ${results.notSubmitted}\n`);

    } catch (error) {
      console.error('\n❌ Error:');
      console.error(error);
    } finally {
      await mongoose.connection.close();
      console.log("📦 MongoDB connection closed\n");
      process.exit(0);
    }
  }
}

// Run immediately
WeeklyNonSubmissionToManager.run();
