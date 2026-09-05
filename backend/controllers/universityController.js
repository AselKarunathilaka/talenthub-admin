const { OAuth2Client } = require("google-auth-library");
const https = require("https");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const dotenv = require("../config/dotenv");
const UniversityUser = require("../models/UniversityUser");
const UniversityStudentFeedback = require("../models/UniversityStudentFeedback");
const Intern = require("../models/Intern");
const InactiveIntern = require("../models/InactiveIntern");
const InternTalentTrailSync = require("../models/InternTalentTrailSync");
const DailyRecord = require("../models/DailyRecord");
const FaceAttendanceLog = require("../models/FaceAttendanceLog");
const Project = require("../models/Project");
const {
  sendUniversityApprovalEmail,
  sendUniversityRejectionEmail,
} = require("../utils/emailSender");
const {
  getColomboDateKey,
  buildDailyAttendanceByDate,
  addAuditCheckoutTimes,
  getDailyTypePriority,
} = require("../utils/attendanceHistory");
const {
  fetchInternGitCommitsData,
  gitCommitsCache,
} = require("./adminController");
const { getSriLankanHolidays } = require("../utils/workingDays");

/**
 * Specialization classifier for non-coding roles (QA, BA, PM, DevOps, AI)
 * Exact match with AdminAnalytics.jsx and adminAnalyticsController.js
 */
const isNoCommitSpecialization = (specName) => {
  if (!specName) return false;
  const s = String(specName).trim().toLowerCase();

  if (/\b(qa|sqa|ba|pm|apm|devops|ai|ml|genai|sre|nlp)\b/i.test(s)) {
    return true;
  }

  return (
    s === "qa" ||
    s.includes("quality assurance") ||
    s.includes("software quality") ||
    s.includes("qa engineer") ||
    s === "ba" ||
    s.includes("business analyst") ||
    s.includes("business analysis") ||
    s.includes("business analytics") ||
    s === "pm" ||
    s.includes("project manager") ||
    s.includes("project management") ||
    s.includes("product manager") ||
    s.includes("product management") ||
    s === "devops" ||
    s.includes("devops") ||
    s.includes("dev ops") ||
    s === "ai" ||
    s.includes("artificial intelligence") ||
    s.includes("machine learning") ||
    s.includes("data science") ||
    s.includes("data scientist") ||
    s.includes("deep learning") ||
    s.includes("computer vision") ||
    s.includes("generative ai") ||
    s.startsWith("ai ") ||
    s.endsWith(" ai") ||
    s.includes(" ai ") ||
    s.includes("ai/") ||
    s.includes("/ai")
  );
};

const DAILY_ATTENDANCE_TYPES = new Set([
  "daily",
  "daily_qr",
  "face",
  "manual_daily",
  "manual",  // matches AdminAnalytics
  "qr",      // matches AdminAnalytics
]);

const MEETING_ATTENDANCE_TYPES = new Set([
  "qr",
  "face_meeting",
  "meeting",
  "manual_meeting",
  "manual",
]);

const formatAttendanceTypeLabel = (type, isMeeting = false) => {
  const t = String(type || "").toLowerCase().trim();
  if (t === "face" || t === "face recognition" || t === "face_attendance") {
    return isMeeting ? "Face Meeting" : "Face Attendance";
  }
  if (t === "daily_qr" || t === "qr") {
    return isMeeting ? "QR Meeting" : "QR Attendance";
  }
  if (t === "manual_daily" || t === "manual") {
    return isMeeting ? "Manual Meeting" : "Manual Daily";
  }
  if (t === "daily" || t === "logbook" || t.includes("logbook")) {
    return "Logbook Attendance";
  }
  if (t === "face_meeting") return "Face Meeting";
  if (t === "manual_meeting" || t === "meeting") return "Meeting Attendance";
  return isMeeting ? "Meeting Attendance" : "Daily Attendance";
};

// Helper for Mon-Fri working days elapsed excluding weekends and Sri Lankan public holidays
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30

const calcWorkingDays = (startDate, endDate = new Date(), holidays = null) => {
  if (!startDate) return 1;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return 1;
  const now = new Date(endDate);
  if (isNaN(now.getTime())) return 1;

  // Shift both to Colombo time to do date-aware cursor math
  const startColombo = new Date(start.getTime() + COLOMBO_OFFSET_MS);
  const endColombo = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  startColombo.setUTCHours(0, 0, 0, 0);
  endColombo.setUTCHours(23, 59, 59, 999);

  if (endColombo <= startColombo) return 1;
  let count = 0;
  const cursor = new Date(startColombo);

  while (cursor <= endColombo) {
    const dow = cursor.getUTCDay(); // day of week in Colombo
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cursor.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidays ? holidays.has(dateStr) : false;
    if (!isWeekend && !isHoliday) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return Math.max(1, count);
};

const getMondayWeekKey = (dateVal) => {
  if (!dateVal) return null;
  const raw = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(raw.getTime())) return null;
  const colombo = new Date(raw.getTime() + COLOMBO_OFFSET_MS);
  const day = colombo.getUTCDay();
  const diff = colombo.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(colombo);
  monday.setUTCDate(diff);
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const d = String(monday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// Helper for elapsed weeks (expected meetings anchored to calendar Mondays)
const calcElapsedWeeks = (startDate, endDate = new Date()) => {
  if (!startDate) return 0;
  const startMondayKey = getMondayWeekKey(startDate);
  const endMondayKey = getMondayWeekKey(endDate);
  if (!startMondayKey || !endMondayKey) return 0;

  const startMon = new Date(startMondayKey + "T12:00:00Z");
  const endMon = new Date(endMondayKey + "T12:00:00Z");
  if (endMon < startMon) return 0;

  const diffWeeks = Math.round((endMon.getTime() - startMon.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, diffWeeks);
};

// Canonical attendance calculation helper matching AdminAnalytics exactly
const computeAttendanceMetrics = (intern, studentRecords = [], endDate = new Date(), holidays = null) => {
  const workingDays = calcWorkingDays(
    intern.Training_StartDate,
    intern.Training_EndDate ? Math.min(new Date(endDate), new Date(intern.Training_EndDate)) : new Date(endDate),
    holidays
  );
  const elapsedWeeks = calcElapsedWeeks(
    intern.Training_StartDate,
    intern.Training_EndDate ? Math.min(new Date(endDate), new Date(intern.Training_EndDate)) : new Date(endDate)
  );

  // 1. Daily Attended Days (Valid working days only)
  const dailyAttendedDays = new Set();

  // From DailyRecords (logbooks: working / wfh → Present, leave / study_leave → Absent)
  let logbookCount = 0;
  studentRecords.forEach((r) => {
    const recordStatus = (r.status || "working").toLowerCase();
    if (recordStatus !== "leave" && recordStatus !== "study_leave") {
      if (r.date) {
        const dateStr = getColomboDateKey(r.date); // Colombo-aware YYYY-MM-DD
        if (dateStr) {
          // Derive day-of-week from Colombo date string at noon UTC (no tz shift)
          const dow = new Date(dateStr + "T12:00:00Z").getUTCDay();
          const isWeekend = dow === 0 || dow === 6;
          const isHoliday = holidays ? holidays.has(dateStr) : false;
          if (!isWeekend && !isHoliday) {
            logbookCount++;
            dailyAttendedDays.add(dateStr);
          }
        }
      }
    }
  });

  // From intern.attendance (daily types on working days)
  const attendanceEntries = intern.attendance || [];
  attendanceEntries.forEach((entry) => {
    const type = (entry.type || "").toLowerCase();
    const isDaily = DAILY_ATTENDANCE_TYPES.has(type);
    const s = (entry.status || "").toLowerCase();
    // AdminAnalytics: isPresent = status === "present" || status === "late" || !entry.status
    const isPresent = s === "present" || s === "late" || !entry.status;
    if (isDaily && isPresent && entry.date) {
      const dateKey = getColomboDateKey(entry.date); // already Colombo YYYY-MM-DD
      if (dateKey) {
        // Derive day-of-week from Colombo date string at noon UTC (no tz shift)
        const dow = new Date(dateKey + "T12:00:00Z").getUTCDay();
        const isWeekend = dow === 0 || dow === 6;
        const isHoliday = holidays ? holidays.has(dateKey) : false;
        if (!isWeekend && !isHoliday) {
          dailyAttendedDays.add(dateKey);
        }
      }
    }
  });

  const dailyAttendanceRate = Math.min(100, Math.round((dailyAttendedDays.size / workingDays) * 100)) || 0;
  const logbookRecordRate = Math.min(100, Math.round((logbookCount / workingDays) * 100)) || 0;

  // 2. Meeting Attended Weeks (distinct calendar Monday week keys for completed weeks)
  const attendedMeetingWeeks = new Set();
  const startMondayKey = getMondayWeekKey(intern.Training_StartDate);
  const currentMondayKey = getMondayWeekKey(endDate);

  // From DailyRecord.meetingAttendance
  studentRecords.forEach((r) => {
    if (Array.isArray(r.meetingAttendance) && r.meetingAttendance.length > 0) {
      r.meetingAttendance.forEach((m) => {
        const dVal = m.attendanceTime || r.date;
        if (dVal) {
          const wk = getMondayWeekKey(dVal);
          if (wk && (!startMondayKey || wk >= startMondayKey) && (!currentMondayKey || wk < currentMondayKey)) {
            attendedMeetingWeeks.add(wk);
          }
        }
      });
    }
  });

  // From intern.attendance (meeting types: qr, manual, manual_meeting, face_meeting, meeting)
  // Note: "qr" and "manual" are in BOTH DAILY and MEETING sets (like AdminAnalytics)
  attendanceEntries.forEach((entry) => {
    const type = (entry.type || "").toLowerCase();
    const isMeeting = MEETING_ATTENDANCE_TYPES.has(type);
    const s = (entry.status || "").toLowerCase();
    const isPresent = s === "present" || s === "late" || !entry.status;
    if (isMeeting && isPresent && entry.date) {
      const wk = getMondayWeekKey(entry.date);
      if (wk && (!startMondayKey || wk >= startMondayKey) && (!currentMondayKey || wk < currentMondayKey)) {
        attendedMeetingWeeks.add(wk);
      }
    }
  });

  const meetingAttendanceRate = elapsedWeeks <= 0 ? 100 : Math.min(100, Math.round((attendedMeetingWeeks.size / elapsedWeeks) * 100)) || 0;

  return {
    dailyAttendanceRate,
    meetingAttendanceRate,
    logbookRecordRate,
    logbookCount,
    presentDays: dailyAttendedDays.size,
    workingDays,
    elapsedWeeks,
    attendedWeeks: attendedMeetingWeeks.size,
  };
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Helper to fetch Google userinfo from access token (implicit flow)
 */
const fetchGoogleUserInfo = (accessToken) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "www.googleapis.com",
      path: "/oauth2/v3/userinfo",
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error)
            return reject(
              new Error(parsed.error.message || "Google userinfo error")
            );
          resolve(parsed);
        } catch (e) {
          reject(new Error("Failed to parse Google userinfo response"));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
};

/**
 * Builds a regex query condition matching Sri Lankan universities based on known aliases
 */
const buildUniversityQueryRegex = (universityName) => {
  const normalized = (universityName || "").trim().toLowerCase();

  if (!normalized) return { $exists: true };

  // Common Sri Lankan university alias patterns
  if (normalized.includes("nsbm")) {
    return new RegExp("nsbm", "i");
  }
  if (normalized.includes("moratuwa") || normalized.includes("uom") || normalized.includes("ndt")) {
    return new RegExp("moratuwa|ndt", "i");
  }
  if (normalized.includes("colombo") || normalized.includes("uoc") || normalized.includes("ucsc")) {
    return new RegExp("colombo|ucsc", "i");
  }
  if (normalized.includes("sliit") || normalized.includes("information technology")) {
    return new RegExp("sliit|sri lanka institute of information technology|srilanka institute of information technology", "i");
  }
  if (normalized.includes("jayewardenepura") || normalized.includes("jayawardenapura") || normalized.includes("usj") || normalized.includes("japura")) {
    return new RegExp("jayewardenepura|jayawardenapura|jayawardana", "i");
  }
  if (normalized.includes("kelaniya") || normalized.includes("uok")) {
    return new RegExp("kelaniya", "i");
  }
  if (normalized.includes("iit") || normalized.includes("informatics")) {
    return new RegExp("iit|informatic|informatics", "i");
  }
  if (normalized.includes("peradeniya") || normalized.includes("uop")) {
    return new RegExp("peradeniya", "i");
  }
  if (normalized.includes("ruhuna") || normalized.includes("uor")) {
    return new RegExp("ruhuna", "i");
  }
  if (normalized.includes("open university") || normalized.includes("ousl")) {
    return new RegExp("open university", "i");
  }
  if (normalized.includes("kotelawala") || normalized.includes("kdu") || normalized.includes("kothalawala")) {
    return new RegExp("kdu|kotelawala|kotelwela|kothalawala", "i");
  }
  if (normalized.includes("sltc") || normalized.includes("technology campus")) {
    return new RegExp("sltc|technology campus", "i");
  }
  if (normalized.includes("cinec")) {
    return new RegExp("cinec", "i");
  }
  if (normalized.includes("horizon")) {
    return new RegExp("horizon", "i");
  }
  if (normalized.includes("uva wellassa") || normalized.includes("uwu") || normalized.includes("wellasa")) {
    return new RegExp("uva wellassa|wellasa|wellassa|uwa wellassa", "i");
  }
  if (normalized.includes("sabaragamuwa") || normalized.includes("susl")) {
    return new RegExp("sabaragamuwa", "i");
  }
  if (normalized.includes("rajarata") || normalized.includes("rusl")) {
    return new RegExp("rajarata", "i");
  }
  if (normalized.includes("wayamba") || normalized.includes("wusl")) {
    return new RegExp("wayamba", "i");
  }
  if (normalized.includes("eastern") || normalized.includes("seusl")) {
    return new RegExp("eastern", "i");
  }
  if (normalized.includes("nibm")) {
    return new RegExp("nibm|national institute of business", "i");
  }
  if (normalized.includes("bci")) {
    return new RegExp("bci", "i");
  }
  if (normalized.includes("icbt")) {
    return new RegExp("icbt", "i");
  }

  // Token fallback: take the first meaningful word >= 3 chars
  const words = normalized
    .replace(/university|campus|institute|of|the|sri|lanka/gi, "")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  if (words.length > 0) {
    return new RegExp(words.join("|"), "i");
  }

  return new RegExp(normalized.slice(0, 5), "i");
};

// ─── Controller Functions ───────────────────────────────────────────────────

/**
 * University Google Login
 * Accepts accessToken (useGoogleLogin implicit) or ID token / credential
 */
const universityGoogleLogin = async (req, res) => {
  const token = req.body.accessToken || req.body.credential || req.body.code;

  if (!token) {
    return res.status(400).json({ message: "Missing Google authentication token." });
  }

  try {
    let payload;

    if (token.startsWith("ya29.")) {
      // Access token flow
      const googlePayload = await fetchGoogleUserInfo(token);
      if (!googlePayload || !googlePayload.email) {
        return res.status(400).json({ message: "Failed to verify Google identity." });
      }
      payload = {
        email: googlePayload.email,
        name: googlePayload.name,
        picture: googlePayload.picture,
        sub: googlePayload.sub,
      };
    } else {
      // ID token flow
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const idPayload = ticket.getPayload();
      payload = {
        email: idPayload.email,
        name: idPayload.name,
        picture: idPayload.picture,
        sub: idPayload.sub,
      };
    }

    const normalizedEmail = (payload.email || "").toLowerCase().trim();

    // Look up supervisor in UniversityUser collection
    const supervisor = await UniversityUser.findOne({ email: normalizedEmail });

    if (!supervisor) {
      return res.status(404).json({
        registered: false,
        email: normalizedEmail,
        name: payload.name || "",
        picture: payload.picture || "",
        message:
          "This email is not registered as a university supervisor. Please register your university access request.",
      });
    }

    // Check status
    if (supervisor.status === "pending") {
      return res.status(403).json({
        registered: true,
        status: "pending",
        supervisor: {
          name: supervisor.supervisorName,
          universityName: supervisor.universityName,
          email: supervisor.email,
          requestedAt: supervisor.requestedAt,
        },
        message:
          "Your university registration request is currently pending approval. You will receive an email once approved.",
      });
    }

    if (supervisor.status === "rejected") {
      return res.status(403).json({
        registered: true,
        status: "rejected",
        rejectionReason: supervisor.rejectionReason || "No specific reason provided.",
        supervisor: {
          name: supervisor.supervisorName,
          universityName: supervisor.universityName,
          email: supervisor.email,
          rejectedAt: supervisor.rejectedAt,
        },
        message: `Your registration request was rejected. Reason: ${supervisor.rejectionReason || "Please contact admin."}`,
      });
    }

    if (supervisor.status === "revoked" || supervisor.status === "cancelled") {
      return res.status(403).json({
        registered: true,
        status: supervisor.status,
        supervisor: {
          name: supervisor.supervisorName,
          universityName: supervisor.universityName,
          email: supervisor.email,
        },
        message: "Your university access has been revoked or cancelled. Please contact TalentHub administration.",
      });
    }

    if (supervisor.status !== "approved") {
      return res.status(403).json({
        registered: true,
        status: supervisor.status,
        message: `Your account status is ${supervisor.status}.`,
      });
    }

    // Status is "approved" -> Update session details & sign JWT
    supervisor.lastLoginAt = new Date();
    if (payload.sub) supervisor.googleSubject = payload.sub;
    if (payload.picture) supervisor.picture = payload.picture;
    if (!supervisor.supervisorName && payload.name) supervisor.supervisorName = payload.name;
    await supervisor.save();

    const jwtToken = jwt.sign(
      {
        id: supervisor._id,
        email: supervisor.email,
        universityName: supervisor.universityName,
        supervisorName: supervisor.supervisorName,
        role: "university_supervisor",
        accountType: "university",
      },
      dotenv.jwtSecret,
      { expiresIn: "24h" }
    );

    return res.status(200).json({
      token: jwtToken,
      user: {
        id: supervisor._id,
        supervisorName: supervisor.supervisorName,
        universityName: supervisor.universityName,
        email: supervisor.email,
        department: supervisor.department,
        designation: supervisor.designation,
        contactNumber: supervisor.contactNumber,
        picture: supervisor.picture,
        status: "approved",
        role: "university_supervisor",
      },
      message: "University login successful!",
    });
  } catch (error) {
    console.error("[UniversityAuth] Google login error:", error);
    return res.status(500).json({
      message: error.message || "Failed to process university Google login.",
    });
  }
};

/**
 * Register a new University Supervisor Access Request
 */
const registerUniversityRequest = async (req, res) => {
  try {
    const {
      universityName,
      supervisorName,
      email,
      department,
      contactNumber,
      designation,
      notes,
    } = req.body;

    if (!universityName || !supervisorName || !email) {
      return res.status(400).json({
        message: "University name, supervisor name, and email are required.",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // Check if user already exists
    const existing = await UniversityUser.findOne({ email: normalizedEmail });

    if (existing) {
      if (existing.status === "approved") {
        return res.status(400).json({
          message: "This email is already registered and approved. You can sign in directly with Google.",
          status: "approved",
        });
      }

      if (existing.status === "pending") {
        return res.status(400).json({
          message: "A registration request for this email is already pending admin approval.",
          status: "pending",
        });
      }

      // If rejected, revoked, or cancelled -> Allow re-submitting updated request
      existing.universityName = universityName.trim();
      existing.supervisorName = supervisorName.trim();
      existing.department = department ? department.trim() : existing.department;
      existing.contactNumber = contactNumber ? contactNumber.trim() : existing.contactNumber;
      existing.designation = designation ? designation.trim() : existing.designation;
      existing.notes = notes ? notes.trim() : existing.notes;
      existing.status = "pending";
      existing.rejectionReason = "";
      existing.requestedAt = new Date();
      existing.approvedAt = null;
      existing.approvedBy = null;
      existing.rejectedAt = null;
      existing.rejectedBy = null;
      await existing.save();

      return res.status(200).json({
        success: true,
        message: "Your registration request has been re-submitted for approval. You will receive an email once reviewed.",
        supervisor: existing,
      });
    }

    // Create new request
    const newSupervisor = new UniversityUser({
      universityName: universityName.trim(),
      supervisorName: supervisorName.trim(),
      email: normalizedEmail,
      department: department ? department.trim() : "",
      contactNumber: contactNumber ? contactNumber.trim() : "",
      designation: designation ? designation.trim() : "University Supervisor / Coordinator",
      notes: notes ? notes.trim() : "",
      status: "pending",
      requestedAt: new Date(),
    });

    await newSupervisor.save();

    return res.status(201).json({
      success: true,
      message: "Registration request submitted successfully. Awaiting approval.",
      supervisor: newSupervisor,
    });
  } catch (error) {
    console.error("[UniversityAuth] Registration error:", error);
    return res.status(500).json({
      message: "Failed to submit registration request",
      error: error.message,
    });
  }
};

/**
 * Check Status of a University Email
 */
const checkUniversityStatus = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: "Email query parameter is required." });
    }

    const supervisor = await UniversityUser.findOne({
      email: String(email).toLowerCase().trim(),
    });

    if (!supervisor) {
      return res.status(404).json({ registered: false, message: "Email not registered." });
    }

    return res.status(200).json({
      registered: true,
      status: supervisor.status,
      universityName: supervisor.universityName,
      supervisorName: supervisor.supervisorName,
      email: supervisor.email,
      rejectionReason: supervisor.rejectionReason,
      requestedAt: supervisor.requestedAt,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── Admin Controller Functions ─────────────────────────────────────────────

/**
 * Admin: Get all university registration requests & supervisors
 */
const getAdminUniversityRequests = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (search && search.trim()) {
      const s = search.trim();
      filter.$or = [
        { supervisorName: new RegExp(s, "i") },
        { universityName: new RegExp(s, "i") },
        { email: new RegExp(s, "i") },
        { department: new RegExp(s, "i") },
      ];
    }

    const [requests, totalCount, pendingCount, approvedCount, rejectedCount, revokedCount] =
      await Promise.all([
        UniversityUser.find(filter).sort({ requestedAt: -1, createdAt: -1 }),
        UniversityUser.countDocuments(),
        UniversityUser.countDocuments({ status: "pending" }),
        UniversityUser.countDocuments({ status: "approved" }),
        UniversityUser.countDocuments({ status: "rejected" }),
        UniversityUser.countDocuments({ status: "revoked" }),
      ]);

    return res.status(200).json({
      requests,
      counts: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        revoked: revokedCount,
      },
    });
  } catch (error) {
    console.error("[AdminUniversity] Fetch requests error:", error);
    return res.status(500).json({ message: "Failed to fetch university requests." });
  }
};

/**
 * Admin: Approve a university registration request
 */
const approveUniversityRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const supervisor = await UniversityUser.findById(id);

    if (!supervisor) {
      return res.status(404).json({ message: "University request not found." });
    }

    supervisor.status = "approved";
    supervisor.approvedAt = new Date();
    supervisor.approvedBy = req.user?.email || "admin";
    supervisor.rejectionReason = "";
    await supervisor.save();

    // Auto-send approval email
    try {
      await sendUniversityApprovalEmail({
        to: supervisor.email,
        supervisorName: supervisor.supervisorName,
        universityName: supervisor.universityName,
      });
      console.log(`[AdminUniversity] Approval email sent to ${supervisor.email}`);
    } catch (emailErr) {
      console.error("[AdminUniversity] Email sending error:", emailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Access approved for ${supervisor.supervisorName} (${supervisor.universityName}). Approval email sent.`,
      supervisor,
    });
  } catch (error) {
    console.error("[AdminUniversity] Approve error:", error);
    return res.status(500).json({ message: "Failed to approve request." });
  }
};

/**
 * Admin: Reject a university registration request with reason
 */
const rejectUniversityRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const supervisor = await UniversityUser.findById(id);
    if (!supervisor) {
      return res.status(404).json({ message: "University request not found." });
    }

    supervisor.status = "rejected";
    supervisor.rejectedAt = new Date();
    supervisor.rejectedBy = req.user?.email || "admin";
    supervisor.rejectionReason =
      rejectionReason?.trim() || "Verification could not be confirmed with institutional records.";
    await supervisor.save();

    // Auto-send rejection email
    try {
      await sendUniversityRejectionEmail({
        to: supervisor.email,
        supervisorName: supervisor.supervisorName,
        universityName: supervisor.universityName,
        rejectionReason: supervisor.rejectionReason,
      });
      console.log(`[AdminUniversity] Rejection email sent to ${supervisor.email}`);
    } catch (emailErr) {
      console.error("[AdminUniversity] Email sending error:", emailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Request for ${supervisor.supervisorName} was rejected. Notification email sent.`,
      supervisor,
    });
  } catch (error) {
    console.error("[AdminUniversity] Reject error:", error);
    return res.status(500).json({ message: "Failed to reject request." });
  }
};

/**
 * Admin: Revoke access for an approved supervisor
 */
const revokeUniversityAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const supervisor = await UniversityUser.findById(id);

    if (!supervisor) {
      return res.status(404).json({ message: "University request not found." });
    }

    supervisor.status = "revoked";
    await supervisor.save();

    return res.status(200).json({
      success: true,
      message: `Access revoked for ${supervisor.supervisorName}.`,
      supervisor,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to revoke access." });
  }
};

/**
 * Admin: Delete a university supervisor record
 */
const deleteUniversityRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await UniversityUser.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "University request not found." });
    }

    return res.status(200).json({
      success: true,
      message: "University supervisor record deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete record." });
  }
};

// ─── University Supervisor Portal Endpoints ─────────────────────────────────

/**
 * Get profile of currently logged-in university supervisor
 */
const getSupervisorProfile = async (req, res) => {
  try {
    const supervisorId = req.universitySupervisor?._id || req.user?.id;
    const supervisor = supervisorId
      ? await UniversityUser.findById(supervisorId)
      : await UniversityUser.findOne({ email: req.user?.email });

    if (!supervisor) {
      return res.status(200).json({
        supervisor: {
          supervisorName: req.user?.name || "University Supervisor",
          universityName: req.user?.universityName || "NSBM Green University",
          email: req.user?.email || "",
          status: "approved",
        },
      });
    }
    return res.status(200).json({ supervisor });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Get all students enrolled from the logged-in supervisor's university
 */
const getUniversityStudents = async (req, res) => {
  try {
    const universityName =
      req.query?.universityName ||
      req.universitySupervisor?.universityName ||
      req.user?.universityName ||
      "NSBM Green University";

    const universityRegex = buildUniversityQueryRegex(universityName);

    // 1. Parallel fetch active interns, inactive interns, and projects
    const [interns, inactiveList, allProjects] = await Promise.all([
      Intern.find({
        $or: [
          { Institute: universityRegex },
          { institute: universityRegex },
          { Institute: new RegExp(universityName.split(" ")[0] || "NSBM", "i") },
        ],
      })
        .sort({ Trainee_Name: 1 })
        .lean(),
      InactiveIntern.find({
        $or: [
          { Institute: universityRegex },
          { institute: universityRegex },
          { Institute: new RegExp(universityName.split(" ")[0] || "NSBM", "i") },
        ],
      })
        .lean()
        .catch(() => []),
      Project.find({})
        .select("projectName status description tasks feedback team")
        .lean()
        .catch(() => []),
    ]);

    const internIds = interns.map((i) => i._id);
    const internEmails = interns.map((i) => (i.Trainee_Email || "").toLowerCase()).filter(Boolean);

    // 2. Parallel fetch related data for active interns
    const [dailyRecords, faceLogs, feedbacks, syncRecords] = await Promise.all([
      DailyRecord.find({ internId: { $in: internIds } })
        .select("internId date status attendance attendanceTime meetingAttendance task progress")
        .lean(),
      FaceAttendanceLog.find({ internId: { $in: internIds } })
        .select("internId timestamp date")
        .lean()
        .catch(() => []),
      UniversityStudentFeedback.find({ internId: { $in: internIds } })
        .lean()
        .catch(() => []),
      InternTalentTrailSync.find({ email: { $in: internEmails } })
        .lean()
        .catch(() => []),
    ]);

    // Organize daily records by internId
    const recordsByIntern = new Map();
    dailyRecords.forEach((rec) => {
      const key = String(rec.internId);
      if (!recordsByIntern.has(key)) recordsByIntern.set(key, []);
      recordsByIntern.get(key).push(rec);
    });

    // Organize face logs by internId
    const faceLogsByIntern = new Map();
    faceLogs.forEach((log) => {
      const key = String(log.internId);
      if (!faceLogsByIntern.has(key)) faceLogsByIntern.set(key, []);
      faceLogsByIntern.get(key).push(log);
    });

    // Organize feedback by internId
    const feedbackByIntern = new Map();
    feedbacks.forEach((fb) => {
      const key = String(fb.internId);
      if (!feedbackByIntern.has(key)) feedbackByIntern.set(key, []);
      feedbackByIntern.get(key).push(fb);
    });

    // Organize sync records by email
    const syncByEmail = new Map();
    syncRecords.forEach((sync) => {
      if (sync && sync.email) {
        syncByEmail.set(String(sync.email).toLowerCase(), sync);
      }
    });

    const currentYear = new Date().getFullYear();
    const holidays = getSriLankanHolidays([currentYear - 2, currentYear - 1, currentYear, currentYear + 1]) || new Set();

    const todayStr = new Date().toISOString().slice(0, 10);
    let activeTodayCount = 0;
    let totalQualitySum = 0;
    let totalLogbooksSubmitted = 0;

    const activeStudentList = interns.map((intern) => {
      const idKey = String(intern._id);
      const emailKey = (intern.Trainee_Email || "").toLowerCase();
      const studentRecords = recordsByIntern.get(idKey) || [];
      const studentFeedback = feedbackByIntern.get(idKey) || [];
      const syncRecord = syncByEmail.get(emailKey) || null;

      // Extract commits from in-memory cache if available
      const cached = gitCommitsCache ? gitCommitsCache.get(`git_commits_${intern._id}`) : null;
      let gitCommitsData = cached ? cached.data : null;

      // 1 & 2. Compute attendance metrics using exact AdminAnalytics calculation
      const attMetrics = computeAttendanceMetrics(intern, studentRecords, new Date(), holidays);

      // 3. Logbook Submissions Count
      const logbookCount = studentRecords.length;
      totalLogbooksSubmitted += logbookCount;

      // 4. Projects Count & Enrolled Projects
      const localProjects = (allProjects || []).filter((p) => {
        if (!p) return false;
        const inTasks = Array.isArray(p.tasks) && p.tasks.some((t) =>
          t && Array.isArray(t.assignedTo) && t.assignedTo.some((uid) => uid && String(uid) === idKey)
        );
        const inFeedback = Array.isArray(p.feedback) && p.feedback.some(
          (f) => f && f.internId && String(f.internId) === idKey
        );
        const matchTeam = p.team && intern.team && String(p.team).toLowerCase().trim() === String(intern.team).toLowerCase().trim();
        return inTasks || inFeedback || matchTeam;
      }).map((p) => ({
        id: p._id,
        name: p.projectName,
        status: p.status,
        description: p.description,
      }));

      const ttProjects = Array.isArray(syncRecord?.projects)
        ? syncRecord.projects.map((p) => ({
          id: p.projectId,
          name: p.projectName,
          status: p.status || "IN_PROGRESS",
          description: p.description || "",
        }))
        : [];

      // Combine & Deduplicate projects
      const combinedProjectsMap = new Map();
      [...localProjects, ...ttProjects].forEach((p) => {
        if (p && p.name && !combinedProjectsMap.has(p.name)) {
          combinedProjectsMap.set(p.name, p);
        }
      });
      const enrolledProjects = Array.from(combinedProjectsMap.values());
      const projectsCount = enrolledProjects.length;

      // 5. GitHub Commits Count (matching AdminAnalytics method)
      let commitsCount = 0;
      if (gitCommitsData) {
        if (gitCommitsData.totalCommits !== undefined) {
          commitsCount = Number(gitCommitsData.totalCommits) || 0;
        } else {
          let all = [];
          const projects = Array.isArray(gitCommitsData) ? gitCommitsData : (gitCommitsData.projectCommits || []);
          function walk(node) {
            if (!node) return;
            if (Array.isArray(node.commits)) all.push(...node.commits);
            if (Array.isArray(node.modules)) node.modules.forEach(walk);
            if (Array.isArray(node.children)) node.children.forEach(walk);
            if (Array.isArray(node.subProjects)) node.subProjects.forEach(walk);
          }
          projects.forEach(walk);
          commitsCount = all.length;
        }
      } else if (typeof intern.commitsCount === "number" && intern.commitsCount > 0) {
        commitsCount = intern.commitsCount;
      } else if (Array.isArray(intern.gitCommits) && intern.gitCommits.length > 0) {
        commitsCount = intern.gitCommits.length;
      } else if (typeof intern.commitsCount === "number") {
        commitsCount = intern.commitsCount;
      }

      // 6. Performance Rate (Exact match with AdminAnalytics)
      const logbookRate = attMetrics.logbookRecordRate;
      const baseAvg = (logbookRate + attMetrics.meetingAttendanceRate) / 2;
      let performanceRate = 0;
      const specName = intern.field_of_spec_name || intern.fieldOfSpecialization || intern.specialization || "";
      if (isNoCommitSpecialization(specName)) {
        performanceRate = Math.max(0, Math.min(100, Math.round(baseAvg)));
      } else {
        const commitBonus = Math.max(0, commitsCount - attMetrics.workingDays);
        performanceRate = Math.max(0, Math.min(100, Math.round(baseAvg + commitBonus)));
      }

      let internStatus = "Good";
      if (performanceRate < 60) internStatus = "Poor";
      else if (performanceRate < 80) internStatus = "At Risk";

      const workQualityRate = performanceRate;
      totalQualitySum += performanceRate;

      // Check if active today
      const attendanceEntries = intern.attendance || [];
      const hasTodayLog = studentRecords.some((r) => r.date === todayStr);
      const hasTodayAttendance = attendanceEntries.some(
        (a) => a.date && new Date(a.date).toISOString().slice(0, 10) === todayStr
      );
      const isActiveToday = hasTodayLog || hasTodayAttendance;
      if (isActiveToday) activeTodayCount += 1;

      // Latest logbook entry date
      const sortedRecords = [...studentRecords].sort(
        (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
      );
      const latestLogDate = sortedRecords.length > 0 ? sortedRecords[0].date : null;

      // Historical restriction count & Low Performer status (restricted 2 or more times, i.e. >= 2)
      const restrictionHistory = Array.isArray(intern.logbookRestrictionHistory)
        ? intern.logbookRestrictionHistory
        : [];
      const restrictionCount =
        restrictionHistory.length > 0
          ? restrictionHistory.length
          : (intern.logbookRestricted ? 1 : 0);
      const isLowPerformer = restrictionCount >= 2;
      const isTerminated = Boolean(intern.logbookRestricted || intern.status === "terminated");

      return {
        id: intern._id,
        traineeId: intern.Trainee_ID,
        name: intern.Trainee_Name,
        email: intern.Trainee_Email,
        institute: intern.Institute,
        fieldOfSpecialization: intern.field_of_spec_name,
        team: intern.team || "",
        startDate: intern.Training_StartDate,
        endDate: intern.Training_EndDate,
        district: intern.district || "",
        homeAddress: intern.Trainee_HomeAddress || "",
        googlePictureUrl: intern.googlePictureUrl || "",
        status: isTerminated ? "terminated" : "active",
        isInactive: false,
        isTerminated,
        dailyAttendanceRate: attMetrics.dailyAttendanceRate,
        meetingAttendanceRate: attMetrics.meetingAttendanceRate,
        attendanceRate: attMetrics.dailyAttendanceRate,
        presentDays: attMetrics.presentDays,
        workingDays: attMetrics.workingDays,
        elapsedWeeks: attMetrics.elapsedWeeks,
        attendedWeeks: attMetrics.attendedWeeks,
        logbookCount,
        commitsCount,
        projectsCount,
        qualityScore: workQualityRate,
        workQualityRate,
        latestLogDate,
        isActiveToday,
        feedbackCount: studentFeedback.length,
        enrolledProjects,
        restrictionCount,
        isLowPerformer,
        logbookRestricted: intern.logbookRestricted || false,
        logbookRestrictionReason: intern.logbookRestrictionReason || null,
        logbookRestrictedAt: intern.logbookRestrictedAt || null,
        logbookRestrictionHistory: restrictionHistory,
      };
    });

    const activeInternsCount = interns.length;
    // Deduplicate against active students and remove duplicates inside inactive list
    const activeIds = new Set(interns.map((i) => String(i._id)));
    const activeTraineeIds = new Set(interns.map((i) => (i.Trainee_ID || "").trim().toLowerCase()).filter(Boolean));
    const activeEmails = new Set(interns.map((i) => (i.Trainee_Email || "").trim().toLowerCase()).filter(Boolean));

    const seenInactiveKeys = new Set();
    const uniqueInactiveList = inactiveList.filter((inactiveIntern) => {
      const tid = (inactiveIntern.Trainee_ID || "").trim().toLowerCase();
      const em = (inactiveIntern.Trainee_Email || "").trim().toLowerCase();
      const idStr = String(inactiveIntern._id);

      if (activeIds.has(idStr) || (tid && activeTraineeIds.has(tid)) || (em && activeEmails.has(em))) {
        return false;
      }
      const key = tid || em || idStr;
      if (seenInactiveKeys.has(key)) return false;
      seenInactiveKeys.add(key);
      return true;
    });

    // Format inactive & terminated students
    const inactiveStudentList = uniqueInactiveList.map((inactiveIntern) => {
      const isTerminated = Boolean(
        inactiveIntern.archiveReason === "terminated"
      );

      const attMetrics = computeAttendanceMetrics(
        inactiveIntern,
        [],
        inactiveIntern.archivedAt || inactiveIntern.Training_EndDate || new Date()
      );

      const workQualityRate = Math.round((attMetrics.dailyAttendanceRate + attMetrics.meetingAttendanceRate) / 2);

      const restrictionHistory = Array.isArray(inactiveIntern.logbookRestrictionHistory)
        ? inactiveIntern.logbookRestrictionHistory
        : [];
      const restrictionCount =
        restrictionHistory.length > 0
          ? restrictionHistory.length
          : (inactiveIntern.logbookRestricted ? 1 : 0);
      const isLowPerformer = restrictionCount >= 2;

      return {
        id: inactiveIntern._id,
        traineeId: inactiveIntern.Trainee_ID,
        name: inactiveIntern.Trainee_Name,
        email: inactiveIntern.Trainee_Email,
        institute: inactiveIntern.Institute,
        fieldOfSpecialization: inactiveIntern.field_of_spec_name || "Engineering",
        team: inactiveIntern.team || "",
        startDate: inactiveIntern.Training_StartDate,
        endDate: inactiveIntern.Training_EndDate,
        archivedAt: inactiveIntern.archivedAt,
        archiveReason: inactiveIntern.archiveReason,
        district: inactiveIntern.district || "",
        homeAddress: inactiveIntern.Trainee_HomeAddress || "",
        googlePictureUrl: inactiveIntern.googlePictureUrl || "",
        status: isTerminated ? "terminated" : "inactive",
        isInactive: true,
        isTerminated,
        dailyAttendanceRate: attMetrics.dailyAttendanceRate,
        meetingAttendanceRate: attMetrics.meetingAttendanceRate,
        attendanceRate: attMetrics.dailyAttendanceRate,
        presentDays: attMetrics.presentDays,
        workingDays: attMetrics.workingDays,
        elapsedWeeks: attMetrics.elapsedWeeks,
        attendedWeeks: attMetrics.attendedWeeks,
        logbookCount: 0,
        commitsCount: 0,
        projectsCount: 0,
        qualityScore: workQualityRate,
        workQualityRate,
        latestLogDate: null,
        isActiveToday: false,
        feedbackCount: 0,
        enrolledProjects: [],
        restrictionCount,
        isLowPerformer,
        logbookRestricted: false,
        logbookRestrictionReason: null,
        logbookRestrictedAt: null,
        logbookRestrictionHistory: restrictionHistory,
      };
    });

    // Combine all students: active + inactive + terminated
    const fullStudentList = [...activeStudentList, ...inactiveStudentList];

    return res.status(200).json({
      universityName,
      supervisorName:
        req.universitySupervisor?.supervisorName ||
        req.user?.name ||
        "University Supervisor",
      totalStudents: fullStudentList.length,
      totalInterns: fullStudentList.length,
      activeInterns: activeStudentList.length,
      inactiveInterns: inactiveStudentList.filter((s) => !s.isTerminated).length,
      terminatedInterns: fullStudentList.filter((s) => s.isTerminated || s.logbookRestricted).length,
      lowPerformers: fullStudentList.filter((s) => s.isLowPerformer).length,
      activeToday: activeTodayCount,
      totalLogbooksSubmitted,
      averageQualityScore:
        activeStudentList.length > 0
          ? Math.round(totalQualitySum / activeStudentList.length)
          : 0,
      students: fullStudentList,
    });
  } catch (error) {
    console.error("[UniversitySupervisor] Get students error:", error);
    return res.status(500).json({ message: "Failed to fetch university students." });
  }
};

/**
 * Get comprehensive student details (Logbook, Attendance, Quality & Working Rate, Projects, Comments)
 */
const getUniversityStudentDetails = async (req, res) => {
  try {
    const { internId } = req.params;

    // Fetch intern by ID (active or inactive, by ObjectId, Trainee_ID, or Email)
    let intern = null;
    let isInactiveIntern = false;
    if (mongoose.Types.ObjectId.isValid(internId)) {
      intern = await Intern.findById(internId);
      if (!intern) {
        intern = await InactiveIntern.findById(internId);
        if (intern) isInactiveIntern = true;
      }
    }
    if (!intern) {
      intern = await Intern.findOne({
        $or: [
          { Trainee_ID: internId },
          { Trainee_Email: { $regex: new RegExp(`^${internId}$`, "i") } },
        ],
      });
    }
    if (!intern) {
      intern = await InactiveIntern.findOne({
        $or: [
          { Trainee_ID: internId },
          { Trainee_Email: { $regex: new RegExp(`^${internId}$`, "i") } },
        ],
      });
      if (intern) isInactiveIntern = true;
    }

    if (!intern) {
      return res.status(404).json({
        message: "Student record not found.",
      });
    }

    const idOr = [
      { internId: intern._id },
      ...(mongoose.Types.ObjectId.isValid(internId) ? [{ internId }] : []),
      ...(intern.Trainee_ID ? [{ traineeId: intern.Trainee_ID }] : []),
    ];

    // Load DailyRecords, FaceAttendanceLogs (all audit logs including checkout), Projects, Feedback, TalentTrail sync, and Git commits concurrently
    const [dailyRecords, faceLogs, allProjects, rawFeedbackList, syncRecord, gitCommitsData] = await Promise.all([
      DailyRecord.find({ $or: idOr }).sort({ date: -1 }).lean(),
      FaceAttendanceLog.find({ $or: idOr }).sort({ attendanceDate: -1 }).lean(),
      Project.find({}).lean(),
      UniversityStudentFeedback.find({ $or: idOr })
        .populate("universitySupervisorId", "picture")
        .sort({ createdAt: -1 })
        .lean(),
      InternTalentTrailSync.findOne({
        email: { $regex: new RegExp(`^${intern.Trainee_Email}$`, "i") },
      }).lean().catch(() => null),
      fetchInternGitCommitsData(intern._id).catch(() => null),
    ]);

    const feedbackList = (rawFeedbackList || []).map((fb) => ({
      ...fb,
      picture: fb.supervisorPicture || fb.universitySupervisorId?.picture || "",
      supervisorPicture: fb.supervisorPicture || fb.universitySupervisorId?.picture || "",
    }));

    const currentYear = new Date().getFullYear();
    const holidays = getSriLankanHolidays([currentYear - 2, currentYear - 1, currentYear, currentYear + 1]) || new Set();

    // Compute attendance metrics using exact AdminAnalytics calculation
    const attMetrics = computeAttendanceMetrics(intern, dailyRecords, new Date(), holidays);

    // Matching local and talentTrail projects
    const localProjects = (allProjects || []).filter((p) => {
      if (!p) return false;
      const inTasks = Array.isArray(p.tasks) && p.tasks.some((t) =>
        t && Array.isArray(t.assignedTo) && t.assignedTo.some((uid) => uid && String(uid) === String(intern._id))
      );
      const inFeedback = Array.isArray(p.feedback) && p.feedback.some(
        (f) => f && f.internId && String(f.internId) === String(intern._id)
      );
      const matchTeam = p.team && intern.team && String(p.team).toLowerCase().trim() === String(intern.team).toLowerCase().trim();
      return inTasks || inFeedback || matchTeam;
    }).map((p) => ({
      id: p._id,
      name: p.projectName,
      status: p.status,
      description: p.description,
    }));

    const ttProjects = Array.isArray(syncRecord?.projects)
      ? syncRecord.projects.map((p) => ({
        id: p.projectId,
        name: p.projectName,
        status: p.status || "IN_PROGRESS",
        description: p.description || "",
      }))
      : [];

    const combinedProjectsMap = new Map();
    [...localProjects, ...ttProjects].forEach((p) => {
      if (p && p.name && !combinedProjectsMap.has(p.name)) {
        combinedProjectsMap.set(p.name, p);
      }
    });
    const enrolledProjects = Array.from(combinedProjectsMap.values());
    const projectsCount = enrolledProjects.length;

    // GitHub Commits Count (matching AdminAnalytics method)
    let commitsCount = 0;
    if (gitCommitsData) {
      if (gitCommitsData.totalCommits !== undefined) {
        commitsCount = Number(gitCommitsData.totalCommits) || 0;
      } else {
        let all = [];
        const projects = Array.isArray(gitCommitsData) ? gitCommitsData : (gitCommitsData.projectCommits || []);
        function walk(node) {
          if (!node) return;
          if (Array.isArray(node.commits)) all.push(...node.commits);
          if (Array.isArray(node.modules)) node.modules.forEach(walk);
          if (Array.isArray(node.children)) node.children.forEach(walk);
          if (Array.isArray(node.subProjects)) node.subProjects.forEach(walk);
        }
        projects.forEach(walk);
        commitsCount = all.length;
      }
    } else if (typeof intern.commitsCount === "number" && intern.commitsCount > 0) {
      commitsCount = intern.commitsCount;
    } else if (Array.isArray(intern.gitCommits) && intern.gitCommits.length > 0) {
      commitsCount = intern.gitCommits.length;
    } else if (typeof intern.commitsCount === "number") {
      commitsCount = intern.commitsCount;
    }

    // Performance Rate (Exact match with AdminAnalytics)
    const logbookRate = attMetrics.logbookRecordRate;
    const baseAvg = (logbookRate + attMetrics.meetingAttendanceRate) / 2;
    let performanceRate = 0;
    const specName = intern.field_of_spec_name || intern.fieldOfSpecialization || intern.specialization || "";
    if (isNoCommitSpecialization(specName)) {
      performanceRate = Math.max(0, Math.min(100, Math.round(baseAvg)));
    } else {
      const commitBonus = Math.max(0, commitsCount - attMetrics.workingDays);
      performanceRate = Math.max(0, Math.min(100, Math.round(baseAvg + commitBonus)));
    }
    const workQualityRate = performanceRate;

    // ── Build Comprehensive Attendance Records (Reconciling intern.attendance + faceLogs + dailyRecords) ──
    const dailyEntriesByDate = buildDailyAttendanceByDate(
      intern.attendance || [],
      DAILY_ATTENDANCE_TYPES
    );
    // Reconcile checkout times from FaceAttendanceLog audit records
    addAuditCheckoutTimes(dailyEntriesByDate, faceLogs || []);

    const dailyMap = new Map();
    const meetingMap = new Map();

    // 1. Populate dailyMap from reconciled dailyEntriesByDate
    dailyEntriesByDate.forEach((info, dateKey) => {
      const entry = info.entry || {};
      const rawType = entry.type || "daily";
      const checkOut = info.checkOutTime || entry.checkOutTime || null;
      const timeMarked = info.markedAt || entry.timeMarked || entry.date;

      dailyMap.set(dateKey, {
        date: entry.date || dateKey,
        status: entry.status || "Present",
        rawType,
        type: formatAttendanceTypeLabel(rawType, false),
        timeMarked,
        checkOutTime: checkOut,
        projectName: "",
        isMeeting: false,
      });
    });

    // 2. Process intern.attendance entries for meeting records
    (intern.attendance || []).forEach((a) => {
      if (!a || !a.date) return;
      const type = (a.type || "").toLowerCase();
      const isDaily = DAILY_ATTENDANCE_TYPES.has(type);
      const dateKey = getColomboDateKey(a.date);

      if (!isDaily) {
        const meetingName =
          a.projectName ||
          a.meetingName ||
          a.meeting ||
          a.title ||
          a.subject ||
          a.topic ||
          "General Meeting";
        const meetingKey = `${dateKey}::${meetingName}`;
        if (!meetingMap.has(meetingKey)) {
          meetingMap.set(meetingKey, {
            date: a.date,
            status: a.status || "Present",
            rawType: type,
            type: formatAttendanceTypeLabel(type, true),
            timeMarked: a.timeMarked || a.date,
            checkOutTime: a.checkOutTime || null,
            projectName: meetingName,
            meetingName: meetingName,
            isMeeting: true,
          });
        }
      }
    });

    // 3. Process DailyRecords (Logbooks & embedded meetingAttendance)
    dailyRecords.forEach((record) => {
      if (!record || !record.date) return;
      const dateKey = getColomboDateKey(record.date);
      const recordStatus = (record.status || "working").toLowerCase();
      const derivedStatus =
        recordStatus === "leave" || recordStatus === "study_leave"
          ? "Absent"
          : "Present";

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: record.date,
          status: derivedStatus,
          rawType: "daily",
          type: "Logbook Attendance",
          timeMarked: record.attendanceTime || record.date,
          checkOutTime: record.checkOutTime || null,
          projectName: "",
          isMeeting: false,
        });
      } else {
        const curr = dailyMap.get(dateKey);
        if (record.checkOutTime && !curr.checkOutTime) {
          curr.checkOutTime = record.checkOutTime;
        }
        if (record.attendanceTime && !curr.timeMarked) {
          curr.timeMarked = record.attendanceTime;
        }
        if (record.status) {
          curr.status = derivedStatus;
        }
      }

      // Process meetings inside DailyRecord
      if (Array.isArray(record.meetingAttendance) && record.meetingAttendance.length > 0) {
        record.meetingAttendance.forEach((m) => {
          if (!m) return;
          const mName = m.projectName || m.meetingTitle || m.title || "General Meeting";
          const mKey = `${dateKey}::${mName}`;
          if (!meetingMap.has(mKey)) {
            const mType = m.method || "meeting";
            meetingMap.set(mKey, {
              date: m.attendanceTime || record.date,
              status: "Present",
              rawType: mType,
              type: formatAttendanceTypeLabel(mType, true),
              timeMarked: m.attendanceTime || record.date,
              checkOutTime: null,
              projectName: mName,
              meetingName: mName,
              isMeeting: true,
            });
          }
        });
      }
    });

    const attendanceRecords = [
      ...Array.from(dailyMap.values()),
      ...Array.from(meetingMap.values()),
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const restrictionHistory = Array.isArray(intern.logbookRestrictionHistory)
      ? intern.logbookRestrictionHistory
      : [];
    const restrictionCount =
      restrictionHistory.length > 0
        ? restrictionHistory.length
        : (intern.logbookRestricted ? 1 : 0);
    const isLowPerformer = restrictionCount >= 2;
    const isTerminated = Boolean(intern.logbookRestricted || intern.status === "terminated");

    return res.status(200).json({
      student: {
        id: intern._id,
        traineeId: intern.Trainee_ID,
        name: intern.Trainee_Name,
        email: intern.Trainee_Email,
        institute: intern.Institute,
        fieldOfSpecialization: intern.field_of_spec_name,
        team: intern.team || "",
        startDate: intern.Training_StartDate,
        endDate: intern.Training_EndDate,
        district: intern.district || "",
        homeAddress: intern.Trainee_HomeAddress || "",
        availableDays: intern.availableDays || [],
        googlePictureUrl: intern.googlePictureUrl || "",
        status: isTerminated ? "terminated" : (isInactiveIntern ? "inactive" : "active"),
        isInactive: isInactiveIntern,
        isTerminated,
        restrictionCount,
        isLowPerformer,
        logbookRestricted: intern.logbookRestricted || false,
        logbookRestrictionReason: intern.logbookRestrictionReason || null,
        logbookRestrictedAt: intern.logbookRestrictedAt || null,
        logbookRestrictionHistory: restrictionHistory,
      },
      metrics: {
        dailyAttendanceRate: attMetrics.dailyAttendanceRate,
        meetingAttendanceRate: attMetrics.meetingAttendanceRate,
        attendanceRate: attMetrics.dailyAttendanceRate,
        workQualityRate,
        overallQualityScore: workQualityRate,
        qualityScore: workQualityRate,
        logbookCount,
        commitsCount,
        projectsCount,
        presentDays: attMetrics.presentDays,
        workingDays: attMetrics.workingDays,
        elapsedWeeks: attMetrics.elapsedWeeks,
        attendedWeeks: attMetrics.attendedWeeks,
        totalLogs: dailyRecords.length,
        enrolledProjectsCount: enrolledProjects.length,
        faceScansCount: faceLogs.length,
      },
      dailyRecords,
      attendanceRecords,
      enrolledProjects,
      gitCommitsData,
      feedbackList,
    });
  } catch (error) {
    console.error("[UniversitySupervisor] Get student details error:", error);
    return res.status(500).json({ message: "Failed to fetch student details." });
  }
};

/**
 * Add a university supervisor feedback/comment for a student
 */
const addStudentFeedback = async (req, res) => {
  try {
    const { internId } = req.params;
    const { comment, rating, tags } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: "Feedback comment cannot be empty." });
    }

    const intern = await Intern.findById(internId);

    if (!intern) {
      return res.status(404).json({
        message: "Student not found.",
      });
    }

    const supervisorId = req.universitySupervisor?._id || req.user?.id || new mongoose.Types.ObjectId();
    const supervisorName = req.universitySupervisor?.supervisorName || req.user?.name || "University Supervisor";
    const supervisorEmail = req.universitySupervisor?.email || req.user?.email || "supervisor@university.lk";
    const universityName = req.universitySupervisor?.universityName || req.user?.universityName || intern.Institute || "University";
    const supervisorPicture = req.universitySupervisor?.picture || req.user?.picture || "";

    const feedback = new UniversityStudentFeedback({
      internId: intern._id,
      traineeId: intern.Trainee_ID,
      universitySupervisorId: supervisorId,
      supervisorName,
      supervisorEmail,
      supervisorPicture,
      universityName,
      comment: comment.trim(),
      rating: Number(rating) || 5,
      tags: Array.isArray(tags) ? tags : [],
    });

    await feedback.save();

    return res.status(201).json({
      success: true,
      message: "Feedback recorded successfully.",
      feedback,
    });
  } catch (error) {
    console.error("[UniversitySupervisor] Add feedback error:", error);
    return res.status(500).json({ message: "Failed to record supervisor feedback." });
  }
};

/**
 * Update a university supervisor feedback/comment
 */
const updateStudentFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { comment, rating, tags } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: "Feedback comment cannot be empty." });
    }

    const feedback = await UniversityStudentFeedback.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback record not found." });
    }

    feedback.comment = comment.trim();
    if (rating !== undefined) {
      feedback.rating = Number(rating) || 5;
    }
    if (Array.isArray(tags)) {
      feedback.tags = tags;
    }

    await feedback.save();

    return res.status(200).json({
      success: true,
      message: "Feedback updated successfully.",
      feedback,
    });
  } catch (error) {
    console.error("[UniversitySupervisor] Update feedback error:", error);
    return res.status(500).json({ message: "Failed to update supervisor feedback." });
  }
};

/**
 * Delete a university supervisor feedback/comment
 */
const deleteStudentFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;

    const feedback = await UniversityStudentFeedback.findByIdAndDelete(feedbackId);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback record not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Feedback removed successfully.",
    });
  } catch (error) {
    console.error("[UniversitySupervisor] Delete feedback error:", error);
    return res.status(500).json({ message: "Failed to delete supervisor feedback." });
  }
};

/**
 * Get live GitHub commits for a university student
 */
const getUniversityStudentGitCommits = async (req, res) => {
  try {
    const { internId } = req.params;
    const data = await fetchInternGitCommitsData(internId);
    if (!data) return res.status(404).json({ error: "Student not found" });
    return res.status(200).json(data);
  } catch (error) {
    console.error("[UniversitySupervisor] Get git commits error:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  universityGoogleLogin,
  registerUniversityRequest,
  checkUniversityStatus,
  getAdminUniversityRequests,
  approveUniversityRequest,
  rejectUniversityRequest,
  revokeUniversityAccess,
  deleteUniversityRequest,
  getSupervisorProfile,
  getUniversityStudents,
  getUniversityStudentDetails,
  getUniversityStudentGitCommits,
  addStudentFeedback,
  updateStudentFeedback,
  deleteStudentFeedback,
};
