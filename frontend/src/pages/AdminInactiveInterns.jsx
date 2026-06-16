import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import { motion, AnimatePresence } from "framer-motion";
import { UserX } from "lucide-react";
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
    const delta = 6; // Increased delta to reduce concatenated pages
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
    <div className="flex items-center justify-between w-full px-4 py-2 border-t border-gray-100 bg-white/50 gap-2">
      <button
        onClick={onPrev}
        disabled={page === 1}
        className="flex items-center gap-2 p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-bold text-xs shrink-0"
      >
        <FaChevronLeft className="text-[10px]" /> Prev
      </button>
      
      {getPages().map((p, i) =>
        p === "..." ? (
          <span key={`e-${i}`} className="text-xs text-gray-400 px-2 flex-shrink-0">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`flex-1 max-w-[40px] h-8 rounded-lg text-xs font-semibold transition-colors ${
              p === page
                ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                : "text-gray-500 hover:bg-blue-50 hover:text-blue-600 bg-white"
            }`}
          >
            {p}
          </button>
        ),
      )}
      
      <button
        onClick={onNext}
        disabled={page === totalPages}
        className="flex items-center gap-2 p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-bold text-xs shrink-0"
      >
        Next <FaChevronRight className="text-[10px]" />
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

  const carouselRef = useRef(null);

  const authHeaders = { Authorization: `Bearer ${token}` };
  const totalPages = Math.ceil(totalInterns / PAGE_SIZE);

  // Reset horizontal scroll when changing pages
  useEffect(() => {
    if (carouselRef.current) {
      carouselRef.current.scrollTo({ left: 0, behavior: "smooth" });
    }
  }, [currentPage]);

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
      <div className="min-h-screen bg-slate-50 font-sans text-gray-800 pb-10 flex flex-col">
        <div className="flex-1 w-full lg:mt-4 lg:px-6 xl:px-10">
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
            {/* page header */}
            <motion.div
              className="mb-8 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
                >
                  <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl">
                    <UserX className="text-[#0056a2] h-8 w-8" />
                  </div>
                  Terminated Interns
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
                >
                  Manage interns no longer in the active system
                </motion.p>
              </div>

              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto mt-4 xl:mt-0">
                <div className="relative w-full sm:w-[280px]">
                  <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by ID, name or email…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent placeholder-gray-400 font-bold transition-all text-gray-800 shadow-sm"
                  />
                </div>
                
                <div className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-center shadow-sm w-full sm:w-auto whitespace-nowrap">
                  <span>
                    {totalInterns} intern{totalInterns !== 1 ? "s" : ""}
                    {searchTerm && " found"}
                  </span>
                </div>

                <motion.button
                  onClick={() => {
                    setCurrentPage(1);
                    fetchInactiveInterns();
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center px-4 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-[#0056a2] rounded-xl text-sm font-bold shadow-sm transition-all w-full sm:w-auto whitespace-nowrap"
                >
                  <FaSync className="mr-2" /> Refresh
                </motion.button>
              </div>
            </motion.div>

            {/* success banner */}
            <AnimatePresence>
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 bg-[#50b748]/10 border border-[#50b748]/30 text-[#15803d] px-5 py-4 rounded-2xl font-bold shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <FaCheckCircle className="text-xl" />
                    <span>{successMessage}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* vertically stacked layout */}
            <div className="flex flex-col gap-6">
              {/* ── top: horizontal strip ── */}
              <motion.div
                className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* horizontal scroll list */}
                <div
                  ref={carouselRef}
                  className="flex flex-col overflow-x-auto custom-scrollbar pb-2 px-1 relative"
                >
                  {/* Cards Row */}
                  <div className="flex gap-3 items-stretch pb-4 w-max min-w-full min-h-[160px]">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-8 px-20 text-gray-400 w-full sticky left-0 h-full">
                        <FaSpinner className="animate-spin text-2xl mb-3 text-[#00b4eb]" />
                        <span className="text-sm font-medium">Loading…</span>
                      </div>
                    ) : inactiveInterns.length === 0 ? (
                      <div className="text-center py-8 px-20 text-gray-400 text-sm font-medium w-full flex items-center justify-center sticky left-0 h-full">
                        {searchTerm
                          ? "No results matching your search"
                          : "No inactive interns found"}
                      </div>
                    ) : (
                      inactiveInterns.map((intern, index) => (
                        <motion.div
                          key={intern.id}
                          onClick={() => handleSelectIntern(intern)}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.04 }}
                          className={`min-w-[220px] max-w-[220px] p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col ${
                            selectedIntern?.id === intern.id
                              ? "bg-[#0056a2] border-[#0056a2] text-white shadow-md shadow-[#0056a2]/20"
                              : "bg-white border-gray-100 hover:border-[#00b4eb]/50 hover:bg-blue-50/50"
                          }`}
                        >
                          <div className="font-extrabold text-sm mb-1 truncate" title={intern.traineeName}>
                            {intern.traineeName}
                          </div>
                          <div
                            className={`text-[10px] font-bold mb-3 ${selectedIntern?.id === intern.id ? "text-blue-200" : "text-gray-500"}`}
                          >
                            ID: {intern.traineeId}
                          </div>
                          <div className="space-y-1.5 mt-auto">
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
                                className={`flex items-center gap-2 text-[10px] font-medium ${
                                  selectedIntern?.id === intern.id
                                    ? "text-blue-100"
                                    : "text-gray-500"
                                }`}
                                title={label}
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

                  {/* Pagination Row */}
                  {totalPages > 1 && (
                    <div className="sticky left-0 w-full flex justify-center pt-2 border-t border-gray-100 mt-auto bg-white/95 z-10">
                      <Pagination
                        page={currentPage}
                        totalPages={totalPages}
                        onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        onNext={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        onPage={(p) => setCurrentPage(p)}
                      />
                    </div>
                  )}
                </div>
              </motion.div>

              {/* ── bottom: details panel ── */}
              {selectedIntern ? (
                <motion.div
                  className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden min-h-[600px] w-full"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {detailsLoading ? (
                    <div className="flex flex-col items-center justify-center flex-1 text-[#0056a2] min-h-[400px]">
                      <FaSpinner className="animate-spin text-4xl mb-4" />
                      <span className="text-sm font-bold text-gray-500">Loading details…</span>
                    </div>
                  ) : details ? (
                    <>
                      {/* details header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 p-6 sm:p-8 bg-slate-50/50 border-b border-gray-100">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
                          <div className="h-20 w-20 rounded-2xl bg-[#00b4eb]/10 border border-[#00b4eb]/20 flex items-center justify-center shadow-sm flex-shrink-0">
                            <FaUser className="text-[#0056a2] text-3xl" />
                          </div>
                          <div className="pt-1">
                            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                              {details.traineeName}
                            </h2>
                            <p className="text-sm font-bold text-gray-500 mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                              <span>ID: {details.traineeId}</span>
                              <span className="hidden sm:inline text-gray-300">•</span>
                              <span>{details.institute}</span>
                            </p>
                            {details.homeAddress && (
                              <p className="text-xs font-medium text-gray-400 flex items-center justify-center sm:justify-start gap-1.5 mt-2">
                                <FaHome className="text-gray-400" />
                                {details.homeAddress}
                              </p>
                            )}
                          </div>
                        </div>
                        <motion.button
                          onClick={handleReactivate}
                          disabled={reactivating}
                          whileHover={{ scale: reactivating ? 1 : 1.05 }}
                          whileTap={{ scale: reactivating ? 1 : 0.95 }}
                          className="flex items-center justify-center px-6 py-3 bg-[#50b748] hover:bg-[#43a03c] text-white rounded-2xl font-bold text-sm shadow-md shadow-[#50b748]/20 disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed transition-all whitespace-nowrap mt-2 sm:mt-0"
                        >
                          {reactivating ? (
                            <>
                              <FaSpinner className="animate-spin mr-2" />
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
                      <div className="flex border-b border-gray-100 px-4 sm:px-6 bg-white overflow-x-auto custom-scrollbar">
                        {tabs.map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-4 text-sm font-bold capitalize transition-all border-b-2 whitespace-nowrap ${
                              activeTab === tab
                                ? "text-[#0056a2] border-[#0056a2]"
                                : "text-gray-400 border-transparent hover:text-gray-700 hover:border-gray-200"
                            }`}
                          >
                            {tab === "records"
                              ? "Daily Records"
                              : tab.charAt(0).toUpperCase() + tab.slice(1)}
                          </button>
                        ))}
                      </div>

                      {/* tab content */}
                      <div className="flex-1 p-6 sm:p-8 overflow-y-auto bg-white custom-scrollbar">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                          >
                            {/* ── OVERVIEW ── */}
                            {activeTab === "overview" && (
                              <div className="space-y-6">
                                <h3 className="text-lg font-extrabold text-gray-900 mb-4">Internship Details</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="sm:col-span-2 bg-slate-50 border border-slate-100 rounded-2xl p-5 hover:border-blue-100 transition-colors">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                      <FaEnvelope className="text-[#00b4eb]" /> Email
                                    </p>
                                    <p className="text-sm font-bold text-gray-800 break-words">
                                      {details.email}
                                    </p>
                                  </div>
                                  <div className="sm:col-span-2 bg-slate-50 border border-slate-100 rounded-2xl p-5 hover:border-blue-100 transition-colors">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                      <FaLaptopCode className="text-[#0056a2]" /> Field of Specialization
                                    </p>
                                    <p className="text-sm font-bold text-gray-800 break-words">
                                      {details.fieldOfSpecialization || "N/A"}
                                    </p>
                                  </div>
                                  
                                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 hover:border-blue-100 transition-colors">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                      <FaCalendar className="text-[#50b748]" /> Training Start
                                    </p>
                                    <p className="text-sm font-bold text-gray-800">
                                      {fmtDate(details.trainingStartDate)}
                                    </p>
                                  </div>
                                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 hover:border-blue-100 transition-colors">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                      <FaCalendar className="text-[#50b748]" /> Training End
                                    </p>
                                    <p className="text-sm font-bold text-gray-800">
                                      {fmtDate(details.trainingEndDate)}
                                    </p>
                                  </div>

                                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 hover:border-blue-100 transition-colors">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                      <FaExclamationTriangle className="text-rose-400" /> Archive Reason
                                    </p>
                                    <p className="text-sm font-bold text-gray-800">
                                      {deriveArchiveReason(
                                        details.archiveReason,
                                        details.archivedAt,
                                        details.trainingEndDate,
                                      )}
                                    </p>
                                  </div>
                                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 hover:border-blue-100 transition-colors">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                      <FaClock className="text-rose-400" /> Archived At
                                    </p>
                                    <p className="text-sm font-bold text-gray-800">
                                      {fmtDate(details.archivedAt)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ── ATTENDANCE ── */}
                            {activeTab === "attendance" && (
                              <div className="space-y-8">
                                <h3 className="text-lg font-extrabold text-gray-900 mb-2">Attendance Overview</h3>
                                {/* two stat cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                  <div className="bg-green-50 border border-green-100 rounded-3xl p-6 flex flex-col items-center text-center shadow-sm">
                                    <div className="w-12 h-12 rounded-2xl bg-white border border-green-200 flex items-center justify-center mb-4 shadow-sm">
                                      <FaRegCalendarAlt className="text-[#50b748] text-xl" />
                                    </div>
                                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">
                                      Daily Attendance
                                    </p>
                                    <p className="text-5xl font-black text-green-700 my-2">
                                      {details.attendance?.daily?.count ?? 0}
                                    </p>
                                    <div className="bg-white/60 px-3 py-1 rounded-full border border-green-200/50">
                                      <p className="text-xs font-bold text-green-600">
                                        {details.attendance?.daily?.presentCount ?? 0} present
                                      </p>
                                    </div>
                                  </div>

                                  <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex flex-col items-center text-center shadow-sm">
                                    <div className="w-12 h-12 rounded-2xl bg-white border border-blue-200 flex items-center justify-center mb-4 shadow-sm">
                                      <FaVideo className="text-[#0056a2] text-xl" />
                                    </div>
                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">
                                      Meeting Attendance
                                    </p>
                                    <p className="text-5xl font-black text-[#0056a2] my-2">
                                      {details.attendance?.meeting?.count ?? 0}
                                    </p>
                                    <div className="bg-white/60 px-3 py-1 rounded-full border border-blue-200/50">
                                      <p className="text-xs font-bold text-[#0056a2]">
                                        {details.attendance?.meeting?.presentCount ?? 0} present
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* calendar */}
                                <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                                  <h3 className="text-sm font-extrabold text-gray-800 mb-6 flex items-center gap-2">
                                    <FaCalendar className="text-[#00b4eb]" />
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
                                  <div className="flex flex-col items-center justify-center py-20 text-[#0056a2]">
                                    <FaSpinner className="animate-spin text-4xl mb-4" />
                                    <span className="text-sm font-bold text-gray-500">Loading records…</span>
                                  </div>
                                ) : recordsError ? (
                                  <div className="flex flex-col items-center justify-center py-20 text-rose-500">
                                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
                                      <FaExclamationTriangle className="text-2xl" />
                                    </div>
                                    <span className="text-sm font-bold">{recordsError}</span>
                                  </div>
                                ) : (
                                  <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                      <h3 className="text-lg font-extrabold text-gray-900">Logbook Entries</h3>
                                      {dailyRecords.length > 0 && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-[#0056a2] rounded-xl text-xs font-bold border border-blue-100">
                                          <FaClipboardList />
                                          {dailyRecords.length} {dailyRecords.length !== 1 ? "entries" : "entry"}
                                        </span>
                                      )}
                                    </div>
                                    
                                    <DailyRecordsCalendar
                                      recordsByDate={recordsByDate}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center flex-1 text-gray-400 p-8 text-center min-h-[400px]">
                      <div className="w-20 h-20 bg-yellow-50 text-yellow-500 rounded-full flex items-center justify-center mb-4 shadow-sm border border-yellow-100">
                        <FaExclamationTriangle className="text-3xl" />
                      </div>
                      <p className="text-base font-bold text-gray-700">Failed to load details</p>
                      <p className="text-sm mt-1">Please try selecting the intern again.</p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  className="bg-white rounded-3xl border border-gray-100 shadow-sm flex items-center justify-center min-h-[400px] w-full"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="text-center text-gray-400 flex flex-col items-center max-w-sm px-6">
                    <div className="w-24 h-24 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
                      <FaUser className="text-4xl text-gray-300" />
                    </div>
                    <p className="text-lg font-extrabold text-gray-800 mb-2">
                      No Intern Selected
                    </p>
                    <p className="text-sm font-medium text-gray-500">
                      Select an inactive intern from the list above to view their detailed profile, attendance, and logbook entries.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </main>
        </div>
      </div>
    </AdminNavigation>
  );
}
