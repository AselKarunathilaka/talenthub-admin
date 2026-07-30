import React, { useState, useEffect, useCallback } from "react";
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
  FaHome,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../api/adminApi";
import { API_BASE_URL } from "../api/apiConfig";
import logo from "../assets/sltlogo.jpg";
import AdminNavigation from "../components/AdminNavigation";

/* ── Brand colors (same as dashboard) ── */
const BRAND = {
  primary: "#0056a2",
  accent: "#00b4eb",
  success: "#50b748",
  primaryLight: "#e8f0fa",
  accentLight: "#e0f5fc",
  successLight: "#eaf7e9",
  dangerLight: "#fef2f2",
  danger: "#ef4444",
};

// ─── Helper: get all calendar days for a given month ───────────────────────
const getCalendarDays = (year, month) => {
  const days = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1; // Make Monday = 0
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++)
    days.push(new Date(year, month, d));
  return days;
};

const toDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Soft Pastel Backgrounds with High-Contrast Text for Daily Attendance
const getDailyMetaClasses = (dailyMap, date) => {
  if (!date) return null;
  const key = toDateKey(date);
  const entry = dailyMap[key];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isFuture = date > today;

  if (isFuture) return { classes: "bg-slate-50 text-slate-300 border-slate-100", label: "Future" };
  if (!entry) return { classes: "bg-white text-gray-500 border-gray-200", label: "No Record" };
  
  const st = (entry.status || "").toLowerCase();
  if (st === "present") return { classes: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "Present" };
  if (st === "absent") return { classes: "bg-rose-100 text-rose-800 border-rose-300", label: "Absent" };
  return { classes: "bg-white text-gray-500 border-gray-200", label: "No Record" };
};

// Soft Pastel Backgrounds with High-Contrast Text for Logbook Records
const getLogbookMetaClasses = (recordMap, date) => {
  if (!date) return null;
  const key = toDateKey(date);
  const rec = recordMap[key];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isFuture = date > today;
  
  if (isWeekend || isFuture) return { classes: "bg-slate-50 text-slate-400 border-slate-100", label: "Weekend / Future" };
  if (!rec) return { classes: "bg-orange-100 text-orange-800 border-orange-300", label: "Missed" }; // Made Missed Orange to differentiate from Absent Red
  
  const st = (rec.status || "").toLowerCase();
  if (st === "working") return { classes: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "Working" };
  if (st === "wfh") return { classes: "bg-violet-100 text-violet-800 border-violet-300", label: "WFH" };
  if (st === "leave") return { classes: "bg-amber-100 text-amber-800 border-amber-300", label: "On Leave" };
  return { classes: "bg-blue-100 text-blue-800 border-blue-300", label: "Submitted" }; // Made Submitted Blue to differentiate from Working Green
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
  IN_PROGRESS: { bg: "bg-blue-100", text: "text-blue-700", label: "In Progress" },
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

  const [logbookView, setLogbookView] = useState("calendar");
  const [logbookCalMonth, setLogbookCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [logbookModal, setLogbookModal] = useState(null);

  const [gitCommitsData, setGitCommitsData] = useState(null);
  const [gitCommitsLoading, setGitCommitsLoading] = useState(false);
  const [certAttendanceCount, setCertAttendanceCount] = useState(null);

  useEffect(() => {
    fetchInternDetails();
    fetchAttendance();
    fetchGitCommits();
    fetchCertAttendanceCount();
  }, [internId]);

  const fetchGitCommits = useCallback(async () => {
    if (gitCommitsData) return;
    try {
      setGitCommitsLoading(true);
      const data = await adminApi.getInternGitCommits(internId);
      setGitCommitsData(data);
    } catch (err) {
      console.error("Error fetching git commits:", err);
    } finally {
      setGitCommitsLoading(false);
    }
  }, [internId, gitCommitsData]);

  const fetchAttendance = useCallback(async () => {
    if (attendanceData) return;
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
  }, [internId, attendanceData]);

  const fetchCertAttendanceCount = useCallback(async () => {
    try {
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      if (!adminInfo.token) return;
      const res = await fetch(
        `${(await import("../api/apiConfig")).API_BASE_URL}/admin/intern/${internId}/certificate-data`,
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

  const fetchInternDetails = async () => {
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
      if (error.message.includes("403") || error.message.includes("401")) {
        localStorage.removeItem("adminInfo");
        navigate("/admin-login");
      }
    } finally {
      setLoading(false);
    }
  };

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
        <span className="admin-dash-badge admin-dash-badge--danger">
          <FaExclamationTriangle className="mr-1" /> Overdue
        </span>
      );
    } else if (statistics.totalRecords === 0) {
      return (
        <span className="admin-dash-badge admin-dash-badge--neutral">
          <FaTimesCircle className="mr-1" /> Inactive
        </span>
      );
    } else {
      return (
        <span className="admin-dash-badge admin-dash-badge--success">
          <FaCheckCircle className="mr-1" /> Active
        </span>
      );
    }
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <AdminNavigation>
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/60 via-slate-50 to-indigo-50/60 font-sans text-gray-800 flex items-center justify-center">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-t-4 border-b-4 border-[#00b4eb] rounded-full mx-auto mb-6"
            />
            <p className="text-gray-600 font-medium">Loading intern details...</p>
          </div>
        </div>
      </AdminNavigation>
    );
  }

  /* ── Error state ── */
  if (error || !internDetails) {
    return (
      <AdminNavigation>
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/60 via-slate-50 to-indigo-50/60 font-sans text-gray-800 flex items-center justify-center">
          <motion.div
            className="text-center max-w-md p-6 bg-white/80 backdrop-blur-3xl rounded-3xl border border-[#00b4eb]/20 shadow-[0_0_25px_rgba(0,180,235,0.15)]"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <FaExclamationTriangle
              style={{ fontSize: 40, color: BRAND.danger, marginBottom: 16 }}
              className="mx-auto"
            />
            <p style={{ color: BRAND.danger }} className="mb-6">
              {error || "Intern details not found"}
            </p>
            <div className="flex justify-center space-x-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={fetchInternDetails}
                className="px-4 py-2 bg-[#0056a2] text-white rounded-xl shadow-md hover:bg-[#004488] transition-colors"
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
      </AdminNavigation>
    );
  }

  const { intern, statistics } = internDetails;

  return (
    <AdminNavigation>
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/60 via-slate-50 to-indigo-50/60 font-sans text-gray-800 pb-10 flex flex-col">
        <div className="flex-1 w-full lg:mt-4 lg:px-6 xl:px-10">
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
            
            {/* ── Page header (No Back Button, just Title like Dashboard) ── */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
                >
                  <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl">
                    <FaUser className="text-[#0056a2] h-8 w-8" />
                  </div>
                  Intern Profile
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
                >
                  Detailed information and performance metrics
                </motion.p>
              </div>
              <div className="w-full sm:w-auto">
                {getStatusBadge(statistics)}
              </div>
            </div>

            {/* ── Tabs ── */}
            <div className="mb-6">
              <div className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-2xl p-1.5 border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] inline-flex flex-wrap gap-1">
                {["overview", "records", "attendance"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      if (tab === "attendance") fetchAttendance();
                    }}
                    className={`px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab
                        ? "bg-white text-[#0056a2] shadow-sm md:bg-[#0056a2] md:text-white"
                        : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tab content ── */}
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
                  <div className="space-y-6">
                    {/* Profile card */}
                    <motion.div
                      className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-3xl border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] relative mb-6 overflow-hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                    >
                      <div className="h-24 sm:h-32 bg-gradient-to-r from-[#0056a2] via-[#0078c2] to-[#00b4eb] w-full relative overflow-hidden">
                        <div className="absolute inset-0 bg-[linear-gradient(40deg,transparent_20%,rgba(255,255,255,0.1)_50%,transparent_80%)]"></div>
                      </div>

                      <div className="px-5 sm:px-8 pb-6 sm:pb-8 relative">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 sm:-mt-12 mb-4">
                          <div className="relative inline-block z-10">
                            <div className="h-20 w-20 sm:h-24 sm:w-24 bg-white p-1 rounded-2xl shadow-md border border-gray-100">
                              <div className="h-full w-full bg-slate-100 rounded-xl flex items-center justify-center border border-gray-200 overflow-hidden relative">
                                <img
                                  src={`${API_BASE_URL}/interns/${intern._id}/profile-picture`}
                                  alt={intern.traineeName}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                    if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                                  }}
                                />
                                <div style={{ display: "none", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
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

                          <div className="flex gap-2 sm:gap-3 sm:mb-2">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => window.open(`mailto:${intern.email}`, "_blank")}
                              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-white text-slate-700 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
                            >
                              <FaEnvelope className="mr-2 text-slate-400" /> Contact
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => navigate(`/admin/intern/${internId}/certificate`)}
                              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-[#0056a2] text-white rounded-xl text-sm font-medium hover:bg-[#004488] transition-colors shadow-sm border border-[#0056a2]"
                            >
                              <FaCertificate className="mr-2 text-amber-400" /> Certificate
                            </motion.button>
                          </div>
                        </div>

                        <div className="mb-6">
                          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{intern.traineeName}</h3>
                          <p className="text-sm font-medium text-slate-500 mt-0.5">
                            Trainee ID: <span className="text-slate-700">{intern.traineeId}</span>
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5 border-t border-gray-100">
                          <div>
                            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Email</p>
                            <div className="flex items-center text-sm font-medium text-slate-800">
                              <FaEnvelope className="mr-2 text-slate-400" />
                              <span className="truncate">{intern.email}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Specialization</p>
                            <div className="flex items-center text-sm font-medium text-slate-800">
                              <FaBuilding className="mr-2 text-slate-400" />
                              <span className="truncate">{intern.fieldOfSpecialization || "Not specified"}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Start Date</p>
                            <div className="flex items-center text-sm font-medium text-slate-800">
                              <FaCalendarAlt className="mr-2 text-slate-400" />
                              {intern.startDate ? formatDate(intern.startDate) : "N/A"}
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">End Date</p>
                            <div className="flex items-center text-sm font-medium text-slate-800">
                              <FaCalendarCheck className="mr-2 text-slate-400" />
                              {intern.endDate ? formatDate(intern.endDate) : "N/A"}
                            </div>
                          </div>

                          {attendanceData && intern.startDate && (() => {
                            let present = 0;
                            if (attendanceData.meetingAttendance && Array.isArray(attendanceData.meetingAttendance)) {
                              const weeks = new Set();
                              attendanceData.meetingAttendance.forEach((entry) => {
                                if (entry.status === "Present" && entry.date) {
                                  const d = new Date(entry.date);
                                  if (!isNaN(d.getTime())) {
                                    const day = d.getDay();
                                    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                                    const monday = new Date(new Date(d).setDate(diff));
                                    weeks.add(`${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`);
                                  }
                                }
                              });
                              present = weeks.size;
                            } else {
                              present = attendanceData?.stats?.present ?? 0;
                            }
                            const start = new Date(intern.startDate);
                            const now = new Date();
                            if (isNaN(start) || now <= start) return null;
                            const weeksHeld = Math.max(1, Math.ceil((now - start) / (1000 * 60 * 60 * 24 * 7)));
                            const pct = Math.min(100, Math.round((present / weeksHeld) * 100));
                            const color = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
                            const textColor = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-500" : "text-red-500";
                            return (
                              <div className="sm:col-span-2 lg:col-span-4 pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                                    <FaChartPie className="text-slate-400" /> Meeting Attendance Rate
                                  </p>
                                  <span className={`text-sm font-black ${textColor}`}>{pct}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="h-2 rounded-full transition-all duration-700"
                                    style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
                                  />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  {present} weeks attended out of {weeksHeld} weeks so far
                                </p>
                              </div>
                            );
                          })()}
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
                        { label: "Total Records", value: statistics.totalRecords, icon: FaFileAlt, width: Math.min(100, statistics.totalRecords), accent: BRAND.primary, bg: BRAND.primaryLight },
                        { label: "This Week", value: statistics.weeklyRecords, icon: FaTasks, width: Math.min(100, statistics.weeklyRecords * 20), accent: BRAND.accent, bg: BRAND.accentLight },
                        { label: "This Month", value: statistics.monthlyRecords, icon: FaRegCalendarCheck, width: Math.min(100, statistics.monthlyRecords * 10), accent: BRAND.success, bg: BRAND.successLight },
                        { label: "Days Since Last", value: statistics.daysSinceLastSubmission !== null ? statistics.daysSinceLastSubmission : "Never", icon: FaClock, width: statistics.daysSinceLastSubmission ? Math.max(5, 100 - statistics.daysSinceLastSubmission * 5) : 0, accent: BRAND.danger, bg: BRAND.dangerLight },
                      ].map(({ label, value, icon: Icon, width, accent, bg }) => (
                        <motion.div
                          key={label}
                          className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl p-4 sm:p-5 rounded-2xl border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] hover:shadow-[0_0_25px_rgba(0,180,235,0.25)] hover:border-[#00b4eb]/60 relative overflow-hidden transition-all duration-300"
                          whileHover={{ scale: 1.02 }}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">{label}</p>
                              <p className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: accent }}>{value}</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                              <Icon className="h-5 w-5" style={{ color: accent }} />
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-1.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${width}%`, background: accent }} />
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>

                    {/* Current Projects */}
                    <motion.div
                      className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-2xl border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] p-4 sm:p-6 mt-4 sm:mt-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.9, duration: 0.3 }}
                    >
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center mb-4">
                        <FaLayerGroup className="mr-2 text-indigo-500" /> Current Projects
                        <span className="ml-auto text-xs font-normal text-gray-400">Synced from TalentTrail</span>
                      </h3>
                      {intern.projects && intern.projects.length > 0 ? (
                        <div className="space-y-3">
                          {intern.projects.map((proj, pi) => {
                            const style = PROJECT_STATUS_STYLE[proj.status] || { bg: "bg-gray-100", text: "text-gray-600", label: proj.status || "Unknown" };
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
                                    <span className="font-semibold text-gray-900 text-sm">{proj.projectName}</span>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>{style.label}</span>
                                  </div>
                                  <div className="flex gap-3 text-xs text-gray-500">
                                    {proj.startDate && <span>Start: {new Date(proj.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                                    {proj.targetDate && <span>Target: {new Date(proj.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                                  </div>
                                </div>
                                {proj.description && <p className="text-xs text-gray-500 mb-2 leading-relaxed">{proj.description}</p>}
                                <div className="flex flex-wrap gap-4 text-xs text-gray-500 border-t border-gray-50 pt-2 mt-2">
                                  {proj.projectManagerName && (
                                    <span className="flex items-center gap-1">
                                      <FaUserCheck className="text-gray-400" /> PM: <span className="font-medium text-gray-700">{proj.projectManagerName}</span>
                                    </span>
                                  )}
                                  {proj.supervisorName && (
                                    <span className="flex items-center gap-1">
                                      <FaUser className="text-gray-400" /> Supervisor: <span className="font-medium text-gray-700">{proj.supervisorName}</span>
                                    </span>
                                  )}
                                  {proj.teams && proj.teams.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <FaTeam className="text-gray-400" /> Teams: {proj.teams.map((t) => t.teamName).join(", ")}
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
                          <p className="text-sm">No project assignments synced from TalentTrail</p>
                        </div>
                      )}
                    </motion.div>

                    {/* Recent records preview */}
                    {recentRecords.length > 0 && (
                      <motion.div
                        className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-2xl border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] p-4 sm:p-6 mt-4 sm:mt-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 0.3 }}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                            <FaHistory className="mr-2 text-cyan-500" /> Recent Activity
                          </h3>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate(`/admin/intern/${internId}/records`)}
                            className="text-xs sm:text-sm text-[#0056a2] hover:text-[#0078c2] flex items-center font-semibold"
                          >
                            View All Records <FaArrowLeft className="ml-1 rotate-180" />
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
                                  <p className="text-sm font-medium text-gray-900 truncate">{record.taskDescription || record.task || "N/A"}</p>
                                  <p className="text-xs text-gray-500 mt-1">{formatDate(record.createdAt)}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{record.stack || "N/A"}</span>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => navigate(`/admin/intern/${internId}/records`)}
                                  className="flex items-center text-[#0056a2] hover:bg-cyan-50 px-2 py-1 rounded-xl text-xs shadow-sm"
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
                                {["Date", "Task", "Stack", "Actions"].map((h) => (
                                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                                ))}
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
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatDate(record.createdAt)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    <div className="max-w-xs truncate">{record.taskDescription || record.task || "N/A"}</div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{record.stack || "N/A"}</span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    <motion.button
                                      onClick={() => navigate(`/admin/intern/${internId}/records`)}
                                      className="flex items-center text-[#0056a2] hover:bg-cyan-50 px-3 py-1 rounded-xl shadow-sm"
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
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00b4eb]"></div>
                      </div>
                    ) : gitCommitsData?.projectCommits?.length > 0 ? (
                      <motion.div
                        className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-2xl border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] p-4 sm:p-6 mt-4 sm:mt-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.0, duration: 0.3 }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                            <FaCodeBranch className="mr-2 text-green-500" /> GitHub Commits
                          </h3>
                          <span className="text-xs text-gray-400">{gitCommitsData.totalCommits} total commit{gitCommitsData.totalCommits !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="space-y-6">
                          {gitCommitsData.projectCommits.map((proj) => (
                            <div key={proj.projectId} className="relative font-mono text-xs bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                              <h4 className="font-semibold text-gray-800 mb-3 text-sm">{proj.projectName}</h4>
                              {proj.error ? (
                                <p className="text-gray-400 italic">Unable to fetch commits: {proj.error.replace(/_/g, " ")}</p>
                              ) : proj.commits.length === 0 ? (
                                <p className="text-gray-400 italic">No commits found for this intern.</p>
                              ) : (
                                <div className="relative">
                                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-green-400 via-blue-400 to-purple-400 rounded-full" />
                                  <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                                    {proj.commits.slice(0, 15).map((c) => {
                                      const prefix = getGithubCommitPrefix(c.message);
                                      const cc = COMMIT_COLORS[prefix];
                                      const msgParts = c.message.split(":");
                                      const msgType = msgParts.length > 1 ? msgParts[0] + ":" : "";
                                      const msgBody = msgParts.length > 1 ? msgParts.slice(1).join(":") : c.message;
                                      const dateStr = new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                                      return (
                                        <div key={c.sha} className="flex items-start gap-3 pl-1">
                                          <div className={`relative z-10 w-[14px] h-[14px] rounded-full border-2 border-white flex-shrink-0 mt-0.5 shadow-sm ${cc.dot}`} />
                                          <div className="flex-1 min-w-0 bg-white p-2 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition">
                                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                              {msgType && (
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${cc.bg} ${cc.text}`}>{msgType.replace(":", "")}</span>
                                              )}
                                              <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-gray-800 font-medium hover:text-blue-600 truncate flex-1">{msgBody.trim()}</a>
                                            </div>
                                            <div className="flex items-center gap-3 text-gray-400 mt-1.5">
                                              <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-green-600 font-bold hover:underline">{c.shortSha}</a>
                                              <span className="flex items-center gap-1">
                                                {c.authorAvatar && <img src={c.authorAvatar} alt="" className="w-3 h-3 rounded-full" />}
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
                                    <p className="text-center text-xs text-gray-400 mt-3 pt-3 border-t border-gray-200">+ {proj.commits.length - 15} more commits in this repository</p>
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
                {activeTab === "attendance" && (() => {
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
                  const monthLabel = calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

                  const monthDailyKeys = Object.keys(dailyMap).filter((k) => {
                    const [y, m] = k.split("-").map(Number);
                    return y === year && m === month + 1;
                  });
                  const mDailyPresent = monthDailyKeys.filter((k) => (dailyMap[k]?.status || "").toLowerCase() === "present").length;
                  const mMeetingPresent = Object.values(meetingMap)
                    .flat()
                    .filter((e) => {
                      const d = new Date(e.date);
                      return d.getFullYear() === year && d.getMonth() === month && (e.status || "").toLowerCase() === "present";
                    }).length;

                  const allDailyPresent = (attendanceData?.dailyAttendance || []).filter((e) => (e.status || "").toLowerCase() === "present").length;
                  const allMeetingPresent = (attendanceData?.meetingAttendance || []).filter((e) => (e.status || "").toLowerCase() === "present").length;
                  const allMeetingTotal = (attendanceData?.meetingAttendance || []).length;
                  const allDailyTotal = (attendanceData?.dailyAttendance || []).length;

                  const allActivities = [
                    ...(attendanceData?.dailyAttendance || []).map((e) => ({ ...e, type: "daily", rawType: e.rawType || e.type || "daily", attendanceTypeLabel: e.attendanceTypeLabel || null })),
                    ...(attendanceData?.meetingAttendance || []).map((e) => ({ ...e, type: "meeting", rawType: e.rawType || e.type || "meeting", attendanceTypeLabel: e.attendanceTypeLabel || null })),
                  ]
                    .filter((e) => {
                      const d = new Date(e.date);
                      return d.getFullYear() === year && d.getMonth() === month;
                    })
                    .sort((a, b) => new Date(b.date) - new Date(a.date));

                  return (
                    <div className="space-y-5">
                      {/* Intern Details Card */}
                      <motion.div
                        className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-3xl border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] overflow-hidden"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="bg-gradient-to-r from-[#e8f0fa] via-[#f0f9ff] to-[#e0f5fc] p-5 sm:p-6 border-b border-gray-100">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{intern.traineeName}</h3>
                              <p className="text-sm text-gray-500 mt-0.5">{intern.traineeId}</p>
                              {intern.startDate && intern.endDate && (() => {
                                const daysLeft = Math.ceil((new Date(intern.endDate) - new Date()) / (1000 * 60 * 60 * 24));
                                return daysLeft > 0 ? (
                                  <span className="inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 shadow-sm">{daysLeft} DAYS REMAINING</span>
                                ) : (
                                  <span className="inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-red-500 to-red-600 shadow-sm">TRAINING ENDED</span>
                                );
                              })()}
                            </div>
                            {intern.lastSeen && (
                              <span className="text-xs text-gray-400 bg-white/70 px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                                Last seen: {new Date(intern.lastSeen).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {new Date(intern.lastSeen).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-6">
                          <div className="bg-white/80 rounded-xl border border-gray-200 p-4 shadow-sm h-full">
                            <h4 className="text-sm font-bold text-gray-900 mb-3">Personal Information</h4>
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs text-gray-400">Email:</p>
                                <p className="text-sm font-medium text-gray-800 break-all">{intern.email || "Not specified"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Institute:</p>
                                <p className="text-sm font-medium text-gray-800">{intern.institute || "Not specified"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Specialization:</p>
                                <p className="text-sm font-medium text-gray-800">{intern.fieldOfSpecialization || "Not specified"}</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="bg-white/80 rounded-xl border border-gray-200 p-4 shadow-sm">
                              <h4 className="text-sm font-bold text-gray-900 mb-3">Training Period</h4>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs text-gray-400">Start Date:</p>
                                  <p className="text-sm font-semibold text-gray-800">{intern.startDate ? formatDate(intern.startDate) : "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400">End Date:</p>
                                  <p className="text-sm font-semibold text-gray-800">{intern.endDate ? formatDate(intern.endDate) : "N/A"}</p>
                                </div>
                                {intern.startDate && intern.endDate && (() => {
                                  const start = new Date(intern.startDate);
                                  const end = new Date(intern.endDate);
                                  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                                  const weeks = Math.floor(totalDays / 7);
                                  const remainingDays = totalDays % 7;
                                  const daysLeft = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
                                  return (
                                    <>
                                      <div>
                                        <p className="text-xs text-gray-400">Duration:</p>
                                        <p className="text-sm font-semibold text-gray-800">{weeks} weeks, {remainingDays} days</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-400">Status:</p>
                                        <p className={`text-sm font-semibold ${daysLeft > 0 ? "text-green-600" : "text-red-600"}`}>
                                          {daysLeft > 0 ? `${daysLeft} days remaining` : "Training ended"}
                                        </p>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>

                            <div className="bg-white/80 rounded-xl border border-gray-200 p-4 shadow-sm">
                              <h4 className="text-sm font-bold text-gray-900 mb-3">Project Assignments</h4>
                              {intern.projects && intern.projects.length > 0 ? (
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                  {intern.projects.map((proj, pi) => (
                                    <div key={pi} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                                        <FaProjectDiagram className="text-white text-xs" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-800 truncate">{proj.projectName}</p>
                                        <p className="text-xs text-gray-400">Status: {proj.status || "N/A"}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400 italic">No projects assigned</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-3xl border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] p-5 sm:p-7"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                      >
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                          <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center">
                            <FaCalendarCheck className="mr-3 text-slate-400" /> Attendance Calendar
                          </h3>
                        </div>

                        {attendanceLoading && (
                          <div className="flex justify-center items-center py-16">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-8 h-8 border-t-2 border-b-2 border-[#00b4eb] rounded-full"
                            />
                          </div>
                        )}
                        {attendanceError && !attendanceLoading && (
                          <div className="text-center py-12 text-red-500 text-sm font-medium">{attendanceError}</div>
                        )}

                        {!attendanceLoading && !attendanceError && (
                          <div>
                            {/* All-time stat cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                              {[
                                { count: allDailyPresent, label: "Daily Present", icon: FaCalendarCheck, accentColor: "text-emerald-600" },
                                { count: allDailyTotal - allDailyPresent, label: "Daily Absent", icon: FaTimesCircle, accentColor: "text-rose-600" },
                                { count: allMeetingPresent, label: "Meetings Attended", icon: FaVideo, accentColor: "text-blue-600" },
                                { count: allMeetingTotal - allMeetingPresent, label: "Meetings Missed", icon: FaTimes, accentColor: "text-amber-600" },
                              ].map(({ count, label, icon: Icon, accentColor }) => (
                                <div key={label} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col shadow-sm relative overflow-hidden">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                      <Icon className={`text-lg ${accentColor}`} />
                                    </div>
                                  </div>
                                  <div className="mt-2">
                                    <p className={`text-2xl font-bold tracking-tight ${accentColor}`}>{count}</p>
                                    <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mt-1">{label}</p>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Month nav + mini stats */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                >
                                  <FaChevronLeft className="h-3 w-3" />
                                </button>
                                <span className="text-sm font-semibold text-gray-800 min-w-[130px] text-center">{monthLabel}</span>
                                <button
                                  onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
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

                            {/* ── SOFT PASTEL CALENDAR GRID ── */}
                            <div className="max-w-2xl mx-auto">
                              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                                  <div key={d} className="text-center text-[10px] sm:text-xs font-bold text-gray-500 pb-2 uppercase tracking-wider">
                                    {d}
                                  </div>
                                ))}
                                {calDays.map((day, di) => {
                                  if (!day) return <div key={`empty-${di}`} className="aspect-square" />;
                                  
                                  const meta = getDailyMetaClasses(dailyMap, day);
                                  const isToday = day.toDateString() === new Date().toDateString();
                                  const dayKey = toDateKey(day);
                                  const meetingsOnDay = meetingMap[dayKey] || [];
                                  const hasMeetingPresent = meetingsOnDay.some((e) => (e.status || "").toLowerCase() === "present");
                                  const hasMeetingMissed = meetingsOnDay.some((e) => (e.status || "").toLowerCase() !== "present");
                                  const hasMeeting = meetingsOnDay.length > 0;

                                  const tooltipLines = [
                                    day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
                                    `Daily: ${meta?.label ?? "No Record"}`,
                                  ];
                                  if (dailyMap[dayKey]?.time) tooltipLines.push(`Time: ${dailyMap[dayKey].time}`);
                                  if (hasMeeting) {
                                    meetingsOnDay.forEach((m) => tooltipLines.push(`Meeting: ${m.meetingName || "Meeting"} — ${m.status || "Unknown"}`));
                                  }

                                  return (
                                    <div key={di} className="group relative aspect-square">
                                      <div
                                        className={`w-full h-full rounded-lg flex flex-col items-center justify-center border transition-all duration-200 hover:shadow-md cursor-default ${meta.classes} ${isToday ? 'ring-2 ring-[#00b4eb] ring-offset-2 ring-offset-white' : ''}`}
                                      >
                                        <span className="text-[11px] sm:text-sm font-extrabold">
                                          {day.getDate()}
                                        </span>
                                        <div className="flex gap-0.5 mt-0.5 h-1.5">
                                          {hasMeetingPresent && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shadow-sm" />}
                                          {hasMeetingMissed && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-sm" />}
                                        </div>
                                      </div>
                                      {/* Hover Tooltip */}
                                      <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[220px] p-2.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-xl whitespace-pre-line">
                                        {tooltipLines.join("\n")}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-100 max-w-2xl mx-auto">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Legend</p>
                              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-600">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-4 h-4 rounded-md inline-block bg-emerald-100 border border-emerald-300"></span> Present
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="w-4 h-4 rounded-md inline-block bg-rose-100 border border-rose-300"></span> Absent
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-full inline-block bg-blue-600 shadow-sm ring-1 ring-blue-300"></span> Meeting Attended
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-full inline-block bg-orange-500 shadow-sm ring-1 ring-orange-200"></span> Meeting Missed
                                </span>
                              </div>
                            </div>

                            {/* Activity List */}
                            <div className="mt-6 max-w-2xl mx-auto">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">All Activity — {monthLabel}</h4>
                              {allActivities.length > 0 ? (
                                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                  {allActivities.map((entry, idx) => {
                                    const rawDateStr = String(entry.date || "");
                                    let d;
                                    if (rawDateStr.includes("-")) {
                                      const parts = rawDateStr.slice(0, 10).split("-").map(Number);
                                      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
                                        d = new Date(parts[0], parts[1] - 1, parts[2]);
                                      } else {
                                        d = new Date(entry.date);
                                      }
                                    } else {
                                      d = new Date(entry.date);
                                    }
                                    const isPresent = (entry.status || "").toLowerCase() === "present";
                                    const typeLabel = entry.attendanceTypeLabel || (entry.type === "daily" ? (entry.rawType === "face" || entry.attendanceMethod === "face recognition" ? "Face Attendance" : entry.rawType === "daily_qr" || entry.attendanceMethod === "qr" ? "QR Attendance" : entry.rawType === "manual_daily" ? "Manual Daily" : "Logbook Attendance") : entry.rawType === "face_meeting" ? "Face Meeting" : entry.rawType === "qr" ? "QR Meeting" : "Meeting Attendance");

                                    const timeStr = entry.time || (entry.attendanceTime ? new Date(entry.attendanceTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : null);
                                    const checkOutStr = entry.checkOutTime || null;
                                    const timeDetails = timeStr ? (checkOutStr ? `In: ${timeStr} • Out: ${checkOutStr}` : `In: ${timeStr}`) : null;

                                    return (
                                      <div key={idx} className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl px-3 py-2.5 text-sm">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${entry.type === "daily" ? (isPresent ? "bg-green-500" : "bg-red-400") : isPresent ? "bg-blue-500" : "bg-orange-400"}`} />
                                          <div className="min-w-0">
                                            <p className="font-medium text-gray-800 text-xs sm:text-sm">{d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-xs text-gray-500">
                                              <span className="font-medium text-gray-600 truncate">{entry.type === "meeting" && entry.meetingName ? `${entry.meetingName} (${typeLabel})` : typeLabel}</span>
                                              {timeDetails && <span className="text-gray-400 font-mono">{timeDetails}</span>}
                                            </div>
                                          </div>
                                        </div>
                                        <span className={`text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1.5 ${entry.type === "daily" ? (isPresent ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-50 text-red-500 border border-red-200") : isPresent ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-orange-100 text-orange-600 border border-orange-200"}`}>
                                          <span>{entry.type === "daily" ? "📅" : "📹"}</span>
                                          <span>{typeLabel}</span>
                                          <span className="opacity-40">•</span>
                                          <span>{entry.status || "No Record"}</span>
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-center text-gray-400 text-xs py-6">No attendance records for {monthLabel}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  );
                })()}

                {/* ══ RECORDS ══ */}
                {activeTab === "records" && (() => {
                  const recordMap = {};
                  (internDetails.records || []).forEach((rec) => {
                    const d = new Date(rec.createdAt || rec.date);
                    if (!isNaN(d.getTime())) recordMap[toDateKey(d)] = rec;
                  });

                  const totalRecords = internDetails.records?.length || 0;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const firstRecordDate = totalRecords > 0 ? new Date(internDetails.records[internDetails.records.length - 1].createdAt) : today;
                  let totalWeekdays = 0;
                  for (let d = new Date(firstRecordDate); d <= today; d.setDate(d.getDate() + 1)) {
                    if (d.getDay() !== 0 && d.getDay() !== 6) totalWeekdays++;
                  }
                  const missedDays = Math.max(0, totalWeekdays - totalRecords);

                  const lbYear = logbookCalMonth.getFullYear();
                  const lbMonth = logbookCalMonth.getMonth();
                  const lbCalDays = getCalendarDays(lbYear, lbMonth);
                  const lbMonthLabel = logbookCalMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

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
                                  <h3 className="text-lg font-bold text-gray-900">Logbook Entry</h3>
                                  <p className="text-xs text-gray-500">
                                    {new Date(logbookModal.createdAt || logbookModal.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                                  </p>
                                </div>
                                <button onClick={() => setLogbookModal(null)} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
                                  <FaTimes />
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2 mb-4">
                                {logbookModal.stack && <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{logbookModal.stack}</span>}
                                {logbookModal.status && <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold capitalize">{logbookModal.status}</span>}
                              </div>
                              <div className="space-y-4">
                                {logbookModal.task && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center">
                                      <FaCheckCircle className="text-blue-500 mr-1.5" /> Tasks Completed
                                    </p>
                                    <p className="text-sm text-gray-800 leading-relaxed bg-gray-50 rounded-xl p-3">{logbookModal.task}</p>
                                  </div>
                                )}
                                {logbookModal.progress && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center">
                                      <FaChartLine className="text-emerald-500 mr-1.5" /> Progress
                                    </p>
                                    <p className="text-sm text-gray-800 leading-relaxed bg-gray-50 rounded-xl p-3">{logbookModal.progress}</p>
                                  </div>
                                )}
                                {logbookModal.blockers && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center">
                                      <FaExclamationTriangle className="text-amber-500 mr-1.5" /> Challenges / Blockers
                                    </p>
                                    <p className="text-sm text-gray-800 leading-relaxed bg-amber-50 rounded-xl p-3">{logbookModal.blockers}</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-2xl border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                            <FaFileAlt className="mr-2 text-blue-500" /> Record History
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex rounded-xl overflow-hidden bg-gray-100 p-1 border border-gray-200/60">
                              <button
                                onClick={() => setLogbookView("calendar")}
                                className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all rounded-lg ${logbookView === "calendar" ? "bg-white text-[#0056a2] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                              >
                                <FaCalendarAlt /> Calendar View
                              </button>
                              <button
                                onClick={() => setLogbookView("list")}
                                className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all rounded-lg ${logbookView === "list" ? "bg-white text-[#0056a2] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                              >
                                <FaClipboardList /> List View
                              </button>
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => navigate(`/admin/intern/${internId}/records`)}
                              className="flex items-center px-4 py-2 bg-[#0056a2] text-white rounded-xl text-xs sm:text-sm font-medium shadow-sm hover:bg-[#004488] hover:shadow transition-all"
                            >
                              <FaFileAlt className="mr-2" /> View Full Records
                            </motion.button>
                          </div>
                        </div>

                        {logbookView === "calendar" && (
                          <div>
                            <div className="grid grid-cols-3 gap-3 mb-6 max-w-2xl mx-auto">
                              {[
                                { value: totalWeekdays, label: "Working Days", color: "text-slate-900" },
                                { value: totalRecords, label: "Logs Submitted", color: "text-emerald-600" },
                                { value: missedDays, label: "Logs Missed", color: "text-rose-600" },
                              ].map(({ value, label, color }) => (
                                <div key={label} className="bg-white/80 border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
                                  <p className={`text-2xl sm:text-3xl font-bold tracking-tight mb-1 ${color}`}>{value}</p>
                                  <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500">{label}</p>
                                </div>
                              ))}
                            </div>

                            <div className="flex items-center justify-between mb-6 max-w-2xl mx-auto">
                              <button
                                onClick={() => setLogbookCalMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                              >
                                <FaChevronLeft className="h-3 w-3" />
                              </button>
                              <span className="text-sm font-semibold text-gray-800">{lbMonthLabel}</span>
                              <button
                                onClick={() => setLogbookCalMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                              >
                                <FaChevronRight className="h-3 w-3" />
                              </button>
                            </div>

                            {/* ── SOFT PASTEL LOGBOOK CALENDAR GRID ── */}
                            <div className="max-w-2xl mx-auto">
                              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                                  <div key={d} className="text-center text-[10px] sm:text-xs font-bold text-gray-500 pb-2 uppercase tracking-wider">
                                    {d}
                                  </div>
                                ))}
                                {lbCalDays.map((day, di) => {
                                  if (!day) return <div key={`empty-${di}`} className="aspect-square" />;
                                  
                                  const meta = getLogbookMetaClasses(recordMap, day);
                                  const isToday = day.toDateString() === new Date().toDateString();
                                  const dayKey = toDateKey(day);
                                  const rec = recordMap[dayKey];
                                  const isClickable = rec != null;

                                  const tooltipContent = rec 
                                    ? `${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}\nStatus: ${meta.label}\n${rec.taskDescription || rec.task || "No task description"}`
                                    : `${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}\nStatus: ${meta.label}`;

                                  return (
                                    <div key={di} className="group relative aspect-square">
                                      <div
                                        className={`w-full h-full rounded-lg flex items-center justify-center border transition-all duration-200 ${isClickable ? "cursor-pointer hover:shadow-md hover:scale-105" : "cursor-default"} ${meta.classes} ${isToday ? 'ring-2 ring-[#00b4eb] ring-offset-2 ring-offset-white' : ''}`}
                                        onClick={() => isClickable && setLogbookModal(rec)}
                                      >
                                        <span className="text-[11px] sm:text-sm font-extrabold">
                                          {day.getDate()}
                                        </span>
                                      </div>
                                      {/* Hover Tooltip */}
                                      <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[220px] p-2.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-xl whitespace-pre-line">
                                        {tooltipContent}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-100 max-w-2xl mx-auto">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Legend — Click any colored day to inspect the logbook
                              </p>
                              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600">
                                {[
                                  { color: "bg-emerald-100 border-emerald-300", label: "Working" },
                                  { color: "bg-blue-100 border-blue-300", label: "Submitted" },
                                  { color: "bg-violet-100 border-violet-300", label: "WFH" },
                                  { color: "bg-amber-100 border-amber-300", label: "On Leave" },
                                  { color: "bg-orange-100 border-orange-300", label: "Missed" },
                                  { color: "bg-slate-50 border-slate-100", label: "Weekend / Future" },
                                ].map(({ color, label }) => (
                                  <span key={label} className="flex items-center gap-1.5">
                                    <span className={`w-4 h-4 rounded-md inline-block border ${color}`}></span> {label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {logbookView === "list" && (internDetails.records && internDetails.records.length > 0 ? (
                          <>
                            <div className="block sm:hidden space-y-3 max-h-[400px] overflow-y-auto">
                              {internDetails.records.map((record, index) => (
                                <motion.div
                                  key={index}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.02 * index }}
                                  className="bg-gray-50 rounded-xl p-3 border border-gray-200"
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-900">{record.taskDescription || record.task || "N/A"}</p>
                                      <p className="text-xs text-gray-500 mt-1">{formatDate(record.createdAt)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{record.stack || "N/A"}</span>
                                    <motion.button
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => setLogbookModal(record)}
                                      className="flex items-center text-[#0056a2] hover:bg-cyan-50 px-2 py-1 rounded-xl text-xs shadow-sm"
                                    >
                                      <FaEye className="mr-1 h-3 w-3" /> View
                                    </motion.button>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                            <div className="hidden sm:block overflow-x-auto max-h-[500px]">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                  <tr>
                                    {["Date", "Task", "Stack", "Actions"].map((h) => (
                                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {internDetails.records.map((record, index) => (
                                    <motion.tr
                                      key={index}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: 0.02 * index }}
                                      className="hover:bg-gray-50"
                                    >
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatDate(record.createdAt)}</td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                        <div className="max-w-xs truncate">{record.taskDescription || record.task || "N/A"}</div>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{record.stack || "N/A"}</span>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                        <motion.button
                                          onClick={() => setLogbookModal(record)}
                                          className="flex items-center text-[#0056a2] hover:bg-cyan-50 px-3 py-1 rounded-xl shadow-sm"
                                          whileHover={{ scale: 1.05 }}
                                          whileTap={{ scale: 0.95 }}
                                        >
                                          <FaEye className="mr-2" /> Inspect
                                        </motion.button>
                                      </td>
                                    </motion.tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : (
                          <div className="h-32 sm:h-48 flex items-center justify-center">
                            <p className="text-gray-500 text-xs sm:text-sm text-center">No records found for this intern.</p>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </AdminNavigation>
  );
};

export default AdminInternDetails;