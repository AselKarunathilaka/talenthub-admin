// src/utils/generateCertificatePDF.js
// Generates a professional Internship Completion Certificate as a PDF
// Landscape A4 — standard certificate size
import jsPDF from "jspdf";
import QRCode from "qrcode";

const COLORS = {
  navy: [0, 16, 47],
  blue: [0, 119, 182],
  gold: [180, 150, 50],
  goldLight: [210, 190, 110],
  black: [30, 30, 30],
  gray: [100, 100, 100],
  lightGray: [180, 180, 180],
  white: [255, 255, 255],
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

export const generateCertificatePDF = async (data) => {
  const {
    intern,
    startDate,
    endDate,
    attendanceCount,
    projects = [],
    specialization,
    logoBase64,
    gitCommitsData,
    verificationUrl,
    extendedLeaves = [],
  } = data;

  // ── Landscape A4 — standard certificate format ─────────────────────
  const doc = new jsPDF("l", "mm", "a4");
  const W = doc.internal.pageSize.getWidth(); // 297mm
  const H = doc.internal.pageSize.getHeight(); // 210mm
  const M = 20; // margin

  // ── Decorative double border ───────────────────────────────────────
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(1.8);
  doc.rect(8, 8, W - 16, H - 16);
  doc.setLineWidth(0.5);
  doc.rect(12, 12, W - 24, H - 24);

  // Corner L-brackets (decorative)
  const cs = 12;
  const cornerPositions = [
    [12, 12],
    [W - 12 - cs, 12],
    [12, H - 12 - cs],
    [W - 12 - cs, H - 12 - cs],
  ];
  cornerPositions.forEach(([x, cy]) => {
    doc.setLineWidth(1);
    doc.setDrawColor(...COLORS.gold);
    doc.line(x, cy, x + cs, cy);
    doc.line(x, cy, x, cy + cs);
  });

  let y = 22;

  // ── Logo — centered at top ────────────────────────────────────────
  if (logoBase64) {
    try {
      const logoW = 30;
      const logoH = 15;
      doc.addImage(logoBase64, "PNG", W / 2 - logoW / 2, y, logoW, logoH);
      y += logoH + 4;
    } catch (e) {
      console.warn("Logo failed:", e);
      y += 8;
    }
  }

  // Company name — centered
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.navy);
  doc.text("SRI LANKA TELECOM PLC", W / 2, y, { align: "center" });
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray);
  doc.text("Lotus Road, Colombo 01, Sri Lanka", W / 2, y, { align: "center" });

  // ── Divider ────────────────────────────────────────────────────────
  y += 6;
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.8);
  doc.line(M + 40, y, W - M - 40, y);
  y += 1.5;
  doc.setLineWidth(0.3);
  doc.line(M + 40, y, W - M - 40, y);

  // ── Title ──────────────────────────────────────────────────────────
  y += 10;
  doc.setFont("times", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...COLORS.navy);
  doc.text("INTERNSHIP COMPLETION", W / 2, y, { align: "center" });

  y += 10;
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.blue);
  doc.text("CERTIFICATE", W / 2, y, { align: "center" });

  // Gold accent line under title
  y += 5;
  const accentW = 50;
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - accentW / 2, y, W / 2 + accentW / 2, y);

  // ── "This is to certify that" ──────────────────────────────────────
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.black);
  doc.text("This is to certify that", W / 2, y, { align: "center" });

  // ── Intern Name — large & prominent ────────────────────────────────
  y += 12;
  const name = intern.traineeName || intern.name || "N/A";
  doc.setFont("times", "bolditalic");
  doc.setFontSize(32);
  doc.setTextColor(...COLORS.navy);
  doc.text(name, W / 2, y, { align: "center" });

  // Gold underline beneath name
  y += 4;
  const nameWidth = doc.getTextWidth(name);
  const lineHalf = Math.max(nameWidth / 2 + 15, 60);
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.6);
  doc.line(W / 2 - lineHalf, y, W / 2 + lineHalf, y);

  // ── Formal paragraph ──────────────────────────────────────────────
  y += 12;
  const field = specialization || intern.fieldOfSpecialization || "N/A";
  const institute = intern.institute || intern.university || "N/A";
  const duration = dur(startDate, endDate);
  const traineeId = intern.traineeId || "N/A";

  let attendanceStr = `${attendanceCount} meeting${attendanceCount !== 1 ? "s" : ""}`;
  if (startDate) {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    const now = new Date();
    // attended / weeks held so far (capped at endDate if completed)
    const measureTo = end && end < now ? end : now;
    if (!isNaN(start) && measureTo > start) {
      const weeksHeld = Math.max(1, Math.ceil((measureTo - start) / (1000 * 60 * 60 * 24 * 7)));
      const percentage = Math.min(100, Math.round((attendanceCount / weeksHeld) * 100));
      attendanceStr += ` (achieving an attendance rate of ${percentage}%)`;
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.black);

  const maxTextWidth = W - M * 2 - 60;

  let extendedLeaveStr = "";
  if (extendedLeaves && extendedLeaves.length > 0) {
    let totalLeaveDays = 0;
    extendedLeaves.forEach(l => {
      if (l.leaveDate) {
        if (l.studyEndDate) {
          totalLeaveDays += Math.max(1, Math.ceil((new Date(l.studyEndDate) - new Date(l.leaveDate)) / 864e5) + 1);
        } else {
          totalLeaveDays += 1; // Single day leave
        }
      }
    });
    if (totalLeaveDays > 0) {
      extendedLeaveStr = ` [excluding ${totalLeaveDays} day${totalLeaveDays !== 1 ? 's' : ''} of approved extended leave]`;
    }
  }

  const paragraph =
    `bearing Trainee ID ${traineeId}, from ${institute}, ` +
    `specializing in ${field}, has successfully completed the internship ` +
    `training program at Sri Lanka Telecom PLC during the period ` +
    `${fmt(startDate)} to ${fmt(endDate)} (${duration})${extendedLeaveStr}. ` +
    `Throughout the training period, the intern demonstrated outstanding ` +
    `dedication and commitment, attending ${attendanceStr}. ` +
    `We acknowledge and appreciate the valuable contributions made during this internship.`;

  const wrappedLines = doc.splitTextToSize(paragraph, maxTextWidth);
  wrappedLines.forEach((line) => {
    doc.text(line, W / 2, y, { align: "center" });
    y += 6;
  });

  // ── Projects paragraph ─────────────────────────────────────────────
  if (projects.length > 0) {
    y += 2;
    const projDescriptions = projects.map((p) => {
      const projName = p.projectName || p.name || "N/A";
      const supervisor = p.supervisorName || p.supervisor || "";
      let commitsInfo = "";
      if (gitCommitsData && gitCommitsData.projectCommits) {
        const match = gitCommitsData.projectCommits.find(
          (gc) => 
            gc.projectName?.trim().toLowerCase() === 
            (p.projectName || p.name)?.trim().toLowerCase()
        );
        if (match && match.totalCommits > 0) {
          commitsInfo = `, contributing ${match.totalCommits} code commit${match.totalCommits === 1 ? '' : 's'}`;
        }
      }
      let desc = projName;
      if (commitsInfo) desc += commitsInfo;
      if (supervisor) desc += ` (supervised by ${supervisor})`;
      return desc;
    });

    let projSentence;
    if (projDescriptions.length === 1) {
      projSentence = projDescriptions[0];
    } else {
      projSentence =
        projDescriptions.slice(0, -1).join(", ") +
        ", and " +
        projDescriptions[projDescriptions.length - 1];
    }

    const projParagraph =
      `During the internship, the trainee contributed to the following ` +
      `project${projects.length > 1 ? "s" : ""}: ${projSentence}.`;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.black);
    const projWrapped = doc.splitTextToSize(projParagraph, maxTextWidth);
    projWrapped.forEach((line) => {
      doc.text(line, W / 2, y, { align: "center" });
      y += 5.5;
    });
  }

  // ── Signature area ─────────────────────────────────────────────────
  const sigY = H - 42;
  const sw = 60;
  const leftX = M + 30;
  const rightX = W - M - 30 - sw;

  // Left: Authorized Signature
  doc.setDrawColor(...COLORS.lightGray);
  doc.setLineWidth(0.3);
  doc.line(leftX, sigY, leftX + sw, sigY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.black);
  doc.text("Authorized Signature", leftX + sw / 2, sigY + 5, { align: "center" });
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray);
  doc.text("Training Division", leftX + sw / 2, sigY + 9, { align: "center" });

  // Center: Date Issued
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.black);
  doc.text(`Date Issued: ${fmt(new Date().toISOString())}`, W / 2, sigY + 5, { align: "center" });

  // Right: Supervisor Signature
  doc.setDrawColor(...COLORS.lightGray);
  doc.setLineWidth(0.3);
  doc.line(rightX, sigY, rightX + sw, sigY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.black);
  doc.text("Supervisor Signature", rightX + sw / 2, sigY + 5, { align: "center" });
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray);
  doc.text("Sri Lanka Telecom PLC", rightX + sw / 2, sigY + 9, { align: "center" });

  // ── Footer ─────────────────────────────────────────────────────────
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.6);
  doc.line(M + 15, H - 25, W - M - 15, H - 25);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray);
  doc.text(
    "This certificate is system-generated from TalentHub — Sri Lanka Telecom Intern Management System",
    W / 2,
    H - 20,
    { align: "center" }
  );

  const ref = `REF/SLT/INTERN/${intern.traineeId || "000"}/${new Date().getFullYear()}`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Validate Certificate ID:  ${ref}`, W / 2, H - 15, { align: "center" });

  // ── QR Code (verification) ────────────────────────────────────────
  if (verificationUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
        width: 100,
        margin: 1,
        color: { dark: "#00102f", light: "#ffffff" },
      });
      const qrSize = 24;
      const qrX = W - M - 15 - qrSize;
      const qrY = H - 25 - qrSize - 6;
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(...COLORS.gray);
      doc.text("Scan to verify", qrX + qrSize / 2, qrY + qrSize + 3.5, { align: "center" });
      doc.text("authenticity", qrX + qrSize / 2, qrY + qrSize + 7, { align: "center" });
    } catch (e) {
      console.warn("QR Code generation failed:", e);
    }
  }

  // ── Save ───────────────────────────────────────────────────────────
  const filename = `Internship_Certificate_${name.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
  return { success: true, filename };
};
