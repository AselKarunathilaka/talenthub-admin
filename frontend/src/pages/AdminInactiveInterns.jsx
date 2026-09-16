import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import { motion, AnimatePresence } from "framer-motion";
import { UserX, X } from "lucide-react";
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
  FaChevronLeft,
  FaChevronRight,
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
  FaUsers,
  FaRegCalendarAlt,
  FaVideo,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import logo from "../assets/sltlogo.jpg";
import { API_BASE_URL } from "../api/apiConfig";

const PAGE_SIZE = 10;

// Digital Clock Component (Memoized to prevent parent re-renders)
const formatDigit = (num) => num.toString().padStart(2, '0');

const DigitalClock = React.memo(function DigitalClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-4 w-full">
      <div className="flex items-baseline font-bold tracking-tight text-slate-800 tabular-nums">
        <span className="text-xl sm:text-2xl md:text-3xl lg:text-4xl">{formatDigit(time.getHours())}</span>
        <span className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-slate-400 mx-0.5 sm:mx-1 animate-pulse font-medium">:</span>
        <span className="text-xl sm:text-2xl md:text-3xl lg:text-4xl">{formatDigit(time.getMinutes())}</span>
        <span className="text-[10px] sm:text-xs md:text-sm lg:text-base text-[#006600] font-bold ml-1 sm:ml-1.5">{formatDigit(time.getSeconds())}</span>
      </div>
      <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-slate-300"></div>
      <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs md:text-sm lg:text-base font-bold text-slate-600 mt-0.5 sm:mt-0">
        <span className="text-[#000066] uppercase">{time.toLocaleDateString("en-US", { weekday: "short" })}</span>
        <span>{time.getDate()}</span>
        <span>{time.toLocaleDateString("en-US", { month: "short" })}</span>
      </div>
    </div>
  );
});

/* ─── helpers ──────────────────────────────────────────────── */
const fmtDate = (d) => {
  if (!d) return "N/A";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "N/A";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
};

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
    if (archived < end) return "Past Interns";
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
const AttendanceCalendar = React.memo(function AttendanceCalendar({ dailyMap = {}, meetingMap = {} }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const monthLabel = useMemo(() => new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  }), [viewYear, viewMonth]);

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = useMemo(() => {
    const list = [];
    for (let i = 0; i < firstDow; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(d);
    return list;
  }, [firstDow, daysInMonth]);

  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="select-none">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-3 sm:p-5 md:p-6 border border-gray-100 shadow-md sm:shadow-lg">
        {/* month nav */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <button
            onClick={prevMonth}
            className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-600 transition-all duration-150 shadow-sm sm:shadow-md hover:scale-105 active:scale-95"
          >
            <FaChevronLeft className="text-xs sm:text-base" />
          </button>
          <div className="text-center">
            <h3 className="text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {monthLabel}
            </h3>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Daily & Meeting Attendance</p>
          </div>
          <button
            onClick={nextMonth}
            className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-600 transition-all duration-150 shadow-sm sm:shadow-md hover:scale-105 active:scale-95"
          >
            <FaChevronRight className="text-xs sm:text-base" />
          </button>
        </div>

        {/* day-of-week headers */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-4">
          {DOW.map((d) => (
            <div
              key={d}
              className="text-center text-[8px] sm:text-[10px] md:text-xs font-bold text-gray-600 py-1.5 sm:py-2.5 px-0.5 sm:px-1 uppercase tracking-wider bg-gradient-to-b from-gray-50 to-gray-100 rounded-md sm:rounded-lg border border-gray-200"
            >
              {d}
            </div>
          ))}
        </div>

        {/* day cells */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {cells.map((day, idx) => {
            if (!day) return <div key={`blank-${idx}`} />;
            const k = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hasDaily = !!dailyMap[k];
            const hasMeeting = !!meetingMap[k];
            const hasBoth = hasDaily && hasMeeting;
            const isToday =
              day === today.getDate() &&
              viewMonth === today.getMonth() &&
              viewYear === today.getFullYear();

            // Determine cell background
            let cellBg = "bg-white";
            let textColor = "text-gray-400";
            let borderClass = "border border-gray-100";
            let shadowClass = "";

            if (hasBoth) {
              cellBg = "bg-gradient-to-br from-emerald-400 via-green-400 to-blue-500";
              textColor = "text-white font-bold";
              borderClass = "border-0";
              shadowClass = "shadow-sm sm:shadow-md hover:shadow-lg hover:shadow-blue-300";
            } else if (hasDaily) {
              cellBg = "bg-gradient-to-br from-emerald-50 to-green-50";
              textColor = "text-emerald-700 font-semibold";
              borderClass = "border border-emerald-200";
              shadowClass = "shadow-sm hover:shadow-md hover:shadow-emerald-200";
            } else if (hasMeeting) {
              cellBg = "bg-gradient-to-br from-blue-50 to-cyan-50";
              textColor = "text-blue-700 font-semibold";
              borderClass = "border border-blue-200";
              shadowClass = "shadow-sm hover:shadow-md hover:shadow-blue-200";
            }

            if (isToday && !hasDaily && !hasMeeting) {
              cellBg = "bg-gradient-to-br from-amber-50 to-orange-50";
              textColor = "text-gray-700 font-bold";
              borderClass = "border-2 border-amber-300";
              shadowClass = "hover:shadow-md hover:shadow-amber-200";
            }

            const dailyCount = hasDaily ? dailyMap[k].length : 0;
            const meetingCount = hasMeeting ? meetingMap[k].length : 0;
            const interactive = hasDaily || hasMeeting || isToday;

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
                        : isToday ? "Today" : undefined
                }
                className={`flex items-center justify-center rounded-lg sm:rounded-xl h-8 sm:h-10 md:h-12 text-xs sm:text-sm md:text-base font-semibold transition-all duration-150 cursor-pointer ${cellBg} ${textColor} ${borderClass} ${shadowClass} ${interactive ? "hover:scale-105 active:scale-95" : ""}`}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* legend */}
        <div className="flex items-center flex-wrap gap-2.5 sm:gap-5 mt-4 sm:mt-6 pt-3 sm:pt-5 border-t border-gray-200">
          <div className="flex items-center gap-1.5 sm:gap-3 hover:opacity-80 transition-opacity cursor-pointer">
            <div className="flex items-center justify-center w-4 h-4 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 border sm:border-2 border-emerald-200">
              <span className="text-[9px] sm:text-xs text-emerald-600">✓</span>
            </div>
            <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-gray-700">Daily</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 hover:opacity-80 transition-opacity cursor-pointer">
            <div className="flex items-center justify-center w-4 h-4 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 border sm:border-2 border-blue-200">
              <span className="text-[9px] sm:text-xs text-blue-600">•</span>
            </div>
            <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-gray-700">Meeting</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 hover:opacity-80 transition-opacity cursor-pointer">
            <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-gradient-to-br from-emerald-400 via-green-400 to-blue-500 border-0"></div>
            <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-gray-700">Both</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 hover:opacity-80 transition-opacity cursor-pointer">
            <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border sm:border-2 border-amber-400"></div>
            <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-gray-700">Today</span>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ─── DailyRecordsCalendar ──────────────────────────────────── */
const DailyRecordsCalendar = React.memo(function DailyRecordsCalendar({ recordsByDate = {} }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState(null);

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const monthLabel = useMemo(() => new Date(viewYear, viewMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  }), [viewYear, viewMonth]);

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = useMemo(() => {
    const list = [];
    for (let i = 0; i < firstDow; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(d);
    return list;
  }, [firstDow, daysInMonth]);

  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const selectedRecord = selectedKey ? recordsByDate[selectedKey] : null;

  const attendanceBadge = (status) => {
    const map = {
      present: "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-300",
      absent: "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-300",
      late: "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border border-amber-300",
    };
    return map[status?.toLowerCase()] ?? "bg-gray-100 text-gray-600 border border-gray-200";
  };

  const workStatusBadge = (status) => {
    const map = {
      working: "bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-300",
      leave: "bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border border-orange-300",
      wfh: "bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 border border-indigo-300",
    };
    return map[status?.toLowerCase()] ?? "bg-gray-100 text-gray-600 border border-gray-200";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* calendar */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-3 sm:p-5 md:p-6 border border-gray-100 shadow-md sm:shadow-lg">
        {/* nav */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <button
            onClick={prevMonth}
            className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-600 transition-all duration-150 shadow-sm sm:shadow-md hover:scale-105 active:scale-95"
          >
            <FaChevronLeft className="text-xs sm:text-base" />
          </button>
          <div className="text-center">
            <h3 className="text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {monthLabel}
            </h3>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Click a date to view</p>
          </div>
          <button
            onClick={nextMonth}
            className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-600 transition-all duration-150 shadow-sm sm:shadow-md hover:scale-105 active:scale-95"
          >
            <FaChevronRight className="text-xs sm:text-base" />
          </button>
        </div>

        {/* dow headers */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-4">
          {DOW.map((d) => (
            <div
              key={d}
              className="text-center text-[8px] sm:text-[10px] md:text-xs font-bold text-gray-600 py-1.5 sm:py-2.5 px-0.5 sm:px-1 uppercase tracking-wider bg-gradient-to-b from-gray-50 to-gray-100 rounded-md sm:rounded-lg border border-gray-200"
            >
              {d}
            </div>
          ))}
        </div>

        {/* cells */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {cells.map((day, idx) => {
            if (!day) return <div key={`blank-${idx}`} />;
            const k = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
                disabled={!hasRecord && !isToday}
                className={`flex flex-col items-center justify-center py-2 sm:py-3 md:py-4 px-0.5 sm:px-1 rounded-lg sm:rounded-xl font-bold transition-all duration-150 text-xs sm:text-sm md:text-base leading-tight
                  ${
                    isSelected
                      ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-300 border-0 scale-105"
                      : hasRecord
                        ? `bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-700 border-2 border-blue-300 hover:from-blue-100 hover:to-cyan-100 cursor-pointer shadow-sm hover:shadow-md hover:scale-105 active:scale-95`
                        : isToday
                          ? "bg-gradient-to-br from-amber-50 to-orange-50 text-amber-700 font-bold border-2 border-amber-400 hover:from-amber-100 hover:to-orange-100 cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                          : "text-gray-300 cursor-default"
                  }`}
              >
                {day}
                {hasRecord && !isSelected && (
                  <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-blue-500 mt-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* hint */}
        <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-gray-200">
          <p className="text-[10px] sm:text-xs text-gray-500 text-center flex items-center justify-center gap-1.5 sm:gap-2">
            <FaRegCalendarAlt className="text-blue-400" />
            Dates with a dot have logbook entries
          </p>
        </div>
      </div>

      {/* selected record details */}
      <AnimatePresence mode="wait">
        {selectedRecord && (
          <motion.div
            key={selectedKey}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.15 }}
            className="border border-blue-200 rounded-2xl overflow-hidden bg-gradient-to-br from-white to-blue-50 shadow-lg sm:shadow-xl"
          >
            {/* record header */}
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-2.5 sm:py-4 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 border-b border-blue-300">
              <div className="p-1.5 sm:p-2.5 rounded-lg bg-white/20">
                <FaCalendar className="text-white text-sm sm:text-lg flex-shrink-0" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs sm:text-sm md:text-base font-bold text-white block truncate">
                  {new Date(selectedRecord.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <span className="text-[10px] sm:text-xs text-blue-100">
                  {new Date(selectedRecord.date).toLocaleDateString("en-US", { weekday: "short" })}
                </span>
              </div>
              {selectedRecord.status && (
                <span
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold shrink-0 ${workStatusBadge(selectedRecord.status)}`}
                >
                  {selectedRecord.status}
                </span>
              )}
            </div>

            {/* record body */}
            <div className="px-3 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-5">
              {[
                {
                  label: "Stack / Technology",
                  icon: FaLaptopCode,
                  value: selectedRecord.stack,
                  color: "from-purple-500 to-pink-500",
                },
                { 
                  label: "Task", 
                  icon: FaTasks, 
                  value: selectedRecord.task,
                  color: "from-blue-500 to-cyan-500",
                },
                {
                  label: "Progress / Challenges",
                  icon: FaChartBar,
                  value: selectedRecord.progress,
                  color: "from-green-500 to-emerald-500",
                },
                {
                  label: "Blockers / Plans",
                  icon: FaExclamationTriangle,
                  value: selectedRecord.blockers,
                  color: "from-orange-500 to-red-500",
                },
              ].map(({ label, icon: Icon, value, color }) => (
                <div 
                  key={label}
                  className="border-l-4 border-blue-300 pl-3 sm:pl-4 py-1.5 sm:py-2"
                >
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                    <span className={`p-1 sm:p-1.5 rounded-lg bg-gradient-to-br ${color} text-white`}>
                      <Icon className="text-xs" />
                    </span>
                    {label}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-medium">
                    {value || <span className="italic text-gray-400 font-normal">— No entry</span>}
                  </p>
                </div>
              ))}

              {/* meeting attendance within the record */}
              {selectedRecord.meetingAttendance?.length > 0 && (
                <div
                  className="border-t-2 border-dashed border-blue-200 pt-3 sm:pt-5"
                >
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2">
                    <span className="p-1 sm:p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 text-white">
                      <FaVideo className="text-xs" />
                    </span>
                    Meeting Attendance ({selectedRecord.meetingAttendance.length})
                  </p>
                  <div className="space-y-2">
                    {selectedRecord.meetingAttendance.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-xs border border-blue-100 hover:border-blue-300 transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 truncate mr-2">
                            {m.meetingTitle}
                          </p>
                          {m.projectName && (
                            <p className="text-[10px] sm:text-[11px] text-gray-500">
                              {m.projectName}
                            </p>
                          )}
                        </div>
                        <span
                          className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-bold flex-shrink-0 text-[10px] sm:text-[11px] ${attendanceBadge(m.attendanceStatus)}`}
                        >
                          {m.attendanceStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRecord.attendanceTime && (
                <p
                  className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-2 pt-2 border-t border-gray-100 mt-3 sm:mt-4 pt-3 sm:pt-4"
                >
                  <FaClock className="text-blue-400" />
                  Marked at:{" "}
                  <span className="font-semibold text-gray-700">
                    {new Date(selectedRecord.attendanceTime).toLocaleTimeString(
                      "en-US",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      },
                    )}
                  </span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/* ─── Pagination (Memoized) ─────────────────────────────────── */
const Pagination = React.memo(function Pagination({ page, totalPages, total, limit, onPage }) {
  if (!total || total <= 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

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
      disabled={disabled}
      title={title}
      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none"
    >
      {icon}
    </button>
  );

  return (
    <div className="flex flex-col items-center justify-between gap-2.5 px-3 sm:px-4 py-3 sm:py-4 border-t border-slate-200/80 bg-slate-50/80 rounded-b-xl sm:rounded-b-[14px] md:rounded-b-2xl w-full mt-auto">
      <p className="text-xs sm:text-sm text-slate-500 font-medium text-center">
        Showing{" "}
        <span className="font-bold text-slate-700">
          {from} - {to}
        </span>{" "}
        of <span className="font-bold text-slate-700">{total}</span>{" "}
        records
      </p>
      <div className="flex items-center gap-1 flex-wrap justify-center">
        {btn(
          () => onPage(1),
          !hasPrev,
          <FaAngleDoubleLeft className="h-3 w-3" />,
          "First",
        )}
        {btn(
          () => onPage(page - 1),
          !hasPrev,
          <FaChevronLeft className="h-3 w-3" />,
          "Previous",
        )}
        {pageNums.map((p, idx, arr) => (
          <React.Fragment key={p}>
            {arr[idx - 1] && p - arr[idx - 1] > 1 && (
              <span className="px-1 text-slate-400 text-xs font-bold">…</span>
            )}
            <button
              onClick={() => onPage(p)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-bold transition-all focus:outline-none ${
                p === page
                  ? "bg-gradient-to-r from-[#000066] to-[#006600] text-white shadow-md shadow-[#006600]/20"
                  : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              {p}
            </button>
          </React.Fragment>
        ))}
        {btn(
          () => onPage(page + 1),
          !hasNext,
          <FaChevronRight className="h-3 w-3" />,
          "Next",
        )}
        {btn(
          () => onPage(totalPages),
          !hasNext,
          <FaAngleDoubleRight className="h-3 w-3" />,
          "Last",
        )}
      </div>
    </div>
  );
});

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

  // Security Popup State
  const [showSecurityPopup, setShowSecurityPopup] = useState(false);
  const [securityPassword, setSecurityPassword] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [securitySaving, setSecuritySaving] = useState(false);

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
  const handleSelectIntern = useCallback(async (intern) => {
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
  }, [token]);

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

  /* reactivate — opens security check popup */
  const handleReactivate = useCallback(() => {
    if (!selectedIntern) return;
    setShowSecurityPopup(true);
    setSecurityPassword("");
    setPasswordError("");
  }, [selectedIntern]);

  /* execute reactivation after password verified */
  const executeReactivate = useCallback(async () => {
    if (!selectedIntern) return;
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
  }, [selectedIntern, token]);

  /* verify security password then reactivate */
  const handlePasswordVerify = useCallback(async () => {
    if (!securityPassword) {
      setPasswordError("Please enter the security password");
      return;
    }
    setSecuritySaving(true);
    setPasswordError("");
    try {
      const internName = selectedIntern?.traineeName || "";
      const internEmail = selectedIntern?.traineeEmail || selectedIntern?.email || "";
      const internId = selectedIntern?.traineeId || "N/A";
      const response = await fetch(`${API_BASE_URL}/admin/attendance/verify-security`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          securityPin: securityPassword,
          action: "intern reactivate",
          extraInfo: `Intern: ${internName} (ID: ${internId})${internEmail ? ` - ${internEmail}` : ""}`,
        }),
      });
      const data = await response.json();
      if (response.ok && (data.success || data.message)) {
        setShowSecurityPopup(false);
        setSecurityPassword("");
        setPasswordError("");
        await executeReactivate();
      } else {
        setPasswordError(data.message || "Invalid security password");
      }
    } catch (err) {
      setPasswordError(err.message || "Invalid security password");
    } finally {
      setSecuritySaving(false);
    }
  }, [securityPassword, selectedIntern, authHeaders, executeReactivate]);

  const tabs = ["overview", "attendance", "records"];

  return (
    <AdminNavigation>
      {/* Background using transparent to blend with Layout */}
      <div className="min-h-full relative font-sans text-slate-800 flex flex-col select-none">
        
        <main className="relative flex-1 p-3 sm:p-6 sm:px-8 mx-auto max-w-[1400px] w-full flex flex-col gap-5 sm:gap-6 min-w-0">
          
          {/* Top header: Title on Left, Clock & Tools on Right */}
          <div className="relative z-20 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 pt-2">

            {/* Left: Dashboard Title */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="p-2.5 sm:p-3 md:p-3.5 bg-gradient-to-br from-[#000066] to-[#006600] shadow-md rounded-lg sm:rounded-xl md:rounded-2xl border border-[#006600]/20 flex-shrink-0"
              >
                <UserX className="text-white h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
              </motion.div>
              <div className="flex flex-col justify-center">
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight"
                >
                  Inactive Interns
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="text-slate-500 mt-0.5 sm:mt-1 text-[10px] sm:text-xs md:text-sm lg:text-base font-medium max-w-xl"
                >
                  Manage interns no longer in the active TalentHub system
                </motion.p>
              </div>
            </div>
            
            {/* Right: Clock */}
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 w-full xl:w-auto">
              {/* Clock Container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="flex items-center justify-center bg-white border border-slate-200/80 shadow-sm px-3 sm:px-5 md:px-6 py-2 sm:py-3 md:py-4 rounded-xl md:rounded-[16px] w-full xl:w-auto"
              >
                <DigitalClock />
              </motion.div>
            </div>
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
                      <div className="inactive-loader__spinner animate-spin" />
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
                    inactiveInterns.map((intern) => (
                      <div
                        key={intern.id}
                        onClick={() => handleSelectIntern(intern)}
                        className={`inactive-list-item transform-gpu transition-colors ${selectedIntern?.id === intern.id ? 'inactive-list-item--selected' : ''}`}
                      >
                         <div className="inactive-list-item__avatar" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
                            <img
                              src={`${API_BASE_URL}/interns/${intern.id}/profile-picture`}
                              alt={intern.traineeName}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                            <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                              {(intern.traineeName || '?').charAt(0).toUpperCase()}
                            </div>
                        </div>
                        <div className="inactive-list-item__body">
                          <div className="inactive-list-item__name" title={intern.traineeName}>
                            {intern.traineeName}
                          </div>
                          <div className="inactive-list-item__meta">
                            <span>ID: {intern.traineeId}</span>
                            {intern.archivedAt && (
                              <span>· {fmtDate(intern.archivedAt)}</span>
                            )}
                          </div>
                          <div className="inactive-list-item__email" title={intern.email}>
                            {intern.email}
                          </div>
                        </div>
                        <div className="inactive-list-item__arrow">›</div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <Pagination
                    page={currentPage}
                    totalPages={totalPages}
                    total={totalInterns}
                    limit={PAGE_SIZE}
                    onPage={(p) => setCurrentPage(p)}
                  />
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
                      <div
                        className="inactive-loader__spinner animate-spin"
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
                        <div className="inactive-detail-avatar" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
                          <img
                            src={`${API_BASE_URL}/interns/${details.id}/profile-picture`}
                            alt={details.traineeName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                            {(details.traineeName || '?').charAt(0).toUpperCase()}
                          </div>
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
                                    <div className="inactive-loader__spinner animate-spin" />
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

        <style>{`
          /* ── Stats bar ── */
          .inactive-stats-bar {
            display: flex; align-items: center; gap: 20px;
            padding: 14px 20px; background: white;
            border-radius: 16px; border: 1px solid rgba(226, 232, 240, 0.8);
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
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
            .inactive-layout { flex-direction: column; gap: 16px; min-height: auto; }
          }

          /* ── Left col: intern list ── */
          .inactive-list-col {
            flex: 0 0 340px; min-width: 0;
            background: white; border-radius: 16px;
            border: 1px solid rgba(226, 232, 240, 0.8);
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
            overflow: hidden; display: flex; flex-direction: column;
          }
          @media (max-width: 900px) {
            .inactive-list-col { flex: none; width: 100%; height: auto; max-height: 480px; }
          }
          .inactive-list-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 16px 20px; border-bottom: 1px solid rgba(226, 232, 240, 0.8);
            background: #fafafa;
          }
          .inactive-list-header__title {
            font-size: 14px; font-weight: 800; color: #1a1a2e;
          }
          .inactive-list-body {
            flex: 1; overflow-y: auto; min-height: 0;
          }
          @media (max-width: 900px) {
            .inactive-list-body { max-height: 320px; }
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

          /* ── Right col: detail ── */
          .inactive-detail-col {
            flex: 1; min-width: 0; display: flex; flex-direction: column;
          }

          /* ── Detail panel ── */
          .inactive-detail-panel {
            background: white; border-radius: 16px;
            border: 1px solid rgba(226, 232, 240, 0.8);
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
            display: flex; flex-direction: column; overflow: hidden;
            flex: 1;
          }

          /* ── Detail header ── */
          .inactive-detail-header {
            display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start;
            padding: 24px; background: #fafafa;
            border-bottom: 1px solid rgba(226, 232, 240, 0.8);
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
            display: flex; border-bottom: 1px solid rgba(226, 232, 240, 0.8);
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
            background: white; border-radius: 16px;
            border: 1px solid rgba(226, 232, 240, 0.8);
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
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

          /* ── Responsive adjustments for 1024px and below ── */
          @media (max-width: 1024px) {
            .inactive-layout {
              flex-direction: column; gap: 16px; min-height: auto;
            }
            .inactive-list-col {
              flex: none; width: 100%; height: auto; max-height: 480px;
            }
            .inactive-list-body {
              max-height: 320px;
            }
            .inactive-stats-bar {
              padding: 10px 14px; gap: 10px; margin-bottom: 14px;
            }
            .inactive-stat__value { font-size: 20px; }
            .inactive-stat__label { font-size: 10px; }
            .inactive-stat--divider { display: none; }
            .inactive-search-bar { min-width: 100%; }
            .inactive-search-bar__input {
              padding: 8px 34px 8px 32px; font-size: 12px;
            }
            .inactive-search-bar__icon { left: 10px; font-size: 12px; }
            .inactive-detail-panel { border-radius: 12px; }
            .inactive-detail-header { padding: 14px; gap: 12px; }
            .inactive-detail-avatar { width: 44px; height: 44px; font-size: 18px; border-radius: 12px; }
            .inactive-detail-name { font-size: 15px; }
            .inactive-detail-meta { font-size: 11px; }
            .inactive-detail-email { font-size: 10px; }
            .inactive-btn { width: 100%; padding: 8px 14px; font-size: 11px; }
            .inactive-tabs { padding: 0 8px; }
            .inactive-tab { padding: 10px 12px; font-size: 11px; }
            .inactive-tab-content { padding: 12px; }
            .inactive-empty-detail { padding: 24px 14px; min-height: 240px; }
            .inactive-empty-detail__icon { width: 56px; height: 56px; border-radius: 14px; margin-bottom: 12px; }
            .inactive-empty-detail__title { font-size: 14px; }
            .inactive-empty-detail__sub { font-size: 11px; }
          }

          /* ── Responsive adjustments for 320px - 480px ── */
          @media (max-width: 480px) {
            .inactive-layout { gap: 10px; }
            .inactive-list-col { border-radius: 12px; }
            .inactive-list-header { padding: 10px 12px; }
            .inactive-list-header__title { font-size: 12px; }
            .inactive-count-badge { padding: 3px 8px; font-size: 10px; }
            .inactive-list-item { padding: 8px 10px; gap: 8px; }
            .inactive-list-item__avatar { width: 30px; height: 30px; font-size: 12px; border-radius: 8px; }
            .inactive-list-item__name { font-size: 11px; }
            .inactive-list-item__meta { font-size: 9px; }
            .inactive-list-item__email { font-size: 9px; }
            .inactive-list-item__arrow { font-size: 14px; }
          }
        `}</style>

        {/* Security Check Backdrop */}
        <AnimatePresence>
          {showSecurityPopup && (
            <motion.div
              key="inactive-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[25] pointer-events-none bg-slate-900/60 backdrop-blur-sm"
            />
          )}
        </AnimatePresence>

        {/* Security Check Popup */}
        <AnimatePresence>
          {showSecurityPopup && (
            <motion.div key="modal-wrapper-animate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[50] pointer-events-none">
              <div
                className="fixed inset-0 z-[26] pointer-events-auto"
                onClick={() => setShowSecurityPopup(false)}
              />
              <div className="fixed left-0 lg:left-[260px] right-0 bottom-0 top-[64px] z-50 pointer-events-none flex items-center justify-center px-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  
                  onAnimationComplete={() => {
                    document.getElementById('inactive-security-password-input')?.focus();
                  }}
                  className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-sm pointer-events-auto"
                >
                  <div className="flex justify-between items-start mb-3 sm:mb-4">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-800">Security Check</h3>
                      <p className="text-xs text-slate-500 mt-1">Enter password to proceed</p>
                    </div>
                    <button
                      onClick={() => setShowSecurityPopup(false)}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mb-3 sm:mb-5 relative">
                    <input
                      id="inactive-security-password-input"
                      type={showPasswordText ? "text" : "password"}
                      value={securityPassword}
                      onChange={(e) => setSecurityPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handlePasswordVerify()}
                      placeholder="Enter password..."
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-3 top-[10px] text-slate-400 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer"
                    >
                      {showPasswordText ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                    </button>
                    {passwordError && (
                      <p className="text-xs font-semibold text-rose-500 mt-2">{passwordError}</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSecurityPopup(false)}
                      className="flex-1 px-4 py-2 sm:py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePasswordVerify}
                      disabled={securitySaving || !securityPassword}
                      className="flex-1 flex items-center justify-center px-4 py-2 sm:py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
                    >
                      {securitySaving ? <FaSpinner className="w-4 h-4 animate-spin" /> : "Verify"}
                    </button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </AdminNavigation>
  );
}
