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
      console.error(err);
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
            
          </div>
        </div>
      </div>
    );

  // Main render
  return (
    <AdminNavigation>
      <div className="min-h-screen bg-slate-50 font-sans text-gray-800 pb-10 flex flex-col">
        <div className="flex-1 w-full lg:mt-4 lg:px-6 xl:px-10">
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
            {/* Header Section */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
                >
                  <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl">
                    <BookOpen className="text-[#0056a2] h-8 w-8" />
                  </div>
                  Daily Logs
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
                >
                  Browse daily logbook submissions
                </motion.p>
              </div>

              {/* Stats & Date Filter */}
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.2 }} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-2 sm:p-3 flex flex-wrap sm:flex-nowrap items-center gap-3">
                <div className="flex-1 min-w-[200px] bg-slate-50 rounded-2xl p-3 flex items-center gap-3 border border-slate-100">
                  <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100"><FaCalendarAlt className="text-[#00b4eb] h-5 w-5" /></div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Select Date</label>
                    <input type="date" value={selectedDate} max={todayStr} onChange={handleDateChange} className="bg-transparent text-sm font-bold text-gray-800 w-full focus:outline-none cursor-pointer" />
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="flex-1 sm:w-32 text-center p-3 bg-blue-50/80 rounded-2xl border border-blue-100">
                    <div className="text-2xl font-black text-cyan-600 leading-none mb-1">{pagination.total}</div>
                    <div className="text-[10px] font-bold text-blue-500/80 uppercase tracking-wider">Submissions</div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Search Bar */}
            <motion.div
              className="bg-white p-4 md:p-6 rounded-3xl border border-gray-100 shadow-sm mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between space-y-3 lg:space-y-0 lg:space-x-4">
                <div className="flex-1">
                  <label htmlFor="search-input" className="block text-sm font-bold text-gray-700 mb-2">Search Records</label>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        id="search-input"
                        type="text"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        placeholder="Search by name or Trainee ID within this day..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent text-gray-900 text-sm shadow-sm transition-all"
                      />
                      {searchTerm && (
                        <button onClick={() => {setSearchTerm(''); fetchRecords({ page: 1, date: selectedDate, search: '' });}} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-white p-1 rounded-full shadow-sm">
                          <FaTimes className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-6 lg:pt-0">
                  <motion.button
                    onClick={() => setSortOrder((o) => (o === "desc" ? "asc" : "desc"))}
                    className="flex items-center space-x-2 px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-2xl text-sm font-bold transition-all shadow-sm hover:bg-gray-50"
                  >
                    <FaSort className="text-blue-400 h-4 w-4" />
                    <span>{sortOrder === "desc" ? "↓ Newest" : "↑ Oldest"}</span>
                  </motion.button>
                  <motion.button
                    onClick={handleExportCSV}
                    disabled={displayedRecords.length === 0 || pageLoading}
                    className="flex items-center space-x-2 px-5 py-3 bg-[#50b748] hover:bg-[#43a03c] disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-2xl text-sm font-bold transition-all shadow-md shadow-[#50b748]/20 disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    <FaDownload className="h-4 w-4" />
                    <span>Export CSV</span>
                  </motion.button>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-3 font-medium">
                {pagination.total === 0
                  ? `No submissions found for ${prettyDate(selectedDate)}`
                  : `${displayedRecords.length} of ${pagination.total} records · page ${pagination.page}/${pagination.totalPages || 1}`}
                {searchTerm && " · filtered by search"}
              </p>
            </motion.div>

            {/* Records Table */}
            <motion.div
              className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              {/* Table title bar */}
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/80">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                    Submissions —{" "}
                    <span className="text-blue-600">
                      {new Date(selectedDate + "T00:00:00").toLocaleDateString(
                        "en-US",
                        { month: "long", day: "numeric", year: "numeric" },
                      )}
                    </span>
                  </h2>
                  <p className="text-sm text-gray-500 font-medium mt-0.5">
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
                    <FaSpinner className="text-[#00b4eb] h-5 w-5" />
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
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/80 border-b border-gray-100">
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
                                className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
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
                                className="hover:bg-slate-50/50 transition-colors group"
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
          </main>
        </div>
      </div>
    </AdminNavigation>
  );
};

export default AdminDailyRecords;
