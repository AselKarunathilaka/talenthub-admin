import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  BarChart3,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Mail,
  Briefcase,
  GraduationCap,
  Calendar,
  Video,
  BookOpen,
  GitCommit,
  Activity,
  User,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Users,
  Building2,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AdminNavigation from "../components/AdminNavigation";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import axios from "axios";
import { API_BASE_URL } from "../api/apiConfig";

// ── Auth token retriever (supports adminInfo, userData, and token keys) ───────
const getAuthToken = () => {
  const adminInfo = localStorage.getItem("adminInfo");
  if (adminInfo) {
    try {
      const parsed = JSON.parse(adminInfo);
      if (parsed.token) return parsed.token;
    } catch {
      /* ignore */
    }
  }

  const userData = localStorage.getItem("userData");
  if (userData) {
    try {
      const parsed = JSON.parse(userData);
      if (parsed.token) return parsed.token;
    } catch {
      /* ignore */
    }
  }

  return localStorage.getItem("token") || null;
};

// ── Date Formatter (YYYY/MM/DD) ──────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "N/A";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
};

// ── Specialization classifier for non-coding roles (QA, BA, PM, DevOps, AI) ───
const isNoCommitSpecialization = (spec) => {
  if (!spec) return false;
  const s = spec.trim().toLowerCase();

  if (/\b(qa|sqa|ba|pm|apm|devops|ai|ml|genai|sre|nlp)\b/i.test(s)) {
    return true;
  }

  return (
    s === "qa" ||
    s.includes("quality assurance") ||
    s.includes("software quality") ||
    s.includes("qa engineer") ||
    s === "ba" ||
    s.includes("business analyst") ||
    s.includes("business analysis") ||
    s.includes("business analytics") ||
    s === "pm" ||
    s.includes("project manager") ||
    s.includes("project management") ||
    s.includes("product manager") ||
    s.includes("product management") ||
    s === "devops" ||
    s.includes("devops") ||
    s.includes("dev ops") ||
    s === "ai" ||
    s.includes("artificial intelligence") ||
    s.includes("machine learning") ||
    s.includes("data science") ||
    s.includes("data scientist") ||
    s.includes("deep learning") ||
    s.includes("computer vision") ||
    s.includes("generative ai") ||
    s.startsWith("ai ") ||
    s.endsWith(" ai") ||
    s.includes(" ai ") ||
    s.includes("ai/") ||
    s.includes("/ai")
  );
};

// ── Rate color helper ────────────────────────────────────────────────────────
const getRateTextColor = (rate) => {
  if (rate >= 80) return "text-emerald-600";
  if (rate >= 60) return "text-amber-500";
  return "text-rose-500";
};

const getStatusBadge = (status) => {
  const s = String(status || "").trim();
  switch (s) {
    case "In Progress":
    case "Active":
    case "On Track":
    case "IN_PROGRESS":
    case "INPROGRESS":
    case "ACTIVE":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Completed":
    case "Good":
    case "COMPLETE":
    case "COMPLETED":
    case "DONE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "On Hold":
    case "ON_HOLD":
    case "ONHOLD":
    case "HOLD":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "At Risk":
    case "Delayed":
    case "AT_RISK":
    case "DELAYED":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "Planning":
    case "Testing":
    case "PLANNING":
    case "TESTING":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "Retired":
    case "RETIRED":
      return "bg-slate-100 text-slate-600 border-slate-300";
    case "Cancelled":
    case "Canceled":
    case "CANCELLED":
    case "CANCELED":
    case "Poor":
    case "Inactive":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
};

// Clean status text display without badge/tag styling
const getPerformanceStatusText = (rate) => {
  if (rate >= 80) {
    return <span className="text-[13px] font-bold text-emerald-600">Good</span>;
  }
  if (rate >= 60) {
    return <span className="text-[13px] font-bold text-amber-500">At Risk</span>;
  }
  return <span className="text-[13px] font-bold text-rose-600">Poor</span>;
};

// Profile avatar with image and fallback initial
const InternAvatar = ({ id, name, size = "w-9 h-9", textClass = "text-xs" }) => {
  const [hasError, setHasError] = useState(false);
  const initial = (name || "?").charAt(0).toUpperCase();

  if (hasError || !id) {
    return (
      <div className={`${size} rounded-full bg-gradient-to-br from-[#000066] to-[#006600] flex items-center justify-center text-white ${textClass} font-bold shadow-sm flex-shrink-0`}>
        {initial}
      </div>
    );
  }

  return (
    <div className={`${size} rounded-full bg-slate-100 flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0 overflow-hidden relative border border-slate-200`}>
      <img
        src={`${API_BASE_URL}/interns/${id}/profile-picture`}
        alt={name || "Intern"}
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
};

// Helper to compute month date range for analytics filtering
const computeMonthRange = (selection, includeCurrent) => {
  if (selection === "all" && !includeCurrent) {
    return { startDate: null, endDate: null, label: "All Months" };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed (0 = Jan, 7 = Aug)

  const formatYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const curMonthStart = new Date(currentYear, currentMonth, 1);
  const curMonthEnd = new Date(currentYear, currentMonth + 1, 0);

  if (selection === "current" || (selection === "all" && includeCurrent)) {
    return {
      startDate: formatYMD(curMonthStart),
      endDate: formatYMD(curMonthEnd),
      label: "Current Month",
    };
  }

  let startMonthOffset = 1;
  let baseLabel = "Previous Month";

  if (selection === "prev1") {
    startMonthOffset = 1;
    baseLabel = "Previous Month";
  } else if (selection === "prev2") {
    startMonthOffset = 2;
    baseLabel = "Previous 2 Months";
  } else if (selection === "prev3") {
    startMonthOffset = 3;
    baseLabel = "Previous 3 Months";
  }

  const rangeStart = new Date(currentYear, currentMonth - startMonthOffset, 1);
  const rangeEnd = includeCurrent
    ? curMonthEnd
    : new Date(currentYear, currentMonth, 0); // Last day of previous month

  let label = baseLabel;
  if (includeCurrent) {
    if (selection === "prev1") label = "Current + Previous Month";
    else if (selection === "prev2") label = "Current + Prev 2 Months";
    else if (selection === "prev3") label = "Current + Prev 3 Months";
  }

  return {
    startDate: formatYMD(rangeStart),
    endDate: formatYMD(rangeEnd),
    label,
  };
};

const AdminAnalytics = () => {
  const navigate = useNavigate();

  const [analyticsData, setAnalyticsData] = useState([]);
  const [summaryStats, setSummaryStats] = useState({ total: 0, good: 0, atRisk: 0, poor: 0 });
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [uniqueSpecializations, setUniqueSpecializations] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);

  // Filters and Sorting
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [specFilter, setSpecFilter] = useState("all");
  const [monthSelection, setMonthSelection] = useState("all");
  const [includeCurrentMonth, setIncludeCurrentMonth] = useState(false);
  const [useInternStartDate, setUseInternStartDate] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const monthDropdownRef = useRef(null);

  const [sortConfig, setSortConfig] = useState({ key: "traineeId", direction: "asc" });
  const [expandedRowId, setExpandedRowId] = useState(null);

  // Server-Side Pagination (default 25 items per page for ultra-fast loading)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Debounce search term to prevent rapid requests while typing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Active month range computation
  const activeMonthRange = useMemo(() => {
    return computeMonthRange(monthSelection, includeCurrentMonth);
  }, [monthSelection, includeCurrentMonth]);

  // Click outside to close month dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(e.target)) {
        setIsMonthDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      const token = getAuthToken();
      if (!token) {
        setError("Admin authentication required. Please log in.");
        setIsLoading(false);
        setIsRefreshing(false);
        navigate("/admin-login");
        return;
      }

      const range = computeMonthRange(monthSelection, includeCurrentMonth);
      const params = new URLSearchParams();
      if (isRefresh) params.set("refresh", "true");
      if (range.startDate && range.endDate) {
        params.set("startDate", range.startDate);
        params.set("endDate", range.endDate);
        params.set("useInternStartDate", String(useInternStartDate));
      }
      params.set("page", String(currentPage));
      params.set("limit", String(pageSize));
      if (debouncedSearchTerm.trim()) params.set("search", debouncedSearchTerm.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (specFilter !== "all") params.set("specialization", specFilter);
      if (sortConfig.key) {
        params.set("sortBy", sortConfig.key);
        params.set("sortOrder", sortConfig.direction);
      }

      const res = await axios.get(`${API_BASE_URL}/admin/analytics?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.data) {
        if (Array.isArray(res.data)) {
          setAnalyticsData(res.data);
          setTotalEntries(res.data.length);
          setTotalPages(Math.max(1, Math.ceil(res.data.length / pageSize)));
          const good = res.data.filter((i) => (Number(i.performanceRate) || 0) >= 80).length;
          const atRisk = res.data.filter((i) => (Number(i.performanceRate) || 0) >= 60 && (Number(i.performanceRate) || 0) < 80).length;
          const poor = res.data.filter((i) => (Number(i.performanceRate) || 0) < 60).length;
          setSummaryStats({ total: res.data.length, good, atRisk, poor });
        } else {
          setAnalyticsData(res.data.interns || []);
          if (res.data.summary) {
            setSummaryStats(res.data.summary);
          }
          if (res.data.pagination) {
            setTotalEntries(res.data.pagination.total);
            setTotalPages(res.data.pagination.totalPages);
          } else if (typeof res.data.total === "number") {
            setTotalEntries(res.data.total);
            setTotalPages(Math.max(1, Math.ceil(res.data.total / pageSize)));
          }
          if (Array.isArray(res.data.specializations)) {
            setUniqueSpecializations(res.data.specializations);
          }
        }
      } else {
        setAnalyticsData([]);
        setTotalEntries(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Error fetching admin analytics:", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Session expired or unauthorized. Redirecting to login...");
        setTimeout(() => navigate("/admin-login"), 1500);
      } else {
        setError(err.response?.data?.message || "Failed to load analytics data.");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [
    navigate,
    monthSelection,
    includeCurrentMonth,
    useInternStartDate,
    currentPage,
    pageSize,
    debouncedSearchTerm,
    statusFilter,
    specFilter,
    sortConfig,
  ]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const toggleRow = (id) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (val) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleSpecFilterChange = (val) => {
    setSpecFilter(val);
    setCurrentPage(1);
  };

  // Helper to fetch all matching users for PDF and CSV export
  const fetchAllMatchingDataForExport = async () => {
    const token = getAuthToken();
    if (!token) return [];

    const range = computeMonthRange(monthSelection, includeCurrentMonth);
    const params = new URLSearchParams();
    params.set("exportAll", "true");
    if (range.startDate && range.endDate) {
      params.set("startDate", range.startDate);
      params.set("endDate", range.endDate);
      params.set("useInternStartDate", String(useInternStartDate));
    }
    if (searchTerm.trim()) params.set("search", searchTerm.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (specFilter !== "all") params.set("specialization", specFilter);
    if (sortConfig.key) {
      params.set("sortBy", sortConfig.key);
      params.set("sortOrder", sortConfig.direction);
    }

    const res = await axios.get(`${API_BASE_URL}/admin/analytics?${params.toString()}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.data) {
      if (Array.isArray(res.data)) return res.data;
      if (Array.isArray(res.data.interns)) return res.data.interns;
    }
    return analyticsData;
  };

  const SortIcon = ({ columnKey }) => {
    const isSorted = sortConfig.key === columnKey;
    return (
      <span className={`transition-opacity duration-150 ${isSorted ? "opacity-100 text-[#000066]" : "opacity-0 group-hover:opacity-100 text-slate-400"}`}>
        {isSorted && sortConfig.direction === "desc" ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#000066]" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5" />
        )}
      </span>
    );
  };

  // CSV Export Handler - Fetches all matching users
  const exportToCSV = async () => {
    try {
      setIsExporting(true);
      const allMatching = await fetchAllMatchingDataForExport();
      if (!allMatching || allMatching.length === 0) return;

      const headers = [
        "Trainee ID",
        "Intern Name",
        "Email",
        "University / Institute",
        "Specialization",
        "Start Date",
        "End Date",
        "Working Days",
        "Expected Meetings",
        "Daily Attendance %",
        "Meeting Attendance %",
        "Logbook %",
        "Performance %",
        "Status",
        "Daily Att. Count",
        "Meeting Att. Count",
        "Logbook Count",
        "Git Commits",
        "Assigned Projects"
      ];

      const rows = allMatching.map((item) => [
        `"${item.traineeId || ""}"`,
        `"${item.name || ""}"`,
        `"${item.email || ""}"`,
        `"${item.institute || item.university || "Not Specified"}"`,
        `"${item.specialization || ""}"`,
        `"${formatDate(item.startDate)}"`,
        `"${formatDate(item.endDate)}"`,
        item.workingDays ?? 0,
        item.expectedMeetings ?? 0,
        item.dailyAttendanceRate,
        item.meetingAttendanceRate,
        item.logbookRecordRate,
        item.performanceRate,
        `"${item.internStatus || ""}"`,
        item.dailyAttendanceCount,
        item.meetingAttendanceCount,
        item.logbookCount,
        isNoCommitSpecialization(item.specialization) ? "N/A" : item.commitCount,
        `"${(item.projects || []).map((p) => p?.name || p?.projectName || String(p)).join(", ")}"`
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      const safeMonthLabel = activeMonthRange.label.replace(/[^a-zA-Z0-9]/g, "_");
      link.setAttribute("download", `TalentHub_Analytics_${safeMonthLabel}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export CSV:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // PDF Export Handler - Fetches all matching users
  const exportToPDF = async () => {
    try {
      setIsExporting(true);
      const allMatching = await fetchAllMatchingDataForExport();
      if (!allMatching || allMatching.length === 0) return;

      const doc = new jsPDF("landscape");
      
      // Title
      doc.setFontSize(22);
      doc.setTextColor(0, 0, 102); // #000066
      doc.text("TalentHub Analytics Report", 14, 20);
      
      // Date, time & Period
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Period: ${activeMonthRange.label}   |   Generated on: ${new Date().toLocaleString()}`, 14, 28);
      
      // KPI summary
      doc.setFontSize(11);
      doc.setTextColor(50, 50, 50);
      doc.text(
        `Total Interns: ${summaryStats.total}   |   Good: ${summaryStats.good}   |   At Risk: ${summaryStats.atRisk}   |   Poor: ${summaryStats.poor}`,
        14, 38
      );

      const tableColumn = [
        "ID", 
        "Name", 
        "University", 
        "Stack", 
        "Start Date",
        "Projects", 
        "Daily", 
        "Meeting", 
        "Performance", 
        "Status"
      ];
      
      const tableRows = [];

      allMatching.forEach(item => {
        const rowData = [
          item.traineeId || "",
          item.name || "",
          item.institute || item.university || "Not Specified",
          item.specialization || "",
          formatDate(item.startDate) || "",
          (item.projects || []).map(p => p?.name || p?.projectName || String(p)).join("\n"),
          `${item.dailyAttendanceRate}%`,
          `${item.meetingAttendanceRate}%`,
          `${item.performanceRate}%`,
          item.internStatus || (item.performanceRate >= 80 ? "Good" : item.performanceRate >= 60 ? "At Risk" : "Poor")
        ];
        tableRows.push(rowData);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3, textColor: [40, 40, 40] },
        headStyles: { fillColor: [0, 0, 102], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 40 },
          2: { cellWidth: 38 },
          3: { cellWidth: 20 },
          4: { cellWidth: 20 },
          5: { cellWidth: 55 },
          6: { cellWidth: 18, halign: 'center' },
          7: { cellWidth: 18, halign: 'center' },
          8: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
          9: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 9) {
            const status = data.cell.raw;
            if (status === 'Good') {
              data.cell.styles.textColor = [5, 150, 105]; // emerald-600
            } else if (status === 'At Risk') {
              data.cell.styles.textColor = [217, 119, 6]; // amber-600
            } else if (status === 'Poor') {
              data.cell.styles.textColor = [225, 29, 72]; // rose-600
            }
          }
        }
      });

      const safeMonthLabel = activeMonthRange.label.replace(/[^a-zA-Z0-9]/g, "_");
      doc.save(`TalentHub_Analytics_${safeMonthLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Mobile Card Component
  const MobileCard = ({ row }) => {
    const isExpanded = expandedRowId === row.id;
    const isNoCommit = isNoCommitSpecialization(row.specialization);

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div
          onClick={() => toggleRow(row.id)}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <InternAvatar id={row.id} name={row.name} size="w-10 h-10" />
            <div className="min-w-0">
              <h3 className="font-bold text-slate-800 leading-tight truncate text-sm">{row.name}</h3>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                {row.email} • {row.traineeId}
              </p>
              {row.institute && row.institute !== "Not Specified" && (
                <p className="text-[11px] font-medium text-indigo-600/90 flex items-center gap-1 truncate mt-0.5">
                  <Building2 className="w-3 h-3 flex-shrink-0 text-indigo-400" />
                  <span className="truncate">{row.institute}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {getPerformanceStatusText(row.performanceRate)}
            <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </motion.div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-slate-100 bg-slate-50"
            >
              <div className="p-4 space-y-4">
                {/* Stack & Dates */}
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{row.specialization}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>Duration: <strong className="text-slate-700">{formatDate(row.startDate)} – {formatDate(row.endDate)}</strong></span>
                  </div>
                </div>

                {/* Rates without progress bars */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm grid grid-cols-2 gap-4 text-center">
                  <div className="flex flex-col items-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Daily Att.</p>
                    <span className={`text-[15px] font-black ${getRateTextColor(row.dailyAttendanceRate)}`}>
                      {row.dailyAttendanceRate}%
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Meeting Att.</p>
                    <span className={`text-[15px] font-black ${getRateTextColor(row.meetingAttendanceRate)}`}>
                      {row.meetingAttendanceRate}%
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Logbook</p>
                    <span className={`text-[15px] font-black ${getRateTextColor(row.logbookRecordRate)}`}>
                      {row.logbookRecordRate}%
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Performance</p>
                    <span className={`text-[15px] font-black ${getRateTextColor(row.performanceRate)}`}>
                      {row.performanceRate}%
                    </span>
                  </div>
                </div>

                {/* Counts - without tags */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Activity Summary</h4>
                  <div className={`grid ${isNoCommit ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3 sm:grid-cols-6"} gap-2 text-center`}>
                    <div className="flex flex-col items-center">
                      <span className="text-base font-black text-blue-600 leading-none">{row.dailyAttendanceCount}</span>
                      <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider mt-1">Daily Att.</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-base font-black text-purple-600 leading-none">{row.meetingAttendanceCount}</span>
                      <span className="text-[9px] text-purple-600 font-bold uppercase tracking-wider mt-1">Meetings</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-base font-black text-amber-600 leading-none">{row.logbookCount}</span>
                      <span className="text-[9px] text-amber-600 font-bold uppercase tracking-wider mt-1">Logbook</span>
                    </div>
                    {!isNoCommit && (
                      <div className="flex flex-col items-center">
                        <span className="text-base font-black text-emerald-600 leading-none">{row.commitCount}</span>
                        <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mt-1">Commits</span>
                      </div>
                    )}
                    <div className="flex flex-col items-center">
                      <span className="text-base font-black text-teal-600 leading-none">{row.workingDays ?? 0}</span>
                      <span className="text-[9px] text-teal-600 font-bold uppercase tracking-wider mt-1">Work Days</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-base font-black text-indigo-600 leading-none">{row.expectedMeetings ?? 0}</span>
                      <span className="text-[9px] text-indigo-600 font-bold uppercase tracking-wider mt-1">Exp Meets</span>
                    </div>
                  </div>
                </div>

                {/* Projects */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Assigned Projects</h4>
                  <div className="space-y-2">
                    {row.projects && row.projects.length > 0 ? (
                      row.projects.map((proj, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <Briefcase className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                            <span className="text-xs font-semibold text-slate-700 truncate">{proj?.name || proj?.projectName || String(proj)}</span>
                          </div>
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${getStatusBadge(proj?.status)}`}>
                            {proj?.status || "In Progress"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic text-center py-2">No projects assigned.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <AdminNavigation>
      <div className="min-h-screen flex flex-col bg-[#F8FAFC] font-sans">
        <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8">
          <div className="max-w-[1600px] w-full mx-auto flex flex-col flex-1 space-y-6">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 md:w-12 md:h-12 flex-shrink-0 rounded-xl bg-gradient-to-br from-[#000066] to-[#006600] flex items-center justify-center text-white shadow-md">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">Analytics Overview</h1>
                  <p className="text-xs md:text-sm font-medium text-slate-500">Monitor intern performance, attendance, and project progress.</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={exportToPDF}
                  disabled={isLoading || isExporting || totalEntries === 0}
                  className="flex items-center gap-2 px-3.5 py-2 md:py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-semibold text-slate-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  title="Export to PDF"
                >
                  <FileText className="w-4 h-4 text-rose-500" />
                  <span>{isExporting ? "Exporting..." : "Export PDF"}</span>
                </button>
                <button
                  onClick={exportToCSV}
                  disabled={isLoading || isExporting || totalEntries === 0}
                  className="flex items-center gap-2 px-3.5 py-2 md:py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-semibold text-slate-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  title="Export to CSV"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => fetchAnalytics(true)}
                  disabled={isLoading || isRefreshing}
                  title="Refresh Data"
                  className="p-2 md:p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition-colors flex-shrink-0 disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing || isLoading ? 'animate-spin text-[#000066]' : ''}`} />
                </button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {/* Total Interns */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Interns</p>
                  <p className="text-xl font-black text-slate-800 leading-tight">
                    {isLoading ? "..." : summaryStats.total}
                  </p>
                </div>
              </div>

              {/* Good Performance */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Good (&ge;80%)</p>
                  <p className="text-xl font-black text-emerald-600 leading-tight">
                    {isLoading ? "..." : summaryStats.good}
                  </p>
                </div>
              </div>

              {/* At Risk */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">At Risk (60-79%)</p>
                  <p className="text-xl font-black text-amber-600 leading-tight">
                    {isLoading ? "..." : summaryStats.atRisk}
                  </p>
                </div>
              </div>

              {/* Poor */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Poor (&lt;60%)</p>
                  <p className="text-xl font-black text-rose-600 leading-tight">
                    {isLoading ? "..." : summaryStats.poor}
                  </p>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  autoComplete="off"
                  spellCheck="false"
                  placeholder="Search intern name, ID, email, university, specialization..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-[#000066] transition-colors placeholder:text-slate-400"
                />
                {searchTerm && (
                  <button
                    onClick={() => handleSearchChange("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Status Filter */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs font-semibold">
                  {[
                    { key: "all", label: "All Status" },
                    { key: "Good", label: "Good" },
                    { key: "At Risk", label: "At Risk" },
                    { key: "Poor", label: "Poor" }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => handleStatusFilterChange(tab.key)}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        statusFilter === tab.key
                          ? "bg-[#000066] text-white shadow-sm font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Specialization Filter Dropdown with properly aligned ChevronDown icon */}
                {uniqueSpecializations.length > 0 && (
                  <div className="relative">
                    <select
                      value={specFilter}
                      onChange={(e) => handleSpecFilterChange(e.target.value)}
                      className="appearance-none pl-3.5 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#000066] transition-colors cursor-pointer"
                    >
                      <option value="all">All Specializations</option>
                      {uniqueSpecializations.map((spec) => (
                        <option key={spec} value={spec}>{spec}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                )}

                {/* Month Filter Dropdown immediately after Specialization */}
                <div className="relative" ref={monthDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsMonthDropdownOpen((prev) => !prev)}
                    className={`flex items-center gap-1.5 pl-3 pr-8 py-2 bg-slate-50 border ${
                      monthSelection !== "all" || includeCurrentMonth
                        ? "border-[#000066] text-[#000066] bg-indigo-50/50 font-bold"
                        : "border-slate-200 text-slate-700 font-semibold"
                    } rounded-xl text-xs outline-none hover:border-[#000066] transition-colors cursor-pointer shadow-sm`}
                    title="Filter by Month Range"
                  >
                    <Calendar className={`w-3.5 h-3.5 ${monthSelection !== "all" || includeCurrentMonth ? "text-[#000066]" : "text-slate-400"} flex-shrink-0`} />
                    <span className="truncate max-w-[145px]">{activeMonthRange.label}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </button>

                  <AnimatePresence>
                    {isMonthDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.98 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 overflow-hidden"
                      >
                        {/* Top Checkboxes */}
                        <div className="space-y-1.5 p-1 bg-slate-50/80 rounded-lg border border-slate-100">
                          {/* Checkbox 1: Current Month */}
                          <div className="px-2 py-1.5 hover:bg-slate-100/80 rounded-md transition-colors">
                            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-800">
                              <input
                                type="checkbox"
                                checked={includeCurrentMonth}
                                onChange={(e) => {
                                  setIncludeCurrentMonth(e.target.checked);
                                  setCurrentPage(1);
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-[#000066] focus:ring-[#000066] cursor-pointer accent-[#000066]"
                              />
                              <span>Current Month</span>
                            </label>
                            <p className="text-[10px] text-slate-500 pl-6 mt-0.5">
                              {monthSelection === "all" || monthSelection === "current"
                                ? "Filter by current month"
                                : "Combine with previous months"}
                            </p>
                          </div>

                          {/* Checkbox 2: Use Internship Start Date */}
                          <div className="px-2 py-1.5 hover:bg-slate-100/80 rounded-md transition-colors border-t border-slate-200/50 pt-1.5">
                            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-800">
                              <input
                                type="checkbox"
                                checked={useInternStartDate}
                                onChange={(e) => {
                                  setUseInternStartDate(e.target.checked);
                                  setCurrentPage(1);
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-[#000066] focus:ring-[#000066] cursor-pointer accent-[#000066]"
                              />
                              <span>Use Internship Start Date</span>
                            </label>
                            <p className="text-[10px] text-slate-500 pl-6 mt-0.5">
                              Calculate from internship start date
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 my-1.5" />

                        {/* Month Range Options */}
                        <div className="space-y-0.5">
                          {[
                            { key: "all", label: "All Months" },
                            { key: "current", label: "Current Month" },
                            { key: "prev1", label: "Previous Month" },
                            { key: "prev2", label: "Previous 2 Months" },
                            { key: "prev3", label: "Previous 3 Months" },
                          ].map((opt) => {
                            const isSelected = monthSelection === opt.key;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => {
                                  setMonthSelection(opt.key);
                                  setCurrentPage(1);
                                  setIsMonthDropdownOpen(false);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                                  isSelected
                                    ? "bg-indigo-50 text-[#000066] font-bold"
                                    : "text-slate-700 hover:bg-slate-50 font-medium"
                                }`}
                              >
                                <span>{opt.label}</span>
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#000066]" />}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Page Size Selector with properly aligned ChevronDown icon */}
                <div className="relative">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="appearance-none pl-3.5 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#000066] transition-colors cursor-pointer"
                  >
                    <option value="10">10 / page</option>
                    <option value="25">25 / page</option>
                    <option value="50">50 / page</option>
                    <option value="100">100 / page</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Mobile View: Cards */}
            <div className="xl:hidden flex flex-col gap-3">
              {isLoading ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center shadow-sm">
                  <div className="relative mb-3 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full border-3 border-indigo-100 border-t-[#000066] animate-spin"></div>
                    <Activity className="w-4 h-4 text-[#000066] absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Calculating & Loading Analytics...</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Processing attendance, logbooks, and performance rates</p>
                </div>
              ) : error ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
                  <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
                  <p className="text-sm font-bold text-slate-700 mb-3">{error}</p>
                  <button
                    onClick={() => fetchAnalytics(true)}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-[#000066] hover:bg-[#000088] rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : analyticsData.length > 0 ? (
                <>
                  {analyticsData.map((row) => <MobileCard key={row.id} row={row} />)}
                  {/* Mobile Pagination */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between shadow-sm text-xs font-medium text-slate-600">
                    <span>Page {currentPage} of {totalPages} ({totalEntries} items)</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 disabled:opacity-40 font-semibold cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Filter className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-700">No results found</h3>
                  <p className="text-sm text-slate-500 mt-1">Try adjusting your search criteria or clearing filters.</p>
                  {(searchTerm || statusFilter !== "all" || specFilter !== "all") && (
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("all");
                        setSpecFilter("all");
                        setCurrentPage(1);
                      }}
                      className="mt-4 px-4 py-2 text-xs font-bold text-[#000066] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Desktop View: Compact Modern Table with Fixed Layout & Precise Alignment */}
            <div className="hidden xl:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-separate border-spacing-0 table-fixed">
                  <thead className="bg-slate-50/90">
                    <tr>
                      <th className="w-[3.5%] px-2 py-3.5 border-b border-slate-200 text-center"></th>
                      {[
                        { k: "name", l: "Intern", align: "left", width: "w-[31.5%]" },
                        { k: "traineeId", l: "Trainee ID", align: "center", width: "w-[10%]" },
                        { k: "specialization", l: "Specialization", align: "left", width: "w-[11%]" },
                        { k: "dailyAttendanceRate", l: "Daily Att.", align: "center", width: "w-[9%]" },
                        { k: "meetingAttendanceRate", l: "Meeting Att.", align: "center", width: "w-[10%]" },
                        { k: "logbookRecordRate", l: "Logbook", align: "center", width: "w-[9%]" },
                        { k: "performanceRate", l: "Performance", align: "center", width: "w-[9%]" },
                        { k: "internStatus", l: "Status", align: "center", width: "w-[7%]" },
                      ].map((col) => (
                        <th
                          key={col.k}
                          className={`px-3 py-3.5 cursor-pointer group hover:bg-slate-100/70 transition-colors whitespace-nowrap border-b border-slate-200 ${col.align === 'center' ? 'text-center' : 'text-left'} ${col.width || ''}`}
                          onClick={() => handleSort(col.k)}
                        >
                          {col.align === "center" ? (
                            <div className="relative inline-flex items-center justify-center">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{col.l}</span>
                              <span className="absolute -right-4 top-1/2 -translate-y-1/2 flex items-center">
                                <SortIcon columnKey={col.k} />
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{col.l}</span>
                              <SortIcon columnKey={col.k} />
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan="9" className="px-6 py-20 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center">
                            <div className="relative mb-3 flex items-center justify-center">
                              <div className="w-12 h-12 rounded-full border-3 border-indigo-100 border-t-[#000066] animate-spin"></div>
                              <Activity className="w-5 h-5 text-[#000066] absolute inset-0 m-auto animate-pulse" />
                            </div>
                            <h4 className="text-base font-bold text-slate-800">Calculating & Loading Analytics...</h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm">
                              Processing attendance, meeting participation, logbooks, and performance rates.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan="9" className="px-6 py-16 text-center text-rose-500">
                          <div className="flex flex-col items-center justify-center">
                            <AlertCircle className="w-8 h-8 mb-2 text-rose-500" />
                            <p className="text-sm font-bold text-slate-700 mb-2">{error}</p>
                            <button
                              onClick={() => fetchAnalytics(true)}
                              className="mt-2 px-4 py-1.5 text-xs font-bold text-white bg-[#000066] hover:bg-[#000088] rounded-lg transition-colors cursor-pointer"
                            >
                              Retry
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : analyticsData.length > 0 ? (
                      analyticsData.map((row) => {
                        const isNoCommit = isNoCommitSpecialization(row.specialization);

                        return (
                          <React.Fragment key={row.id}>
                            {/* Main Row */}
                            <tr
                              onClick={() => toggleRow(row.id)}
                              className={`group cursor-pointer transition-all duration-150 ${
                                expandedRowId === row.id
                                  ? 'bg-indigo-50/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]'
                                  : 'hover:bg-slate-50/80'
                              }`}
                            >
                              <td className="px-2 py-3 text-slate-400 group-hover:text-[#000066] transition-colors text-center align-middle">
                                <motion.div animate={{ rotate: expandedRowId === row.id ? 90 : 0 }}>
                                   <ChevronRight className="w-4 h-4 mx-auto" />
                                </motion.div>
                              </td>

                              {/* Name, Avatar & Mail + ID display area */}
                              <td className="px-3 py-3 text-left align-middle">
                                <div className="flex items-center gap-2.5">
                                  <InternAvatar id={row.id} name={row.name} size="w-9 h-9" />
                                  <div className="min-w-0 flex-1 pr-2">
                                    <p className="font-bold text-slate-800 text-[13px] leading-snug truncate">{row.name}</p>
                                    <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                                      <Mail className="w-3 h-3 flex-shrink-0 text-slate-400" />
                                      <span className="truncate">{row.email} • {row.traineeId}</span>
                                    </p>
                                    {row.institute && row.institute !== "Not Specified" && (
                                      <p className="text-[10.5px] font-medium text-indigo-600/90 flex items-center gap-1 mt-0.5 truncate">
                                        <Building2 className="w-3 h-3 flex-shrink-0 text-indigo-400" />
                                        <span className="truncate">{row.institute}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Trainee ID: Perfectly Centered */}
                              <td className="px-3 py-3 text-center align-middle">
                                <span className="font-mono text-[13px] font-bold text-slate-700">
                                  {row.traineeId}
                                </span>
                              </td>

                              {/* Specialization: Left aligned */}
                              <td className="px-3 py-3 text-left align-middle">
                                <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700 truncate">
                                  <GraduationCap className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  <span className="truncate">{row.specialization}</span>
                                </div>
                              </td>

                              {/* Daily Att.: Perfectly Centered */}
                              <td className="px-3 py-3 text-center align-middle">
                                <span className={`text-[13px] font-bold ${getRateTextColor(row.dailyAttendanceRate)}`}>
                                  {row.dailyAttendanceRate}%
                                </span>
                              </td>

                              {/* Meeting Att.: Perfectly Centered */}
                              <td className="px-3 py-3 text-center align-middle">
                                <span className={`text-[13px] font-bold ${getRateTextColor(row.meetingAttendanceRate)}`}>
                                  {row.meetingAttendanceRate}%
                                </span>
                              </td>

                              {/* Logbook: Perfectly Centered */}
                              <td className="px-3 py-3 text-center align-middle">
                                <span className={`text-[13px] font-bold ${getRateTextColor(row.logbookRecordRate)}`}>
                                  {row.logbookRecordRate}%
                                </span>
                              </td>

                              {/* Performance: Perfectly Centered */}
                              <td className="px-3 py-3 text-center align-middle">
                                <span className={`text-[13px] font-bold ${getRateTextColor(row.performanceRate)}`}>
                                  {row.performanceRate}%
                                </span>
                              </td>

                              {/* Status: Perfectly Centered text without tag/badge */}
                              <td className="px-3 py-3 text-center align-middle">
                                {getPerformanceStatusText(row.performanceRate)}
                              </td>
                            </tr>

                            {/* Expanded Dropdown Drawer */}
                            <AnimatePresence>
                              {expandedRowId === row.id && (
                                <tr className="bg-slate-50/60">
                                  <td colSpan="9" className="p-0 border-b border-slate-200">
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="p-4 md:p-5 lg:p-6 bg-slate-50/90 shadow-inner">
                                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:p-5">

                                          {/* Drawer Heading & Activity Counts without tags */}
                                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-200">
                                            <div className="flex items-center gap-3">
                                              <InternAvatar id={row.id} name={row.name} size="w-11 h-11" textClass="text-sm" />
                                              <div>
                                                <div className="flex items-center gap-2 text-slate-800">
                                                  <h4 className="text-base font-extrabold text-slate-900">{row.name}</h4>
                                                  <span className="text-xs font-bold text-slate-500 font-mono">({row.traineeId})</span>
                                                </div>
                                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                                  {row.specialization} • {formatDate(row.startDate)} – {formatDate(row.endDate)}
                                                </p>
                                              </div>
                                            </div>

                                            {/* Activity Counts: Conditional Git Commits based on Specialization */}
                                            <div className="flex flex-wrap items-center gap-4 sm:gap-6 lg:gap-7">
                                              <div className="flex flex-col items-center">
                                                <span className="text-[18px] lg:text-[20px] font-black text-blue-600 leading-none">{row.dailyAttendanceCount}</span>
                                                <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mt-1">Daily Att.</span>
                                              </div>
                                              <div className="flex flex-col items-center">
                                                <span className="text-[18px] lg:text-[20px] font-black text-purple-600 leading-none">{row.meetingAttendanceCount}</span>
                                                <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider mt-1">Meeting Att.</span>
                                              </div>
                                              <div className="flex flex-col items-center">
                                                <span className="text-[18px] lg:text-[20px] font-black text-amber-600 leading-none">{row.logbookCount}</span>
                                                <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mt-1">Logbook</span>
                                              </div>
                                              {!isNoCommit && (
                                                <div className="flex flex-col items-center">
                                                  <span className="text-[18px] lg:text-[20px] font-black text-emerald-600 leading-none">{row.commitCount}</span>
                                                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-1">Git Commits</span>
                                                </div>
                                              )}
                                              <div className="flex flex-col items-center">
                                                <span className="text-[18px] lg:text-[20px] font-black text-teal-600 leading-none">{row.workingDays ?? 0}</span>
                                                <span className="text-[10px] text-teal-600 font-bold uppercase tracking-wider mt-1">Work Days</span>
                                              </div>
                                              <div className="flex flex-col items-center">
                                                <span className="text-[18px] lg:text-[20px] font-black text-indigo-600 leading-none">{row.expectedMeetings ?? 0}</span>
                                                <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mt-1">Exp Meets</span>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Projects Section */}
                                          <div>
                                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                                              Assigned Projects & Modules
                                            </h5>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                              {row.projects && row.projects.length > 0 ? (
                                                row.projects.map((proj, idx) => (
                                                  <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-slate-100/70 transition-colors">
                                                    <div className="flex items-center gap-2 truncate pr-2">
                                                      <Briefcase className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                                      <span className="text-sm font-semibold text-slate-700 truncate">{proj?.name || proj?.projectName || String(proj)}</span>
                                                    </div>
                                                    <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${getStatusBadge(proj?.status)}`}>
                                                      {proj?.status || "In Progress"}
                                                    </span>
                                                  </div>
                                                ))
                                              ) : (
                                                <div className="col-span-full text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                                  <p className="text-sm text-slate-500 italic">No projects assigned.</p>
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                        </div>
                                      </div>
                                    </motion.div>
                                  </td>
                                </tr>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="9" className="px-4 py-16 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                              <Filter className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">No results found</h3>
                            <p className="text-sm text-slate-500 mt-1">Try adjusting your search criteria or clearing active filters.</p>
                            {(searchTerm || statusFilter !== "all" || specFilter !== "all") && (
                              <button
                                onClick={() => {
                                  setSearchTerm("");
                                  setStatusFilter("all");
                                  setSpecFilter("all");
                                  setCurrentPage(1);
                                }}
                                className="mt-4 px-4 py-2 text-xs font-bold text-[#000066] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                              >
                                Clear All Filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Desktop Table Footer & Pagination */}
              {totalEntries > 0 && (
                <div className="bg-gradient-to-r from-[#000066] to-[#006600] px-4 md:px-6 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-4 text-[13px] font-medium text-white/90 shadow-inner">
                  <span>
                    Showing <strong className="text-white font-bold">{(currentPage - 1) * pageSize + 1}</strong> to{" "}
                    <strong className="text-white font-bold">{Math.min(currentPage * pageSize, totalEntries)}</strong> of{" "}
                    <strong className="text-white font-bold">{totalEntries}</strong> matching interns
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-white font-semibold disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                    >
                      Prev
                    </button>

                    {/* Page Numbers */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .reduce((acc, p, idx, arr) => {
                        if (idx > 0 && p - arr[idx - 1] > 1) {
                          acc.push("...");
                        }
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, idx) =>
                        p === "..." ? (
                          <span key={`ellipsis-${idx}`} className="px-2 text-white/50">...</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setCurrentPage(p)}
                            className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center transition-all cursor-pointer ${
                              currentPage === p
                                ? "bg-white text-[#000066] shadow-md"
                                : "border border-white/20 hover:bg-white/10 text-white"
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-white font-semibold disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Page Footer */}
        <footer className="bg-gradient-to-r from-[#000066] to-[#006600] py-2.5 px-4 md:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-medium text-white/90 shadow-inner">
          <p>© {new Date().getFullYear()} TalentHub. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span>
            <span className="hover:text-white transition-colors cursor-pointer">Terms of Service</span>
            <span className="hover:text-white transition-colors cursor-pointer">Support</span>
          </div>
        </footer>
      </div>
    </AdminNavigation>
  );
};

export default AdminAnalytics;
