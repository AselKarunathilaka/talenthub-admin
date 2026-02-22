const DailyRecord = require("../models/DailyRecord");
const Intern = require("../models/Intern");
const { checkLeaveSubmissionAllowed } = require("../utils/timeRestriction");
const PDFDocument = require("pdfkit");

const SLT_LOGO_BASE64 =
  "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";
const SLT_LOGO_BUFFER = Buffer.from(SLT_LOGO_BASE64, "base64");

// Create a new daily record
const createDailyRecord = async (req, res) => {
  try {
    const { date, stack, task, progress, blockers, status } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Check if leave submission is allowed (time restriction check)
    if (status === "leave") {
      const leaveCheck = checkLeaveSubmissionAllowed();
      if (!leaveCheck.allowed) {
        return res.status(403).json({
          error: leaveCheck.message,
          timeRestriction: true,
          currentTime: leaveCheck.currentTime,
        });
      }
    }

    // The user ID could be either a User (admin) or Intern ID directly
    // For daily records, we need to find the intern
    let internId;

    // First, try to find intern by ID directly (for Google login case)
    let intern = await Intern.findById(userId);

    if (!intern) {
      // If not found by ID, try to find by email (for cases where user logged in with email)
      intern = await Intern.findOne({ email: userEmail });
    }

    if (!intern) {
      // If still not found, try to find intern by userId (for admin login case - though admins shouldn't create records)
      intern = await Intern.findOne({ userId: userId });
    }

    if (!intern) {
      return res.status(404).json({
        error:
          "Intern record not found. Please contact your administrator to set up your intern profile.",
        details: `No intern found for email: ${userEmail}`,
      });
    }

    internId = intern._id;

    // Check if a record already exists for this date
    const existingRecord = await DailyRecord.findOne({
      internId: internId,
      date: date,
    });

    if (existingRecord) {
      // Update existing record
      existingRecord.stack = stack;
      existingRecord.task = task;
      existingRecord.progress = progress || "No challenges faced";
      existingRecord.blockers = blockers || "No specific plans";
      if (status) existingRecord.status = status;

      await existingRecord.save();

      // Populate the intern details
      await existingRecord.populate(
        "internId",
        "Trainee_Name Trainee_ID Trainee_Email",
      );

      return res.status(200).json(existingRecord);
    } else {
      // Create new record
      const newRecord = new DailyRecord({
        internId: internId,
        date,
        stack,
        task,
        progress: progress || "No challenges faced",
        blockers: blockers || "No specific plans",
        status: status || "working",
      });

      await newRecord.save();

      // Populate the intern details
      await newRecord.populate(
        "internId",
        "Trainee_Name Trainee_ID Trainee_Email",
      );

      return res.status(201).json(newRecord);
    }
  } catch (error) {
    console.error("Error creating daily record:", error);

    if (error.code === 11000) {
      return res
        .status(400)
        .json({ error: "A record for this date already exists" });
    }

    // Check for validation errors (e.g., field too long)
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message,
      );
      return res.status(400).json({
        error: "Validation failed",
        details: validationErrors,
        message:
          "Please check that your entries are not too long. Each field has a maximum character limit.",
      });
    }

    // Check for payload too large error
    if (error.type === "entity.too.large") {
      return res.status(413).json({
        error: "Request too large",
        message:
          "Your submission contains too much data. Please reduce the length of your entries.",
      });
    }

    res.status(500).json({
      error: "Failed to create daily record",
      message:
        "Please try submitting with shorter entries. If the problem persists, contact support.",
    });
  }
};

// Get all daily records (for admin) or user's own records
const getDailyRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    let query = {};

    // Check if this is an admin or intern request
    // If the user ID corresponds to a User (admin), show all records
    // If the user ID corresponds to an Intern, show only their records

    // First check if this is an admin user
    const adminUser = await require("../models/User").findById(userId);

    if (!adminUser) {
      // This is likely an intern login, filter by their records

      // Try to find intern by ID first (Google login case)
      let intern = await Intern.findById(userId);

      if (!intern) {
        // Try to find by email (backup case)
        intern = await Intern.findOne({ email: userEmail });
      }

      if (!intern) {
        return res.status(404).json({
          error: "Intern record not found. Please contact your administrator.",
          details: `No intern found for email: ${userEmail}`,
        });
      }

      query.internId = intern._id;
    } else {
      // Admin can see all records - no filter needed
    }

    const records = await DailyRecord.find(query)
      .populate("internId", "Trainee_Name Trainee_ID Trainee_Email")
      .sort({ createdAt: -1 });

    res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching daily records:", error);
    res.status(500).json({ error: "Failed to fetch daily records" });
  }
};

// Get a specific daily record by ID
const getDailyRecordById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const record = await DailyRecord.findById(id).populate(
      "internId",
      "traineeName traineeId email",
    );

    if (!record) {
      return res.status(404).json({ error: "Daily record not found" });
    }

    // Check if user has permission to view this record
    const adminUser = await require("../models/User").findById(userId);

    if (!adminUser) {
      // This is an intern user, check if they own this record
      const intern = await Intern.findById(userId);
      if (!intern || !record.internId._id.equals(intern._id)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    // Admin users can view any record

    res.status(200).json(record);
  } catch (error) {
    console.error("Error fetching daily record:", error);
    res.status(500).json({ error: "Failed to fetch daily record" });
  }
};

// Update a daily record
const updateDailyRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { task, progress, blockers, status } = req.body;
    const userId = req.user.id;

    // Check if leave status update is allowed (time restriction check)
    if (status === "leave") {
      const leaveCheck = checkLeaveSubmissionAllowed();
      if (!leaveCheck.allowed) {
        return res.status(403).json({
          error: leaveCheck.message,
          timeRestriction: true,
          currentTime: leaveCheck.currentTime,
        });
      }
    }

    const record = await DailyRecord.findById(id);

    if (!record) {
      return res.status(404).json({ error: "Daily record not found" });
    }

    // Check if user has permission to update this record
    const adminUser = await require("../models/User").findById(userId);

    if (!adminUser) {
      // This is an intern user, check if they own this record
      const intern = await Intern.findById(userId);
      if (!intern || !record.internId.equals(intern._id)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    // Admin users can update any record

    // Update the record
    if (task !== undefined) record.task = task;
    if (progress !== undefined) record.progress = progress;
    if (blockers !== undefined) record.blockers = blockers;
    if (status !== undefined) record.status = status;

    await record.save();
    await record.populate("internId", "traineeName traineeId email");

    res.status(200).json(record);
  } catch (error) {
    console.error("Error updating daily record:", error);
    res.status(500).json({ error: "Failed to update daily record" });
  }
};

// Delete a daily record
const deleteDailyRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const record = await DailyRecord.findById(id);

    if (!record) {
      return res.status(404).json({ error: "Daily record not found" });
    }

    // Check if user has permission to delete this record
    const adminUser = await require("../models/User").findById(userId);

    if (!adminUser) {
      // This is an intern user, check if they own this record
      const intern = await Intern.findById(userId);
      if (!intern || !record.internId.equals(intern._id)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    // Admin users can delete any record

    await DailyRecord.findByIdAndDelete(id);
    res.status(200).json({ message: "Daily record deleted successfully" });
  } catch (error) {
    console.error("Error deleting daily record:", error);
    res.status(500).json({ error: "Failed to delete daily record" });
  }
};

const exportDailyRecordsPDF = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    const { date, startDate, endDate } = req.query;

    let query = {};
    let dateLabel = "";

    // Date field is stored as a plain "YYYY-MM-DD" string in MongoDB.
    if (date) {
      query.date = date;
      dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } else if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
      const s = new Date(startDate + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const e = new Date(endDate + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      dateLabel = `${s} – ${e}`;
    } else {
      dateLabel = "All Records";
    }

    const adminUser = await require("../models/User").findById(userId);
    const isAdmin = !!adminUser;

    if (!isAdmin) {
      let intern = await Intern.findById(userId);
      if (!intern) intern = await Intern.findOne({ email: userEmail });
      if (!intern) {
        return res.status(404).json({ error: "Intern record not found." });
      }
      query.internId = intern._id;
    }

    const records = await DailyRecord.find(query)
      .populate("internId", "Trainee_Name Trainee_ID Trainee_Email")
      .sort({ internId: 1, date: -1 }); // newest record first within each intern

    // PDF setup
    const doc = new PDFDocument({ margin: 40, size: "A4" });

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    const pdfDone = new Promise((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    // Layout constants
    const TABLE_LEFT = 40;
    const TABLE_WIDTH = 515;
    const PAGE_BOTTOM = doc.page.height - 40; // bottom margin
    const HEADER_H = 24;
    const FONT_SIZE = 7.5;
    const LINE_HEIGHT = FONT_SIZE * 1.35;
    const PADDING_V = 8;
    const MIN_ROW_H = 36;

    const COLS = {
      no: 30,
      date: 62,
      stack: 65,
      status: 52,
      task: 153,
      challenges: 153,
    };

    const statusMap = { wfh: "WFH", leave: "On Leave", working: "Working" };

    // Opens a new page and returns the Y to start drawing at.
    const addPage = () => {
      doc.addPage();
      return 40; // top margin on the fresh page
    };

    // Row-height measurement
    const measureTextHeight = (text, width) => {
      if (!text) return LINE_HEIGHT;
      return doc.fontSize(FONT_SIZE).heightOfString(text, { width });
    };

    const calcRowHeight = (taskText, challengeText) => {
      const h = Math.max(
        measureTextHeight(taskText, COLS.task),
        measureTextHeight(challengeText, COLS.challenges),
      );
      return Math.max(MIN_ROW_H, h + PADDING_V * 2);
    };

    // Drawing helpers
    const drawTableHeader = (y) => {
      doc.rect(TABLE_LEFT, y, TABLE_WIDTH, HEADER_H).fill("#0b5394");
      doc.fontSize(8).font("Helvetica-Bold").fillColor("white");

      let x = TABLE_LEFT + 4;
      const ty = y + 8;
      doc.text("No.", x, ty, { width: COLS.no, align: "center" });
      x += COLS.no;
      doc.text("Date", x, ty, { width: COLS.date, align: "left" });
      x += COLS.date;
      doc.text("Stack", x, ty, { width: COLS.stack, align: "left" });
      x += COLS.stack;
      doc.text("Status", x, ty, { width: COLS.status, align: "left" });
      x += COLS.status;
      doc.text("Tasks Completed", x, ty, { width: COLS.task, align: "left" });
      x += COLS.task;
      doc.text("Challenges Faced", x, ty, {
        width: COLS.challenges,
        align: "left",
      });

      doc.font("Helvetica").fillColor("black");
      return y + HEADER_H;
    };

    const drawRow = (record, rowIndex, rowNumber, y) => {
      const taskText = record.task || "";
      const challengeText = record.progress || "";
      const rowH = calcRowHeight(taskText, challengeText);

      doc
        .rect(TABLE_LEFT, y, TABLE_WIDTH, rowH)
        .fill(rowIndex % 2 === 0 ? "#f5f7fa" : "#ffffff");

      doc.fontSize(FONT_SIZE).font("Helvetica").fillColor("#222222");

      // Pin every cell to the same top-Y so text starts at the same baseline
      const ty = y + PADDING_V;
      let x = TABLE_LEFT + 4;

      doc.text(String(rowNumber), x, ty, {
        width: COLS.no,
        align: "center",
        lineBreak: false,
      });
      x += COLS.no;

      // Append T00:00:00 to prevent timezone shift on date-string fields
      const formattedDate = record.date
        ? new Date(record.date + "T00:00:00").toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "N/A";
      doc.text(formattedDate, x, ty, {
        width: COLS.date,
        lineBreak: false,
      });
      x += COLS.date;

      doc.text(record.stack || "N/A", x, ty, {
        width: COLS.stack,
        lineBreak: false,
      });
      x += COLS.stack;

      doc.text(statusMap[record.status] || record.status || "Working", x, ty, {
        width: COLS.status,
        lineBreak: false,
      });
      x += COLS.status;

      // Wrapped text columns — same starting Y, different widths
      doc.text(taskText, x, ty, { width: COLS.task, lineBreak: true });
      x += COLS.task;
      doc.text(challengeText, x, ty, {
        width: COLS.challenges,
        lineBreak: true,
      });

      doc
        .moveTo(TABLE_LEFT, y + rowH)
        .lineTo(TABLE_LEFT + TABLE_WIDTH, y + rowH)
        .strokeColor("#d0d7de")
        .lineWidth(0.4)
        .stroke();

      return y + rowH;
    };

    const drawInternHeader = (name, traineeId, y) => {
      // Start a new page if the block + at least one table-header won't fit
      if (y + 55 > PAGE_BOTTOM) y = addPage();

      const blockH = 42;
      doc.rect(TABLE_LEFT, y, TABLE_WIDTH, blockH).fill("#e8f0fe");
      doc.rect(TABLE_LEFT, y, TABLE_WIDTH, blockH).stroke("#c5d3f0");

      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#0b3c8c")
        .text(name || "Unknown Intern", TABLE_LEFT + 12, y + 7, {
          width: TABLE_WIDTH - 24,
          lineBreak: false,
        });

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#3a5a8c")
        .text(`Trainee ID: ${traineeId || "N/A"}`, TABLE_LEFT + 12, y + 23, {
          width: TABLE_WIDTH - 24,
          lineBreak: false,
        });

      doc.font("Helvetica").fillColor("black");
      return y + blockH + 4;
    };

    // Cover / title section
    try {
      doc.image(SLT_LOGO_BUFFER, 40, 40, { fit: [120, 70] });
    } catch (_) {
      /* skip invalid logo */
    }

    doc.moveDown(4);

    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor("#0b5394")
      .text("Daily Log Records Report", { align: "center" });

    doc.moveDown(0.4);

    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#333333")
      .text(`Period: ${dateLabel}`, { align: "center" });

    doc
      .fontSize(9)
      .fillColor("#666666")
      .text(
        `Generated on: ${new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}`,
        { align: "center" },
      );

    doc.moveDown(1.2);

    // No records edge-case
    if (records.length === 0) {
      doc
        .fontSize(12)
        .font("Helvetica")
        .fillColor("#666666")
        .text("No records found for the selected period.", { align: "center" });

      writeFooter();
      doc.end();

      const buffer = await pdfDone;
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="daily-records-${date || "all"}.pdf"`,
        "Content-Length": buffer.length,
      });
      return res.send(buffer);
    }

    // Build table(s)
    let currentY = doc.y;

    if (isAdmin) {
      // Group records by intern, preserving the sort order from Mongo
      const groups = new Map();
      for (const r of records) {
        const key = String(r.internId?._id || "unknown");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      }

      const groupEntries = [...groups.entries()];

      groupEntries.forEach(([, groupRecords], groupIdx) => {
        const first = groupRecords[0];
        const name = first.internId?.Trainee_Name || "Unknown Intern";
        const traineeId = first.internId?.Trainee_ID || "N/A";

        currentY = drawInternHeader(name, traineeId, currentY);
        currentY = drawTableHeader(currentY);

        groupRecords.forEach((record, idx) => {
          const rowH = calcRowHeight(record.task || "", record.progress || "");
          if (currentY + rowH > PAGE_BOTTOM) {
            currentY = addPage();
            currentY = drawTableHeader(currentY);
          }
          currentY = drawRow(record, idx, idx + 1, currentY);
        });

        // Only add spacing/page-break between groups, never after the last one
        const isLastGroup = groupIdx === groupEntries.length - 1;
        if (!isLastGroup) {
          currentY += 16;
          if (currentY + 80 > PAGE_BOTTOM) {
            currentY = addPage();
          }
        }
      });
    } else {
      // Single intern — one header block then the full table
      const first = records[0];
      const name = first.internId?.Trainee_Name || "Unknown Intern";
      const traineeId = first.internId?.Trainee_ID || "N/A";

      currentY = drawInternHeader(name, traineeId, currentY);
      currentY = drawTableHeader(currentY);

      records.forEach((record, idx) => {
        const rowH = calcRowHeight(record.task || "", record.progress || "");
        if (currentY + rowH > PAGE_BOTTOM) {
          currentY = addPage();
          currentY = drawTableHeader(currentY);
        }
        currentY = drawRow(record, idx, idx + 1, currentY);
      });
    }

    doc.end();

    const buffer = await pdfDone;
    const filename = date
      ? `daily-records-${date}.pdf`
      : "daily-records-all.pdf";

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length,
    });
    return res.send(buffer);
  } catch (error) {
    console.error("Error exporting daily records PDF:", error);
    res.status(500).json({ error: "Failed to export records as PDF" });
  }
};

module.exports = {
  createDailyRecord,
  getDailyRecords,
  getDailyRecordById,
  updateDailyRecord,
  deleteDailyRecord,
  exportDailyRecordsPDF,
};
