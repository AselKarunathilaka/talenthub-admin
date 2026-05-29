import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import logo from "../assets/sltlogo.jpg";
import { API_BASE_URL } from "../api/apiConfig";

const AdminLeaveManagement = ({ requestType = "short_leave" }) => {
  const isStudyLeave = requestType === "study_leave";
  const pageCopy = isStudyLeave
    ? {
        title: "Study Leave Requests Management",
        description: "Review and manage intern exam-period study leave requests",
        empty: "No study leave requests found",
        details: "Study Leave Request Details",
        noForDate: "No study leave requests submitted",
      }
    : {
        title: "Short Leave Request Management",
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
        return "px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800";
      case "Denied":
        return "px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800";
      case "Pending":
        return "px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800";
      default:
        return "px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800";
    }
  };

  const getPurposeBadgeClass = (purpose) => {
    return purpose === "Official"
      ? "px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
      : "px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800";
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
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6 flex items-center gap-4 pb-6 border-b border-gray-200">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            title="Go back"
          >
            <FiArrowLeft className="w-6 h-6" />
          </button>
          <img src={logo} alt="SLT Logo" className="w-16 h-16 object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <FiFileText className="text-blue-600" />
              {pageCopy.title}
            </h1>
            <p className="text-gray-600 mt-1">
              {pageCopy.description}
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-3xl font-bold text-gray-900">
                {displayedStats.total}
              </div>
              <div className="text-sm text-gray-600 mt-1">Total Requests</div>
              {selectedDate ? (
                <div className="text-xs text-gray-500 mt-1">
                  for {formatSelectedDate().replace(" (Today)", "")}
                </div>
              ) : isStudyLeave ? (
                <div className="text-xs text-gray-500 mt-1">
                  all submitted dates
                </div>
              ) : null}
            </div>
            <div className="bg-yellow-50 rounded-lg shadow-sm border border-yellow-200 p-6 relative">
              {displayedStats.pending > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold animate-pulse">
                  {displayedStats.pending}
                </div>
              )}
              <div className="text-3xl font-bold text-yellow-800">
                {displayedStats.pending}
              </div>
              <div className="text-sm text-yellow-600 mt-1 font-semibold">
                ⏰ Pending Review
              </div>
            </div>
            <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-6">
              <div className="text-3xl font-bold text-green-800">
                {displayedStats.approved}
              </div>
              <div className="text-sm text-green-600 mt-1">✓ Approved</div>
            </div>
            <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-6">
              <div className="text-3xl font-bold text-red-800">
                {displayedStats.denied}
              </div>
              <div className="text-sm text-red-600 mt-1">✗ Denied</div>
            </div>
          </div>

          {/* Date + Intern ID filter bar */}
          <div className="mb-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              {/* Left: date + intern ID filters */}
              <div className="flex flex-wrap items-start gap-6">
                {/* Date filter */}
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <FiFilter className="inline mr-1" />
                    {isStudyLeave ? "Filter by Submitted Date" : "Filter by Date"}
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                  {isStudyLeave && selectedDate && (
                    <button
                      onClick={() => {
                        setSelectedDate("");
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                      className="mt-2 text-left text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Show all pending requests
                    </button>
                  )}
                  {selectedDate && (
                    <p className="text-sm text-gray-600 mt-2">
                      Showing:{" "}
                      <span className="font-semibold">
                        {formatSelectedDate()}
                      </span>
                    </p>
                  )}
                  {isStudyLeave && !selectedDate && (
                    <p className="text-sm text-gray-600 mt-2">
                      Showing: <span className="font-semibold">All submitted dates</span>
                    </p>
                  )}
                </div>

                {/* Intern ID filter — now filters on internTraineeId */}
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <FiUser className="inline mr-1" />
                    Filter by Intern ID
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={internIdFilter}
                      onChange={(e) =>
                        setInternIdFilter(
                          e.target.value.replace(/\D/g, "").slice(0, 4),
                        )
                      }
                      placeholder="4-digit ID"
                      maxLength={4}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 w-32"
                    />
                    {internIdFilter && (
                      <button
                        onClick={() => setInternIdFilter("")}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                        title="Clear intern ID filter"
                      >
                        <FiX className="w-4 h-4" /> Clear
                      </button>
                    )}
                  </div>
                  {internIdFilter && (
                    <p className="text-sm text-gray-600 mt-2">
                      ID:{" "}
                      <span className="font-semibold text-blue-700">
                        {internIdFilter}
                      </span>
                      {filteredRequests.length === 0 ? (
                        <span className="ml-2 text-red-500 text-xs">
                          No matches
                        </span>
                      ) : (
                        <span className="ml-2 text-green-600 text-xs">
                          {filteredRequests.length} result
                          {filteredRequests.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: action buttons */}
              <div className="flex gap-3 flex-wrap">
                {!isStudyLeave && (
                <button
                  onClick={handleTriggerApprovedShortLeaveEmail}
                  disabled={triggeringEmail}
                  className={`bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm hover:bg-green-700 transition-colors flex items-center gap-2 ${
                    triggeringEmail ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  title="Manually send approved short leave email to gate staff"
                >
                  <FiSend className={triggeringEmail ? "animate-pulse" : ""} />
                  {triggeringEmail
                    ? "Sending Email..."
                    : "📧 Send Approved Leaves Email"}
                </button>
                )}
                {!isStudyLeave && (
                  <button
                    onClick={handleDownloadApprovedReport}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    <FiFileText />
                    Download Approved Leaves PDF
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Buttons & Controls */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: "Pending", count: displayedStats.pending, icon: "⏰" },
                { key: "Approved", count: displayedStats.approved, icon: "✓" },
                { key: "Denied", count: displayedStats.denied, icon: "✗" },
                {
                  key: "all",
                  count: displayedStats.total,
                  label: "All",
                  icon: "📋",
                },
              ].map(({ key, count, label, icon }) => (
                <button
                  key={key}
                  onClick={() => {
                    setFilter(key);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                    setSelectedRequests(new Set());
                    setIsSelectAll(false);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    filter === key
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span>{icon}</span>
                  {label || key} ({count})
                </button>
              ))}
            </div>

            {/* Sort and refresh controls */}
            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  fetchLeaveRequests();
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="urgent">Urgent First (Today)</option>
              </select>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                Auto-refresh (30s)
              </label>

              <button
                onClick={() => {
                  fetchLeaveRequests();
                  fetchStats();
                  toast.success("Refreshed!");
                }}
                className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {filter === "Pending" && selectedRequests.size > 0 && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-blue-700 font-medium">
                {selectedRequests.size} request(s) selected
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleBulkAction("approve")}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <FiCheckCircle />
                  Approve Selected
                </button>
                <button
                  onClick={() => handleBulkAction("deny")}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  <FiX />
                  Deny Selected
                </button>
                <button
                  onClick={() => {
                    setSelectedRequests(new Set());
                    setIsSelectAll(false);
                  }}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FiFileText className="mx-auto text-gray-400 text-6xl mb-4" />
            <p className="text-gray-600 text-lg">
              {internIdFilter
                ? `No requests found for intern ID "${internIdFilter}"`
                : selectedDate
                  ? `${pageCopy.noForDate} for ${formatSelectedDate()}`
                  : pageCopy.empty}
            </p>
            <div className="mt-4 flex gap-3 justify-center">
              {internIdFilter && (
                <button
                  onClick={() => setInternIdFilter("")}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Clear Intern ID Filter
                </button>
              )}
              <button
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setSelectedDate(today);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Today's Requests
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Requests Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {filter === "Pending" && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                          <button
                            onClick={handleSelectAll}
                            className="flex items-center justify-center"
                            title={isSelectAll ? "Deselect all" : "Select all"}
                          >
                            {isSelectAll ? (
                              <FiCheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <FiSquare className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Intern Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {isStudyLeave ? "Study Leave Period" : "Leave Date & Time"}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Purpose
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Submitted
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRequests.map((request) => {
                      const urgent = isUrgentRequest(request.leaveDate);
                      const todayRequest = isToday(request.leaveDate);
                      return (
                        <tr
                          key={request._id}
                          className={`hover:bg-gray-50 ${
                            urgent && request.status === "Pending"
                              ? "bg-orange-50 border-l-4 border-l-orange-500"
                              : todayRequest
                                ? "bg-blue-50"
                                : ""
                          }`}
                        >
                          {filter === "Pending" && (
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={selectedRequests.has(request._id)}
                                  onChange={() =>
                                    handleSelectRequest(request._id)
                                  }
                                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                  disabled={request.status !== "Pending"}
                                />
                              </div>
                            </td>
                          )}

                          {/* ── UPDATED: Intern Details cell ── */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {/* Name + urgent badge */}
                            <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                              {request.internName}
                              {urgent && request.status === "Pending" && (
                                <span className="text-xs px-2 py-0.5 bg-red-500 text-white rounded-full font-bold animate-pulse">
                                  URGENT
                                </span>
                              )}
                            </div>

                            {/* Intern Trainee ID (4-digit) — highlighted when filter active */}
                            <div className="text-xs text-blue-700 font-semibold mt-0.5 flex items-center gap-1">
                              <FiUser className="w-3 h-3 flex-shrink-0" />
                              ID:{" "}
                              {request.internTraineeId ? (
                                internIdFilter ? (
                                  highlightMatch(
                                    request.internTraineeId,
                                    internIdFilter,
                                  )
                                ) : (
                                  request.internTraineeId
                                )
                              ) : (
                                <span className="text-gray-400 font-normal">
                                  N/A
                                </span>
                              )}
                            </div>

                            {/* National ID */}
                            <div className="text-sm text-gray-500 mt-0.5">
                              NIC: {request.nationalId}
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center gap-2">
                              <FiCalendar className="text-gray-400" />
                              {formatDate(request.leaveDate)}
                              {todayRequest && (
                                <span className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded-full font-bold">
                                  TODAY
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                              <FiClock className="text-gray-400" />
                              {isStudyLeave && request.studyEndDate
                                ? `Until ${formatDate(request.studyEndDate)}`
                                : request.leaveTime}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={getPurposeBadgeClass(request.purpose)}
                            >
                              {request.purpose}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(request.submittedAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={getStatusBadgeClass(request.status)}
                            >
                              {request.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              {request.status === "Pending" ? (
                                <>
                                  <button
                                    onClick={() =>
                                      handleQuickAction(request._id, "approve")
                                    }
                                    disabled={processing}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-xs font-semibold"
                                    title="Quick Approve"
                                  >
                                    <FiCheck className="w-4 h-4" />
                                    Approve
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleQuickAction(request._id, "deny")
                                    }
                                    disabled={processing}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-xs font-semibold"
                                    title="Quick Deny"
                                  >
                                    <FiX className="w-4 h-4" />
                                    Deny
                                  </button>
                                  <button
                                    onClick={() => openReviewModal(request)}
                                    className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs font-semibold border border-blue-300"
                                    title="View Details"
                                  >
                                    <FiEye className="w-4 h-4 inline" /> Details
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => openReviewModal(request)}
                                  className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                                >
                                  Review
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                  disabled={pagination.page === 1}
                  className="px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Review Modal */}
        {selectedRequest && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={closeReviewModal}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FiFileText className="text-blue-600" />
              {pageCopy.details}
                </h2>
                <button
                  onClick={closeReviewModal}
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                {/* ── UPDATED: show intern ID + NIC together ── */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Intern Name
                    </label>
                    <p className="text-sm text-gray-900">
                      {selectedRequest.internName}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Intern ID
                    </label>
                    <p className="text-sm font-semibold text-blue-700">
                      {selectedRequest.internTraineeId ?? (
                        <span className="text-gray-400 font-normal">N/A</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      NIC
                    </label>
                    <p className="text-sm text-gray-900">
                      {selectedRequest.nationalId}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Leave Date
                    </label>
                    <p className="text-sm text-gray-900 flex items-center gap-2">
                      <FiCalendar className="text-gray-400" />
                      {formatDate(selectedRequest.leaveDate)}
                    </p>
                  </div>
                </div>
                {isStudyLeave && selectedRequest.studyEndDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Study Leave End Date
                    </label>
                    <p className="text-sm text-gray-900 flex items-center gap-2">
                      <FiCalendar className="text-gray-400" />
                      {formatDate(selectedRequest.studyEndDate)}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Leave Time
                    </label>
                    <p className="text-sm text-gray-900 flex items-center gap-2">
                      <FiClock className="text-gray-400" />
                      {selectedRequest.leaveTime}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Purpose
                    </label>
                    <span
                      className={getPurposeBadgeClass(selectedRequest.purpose)}
                    >
                      {selectedRequest.purpose}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                    {selectedRequest.reason}
                  </p>
                </div>
                {selectedRequest.proofDocument?.data && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Proof Document
                    </label>
                    <button
                      onClick={() => handleViewDocument(selectedRequest._id)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 underline bg-transparent border-none cursor-pointer"
                    >
                      <FiEye /> View Document (
                      {selectedRequest.proofDocument.filename})
                    </button>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Submitted At
                  </label>
                  <p className="text-sm text-gray-900">
                    {formatDateTime(selectedRequest.submittedAt)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Status
                  </label>
                  <span className={getStatusBadgeClass(selectedRequest.status)}>
                    {selectedRequest.status}
                  </span>
                </div>
                {selectedRequest.reviewedBy && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reviewed By
                      </label>
                      <p className="text-sm text-gray-900">
                        {selectedRequest.reviewedBy?.email}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reviewed At
                      </label>
                      <p className="text-sm text-gray-900">
                        {formatDateTime(selectedRequest.reviewedAt)}
                      </p>
                    </div>
                    {selectedRequest.adminResponse && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Previous Admin Response
                        </label>
                        <p className="text-sm text-gray-900 bg-blue-50 p-3 rounded-lg">
                          {selectedRequest.adminResponse}
                        </p>
                      </div>
                    )}
                  </>
                )}
                {selectedRequest.status === "Pending" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Admin Response (Optional)
                      </label>
                      <textarea
                        value={adminResponse}
                        onChange={(e) => setAdminResponse(e.target.value)}
                        placeholder="Add a comment or reason for your decision..."
                        rows="3"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                      />
                    </div>
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
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                          processing
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-green-600 hover:bg-green-700 hover:shadow-lg"
                        }`}
                      >
                        <FiCheck className="w-5 h-5" />
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
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                          processing
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-red-600 hover:bg-red-700 hover:shadow-lg"
                        }`}
                      >
                        <FiX className="w-5 h-5" />
                        {processing ? "Processing..." : "Deny"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bulk Action Modal */}
        {isBulkModalOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => !processing && setIsBulkModalOpen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  {bulkAction === "approve" ? (
                    <FiCheckCircle className="text-green-600" />
                  ) : (
                    <FiX className="text-red-600" />
                  )}
                  Bulk {bulkAction === "approve" ? "Approve" : "Deny"} Requests
                </h2>
                <button
                  onClick={() => !processing && setIsBulkModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
                  disabled={processing}
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-blue-800 text-sm">
                    You are about to{" "}
                    {bulkAction === "approve" ? "approve" : "deny"}{" "}
                    <span className="font-bold">{selectedRequests.size}</span>{" "}
                    leave request(s).
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Response (Optional - applied to all selected requests)
                  </label>
                  <textarea
                    value={bulkAdminResponse}
                    onChange={(e) => setBulkAdminResponse(e.target.value)}
                    placeholder={`Add a comment or reason for ${bulkAction === "approve" ? "approving" : "denying"} these requests...`}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    disabled={processing}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => !processing && setIsBulkModalOpen(false)}
                    disabled={processing}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmBulkAction}
                    disabled={processing}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                      processing
                        ? "bg-gray-400 cursor-not-allowed"
                        : bulkAction === "approve"
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {processing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        {bulkAction === "approve" ? <FiCheckCircle /> : <FiX />}
                        Confirm {bulkAction === "approve"
                          ? "Approve"
                          : "Deny"}{" "}
                        ({selectedRequests.size})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Viewer Modal */}
        {documentViewer.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
            <div className="relative bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  Document Viewer
                </h3>
                <button
                  onClick={closeDocumentViewer}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <FiX size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4">
                {documentViewer.type === "pdf" ? (
                  <iframe
                    src={documentViewer.url}
                    className="w-full h-full min-h-[600px] border-0"
                    title="Document Viewer"
                  />
                ) : documentViewer.type === "image" ? (
                  <img
                    src={documentViewer.url}
                    alt="Document"
                    className="max-w-full h-auto mx-auto"
                  />
                ) : (
                  <div className="text-center py-12">
                    <FiFileText
                      size={64}
                      className="mx-auto text-gray-400 mb-4"
                    />
                    <p className="text-gray-600 mb-4">
                      This file type cannot be previewed.
                    </p>
                    <a
                      href={documentViewer.url}
                      download
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <FiFileText /> Download File
                    </a>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                <a
                  href={documentViewer.url}
                  download
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Download
                </a>
                <button
                  onClick={closeDocumentViewer}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLeaveManagement;
