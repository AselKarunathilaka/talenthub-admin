import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  FaSpinner,
  FaCalendarAlt,
  FaUser,
  FaTasks,
  FaExclamationTriangle,
  FaPlus,
  FaSearch,
  FaFilter,
  FaBook,
  FaChevronLeft,
  FaChevronRight,
  FaFilePdf,
  FaTimes,
} from "react-icons/fa";
import Navigation from "../components/Navigation";
import ExportModal from "../components/ExportModal";

// ── Main Component ────────────────────────────────────────────────────────────
const DailyRecords = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState("calendar");

  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const isAdmin = location.pathname.includes("/admin/");
  const studentInfo = JSON.parse(localStorage.getItem("studentInfo") || "{}");

  // ── Calendar helpers ────────────────────────────────────────
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const daysInMonth = getDaysInMonth(currentMonth);
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
        record.task.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  const getDayClass = (day) => {
    if (!day) return "";
    const hasRecords = getRecordsForDate(day).length > 0;
    const isSelected =
      selectedDate &&
      day.getDate() === selectedDate.getDate() &&
      day.getMonth() === selectedDate.getMonth() &&
      day.getFullYear() === selectedDate.getFullYear();
    const isToday = day.toDateString() === new Date().toDateString();
    let classes =
      "min-h-[60px] md:min-h-[80px] p-1 md:p-2 border border-gray-100 rounded-lg cursor-pointer transition duration-200 hover:bg-gray-50 flex flex-col justify-between";
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
      <div className="flex flex-col lg:flex-row min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Navigation />
        <div className="flex-1 w-full lg:mt-20 lg:px-10 flex items-center justify-center px-4">
          <div className="text-center bg-white rounded-2xl shadow-lg p-8 md:p-12 border border-gray-200 max-w-md w-full">
            <div className="bg-indigo-100 rounded-full p-4 md:p-6 w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 flex items-center justify-center">
              <FaSpinner className="animate-spin text-2xl md:text-4xl text-indigo-600" />
            </div>
            <h3 className="text-xl md:text-2xl font-semibold text-gray-800 mb-2">
              Loading Daily Records
            </h3>
            <p className="text-gray-600 text-sm md:text-lg">
              Please wait while we fetch your records...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Navigation />
        <div className="flex-1 w-full lg:mt-20 lg:px-10 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 max-w-md w-full text-center border border-gray-200">
            <div className="bg-red-100 rounded-full p-4 md:p-6 w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 flex items-center justify-center">
              <FaExclamationTriangle className="text-2xl md:text-4xl text-red-500" />
            </div>
            <h2 className="text-xl md:text-2xl font-semibold text-gray-800 mb-3 md:mb-4">
              Error Loading Records
            </h2>
            <p className="text-gray-600 mb-4 md:mb-6 leading-relaxed text-sm md:text-base">
              {error}
            </p>
            <button
              onClick={fetchDailyRecords}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 md:px-8 py-2 md:py-3 rounded-xl transition duration-300 font-medium shadow-lg text-sm md:text-base"
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
    <div className="flex flex-col lg:flex-row min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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

      <div className="flex-1 w-full lg:mt-20 lg:px-10">
        <main className="mx-auto px-4 py-6 md:py-8 lg:py-10 max-w-7xl">
          {/* Export error toast */}
          {exportError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
              <span>{exportError}</span>
              <button
                onClick={() => setExportError(null)}
                className="ml-2 text-red-500 hover:text-red-700"
              >
                <FaTimes />
              </button>
            </div>
          )}

          {/* Navigation Header */}
          <nav className="bg-white shadow-lg rounded-xl border border-gray-200 mb-6 md:mb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center py-4 lg:py-6 gap-4 lg:gap-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <FaCalendarAlt className="text-indigo-600 text-xl md:text-2xl" />
                  </div>
                  <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-800">
                      {isAdmin ? "All Student Records" : "My Daily Records"}
                    </h1>
                    <p className="text-gray-600 text-xs md:text-sm">
                      Track daily progress and achievements
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-3">
                  {/* Toggle View */}
                  <button
                    onClick={() =>
                      setViewMode(viewMode === "calendar" ? "list" : "calendar")
                    }
                    className="inline-flex items-center justify-center px-4 lg:px-5 py-2 lg:py-3 bg-white border border-gray-200 rounded-xl shadow-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 group cursor-pointer text-sm"
                  >
                    <FaCalendarAlt className="mr-2 h-3 w-3 lg:h-4 lg:w-4 text-blue-600 group-hover:text-blue-700" />
                    <span className="whitespace-nowrap">
                      {viewMode === "calendar" ? "List View" : "Calendar View"}
                    </span>
                  </button>

                  {/* Export PDF — visible to both intern and admin */}
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="inline-flex items-center justify-center px-4 lg:px-5 py-2 lg:py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 text-sm"
                  >
                    <FaFilePdf className="mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                    <span className="whitespace-nowrap">Export Records</span>
                  </button>

                  {/* Add New Entry — intern only */}
                  {!isAdmin && (
                    <Link
                      to="/log-book"
                      className="inline-flex items-center justify-center px-4 lg:px-5 py-2 lg:py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 text-sm"
                    >
                      <FaBook className="mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                      <span className="whitespace-nowrap">Add New Entry</span>
                      <FaPlus className="ml-2 h-3 w-3 lg:h-4 lg:w-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <div className="py-4">
            <div className="max-w-7xl mx-auto">
              {viewMode === "calendar" ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
                  {/* Calendar */}
                  <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 md:mb-6 gap-3 sm:gap-0">
                      <h2 className="text-xl md:text-2xl font-bold text-gray-900 text-center sm:text-left">
                        {monthNames[currentMonth.getMonth()]}{" "}
                        {currentMonth.getFullYear()}
                      </h2>
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={prevMonth}
                          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition duration-200"
                        >
                          <FaChevronLeft className="text-gray-600" />
                        </button>
                        <button
                          onClick={goToToday}
                          className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition duration-200"
                        >
                          Today
                        </button>
                        <button
                          onClick={nextMonth}
                          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition duration-200"
                        >
                          <FaChevronRight className="text-gray-600" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-4">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (day) => (
                          <div
                            key={day}
                            className="p-2 md:p-3 text-center text-xs md:text-sm font-medium text-gray-500 border-b border-gray-200"
                          >
                            <span className="hidden sm:inline">{day}</span>
                            <span className="sm:hidden">{day.charAt(0)}</span>
                          </div>
                        ),
                      )}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {daysInMonth.map((day, index) => (
                        <div
                          key={index}
                          className={getDayClass(day)}
                          onClick={() => day && setSelectedDate(day)}
                        >
                          {day && (
                            <>
                              <div className="text-xs md:text-sm font-medium text-gray-900">
                                {day.getDate()}
                              </div>
                              {getRecordsForDate(day).length > 0 && (
                                <div className="absolute bottom-1 w-full flex justify-center left-1/2 transform -translate-x-1/2">
                                  {getRecordsForDate(day).some(r => r.status === "study_leave") ? (
                                    <span className="text-[8px] md:text-[9px] bg-sky-100 text-sky-700 px-1 py-0.5 rounded font-semibold whitespace-nowrap shadow-sm">
                                      Extended Leave
                                    </span>
                                  ) : (
                                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-indigo-500 rounded-full"></div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Selected Date Records */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">
                      <span className="hidden sm:inline">
                        Records for{" "}
                        {selectedDate.toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                      <span className="sm:hidden">
                        Records for{" "}
                        {selectedDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </h3>

                    {selectedDateRecords.length > 0 ? (
                      <div className="space-y-3 md:space-y-4 max-h-80 md:max-h-96 overflow-y-auto">
                        {selectedDateRecords.map((record) => (
                          <div
                            key={record._id}
                            className="bg-gray-50 rounded-lg p-3 md:p-4 border border-gray-200 hover:shadow-sm transition duration-200"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <FaUser className="text-indigo-600 text-sm" />
                              <span className="font-medium text-gray-900 text-sm">
                                {isAdmin
                                  ? record.internId?.traineeName ||
                                    "Unknown User"
                                  : "My Record"}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mb-1">
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
                            <p className="text-gray-700 text-xs md:text-sm line-clamp-3 break-words leading-relaxed">
                              {record.task}
                            </p>
                            <div className="text-xs text-gray-500 mt-2">
                              {formatDate(record.createdAt || record.date)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 md:py-8">
                        <FaTasks className="text-3xl md:text-4xl text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm md:text-base">
                          No records for this date
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* List View */
                <>
                  <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-6 md:mb-8 border border-gray-200 bg-gradient-to-r from-white to-gray-50">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 md:gap-6">
                      <div className="text-center sm:text-left">
                        <h1 className="text-2xl md:text-4xl font-bold tracking-wide bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                          Daily Records
                        </h1>
                        <p className="text-gray-600 mt-2 text-base md:text-lg">
                          {filteredRecords.length} record
                          {filteredRecords.length !== 1 ? "s" : ""} found
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 md:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                      <div className="relative sm:col-span-2 lg:col-span-1">
                        <FaSearch className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search records..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-4 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 transition duration-300 shadow-sm hover:border-gray-400 hover:shadow-md text-sm md:text-base"
                        />
                      </div>
                      <div className="relative">
                        <FaFilter className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <select
                          value={filterBy}
                          onChange={(e) => setFilterBy(e.target.value)}
                          className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-4 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 transition duration-300 shadow-sm appearance-none hover:border-gray-400 hover:shadow-md text-sm md:text-base"
                        >
                          <option value="all">All Records</option>
                          <option value="today">Today</option>
                          <option value="week">This Week</option>
                          <option value="month">This Month</option>
                        </select>
                      </div>
                      <div>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="w-full px-4 py-3 md:py-4 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 transition duration-300 shadow-sm appearance-none hover:border-gray-400 hover:shadow-md text-sm md:text-base"
                        >
                          <option value="newest">Newest First</option>
                          <option value="oldest">Oldest First</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {filteredRecords.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-lg p-8 md:p-16 text-center border border-gray-200">
                      <div className="max-w-sm mx-auto">
                        <div className="bg-gray-100 rounded-full p-4 md:p-6 w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 flex items-center justify-center">
                          <FaTasks className="text-2xl md:text-4xl text-gray-400" />
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
                              <FaPlus className="mr-2 h-3 w-3 md:h-4 md:w-4" />
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
                          className="bg-white rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col transform hover:-translate-y-1 hover:scale-[1.02] min-w-0"
                        >
                          <div className="bg-gradient-to-r from-blue-100 to-blue-200 p-4 md:p-6 flex-shrink-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                <div className="bg-white/30 p-1.5 md:p-2 rounded-lg">
                                  <FaUser className="text-xs md:text-sm flex-shrink-0 text-gray-700" />
                                </div>
                                <span className="font-semibold truncate text-gray-800 text-sm md:text-lg">
                                  {isAdmin
                                    ? record.internId?.traineeName ||
                                      "Unknown User"
                                    : "My Record"}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-gray-700 text-xs md:text-sm mt-3 md:mt-4">
                              <span className="text-gray-600 font-medium">
                                Trainee ID:
                              </span>
                              <span className="font-mono bg-white/30 px-2 md:px-4 py-1 md:py-2 rounded-lg text-gray-800 font-semibold backdrop-blur-sm text-xs md:text-sm">
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

                            <div className="flex items-center gap-2 md:gap-3 text-gray-700 text-xs md:text-sm mt-2 md:mt-3">
                              <div className="bg-white/30 p-1 md:p-1.5 rounded-lg">
                                <FaCalendarAlt className="flex-shrink-0 text-gray-700" />
                              </div>
                              <span className="truncate font-medium">
                                {formatDate(record.createdAt || record.date)}
                              </span>
                            </div>
                            <div className="text-gray-600 text-xs mt-1 md:mt-2 ml-6 md:ml-8">
                              {getTimeAgo(record.createdAt || record.date)}
                            </div>
                          </div>

                          <div className="p-4 md:p-6 space-y-4 md:space-y-6 flex-grow">
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
                                  <FaTasks className="text-blue-600 flex-shrink-0 text-xs md:text-sm" />
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
                                    <FaExclamationTriangle className="text-amber-600 flex-shrink-0 text-xs md:text-sm" />
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
                                    <FaPlus className="text-emerald-600 flex-shrink-0 text-xs md:text-sm" />
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
          </div>
        </main>
      </div>
    </div>
  );
};

export default DailyRecords;
