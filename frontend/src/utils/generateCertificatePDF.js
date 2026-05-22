// src/utils/generateCertificatePDF.js
// Generates a professional Internship Completion Certificate as a PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = {
  navy: [0, 16, 47],
  blue: [0, 119, 182],
  gold: [180, 150, 50],
  black: [30, 30, 30],
  gray: [100, 100, 100],
  lightGray: [180, 180, 180],
  white: [255, 255, 255],
  tableHead: [0, 40, 80],
  tableAlt: [245, 248, 255],
};

const fmt = (dateStr) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
};

const dur = (s, e) => {
  if (!s || !e) return "N/A";
  const ms = new Date(e) - new Date(s);
  const months = Math.round(ms / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 1) {
    const days = Math.ceil(ms / 864e5);
    return `${days} day${days !== 1 ? "s" : ""}`;
  }
  return `${months} month${months !== 1 ? "s" : ""}`;
};

export const generateCertificatePDF = (data) => {
  const {
    intern,
    startDate,
    endDate,
    attendanceCount,
    projects = [],
    specialization,
    logoBase64,
  } = data;

  const doc = new jsPDF("p", "mm", "a4");
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;

  // ── Decorative double border ───────────────────────────────────────
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(1.5);
  doc.rect(7, 7, W - 14, H - 14);
  doc.setLineWidth(0.4);
  doc.rect(10, 10, W - 20, H - 20);

  // Corner L-brackets
  const cs = 10;
  const corners = [
    [10, 10],
    [W - 10 - cs, 10],
    [10, H - 10 - cs],
    [W - 10 - cs, H - 10 - cs],
  ];
  corners.forEach(([x, cy]) => {
    doc.setLineWidth(0.8);
    doc.setDrawColor(...COLORS.gold);
    doc.line(x, cy, x + cs, cy);
    doc.line(x, cy, x, cy + cs);
  });

  let y = 20;

  // ── Logo + header ─────────────────────────────────────────────────
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", M, y, 30, 15);
    } catch (e) {
      console.warn("Logo failed:", e);
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.navy);
  doc.text("Sri Lanka Telecom PLC", W - M, y + 6, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.text("Lotus Road, Colombo 01, Sri Lanka", W - M, y + 11, {
    align: "right",
  });

  y += 20;

  // Divider
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  y += 1.5;
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);

  // ── Title ──────────────────────────────────────────────────────────
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.navy);
  doc.text("INTERNSHIP COMPLETION", W / 2, y, { align: "center" });

  y += 11;
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.blue);
  doc.text("CERTIFICATE", W / 2, y, { align: "center" });

  y += 6;
  const dw = 40;
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.6);
  doc.line(W / 2 - dw / 2, y, W / 2 + dw / 2, y);

  // ── Body text ──────────────────────────────────────────────────────
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.black);
  doc.text("This is to certify that", W / 2, y, { align: "center" });

  y += 12;
  const name = intern.traineeName || intern.name || "N/A";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.navy);
  doc.text(name, W / 2, y, { align: "center" });

  y += 3;
  const nw = doc.getTextWidth(name);
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.5);
  doc.line(W / 2 - nw / 2, y, W / 2 + nw / 2, y);

  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.black);

  const bodyLines = [
    "has successfully completed the internship training program",
    "at Sri Lanka Telecom PLC during the period",
    `${fmt(startDate)}  to  ${fmt(endDate)}  (${dur(startDate, endDate)}).`,
  ];
  bodyLines.forEach((l) => {
    doc.text(l, W / 2, y, { align: "center" });
    y += 7;
  });

  // ── Details table ──────────────────────────────────────────────────
  y += 6;
  const details = [
    ["Trainee ID", intern.traineeId || "N/A"],
    ["Email", intern.email || "N/A"],
    ["University / Institute", intern.institute || intern.university || "N/A"],
    [
      "Field of Specialization",
      specialization || intern.fieldOfSpecialization || "N/A",
    ],
    ["Training Period", `${fmt(startDate)}  –  ${fmt(endDate)}`],
    ["Duration", dur(startDate, endDate)],
    [
      "Meeting Attendance",
      `${attendanceCount} day${attendanceCount !== 1 ? "s" : ""}`,
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Detail", "Information"]],
    body: details,
    margin: { left: M + 8, right: M + 8 },
    theme: "grid",
    headStyles: {
      fillColor: COLORS.tableHead,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 9, textColor: COLORS.black, cellPadding: 3 },
    columnStyles: {
      0: {
        fontStyle: "bold",
        cellWidth: 52,
        fillColor: [235, 240, 250],
        textColor: COLORS.navy,
      },
    },
    alternateRowStyles: { fillColor: COLORS.tableAlt },
    styles: { lineColor: [200, 210, 225], lineWidth: 0.2 },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // ── Projects table ─────────────────────────────────────────────────
  if (projects.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.navy);
    doc.text("Projects Contributed To", M + 8, y);
    y += 4;

    const projBody = projects.map((p, i) => [
      i + 1,
      p.projectName || p.name || "N/A",
      p.supervisorName || p.supervisor || "N/A",
      p.status || "N/A",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["#", "Project Name", "Supervisor", "Status"]],
      body: projBody,
      margin: { left: M + 8, right: M + 8 },
      theme: "grid",
      headStyles: {
        fillColor: COLORS.blue,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 9,
        cellPadding: 3,
      },
      bodyStyles: { fontSize: 9, textColor: COLORS.black, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        2: { cellWidth: 38 },
        3: { cellWidth: 28, halign: "center" },
      },
      alternateRowStyles: { fillColor: [245, 250, 255] },
      styles: { lineColor: [200, 210, 225], lineWidth: 0.2 },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 8;
  }

  // ── Signature area ─────────────────────────────────────────────────
  const sigY = Math.max(y + 12, H - 52);
  const sw = 55;
  const lx = M + 15;
  const rx = W - M - 15 - sw;

  doc.setDrawColor(...COLORS.lightGray);
  doc.setLineWidth(0.3);
  doc.line(lx, sigY, lx + sw, sigY);
  doc.line(rx, sigY, rx + sw, sigY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.black);
  doc.text("Authorized Signature", lx + sw / 2, sigY + 5, {
    align: "center",
  });
  doc.text("Supervisor Signature", rx + sw / 2, sigY + 5, {
    align: "center",
  });

  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray);
  doc.text("Training Division", lx + sw / 2, sigY + 9, { align: "center" });
  doc.text("Sri Lanka Telecom PLC", rx + sw / 2, sigY + 9, {
    align: "center",
  });

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.text(`Date Issued: ${fmt(new Date().toISOString())}`, W / 2, sigY + 5, {
    align: "center",
  });

  // ── Footer ─────────────────────────────────────────────────────────
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.8);
  doc.line(M, H - 28, W - M, H - 28);
  doc.setLineWidth(0.3);
  doc.line(M, H - 26.5, W - M, H - 26.5);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray);
  doc.text(
    "This certificate is system-generated from TalentHub — Sri Lanka Telecom Intern Management System",
    W / 2,
    H - 21,
    { align: "center" }
  );

  const ref = `REF/SLT/INTERN/${intern.traineeId || "000"}/${new Date().getFullYear()}`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Ref: ${ref}`, W / 2, H - 16, { align: "center" });

  // ── Save ───────────────────────────────────────────────────────────
  const filename = `Internship_Certificate_${name.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
  return { success: true, filename };
};
