const DailyRecord = require('../models/DailyRecord');
const Intern = require('../models/Intern');
const ComplianceCheck = require('../models/ComplianceCheck');
const sendEmail = require('../utils/emailSender');
const moment = require('moment');
const nodemailer = require("nodemailer");

class WeeklyWorkLogService {
  /**
   * Check if intern has submitted work logs for the previous week
   * Returns true if logs exist, false otherwise
   */
  static async hasWorkLogsForPreviousWeek(internId) {
    try {
      // Get previous week's date range (Monday to Friday)
      const previousWeekStart = moment().subtract(1, 'week').startOf('isoWeek');
      const previousWeekEnd = moment().subtract(1, 'week').endOf('isoWeek').subtract(2, 'days'); // Friday
      
      // Check for any daily records in the previous week
      const workLogs = await DailyRecord.find({
        internId: internId,
        date: {
          $gte: previousWeekStart.format('YYYY-MM-DD'),
          $lte: previousWeekEnd.format('YYYY-MM-DD')
        }
      });

      return workLogs.length > 0;
    } catch (error) {
      console.error('Error checking work logs for intern:', internId, error);
      return false;
    }
  }

  /**
   * Check if intern is within 4-week grace period from training start date
   */
  static isWithinGracePeriod(trainingStartDate) {
    if (!trainingStartDate) return false;
    
    const fourWeeksAgo = moment().subtract(4, 'weeks');
    const startDate = moment(trainingStartDate);
    
    return startDate.isAfter(fourWeeksAgo);
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
   * Get training start date (supports both API-style and legacy fields)
   */
  static getTrainingStartDate(intern) {
    return intern.Training_StartDate || intern.trainingStartDate;
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
   * Send consolidated report email to supervisors with all non-compliant interns
   */
  static async sendConsolidatedReportEmail(nonCompliantList, previousWeekStart, previousWeekEnd) {
    try {
      if (nonCompliantList.length === 0) {
        console.log('✅ No non-compliant interns - no email to send');
        return {
          success: true,
          skipped: true,
          reason: 'No non-compliant interns'
        };
      }

      // Supervisors email addresses
      const supervisorEmails = 'mgiri@slt.com.lk,jana@slt.com.lk';
      
      // Separate new and regular interns
      const newInterns = nonCompliantList.filter(i => i.isNewIntern);
      const regularInterns = nonCompliantList.filter(i => !i.isNewIntern);

      const subject = `⚠️ Weekly Compliance Report - ${nonCompliantList.length} Interns Without Daily Records - Week of ${previousWeekStart.format('MMM DD, YYYY')}`;
      
      // Build email body
      let emailBody = `
Dear Supervisors,

WEEKLY WORK LOG COMPLIANCE REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Week Checked: ${previousWeekStart.format('MMMM DD')} - ${previousWeekEnd.format('MMMM DD, YYYY')}
📊 Total Non-Compliant Interns: ${nonCompliantList.length}
🆕 New Interns (Grace Period): ${newInterns.length}
⚠️  Regular Interns: ${regularInterns.length}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The following interns have NOT submitted any daily work logs for the previous week:
`;

      // Add new interns section
      if (newInterns.length > 0) {
        emailBody += `

🆕 NEW INTERNS (Within 4-Week Grace Period):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
        newInterns.forEach((intern, index) => {
          emailBody += `
${index + 1}. ${intern.name} (${intern.id})
   📧 Email: ${intern.email}
   🎓 Field: ${intern.fieldOfSpecialization}
   🏫 Institute: ${intern.institute}
   � Team: ${intern.team}
   📅 Start Date: ${intern.trainingStartDate}
   ⏰ Status: ${intern.gracePeriodStatus}
`;
        });
      }

      // Add regular interns section
      if (regularInterns.length > 0) {
        emailBody += `

⚠️ REGULAR INTERNS (Past Grace Period):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
        regularInterns.forEach((intern, index) => {
          emailBody += `
${index + 1}. ${intern.name} (${intern.id})
   📧 Email: ${intern.email}
   🎓 Field: ${intern.fieldOfSpecialization}
   🏫 Institute: ${intern.institute}
   👥 Team: ${intern.team}
   📅 Start Date: ${intern.trainingStartDate}
   ⏰ Status: ${intern.gracePeriodStatus}
`;
        });
      }

      emailBody += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 SUMMARY:
• Total interns checked: Visible in system logs
• Compliant interns: Have submitted daily records
• Non-compliant interns: ${nonCompliantList.length} (listed above)

⚡ RECOMMENDED ACTIONS:
${regularInterns.length > 0 ? `• Follow up with regular interns regarding non-compliance\n• Consider termination proceedings if pattern continues` : ''}
${newInterns.length > 0 ? `• Monitor new interns and remind them of daily log requirements\n• Provide additional guidance during grace period` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is an automated report generated by the TalentHub Intern Management System.
For questions or concerns, please review the system logs or contact the system administrator.

Best regards,
SLT Mobitel - TalentHub System
Digital Platforms Development Section

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
� Generated on: ${moment().format('MMMM DD, YYYY [at] h:mm A')}
📧 Recipients: Mr. Giridharan (mgiri@slt.com.lk), Mr. Janaka (jana@slt.com.lk)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `.trim();

      // Create mail options
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: supervisorEmails,
        subject: subject,
        text: emailBody
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
      
      console.log(`✅ Consolidated report email sent to supervisors`);
      console.log(`📧 Recipients: ${supervisorEmails}`);
      console.log(`📧 Email ID: ${info.messageId}`);
      console.log(`📊 Interns listed: ${nonCompliantList.length} (${newInterns.length} new, ${regularInterns.length} regular)`);
      
      return {
        success: true,
        messageId: info.messageId,
        recipients: supervisorEmails,
        internsCount: nonCompliantList.length,
        newInternsCount: newInterns.length,
        regularInternsCount: regularInterns.length
      };

    } catch (error) {
      console.error(`❌ Failed to send consolidated report email:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Main function to check all interns and send consolidated report to supervisors
   */
  static async performWeeklyCheck(triggerType = 'scheduled') {
    const startTime = new Date();
    console.log('\n🔍 Starting weekly work log compliance check...');
    console.log(`📅 Checking period: ${moment().subtract(1, 'week').startOf('isoWeek').format('MMMM DD')} - ${moment().subtract(1, 'week').endOf('isoWeek').subtract(2, 'days').format('MMMM DD, YYYY')}`);

    // Week period for database logging
    const previousWeekStart = moment().subtract(1, 'week').startOf('isoWeek');
    const previousWeekEnd = moment().subtract(1, 'week').endOf('isoWeek').subtract(2, 'days');

    try {
      const activeInterns = await this.getActiveInterns();
      console.log(`👥 Found ${activeInterns.length} active interns to check`);

      const results = {
        total: activeInterns.length,
        compliant: 0,
        nonCompliantNew: 0,
        nonCompliantRegular: 0,
        emailSent: false,
        emailMessageId: null,
        emailError: null,
        errors: [],
        nonCompliantList: [] // Detailed list of non-compliant interns
      };

      // Check each intern
      for (const intern of activeInterns) {
        try {
          const internName = this.getInternName(intern);
          const internId = this.getInternId(intern);
          const internEmail = this.getInternEmail(intern);
          const trainingStartDate = this.getTrainingStartDate(intern);
          
          // Check if intern is within grace period
          const isNewIntern = this.isWithinGracePeriod(trainingStartDate);

          // Check if intern has work logs for previous week
          const hasLogs = await this.hasWorkLogsForPreviousWeek(intern._id);
          
          if (hasLogs) {
            results.compliant++;
          } else {
            // Add to non-compliant list with detailed information
            const nonCompliantInfo = {
              internId: intern._id,
              name: internName,
              id: internId,
              email: internEmail,
              fieldOfSpecialization: intern.field_of_spec_name || 'Not specified',
              institute: intern.Institute || 'Not specified',
              team: intern.team || 'Not specified',
              trainingStartDate: trainingStartDate ? moment(trainingStartDate).format('YYYY-MM-DD') : 'Not specified',
              isNewIntern: isNewIntern,
              gracePeriodStatus: isNewIntern ? 'Within 4-week grace period' : 'Regular intern'
            };
            results.nonCompliantList.push(nonCompliantInfo);
            
            if (isNewIntern) {
              results.nonCompliantNew++;
              console.log(`⚠️  [NEW INTERN] ${internName} (${internId}) has NO work logs`);
            } else {
              results.nonCompliantRegular++;
              console.log(`❌ [REGULAR] ${internName} (${internId}) has NO work logs`);
            }
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

      // Send consolidated email to supervisors if there are non-compliant interns
      if (results.nonCompliantList.length > 0) {
        console.log(`\n📧 Sending consolidated report to supervisors...`);
        const emailResult = await this.sendConsolidatedReportEmail(
          results.nonCompliantList,
          previousWeekStart,
          previousWeekEnd
        );
        
        if (emailResult.success) {
          results.emailSent = true;
          results.emailMessageId = emailResult.messageId;
          console.log(`✅ Email sent successfully to supervisors`);
        } else {
          results.emailSent = false;
          results.emailError = emailResult.error;
          console.log(`❌ Failed to send email to supervisors: ${emailResult.error}`);
        }
      }

      // Generate summary with detailed listing
      console.log('\n📊 WEEKLY COMPLIANCE CHECK SUMMARY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📋 Total interns checked: ${results.total}`);
      console.log(`✅ Compliant (has logs): ${results.compliant}`);
      console.log(`⚠️  Non-compliant (new interns in grace period): ${results.nonCompliantNew}`);
      console.log(`❌ Non-compliant (regular interns): ${results.nonCompliantRegular}`);
      console.log(`📧 Consolidated report sent: ${results.emailSent ? 'YES' : 'NO'}`);
      console.log(`⚠️  Processing errors: ${results.errors.length}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (results.nonCompliantList.length > 0) {
        console.log('\n📋 DETAILED LIST OF NON-COMPLIANT INTERNS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Group by status
        const newInterns = results.nonCompliantList.filter(i => i.isNewIntern);
        const regularInterns = results.nonCompliantList.filter(i => !i.isNewIntern);
        
        if (newInterns.length > 0) {
          console.log('\n🆕 NEW INTERNS (Grace Period):');
          newInterns.forEach((intern, index) => {
            console.log(`\n  ${index + 1}. ${intern.name} (${intern.id})`);
            console.log(`     📧 Email: ${intern.email}`);
            console.log(`     🎓 Field: ${intern.fieldOfSpecialization}`);
            console.log(`     🏫 Institute: ${intern.institute}`);
            console.log(`     👥 Team: ${intern.team}`);
            console.log(`     📅 Start Date: ${intern.trainingStartDate}`);
            console.log(`     ⏰ Status: ${intern.gracePeriodStatus}`);
          });
        }
        
        if (regularInterns.length > 0) {
          console.log('\n⚠️  REGULAR INTERNS (Past Grace Period):');
          regularInterns.forEach((intern, index) => {
            console.log(`\n  ${index + 1}. ${intern.name} (${intern.id})`);
            console.log(`     📧 Email: ${intern.email}`);
            console.log(`     🎓 Field: ${intern.fieldOfSpecialization}`);
            console.log(`     🏫 Institute: ${intern.institute}`);
            console.log(`     👥 Team: ${intern.team}`);
            console.log(`     📅 Start Date: ${intern.trainingStartDate}`);
            console.log(`     ⏰ Status: ${intern.gracePeriodStatus}`);
          });
        }
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }

      console.log('\n✅ Weekly compliance check completed!\n');

      // Save audit log to database
      const endTime = new Date();
      const complianceCheck = new ComplianceCheck({
        checkDate: startTime,
        weekChecked: {
          startDate: previousWeekStart.format('YYYY-MM-DD'),
          endDate: previousWeekEnd.format('YYYY-MM-DD')
        },
        triggerType: triggerType,
        results: {
          totalInterns: results.total,
          compliantInterns: results.compliant,
          nonCompliantNewInterns: results.nonCompliantNew,
          nonCompliantRegularInterns: results.nonCompliantRegular,
          terminatedInterns: results.nonCompliantRegular,
          emailSent: results.emailSent,
          emailMessageId: results.emailMessageId,
          emailError: results.emailError,
          processingErrors: results.errors,
          nonCompliantDetails: results.nonCompliantList
        },
        executionTime: {
          startedAt: startTime,
          completedAt: endTime,
          durationMs: endTime.getTime() - startTime.getTime()
        },
        status: results.errors.length === 0 ? 'success' : 'partial_success'
      });

      await complianceCheck.save();

      return {
        ...results,
        auditLogId: complianceCheck._id,
        executionTime: endTime.getTime() - startTime.getTime()
      };

    } catch (error) {
      console.error('❌ Fatal error during weekly check:', error);
      
      // Try to save error audit log
      try {
        const endTime = new Date();
        const errorLog = new ComplianceCheck({
          checkDate: startTime,
          weekChecked: {
            startDate: previousWeekStart.format('YYYY-MM-DD'),
            endDate: previousWeekEnd.format('YYYY-MM-DD')
          },
          triggerType: triggerType,
          results: {
            totalInterns: 0,
            compliantInterns: 0,
            nonCompliantNewInterns: 0,
            nonCompliantRegularInterns: 0,
            terminatedInterns: 0,
            emailSent: false,
            processingErrors: [{
              error: error.message,
              occurredAt: new Date()
            }]
          },
          executionTime: {
            startedAt: startTime,
            completedAt: endTime,
            durationMs: endTime.getTime() - startTime.getTime()
          },
          status: 'failed'
        });
        
        await errorLog.save();
      } catch (auditError) {
        console.error('❌ Failed to save error audit log:', auditError);
      }

      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = WeeklyWorkLogService;