/**
 * exportController.js
 *
 * Handles all PDF export logic for daily records.
 * Separated from dailyRecordController.js to keep that file concise.
 *
 * Routes that use this module:
 *   GET /api/records/export/pdf        → exportDailyRecordsPDF
 *   GET /api/records/export/templates  → getAvailableTemplates
 */

const DailyRecord = require("../models/DailyRecord");
const Intern = require("../models/Intern");
const User = require("../models/User");

const {
  buildDateLabel,
  buildDateQuery,
} = require("./pdfTemplates/baseTemplate");
const {
  getTemplate,
  listTemplates,
} = require("./pdfTemplates/templateRegistry");

// ── GET /export/templates ─────────────────────────────────────────────────────
/**
 * Returns the list of available templates so the frontend can build a dropdown.
 * Response: [{ id: string, label: string }, ...]
 */
const getAvailableTemplates = (_req, res) => {
  res.status(200).json(listTemplates());
};

// ── GET /export/pdf ───────────────────────────────────────────────────────────
/**
 * Query params:
 *   date       {string}  YYYY-MM-DD  — single day
 *   startDate  {string}  YYYY-MM-DD  — range start (use with endDate)
 *   endDate    {string}  YYYY-MM-DD  — range end
 *   template   {string}  template id — e.g. "default" | "nsbm" | "sliit" | "iit"
 *                                      defaults to "default"
 */
const exportDailyRecordsPDF = async (req, res) => {
  try {
    const {
      date,
      startDate,
      endDate,
      template: templateId = "default",
    } = req.query;
    const userId = req.user.id;
    const userEmail = req.user.email;

    const {
      buildDateLabel,
      buildDateQuery,
    } = require("./pdfTemplates/baseTemplate");
    const { getTemplate } = require("./pdfTemplates/templateRegistry");

    const dateLabel = buildDateLabel({ date, startDate, endDate });
    const dateQuery = buildDateQuery({ date, startDate, endDate });

    // Determine admin vs intern
    const User = require("../models/User");
    const Intern = require("../models/Intern");
    const DailyRecord = require("../models/DailyRecord");

    const adminUser = await User.findById(userId);
    const isAdmin = !!adminUser;

    if (!isAdmin) {
      let intern = await Intern.findById(userId);
      if (!intern) intern = await Intern.findOne({ email: userEmail });
      if (!intern)
        return res.status(404).json({ error: "Intern record not found." });
      dateQuery.internId = intern._id;
    }

    const records = await DailyRecord.find(dateQuery)
      .populate("internId", "Trainee_Name Trainee_ID Trainee_Email")
      .sort({ internId: 1, date: -1 });

    // ── Resolve template ──────────────────────────────────────────────────────
    const tmpl = getTemplate(templateId);
    const buffer = await tmpl.generate(records, { dateLabel, isAdmin });

    // ── Build filename & content-type (PDF or XLSX) ───────────────────────────
    const isExcel = tmpl.ext === "xlsx";
    const isWord = tmpl.ext === "docx"; // ← add this
    const ext = isExcel ? "xlsx" : isWord ? "docx" : "pdf";
    const mime = isExcel
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : isWord
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // ← add
        : "application/pdf";

    const filename = date
      ? `daily-records-${date}-${tmpl.id}.${ext}`
      : startDate
        ? `daily-records-${startDate}-to-${endDate}-${tmpl.id}.${ext}`
        : `daily-records-all-${tmpl.id}.${ext}`;

    res.set({
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length,
    });
    return res.send(buffer);
  } catch (error) {
    console.error("Error exporting daily records:", error);
    res.status(500).json({ error: "Failed to export records" });
  }
};

module.exports = { exportDailyRecordsPDF, getAvailableTemplates };
