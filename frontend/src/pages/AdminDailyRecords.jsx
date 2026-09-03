import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import { BookOpen } from "lucide-react";
import {
  FaSearch,
  FaCalendarAlt,
  FaUser,
  FaArrowLeft,
  FaSort,
  FaFileExport,
  FaEye,
  FaExclamationTriangle,
  FaShieldAlt,
  FaRegClock,
  FaChevronLeft,
  FaChevronRight,
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
  FaSpinner,
  FaCalendarDay,
  FaTimes,
  FaDownload,
} from "react-icons/fa";
import { motion } from "framer-motion";
import { adminApi, notificationUtils } from "../api/adminApi";
import { API_BASE_URL } from "../api/apiConfig";


const LIMIT = 50;

// "YYYY-MM-DD" in local time (avoids UTC midnight shift)
const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayStr = toDateStr(new Date());

const AdminDailyRecords = () => {
  const navigate = useNavigate();

  // data
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: LIMIT,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // ui
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState(null);

  // filters
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");

  const [exporting, setExporting] = useState(false);

  const searchTimer = useRef(null);

  // Core fetch
  const fetchRecords = useCallback(
    async ({
      page = 1,
      date = selectedDate,
      search = searchTerm,
      isInitial = false,
    } = {}) => {
      try {
        isInitial ? setLoading(true) : setPageLoading(true);
        setError(null);

        const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
        if (!adminInfo.token) {
          setError("Admin authentication required");
          navigate("/admin-login");
          return;
        }

        const data = await adminApi.getAllDailyRecords({
          page,
          limit: LIMIT,
          search,
          date,
        });
        setRecords(data.records);
        setPagination(data.pagination);
      } catch (err) {
        console.error("Error fetching daily records:", err);
        setError("Failed to load daily records. Please try again.");
        if (err.message?.includes("403") || err.message?.includes("401")) {
          localStorage.removeItem("adminInfo");
          navigate("/admin-login");
        }
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    },
    [navigate],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchRecords({ isInitial: true, date: todayStr });
  }, [fetchRecords]);

  // Handlers
  const switchDate = (val) => {
    setSelectedDate(val);
    setSearchTerm("");
    fetchRecords({ page: 1, date: val, search: "" });
  };

  const handleDateChange = (e) => switchDate(e.target.value);
  const handleGoToToday = () => switchDate(todayStr);

  // Debounced search within current date
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchRecords({ page: 1, date: selectedDate, search: val });
    }, 400);
  };

  const goToPage = (p) =>
    fetchRecords({ page: p, date: selectedDate, search: searchTerm });

  // Sort is local only (just reverses current page slice)
  const displayedRecords =
    sortOrder === "desc" ? records : [...records].reverse();

  // Fetch every page for the given date/search so export isn't limited to
  // whatever page happens to be loaded in the table.
  const fetchAllRecordsForExport = async (date, search) => {
    const EXPORT_PAGE_SIZE = 200; // fewer round-trips than the UI's LIMIT of 50
    const all = [];

    // First page also tells us the true total / totalPages for this filter.
    const first = await adminApi.getAllDailyRecords({
      page: 1,
      limit: EXPORT_PAGE_SIZE,
      search,
      date,
    });
    all.push(...(first.records || []));

    const totalPages = first.pagination?.totalPages || 1;
    for (let page = 2; page <= totalPages; page++) {
      const next = await adminApi.getAllDailyRecords({
        page,
        limit: EXPORT_PAGE_SIZE,
        search,
        date,
      });
      all.push(...(next.records || []));
    }

    return all;
  };

  // CSV export — pulls the full result set for the selected date (not just
  // the current page) so the export always matches the "Submissions" total.
  const handleExportCSV = async () => {
    if (exporting) return;

    try {
      setExporting(true);

      const allRecords = await fetchAllRecordsForExport(
        selectedDate,
        searchTerm,
      );

      if (allRecords.length === 0) {
        notificationUtils.showInfo("No records to export.");
        return;
      }

      const sortedRecords =
        sortOrder === "desc" ? allRecords : [...allRecords].reverse();

      const fmtDT = (d) => {
        if (!d) return '="N/A"';
        const dt = new Date(d);
        if (isNaN(dt)) return '="N/A"';
        return `="${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}:${String(dt.getSeconds()).padStart(2, "0")}"`;
      };

      const csvData = sortedRecords.map((r) => ({
        Date: `="${r.date || "N/A"}"`,
        "Trainee Name": `"${r.internId?.Trainee_Name || r.Trainee_Name || "N/A"}"`,
        "Trainee ID": r.internId?.Trainee_ID || r.Trainee_ID || "N/A",
        Status: r.status || "working",
        "Submitted At": fmtDT(r.createdAt),
      }));

      const headers = Object.keys(csvData[0]);
      const csv = [
        headers.join(","),
        ...csvData.map((row) =>
          headers
            .map((h) => {
              const v = String(row[h] || "");
              return v.includes(",") || v.includes('"')
                ? `"${v.replace(/"/g, '""')}"`
                : v;
            })
            .join(","),
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `daily_records_${selectedDate}.csv`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      notificationUtils.showSuccess(
        `Exported ${sortedRecords.length} record${sortedRecords.length !== 1 ? "s" : ""} for ${selectedDate}`,
      );
    } catch (err) {
      console.error(err);
      notificationUtils.showError("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  };

  // Pretty date label
  const prettyDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    const long = d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (dateStr === todayStr) return `Today — ${long}`;
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    if (dateStr === toDateStr(yest)) return `Yesterday — ${long}`;
    return long;
  };

  // Status badge helper
  const statusBadgeClass = (s) =>
    ({
      working: "bg-green-100 text-green-700 border-green-200",
      wfh: "bg-blue-100  text-blue-700  border-blue-200",
      leave: "bg-orange-100 text-orange-700 border-orange-200",
      study_leave: "bg-sky-100 text-sky-700 border-sky-200",
    })[s] || "bg-gray-100 text-gray-600 border-gray-200";

  const statusLabel = (s) =>
    s === "wfh"
      ? "WFH"
      : s === "study_leave"
        ? "Extended Leave"
        : s
          ? s.charAt(0).toUpperCase() + s.slice(1)
          : "Working";

  // Pagination bar
  const PaginationBar = () => {
    const { page, totalPages, total, limit, hasNextPage, hasPrevPage } =
      pagination;
    if (!total) return null;

    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    const pageNums = (() => {
      if (totalPages <= 7)
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      const s = new Set([1, totalPages]);
      for (
        let i = Math.max(2, page - 2);
        i <= Math.min(totalPages - 1, page + 2);
        i++
      )
        s.add(i);
      return [...s].sort((a, b) => a - b);
    })();

    const btn = (onClick, disabled, icon, title) => (
      <button
        onClick={onClick}
        disabled={disabled || pageLoading}
        title={title}
        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none"
      >
        {icon}
      </button>
    );

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200/80 bg-slate-50/80 rounded-b-xl sm:rounded-b-[14px] md:rounded-b-2xl">
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Showing{" "}
          <span className="font-bold text-slate-700">
            {from} - {to}
          </span>{" "}
          of <span className="font-bold text-slate-700">{total}</span>{" "}
          records
        </p>
        <div className="flex items-center gap-1">
          {btn(
            () => goToPage(1),
            !hasPrevPage,
            <FaAngleDoubleLeft className="h-3 w-3" />,
            "First",
          )}
          {btn(
            () => goToPage(page - 1),
            !hasPrevPage,
            <FaChevronLeft className="h-3 w-3" />,
            "Previous",
          )}
          {pageNums.map((p, idx, arr) => (
            <React.Fragment key={p}>
              {arr[idx - 1] && p - arr[idx - 1] > 1 && (
                <span className="px-1 text-slate-400 text-xs font-bold">…</span>
              )}
              <button
                onClick={() => goToPage(p)}
                disabled={pageLoading}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all focus:outline-none ${p === page ? "bg-gradient-to-r from-[#000066] to-[#006600] text-white shadow-md shadow-[#006600]/20" : "text-slate-600 hover:bg-slate-200"}`}
              >
                {p}
              </button>
            </React.Fragment>
          ))}
          {btn(
            () => goToPage(page + 1),
            !hasNextPage,
            <FaChevronRight className="h-3 w-3" />,
            "Next",
          )}
          {btn(
            () => goToPage(totalPages),
            !hasNextPage,
            <FaAngleDoubleRight className="h-3 w-3" />,
            "Last",
          )}
        </div>
      </div>
    );
  };

  // Loading / error screens
  if (error)
    return (
      <AdminNavigation>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="text-center max-w-md p-8 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <FaExclamationTriangle className="text-4xl text-red-500 mb-4 mx-auto" />
            <p className="text-gray-700 mb-6">{error}</p>
            <div className="flex justify-center">
              <motion.button
                onClick={() =>
                  fetchRecords({ isInitial: true, date: selectedDate })
                }
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-xl shadow-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Retry
              </motion.button>
            </div>
          </div>
        </div>
      </AdminNavigation>
    );

  // Main render
  return (
    <AdminNavigation>
      <div className="min-h-full relative font-sans text-slate-800 flex flex-col select-none">
        <main className="relative flex-1 p-3 sm:p-6 sm:px-8 mx-auto max-w-[1400px] w-full flex flex-col gap-5 sm:gap-6 min-w-0">
          {/* Header Section */}
          <div className="relative z-30 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6 pt-2">
            {/* Left: Title */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="p-2.5 sm:p-3 md:p-3.5 bg-gradient-to-br from-[#000066] to-[#006600] shadow-md rounded-lg sm:rounded-xl md:rounded-2xl border border-[#006600]/20 flex-shrink-0"
              >
                <BookOpen className="text-white h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
              </motion.div>
              <div className="flex flex-col justify-center">
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight"
                >
                  Daily Logs
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="text-slate-500 mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base font-medium max-w-xl"
                >
                  Browse daily logbook submissions
                </motion.p>
              </div>
            </div>

            {/* Right: Stats & Date Filter */}
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full xl:w-auto">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.3 }} className="bg-white rounded-xl md:rounded-[16px] shadow-sm border border-slate-200/80 px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 md:py-4 flex flex-wrap sm:flex-nowrap items-center gap-3 w-full xl:w-auto">
                <div className="flex-1 min-w-[200px] bg-slate-50 rounded-lg sm:rounded-xl p-2 sm:p-2.5 flex items-center gap-2 sm:gap-3 border border-slate-200/60 focus-within:border-[#000066]/40 focus-within:bg-white transition-all">
                  <div className="bg-white p-1.5 sm:p-2 rounded-lg shadow-sm border border-slate-200/60">
                    <FaCalendarAlt className="text-[#000066] h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 cursor-pointer">Select Date</label>
                    <input 
                      type="date" 
                      value={selectedDate} 
                      max={todayStr} 
                      onChange={handleDateChange} 
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      onMouseDown={(e) => e.preventDefault()}
                      style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                      className="bg-transparent text-xs sm:text-sm font-bold text-slate-800 w-full focus:outline-none focus:ring-0 cursor-pointer" 
                    />
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="flex-1 sm:w-32 text-center p-2 sm:p-3 bg-[#006600]/5 rounded-lg sm:rounded-xl border border-[#006600]/10">
                    <div className="text-xl sm:text-2xl font-black text-[#006600] leading-none mb-1">{loading ? "-" : pagination.total}</div>
                    <div className="text-[9px] sm:text-[10px] font-bold text-[#006600]/70 uppercase tracking-wider">Submissions</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

            {/* Search Bar */}
            <motion.div
              className="bg-white p-4 md:p-5 lg:p-6 rounded-xl sm:rounded-[14px] md:rounded-2xl border border-slate-200/80 shadow-md mb-4 sm:mb-6 z-20 relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between space-y-3 lg:space-y-0 lg:space-x-4">
                <div className="flex-1">
                  <label htmlFor="search-input" className="block text-[10px] sm:text-xs lg:text-sm font-bold text-slate-700 mb-1.5 sm:mb-2">Search Records</label>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1 group">
                      <FaSearch className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-[#000066]/70 transition-colors h-3.5 w-3.5 sm:h-4 sm:w-5" />
                      <input
                        id="search-input"
                        type="text"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        placeholder="Search by name or Trainee ID within this day..."
                        className="w-full pl-8 sm:pl-11 pr-3 sm:pr-4 py-2 sm:py-2.5 lg:py-3 bg-slate-50 border border-slate-200/80 rounded-lg sm:rounded-xl focus:ring-0 focus:outline-none focus:border-[#000066]/40 text-slate-900 text-xs sm:text-sm shadow-sm transition-all"
                      />
                      {searchTerm && (
                        <button onClick={() => { setSearchTerm(''); fetchRecords({ page: 1, date: selectedDate, search: '' }); }} className="absolute right-2.5 sm:right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-white p-1 rounded-full shadow-sm focus:outline-none">
                          <FaTimes className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 sm:gap-3 pt-2 lg:pt-0 w-full lg:w-auto">
                  <motion.button
                    onClick={() => setSortOrder((o) => (o === "desc" ? "asc" : "desc"))}
                    className="flex-1 lg:flex-none justify-center flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 lg:px-5 py-2 sm:py-2.5 lg:py-3 bg-white border border-slate-200/80 text-slate-700 rounded-lg sm:rounded-xl text-[10px] sm:text-xs lg:text-sm font-bold transition-all shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:shadow-md focus:outline-none"
                  >
                    <FaSort className="text-[#000066] h-2.5 w-2.5 sm:h-3 sm:w-4" />
                    <span>{sortOrder === "desc" ? "↓ Newest" : "↑ Oldest"}</span>
                  </motion.button>
                  <motion.button
                    onClick={handleExportCSV}
                    disabled={pagination.total === 0 || loading || exporting}
                    className="flex-1 lg:flex-none justify-center flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 lg:px-5 py-2 sm:py-2.5 lg:py-3 bg-gradient-to-r from-[#006600] to-[#008800] hover:opacity-95 disabled:opacity-50 disabled:from-slate-400 disabled:to-slate-500 text-white rounded-lg sm:rounded-xl text-[10px] sm:text-xs lg:text-sm font-bold transition-all shadow-md shadow-[#006600]/20 disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    {exporting ? (
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                        className="inline-flex"
                      >
                        <FaSpinner className="h-2.5 w-2.5 sm:h-3 sm:w-4" />
                      </motion.span>
                    ) : (
                      <FaDownload className="h-2.5 w-2.5 sm:h-3 sm:w-4" />
                    )}
                    <span>{exporting ? "Exporting..." : "Export CSV"}</span>
                  </motion.button>
                </div>
              </div>

              <p className="text-[9px] sm:text-[10px] lg:text-xs text-slate-500 mt-2 sm:mt-3 font-medium">
                {loading
                  ? "Loading records..."
                  : pagination.total === 0
                    ? `No submissions found for ${prettyDate(selectedDate)}`
                    : `${displayedRecords.length} of ${pagination.total} records · page ${pagination.page}/${pagination.totalPages || 1}`}
                {searchTerm && !loading && " · filtered by search"}
              </p>
            </motion.div>

            {/* Records Table */}
            <motion.div
              className="bg-white rounded-xl sm:rounded-[14px] md:rounded-2xl border border-slate-200/80 shadow-md overflow-hidden relative z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              {/* Table title bar */}
              <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-200/80 flex items-center justify-between bg-white">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                    Submissions - {" "}
                    <span className="text-[#000066]">
                      {new Date(selectedDate + "T00:00:00").toLocaleDateString(
                        "en-US",
                        { month: "long", day: "numeric", year: "numeric" },
                      )}
                    </span>
                  </h2>
                  <p className="text-[10px] sm:text-xs text-slate-500 font-semibold mt-0.5">
                    {loading ? "Loading..." : `${pagination.total} record${pagination.total !== 1 ? "s" : ""} total`}
                  </p>
                </div>
                {(loading || pageLoading) && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 0.7,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    <FaSpinner className="text-[#000066] h-4 w-4 sm:h-5 sm:w-5" />
                  </motion.div>
                )}
              </div>

              {/* Body */}
              <div className="relative min-h-[300px]">
                {/* Page-change overlay */}
                {(loading || pageLoading) && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 0.7,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="w-10 h-10 border-t-4 border-b-4 border-[#000066] rounded-full"
                    />
                  </div>
                )}

                {!loading && !pageLoading && displayedRecords.length === 0 ? (
                  /* Empty state */
                  <motion.div
                    className="text-center py-12 sm:py-16 px-4"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <FaCalendarDay className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-slate-200 mb-3 sm:mb-4" />
                    </motion.div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-500 mb-1">
                      No submissions for this day
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-sm mx-auto">
                      {searchTerm
                        ? "No interns match your search for this date."
                        : selectedDate === todayStr
                          ? "No interns have submitted their logbook today yet."
                          : "No logbook entries were submitted on this date."}
                    </p>
                    {selectedDate !== todayStr && (
                      <motion.button
                        onClick={handleGoToToday}
                        className="mt-4 sm:mt-5 px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-[#000066] to-[#006600] text-white text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl shadow-md shadow-[#006600]/20 focus:outline-none"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Go to Today
                      </motion.button>
                    )}
                  </motion.div>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="block xl:hidden divide-y divide-slate-200/60">
                      {displayedRecords.map((record, idx) => {
                        const name =
                          record.internId?.Trainee_Name ||
                          record.Trainee_Name ||
                          "N/A";
                        const tid =
                          record.internId?.Trainee_ID ||
                          record.Trainee_ID ||
                          "N/A";
                        const iid = record.internId?._id || record.internId;
                        const status = record.status || "working";
                        const rowNum = (pagination.page - 1) * LIMIT + idx + 1;
                        return (
                          <div
                            key={record._id}
                            className="p-4 hover:bg-slate-50/80 transition-all hover:-translate-y-px"
                          >
                            <div className="flex items-start mb-3 gap-3">
                              <div className="h-10 w-10 rounded-full bg-[#000066]/10 text-[#000066] flex items-center justify-center font-bold text-lg flex-shrink-0 overflow-hidden shadow-inner relative mt-1">
                                <img
                                  src={`${API_BASE_URL}/interns/${iid}/profile-picture`}
                                  alt={name}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                                <div className="w-full h-full flex items-center justify-center hidden bg-gradient-to-br from-[#000066]/20 to-[#006600]/20">
                                  {(name || "?")[0].toUpperCase()}
                                </div>
                              </div>
                              <div className="min-w-0 flex-1 flex flex-col items-start">
                                <span
                                  className={`flex-shrink-0 text-[9px] sm:text-[10px] lg:text-xs px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider mb-1.5 ${statusBadgeClass(status)}`}
                                >
                                  {statusLabel(status)}
                                </span>
                                <p className="text-xs sm:text-sm lg:text-base font-bold text-slate-900 break-words w-full">
                                  {name}
                                </p>
                                <p className="text-[10px] sm:text-xs lg:text-sm font-medium text-slate-500 truncate w-full">
                                  ID: {tid}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] sm:text-xs lg:text-sm font-medium text-slate-400">
                                <FaRegClock className="inline mr-1" />
                                {new Date(record.createdAt).toLocaleTimeString(
                                  "en-US",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </p>
                              <button
                                onClick={() =>
                                  navigate(`/admin/intern/${iid}/records`, {
                                    state: { from: "daily-records" },
                                  })
                                }
                                className="flex items-center text-[#000066] hover:bg-[#000066]/10 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs lg:text-sm font-bold transition-all hover:scale-105 active:scale-95"
                              >
                                <FaEye className="mr-1.5 h-3 w-3" /> View
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden xl:block overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/80">
                          <tr>
                            {[
                              { label: "#", align: "left" },
                              { label: "Intern", align: "left" },
                              { label: "Status", align: "center" },
                              { label: "Submitted At", align: "center" },
                              { label: "Actions", align: "center" },
                            ].map((h) => (
                              <th
                                key={h.label}
                                className={`px-5 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-[9px] sm:text-[10px] md:text-xs lg:text-sm text-${h.align}`}
                              >
                                {h.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {displayedRecords.map((record, idx) => {
                            const name =
                              record.internId?.Trainee_Name ||
                              record.Trainee_Name ||
                              "N/A";
                            const tid =
                              record.internId?.Trainee_ID ||
                              record.Trainee_ID ||
                              "N/A";
                            const iid = record.internId?._id || record.internId;
                            const status = record.status || "working";
                            const rowNum =
                              (pagination.page - 1) * LIMIT + idx + 1;
                            return (
                              <tr
                                key={record._id}
                                className="hover:bg-slate-50/80 transition-colors group"
                              >
                                <td className="px-5 py-4 text-xs sm:text-sm lg:text-base font-medium text-slate-400 w-12">
                                  {rowNum}
                                </td>
                                <td className="px-5 py-4 min-w-[200px] max-w-[250px] sm:max-w-[300px]">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-[#000066]/10 text-[#000066] flex items-center justify-center font-bold text-lg flex-shrink-0 overflow-hidden shadow-inner relative border border-slate-200">
                                      <img
                                        src={`${API_BASE_URL}/interns/${iid}/profile-picture`}
                                        alt={name}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                        }}
                                      />
                                      <div className="w-full h-full flex items-center justify-center hidden bg-gradient-to-br from-[#000066]/20 to-[#006600]/20">
                                        {(name || "?")[0].toUpperCase()}
                                      </div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs sm:text-sm lg:text-base font-bold text-slate-900 group-hover:text-[#000066] transition-colors break-words">
                                        {name}
                                      </p>
                                      <p className="text-[9px] sm:text-[10px] lg:text-xs font-semibold text-slate-500 truncate">
                                        ID: {tid}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] lg:text-xs font-bold uppercase tracking-wider border ${statusBadgeClass(status)}`}
                                  >
                                    {statusLabel(status)}
                                  </span>
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap text-xs sm:text-sm lg:text-base font-medium text-slate-500 text-center">
                                  {new Date(
                                    record.createdAt,
                                  ).toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })}
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                  <button
                                    onClick={() =>
                                      navigate(`/admin/intern/${iid}/records`, {
                                        state: { from: "daily-records" },
                                      })
                                    }
                                    className="inline-flex items-center gap-1.5 text-[#000066] hover:text-white hover:bg-[#000066] px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs lg:text-sm font-bold transition-all shadow-sm border border-[#000066]/20 hover:border-[#000066] hover:shadow-md focus:outline-none hover:scale-105 active:scale-95"
                                  >
                                    <FaEye className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> View
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              <PaginationBar />
            </motion.div>
          </main>
      </div>
    </AdminNavigation>
  );
};

export default AdminDailyRecords;