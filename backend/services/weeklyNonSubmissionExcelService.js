const DailyRecord = require("../models/DailyRecord");
const Intern = require("../models/Intern");
const nodemailer = require("nodemailer");
const moment = require("moment");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Sri Lankan Public Holidays (shared helper)
// ---------------------------------------------------------------------------
function getSriLankanHolidays(years) {
  const yearList = Array.isArray(years) ? years : [years];
  const holidays = new Set();

  yearList.forEach((y) => {
    const fixed = [`${y}-01-01`, `${y}-02-04`, `${y}-05-01`, `${y}-12-25`];
    fixed.forEach((d) => holidays.add(d));

    const lunarApprox = {
      2024: [
        "2024-01-15",
        "2024-02-23",
        "2024-03-25",
        "2024-04-12",
        "2024-04-13",
        "2024-04-14",
        "2024-05-23",
        "2024-05-24",
        "2024-06-17",
        "2024-06-21",
        "2024-07-20",
        "2024-08-19",
        "2024-09-17",
        "2024-10-02",
        "2024-10-17",
        "2024-10-31",
        "2024-11-15",
        "2024-12-15",
      ],
      2025: [
        "2025-01-14",
        "2025-02-26",
        "2025-03-14",
        "2025-03-31",
        "2025-04-13",
        "2025-04-14",
        "2025-05-12",
        "2025-05-13",
        "2025-06-06",
        "2025-06-07",
        "2025-07-05",
        "2025-08-03",
        "2025-09-01",
        "2025-09-05",
        "2025-10-01",
        "2025-10-20",
        "2025-10-30",
        "2025-11-29",
      ],
      2026: [
        "2026-01-14",
        "2026-02-15",
        "2026-03-03",
        "2026-03-20",
        "2026-04-02",
        "2026-04-13",
        "2026-04-14",
        "2026-05-01",
        "2026-05-02",
        "2026-05-28",
        "2026-05-30",
        "2026-06-29",
        "2026-07-28",
        "2026-08-27",
        "2026-09-10",
        "2026-09-25",
        "2026-11-09",
        "2026-11-24",
        "2026-12-23",
      ],
    };

    if (lunarApprox[y]) {
      lunarApprox[y].forEach((d) => holidays.add(d));
    }
  });

  return holidays;
}

/**
 * Returns the past N working days (excluding weekends + SL public holidays),
 * going backwards from (but NOT including) today.
 */
function getPastWorkingDays(count) {
  const today = moment().startOf("day");
  const years = new Set([today.year()]);
  // include prior year in case we cross a year boundary
  years.add(today.year() - 1);
  const holidays = getSriLankanHolidays([...years]);

  const days = [];
  const cursor = today.clone().subtract(1, "day");

  while (days.length < count) {
    const dow = cursor.day();
    const dateStr = cursor.format("YYYY-MM-DD");
    if (dow !== 0 && dow !== 6 && !holidays.has(dateStr)) {
      days.push(dateStr);
    }
    cursor.subtract(1, "day");
  }

  return days; // most-recent first; reverse() for chronological order
}

class WeeklyNonSubmissionExcelService {
  // ── Period helpers ────────────────────────────────────────────────────────

  /**
   * The "check window" is the past 5 working days (Mon-Fri, excl. holidays).
   * Returns an array of YYYY-MM-DD strings, most-recent first.
   */
  static getCheckWindow() {
    return getPastWorkingDays(5);
  }

  // ── New-intern guard ──────────────────────────────────────────────────────

  /**
   * An intern is considered "new" if their Training_StartDate falls within the
   * check window (i.e. they joined during the period being reviewed).
   * New interns are excluded from the report — they can't be expected to have
   * submitted logs for days before they started.
   */
  static isNewIntern(intern) {
    if (!intern.Training_StartDate) return false;

    const window = this.getCheckWindow();
    const windowStart = moment(window[window.length - 1]); // earliest day
    const trainingStart = moment(intern.Training_StartDate).startOf("day");

    return trainingStart.isSameOrAfter(windowStart);
  }

  // ── Log-submission check ──────────────────────────────────────────────────

  /**
   * Returns true if the intern submitted at least one daily log within the
   * past 5 working days (weekends + SL public holidays excluded).
   */
  static async hasSubmittedLogsForPastWeek(internId) {
    try {
      const workingDays = this.getCheckWindow();

      const logsCount = await DailyRecord.countDocuments({
        internId: internId,
        date: { $in: workingDays },
      });

      return logsCount > 0;
    } catch (error) {
      console.error(`Error checking logs for intern ${internId}:`, error);
      return false;
    }
  }

  // ── Last submission date ──────────────────────────────────────────────────

  /**
   * Returns the most recent logbook submission date for an intern across all
   * time, formatted as "MMM DD, YYYY". Returns "No record found" if they have
   * never submitted.
   */
  static async getLastSubmissionDate(internId) {
    try {
      const lastRecord = await DailyRecord.findOne({ internId: internId })
        .sort({ date: -1 })
        .select("date");

      return lastRecord
        ? moment(lastRecord.date).format("MMM DD, YYYY")
        : "No record found";
    } catch (error) {
      console.error(
        `Error fetching last submission for intern ${internId}:`,
        error,
      );
      return "Error fetching";
    }
  }

  // ── Field helpers ─────────────────────────────────────────────────────────

  static getInternName(intern) {
    return intern.Trainee_Name || intern.traineeName || "Unknown";
  }

  static getInternId(intern) {
    return intern.Trainee_ID || intern.traineeId || "Unknown";
  }

  static getInternEmail(intern) {
    return intern.Trainee_Email || intern.email || "";
  }

  // ── Active-intern query ───────────────────────────────────────────────────

  static async getActiveInterns() {
    try {
      const currentDate = new Date();

      const activeInterns = await Intern.find({
        $and: [
          {
            $or: [
              { Training_StartDate: { $lte: currentDate } },
              { Training_StartDate: { $exists: false } },
            ],
          },
          {
            $or: [
              { Training_EndDate: { $gte: currentDate } },
              { Training_EndDate: { $exists: false } },
            ],
          },
        ],
      });

      return activeInterns;
    } catch (error) {
      console.error("Error fetching active interns:", error);
      return [];
    }
  }

  // ── Excel generation ──────────────────────────────────────────────────────

  static generateExcelReport(nonSubmittedInterns) {
    try {
      const window = this.getCheckWindow();
      const periodStart = moment(window[window.length - 1]).format(
        "MMM DD, YYYY",
      );
      const periodEnd = moment(window[0]).format("MMM DD, YYYY");
      const periodLabel = `${periodStart} - ${periodEnd}`;

      const excelData = [];

      excelData.push(["WEEKLY LOGBOOK NON-SUBMISSION REPORT"]);
      excelData.push(["TalentHub Intern Management System"]);
      excelData.push([]);
      excelData.push([
        "Report Generated:",
        moment().format("MMMM DD, YYYY [at] h:mm A"),
      ]);
      excelData.push(["Week Period:", periodLabel]);
      excelData.push([
        "Total Non-Submitting Interns:",
        nonSubmittedInterns.length,
      ]);
      excelData.push([]);
      excelData.push([]);

      excelData.push([
        "No.",
        "Intern Name",
        "Trainee ID",
        "Email Address",
        "Field of Specialization",
        "Institute",
        "Training Start Date",
        "Training End Date",
        "Last Submission Date",
      ]);

      // Already sorted by Trainee ID before this method is called
      nonSubmittedInterns.forEach((intern, index) => {
        excelData.push([
          index + 1,
          intern.name,
          intern.id,
          intern.email,
          intern.fieldOfSpecialization,
          intern.institute,
          intern.trainingStartDate,
          intern.trainingEndDate,
          intern.lastSubmissionDate,
        ]);
      });

      excelData.push([]);
      excelData.push([]);
      excelData.push(["SUMMARY"]);
      excelData.push([
        `These interns have NOT submitted any daily logbook entries for the past 5 working days (${periodLabel}).`,
      ]);
      excelData.push(["Immediate follow-up action is recommended."]);
      excelData.push([]);
      excelData.push([
        "Note: Interns whose training started within the review period are excluded.",
      ]);

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      worksheet["!cols"] = [
        { wch: 5 },
        { wch: 25 },
        { wch: 15 },
        { wch: 30 },
        { wch: 25 },
        { wch: 30 },
        { wch: 20 },
        { wch: 20 },
        { wch: 25 },
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Non-Submission Report",
      );

      const tempDir = path.join(__dirname, "..", "temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      const timestamp = moment().format("YYYY-MM-DD_HH-mm-ss");
      const filename = `Weekly_Non_Submission_Report_${timestamp}.xlsx`;
      const filePath = path.join(tempDir, filename);

      XLSX.writeFile(workbook, filePath);
      console.log(`✅ Excel report generated: ${filename}`);
      return filePath;
    } catch (error) {
      console.error("❌ Error generating Excel report:", error);
      throw error;
    }
  }

  // ── Email sending ─────────────────────────────────────────────────────────

  static async sendNonSubmissionEmailWithExcel(
    nonSubmittedInterns,
    recipients,
  ) {
    let excelFilePath = null;

    try {
      if (nonSubmittedInterns.length === 0) {
        console.log("✅ All interns have submitted logs - no email to send");
        return {
          success: true,
          skipped: true,
          reason: "All interns have submitted logs",
        };
      }

      const recipientEmail = Array.isArray(recipients)
        ? recipients.join(", ")
        : recipients;
      const recipientList = Array.isArray(recipients)
        ? recipients
        : [recipients];
      console.log(`📧 Recipients: ${recipientList.join(", ")}`);

      console.log("📊 Generating Excel report...");
      excelFilePath = this.generateExcelReport(nonSubmittedInterns);

      const window = this.getCheckWindow();
      const periodStart = moment(window[window.length - 1]).format(
        "MMM DD, YYYY",
      );
      const periodEnd = moment(window[0]).format("MMM DD, YYYY");
      const periodLabel = `${periodStart} - ${periodEnd}`;

      const subject = `Weekly Logbook Non-Submission Alert - ${nonSubmittedInterns.length} Intern(s) - ${moment().format("MMM DD, YYYY")}`;

      const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 25px; border: 1px solid #ddd; }
    .info { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
    .attachment-notice { background-color: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; }
    .footer { background-color: #343a40; color: white; padding: 15px; text-align: center; border-radius: 0 0 5px 5px; font-size: 12px; }
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
      <p>Dear Sir,</p>

      <p>This is an automated weekly report for the logbook submission compliance check.</p>

      <div class="info">
        <p style="margin: 0;"><strong>📅 Review Period:</strong> ${periodLabel}</p>
        <p style="margin: 8px 0 0 0;"><strong>📊 Non-Submitting Interns:</strong> <span class="badge">${nonSubmittedInterns.length}</span></p>
        <p style="margin: 8px 0 0 0;"><strong>⏰ Generated On:</strong> ${moment().format("MMMM DD, YYYY [at] h:mm A")}</p>
      </div>

      <p>
        The attached Excel file contains the complete list of interns who have <strong>NOT</strong> submitted
        any daily logbook entries during the above review period. Interns whose training commenced within this period are excluded from the report.
      </p>

      <div class="attachment-notice">
        <p style="margin: 0;"><strong>📎 Attachment:</strong> ${path.basename(excelFilePath)}</p>
      </div>

      <p>Please review the attached file and follow up with the listed interns at the earliest.</p>

      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>SLT Mobitel – TalentHub System</strong><br>
        Digital Platforms Development Section
      </p>
    </div>

    <div class="footer">
      <p style="margin: 5px 0;">📧 Recipients: ${recipientList.join(", ")}</p>
      <p style="margin: 5px 0;">🕐 Generated: ${moment().format("MMMM DD, YYYY [at] h:mm A")}</p>
      <p style="margin: 5px 0;">© ${moment().format("YYYY")} SLT Mobitel - All Rights Reserved</p>
    </div>
  </div>
</body>
</html>`.trim();

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: recipientEmail,
        subject,
        html: emailBody,
        attachments: [
          { filename: path.basename(excelFilePath), path: excelFilePath },
        ],
      };

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
      });

      const info = await transporter.sendMail(mailOptions);

      console.log(
        `✅ Non-submission alert email sent to ${recipientList.length} recipient(s)`,
      );
      recipientList.forEach((email) => console.log(`   📧 ${email}`));
      console.log(`📧 Email ID: ${info.messageId}`);
      console.log(`📎 Attachment: ${path.basename(excelFilePath)}`);
      console.log(`📊 Interns listed: ${nonSubmittedInterns.length}`);

      if (fs.existsSync(excelFilePath)) {
        fs.unlinkSync(excelFilePath);
        console.log(
          `🗑️  Temporary Excel file deleted: ${path.basename(excelFilePath)}`,
        );
      }

      return {
        success: true,
        messageId: info.messageId,
        recipients: recipientList,
        recipientCount: recipientList.length,
        internsCount: nonSubmittedInterns.length,
        attachmentName: path.basename(excelFilePath),
      };
    } catch (error) {
      console.error("❌ Failed to send non-submission alert email:", error);

      if (excelFilePath && fs.existsSync(excelFilePath)) {
        try {
          fs.unlinkSync(excelFilePath);
          console.log("🗑️  Cleaned up Excel file after error");
        } catch (cleanupError) {
          console.error(
            `⚠️  Could not delete temp file: ${cleanupError.message}`,
          );
        }
      }

      return { success: false, error: error.message };
    }
  }

  // ── Main entry point ──────────────────────────────────────────────────────

  static async performWeeklyNonSubmissionCheckWithExcel(
    recipients,
    triggerType = "scheduled",
  ) {
    const startTime = new Date();
    const window = this.getCheckWindow();
    const periodStart = moment(window[window.length - 1]).format(
      "MMMM DD, YYYY",
    );
    const periodEnd = moment(window[0]).format("MMMM DD, YYYY");

    console.log("\n🔍 Starting weekly logbook non-submission check...");
    console.log(`📅 Review period: ${periodStart} to ${periodEnd}`);

    try {
      const activeInterns = await this.getActiveInterns();
      console.log(`👥 Found ${activeInterns.length} active interns to check`);

      const results = {
        total: activeInterns.length,
        submitted: 0,
        notSubmitted: 0,
        skippedNewInterns: 0,
        emailSent: false,
        emailMessageId: null,
        emailError: null,
        errors: [],
        nonSubmittedList: [],
      };

      for (const intern of activeInterns) {
        try {
          const internName = this.getInternName(intern);
          const internId = this.getInternId(intern);
          const internEmail = this.getInternEmail(intern);

          // Skip interns who joined within the review window
          if (this.isNewIntern(intern)) {
            results.skippedNewInterns++;
            console.log(
              `🆕 ${internName} (${internId}) - SKIPPED (training started within the review period)`,
            );
            continue;
          }

          const hasSubmitted = await this.hasSubmittedLogsForPastWeek(
            intern._id,
          );

          if (hasSubmitted) {
            results.submitted++;
            console.log(`✅ ${internName} (${internId}) - has submitted logs`);
          } else {
            results.notSubmitted++;

            const lastSubmissionDate = await this.getLastSubmissionDate(
              intern._id,
            );

            results.nonSubmittedList.push({
              internId: intern._id,
              name: internName,
              id: internId,
              email: internEmail,
              fieldOfSpecialization:
                intern.field_of_spec_name || "Not specified",
              institute: intern.Institute || "Not specified",
              trainingStartDate: intern.Training_StartDate
                ? moment(intern.Training_StartDate).format("MMM DD, YYYY")
                : "Not specified",
              trainingEndDate: intern.Training_EndDate
                ? moment(intern.Training_EndDate).format("MMM DD, YYYY")
                : "Not specified",
              lastSubmissionDate,
            });

            console.log(
              `❌ ${internName} (${internId}) - NO logs submitted for the review period (last: ${lastSubmissionDate})`,
            );
          }
        } catch (error) {
          const internName = this.getInternName(intern);
          const internId = this.getInternId(intern);
          console.error(`❌ Error processing intern ${internName}:`, error);
          results.errors.push({
            internId: intern._id,
            internName,
            traineeId: internId,
            error: error.message,
            occurredAt: new Date(),
          });
        }
      }

      // Sort by Trainee ID ascending
      results.nonSubmittedList.sort((a, b) => {
        const idA = String(a.id).toUpperCase();
        const idB = String(b.id).toUpperCase();
        return idA < idB ? -1 : idA > idB ? 1 : 0;
      });

      const recipientList = Array.isArray(recipients)
        ? recipients
        : [recipients];
      console.log(
        `\n📧 Sending alert to ${recipientList.length} recipient(s)...`,
      );

      const emailResult = await this.sendNonSubmissionEmailWithExcel(
        results.nonSubmittedList,
        recipients,
      );

      if (emailResult.success) {
        results.emailSent = true;
        results.emailMessageId = emailResult.messageId;
        results.attachmentName = emailResult.attachmentName;
        if (!emailResult.skipped)
          console.log("✅ Alert email with Excel attachment sent successfully");
      } else {
        results.emailSent = false;
        results.emailError = emailResult.error;
        console.log(`❌ Failed to send alert email: ${emailResult.error}`);
      }

      console.log("\n📊 WEEKLY NON-SUBMISSION CHECK SUMMARY");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`📋 Total interns checked:          ${results.total}`);
      console.log(
        `🆕 New interns skipped:            ${results.skippedNewInterns}`,
      );
      console.log(`✅ Submitted logs:                 ${results.submitted}`);
      console.log(`❌ Did NOT submit logs:            ${results.notSubmitted}`);
      console.log(
        `📧 Alert email sent:               ${results.emailSent ? "YES" : "NO"}`,
      );
      console.log(
        `📎 Excel attachment:               ${results.attachmentName || "N/A"}`,
      );
      console.log(
        `⚠️  Processing errors:             ${results.errors.length}`,
      );
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      if (results.nonSubmittedList.length > 0) {
        console.log("\n📋 DETAILED LIST OF NON-SUBMITTING INTERNS:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        results.nonSubmittedList.forEach((intern, index) => {
          console.log(`\n  ${index + 1}. ${intern.name} (${intern.id})`);
          console.log(`     📧 Email:         ${intern.email}`);
          console.log(`     🎓 Field:         ${intern.fieldOfSpecialization}`);
          console.log(`     🏫 Institute:     ${intern.institute}`);
          console.log(
            `     📅 Training:      ${intern.trainingStartDate} - ${intern.trainingEndDate}`,
          );
          console.log(`     🕐 Last submit:   ${intern.lastSubmissionDate}`);
        });
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      }

      console.log("\n✅ Weekly non-submission check completed!\n");

      const endTime = new Date();
      return {
        ...results,
        executionTime: endTime.getTime() - startTime.getTime(),
        triggerType,
      };
    } catch (error) {
      console.error(
        "❌ Fatal error during weekly non-submission check:",
        error,
      );
      return { success: false, error: error.message };
    }
  }
}

module.exports = WeeklyNonSubmissionExcelService;
