import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaUser,
  FaEnvelope,
  FaIdCard,
  FaBuilding,
  FaUsers,
  FaCalendarAlt,
  FaChartLine,
  FaArrowLeft,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaShieldAlt,
  FaFileAlt,
  FaTasks,
  FaClock,
  FaChartPie,
  FaHistory,
  FaRegCalendarCheck,
  FaEye,
  FaCertificate,
  FaCalendarCheck,
  FaChevronLeft,
  FaChevronRight,
  FaCircle,
  FaVideo,
  FaUserCheck,
  FaCodeBranch,
  FaProjectDiagram,
  FaCalendarDay,
  FaExclamationCircle,
  FaTimes,
  FaLayerGroup,
  FaUsers as FaTeam,
  FaClipboardList,
  FaGraduationCap,
  FaStar,
  FaAward,
  FaFilePdf,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { adminApi } from "../api/adminApi";
import { API_BASE_URL } from "../api/apiConfig";
import AdminNavigation from "../components/AdminNavigation";
import Dashboard from "./Dashboard";
import {
  isNoCommitSpecialization,
  calcWorkingDays as calcWorkingDaysUtil,
  calcElapsedWeeks as calcElapsedWeeksUtil,
  calcDailyAttendanceRate,
  calcMeetingAttendanceRate,
  calcLogbookRate,
  calcPerformanceRate,
  getPerformanceStatus,
  getMondayWeekKey,
  toDateStr,
} from "../utils/analyticsCalculations";

// ─── Helper: load profile image as Base64 for jsPDF ─────────────────────────
const loadProfileImageBase64 = (url) => {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 140;
        canvas.height = img.naturalHeight || img.height || 140;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL("image/jpeg", 0.9);
        resolve(dataURL);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

// ─── Helper: draw initials avatar on PDF if image unavailable ───────────────
const drawPdfFallbackAvatar = (doc, x, y, size, intern) => {
  doc.setFillColor(0, 0, 102);
  doc.roundedRect(x, y, size, size, 2.5, 2.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const initial = ((intern?.traineeName || intern?.name || "?").charAt(0) || "?").toUpperCase();
  doc.text(initial, x + size / 2, y + size / 2 + 3.5, { align: "center" });
};

// ─── Helper: get all calendar days for a given month ───────────────────────
const getCalendarDays = (year, month) => {
  const days = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++)
    days.push(new Date(year, month, d));
  return days;
};

const toDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const getAttendanceMeta = (dailyMap, meetingMap, date, holidayChecker) => {
  if (!date) return null;
  const key = toDateKey(date);
  const dailyEntry = dailyMap[key];
  const meetings = meetingMap[key] || [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isFuture = date > today;
  const holiday = holidayChecker ? holidayChecker(date) : null;

  const hasMeetingAttended = meetings.some(
    (e) => (e.status || "").toLowerCase() === "present"
  );
  
  // Check if daily entry is present AND is either face or qr (not logbook)
  const isDailyPresent = dailyEntry && 
    (dailyEntry.status || "").toLowerCase() === "present" &&
    (dailyEntry.rawType === "face" || dailyEntry.rawType === "daily_qr");

  if (isWeekend) return { bgClass: "bg-gray-50", textClass: "text-gray-400", isWeekend: true };
  if (holiday) return { bgClass: "bg-yellow-50", textClass: "text-yellow-800", isHoliday: true, holidayName: holiday.name };
  if (isFuture) return { bgClass: "bg-white", textClass: "text-gray-300", isFuture: true };

  return { 
    bgClass: "bg-white", 
    textClass: "text-gray-700", 
    hasMeetingAttended, 
    isDailyPresent 
  };
};

const getLogbookMeta = (recordMap, date, holidayChecker) => {
  if (!date) return null;
  const key = toDateKey(date);
  const rec = recordMap[key];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isFuture = date > today;
  const holiday = holidayChecker ? holidayChecker(date) : null;

  if (isWeekend) return { bgClass: "bg-gray-50", textClass: "text-gray-400", isWeekend: true };
  if (holiday) return { bgClass: "bg-yellow-50", textClass: "text-yellow-800", isHoliday: true, holidayName: holiday.name };
  if (isFuture) return { bgClass: "bg-white", textClass: "text-gray-300", isFuture: true };

  if (!rec) return { bgClass: "bg-white", textClass: "text-gray-400", label: "No Record", isMissing: true };
  
  const st = (rec.status || "").toLowerCase();
  if (st === "leave") return { bgClass: "bg-red-50", textClass: "text-red-700", label: "On Leave", isLeave: true };
  
  return { 
    bgClass: "bg-green-50", 
    textClass: "text-green-700", 
    label: st === "wfh" ? "WFH" : st === "working" ? "Working" : "Submitted",
    isWorking: st === "working",
    isWfh: st === "wfh",
    isSubmitted: true
  };
};

const getGithubCommitPrefix = (message) => {
  if (!message) return "chore";
  const m = message.toLowerCase();
  if (m.startsWith("feat") || m.startsWith("feature")) return "feat";
  if (m.startsWith("fix") || m.startsWith("bug")) return "feat";
  if (m.startsWith("docs") || m.startsWith("doc")) return "docs";
  if (m.startsWith("test")) return "test";
  return "chore";
};

const COMMIT_COLORS = {
  feat: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  docs: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  test: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  chore: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
};

const PROJECT_STATUS_STYLE = {
  IN_PROGRESS: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    label: "In Progress",
  },
  PLANNING: { bg: "bg-amber-100", text: "text-amber-700", label: "Planning" },
  COMPLETED: { bg: "bg-green-100", text: "text-green-700", label: "Completed" },
  ON_HOLD: { bg: "bg-red-100", text: "text-red-700", label: "On Hold" },
};

const AdminInternDetails = () => {
  const { internId } = useParams();
  const navigate = useNavigate();
  const [internDetails, setInternDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [recentRecords, setRecentRecords] = useState([]);

  const [attendanceData, setAttendanceData] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [tooltip, setTooltip] = useState(null);

  const [logbookView, setLogbookView] = useState("calendar");
  const [logbookCalMonth, setLogbookCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [logbookModal, setLogbookModal] = useState(null);

  const [gitCommitsData, setGitCommitsData] = useState(null);
  const [gitCommitsLoading, setGitCommitsLoading] = useState(false);
  // Unified attendance count — same source as the certificate page (TalentTrail-enriched)
  const [certAttendanceCount, setCertAttendanceCount] = useState(null);
  // Direct collection counts (dailyattendance, meetingattendance, dailyrecords)
  const [recordCounts, setRecordCounts] = useState(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const intern = internDetails?.intern;

  const handleExportMissingRecordsPDF = useCallback(async ({
    intern,
    dailyAttendanceRate,
    meetingAttendanceRate,
    performanceRate,
    missingDailyDates = [],
    missingLogbookDates = [],
    missingMeetingWeeks = [],
    startDateVal,
    formattedStartDate,
    workingDays,
    elapsedWeeks,
  }) => {
    setIsExportingPDF(true);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;

      // ── 1. Header Banner (Corporate Dark Blue to Emerald Accent) ──
      doc.setFillColor(0, 0, 102); // #000066 Navy
      doc.rect(0, 0, pageWidth, 22, "F");

      doc.setFillColor(0, 102, 0); // #006600 Emerald
      doc.rect(0, 22, pageWidth, 2.5, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("TALENTHUB  •  INTERN ATTENDANCE & AUDIT REPORT", margin, 12);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(203, 213, 225);
      doc.text(
        `Official Internship Missing Submissions & Compliance Audit  |  Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
        margin,
        17.5
      );

      // ── 2. Profile Card (Top Area) ──
      let cardY = 28;
      const cardHeight = 38;

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, cardY, contentWidth, cardHeight, 3, 3, "F");
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, cardY, contentWidth, cardHeight, 3, 3, "S");

      // Profile Image loading
      const photoUrl = intern?._id ? `${API_BASE_URL}/interns/${intern._id}/profile-picture` : null;
      let photoData = null;
      if (photoUrl) {
        photoData = await loadProfileImageBase64(photoUrl);
      }

      const avatarSize = 28;
      const avatarX = margin + 5;
      const avatarY = cardY + 5;

      if (photoData) {
        try {
          doc.addImage(photoData, "JPEG", avatarX, avatarY, avatarSize, avatarSize);
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.4);
          doc.roundedRect(avatarX, avatarY, avatarSize, avatarSize, 2, 2, "S");
        } catch {
          drawPdfFallbackAvatar(doc, avatarX, avatarY, avatarSize, intern);
        }
      } else {
        drawPdfFallbackAvatar(doc, avatarX, avatarY, avatarSize, intern);
      }

      // Profile Text info with perfectly aligned 2-column layout
      const col1X = avatarX + avatarSize + 6;
      const col2X = col1X + 66;
      const internName = intern?.traineeName || intern?.name || intern?.Trainee_Name || "Intern";
      const traineeId = intern?.traineeId || intern?.Trainee_ID || "N/A";
      const spec = intern?.field_of_spec_name || intern?.fieldOfSpecialization || intern?.specialization || "Not Specified";
      const institute = intern?.institute || intern?.university || intern?.Institute || "Not Specified";
      const startDisplay = formattedStartDate || (startDateVal ? new Date(startDateVal).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "N/A");
      const endDisplay = intern?.endDate || intern?.Training_EndDate ? new Date(intern?.endDate || intern?.Training_EndDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "N/A";

      // Intern Name (Title)
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12.5);
      doc.text(internName, col1X, cardY + 9);

      // Helper for clean, perfectly aligned key-value pair
      const renderField = (label, val, x, y, valColor = [15, 23, 42]) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(label, x, y);
        const labelWidth = doc.getTextWidth(label);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...valColor);
        doc.text(String(val || "N/A"), x + labelWidth + 1.2, y);
      };

      // Row 1: Trainee ID & Specialization
      renderField("Trainee ID: ", traineeId, col1X, cardY + 16.5, [0, 0, 102]);
      renderField("Specialization: ", spec, col2X, cardY + 16.5, [2, 132, 199]);

      // Row 2: Institute & Target End Date
      renderField("Institute: ", institute, col1X, cardY + 23.5, [30, 41, 59]);
      renderField("Target End Date: ", endDisplay, col2X, cardY + 23.5, [30, 41, 59]);

      // Row 3: Start Date & Working Days
      renderField("Start Date: ", startDisplay, col1X, cardY + 30.5, [30, 41, 59]);
      renderField("Working Days: ", `${workingDays} Days`, col2X, cardY + 30.5, [30, 41, 59]);

      // ── 3. KPI Rate & Missing Summary Grid (6 Cards) ──
      let kpiY = cardY + cardHeight + 5.5;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text("ATTENDANCE & MISSING SUBMISSION METRICS", margin, kpiY);

      kpiY += 3.5;
      const cardGap = 3.5;
      const colW = (contentWidth - cardGap * 2) / 3;
      const rowH = 19;

      const kpis = [
        {
          label: "Daily Attendance Rate",
          val: `${dailyAttendanceRate}%`,
          sub: `${workingDays} Total Working Days`,
          borderCol: [191, 219, 254],
          bgCol: [239, 246, 255],
          textCol: [29, 78, 216],
        },
        {
          label: "Meeting Attendance Rate",
          val: `${meetingAttendanceRate}%`,
          sub: `${elapsedWeeks || 0} Expected Meetings`,
          borderCol: [221, 214, 254],
          bgCol: [245, 243, 255],
          textCol: [109, 40, 217],
        },
        {
          label: "Performance Rate",
          val: `${performanceRate}%`,
          sub: `Status: ${getPerformanceStatus(performanceRate)}`,
          borderCol: performanceRate >= 80 ? [167, 243, 208] : performanceRate >= 60 ? [254, 215, 170] : [254, 205, 211],
          bgCol: performanceRate >= 80 ? [236, 253, 245] : performanceRate >= 60 ? [255, 251, 235] : [255, 241, 242],
          textCol: performanceRate >= 80 ? [4, 120, 87] : performanceRate >= 60 ? [180, 83, 9] : [190, 18, 60],
        },
        {
          label: "Missing Daily Attendance",
          val: `${missingDailyDates.length} Days`,
          sub: missingDailyDates.length === 0 ? "100% Complete" : "Working days unrecorded",
          borderCol: missingDailyDates.length > 0 ? [254, 205, 211] : [167, 243, 208],
          bgCol: missingDailyDates.length > 0 ? [255, 241, 242] : [236, 253, 245],
          textCol: missingDailyDates.length > 0 ? [225, 29, 72] : [4, 120, 87],
        },
        {
          label: "Missing Logbook Entries",
          val: `${missingLogbookDates.length} Days`,
          sub: missingLogbookDates.length === 0 ? "100% Complete" : "Working days unsubmitted",
          borderCol: missingLogbookDates.length > 0 ? [254, 215, 170] : [167, 243, 208],
          bgCol: missingLogbookDates.length > 0 ? [255, 251, 235] : [236, 253, 245],
          textCol: missingLogbookDates.length > 0 ? [217, 119, 6] : [4, 120, 87],
        },
        {
          label: "Missed Meeting Weeks",
          val: `${missingMeetingWeeks.length} Weeks`,
          sub: missingMeetingWeeks.length === 0 ? "100% Complete" : "Weekly meetings missed",
          borderCol: missingMeetingWeeks.length > 0 ? [221, 214, 254] : [167, 243, 208],
          bgCol: missingMeetingWeeks.length > 0 ? [245, 243, 255] : [236, 253, 245],
          textCol: missingMeetingWeeks.length > 0 ? [124, 58, 237] : [4, 120, 87],
        },
      ];

      // Render Row 1 (3 items)
      kpis.slice(0, 3).forEach((item, idx) => {
        const x = margin + idx * (colW + cardGap);
        const y = kpiY;
        doc.setFillColor(...item.bgCol);
        doc.roundedRect(x, y, colW, rowH, 2, 2, "F");
        doc.setDrawColor(...item.borderCol);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, colW, rowH, 2, 2, "S");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(item.label, x + 3.5, y + 5.2);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11.5);
        doc.setTextColor(...item.textCol);
        doc.text(item.val, x + 3.5, y + 11.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        doc.setTextColor(100, 116, 139);
        doc.text(item.sub, x + 3.5, y + 15.8);
      });

      // Render Row 2 (3 items)
      kpis.slice(3, 6).forEach((item, idx) => {
        const x = margin + idx * (colW + cardGap);
        const y = kpiY + rowH + cardGap;
        doc.setFillColor(...item.bgCol);
        doc.roundedRect(x, y, colW, rowH, 2, 2, "F");
        doc.setDrawColor(...item.borderCol);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, colW, rowH, 2, 2, "S");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(item.label, x + 3.5, y + 5.2);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11.5);
        doc.setTextColor(...item.textCol);
        doc.text(item.val, x + 3.5, y + 11.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        doc.setTextColor(100, 116, 139);
        doc.text(item.sub, x + 3.5, y + 15.8);
      });

      let currentY = kpiY + rowH * 2 + cardGap + 7.5;

      // ── Helper to format dates for table ──
      const formatRowDate = (dateStr) => {
        if (!dateStr) return { date: "N/A", day: "N/A" };
        const dObj = new Date(dateStr + "T12:00:00Z");
        return {
          date: dObj.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
          day: dObj.toLocaleDateString("en-US", { weekday: "long" }),
        };
      };

      // ── 4. Detailed Table 1: Missing Daily Attendance Working Days ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`1. MISSING DAILY ATTENDANCE (${missingDailyDates.length} WORKING DAYS)`, margin, currentY);

      if (missingDailyDates.length === 0) {
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(margin, currentY + 2.5, contentWidth, 8, 1.5, 1.5, "F");
        doc.setDrawColor(187, 247, 208);
        doc.roundedRect(margin, currentY + 2.5, contentWidth, 8, 1.5, 1.5, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.8);
        doc.setTextColor(22, 101, 52);
        doc.text("✓ Excellent! All working day daily attendance check-ins are recorded and verified.", margin + 4, currentY + 7.5);
        currentY += 14.5;
      } else {
        const dailyRows = missingDailyDates.map((dateStr, idx) => {
          const info = formatRowDate(dateStr);
          return [idx + 1, dateStr, info.date, info.day, "Unrecorded Daily Check-in"];
        });

        autoTable(doc, {
          startY: currentY + 2.5,
          margin: { left: margin, right: margin },
          head: [["#", "Date (YYYY-MM-DD)", "Formatted Date", "Day of Week", "Status"]],
          body: dailyRows,
          theme: "striped",
          headStyles: {
            fillColor: [225, 29, 72],
            textColor: [255, 255, 255],
            fontSize: 7.5,
            fontStyle: "bold",
            halign: "left",
          },
          styles: {
            fontSize: 7.2,
            cellPadding: 1.8,
            textColor: [30, 41, 59],
          },
          columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: 35 },
            2: { cellWidth: 40 },
            3: { cellWidth: 35 },
            4: { cellWidth: 62, fontStyle: "bold", textColor: [190, 18, 60] },
          },
        });

        currentY = doc.lastAutoTable.finalY + 6.5;
      }

      // Check page break before Table 2
      if (currentY > pageHeight - 45) {
        doc.addPage();
        currentY = 16;
      }

      // ── 5. Detailed Table 2: Missing Logbook Submissions ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`2. MISSING LOGBOOK ENTRIES (${missingLogbookDates.length} WORKING DAYS)`, margin, currentY);

      if (missingLogbookDates.length === 0) {
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(margin, currentY + 2.5, contentWidth, 8, 1.5, 1.5, "F");
        doc.setDrawColor(187, 247, 208);
        doc.roundedRect(margin, currentY + 2.5, contentWidth, 8, 1.5, 1.5, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.8);
        doc.setTextColor(22, 101, 52);
        doc.text("✓ Excellent! All working day logbook submissions are recorded and up to date.", margin + 4, currentY + 7.5);
        currentY += 14.5;
      } else {
        const logbookRows = missingLogbookDates.map((dateStr, idx) => {
          const info = formatRowDate(dateStr);
          return [idx + 1, dateStr, info.date, info.day, "Missing Daily Work Log"];
        });

        autoTable(doc, {
          startY: currentY + 2.5,
          margin: { left: margin, right: margin },
          head: [["#", "Date (YYYY-MM-DD)", "Formatted Date", "Day of Week", "Status"]],
          body: logbookRows,
          theme: "striped",
          headStyles: {
            fillColor: [217, 119, 6],
            textColor: [255, 255, 255],
            fontSize: 7.5,
            fontStyle: "bold",
            halign: "left",
          },
          styles: {
            fontSize: 7.2,
            cellPadding: 1.8,
            textColor: [30, 41, 59],
          },
          columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: 35 },
            2: { cellWidth: 40 },
            3: { cellWidth: 35 },
            4: { cellWidth: 62, fontStyle: "bold", textColor: [180, 83, 9] },
          },
        });

        currentY = doc.lastAutoTable.finalY + 6.5;
      }

      // Check page break before Table 3
      if (currentY > pageHeight - 45) {
        doc.addPage();
        currentY = 16;
      }

      // ── 6. Detailed Table 3: Missed Weekly Meeting Sessions ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`3. MISSED WEEKLY MEETING SESSIONS (${missingMeetingWeeks.length} WEEKS)`, margin, currentY);

      if (missingMeetingWeeks.length === 0) {
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(margin, currentY + 2.5, contentWidth, 8, 1.5, 1.5, "F");
        doc.setDrawColor(187, 247, 208);
        doc.roundedRect(margin, currentY + 2.5, contentWidth, 8, 1.5, 1.5, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.8);
        doc.setTextColor(22, 101, 52);
        doc.text("✓ Excellent! All weekly team meeting sessions were attended as scheduled.", margin + 4, currentY + 7.5);
      } else {
        const meetingRows = missingMeetingWeeks.map((weekObj, idx) => {
          const monStr = weekObj.monday instanceof Date
            ? weekObj.monday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : String(weekObj.weekKey || "N/A");
          const friStr = weekObj.friday instanceof Date
            ? weekObj.friday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "N/A";
          return [idx + 1, weekObj.weekKey || "N/A", `${monStr} – ${friStr}`, "Missed Weekly Meeting Session"];
        });

        autoTable(doc, {
          startY: currentY + 2.5,
          margin: { left: margin, right: margin },
          head: [["#", "Week Reference Key", "Week Period (Monday – Friday)", "Status"]],
          body: meetingRows,
          theme: "striped",
          headStyles: {
            fillColor: [109, 40, 217],
            textColor: [255, 255, 255],
            fontSize: 7.5,
            fontStyle: "bold",
            halign: "left",
          },
          styles: {
            fontSize: 7.2,
            cellPadding: 1.8,
            textColor: [30, 41, 59],
          },
          columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: 45 },
            2: { cellWidth: 65 },
            3: { cellWidth: 62, fontStyle: "bold", textColor: [109, 40, 217] },
          },
        });
      }

      // ── 7. Add Footers and Page Numbers on all pages ──
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("TalentHub  •  SLT Mobitel Digital Platforms  •  Official Compliance & Attendance Audit", margin, pageHeight - 7);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
      }

      const safeName = (intern?.traineeName || intern?.name || "Intern").replace(/[^a-zA-Z0-9]/g, "_");
      const safeId = String(intern?.traineeId || intern?.Trainee_ID || "3548").replace(/[^a-zA-Z0-9]/g, "_");
      const dateStamp = new Date().toISOString().slice(0, 10);
      doc.save(`TalentHub_Missing_Records_${safeId}_${safeName}_${dateStamp}.pdf`);
    } catch (err) {
      console.error("Error generating Missing Records PDF:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsExportingPDF(false);
    }
  }, []);

  // ── Holidays (must be declared before metrics useMemos that depend on it) ──
  const [holidays, setHolidays] = useState([]);
  const fetchedHolidayYears = useRef(new Set());

  // ── Synced Metrics Calculations (Exact match with Intern Dashboard & University Dashboard) ──
  const workingDays = useMemo(() => {
    const startDateVal = intern?.startDate || intern?.Training_StartDate;
    if (!startDateVal) return 1;
    const now = new Date();
    const holidaySet = new Set((holidays || []).map((h) => (typeof h === 'string' ? h : h.date)));
    // Always calculate from internship start date to current date
    return calcWorkingDaysUtil(startDateVal, now, holidaySet);
  }, [intern, holidays]);

  const elapsedWeeks = useMemo(() => {
    const startDateVal = intern?.startDate || intern?.Training_StartDate;
    if (!startDateVal) return 0;
    const now = new Date();
    // Always calculate from internship start date to current date
    return calcElapsedWeeksUtil(startDateVal, now);
  }, [intern]);

  const attendedDaysCount = useMemo(() => {
    const startDateVal = intern?.startDate || intern?.Training_StartDate;
    const startDStr = toDateStr(startDateVal);
    const todayDStr = toDateStr(new Date());
    const records = attendanceData?.dailyAttendance || [];
    const holidaySet = new Set((holidays || []).map((h) => (typeof h === 'string' ? h : h.date)));
    return new Set(
      records
        .filter((r) => {
          if (!r.date) return false;
          const s = (r.status || "").toLowerCase();
          const isPresent = s === "present" || s === "late" || !r.status;
          if (!isPresent) return false;
          const dStr = toDateStr(r.date); // Colombo YYYY-MM-DD
          if (!dStr) return false;
          // Filter out dates before internship start date or after today
          if (startDStr && dStr < startDStr) return false;
          if (todayDStr && dStr > todayDStr) return false;
          // Derive day-of-week from the Colombo date string (noon UTC avoids any tz shift)
          const dow = new Date(dStr + "T12:00:00Z").getUTCDay();
          const isWeekend = dow === 0 || dow === 6;
          const isHoliday = holidaySet.has(dStr);
          return !isWeekend && !isHoliday;
        })
        .map((r) => toDateStr(r.date))
        .filter(Boolean)
    ).size;
  }, [attendanceData, holidays, intern]);

  const dailyAttendanceRate = useMemo(() => {
    const startDateVal = intern?.startDate || intern?.Training_StartDate;
    if (!startDateVal) return 0;
    return calcDailyAttendanceRate(attendedDaysCount, workingDays);
  }, [intern, attendedDaysCount, workingDays]);

  const attendedMeetingWeeksCount = useMemo(() => {
    const startDateVal = intern?.startDate || intern?.Training_StartDate;
    const startMonKey = getMondayWeekKey(startDateVal);
    const todayMonKey = getMondayWeekKey(new Date());

    return new Set(
      (attendanceData?.meetingAttendance || [])
        .filter((r) => {
          const s = (r.status || "").toLowerCase();
          const isPresent = s === "present" || s === "late" || !r.status;
          if (!isPresent || !r.date) return false;
          const wKey = getMondayWeekKey(r.date);
          if (!wKey) return false;
          // Ignore previous weeks before the internship start week or current incomplete week
          if (startMonKey && wKey < startMonKey) return false;
          if (todayMonKey && wKey >= todayMonKey) return false;
          return true;
        })
        .map((r) => getMondayWeekKey(r.date))
        .filter(Boolean)
    ).size;
  }, [attendanceData, intern]);

  const meetingAttendanceRate = useMemo(() => {
    const startDateVal = intern?.startDate || intern?.Training_StartDate;
    if (!startDateVal) return 0;
    return calcMeetingAttendanceRate(attendedMeetingWeeksCount, elapsedWeeks);
  }, [intern, attendedMeetingWeeksCount, elapsedWeeks]);

  const commitsCount = useMemo(() => {
    if (gitCommitsData) {
      if (gitCommitsData.totalCommits !== undefined) {
        return Number(gitCommitsData.totalCommits) || 0;
      }
      let all = [];
      const projects = Array.isArray(gitCommitsData)
        ? gitCommitsData
        : (gitCommitsData.projectCommits || []);
      function walk(node) {
        if (!node) return;
        if (Array.isArray(node.commits)) all.push(...node.commits);
        if (Array.isArray(node.modules)) node.modules.forEach(walk);
        if (Array.isArray(node.children)) node.children.forEach(walk);
        if (Array.isArray(node.subProjects)) node.subProjects.forEach(walk);
      }
      projects.forEach(walk);
      return all.length;
    }
    if (typeof intern?.commitsCount === "number") {
      return intern.commitsCount;
    }
    if (Array.isArray(intern?.gitCommits)) {
      return intern.gitCommits.length;
    }
    return 0;
  }, [gitCommitsData, intern]);

  const projectsCount = useMemo(() => {
    if (gitCommitsData) {
      if (gitCommitsData.totalProjects !== undefined) {
        return Number(gitCommitsData.totalProjects) || 0;
      }
      const projects = Array.isArray(gitCommitsData)
        ? gitCommitsData
        : (gitCommitsData.projectCommits || []);
      return projects.length;
    }
    if (typeof intern?.projectsCount === "number") {
      return intern.projectsCount;
    }
    if (Array.isArray(intern?.projects)) {
      return intern.projects.length;
    }
    return 0;
  }, [gitCommitsData, intern]);

  const logbookCount = useMemo(() => {
    const startDateVal = intern?.startDate || intern?.Training_StartDate;
    const startDStr = toDateStr(startDateVal);
    const todayDStr = toDateStr(new Date());
    const holidaySet = new Set((holidays || []).map((h) => (typeof h === 'string' ? h : h.date)));
    const records = internDetails?.records || attendanceData?.dailyAttendance || [];
    return records.filter((r) => {
      if (!r.date) return false;
      const status = (r.status || r.recordStatus || "working").toLowerCase();
      if (status === "leave" || status === "study_leave") return false;
      const dStr = toDateStr(r.date);
      if (!dStr) return false;
      if (startDStr && dStr < startDStr) return false;
      if (todayDStr && dStr > todayDStr) return false;
      const dow = new Date(dStr + "T12:00:00Z").getUTCDay();
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = holidaySet.has(dStr);
      return !isWeekend && !isHoliday;
    }).length;
  }, [internDetails?.records, attendanceData, holidays, intern]);

  const logbookRate = useMemo(() => {
    const startDateVal = intern?.startDate || intern?.Training_StartDate;
    if (!startDateVal) return 0;
    return calcLogbookRate(logbookCount, workingDays);
  }, [intern, logbookCount, workingDays]);

  const performanceRate = useMemo(() => {
    const startDateVal = intern?.startDate || intern?.Training_StartDate;
    if (!startDateVal) return 0;
    const spec = intern?.field_of_spec_name || intern?.fieldOfSpecialization || intern?.specialization || "";
    return calcPerformanceRate({
      logbookRate,
      meetingAttendanceRate,
      commitsCount,
      workingDays,
      specialization: spec,
    });
  }, [intern, logbookRate, meetingAttendanceRate, commitsCount, workingDays]);

  const workQualityRate = performanceRate;

  const fetchHolidays = useCallback(async (year) => {
    if (!year || fetchedHolidayYears.current.has(year)) return;
    fetchedHolidayYears.current.add(year);
    try {
      const response = await fetch(`${API_BASE_URL}/holidays/${year}`);
      if (!response.ok) {
        throw new Error(`Holiday request failed: ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data.holidays)) {
        throw new Error(data.error || "Holiday response had no holidays");
      }
      setHolidays((prev) => {
        // Merge new holidays, deduplicate by date string
        const existing = new Map(prev.map((h) => [h.date, h]));
        data.holidays.forEach((h) => existing.set(h.date, h));
        return Array.from(existing.values());
      });
    } catch (error) {
      // Allow a retry on the next navigation rather than caching the failure
      fetchedHolidayYears.current.delete(year);
      console.error("Holiday fetch failed:", error);
    }
  }, []);

  const getHolidayForDate = useCallback(
    (date) => {
      if (!date) return null;
      return holidays.find((holiday) => {
        const holidayDate = new Date(holiday.date);
        return (
          holidayDate.getDate() === date.getDate() &&
          holidayDate.getMonth() === date.getMonth() &&
          holidayDate.getFullYear() === date.getFullYear()
        );
      });
    },
    [holidays],
  );

  const fetchGitCommits = useCallback(async () => {
    try {
      setGitCommitsLoading(true);
      const data = await adminApi.getInternGitCommits(internId);
      setGitCommitsData(data);
    } catch (err) {
      console.error("Error fetching git commits:", err);
    } finally {
      setGitCommitsLoading(false);
    }
  }, [internId]);

  const fetchAttendance = useCallback(async () => {
    try {
      setAttendanceLoading(true);
      setAttendanceError(null);
      const data = await adminApi.getInternAttendance(internId);
      setAttendanceData(data);
    } catch (err) {
      console.error("Error fetching attendance:", err);
      setAttendanceError("Failed to load attendance data.");
    } finally {
      setAttendanceLoading(false);
    }
  }, [internId]);

  const fetchCertAttendanceCount = useCallback(async () => {
    try {
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      if (!adminInfo.token) return;
      const res = await fetch(
        `${API_BASE_URL}/admin/intern/${internId}/certificate-data`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminInfo.token}`,
          },
        },
      );
      if (!res.ok) return;
      const certData = await res.json();
      setCertAttendanceCount(certData.attendanceCount ?? null);
    } catch (err) {
      console.warn("Could not fetch cert attendance count:", err);
    }
  }, [internId]);

  const fetchInternDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      if (!adminInfo.token) {
        navigate("/admin-login");
        return;
      }
      const data = await adminApi.getInternDetails(internId);
      setInternDetails(data);
      if (data.records && data.records.length > 0) {
        setRecentRecords(data.records.slice(0, 5));
      }
    } catch (error) {
      console.error("Error fetching intern details:", error);
      setError("Failed to load intern details");
      if (error.message && (error.message.includes("403") || error.message.includes("401"))) {
        localStorage.removeItem("adminInfo");
        navigate("/admin-login");
      }
    } finally {
      setLoading(false);
    }
  }, [internId, navigate]);

  const fetchRecordCounts = useCallback(async () => {
    try {
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      const res = await fetch(
        `${API_BASE_URL}/admin/intern/${internId}/record-counts`,
        { headers: { Authorization: `Bearer ${adminInfo.token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setRecordCounts(data);
      }
    } catch (err) {
      console.warn("Could not fetch record counts:", err);
    }
  }, [internId]);

  // Load all initial data once when internId changes
  useEffect(() => {
    fetchInternDetails();
    fetchAttendance();
    fetchGitCommits();
    fetchCertAttendanceCount();
    fetchRecordCounts();
    fetchHolidays(new Date().getFullYear());
  }, [internId]);

  // Re-fetch holidays when calendar months change to a different year
  useEffect(() => {
    const years = new Set([
      calendarMonth.getFullYear(),
      logbookCalMonth.getFullYear(),
    ]);
    years.forEach((y) => fetchHolidays(y));
  }, [calendarMonth, logbookCalMonth, fetchHolidays]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (statistics) => {
    if (statistics.isOverdue) {
      return (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-600 border border-red-200"
        >
          <FaExclamationTriangle className="mr-2" /> Overdue
        </motion.div>
      );
    } else if (statistics.totalRecords === 0) {
      return (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 border border-gray-200"
        >
          <FaTimesCircle className="mr-2" /> Inactive
        </motion.div>
      );
    } else {
      return (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-600 border border-green-200"
        >
          <FaCheckCircle className="mr-2" /> Active
        </motion.div>
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-t-4 border-b-4 border-green-500 rounded-full mx-auto mb-6"
          />
          <p className="text-gray-600 font-medium">Loading intern details...</p>
        </div>
      </div>
    );
  }

  if (error || !internDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <motion.div
          className="text-center max-w-md p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-lg"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <FaExclamationTriangle className="text-4xl text-red-500 mb-4 mx-auto" />
          <p className="text-red-600 mb-6">
            {error || "Intern details not found"}
          </p>
          <div className="flex justify-center space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchInternDetails}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-xl shadow-md"
            >
              Retry
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/admin/dashboard")}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl"
            >
              Back to Dashboard
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  const { statistics } = internDetails;

  return (
    <AdminNavigation>
      <div className="min-h-screen bg-[#f8fafc] text-gray-800">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Page header */}
            <motion.div
              className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">
                    Intern Profile
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-gray-600">
                  Detailed information and performance metrics
                </p>
              </div>
              <div className="w-full sm:w-auto">
                {getStatusBadge(statistics)}
              </div>
            </motion.div>

            {/* Tabs — modern pill style & Meta Tags */}
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="inline-flex items-center rounded-xl bg-gray-100 p-1 border border-gray-200/60 overflow-x-auto max-w-full">
                {["overview", "records", "attendance", "details", "preview"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      if (tab === "attendance" || tab === "details" || tab === "preview") {
                        fetchAttendance();
                      }
                    }}
                    className={`px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap ${
                      activeTab === tab
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab === "overview" && "Overview"}
                    {tab === "records" && "Records"}
                    {tab === "attendance" && "Attendance"}
                    {tab === "details" && "Details"}
                    {tab === "preview" && "Preview"}
                  </button>
                ))}
              </div>

              {/* Meta Tags (Started & Working Days) */}
              <div className="flex flex-wrap items-center gap-2">
                {(intern?.startDate || intern?.Training_StartDate) && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-100 shadow-sm">
                    <FaCalendarAlt className="text-indigo-500" />
                    <span>
                      Started:{" "}
                      {new Date(intern?.startDate || intern?.Training_StartDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                )}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold border border-blue-100 shadow-sm">
                  <FaCalendarDay className="text-blue-500" />
                  <span>{workingDays} Total Working Days</span>
                </div>
              </div>
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* ══ OVERVIEW ══ */}
                {activeTab === "overview" && (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Profile card */}
                    <motion.div
                      className="bg-white rounded-2xl border border-gray-200 shadow-sm relative mb-6 overflow-hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                    >
                      {/* Cover Banner */}
                      <div className="h-24 sm:h-32 bg-slate-900 w-full relative overflow-hidden">
                        <div className="absolute inset-0 bg-[linear-gradient(40deg,transparent_20%,rgba(255,255,255,0.05)_50%,transparent_80%)]"></div>
                      </div>

                      <div className="px-5 sm:px-8 pb-6 sm:pb-8 relative">
                        {/* Avatar & Buttons Row */}
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 sm:-mt-12 mb-4">
                          {/* Overlapping Avatar */}
                          <div className="relative inline-block z-10">
                            <div className="h-20 w-20 sm:h-24 sm:w-24 bg-white p-1 rounded-2xl shadow-md border border-gray-100">
                              <div className="h-full w-full bg-slate-100 rounded-xl flex items-center justify-center border border-gray-200 overflow-hidden relative">
                                <img
                                  src={`${API_BASE_URL}/interns/${intern._id}/profile-picture`}
                                  alt={intern.traineeName}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                    if (e.target.nextSibling)
                                      e.target.nextSibling.style.display =
                                        "flex";
                                  }}
                                />
                                <div
                                  style={{
                                    display: "none",
                                    width: "100%",
                                    height: "100%",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <FaUser className="text-slate-400 text-3xl sm:text-4xl" />
                                </div>
                              </div>
                            </div>
                            <div className="absolute -bottom-1.5 -right-1.5 bg-white rounded-full p-0.5 shadow-sm border border-gray-100">
                              <div className="bg-emerald-500 rounded-full h-5 w-5 flex items-center justify-center">
                                <FaCheckCircle className="text-white text-[10px]" />
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 sm:gap-3 sm:mb-2">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() =>
                                window.open(`mailto:${intern.email}`, "_blank")
                              }
                              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-white text-slate-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
                            >
                              <FaEnvelope className="mr-2 text-slate-400" />{" "}
                              Contact
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() =>
                                navigate(
                                  `/admin/intern/${internId}/certificate`,
                                )
                              }
                              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm border border-slate-900"
                            >
                              <FaCertificate className="mr-2 text-amber-400" />{" "}
                              Certificate
                            </motion.button>
                          </div>
                        </div>

                        {/* Profile Info */}
                        <div className="mb-6">
                          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                            {intern.traineeName}
                          </h3>
                          <p className="text-sm font-medium text-slate-500 mt-0.5">
                            Trainee ID:{" "}
                            <span className="text-slate-700">
                              {intern.traineeId}
                            </span>
                          </p>
                        </div>

                        {/* Metadata Strip */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5 border-t border-gray-100">
                          <div>
                            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
                              Email
                            </p>
                            <div className="flex items-center text-sm font-medium text-slate-800">
                              <FaEnvelope className="mr-2 text-slate-400" />
                              <span className="truncate">{intern.email}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
                              Specialization
                            </p>
                            <div className="flex items-center text-sm font-medium text-slate-800">
                              <FaBuilding className="mr-2 text-slate-400" />
                              <span className="truncate">
                                {intern.fieldOfSpecialization ||
                                  "Not specified"}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
                              Start Date
                            </p>
                            <div className="flex items-center text-sm font-medium text-slate-800">
                              <FaCalendarAlt className="mr-2 text-slate-400" />
                              {intern.startDate
                                ? formatDate(intern.startDate)
                                : "N/A"}
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
                              End Date
                            </p>
                            <div className="flex items-center text-sm font-medium text-slate-800">
                              <FaCalendarCheck className="mr-2 text-slate-400" />
                              {intern.endDate
                                ? formatDate(intern.endDate)
                                : "N/A"}
                            </div>
                          </div>

                          {/* Meeting Attendance Rate */}
                          {attendanceData && (
                            <div className="sm:col-span-2 lg:col-span-4 pt-4 border-t border-slate-100">
                              <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                                  <FaChartPie className="text-slate-400" />{" "}
                                  Meeting Attendance Rate
                                </p>
                                <span
                                  className={`text-sm font-black ${
                                    meetingAttendanceRate >= 80
                                      ? "text-emerald-600"
                                      : meetingAttendanceRate >= 50
                                        ? "text-amber-500"
                                        : "text-red-500"
                                  }`}
                                >
                                  {meetingAttendanceRate}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-2 rounded-full transition-all duration-700"
                                  style={{
                                    width: `${meetingAttendanceRate}%`,
                                    background: `linear-gradient(90deg, ${
                                      meetingAttendanceRate >= 80
                                        ? "#22c55e"
                                        : meetingAttendanceRate >= 50
                                          ? "#f59e0b"
                                          : "#ef4444"
                                    }, ${
                                      meetingAttendanceRate >= 80
                                        ? "#22c55ecc"
                                        : meetingAttendanceRate >= 50
                                          ? "#f59e0bcc"
                                          : "#ef4444cc"
                                    })`,
                                  }}
                                />
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {attendedMeetingWeeksCount} weeks attended out of {elapsedWeeks} weeks elapsed (1 meeting per week)
                              </p>
                            </div>
                          )}

                          {/* Daily Attendance Rate */}
                          {attendanceData && (
                            <div className="sm:col-span-2 lg:col-span-4 pt-4 border-t border-slate-100">
                              <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                                  <FaChartLine className="text-slate-400" />{" "}
                                  Daily Attendance Rate
                                </p>
                                <span
                                  className={`text-sm font-black ${
                                    dailyAttendanceRate >= 80
                                      ? "text-blue-500"
                                      : dailyAttendanceRate >= 50
                                        ? "text-purple-500"
                                        : "text-pink-500"
                                  }`}
                                >
                                  {dailyAttendanceRate}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-2 rounded-full transition-all duration-700"
                                  style={{
                                    width: `${dailyAttendanceRate}%`,
                                    background: `linear-gradient(90deg, ${
                                      dailyAttendanceRate >= 80
                                        ? "#3b82f6"
                                        : dailyAttendanceRate >= 50
                                          ? "#8b5cf6"
                                          : "#ec4899"
                                    }, ${
                                      dailyAttendanceRate >= 80
                                        ? "#3b82f6cc"
                                        : dailyAttendanceRate >= 50
                                          ? "#8b5cf6cc"
                                          : "#ec4899cc"
                                    })`,
                                  }}
                                />
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {attendedDaysCount} day{attendedDaysCount !== 1 ? "s" : ""} attended out of {workingDays} expected working days
                              </p>
                            </div>
                          )}

                          {/* Performance / Work Quality Rate */}
                          {attendanceData && (
                            <div className="sm:col-span-2 lg:col-span-4 pt-4 border-t border-slate-100">
                              <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                                  <FaAward className="text-blue-500" />{" "}
                                  Performance Rate
                                </p>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      performanceRate >= 80
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : performanceRate >= 60
                                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                                          : "bg-rose-50 text-rose-700 border border-rose-200"
                                    }`}
                                  >
                                    {getPerformanceStatus(performanceRate)}
                                  </span>
                                  <span
                                    className={`text-sm font-black ${
                                      performanceRate >= 80
                                        ? "text-emerald-600"
                                        : performanceRate >= 60
                                          ? "text-amber-600"
                                          : "text-rose-600"
                                    }`}
                                  >
                                    {performanceRate}%
                                  </span>
                                </div>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-2 rounded-full transition-all duration-700"
                                  style={{
                                    width: `${performanceRate}%`,
                                    background: `linear-gradient(90deg, ${
                                      performanceRate >= 80
                                        ? "#059669"
                                        : performanceRate >= 60
                                          ? "#d97706"
                                          : "#dc2626"
                                    }, ${
                                      performanceRate >= 80
                                        ? "#10b981"
                                        : performanceRate >= 60
                                          ? "#f59e0b"
                                          : "#ef4444"
                                    })`,
                                  }}
                                />
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {isNoCommitSpecialization(intern?.field_of_spec_name || intern?.fieldOfSpecialization || intern?.specialization || "")
                                  ? `Calculated from Logbooks (${logbookRate}%) and Meeting Attendance (${meetingAttendanceRate}%) for ${intern?.field_of_spec_name || intern?.fieldOfSpecialization || intern?.specialization || "Specialization"}`
                                  : `Calculated from Logbooks (${logbookRate}%), Meeting Attendance (${meetingAttendanceRate}%), and GitHub Commit Balance (+${Math.max(0, commitsCount - workingDays)}% from ${commitsCount} commits / ${workingDays} working days)`}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>

                    {/* Stats cards */}
                    <motion.div
                      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.3 }}
                    >
                      {[
                        {
                          label: "Total Records",
                          value: statistics.totalRecords,
                          icon: FaFileAlt,
                          width: Math.min(100, statistics.totalRecords),
                        },
                        {
                          label: "This Week",
                          value: statistics.weeklyRecords,
                          icon: FaTasks,
                          width: Math.min(100, statistics.weeklyRecords * 20),
                        },
                        {
                          label: "This Month",
                          value: statistics.monthlyRecords,
                          icon: FaRegCalendarCheck,
                          width: Math.min(100, statistics.monthlyRecords * 10),
                        },
                        {
                          label: "Days Since Last",
                          value:
                            statistics.daysSinceLastSubmission !== null
                              ? statistics.daysSinceLastSubmission
                              : "Never",
                          icon: FaClock,
                          width: statistics.daysSinceLastSubmission
                            ? Math.max(
                                5,
                                100 - statistics.daysSinceLastSubmission * 5,
                              )
                            : 0,
                        },
                      ].map(({ label, value, icon: Icon, width }) => (
                        <div
                          key={label}
                          className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                                {label}
                              </p>
                              <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                                {value}
                              </p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                              <Icon className="h-5 w-5 text-slate-600" />
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-slate-800 h-1.5 rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </motion.div>

                    {/* Current Projects */}
                    <motion.div
                      className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm mt-4 sm:mt-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.9, duration: 0.3 }}
                    >
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center mb-4">
                        <FaLayerGroup className="mr-2 text-indigo-500" />{" "}
                        Current Projects
                        <span className="ml-auto text-xs font-normal text-gray-400">
                          Synced from TalentTrail
                        </span>
                      </h3>
                      {intern.projects && intern.projects.length > 0 ? (
                        <div className="space-y-3">
                          {intern.projects.map((proj, pi) => {
                            const style = PROJECT_STATUS_STYLE[proj.status] || {
                              bg: "bg-gray-100",
                              text: "text-gray-600",
                              label: proj.status || "Unknown",
                            };
                            return (
                              <motion.div
                                key={pi}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.05 * pi }}
                                className="border border-gray-100 rounded-xl p-4 hover:border-indigo-200 hover:shadow-sm transition-all"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900 text-sm">
                                      {proj.projectName}
                                    </span>
                                    <span
                                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
                                    >
                                      {style.label}
                                    </span>
                                  </div>
                                  <div className="flex gap-3 text-xs text-gray-500">
                                    {proj.startDate && (
                                      <span>
                                        Start:{" "}
                                        {new Date(
                                          proj.startDate,
                                        ).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })}
                                      </span>
                                    )}
                                    {proj.targetDate && (
                                      <span>
                                        Target:{" "}
                                        {new Date(
                                          proj.targetDate,
                                        ).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {proj.description && (
                                  <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                                    {proj.description}
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-4 text-xs text-gray-500 border-t border-gray-50 pt-2 mt-2">
                                  {proj.projectManagerName && (
                                    <span className="flex items-center gap-1">
                                      <FaUserCheck className="text-gray-400" />{" "}
                                      PM:{" "}
                                      <span className="font-medium text-gray-700">
                                        {proj.projectManagerName}
                                      </span>
                                    </span>
                                  )}
                                  {proj.supervisorName && (
                                    <span className="flex items-center gap-1">
                                      <FaUser className="text-gray-400" />{" "}
                                      Supervisor:{" "}
                                      <span className="font-medium text-gray-700">
                                        {proj.supervisorName}
                                      </span>
                                    </span>
                                  )}
                                  {proj.teams && proj.teams.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <FaTeam className="text-gray-400" />{" "}
                                      Teams:{" "}
                                      {proj.teams
                                        .map((t) => t.teamName)
                                        .join(", ")}
                                    </span>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                          <FaLayerGroup className="text-4xl mb-2 opacity-30" />
                          <p className="text-sm">
                            No project assignments synced from TalentTrail
                          </p>
                        </div>
                      )}
                    </motion.div>

                    {/* University Supervisor Feedback Section */}
                    <motion.div
                      className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm mt-4 sm:mt-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.85, duration: 0.3 }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                          <FaGraduationCap className="mr-2 text-emerald-600" />
                          University Supervisor Feedback
                        </h3>
                        {(internDetails?.universityFeedbacks || []).length > 0 && (
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {(internDetails?.universityFeedbacks || []).length} Feedback{(internDetails?.universityFeedbacks || []).length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>

                      {(internDetails?.universityFeedbacks || []).length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {internDetails.universityFeedbacks.map((fb, fi) => (
                            <motion.div
                              key={fb._id || fi}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.05 * fi }}
                              className="border border-slate-100 rounded-xl p-4 sm:p-5 bg-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-3 mb-2.5">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#50b748] to-[#00b4eb] text-white font-bold text-xs flex items-center justify-center shadow-sm shrink-0 overflow-hidden border border-slate-200">
                                      {fb.picture || fb.supervisorPicture ? (
                                        <img
                                          src={fb.picture || fb.supervisorPicture}
                                          alt={fb.supervisorName}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            e.target.style.display = "none";
                                            if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                                          }}
                                        />
                                      ) : null}
                                      <span style={{ display: fb.picture || fb.supervisorPicture ? "none" : "flex" }} className="w-full h-full items-center justify-center">
                                        {(fb.supervisorName || "U")[0].toUpperCase()}
                                      </span>
                                    </div>
                                    <div>
                                      <div className="font-bold text-slate-800 text-sm leading-tight">
                                        {fb.supervisorName}
                                      </div>
                                      <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                                        <FaBuilding className="text-[10px]" />
                                        <span>{fb.universityName || intern.institute || "University"}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Rating */}
                                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 shrink-0">
                                    <div className="flex">
                                      {[1, 2, 3, 4, 5].map((s) => (
                                        <FaStar
                                          key={s}
                                          className={`text-[10px] ${s <= (fb.rating || 5) ? "text-amber-400" : "text-slate-200"}`}
                                        />
                                      ))}
                                    </div>
                                    <span className="text-[11px] font-extrabold text-amber-700 ml-0.5">
                                      {fb.rating || 5}.0
                                    </span>
                                  </div>
                                </div>

                                {/* Comment */}
                                <div className="relative pl-3 border-l-2 border-emerald-400 my-2.5">
                                  <p className="text-xs text-slate-600 leading-relaxed italic">
                                    "{fb.comment}"
                                  </p>
                                </div>

                                {/* Tags */}
                                {Array.isArray(fb.tags) && fb.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {fb.tags.map((tag, ti) => (
                                      <span
                                        key={ti}
                                        className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60"
                                      >
                                        #{tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                                <span className="flex items-center gap-1">
                                  <FaCalendarAlt className="text-[9px]" />
                                  {fb.createdAt ? formatDate(fb.createdAt) : "Recent"}
                                </span>
                                {fb.supervisorEmail && (
                                  <span className="truncate max-w-[150px]">{fb.supervisorEmail}</span>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                          <FaGraduationCap className="text-3xl mb-2 text-slate-300" />
                          <p className="text-xs font-medium text-slate-600">
                            No university supervisor feedback recorded yet
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Evaluations and comments submitted via the University Portal will be visible here.
                          </p>
                        </div>
                      )}
                    </motion.div>

                    {/* Recent records preview */}
                    {recentRecords.length > 0 && (
                      <motion.div
                        className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm mt-4 sm:mt-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 0.3 }}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                            <FaHistory className="mr-2 text-cyan-500" /> Recent
                            Activity
                          </h3>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() =>
                              navigate(`/admin/intern/${internId}/records`)
                            }
                            className="text-xs sm:text-sm text-cyan-600 hover:text-cyan-700 flex items-center"
                          >
                            View All Records{" "}
                            <FaArrowLeft className="ml-1 rotate-180" />
                          </motion.button>
                        </div>

                        {/* Mobile */}
                        <div className="block sm:hidden space-y-3">
                          {recentRecords.map((record, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 * index }}
                              className="bg-gray-50 rounded-xl p-3 border border-gray-200"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {record.taskDescription ||
                                      record.task ||
                                      "N/A"}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {formatDate(record.createdAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {record.stack || "N/A"}
                                </span>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() =>
                                    navigate(
                                      `/admin/intern/${internId}/records`,
                                    )
                                  }
                                  className="flex items-center text-cyan-600 hover:bg-cyan-50 px-2 py-1 rounded-xl text-xs shadow-sm"
                                >
                                  <FaEye className="mr-1 h-3 w-3" /> View
                                </motion.button>
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* Desktop */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr>
                                {["Date", "Task", "Stack", "Actions"].map(
                                  (h) => (
                                    <th
                                      key={h}
                                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                      {h}
                                    </th>
                                  ),
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {recentRecords.map((record, index) => (
                                <motion.tr
                                  key={index}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.1 * index }}
                                  className="hover:bg-gray-50"
                                >
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    {formatDate(record.createdAt)}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    <div className="max-w-xs truncate">
                                      {record.taskDescription ||
                                        record.task ||
                                        "N/A"}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {record.stack || "N/A"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    <motion.button
                                      onClick={() =>
                                        navigate(
                                          `/admin/intern/${internId}/records`,
                                        )
                                      }
                                      className="flex items-center text-cyan-600 hover:bg-cyan-50 px-3 py-1 rounded-xl shadow-sm"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                    >
                                      <FaEye className="mr-2" /> View
                                    </motion.button>
                                  </td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}

                    {/* GitHub Commits */}
                    {gitCommitsLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      </div>
                    ) : gitCommitsData?.projectCommits?.length > 0 ? (
                      <motion.div
                        className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm mt-4 sm:mt-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.0, duration: 0.3 }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                            <FaCodeBranch className="mr-2 text-green-500" />{" "}
                            GitHub Commits
                          </h3>
                          <span className="text-xs text-gray-400">
                            {gitCommitsData.totalCommits} total commit
                            {gitCommitsData.totalCommits !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="space-y-6">
                          {gitCommitsData.projectCommits.map((proj) => (
                            <div
                              key={proj.projectId}
                              className="relative font-mono text-xs bg-gray-50/50 p-3 rounded-xl border border-gray-100"
                            >
                              <h4 className="font-semibold text-gray-800 mb-3 text-sm">
                                {proj.projectName}
                              </h4>
                              {proj.error ? (
                                <p className="text-gray-400 italic">
                                  Unable to fetch commits:{" "}
                                  {proj.error.replace(/_/g, " ")}
                                </p>
                              ) : proj.commits.length === 0 ? (
                                <p className="text-gray-400 italic">
                                  No commits found for this intern.
                                </p>
                              ) : (
                                <div className="relative">
                                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-green-400 via-blue-400 to-purple-400 rounded-full" />
                                  <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                                    {proj.commits.slice(0, 15).map((c) => {
                                      const prefix = getGithubCommitPrefix(
                                        c.message,
                                      );
                                      const cc = COMMIT_COLORS[prefix];
                                      const msgParts = c.message.split(":");
                                      const msgType =
                                        msgParts.length > 1
                                          ? msgParts[0] + ":"
                                          : "";
                                      const msgBody =
                                        msgParts.length > 1
                                          ? msgParts.slice(1).join(":")
                                          : c.message;
                                      const dateStr = new Date(
                                        c.date,
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                      });
                                      return (
                                        <div
                                          key={c.sha}
                                          className="flex items-start gap-3 pl-1"
                                        >
                                          <div
                                            className={`relative z-10 w-[14px] h-[14px] rounded-full border-2 border-white flex-shrink-0 mt-0.5 shadow-sm ${cc.dot}`}
                                          />
                                          <div className="flex-1 min-w-0 bg-white p-2 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition">
                                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                              {msgType && (
                                                <span
                                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${cc.bg} ${cc.text}`}
                                                >
                                                  {msgType.replace(":", "")}
                                                </span>
                                              )}
                                              <a
                                                href={c.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-gray-800 font-medium hover:text-blue-600 truncate flex-1"
                                              >
                                                {msgBody.trim()}
                                              </a>
                                            </div>
                                            <div className="flex items-center gap-3 text-gray-400 mt-1.5">
                                              <a
                                                href={c.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-green-600 font-bold hover:underline"
                                              >
                                                {c.shortSha}
                                              </a>
                                              <span className="flex items-center gap-1">
                                                {c.authorAvatar && (
                                                  <img
                                                    src={c.authorAvatar}
                                                    alt=""
                                                    className="w-3 h-3 rounded-full"
                                                  />
                                                )}
                                                {c.authorName}
                                              </span>
                                              <span>{dateStr}</span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {proj.commits.length > 15 && (
                                    <p className="text-center text-xs text-gray-400 mt-3 pt-3 border-t border-gray-200">
                                      + {proj.commits.length - 15} more commits
                                      in this repository
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    ) : null}
                  </div>
                )}

                {/* ══ ATTENDANCE ══ */}
                {activeTab === "attendance" &&
                  (() => {
                    const dailyMap = {};
                    if (attendanceData?.dailyAttendance) {
                      attendanceData.dailyAttendance.forEach((entry) => {
                        const d = new Date(entry.date);
                        if (!isNaN(d.getTime())) dailyMap[toDateKey(d)] = entry;
                      });
                    }
                    const meetingMap = {};
                    if (attendanceData?.meetingAttendance) {
                      attendanceData.meetingAttendance.forEach((entry) => {
                        const d = new Date(entry.date);
                        if (!isNaN(d.getTime())) {
                          const key = toDateKey(d);
                          if (!meetingMap[key]) meetingMap[key] = [];
                          meetingMap[key].push(entry);
                        }
                      });
                    }

                    const year = calendarMonth.getFullYear();
                    const month = calendarMonth.getMonth();
                    const calDays = getCalendarDays(year, month);
                    const monthLabel = calendarMonth.toLocaleDateString(
                      "en-US",
                      { month: "long", year: "numeric" },
                    );

                    // Monthly stats
                    const monthDailyKeys = Object.keys(dailyMap).filter((k) => {
                      const [y, m] = k.split("-").map(Number);
                      return y === year && m === month + 1;
                    });
                    const mDailyPresent = monthDailyKeys.filter(
                      (k) =>
                        (dailyMap[k]?.status || "").toLowerCase() === "present",
                    ).length;
                    const mMeetingPresent = Object.values(meetingMap)
                      .flat()
                      .filter((e) => {
                        const d = new Date(e.date);
                        return (
                          d.getFullYear() === year &&
                          d.getMonth() === month &&
                          (e.status || "").toLowerCase() === "present"
                        );
                      }).length;

                    // All-time totals
                    const allDailyPresent = (
                      attendanceData?.dailyAttendance || []
                    ).filter(
                      (e) => (e.status || "").toLowerCase() === "present",
                    ).length;
                    const allMeetingPresent = (
                      attendanceData?.meetingAttendance || []
                    ).filter(
                      (e) => (e.status || "").toLowerCase() === "present",
                    ).length;
                    const allMeetingTotal = (
                      attendanceData?.meetingAttendance || []
                    ).length;
                    const allDailyTotal = (
                      attendanceData?.dailyAttendance || []
                    ).length;

                    const allActivities = [
                      ...(attendanceData?.dailyAttendance || []).map((e) => ({
                        ...e,
                        type: "daily",
                      })),
                      ...(attendanceData?.meetingAttendance || []).map((e) => ({
                        ...e,
                        type: "meeting",
                      })),
                    ]
                      .filter((e) => {
                        const d = new Date(e.date);
                        return (
                          d.getFullYear() === year && d.getMonth() === month
                        );
                      })
                      .sort((a, b) => new Date(b.date) - new Date(a.date));

                    return (
                      <div className="space-y-5">
                        {/* ── Intern Details Card (Profile-style) ── */}
                        <motion.div
                          className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          {/* Header with gradient */}
                          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-cyan-50 p-5 sm:p-6 border-b border-gray-100">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div>
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
                                  {intern.traineeName}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                  {intern.traineeId}
                                </p>
                                {intern.startDate &&
                                  intern.endDate &&
                                  (() => {
                                    const daysLeft = Math.ceil(
                                      (new Date(intern.endDate) - new Date()) /
                                        (1000 * 60 * 60 * 24),
                                    );
                                    return daysLeft > 0 ? (
                                      <span className="inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 shadow-sm">
                                        {daysLeft} DAYS REMAINING
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-red-500 to-red-600 shadow-sm">
                                        TRAINING ENDED
                                      </span>
                                    );
                                  })()}
                              </div>
                              {intern.lastSeen && (
                                <span className="text-xs text-gray-400 bg-white/70 px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                                  Last seen:{" "}
                                  {new Date(intern.lastSeen).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    },
                                  )}{" "}
                                  at{" "}
                                  {new Date(intern.lastSeen).toLocaleTimeString(
                                    "en-US",
                                    { hour: "2-digit", minute: "2-digit" },
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Content sections */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-6">
                            {/* Personal Information */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm h-full">
                              <h4 className="text-sm font-bold text-gray-900 mb-3">
                                Personal Information
                              </h4>
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs text-gray-400">
                                    Email:
                                  </p>
                                  <p className="text-sm font-medium text-gray-800 break-all">
                                    {intern.email || "Not specified"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400">
                                    Institute:
                                  </p>
                                  <p className="text-sm font-medium text-gray-800">
                                    {intern.institute || "Not specified"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400">
                                    Specialization:
                                  </p>
                                  <p className="text-sm font-medium text-gray-800">
                                    {intern.fieldOfSpecialization ||
                                      "Not specified"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              {/* Training Period */}
                              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                <h4 className="text-sm font-bold text-gray-900 mb-3">
                                  Training Period
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <p className="text-xs text-gray-400">
                                      Start Date:
                                    </p>
                                    <p className="text-sm font-semibold text-gray-800">
                                      {intern.startDate
                                        ? formatDate(intern.startDate)
                                        : "N/A"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-400">
                                      End Date:
                                    </p>
                                    <p className="text-sm font-semibold text-gray-800">
                                      {intern.endDate
                                        ? formatDate(intern.endDate)
                                        : "N/A"}
                                    </p>
                                  </div>
                                  {intern.startDate &&
                                    intern.endDate &&
                                    (() => {
                                      const start = new Date(intern.startDate);
                                      const end = new Date(intern.endDate);
                                      const totalDays = Math.ceil(
                                        (end - start) / (1000 * 60 * 60 * 24),
                                      );
                                      const weeks = Math.floor(totalDays / 7);
                                      const remainingDays = totalDays % 7;
                                      const daysLeft = Math.ceil(
                                        (end - new Date()) /
                                          (1000 * 60 * 60 * 24),
                                      );
                                      return (
                                        <>
                                          <div>
                                            <p className="text-xs text-gray-400">
                                              Duration:
                                            </p>
                                            <p className="text-sm font-semibold text-gray-800">
                                              {weeks} weeks, {remainingDays}{" "}
                                              days
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-400">
                                              Status:
                                            </p>
                                            <p
                                              className={`text-sm font-semibold ${daysLeft > 0 ? "text-green-600" : "text-red-600"}`}
                                            >
                                              {daysLeft > 0
                                                ? `${daysLeft} days remaining`
                                                : "Training ended"}
                                            </p>
                                          </div>
                                        </>
                                      );
                                    })()}
                                </div>
                              </div>

                              {/* Project Assignments */}
                              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                <h4 className="text-sm font-bold text-gray-900 mb-3">
                                  Project Assignments
                                </h4>
                                {intern.projects &&
                                intern.projects.length > 0 ? (
                                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                    {intern.projects.map((proj, pi) => (
                                      <div
                                        key={pi}
                                        className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100"
                                      >
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                                          <FaProjectDiagram className="text-white text-xs" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-sm font-semibold text-gray-800 truncate">
                                            {proj.projectName}
                                          </p>
                                          <p className="text-xs text-gray-400">
                                            Status: {proj.status || "N/A"}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400 italic">
                                    No projects assigned
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>

                        <motion.div
                          className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-7 shadow-sm"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.1 }}
                        >
                          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center">
                              <FaCalendarCheck className="mr-3 text-slate-400" />{" "}
                              Attendance Calendar
                            </h3>
                          </div>

                          {attendanceLoading && (
                            <div className="flex justify-center items-center py-16">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{
                                  duration: 1,
                                  repeat: Infinity,
                                  ease: "linear",
                                }}
                                className="w-8 h-8 border-t-2 border-b-2 border-slate-800 rounded-full"
                              />
                            </div>
                          )}
                          {attendanceError && !attendanceLoading && (
                            <div className="text-center py-12 text-red-500 text-sm font-medium">
                              {attendanceError}
                            </div>
                          )}

                          {!attendanceLoading && !attendanceError && (
                            <div>
                              {/* ── All-time stat cards ── */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                                {[
                                  {
                                    count: allDailyPresent,
                                    total: allDailyTotal,
                                    label: "Daily Present",
                                    icon: FaCalendarCheck,
                                    accentColor: "text-emerald-600",
                                  },
                                  {
                                    count: allDailyTotal - allDailyPresent,
                                    total: allDailyTotal,
                                    label: "Daily Absent",
                                    icon: FaTimesCircle,
                                    accentColor: "text-rose-600",
                                  },
                                  {
                                    count: allMeetingPresent,
                                    total: allMeetingTotal,
                                    label: "Meetings Attended",
                                    icon: FaVideo,
                                    accentColor: "text-blue-600",
                                  },
                                  {
                                    count: allMeetingTotal - allMeetingPresent,
                                    total: allMeetingTotal,
                                    label: "Meetings Missed",
                                    icon: FaTimes,
                                    accentColor: "text-amber-600",
                                  },
                                ].map(
                                  ({
                                    count,
                                    total,
                                    label,
                                    sublabel,
                                    icon: Icon,
                                    accentColor,
                                  }) => (
                                    <div
                                      key={label}
                                      className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col shadow-sm relative overflow-hidden"
                                    >
                                      <div className="flex justify-between items-start mb-2">
                                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                          <Icon
                                            className={`text-lg ${accentColor}`}
                                          />
                                        </div>
                                      </div>
                                      <div className="mt-2">
                                        <p
                                          className={`text-2xl font-bold tracking-tight ${accentColor}`}
                                        >
                                          {count}
                                        </p>
                                        <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mt-1">
                                          {label}
                                        </p>
                                        {sublabel && (
                                          <p className="text-[10px] text-slate-400 mt-0.5">
                                            {sublabel}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>

                              {/* Month nav + mini stats */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                <div className="flex items-center space-x-3">
                                  <button
                                    onClick={() =>
                                      setCalendarMonth(
                                        (prev) =>
                                          new Date(
                                            prev.getFullYear(),
                                            prev.getMonth() - 1,
                                            1,
                                          ),
                                      )
                                    }
                                    className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                  >
                                    <FaChevronLeft className="h-3 w-3" />
                                  </button>
                                  <span className="text-sm font-semibold text-gray-800 min-w-[130px] text-center">
                                    {monthLabel}
                                  </span>
                                  <button
                                    onClick={() =>
                                      setCalendarMonth(
                                        (prev) =>
                                          new Date(
                                            prev.getFullYear(),
                                            prev.getMonth() + 1,
                                            1,
                                          ),
                                      )
                                    }
                                    className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                  >
                                    <FaChevronRight className="h-3 w-3" />
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs">
                                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-200 font-medium">
                                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block shadow-sm"></span>
                                    Daily Present: {mDailyPresent}
                                  </span>
                                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200 font-medium">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shadow-sm"></span>
                                    Meetings Attended: {mMeetingPresent}
                                  </span>
                                </div>
                              </div>

                              {/* Calendar grid */}
                              {/* Calendar grid */}
                              <div className="w-full overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm">
                                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                                    <div
                                      key={d}
                                      className="py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
                                    >
                                      {d}
                                    </div>
                                  ))}
                                </div>
                                <div className="grid grid-cols-7 auto-rows-fr">
                                  {calDays.map((day, di) => {
                                    if (!day) return <div key={di} className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50" />;
                                    
                                    const attMeta = getAttendanceMeta(dailyMap, meetingMap, day, getHolidayForDate);
                                    const isToday = day.toDateString() === new Date().toDateString();
                                    const dayKey = toDateKey(day);

                                    const tooltipContent = (() => {
                                      let lines = [
                                        day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
                                      ];
                                      if (attMeta?.isHoliday) {
                                        lines.push(`Holiday: ${attMeta.holidayName}`);
                                      }
                                      const dailyE = dayKey ? dailyMap[dayKey] : null;
                                      if (dailyE && (dailyE.status || "").toLowerCase() === "present") {
                                        lines.push(`Daily: Present (${dailyE.rawType || "Unknown"})`);
                                        if (dailyE.time) lines.push(`Time: ${dailyE.time}`);
                                      }
                                      const meetings = dayKey ? meetingMap[dayKey] || [] : [];
                                      meetings.forEach((m) => {
                                        lines.push(`Meeting: ${m.meetingName || "Meeting"} — ${m.status || "Unknown"}`);
                                      });
                                      return lines.join("\n");
                                    })();
                                    
                                    return (
                                      <div
                                        key={di}
                                        className={`min-h-[100px] border-b border-r border-gray-100 p-2 flex flex-col transition-colors relative ${attMeta?.bgClass || "bg-white"} hover:bg-gray-50`}
                                        title={attMeta?.isHoliday ? attMeta.holidayName : ""}
                                        onMouseEnter={(e) => {
                                          const r = e.currentTarget.getBoundingClientRect();
                                          setTooltip({ x: r.left, y: r.top, label: tooltipContent, date: "" });
                                        }}
                                        onMouseLeave={() => setTooltip(null)}
                                      >
                                        <div className="flex justify-between items-start mb-2">
                                          <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? "bg-blue-600 text-white shadow-sm" : attMeta?.textClass || "text-gray-700"}`}>
                                            {day.getDate()}
                                          </span>
                                        </div>
                                        
                                        <div className="flex flex-col gap-1 flex-1 justify-end">
                                          {attMeta?.hasMeetingAttended && (
                                            <span className="w-full text-center px-1 py-1 text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 rounded shadow-sm border border-blue-200">
                                              Meeting
                                            </span>
                                          )}
                                          {attMeta?.isDailyPresent && (
                                            <span className="w-full text-center px-1 py-1 text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 rounded shadow-sm border border-green-200">
                                              QR / Face
                                            </span>
                                          )}
                                          {!attMeta?.hasMeetingAttended && !attMeta?.isDailyPresent && !attMeta?.isWeekend && !attMeta?.isFuture && !attMeta?.isHoliday && (
                                            <span className="w-full text-center px-1 py-1 text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-400 rounded border border-red-100">
                                              Absent
                                            </span>
                                          )}
                                          {attMeta?.isHoliday && (
                                            <span className="w-full text-center px-1 py-1 text-[10px] font-bold uppercase tracking-wide bg-yellow-100 text-yellow-700 rounded border border-yellow-200 truncate" title={attMeta.holidayName}>
                                              Holiday
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Simplified Legend */}
                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                  Legend
                                </p>
                                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-600">
                                  <span className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 rounded shadow-sm border border-green-200">QR / Face</span>
                                    Daily Present
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 rounded shadow-sm border border-blue-200">Meeting</span>
                                    Meeting Attended
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-yellow-100 text-yellow-700 rounded border border-yellow-200">Holiday</span>
                                    Holiday
                                  </span>
                                </div>
                              </div>

                              {/* Activity list */}
                              <div className="mt-6">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                  All Activity — {monthLabel}
                                </h4>
                                {allActivities.length > 0 ? (
                                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                    {allActivities.map((entry, idx) => {
                                      const d = new Date(entry.date);
                                      const isPresent =
                                        (entry.status || "").toLowerCase() ===
                                        "present";
                                      return (
                                        <div
                                          key={idx}
                                          className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl px-3 py-2.5 text-sm"
                                        >
                                          <div className="flex items-center gap-3">
                                            <span
                                              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                                entry.type === "daily"
                                                  ? isPresent
                                                    ? "bg-green-500"
                                                    : "bg-red-400"
                                                  : isPresent
                                                    ? "bg-blue-500"
                                                    : "bg-orange-400"
                                              }`}
                                            />
                                            <div>
                                              <p className="font-medium text-gray-800 text-xs sm:text-sm">
                                                {d.toLocaleDateString("en-US", {
                                                  weekday: "short",
                                                  month: "short",
                                                  day: "numeric",
                                                })}
                                              </p>
                                              {entry.meetingName && (
                                                <p className="text-[10px] sm:text-xs text-gray-500 truncate max-w-[160px]">
                                                  {entry.meetingName}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                          <span
                                            className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full ${
                                              entry.type === "daily"
                                                ? isPresent
                                                  ? "bg-green-100 text-green-700"
                                                  : "bg-red-50 text-red-500"
                                                : isPresent
                                                  ? "bg-blue-100 text-blue-700"
                                                  : "bg-orange-100 text-orange-600"
                                            }`}
                                          >
                                            {entry.type === "daily"
                                              ? "📅"
                                              : "📹"}{" "}
                                            {entry.status || "No Record"}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-center text-gray-400 text-xs py-6">
                                    No attendance records for {monthLabel}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      </div>
                    );
                  })()}

                {/* Global tooltip */}
                {tooltip && (
                  <div
                    className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none shadow-xl max-w-[220px] whitespace-pre-line"
                    style={{ top: tooltip.y - 48, left: tooltip.x + 12 }}
                  >
                    {tooltip.date && (
                      <>
                        <span className="text-gray-300">{tooltip.date}</span>
                        <br />
                      </>
                    )}
                    <span className="font-semibold">{tooltip.label}</span>
                  </div>
                )}

                {/* ══ RECORDS ══ */}
                {activeTab === "records" &&
                  (() => {
                    const recordMap = {};
                    (internDetails.records || []).forEach((rec) => {
                      const d = new Date(rec.createdAt || rec.date);
                      if (!isNaN(d.getTime())) recordMap[toDateKey(d)] = rec;
                    });

                    const totalRecords = internDetails.records?.length || 0;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const firstRecordDate =
                      totalRecords > 0
                        ? new Date(
                            internDetails.records[
                              internDetails.records.length - 1
                            ].createdAt,
                          )
                        : today;
                    let totalWeekdays = 0;
                    for (
                      let d = new Date(firstRecordDate);
                      d <= today;
                      d.setDate(d.getDate() + 1)
                    ) {
                      if (d.getDay() !== 0 && d.getDay() !== 6) totalWeekdays++;
                    }
                    const missedDays = Math.max(
                      0,
                      totalWeekdays - totalRecords,
                    );

                    const lbYear = logbookCalMonth.getFullYear();
                    const lbMonth = logbookCalMonth.getMonth();
                    const lbCalDays = getCalendarDays(lbYear, lbMonth);
                    const lbMonthLabel = logbookCalMonth.toLocaleDateString(
                      "en-US",
                      { month: "long", year: "numeric" },
                    );

                    return (
                      <>
                        <AnimatePresence>
                          {logbookModal && (
                            <motion.div
                              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              onClick={() => setLogbookModal(null)}
                            >
                              <motion.div
                                className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto"
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between mb-4">
                                  <div>
                                    <h3 className="text-lg font-bold text-gray-900">
                                      Logbook Entry
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                      {new Date(
                                        logbookModal.createdAt ||
                                          logbookModal.date,
                                      ).toLocaleDateString("en-US", {
                                        weekday: "long",
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                      })}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => setLogbookModal(null)}
                                    className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                                  >
                                    <FaTimes />
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {logbookModal.stack && (
                                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                                      {logbookModal.stack}
                                    </span>
                                  )}
                                  {logbookModal.status && (
                                    <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold capitalize">
                                      {logbookModal.status}
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-4">
                                  {logbookModal.task && (
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center">
                                        <FaCheckCircle className="text-blue-500 mr-1.5" />{" "}
                                        Tasks Completed
                                      </p>
                                      <p className="text-sm text-gray-800 leading-relaxed bg-gray-50 rounded-xl p-3">
                                        {logbookModal.task}
                                      </p>
                                    </div>
                                  )}
                                  {logbookModal.progress && (
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center">
                                        <FaChartLine className="text-emerald-500 mr-1.5" />{" "}
                                        Progress
                                      </p>
                                      <p className="text-sm text-gray-800 leading-relaxed bg-gray-50 rounded-xl p-3">
                                        {logbookModal.progress}
                                      </p>
                                    </div>
                                  )}
                                  {logbookModal.blockers && (
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center">
                                        <FaExclamationTriangle className="text-amber-500 mr-1.5" />{" "}
                                        Challenges / Blockers
                                      </p>
                                      <p className="text-sm text-gray-800 leading-relaxed bg-amber-50 rounded-xl p-3">
                                        {logbookModal.blockers}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                              <FaFileAlt className="mr-2 text-blue-500" />{" "}
                              Record History
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex rounded-xl overflow-hidden bg-gray-100 p-1 border border-gray-200/60">
                                <button
                                  onClick={() => setLogbookView("calendar")}
                                  className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all rounded-lg ${
                                    logbookView === "calendar"
                                      ? "bg-white text-blue-600 shadow-sm"
                                      : "text-gray-500 hover:text-gray-700"
                                  }`}
                                >
                                  <FaCalendarAlt /> Calendar View
                                </button>
                                <button
                                  onClick={() => setLogbookView("list")}
                                  className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all rounded-lg ${
                                    logbookView === "list"
                                      ? "bg-white text-blue-600 shadow-sm"
                                      : "text-gray-500 hover:text-gray-700"
                                  }`}
                                >
                                  <FaClipboardList /> List View
                                </button>
                              </div>
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() =>
                                  navigate(`/admin/intern/${internId}/records`)
                                }
                                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-medium shadow-sm hover:bg-blue-700 hover:shadow transition-all"
                              >
                                <FaFileAlt className="mr-2" /> View Full Records
                              </motion.button>
                            </div>
                          </div>

                          {logbookView === "calendar" && (
                            <div>
                              <div className="grid grid-cols-3 gap-3 mb-5">
                                {[
                                  {
                                    value: totalWeekdays,
                                    label: "Working Days",
                                    color: "text-slate-900",
                                  },
                                  {
                                    value: totalRecords,
                                    label: "Logs Submitted",
                                    color: "text-emerald-600",
                                  },
                                  {
                                    value: missedDays,
                                    label: "Logs Missed",
                                    color: "text-rose-600",
                                  },
                                ].map(({ value, label, color }) => (
                                  <div
                                    key={label}
                                    className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm"
                                  >
                                    <p
                                      className={`text-2xl sm:text-3xl font-bold tracking-tight mb-1 ${color}`}
                                    >
                                      {value}
                                    </p>
                                    <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                                      {label}
                                    </p>
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center justify-between mb-4">
                                <button
                                  onClick={() =>
                                    setLogbookCalMonth(
                                      (prev) =>
                                        new Date(
                                          prev.getFullYear(),
                                          prev.getMonth() - 1,
                                          1,
                                        ),
                                    )
                                  }
                                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                >
                                  <FaChevronLeft className="h-3 w-3" />
                                </button>
                                <span className="text-sm font-semibold text-gray-800">
                                  {lbMonthLabel}
                                </span>
                                <button
                                  onClick={() =>
                                    setLogbookCalMonth(
                                      (prev) =>
                                        new Date(
                                          prev.getFullYear(),
                                          prev.getMonth() + 1,
                                          1,
                                        ),
                                    )
                                  }
                                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                >
                                  <FaChevronRight className="h-3 w-3" />
                                </button>
                              </div>

                              {/* Calendar grid */}
                              <div className="w-full overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm">
                                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                                    <div
                                      key={d}
                                      className="py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
                                    >
                                      {d}
                                    </div>
                                  ))}
                                </div>
                                <div className="grid grid-cols-7 auto-rows-fr">
                                  {lbCalDays.map((day, di) => {
                                    if (!day) return <div key={di} className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50" />;
                                    
                                    const meta = getLogbookMeta(recordMap, day, getHolidayForDate);
                                    const isToday = day.toDateString() === new Date().toDateString();
                                    const dayKey = toDateKey(day);
                                    const rec = recordMap[dayKey];
                                    const isClickable = rec != null;
                                    
                                    return (
                                      <div
                                        key={di}
                                        className={`min-h-[100px] border-b border-r border-gray-100 p-2 flex flex-col transition-colors relative ${meta?.bgClass || "bg-white"} ${isClickable ? "cursor-pointer hover:bg-gray-100/50 hover:shadow-inner" : ""}`}
                                        title={meta?.isHoliday ? meta.holidayName : ""}
                                        onClick={() => isClickable && setLogbookModal(rec)}
                                      >
                                        <div className="flex justify-between items-start mb-2">
                                          <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? "bg-blue-600 text-white shadow-sm" : meta?.textClass || "text-gray-700"}`}>
                                            {day.getDate()}
                                          </span>
                                        </div>
                                        
                                        <div className="flex flex-col gap-1 flex-1 justify-end">
                                          {meta?.isWorking && (
                                            <span className="w-full text-center px-1 py-1 text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 rounded shadow-sm border border-blue-200 truncate">
                                              Office
                                            </span>
                                          )}
                                          {meta?.isWfh && (
                                            <span className="w-full text-center px-1 py-1 text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 rounded shadow-sm border border-green-200 truncate">
                                              WFH
                                            </span>
                                          )}
                                          {!meta?.isWorking && !meta?.isWfh && meta?.isSubmitted && (
                                            <span className="w-full text-center px-1 py-1 text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 rounded shadow-sm border border-emerald-200 truncate">
                                              Submitted
                                            </span>
                                          )}
                                          {meta?.isLeave && (
                                            <span className="w-full text-center px-1 py-1 text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700 rounded shadow-sm border border-red-200 truncate">
                                              On Leave
                                            </span>
                                          )}
                                          {meta?.isHoliday && (
                                            <span className="w-full text-center px-1 py-1 text-[10px] font-bold uppercase tracking-wide bg-yellow-100 text-yellow-700 rounded border border-yellow-200 truncate" title={meta.holidayName}>
                                              Holiday
                                            </span>
                                          )}
                                          {meta?.isMissing && !meta?.isWeekend && !meta?.isFuture && !meta?.isHoliday && (
                                            <span className="w-full text-center px-1 py-1 text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-500 rounded border border-gray-200 truncate">
                                              No Record
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                  Legend — Click any day with a record to inspect the logbook
                                </p>
                                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600">
                                  {[
                                    { label: "Submitted (Unknown Type)", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
                                    { label: "Working (Office)", badge: "bg-blue-100 text-blue-700 border-blue-200" },
                                    { label: "WFH", badge: "bg-green-100 text-green-700 border-green-200" },
                                    { label: "On Leave", badge: "bg-red-100 text-red-700 border-red-200" },
                                    { label: "Holiday", badge: "bg-yellow-100 text-yellow-700 border-yellow-200" },
                                  ].map(({ label, badge }) => (
                                    <span
                                      key={label}
                                      className="flex items-center gap-1.5"
                                    >
                                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded shadow-sm border ${badge}`}>
                                        {label.split(' ')[0]}
                                      </span>
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {logbookView === "list" &&
                            (internDetails.records &&
                            internDetails.records.length > 0 ? (
                              <>
                                <div className="block sm:hidden space-y-3 max-h-[400px] overflow-y-auto">
                                  {internDetails.records.map(
                                    (record, index) => (
                                      <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.02 * index }}
                                        className="bg-gray-50 rounded-xl p-3 border border-gray-200"
                                      >
                                        <div className="flex items-start justify-between mb-2">
                                          <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900">
                                              {record.taskDescription ||
                                                record.task ||
                                                "N/A"}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                              {formatDate(record.createdAt)}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {record.stack || "N/A"}
                                          </span>
                                          <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() =>
                                              setLogbookModal(record)
                                            }
                                            className="flex items-center text-cyan-600 hover:bg-cyan-50 px-2 py-1 rounded-xl text-xs shadow-sm"
                                          >
                                            <FaEye className="mr-1 h-3 w-3" />{" "}
                                            View
                                          </motion.button>
                                        </div>
                                      </motion.div>
                                    ),
                                  )}
                                </div>
                                <div className="hidden sm:block overflow-x-auto max-h-[500px]">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead>
                                      <tr>
                                        {[
                                          "Date",
                                          "Task",
                                          "Stack",
                                          "Actions",
                                        ].map((h) => (
                                          <th
                                            key={h}
                                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                          >
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {internDetails.records.map(
                                        (record, index) => (
                                          <motion.tr
                                            key={index}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.02 * index }}
                                            className="hover:bg-gray-50"
                                          >
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                              {formatDate(record.createdAt)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                              <div className="max-w-xs truncate">
                                                {record.taskDescription ||
                                                  record.task ||
                                                  "N/A"}
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {record.stack || "N/A"}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                              <motion.button
                                                onClick={() =>
                                                  setLogbookModal(record)
                                                }
                                                className="flex items-center text-cyan-600 hover:bg-cyan-50 px-3 py-1 rounded-xl shadow-sm"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                              >
                                                <FaEye className="mr-2" />{" "}
                                                Inspect
                                              </motion.button>
                                            </td>
                                          </motion.tr>
                                        ),
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            ) : (
                              <div className="h-32 sm:h-48 flex items-center justify-center">
                                <p className="text-gray-500 text-xs sm:text-sm text-center">
                                  No records found for this intern.
                                </p>
                              </div>
                            ))}
                        </div>
                      </>
                    );
                  })()}

                {/* ══ DETAILS TAB ══ */}
                {activeTab === "details" && (() => {
                  const dailyList = attendanceData?.dailyAttendance || [];
                  const meetingList = attendanceData?.meetingAttendance || [];
                  const logbookList = internDetails?.records || [];

                  // Use direct collection counts from backend (most accurate)
                  const totalDailyCount = recordCounts?.totalDailyAttendance ?? dailyList.length;
                  const totalMeetingCount = recordCounts?.totalMeetingAttendance ?? meetingList.length;
                  const totalLogbookCount = recordCounts?.totalLogbook ?? logbookList.length;

                  // ── Working-day filtered counts (Mon–Fri, excl. Sri Lanka holidays) ──
                  const holidaySet = new Set(
                    (holidays || []).map((h) => (typeof h === "string" ? h : h.date))
                  );
                  const isWorkingDay = (dateVal) => {
                    if (!dateVal) return false;
                    const dStr = toDateStr(dateVal);
                    if (!dStr) return false;
                    const dow = new Date(dStr + "T12:00:00Z").getUTCDay();
                    return dow !== 0 && dow !== 6 && !holidaySet.has(dStr);
                  };

                  const startDateVal = intern?.startDate || intern?.Training_StartDate;
                  const startDStr = toDateStr(startDateVal);
                  const todayDStr = toDateStr(new Date());
                  const startMonKey = getMondayWeekKey(startDateVal);
                  const todayMonKey = getMondayWeekKey(new Date());

                  // Working-day daily attendance count (unique dates, present only, strictly start date -> today)
                  const workingDayDailyCount = new Set(
                    dailyList
                      .filter((e) => {
                        const s = (e.status || "").toLowerCase();
                        const isPresent = s === "present" || s === "late" || !e.status;
                        if (!isPresent || !e.date) return false;
                        const dStr = toDateStr(e.date);
                        if (!dStr) return false;
                        if (startDStr && dStr < startDStr) return false;
                        if (todayDStr && dStr > todayDStr) return false;
                        return isWorkingDay(e.date);
                      })
                      .map((e) => toDateStr(e.date))
                      .filter(Boolean)
                  ).size;

                  // Working-day meeting attendance count (unique week keys on working days, strictly start week -> today)
                  const workingDayMeetingCount = new Set(
                    meetingList
                      .filter((e) => {
                        const s = (e.status || "").toLowerCase();
                        const isPresent = s === "present" || s === "late" || !e.status;
                        if (!isPresent || !e.date || !isWorkingDay(e.date)) return false;
                        const wKey = getMondayWeekKey(e.date);
                        if (!wKey) return false;
                        if (startMonKey && wKey < startMonKey) return false;
                        if (todayMonKey && wKey >= todayMonKey) return false;
                        return true;
                      })
                      .map((e) => getMondayWeekKey(e.date))
                      .filter(Boolean)
                  ).size;

                  // Working-day logbook count (excluding leave/study_leave, strictly start date -> today)
                  const workingDayLogbookCount = logbookList.filter((r) => {
                    const status = (r.recordStatus || r.status || "working").toLowerCase();
                    if (status === "leave" || status === "study_leave" || !r.date) return false;
                    const dStr = toDateStr(r.date);
                    if (!dStr) return false;
                    if (startDStr && dStr < startDStr) return false;
                    if (todayDStr && dStr > todayDStr) return false;
                    return isWorkingDay(r.date);
                  }).length;

                  const totalDailyPresent = dailyList.filter(
                    (e) => (e.status || "").toLowerCase() === "present" || !e.status
                  ).length;

                  const totalMeetingPresent = meetingList.filter(
                    (e) => (e.status || "").toLowerCase() === "present" || !e.status
                  ).length;

                  // Breakdowns
                  const qrCount = dailyList.filter((e) =>
                    ["daily_qr", "qr"].includes(String(e.rawType || e.type || e.markType || "").toLowerCase())
                  ).length;
                  const faceCount = dailyList.filter((e) =>
                    ["face"].includes(String(e.rawType || e.type || e.markType || "").toLowerCase())
                  ).length;
                  const manualDailyCount = dailyList.filter((e) =>
                    String(e.rawType || e.type || e.markType || "").toLowerCase().includes("manual")
                  ).length;
                  const otherDailyCount = Math.max(0, totalDailyCount - qrCount - faceCount - manualDailyCount);

                  const workingRecords = logbookList.filter(
                    (r) => (r.status || "working").toLowerCase() === "working"
                  ).length;
                  const wfhRecords = logbookList.filter(
                    (r) => (r.status || "").toLowerCase() === "wfh"
                  ).length;
                  const leaveRecords = logbookList.filter((r) => {
                    const st = (r.status || "").toLowerCase();
                    return st === "leave" || st === "study_leave";
                  }).length;

                  // ── Working-day missing daily attendance, logbook & meeting weeks ──
                  const missingDailyDates = [];
                  const missingLogbookDates = [];
                  const missingMeetingWeeks = [];
                  const expectedMeetingWeekKeys = [];

                  if (startDateVal) {
                    const start = new Date(startDateVal);
                    const today = new Date();
                    start.setHours(0, 0, 0, 0);
                    today.setHours(0, 0, 0, 0);

                    // 1. Set of dates with daily attendance marked as present
                    const presentDailySet = new Set(
                      dailyList
                        .filter((e) => {
                          const s = (e.status || "").toLowerCase();
                          return s === "present" || s === "late" || !e.status;
                        })
                        .map((e) => toDateStr(e.date))
                        .filter(Boolean)
                    );

                    // 2. Set of dates with submitted logbook record (excluding leave / study_leave)
                    const submittedLogbookSet = new Set(
                      logbookList
                        .filter((r) => {
                          const s = (r.recordStatus || r.status || "working").toLowerCase();
                          return s !== "leave" && s !== "study_leave" && r.date;
                        })
                        .map((r) => toDateStr(r.date))
                        .filter(Boolean)
                    );

                    // Day-by-day iteration for daily attendance and logbooks
                    const cur = new Date(start);
                    while (cur <= today) {
                      const y = cur.getFullYear();
                      const m = String(cur.getMonth() + 1).padStart(2, "0");
                      const d = String(cur.getDate()).padStart(2, "0");
                      const dStr = `${y}-${m}-${d}`;
                      const dow = cur.getDay(); // 0 = Sun, 6 = Sat

                      if (dow !== 0 && dow !== 6 && !holidaySet.has(dStr)) {
                        if (!presentDailySet.has(dStr)) {
                          missingDailyDates.push(dStr);
                        }
                        if (!submittedLogbookSet.has(dStr)) {
                          missingLogbookDates.push(dStr);
                        }
                      }
                      cur.setDate(cur.getDate() + 1);
                    }

                    // 3. Set of attended meeting week keys (strictly on or after start week)
                    const attendedMeetingWeekSet = new Set(
                      meetingList
                        .filter((e) => {
                          const s = (e.status || "").toLowerCase();
                          const isPresent = s === "present" || s === "late" || !e.status;
                          if (!isPresent || !e.date) return false;
                          const wKey = getMondayWeekKey(e.date);
                          if (!wKey) return false;
                          if (startMonKey && wKey < startMonKey) return false;
                          if (todayMonKey && wKey >= todayMonKey) return false;
                          return true;
                        })
                        .map((e) => getMondayWeekKey(e.date))
                        .filter(Boolean)
                    );

                    // Monday-by-Monday calendar week iteration for completed weeks up to current week
                    if (startMonKey && todayMonKey) {
                      let weekCursor = new Date(startMonKey + "T12:00:00Z");
                      const endMondayDate = new Date(todayMonKey + "T12:00:00Z");

                      while (weekCursor < endMondayDate) {
                        const wKey = getMondayWeekKey(weekCursor);
                        if (wKey) {
                          expectedMeetingWeekKeys.push(wKey);
                          if (!attendedMeetingWeekSet.has(wKey)) {
                            const mon = new Date(weekCursor);
                            const fri = new Date(weekCursor);
                            fri.setUTCDate(fri.getUTCDate() + 4);
                            missingMeetingWeeks.push({
                              weekKey: wKey,
                              monday: mon,
                              friday: fri,
                            });
                          }
                        }
                        weekCursor.setUTCDate(weekCursor.getUTCDate() + 7);
                      }
                    }
                  }

                  const totalExpectedMeetingWeeks = expectedMeetingWeekKeys.length;
                  const effectiveMeetingRate = calcMeetingAttendanceRate(
                    attendedMeetingWeeksCount,
                    totalExpectedMeetingWeeks
                  );

                  missingDailyDates.sort((a, b) => new Date(b) - new Date(a));
                  missingLogbookDates.sort((a, b) => new Date(b) - new Date(a));
                  missingMeetingWeeks.sort((a, b) => new Date(b.monday) - new Date(a.monday));

                  const formattedStartDate = startDateVal
                    ? new Date(startDateVal).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "";

                  return (
                    <div className="space-y-6">
                      {/* Section Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                            Intern Attendance & Record Details
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-500">
                            Summary of all recorded submissions and working-day performance metrics for {intern?.traineeName} ({intern?.traineeId})
                          </p>
                        </div>
                      </div>

                      {/* 5 Main Total Metric Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        {/* 1. Daily Attendance */}
                        <motion.div
                          className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between"
                          whileHover={{ y: -3 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="absolute right-2 top-2 opacity-10">
                            <FaCalendarCheck size={80} />
                          </div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                                <FaCalendarCheck className="text-white text-base" />
                              </span>
                              <span className="text-xs font-bold tracking-wider uppercase text-blue-100">
                                Daily Attendance
                              </span>
                            </div>
                            <h4 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">
                              {dailyAttendanceRate}%
                            </h4>
                            <p className="text-[11px] text-blue-100 mb-3">
                              Daily Attendance Rate
                            </p>
                          </div>
                          <div className="relative z-10 pt-3 border-t border-white/20 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-blue-100">Total Submissions:</span>
                              <span className="font-semibold text-white">
                                {totalDailyCount}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-blue-100">Valid submissions:</span>
                              <span className="font-semibold text-white">
                                {workingDayDailyCount} days
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-blue-100">Working Days:</span>
                              <span className="font-semibold text-white">
                                {workingDays} days
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-white/20">
                            <p className="text-[10px] text-blue-200/80 leading-relaxed font-mono italic">
                              Formula: (Valid Submissions / Working Days) × 100
                            </p>
                          </div>
                        </motion.div>

                        {/* 2. Meeting Attendance */}
                        <motion.div
                          className="bg-gradient-to-br from-purple-500 to-indigo-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between"
                          whileHover={{ y: -3 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="absolute right-2 top-2 opacity-10">
                            <FaUsers size={80} />
                          </div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                                <FaUsers className="text-white text-base" />
                              </span>
                              <span className="text-xs font-bold tracking-wider uppercase text-purple-100">
                                Meeting Attendance
                              </span>
                            </div>
                            <h4 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">
                              {effectiveMeetingRate}%
                            </h4>
                            <p className="text-[11px] text-purple-100 mb-3">
                              Meeting Attendance Rate
                            </p>
                          </div>
                          <div className="relative z-10 pt-3 border-t border-white/20 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-purple-100">Total Submissions:</span>
                              <span className="font-semibold text-white">
                                {totalMeetingCount}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-purple-100">Valid Submissions:</span>
                              <span className="font-semibold text-white">
                                {workingDayMeetingCount} weeks
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-purple-100">Expected Meetings:</span>
                              <span className="font-semibold text-white">
                                {totalExpectedMeetingWeeks} weeks
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-white/20">
                            <p className="text-[10px] text-purple-200/80 leading-relaxed font-mono italic">
                              Formula: (Valid Submissions / Expected Meetings) × 100
                            </p>
                          </div>
                        </motion.div>

                        {/* 3. Logbook Records */}
                        <motion.div
                          className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between"
                          whileHover={{ y: -3 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="absolute right-2 top-2 opacity-10">
                            <FaClipboardList size={80} />
                          </div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                                <FaClipboardList className="text-white text-base" />
                              </span>
                              <span className="text-xs font-bold tracking-wider uppercase text-emerald-100">
                                Logbook Records
                              </span>
                            </div>
                            <h4 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">
                              {logbookRate}%
                            </h4>
                            <p className="text-[11px] text-emerald-100 mb-3">
                              Logbook Submission Rate
                            </p>
                          </div>
                          <div className="relative z-10 pt-3 border-t border-white/20 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-emerald-100">Total Submissions:</span>
                              <span className="font-semibold text-white">
                                {totalLogbookCount}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-emerald-100">Valid Submissions:</span>
                              <span className="font-semibold text-white">
                                {workingDayLogbookCount} entries
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-emerald-100">Working Days:</span>
                              <span className="font-semibold text-white">
                                {workingDays} days
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-white/20">
                            <p className="text-[10px] text-emerald-200/80 leading-relaxed font-mono italic">
                              Formula: (Valid Submissions / Working Days) × 100
                            </p>
                          </div>
                        </motion.div>

                        {/* 4. Git Commits */}
                        {!isNoCommitSpecialization(intern?.field_of_spec_name || intern?.fieldOfSpecialization || intern?.specialization || "") && (
                          <motion.div
                            className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between"
                            whileHover={{ y: -3 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="absolute right-2 top-2 opacity-10">
                              <FaCodeBranch size={80} />
                            </div>
                            <div className="relative z-10">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                                  <FaCodeBranch className="text-white text-base" />
                                </span>
                                <span className="text-xs font-bold tracking-wider uppercase text-amber-100">
                                  Git Commits
                                </span>
                              </div>
                              <h4 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">
                                {commitsCount}
                              </h4>
                              <p className="text-[11px] text-amber-100 mb-3">
                                Total repository commits recorded
                              </p>
                            </div>
                            <div className="relative z-10 pt-3 border-t border-white/20 space-y-1.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-amber-100">Tracked Commits:</span>
                                <span className="font-semibold text-white">
                                  {commitsCount} commits
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-amber-100">Working Days:</span>
                                <span className="font-semibold text-white">
                                  {workingDays} days
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-amber-100">Projects:</span>
                                <span className="font-semibold text-white">
                                  {projectsCount} project{projectsCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* 5. Overall Performance */}
                        <motion.div
                          className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between"
                          whileHover={{ y: -3 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="absolute right-2 top-2 opacity-10">
                            <FaAward size={80} />
                          </div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                                <FaAward className="text-white text-base" />
                              </span>
                              <span className="text-xs font-bold tracking-wider uppercase text-rose-100">
                                Performance
                              </span>
                            </div>
                            <h4 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">
                              {performanceRate}%
                            </h4>
                            <p className="text-[11px] text-rose-100 mb-3">
                              Composite performance score
                            </p>
                          </div>
                          <div className="relative z-10 pt-3 border-t border-white/20 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-rose-100">Status:</span>
                              <span className="font-semibold text-white">
                                {getPerformanceStatus(performanceRate)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-rose-100">Quality Score:</span>
                              <span className="font-semibold text-white">
                                {workQualityRate}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-rose-100">Evaluation:</span>
                              <span className="font-semibold text-white">
                                {performanceRate >= 80 ? "Good" : performanceRate >= 60 ? "Average" : "Needs Attention"}
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-white/20">
                            <p className="text-[10px] text-rose-200/80 leading-relaxed font-mono italic">
                              {isNoCommitSpecialization(intern?.field_of_spec_name || intern?.specialization || intern?.fieldOfSpecialization || "")
                                ? "Formula: (Meeting Attendance Rate + Logbook Rate) / 2"
                                : "Formula: (Meeting Attendance Rate + Logbook Rate) / 2 + max(0, Commits Count - Working Days)"}
                            </p>
                          </div>
                        </motion.div>
                      </div>

                      {/* ══ NOT SUBMITTED DATES & WEEKS HUB (Before Daily Attendance Types) ══ */}
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
                          <div>
                            <h4 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                              <FaExclamationTriangle className="text-amber-500" />
                              Missing Submissions & Pending Records
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Unrecorded working days and missed weekly meeting sessions between internship start date and current date
                            </p>
                          </div>

                          {/* ── Export Missing Records PDF Button ── */}
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="button"
                            onClick={() =>
                              handleExportMissingRecordsPDF({
                                intern,
                                dailyAttendanceRate,
                                meetingAttendanceRate,
                                performanceRate,
                                missingDailyDates,
                                missingLogbookDates,
                                missingMeetingWeeks,
                                startDateVal,
                                formattedStartDate,
                                workingDays,
                                elapsedWeeks,
                              })
                            }
                            disabled={isExportingPDF}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#000066] to-[#006600] hover:from-[#000088] hover:to-[#008800] active:scale-95 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                            title="Export clean PDF report with profile, rates, and detailed missing submissions breakdown"
                          >
                            <FaFilePdf className="text-sm text-rose-300" />
                            <span>{isExportingPDF ? "Generating PDF..." : "Export PDF"}</span>
                          </motion.button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                          {/* 1. Missing Daily Attendance */}
                          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div>
                              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                  <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                                    <FaCalendarCheck className="text-sm" />
                                  </span>
                                  <div>
                                    <h5 className="text-xs font-bold text-gray-900">
                                      Missing Daily Attendance
                                    </h5>
                                    <p className="text-[10px] text-gray-500">Working days without check-in</p>
                                  </div>
                                </div>
                                <span
                                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                    missingDailyDates.length > 0
                                      ? "bg-red-50 text-red-700 border border-red-200"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  }`}
                                >
                                  {missingDailyDates.length} {missingDailyDates.length === 1 ? "Day" : "Days"}
                                </span>
                              </div>

                              {missingDailyDates.length === 0 ? (
                                <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-medium border border-emerald-100">
                                  <FaCheckCircle className="text-emerald-600 text-sm flex-shrink-0" />
                                  <span>All working day daily check-ins completed!</span>
                                </div>
                              ) : (
                                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                                  {missingDailyDates.map((dateStr) => {
                                    const dObj = new Date(dateStr + "T12:00:00Z");
                                    const dayName = dObj.toLocaleDateString("en-US", { weekday: "short" });
                                    const formatted = dObj.toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    });
                                    return (
                                      <div
                                        key={dateStr}
                                        className="flex items-center justify-between p-2 bg-red-50/70 hover:bg-red-100/70 text-red-900 border border-red-100 rounded-xl text-xs transition-colors"
                                      >
                                        <span className="font-semibold">{formatted}</span>
                                        <span className="text-[11px] text-red-600 font-medium px-2 py-0.5 bg-white/70 rounded-md">
                                          {dayName}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-100">
                              * Excludes weekends and Sri Lanka public holidays
                            </p>
                          </div>

                          {/* 2. Missing Logbook Submissions */}
                          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div>
                              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                  <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                                    <FaClipboardList className="text-sm" />
                                  </span>
                                  <div>
                                    <h5 className="text-xs font-bold text-gray-900">
                                      Missing Logbook Entries
                                    </h5>
                                    <p className="text-[10px] text-gray-500">Working days without logbook</p>
                                  </div>
                                </div>
                                <span
                                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                    missingLogbookDates.length > 0
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  }`}
                                >
                                  {missingLogbookDates.length} {missingLogbookDates.length === 1 ? "Day" : "Days"}
                                </span>
                              </div>

                              {missingLogbookDates.length === 0 ? (
                                <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-medium border border-emerald-100">
                                  <FaCheckCircle className="text-emerald-600 text-sm flex-shrink-0" />
                                  <span>All working day logbook submissions completed!</span>
                                </div>
                              ) : (
                                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                                  {missingLogbookDates.map((dateStr) => {
                                    const dObj = new Date(dateStr + "T12:00:00Z");
                                    const dayName = dObj.toLocaleDateString("en-US", { weekday: "short" });
                                    const formatted = dObj.toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    });
                                    return (
                                      <div
                                        key={dateStr}
                                        className="flex items-center justify-between p-2 bg-amber-50/70 hover:bg-amber-100/70 text-amber-900 border border-amber-100 rounded-xl text-xs transition-colors"
                                      >
                                        <span className="font-semibold">{formatted}</span>
                                        <span className="text-[11px] text-amber-700 font-medium px-2 py-0.5 bg-white/70 rounded-md">
                                          {dayName}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-100">
                              * Excludes weekends, holidays & approved leaves
                            </p>
                          </div>

                          {/* 3. Missed Meeting Weeks */}
                          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div>
                              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                  <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
                                    <FaUsers className="text-sm" />
                                  </span>
                                  <div>
                                    <h5 className="text-xs font-bold text-gray-900">
                                      Missed Meeting Weeks
                                    </h5>
                                    <p className="text-[10px] text-gray-500">Weeks without meeting attendance</p>
                                  </div>
                                </div>
                                <span
                                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                    missingMeetingWeeks.length > 0
                                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  }`}
                                >
                                  {missingMeetingWeeks.length} {missingMeetingWeeks.length === 1 ? "Week" : "Weeks"}
                                </span>
                              </div>

                              {missingMeetingWeeks.length === 0 ? (
                                <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-medium border border-emerald-100">
                                  <FaCheckCircle className="text-emerald-600 text-sm flex-shrink-0" />
                                  <span>All weekly meetings attended!</span>
                                </div>
                              ) : (
                                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                                  {missingMeetingWeeks.map((item) => {
                                    const monStr = item.monday.toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    });
                                    const friStr = item.friday.toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    });
                                    return (
                                      <div
                                        key={item.weekKey}
                                        className="flex items-center justify-between p-2 bg-purple-50/70 hover:bg-purple-100/70 text-purple-900 border border-purple-100 rounded-xl text-xs transition-colors"
                                      >
                                        <span className="font-semibold">{monStr} – {friStr}</span>
                                        <span className="text-[11px] text-purple-700 font-medium px-2 py-0.5 bg-white/70 rounded-md">
                                          Week {item.weekKey.split("-W")[1] || ""}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-100">
                              * Expected minimum 1 meeting session per calendar week
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Detailed Breakdown Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                        {/* Daily Attendance Breakdown Card */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <FaCalendarCheck className="text-blue-500" />
                              Daily Attendance Types
                            </h4>
                            <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                              {totalDailyCount} Total
                            </span>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                              <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                                QR Scans
                              </span>
                              <span className="text-xs font-bold text-gray-900">{qrCount}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                              <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                                Biometric Face
                              </span>
                              <span className="text-xs font-bold text-gray-900">{faceCount}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                              <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                                Admin Manual Marks
                              </span>
                              <span className="text-xs font-bold text-gray-900">{manualDailyCount}</span>
                            </div>
                            {otherDailyCount > 0 && (
                              <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                                <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                  Logbook / Direct
                                </span>
                                <span className="text-xs font-bold text-gray-900">{otherDailyCount}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Meeting Attendance Breakdown Card */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <FaUsers className="text-purple-500" />
                              Meeting Attendance
                            </h4>
                            <span className="text-xs font-semibold px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                              {totalMeetingCount} Total
                            </span>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                              <span className="text-xs font-medium text-gray-700">Present Marks</span>
                              <span className="text-xs font-bold text-emerald-600">{totalMeetingPresent}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                              <span className="text-xs font-medium text-gray-700">Distinct Meeting Weeks</span>
                              <span className="text-xs font-bold text-purple-600">{attendedMeetingWeeksCount}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                              <span className="text-xs font-medium text-gray-700">Expected Weeks</span>
                              <span className="text-xs font-bold text-gray-900">{elapsedWeeks}</span>
                            </div>
                          </div>
                        </div>

                        {/* Logbook Breakdown Card */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <FaClipboardList className="text-emerald-500" />
                              Logbook Submissions
                            </h4>
                            <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
                              {totalLogbookCount} Total
                            </span>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                              <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                Office Working
                              </span>
                              <span className="text-xs font-bold text-gray-900">{workingRecords}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                              <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                                Work From Home
                              </span>
                              <span className="text-xs font-bold text-gray-900">{wfhRecords}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                              <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                                Leave / Study Leave
                              </span>
                              <span className="text-xs font-bold text-gray-900">{leaveRecords}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ══ PREVIEW TAB (Intern-Side Portal Preview using Dashboard.jsx) ══ */}
                {activeTab === "preview" && (
                  <div className="rounded-2xl overflow-hidden border border-gray-200 bg-[#f8fafc] shadow-sm">
                    <Dashboard previewInternId={internId} isPreview={true} />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </AdminNavigation>
  );
};

export default AdminInternDetails;
