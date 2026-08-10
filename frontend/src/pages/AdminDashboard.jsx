import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUsers,
  FaSearch,
  FaDownload,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaTasks,
  FaSpinner,
  FaRunning,
  FaFileAlt,
  FaRegFileExcel,
  FaClock,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi, csvUtils, notificationUtils } from "../api/adminApi";
import { API_BASE_URL } from "../api/apiConfig";
import AdminNavigation from "../components/AdminNavigation";
import { Home } from "lucide-react";

// Digital Clock Component
const formatDigit = (num) => num.toString().padStart(2, '0');

const DigitalClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const h = formatDigit(time.getHours());
  const m = formatDigit(time.getMinutes());
  const s = formatDigit(time.getSeconds());

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 sm:gap-1.5 text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
        <span className="bg-blue-100/50 text-[#0056a2] rounded-xl shadow-sm border border-blue-200/50 w-10 sm:w-12 h-10 sm:h-12 flex items-center justify-center">{h}</span>
        <span className="text-slate-300 -mt-1">:</span>
        <span className="bg-blue-100/50 text-[#0056a2] rounded-xl shadow-sm border border-blue-200/50 w-10 sm:w-12 h-10 sm:h-12 flex items-center justify-center">{m}</span>
        <span className="text-slate-300 -mt-1">:</span>
        <span className="bg-[#00b4eb]/15 text-[#00b4eb] rounded-xl shadow-sm border border-[#00b4eb]/20 w-10 sm:w-12 h-10 sm:h-12 flex items-center justify-center">{s}</span>
      </div>
      <div className="hidden sm:flex flex-col justify-center border-l-2 border-slate-100 pl-4">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{time.toLocaleDateString('en-US', { weekday: 'short' })}</span>
        <span className="text-sm font-extrabold text-[#0056a2] uppercase">{time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
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
  const [hasSearched, setHasSearched] = useState(false);
  const searchInputRef = useRef(null);

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
    []
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchInterns(searchTerm);
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchInterns]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const handleExportPreviousDayNonSubmissions = async () => {
    try {
      const sriLankaFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const todayInSriLanka = sriLankaFormatter.format(new Date()); 

      const [y, m, d] = todayInSriLanka.split("-").map(Number);
      const yesterday = new Date(Date.UTC(y, m - 1, d - 1));

      const day = yesterday.getUTCDay(); 
      if (day === 0) yesterday.setUTCDate(yesterday.getUTCDate() - 2);
      if (day === 6) yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      const dateStr = yesterday.toISOString().split("T")[0];

      const previousDayNonSubmissionsData = await adminApi.getWeeklyNonSubmissions({
        startDate: dateStr,
        endDate: dateStr,
      });

      previousDayNonSubmissionsData.nonSubmittedInterns = sortByTraineeId(
        previousDayNonSubmissionsData.nonSubmittedInterns,
      );

      if (previousDayNonSubmissionsData.nonSubmittedInterns.length === 0) {
        notificationUtils.showInfo(
          "All interns submitted their logbook records for the previous working day.",
        );
        return;
      }

      await csvUtils.downloadInternReport(
        previousDayNonSubmissionsData,
        `weekly_non_submissions_previous_day_${dateStr}`,
      );
      notificationUtils.showSuccess(
        `Previous day non-submissions CSV report with ${previousDayNonSubmissionsData.nonSubmittedInterns.length} interns downloaded successfully.`,
      );
    } catch (error) {
      console.error("Error exporting previous day non-submissions CSV:", error);
      notificationUtils.showError(
        "Failed to export previous day non-submissions CSV report",
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

  const filteredInterns = internReport || [];

  const getStatusBadge = (intern) => {
    if (intern.isNonSubmitting || intern.isOverdue) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
          <FaExclamationTriangle className="mr-1.5" /> Non-Submitting
        </span>
      );
    } else if (intern.totalRecords === 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
          <FaTimesCircle className="mr-1.5" /> Not Submitted
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
          <FaCheckCircle className="mr-1.5" /> Submitted
        </span>
      );
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center p-8 bg-white rounded-3xl shadow-xl border border-slate-100 max-w-sm">
          <FaExclamationTriangle className="text-5xl text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-semibold mb-6">{error}</p>
          <button
            onClick={fetchData}
            className="px-6 py-3 bg-[#0056a2] text-white rounded-xl font-bold hover:bg-[#004482] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminNavigation>
      {/* Background using pure Tailwind */}
      <div className="min-h-screen relative overflow-hidden bg-white font-sans text-slate-800 pb-16 flex flex-col">
        
        {/* Blur Overlay when Searching */}
        <AnimatePresence>
          {searchTerm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-20 bg-white/60 backdrop-blur-md cursor-pointer"
              onClick={() => { setSearchTerm(""); setHasSearched(false); setInternReport([]); }}
            />
          )}
        </AnimatePresence>

        <main className="relative flex-1 p-4 sm:p-8 mx-auto max-w-[1400px] w-full flex flex-col gap-8">
          
          {/* Top Header with Clock */}
          <div className="relative z-30 flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-4xl sm:text-5xl font-extrabold text-slate-900 flex items-center gap-4 tracking-tight"
              >
                <div className="p-3.5 bg-white shadow-sm shadow-[#0056a2]/10 rounded-2xl border border-slate-100">
                  <Home className="text-[#0056a2] h-8 w-8" />
                </div>
                Dashboard
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="text-slate-500 mt-3 text-base sm:text-lg font-medium max-w-xl"
              >
                Overview of intern attendance, logbook submissions, and statistics
              </motion.p>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="bg-blue-50/50 backdrop-blur-md px-5 py-4 rounded-3xl border border-blue-100/50 shadow-sm self-start md:self-auto"
            >
              <DigitalClock />
            </motion.div>
          </div>

          {/* Search */}
          <section className="w-full z-50 mt-4 relative">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <div
                className={`relative bg-blue-50/80 backdrop-blur-2xl rounded-3xl border-2 transition-all duration-200 ease-out flex items-center px-6 py-5 shadow-lg hover:scale-[1.015] ${
                  searchTerm 
                    ? 'border-[#00b4eb] shadow-[0_8px_30px_rgb(0,180,235,0.2)] bg-white scale-[1.015]' 
                    : 'border-blue-100 hover:border-[#00b4eb]/50 hover:shadow-[0_8px_30px_rgb(0,180,235,0.12)]'
                }`}
              >
                <FaSearch className={`text-2xl mr-4 flex-shrink-0 transition-colors ${searchTerm ? 'text-[#00b4eb]' : 'text-slate-400'}`} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search interns by name, ID, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xl sm:text-2xl font-semibold text-slate-800 placeholder-slate-400 outline-none bg-transparent"
                  aria-label="Search interns"
                  role="combobox"
                  aria-expanded={searchTerm.length >= 2}
                  autoFocus
                />
                {searchLoading && (
                  <FaSpinner className="text-[#00b4eb] text-2xl animate-spin ml-4 flex-shrink-0" />
                )}
                {searchTerm && !searchLoading && (
                  <button
                    onClick={() => { setSearchTerm(""); setHasSearched(false); setInternReport([]); searchInputRef.current?.focus(); }}
                    className="ml-4 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    aria-label="Clear search"
                  >
                    <FaTimesCircle className="text-2xl" />
                  </button>
                )}
              </div>
            </motion.div>

            {/* Results Dropdown */}
            <AnimatePresence>
              {searchTerm.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-[calc(100%+16px)] left-0 right-0 bg-blue-50/95 backdrop-blur-3xl rounded-3xl shadow-2xl border border-blue-100/50 min-h-[220px] max-h-[60vh] overflow-y-auto z-50 p-3 flex flex-col"
                  role="listbox"
                >
                  {!hasSearched ? (
                    <div className="p-10 text-center text-slate-400">
                      <FaSpinner className="text-4xl animate-spin mx-auto mb-4 text-[#00b4eb]" />
                      <p className="font-semibold text-lg">Searching...</p>
                    </div>
                  ) : filteredInterns.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      <FaUsers className="text-5xl mx-auto mb-4 opacity-40 text-slate-300" />
                      <p className="font-semibold text-xl text-slate-600">No interns found</p>
                      <p className="text-sm mt-2">Try searching by trainee ID or a different name.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {filteredInterns.length} Results Found
                      </div>
                      {filteredInterns.map((intern, idx) => (
                        <div
                          key={intern._id}
                          onClick={() => navigate(`/admin/intern/${intern._id}`)}
                          className="flex items-center gap-5 p-4 rounded-2xl hover:bg-slate-50 cursor-pointer transition-all duration-200 border border-transparent hover:border-slate-200 hover:shadow-sm group focus:outline-none focus:bg-slate-50 focus:border-[#00b4eb]"
                          role="option"
                          tabIndex={0}
                          onKeyDown={(e) => {
                             if (e.key === 'Enter') navigate(`/admin/intern/${intern._id}`);
                          }}
                        >
                          <div className="h-14 w-14 rounded-2xl bg-[#00b4eb]/10 text-[#0056a2] flex items-center justify-center font-bold text-xl flex-shrink-0 overflow-hidden shadow-inner relative">
                            <img
                              src={`${API_BASE_URL}/interns/${intern._id}/profile-picture`}
                              alt={intern.traineeName}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                            <div className="w-full h-full flex items-center justify-center hidden bg-gradient-to-br from-[#00b4eb]/20 to-[#0056a2]/20">
                              {(intern.traineeName || "?")[0].toUpperCase()}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-bold text-slate-900 truncate group-hover:text-[#0056a2] transition-colors">
                              {intern.traineeName || "N/A"}
                            </h4>
                            <p className="text-sm font-medium text-slate-500 truncate mt-0.5 flex items-center gap-2">
                              <span className="font-semibold text-slate-600">{intern.traineeId || "N/A"}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              {intern.email || "No Email"}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            {getStatusBadge(intern)}
                            <span className="text-xs font-bold text-slate-400">
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
          </section>

          {/* Bento-Box KPIs */}
          <motion.section 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 z-10"
          >
            {[
              {
                label: "Total Interns",
                value: loading ? "..." : dashboardStats?.totalInterns || 0,
                icon: FaUsers,
                color: "#0056a2", // Primary
                bg: "bg-[#0056a2]/5",
                border: "border-[#0056a2]/10",
                hoverBorder: "hover:border-[#0056a2]/30",
              },
              {
                label: "Total Records",
                value: loading ? "..." : dashboardStats?.totalRecords || 0,
                icon: FaTasks,
                color: "#00b4eb", // Accent
                bg: "bg-[#00b4eb]/5",
                border: "border-[#00b4eb]/10",
                hoverBorder: "hover:border-[#00b4eb]/30",
              },
              {
                label: "Submitted",
                value: loading ? "..." : dashboardStats?.submittedInterns || 0,
                icon: FaCheckCircle,
                color: "#50b748", // Success
                bg: "bg-[#50b748]/5",
                border: "border-[#50b748]/10",
                hoverBorder: "hover:border-[#50b748]/30",
              },
              {
                label: "Non-Submissions",
                value: loading ? "..." : (dashboardStats?.nonSubmittingInterns ?? dashboardStats?.overdueInterns ?? 0),
                icon: FaExclamationTriangle,
                color: "#ef4444", // Danger
                bg: "bg-[#ef4444]/5",
                border: "border-[#ef4444]/10",
                hoverBorder: "hover:border-[#ef4444]/30",
              },
            ].map((stat, idx) => (
              <div
                key={stat.label}
                className={`group bg-blue-50/50 backdrop-blur-xl p-6 rounded-3xl border-2 transition-all duration-300 flex flex-col justify-between hover:bg-blue-50 ${stat.border} ${stat.hoverBorder} shadow-sm hover:shadow-md cursor-default`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-2xl ${stat.bg} transition-transform group-hover:scale-110 duration-300`}>
                    <stat.icon size={22} style={{ color: stat.color }} />
                  </div>
                </div>
                <div>
                  <div className="text-4xl font-extrabold text-slate-900 tracking-tight" style={{ color: stat.color }}>
                    {stat.value}
                  </div>
                  <div className="text-sm font-semibold text-slate-500 mt-1">
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </motion.section>

          {/* Reports & Exports Grid */}
          <motion.section 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="z-10 mt-2"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3 px-1">
                <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-md">
                  <FaDownload className="text-sm" />
                </div>
                <h3 className="text-2xl font-extrabold text-slate-900">Reports & Exports</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              
              <button
                onClick={handleExportSubmittedCSV}
                className="group relative bg-blue-50/50 backdrop-blur-xl p-6 rounded-3xl border-2 border-blue-100 hover:border-[#50b748]/50 hover:bg-blue-50 hover:shadow-xl hover:shadow-[#50b748]/10 transition-all duration-300 text-left overflow-hidden"
              >
                <div className="absolute top-4 right-5 text-[#50b748]/40 group-hover:text-[#50b748] transition-colors z-20"><FaDownload className="text-xl" /></div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#50b748]/10 to-transparent rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110 z-10"></div>
                <FaRegFileExcel className="text-3xl text-[#50b748] mb-4 relative z-20" />
                <h4 className="text-xl font-bold text-slate-900 relative z-20 mb-1">Submissions</h4>
                <p className="text-sm font-medium text-slate-500 relative z-20">Export a complete CSV of all currently submitted interns.</p>
              </button>

              <button
                onClick={handleDownloadOnLeaveExcel}
                className="group relative bg-blue-50/50 backdrop-blur-xl p-6 rounded-3xl border-2 border-blue-100 hover:border-purple-400/50 hover:bg-blue-50 hover:shadow-xl hover:shadow-purple-400/10 transition-all duration-300 text-left overflow-hidden"
              >
                <div className="absolute top-4 right-5 text-purple-500/40 group-hover:text-purple-500 transition-colors z-20"><FaDownload className="text-xl" /></div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-400/10 to-transparent rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110 z-10"></div>
                <FaRegFileExcel className="text-3xl text-purple-500 mb-4 relative z-20" />
                <h4 className="text-xl font-bold text-slate-900 relative z-20 mb-1">On-Leave</h4>
                <p className="text-sm font-medium text-slate-500 relative z-20">Download Excel report of interns currently on leave.</p>
              </button>

              <button
                onClick={handleExportWeeklyNonSubmissionsWithinWeek}
                className="group relative bg-blue-50/50 backdrop-blur-xl p-6 rounded-3xl border-2 border-blue-100 hover:border-[#ef4444]/50 hover:bg-blue-50 hover:shadow-xl hover:shadow-[#ef4444]/10 transition-all duration-300 text-left overflow-hidden"
              >
                <div className="absolute top-4 right-5 text-[#ef4444]/40 group-hover:text-[#ef4444] transition-colors z-20"><FaDownload className="text-xl" /></div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#ef4444]/10 to-transparent rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110 z-10"></div>
                <FaExclamationTriangle className="text-3xl text-[#ef4444] mb-4 relative z-20" />
                <h4 className="text-xl font-bold text-slate-900 relative z-20 mb-1">Non-Submissions</h4>
                <p className="text-sm font-medium text-slate-500 relative z-20">Last 5 working days non-submissions report.</p>
              </button>

              <button
                onClick={handleExportPreviousDayNonSubmissions}
                className="group relative bg-blue-50/50 backdrop-blur-xl p-6 rounded-3xl border-2 border-blue-100 hover:border-[#0056a2]/50 hover:bg-blue-50 hover:shadow-xl hover:shadow-[#0056a2]/10 transition-all duration-300 text-left overflow-hidden"
              >
                <div className="absolute top-4 right-5 text-[#0056a2]/40 group-hover:text-[#0056a2] transition-colors z-20"><FaDownload className="text-xl" /></div>
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#0056a2]/10 to-transparent rounded-bl-[100px] -mr-4 -mt-4 transition-transform group-hover:scale-110 z-10"></div>
                <FaClock className="text-3xl text-[#0056a2] mb-4 relative z-20" />
                <h4 className="text-xl font-bold text-slate-900 relative z-20 mb-1">Previous Day</h4>
                <p className="text-sm font-medium text-slate-500 relative z-20">Non-submissions report for the previous working day.</p>
              </button>

            </div>

            {/* Custom Date Range */}
            <div className="mt-6 bg-blue-50/50 backdrop-blur-xl p-6 md:p-8 rounded-3xl border-2 border-blue-100 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
              <div>
                <h4 className="text-xl font-bold text-slate-900">Custom Date Range Export</h4>
                <p className="text-sm font-medium text-slate-500 mt-1">Export non-submission data between specific dates.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                <div className="flex items-center bg-white/80 border-2 border-blue-200 rounded-2xl p-1.5 focus-within:border-[#00b4eb] transition-colors w-full sm:w-auto shadow-inner">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-2 outline-none text-sm font-bold text-slate-700 bg-transparent"
                    aria-label="Start date"
                  />
                  <span className="text-slate-300 mx-2 font-bold px-1">→</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-2 outline-none text-sm font-bold text-slate-700 bg-transparent"
                    aria-label="End date"
                  />
                </div>
                <button
                  onClick={handleExportWeeklyNonSubmissionsCSV}
                  className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <FaDownload /> Download Range
                </button>
              </div>
            </div>
          </motion.section>
        </main>
      </div>

    </AdminNavigation>
  );
};

export default AdminDashboard;
