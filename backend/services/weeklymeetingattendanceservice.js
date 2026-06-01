const Intern = require("../models/Intern");
const InternTalentTrailSync = require("../models/InternTalentTrailSync");
const nodemailer = require("nodemailer");
const moment = require("moment-timezone");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const TZ = "Asia/Colombo";

// ── Attendance type sets ──────────────────────────────────────────────────────
const MEETING_ATTENDANCE_TYPES = new Set([
  "qr",
  "face_meeting",
  "meeting",
  "manual_meeting",
  "manual",
]);

// ---------------------------------------------------------------------------
// Sri Lankan Public Holidays
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

    if (lunarApprox[y]) lunarApprox[y].forEach((d) => holidays.add(d));
  });

  return holidays;
}

function getWorkingDaysInRange(startDate, endDate) {
  const years = [];
  for (let y = startDate.year(); y <= endDate.year(); y++) years.push(y);
  const holidays = getSriLankanHolidays(years);

  const workingDays = [];
  const cursor = startDate.clone();

  while (cursor.isSameOrBefore(endDate, "day")) {
    const dayOfWeek = cursor.day();
    const dateStr = cursor.format("YYYY-MM-DD");
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateStr)) {
      workingDays.push(cursor.clone());
    }
    cursor.add(1, "day");
  }

  return workingDays;
}

class WeeklyMeetingAttendanceService {
  // ── Date range (timezone-aware) ───────────────────────────────────────────

  static getTwoWeekRange() {
    const endDate = moment().tz(TZ).startOf("day");
    const startDate = moment().tz(TZ).subtract(14, "days").startOf("day");
    return { startDate, endDate };
  }

  // ── New-intern guard ──────────────────────────────────────────────────────

  static isNewIntern(intern) {
    if (!intern.Training_StartDate) return false;
    const { startDate } = this.getTwoWeekRange();
    const trainingStart = moment(intern.Training_StartDate)
      .tz(TZ)
      .startOf("day");
    return trainingStart.isSameOrAfter(startDate);
  }

  // ── Attendance check ──────────────────────────────────────────────────────

  /**
   * Returns true if the intern has at least one MEETING-type "Present" record
   * on a working day within the past two-week window.
   * Uses MEETING_ATTENDANCE_TYPES and timezone-aware date comparisons,
   * identical to the controller's hasAttendedMeeting helper.
   */
  static hasAttendedMeetingInPastTwoWeeks(intern) {
    try {
      if (!intern.attendance || intern.attendance.length === 0) return false;

      const { startDate, endDate } = this.getTwoWeekRange();

      const workingDayStrings = new Set(
        getWorkingDaysInRange(startDate, endDate).map((d) =>
          d.format("YYYY-MM-DD"),
        ),
      );

      return intern.attendance.some((record) => {
        const recordDate = moment(record.date).tz(TZ);
        const dateStr = recordDate.format("YYYY-MM-DD");
        const recordType = String(record.type || "").toLowerCase();

        return (
          recordDate.isSameOrAfter(startDate) &&
          recordDate.isSameOrBefore(endDate) &&
          record.status === "Present" &&
          MEETING_ATTENDANCE_TYPES.has(recordType) &&
          workingDayStrings.has(dateStr)
        );
      });
    } catch (error) {
      console.error(
        `Error checking attendance for intern ${intern._id}:`,
        error,
      );
      return false;
    }
  }

  static getLastAttendedMeeting(intern) {
    if (!intern.attendance || intern.attendance.length === 0) return null;

    const presentRecords = intern.attendance
      .filter((r) => {
        const recordType = String(r.type || "").toLowerCase();
        return (
          r.status === "Present" && MEETING_ATTENDANCE_TYPES.has(recordType)
        );
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return presentRecords.length > 0 ? presentRecords[0] : null;
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
      return await Intern.find({
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
    } catch (error) {
      console.error("Error fetching active interns:", error);
      return [];
    }
  }

  // ── Excel generation ──────────────────────────────────────────────────────

  static async generateExcelReport(nonAttendingInterns) {
    try {
      const { startDate, endDate } = this.getTwoWeekRange();
      const periodLabel = `${startDate.format("MMM DD, YYYY")} - ${endDate.format("MMM DD, YYYY")}`;

      const talentTrailDocs = await InternTalentTrailSync.find({});
      const projectsByEmail = {};
      for (const doc of talentTrailDocs) {
        const email = String(doc.email || "").toLowerCase();
        const projectNames = (doc.projects || []).map((p) => p.projectName);
        if (!projectsByEmail[email]) projectsByEmail[email] = [];
        projectsByEmail[email].push(...projectNames);
      }

      const excelData = [];
      excelData.push(["WEEKLY MEETING NON-ATTENDANCE REPORT"]);
      excelData.push(["TalentHub Intern Management System"]);
      excelData.push([]);
      excelData.push([
        "Report Generated:",
        moment().tz(TZ).format("MMMM DD, YYYY [at] HH:mm"),
      ]);
      excelData.push(["Review Period:", periodLabel]);
      excelData.push([
        "Total Non-Attending Interns:",
        nonAttendingInterns.length,
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
        "Projects",
        "Training Start Date",
        "Training End Date",
        "Last Meeting Attended",
      ]);

      nonAttendingInterns.forEach((intern, index) => {
        const internEmail = String(intern.email || "").toLowerCase();
        const projectList = projectsByEmail[internEmail] || [];
        const projectsString =
          projectList.length > 0 ? projectList.join(", ") : "Not assigned";

        excelData.push([
          index + 1,
          intern.name,
          intern.id,
          intern.email,
          intern.fieldOfSpecialization,
          intern.institute,
          projectsString,
          intern.trainingStartDate,
          intern.trainingEndDate,
          intern.lastAttendedMeeting,
        ]);
      });

      excelData.push([]);
      excelData.push([]);
      excelData.push(["SUMMARY"]);
      excelData.push([
        `These interns have NOT attended any meetings in the past 2 weeks (${periodLabel}).`,
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
        { wch: 35 },
        { wch: 20 },
        { wch: 20 },
        { wch: 25 },
      ];
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Non-Attendance Report",
      );

      const tempDir = path.join(__dirname, "..", "temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      const timestamp = moment().tz(TZ).format("YYYY-MM-DD_HH-mm-ss");
      const filename = `Weekly_Meeting_Non_Attendance_Report_${timestamp}.xlsx`;
      const filePath = path.join(tempDir, filename);

      XLSX.writeFile(workbook, filePath);
      console.log(`✅ Meeting attendance Excel report generated: ${filename}`);
      return filePath;
    } catch (error) {
      console.error(
        "❌ Error generating meeting attendance Excel report:",
        error,
      );
      throw error;
    }
  }

  // ── Email sending ─────────────────────────────────────────────────────────

  static async sendNonAttendanceEmailWithExcel(
    nonAttendingInterns,
    recipients = "dimalshacooray@gmail.com",
  ) {
    let excelFilePath = null;

    try {
      if (nonAttendingInterns.length === 0) {
        console.log(
          "✅ All interns attended meetings in the past 2 weeks - no email to send",
        );
        return {
          success: true,
          skipped: true,
          reason: "All interns attended meetings in the past 2 weeks",
        };
      }

      const recipientList = Array.isArray(recipients)
        ? recipients
        : [recipients];
      const recipientEmail = recipientList.join(", ");
      console.log(`📧 Recipients: ${recipientList.join(", ")}`);

      console.log("📊 Generating meeting attendance Excel report...");
      excelFilePath = await this.generateExcelReport(nonAttendingInterns);

      const { startDate, endDate } = this.getTwoWeekRange();
      const periodLabel = `${startDate.format("MMM DD, YYYY")} - ${endDate.format("MMM DD, YYYY")}`;
      const subject = `Meeting Non-Attendance Alert - ${nonAttendingInterns.length} Intern(s) - ${moment().tz(TZ).format("MMM DD, YYYY")}`;

      const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { background-color: #e65100; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 25px; border: 1px solid #ddd; }
    .info { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
    .attachment-notice { background-color: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; }
    .footer { background-color: #343a40; color: white; padding: 15px; text-align: center; border-radius: 0 0 5px 5px; font-size: 12px; }
    .badge { background-color: #e65100; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">⚠️ WEEKLY MEETING NON-ATTENDANCE ALERT</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px;">TalentHub Intern Management System</p>
    </div>
    <div class="content">
      <p>Dear Sir,</p>
      <p>This is an automated weekly report for the meeting attendance compliance check.</p>
      <div class="info">
        <p style="margin: 0;"><strong>📅 Review Period:</strong> ${periodLabel}</p>
        <p style="margin: 8px 0 0 0;"><strong>📊 Non-Attending Interns:</strong> <span class="badge">${nonAttendingInterns.length}</span></p>
        <p style="margin: 8px 0 0 0;"><strong>⏰ Generated On:</strong> ${moment().tz(TZ).format("MMMM DD, YYYY [at] HH:mm")}</p>
      </div>
      <p>
        The attached Excel file contains the complete list of interns who have <strong>NOT</strong> attended
        any meetings during the above two-week review period. Interns whose training commenced within this period are excluded from the report.
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
      <p style="margin: 5px 0;">🕐 Generated: ${moment().tz(TZ).format("MMMM DD, YYYY [at] HH:mm")}</p>
      <p style="margin: 5px 0;">© ${moment().tz(TZ).format("YYYY")} SLT Mobitel - All Rights Reserved</p>
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
        `✅ Meeting non-attendance alert email sent to ${recipientList.length} recipient(s)`,
      );
      recipientList.forEach((email) => console.log(`   📧 ${email}`));
      console.log(`📧 Email ID: ${info.messageId}`);
      console.log(`📎 Attachment: ${path.basename(excelFilePath)}`);
      console.log(`📊 Interns listed: ${nonAttendingInterns.length}`);

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
        internsCount: nonAttendingInterns.length,
        attachmentName: path.basename(excelFilePath),
      };
    } catch (error) {
      console.error(
        "❌ Failed to send meeting non-attendance alert email:",
        error,
      );
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

  static async performWeeklyMeetingAttendanceCheck(
    recipients = "dimalshacooray@gmail.com",
    triggerType = "scheduled",
  ) {
    const startTime = new Date();
    const { startDate, endDate } = this.getTwoWeekRange();

    const workingDays = getWorkingDaysInRange(startDate, endDate);
    const holidaysSkipped = 14 - workingDays.length;

    console.log("\n🔍 Starting weekly meeting attendance check...");
    console.log(
      `📅 Checking period: ${startDate.format("MMMM DD, YYYY")} to ${endDate.format("MMMM DD, YYYY")}`,
    );
    console.log(
      `📆 Working days in window: ${workingDays.length} (${holidaysSkipped} weekend/holiday day(s) excluded)`,
    );

    try {
      const activeInterns = await this.getActiveInterns();
      console.log(`👥 Found ${activeInterns.length} active interns to check`);

      const results = {
        total: activeInterns.length,
        attended: 0,
        notAttended: 0,
        skippedNewInterns: 0,
        emailSent: false,
        emailMessageId: null,
        emailError: null,
        errors: [],
        nonAttendingList: [],
      };

      for (const intern of activeInterns) {
        try {
          const internName = this.getInternName(intern);
          const internId = this.getInternId(intern);
          const internEmail = this.getInternEmail(intern);

          if (this.isNewIntern(intern)) {
            results.skippedNewInterns++;
            console.log(
              `🆕 ${internName} (${internId}) - SKIPPED (training started within the review period)`,
            );
            continue;
          }

          const hasAttended = this.hasAttendedMeetingInPastTwoWeeks(intern);

          if (hasAttended) {
            results.attended++;
            console.log(
              `✅ ${internName} (${internId}) - attended a meeting in the past 2 weeks`,
            );
          } else {
            results.notAttended++;

            const lastRecord = this.getLastAttendedMeeting(intern);
            const lastAttendedLabel = lastRecord
              ? `${moment(lastRecord.date).tz(TZ).format("MMM DD, YYYY")}${lastRecord.meetingName ? ` — ${lastRecord.meetingName}` : ""}`
              : "No record found";

            results.nonAttendingList.push({
              internId: intern._id,
              name: internName,
              id: internId,
              email: internEmail,
              fieldOfSpecialization:
                intern.field_of_spec_name || "Not specified",
              institute: intern.Institute || "Not specified",
              trainingStartDate: intern.Training_StartDate
                ? moment(intern.Training_StartDate)
                    .tz(TZ)
                    .format("MMM DD, YYYY")
                : "Not specified",
              trainingEndDate: intern.Training_EndDate
                ? moment(intern.Training_EndDate).tz(TZ).format("MMM DD, YYYY")
                : "Not specified",
              lastAttendedMeeting: lastAttendedLabel,
            });

            console.log(
              `❌ ${internName} (${internId}) - NO meeting attendance in the past 2 weeks`,
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
      results.nonAttendingList.sort((a, b) => {
        const idA = String(a.id).toUpperCase();
        const idB = String(b.id).toUpperCase();
        return idA < idB ? -1 : idA > idB ? 1 : 0;
      });

      const recipientList = Array.isArray(recipients)
        ? recipients
        : [recipients];
      console.log(
        `\n📧 Sending meeting attendance alert to ${recipientList.length} recipient(s)...`,
      );

      const emailResult = await this.sendNonAttendanceEmailWithExcel(
        results.nonAttendingList,
        recipients,
      );

      if (emailResult.success) {
        results.emailSent = true;
        results.emailMessageId = emailResult.messageId;
        results.attachmentName = emailResult.attachmentName;
        if (!emailResult.skipped)
          console.log("✅ Meeting attendance alert email sent successfully");
      } else {
        results.emailSent = false;
        results.emailError = emailResult.error;
        console.log(
          `❌ Failed to send meeting attendance alert: ${emailResult.error}`,
        );
      }

      console.log("\n📊 WEEKLY MEETING ATTENDANCE CHECK SUMMARY");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`📋 Total interns checked:          ${results.total}`);
      console.log(
        `🆕 New interns skipped:            ${results.skippedNewInterns}`,
      );
      console.log(`✅ Attended (past 2 weeks):        ${results.attended}`);
      console.log(`❌ Did NOT attend:                 ${results.notAttended}`);
      console.log(`📆 Working days in window:         ${workingDays.length}`);
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

      if (results.nonAttendingList.length > 0) {
        console.log("\n📋 DETAILED LIST OF NON-ATTENDING INTERNS:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        results.nonAttendingList.forEach((intern, index) => {
          console.log(`\n  ${index + 1}. ${intern.name} (${intern.id})`);
          console.log(`     📧 Email:         ${intern.email}`);
          console.log(`     🎓 Field:         ${intern.fieldOfSpecialization}`);
          console.log(`     🏫 Institute:     ${intern.institute}`);
          console.log(
            `     📅 Training:      ${intern.trainingStartDate} - ${intern.trainingEndDate}`,
          );
          console.log(`     🕐 Last attended: ${intern.lastAttendedMeeting}`);
        });
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      }

      console.log("\n✅ Weekly meeting attendance check completed!\n");

      const endTime = new Date();
      return {
        ...results,
        executionTime: endTime.getTime() - startTime.getTime(),
        triggerType,
      };
    } catch (error) {
      console.error(
        "❌ Fatal error during weekly meeting attendance check:",
        error,
      );
      return { success: false, error: error.message };
    }
  }
}

module.exports = WeeklyMeetingAttendanceService;
