const DailyRecord = require('../models/DailyRecord');
const Intern = require('../models/Intern');
const ComplianceCheck = require('../models/ComplianceCheck');
const sendEmail = require('../utils/emailSender');
const moment = require('moment');

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
              { trainingStartDate: { $lte: currentDate } },
              { trainingStartDate: { $exists: false } }
            ]
          },
          {
            $or: [
              { trainingEndDate: { $gte: currentDate } },
              { trainingEndDate: { $exists: false } }
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
   * Send termination email to intern and supervisors
   */
  static async sendTerminationEmail(intern) {
    try {
      const internEmail = intern.email;
      const supervisorEmails = 'jana@slt.com.lk,mgiri@slt.com.lk';
      const ccEmails = supervisorEmails;

      const subject = `URGENT: Internship Termination Notice - ${intern.traineeName} (${intern.traineeId})`;
      
      const emailBody = `
Dear ${intern.traineeName},

INTERNSHIP TERMINATION NOTICE

We have detected that you have not submitted any work logs for the previous week (${moment().subtract(1, 'week').startOf('isoWeek').format('MMMM DD')} - ${moment().subtract(1, 'week').endOf('isoWeek').subtract(2, 'days').format('MMMM DD, YYYY')}).

As per company policy, consistent work log submission is mandatory for all interns. Due to non-compliance with this requirement, your internship is hereby terminated effective immediately.

Intern Details:
- Name: ${intern.traineeName}
- Trainee ID: ${intern.traineeId}
- Field of Specialization: ${intern.fieldOfSpecialization}
- Training Start Date: ${intern.trainingStartDate ? moment(intern.trainingStartDate).format('MMMM DD, YYYY') : 'Not specified'}
- Institute: ${intern.institute || 'Not specified'}
- Team: ${intern.team || 'Not specified'}

If you believe this is an error or have any questions, please contact your supervisors immediately.

Best regards,
SLT Mobitel
Digital Platforms Development Section

---
Supervisors: Mr. Janaka, Mr. Giridaran
Generated on: ${moment().format('MMMM DD, YYYY [at] h:mm A')}
      `.trim();

      // Create mail options with CC
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: internEmail,
        cc: ccEmails,
        subject: subject,
        text: emailBody
      };

      // Send email using existing transporter
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransporter({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
      });

      const info = await transporter.sendMail(mailOptions);
      
      console.log(`✅ Termination email sent to ${intern.traineeName} (${intern.traineeId})`);
      console.log(`📧 Email ID: ${info.messageId}`);
      
      return {
        success: true,
        messageId: info.messageId,
        intern: {
          name: intern.traineeName,
          id: intern.traineeId,
          email: internEmail
        }
      };

    } catch (error) {
      console.error(`❌ Failed to send termination email to ${intern.traineeName}:`, error);
      return {
        success: false,
        error: error.message,
        intern: {
          name: intern.traineeName,
          id: intern.traineeId,
          email: intern.email
        }
      };
    }
  }

  /**
   * Main function to check all interns and send termination emails
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
        gracePeriod: 0,
        terminated: 0,
        emailsSent: [],
        emailsFailed: [],
        errors: []
      };

      for (const intern of activeInterns) {
        try {
          // Check if intern is within grace period
          if (this.isWithinGracePeriod(intern.trainingStartDate)) {
            results.gracePeriod++;
            continue;
          }

          // Check if intern has work logs for previous week
          const hasLogs = await this.hasWorkLogsForPreviousWeek(intern._id);
          
          if (hasLogs) {
            results.compliant++;
          } else {
            console.log(`❌ ${intern.traineeName} (${intern.traineeId}) has NO work logs - sending termination email`);
            
            // Send termination email
            const emailResult = await this.sendTerminationEmail(intern);
            
            if (emailResult.success) {
              results.emailsSent.push({
                internId: intern._id,
                internName: intern.traineeName,
                traineeId: intern.traineeId,
                email: intern.email,
                emailId: emailResult.messageId,
                sentAt: new Date()
              });
              results.terminated++;
            } else {
              results.emailsFailed.push({
                internId: intern._id,
                internName: intern.traineeName,
                traineeId: intern.traineeId,
                email: intern.email,
                error: emailResult.error,
                attemptedAt: new Date()
              });
            }
          }

        } catch (error) {
          console.error(`❌ Error processing intern ${intern.traineeName}:`, error);
          results.errors.push({
            internId: intern._id,
            internName: intern.traineeName,
            traineeId: intern.traineeId,
            error: error.message,
            occurredAt: new Date()
          });
        }
      }

      // Generate summary
      console.log('\n📊 WEEKLY COMPLIANCE CHECK SUMMARY');
      console.log('=====================================');
      console.log(`Total interns checked: ${results.total}`);
      console.log(`Compliant (has logs): ${results.compliant}`);
      console.log(`Grace period: ${results.gracePeriod}`);
      console.log(`Terminated: ${results.terminated}`);
      console.log(`Email failures: ${results.emailsFailed.length}`);
      console.log(`Processing errors: ${results.errors.length}`);

      if (results.emailsSent.length > 0) {
        console.log('\n📧 Termination emails sent to:');
        results.emailsSent.forEach(intern => {
          console.log(`  - ${intern.name} (${intern.id}) - ${intern.email}`);
        });
      }

      if (results.emailsFailed.length > 0) {
        console.log('\n❌ Failed to send emails to:');
        results.emailsFailed.forEach(failed => {
          console.log(`  - ${failed.intern.name} (${failed.intern.id}): ${failed.error}`);
        });
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
          gracePeriodInterns: results.gracePeriod,
          terminatedInterns: results.terminated,
          emailsSent: results.emailsSent,
          emailsFailed: results.emailsFailed,
          processingErrors: results.errors
        },
        executionTime: {
          startedAt: startTime,
          completedAt: endTime,
          durationMs: endTime.getTime() - startTime.getTime()
        },
        status: results.errors.length === 0 ? 'success' : (results.emailsSent.length > 0 ? 'partial_success' : 'failed')
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
            gracePeriodInterns: 0,
            terminatedInterns: 0,
            emailsSent: [],
            emailsFailed: [],
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