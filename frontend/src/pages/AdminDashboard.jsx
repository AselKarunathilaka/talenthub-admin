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
      <div className="min-h-screen bg-slate-50 font-sans text-gray-800 pb-10 flex flex-col">
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
                    },
                    {
                      label: "Total Records",
                      value: loading
                        ? "..."
                        : dashboardStats?.totalRecords || 0,
                      icon: FaTasks,
                      accent: BRAND.accent,
                      bg: BRAND.accentLight,
                    },
                    {
                      label: "Submitted",
                      value: loading
                        ? "..."
                        : dashboardStats?.submittedInterns || 0,
                      icon: FaCheckCircle,
                      accent: BRAND.success,
                      bg: BRAND.successLight,
                    },
                    {
                      label: "Overdue",
                      value: loading
                        ? "..."
                        : dashboardStats?.overdueInterns || 0,
                      icon: FaExclamationTriangle,
                      accent: BRAND.danger,
                      bg: BRAND.dangerLight,
                    },
                  ].map((stat, idx) => (
                    <motion.div
                      key={stat.label}
                      className="admin-dash-stat-card"
                      style={{ borderLeftColor: stat.accent }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + idx * 0.08, duration: 0.35 }}
                      whileHover={{
                        y: -3,
                        boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
                      }}
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

            {/* ══════════════ TWO-COLUMN GRID ══════════════ */}
            <div className="admin-dash-grid items-stretch" style={{ marginTop: '24px' }}>
              {/* ── LEFT COLUMN ── */}
              <div className="admin-dash-grid__left h-full">
                {/* ══════════════ INTERN SEARCH ══════════════ */}
                <motion.div
                  className="admin-dash-sidebar-card admin-dash-sidebar-card--search h-full flex flex-col"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                >
                  <div className="admin-dash-sidebar-card__header">
                    <h3 className="admin-dash-sidebar-card__title">
                      <FaSearch style={{ color: BRAND.accent, fontSize: 14 }} />
                      Intern Search
                    </h3>
                  </div>

                  {/* Search input */}
                  <div className="admin-dash-search-bar">
                    <FaSearch className="admin-dash-search-bar__icon" />
                    <input
                      type="text"
                      placeholder="Name, ID, or email…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="admin-dash-search-bar__input"
                    />
                    {searchLoading && (
                      <FaSpinner className="admin-dash-search-bar__spinner animate-spin" />
                    )}
                  </div>
                  {searchTerm.length > 0 && searchTerm.length < 2 && (
                    <p className="admin-dash-search-hint">
                      Type at least 2 characters to search
                    </p>
                  )}

                  {/* Filters removed */}

                  {/* Search Results */}
                  <div className="admin-dash-sidebar-card__results flex-1 overflow-y-auto">
                    {!hasSearched ? (
                      <div className="admin-dash-empty admin-dash-empty--sm">
                        <FaSearch
                          style={{
                            fontSize: 22,
                            color: BRAND.accent,
                            marginBottom: 8,
                          }}
                        />
                        <h3 style={{ fontSize: 14 }}>Find Interns</h3>
                        <p style={{ fontSize: 12, maxWidth: 240 }}>
                          Search by name, ID, or email.
                        </p>
                      </div>
                    ) : filteredInterns.length === 0 ? (
                      <div className="admin-dash-empty admin-dash-empty--sm">
                        <FaUser
                          style={{
                            fontSize: 24,
                            color: "#d1d5db",
                            marginBottom: 8,
                          }}
                        />
                        <h3 style={{ fontSize: 14 }}>No interns found</h3>
                        <p style={{ fontSize: 12 }}>
                          Try adjusting your search or filters.
                        </p>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#64748b",
                            marginBottom: 4,
                          }}
                        >
                          Results ({filteredInterns.length})
                        </div>
                        {filteredInterns.map((intern, idx) => (
                          <motion.div
                            key={intern._id}
                            className={`admin-dash-sidebar-intern ${
                              intern.isOverdue
                                ? "admin-dash-sidebar-intern--danger"
                                : intern.totalRecords > 0
                                  ? "admin-dash-sidebar-intern--success"
                                  : "admin-dash-sidebar-intern--neutral"
                            }`}
                            onClick={() =>
                              navigate(`/admin/intern/${intern._id}`)
                            }
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.02, duration: 0.2 }}
                          >
                            <div className="admin-dash-sidebar-intern__avatar">
                              {(intern.traineeName || "?")[0].toUpperCase()}
                            </div>
                            <div className="admin-dash-sidebar-intern__info">
                              <div className="admin-dash-sidebar-intern__name">
                                {intern.traineeName || "N/A"}
                              </div>
                              <div className="admin-dash-sidebar-intern__meta">
                                {intern.traineeId || "N/A"} ·{" "}
                                {intern.totalRecords || 0} records
                              </div>
                            </div>
                            {getStatusBadge(intern)}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
              {/* ── RIGHT COLUMN ── */}
              <div className="admin-dash-grid__right h-full">
                {/* ══════════════ EXPORTS SECTION ══════════════ */}
                <motion.div
                  className="admin-dash-exports-card h-full flex flex-col justify-between"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.4 }}
                >
                  <div className="admin-dash-exports-card__header">
                    <FaFileExport
                      style={{ color: BRAND.primary, fontSize: 16 }}
                    />
                    <h3 className="admin-dash-exports-card__title">Exports</h3>
                  </div>

                  <div className="admin-dash-exports">
                    {/* Quick export buttons */}
                    <div className="admin-dash-exports__row">
                      <motion.button
                        onClick={handleExportSubmittedCSV}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="admin-dash-export-btn"
                        style={{ borderColor: `${BRAND.success}40` }}
                      >
                        <FaRegFileExcel style={{ color: BRAND.success }} />
                        <div>
                          <strong>Submissions List</strong>
                          <small>Export submitted interns CSV</small>
                        </div>
                        <FaChevronRight className="admin-dash-export-btn__arrow" />
                      </motion.button>

                      <motion.button
                        onClick={handleDownloadOnLeaveExcel}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="admin-dash-export-btn"
                        style={{ borderColor: "#8b5cf640" }}
                      >
                        <FaRegFileExcel style={{ color: "#8b5cf6" }} />
                        <div>
                          <strong>On-Leave List</strong>
                          <small>Download on-leave Excel</small>
                        </div>
                        <FaChevronRight className="admin-dash-export-btn__arrow" />
                      </motion.button>
                    </div>

                    {/* Non-submissions section */}
                    <div className="admin-dash-exports__nonsub">
                      <p className="admin-dash-exports__section-title">
                        Non-Submissions Report
                      </p>

                      <motion.button
                        onClick={handleExportWeeklyNonSubmissionsWithinWeek}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="admin-dash-export-btn admin-dash-export-btn--highlight"
                      >
                        <FaFileExport style={{ color: BRAND.danger }} />
                        <div>
                          <strong>Current Week</strong>
                          <small>Last 5 working days non-submissions</small>
                        </div>
                        <FaChevronRight className="admin-dash-export-btn__arrow" />
                      </motion.button>

                      {/* Custom date range */}
                      <div className="admin-dash-exports__date-range">
                        <div className="admin-dash-exports__dates">
                          <div className="admin-dash-date-field">
                            <label>From</label>
                            <input
                              type="date"
                              value={customStartDate}
                              onChange={(e) =>
                                setCustomStartDate(e.target.value)
                              }
                            />
                          </div>
                          <div className="admin-dash-date-field">
                            <label>To</label>
                            <input
                              type="date"
                              value={customEndDate}
                              onChange={(e) => setCustomEndDate(e.target.value)}
                            />
                          </div>
                        </div>
                        <motion.button
                          onClick={handleExportWeeklyNonSubmissionsCSV}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          className="admin-dash-btn admin-dash-btn--danger"
                        >
                          <FaDownload style={{ marginRight: 6 }} />
                          Download CSV
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

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
