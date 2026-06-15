// src/utils/generateCertificatePDF.js
// Generates an elegant Internship Completion Certificate as a PDF
// Design inspired by modern recognition certificates — clean, minimal, centered
import jsPDF from "jspdf";
import QRCode from "qrcode";

/* ─── Color palette ─────────────────────────────────────────────────────── */
const C = {
  navy: [0, 32, 74], // deep professional navy
  darkBlue: [0, 56, 117],
  gold: [180, 155, 60],
  goldLight: [210, 190, 120],
  black: [35, 35, 35],
  darkGray: [80, 80, 80],
  gray: [130, 130, 130],
  lightGray: [190, 190, 190],
  veryLightGray: [225, 225, 225],
  white: [255, 255, 255],
  decorGray: [200, 205, 210],
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */
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

const fmtShort = (dateStr) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
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

/* ─── Draw geometric hexagonal corner decoration ────────────────────────── */
const drawHexCorner = (doc, cx, cy, size, alpha) => {
  // Draw a single hexagon outline
  doc.setDrawColor(...C.decorGray);
  doc.setLineWidth(0.3);

  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    points.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    doc.line(points[i][0], points[i][1], points[next][0], points[next][1]);
  }
};

const drawCornerPattern = (doc, x, y, flipX, flipY) => {
  // Draw a cluster of hexagons in a corner
  const sizes = [8, 6, 5, 4];
  const offsets = [
    { dx: 0, dy: 0, s: 8 },
    { dx: 14, dy: 8, s: 6 },
    { dx: -2, dy: 16, s: 5 },
    { dx: 16, dy: -4, s: 5 },
    { dx: 10, dy: 20, s: 4 },
    { dx: 24, dy: 14, s: 4 },
    { dx: 28, dy: 4, s: 3 },
  ];

  offsets.forEach(({ dx, dy, s }) => {
    const cx = x + dx * (flipX ? -1 : 1);
    const cy = y + dy * (flipY ? -1 : 1);
    drawHexCorner(doc, cx, cy, s);
  });
};

/* ─── Draw a thin decorative line with small diamond center ─────────────── */
const drawDividerLine = (doc, x1, x2, y) => {
  const mid = (x1 + x2) / 2;
  const ds = 2;

  doc.setDrawColor(...C.goldLight);
  doc.setLineWidth(0.3);
  doc.line(x1, y, mid - ds - 2, y);
  doc.line(mid + ds + 2, y, x2, y);

  // Small diamond
  doc.setFillColor(...C.gold);
  const pts = [
    [mid, y - ds],
    [mid + ds, y],
    [mid, y + ds],
    [mid - ds, y],
  ];
  // Draw diamond manually with lines and fill
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.4);
  doc.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
  doc.line(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
  doc.line(pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
  doc.line(pts[3][0], pts[3][1], pts[0][0], pts[0][1]);
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════════════════════ */
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
  } = data;

  const doc = new jsPDF("l", "mm", "a4"); // Landscape for elegant look
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const MX = 20; // horizontal margin

  // ── Background ─────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, "F");

  // ── Outer border — thin elegant line ──────────────────────────────
  doc.setDrawColor(...C.lightGray);
  doc.setLineWidth(0.6);
  doc.rect(8, 8, W - 16, H - 16);

  // ── Inner subtle border ───────────────────────────────────────────
  doc.setDrawColor(...C.veryLightGray);
  doc.setLineWidth(0.3);
  doc.rect(12, 12, W - 24, H - 24);

  // ── Geometric hexagon corner decorations ──────────────────────────
  drawCornerPattern(doc, 20, 20, false, false); // top-left
  drawCornerPattern(doc, W - 20, 20, true, false); // top-right
  drawCornerPattern(doc, 20, H - 20, false, true); // bottom-left
  drawCornerPattern(doc, W - 20, H - 20, true, true); // bottom-right

  let y = 28;

  // ── Logo — centered at top ────────────────────────────────────────
  if (logoBase64) {
    try {
      const logoW = 28;
      const logoH = 14;
      doc.addImage(logoBase64, "PNG", W / 2 - logoW / 2, y, logoW, logoH);
      y += logoH + 3;
    } catch (e) {
      console.warn("Logo failed:", e);
      y += 6;
    }
  }

  // Company name — centered below logo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.darkBlue);
  doc.text("SRI LANKA TELECOM PLC", W / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(7);
  doc.setTextColor(...C.gray);
  doc.text("Lotus Road, Colombo 01, Sri Lanka", W / 2, y, {
    align: "center",
  });

  // ── Title ─────────────────────────────────────────────────────────
  y += 14;
  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...C.navy);
  doc.text("CERTIFICATE OF COMPLETION", W / 2, y, { align: "center" });

  // Subtle underline accent
  y += 4;
  drawDividerLine(doc, W / 2 - 60, W / 2 + 60, y);

  // ── "This certificate is presented to" ─────────────────────────────
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...C.darkGray);
  doc.text("This certificate is presented to", W / 2, y, { align: "center" });

  // ── Intern Name — large, elegant ──────────────────────────────────
  y += 16;
  const name = intern.traineeName || intern.name || "N/A";
  doc.setFont("times", "bolditalic");
  doc.setFontSize(36);
  doc.setTextColor(...C.navy);
  doc.text(name, W / 2, y, { align: "center" });

  // Gold underline beneath name
  y += 4;
  const nameWidth = doc.getTextWidth(name);
  const lineHalf = Math.max(nameWidth / 2 + 10, 50);
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - lineHalf, y, W / 2 + lineHalf, y);

  // ── Body paragraph ────────────────────────────────────────────────
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...C.darkGray);

  const field =
    specialization || intern.fieldOfSpecialization || "their designated field";
  const institute = intern.institute || intern.university || "their university";
  const duration = dur(startDate, endDate);

  const bodyText = [
    `In recognition of outstanding dedication, exceptional performance,`,
    `and unwavering commitment to excellence during the internship training program`,
    `in ${field} from ${fmt(startDate)} to ${fmt(endDate)} (${duration}).`,
    `Representing ${institute}, their contributions have made a significant`,
    `impact, and we deeply appreciate their efforts.`,
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...C.darkGray);
  const lineHeight = 5.5;
  bodyText.forEach((line) => {
    doc.text(line, W / 2, y, { align: "center" });
    y += lineHeight;
  });

  // ── Bottom section: Issue Date | QR Seal | Signature ──────────────
  const bottomY = H - 52;

  // --- Left: Issue Date ---
  const leftX = MX + 35;
  doc.setDrawColor(...C.lightGray);
  doc.setLineWidth(0.3);
  doc.line(leftX - 25, bottomY, leftX + 25, bottomY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.black);
  doc.text(fmtShort(new Date().toISOString()), leftX, bottomY - 4, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.gray);
  doc.text("Issue date", leftX, bottomY + 5, { align: "center" });

  // --- Center: QR Code as "Seal" ---
  if (verificationUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
        width: 120,
        margin: 1,
        color: { dark: "#00204a", light: "#ffffff" },
      });
      const qrSize = 28;
      const qrX = W / 2 - qrSize / 2;
      const qrY = bottomY - qrSize + 4;

      // Draw a circular border around QR to make it look like a seal
      doc.setDrawColor(...C.gold);
      doc.setLineWidth(1.2);
      doc.circle(W / 2, bottomY - qrSize / 2 + 4, qrSize / 2 + 3);
      doc.setLineWidth(0.4);
      doc.circle(W / 2, bottomY - qrSize / 2 + 4, qrSize / 2 + 5);

      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(...C.gray);
      doc.text("Scan to verify", W / 2, bottomY + 9, { align: "center" });
    } catch (e) {
      console.warn("QR Code generation failed:", e);
    }
  }

  // --- Right: Supervisor / Authorized Signature ---
  const rightX = W - MX - 35;
  doc.setDrawColor(...C.lightGray);
  doc.setLineWidth(0.3);
  doc.line(rightX - 30, bottomY, rightX + 30, bottomY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.black);
  doc.text("Authorized Signatory", rightX, bottomY + 5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.gray);
  doc.text("Training Division — Sri Lanka Telecom PLC", rightX, bottomY + 9, {
    align: "center",
  });

  // ── Footer divider ────────────────────────────────────────────────
  const footerY = H - 22;
  doc.setDrawColor(...C.veryLightGray);
  doc.setLineWidth(0.3);
  doc.line(MX + 10, footerY, W - MX - 10, footerY);

  // ── Validate Certificate ID ───────────────────────────────────────
  const ref = `REF/SLT/INTERN/${intern.traineeId || "000"}/${new Date().getFullYear()}`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.gray);
  doc.text("Validate Certificate ID:", W / 2 - 2, footerY + 6, {
    align: "right",
  });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.navy);
  doc.text(`  ${ref}`, W / 2, footerY + 6, { align: "left" });

  // System-generated note
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6);
  doc.setTextColor(...C.lightGray);
  doc.text(
    "This certificate is system-generated from TalentHub — Sri Lanka Telecom Intern Management System",
    W / 2,
    footerY + 11,
    { align: "center" }
  );

  // ── Save ──────────────────────────────────────────────────────────
  const filename = `Internship_Certificate_${name.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
  return { success: true, filename };
};
