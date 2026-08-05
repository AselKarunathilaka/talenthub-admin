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
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (page >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  };

  return (
    <div className="flex flex-nowrap items-center justify-center w-full gap-1">
      <button
        onClick={onPrev}
        disabled={page === 1}
        className="flex items-center gap-1 p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-bold text-xs"
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
            className={`w-[26px] h-[28px] flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
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
        className="flex items-center gap-1 p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-bold text-xs"
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
        const data = result.data || [];
        setInactiveInterns(data);
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
        setSuccessMessage(`${selectedIntern.traineeName} has been reactivated!`);
        setTotalInterns((prev) => Math.max(0, prev - 1));
        setInactiveInterns((prev) => prev.filter((i) => i.id !== selectedIntern.id));
        setSelectedIntern(null);
        setDetails(null);
        setSearchInput("");
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
      <div className="inactive-root relative z-10">
        {/* Ambient background */}
        <div className="inactive-ambient absolute inset-0 overflow-hidden pointer-events-none">
          <div className="inactive-ambient__orb inactive-ambient__orb--1 absolute" />
          <div className="inactive-ambient__orb inactive-ambient__orb--2 absolute" />
        </div>

        <div className="inactive-content relative z-10 pt-4">
          <main className="inactive-main">

            {/* Page header */}
            <div className="mb-8">
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
              >
                <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl">
                  <UserX className="text-[#0056a2] h-8 w-8" />
                </div>
                Inactive Interns
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05, duration: 0.2 }}
                className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
              >
                Manage interns no longer in the active TalentHub system
              </motion.p>
            </div>

            {/* Stats + Search bar */}
            <motion.div
              className="inactive-stats-bar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="inactive-stat">
                <span className="inactive-stat__value" style={{ color: '#0056a2' }}>
                  {loading ? '—' : totalInterns}
                </span>
                <span className="inactive-stat__label">Total Inactive</span>
              </div>
              <div className="inactive-stat--divider" />
              <div className="inactive-search-bar">
                <FaSearch className="inactive-search-bar__icon" />
                <input
                  type="text"
                  placeholder="Search by ID, name or email…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="inactive-search-bar__input"
                  autoComplete="off"
                  data-lpignore="true"
                />
                {(searchInput || selectedIntern) && (
                  <button
                    className="inactive-search-bar__clear"
                    onClick={() => { 
                      setSearchInput(''); 
                      setSelectedIntern(null); 
                      setDetails(null); 
                      setDailyRecords([]); 
                      setRecordsByDate({}); 
                    }}
                  >
                    <FaTimesCircle />
                  </button>
                )}
              </div>
            </motion.div>

            {/* Success banner */}
            <AnimatePresence>
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 bg-[#50b748]/10 border border-[#50b748]/30 text-[#15803d] px-5 py-4 rounded-2xl font-bold shadow-sm flex items-center gap-3"
                >
                  <FaCheckCircle className="text-xl flex-shrink-0" />
                  <span>{successMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Two-column layout */}
            <div className="inactive-layout">

              {/* LEFT: intern list */}
              <div className="inactive-list-col">
                <div className="inactive-list-header">
                  <span className="inactive-list-header__title">Interns</span>
                  <span className="inactive-count-badge">{totalInterns} total</span>
                </div>

                <div className="inactive-list-body">
                  {loading ? (
                    <div className="inactive-loader" style={{ minHeight: 200 }}>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="inactive-loader__spinner"
                      />
                      <p>Loading…</p>
                    </div>
                  ) : inactiveInterns.length === 0 ? (
                    <div className="inactive-empty" style={{ minHeight: 200 }}>
                      <div className="inactive-empty__icon">
                        <FaUser style={{ color: '#9ca3af', fontSize: 24 }} />
                      </div>
                      <h3>{searchTerm ? 'No results' : 'No inactive interns'}</h3>
                      <p>{searchTerm ? 'Try a different search term.' : 'All interns are currently active.'}</p>
                    </div>
                  ) : (
                    inactiveInterns.map((intern, index) => (
                      <motion.div
                        key={intern.id}
                        onClick={() => {
                          handleSelectIntern(intern);
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15 }}
                        className={`inactive-list-item ${selectedIntern?.id === intern.id ? 'inactive-list-item--selected' : ''}`}
                      >
                        <div className="inactive-list-item__avatar">
                          {(intern.traineeName || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="inactive-list-item__body">
                          <div className="inactive-list-item__name" title={intern.traineeName}>
                            {intern.traineeName}
                          </div>
                          <div className="inactive-list-item__meta">
                            <span>ID: {intern.traineeId}</span>
                            {intern.archivedAt && (
                              <span>· {new Date(intern.archivedAt).toLocaleDateString()}</span>
                            )}
                          </div>
                          <div className="inactive-list-item__email" title={intern.email}>
                            {intern.email}
                          </div>
                        </div>
                        <div className="inactive-list-item__arrow">›</div>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="inactive-list-pagination">
                    <Pagination
                      page={currentPage}
                      totalPages={totalPages}
                      onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      onPage={(p) => setCurrentPage(p)}
                    />
                  </div>
                )}
              </div>

              {/* RIGHT: detail panel */}
              <div className="inactive-detail-col">
                <AnimatePresence mode="wait">
                  {!selectedIntern ? (
                    <motion.div
                      key="empty"
                      className="inactive-empty-detail"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="inactive-empty-detail__icon">
                        <UserX style={{ width: 40, height: 40, color: '#d1d5db' }} />
                      </div>
                      <p className="inactive-empty-detail__title">No Intern Selected</p>
                      <p className="inactive-empty-detail__sub">
                        Click an intern from the list to view their profile, attendance, and logbook records.
                      </p>
                    </motion.div>
                  ) : detailsLoading ? (
                    <motion.div
                      key="loading"
                      className="inactive-empty-detail"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="inactive-loader__spinner"
                        style={{ width: 48, height: 48, marginBottom: 16 }}
                      />
                      <p className="inactive-empty-detail__sub">Loading profile…</p>
                    </motion.div>
                  ) : details ? (
                    <motion.div
                      key={selectedIntern.id}
                      className="inactive-detail-panel"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                    >
                      {/* Profile header */}
                      <div className="inactive-detail-header">
                        <div className="inactive-detail-avatar">
                          {(details.traineeName || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="inactive-detail-info">
                          <h2 className="inactive-detail-name">{details.traineeName}</h2>
                          <p className="inactive-detail-meta">
                            <span>ID: {details.traineeId}</span>
                            {details.institute && (
                              <><span className="inactive-dot">·</span><span>{details.institute}</span></>
                            )}
                          </p>
                          {details.email && (
                            <p className="inactive-detail-email">
                              <FaEnvelope style={{ marginRight: 6, flexShrink: 0 }} />
                              {details.email}
                            </p>
                          )}
                          {details.homeAddress && (
                            <p className="inactive-detail-email" style={{ marginTop: 4 }}>
                              <FaHome style={{ marginRight: 6, flexShrink: 0 }} />
                              {details.homeAddress}
                            </p>
                          )}
                        </div>
                        <motion.button
                          onClick={handleReactivate}
                          disabled={reactivating}
                          whileHover={{ scale: reactivating ? 1 : 1.04 }}
                          whileTap={{ scale: reactivating ? 1 : 0.96 }}
                          className="inactive-btn inactive-btn--reactivate"
                        >
                          {reactivating ? (
                            <><FaSpinner className="animate-spin mr-2" />Reactivating…</>
                          ) : (
                            <><FaCheckCircle className="mr-2" />Reactivate</>
                          )}
                        </motion.button>
                      </div>

                      {/* Tabs */}
                      <div className="inactive-tabs">
                        {tabs.map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`inactive-tab ${activeTab === tab ? 'inactive-tab--active' : ''}`}
                          >
                            {tab === "records" ? "Daily Records" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                          </button>
                        ))}
                      </div>

                      {/* Tab content */}
                      <div className="inactive-tab-content">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18 }}
                          >
                            {/* OVERVIEW */}
                            {activeTab === "overview" && (
                              <div className="space-y-4">
                                <h3 className="text-base font-extrabold text-gray-800 mb-3">Internship Details</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="sm:col-span-2 bg-slate-50 border border-slate-100 rounded-2xl p-4 hover:border-blue-100 transition-colors">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                                      <FaEnvelope className="text-[#00b4eb]" /> Email
                                    </p>
                                    <p className="text-sm font-bold text-gray-800 break-words">{details.email}</p>
                                  </div>
                                  <div className="sm:col-span-2 bg-slate-50 border border-slate-100 rounded-2xl p-4 hover:border-blue-100 transition-colors">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                                      <FaLaptopCode className="text-[#0056a2]" /> Field of Specialization
                                    </p>
                                    <p className="text-sm font-bold text-gray-800">{details.fieldOfSpecialization || "N/A"}</p>
                                  </div>
                                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 hover:border-blue-100 transition-colors">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                                      <FaCalendar className="text-[#50b748]" /> Training Start
                                    </p>
                                    <p className="text-sm font-bold text-gray-800">{fmtDate(details.trainingStartDate)}</p>
                                  </div>
                                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 hover:border-blue-100 transition-colors">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                                      <FaCalendar className="text-[#50b748]" /> Training End
                                    </p>
                                    <p className="text-sm font-bold text-gray-800">{fmtDate(details.trainingEndDate)}</p>
                                  </div>
                                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 hover:border-blue-100 transition-colors">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                                      <FaExclamationTriangle className="text-rose-400" /> Archive Reason
                                    </p>
                                    <p className="text-sm font-bold text-gray-800">
                                      {deriveArchiveReason(details.archiveReason, details.archivedAt, details.trainingEndDate)}
                                    </p>
                                  </div>
                                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 hover:border-blue-100 transition-colors">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                                      <FaClock className="text-rose-400" /> Archived At
                                    </p>
                                    <p className="text-sm font-bold text-gray-800">{fmtDate(details.archivedAt)}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ATTENDANCE */}
                            {activeTab === "attendance" && (
                              <div className="space-y-5">
                                <h3 className="text-base font-extrabold text-gray-800 mb-1">Attendance Overview</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="bg-green-50 border border-green-100 rounded-2xl p-5 flex flex-col items-center text-center shadow-sm">
                                    <div className="w-10 h-10 rounded-xl bg-white border border-green-200 flex items-center justify-center mb-3 shadow-sm">
                                      <FaRegCalendarAlt className="text-[#50b748]" />
                                    </div>
                                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Daily Attendance</p>
                                    <p className="text-4xl font-black text-green-700 my-1">{details.attendance?.daily?.count ?? 0}</p>
                                    <p className="text-xs font-bold text-green-600">{details.attendance?.daily?.presentCount ?? 0} present</p>
                                  </div>
                                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex flex-col items-center text-center shadow-sm">
                                    <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center mb-3 shadow-sm">
                                      <FaVideo className="text-[#0056a2]" />
                                    </div>
                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Meeting Attendance</p>
                                    <p className="text-4xl font-black text-[#0056a2] my-1">{details.attendance?.meeting?.count ?? 0}</p>
                                    <p className="text-xs font-bold text-[#0056a2]">{details.attendance?.meeting?.presentCount ?? 0} present</p>
                                  </div>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                  <h3 className="text-sm font-extrabold text-gray-800 mb-4 flex items-center gap-2">
                                    <FaCalendar className="text-[#00b4eb]" /> Attendance Calendar
                                  </h3>
                                  <AttendanceCalendar
                                    dailyMap={details.attendance?.daily?.map ?? {}}
                                    meetingMap={details.attendance?.meeting?.map ?? {}}
                                  />
                                </div>
                              </div>
                            )}

                            {/* DAILY RECORDS */}
                            {activeTab === "records" && (
                              <div>
                                {recordsLoading ? (
                                  <div className="inactive-loader" style={{ minHeight: 200 }}>
                                    <motion.div
                                      animate={{ rotate: 360 }}
                                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                      className="inactive-loader__spinner"
                                    />
                                    <p>Loading records…</p>
                                  </div>
                                ) : recordsError ? (
                                  <div className="flex flex-col items-center justify-center py-16 text-rose-500">
                                    <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mb-4">
                                      <FaExclamationTriangle className="text-xl" />
                                    </div>
                                    <span className="text-sm font-bold">{recordsError}</span>
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <h3 className="text-base font-extrabold text-gray-800">Logbook Entries</h3>
                                      {dailyRecords.length > 0 && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#0056a2] rounded-xl text-xs font-bold border border-blue-100">
                                          <FaClipboardList />
                                          {dailyRecords.length} {dailyRecords.length !== 1 ? "entries" : "entry"}
                                        </span>
                                      )}
                                    </div>
                                    <DailyRecordsCalendar recordsByDate={recordsByDate} />
                                  </div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="error"
                      className="inactive-empty-detail"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div style={{ width: 56, height: 56, background: '#fef9c3', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, border: '1px solid #fde68a' }}>
                        <FaExclamationTriangle style={{ fontSize: 22, color: '#f59e0b' }} />
                      </div>
                      <p className="inactive-empty-detail__title">Failed to load profile</p>
                      <p className="inactive-empty-detail__sub">Please click the intern card again to retry.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          </main>
        </div>

        <style>{`
          /* ── Root ── */
          .inactive-root {
            min-height: 100vh;
            background: #f0f4f8;
            position: relative;
            font-family: 'Segoe UI', system-ui, sans-serif;
          }

          /* ── Ambient ── */
          .inactive-ambient { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
          .inactive-ambient__orb {
            position: absolute; border-radius: 50%;
            filter: blur(80px); opacity: 0.06;
          }
          .inactive-ambient__orb--1 {
            width: 500px; height: 500px;
            background: #0056a2; top: -100px; right: -100px;
          }
          .inactive-ambient__orb--2 {
            width: 400px; height: 400px;
            background: #50b748; bottom: -80px; left: -80px;
          }

          /* ── Layout ── */
          .inactive-content { position: relative; z-index: 1; padding-top: 8px; }
          .inactive-main { max-width: 1200px; margin: 0 auto; padding: 24px 24px 60px; }

          /* ── Stats bar ── */
          .inactive-stats-bar {
            display: flex; align-items: center; gap: 20px;
            padding: 14px 20px; background: white;
            border-radius: 14px; border: 1px solid #f0f0f0;
            box-shadow: 0 2px 12px rgba(0,0,0,0.04);
            margin-bottom: 20px; flex-wrap: wrap;
          }
          .inactive-stat { display: flex; flex-direction: column; gap: 2px; align-items: center; text-align: center; }
          .inactive-stat__value { font-size: 26px; font-weight: 800; }
          .inactive-stat__label { font-size: 12px; color: #6b7280; font-weight: 500; }
          .inactive-stat--divider { width: 1px; height: 36px; background: #e5e7eb; flex-shrink: 0; }

          /* ── Search bar ── */
          .inactive-search-bar {
            position: relative; flex: 1; min-width: 200px;
          }
          .inactive-search-bar__icon {
            position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
            color: #9ca3af; font-size: 14px; pointer-events: none;
          }
          .inactive-search-bar__input {
            width: 100%; padding: 10px 40px 10px 38px;
            border: 1.5px solid #e0e0e0; border-radius: 10px;
            font-size: 14px; font-weight: 500; color: #1a1a2e;
            outline: none; transition: border-color 0.2s, box-shadow 0.2s;
            background: white; box-sizing: border-box;
          }
          .inactive-search-bar__input:focus {
            border-color: #0056a2;
            box-shadow: 0 0 0 3px rgba(0,86,162,0.08);
          }
          .inactive-search-bar__clear {
            position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
            color: #9ca3af; background: none; border: none; cursor: pointer;
            font-size: 14px; display: flex; align-items: center;
            transition: color 0.2s;
          }
          .inactive-search-bar__clear:hover { color: #ef4444; }

          /* ── Count badge ── */
          .inactive-count-badge {
            display: inline-flex; align-items: center;
            padding: 5px 12px; background: #eff6ff;
            border: 1px solid #bfdbfe; border-radius: 8px;
            font-size: 12px; font-weight: 700; color: #0056a2;
            white-space: nowrap;
          }

          /* ── Two-column layout ── */
          .inactive-layout {
            display: flex; gap: 20px; align-items: stretch;
            min-height: calc(100vh - 250px);
          }
          @media (max-width: 900px) {
            .inactive-layout { flex-direction: column; }
          }

          /* ── Left col: intern list ── */
          .inactive-list-col {
            flex: 0 0 340px; min-width: 0;
            background: white; border-radius: 20px;
            border: 1px solid #f0f0f0;
            box-shadow: 0 2px 12px rgba(0,0,0,0.04);
            overflow: hidden; display: flex; flex-direction: column;
          }
          @media (max-width: 900px) {
            .inactive-list-col { flex: none; width: 100%; height: 500px; }
          }
          .inactive-list-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 16px 20px; border-bottom: 1px solid #f0f0f0;
            background: #fafafa;
          }
          .inactive-list-header__title {
            font-size: 14px; font-weight: 800; color: #1a1a2e;
          }
          .inactive-list-body {
            flex: 1; overflow-y: auto; min-height: 0;
            max-height: calc(100vh - 350px);
          }
          .inactive-list-item {
            display: flex; align-items: center; gap: 10px;
            padding: 10px 14px; cursor: pointer;
            border-bottom: 1px solid #f9f9f9;
            transition: background 0.15s; position: relative;
          }
          .inactive-list-item:hover { background: #f0f9ff; }
          .inactive-list-item--selected {
            background: linear-gradient(90deg, #eff6ff, #f0f9ff) !important;
            border-left: 3px solid #0056a2;
          }
          .inactive-list-item__avatar {
            width: 36px; height: 36px; border-radius: 10px;
            background: linear-gradient(135deg, #0056a2, #00b4eb);
            color: white; font-size: 14px; font-weight: 700;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          }
          .inactive-list-item--selected .inactive-list-item__avatar {
            background: linear-gradient(135deg, #004485, #0090c0);
          }
          .inactive-list-item__body { flex: 1; min-width: 0; }
          .inactive-list-item__name {
            font-size: 13px; font-weight: 700; color: #1a1a2e;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            margin-bottom: 2px;
          }
          .inactive-list-item__meta {
            font-size: 11px; color: #6b7280; font-weight: 500;
            display: flex; gap: 6px; margin-bottom: 2px;
          }
          .inactive-list-item__email {
            font-size: 11px; color: #9ca3af;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          .inactive-list-item__arrow {
            font-size: 18px; color: #9ca3af; flex-shrink: 0;
            transition: color 0.2s;
          }
          .inactive-list-item:hover .inactive-list-item__arrow { color: #0056a2; }
          .inactive-list-item--selected .inactive-list-item__arrow { color: #0056a2; }
          .inactive-list-pagination {
            border-top: 1px solid #f0f0f0; background: white;
            padding: 12px 14px; flex-shrink: 0;
            display: flex; justify-content: center;
          }

          /* ── Right col: detail ── */
          .inactive-detail-col {
            flex: 1; min-width: 0; display: flex; flex-direction: column;
          }

          /* ── Detail panel ── */
          .inactive-detail-panel {
            background: white; border-radius: 20px;
            border: 1px solid #f0f0f0;
            box-shadow: 0 2px 12px rgba(0,0,0,0.04);
            display: flex; flex-direction: column; overflow: hidden;
            flex: 1;
          }

          /* ── Detail header ── */
          .inactive-detail-header {
            display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start;
            padding: 24px; background: #fafafa;
            border-bottom: 1px solid #f0f0f0;
          }
          .inactive-detail-avatar {
            width: 64px; height: 64px; border-radius: 16px;
            background: linear-gradient(135deg, #0056a2, #00b4eb);
            color: white; font-size: 24px; font-weight: 800;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,86,162,0.2);
          }
          .inactive-detail-info { flex: 1; min-width: 0; }
          .inactive-detail-name {
            font-size: 20px; font-weight: 800; color: #1a1a2e; margin: 0 0 4px;
          }
          .inactive-detail-meta {
            font-size: 13px; font-weight: 600; color: #6b7280;
            display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
            margin: 0 0 4px;
          }
          .inactive-dot { color: #d1d5db; }
          .inactive-detail-email {
            font-size: 12px; color: #9ca3af;
            display: flex; align-items: center; margin: 4px 0 0;
          }

          /* ── Tabs ── */
          .inactive-tabs {
            display: flex; border-bottom: 1px solid #f0f0f0;
            padding: 0 16px; background: white; overflow-x: auto;
          }
          .inactive-tab {
            padding: 14px 20px; font-size: 13px; font-weight: 700;
            color: #9ca3af; border: none; background: transparent;
            border-bottom: 2px solid transparent; cursor: pointer;
            transition: all 0.2s; white-space: nowrap; text-transform: capitalize;
          }
          .inactive-tab:hover { color: #374151; border-bottom-color: #e5e7eb; }
          .inactive-tab--active { color: #0056a2; border-bottom-color: #0056a2; }

          /* ── Tab content ── */
          .inactive-tab-content {
            padding: 24px; overflow-y: auto; flex: 1; min-height: 0;
          }

          /* ── Reactivate button ── */
          .inactive-btn {
            display: inline-flex; align-items: center; justify-content: center;
            padding: 10px 20px; border-radius: 14px;
            font-size: 13px; font-weight: 700; cursor: pointer;
            transition: all 0.2s; border: none; white-space: nowrap;
          }
          .inactive-btn--reactivate {
            background: linear-gradient(135deg, #50b748, #2d8a3e);
            color: white; box-shadow: 0 4px 12px rgba(80,183,72,0.2);
          }
          .inactive-btn--reactivate:hover {
            background: linear-gradient(135deg, #43a03c, #237232);
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(80,183,72,0.3);
          }
          .inactive-btn--reactivate:disabled {
            background: #d1d5db; color: #9ca3af;
            box-shadow: none; cursor: not-allowed; transform: none;
          }

          /* ── Loader ── */
          .inactive-loader {
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            padding: 48px 20px; gap: 12px;
          }
          .inactive-loader__spinner {
            width: 36px; height: 36px; border-radius: 50%;
            border: 3px solid #e0e0e0; border-top-color: #0056a2;
          }
          .inactive-loader p { font-size: 13px; color: #9ca3af; font-weight: 500; margin: 0; }

          /* ── Empty states ── */
          .inactive-empty {
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            padding: 32px 16px; gap: 8px; text-align: center;
          }
          .inactive-empty__icon {
            width: 60px; height: 60px; border-radius: 50%;
            background: #f3f4f6;
            display: flex; align-items: center; justify-content: center;
          }
          .inactive-empty h3 { font-size: 14px; font-weight: 700; color: #1a1a2e; margin: 0; }
          .inactive-empty p { color: #6b7280; font-size: 12px; max-width: 240px; margin: 0; }

          /* ── Empty detail ── */
          .inactive-empty-detail {
            background: white; border-radius: 20px;
            border: 1px solid #f0f0f0;
            box-shadow: 0 2px 12px rgba(0,0,0,0.04);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            min-height: 400px; padding: 40px; text-align: center;
            flex: 1; height: 100%;
          }
          .inactive-empty-detail__icon {
            width: 88px; height: 88px;
            background: #f8fafc; border: 1px solid #e5e7eb;
            border-radius: 22px; display: flex; align-items: center;
            justify-content: center; margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          }
          .inactive-empty-detail__title {
            font-size: 17px; font-weight: 800; color: #1f2937; margin: 0 0 8px;
          }
          .inactive-empty-detail__sub {
            font-size: 13px; color: #6b7280; max-width: 320px; margin: 0; line-height: 1.6;
          }
        `}</style>
      </div>
    </AdminNavigation>
  );
}
