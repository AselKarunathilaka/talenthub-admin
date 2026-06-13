import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
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
} from "react-icons/fa";
import { motion } from "framer-motion";
import { adminApi, notificationUtils } from "../api/adminApi";
import logo from "../assets/sltlogo.jpg";

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

  const handlePrevDay = () => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() - 1);
    switchDate(toDateStr(d));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + 1);
    switchDate(toDateStr(d));
  };

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

  // CSV export
  const handleExportCSV = () => {
    try {
      if (displayedRecords.length === 0) {
        notificationUtils.showInfo("No records to export.");
        return;
      }

      const fmtDT = (d) => {
        if (!d) return '="N/A"';
        const dt = new Date(d);
        if (isNaN(dt)) return '="N/A"';
        return `="${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}:${String(dt.getSeconds()).padStart(2, "0")}"`;
      };

      const csvData = displayedRecords.map((r) => ({
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
      link.download = `daily_records_${selectedDate}${pagination.totalPages > 1 ? `_p${pagination.page}` : ""}.csv`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      notificationUtils.showSuccess(
        `Exported ${displayedRecords.length} records for ${selectedDate}`,
      );
    } catch (err) {
      notificationUtils.showError("Failed to export CSV");
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
        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        {icon}
      </button>
    );

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
        <p className="text-xs sm:text-sm text-gray-500">
          Showing{" "}
          <span className="font-semibold text-gray-700">
            {from}–{to}
          </span>{" "}
          of <span className="font-semibold text-gray-700">{total}</span>{" "}
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
                <span className="px-1 text-gray-400 text-xs">…</span>
              )}
              <button
                onClick={() => goToPage(p)}
                disabled={pageLoading}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition ${p === page ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-200"}`}
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
  if (loading)
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-t-4 border-b-4 border-green-500 rounded-full mx-auto mb-6"
          />
          <p className="text-gray-600 font-medium">Loading today's records…</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center max-w-md p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-lg">
          <FaExclamationTriangle className="text-4xl text-red-500 mb-4 mx-auto" />
          <p className="text-gray-700 mb-6">{error}</p>
          <div className="flex justify-center space-x-4">
            <motion.button
              onClick={() =>
                fetchRecords({ isInitial: true, date: selectedDate })
              }
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-xl shadow-md"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Retry
            </motion.button>
            <motion.button
              onClick={() => navigate("/admin/dashboard")}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Back to Dashboard
            </motion.button>
          </div>
        </div>
      </div>
    );

  // Main render
  return (
    <AdminNavigation>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-gray-800 overflow-hidden relative">
        {/* Background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[
          {
            cls: "w-80 h-80 bg-blue-100/40 -top-20 -left-20",
            dur: 15,
            delay: 0,
          },
          {
            cls: "w-96 h-96 bg-cyan-100/40 top-1/4 right-0",
            dur: 18,
            delay: 2,
          },
          {
            cls: "w-64 h-64 bg-green-100/40 bottom-20 left-1/4",
            dur: 20,
            delay: 1,
          },
          {
            cls: "w-72 h-72 bg-purple-100/40 bottom-0 right-20",
            dur: 17,
            delay: 3,
          },
        ].map((b, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full ${b.cls}`}
            animate={{ y: [0, -20, 0], x: [0, 15, 0] }}
            transition={{
              duration: b.dur,
              repeat: Infinity,
              ease: "easeInOut",
              delay: b.delay,
            }}
          />
        ))}
      </div>


      {/* Main Content */}
        <div className="p-3 sm:p-4 lg:p-6 relative z-10">
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
                  className="flex items-center px-3 sm:px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all border border-gray-200 shadow-sm"
                  whileHover={{ x: -3 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FaArrowLeft className="mr-2" /> Back to Dashboard
                </motion.button>
                <div>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">
                      Daily Records
                    </span>
                  </h2>
                  <p className="text-sm text-gray-500">
                    Browse submissions day by day
                  </p>
                </div>
              </div>

              {/* Summary pill */}
              <motion.div
                className="bg-white/80 backdrop-blur-sm px-5 py-3 rounded-2xl border border-gray-100 shadow-sm text-right"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15 }}
              >
                <p className="text-xs text-gray-500">
                  Submissions on this date
                </p>
                <p className="text-2xl font-bold text-cyan-600">
                  {pagination.total}
                </p>
              </motion.div>
            </motion.div>

            {/* Date Navigator */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm mb-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* ← Prev */}
                <motion.button
                  onClick={handlePrevDay}
                  disabled={pageLoading}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-40 w-full sm:w-auto justify-center"
                  whileHover={{ x: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaChevronLeft className="h-3 w-3" /> Prev Day
                </motion.button>

                {/* Date picker + label */}
                <div className="flex-1 flex flex-col items-center gap-1.5 w-full">
                  <label className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl px-4 py-2.5 w-full sm:w-auto cursor-pointer shadow-sm hover:shadow-md transition-all">
                    <FaCalendarDay className="text-blue-500 flex-shrink-0" />
                    <input
                      type="date"
                      value={selectedDate}
                      max={todayStr}
                      onChange={handleDateChange}
                      className="bg-transparent border-0 focus:ring-0 focus:outline-none text-gray-900 font-semibold text-sm sm:text-base cursor-pointer w-full"
                    />
                  </label>
                  <p className="text-xs text-gray-500">
                    {prettyDate(selectedDate)}
                  </p>
                </div>

                {/* Next */}
                <motion.button
                  onClick={handleNextDay}
                  disabled={selectedDate >= todayStr || pageLoading}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Next Day <FaChevronRight className="h-3 w-3" />
                </motion.button>

                {/* Today shortcut — only shown when not on today */}
                {selectedDate !== todayStr && (
                  <motion.button
                    onClick={handleGoToToday}
                    disabled={pageLoading}
                    className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md w-full sm:w-auto"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Jump to Today
                  </motion.button>
                )}
              </div>
            </motion.div>

            {/* Search + controls */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm mb-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search by name or Trainee ID within this day…"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400 shadow-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <motion.button
                    onClick={() =>
                      setSortOrder((o) => (o === "desc" ? "asc" : "desc"))
                    }
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 text-sm shadow-sm hover:bg-gray-50"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <FaSort className="text-blue-400" />
                    {sortOrder === "desc" ? "↓ Newest first" : "↑ Oldest first"}
                  </motion.button>
                  <motion.button
                    onClick={handleExportCSV}
                    disabled={displayedRecords.length === 0 || pageLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white rounded-xl text-sm shadow-sm hover:shadow-md transition-all disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <FaFileExport className="h-3.5 w-3.5" /> Export CSV
                  </motion.button>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-2.5">
                {pagination.total === 0
                  ? `No submissions found for ${prettyDate(selectedDate)}`
                  : `${displayedRecords.length} of ${pagination.total} records · page ${pagination.page}/${pagination.totalPages || 1}`}
                {searchTerm && " · filtered by search"}
              </p>
            </motion.div>

            {/* Records Table */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {/* Table title bar */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                    Submissions —{" "}
                    <span className="text-blue-600">
                      {new Date(selectedDate + "T00:00:00").toLocaleDateString(
                        "en-US",
                        { month: "long", day: "numeric", year: "numeric" },
                      )}
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {pagination.total} record{pagination.total !== 1 ? "s" : ""}{" "}
                    total
                  </p>
                </div>
                {pageLoading && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 0.7,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    <FaSpinner className="text-blue-400 h-5 w-5" />
                  </motion.div>
                )}
              </div>

              {/* Body */}
              <div className="relative">
                {/* Page-change overlay */}
                {pageLoading && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 0.7,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="w-10 h-10 border-t-4 border-b-4 border-blue-400 rounded-full"
                    />
                  </div>
                )}

                {!pageLoading && displayedRecords.length === 0 ? (
                  /* Empty state */
                  <motion.div
                    className="text-center py-16 px-4"
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
                      <FaCalendarDay className="mx-auto h-12 w-12 text-gray-200 mb-4" />
                    </motion.div>
                    <h3 className="text-base font-semibold text-gray-500 mb-1">
                      No submissions for this day
                    </h3>
                    <p className="text-sm text-gray-400">
                      {searchTerm
                        ? "No interns match your search for this date."
                        : selectedDate === todayStr
                          ? "No interns have submitted their logbook today yet."
                          : "No logbook entries were submitted on this date."}
                    </p>
                    {selectedDate !== todayStr && (
                      <motion.button
                        onClick={handleGoToToday}
                        className="mt-5 px-5 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm rounded-xl shadow-sm"
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
                    <div className="block lg:hidden divide-y divide-gray-100">
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
                          <motion.div
                            key={record._id}
                            className="p-4 hover:bg-gray-50/60 transition-colors"
                            whileHover={{ y: -1 }}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 flex items-center justify-center shadow-sm flex-shrink-0">
                                  <FaUser className="text-blue-600 h-4 w-4" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {rowNum}. {name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    ID: {tid}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusBadgeClass(status)}`}
                              >
                                {statusLabel(status)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-gray-400">
                                <FaRegClock className="inline mr-1" />
                                {new Date(record.createdAt).toLocaleTimeString(
                                  "en-US",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </p>
                              <motion.button
                                onClick={() =>
                                  navigate(`/admin/intern/${iid}/records`, {
                                    state: { from: "daily-records" },
                                  })
                                }
                                className="flex items-center text-cyan-600 hover:bg-cyan-50 px-2 py-1 rounded-xl text-xs"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <FaEye className="mr-1 h-3 w-3" /> View
                              </motion.button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50/80">
                          <tr>
                            {[
                              "#",
                              "Intern",
                              "Status",
                              "Submitted At",
                              "Actions",
                            ].map((h) => (
                              <th
                                key={h}
                                className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
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
                              <motion.tr
                                key={record._id}
                                className="hover:bg-gray-50/70 transition-colors bg-white"
                                whileHover={{ y: -1 }}
                              >
                                <td className="px-6 py-4 text-sm text-gray-400 w-12">
                                  {rowNum}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 flex items-center justify-center shadow-sm flex-shrink-0">
                                      <FaUser className="text-blue-600" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">
                                        {name}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        ID: {tid}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass(status)}`}
                                  >
                                    {statusLabel(status)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(
                                    record.createdAt,
                                  ).toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <motion.button
                                    onClick={() =>
                                      navigate(`/admin/intern/${iid}/records`, {
                                        state: { from: "daily-records" },
                                      })
                                    }
                                    className="inline-flex items-center gap-1.5 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 px-3 py-1.5 rounded-xl text-sm transition-colors shadow-sm"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    <FaEye className="h-3.5 w-3.5" /> View
                                    Records
                                  </motion.button>
                                </td>
                              </motion.tr>
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
          </div>
        </div>
      </div>
    </AdminNavigation>
  );
};

export default AdminDailyRecords;
