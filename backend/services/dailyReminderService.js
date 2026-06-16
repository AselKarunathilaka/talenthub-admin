const DailyRecord = require('../models/DailyRecord');
const Intern = require('../models/Intern');
const sendEmail = require('../utils/emailSender');
const moment = require('moment-timezone');

class DailyReminderService {
  // Return interns whose training period includes today (Asia/Colombo)
  static async getActiveInternsForToday() {
    const now = moment.tz('Asia/Colombo').toDate();

    // Query using canonical API-style fields; if some docs miss them, the $exists branch covers
    const interns = await Intern.find({
      $and: [
        {
          $or: [
            { Training_StartDate: { $lte: now } },
            { Training_StartDate: { $exists: false } }
          ]
        },
        {
          $or: [
            { Training_EndDate: { $gte: now } },
            { Training_EndDate: { $exists: false } }
          ]
        }
      ]
    }).lean();

    return interns;
  }

  // Build a Set of internIds who already submitted a record today (string date in DailyRecord)
  static async getInternIdsWithTodayRecord() {
    const todayStr = moment.tz('Asia/Colombo').format('YYYY-MM-DD');

    const todaysRecords = await DailyRecord.find({ date: todayStr }).select('internId').lean();
    const ids = new Set(todaysRecords.map(r => r.internId?.toString()).filter(Boolean));
    return ids;
  }

  static getInternEmail(intern) {
    // Prefer canonical API field
    return intern.Trainee_Email || intern.email || '';
  }

  static getInternName(intern) {
    return intern.Trainee_Name || intern.traineeName || 'Intern';
  }

  static getTraineeId(intern) {
    return intern.Trainee_ID || intern.traineeId || '';
  }

  static async sendReminderEmail(intern) {
    const email = this.getInternEmail(intern);
    if (!email) return { sent: false, reason: 'no_email' };

    const name = this.getInternName(intern);
    const traineeId = this.getTraineeId(intern);
    const todayDisplay = moment.tz('Asia/Colombo').format('MMMM DD, YYYY');

    const subject = 'Reminder: Please submit your daily work log';
    const body = `
Dear ${name},

This is a friendly reminder to submit your daily work log for ${todayDisplay}.

Submitting your log helps your supervisors track progress and provide timely support.

Trainee ID: ${traineeId}
Portal: https://talenthub.slt.lk/

If you are on leave or working from home, please record it in your daily log accordingly.

Thank you,
SLT Mobitel
Digital Platforms Development Section
    `.trim();

    try {
      await sendEmail(email, subject, body);
      return { sent: true };
    } catch (e) {
      // emailSender logs errors itself; return failure info
      return { sent: false, reason: e.message };
    }
  }

  // Run daily reminder process
  static async runDailyReminder(triggerType = 'scheduled', { dryRun = false, includeWeekends = false, sampleSize = 0 } = {}) {
    const start = Date.now();
    const tzNow = moment.tz('Asia/Colombo');
    const todayStr = tzNow.format('YYYY-MM-DD');

    // Skip weekends by default (isoWeekday: 6=Saturday, 7=Sunday)
    const dow = tzNow.isoWeekday();
    if (!includeWeekends && (dow === 6 || dow === 7)) {
      console.log(`⛔ Daily reminder skipped (weekend) for ${todayStr} [trigger=${triggerType}]`);
      return { success: true, skipped: true, reason: 'weekend', date: todayStr };
    }

    try {
      const [activeInterns, submittedIds] = await Promise.all([
        this.getActiveInternsForToday(),
        this.getInternIdsWithTodayRecord()
      ]);

      // Filter interns without a record today
      const pending = activeInterns.filter(i => !submittedIds.has(i._id?.toString()));

      // Minimal logging per user request
      console.log(`📬 Daily reminder (${triggerType}) for ${todayStr}: active=${activeInterns.length}, submitted=${submittedIds.size}, pending=${pending.length}`);

      const results = {
        date: todayStr,
        trigger: triggerType,
        active: activeInterns.length,
        submitted: submittedIds.size,
        pending: pending.length,
        emailsSent: 0,
        emailsSkippedNoEmail: 0,
        errors: 0,
        durationMs: 0
      };

      // Include a small sample list for verification in dry-run
      if (dryRun && sampleSize > 0) {
        const sample = pending.slice(0, sampleSize).map(i => ({
          id: i._id?.toString(),
          traineeId: this.getTraineeId(i),
          name: this.getInternName(i),
          email: this.getInternEmail(i)
        }));
        results.pendingSample = sample;
      }

      if (!dryRun) {
        for (const intern of pending) {
          const res = await this.sendReminderEmail(intern);
          if (res.sent) results.emailsSent += 1;
          else if (res.reason === 'no_email') results.emailsSkippedNoEmail += 1;
          else results.errors += 1;
        }
      }

      results.durationMs = Date.now() - start;
      console.log(`✅ Daily reminder completed: sent=${results.emailsSent}, skipped_no_email=${results.emailsSkippedNoEmail}, errors=${results.errors}, duration=${results.durationMs}ms`);
      return { success: true, ...results };
    } catch (error) {
      console.error('❌ Daily reminder failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = DailyReminderService;
