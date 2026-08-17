import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  Building2,
  Users,
  Search,
  LogOut,
  Calendar,
  Clock,
  BookOpen,
  ScanLine,
  Activity,
  Award,
  ChevronDown,
  ArrowLeft,
  Star,
  CheckCircle2,
  AlertCircle,
  FolderGit2,
  MessageSquare,
  Send,
  X,
  MapPin,
  Mail,
  UserCheck,
  UserX,
  UserMinus,
  AlertTriangle,
  Shield,
  Layers,
  GitCommit,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Edit2,
  Trash2,
  Save,
  RotateCcw,
  Check,
} from "lucide-react";
import { API_BASE_URL } from "../api/apiConfig";
import sltLogo from "../assets/sltlogoOnly.png";
import talentHubLogo from "../assets/talenthubwhitebg.jpeg";
import DailyRecordsHeatmap from "../components/DailyRecordsHeatmap";
import CommitHeatmap from "../components/CommitHeatmap";

// ── In-Memory Fast Client Cache (SWR Pattern for instant page loads) ─────────
const studentDataCache = new Map();

// ── Reusable Circular Progress Ring ─────────────────────────────────────────
const CircularProgressRing = ({
  percentage = 0,
  size = 56,
  strokeWidth = 4.5,
  trackColor = "#e2e8f0",
  strokeColor = "#2563eb",
  textColor = "text-blue-700",
  label = "",
  icon: Icon = null,
  iconColor = "text-blue-600",
}) => {
  const cleanPct = Math.min(100, Math.max(0, Number(percentage) || 0));
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - cleanPct / 100);

  let dynTrackColor = "#fee2e2";
  let dynStrokeColor = "#ef4444";
  let dynTextColor = "text-red-700";
  let dynIconColor = "text-red-600";

  if (cleanPct >= 75) {
    dynTrackColor = "#dbeafe";
    dynStrokeColor = "#3b82f6";
    dynTextColor = "text-blue-700";
    dynIconColor = "text-blue-600";
  } else if (cleanPct >= 50) {
    dynTrackColor = "#fef3c7";
    dynStrokeColor = "#f59e0b";
    dynTextColor = "text-amber-700";
    dynIconColor = "text-amber-600";
  }

  return (
    <div className="flex flex-col items-center justify-center gap-1 shrink-0">
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <svg
          className="w-full h-full -rotate-90 transform"
          viewBox={`0 0 ${size} ${size}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={dynTrackColor}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={dynStrokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[12px] sm:text-[13px] font-black ${dynTextColor} tracking-tight`}>
            {cleanPct}%
          </span>
        </div>
      </div>
      {label && (
        <div className="flex flex-col items-center mt-0.5">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">
            {label}
          </span>
          {Icon && <Icon className={`h-3 w-3 mt-0.5 ${dynIconColor}`} />}
        </div>
      )}
    </div>
  );
};

// ── Reusable Pagination Component ───────────────────────────────────────────
const Pagination = ({ currentPage, totalItems, itemsPerPage, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("...");
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 text-xs text-slate-500">
      <span className="font-medium text-center sm:text-left">
        Showing <span className="font-bold text-slate-800">{startItem}</span>–
        <span className="font-bold text-slate-800">{endItem}</span> of{" "}
        <span className="font-bold text-slate-800">{totalItems}</span> records
      </span>
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-bold transition-all cursor-pointer disabled:cursor-not-allowed text-xs min-h-[36px]"
          aria-label="Previous Page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Prev</span>
        </button>

        {getPageNumbers().map((p, idx) =>
          p === "..." ? (
            <span key={`ell-${idx}`} className="px-1.5 py-1 text-slate-400 font-bold">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-9 h-9 rounded-xl font-bold transition-all cursor-pointer text-xs flex items-center justify-center ${currentPage === p
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-bold transition-all cursor-pointer disabled:cursor-not-allowed text-xs min-h-[36px]"
          aria-label="Next Page"
        >
          <span>Next</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

// ── Skeletons for Seamless Progressive Loading ──────────────────────────────
const CardSkeleton = ({ count = 3 }) => (
  <div className="space-y-3.5">
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 animate-pulse space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="h-5 w-28 bg-slate-200 rounded-lg" />
          <div className="h-5 w-16 bg-slate-200 rounded-md" />
        </div>
        <div className="h-3.5 w-1/3 bg-slate-200/70 rounded" />
        <div className="h-10 w-full bg-slate-200/50 rounded-xl" />
      </div>
    ))}
  </div>
);

const TableSkeleton = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 animate-pulse space-y-3">
    <div className="h-8 bg-slate-100 rounded-xl w-full" />
    <div className="space-y-2 pt-2">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="h-9 bg-slate-50 rounded-lg w-full" />
      ))}
    </div>
  </div>
);

// ── Formatters ──────────────────────────────────────────────────────────────
const formatDateYMD = (d) => {
  if (!d) return "N/A";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
};

const formatTime12H = (timeVal) => {
  if (!timeVal) return "-";
  if (
    typeof timeVal === "string" &&
    !timeVal.includes("T") &&
    !timeVal.includes("-") &&
    (timeVal.includes(":") || timeVal.includes("AM") || timeVal.includes("PM"))
  ) {
    return timeVal;
  }
  try {
    const d = new Date(timeVal);
    if (isNaN(d.getTime())) return String(timeVal);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(timeVal);
  }
};

const getAttendanceTypeBadge = (type, rawType) => {
  const t = String(rawType || type || "").toLowerCase().trim();
  if (t === "face" || t === "face recognition" || t.includes("face")) {
    return {
      label: "Face Attendance",
      color: "text-purple-700 bg-purple-50 border-purple-200",
      icon: ScanLine,
    };
  }
  if (t === "daily_qr" || t === "qr" || t.includes("qr")) {
    return {
      label: "QR Attendance",
      color: "text-blue-700 bg-blue-50 border-blue-200",
      icon: ScanLine,
    };
  }
  if (t === "manual_daily" || t === "manual" || t.includes("manual")) {
    return {
      label: "Manual Attendance",
      color: "text-amber-700 bg-amber-50 border-amber-200",
      icon: ScanLine,
    };
  }
  if (t === "daily" || t.includes("logbook")) {
    return {
      label: "Logbook Attendance",
      color: "text-emerald-700 bg-emerald-50 border-emerald-200",
      icon: BookOpen,
    };
  }
  return {
    label: type || "Daily Attendance",
    color: "text-blue-700 bg-blue-50 border-blue-200",
    icon: ScanLine,
  };
};

const UniversityStudentDetails = () => {
  const { internId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Scroll immediately to top of the page upon opening
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [internId]);

  // Pre-populate supervisor from localStorage
  const [supervisor] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("universityUser") || "null");
    } catch {
      return null;
    }
  });

  // Pre-populate student & synthesized metrics from cache or navigation state
  const navStudent = location.state?.student || null;
  const initialCached = studentDataCache.get(internId) || null;

  const [studentDetails, setStudentDetails] = useState(() => {
    if (initialCached && initialCached?.dailyRecords) return initialCached;
    return null;
  });

  // Preload all required data before displaying page (or instantly open if cached)
  const [loading, setLoading] = useState(!initialCached || !initialCached?.dailyRecords);
  const [isFetchingFull, setIsFetchingFull] = useState(!initialCached || !initialCached?.dailyRecords);
  const [error, setError] = useState(null);

  // Profile dropdown menu state & ref
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Active Tab: 'logbook' | 'attendance' | 'projects' | 'quality' | 'feedback'
  const [activeTab, setActiveTab] = useState("logbook");

  // Attendance sub-tab: 'daily' | 'meeting'
  const [attendanceSubTab, setAttendanceSubTab] = useState("daily");

  // Heatmap View: 'logbook' | 'commits'
  const [heatmapView, setHeatmapView] = useState("logbook");

  // Logbook search filter state
  const [logbookSearch, setLogbookSearch] = useState("");

  // Pagination states
  const [logbookPage, setLogbookPage] = useState(1);
  const [dailyAttPage, setDailyAttPage] = useState(1);
  const [meetingAttPage, setMeetingAttPage] = useState(1);
  const [expandedProjects, setExpandedProjects] = useState({});

  // Reset pagination when searching
  useEffect(() => {
    setLogbookPage(1);
  }, [logbookSearch]);

  // Feedback Submission State
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // Feedback Editing & Deletion State
  const [editingFeedbackId, setEditingFeedbackId] = useState(null);
  const [editFeedbackText, setEditFeedbackText] = useState("");
  const [editFeedbackRating, setEditFeedbackRating] = useState(5);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getAuthToken = useCallback(() => {
    return (
      localStorage.getItem("universityToken") ||
      localStorage.getItem("authToken") ||
      (() => {
        try {
          return JSON.parse(localStorage.getItem("adminInfo") || "{}")?.token || "";
        } catch {
          return "";
        }
      })()
    );
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("universityToken");
    localStorage.removeItem("universityUser");
    navigate("/university-login");
  }, [navigate]);

  // Fast background fetch with AbortController and instant cache sync
  const fetchStudentData = useCallback(async () => {
    if (!internId) return;
    setError(null);
    const token = getAuthToken();

    const controller = new AbortController();

    try {
      const res = await fetch(`${API_BASE_URL}/university/students/${internId}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        signal: controller.signal,
      });

      if (res.status === 401 && !token) {
        handleLogout();
        return;
      }

      const data = await res.json();
      if (res.ok) {
        studentDataCache.set(internId, data);
        setStudentDetails(data);
      } else {
        if (!studentDetails) {
          setError(data.message || "Failed to load student details.");
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error loading student details:", err);
        if (!studentDetails) {
          setError("Network error occurred while fetching student details.");
        }
      }
    } finally {
      setLoading(false);
      setIsFetchingFull(false);
    }

    return () => controller.abort();
  }, [internId, getAuthToken, handleLogout]);

  useEffect(() => {
    fetchStudentData();
  }, [internId]);

  // Submit Supervisor Guidance Feedback
  const handleAddFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackText.trim() || !internId) return;

    setSubmittingFeedback(true);
    try {
      const token = getAuthToken();
      const res = await fetch(
        `${API_BASE_URL}/university/students/${internId}/feedback`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            comment: feedbackText.trim(),
            rating: feedbackRating,
          }),
        }
      );

      const data = await res.json();
      if (res.ok) {
        setFeedbackSuccess(true);
        setFeedbackText("");
        setStudentDetails((prev) => {
          const updated = {
            ...prev,
            feedbackList: [data.feedback, ...(prev?.feedbackList || [])],
          };
          studentDataCache.set(internId, updated);
          return updated;
        });
        setTimeout(() => setFeedbackSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Error adding feedback:", err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleStartEditFeedback = (fb) => {
    setEditingFeedbackId(fb._id);
    setEditFeedbackText(fb.comment || "");
    setEditFeedbackRating(fb.rating || 5);
    setDeleteConfirmId(null);
  };

  const handleCancelEditFeedback = () => {
    setEditingFeedbackId(null);
    setEditFeedbackText("");
    setEditFeedbackRating(5);
  };

  const handleUpdateFeedback = async (feedbackId) => {
    if (!editFeedbackText.trim() || !internId) return;

    setSubmittingEdit(true);
    try {
      const token = getAuthToken();
      const res = await fetch(
        `${API_BASE_URL}/university/students/${internId}/feedback/${feedbackId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            comment: editFeedbackText.trim(),
            rating: editFeedbackRating,
          }),
        }
      );

      const data = await res.json();
      if (res.ok) {
        setStudentDetails((prev) => {
          const updatedList = (prev?.feedbackList || []).map((f) =>
            f._id === feedbackId
              ? { ...f, comment: editFeedbackText.trim(), rating: editFeedbackRating }
              : f
          );
          const updated = { ...prev, feedbackList: updatedList };
          studentDataCache.set(internId, updated);
          return updated;
        });
        setEditingFeedbackId(null);
      } else {
        alert(data.message || "Failed to update feedback.");
      }
    } catch (err) {
      console.error("Error updating feedback:", err);
      alert("Failed to update feedback.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteFeedback = async (feedbackId) => {
    setDeletingFeedbackId(feedbackId);
    try {
      const token = getAuthToken();
      const res = await fetch(
        `${API_BASE_URL}/university/students/${internId}/feedback/${feedbackId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );

      if (res.ok) {
        setStudentDetails((prev) => {
          const updatedList = (prev?.feedbackList || []).filter(
            (f) => f._id !== feedbackId
          );
          const updated = { ...prev, feedbackList: updatedList };
          studentDataCache.set(internId, updated);
          return updated;
        });
        setDeleteConfirmId(null);
      } else {
        const data = await res.json();
        alert(data.message || "Failed to delete feedback.");
      }
    } catch (err) {
      console.error("Error deleting feedback:", err);
      alert("Failed to delete feedback.");
    } finally {
      setDeletingFeedbackId(null);
    }
  };

  const student = studentDetails?.student;

  // Synthesize metrics directly so values NEVER show 0% during progressive fetch
  const metrics = useMemo(() => {
    if (studentDetails?.metrics) return studentDetails.metrics;
    const s = student || navStudent;
    if (s) {
      return {
        dailyAttendanceRate: s.dailyAttendanceRate ?? s.attendanceRate ?? 0,
        meetingAttendanceRate: s.meetingAttendanceRate ?? 0,
        workQualityRate: s.workQualityRate ?? s.qualityScore ?? s.overallQualityScore ?? 0,
        overallQualityScore: s.workQualityRate ?? s.qualityScore ?? s.overallQualityScore ?? 0,
        presentDays: s.presentDays ?? 0,
        workingDays: s.workingDays ?? 0,
        attendedWeeks: s.attendedWeeks ?? 0,
        elapsedWeeks: s.elapsedWeeks ?? 0,
        projectsCount: s.projectsCount ?? (s.enrolledProjects?.length || 0),
        logbookCount: s.logbookCount ?? 0,
        commitsCount: s.commitsCount ?? 0,
      };
    }
    return {};
  }, [studentDetails?.metrics, student, navStudent]);

  const dailyRecords = useMemo(() => studentDetails?.dailyRecords || [], [studentDetails?.dailyRecords]);
  const attendanceRecords = useMemo(() => studentDetails?.attendanceRecords || [], [studentDetails?.attendanceRecords]);
  const enrolledProjects = useMemo(() => studentDetails?.enrolledProjects || [], [studentDetails?.enrolledProjects]);
  const gitCommitsData = useMemo(() => studentDetails?.gitCommitsData || null, [studentDetails?.gitCommitsData]);
  const feedbackList = useMemo(() => studentDetails?.feedbackList || [], [studentDetails?.feedbackList]);

  // Is the full detailed records payload ready?
  const isRecordsReady = !isFetchingFull && Boolean(studentDetails?.dailyRecords && studentDetails?.attendanceRecords);

  // Filtered logbooks based on search
  const filteredLogbooks = useMemo(() => {
    if (!logbookSearch.trim()) return dailyRecords;
    const q = logbookSearch.toLowerCase();
    return dailyRecords.filter(
      (r) =>
        (r.date || "").toLowerCase().includes(q) ||
        (r.task || "").toLowerCase().includes(q) ||
        (r.stack || "").toLowerCase().includes(q) ||
        (r.status || "").toLowerCase().includes(q) ||
        (r.progress || "").toLowerCase().includes(q)
    );
  }, [dailyRecords, logbookSearch]);

  // Paginated logbooks (10 per page)
  const paginatedLogbooks = useMemo(() => {
    const start = (logbookPage - 1) * 10;
    return filteredLogbooks.slice(start, start + 10);
  }, [filteredLogbooks, logbookPage]);

  // Filter attendance records
  const dailyAttendanceList = useMemo(
    () => attendanceRecords.filter((a) => !a.isMeeting),
    [attendanceRecords]
  );
  const meetingAttendanceList = useMemo(
    () => attendanceRecords.filter((a) => a.isMeeting),
    [attendanceRecords]
  );

  // Paginated attendance records (15 per page)
  const paginatedDailyAttendance = useMemo(() => {
    const start = (dailyAttPage - 1) * 15;
    return dailyAttendanceList.slice(start, start + 15);
  }, [dailyAttendanceList, dailyAttPage]);

  const paginatedMeetingAttendance = useMemo(() => {
    const start = (meetingAttPage - 1) * 15;
    return meetingAttendanceList.slice(start, start + 15);
  }, [meetingAttendanceList, meetingAttPage]);

  const profilePictureUrl = supervisor?.picture || supervisor?.googlePictureUrl || "";

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans select-none">
      {/* ─── Top Brand Navigation Bar ─── */}
      <header
        className="sticky top-0 z-40 shadow-lg text-white select-none"
        style={{
          background: "linear-gradient(135deg, #000066 0%, #006600 100%)",
        }}
      >
        <div className="w-full px-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* ─── LEFT CORNER: SLT Logo + TalentHub Logo + Title & University Info ─── */}
            <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
              <Link
                to="/university-dashboard"
                className="flex items-center gap-2 sm:gap-2.5 hover:opacity-95 transition-opacity shrink-0"
              >
                <img
                  src={sltLogo}
                  alt="SLT Mobitel"
                  className="h-7 sm:h-9 w-auto object-contain select-none"
                />
                <img
                  src={talentHubLogo}
                  alt="TalentHub"
                  className="h-7 sm:h-9 w-auto rounded-md object-contain select-none"
                />
              </Link>

              <div className="flex flex-col justify-center min-w-0">
                <Link to="/university-dashboard" className="leading-none">
                  <span className="text-lg sm:text-2xl font-extrabold tracking-tight leading-none text-white">
                    <span className="text-[#00b4eb]">Talent</span>
                    <span className="text-[#50b748]">Hub</span>
                  </span>
                </Link>
                <span className="text-[11px] sm:text-[13px] text-white/80 font-normal mt-0.5 leading-none tracking-normal truncate">
                  University Portal
                </span>
              </div>

              {/* Divider */}
              <div className="h-9 sm:h-11 w-px bg-white/20 hidden md:block mx-1 sm:mx-2 shrink-0" />

              {/* University Name & Supervisor Name */}
              <div className="hidden md:flex flex-col justify-center leading-tight min-w-0">
                <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] lg:max-w-[340px]">
                  {supervisor?.universityName || student?.institute || "University Supervision"}
                </span>
                <span className="text-[10px] sm:text-[11px] text-white/70 mt-0.5 truncate max-w-[200px] lg:max-w-[340px]">
                  {supervisor?.supervisorName
                    ? `Supervisor: ${supervisor.supervisorName}`
                    : "Academic Supervision"}
                </span>
              </div>
            </div>

            {/* ─── RIGHT CORNER: Profile Avatar / Dropdown ─── */}
            <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen((prev) => !prev)}
                  className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-full sm:rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 transition-all cursor-pointer min-h-[40px]"
                  aria-label="Toggle user profile menu"
                >
                  {profilePictureUrl ? (
                    <img
                      src={profilePictureUrl}
                      alt={supervisor?.supervisorName || "Supervisor"}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover shadow-sm ring-2 ring-emerald-400"
                    />
                  ) : (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[#00b4eb] to-[#50b748] flex items-center justify-center font-bold text-xs sm:text-sm text-white shadow ring-2 ring-white/30">
                      {(supervisor?.supervisorName || "U")[0].toUpperCase()}
                    </div>
                  )}

                  <div className="hidden md:flex flex-col text-left leading-tight pr-1">
                    <span className="text-xs font-bold text-white max-w-[130px] truncate">
                      {supervisor?.supervisorName || "Supervisor"}
                    </span>
                    <span className="text-[10px] text-white/70 max-w-[130px] truncate">
                      {supervisor?.universityName || "University"}
                    </span>
                  </div>

                  <ChevronDown
                    className={`h-3.5 w-3.5 text-white/70 transition-transform ${isProfileOpen ? "rotate-180" : ""
                      }`}
                  />
                </button>

                {/* Profile & Logout Dropdown Menu */}
                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white text-slate-800 shadow-2xl border border-slate-200 overflow-hidden z-50"
                    >
                      {/* Dropdown Header */}
                      <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex items-center gap-3">
                        {profilePictureUrl ? (
                          <img
                            src={profilePictureUrl}
                            alt={supervisor?.supervisorName || "Supervisor"}
                            className="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-500 shadow-sm shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#000066] to-[#006600] text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                            {(supervisor?.supervisorName || "U")[0].toUpperCase()}
                          </div>
                        )}

                        <div className="overflow-hidden">
                          <h4 className="font-bold text-sm text-slate-900 truncate">
                            {supervisor?.supervisorName || "University Supervisor"}
                          </h4>
                          <p className="text-xs text-slate-500 truncate">
                            {supervisor?.email || "Academic Supervisor"}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Authorized Supervisor
                          </span>
                        </div>
                      </div>

                      {/* University Details */}
                      <div className="p-3.5 space-y-1.5 text-xs border-b border-slate-100">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">
                            {supervisor?.universityName || student?.institute || "University"}
                          </span>
                        </div>
                        {supervisor?.department && (
                          <div className="flex items-center gap-2 text-slate-600 pl-6">
                            <span>Department: {supervisor.department}</span>
                          </div>
                        )}
                      </div>

                      {/* Dropdown Actions */}
                      <div className="p-2 space-y-1">
                       {/*<button
                          onClick={() => {
                            setIsProfileOpen(false);
                            navigate("/university-dashboard");
                          }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer min-h-[40px]"
                        >
                          <Users className="h-4 w-4 text-slate-500" />
                          <span>View All Students</span>
                        </button>*/}
                        <button
                          onClick={() => {
                            setIsProfileOpen(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer min-h-[40px]"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Content Container ─── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-5 sm:space-y-6 select-none">
        {/* Navigation Breadcrumb Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-xs transition-all cursor-pointer group min-h-[38px]"
          >
            <ChevronLeft className="h-4 w-4 text-slate-500 group-hover:-translate-x-0.5 transition-transform shrink-0" />
            <span className="hidden sm:inline">Back to All Interns List</span>
            <span className="sm:hidden">Back</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button onClick={() => navigate("/university-dashboard")} className="hover:text-slate-900 transition-colors font-medium">
              University Portal
            </button>
            <span>/</span>
            <span className="font-semibold text-slate-800 truncate max-w-[150px] sm:max-w-[240px]">
              {student?.name || "Student Details"}
            </span>
          </div>
        </div>

        {/* Full Blocking Loading State (Only if 0 data available) */}
        {loading ? (
          <div className="py-24 text-center bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-3">
            <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-700">Loading comprehensive student portfolio...</p>
            <p className="text-xs text-slate-400">Retrieving attendance, logbooks, Git commits, and quality records.</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-rose-200 p-6 shadow-sm space-y-3">
            <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">{error}</h3>
            <button
              onClick={() => navigate("/university-dashboard")}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors inline-flex items-center gap-2 min-h-[40px]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Students Dashboard</span>
            </button>
          </div>
        ) : student ? (
          <>
            {/* ─── Hero Student Profile Banner (Responsive Stack on Mobile, Flex on Desktop) ─── */}
            <div
              className="p-5 sm:p-7 rounded-3xl text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-5 sm:gap-6"
              style={{
                background: "linear-gradient(135deg, #000066 0%, #006600 100%)",
              }}
            >
              {/* Background watermark */}
              <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-10 translate-y-10">
                <GraduationCap size={280} />
              </div>

              {/* Student Bio & Badges */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 relative z-10 w-full md:w-auto">
                <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center font-bold text-2xl text-white shadow-lg overflow-hidden shrink-0">
                  <img
                    src={`${API_BASE_URL}/interns/${student.id}/profile-picture`}
                    alt={student.name}
                    className="w-full h-full object-cover bg-white"
                    onError={(e) => {
                      e.target.src =
                        student.googlePictureUrl ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          student.name || "Intern"
                        )}&background=random`;
                    }}
                  />
                </div>

                <div className="space-y-2 min-w-0 flex-1">
                  {/* Row 1: Name */}
                  <h1 className="text-[clamp(1.1rem,4vw,1.875rem)] font-extrabold text-white tracking-tight break-words leading-tight">
                    {student.name}
                  </h1>

                  {/* Row 2: Single-row/wrap: ID → University → Specialization → Status tag (Uniform Pill design) */}
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    {/* 1. ID */}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/20 text-white border border-white/30 shrink-0">
                      <span className="opacity-70">ID:</span> {student.traineeId}
                    </span>

                    {/* 2. University */}
                    {student.institute && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/20 text-white border border-white/30 shrink-0">
                        <GraduationCap className="h-3 w-3 opacity-80 shrink-0" />
                        <span className="truncate max-w-[200px] sm:max-w-none">{student.institute}</span>
                      </span>
                    )}

                    {/* 3. Specialization */}
                    {student.fieldOfSpecialization && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/20 text-white border border-white/30 shrink-0">
                        <Layers className="h-3 w-3 opacity-80 shrink-0" />
                        <span className="truncate max-w-[180px] sm:max-w-none">{student.fieldOfSpecialization}</span>
                      </span>
                    )}

                    {/* 4. Status badge */}
                    {(student.isTerminated || student.status === "terminated") ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-600 text-white border border-rose-400 shrink-0">
                        <UserX className="h-3 w-3 shrink-0" /> Terminated
                      </span>
                    ) : student.isInactive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-600 text-slate-100 border border-slate-400 shrink-0">
                        <UserMinus className="h-3 w-3 shrink-0" /> Inactive
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500 text-white border border-emerald-400 shrink-0">
                        <UserCheck className="h-3 w-3 shrink-0" /> Active Intern
                      </span>
                    )}
                  </div>

                  {/* Secondary warning badges */}
                  {((student.isLowPerformer || student.restrictionCount >= 2) || student.logbookRestricted) && (
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      {(student.isLowPerformer || student.restrictionCount >= 2) && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-400 text-slate-950 border border-amber-300">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          Low Performer ({student.restrictionCount} Warnings)
                        </span>
                      )}
                      {student.logbookRestricted && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500 text-white border border-rose-400">
                          <Shield className="h-3 w-3 shrink-0" /> Restricted
                        </span>
                      )}
                    </div>
                  )}

                  {/* Row 4: Contact/location/dates */}
                  <div className="flex items-center gap-2.5 sm:gap-4 text-[11px] sm:text-xs text-white/80 flex-wrap pt-0.5">
                    {student.email && (
                      <span className="flex items-center gap-1 truncate max-w-[240px]">
                        <Mail className="h-3.5 w-3.5 text-white/60 shrink-0" /> {student.email}
                      </span>
                    )}
                    {student.district && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-white/60 shrink-0" /> {student.district}
                      </span>
                    )}
                    {student.startDate && (() => {
                      const start = new Date(student.startDate);
                      const end = student.endDate ? new Date(student.endDate) : new Date();
                      const diffDays = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
                      return (
                        <span className="flex items-center gap-1 flex-wrap">
                          <Calendar className="h-3.5 w-3.5 text-white/60 shrink-0" />
                          <span>{formatDateYMD(student.startDate)}</span>
                          {student.endDate && <span>– {formatDateYMD(student.endDate)}</span>}
                          <span className="text-white/40 mx-0.5">·</span>
                          <CalendarDays className="h-3.5 w-3.5 text-white/60 shrink-0" />
                          <span>{diffDays} days</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Quick Quality Score Banner Badge */}
              <div className="relative z-10 flex items-center justify-between md:justify-start gap-3.5 bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/20 w-full md:w-auto shrink-0">
                <div className="flex flex-col text-left">
                  <span className="text-[10px] uppercase font-bold text-white/75 tracking-wider">
                    Work Quality Score
                  </span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-emerald-300 leading-tight">
                    {metrics.workQualityRate ?? metrics.overallQualityScore ?? 0}%
                  </span>
                </div>
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
                  <Award className="h-6 w-6 text-slate-950" />
                </div>
              </div>
            </div>

            {/* ─── 4 Bento KPI Circular Progress Rings & Key Stat Cards ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {/* Card 1: Daily Attendance */}
              <div className="p-4.5 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 truncate">
                    <ScanLine className="h-3.5 w-3.5 text-blue-600 shrink-0" /> Daily Attendance
                  </span>
                  <div className="text-2xl font-extrabold text-blue-700">
                    {metrics.dailyAttendanceRate ?? metrics.attendanceRate ?? 0}%
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    {metrics.presentDays ?? 0} attended / {metrics.workingDays ?? 0} days
                  </p>
                </div>
                <CircularProgressRing
                  percentage={metrics.dailyAttendanceRate ?? metrics.attendanceRate ?? 0}
                  size={54}
                  strokeWidth={4.5}
                  trackColor="#e0f2fe"
                  strokeColor="#2563eb"
                  textColor="text-blue-700"
                />
              </div>

              {/* Card 2: Weekly Meeting Attendance */}
              <div className="p-4.5 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 truncate">
                    <Users className="h-3.5 w-3.5 text-purple-600 shrink-0" /> Meeting Attendance
                  </span>
                  <div className="text-2xl font-extrabold text-purple-700">
                    {metrics.meetingAttendanceRate ?? 0}%
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    {metrics.attendedWeeks ?? 0} attended / {metrics.elapsedWeeks ?? 0} wks
                  </p>
                </div>
                <CircularProgressRing
                  percentage={metrics.meetingAttendanceRate ?? 0}
                  size={54}
                  strokeWidth={4.5}
                  trackColor="#ede9fe"
                  strokeColor="#7c3aed"
                  textColor="text-purple-700"
                />
              </div>

              {/* Card 3: Work Quality Rate */}
              <div className="p-4.5 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 truncate">
                    <Activity className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Quality Rate
                  </span>
                  <div className="text-2xl font-extrabold text-emerald-700">
                    {metrics.workQualityRate ?? metrics.overallQualityScore ?? 0}%
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    Task performance score
                  </p>
                </div>
                <CircularProgressRing
                  percentage={metrics.workQualityRate ?? metrics.overallQualityScore ?? 0}
                  size={54}
                  strokeWidth={4.5}
                  trackColor="#d1fae5"
                  strokeColor="#059669"
                  textColor="text-emerald-700"
                />
              </div>

              {/* Card 4: Contribution Counters */}
              <div className="p-4.5 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Contribution Counters
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="p-1.5 sm:p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block font-semibold truncate">Projects</span>
                    <span className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5 block">
                      {metrics.projectsCount ?? enrolledProjects.length}
                    </span>
                  </div>
                  <div className="p-1.5 sm:p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block font-semibold truncate">Logbooks</span>
                    <span className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5 block">
                      {metrics.logbookCount ?? dailyRecords.length}
                    </span>
                  </div>
                  <div className="p-1.5 sm:p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block font-semibold truncate">Commits</span>
                    <span className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5 block">
                      {metrics.commitsCount ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Heatmap Section (Progressive & Fast) ─── */}
            <div className="space-y-3.5">
              {/* Heatmap External Toggle Selector */}
              <div className="w-full max-w-[380px] mx-auto px-1">
                <div className="flex bg-white p-1.5 rounded-2xl shadow-xs border border-slate-200 w-full relative">
                  <button
                    onClick={() => setHeatmapView("logbook")}
                    className={`relative z-10 flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] ${heatmapView === "logbook"
                        ? "text-white"
                        : "text-slate-500 hover:text-slate-700"
                      }`}
                  >
                    <BookOpen size={15} className="shrink-0" />
                    <span className="truncate">Logbook Heatmap</span>
                  </button>
                  <button
                    onClick={() => setHeatmapView("commits")}
                    className={`relative z-10 flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] ${heatmapView === "commits"
                        ? "text-white"
                        : "text-slate-500 hover:text-slate-700"
                      }`}
                  >
                    <GitCommit size={15} className="shrink-0" />
                    <span className="truncate">Git Commits</span>
                  </button>
                  <div
                    className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-300 ease-out shadow-sm"
                    style={{
                      background:
                        heatmapView === "logbook"
                          ? "linear-gradient(135deg, #50b748 0%, #2e7d32 100%)"
                          : "linear-gradient(135deg, #00b4eb 0%, #0056a2 100%)",
                      left: heatmapView === "logbook" ? "6px" : "calc(50%)",
                    }}
                  />
                </div>
              </div>

              {/* Heatmap Content Card */}
              <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <motion.div
                  key={heatmapView}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center justify-between gap-3 mb-3.5 flex-wrap">
                    <div>
                      <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                        {heatmapView === "logbook" ? "Daily Logbook Activity Heatmap" : "GitHub Code Commit Activity Heatmap"}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {heatmapView === "logbook"
                          ? "Visualize daily submission frequency and activity strength throughout the internship training period."
                          : "Track code repository commits contributed by this student across assigned projects."}
                      </p>
                    </div>

                    {heatmapView === "commits" && gitCommitsData?.githubUsername && (
                      <span className="text-xs font-mono text-slate-600 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                        GitHub: @{gitCommitsData.githubUsername}
                      </span>
                    )}
                  </div>

                  <div className="w-full overflow-x-auto custom-scrollbar pb-1">
                    {!isRecordsReady && !studentDetails?.dailyRecords ? (
                      <div className="w-full h-44 rounded-2xl bg-slate-50 border border-slate-100 animate-pulse flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Loader2 className="h-6 w-6 text-emerald-600 animate-spin" />
                        <span className="text-xs font-semibold">Loading activity heatmap...</span>
                      </div>
                    ) : heatmapView === "logbook" ? (
                      <DailyRecordsHeatmap
                        startDate={student.startDate}
                        endDate={student.endDate}
                        records={dailyRecords}
                      />
                    ) : (
                      <CommitHeatmap
                        startDate={student.startDate}
                        endDate={student.endDate}
                        internId={student.id || internId}
                        commitData={gitCommitsData}
                      />
                    )}
                  </div>
                </motion.div>
              </div>
            </div>

            {/* ─── Detailed Portfolio Tabs ─── */}
            <div className="space-y-4">
              {/* Navigation Tab Bar (Fully responsive: equal-width flex distribution on desktop, smooth horizontal swipe on mobile) */}
              <div className="w-full p-1.5 bg-slate-200/80 rounded-2xl border border-slate-300/80 shadow-xs overflow-x-auto hide-scrollbar">
                <div className="flex items-center gap-1 sm:gap-1.5 min-w-full">
                  {[
                    { id: "logbook",    labelFull: `Daily Logbooks (${isRecordsReady ? dailyRecords.length : metrics.logbookCount || 0})`,          labelShort: `Logbooks (${isRecordsReady ? dailyRecords.length : metrics.logbookCount || 0})`,      icon: BookOpen },
                    { id: "attendance", labelFull: `Attendance Records (${isRecordsReady ? attendanceRecords.length : metrics.presentDays || 0})`,  labelShort: `Attendance (${isRecordsReady ? attendanceRecords.length : metrics.presentDays || 0})`, icon: ScanLine },
                    { id: "projects",   labelFull: `Enrolled Projects (${isRecordsReady ? enrolledProjects.length : metrics.projectsCount || 0})`, labelShort: `Projects (${isRecordsReady ? enrolledProjects.length : metrics.projectsCount || 0})`,   icon: FolderGit2 },
                    { id: "quality",    labelFull: "Quality, Restrictions & Commits",                                                               labelShort: "Quality",                                                                            icon: Activity },
                    { id: "feedback",   labelFull: `Supervisor Guidance (${feedbackList.length})`,                                                  labelShort: `Feedback (${feedbackList.length})`,                                                   icon: MessageSquare },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 lg:px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap cursor-pointer min-h-[40px] shrink-0 lg:shrink ${isActive
                            ? "bg-slate-900 text-white shadow-md"
                            : "bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/90"
                          }`}
                      >
                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <span className="hidden sm:inline">{tab.labelFull}</span>
                        <span className="sm:hidden">{tab.labelShort}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab Contents Container */}
              <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 lg:p-7 shadow-xs min-h-[350px]">
                {/* ─── TAB 1: DAILY LOGBOOK ─── */}
                {activeTab === "logbook" && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-emerald-600 shrink-0" />
                        <span>Submitted Daily Logbook Records</span>
                      </h3>

                      {/* Search Bar for Logbooks */}
                      <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={logbookSearch}
                          onChange={(e) => setLogbookSearch(e.target.value)}
                          placeholder="Search tasks, tech stack, date..."
                          className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all min-h-[38px] select-text cursor-text"
                        />
                        {logbookSearch && (
                          <button
                            onClick={() => setLogbookSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                            aria-label="Clear search"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {!isRecordsReady && !studentDetails?.dailyRecords ? (
                      <CardSkeleton count={3} />
                    ) : filteredLogbooks.length === 0 ? (
                      <div className="py-16 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-200 p-4">
                        {logbookSearch
                          ? "No logbook records match your search filter."
                          : "No daily logbook records submitted yet by this student."}
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3.5">
                          {paginatedLogbooks.map((record) => (
                            <div
                              key={record._id || record.date}
                              className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 shadow-xs hover:shadow-sm transition-all space-y-2.5"
                            >
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                                    <CalendarDays className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                    {record.date}
                                  </span>
                                  <span
                                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${record.status === "working"
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                        : record.status === "wfh"
                                          ? "bg-sky-100 text-sky-800 border border-sky-200"
                                          : "bg-rose-100 text-rose-800 border border-rose-200"
                                      }`}
                                  >
                                    {record.status}
                                  </span>
                                </div>

                                {record.attendanceTime && (
                                  <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-slate-400" />
                                    Checked In: {formatTime12H(record.attendanceTime)}
                                  </span>
                                )}
                              </div>

                              {record.stack && (
                                <div>
                                  <span className="text-[10px] uppercase font-bold text-sky-700 tracking-wider block">
                                    Technology Stack:
                                  </span>
                                  <p className="text-xs text-slate-800 font-mono mt-0.5 font-semibold bg-sky-50/50 p-2 rounded-lg border border-sky-100 break-words">
                                    {record.stack}
                                  </p>
                                </div>
                              )}

                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                                  Tasks Accomplished:
                                </span>
                                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mt-1 whitespace-pre-line bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-100 break-words">
                                  {record.task || "No task notes provided."}
                                </p>
                              </div>

                              {record.progress && record.progress !== "No challenges faced" && (
                                <div>
                                  <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider block">
                                    Progress & Challenges:
                                  </span>
                                  <p className="text-xs text-slate-600 mt-1 bg-amber-50/60 p-2.5 sm:p-3 rounded-xl border border-amber-100 break-words">
                                    {record.progress}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Pagination for Logbooks */}
                        <Pagination
                          currentPage={logbookPage}
                          totalItems={filteredLogbooks.length}
                          itemsPerPage={10}
                          onPageChange={setLogbookPage}
                        />
                      </>
                    )}
                  </div>
                )}

                {/* ─── TAB 2: ATTENDANCE RECORDS ─── */}
                {activeTab === "attendance" && (
                  <div className="space-y-4">
                    {/* ── Attendance Sub-Tab Selector ── */}
                    <div className="flex items-center gap-2 flex-wrap pb-1">
                      <button
                        onClick={() => {
                          setAttendanceSubTab("daily");
                          setDailyAttPage(1);
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[40px] ${attendanceSubTab === "daily"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                      >
                        <ScanLine className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Daily Attendance</span>
                        <span className="sm:hidden">Daily</span>
                        <span
                          className={`ml-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${attendanceSubTab === "daily" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
                            }`}
                        >
                          {isRecordsReady ? dailyAttendanceList.length : metrics.presentDays || 0}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setAttendanceSubTab("meeting");
                          setMeetingAttPage(1);
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[40px] ${attendanceSubTab === "meeting"
                            ? "bg-purple-600 text-white shadow-sm"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                      >
                        <Users className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Meeting Attendance</span>
                        <span className="sm:hidden">Meeting</span>
                        <span
                          className={`ml-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${attendanceSubTab === "meeting" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700"
                            }`}
                        >
                          {isRecordsReady ? meetingAttendanceList.length : metrics.attendedWeeks || 0}
                        </span>
                      </button>
                    </div>

                    {/* ── Daily Attendance Section ── */}
                    {attendanceSubTab === "daily" && (
                      <div className="space-y-4">
                        {!isRecordsReady && !studentDetails?.attendanceRecords ? (
                          <TableSkeleton />
                        ) : dailyAttendanceList.length === 0 ? (
                          <div className="py-16 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-200">
                            No daily attendance records found.
                          </div>
                        ) : (
                          <>
                            {/* 1. Desktop Grid Layout */}
                            <div
                              className="hidden md:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                              style={{ width: '100%' }}
                            >
                              {/* Header */}
                              <div
                                className="grid items-center bg-slate-50 border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-widest font-bold"
                                style={{ width: '100%', gridTemplateColumns: '20% 14% 26% 20% 20%' }}
                              >
                                <div className="py-3.5 flex justify-center">Date</div>
                                <div className="py-3.5 flex justify-center">Status</div>
                                <div className="py-3.5 flex justify-center">Attendance Type</div>
                                <div className="py-3.5 flex justify-center">Check-In</div>
                                <div className="py-3.5 flex justify-center">Check-Out</div>
                              </div>
                              {/* Data Rows */}
                              <div className="divide-y divide-slate-100">
                                {paginatedDailyAttendance.map((att, i) => {
                                  const typeBadge = getAttendanceTypeBadge(att.type, att.rawType);
                                  const TypeIcon = typeBadge.icon;
                                  return (
                                    <div
                                      key={i}
                                      className={`grid items-center transition-colors ${i % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/30 hover:bg-slate-50/80'
                                        }`}
                                      style={{ width: '100%', gridTemplateColumns: '20% 14% 26% 20% 20%', minHeight: '54px' }}
                                    >
                                      {/* Date */}
                                      <div className="py-3 flex justify-center">
                                        <span className="font-bold text-slate-800 text-xs tracking-tight">{formatDateYMD(att.date)}</span>
                                      </div>
                                      {/* Status */}
                                      <div className="py-3 flex justify-center">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold ${(att.status || '').toLowerCase() === 'present'
                                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                            : 'bg-rose-100 text-rose-700 border border-rose-200'
                                          }`}>
                                          {att.status}
                                        </span>
                                      </div>
                                      {/* Attendance Type */}
                                      <div className="py-3 flex justify-center">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${typeBadge.color}`}>
                                          <TypeIcon className="h-3 w-3 shrink-0" /> {typeBadge.label}
                                        </span>
                                      </div>
                                      {/* Check-In */}
                                      <div className="py-3 flex justify-center">
                                        {att.timeMarked ? (
                                          <span className="inline-flex items-center gap-1.5 text-slate-600 font-mono text-xs font-medium">
                                            <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                                            {formatTime12H(att.timeMarked)}
                                          </span>
                                        ) : <span className="text-slate-300 text-xs">–</span>}
                                      </div>
                                      {/* Check-Out */}
                                      <div className="py-3 flex justify-center">
                                        {att.checkOutTime ? (
                                          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-mono text-xs font-bold">
                                            <Clock className="h-3 w-3 text-emerald-500 shrink-0" />
                                            {formatTime12H(att.checkOutTime)}
                                          </span>
                                        ) : (
                                          <span className="text-slate-300 text-xs">–</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 2. Mobile Responsive Cards Layout (Mobile < 768px) */}
                            <div className="grid grid-cols-1 gap-3 md:hidden">
                              {paginatedDailyAttendance.map((att, i) => {
                                const typeBadge = getAttendanceTypeBadge(att.type, att.rawType);
                                const TypeIcon = typeBadge.icon;
                                return (
                                  <div
                                    key={i}
                                    className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                        <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
                                        {formatDateYMD(att.date)}
                                      </span>
                                      <span
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${(att.status || "").toLowerCase() === "present"
                                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                            : "bg-rose-100 text-rose-800 border border-rose-200"
                                          }`}
                                      >
                                        {att.status}
                                      </span>
                                    </div>

                                    <div>
                                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-[10px] font-bold ${typeBadge.color}`}>
                                        <TypeIcon className="h-3 w-3 shrink-0" /> {typeBadge.label}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                                      <div className="space-y-0.5">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                          Check-In
                                        </span>
                                        <span className="font-mono text-slate-700 flex items-center gap-1 text-[11px]">
                                          <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                                          {formatTime12H(att.timeMarked)}
                                        </span>
                                      </div>

                                      <div className="space-y-0.5">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                                          Check-Out
                                        </span>
                                        <span className="font-mono text-slate-800 font-semibold flex items-center gap-1 text-[11px]">
                                          <Clock className="h-3 w-3 text-emerald-600 shrink-0" />
                                          {formatTime12H(att.checkOutTime)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Pagination */}
                            <Pagination
                              currentPage={dailyAttPage}
                              totalItems={dailyAttendanceList.length}
                              itemsPerPage={15}
                              onPageChange={setDailyAttPage}
                            />
                          </>
                        )}
                      </div>
                    )}

                    {/* ── Meeting Attendance Section ── */}
                    {attendanceSubTab === "meeting" && (
                      <div className="space-y-4">
                        {!isRecordsReady && !studentDetails?.attendanceRecords ? (
                          <TableSkeleton />
                        ) : meetingAttendanceList.length === 0 ? (
                          <div className="py-16 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-200">
                            No weekly meeting attendance records found.
                          </div>
                        ) : (
                          <>
                            {/* 1. Desktop Grid Layout */}
                            <div
                              className="hidden md:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                              style={{ width: '100%' }}
                            >
                              {/* Header */}
                              <div
                                className="grid items-center bg-slate-50 border-b-2 border-slate-200 text-slate-500 text-[10px] uppercase tracking-widest font-bold"
                                style={{ width: '100%', gridTemplateColumns: '18% 13% 23% 18% 28%' }}
                              >
                                <div className="py-3.5 flex justify-center">Date</div>
                                <div className="py-3.5 flex justify-center">Status</div>
                                <div className="py-3.5 flex justify-center">Attendance Type</div>
                                <div className="py-3.5 flex justify-center">Check-In</div>
                                <div className="py-3.5 flex justify-center">Meeting Title</div>
                              </div>
                              {/* Data Rows */}
                              <div className="divide-y divide-slate-100">
                                {paginatedMeetingAttendance.map((att, i) => (
                                  <div
                                    key={i}
                                    className={`grid items-center transition-colors ${i % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/30 hover:bg-slate-50/80'
                                      }`}
                                    style={{ width: '100%', gridTemplateColumns: '18% 13% 23% 18% 28%', minHeight: '54px' }}
                                  >
                                    {/* Date */}
                                    <div className="py-3 flex justify-center">
                                      <span className="font-bold text-slate-800 text-xs tracking-tight">{formatDateYMD(att.date)}</span>
                                    </div>
                                    {/* Status */}
                                    <div className="py-3 flex justify-center">
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold ${(att.status || '').toLowerCase() === 'present'
                                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                          : 'bg-rose-100 text-rose-700 border border-rose-200'
                                        }`}>
                                        {att.status}
                                      </span>
                                    </div>
                                    {/* Attendance Type */}
                                    <div className="py-3 flex justify-center">
                                      <span className="inline-flex items-center gap-1.5 text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 text-[11px] font-bold">
                                        <Users className="h-3 w-3 shrink-0" /> {att.type || 'Meeting'}
                                      </span>
                                    </div>
                                    {/* Check-In */}
                                    <div className="py-3 flex justify-center">
                                      {att.timeMarked ? (
                                        <span className="inline-flex items-center gap-1.5 text-slate-600 font-mono text-xs font-medium">
                                          <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                                          {formatTime12H(att.timeMarked)}
                                        </span>
                                      ) : <span className="text-slate-300 text-xs">–</span>}
                                    </div>
                                    {/* Meeting Title */}
                                    <div className="py-3 flex justify-center">
                                      <span className="inline-flex items-center gap-1.5 text-slate-700 text-xs font-semibold">
                                        <MessageSquare className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                                        <span className="truncate max-w-[160px]">
                                          {att.meetingName || att.projectName || att.meetingTitle || att.title || 'General Meeting'}
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* 2. Mobile Responsive Cards Layout (Mobile < 768px) */}
                            <div className="grid grid-cols-1 gap-3 md:hidden">
                              {paginatedMeetingAttendance.map((att, i) => (
                                <div
                                  key={i}
                                  className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                      <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
                                      {formatDateYMD(att.date)}
                                    </span>
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${(att.status || "").toLowerCase() === "present"
                                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                          : "bg-rose-100 text-rose-800 border border-rose-200"
                                        }`}
                                    >
                                      {att.status}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100 text-xs">
                                    <span className="text-[10px] uppercase font-bold text-purple-700 block">
                                      Meeting Topic / Project:
                                    </span>
                                    <span className="font-semibold text-slate-800 mt-0.5 block break-words">
                                      {att.meetingName || att.projectName || att.meetingTitle || att.title || "General Meeting"}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between pt-1 text-xs">
                                    <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 text-[10px] font-bold">
                                      <Users className="h-3 w-3 shrink-0" /> {att.type || "Meeting"}
                                    </span>
                                    <span className="font-mono text-slate-600 flex items-center gap-1 text-[11px]">
                                      <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                                      {formatTime12H(att.timeMarked)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Pagination */}
                            <Pagination
                              currentPage={meetingAttPage}
                              totalItems={meetingAttendanceList.length}
                              itemsPerPage={15}
                              onPageChange={setMeetingAttPage}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── TAB 3: ENROLLED PROJECTS ─── */}
                {activeTab === "projects" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <FolderGit2 className="h-5 w-5 text-purple-600 shrink-0" />
                        <span>Enrolled Projects ({isRecordsReady ? enrolledProjects.length : metrics.projectsCount || 0})</span>
                      </h3>
                    </div>

                    {!isRecordsReady && !studentDetails?.enrolledProjects ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="h-28 rounded-2xl bg-slate-50 border border-slate-100 animate-pulse" />
                        <div className="h-28 rounded-2xl bg-slate-50 border border-slate-100 animate-pulse" />
                      </div>
                    ) : enrolledProjects.length === 0 ? (
                      <div className="py-16 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-200">
                        No enrolled project records associated with this student.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {enrolledProjects.map((p) => (
                          <div
                            key={p._id || p.id || p.name}
                            className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 shadow-xs hover:shadow-sm transition-all space-y-3 flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-bold text-sm sm:text-base text-slate-900 break-words">
                                  {p.projectName || p.name}
                                </h4>
                                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                                  {p.status || "Active"}
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed break-words">
                                {p.description || "Project assignment via TalentTrail / SLT Mobitel."}
                              </p>
                            </div>

                            {p.team && (
                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                <span>Assigned Team:</span>
                                <strong className="text-slate-800 font-semibold">{p.team}</strong>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── TAB 4: QUALITY, RESTRICTIONS & COMMITS ─── */}
                {activeTab === "quality" && (
                  <div className="space-y-6">
                    {/* Work Quality Overview Banner */}
                    <div className="p-4 sm:p-6 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-xs text-emerald-800 font-bold uppercase tracking-wider block">
                          Academic Quality Metric
                        </span>
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-900">
                          {metrics.workQualityRate ?? metrics.overallQualityScore}% Quality Score
                        </h3>
                        <p className="text-xs text-emerald-700 max-w-xl">
                          Overall evaluation based on your work performance.                       </p>
                      </div>
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-extrabold text-xl sm:text-2xl shadow-md shrink-0">
                        {metrics.workQualityRate ?? metrics.overallQualityScore}%
                      </div>
                    </div>

                    {/* Restriction History & Low Performer Card */}
                    <div
                      className={`p-4 sm:p-5 rounded-2xl border ${student.isLowPerformer
                          ? "bg-rose-50 border-rose-200"
                          : student.restrictionCount > 0
                            ? "bg-amber-50 border-amber-200"
                            : "bg-slate-50 border-slate-200"
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle
                          className={`h-5 w-5 shrink-0 ${student.isLowPerformer
                              ? "text-rose-600"
                              : student.restrictionCount > 0
                                ? "text-amber-600"
                                : "text-slate-500"
                            }`}
                        />
                        <h4
                          className={`text-xs sm:text-sm font-extrabold uppercase tracking-wide ${student.isLowPerformer
                              ? "text-rose-900"
                              : student.restrictionCount > 0
                                ? "text-amber-900"
                                : "text-slate-700"
                            }`}
                        >
                          {student.isLowPerformer
                            ? `Low Performer Classification (${student.restrictionCount} Total Restrictions)`
                            : `Restriction Log History (${student.restrictionCount}/2 Warnings)`}
                        </h4>
                      </div>

                      <p
                        className={`text-xs sm:text-sm leading-relaxed ${student.isLowPerformer
                            ? "text-rose-700"
                            : student.restrictionCount > 0
                              ? "text-amber-700"
                              : "text-slate-600"
                          }`}
                      >
                        {student.isLowPerformer
                          ? "This intern has accumulated 2 or more restrictions historically. Per academic supervision policies, they are classified as an Underperforming / Low Performer intern."
                          : student.restrictionCount > 0
                            ? `This intern has accumulated ${student.restrictionCount} restriction(s). Accumulating 2 restrictions triggers Low Performer status.`
                            : "Good standing. No logbook restrictions recorded for this intern."}
                      </p>

                      {Array.isArray(student.logbookRestrictionHistory) &&
                        student.logbookRestrictionHistory.length > 0 && (
                          <div className="mt-3.5 pt-3 border-t border-rose-200/60 space-y-2">
                            <span className="text-xs font-bold text-rose-900 block">
                              Restriction Log Breakdown:
                            </span>
                            {student.logbookRestrictionHistory.map((hist, idx) => (
                              <div
                                key={idx}
                                className="p-3 rounded-xl bg-white/90 border border-rose-200/80 text-xs space-y-1 text-slate-700"
                              >
                                <div className="flex items-center justify-between font-bold text-slate-900">
                                  <span>Restriction Event #{idx + 1}</span>
                                  <span>{hist.restrictedAt ? formatDateYMD(hist.restrictedAt) : "N/A"}</span>
                                </div>
                                <p className="text-slate-600">Reason: {hist.restrictionReason || "Consecutive missed daily log submissions"}</p>
                                {hist.liftedAt && (
                                  <p className="text-emerald-700 font-semibold">
                                    ✓ Lifted on {formatDateYMD(hist.liftedAt)} {hist.liftReason ? `(${hist.liftReason})` : ""}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                    </div>

                    {/* GitHub Project Commits Breakdown */}
                    {gitCommitsData?.projectCommits?.some((p) => p.commits?.length > 0) && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <GitCommit className="h-4 w-4 text-sky-600 shrink-0" />
                            <span>Repository Commit Log ({metrics.commitsCount ?? 0} total commits)</span>
                          </h4>
                          {gitCommitsData.githubUsername && (
                            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                              @{gitCommitsData.githubUsername}
                            </span>
                          )}
                        </div>

                        <div className="space-y-3">
                          {gitCommitsData.projectCommits.map((proj) => {
                            if (!proj.commits || proj.commits.length === 0) return null;
                            const isExpanded = expandedProjects[proj.projectId || proj.projectName];
                            const visibleCommits = isExpanded ? proj.commits : proj.commits.slice(0, 10);

                            return (
                              <div
                                key={proj.projectId || proj.projectName}
                                className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-slate-900">{proj.projectName}</span>
                                  <span className="text-xs font-mono font-bold bg-sky-50 text-sky-700 px-2.5 py-1 rounded-lg border border-sky-200">
                                    {proj.commits.length} commits
                                  </span>
                                </div>
                                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                                  {visibleCommits.map((c) => (
                                    <div
                                      key={c.sha || c.shortSha}
                                      className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors gap-2"
                                    >
                                      <div className="flex items-center gap-2.5 truncate min-w-0">
                                        <span className="font-mono text-[10px] font-bold text-sky-600 bg-sky-100/70 px-2 py-0.5 rounded shrink-0">
                                          {c.shortSha || c.sha?.slice(0, 7)}
                                        </span>
                                        <span className="truncate text-slate-800 font-medium text-xs">{c.message}</span>
                                      </div>
                                      <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                                        {formatDateYMD(c.date)}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {proj.commits.length > 10 && (
                                  <button
                                    onClick={() =>
                                      setExpandedProjects((prev) => ({
                                        ...prev,
                                        [proj.projectId || proj.projectName]: !isExpanded,
                                      }))
                                    }
                                    className="text-xs font-bold text-sky-600 hover:text-sky-700 pt-1 flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>{isExpanded ? "Show Less" : `View All ${proj.commits.length} Commits`}</span>
                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── TAB 5: SUPERVISOR GUIDANCE & COMMENTS ─── */}
                {activeTab === "feedback" && (
                  <div className="space-y-6">
                    {/* Add Guidance Comment Form */}
                    <form
                      onSubmit={handleAddFeedback}
                      className="p-4 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs space-y-4"
                    >
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Add Academic Supervisor Guidance & Feedback</span>
                      </h4>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-600">Evaluation Rating:</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setFeedbackRating(star)}
                              className="p-1.5 text-amber-400 hover:scale-125 transition-transform cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                              aria-label={`Rate ${star} star`}
                            >
                              <Star
                                className={`h-5 w-5 ${star <= feedbackRating ? "fill-amber-400 text-amber-400" : "text-slate-300"
                                  }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Enter your academic remarks, guidance notes, or evaluation feedback for this student..."
                        rows={4}
                        className="w-full p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs sm:text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 resize-none shadow-xs select-text cursor-text"
                        required
                      />

                      <div className="flex items-center justify-between flex-wrap gap-2">
                        {feedbackSuccess ? (
                          <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="h-4 w-4 shrink-0" /> Guidance feedback recorded successfully!
                          </span>
                        ) : <div />}

                        <button
                          type="submit"
                          disabled={submittingFeedback}
                          className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 hover:bg-emerald-700 text-white flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-sm ml-auto min-h-[40px]"
                        >
                          <Send className="h-4 w-4 shrink-0" />
                          <span>{submittingFeedback ? "Submitting..." : "Submit Guidance Comment"}</span>
                        </button>
                      </div>
                    </form>

                    {/* Historical Guidance Comments Feed */}
                    <div className="space-y-3.5">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Historical Supervisor Guidance Records ({feedbackList.length})
                      </h4>

                      {feedbackList.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-200">
                          No supervisor guidance comments recorded yet for this student.
                        </div>
                      ) : (
                        feedbackList.map((fb) => (
                          <div
                            key={fb._id}
                            className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 transition-all hover:border-slate-300"
                          >
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-xs overflow-hidden border border-slate-300 shrink-0">
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
                                <span className="text-sm font-bold text-slate-900">
                                  {fb.supervisorName}
                                </span>
                                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                  {fb.universityName}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-0.5 mr-1">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      className={`h-3.5 w-3.5 ${s <= (fb.rating || 5)
                                          ? "fill-amber-400 text-amber-400"
                                          : "text-slate-200"
                                        }`}
                                    />
                                  ))}
                                </div>

                                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditFeedback(fb)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all cursor-pointer shadow-2xs"
                                    title="Edit this guidance comment"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(fb._id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer shadow-2xs"
                                    title="Remove this guidance comment"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Delete confirmation banner */}
                            {deleteConfirmId === fb._id && (
                              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 flex-wrap animate-in fade-in duration-200">
                                <div className="flex items-center gap-2 text-xs font-semibold text-rose-800">
                                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                                  <span>Are you sure you want to remove this guidance comment?</span>
                                </div>
                                <div className="flex items-center gap-2 ml-auto">
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFeedback(fb._id)}
                                    disabled={deletingFeedbackId === fb._id}
                                    className="px-3 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {deletingFeedbackId === fb._id ? (
                                      <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <span>Removing...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Trash2 className="h-3 w-3" />
                                        <span>Yes, Remove</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Normal View or Edit View */}
                            {editingFeedbackId === fb._id ? (
                              <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in duration-200">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-600">Update Rating:</span>
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <button
                                        key={star}
                                        type="button"
                                        onClick={() => setEditFeedbackRating(star)}
                                        className="p-1 text-amber-400 hover:scale-125 transition-transform cursor-pointer"
                                      >
                                        <Star
                                          className={`h-4 w-4 ${
                                            star <= editFeedbackRating ? "fill-amber-400 text-amber-400" : "text-slate-300"
                                          }`}
                                        />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <textarea
                                  value={editFeedbackText}
                                  onChange={(e) => setEditFeedbackText(e.target.value)}
                                  rows={3}
                                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-1 focus:ring-blue-600 resize-none shadow-xs select-text cursor-text"
                                  placeholder="Edit remarks or guidance notes..."
                                  required
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={handleCancelEditFeedback}
                                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateFeedback(fb._id)}
                                    disabled={submittingEdit}
                                    className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    {submittingEdit ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        <span>Saving...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Check className="h-3.5 w-3.5" />
                                        <span>Save Changes</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/70 p-3 rounded-xl border border-slate-100 break-words">
                                  {fb.comment}
                                </p>
                                <span className="text-[11px] text-slate-400 block font-mono">
                                  {new Date(fb.createdAt).toLocaleString()}
                                </span>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </main>

      {/* ─── Footer ─── */}
      <footer
        className="text-white/80 py-4 mt-auto"
        style={{ background: "linear-gradient(135deg, #000066 0%, #006600 100%)" }}
      >
        <div className="px-4 sm:px-6 flex items-center justify-between gap-4">
          <p className="text-xs">© {new Date().getFullYear()} TalentHub . SLT Mobitel . All rights reserved.</p>
          <p className="text-xs text-white/60">TalentHub University Portal System</p>
        </div>
      </footer>
    </div>
  );
};

export default UniversityStudentDetails;




