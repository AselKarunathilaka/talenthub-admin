import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  FiLoader,
  FiCalendar,
  FiUser,
  FiCheckSquare,
  FiAlertTriangle,
  FiPlus,
  FiSearch,
  FiFilter,
  FiBook,
  FiChevronLeft,
  FiChevronRight,
  FiFileText,
  FiX,
  FiArrowRight,
  FiList,
  FiDownload,
} from "react-icons/fi";
import Navigation from "../components/Navigation";
import ExportModal from "../components/ExportModal";

// ── Main Component ────────────────────────────────────────────────────────────
const DailyRecords = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [records, setRecords] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState("calendar");
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);

  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const isAdmin = location.pathname.includes("/admin/");
  const studentInfo = JSON.parse(localStorage.getItem("studentInfo") || "{}");

  // ── Calendar helpers ────────────────────────────────────────
  const getCalendarDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days = [];

    // Trailing days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Leading days from next month to reach exactly 42 cells (6 full rows)
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const calendarDays = getCalendarDays(currentMonth);
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const prevMonth = () =>
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  const nextMonth = () =>
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  // ── Fetch records ───────────────────────────────────────────
  const fetchDailyRecords = useCallback(async () => {
    try {
      setLoading(true);
      let authToken;
      if (isAdmin) {
        const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
        authToken = adminInfo.token;
      } else {
        authToken =
          localStorage.getItem("authToken") ||
          JSON.parse(localStorage.getItem("studentInfo") || "{}").token;
      }

      if (!authToken) {
        setError("Authentication required. Please log in again.");
        navigate(isAdmin ? "/admin-login" : "/");
        return;
      }

      const { API_BASE_URL, API_ENDPOINTS } = await import("../api/apiConfig");
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.RECORDS.LIST}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.status === 401) {
        setError("Session expired. Please log in again.");
        if (isAdmin) {
          localStorage.removeItem("adminInfo");
          navigate("/admin-login");
        } else {
          localStorage.removeItem("studentInfo");
          localStorage.removeItem("authToken");
          navigate("/");
        }
        return;
      }

      const data = await response.json();
      if (response.ok) {
        setRecords(Array.isArray(data) ? data : []);
        setError(null);
      } else {
        setError(data.error || "Failed to fetch records");
      }
    } catch (err) {
      setError("Failed to fetch records. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    fetchDailyRecords();
  }, [fetchDailyRecords]);

  //──Fetch Holidays From Backend──────────────────────────────────────────────
  const fetchHolidays = useCallback(async () => {
  try {
    const year = currentMonth.getFullYear();

    const { API_BASE_URL } = await import("../api/apiConfig");

    const response = await fetch(
      `${API_BASE_URL}/holidays/${year}`
    );

    const data = await response.json();

    if (data.holidays) {
      setHolidays(data.holidays);
    }
  } catch (error) {
    console.error("Holiday fetch failed:", error);
  }
}, [currentMonth]);

useEffect(() => {
  fetchHolidays();
}, [fetchHolidays]);

  // ── Export PDF ──────────────────────────────────────────────
  const handleExportPDF = async (params) => {
    setIsExporting(true);
    setExportError(null);
    try {
      let authToken;
      if (isAdmin) {
        const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
        authToken = adminInfo.token;
      } else {
        authToken =
          localStorage.getItem("authToken") ||
          JSON.parse(localStorage.getItem("studentInfo") || "{}").token;
      }

      const { API_BASE_URL, API_ENDPOINTS } = await import("../api/apiConfig");

      // Build query string — now includes `template`
      const qs = new URLSearchParams();
      if (params.date) qs.set("date", params.date);
      if (params.startDate) qs.set("startDate", params.startDate);
      if (params.endDate) qs.set("endDate", params.endDate);
      if (params.template) qs.set("template", params.template);

      const url = `${API_BASE_URL}${API_ENDPOINTS.RECORDS.EXPORT_PDF}?${qs.toString()}`;

      const response = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Export failed");
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      // Detect file type from the Content-Disposition or Content-Type header
      const contentType = response.headers.get("Content-Type") || "";
      const ext = contentType.includes("spreadsheetml")
        ? "xlsx"
        : contentType.includes("wordprocessingml")
          ? "docx"
          : "pdf";

      a.download = params.date
        ? `daily-records-${params.date}-${params.template || "default"}.${ext}`
        : params.startDate
          ? `daily-records-${params.startDate}-to-${params.endDate}-${params.template || "default"}.${ext}`
          : `daily-records-all-${params.template || "default"}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);
      setShowExportModal(false);
    } catch (err) {
      setExportError(err.message || "Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Filter / sort ───────────────────────────────────────────
  const filteredRecords = records
    .filter((record) => {
      const matchesSearch =
        (record.internId?.traineeName &&
          record.internId.traineeName
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (record.internId?.email &&
          record.internId.email
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (record.internId?.traineeId &&
          record.internId.traineeId
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (record.task && record.task.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.progress &&
          record.progress.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.blockers &&
          record.blockers.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      const recordDate = new Date(record.createdAt || record.date);
      const today = new Date();
      switch (filterBy) {
        case "today":
          return recordDate.toDateString() === today.toDateString();
        case "week":
          return (
            recordDate >= new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
          );
        case "month":
          return (
            recordDate >= new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
          );
        default:
          return true;
      }
    })
    .sort((a, b) =>
      sortBy === "oldest"
        ? new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date)
        : new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date),
    );

  const getRecordsForDate = (date) => {
    if (!date) return [];
    return records.filter((record) => {
      const rd = new Date(record.date || record.createdAt);
      return (
        rd.getDate() === date.getDate() &&
        rd.getMonth() === date.getMonth() &&
        rd.getFullYear() === date.getFullYear()
      );
    });
  };

  const selectedDateRecords = getRecordsForDate(selectedDate);

  //Holiday Helper
  const getHolidayForDate = (date) => {
  if (!date) return null;

  return holidays.find((holiday) => {
    const holidayDate = new Date(holiday.date);

    return (
      holidayDate.getDate() === date.getDate() &&
      holidayDate.getMonth() === date.getMonth() &&
      holidayDate.getFullYear() === date.getFullYear()
    );
  });
};

  const getDayClass = (day) => {
    if (!day) return "";
    const hasRecords = getRecordsForDate(day).length > 0;

    const holiday = getHolidayForDate(day);

    const isSelected =
      selectedDate &&
      day.getDate() === selectedDate.getDate() &&
      day.getMonth() === selectedDate.getMonth() &&
      day.getFullYear() === selectedDate.getFullYear();
    const isToday = day.toDateString() === new Date().toDateString();
    let classes =
      "min-h-[60px] md:min-h-[80px] p-1 md:p-2 border border-gray-100 rounded-lg cursor-pointer transition duration-200 hover:bg-gray-50 flex flex-col justify-between";
    
  //Holiday Styling
      if (holiday && !isSelected) {
    classes += " bg-red-60 border-red-300"; 
  }
    if (isToday) classes += " bg-blue-50 border-blue-200";
    if (isSelected) classes += " bg-indigo-100 border-indigo-300 shadow-md";
    if (hasRecords) classes += " relative";
    return classes;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    if (diffInHours < 1) return "Less than an hour ago";
    if (diffInHours < 24)
      return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7)
      return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks} week${diffInWeeks > 1 ? "s" : ""} ago`;
  };

  // ── Loading / Error states ──────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-sans" style={{ background: "#f0f4f8" }}>
        <Navigation />
        <div className="flex-1 w-full lg:mt-20 lg:px-6 xl:px-10 flex items-center justify-center pb-10">
          <div className="text-center bg-white rounded-2xl shadow-sm p-8 md:p-12 border border-gray-200 max-w-md w-full" style={{ borderRadius: 20 }}>
            <div className="bg-indigo-50 rounded-full p-4 md:p-6 w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 flex items-center justify-center">
              <FiLoader className="animate-spin text-2xl md:text-4xl" style={{ color: "#0056a2" }} />
            </div>
            <h3 className="text-xl md:text-2xl font-semibold text-gray-800 mb-2">
              Loading Daily Records
            </h3>
            <p className="text-gray-500 text-sm md:text-base">
              Please wait while we fetch your records...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-sans" style={{ background: "#f0f4f8" }}>
        <Navigation />
        <div className="flex-1 w-full lg:mt-20 lg:px-6 xl:px-10 flex items-center justify-center pb-10">
          <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12 max-w-md w-full text-center border border-gray-200" style={{ borderRadius: 20 }}>
            <div className="bg-red-50 rounded-full p-4 md:p-6 w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 flex items-center justify-center">
              <FiAlertTriangle className="text-2xl md:text-4xl text-red-500" />
            </div>
            <h2 className="text-xl md:text-2xl font-semibold text-gray-800 mb-3 md:mb-4">
              Error Loading Records
            </h2>
            <p className="text-gray-500 mb-4 md:mb-6 leading-relaxed text-sm md:text-base">
              {error}
            </p>
            <button
              onClick={fetchDailyRecords}
              className="text-white px-6 md:px-8 py-2 md:py-3 rounded-xl transition duration-300 font-medium shadow-sm text-sm md:text-base"
              style={{ background: "linear-gradient(135deg, #0056a2 0%, #00b4eb 100%)", borderRadius: 14 }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-sans" style={{ background: "#f0f4f8" }}>
      <Navigation />

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          onClose={() => {
            setShowExportModal(false);
            setExportError(null);
          }}
          onExport={handleExportPDF}
          isExporting={isExporting}
        />
      )}

      {/* Day Details Modal */}
      {isDayModalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 md:p-6 border-b border-gray-100 bg-white">
              <h3 className="text-lg md:text-xl font-bold text-gray-900">
                {selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              <button
                onClick={() => setIsDayModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FiX className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
            
            {/* Body */}
            <div className="p-5 md:p-6 overflow-y-auto bg-gray-50/50">
              {getHolidayForDate(selectedDate) && (
                <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="font-semibold text-red-700 text-sm md:text-base">
                    {getHolidayForDate(selectedDate).name}
                  </div>
                  <div className="text-xs md:text-sm text-red-600 mt-1">
                    {getHolidayForDate(selectedDate).type.join(", ")}
                  </div>
                </div>
              )}

              {selectedDateRecords.length > 0 ? (
                <div className="space-y-4">
                  {selectedDateRecords.map((record) => (
                    <div
                      key={record._id}
                      className="bg-white rounded-xl p-4 md:p-5 shadow-sm"
                      style={{ border: "1.5px solid rgba(0, 180, 235, 0.2)" }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <FiUser className="text-indigo-600 text-sm" />
                        <span className="font-semibold text-gray-900 text-sm md:text-base">
                          {isAdmin
                            ? record.internId?.traineeName || "Unknown User"
                            : "My Record"}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        {record.stack &&
                          !(
                            record.status === "leave" &&
                            record.stack === "On Leave"
                          ) && (
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                              {record.stack}
                            </span>
                          )}
                        {record.status === "wfh" && (
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                            Work From Home
                          </span>
                        )}
                        {record.status === "leave" && (
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                            On Leave
                          </span>
                        )}
                        {record.status === "study_leave" && (
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-100">
                            Extended Leave
                          </span>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                            <div className="bg-blue-100 p-1.5 rounded-lg flex-shrink-0">
                              <FiCheckSquare className="text-blue-600 flex-shrink-0 text-sm" />
                            </div>
                            <span className="text-sm">Tasks Completed</span>
                          </h4>
                          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 md:p-4 rounded-xl border border-blue-200">
                            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                              {record.task}
                            </p>
                          </div>
                        </div>

                        {record.progress && (
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                              <div className="bg-amber-100 p-1.5 rounded-lg flex-shrink-0">
                                <FiAlertTriangle className="text-amber-600 flex-shrink-0 text-sm" />
                              </div>
                              <span className="text-sm">Challenges Faced</span>
                            </h4>
                            <div className="bg-gradient-to-r from-amber-50 to-amber-100 p-3 md:p-4 rounded-xl border border-amber-200">
                              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                                {record.progress}
                              </p>
                            </div>
                          </div>
                        )}

                        {record.blockers && (
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                              <div className="bg-emerald-100 p-1.5 rounded-lg flex-shrink-0">
                                <FiPlus className="text-emerald-600 flex-shrink-0 text-sm" />
                              </div>
                              <span className="text-sm">Plans for Tomorrow</span>
                            </h4>
                            <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 p-3 md:p-4 rounded-xl border border-emerald-200">
                              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                                {record.blockers}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-400 mt-4 flex items-center gap-1.5 font-medium">
                        <FiCalendar className="w-3.5 h-3.5" />
                        {formatDate(record.createdAt || record.date)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FiCheckSquare className="text-4xl text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium text-sm md:text-base">
                    No records for this date
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 w-full lg:mt-20 lg:px-6 xl:px-10 pb-10">
        <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
          {/* Export error toast */}
          {exportError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-center justify-between text-sm" style={{ borderRadius: 14 }}>
              <span>{exportError}</span>
              <button
                onClick={() => setExportError(null)}
                className="ml-2 text-red-500 hover:text-red-700"
              >
                <FiX />
              </button>
            </div>
          )}

          {/* ───── Page Header ───── */}
          <div style={{ marginBottom: 32 }}>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              {/* Title Section (with Mobile Switcher) */}
              <div className="flex justify-between items-start w-full md:w-auto gap-2">
                <div className="flex-1 pr-1">
                  <h1
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: "#1a1a2e",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                    className="text-[22px] sm:text-[28px]"
                  >
                    <span
                      style={{
                        color: "#1a1a2e",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <FiCalendar style={{ color: "#0056a2" }} className="w-5 h-5 sm:w-auto sm:h-auto shrink-0" />
                      <span className="truncate">{isAdmin ? "Student Records" : "My Daily Records"}</span>
                    </span>
                  </h1>
                  <p
                    style={{
                      color: "#6b7280",
                      marginTop: 6,
                      fontSize: 15,
                      fontStyle: "italic",
                    }}
                    className="text-[13px] sm:text-[15px]"
                  >
                    Track daily progress and achievements
                  </p>
                </div>

                {/* Mobile View Switcher (Hidden on Desktop) */}
                <div className="inline-grid md:hidden grid-cols-2 p-1 bg-white rounded-[14px] border border-[rgba(0,180,235,0.35)] shadow-sm w-[90px] shrink-0 mt-1">
                  <button
                    onClick={() => setViewMode("calendar")}
                    className={`inline-flex items-center justify-center px-1.5 py-1.5 rounded-[10px] transition-all duration-200 min-h-[36px] ${
                      viewMode === "calendar"
                        ? "bg-[#0056a2] text-white shadow-sm"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <FiCalendar className={`w-5 h-5 ${viewMode === "calendar" ? "text-white" : "text-[#00b4eb]"}`} />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`inline-flex items-center justify-center px-1.5 py-1.5 rounded-[10px] transition-all duration-200 min-h-[36px] ${
                      viewMode === "list"
                        ? "bg-[#0056a2] text-white shadow-sm"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <FiList className={`w-5 h-5 ${viewMode === "list" ? "text-white" : "text-[#00b4eb]"}`} />
                  </button>
                </div>
              </div>

              {/* Desktop Action Bar (Original Clustered Layout) */}
              <div className="hidden md:flex flex-wrap items-center gap-3">
                {/* View Switcher */}
                <div className="inline-grid grid-cols-2 p-1 bg-white rounded-[14px] border border-[rgba(0,180,235,0.35)] shadow-sm w-[200px]">
                  <button
                    onClick={() => setViewMode("calendar")}
                    className={`inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-[10px] text-sm font-semibold transition-all duration-200 ${
                      viewMode === "calendar"
                        ? "bg-[#0056a2] text-white shadow-sm font-bold"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <FiCalendar className={`w-4 h-4 ${viewMode === "calendar" ? "text-white" : "text-[#00b4eb]"}`} />
                    <span>Calendar</span>
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-[10px] text-sm font-semibold transition-all duration-200 ${
                      viewMode === "list"
                        ? "bg-[#0056a2] text-white shadow-sm font-bold"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <FiList className={`w-4 h-4 ${viewMode === "list" ? "text-white" : "text-[#00b4eb]"}`} />
                    <span>List</span>
                  </button>
                </div>

                {/* Export Records */}
                <button
                  onClick={() => setShowExportModal(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    background: "white",
                    border: "1.5px solid rgba(0, 180, 235, 0.35)",
                    borderRadius: 14,
                    fontWeight: 600,
                    color: "#0056a2",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                  className="px-4 py-2.5 text-sm hover:bg-blue-50/50"
                >
                  <FiDownload className="mr-2 text-[#00b4eb] text-sm" />
                  Export My Records
                </button>

                {/* Add New Entry */}
                {!isAdmin && (
                  <Link
                    to="/log-book"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      background: "linear-gradient(135deg, #0056a2 0%, #00b4eb 100%)",
                      borderRadius: 14,
                      fontWeight: 600,
                      color: "white",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: "0 4px 14px rgba(0, 180, 235, 0.25)",
                    }}
                    className="px-4 py-2.5 text-sm hover:shadow-lg hover:opacity-95"
                  >
                    <FiPlus className="mr-2 text-sm" />
                    New Entry
                  </Link>
                )}
              </div>

              {/* Mobile Action Bar (Add New Entry & Export) */}
              <div className="flex md:hidden items-center justify-between w-full mt-4 gap-2">
                {/* Left Side: Add New Entry */}
                <div className="flex-1 flex justify-start">
                  {!isAdmin && (
                    <Link
                      to="/log-book"
                      className="inline-flex items-center justify-center gap-1.5 px-3 xs:px-4 py-2.5 bg-gradient-to-r from-[#0056a2] to-[#00b4eb] text-white rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all duration-200 min-h-[44px] w-full max-w-[160px]"
                    >
                      <FiPlus className="w-4 h-4 shrink-0" />
                      <span className="text-[12px] xs:text-[13px] font-semibold whitespace-nowrap">Add New Entry</span>
                    </Link>
                  )}
                </div>

                {/* Right Side: Export Records */}
                <button
                  onClick={() => setShowExportModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 xs:px-4 py-2.5 text-[12px] xs:text-[13px] font-semibold text-[#0056a2] bg-white border border-[rgba(0,180,235,0.35)] rounded-[14px] shadow-sm hover:bg-blue-50/60 active:scale-95 transition-all duration-200 min-h-[44px] whitespace-nowrap shrink-0"
                >
                  <FiDownload className="w-4 h-4 text-[#00b4eb] shrink-0" />
                  <span>Export My Records</span>
                </button>
              </div>
            </div>
          </div>

            {/* Main Content */}
            <div className="w-full">
              {viewMode === "calendar" ? (
                <div className="w-full">
                  {/* Calendar */}
                  {/* Calendar Container */}
                  <div 
                    className="w-full p-3 sm:p-6 md:p-8 bg-gradient-to-r from-[#006600] to-[#000066] text-white"
                    style={{
                      borderRadius: 20,
                      boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <h2 className="text-lg sm:text-2xl font-extrabold text-white">
                        {monthNames[currentMonth.getMonth()]}{" "}
                        {currentMonth.getFullYear()}
                      </h2>
                      <div className="flex items-center space-x-1.5 bg-white/15 backdrop-blur-sm rounded-xl p-1.5 border border-white/20">
                        <button
                          onClick={prevMonth}
                          aria-label="Previous Month"
                          className="p-2 sm:p-2.5 rounded-lg hover:bg-white/25 active:scale-95 text-white transition duration-200"
                        >
                          <FiChevronLeft className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                        </button>
                        <button
                          onClick={nextMonth}
                          aria-label="Next Month"
                          className="p-2 sm:p-2.5 rounded-lg hover:bg-white/25 active:scale-95 text-white transition duration-200"
                        >
                          <FiChevronRight className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                        </button>
                      </div>
                    </div>

                    <div className="w-full overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm mt-3 sm:mt-4">
                      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                          (day) => (
                            <div
                              key={day}
                              className="py-2 sm:py-3 text-center text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
                            >
                              <span className="hidden sm:inline">{day}</span>
                              <span className="sm:hidden">{day.charAt(0)}</span>
                            </div>
                          ),
                        )}
                      </div>

                      <div className="grid grid-cols-7 auto-rows-fr">
                        {calendarDays.map((dayItem, index) => {
                          const { date: day, isCurrentMonth } = dayItem;
                          const dayRecords = getRecordsForDate(day);
                          const holiday = getHolidayForDate(day);
                          const isToday = day.toDateString() === new Date().toDateString();
                          const isSelected = selectedDate && day.toDateString() === selectedDate.toDateString();
                          
                          const hasWorkRecord = dayRecords.some(r => r.status === "working" || r.status === "wfh");

                          let bgClass = isCurrentMonth ? "bg-white" : "bg-gray-50/50 text-gray-400 opacity-60";
                          if (isCurrentMonth && holiday) bgClass = "bg-yellow-50";
                          if (isCurrentMonth && hasWorkRecord) bgClass = "bg-green-100";
                          if (!isCurrentMonth && holiday) bgClass = "bg-yellow-50/40 opacity-60";

                          return (
                            <div
                              key={index}
                              onClick={() => {
                                setSelectedDate(day);
                                setIsDayModalOpen(true);
                              }}
                              className={`min-h-[55px] sm:min-h-[100px] md:min-h-[140px] border-b border-r border-gray-100 p-1 sm:p-2 flex flex-col justify-between transition-colors relative cursor-pointer hover:bg-indigo-50 ${bgClass}`}
                            >
                              {/* Holiday Name at the top if present (desktop only) */}
                              {dayRecords.length === 0 && holiday ? (
                                <div className="z-10 w-full text-center pt-0.5 hidden sm:block">
                                  <span className={`text-[11px] font-bold leading-tight w-full break-words block px-1 ${isCurrentMonth ? "text-red-600" : "text-red-400/70"}`}>
                                    {holiday.name}
                                  </span>
                                </div>
                              ) : (
                                <div className="hidden sm:block" />
                              )}

                              {/* Date Number fixed in the middle of the cell */}
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className={`text-xs sm:text-xl md:text-2xl font-semibold w-6 h-6 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full ${
                                  isToday 
                                    ? "bg-indigo-600 text-white shadow-md font-bold" 
                                    : isSelected 
                                    ? "text-indigo-700 font-bold" 
                                    : isCurrentMonth 
                                    ? "text-gray-700" 
                                    : "text-gray-400 font-normal"
                                }`}>
                                  {day.getDate()}
                                </span>
                              </div>
                              
                              <div className="flex flex-col gap-0.5 sm:gap-1 w-full justify-end z-10">
                                {dayRecords.map((record) => {
                                  // Status Pills
                                  if (record.status === "study_leave") {
                                    return (
                                      <React.Fragment key={record._id}>
                                        <span className="sm:hidden text-[8px] font-bold text-sky-700 bg-sky-100/90 px-0.5 py-0.5 rounded text-center truncate">Leave</span>
                                        <span className="hidden sm:block w-full text-center px-1 py-1 text-[10px] font-bold uppercase tracking-wide bg-sky-100 text-sky-700 rounded shadow-sm border border-sky-200 truncate">
                                          Extended Leave
                                        </span>
                                      </React.Fragment>
                                    );
                                  }
                                  if (record.status === "leave") {
                                    return (
                                      <React.Fragment key={record._id}>
                                        <span className="sm:hidden text-[8px] font-bold text-red-700 bg-red-100/90 px-0.5 py-0.5 rounded text-center truncate">Leave</span>
                                        <span className="hidden sm:block w-full text-center px-1 py-1 text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700 rounded shadow-sm border border-red-200 truncate">
                                          Leave
                                        </span>
                                      </React.Fragment>
                                    );
                                  }
                                  if (record.status === "wfh") {
                                    return (
                                      <React.Fragment key={record._id}>
                                        <span className="sm:hidden text-[8px] font-bold text-purple-700 bg-purple-100/90 px-0.5 py-0.5 rounded text-center truncate">WFH</span>
                                        <span className="hidden sm:block w-full text-center px-1 py-1 text-[10px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700 rounded shadow-sm border border-purple-200 truncate">
                                          WFH
                                        </span>
                                      </React.Fragment>
                                    );
                                  }
                                  return (
                                    <React.Fragment key={record._id}>
                                      <span className="sm:hidden text-[8px] font-bold text-blue-700 bg-blue-100/90 px-0.5 py-0.5 rounded text-center truncate">Work</span>
                                      <span className="hidden sm:block w-full text-center px-1 py-1 text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700 rounded shadow-sm border border-blue-200 truncate">
                                        Working
                                      </span>
                                    </React.Fragment>
                                  );
                                })}
                                {dayRecords.length === 0 && holiday && (
                                  <React.Fragment>
                                    <span className={`sm:hidden text-[8px] font-bold px-0.5 py-0.5 rounded text-center truncate ${isCurrentMonth ? "text-yellow-800 bg-yellow-100/90" : "text-yellow-700/60 bg-yellow-50"}`}>Hol</span>
                                    <span className={`hidden sm:block w-full text-center px-1 py-1 text-[10px] font-bold uppercase tracking-wide rounded shadow-sm border truncate ${isCurrentMonth ? "bg-yellow-100 text-yellow-700 border-yellow-200" : "bg-yellow-50 text-yellow-600/70 border-yellow-100"}`}>
                                      Holiday
                                    </span>
                                  </React.Fragment>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                /* List View */
                <>
                  <div 
                    className="mb-6 md:mb-8 p-6 md:p-8"
                    style={{
                      background: "white",
                      borderRadius: 20,
                      border: "1px solid rgba(0,0,0,0.06)",
                      boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                          {isAdmin ? "Student Records" : "My Records"}
                        </h2>
                        <p className="text-gray-500 text-sm mt-1">
                          Showing {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 sm:min-w-[200px]">
                          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                          <input
                            type="text"
                            placeholder="Search tasks..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                          />
                        </div>
                        <div className="relative">
                          <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                          <select
                            value={filterBy}
                            onChange={(e) => setFilterBy(e.target.value)}
                            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none text-sm cursor-pointer"
                          >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                          </select>
                        </div>
                        <div>
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none text-sm cursor-pointer"
                          >
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {filteredRecords.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-lg p-8 md:p-16 text-center border border-gray-200">
                      <div className="max-w-sm mx-auto">
                        <div className="bg-gray-100 rounded-full p-4 md:p-6 w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 flex items-center justify-center">
                          <FiCheckSquare className="text-2xl md:text-4xl text-gray-400" />
                        </div>
                        <h3 className="text-xl md:text-2xl font-semibold text-gray-600 mb-2 md:mb-3">
                          No Records Found
                        </h3>
                        <p className="text-gray-500 text-sm md:text-lg leading-relaxed">
                          {searchTerm || filterBy !== "all"
                            ? "Try adjusting your search or filter criteria to find what you're looking for."
                            : "No daily records have been submitted yet. Start by creating your first entry!"}
                        </p>
                        {!isAdmin &&
                          searchTerm === "" &&
                          filterBy === "all" && (
                            <Link
                              to="/log-book"
                              className="inline-flex items-center mt-4 md:mt-6 px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 text-sm md:text-base"
                            >
                              <FiPlus className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                              Create First Record
                            </Link>
                          )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
                      {filteredRecords.map((record) => (
                        <div
                          key={record._id}
                          className="bg-white hover:bg-indigo-50 transition-all duration-300 overflow-hidden flex flex-col min-w-0 h-auto"
                          style={{
                            borderRadius: 20,
                            border: "1.5px solid rgba(0, 180, 235, 0.2)",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.03)"
                          }}
                        >
                          <div className="p-4 md:p-5 flex-shrink-0 bg-gradient-to-r from-[#006600] to-[#000066] text-white">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                <div className="p-1.5 md:p-2 rounded-lg bg-white/15 backdrop-blur-sm">
                                  <FiUser className="text-xs md:text-sm flex-shrink-0 text-white" />
                                </div>
                                <span className="font-semibold truncate text-white text-sm md:text-base">
                                  {isAdmin
                                    ? record.internId?.traineeName ||
                                      "Unknown User"
                                    : "My Record"}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-white/80 text-xs md:text-sm mt-3">
                              <span className="font-medium text-white/90">
                                Trainee ID:
                              </span>
                              <span className="font-mono bg-white/15 backdrop-blur-sm px-2 py-1 md:py-1.5 rounded-lg text-white font-semibold shadow-sm text-xs md:text-sm border border-white/10">
                                {(() => {
                                  if (isAdmin && record.internId) {
                                    return (
                                      record.internId.Trainee_ID ||
                                      record.internId.traineeId ||
                                      record.internId.username ||
                                      record.internId._id ||
                                      "No ID Available"
                                    );
                                  } else if (!isAdmin) {
                                    if (record.internId)
                                      return (
                                        record.internId.Trainee_ID ||
                                        record.internId.traineeId ||
                                        record.internId.username ||
                                        ""
                                      );
                                    if (record.Trainee_ID)
                                      return record.Trainee_ID;
                                    if (studentInfo?.Trainee_ID)
                                      return studentInfo.Trainee_ID;
                                    if (studentInfo?.traineeId)
                                      return studentInfo.traineeId;
                                    return "No ID Available";
                                  }
                                  return "No ID Available";
                                })()}
                              </span>
                            </div>

                            <div className="flex items-center justify-between mt-3 text-white/80">
                              <div className="flex items-center gap-2 text-xs md:text-sm">
                                <FiCalendar className="flex-shrink-0 text-white/70" />
                                <span className="truncate font-medium text-white/90">
                                  {formatDate(record.createdAt || record.date)}
                                </span>
                              </div>
                              <div className="text-white/70 text-xs font-medium">
                                {getTimeAgo(record.createdAt || record.date)}
                              </div>
                            </div>
                          </div>

                          <div className="p-4 md:p-5 space-y-4 md:space-y-5 flex-1">
                            <div className="mb-2 flex flex-wrap gap-2">
                              {record.stack &&
                                !(
                                  record.status === "leave" &&
                                  record.stack === "On Leave"
                                ) && (
                                  <span className="inline-block px-2 md:px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                    {record.stack}
                                  </span>
                                )}
                              {record.status === "wfh" && (
                                <span className="inline-block px-2 md:px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                                  Work From Home
                                </span>
                              )}
                              {record.status === "leave" && (
                                <span className="inline-block px-2 md:px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                  On Leave
                                </span>
                              )}
                              {record.status === "study_leave" && (
                                <span className="inline-block px-2 md:px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-700">
                                  Extended Leave
                                </span>
                              )}
                            </div>

                            <div className="space-y-2 md:space-y-3">
                              <h4 className="font-semibold text-gray-800 flex items-center gap-2 md:gap-3">
                                <div className="bg-blue-100 p-1.5 md:p-2 rounded-lg flex-shrink-0">
                                  <FiCheckSquare className="text-blue-600 flex-shrink-0 text-xs md:text-sm" />
                                </div>
                                <span className="text-sm md:text-lg">
                                  Tasks Completed
                                </span>
                              </h4>
                              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 md:p-5 rounded-xl border border-blue-200">
                                <p className="text-gray-700 text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                                  {record.task}
                                </p>
                              </div>
                            </div>

                            {record.progress && (
                              <div className="space-y-2 md:space-y-3">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2 md:gap-3">
                                  <div className="bg-amber-100 p-1.5 md:p-2 rounded-lg flex-shrink-0">
                                    <FiAlertTriangle className="text-amber-600 flex-shrink-0 text-xs md:text-sm" />
                                  </div>
                                  <span className="text-sm md:text-lg">
                                    Challenges Faced
                                  </span>
                                </h4>
                                <div className="bg-gradient-to-r from-amber-50 to-amber-100 p-3 md:p-5 rounded-xl border border-amber-200">
                                  <p className="text-gray-700 text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                                    {record.progress}
                                  </p>
                                </div>
                              </div>
                            )}

                            {record.blockers && (
                              <div className="space-y-2 md:space-y-3">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2 md:gap-3">
                                  <div className="bg-emerald-100 p-1.5 md:p-2 rounded-lg flex-shrink-0">
                                    <FiPlus className="text-emerald-600 flex-shrink-0 text-xs md:text-sm" />
                                  </div>
                                  <span className="text-sm md:text-lg">
                                    Plans for Tomorrow
                                  </span>
                                </h4>
                                <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 p-3 md:p-5 rounded-xl border border-emerald-200">
                                  <p className="text-gray-700 text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                                    {record.blockers}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
        </main>
      </div>
    </div>
  );
};

export default DailyRecords;
