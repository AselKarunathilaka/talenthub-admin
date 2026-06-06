import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUsers,
  FaSearch,
  FaDownload,
  FaBell,
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
  FaRegPaperPlane,
  FaMapMarkedAlt,
  FaBullhorn,
  FaChevronDown,
  FaQrcode,
  FaKey,
  FaChevronRight,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi, csvUtils, notificationUtils } from "../api/adminApi";
import logo from "../assets/sltlogo.jpg";

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
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [showNotifications, setShowNotifications] = useState(false);
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showExports, setShowExports] = useState(false);
  const [activeExport, setActiveExport] = useState(null);

  /* ── New UI state ── */
  const [activeTab, setActiveTab] = useState("actions"); // "actions" | "exports" | "alerts"

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
        if (filterStatus !== "all") {
          try {
            setSearchLoading(true);
            const reportData = await adminApi.searchInterns("*");
            setInternReport(reportData);
            setHasSearched(true);
          } catch (error) {
            console.error("Error loading all interns:", error);
            setInternReport([]);
          } finally {
            setSearchLoading(false);
          }
        } else {
          setInternReport([]);
          setHasSearched(false);
        }
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
    [filterStatus],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchInterns(searchTerm);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchInterns]);

  useEffect(() => {
    if (
      filterStatus !== "all" &&
      (!searchTerm || searchTerm.trim().length < 2)
    ) {
      searchInterns("");
    }
  }, [filterStatus, searchInterns, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Handlers (unchanged) ── */
  const handleSendNotifications = async () => {
    if (
      !dashboardStats?.overdueList ||
      dashboardStats.overdueList.length === 0
    ) {
      notificationUtils.showInfo("No overdue interns to notify");
      return;
    }
    try {
      setSendingNotifications(true);
      const notifications = dashboardStats.overdueList.map((intern) => ({
        id: intern._id,
        name: intern.traineeName,
        traineeId: intern.traineeId,
        email: intern.email,
        body: `Dear ${intern.traineeName},\n\nYou are overdue in submitting your logbook. Please submit it as soon as possible.\n\nThank you.`,
      }));
      await adminApi.sendOverdueNotifications(notifications);
      notificationUtils.showSuccess(
        "Notifications sent to all overdue interns.",
      );
    } catch (error) {
      console.error("Error sending notifications:", error);
      notificationUtils.showError("Failed to send notifications");
    } finally {
      setSendingNotifications(false);
    }
  };

  const handleExportOverdueCSV = async () => {
    try {
      if (
        !dashboardStats?.overdueList ||
        dashboardStats.overdueList.length === 0
      ) {
        notificationUtils.showInfo("No overdue interns to export.");
        return;
      }
      await csvUtils.downloadInternReport(
        dashboardStats.overdueList,
        "overdue_interns",
      );
      notificationUtils.showSuccess(
        `Overdue interns CSV report with ${dashboardStats.overdueList.length} interns downloaded successfully`,
      );
    } catch (error) {
      console.error("Error exporting overdue interns CSV:", error);
      notificationUtils.showError(
        "Failed to export overdue interns CSV report",
      );
    }
  };

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

  /* ── Filtering & sorting (unchanged) ── */
  const getFilteredInterns = () => {
    if (!internReport || internReport.length === 0) return [];
    const filtered = internReport
      .filter((intern) => {
        switch (filterStatus) {
          case "submitted":
            return !intern.isOverdue && intern.totalRecords > 0;
          case "notsubmitted":
            return intern.totalRecords === 0;
          case "overdue":
            return intern.isOverdue;
          default:
            return true;
        }
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "name":
            return (a.traineeName || "").localeCompare(b.traineeName || "");
          case "id":
            return (a.traineeId || "").localeCompare(b.traineeId || "");
          case "records":
            return (b.totalRecords || 0) - (a.totalRecords || 0);
          case "lastSubmitted":
            const aDays = a.daysSinceLastSubmission || 999;
            const bDays = b.daysSinceLastSubmission || 999;
            return aDays - bDays;
          default:
            return 0;
        }
      });
    return filtered;
  };

  const filteredInterns = getFilteredInterns();

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

  /* ── Quick-action items config ── */
  const quickActions = [
    { label: "Daily Records", icon: FaCalendarAlt, route: "/admin/daily-records", color: BRAND.success },
    { label: "Leave Requests", icon: FaRunning, route: "/admin/leave-requests", color: "#8b5cf6" },
    { label: "Seat Layout", icon: FaChair, route: "/admin/seat-management", color: "#ec4899" },
    { label: "Announce", icon: FaBullhorn, route: "/admin/announcements", color: BRAND.accent },
    { label: "Locations", icon: FaMapMarkedAlt, route: "/admin/intern-locations", color: BRAND.primary },
    { label: "Attendance", icon: FaCalendarCheck, route: "/admin/intern-attendance", color: "#6366f1" },
    { label: "QR Code", icon: FaQrcode, route: "/admin/qr-management", color: "#14b8a6" },
    { label: "PIN Gen", icon: FaKey, route: "/admin/pin-management", color: BRAND.success },
  ];

  /* ── Tab definitions ── */
  const tabs = [
    { id: "actions", label: "Actions", icon: FaTasks },
    { id: "exports", label: "Exports", icon: FaFileExport },
    {
      id: "alerts",
      label: "Alerts",
      icon: FaBell,
      badge: dashboardStats?.overdueInterns || 0,
    },
  ];

  /* ── Filter pill options ── */
  const filterPills = [
    { value: "all", label: "All" },
    { value: "submitted", label: "Submitted" },
    { value: "notsubmitted", label: "Not Submitted" },
    { value: "overdue", label: "Overdue" },
  ];

  /* ══════════════════════════════════════════════════════════
     Loading state
     ══════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="admin-dash-loader">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="admin-dash-loader__spinner"
        />
        <p className="admin-dash-loader__text">Loading dashboard…</p>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     Error state
     ══════════════════════════════════════════════════════════ */
  if (error) {
    return (
      <div className="admin-dash-loader">
        <div className="admin-dash-error-card">
          <FaExclamationTriangle style={{ fontSize: 40, color: BRAND.danger, marginBottom: 16 }} />
          <p style={{ color: BRAND.danger, marginBottom: 20 }}>{error}</p>
          <button onClick={fetchData} className="admin-dash-btn admin-dash-btn--primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     Main render
     ══════════════════════════════════════════════════════════ */
  return (
    <div className="admin-dash-root">
      {/* ── Ambient background ── */}
      <div className="admin-dash-ambient">
        <div className="admin-dash-ambient__orb admin-dash-ambient__orb--1" />
        <div className="admin-dash-ambient__orb admin-dash-ambient__orb--2" />
        <div className="admin-dash-ambient__orb admin-dash-ambient__orb--3" />
      </div>

      {/* ══════════════ HEADER ══════════════ */}
      <motion.header
        className="admin-dash-header"
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
      >
        <div className="admin-dash-header__inner">
          {/* Left: Logo + title */}
          <motion.div
            className="admin-dash-header__brand"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              localStorage.clear();
              navigate("/admin-login");
            }}
          >
            <img src={logo} alt="SLT Logo" className="admin-dash-header__logo" />
            <div className="admin-dash-header__titles">
              <span className="admin-dash-header__title">TalentHub</span>
              <span className="admin-dash-header__subtitle">Admin Portal</span>
            </div>
          </motion.div>

          {/* Right: User + Logout */}
          <div className="admin-dash-header__actions">
            <div className="admin-dash-header__user">
              <div className="admin-dash-header__avatar">
                <FaShieldAlt />
              </div>
              <span className="admin-dash-header__username">Admin</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                localStorage.removeItem("adminInfo");
                navigate("/admin-login");
              }}
              className="admin-dash-header__logout"
            >
              <FaSignOutAlt />
              <span>Logout</span>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* ══════════════ MAIN CONTENT ══════════════ */}
      <div className="admin-dash-content">
        <main className="admin-dash-main">
          <div className="admin-dash-container">

            {/* ── Page title ── */}
            <motion.div
              className="admin-dash-page-title"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <h1>
                Intern Management
              </h1>
              <p>Monitor and manage intern logbook submissions</p>
            </motion.div>

            {/* ══════════════ KPI STAT CARDS ══════════════ */}
            <motion.div
              className="admin-dash-stats"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
            >
              {[
                {
                  label: "Total Interns",
                  value: dashboardStats?.totalInterns || 0,
                  icon: FaUsers,
                  accent: BRAND.primary,
                  bg: BRAND.primaryLight,
                },
                {
                  label: "Submitted",
                  value: dashboardStats?.submittedInterns || 0,
                  icon: FaCheckCircle,
                  accent: BRAND.success,
                  bg: BRAND.successLight,
                },
                {
                  label: "Overdue",
                  value: dashboardStats?.overdueInterns || 0,
                  icon: FaExclamationTriangle,
                  accent: BRAND.danger,
                  bg: BRAND.dangerLight,
                },
                {
                  label: "Total Records",
                  value: dashboardStats?.totalRecords || 0,
                  icon: FaTasks,
                  accent: BRAND.accent,
                  bg: BRAND.accentLight,
                },
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  className="admin-dash-stat-card"
                  style={{ borderLeftColor: stat.accent }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.08, duration: 0.35 }}
                  whileHover={{ y: -3, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
                >
                  <div className="admin-dash-stat-card__icon" style={{ background: stat.bg }}>
                    <stat.icon style={{ color: stat.accent, fontSize: 18 }} />
                  </div>
                  <div className="admin-dash-stat-card__text">
                    <span className="admin-dash-stat-card__value" style={{ color: stat.accent }}>
                      {stat.value}
                    </span>
                    <span className="admin-dash-stat-card__label">{stat.label}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* ══════════════ COMMAND CENTER (Tabs) ══════════════ */}
            <motion.div
              className="admin-dash-command"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.35 }}
            >
              {/* Tab bar */}
              <div className="admin-dash-tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`admin-dash-tab ${activeTab === tab.id ? "admin-dash-tab--active" : ""}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <tab.icon className="admin-dash-tab__icon" />
                    <span>{tab.label}</span>
                    {tab.badge > 0 && (
                      <span className="admin-dash-tab__badge">{tab.badge}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab panels */}
              <div className="admin-dash-tab-panels">
                <AnimatePresence mode="wait">
                  {/* ── TAB: Actions ── */}
                  {activeTab === "actions" && (
                    <motion.div
                      key="tab-actions"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                      className="admin-dash-tab-panel"
                    >
                      <div className="admin-dash-actions-grid">
                        {quickActions.map((action) => (
                          <motion.button
                            key={action.label}
                            onClick={() => navigate(action.route)}
                            whileHover={{ scale: 1.04, y: -2 }}
                            whileTap={{ scale: 0.96 }}
                            className="admin-dash-action-btn"
                          >
                            <div
                              className="admin-dash-action-btn__icon"
                              style={{ background: `${action.color}14`, color: action.color }}
                            >
                              <action.icon />
                            </div>
                            <span className="admin-dash-action-btn__label">{action.label}</span>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* ── TAB: Exports ── */}
                  {activeTab === "exports" && (
                    <motion.div
                      key="tab-exports"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                      className="admin-dash-tab-panel"
                    >
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
                          <p className="admin-dash-exports__section-title">Non-Submissions Report</p>

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
                                  onChange={(e) => setCustomStartDate(e.target.value)}
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
                  )}

                  {/* ── TAB: Alerts ── */}
                  {activeTab === "alerts" && (
                    <motion.div
                      key="tab-alerts"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                      className="admin-dash-tab-panel"
                    >
                      {/* Alerts header actions */}
                      <div className="admin-dash-alerts-header">
                        <h3>
                          Overdue Interns
                          <span className="admin-dash-alerts-header__count">
                            {dashboardStats?.overdueList?.length || 0}
                          </span>
                        </h3>
                        <div className="admin-dash-alerts-header__actions">
                          <motion.button
                            onClick={handleExportOverdueCSV}
                            disabled={!dashboardStats?.overdueList?.length}
                            whileHover={{ scale: !dashboardStats?.overdueList?.length ? 1 : 1.03 }}
                            whileTap={{ scale: !dashboardStats?.overdueList?.length ? 1 : 0.97 }}
                            className="admin-dash-btn admin-dash-btn--warning"
                          >
                            <FaFileExport style={{ marginRight: 6 }} />
                            Export List
                          </motion.button>
                          <motion.button
                            onClick={handleSendNotifications}
                            disabled={sendingNotifications || !dashboardStats?.overdueList?.length}
                            whileHover={{
                              scale:
                                sendingNotifications || !dashboardStats?.overdueList?.length
                                  ? 1
                                  : 1.03,
                            }}
                            whileTap={{
                              scale:
                                sendingNotifications || !dashboardStats?.overdueList?.length
                                  ? 1
                                  : 0.97,
                            }}
                            className="admin-dash-btn admin-dash-btn--danger"
                          >
                            {sendingNotifications ? (
                              <FaSpinner className="animate-spin" style={{ marginRight: 6 }} />
                            ) : (
                              <FaRegPaperPlane style={{ marginRight: 6 }} />
                            )}
                            Remind All
                          </motion.button>
                        </div>
                      </div>

                      {/* Overdue list */}
                      {dashboardStats?.overdueList?.length > 0 ? (
                        <div className="admin-dash-overdue-list">
                          {dashboardStats.overdueList.map((intern) => (
                            <motion.div
                              key={intern._id}
                              className="admin-dash-overdue-item"
                              whileHover={{ scale: 1.005 }}
                              transition={{ duration: 0.15 }}
                            >
                              <div className="admin-dash-overdue-item__info">
                                <p className="admin-dash-overdue-item__name">{intern.traineeName}</p>
                                <p className="admin-dash-overdue-item__meta">
                                  {intern.traineeId} · {intern.email}
                                </p>
                              </div>
                              <div className="admin-dash-overdue-item__date">
                                <FaClock style={{ fontSize: 11, marginRight: 4, opacity: 0.6 }} />
                                {intern.lastSubmission
                                  ? formatDateDisplay(intern.lastSubmission)
                                  : "Never submitted"}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="admin-dash-empty admin-dash-empty--sm">
                          <FaCheckCircle style={{ fontSize: 28, color: BRAND.success, marginBottom: 8 }} />
                          <p>No overdue interns — all caught up!</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* ══════════════ SEARCH & FILTER ══════════════ */}
            <motion.div
              className="admin-dash-search-section"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.3 }}
            >
              {/* Search input */}
              <div className="admin-dash-search-bar">
                <FaSearch className="admin-dash-search-bar__icon" />
                <input
                  type="text"
                  placeholder="Search by name, trainee ID, or email…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="admin-dash-search-bar__input"
                />
                {searchLoading && (
                  <FaSpinner className="admin-dash-search-bar__spinner animate-spin" />
                )}
              </div>
              {searchTerm.length > 0 && searchTerm.length < 2 && (
                <p className="admin-dash-search-hint">Type at least 2 characters to search</p>
              )}

              {/* Filter pills + sort */}
              <div className="admin-dash-filters">
                <div className="admin-dash-filter-pills">
                  {filterPills.map((pill) => (
                    <button
                      key={pill.value}
                      className={`admin-dash-pill ${filterStatus === pill.value ? "admin-dash-pill--active" : ""}`}
                      onClick={() => setFilterStatus(pill.value)}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
                <div className="admin-dash-sort">
                  <FaSort style={{ color: "#9ca3af", flexShrink: 0 }} />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="admin-dash-sort__select"
                  >
                    <option value="name">Name</option>
                    <option value="id">Trainee ID</option>
                    <option value="records">Records</option>
                    <option value="lastSubmitted">Last Submitted</option>
                  </select>
                </div>
              </div>
            </motion.div>

            {/* ══════════════ INTERN RESULTS ══════════════ */}
            <motion.div
              className="admin-dash-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.3 }}
            >
              {/* Results header */}
              <div className="admin-dash-results__header">
                <h2>
                  {!hasSearched && filterStatus === "all"
                    ? "Search for Interns"
                    : `Results (${filteredInterns.length})`}
                </h2>
                {!hasSearched && filterStatus === "all" && (
                  <p>Use the search bar or filters above to find interns</p>
                )}
              </div>

              {/* Empty / Placeholder states */}
              {!hasSearched && filterStatus === "all" ? (
                <div className="admin-dash-empty">
                  <div className="admin-dash-empty__icon-wrapper">
                    <FaSearch style={{ fontSize: 28, color: BRAND.accent }} />
                  </div>
                  <h3>Find Interns Instantly</h3>
                  <p>
                    Type a name, trainee ID, or email above to search — or pick a
                    filter to browse by status.
                  </p>
                  <div className="admin-dash-empty__tip">
                    💡 <strong>Tip:</strong> Select "Overdue" filter to quickly see
                    who needs attention.
                  </div>
                </div>
              ) : filteredInterns.length === 0 ? (
                <div className="admin-dash-empty">
                  <FaUser style={{ fontSize: 32, color: "#d1d5db", marginBottom: 8 }} />
                  <h3>No interns found</h3>
                  <p>Try adjusting your search or filters.</p>
                </div>
              ) : (
                <>
                  {/* ── Mobile Card View ── */}
                  <div className="admin-dash-cards-mobile">
                    {filteredInterns.map((intern, idx) => (
                      <motion.div
                        key={intern._id}
                        className={`admin-dash-intern-card ${
                          intern.isOverdue
                            ? "admin-dash-intern-card--danger"
                            : intern.totalRecords > 0
                            ? "admin-dash-intern-card--success"
                            : "admin-dash-intern-card--neutral"
                        }`}
                        onClick={() => navigate(`/admin/intern/${intern._id}`)}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03, duration: 0.25 }}
                        whileHover={{ y: -2 }}
                      >
                        <div className="admin-dash-intern-card__top">
                          <div className="admin-dash-intern-card__avatar">
                            {(intern.traineeName || "?")[0].toUpperCase()}
                          </div>
                          <div className="admin-dash-intern-card__identity">
                            <span className="admin-dash-intern-card__name">
                              {intern.traineeName || "N/A"}
                            </span>
                            <span className="admin-dash-intern-card__id">
                              {intern.traineeId || "N/A"}
                            </span>
                          </div>
                          {getStatusBadge(intern)}
                        </div>

                        <div className="admin-dash-intern-card__details">
                          <div className="admin-dash-intern-card__detail">
                            <span>📧</span>
                            <span>{intern.email || "N/A"}</span>
                          </div>
                          <div className="admin-dash-intern-card__detail">
                            <span>🎯</span>
                            <span>{intern.fieldOfSpecialization || "N/A"}</span>
                          </div>
                          <div className="admin-dash-intern-card__detail">
                            <span>🗓️</span>
                            <span>
                              {intern.trainingStartDate
                                ? formatDateDisplay(intern.trainingStartDate)
                                : "N/A"}{" "}
                              –{" "}
                              {intern.trainingEndDate
                                ? formatDateDisplay(intern.trainingEndDate)
                                : "N/A"}
                            </span>
                          </div>
                        </div>

                        <div className="admin-dash-intern-card__footer">
                          <span>
                            <strong>{intern.totalRecords || 0}</strong> records
                          </span>
                          <span>
                            Last:{" "}
                            {intern.lastSubmission
                              ? formatDateDisplay(intern.lastSubmission)
                              : "Never"}
                          </span>
                          {intern.daysSinceLastSubmission !== null &&
                            intern.daysSinceLastSubmission !== undefined && (
                              <span className="admin-dash-intern-card__days-ago">
                                {intern.daysSinceLastSubmission}d ago
                              </span>
                            )}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* ── Desktop Table View ── */}
                  <div className="admin-dash-table-wrapper">
                    <table className="admin-dash-table">
                      <thead>
                        <tr>
                          <th>Intern</th>
                          <th>Contact</th>
                          <th>Training Period</th>
                          <th>Records</th>
                          <th>Last Submission</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInterns.map((intern) => (
                          <motion.tr
                            key={intern._id}
                            className="admin-dash-table__row"
                            onClick={() => navigate(`/admin/intern/${intern._id}`)}
                            whileHover={{ backgroundColor: `${BRAND.accent}08` }}
                            transition={{ duration: 0.15 }}
                          >
                            <td>
                              <div className="admin-dash-table__intern-cell">
                                <div className="admin-dash-table__avatar">
                                  {(intern.traineeName || "?")[0].toUpperCase()}
                                </div>
                                <div>
                                  <div className="admin-dash-table__name">
                                    {intern.traineeName || "N/A"}
                                  </div>
                                  <div className="admin-dash-table__sub">
                                    {intern.traineeId || "N/A"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="admin-dash-table__name" title={intern.email}>
                                {intern.email || "N/A"}
                              </div>
                              <div className="admin-dash-table__sub" title={intern.fieldOfSpecialization}>
                                {intern.fieldOfSpecialization || "N/A"}
                              </div>
                            </td>
                            <td>
                              <div className="admin-dash-table__name">
                                {intern.trainingStartDate
                                  ? formatDateDisplay(intern.trainingStartDate)
                                  : "N/A"}
                              </div>
                              <div className="admin-dash-table__sub">
                                to{" "}
                                {intern.trainingEndDate
                                  ? formatDateDisplay(intern.trainingEndDate)
                                  : "N/A"}
                              </div>
                            </td>
                            <td>
                              <span className="admin-dash-table__records-badge">
                                {intern.totalRecords || 0}
                              </span>
                            </td>
                            <td>
                              <div className="admin-dash-table__name">
                                {intern.lastSubmission
                                  ? formatDateDisplay(intern.lastSubmission)
                                  : "Never"}
                              </div>
                              <div className="admin-dash-table__sub">
                                {intern.daysSinceLastSubmission !== null &&
                                intern.daysSinceLastSubmission !== undefined
                                  ? `${intern.daysSinceLastSubmission} days ago`
                                  : "—"}
                              </div>
                            </td>
                            <td>{getStatusBadge(intern)}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
