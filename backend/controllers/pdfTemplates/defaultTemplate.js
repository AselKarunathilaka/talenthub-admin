const {
  SLT_LOGO_BUFFER,
  PDFDocument,
  collectBuffer,
  STATUS_LABELS,
  todayLabel,
} = require("./baseTemplate");

// ── Layout constants ──────────────────────────────────────────────────────────
const TABLE_LEFT = 40;
const TABLE_WIDTH = 515;
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

// ── Private helpers ───────────────────────────────────────────────────────────
const measureH = (doc, text, width) =>
  text ? doc.fontSize(FONT_SIZE).heightOfString(text, { width }) : LINE_HEIGHT;

const calcRowH = (doc, taskText, challengeText) =>
  Math.max(
    MIN_ROW_H,
    Math.max(
      measureH(doc, taskText, COLS.task),
      measureH(doc, challengeText, COLS.challenges),
    ) +
      PADDING_V * 2,
  );

const addPage = (doc) => {
  doc.addPage();
  return 40;
};

const pageBottom = (doc) => doc.page.height - 40;

const drawTableHeader = (doc, y) => {
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

const drawRow = (doc, record, rowIndex, rowNumber, y) => {
  const taskText = record.task || "";
  const challengeText = record.progress || "";
  const rowH = calcRowH(doc, taskText, challengeText);

  doc
    .rect(TABLE_LEFT, y, TABLE_WIDTH, rowH)
    .fill(rowIndex % 2 === 0 ? "#f5f7fa" : "#ffffff");

  doc.fontSize(FONT_SIZE).font("Helvetica").fillColor("#222222");
  const ty = y + PADDING_V;
  let x = TABLE_LEFT + 4;

  doc.text(String(rowNumber), x, ty, {
    width: COLS.no,
    align: "center",
    lineBreak: false,
  });
  x += COLS.no;

  const formattedDate = record.date
    ? new Date(record.date + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "N/A";
  doc.text(formattedDate, x, ty, { width: COLS.date, lineBreak: false });
  x += COLS.date;

  doc.text(record.stack || "N/A", x, ty, {
    width: COLS.stack,
    lineBreak: false,
  });
  x += COLS.stack;
  doc.text(STATUS_LABELS[record.status] || record.status || "Working", x, ty, {
    width: COLS.status,
    lineBreak: false,
  });
  x += COLS.status;
  doc.text(taskText, x, ty, { width: COLS.task, lineBreak: true });
  x += COLS.task;
  doc.text(challengeText, x, ty, { width: COLS.challenges, lineBreak: true });

  doc
    .moveTo(TABLE_LEFT, y + rowH)
    .lineTo(TABLE_LEFT + TABLE_WIDTH, y + rowH)
    .strokeColor("#d0d7de")
    .lineWidth(0.4)
    .stroke();

  return y + rowH;
};

const drawInternHeader = (doc, name, traineeId, y) => {
  const PAGE_BOTTOM = pageBottom(doc);
  if (y + 55 > PAGE_BOTTOM) y = addPage(doc);

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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate the default SLT-branded PDF.
 * @param {object[]} records  Populated Mongoose documents.
 * @param {object}   opts     { dateLabel, isAdmin }
 * @returns {Promise<Buffer>}
 */
const generate = async (records, { dateLabel, isAdmin }) => {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const bufferPromise = collectBuffer(doc);

  // ── Cover / title section ─────────────────────────────────────────────────
  try {
    doc.image(SLT_LOGO_BUFFER, 40, 40, { fit: [120, 70] });
  } catch (_) {}

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
    .text(`Generated on: ${todayLabel()}`, { align: "center" });
  doc.moveDown(1.2);

  if (records.length === 0) {
    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#666666")
      .text("No records found for the selected period.", { align: "center" });
    doc.end();
    return bufferPromise;
  }

  let currentY = doc.y;
  const PAGE_BOTTOM = pageBottom(doc);

  const renderGroup = (groupRecords, name, traineeId) => {
    currentY = drawInternHeader(doc, name, traineeId, currentY);
    currentY = drawTableHeader(doc, currentY);

    groupRecords.forEach((record, idx) => {
      const rowH = calcRowH(doc, record.task || "", record.progress || "");
      if (currentY + rowH > pageBottom(doc)) {
        currentY = addPage(doc);
        currentY = drawTableHeader(doc, currentY);
      }
      currentY = drawRow(doc, record, idx, idx + 1, currentY);
    });
  };

  if (isAdmin) {
    const groups = new Map();
    for (const r of records) {
      const key = String(r.internId?._id || "unknown");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    const entries = [...groups.entries()];
    entries.forEach(([, groupRecords], gIdx) => {
      const first = groupRecords[0];
      const name = first.internId?.Trainee_Name || "Unknown Intern";
      const traineeId = first.internId?.Trainee_ID || "N/A";
      renderGroup(groupRecords, name, traineeId);

      if (gIdx < entries.length - 1) {
        currentY += 16;
        if (currentY + 80 > pageBottom(doc)) currentY = addPage(doc);
      }
    });
  } else {
    const first = records[0];
    const name = first.internId?.Trainee_Name || "Unknown Intern";
    const traineeId = first.internId?.Trainee_ID || "N/A";
    renderGroup(records, name, traineeId);
  }

  doc.end();
  return bufferPromise;
};

module.exports = { generate, id: "default", label: "Standard (SLT)" };
