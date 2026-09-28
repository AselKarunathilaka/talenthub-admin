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
    let resolvedUniversity = req.query.universityName || "NSBM Green University";
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
    const mongoose = require("mongoose");
    const User = require("../models/User");
    const DailyRecord = require("../models/DailyRecord");
    const { findInternRecord } = require("./dailyRecordController");

    const adminUser = (userId && mongoose.Types.ObjectId.isValid(userId))
      ? await User.findById(userId)
      : null;
    const isAdmin = !!adminUser;

    let internRecord = null;
    if (!isAdmin) {
      internRecord = await findInternRecord(userId, userEmail);
      if (!internRecord)
        return res.status(404).json({ error: "Intern record not found." });
      if (internRecord.Institute) {
        resolvedUniversity = internRecord.Institute;
      }
      dateQuery.$or = [
        { internId: internRecord._id },
        ...(internRecord.Trainee_ID ? [{ traineeId: internRecord.Trainee_ID }] : []),
      ];
    }

    const rawRecords = await DailyRecord.find(dateQuery)
      .populate("internId", "Trainee_Name Trainee_ID Trainee_Email Institute")
      .sort({ date: 1 });

    const records = rawRecords.map((r) => {
      const obj = r.toObject ? r.toObject() : { ...r };
      if ((!obj.internId || !obj.internId.Trainee_Name) && internRecord) {
        obj.internId = {
          _id: internRecord._id,
          Trainee_ID: internRecord.Trainee_ID || internRecord.traineeId || "",
          traineeId: internRecord.Trainee_ID || internRecord.traineeId || "",
          Trainee_Name: internRecord.Trainee_Name || internRecord.traineeName || "Intern",
          traineeName: internRecord.Trainee_Name || internRecord.traineeName || "Intern",
          Trainee_Email: internRecord.Trainee_Email || internRecord.email || userEmail || "",
          email: internRecord.Trainee_Email || internRecord.email || userEmail || "",
          Institute: internRecord.Institute || resolvedUniversity,
        };
      }
      return obj;
    });

    // Ensure strictly chronological sort by date (earliest to latest)
    records.sort((a, b) => {
      const da = a.date || "";
      const db = b.date || "";
      return da.localeCompare(db);
    });

    // ── Resolve template ──────────────────────────────────────────────────────
    const tmpl = getTemplate(templateId);
    const buffer = await tmpl.generate(records, { dateLabel, isAdmin, universityName: resolvedUniversity });

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
