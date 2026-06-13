import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaArrowLeft,
  FaSearch,
  FaSync,
  FaCalendar,
  FaEnvelope,
  FaSchool,
  FaChartBar,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaUser,
  FaSignOutAlt,
  FaExclamationTriangle,
  FaSpinner,
  FaHome,
  FaFilter,
  FaSortAmountDown,
  FaClipboardList,
  FaLaptopCode,
  FaTasks,
  FaChevronDown,
  FaChevronUp,
  FaChevronLeft,
  FaChevronRight,
  FaUsers,
  FaRegCalendarAlt,
  FaVideo,
} from "react-icons/fa";
import logo from "../assets/sltlogo.jpg";
import { API_BASE_URL } from "../api/apiConfig";

const PAGE_SIZE = 15;

/* ─── helpers ──────────────────────────────────────────────── */
const fmtDate = (
  d,
  opts = { year: "numeric", month: "short", day: "numeric" },
) => (d ? new Date(d).toLocaleDateString("en-US", opts) : "N/A");

const isSameDay = (a, b) => {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};

const deriveArchiveReason = (archiveReason, archivedAt, trainingEndDate) => {
  if (archivedAt && trainingEndDate) {
    const archived = new Date(archivedAt);
    const end = new Date(trainingEndDate);
    if (isSameDay(archived, end)) return "Inactive";
    if (archived < end) return "Terminated";
  }
  return archiveReason || "N/A";
};

const toKey = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/* ─── AttendanceCalendar ────────────────────────────────────── */
/**
 * Renders a monthly grid calendar with two colored cell types:
 *   • green = daily attendance
 *   • blue  = meeting attendance
 *   • both  = split diagonal pill
 * No absent/rate display — just the two presence types.
 */
function AttendanceCalendar({ dailyMap = {}, meetingMap = {} }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const keyFor = (day) => {
    if (!day) return null;
    return `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="select-none">
      {/* month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
        >
          <FaChevronLeft className="text-xs" />
        </button>
        <span className="text-sm font-semibold text-gray-700">
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
        >
          <FaChevronRight className="text-xs" />
        </button>
      </div>

      {/* day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DOW.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold text-gray-400 py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`blank-${idx}`} />;
          const k = keyFor(day);
          const hasDaily = !!dailyMap[k];
          const hasMeeting = !!meetingMap[k];
          const hasBoth = hasDaily && hasMeeting;
          const isToday =
            day === today.getDate() &&
            viewMonth === today.getMonth() &&
            viewYear === today.getFullYear();

          // Determine cell background
          let cellBg = "bg-white";
          let textColor = "text-gray-500";
          let ring = "";

          if (hasBoth) {
            // split: left green, right blue via gradient
            cellBg = "bg-gradient-to-r from-green-400 to-blue-500";
            textColor = "text-white font-bold";
          } else if (hasDaily) {
            cellBg = "bg-green-100 border border-green-300";
            textColor = "text-green-800 font-semibold";
          } else if (hasMeeting) {
            cellBg = "bg-blue-100 border border-blue-300";
            textColor = "text-blue-800 font-semibold";
          }

          if (isToday && !hasDaily && !hasMeeting) {
            ring = "ring-2 ring-gray-300";
            textColor = "text-gray-700 font-bold";
          }

          const dailyCount = hasDaily ? dailyMap[k].length : 0;
          const meetingCount = hasMeeting ? meetingMap[k].length : 0;

          return (
            <div
              key={k}
              title={
                hasBoth
                  ? `Daily: ${dailyCount} · Meeting: ${meetingCount}`
                  : hasDaily
                    ? `Daily attendance: ${dailyCount}`
                    : hasMeeting
                      ? `Meeting attendance: ${meetingCount}`
                      : undefined
              }
              className={`flex items-center justify-center rounded-lg h-8 text-xs transition-all ${cellBg} ${textColor} ${ring}`}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* legend */}
      <div className="flex items-center gap-5 mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-green-100 border border-green-300 inline-block flex-shrink-0" />
          <span className="text-xs text-gray-500">Daily</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-blue-100 border border-blue-300 inline-block flex-shrink-0" />
          <span className="text-xs text-gray-500">Meeting</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-gradient-to-r from-green-400 to-blue-500 inline-block flex-shrink-0" />
          <span className="text-xs text-gray-500">Both</span>
        </div>
      </div>
    </div>
  );
}

/* ─── DailyRecordsCalendar ──────────────────────────────────── */
/**
 * Shows a calendar where dates that have a daily record are highlighted.
 * Clicking a date reveals the record details below.
 */
function DailyRecordsCalendar({ recordsByDate = {} }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState(null);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const keyFor = (day) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const selectedRecord = selectedKey ? recordsByDate[selectedKey] : null;

  const attendanceBadge = (status) => {
    const map = {
      present: "bg-green-100 text-green-700",
      absent: "bg-red-100 text-red-700",
      late: "bg-yellow-100 text-yellow-700",
    };
    return map[status?.toLowerCase()] ?? "bg-gray-100 text-gray-500";
  };

  const workStatusBadge = (status) => {
    const map = {
      working: "bg-blue-100 text-blue-700",
      leave: "bg-orange-100 text-orange-700",
      wfh: "bg-indigo-100 text-indigo-700",
    };
    return map[status?.toLowerCase()] ?? "bg-gray-100 text-gray-500";
  };

  return (
    <div className="space-y-5">
      {/* calendar */}
      <div className="bg-gray-50 rounded-2xl p-4">
        {/* nav */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-white text-gray-500 hover:text-gray-800 transition-colors shadow-sm"
          >
            <FaChevronLeft className="text-xs" />
          </button>
          <span className="text-sm font-semibold text-gray-700">
            {monthLabel}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-white text-gray-500 hover:text-gray-800 transition-colors shadow-sm"
          >
            <FaChevronRight className="text-xs" />
          </button>
        </div>

        {/* dow headers */}
        <div className="grid grid-cols-7 mb-1">
          {DOW.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-semibold text-gray-400 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* cells */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={`blank-${idx}`} />;
            const k = keyFor(day);
            const hasRecord = !!recordsByDate[k];
            const isSelected = k === selectedKey;
            const isToday =
              day === today.getDate() &&
              viewMonth === today.getMonth() &&
              viewYear === today.getFullYear();

            return (
              <button
                key={k}
                onClick={() => setSelectedKey(isSelected ? null : k)}
                disabled={!hasRecord}
                className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all text-xs font-medium leading-none
                  ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                      : hasRecord
                        ? "bg-white hover:bg-blue-50 text-gray-800 border border-blue-200 hover:border-blue-400 cursor-pointer shadow-sm"
                        : isToday
                          ? "text-blue-500 font-bold"
                          : "text-gray-400 cursor-default"
                  }`}
              >
                {day}
                {hasRecord && !isSelected && (
                  <span className="w-1 h-1 rounded-full bg-blue-400 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* hint */}
        <p className="text-[10px] text-gray-400 text-center mt-3">
          Highlighted dates have logbook entries — tap to view
        </p>
      </div>

      {/* selected record details */}
      <AnimatePresence mode="wait">
        {selectedRecord ? (
          <motion.div
            key={selectedKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="border border-blue-100 rounded-2xl overflow-hidden bg-white shadow-sm"
          >
            {/* record header */}
            <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100">
              <FaCalendar className="text-blue-400 text-xs flex-shrink-0" />
              <span className="text-sm font-semibold text-gray-800">
                {new Date(selectedRecord.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              {selectedRecord.status && (
                <span
                  className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold ${workStatusBadge(selectedRecord.status)}`}
                >
                  {selectedRecord.status}
                </span>
              )}
            </div>

            {/* record body */}
            <div className="px-5 py-4 space-y-4">
              {[
                {
                  label: "Stack / Technology",
                  icon: FaLaptopCode,
                  value: selectedRecord.stack,
                },
                { label: "Task", icon: FaTasks, value: selectedRecord.task },
                {
                  label: "Progress / Challenges",
                  icon: FaChartBar,
                  value: selectedRecord.progress,
                },
                {
                  label: "Blockers / Plans",
                  icon: FaExclamationTriangle,
                  value: selectedRecord.blockers,
                },
              ].map(({ label, icon: Icon, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Icon className="text-[9px]" /> {label}
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {value || <span className="italic text-gray-400">—</span>}
                  </p>
                </div>
              ))}

              {/* meeting attendance within the record */}
              {selectedRecord.meetingAttendance?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Meeting Attendance (
                    {selectedRecord.meetingAttendance.length})
                  </p>
                  <div className="space-y-1.5">
                    {selectedRecord.meetingAttendance.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-gray-700 truncate mr-2">
                          {m.meetingTitle}
                          {m.projectName && (
                            <span className="ml-1 text-gray-400">
                              ({m.projectName})
                            </span>
                          )}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${attendanceBadge(m.attendanceStatus)}`}
                        >
                          {m.attendanceStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRecord.attendanceTime && (
                <p className="text-xs text-gray-400">
                  Marked at:{" "}
                  {new Date(selectedRecord.attendanceTime).toLocaleTimeString(
                    "en-US",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-10 text-gray-400 space-y-2"
          >
            <FaRegCalendarAlt className="text-3xl opacity-30" />
            <p className="text-sm">
              Select a highlighted date to view the logbook entry
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Pagination ────────────────────────────────────────────── */
function Pagination({ page, totalPages, onPrev, onNext, onPage }) {
  if (totalPages <= 1) return null;

  const getPages = () => {
    const pages = [];
    const delta = 2;
    const left = Math.max(1, page - delta);
    const right = Math.min(totalPages, page + delta);
    if (left > 1) {
      pages.push(1);
      if (left > 2) pages.push("...");
    }
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages) {
      if (right < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1 px-3 py-2 border-t border-gray-100 bg-white/50">
      <button
        onClick={onPrev}
        disabled={page === 1}
        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <FaChevronLeft className="text-xs" />
      </button>
      {getPages().map((p, i) =>
        p === "..." ? (
          <span key={`e-${i}`} className="text-xs text-gray-400 px-1">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`min-w-[28px] h-7 rounded-lg text-xs font-semibold transition-colors ${
              p === page
                ? "bg-blue-600 text-white"
                : "text-gray-500 hover:bg-blue-50 hover:text-blue-600"
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={onNext}
        disabled={page === totalPages}
        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <FaChevronRight className="text-xs" />
      </button>
    </div>
  );
}

/* ─── main component ────────────────────────────────────────── */
export default function AdminInactiveInterns() {
  const navigate = useNavigate();
  const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
  const token = adminInfo.token;

  useEffect(() => {
    if (!token) navigate("/admin-login");
  }, []);

  const [inactiveInterns, setInactiveInterns] = useState([]);
  const [totalInterns, setTotalInterns] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [details, setDetails] = useState(null);
  const [dailyRecords, setDailyRecords] = useState([]);
  const [recordsByDate, setRecordsByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [reactivating, setReactivating] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const authHeaders = { Authorization: `Bearer ${token}` };
  const totalPages = Math.ceil(totalInterns / PAGE_SIZE);

  /* debounce search */
  useEffect(() => {
    const id = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  /* fetch paginated list */
  const fetchInactiveInterns = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: PAGE_SIZE,
      });
      if (searchTerm) params.append("search", searchTerm);
      const res = await fetch(`${API_BASE_URL}/inactive-interns?${params}`, {
        headers: authHeaders,
      });
      if (res.ok) {
        const result = await res.json();
        setInactiveInterns(result.data || []);
        setTotalInterns(result.total || 0);
      }
    } catch (err) {
      console.error("Error fetching inactive interns:", err);
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, searchTerm]);

  useEffect(() => {
    fetchInactiveInterns();
  }, [fetchInactiveInterns]);

  /* select intern → fetch details */
  const handleSelectIntern = async (intern) => {
    setSelectedIntern(intern);
    setDetails(null);
    setDailyRecords([]);
    setRecordsByDate({});
    setRecordsError(null);
    setActiveTab("overview");
    setDetailsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inactive-interns/${intern.id}`, {
        headers: authHeaders,
      });
      if (res.ok) {
        const result = await res.json();
        setDetails(result.data);
      }
    } catch (err) {
      console.error("Error fetching intern details:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  /* fetch daily records */
  const fetchDailyRecords = useCallback(async () => {
    if (!selectedIntern) return;
    setRecordsLoading(true);
    setRecordsError(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/inactive-interns/${selectedIntern.id}/daily-records`,
        { headers: authHeaders },
      );
      if (res.ok) {
        const result = await res.json();
        setDailyRecords(result.data || []);
        setRecordsByDate(result.recordsByDate || {});
      } else {
        setRecordsError("Failed to load daily records.");
      }
    } catch (err) {
      console.error("Error fetching daily records:", err);
      setRecordsError("Network error loading records.");
    } finally {
      setRecordsLoading(false);
    }
  }, [selectedIntern, token]);

  useEffect(() => {
    if (activeTab === "records") fetchDailyRecords();
  }, [activeTab, fetchDailyRecords]);

  /* reactivate */
  const handleReactivate = async () => {
    if (!selectedIntern) return;
    if (!window.confirm(`Reactivate ${selectedIntern.traineeName}?`)) return;
    setReactivating(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/inactive-interns/${selectedIntern.id}/reactivate`,
        {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
        },
      );
      if (res.ok) {
        setSuccessMessage(
          `${selectedIntern.traineeName} has been reactivated!`,
        );
        setTotalInterns((prev) => Math.max(0, prev - 1));
        setInactiveInterns((prev) =>
          prev.filter((i) => i.id !== selectedIntern.id),
        );
        setSelectedIntern(null);
        setDetails(null);
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (err) {
      console.error("Error reactivating intern:", err);
    } finally {
      setReactivating(false);
    }
  };

  const tabs = ["overview", "attendance", "records"];

  /* ── render ── */
  return (
    <AdminNavigation>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-gray-800 overflow-hidden relative">
        {/* floating blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[
          {
            cls: "w-80 h-80 bg-blue-100/40 -top-20 -left-20",
            dur: 15,
            dx: 20,
            dy: -30,
          },
          {
            cls: "w-96 h-96 bg-cyan-100/40 top-1/4 right-0",
            dur: 18,
            dx: -20,
            dy: 20,
            delay: 2,
          },
          {
            cls: "w-64 h-64 bg-purple-100/40 bottom-20 left-1/4",
            dur: 20,
            dx: 15,
            dy: -20,
            delay: 1,
          },
        ].map(({ cls, dur, dx, dy, delay = 0 }, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full ${cls}`}
            animate={{ y: [0, dy, 0], x: [0, dx, 0] }}
            transition={{
              duration: dur,
              repeat: Infinity,
              ease: "easeInOut",
              delay,
            }}
          />
        ))}
      </div>

      <div className="pt-[1.5rem] sm:pt-[2.5rem] relative z-10">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* page header */}
            <motion.div
              className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                
                <div>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">
                      Terminated Interns
                    </span>
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600">
                    Manage interns no longer in the active system
                  </p>
                </div>
              </div>
              <motion.button
                onClick={() => {
                  setCurrentPage(1);
                  fetchInactiveInterns();
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-sm shadow-sm hover:shadow-md"
              >
                <FaSync className="mr-2" /> Refresh
              </motion.button>
            </motion.div>

            {/* success banner */}
            <AnimatePresence>
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 bg-green-500 text-white px-5 py-3 rounded-xl font-medium shadow-sm"
                >
                  {successMessage}
                </motion.div>
              )}
            </AnimatePresence>

            {/* two-panel layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 sm:gap-5">
              {/* ── left: list panel ── */}
              <motion.div
                className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden max-h-[75vh] lg:max-h-none"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                {/* search */}
                <div className="p-3 border-b border-gray-100 relative">
                  <FaSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                  <input
                    type="text"
                    placeholder="Search by ID, name or email…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 bg-white"
                  />
                </div>

                {/* count */}
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center justify-between">
                  <span>
                    {totalInterns} intern{totalInterns !== 1 ? "s" : ""}
                    {searchTerm && " found"}
                  </span>
                  {totalPages > 1 && (
                    <span className="text-gray-400 font-normal normal-case">
                      Page {currentPage} of {totalPages}
                    </span>
                  )}
                </div>

                {/* list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {loading ? (
                    <div className="flex items-center justify-center py-12 text-gray-400">
                      <FaSpinner className="animate-spin mr-2" /> Loading…
                    </div>
                  ) : inactiveInterns.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">
                      {searchTerm
                        ? "No results matching your search"
                        : "No inactive interns found"}
                    </div>
                  ) : (
                    inactiveInterns.map((intern, index) => (
                      <motion.div
                        key={intern.id}
                        onClick={() => handleSelectIntern(intern)}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        whileHover={{ x: 3 }}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedIntern?.id === intern.id
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-gray-50 border-transparent hover:border-blue-300 hover:bg-blue-50"
                        }`}
                      >
                        <div className="font-semibold text-sm mb-0.5">
                          {intern.traineeName}
                        </div>
                        <div
                          className={`text-xs mb-2 ${selectedIntern?.id === intern.id ? "text-blue-200" : "text-gray-500"}`}
                        >
                          ID: {intern.traineeId}
                        </div>
                        <div className="space-y-1">
                          {[
                            { icon: FaEnvelope, label: intern.email },
                            { icon: FaSchool, label: intern.institute },
                            {
                              icon: FaCalendar,
                              label: intern.archivedAt
                                ? `Archived: ${new Date(intern.archivedAt).toLocaleDateString()}`
                                : "No archive date",
                            },
                          ].map(({ icon: Icon, label }) => (
                            <div
                              key={label}
                              className={`flex items-center gap-2 text-xs ${
                                selectedIntern?.id === intern.id
                                  ? "text-blue-100"
                                  : "text-gray-500"
                              }`}
                            >
                              <Icon className="text-[10px] flex-shrink-0" />
                              <span className="truncate">{label}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                <Pagination
                  page={currentPage}
                  totalPages={totalPages}
                  onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  onNext={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  onPage={(p) => setCurrentPage(p)}
                />
              </motion.div>

              {/* ── right: details panel ── */}
              {selectedIntern ? (
                <motion.div
                  className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  {detailsLoading ? (
                    <div className="flex items-center justify-center py-20 text-blue-500">
                      <FaSpinner className="animate-spin mr-2" /> Loading
                      details…
                    </div>
                  ) : details ? (
                    <>
                      {/* details header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 border-b border-gray-100">
                        <div className="flex items-center gap-4">
                          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
                            <FaUser className="text-white text-xl" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-gray-900">
                              {details.traineeName}
                            </h2>
                            <p className="text-sm text-gray-500 mt-0.5">
                              ID {details.traineeId} · {details.institute}
                            </p>
                            {details.homeAddress && (
                              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                <FaHome className="text-[9px]" />{" "}
                                {details.homeAddress}
                              </p>
                            )}
                          </div>
                        </div>
                        <motion.button
                          onClick={handleReactivate}
                          disabled={reactivating}
                          whileHover={{ scale: reactivating ? 1 : 1.04 }}
                          whileTap={{ scale: reactivating ? 1 : 0.96 }}
                          className="flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold text-sm shadow-sm hover:shadow-md disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                        >
                          {reactivating ? (
                            <>
                              <FaSpinner className="animate-spin mr-2" />{" "}
                              Reactivating…
                            </>
                          ) : (
                            <>
                              <FaCheckCircle className="mr-2" /> Reactivate
                            </>
                          )}
                        </motion.button>
                      </div>

                      {/* tabs */}
                      <div className="flex border-b border-gray-100 px-2">
                        {tabs.map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                              activeTab === tab
                                ? "text-blue-600 border-blue-600"
                                : "text-gray-500 border-transparent hover:text-gray-800"
                            }`}
                          >
                            {tab === "records"
                              ? "Daily Records"
                              : tab.charAt(0).toUpperCase() + tab.slice(1)}
                          </button>
                        ))}
                      </div>

                      {/* tab content */}
                      <div className="flex-1 p-5 sm:p-6 overflow-y-auto">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18 }}
                          >
                            {/* ── OVERVIEW ── */}
                            {activeTab === "overview" && (
                              <div className="space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="sm:col-span-2 bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                                      Email
                                    </p>
                                    <p className="text-sm font-medium text-gray-800 break-words">
                                      {details.email}
                                    </p>
                                  </div>
                                  <div className="sm:col-span-2 bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                                      Field of Specialization
                                    </p>
                                    <p className="text-sm font-medium text-gray-800 break-words">
                                      {details.fieldOfSpecialization || "N/A"}
                                    </p>
                                  </div>
                                  <div className="sm:col-span-2 bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                                      Home Address
                                    </p>
                                    <p className="text-sm font-medium text-gray-800 break-words">
                                      {details.homeAddress || "N/A"}
                                    </p>
                                  </div>
                                  <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                                      Training Start
                                    </p>
                                    <p className="text-sm font-medium text-gray-800">
                                      {fmtDate(details.trainingStartDate)}
                                    </p>
                                  </div>
                                  <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                                      Training End
                                    </p>
                                    <p className="text-sm font-medium text-gray-800">
                                      {fmtDate(details.trainingEndDate)}
                                    </p>
                                  </div>
                                  <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                                      Archive Reason
                                    </p>
                                    <p className="text-sm font-medium text-gray-800">
                                      {deriveArchiveReason(
                                        details.archiveReason,
                                        details.archivedAt,
                                        details.trainingEndDate,
                                      )}
                                    </p>
                                  </div>
                                  <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                                      Archived At
                                    </p>
                                    <p className="text-sm font-medium text-gray-800">
                                      {fmtDate(details.archivedAt)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ── ATTENDANCE ── */}
                            {activeTab === "attendance" && (
                              <div className="space-y-6">
                                {/* two stat cards */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-green-50 border border-green-100 rounded-2xl p-5 flex flex-col items-center text-center">
                                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-3">
                                      <FaRegCalendarAlt className="text-green-500 text-sm" />
                                    </div>
                                    <p className="text-xs font-semibold text-green-500 uppercase tracking-wide mb-1">
                                      Daily Attendance
                                    </p>
                                    <p className="text-4xl font-bold text-green-600">
                                      {details.attendance?.daily?.count ?? 0}
                                    </p>
                                    <p className="text-xs text-green-400 mt-1">
                                      {details.attendance?.daily
                                        ?.presentCount ?? 0}{" "}
                                      present
                                    </p>
                                  </div>
                                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex flex-col items-center text-center">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                                      <FaVideo className="text-blue-500 text-sm" />
                                    </div>
                                    <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">
                                      Meeting Attendance
                                    </p>
                                    <p className="text-4xl font-bold text-blue-600">
                                      {details.attendance?.meeting?.count ?? 0}
                                    </p>
                                    <p className="text-xs text-blue-400 mt-1">
                                      {details.attendance?.meeting
                                        ?.presentCount ?? 0}{" "}
                                      present
                                    </p>
                                  </div>
                                </div>

                                {/* calendar */}
                                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                                    Attendance Calendar
                                  </h3>
                                  <AttendanceCalendar
                                    dailyMap={
                                      details.attendance?.daily?.map ?? {}
                                    }
                                    meetingMap={
                                      details.attendance?.meeting?.map ?? {}
                                    }
                                  />
                                </div>
                              </div>
                            )}

                            {/* ── DAILY RECORDS ── */}
                            {activeTab === "records" && (
                              <div>
                                {recordsLoading ? (
                                  <div className="flex items-center justify-center py-16 text-blue-500">
                                    <FaSpinner className="animate-spin mr-2" />{" "}
                                    Loading records…
                                  </div>
                                ) : recordsError ? (
                                  <div className="flex items-center justify-center py-16 text-red-400 gap-2">
                                    <FaExclamationTriangle />
                                    <span className="text-sm">
                                      {recordsError}
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    {/* summary pill */}
                                    {dailyRecords.length > 0 && (
                                      <div className="flex items-center justify-between mb-4">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold border border-blue-100">
                                          <FaClipboardList className="text-[10px]" />
                                          {dailyRecords.length} logbook entr
                                          {dailyRecords.length !== 1
                                            ? "ies"
                                            : "y"}
                                        </span>
                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                          <FaSortAmountDown className="text-[10px]" />{" "}
                                          Tap a date to view
                                        </span>
                                      </div>
                                    )}
                                    <DailyRecordsCalendar
                                      recordsByDate={recordsByDate}
                                    />
                                  </>
                                )}
                              </div>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
                      <FaExclamationTriangle className="mr-2 text-yellow-400" />
                      Failed to load details. Try selecting again.
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{ minHeight: "400px" }}
                >
                  <div className="text-center text-gray-400 space-y-3 px-6">
                    <FaUser className="text-5xl opacity-20 mx-auto" />
                    <p className="text-sm font-medium text-gray-500">
                      Select an inactive intern to view details
                    </p>
                    <p className="text-xs text-gray-400">
                      Click any name in the list on the left
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </main>
        </div>
      </div>
    </AdminNavigation>
  );
}
