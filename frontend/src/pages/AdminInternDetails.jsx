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
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../api/adminApi";
import { API_BASE_URL } from "../api/apiConfig";
import logo from "../assets/sltlogo.jpg";

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

const getDailyMeta = (dailyMap, date) => {
  if (!date) return null;
  const key = toDateKey(date);
  const entry = dailyMap[key];
  if (!entry) return { color: "#e5e7eb", label: "No Record" };
  const st = (entry.status || "").toLowerCase();
  if (st === "present") return { color: "#22c55e", label: "Present" };
  if (st === "absent") return { color: "#f87171", label: "Absent" };
  return { color: "#e5e7eb", label: "No Record" };
};

const getLogbookMeta = (recordMap, date) => {
  if (!date) return null;
  const key = toDateKey(date);
  const rec = recordMap[key];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isFuture = date > today;
  if (isWeekend || isFuture)
    return {
      color: "#f3f4f6",
      label: "Weekend / Future",
      textColor: "#9ca3af",
    };
  if (!rec) return { color: "#fecaca", label: "Missed", textColor: "#dc2626" };
  const st = (rec.status || "").toLowerCase();
  if (st === "working")
    return { color: "#bbf7d0", label: "Working", textColor: "#166534" };
  if (st === "wfh")
    return { color: "#ddd6fe", label: "WFH", textColor: "#5b21b6" };
  if (st === "leave")
    return { color: "#fde68a", label: "On Leave", textColor: "#92400e" };
  return { color: "#bbf7d0", label: "Submitted", textColor: "#166534" };
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

  // Fetch the same certificate-data endpoint used by the certificate page
  // so the attendance count matches what the certificate shows (TalentTrail-enriched)
  const fetchCertAttendanceCount = useCallback(async () => {
    try {
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      if (!adminInfo.token) return;
      const res = await fetch(
        `${(await import("../api/apiConfig")).API_BASE_URL}/admin/intern/${internId}/certificate-data`,
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminInfo.token}` } }
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

  const { intern, statistics } = internDetails;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-gray-800 overflow-hidden">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-80 h-80 rounded-full bg-blue-100/40 -top-20 -left-20"
          animate={{ y: [0, -30, 0], x: [0, 20, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-cyan-100/40 top-1/4 right-0"
          animate={{ y: [0, 20, 0], x: [0, -20, 0], rotate: [0, -5, 0] }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />
        <motion.div
          className="absolute w-64 h-64 rounded-full bg-green-100/40 bottom-20 left-1/4"
          animate={{ y: [0, -20, 0], x: [0, 15, 0], rotate: [0, 3, 0] }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
        <motion.div
          className="absolute w-72 h-72 rounded-full bg-purple-100/40 bottom-0 right-20"
          animate={{ y: [0, 25, 0], x: [0, -15, 0], rotate: [0, -3, 0] }}
          transition={{
            duration: 17,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 3,
          }}
        />
      </div>

      {/* Navbar */}
      <motion.header
        className="bg-white/80 backdrop-blur-md shadow-sm fixed top-0 left-0 right-0 z-30 h-[4.5rem] sm:h-[5.5rem] border-b border-gray-100"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
      >
        <div className="flex items-center justify-between h-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
            <motion.div
              className="flex items-center space-x-2 sm:space-x-4 cursor-pointer"
              onClick={() => {
                localStorage.clear();
                navigate("/admin-login");
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.img
                src={logo}
                alt="SLT Logo"
                className="h-8 sm:h-10 w-auto rounded-lg border border-gray-200 flex-shrink-0 shadow-sm"
                whileHover={{ rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              />
              <div className="hidden sm:flex flex-col min-w-0">
                <span className="text-sm sm:text-lg font-semibold text-gray-900 truncate">
                  SLT Admin Portal
                </span>
                <span className="text-xs sm:text-sm text-gray-600 truncate">
                  Intern Details
                </span>
              </div>
            </motion.div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-6 flex-shrink-0">
            <div className="hidden md:flex items-center space-x-3 mr-4 p-2 bg-gray-50 rounded-xl">
              <motion.div
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 flex items-center justify-center border border-gray-200 shadow-sm"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <FaUser className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </motion.div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">Welcome back,</span>
                <span className="text-sm font-medium text-gray-800">
                  Administrator
                </span>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                localStorage.removeItem("adminInfo");
                navigate("/admin-login");
              }}
              className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 text-xs sm:text-sm text-red-600 hover:text-white hover:bg-gradient-to-r from-red-500 to-orange-500 rounded-xl transition-all border border-red-200 hover:border-red-600 cursor-pointer shadow-sm hover:shadow-md"
            >
              <FaShieldAlt className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Logout</span>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="pt-[4.5rem] sm:pt-[5.5rem]">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Page header */}
            <motion.div
              className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <motion.button
                  onClick={() => navigate("/admin/dashboard")}
                  className="flex items-center px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all border border-gray-200 shadow-sm hover:shadow-md"
                  whileHover={{ x: -3 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FaArrowLeft className="mr-2" /> Back to Dashboard
                </motion.button>
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
              </div>
              <div className="w-full sm:w-auto">
                {getStatusBadge(statistics)}
              </div>
            </motion.div>

            {/* Tabs */}
            <div className="mb-4 sm:mb-6 border-b border-gray-200">
              <nav className="flex space-x-1 overflow-x-auto">
                {["overview", "records", "attendance"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      if (tab === "attendance") fetchAttendance();
                    }}
                    className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab
                        ? "bg-white text-blue-600 border-t border-l border-r border-gray-200"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </nav>
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
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    if(e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                                <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
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
                              onClick={() => window.open(`mailto:${intern.email}`, "_blank")}
                              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-white text-slate-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
                            >
                              <FaEnvelope className="mr-2 text-slate-400" /> Contact
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => navigate(`/admin/intern/${internId}/certificate`)}
                              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm border border-slate-900"
                            >
                              <FaCertificate className="mr-2 text-amber-400" /> Certificate
                            </motion.button>
                          </div>
                        </div>

                        {/* Profile Info */}
                        <div className="mb-6">
                          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                            {intern.traineeName}
                          </h3>
                          <p className="text-sm font-medium text-slate-500 mt-0.5">
                            Trainee ID: <span className="text-slate-700">{intern.traineeId}</span>
                          </p>
                        </div>

                        {/* Metadata Strip */}
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

                          {/* Meeting Attendance % = attended ÷ meetings held so far */}
                          {attendanceData && intern.startDate && (() => {
                            let present = 0;
                            if (attendanceData.meetingAttendance && Array.isArray(attendanceData.meetingAttendance)) {
                              const weeks = new Set();
                              attendanceData.meetingAttendance.forEach(entry => {
                                if (entry.status === 'Present' && entry.date) {
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
                            const end = intern.endDate ? new Date(intern.endDate) : null;
                            const now = new Date();
                            // Meetings held so far = weeks elapsed (1 meeting per week), capped at training end
                            const measureTo = end && end < now ? end : now;
                            if (isNaN(start) || measureTo <= start) return null;
                            const weeksHeld = Math.max(1, Math.ceil((measureTo - start) / (1000 * 60 * 60 * 24 * 7)));
                            const pct = Math.min(100, Math.round((present / weeksHeld) * 100));
                            const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
                            const textColor = pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-500' : 'text-red-500';
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
                                  {present} attended out of {weeksHeld} meetings held so far (1 per week)
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
                            ? Math.max(5, 100 - statistics.daysSinceLastSubmission * 5)
                            : 0,
                        },
                      ].map(
                        ({
                          label,
                          value,
                          icon: Icon,
                          width,
                        }) => (
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
                              <div
                                className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center"
                              >
                                <Icon
                                  className="h-5 w-5 text-slate-600"
                                />
                              </div>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-slate-800 h-1.5 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </div>
                        ),
                      )}
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
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{intern.traineeName}</h3>
                                <p className="text-sm text-gray-500 mt-0.5">{intern.traineeId}</p>
                                {intern.startDate && intern.endDate && (() => {
                                  const daysLeft = Math.ceil(
                                    (new Date(intern.endDate) - new Date()) / (1000 * 60 * 60 * 24)
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
                                  Last seen: {new Date(intern.lastSeen).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {new Date(intern.lastSeen).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Content sections */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-6">
                            {/* Personal Information */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm h-full">
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
                              {/* Training Period */}
                              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
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

                              {/* Project Assignments */}
                              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
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
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
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
                                          <Icon className={`text-lg ${accentColor}`} />
                                        </div>
                                      </div>
                                      <div className="mt-2">
                                        <p className={`text-2xl font-bold tracking-tight ${accentColor}`}>
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
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                  <thead>
                                    <tr>
                                      {[
                                        "Mon",
                                        "Tue",
                                        "Wed",
                                        "Thu",
                                        "Fri",
                                        "Sat",
                                        "Sun",
                                      ].map((d) => (
                                        <th
                                          key={d}
                                          className="text-center pb-2 text-xs font-semibold text-gray-500 w-[14.28%]"
                                        >
                                          {d}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Array.from(
                                      { length: Math.ceil(calDays.length / 7) },
                                      (_, w) => (
                                        <tr key={w}>
                                          {calDays
                                            .slice(w * 7, w * 7 + 7)
                                            .map((day, di) => {
                                              const dailyMeta = getDailyMeta(
                                                dailyMap,
                                                day,
                                              );
                                              const isToday =
                                                day &&
                                                day.toDateString() ===
                                                  new Date().toDateString();
                                              const dayKey = day
                                                ? toDateKey(day)
                                                : null;
                                              const meetingsOnDay = dayKey
                                                ? meetingMap[dayKey] || []
                                                : [];
                                              const hasMeetingPresent =
                                                meetingsOnDay.some(
                                                  (e) =>
                                                    (
                                                      e.status || ""
                                                    ).toLowerCase() ===
                                                    "present",
                                                );
                                              const hasMeetingMissed =
                                                meetingsOnDay.some(
                                                  (e) =>
                                                    (
                                                      e.status || ""
                                                    ).toLowerCase() !==
                                                    "present",
                                                );
                                              const hasMeeting =
                                                meetingsOnDay.length > 0;

                                              const tooltipContent = day
                                                ? (() => {
                                                    let lines = [
                                                      day.toLocaleDateString(
                                                        "en-US",
                                                        {
                                                          weekday: "short",
                                                          month: "short",
                                                          day: "numeric",
                                                        },
                                                      ),
                                                    ];
                                                    lines.push(
                                                      `Daily: ${dailyMeta?.label ?? "No Record"}`,
                                                    );
                                                    if (dailyMap[dayKey]?.time)
                                                      lines.push(
                                                        `Time: ${dailyMap[dayKey].time}`,
                                                      );
                                                    if (hasMeeting)
                                                      meetingsOnDay.forEach(
                                                        (m) =>
                                                          lines.push(
                                                            `Meeting: ${m.meetingName || "Meeting"} — ${m.status || "Unknown"}`,
                                                          ),
                                                      );
                                                    return lines.join("\n");
                                                  })()
                                                : null;

                                              return (
                                                <td
                                                  key={di}
                                                  className="py-1 text-center"
                                                >
                                                  {day ? (
                                                    <div className="flex flex-col items-center py-0.5">
                                                      <div
                                                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 shadow-sm ${isToday ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}
                                                        style={{
                                                          backgroundColor:
                                                            dailyMeta?.color ??
                                                            "#e5e7eb",
                                                        }}
                                                        onMouseEnter={(e) => {
                                                          const r =
                                                            e.currentTarget.getBoundingClientRect();
                                                          setTooltip({
                                                            x: r.left,
                                                            y: r.top,
                                                            label:
                                                              tooltipContent,
                                                            date: "",
                                                          });
                                                        }}
                                                        onMouseLeave={() =>
                                                          setTooltip(null)
                                                        }
                                                      >
                                                        <span
                                                          className={`text-[10px] sm:text-xs font-semibold ${
                                                            dailyMeta?.label ===
                                                            "Present"
                                                              ? "text-white"
                                                              : isToday
                                                                ? "text-blue-700"
                                                                : "text-gray-600"
                                                          }`}
                                                        >
                                                          {day.getDate()}
                                                        </span>
                                                      </div>
                                                      {/* Meeting indicator dots — larger and more visible */}
                                                      {hasMeeting && (
                                                        <div className="flex gap-1 mt-1">
                                                          {hasMeetingPresent && (
                                                            <span
                                                              className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shadow-sm ring-1 ring-blue-300"
                                                              title="Meeting attended"
                                                            />
                                                          )}
                                                          {hasMeetingMissed && (
                                                            <span
                                                              className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block shadow-sm ring-1 ring-orange-200"
                                                              title="Meeting missed"
                                                            />
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>
                                                  ) : (
                                                    <div className="h-10" />
                                                  )}
                                                </td>
                                              );
                                            })}
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              {/* Simplified Legend */}
                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                  Legend
                                </p>
                                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-600">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded-full inline-block bg-green-400 shadow-sm"></span>
                                    Daily Present
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded-full inline-block bg-red-400 shadow-sm"></span>
                                    Daily Absent
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full inline-block bg-blue-500 shadow-sm ring-1 ring-blue-300"></span>
                                    Meeting Attended
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full inline-block bg-orange-400 shadow-sm ring-1 ring-orange-200"></span>
                                    Meeting Missed
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
                                        <FaCheckCircle className="text-blue-500 mr-1.5" /> Tasks Completed
                                      </p>
                                      <p className="text-sm text-gray-800 leading-relaxed bg-gray-50 rounded-xl p-3">
                                        {logbookModal.task}
                                      </p>
                                    </div>
                                  )}
                                  {logbookModal.progress && (
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center">
                                        <FaChartLine className="text-emerald-500 mr-1.5" /> Progress
                                      </p>
                                      <p className="text-sm text-gray-800 leading-relaxed bg-gray-50 rounded-xl p-3">
                                        {logbookModal.progress}
                                      </p>
                                    </div>
                                  )}
                                  {logbookModal.blockers && (
                                    <div>
                                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center">
                                        <FaExclamationTriangle className="text-amber-500 mr-1.5" /> Challenges / Blockers
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
                                    <p className={`text-2xl sm:text-3xl font-bold tracking-tight mb-1 ${color}`}>
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

                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                  <thead>
                                    <tr>
                                      {[
                                        "Mon",
                                        "Tue",
                                        "Wed",
                                        "Thu",
                                        "Fri",
                                        "Sat",
                                        "Sun",
                                      ].map((d) => (
                                        <th
                                          key={d}
                                          className="text-center pb-2 text-xs font-semibold text-gray-500 w-[14.28%]"
                                        >
                                          {d}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Array.from(
                                      {
                                        length: Math.ceil(lbCalDays.length / 7),
                                      },
                                      (_, w) => (
                                        <tr key={w}>
                                          {lbCalDays
                                            .slice(w * 7, w * 7 + 7)
                                            .map((day, di) => {
                                              const meta = getLogbookMeta(
                                                recordMap,
                                                day,
                                              );
                                              const isToday =
                                                day &&
                                                day.toDateString() ===
                                                  new Date().toDateString();
                                              const dayKey = day
                                                ? toDateKey(day)
                                                : null;
                                              const rec = dayKey
                                                ? recordMap[dayKey]
                                                : null;
                                              const isClickable = rec != null;
                                              return (
                                                <td
                                                  key={di}
                                                  className="py-1 text-center"
                                                >
                                                  {day ? (
                                                    <div
                                                      className={`mx-auto w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all ${
                                                        isClickable
                                                          ? "cursor-pointer hover:opacity-80 hover:shadow-md"
                                                          : ""
                                                      } ${isToday ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}
                                                      style={{
                                                        backgroundColor:
                                                          meta?.color ??
                                                          "#f3f4f6",
                                                      }}
                                                      onClick={() =>
                                                        isClickable &&
                                                        setLogbookModal(rec)
                                                      }
                                                    >
                                                      <span
                                                        className="text-[10px] sm:text-xs font-bold"
                                                        style={{
                                                          color:
                                                            meta?.textColor ??
                                                            "#9ca3af",
                                                        }}
                                                      >
                                                        {day.getDate()}
                                                      </span>
                                                    </div>
                                                  ) : (
                                                    <div className="h-11" />
                                                  )}
                                                </td>
                                              );
                                            })}
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                  Legend — Click any colored day to inspect the
                                  logbook
                                </p>
                                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600">
                                  {[
                                    { color: "#bbf7d0", label: "Working" },
                                    { color: "#ddd6fe", label: "WFH" },
                                    { color: "#fde68a", label: "On Leave" },
                                    { color: "#fecaca", label: "Missed" },
                                    {
                                      color: "#f3f4f6",
                                      label: "Weekend / Future",
                                    },
                                  ].map(({ color, label }) => (
                                    <span
                                      key={label}
                                      className="flex items-center gap-1.5"
                                    >
                                      <span
                                        className="w-3 h-3 rounded inline-block"
                                        style={{ backgroundColor: color }}
                                      ></span>{" "}
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
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminInternDetails;
