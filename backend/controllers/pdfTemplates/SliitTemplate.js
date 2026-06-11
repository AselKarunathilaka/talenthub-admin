/**
 * SliitTemplate.js — SLIIT Form I-3A "Intern's Daily Diary" (.docx)
 *
 * Generates a Word document matching the official SLIIT Form I-3A layout:
 *   - Header: "Faculty of Computing" + "Form I – 3A" + "INTERN'S DAILY DIARY"
 *   - Intern's Information table  (Name | Student ID)
 *   - Internship Information table (Title | Specialisation | Supervisor Name)
 *   - Per-week Training Information table (DATE | DETAILS AND NOTES…)
 *   - Supervisor Comments For the Week (blank)
 *   - Supervisor Signature | Date row
 *
 * Intern name and Student ID are pre-filled from record data.
 * All supervisor/internship fields are left blank for the student to complete.
 *
 * Date normalisation mirrors IitTemplate.js — handles DD/MM/YYYY, YYYY-MM-DD,
 * ISO strings, and Date objects correctly regardless of server timezone.
 *
 * Requires: npm install docx
 */

const docxModule = require("docx");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  PageBreak,
} = docxModule;

// ── Page / column widths (DXA: 1440 = 1 inch) ────────────────────────────────
// A4 with 1cm margins each side ≈ 11906 - 2 * 567 = 10772 DXA content width
const PAGE_W = 11906;
const MARGIN = 720; // ~1.27 cm
const CONTENT_W = PAGE_W - 2 * MARGIN; // 10466 DXA

// Training table column widths
const DATE_W = 1800;
const DETAIL_W = CONTENT_W - DATE_W;

// ── Colours ───────────────────────────────────────────────────────────────────
const LIGHT_GREY = "E8E8E8";
const WHITE = "FFFFFF";
const DARK_GREY = "404040";

// ── Border helpers ────────────────────────────────────────────────────────────
const bSingle = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const bNil = { style: BorderStyle.NIL, size: 0, color: "000000" };
const allBorders = {
  top: bSingle,
  bottom: bSingle,
  left: bSingle,
  right: bSingle,
};
const noBorders = { top: bNil, bottom: bNil, left: bNil, right: bNil };

// ── Cell margin ───────────────────────────────────────────────────────────────
const cellPad = { top: 80, bottom: 80, left: 120, right: 120 };
const cellPadSm = { top: 60, bottom: 60, left: 100, right: 100 };

// ── Text run helpers ──────────────────────────────────────────────────────────
const run = (text, opts = {}) =>
  new TextRun({ text: text ?? "", font: "Arial", size: 18, ...opts });
const runB = (text, opts = {}) => run(text, { bold: true, ...opts });

// ── Date normalisation (same logic as IitTemplate) ────────────────────────────
function toLocalDateStr(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function normaliseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date)
    return isNaN(raw.getTime()) ? null : toLocalDateStr(raw);
  let s = String(raw).trim();
  const tIdx = s.indexOf("T");
  if (tIdx !== -1) s = s.slice(0, tIdx);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const sl = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (sl) {
    const [, d, m, y] = sl;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const da = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (da) {
    const [, m, d, y] = da;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const p = new Date(s);
  if (!isNaN(p.getTime())) return toLocalDateStr(p);
  console.warn("[SLIIT] Cannot parse date:", raw);
  return null;
}

function extractDateStr(r) {
  const fd = normaliseDate(r.date);
  if (fd) return fd;
  if (r.createdAt)
    return normaliseDate(r.createdAt) ?? toLocalDateStr(new Date(r.createdAt));
  return null;
}

function fmtDisplay(ds) {
  if (!ds) return "";
  const d = new Date(ds + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function weekBounds(ds) {
  const d = new Date(ds + "T00:00:00");
  const dow = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { mon, sun };
}

function groupByWeek(records) {
  const map = new Map();
  for (const r of records) {
    const ds = extractDateStr(r);
    if (!ds) {
      console.warn("[SLIIT] Skip unparseable date", r._id, r.date);
      continue;
    }
    const { mon, sun } = weekBounds(ds);
    const key = toLocalDateStr(mon);
    if (!map.has(key)) map.set(key, { mon, sun, records: [] });
    map.get(key).records.push({ ...r, _ds: ds });
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

function recordForDay(wRecs, di, mon) {
  const t = new Date(mon);
  t.setDate(mon.getDate() + di);
  const ts = toLocalDateStr(t);
  return wRecs.find((r) => r._ds === ts) ?? null;
}

const DEFAULT_PROGRESS = "No challenges faced";
const DEFAULT_BLOCKERS = "No specific plans";
function hasContent(v, ph) {
  return v && v.trim() !== "" && v.trim() !== ph;
}

// ── Mongoose → plain ──────────────────────────────────────────────────────────
function toPlain(r) {
  if (!r) return r;
  if (typeof r.toObject === "function") return r.toObject();
  if (typeof r.toJSON === "function") return r.toJSON();
  return r;
}

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

// ── Table builders ────────────────────────────────────────────────────────────

/** Simple shaded header cell spanning full width */
function headerCell(text, colSpan = 1, bold = true, shading = LIGHT_GREY) {
  return new TableCell({
    columnSpan: colSpan,
    borders: allBorders,
    shading: { fill: shading, type: ShadingType.CLEAR },
    margins: cellPad,
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [bold ? runB(text, { size: 20 }) : run(text, { size: 18 })],
      }),
    ],
  });
}

/** Plain content cell */
function contentCell(text, colSpan = 1, bold = false, minHeight = false) {
  const children = [
    new Paragraph({
      children: [bold ? runB(text ?? "") : run(text ?? "")],
    }),
  ];
  return new TableCell({
    columnSpan: colSpan,
    borders: allBorders,
    margins: cellPad,
    verticalAlign: VerticalAlign.TOP,
    children,
  });
}

/** Label cell (right-aligned, no border) */
function labelCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: noBorders,
    margins: cellPadSm,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [run(text, { size: 18 })],
      }),
    ],
  });
}

/** Input cell (full border) */
function inputCell(value, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: allBorders,
    margins: cellPadSm,
    children: [
      new Paragraph({
        children: [run(value ?? "", { size: 18 })],
      }),
    ],
  });
}

// ── Week block builder ────────────────────────────────────────────────────────
function buildWeekBlock(week, isFirst) {
  const { mon, sun, records: wRecs } = week;
  const weekLabel = `${fmtDisplay(toLocalDateStr(mon))} – ${fmtDisplay(toLocalDateStr(sun))}`;
  const elements = [];

  if (!isFirst) {
    // Small spacing before next week
    elements.push(new Paragraph({ children: [run("")] }));
  }

  // Training Information header row
  const trainingRows = [
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          borders: allBorders,
          shading: { fill: LIGHT_GREY, type: ShadingType.CLEAR },
          margins: cellPad,
          children: [
            new Paragraph({
              children: [
                runB("Training Information For the Week", { size: 20 }),
                run("  (to be filled by the intern)", {
                  size: 18,
                  italics: true,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    // Week range row
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          borders: allBorders,
          margins: cellPadSm,
          children: [
            new Paragraph({
              children: [run(`Week: ${weekLabel}`, { size: 16 })],
            }),
          ],
        }),
      ],
    }),
    // Column headers
    new TableRow({
      children: [
        new TableCell({
          width: { size: DATE_W, type: WidthType.DXA },
          borders: allBorders,
          shading: { fill: LIGHT_GREY, type: ShadingType.CLEAR },
          margins: cellPad,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [runB("DATE", { size: 18 })],
            }),
          ],
        }),
        new TableCell({
          width: { size: DETAIL_W, type: WidthType.DXA },
          borders: allBorders,
          shading: { fill: LIGHT_GREY, type: ShadingType.CLEAR },
          margins: cellPad,
          children: [
            new Paragraph({
              children: [
                runB(
                  "DETAILS AND NOTES OF WORK CARRIED OUT, PROBLEMS ENCOUNTERED AND HOW SOLVED ETC., SKETCHES AND DIMENSIONS TO BE GIVEN WHEREVER POSSIBLE.",
                  { size: 18 },
                ),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  // Day rows
  for (let di = 0; di < 7; di++) {
    const rec = recordForDay(wRecs, di, mon);
    const dayDate = new Date(mon);
    dayDate.setDate(mon.getDate() + di);
    const dateStr = `${DAYS[di]}\n${fmtDisplay(toLocalDateStr(dayDate))}`;

    const detailParts = [];
    if (rec) {
      if (rec.task) detailParts.push(rec.task);
      if (rec.status === "leave") detailParts.push("[On Leave]");
      if (rec.status === "study_leave") detailParts.push("[Extended Leave]");
      if (rec.status === "wfh") detailParts.push("[Work From Home]");
      if (rec.stack && rec.stack !== "On Leave")
        detailParts.push(`Stack: ${rec.stack}`);
      if (hasContent(rec.progress, DEFAULT_PROGRESS))
        detailParts.push(`Problems: ${rec.progress}`);
      if (hasContent(rec.blockers, DEFAULT_BLOCKERS))
        detailParts.push(`Solution: ${rec.blockers}`);
    }
    const detailText = detailParts.join("\n");

    // Build date cell paragraphs (day name bold, date normal)
    const dateParagraphs = [
      new Paragraph({ children: [runB(DAYS[di], { size: 16 })] }),
      new Paragraph({
        children: [run(fmtDisplay(toLocalDateStr(dayDate)), { size: 16 })],
      }),
    ];

    // Build detail cell paragraphs (split on \n)
    const detailParagraphs = detailText
      ? detailText
          .split("\n")
          .map((line) => new Paragraph({ children: [run(line, { size: 18 })] }))
      : [new Paragraph({ children: [run("")] })];

    trainingRows.push(
      new TableRow({
        height: { value: 800, rule: "atLeast" },
        children: [
          new TableCell({
            width: { size: DATE_W, type: WidthType.DXA },
            borders: allBorders,
            margins: cellPad,
            verticalAlign: VerticalAlign.TOP,
            children: dateParagraphs,
          }),
          new TableCell({
            width: { size: DETAIL_W, type: WidthType.DXA },
            borders: allBorders,
            margins: cellPad,
            verticalAlign: VerticalAlign.TOP,
            children: detailParagraphs,
          }),
        ],
      }),
    );
  }

  elements.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [DATE_W, DETAIL_W],
      rows: trainingRows,
    }),
  );

  // Supervisor comments table
  elements.push(new Paragraph({ children: [run("")] }));
  elements.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [CONTENT_W],
      rows: [
        new TableRow({
          children: [
            headerCell("SUPERVISOR COMMENTS FOR THE WEEK", 1, true, LIGHT_GREY),
          ],
        }),
        new TableRow({
          height: { value: 1440, rule: "atLeast" },
          children: [contentCell("", 1)],
        }),
      ],
    }),
  );

  // Supervisor signature / date row
  const SIG_W = Math.round(CONTENT_W * 0.5);
  const DLBL_W = Math.round(CONTENT_W * 0.15);
  const DVAL_W = CONTENT_W - SIG_W - DLBL_W;

  elements.push(new Paragraph({ children: [run("")] }));
  elements.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [SIG_W, DLBL_W, DVAL_W],
      rows: [
        new TableRow({
          height: { value: 720, rule: "atLeast" },
          children: [
            new TableCell({
              width: { size: SIG_W, type: WidthType.DXA },
              borders: allBorders,
              margins: cellPad,
              children: [
                new Paragraph({
                  children: [runB("Supervisor's Signature", { size: 18 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: DLBL_W, type: WidthType.DXA },
              borders: allBorders,
              shading: { fill: LIGHT_GREY, type: ShadingType.CLEAR },
              margins: cellPad,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [runB("Date", { size: 18 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: DVAL_W, type: WidthType.DXA },
              borders: allBorders,
              margins: cellPad,
              children: [new Paragraph({ children: [run("")] })],
            }),
          ],
        }),
      ],
    }),
  );

  return elements;
}

// ── Document builder for one intern ──────────────────────────────────────────
function buildInternSection(intern, isFirstIntern) {
  const elements = [];

  if (!isFirstIntern) {
    elements.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // "Faculty of Computing" header
  elements.push(
    new Paragraph({
      children: [run("Faculty of Computing", { size: 22, italics: true })],
      spacing: { after: 80 },
    }),
  );

  // "Form I – 3A"
  elements.push(
    new Paragraph({
      children: [runB("Form I \u2013 3A", { size: 32 })],
      spacing: { after: 40 },
    }),
  );

  // "INTERN'S DAILY DIARY"
  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [runB("INTERN\u2019S DAILY DIARY", { size: 24 })],
      spacing: { after: 80 },
    }),
  );

  // Italic instruction note
  elements.push(
    new Paragraph({
      children: [
        run(
          "(To be filled by the Intern\u2013 Please ensure to upload duly filled set of forms at end of four weeks to the provided folder)",
          { italics: true, size: 16 },
        ),
      ],
      spacing: { after: 160 },
    }),
  );

  // ── Intern's Information ──────────────────────────────────────────────────
  elements.push(
    new Paragraph({
      children: [runB("Intern\u2019s Information", { size: 20 })],
      spacing: { after: 60 },
    }),
  );

  const nameW = Math.round(CONTENT_W * 0.14);
  const nameVW = Math.round(CONTENT_W * 0.37);
  const idLW = Math.round(CONTENT_W * 0.12);
  const idVW = CONTENT_W - nameW - nameVW - idLW;

  elements.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [nameW, nameVW, idLW, idVW],
      rows: [
        new TableRow({
          children: [
            labelCell("Intern\u2019s Name", nameW),
            inputCell(intern.name, nameVW),
            labelCell("Student ID", idLW),
            inputCell("", idVW),
          ],
        }),
      ],
    }),
  );
  elements.push(new Paragraph({ children: [run("")], spacing: { after: 80 } }));

  // ── Internship Information ────────────────────────────────────────────────
  elements.push(
    new Paragraph({
      children: [runB("Internship Information", { size: 20 })],
      spacing: { after: 60 },
    }),
  );

  const tLW = Math.round(CONTENT_W * 0.14);
  const tVW = Math.round(CONTENT_W * 0.37);
  const spLW = Math.round(CONTENT_W * 0.13);
  const spVW = CONTENT_W - tLW - tVW - spLW;
  const supLW = Math.round(CONTENT_W * 0.14);
  const supVW = CONTENT_W - supLW;

  elements.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [tLW, tVW, spLW, spVW],
      rows: [
        new TableRow({
          children: [
            labelCell("Internship Title", tLW),
            inputCell("", tVW),
            labelCell("Specialisation", spLW),
            inputCell("", spVW),
          ],
        }),
      ],
    }),
  );
  elements.push(
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [supLW, supVW],
      rows: [
        new TableRow({
          children: [labelCell("Supervisor Name", supLW), inputCell("", supVW)],
        }),
      ],
    }),
  );
  elements.push(new Paragraph({ children: [run("")], spacing: { after: 80 } }));

  // ── Week blocks ────────────────────────────────────────────────────────────
  const weeks = groupByWeek(intern.records);

  console.log(
    `[SLIIT] ${intern.records.length} record(s) → ${weeks.length} week(s) for ${intern.name}`,
  );
  if (intern.records.length > 0) {
    console.log(
      `[SLIIT] sample date: "${intern.records[0].date}" → "${extractDateStr(intern.records[0])}"`,
    );
  }

  if (weeks.length === 0) {
    elements.push(
      new Paragraph({
        children: [run("No records found for the selected period.")],
      }),
    );
  } else {
    weeks.forEach((week, idx) => {
      buildWeekBlock(week, idx === 0).forEach((el) => elements.push(el));
    });
  }

  return elements;
}

// ── Public API ────────────────────────────────────────────────────────────────
const generate = async (records, { dateLabel, isAdmin }) => {
  const plain = records.map(toPlain);

  // Group by intern
  const internGroups = [];
  if (isAdmin) {
    const byIntern = new Map();
    for (const r of plain) {
      const key = String(r.internId?._id ?? "unknown");
      if (!byIntern.has(key))
        byIntern.set(key, { info: r.internId, records: [] });
      byIntern.get(key).records.push(r);
    }
    for (const { info, records: recs } of byIntern.values()) {
      internGroups.push({
        name: info?.Trainee_Name ?? "",
        id: info?.Trainee_ID ?? "",
        email: info?.Trainee_Email ?? "",
        records: recs,
      });
    }
  } else {
    const first = plain[0];
    internGroups.push({
      name: first?.internId?.Trainee_Name ?? "",
      id: first?.internId?.Trainee_ID ?? "",
      email: first?.internId?.Trainee_Email ?? "",
      records: plain,
    });
  }

  // Build all sections
  const allChildren = [];
  internGroups.forEach((intern, idx) => {
    buildInternSection(intern, idx === 0).forEach((el) => allChildren.push(el));
  });

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Arial", size: 18 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: 16838 },
            margin: {
              top: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
              right: MARGIN,
            },
          },
        },
        children: allChildren,
      },
    ],
  });

  return Packer.toBuffer(doc);
};

module.exports = {
  generate,
  id: "sliit",
  label: "SLIIT",
  contentType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ext: "docx",
};
