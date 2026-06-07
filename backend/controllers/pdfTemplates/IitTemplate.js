const ExcelJS = require("exceljs");

const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];
const DEFAULT_PROGRESS = "No challenges faced";
const DEFAULT_BLOCKERS = "No specific plans";

const thinBorder = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};
const boldFont = (sz = 9) => ({ name: "Arial", bold: true, size: sz });
const normalFont = (sz = 9) => ({ name: "Arial", bold: false, size: sz });
const centerAlign = () => ({
  horizontal: "center",
  vertical: "center",
  wrapText: true,
});
const leftAlign = () => ({
  horizontal: "left",
  vertical: "top",
  wrapText: true,
});

// single cell
function sc(ws, row, col, value, font, align) {
  const cell = ws.getCell(row, col);
  cell.value = value ?? "";
  cell.font = font;
  cell.alignment = align || leftAlign();
  cell.border = thinBorder;
  return cell;
}
// merged columns within same row
function mc(ws, row, c1, c2, value, font, align) {
  if (c1 !== c2) ws.mergeCells(row, c1, row, c2);
  return sc(ws, row, c1, value, font, align);
}

function toPlain(r) {
  if (!r) return r;
  if (typeof r.toObject === "function") return r.toObject();
  if (typeof r.toJSON === "function") return r.toJSON();
  return r;
}

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
  console.warn("[IIT] Cannot parse date:", raw);
  return null;
}

function extractDateStr(r) {
  const fd = normaliseDate(r.date);
  if (fd) return fd;
  if (r.createdAt)
    return normaliseDate(r.createdAt) ?? toLocalDateStr(new Date(r.createdAt));
  return null;
}

function fmtDate(d) {
  return (
    String(d.getDate()).padStart(2, "0") +
    "/" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "/" +
    d.getFullYear()
  );
}

function weekBounds(s) {
  const d = new Date(s + "T00:00:00");
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
      console.warn("[IIT] Skip unparseable date", r._id, r.date);
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

function hasContent(val, ph) {
  return val && val.trim() !== "" && val.trim() !== ph;
}

function buildSheet(ws, internInfo, records, dateLabel) {
  ws.columns = [
    { width: 18 }, // A – day / labels
    { width: 62 }, // B – description / content
    { width: 20 }, // C – activity no. / solutions
  ];

  let row = 1;

  // Title
  mc(
    ws,
    row,
    1,
    3,
    "IIT Industrial Training Daily Log",
    boldFont(11),
    centerAlign(),
  );
  ws.getRow(row).height = 20;
  row += 2;

  const weeks = groupByWeek(records);
  console.log(
    `[IIT] ${records.length} record(s) → ${weeks.length} week(s) for ${internInfo.name}`,
  );
  if (records.length > 0)
    console.log(
      `[IIT] sample date: "${records[0].date}" → "${extractDateStr(records[0])}"`,
    );

  if (weeks.length === 0) {
    mc(
      ws,
      row,
      1,
      3,
      "No records found for this period.",
      normalFont(9),
      centerAlign(),
    );
    return;
  }

  for (const week of weeks) {
    const { mon, sun, records: wRecs } = week;

    // WEEK ENDING
    sc(ws, row, 1, "WEEK ENDING", boldFont(9), centerAlign());
    mc(
      ws,
      row,
      2,
      3,
      `${fmtDate(mon)} - ${fmtDate(sun)}`,
      boldFont(9),
      leftAlign(),
    );
    ws.getRow(row).height = 16;
    row++;

    // Column headers
    sc(ws, row, 1, "DAYS", boldFont(9), centerAlign());
    sc(
      ws,
      row,
      2,
      "DESCRIPTION OF WORK CARRIED OUT",
      boldFont(9),
      centerAlign(),
    );
    sc(ws, row, 3, "ACTIVITY NO.", boldFont(9), centerAlign());
    ws.getRow(row).height = 16;
    row++;

    // Day rows
    for (let di = 0; di < 7; di++) {
      const rec = recordForDay(wRecs, di, mon);
      const parts = [];
      if (rec) {
        if (rec.task) parts.push(rec.task);
        if (rec.status === "leave") parts.push("[On Leave]");
        if (rec.status === "study_leave") parts.push("[Extended Leave]");
        if (rec.status === "wfh") parts.push("[WFH]");
        if (rec.stack && rec.stack !== "On Leave")
          parts.push(`Stack: ${rec.stack}`);
      }
      const desc = parts.join("\n");
      sc(ws, row, 1, DAYS_OF_WEEK[di], boldFont(9), {
        horizontal: "left",
        vertical: "center",
        wrapText: true,
      });
      sc(ws, row, 2, desc, normalFont(9), leftAlign());
      sc(ws, row, 3, "", normalFont(9), centerAlign());
      ws.getRow(row).height = Math.max(
        22,
        (desc ? desc.split("\n").length : 1) * 14,
      );
      row++;
    }

    // Problems / Solutions — header
    mc(ws, row, 1, 2, "PROBLEMS ENCOUNTERED", boldFont(9), centerAlign());
    sc(ws, row, 3, "SOLUTIONS FOUND", boldFont(9), centerAlign());
    ws.getRow(row).height = 16;
    row++;

    // Problems / Solutions — content (multi-row vertical merge)
    const problems = wRecs
      .filter((r) => hasContent(r.progress, DEFAULT_PROGRESS))
      .map((r) => r.progress.trim())
      .join("\n\n");
    const solutions = wRecs
      .filter((r) => hasContent(r.blockers, DEFAULT_BLOCKERS))
      .map((r) => r.blockers.trim())
      .join("\n\n");
    const pLines = Math.max(3, problems ? problems.split("\n").length : 0);

    ws.mergeCells(row, 1, row + pLines - 1, 2);
    Object.assign(ws.getCell(row, 1), {
      value: problems,
      font: normalFont(9),
      alignment: leftAlign(),
      border: thinBorder,
    });
    ws.mergeCells(row, 3, row + pLines - 1, 3);
    Object.assign(ws.getCell(row, 3), {
      value: solutions,
      font: normalFont(9),
      alignment: leftAlign(),
      border: thinBorder,
    });
    for (let mr = row; mr < row + pLines; mr++) ws.getRow(mr).height = 18;
    row += pLines;

    // Supervisor comments
    mc(
      ws,
      row,
      1,
      3,
      "INDUSTRIAL SUPERVISOR'S COMMENTS",
      boldFont(9),
      centerAlign(),
    );
    ws.getRow(row).height = 16;
    row++;

    ws.mergeCells(row, 1, row + 3, 3);
    Object.assign(ws.getCell(row, 1), {
      value: "",
      font: normalFont(9),
      alignment: leftAlign(),
      border: thinBorder,
    });
    for (let cr = row; cr < row + 4; cr++) ws.getRow(cr).height = 18;
    row += 4;

    // DESIGNATION
    sc(ws, row, 1, "DESIGNATION", boldFont(9), centerAlign());
    sc(ws, row, 2, "", normalFont(9), centerAlign());
    sc(ws, row, 3, "", normalFont(9), centerAlign());
    ws.getRow(row).height = 50;
    row++;

    row += 1; // gap before next week
  }
}

async function generate(records, { dateLabel, isAdmin }) {
  const plain = records.map(toPlain);
  const wb = new ExcelJS.Workbook();
  wb.creator = "IIT Logbook System";
  wb.created = new Date();
  wb.modified = new Date();

  if (isAdmin) {
    const byIntern = new Map();
    for (const r of plain) {
      const key = String(r.internId?._id ?? "unknown");
      if (!byIntern.has(key))
        byIntern.set(key, { info: r.internId, records: [] });
      byIntern.get(key).records.push(r);
    }
    for (const { info, records: recs } of byIntern.values()) {
      const internInfo = {
        name: info?.Trainee_Name ?? "Unknown",
        id: info?.Trainee_ID ?? "N/A",
        email: info?.Trainee_Email ?? "N/A",
      };
      const sheetName = `${internInfo.id}_${internInfo.name}`
        .slice(0, 31)
        .replace(/[/\\?*[\]:]/g, "_");
      buildSheet(wb.addWorksheet(sheetName), internInfo, recs, dateLabel);
    }
  } else {
    const first = plain[0];
    const internInfo = {
      name: first?.internId?.Trainee_Name ?? "Unknown",
      id: first?.internId?.Trainee_ID ?? "N/A",
      email: first?.internId?.Trainee_Email ?? "N/A",
    };
    buildSheet(wb.addWorksheet("Logbook"), internInfo, plain, dateLabel);
  }

  return wb.xlsx.writeBuffer();
}

module.exports = {
  generate,
  id: "iit",
  label: "IIT",
  contentType:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ext: "xlsx",
};
