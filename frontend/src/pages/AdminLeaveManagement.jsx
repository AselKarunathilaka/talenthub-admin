import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import {
  getAllLeaveRequests,
  updateLeaveRequestStatus,
  bulkUpdateLeaveRequestStatus,
  getLeaveRequestStats,
} from "../api/leaveRequestApi";
import { downloadApprovedLeaveReport, adminApi } from "../api/adminApi";
import toast from "react-hot-toast";
import {
  FiFileText,
  FiCalendar,
  FiClock,
  FiUser,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiArrowLeft,
  FiEye,
  FiCheckSquare,
  FiSquare,
  FiCheckCircle,
  FiFilter,
  FiSend,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../api/apiConfig";

const AdminLeaveManagement = ({ requestType = "short_leave" }) => {
  const isStudyLeave = requestType === "study_leave";
  const pageCopy = isStudyLeave
    ? {
        title: "Extended Leave Requests",
        description: "Review and manage intern extended leave requests",
        empty: "No extended leave requests found",
        details: "Extended Leave Request Details",
        noForDate: "No extended leave requests submitted",
      }
    : {
        title: "Short Leave Requests",
        description: "Review and manage intern short leave requests",
        empty: "No short leave requests found",
        details: "Short Leave Request Details",
        noForDate: "No short leave requests found",
      };
  const navigate = useNavigate();
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [documentViewer, setDocumentViewer] = useState({
    show: false,
    url: "",
    type: "",
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Pending");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    denied: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminResponse, setAdminResponse] = useState("");
  const [processing, setProcessing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    return isStudyLeave ? "" : new Date().toISOString().split("T")[0];
  });

  // Intern ID filter
  const [internIdFilter, setInternIdFilter] = useState("");

  // Bulk operations
  const [selectedRequests, setSelectedRequests] = useState(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkAdminResponse, setBulkAdminResponse] = useState("");
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [triggeringEmail, setTriggeringEmail] = useState(false);

  useEffect(() => {
    const adminInfo = localStorage.getItem("adminInfo");
    if (!adminInfo) {
      toast.error("Please log in as admin to access this page");
      navigate("/admin-login");
      return;
    }
    fetchLeaveRequests();
    fetchStats();
  }, [filter, pagination.page, selectedDate, requestType]);

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLeaveRequests();
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, filter, pagination.page, selectedDate, requestType]);

  const fetchLeaveRequests = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        requestType,
      };

      if (filter !== "all") {
        params.status = filter;
      }

      if (selectedDate && isStudyLeave) {
        params.submittedDate = selectedDate;
      } else if (selectedDate) {
        params.date = selectedDate;
      }
      const response = await getAllLeaveRequests(params);

      // Sort requests based on sortBy
      let sortedRequests = [...response.data];
      if (sortBy === "urgent") {
        const today = new Date().toISOString().split("T")[0];
        sortedRequests.sort((a, b) => {
          const aIsUrgent = a.leaveDate.split("T")[0] === today;
          const bIsUrgent = b.leaveDate.split("T")[0] === today;
          if (aIsUrgent && !bIsUrgent) return -1;
          if (!aIsUrgent && bIsUrgent) return 1;
          return new Date(b.submittedAt) - new Date(a.submittedAt);
        });
      } else if (sortBy === "oldest") {
        sortedRequests.sort(
          (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt),
        );
      } else {
        sortedRequests.sort(
          (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt),
        );
      }

      setLeaveRequests(sortedRequests);
      setPagination(response.pagination);
      setSelectedRequests(new Set());
      setIsSelectAll(false);
    } catch (error) {
      console.error("Error fetching leave requests:", error);

      if (error.message === "Admin access required") {
        toast.error("Admin access required. Redirecting to admin login...");
        setTimeout(() => navigate("/admin-login"), 1500);
        return;
      }

      toast.error("Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = {};
      if (isStudyLeave && selectedDate) {
        params.submittedDate = selectedDate;
      } else if (!isStudyLeave) {
        params.date = selectedDate || new Date().toISOString().split("T")[0];
      }
      params.requestType = requestType;
      const response = await getLeaveRequestStats(params);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleViewDocument = async (leaveRequestId) => {
    try {
      const authToken = localStorage.getItem("authToken");
      const adminInfo = localStorage.getItem("adminInfo");
      const token =
        (adminInfo ? JSON.parse(adminInfo).token : null) || authToken;

      const response = await fetch(
        `${API_BASE_URL}/leave-requests/${leaveRequestId}/document`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            errorData.error ||
            `Failed to load document (${response.status})`,
        );
      }

      const blob = await response.blob();
      const fileUrl = URL.createObjectURL(blob);
      const contentType = response.headers.get("Content-Type");

      const fileType = contentType?.includes("pdf")
        ? "pdf"
        : contentType?.includes("image")
          ? "image"
          : "other";

      setDocumentViewer({ show: true, url: fileUrl, type: fileType });
    } catch (error) {
      console.error("Error loading document:", error);
      toast.error(error.message || "Failed to load document");
    }
  };

  const closeDocumentViewer = () => {
    if (documentViewer.url && documentViewer.url.startsWith("blob:")) {
      URL.revokeObjectURL(documentViewer.url);
    }
    setDocumentViewer({ show: false, url: "", type: "" });
  };

  const handleStatusUpdate = async (requestId, status, response = "") => {
    setProcessing(true);
    try {
      await updateLeaveRequestStatus(requestId, {
        status,
        adminResponse: response.trim() || undefined,
      });

      toast.success(`Leave request ${status.toLowerCase()} successfully`);
      setSelectedRequest(null);
      setAdminResponse("");
      fetchLeaveRequests();
      fetchStats();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(error.message || "Failed to update leave request");
    } finally {
      setProcessing(false);
    }
  };

  const openReviewModal = (request) => {
    setSelectedRequest(request);
    setAdminResponse("");
  };

  const closeReviewModal = () => {
    setSelectedRequest(null);
    setAdminResponse("");
  };

  // Bulk selection handlers
  const handleSelectRequest = (requestId) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedRequests(newSelected);
  };

  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedRequests(new Set());
    } else {
      const allIds = filteredRequests
        .filter((request) => request.status === "Pending")
        .map((request) => request._id);
      setSelectedRequests(new Set(allIds));
    }
    setIsSelectAll(!isSelectAll);
  };

  const handleBulkAction = (action) => {
    if (selectedRequests.size === 0) {
      toast.error("Please select at least one request");
      return;
    }
    setBulkAction(action);
    setIsBulkModalOpen(true);
  };

  const confirmBulkAction = async () => {
    if (selectedRequests.size === 0) {
      toast.error("No requests selected");
      return;
    }

    setProcessing(true);
    try {
      const requestsArray = Array.from(selectedRequests);
      const toastId = toast.loading(
        `Processing ${selectedRequests.size} request(s)...`,
      );

      const response = await bulkUpdateLeaveRequestStatus(requestsArray, {
        status: bulkAction === "approve" ? "Approved" : "Denied",
        adminResponse: bulkAdminResponse.trim() || undefined,
      });

      toast.success(
        `Successfully ${bulkAction === "approve" ? "approved" : "denied"} ${selectedRequests.size} request(s)${
          !isStudyLeave && bulkAction === "approve" && response.data.updated > 0
            ? " - Email notification sent!"
            : ""
        }`,
        { id: toastId },
      );

      setSelectedRequests(new Set());
      setIsSelectAll(false);
      setBulkAdminResponse("");
      setIsBulkModalOpen(false);
      fetchLeaveRequests();
      fetchStats();
    } catch (error) {
      console.error("Error in bulk action:", error);
      toast.error("Failed to process bulk action");
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadApprovedReport = async () => {
    const toastId = toast.loading("Generating approved leave report...");
    try {
      const reportDate = selectedDate || new Date().toISOString().split("T")[0];
      const blob = await downloadApprovedLeaveReport({ date: reportDate });
      const url = URL.createObjectURL(blob);
      const fileName = `approved-leaves-report-${reportDate}.pdf`;
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Approved leave report ready for download", {
        id: toastId,
      });
    } catch (error) {
      console.error("Error downloading approved leave report:", error);
      toast.error("Failed to download approved leave report", { id: toastId });
    }
  };

  const handleTriggerApprovedShortLeaveEmail = async () => {
    if (
      !window.confirm(
        "Are you sure you want to send the approved short leave email to gate staff now?",
      )
    ) {
      return;
    }

    setTriggeringEmail(true);
    const toastId = toast.loading("Initiating email send...");

    try {
      const result = await adminApi.triggerApprovedShortLeaveEmail();

      if (result.processing) {
        toast.success(
          `✅ Email is being sent in the background. Check server logs for status.`,
          { id: toastId, duration: 5000 },
        );
      } else if (result.success && !result.skipped) {
        toast.success(
          `✅ Email sent successfully! ${result.data?.internsCount || 0} intern(s)`,
          { id: toastId, duration: 5000 },
        );
      } else if (result.skipped) {
        toast(`📭 Skipped: ${result.message}`, { id: toastId });
      } else {
        toast.error(`❌ Failed: ${result.message}`, {
          id: toastId,
          duration: 10000,
        });
      }
    } catch (error) {
      toast.error(error.message || "Failed to trigger email", { id: toastId });
    } finally {
      setTriggeringEmail(false);
    }
  };

  const handleQuickAction = async (requestId, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this request?`)) {
      return;
    }

    setProcessing(true);
    try {
      await updateLeaveRequestStatus(requestId, {
        status: action === "approve" ? "Approved" : "Denied",
      });

      toast.success(`Leave request ${action}d successfully`);
      fetchLeaveRequests();
      fetchStats();
    } catch (error) {
      console.error("Error in quick action:", error);
      toast.error(error.message || "Failed to update leave request");
    } finally {
      setProcessing(false);
    }
  };

  const isUrgentRequest = (leaveDate) => {
    const today = new Date().toISOString().split("T")[0];
    const reqDate = new Date(leaveDate).toISOString().split("T")[0];
    return reqDate === today;
  };

  const isToday = (leaveDate) => {
    const today = new Date().toISOString().split("T")[0];
    const reqDate = new Date(leaveDate).toISOString().split("T")[0];
    return reqDate === today;
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Approved":
        return "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-100 text-green-700 border border-green-200";
      case "Denied":
        return "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-700 border border-rose-200";
      case "Pending":
        return "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200";
      default:
        return "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-700 border border-gray-200";
    }
  };

  const getPurposeBadgeClass = (purpose) => {
    return purpose === "Official"
      ? "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-100 text-[#0056a2] border border-blue-200"
      : "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-purple-100 text-purple-700 border border-purple-200";
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSelectedDate = () => {
    if (!selectedDate) return "All Dates";
    const date = new Date(selectedDate);
    const today = new Date().toISOString().split("T")[0];
    const isTodayDate = selectedDate === today;
    return (
      date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }) + (isTodayDate ? " (Today)" : "")
    );
  };

  // ── UPDATED: filter by internTraineeId instead of nationalId ──
  const filteredRequests = internIdFilter
    ? leaveRequests.filter((r) =>
        r.internTraineeId?.toString().includes(internIdFilter),
      )
    : leaveRequests;

  const displayedStats = (() => {
    if (!isStudyLeave || stats.total > 0 || pagination.total === 0) {
      return stats;
    }

    const fallback = {
      total: filter === "all" ? pagination.total : leaveRequests.length,
      pending: leaveRequests.filter((request) => request.status === "Pending")
        .length,
      approved: leaveRequests.filter((request) => request.status === "Approved")
        .length,
      denied: leaveRequests.filter((request) => request.status === "Denied")
        .length,
    };

    if (filter === "Pending") fallback.pending = pagination.total;
    if (filter === "Approved") fallback.approved = pagination.total;
    if (filter === "Denied") fallback.denied = pagination.total;

    fallback.total = Math.max(
      fallback.total,
      fallback.pending + fallback.approved + fallback.denied,
    );

    return fallback;
  })();

  // Helper to highlight matched text inside a string
  const highlightMatch = (text, query) => {
    if (!query || !text) return <span>{text ?? "N/A"}</span>;
    const str = text.toString();
    const parts = str.split(query);
    return (
      <span>
        {parts.map((part, i, arr) =>
          i < arr.length - 1 ? (
            <span key={i}>
              {part}
              <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">
                {query}
              </mark>
            </span>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </span>
    );
  };

  return (
    <AdminNavigation>
      <div className="min-h-screen bg-slate-50 font-sans text-gray-800 pb-10 flex flex-col">
        <div className="flex-1 w-full lg:mt-4 lg:px-6 xl:px-10">
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
          {/* Header & Page Info */}
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
              >
                <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl">
                  <FiFileText className="text-[#0056a2] h-8 w-8" />
                </div>
                {pageCopy.title}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05, duration: 0.2 }}
                className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
              >
                {pageCopy.description}
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.2 }}
              className="flex gap-3 flex-wrap justify-end"
            >
              {!isStudyLeave && (
                <button
                  onClick={handleTriggerApprovedShortLeaveEmail}
                  disabled={triggeringEmail}
                  className={`bg-white text-[#15803d] border border-[#15803d]/30 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-green-50 transition-all flex items-center gap-2 ${
                    triggeringEmail ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  title="Manually send approved short leave email to gate staff"
                >
                  <FiSend className={triggeringEmail ? "animate-pulse" : ""} />
                  {triggeringEmail ? "Sending..." : "Send Gate Email"}
                </button>
              )}
              {!isStudyLeave && (
                <button
                  onClick={handleDownloadApprovedReport}
                  className="bg-gradient-to-r from-[#0056a2] to-[#00b4eb] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30 ring-1 ring-blue-400/50 hover:opacity-90 transition-all flex items-center gap-2"
                >
                  <FiFileText />
                  Download PDF Report
                </button>
              )}
            </motion.div>
          </div>

          {/* Premium Stat Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
          >
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 relative overflow-hidden group hover:border-[#0056a2]/30 transition-colors">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-gray-50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 z-10 text-gray-500 group-hover:text-[#0056a2] transition-colors">
                <FiFileText size={24} />
              </div>
              <div className="z-10">
                <div className="text-3xl font-extrabold text-gray-900 tracking-tight">
                  {displayedStats.total}
                </div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-0.5">
                  Total Requests
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {selectedDate
                    ? formatSelectedDate().replace(" (Today)", "")
                    : isStudyLeave
                      ? "all dates"
                      : ""}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl shadow-sm border border-amber-100 p-5 flex items-center gap-4 relative overflow-hidden group hover:border-amber-300 transition-colors">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-100/50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-amber-100 z-10 text-amber-500 shadow-sm">
                <FiClock size={24} />
              </div>
              <div className="z-10">
                <div className="text-3xl font-extrabold text-amber-600 tracking-tight">
                  {displayedStats.pending}
                </div>
                <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mt-0.5">
                  Pending Review
                </div>
              </div>
              {displayedStats.pending > 0 && (
                <div className="absolute top-4 right-4 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl shadow-sm border border-green-100 p-5 flex items-center gap-4 relative overflow-hidden group hover:border-green-300 transition-colors">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-100/50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-green-100 z-10 text-green-500 shadow-sm">
                <FiCheckCircle size={24} />
              </div>
              <div className="z-10">
                <div className="text-3xl font-extrabold text-green-600 tracking-tight">
                  {displayedStats.approved}
                </div>
                <div className="text-xs font-bold text-green-700 uppercase tracking-wider mt-0.5">
                  Approved
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-3xl shadow-sm border border-rose-100 p-5 flex items-center gap-4 relative overflow-hidden group hover:border-rose-300 transition-colors">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-100/50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-rose-100 z-10 text-rose-500 shadow-sm">
                <FiX size={24} />
              </div>
              <div className="z-10">
                <div className="text-3xl font-extrabold text-rose-600 tracking-tight">
                  {displayedStats.denied}
                </div>
                <div className="text-xs font-bold text-rose-700 uppercase tracking-wider mt-0.5">
                  Denied
                </div>
              </div>
            </div>
          </motion.div>

          {/* Filters & Controls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 mb-6"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    key: "Pending",
                    count: displayedStats.pending,
                    label: "Pending",
                  },
                  {
                    key: "Approved",
                    count: displayedStats.approved,
                    label: "Approved",
                  },
                  {
                    key: "Denied",
                    count: displayedStats.denied,
                    label: "Denied",
                  },
                  {
                    key: "all",
                    count: displayedStats.total,
                    label: "All Requests",
                  },
                ].map(({ key, count, label }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setFilter(key);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                      setSelectedRequests(new Set());
                      setIsSelectAll(false);
                    }}
                    className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 flex items-center gap-2 ${
                      filter === key
                        ? "bg-slate-800 text-white shadow-md shadow-slate-200"
                        : "bg-white text-gray-500 hover:text-gray-800 hover:bg-slate-50 border border-gray-200"
                    }`}
                  >
                    {label}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] ${filter === key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Date Filter */}
                <div className="bg-slate-50 rounded-xl p-1.5 flex items-center border border-slate-200">
                  <div className="bg-white p-1.5 rounded-lg border border-slate-100 shadow-sm mr-2 ml-1">
                    <FiCalendar className="text-[#0056a2] w-4 h-4" />
                  </div>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="bg-transparent text-sm font-bold text-gray-700 focus:outline-none cursor-pointer w-32"
                    title={
                      isStudyLeave
                        ? "Filter by Submitted Date"
                        : "Filter by Leave Date"
                    }
                  />
                  {selectedDate && (
                    <button
                      onClick={() => {
                        setSelectedDate("");
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                      className="ml-1 mr-2 text-gray-400 hover:text-rose-500"
                    >
                      <FiX size={14} />
                    </button>
                  )}
                </div>

                {/* ID Filter */}
                <div className="bg-slate-50 rounded-xl p-1.5 flex items-center border border-slate-200">
                  <div className="bg-white p-1.5 rounded-lg border border-slate-100 shadow-sm mr-2 ml-1">
                    <FiUser className="text-[#0056a2] w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={internIdFilter}
                    onChange={(e) =>
                      setInternIdFilter(
                        e.target.value.replace(/\D/g, "").slice(0, 4),
                      )
                    }
                    placeholder="Intern ID"
                    maxLength={4}
                    className="bg-transparent text-sm font-bold text-gray-700 focus:outline-none w-20 placeholder-gray-400"
                  />
                  {internIdFilter && (
                    <button
                      onClick={() => setInternIdFilter("")}
                      className="ml-1 mr-2 text-gray-400 hover:text-rose-500"
                    >
                      <FiX size={14} />
                    </button>
                  )}
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    fetchLeaveRequests();
                  }}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 focus:outline-none hover:bg-slate-50 transition-colors"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="urgent">Urgent First</option>
                </select>

                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer ml-1">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4 text-[#0056a2] rounded focus:ring-[#0056a2] border-gray-300"
                  />
                  Auto-refresh
                </label>

                <button
                  onClick={() => {
                    fetchLeaveRequests();
                    fetchStats();
                    toast.success("Refreshed!");
                  }}
                  className="p-2.5 bg-slate-100 text-gray-600 rounded-xl hover:bg-slate-200 transition-colors ml-1"
                  title="Refresh manually"
                >
                  🔄
                </button>
              </div>
            </div>

            {/* Context hints under filters */}
            {(selectedDate || internIdFilter) && (
              <div className="mt-3 flex gap-4 border-t border-slate-100 pt-3">
                {selectedDate && (
                  <p className="text-xs text-gray-500 font-medium">
                    Showing date:{" "}
                    <span className="font-bold text-[#0056a2]">
                      {formatSelectedDate()}
                    </span>
                  </p>
                )}
                {internIdFilter && (
                  <p className="text-xs text-gray-500 font-medium">
                    Searching ID:{" "}
                    <span className="font-bold text-[#0056a2]">
                      {internIdFilter}
                    </span>
                    <span className="ml-2 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                      {filteredRequests.length} results
                    </span>
                  </p>
                )}
              </div>
            )}
          </motion.div>

          {/* Bulk Actions Bar */}
          <AnimatePresence>
            {filter === "Pending" && selectedRequests.size > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 bg-[#0056a2]/5 border border-[#0056a2]/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-[#0056a2] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                    {selectedRequests.size}
                  </div>
                  <span className="text-[#0056a2] font-bold">
                    Request{selectedRequests.size > 1 ? "s" : ""} Selected
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleBulkAction("approve")}
                    disabled={processing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-green-700 transition-all disabled:opacity-50"
                  >
                    <FiCheckCircle /> Approve Selected
                  </button>
                  <button
                    onClick={() => handleBulkAction("deny")}
                    disabled={processing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-rose-700 transition-all disabled:opacity-50"
                  >
                    <FiX /> Deny Selected
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRequests(new Set());
                      setIsSelectAll(false);
                    }}
                    className="px-4 py-2 text-gray-500 hover:text-gray-800 font-bold text-sm transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content Body */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0056a2]"></div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-3xl shadow-sm border border-dashed border-gray-300 p-16 text-center"
            >
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <FiFileText className="h-10 w-10 text-slate-300" />
              </div>
              <h4 className="text-xl font-bold text-gray-700 mb-2">
                {internIdFilter
                  ? `No requests found for intern ID "${internIdFilter}"`
                  : pageCopy.empty}
              </h4>
              <p className="text-gray-500">
                {selectedDate && !internIdFilter
                  ? `No requests found for ${formatSelectedDate()}.`
                  : "Try adjusting your filters."}
              </p>
              <div className="mt-8 flex justify-center gap-4">
                {(internIdFilter || selectedDate || filter !== "all") && (
                  <button
                    onClick={() => {
                      setInternIdFilter("");
                      setSelectedDate("");
                      setFilter("all");
                    }}
                    className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 shadow-sm"
                  >
                    Clear All Filters
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedDate(new Date().toISOString().split("T")[0]);
                    setFilter("Pending");
                  }}
                  className="px-6 py-2.5 bg-[#0056a2] text-white rounded-xl font-bold text-sm hover:bg-[#00488a] shadow-sm shadow-blue-500/20"
                >
                  View Today's Pending
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Premium Data Table */}
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-slate-50/50">
                      <tr>
                        {filter === "Pending" && (
                          <th className="px-6 py-4 text-center w-12">
                            <button
                              onClick={handleSelectAll}
                              className="flex items-center justify-center transition-transform hover:scale-110"
                              title={
                                isSelectAll ? "Deselect all" : "Select all"
                              }
                            >
                              {isSelectAll ? (
                                <FiCheckSquare className="w-5 h-5 text-[#0056a2]" />
                              ) : (
                                <FiSquare className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                              )}
                            </button>
                          </th>
                        )}
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Intern Details
                        </th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {isStudyLeave
                            ? "Extended Leave Period"
                            : "Leave Date & Time"}
                        </th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Purpose
                        </th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Submitted
                        </th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Status
                        </th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      <AnimatePresence>
                        {filteredRequests.map((request) => {
                          const urgent = isUrgentRequest(request.leaveDate);
                          const todayRequest = isToday(request.leaveDate);
                          return (
                            <motion.tr
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              key={request._id}
                              className={`transition-colors hover:bg-slate-50/50 ${
                                urgent && request.status === "Pending"
                                  ? "bg-rose-50/30"
                                  : todayRequest
                                    ? "bg-blue-50/30"
                                    : ""
                              }`}
                            >
                              {filter === "Pending" && (
                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                  <input
                                    type="checkbox"
                                    checked={selectedRequests.has(request._id)}
                                    onChange={() =>
                                      handleSelectRequest(request._id)
                                    }
                                    className="w-4 h-4 text-[#0056a2] border-gray-300 rounded focus:ring-[#0056a2] cursor-pointer"
                                    disabled={request.status !== "Pending"}
                                  />
                                </td>
                              )}

                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className="font-bold text-gray-900 text-sm">
                                    {request.internName}
                                  </div>
                                  {urgent && request.status === "Pending" && (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-rose-500 text-white rounded uppercase tracking-wider font-bold animate-pulse">
                                      Urgent
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  <div className="text-xs font-bold text-[#0056a2] bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <FiUser size={10} /> ID:{" "}
                                    {request.internTraineeId
                                      ? internIdFilter
                                        ? highlightMatch(
                                            request.internTraineeId,
                                            internIdFilter,
                                          )
                                        : request.internTraineeId
                                      : "N/A"}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    NIC: {request.nationalId}
                                  </div>
                                </div>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                  <FiCalendar className="text-gray-400" />
                                  {formatDate(request.leaveDate)}
                                  {todayRequest && (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-[#00b4eb] text-white rounded uppercase tracking-wider font-bold">
                                      Today
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mt-1">
                                  <FiClock className="text-gray-400" />
                                  {isStudyLeave && request.studyEndDate
                                    ? `Until ${formatDate(request.studyEndDate)}`
                                    : request.leaveTime}
                                </div>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={getPurposeBadgeClass(
                                    request.purpose,
                                  )}
                                >
                                  {request.purpose}
                                </span>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">
                                {formatDate(request.submittedAt)}
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={getStatusBadgeClass(
                                    request.status,
                                  )}
                                >
                                  {request.status}
                                </span>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                  {request.status === "Pending" ? (
                                    <>
                                      <button
                                        onClick={() =>
                                          handleQuickAction(
                                            request._id,
                                            "approve",
                                          )
                                        }
                                        disabled={processing}
                                        className="p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-xl transition-all disabled:opacity-50 border border-green-200 hover:border-transparent"
                                        title="Quick Approve"
                                      >
                                        <FiCheck size={16} />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleQuickAction(request._id, "deny")
                                        }
                                        disabled={processing}
                                        className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all disabled:opacity-50 border border-rose-200 hover:border-transparent"
                                        title="Quick Deny"
                                      >
                                        <FiX size={16} />
                                      </button>
                                      <button
                                        onClick={() => openReviewModal(request)}
                                        className="px-3 py-1.5 bg-white text-[#0056a2] hover:bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-sm"
                                        title="Review Details"
                                      >
                                        Review
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => openReviewModal(request)}
                                      className="px-3 py-1.5 bg-slate-50 text-gray-600 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold transition-all"
                                    >
                                      Details
                                    </button>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pb-6">
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: prev.page - 1,
                      }))
                    }
                    disabled={pagination.page === 1}
                    className="px-4 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
                  >
                    Previous
                  </button>
                  <span className="text-sm font-bold text-gray-500 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: prev.page + 1,
                      }))
                    }
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
          </main>
        </div>
      </div>

      {/* Review Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
            onClick={closeReviewModal}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00b4eb] to-[#0056a2]"></div>

              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-slate-50/50">
                <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-3">
                  <div className="p-2 bg-[#00b4eb]/10 rounded-xl">
                    <FiFileText className="text-[#0056a2]" />
                  </div>
                  {pageCopy.details}
                </h2>
                <button
                  onClick={closeReviewModal}
                  className="text-gray-400 hover:text-gray-700 p-2 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-gray-200 shadow-sm"
                >
                  <FiX size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 flex-1 overflow-auto">
                {/* Intern Info Card */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between">
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                      Intern Name
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      {selectedRequest.internName}
                    </span>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                        Intern ID
                      </span>
                      <span className="text-sm font-bold text-[#0056a2] bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                        {selectedRequest.internTraineeId || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                        NIC
                      </span>
                      <span className="text-sm font-bold text-gray-700 bg-white px-2 py-1 rounded-lg border border-gray-200">
                        {selectedRequest.nationalId}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dates Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1 flex items-center gap-1">
                      <FiCalendar /> Leave Date
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {formatDate(selectedRequest.leaveDate)}
                    </span>
                  </div>
                  {isStudyLeave && selectedRequest.studyEndDate ? (
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1 flex items-center gap-1">
                        <FiCalendar /> End Date
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatDate(selectedRequest.studyEndDate)}
                      </span>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1 flex items-center gap-1">
                        <FiClock /> Leave Time
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {selectedRequest.leaveTime}
                      </span>
                    </div>
                  )}
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                      Purpose
                    </span>
                    <span
                      className={getPurposeBadgeClass(selectedRequest.purpose)}
                    >
                      {selectedRequest.purpose}
                    </span>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                      Submitted At
                    </span>
                    <span className="text-sm font-bold text-gray-700">
                      {formatDateTime(selectedRequest.submittedAt)}
                    </span>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    Reason
                  </span>
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-sm text-gray-800 font-medium leading-relaxed">
                    {selectedRequest.reason}
                  </div>
                </div>

                {/* Proof Document */}
                {selectedRequest.proofDocument?.data && (
                  <div className="flex items-center justify-between bg-blue-50 rounded-2xl p-4 border border-blue-100">
                    <div>
                      <span className="text-[10px] font-black text-[#0056a2] uppercase tracking-widest block mb-1">
                        Proof Document
                      </span>
                      <span className="text-xs font-bold text-gray-600 truncate max-w-[200px] block">
                        {selectedRequest.proofDocument.filename}
                      </span>
                    </div>
                    <button
                      onClick={() => handleViewDocument(selectedRequest._id)}
                      className="text-sm font-bold px-4 py-2 bg-white text-[#0056a2] border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors shadow-sm flex items-center gap-2"
                    >
                      <FiEye /> View
                    </button>
                  </div>
                )}

                {/* Current Status */}
                <div className="flex items-center gap-4 py-2 border-t border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Current Status:
                  </span>
                  <span className={getStatusBadgeClass(selectedRequest.status)}>
                    {selectedRequest.status}
                  </span>
                </div>

                {/* Previous Review Info */}
                {selectedRequest.reviewedBy && (
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-gray-500">
                        Reviewed By:
                      </span>
                      <span className="font-bold text-gray-900">
                        {selectedRequest.reviewedBy?.email}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-gray-500">
                        Reviewed At:
                      </span>
                      <span className="font-bold text-gray-900">
                        {formatDateTime(selectedRequest.reviewedAt)}
                      </span>
                    </div>
                    {selectedRequest.adminResponse && (
                      <div className="pt-3 border-t border-slate-200">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                          Previous Admin Response
                        </span>
                        <p className="text-sm text-gray-800 font-medium bg-white p-3 rounded-xl border border-gray-200">
                          {selectedRequest.adminResponse}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Admin Action Area */}
                {selectedRequest.status === "Pending" && (
                  <div className="pt-4 border-t border-gray-200">
                    <span className="text-[10px] font-black text-[#0056a2] uppercase tracking-widest block mb-2 flex items-center gap-1">
                      <FiFileText /> Admin Response (Optional)
                    </span>
                    <textarea
                      value={adminResponse}
                      onChange={(e) => setAdminResponse(e.target.value)}
                      placeholder="Add a comment or reason for your decision..."
                      rows="2"
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent transition-all resize-none text-sm font-medium text-gray-800"
                    />
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() =>
                          handleStatusUpdate(
                            selectedRequest._id,
                            "Approved",
                            adminResponse,
                          )
                        }
                        disabled={processing}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold text-white transition-all shadow-md ${
                          processing
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-gradient-to-r from-[#15803d] to-[#50b748] hover:shadow-lg hover:shadow-green-500/30 ring-1 ring-green-400/50 transform hover:-translate-y-0.5"
                        }`}
                      >
                        <FiCheckCircle size={18} />{" "}
                        {processing ? "Processing..." : "Approve"}
                      </button>
                      <button
                        onClick={() =>
                          handleStatusUpdate(
                            selectedRequest._id,
                            "Denied",
                            adminResponse,
                          )
                        }
                        disabled={processing}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold text-white transition-all shadow-md ${
                          processing
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-gradient-to-r from-rose-600 to-red-500 hover:shadow-lg hover:shadow-red-500/30 ring-1 ring-red-400/50 transform hover:-translate-y-0.5"
                        }`}
                      >
                        <FiX size={18} />{" "}
                        {processing ? "Processing..." : "Deny"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Action Modal */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
            onClick={() => !processing && setIsBulkModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`absolute top-0 left-0 w-full h-1 ${bulkAction === "approve" ? "bg-green-500" : "bg-rose-500"}`}
              ></div>

              <div className="p-6 border-b border-gray-100 bg-slate-50/50 flex justify-between items-center">
                <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                  {bulkAction === "approve" ? (
                    <FiCheckCircle className="text-green-600" />
                  ) : (
                    <FiX className="text-rose-600" />
                  )}
                  Bulk {bulkAction === "approve" ? "Approve" : "Deny"}
                </h2>
                <button
                  onClick={() => !processing && setIsBulkModalOpen(false)}
                  className="text-gray-400 hover:text-gray-700 p-2 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-gray-200 shadow-sm"
                  disabled={processing}
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div
                  className={`p-4 rounded-xl border ${bulkAction === "approve" ? "bg-green-50 border-green-100" : "bg-rose-50 border-rose-100"}`}
                >
                  <p
                    className={`text-sm font-bold ${bulkAction === "approve" ? "text-green-800" : "text-rose-800"}`}
                  >
                    You are about to{" "}
                    {bulkAction === "approve" ? "approve" : "deny"}{" "}
                    <span className="text-lg">{selectedRequests.size}</span>{" "}
                    request(s).
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">
                    Admin Response (Optional - applies to all)
                  </span>
                  <textarea
                    value={bulkAdminResponse}
                    onChange={(e) => setBulkAdminResponse(e.target.value)}
                    placeholder={`Add a comment for ${bulkAction === "approve" ? "approving" : "denying"} these requests...`}
                    rows="3"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent transition-all resize-none text-sm font-medium"
                    disabled={processing}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => !processing && setIsBulkModalOpen(false)}
                    disabled={processing}
                    className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmBulkAction}
                    disabled={processing}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-white transition-all shadow-md ${
                      processing
                        ? "bg-gray-400 cursor-not-allowed"
                        : bulkAction === "approve"
                          ? "bg-gradient-to-r from-[#15803d] to-[#50b748]"
                          : "bg-gradient-to-r from-rose-600 to-red-500"
                    }`}
                  >
                    {processing
                      ? "Processing..."
                      : `Confirm ${bulkAction === "approve" ? "Approve" : "Deny"}`}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document Viewer Modal */}
      <AnimatePresence>
        {documentViewer.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00b4eb] to-[#0056a2]"></div>

              <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-slate-50/50">
                <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                  <FiFileText className="text-[#0056a2]" /> Document Viewer
                </h3>
                <button
                  onClick={closeDocumentViewer}
                  className="text-gray-400 hover:text-gray-700 p-2 rounded-xl bg-white hover:bg-gray-100 transition-colors border border-gray-200 shadow-sm"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4 bg-slate-100/50">
                {documentViewer.type === "pdf" ? (
                  <iframe
                    src={documentViewer.url}
                    className="w-full h-full min-h-[60vh] border-0 rounded-xl bg-white shadow-sm"
                    title="Document Viewer"
                  />
                ) : documentViewer.type === "image" ? (
                  <div className="flex items-center justify-center min-h-[60vh] bg-white rounded-xl shadow-sm p-4">
                    <img
                      src={documentViewer.url}
                      alt="Document"
                      className="max-w-full max-h-[70vh] object-contain rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white rounded-xl shadow-sm min-h-[50vh] flex flex-col items-center justify-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <FiFileText size={32} className="text-slate-300" />
                    </div>
                    <p className="text-gray-600 font-medium mb-6">
                      This file type cannot be previewed.
                    </p>
                    <a
                      href={documentViewer.url}
                      download
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#0056a2] text-white font-bold rounded-xl shadow-md"
                    >
                      <FiFileText /> Download File
                    </a>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 p-4 border-t border-gray-100 bg-white">
                <a
                  href={documentViewer.url}
                  download
                  className="px-6 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm"
                >
                  Download
                </a>
                <button
                  onClick={closeDocumentViewer}
                  className="px-6 py-2.5 text-sm font-bold text-white bg-slate-800 rounded-xl hover:bg-slate-900 shadow-sm"
                >
                  Close Viewer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminNavigation>
  );
};

export default AdminLeaveManagement;
