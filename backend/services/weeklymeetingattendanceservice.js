const Intern = require("../models/Intern");
const nodemailer = require("nodemailer");
const moment = require("moment");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

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

    if (lunarApprox[y]) {
      lunarApprox[y].forEach((d) => holidays.add(d));
    }
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
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidays.has(dateStr);

    if (!isWeekend && !isHoliday) {
      workingDays.push(cursor.clone());
    }

    cursor.add(1, "day");
  }

  return workingDays;
}

class WeeklyMeetingAttendanceService {
  static getTwoWeekRange() {
    const endDate = moment().startOf("day");
    const startDate = moment().subtract(14, "days").startOf("day");
    return { startDate, endDate };
  }

  static isNewIntern(intern) {
    if (!intern.Training_StartDate) return false;

    const { startDate } = this.getTwoWeekRange();
    const trainingStart = moment(intern.Training_StartDate).startOf("day");

    return trainingStart.isSameOrAfter(startDate);
  }

  static hasAttendedMeetingInPastTwoWeeks(intern) {
    try {
      if (!intern.attendance || intern.attendance.length === 0) {
        return false;
      }

      const { startDate, endDate } = this.getTwoWeekRange();

      const workingDayStrings = new Set(
        getWorkingDaysInRange(startDate, endDate).map((d) =>
          d.format("YYYY-MM-DD"),
        ),
      );

      const hasPresent = intern.attendance.some((record) => {
        const recordDate = moment(record.date);
        const dateStr = recordDate.format("YYYY-MM-DD");
        const isInRange =
          recordDate.isSameOrAfter(startDate) &&
          recordDate.isSameOrBefore(endDate);
        const isWorkingDay = workingDayStrings.has(dateStr);
        const isPresent = record.status === "Present";

        return isInRange && isWorkingDay && isPresent;
      });

      return hasPresent;
    } catch (error) {
      console.error(
        `Error checking attendance for intern ${intern._id}:`,
        error,
      );
      return false;
    }
  }

  static getLastAttendedMeeting(intern) {
    if (!intern.attendance || intern.attendance.length === 0) {
      return null;
    }

    const presentRecords = intern.attendance
      .filter((r) => r.status === "Present")
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return presentRecords.length > 0 ? presentRecords[0] : null;
  }

  static getInternName(intern) {
    return intern.Trainee_Name || intern.traineeName || "Unknown";
  }

  static getInternId(intern) {
    return intern.Trainee_ID || intern.traineeId || "Unknown";
  }

  static getInternEmail(intern) {
    return intern.Trainee_Email || intern.email || "";
  }

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

  static generateExcelReport(nonAttendingInterns) {
    try {
      const { startDate, endDate } = this.getTwoWeekRange();
      const periodLabel = `${startDate.format("MMM DD, YYYY")} - ${endDate.format("MMM DD, YYYY")}`;

      const excelData = [];

      excelData.push(["WEEKLY MEETING ATTENDANCE NON-ATTENDANCE REPORT"]);
      excelData.push(["TalentHub Intern Management System"]);
      excelData.push([]);
      excelData.push([
        "Report Generated:",
        moment().format("MMMM DD, YYYY [at] h:mm A"),
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
        "Team",
        "Training Start Date",
        "Training End Date",
        "Last Meeting Attended",
      ]);

      // ── Interns are already sorted by Trainee ID (ascending) before this
      //    method is called in performWeeklyMeetingAttendanceCheck ──────────
      nonAttendingInterns.forEach((intern, index) => {
        excelData.push([
          index + 1,
          intern.name,
          intern.id,
          intern.email,
          intern.fieldOfSpecialization,
          intern.institute,
          intern.team,
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
        "Note: Sri Lankan public holidays and weekends are excluded from the attendance window.",
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
        { wch: 20 },
        { wch: 25 },
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Non-Attendance Report",
      );

      const tempDir = path.join(__dirname, "..", "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const timestamp = moment().format("YYYY-MM-DD_HH-mm-ss");
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

  static async sendNonAttendanceEmailWithExcel(
    nonAttendingInterns,
    recipients = "mgiri@slt.com.lk",
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

      const recipientEmail = Array.isArray(recipients)
        ? recipients.join(", ")
        : recipients;
      const recipientList = Array.isArray(recipients)
        ? recipients
        : [recipients];
      console.log(`📧 Recipients: ${recipientList.join(", ")}`);

      console.log("📊 Generating meeting attendance Excel report...");
      excelFilePath = this.generateExcelReport(nonAttendingInterns);

      const { startDate, endDate } = this.getTwoWeekRange();
      const periodLabel = `${startDate.format("MMM DD, YYYY")} - ${endDate.format("MMM DD, YYYY")}`;

      const subject = `⚠️ Meeting Non-Attendance Alert - ${nonAttendingInterns.length} Interns - ${moment().format("MMM DD, YYYY")}`;

      const displayInterns = nonAttendingInterns.slice(0, 10);
      let tableRows = "";
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
            <td style="padding: 12px 8px;">${intern.lastAttendedMeeting}</td>
          </tr>`;
      });

      if (nonAttendingInterns.length > 10) {
        tableRows += `
          <tr style="background-color: #fff3cd;">
            <td colspan="8" style="padding: 12px 8px; text-align: center;">
              <strong>📎 See attached Excel file for complete list of all ${nonAttendingInterns.length} interns</strong>
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
    .header { background-color: #e65100; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .summary { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
    .actions { background-color: #d1ecf1; padding: 15px; border-left: 4px solid #17a2b8; margin: 20px 0; }
    .attachment-notice { background-color: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; }
    .info-notice { background-color: #e8f4f8; padding: 15px; border-left: 4px solid #5bc0de; margin: 20px 0; }
    .footer { background-color: #343a40; color: white; padding: 15px; text-align: center; border-radius: 0 0 5px 5px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; background-color: white; }
    th { background-color: #2c3e50; color: white; padding: 12px 8px; text-align: left; font-weight: bold; }
    td { padding: 12px 8px; }
    tr:hover { background-color: #f5f5f5; }
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
      <h2>Dear Sir,</h2>

      <div class="summary">
        <h3 style="margin-top: 0;">📊 Report Summary</h3>
        <p><strong>📅 Review Period:</strong> ${periodLabel}</p>
        <p><strong>📊 Total Non-Attending Interns:</strong> <span class="badge">${nonAttendingInterns.length}</span></p>
        <p><strong>⏰ Generated On:</strong> ${moment().format("MMMM DD, YYYY [at] h:mm A")}</p>
      </div>

      <div class="info-notice">
        <h3 style="margin-top: 0;">ℹ️ Attendance Check Methodology</h3>
        <p>This report <strong>excludes</strong> the following from the attendance window:</p>
        <ul style="margin: 5px 0;">
          <li>🗓️ <strong>Weekends</strong> (Saturdays &amp; Sundays)</li>
          <li>🎉 <strong>Sri Lankan public holidays</strong> (gazetted national &amp; bank holidays)</li>
          <li>🆕 <strong>New interns</strong> whose training commenced within the review period</li>
        </ul>
        <p style="margin-bottom: 0;">Only interns who were expected to attend meetings on working days are included.</p>
      </div>

      <div class="attachment-notice">
        <h3 style="margin-top: 0;">📎 Excel Attachment Included</h3>
        <p>A detailed Excel report with all non-attending interns is attached to this email.</p>
        <p><strong>Filename:</strong> ${path.basename(excelFilePath)}</p>
        <p>The Excel file contains complete information for all ${nonAttendingInterns.length} interns, <strong>sorted by Trainee ID (ascending)</strong>.</p>
      </div>

      <h3>📋 Non-Attending Interns (Preview - First ${displayInterns.length})</h3>
      <p>The following interns have <strong>NOT</strong> attended any meetings in the past 2 weeks:</p>

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
              <th>Last Meeting Attended</th>
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
          <li><strong>Review period:</strong> ${periodLabel}</li>
          <li><strong>Interns who attended meetings:</strong> Compliant</li>
          <li><strong>Interns who did NOT attend any meetings:</strong> ${nonAttendingInterns.length} (see attached Excel file)</li>
        </ul>
      </div>

      <div class="actions">
        <h3 style="margin-top: 0;">⚡ Recommended Actions</h3>
        <ul style="margin: 10px 0;">
          <li>Review the attached Excel file for the complete list</li>
          <li>Follow up with non-attending interns immediately</li>
          <li>Remind them of the meeting attendance requirement</li>
          <li>Investigate if absences are due to approved leave or other reasons</li>
          <li>Consider disciplinary action for repeated non-attendance</li>
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
        subject: subject,
        html: emailBody,
        attachments: [
          {
            filename: path.basename(excelFilePath),
            path: excelFilePath,
          },
        ],
      };

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
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

      return {
        success: false,
        error: error.message,
      };
    }
  }

  static async performWeeklyMeetingAttendanceCheck(
    recipients = "mgiri@slt.com.lk",
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
              ? `${moment(lastRecord.date).format("MMM DD, YYYY")}${lastRecord.meetingName ? ` — ${lastRecord.meetingName}` : ""}`
              : "No record found";

            results.nonAttendingList.push({
              internId: intern._id,
              name: internName,
              id: internId,
              email: internEmail,
              fieldOfSpecialization:
                intern.field_of_spec_name || "Not specified",
              institute: intern.Institute || "Not specified",
              team: intern.team || "Not specified",
              trainingStartDate: intern.Training_StartDate
                ? moment(intern.Training_StartDate).format("MMM DD, YYYY")
                : "Not specified",
              trainingEndDate: intern.Training_EndDate
                ? moment(intern.Training_EndDate).format("MMM DD, YYYY")
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

      // ── Sort non-attending interns by Trainee ID ascending before sending ─
      // This ensures the Excel sheet and email preview table are both in a
      // consistent, easy-to-scan order (e.g. SLT001, SLT002, SLT010 ...).
      results.nonAttendingList.sort((a, b) => {
        const idA = String(a.id).toUpperCase();
        const idB = String(b.id).toUpperCase();
        return idA < idB ? -1 : idA > idB ? 1 : 0;
      });

      // Send email
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
        if (!emailResult.skipped) {
          console.log("✅ Meeting attendance alert email sent successfully");
        }
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
          console.log(`     📧 Email:           ${intern.email}`);
          console.log(
            `     🎓 Field:           ${intern.fieldOfSpecialization}`,
          );
          console.log(`     🏫 Institute:       ${intern.institute}`);
          console.log(`     👥 Team:            ${intern.team}`);
          console.log(
            `     📅 Training:        ${intern.trainingStartDate} - ${intern.trainingEndDate}`,
          );
          console.log(`     🕐 Last attended:   ${intern.lastAttendedMeeting}`);
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
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = WeeklyMeetingAttendanceService;
