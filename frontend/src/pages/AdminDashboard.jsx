import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUsers,
  FaSearch,
  FaDownload,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaCalendarAlt,
  FaFileExport,
  FaFilter,
  FaSort,
  FaUser,
  FaTasks,
  FaSpinner,
  FaShieldAlt,
  FaArrowLeft,
  FaEye,
  FaFileAlt,
  FaChair,
  FaSignOutAlt,
  FaRunning,
  FaClock,
  FaAngleDoubleLeft,
  FaRegFileExcel,
  FaSlidersH,
  FaCalendarCheck,
  FaMapMarkedAlt,
  FaBullhorn,
  FaChevronDown,
  FaQrcode,
  FaKey,
  FaChevronRight,
  FaTimes,
  FaGraduationCap,
  FaCamera,
  FaLock,
  FaChartLine,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi, csvUtils, notificationUtils } from "../api/adminApi";
import { API_BASE_URL } from "../api/apiConfig";
import logo from "../assets/sltlogo.jpg";
import AdminNavigation from "../components/AdminNavigation";
import { Home } from "lucide-react";
/* ── Chart.js imports removed as per user request ── */
/* ═══════════════════════════════════════════════════════════════
   Brand Colors
   ═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   Date formatting utilities (unchanged)
   ═══════════════════════════════════════════════════════════════ */
const formatDateDisplay = (dateString) => {
  if (!dateString) return "N/A";
  try {
    if (dateString.includes("T") || dateString.includes("Z")) {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    if (dateString.includes("-") && dateString.split("-").length === 3) {
      const parts = dateString.split("-");
      if (parts[2].length <= 2) {
        const [year, month, day] = parts.map(Number);
        const date = new Date(year, month - 1, day);
        if (isNaN(date.getTime())) return "Invalid Date";
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    console.error("Error formatting date:", dateString, error);
    return "Invalid Date";
  }
};

const parseDateForComparison = (dateString) => {
  if (!dateString) return new Date(0);
  try {
    if (dateString.includes("T") || dateString.includes("Z")) {
      return new Date(dateString);
    }
    if (dateString.includes("-") && dateString.split("-").length === 3) {
      const parts = dateString.split("-");
      if (parts[2].length <= 2) {
        const [year, month, day] = parts.map(Number);
        return new Date(year, month - 1, day);
      }
    }
    return new Date(dateString);
  } catch (error) {
    console.error("Error parsing date for comparison:", dateString, error);
    return new Date(0);
  }
};

/* ═══════════════════════════════════════════════════════════════
   Generate submission trend data (Removed)
   ═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
const AdminDashboard = () => {
  /* ── State (unchanged) ── */
  const [showDateSelector, setShowDateSelector] = useState(false);
  const handleShowDateSelector = () => setShowDateSelector(true);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const navigate = useNavigate();
  const [dashboardStats, setDashboardStats] = useState(null);
  const [internReport, setInternReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showExports, setShowExports] = useState(false);
  const [activeExport, setActiveExport] = useState(null);
  const [showLeaveRequestPicker, setShowLeaveRequestPicker] = useState(false);

  /* ── Data fetching (unchanged) ── */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      if (!adminInfo.token) {
        setError("Admin authentication required");
        navigate("/admin-login");
        return;
      }
      const statsData = await adminApi.getDashboardStats();
      setDashboardStats(statsData);
      setInternReport([]);
      setHasSearched(false);
    } catch (error) {
      console.error("Error in fetchData:", error);
      setError("Failed to load dashboard data. Please try again.");
      if (error.message.includes("403") || error.message.includes("401")) {
        localStorage.removeItem("adminInfo");
        navigate("/admin-login");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const searchInterns = useCallback(
    async (searchQuery) => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        setInternReport([]);
        setHasSearched(false);
        return;
      }
      try {
        setSearchLoading(true);
        const reportData = await adminApi.searchInterns(searchQuery.trim());
        setInternReport(reportData);
        setHasSearched(true);
      } catch (error) {
        console.error("Error searching interns:", error);
        setInternReport([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchInterns(searchTerm);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchInterns]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Chart data removed ── */

  const handleExportSubmittedCSV = async () => {
    try {
      let submittedInterns = [];
      if (internReport && internReport.length > 0) {
        submittedInterns = internReport.filter(
          (intern) => !intern.isOverdue && intern.totalRecords > 0,
        );
      } else {
        try {
          setSearchLoading(true);
          const allInterns = await adminApi.getInternReport();
          submittedInterns = allInterns.filter(
            (intern) => !intern.isOverdue && intern.totalRecords > 0,
          );
        } catch (error) {
          console.error("Error loading interns for submitted export:", error);
          notificationUtils.showError(
            "Failed to load intern data for export. Please try again or search for interns first.",
          );
          return;
        } finally {
          setSearchLoading(false);
        }
      }
      if (submittedInterns.length === 0) {
        notificationUtils.showInfo("No submitted interns found to export.");
        return;
      }
      await csvUtils.downloadInternReport(
        submittedInterns,
        "submitted_interns",
      );
      notificationUtils.showSuccess(
        `Submitted interns CSV report with ${submittedInterns.length} interns downloaded successfully`,
      );
    } catch (error) {
      console.error("Error exporting submitted interns CSV:", error);
      notificationUtils.showError(
        "Failed to export submitted interns CSV report",
      );
    }
  };

  const handleDownloadOnLeaveExcel = async () => {
    try {
      const blob = await adminApi.downloadOnLeaveExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "on_leave_interns.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download on-leave Excel");
    }
  };

  const sortByTraineeId = (interns) =>
    [...interns].sort((a, b) =>
      (a.traineeId || "").localeCompare(b.traineeId || "", undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );

  const handleExportWeeklyNonSubmissionsWithinWeek = async () => {
    try {
      const weeklyNonSubmissionsData =
        await adminApi.getNonSubmissionsWithinAWeek();
      weeklyNonSubmissionsData.nonSubmittedInterns = sortByTraineeId(
        weeklyNonSubmissionsData.nonSubmittedInterns,
      );
      if (weeklyNonSubmissionsData.nonSubmittedInterns.length === 0) {
        notificationUtils.showInfo(
          "All interns have submitted records within the last 5 working days.",
        );
        return;
      }
      const startDateStr =
        weeklyNonSubmissionsData.startDate ||
        new Date().toISOString().split("T")[0];
      await csvUtils.downloadInternReport(
        weeklyNonSubmissionsData,
        `weekly_non_submissions_from_${startDateStr}`,
      );
      notificationUtils.showSuccess(
        `Weekly non-submissions CSV report with ${weeklyNonSubmissionsData.nonSubmittedInterns.length} interns downloaded successfully. ` +
          `Period: ${weeklyNonSubmissionsData.weekPeriod}`,
      );
    } catch (error) {
      console.error(
        "Error exporting weekly non-submissions within week CSV:",
        error,
      );
      notificationUtils.showError(
        "Failed to export weekly non-submissions within week CSV report",
      );
    }
  };

  const handleExportWeeklyNonSubmissionsCSV = async () => {
    try {
      let weeklyNonSubmissionsData;
      if (customStartDate && customEndDate) {
        weeklyNonSubmissionsData = await adminApi.getWeeklyNonSubmissions({
          startDate: customStartDate,
          endDate: customEndDate,
        });
      } else {
        const today = new Date();
        const isTuesday = today.getDay() === 2;
        if (isTuesday) {
          weeklyNonSubmissionsData =
            await adminApi.getWeeklyNonSubmissions("previous");
        } else {
          weeklyNonSubmissionsData = await adminApi.getWeeklyNonSubmissions();
        }
      }
      weeklyNonSubmissionsData.nonSubmittedInterns = sortByTraineeId(
        weeklyNonSubmissionsData.nonSubmittedInterns,
      );
      if (weeklyNonSubmissionsData.nonSubmittedInterns.length === 0) {
        notificationUtils.showInfo(
          "All interns have submitted records for the selected week.",
        );
        return;
      }
      const weekStr =
        customStartDate && customEndDate
          ? `${customStartDate}_to_${customEndDate}`
          : new Date().toISOString().split("T")[0];
      await csvUtils.downloadInternReport(
        weeklyNonSubmissionsData,
        `weekly_non_submissions_${weekStr}`,
      );
      notificationUtils.showSuccess(
        `Weekly non-submissions CSV report with ${weeklyNonSubmissionsData.nonSubmittedInterns.length} interns downloaded successfully. ` +
          `Period: ${weeklyNonSubmissionsData.weekPeriod}`,
      );
    } catch (error) {
      console.error("Error exporting weekly non-submissions CSV:", error);
      notificationUtils.showError(
        "Failed to export weekly non-submissions CSV report",
      );
    }
  };

  /* ── Filtering & sorting removed, using internReport directly ── */
  const filteredInterns = internReport || [];

  const getStatusBadge = (intern) => {
    if (intern.isOverdue) {
      return (
        <span className="admin-dash-badge admin-dash-badge--danger">
          <FaExclamationTriangle className="mr-1" />
          Overdue
        </span>
      );
    } else if (intern.totalRecords === 0) {
      return (
        <span className="admin-dash-badge admin-dash-badge--neutral">
          <FaTimesCircle className="mr-1" />
          Not Submitted
        </span>
      );
    } else {
      return (
        <span className="admin-dash-badge admin-dash-badge--success">
          <FaCheckCircle className="mr-1" />
          Submitted
        </span>
      );
    }
  };

  /* ── Filter pills removed ── */

  /* ══════════════════════════════════════════════════════════
     Error state
     ══════════════════════════════════════════════════════════ */
  if (error) {
    return (
      <div className="admin-dash-loader">
        <div className="admin-dash-error-card">
          <FaExclamationTriangle
            style={{ fontSize: 40, color: BRAND.danger, marginBottom: 16 }}
          />
          <p style={{ color: BRAND.danger, marginBottom: 20 }}>{error}</p>
          <button
            onClick={fetchData}
            className="admin-dash-btn admin-dash-btn--primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     Main render — Two-Column Grid Layout
     ══════════════════════════════════════════════════════════ */
  return (
    <AdminNavigation>
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/60 via-slate-50 to-indigo-50/60 font-sans text-gray-800 pb-10 flex flex-col">
        <div className="flex-1 w-full lg:mt-4 lg:px-6 xl:px-10">
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
            {/* ── Page title ── */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
                >
                  <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl">
                    <Home className="text-[#0056a2] h-8 w-8" />
                  </div>
                  Dashboard
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
                >
                  Overview of intern attendance, logbook submissions, and
                  statistics
                </motion.p>
              </div>
            </div>

            {/* ══════════════ KPI STAT CARDS ══════════════ */}
                <motion.div
                  className="admin-dash-stats"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  {[
                    {
                      label: "Total Interns",
                      value: loading
                        ? "..."
                        : dashboardStats?.totalInterns || 0,
                      icon: FaUsers,
                      accent: BRAND.primary,
                      bg: BRAND.primaryLight,
                      borderColor: "!border-blue-400/30",
                      hoverBorderColor: "hover:!border-blue-400/60",
                      shadowColor: "shadow-[0_0_15px_rgba(0,86,162,0.15)]",
                      hoverShadowColor: "hover:shadow-[0_0_25px_rgba(0,86,162,0.35)]"
                    },
                    {
                      label: "Total Records",
                      value: loading
                        ? "..."
                        : dashboardStats?.totalRecords || 0,
                      icon: FaTasks,
                      accent: BRAND.accent,
                      bg: BRAND.accentLight,
                      borderColor: "!border-cyan-400/30",
                      hoverBorderColor: "hover:!border-cyan-400/60",
                      shadowColor: "shadow-[0_0_15px_rgba(0,180,235,0.15)]",
                      hoverShadowColor: "hover:shadow-[0_0_25px_rgba(0,180,235,0.35)]"
                    },
                    {
                      label: "Submitted",
                      value: loading
                        ? "..."
                        : dashboardStats?.submittedInterns || 0,
                      icon: FaCheckCircle,
                      accent: BRAND.success,
                      bg: BRAND.successLight,
                      borderColor: "!border-emerald-400/30",
                      hoverBorderColor: "hover:!border-emerald-400/60",
                      shadowColor: "shadow-[0_0_15px_rgba(80,183,72,0.15)]",
                      hoverShadowColor: "hover:shadow-[0_0_25px_rgba(80,183,72,0.35)]"
                    },
                    {
                      label: "Overdue",
                      value: loading
                        ? "..."
                        : dashboardStats?.overdueInterns || 0,
                      icon: FaExclamationTriangle,
                      accent: BRAND.danger,
                      bg: BRAND.dangerLight,
                      borderColor: "!border-red-400/30",
                      hoverBorderColor: "hover:!border-red-400/60",
                      shadowColor: "shadow-[0_0_15px_rgba(239,68,68,0.15)]",
                      hoverShadowColor: "hover:shadow-[0_0_25px_rgba(239,68,68,0.35)]"
                    },
                  ].map((stat, idx) => (
                    <motion.div
                      key={stat.label}
                      className={`admin-dash-stat-card !bg-white/80 md:!bg-white/20 md:backdrop-blur-3xl !border ${stat.borderColor} ${stat.hoverBorderColor} ${stat.shadowColor} ${stat.hoverShadowColor} transition-all duration-300`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + idx * 0.08, duration: 0.35 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div
                        className="admin-dash-stat-card__icon"
                        style={{ background: stat.bg }}
                      >
                        <stat.icon
                          style={{ color: stat.accent, fontSize: 18 }}
                        />
                      </div>
                      <div className="admin-dash-stat-card__text">
                        <span
                          className="admin-dash-stat-card__value"
                          style={{ color: stat.accent }}
                        >
                          {stat.value}
                        </span>
                        <span className="admin-dash-stat-card__label">
                          {stat.label}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>

            {/* ══════════════ SPOTLIGHT SEARCH ══════════════ */}
            <div className="mt-12 mb-8 relative w-full z-20">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className={`relative bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-3xl border transition-all duration-300 ${searchTerm ? 'border-[#00b4eb]/50 ring-4 ring-[#00b4eb]/10 shadow-[0_0_25px_rgba(0,180,235,0.35)]' : 'border-[#00b4eb]/20 hover:border-[#00b4eb]/60 shadow-[0_0_15px_rgba(0,180,235,0.15)] hover:shadow-[0_0_25px_rgba(0,180,235,0.35)]'} overflow-hidden flex items-center px-4 sm:px-6 py-4 sm:py-5`}
              >
                <FaSearch className="text-gray-400 text-xl sm:text-3xl mr-3 sm:mr-6 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search interns by name, ID, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-sm sm:text-2xl font-semibold text-gray-800 placeholder-gray-400 sm:placeholder-gray-300 outline-none bg-transparent"
                  autoFocus
                />
                {searchLoading && (
                  <FaSpinner className="text-[#00b4eb] text-xl sm:text-2xl animate-spin ml-2 sm:ml-4 flex-shrink-0" />
                )}
                {searchTerm && !searchLoading && (
                  <button 
                    onClick={() => { setSearchTerm(""); setHasSearched(false); setInternReport([]); }}
                    className="ml-2 sm:ml-4 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <FaTimesCircle className="text-xl sm:text-2xl" />
                  </button>
                )}
              </motion.div>

              {/* Search Results Dropdown */}
              <AnimatePresence>
                {searchTerm.length >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-[calc(100%+12px)] left-0 right-0 bg-white/90 md:bg-white/30 md:backdrop-blur-3xl rounded-3xl shadow-[0_0_25px_rgba(0,180,235,0.25)] border border-[#00b4eb]/40 max-h-[60vh] overflow-y-auto z-50 p-2 sm:p-3"
                  >
                    {!hasSearched ? (
                       <div className="p-6 sm:p-10 text-center text-gray-400">
                         <FaSpinner className="text-3xl animate-spin mx-auto mb-4 text-[#00b4eb]" />
                         <p className="font-medium text-base sm:text-lg">Searching...</p>
                       </div>
                    ) : filteredInterns.length === 0 ? (
                       <div className="p-6 sm:p-10 text-center text-gray-400">
                         <FaUser className="text-4xl mx-auto mb-4 opacity-50" />
                         <p className="font-medium text-base sm:text-lg">No interns found</p>
                         <p className="text-xs sm:text-sm mt-2">Try adjusting your search query.</p>
                       </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="px-4 py-2 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-2">
                          {filteredInterns.length} Results
                        </div>
                        {filteredInterns.map((intern, idx) => (
                          <div
                            key={intern._id}
                            onClick={() => navigate(`/admin/intern/${intern._id}`)}
                            className="flex items-center gap-3 sm:gap-5 p-3 sm:p-4 rounded-2xl hover:bg-white/60 cursor-pointer transition-all duration-300 border border-transparent hover:border-[#00b4eb]/30 hover:shadow-[0_0_15px_rgba(0,180,235,0.1)] group"
                          >
                            <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-2xl bg-[#00b4eb]/10 text-[#0056a2] flex items-center justify-center font-bold text-lg sm:text-xl flex-shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
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
                                {(intern.traineeName || "?")[0].toUpperCase()}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                                {intern.traineeName || "N/A"}
                              </h4>
                              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate mt-0.5">
                                {intern.traineeId || "N/A"} <span className="hidden sm:inline">· {intern.email || "No Email"}</span>
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 sm:gap-2 flex-shrink-0">
                              {getStatusBadge(intern)}
                              <span className="text-[10px] sm:text-xs font-semibold text-gray-400 mt-1">
                                {intern.totalRecords || 0} Records
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ══════════════ EXPORTS SECTION ══════════════ */}
            <div className="mt-16 w-full">
              <div className="flex items-center gap-3 mb-6 px-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-xl flex-shrink-0">
                  <FaFileExport className="text-lg" />
                </div>
                <h3 className="text-2xl font-extrabold text-gray-900">Reports & Exports</h3>
              </div>
              
              <div className="grid grid-cols-3 gap-3 sm:gap-6">
                
                {/* Submissions List */}
                <motion.button
                  onClick={handleExportSubmittedCSV}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-[0_0_15px_rgba(80,183,72,0.15)] border border-[#50b748]/20 hover:shadow-[0_0_25px_rgba(80,183,72,0.35)] hover:border-[#50b748]/60 flex flex-col items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4 transition-all duration-300 group w-full"
                >
                  <div className="p-3 sm:p-4 bg-[#50b748]/10 text-[#50b748] rounded-xl sm:rounded-2xl group-hover:bg-[#50b748] group-hover:text-white transition-colors">
                    <FaRegFileExcel className="text-2xl sm:text-3xl" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-lg font-bold text-gray-900 leading-tight">Submissions</h4>
                    <p className="hidden sm:block text-sm font-medium text-gray-500 mt-1">Export a complete CSV of all currently submitted interns.</p>
                  </div>
                </motion.button>

                {/* On-Leave List */}
                <motion.button
                  onClick={handleDownloadOnLeaveExcel}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-[0_0_15px_rgba(147,51,234,0.15)] border border-purple-400/20 hover:shadow-[0_0_25px_rgba(147,51,234,0.35)] hover:border-purple-400/60 flex flex-col items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4 transition-all duration-300 group w-full"
                >
                  <div className="p-3 sm:p-4 bg-purple-100 text-purple-600 rounded-xl sm:rounded-2xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <FaRegFileExcel className="text-2xl sm:text-3xl" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-lg font-bold text-gray-900 leading-tight">On-Leave</h4>
                    <p className="hidden sm:block text-sm font-medium text-gray-500 mt-1">Download Excel report of interns currently on leave.</p>
                  </div>
                </motion.button>

                {/* Current Week Non-Submissions */}
                <motion.button
                  onClick={handleExportWeeklyNonSubmissionsWithinWeek}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl p-3 sm:p-6 rounded-2xl sm:rounded-3xl shadow-[0_0_15px_rgba(239,68,68,0.15)] border border-red-400/20 hover:shadow-[0_0_25px_rgba(239,68,68,0.35)] hover:border-red-400/60 flex flex-col items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4 transition-all duration-300 group w-full"
                >
                  <div className="p-3 sm:p-4 bg-red-50 text-red-500 rounded-xl sm:rounded-2xl group-hover:bg-red-500 group-hover:text-white transition-colors">
                    <FaExclamationTriangle className="text-2xl sm:text-3xl" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-lg font-bold text-gray-900 leading-tight">Non-Submissions</h4>
                    <p className="hidden sm:block text-sm font-medium text-gray-500 mt-1">Last 5 working days non-submissions report.</p>
                  </div>
                </motion.button>

              </div>
              
              {/* Custom Date Non-Submissions */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="mt-8 bg-white/80 md:bg-white/20 md:backdrop-blur-3xl p-6 rounded-3xl shadow-[0_0_15px_rgba(100,116,139,0.15)] border border-slate-400/20 hover:shadow-[0_0_25px_rgba(100,116,139,0.35)] hover:border-slate-400/60 flex flex-col md:flex-row items-center gap-6 transition-all duration-300"
              >
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-gray-900">Custom Date Range Non-Submissions</h4>
                  <p className="text-sm font-medium text-gray-500 mt-1">Export non-submission data between specific dates.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#00b4eb]/30 outline-none text-sm font-semibold text-gray-700 w-full sm:w-auto"
                    />
                    <span className="text-gray-400 font-bold">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#00b4eb]/30 outline-none text-sm font-semibold text-gray-700 w-full sm:w-auto"
                    />
                  </div>
                  <motion.button
                    onClick={handleExportWeeklyNonSubmissionsCSV}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors w-full sm:w-auto flex-shrink-0 shadow-md"
                  >
                    <FaDownload />
                    <span>Download</span>
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {showLeaveRequestPicker && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLeaveRequestPicker(false)}
          >
            <motion.div
              className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-100"
              initial={{ y: 24, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 24, scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Leave Requests Management
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Select which request type you want to manage
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLeaveRequestPicker(false)}
                  className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  aria-label="Close leave request selection"
                >
                  <FaTimesCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-3 p-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveRequestPicker(false);
                    navigate("/admin/leave-requests");
                  }}
                  className="flex items-center gap-4 rounded-xl border border-purple-100 bg-purple-50 px-5 py-4 text-left hover:border-purple-200 hover:bg-purple-100 transition-colors"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-100">
                    <FaRunning className="h-5 w-5 text-purple-600" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-gray-900">
                      Short Leave Request Management
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      Review early-exit permission requests
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveRequestPicker(false);
                    navigate("/admin/study-leave-requests");
                  }}
                  className="flex items-center gap-4 rounded-xl border border-sky-100 bg-sky-50 px-5 py-4 text-left hover:border-sky-200 hover:bg-sky-100 transition-colors"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100">
                    <FaFileAlt className="h-5 w-5 text-sky-600" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-gray-900">
                      Extended Leave Requests Management
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      Review extended leave requests
                    </span>
                  </span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminNavigation>
  );
};

export default AdminDashboard;
