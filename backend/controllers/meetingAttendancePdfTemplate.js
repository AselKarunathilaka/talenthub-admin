const PDFDocument = require("pdfkit");
// ── SLT Logo (embedded so templates don't need to import it) ─────────────────
const SLT_LOGO_BASE64 =
  "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";
const SLT_LOGO_BUFFER = Buffer.from(SLT_LOGO_BASE64, "base64");

// ── Brand colours ─────────────────────────────────────────────────────────────
const BRAND_BLUE = "#1a4f8b";
const BRAND_TEAL = "#00a79d";
const ROW_ALT = "#f0f6fc";
const TEXT_DARK = "#1a1a2e";
const TEXT_MID = "#4a5568";
const WHITE = "#ffffff";
const BORDER = "#e2e8f0";

// ── Layout (A4 portrait) ──────────────────────────────────────────────────────
const PAGE_MARGIN = 40;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const FOOTER_HEIGHT = 25;

// How tall the first-page header is (logo bar + stripe + title + 3 meta lines + divider)
const FIRST_PAGE_HEADER_H = 172;
// How tall continuation-page column header row is (approx)
const COL_HEADER_H = 32;

// ── Columns ───────────────────────────────────────────────────────────────────
const COLS = [
  { label: "Trainee\nID", w: 0.12 },
  { label: "Name", w: 0.28 },
  { label: "Field of\nSpecialization", w: 0.18 },
  { label: "Institute", w: 0.28 },
  { label: "Attendance", w: 0.14 },
];

function colWidths() {
  return COLS.map((c) => Math.floor(c.w * CONTENT_WIDTH));
}

// ── Row height calculation (dry-run, no drawing) ──────────────────────────────
function cellHeight(doc, text, colW, fontSize, padding = 8) {
  doc.fontSize(fontSize);
  const h = doc.heightOfString(String(text), { width: colW - padding * 2 });
  return Math.max(h + padding * 2, 24);
}

function rowHeight(doc, rowData, widths, isHeader) {
  const PADDING = 8;
  let h = isHeader ? 32 : 24;
  rowData.forEach((text, i) => {
    const ch = cellHeight(doc, String(text), widths[i], 8, PADDING);
    if (ch > h) h = ch;
  });
  return h;
}

// ── Pre-calculate total pages without drawing ─────────────────────────────────
function calcTotalPages(doc, rows, widths) {
  // Footer is drawn inside the page bottom margin, so we use PAGE_HEIGHT - PAGE_MARGIN as the usable bottom
  const usableFirst =
    PAGE_HEIGHT -
    PAGE_MARGIN -
    FIRST_PAGE_HEADER_H -
    COL_HEADER_H -
    FOOTER_HEIGHT;
  const usableRest =
    PAGE_HEIGHT - PAGE_MARGIN - COL_HEADER_H - FOOTER_HEIGHT - PAGE_MARGIN;

  let pages = 1;
  let remaining = usableFirst;

  for (const row of rows) {
    const h = rowHeight(doc, row, widths, false);
    if (remaining - h < 0) {
      pages++;
      remaining = usableRest;
    }
    remaining -= h;
  }
  return pages;
}

// ── Drawing helpers ───────────────────────────────────────────────────────────
function drawRow(doc, rowData, x, y, widths, isHeader, isAlt) {
  const PADDING = 8;
  const h = rowHeight(doc, rowData, widths, isHeader);

  if (isHeader) doc.rect(x, y, CONTENT_WIDTH, h).fill(BRAND_BLUE);
  else if (isAlt) doc.rect(x, y, CONTENT_WIDTH, h).fill(ROW_ALT);
  else doc.rect(x, y, CONTENT_WIDTH, h).fill(WHITE);

  let cx = x;
  rowData.forEach((text, i) => {
    if (i > 0) {
      doc
        .moveTo(cx, y)
        .lineTo(cx, y + h)
        .strokeColor(isHeader ? "#2d6aad" : BORDER)
        .lineWidth(0.5)
        .stroke();
    }
    doc
      .font(isHeader ? "Helvetica-Bold" : "Helvetica")
      .fontSize(8)
      .fillColor(isHeader ? WHITE : TEXT_DARK)
      .text(String(text), cx + PADDING, y + PADDING, {
        width: widths[i] - PADDING * 2,
        lineBreak: true,
        ellipsis: false,
      });
    cx += widths[i];
  });

  doc
    .moveTo(x, y + h)
    .lineTo(x + CONTENT_WIDTH, y + h)
    .strokeColor(BORDER)
    .lineWidth(0.5)
    .stroke();
  doc
    .moveTo(x, y)
    .lineTo(x, y + h)
    .strokeColor(BORDER)
    .lineWidth(0.5)
    .stroke();
  doc
    .moveTo(x + CONTENT_WIDTH, y)
    .lineTo(x + CONTENT_WIDTH, y + h)
    .strokeColor(BORDER)
    .lineWidth(0.5)
    .stroke();

  return h;
}

// ── FIX: Footer drawn inside the page, not beyond PAGE_HEIGHT ─────────────────
function drawFooter(doc, pageNum, totalPages) {
  // Use PAGE_HEIGHT - PAGE_MARGIN - FOOTER_HEIGHT so the footer stays within
  // the page boundary and never triggers a new page.
  const footerY = PAGE_HEIGHT - PAGE_MARGIN - FOOTER_HEIGHT + 8;
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(TEXT_MID)
    .text(
      `TalentHub Intern Management System  •  Meeting Attendance  •  Page ${pageNum} of ${totalPages}`,
      PAGE_MARGIN,
      footerY,
      { width: CONTENT_WIDTH, align: "center" },
    );
}

// ── First-page header ─────────────────────────────────────────────────────────
function drawFirstPageHeader(doc, date, totalCount, sortedBy) {
  const x = PAGE_MARGIN;
  let y = PAGE_MARGIN;

  doc.rect(x, y, CONTENT_WIDTH, 56).fill(WHITE);
  try {
    doc.image(SLT_LOGO_BUFFER, x + 8, y + 6, { height: 44, fit: [120, 44] });
  } catch (_) {
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor(BRAND_BLUE)
      .text("SLT", x + 10, y + 14, { continued: true })
      .fillColor(BRAND_TEAL)
      .text("MOBITEL");
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(TEXT_MID)
      .text("The Connection", x + 10, y + 38);
  }
  doc.rect(x, y + 56, CONTENT_WIDTH, 3).fill(BRAND_TEAL);
  y += 70;

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(TEXT_DARK)
    .text("Intern Meeting Attendance Report", x, y);
  y += 28;

  [
    ["Date:", date],
    ["Sorted by:", sortedBy || "None"],
    ["Total Attendance Count:", String(totalCount)],
  ].forEach(([label, value]) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(TEXT_DARK)
      .text(label, x, y, { continued: true })
      .font("Helvetica")
      .fillColor(TEXT_DARK)
      .text("  " + value);
    y += 16;
  });

  y += 4;
  doc
    .moveTo(x, y)
    .lineTo(x + CONTENT_WIDTH, y)
    .strokeColor(BRAND_TEAL)
    .lineWidth(1.5)
    .stroke();
  y += 12;
  return y;
}

// ── Main export ───────────────────────────────────────────────────────────────
async function generateMeetingAttendancePdf({ date, interns, sortedBy }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        layout: "portrait",
        margins: {
          top: PAGE_MARGIN,
          bottom: PAGE_MARGIN,
          left: PAGE_MARGIN,
          right: PAGE_MARGIN,
        },
        autoFirstPage: false,
      });

      const buffers = [];
      doc.on("data", (c) => buffers.push(c));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const widths = colWidths();

      // Sort ascending by numeric Trainee ID
      const sorted = [...interns].sort((a, b) => Number(a.id) - Number(b.id));

      const rows = sorted.map((intern) => [
        String(intern.id),
        intern.name || "—",
        intern.fieldOfSpecialization || "—",
        intern.institute || "—",
        "Present",
      ]);

      // ── Step 1: pre-calculate total pages (no drawing) ──
      const totalPages = calcTotalPages(doc, rows, widths);

      // ── Step 2: render everything in a single forward pass ──
      const usableFirst =
        PAGE_HEIGHT -
        PAGE_MARGIN -
        FIRST_PAGE_HEADER_H -
        COL_HEADER_H -
        FOOTER_HEIGHT;
      const usableRest =
        PAGE_HEIGHT - PAGE_MARGIN - COL_HEADER_H - FOOTER_HEIGHT - PAGE_MARGIN;

      let pageNum = 1;

      // Page 1 — full header
      doc.addPage();
      let y = drawFirstPageHeader(doc, date, sorted.length, sortedBy);
      y += drawRow(
        doc,
        COLS.map((c) => c.label),
        PAGE_MARGIN,
        y,
        widths,
        true,
        false,
      );
      let remaining = usableFirst;

      let rowIndex = 0;
      while (rowIndex < rows.length) {
        const row = rows[rowIndex];
        const isAlt = rowIndex % 2 === 1;
        const h = rowHeight(doc, row, widths, false);

        if (remaining - h < 0) {
          drawFooter(doc, pageNum, totalPages);
          pageNum++;
          doc.addPage();
          y = PAGE_MARGIN;
          y += drawRow(
            doc,
            COLS.map((c) => c.label),
            PAGE_MARGIN,
            y,
            widths,
            true,
            false,
          );
          remaining = usableRest;
        }

        y += drawRow(doc, row, PAGE_MARGIN, y, widths, false, isAlt);
        remaining -= h;
        rowIndex++;
      }

      // Footer on the last page
      drawFooter(doc, pageNum, totalPages);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateMeetingAttendancePdf };
