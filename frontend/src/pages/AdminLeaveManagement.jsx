import React, { useState, useEffect, useRef } from "react";
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
  FiEye,
  FiCheckSquare,
  FiSquare,
  FiCheckCircle,
  FiSend,
} from "react-icons/fi";
import { Bike, GraduationCap } from "lucide-react";
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
    loading: false,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
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
    return requestType === "study_leave" ? "" : new Date().toISOString().split("T")[0];
  });

  // Bulk operations
  const [selectedRequests, setSelectedRequests] = useState(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkAdminResponse, setBulkAdminResponse] = useState("");
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [triggeringEmail, setTriggeringEmail] = useState(false);

  const [prevRequestType, setPrevRequestType] = useState(requestType);
  if (requestType !== prevRequestType) {
    setPrevRequestType(requestType);
    setLeaveRequests([]);
    setStats({ total: 0, pending: 0, approved: 0, denied: 0 });
    setFilter("all");
    setPagination({ page: 1, limit: 10, total: 0, totalPages: 0 });
    setSelectedDate(requestType === "study_leave" ? "" : new Date().toISOString().split("T")[0]);
    setSelectedRequests(new Set());
    setIsSelectAll(false);
  }

  const fetchIdRef = useRef(0);

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

  const fetchLeaveRequests = async () => {
    const currentFetchId = ++fetchIdRef.current;
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

      if (currentFetchId !== fetchIdRef.current) return;

      // Sort requests
      let sortedRequests = [...response.data];
      sortedRequests.sort(
        (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt),
      );

      setLeaveRequests(sortedRequests);
      setPagination(response.pagination);
      setSelectedRequests(new Set());
      setIsSelectAll(false);
    } catch (error) {
      if (currentFetchId !== fetchIdRef.current) return;
      console.error("Error fetching leave requests:", error);

      if (error.message === "Admin access required") {
        toast.error("Admin access required. Redirecting to admin login...");
        setTimeout(() => navigate("/admin-login"), 1500);
        return;
      }

      toast.error("Failed to load leave requests");
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  };

  const fetchStats = async () => {
    const currentFetchId = fetchIdRef.current;
    try {
      const params = {};
      if (isStudyLeave && selectedDate) {
        params.submittedDate = selectedDate;
      } else if (!isStudyLeave) {
        params.date = selectedDate || new Date().toISOString().split("T")[0];
      }
      params.requestType = requestType;
      const response = await getLeaveRequestStats(params);

      if (currentFetchId !== fetchIdRef.current) return;

      setStats(response.data);
    } catch (error) {
      if (currentFetchId !== fetchIdRef.current) return;
      console.error("Error fetching stats:", error);
    }
  };

  const handleViewDocument = async (leaveRequestId) => {
    try {
      setDocumentViewer({ show: true, url: "", type: "", loading: true });
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

      setDocumentViewer({ show: true, url: fileUrl, type: fileType, loading: false });
    } catch (error) {
      console.error("Error loading document:", error);
      toast.error(error.message || "Failed to load document");
      setDocumentViewer({ show: false, url: "", type: "", loading: false });
    }
  };

  const closeDocumentViewer = () => {
    if (documentViewer.url && documentViewer.url.startsWith("blob:")) {
      URL.revokeObjectURL(documentViewer.url);
    }
    setDocumentViewer({ show: false, url: "", type: "", loading: false });
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

  const handleSelectAll = async () => {
    if (isSelectAll) {
      setSelectedRequests(new Set());
      setIsSelectAll(false);
    } else {
      setProcessing(true);
      const toastId = toast.loading("Selecting all pending requests...");
      try {
        const params = {
          limit: 10000,
          requestType,
          status: "Pending",
        };
        
        if (selectedDate && isStudyLeave) {
          params.submittedDate = selectedDate;
        } else if (selectedDate) {
          params.date = selectedDate;
        }

        const response = await getAllLeaveRequests(params);
        
        const allIds = response.data
          .filter((request) => request.status === "Pending")
          .map((request) => request._id);
          
        setSelectedRequests(new Set(allIds));
        setIsSelectAll(true);
        toast.success(`Selected ${allIds.length} pending requests`, { id: toastId });
      } catch (error) {
        console.error("Error fetching all pending requests for selection:", error);
        toast.error("Failed to select all requests", { id: toastId });
      } finally {
        setProcessing(false);
      }
    }
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

  const filteredRequests = leaveRequests;

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
                  {isStudyLeave ? (
                    <GraduationCap className="text-[#0056a2] h-8 w-8" />
                  ) : (
                    <Bike className="text-[#0056a2] h-8 w-8" />
                  )}
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
              className="flex gap-3 flex-col sm:flex-row flex-wrap sm:justify-end sm:items-center w-full md:w-auto"
            >
              {!isStudyLeave && (
                <button
                  onClick={handleTriggerApprovedShortLeaveEmail}
                  disabled={triggeringEmail}
                  className={`bg-white text-[#15803d] border border-[#15803d]/30 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-green-50 transition-all flex items-center justify-center gap-2 w-full sm:w-auto ${
                    triggeringEmail ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  title="Manually send approved short leave email to gate staff"
                >
                  <FiSend className={triggeringEmail ? "animate-pulse" : ""} />
                  {triggeringEmail ? "Sending..." : "Send Gate Email"}
                </button>
              )}

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-2 sm:p-3 flex items-center gap-3 w-full sm:w-auto min-w-0 sm:min-w-[280px]">
                <div className="flex-1 bg-slate-50 rounded-2xl p-3 flex items-center gap-3 border border-slate-100">
                  <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                    <FiCalendar className="text-[#00b4eb] h-5 w-5" />
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                      {isStudyLeave ? "Submitted Date" : "Select Date"}
                    </label>
                    <div className="flex items-center">
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => {
                          setSelectedDate(e.target.value);
                          setPagination((prev) => ({ ...prev, page: 1 }));
                        }}
                        className="bg-transparent text-sm font-bold text-gray-800 w-full focus:outline-none cursor-pointer"
                      />
                      {selectedDate && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate("");
                            setPagination((prev) => ({ ...prev, page: 1 }));
                          }}
                          className="ml-2 text-gray-400 hover:text-rose-500 transition-colors p-1 flex-shrink-0"
                          title="Clear date filter"
                        >
                          <FiX size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Premium Stat Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6"
          >
            <div 
              onClick={() => { setFilter("all"); setPagination((prev) => ({ ...prev, page: 1 })); setSelectedRequests(new Set()); setIsSelectAll(false); }}
              className={`rounded-3xl border p-4 sm:p-5 flex items-center gap-3 sm:gap-4 relative overflow-hidden group transition-all cursor-pointer ${filter === "all" ? "bg-blue-50/50 border-[#0056a2] shadow-md shadow-[#0056a2]/10 ring-2 ring-[#0056a2]/20" : "bg-white shadow-sm border-gray-100 hover:border-[#0056a2]/30"}`}
            >
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-gray-50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 z-10 transition-colors ${filter === "all" ? "text-[#0056a2]" : "text-gray-500 group-hover:text-[#0056a2]"}`}>
                <FiFileText className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="z-10 text-left min-w-0">
                <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight truncate">
                  {displayedStats.total}
                </div>
                <div className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mt-0.5 leading-tight truncate">
                  Total
                </div>
              </div>
            </div>

            <div 
              onClick={() => { setFilter("Pending"); setPagination((prev) => ({ ...prev, page: 1 })); setSelectedRequests(new Set()); setIsSelectAll(false); }}
              className={`rounded-3xl border p-4 sm:p-5 flex items-center gap-3 sm:gap-4 relative overflow-hidden group transition-all cursor-pointer ${filter === "Pending" ? "bg-amber-100/40 border-amber-500 shadow-md shadow-amber-500/10 ring-2 ring-amber-500/20" : "bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm border-amber-100 hover:border-amber-300"}`}
            >
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-100/50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-white rounded-2xl flex items-center justify-center border border-amber-100 z-10 text-amber-500 shadow-sm">
                <FiClock className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="z-10 text-left min-w-0">
                <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight truncate">
                  {displayedStats.pending}
                </div>
                <div className="text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wider mt-0.5 leading-tight truncate">
                  Pending
                </div>
              </div>
            </div>

            <div 
              onClick={() => { setFilter("Approved"); setPagination((prev) => ({ ...prev, page: 1 })); setSelectedRequests(new Set()); setIsSelectAll(false); }}
              className={`rounded-3xl border p-4 sm:p-5 flex items-center gap-3 sm:gap-4 relative overflow-hidden group transition-all cursor-pointer ${filter === "Approved" ? "bg-green-100/40 border-green-500 shadow-md shadow-green-500/10 ring-2 ring-green-500/20" : "bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm border-green-100 hover:border-green-300"}`}
            >
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-100/50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-white rounded-2xl flex items-center justify-center border border-green-100 z-10 text-green-500 shadow-sm">
                <FiCheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="z-10 text-left min-w-0">
                <div className="text-2xl sm:text-3xl font-extrabold text-green-600 tracking-tight truncate">
                  {displayedStats.approved}
                </div>
                <div className="text-[10px] sm:text-xs font-bold text-green-700 uppercase tracking-wider mt-0.5 leading-tight truncate">
                  Approved
                </div>
              </div>
            </div>

            <div 
              onClick={() => { setFilter("Denied"); setPagination((prev) => ({ ...prev, page: 1 })); setSelectedRequests(new Set()); setIsSelectAll(false); }}
              className={`rounded-3xl border p-4 sm:p-5 flex items-center gap-3 sm:gap-4 relative overflow-hidden group transition-all cursor-pointer ${filter === "Denied" ? "bg-rose-100/40 border-rose-500 shadow-md shadow-rose-500/10 ring-2 ring-rose-500/20" : "bg-gradient-to-br from-rose-50 to-red-50 shadow-sm border-rose-100 hover:border-rose-300"}`}
            >
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-100/50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-white rounded-2xl flex items-center justify-center border border-rose-100 z-10 text-rose-500 shadow-sm">
                <FiX className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="z-10 text-left min-w-0">
                <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight truncate">
                  {displayedStats.denied}
                </div>
                <div className="text-[10px] sm:text-xs font-bold text-rose-700 uppercase tracking-wider mt-0.5 leading-tight truncate">
                  Denied
                </div>
              </div>
            </div>
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
                <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                  <button
                    onClick={() => handleBulkAction("approve")}
                    disabled={processing}
                    className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm hover:bg-green-700 transition-all disabled:opacity-50 w-full"
                  >
                    <FiCheckCircle className="text-base sm:text-lg shrink-0" /> 
                    <span className="truncate">Approve <span className="hidden sm:inline">Selected</span></span>
                  </button>
                  <button
                    onClick={() => handleBulkAction("deny")}
                    disabled={processing}
                    className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm hover:bg-rose-700 transition-all disabled:opacity-50 w-full"
                  >
                    <FiX className="text-base sm:text-lg shrink-0" /> 
                    <span className="truncate">Deny <span className="hidden sm:inline">Selected</span></span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRequests(new Set());
                      setIsSelectAll(false);
                    }}
                    className="col-span-2 sm:col-span-1 px-4 py-2.5 bg-gray-200/50 sm:bg-transparent text-gray-600 sm:text-gray-500 hover:bg-gray-200 sm:hover:bg-transparent hover:text-gray-800 rounded-xl sm:rounded-none font-bold text-xs sm:text-sm transition-colors text-center w-full sm:w-auto"
                  >
                    Clear <span className="sm:hidden">Selection</span>
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
                {pageCopy.empty}
              </h4>
              <p className="text-gray-500">
                {selectedDate
                  ? `No requests found for ${formatSelectedDate()}.`
                  : "Try adjusting your filters."}
              </p>
              <div className="mt-8 flex justify-center gap-4">
                {(selectedDate || filter !== "all") && (
                  <button
                    onClick={() => {
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
              {/* Mobile Select All */}
              {filter === "Pending" && filteredRequests.length > 0 && (
                <div className="md:hidden flex items-center justify-between mb-4 bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                  <span className="text-sm font-bold text-gray-700">Select All Requests</span>
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center justify-center transition-transform hover:scale-110"
                    title={isSelectAll ? "Deselect all" : "Select all"}
                  >
                    {isSelectAll ? (
                      <FiCheckSquare className="w-6 h-6 text-[#0056a2]" />
                    ) : (
                      <FiSquare className="w-6 h-6 text-gray-300 hover:text-gray-400" />
                    )}
                  </button>
                </div>
              )}

              {/* Premium Data Table */}
              <div className="bg-transparent md:bg-white md:rounded-3xl shadow-none md:shadow-sm border-none md:border md:border-gray-100 mb-6">
                <div className="overflow-visible md:overflow-x-auto">
                  <table className="min-w-full block md:table divide-y divide-gray-100">
                    <thead className="hidden md:table-header-group bg-slate-50/50">
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
                    <tbody className="block md:table-row-group divide-y-0 md:divide-y divide-gray-50 bg-transparent md:bg-white">
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
                              className={`grid grid-cols-2 md:table-row mb-4 md:mb-0 bg-white rounded-2xl md:rounded-none shadow-sm md:shadow-none border border-gray-100 md:border-none transition-colors hover:bg-slate-50/50 overflow-hidden ${
                                urgent && request.status === "Pending"
                                  ? "bg-rose-50/30"
                                  : todayRequest
                                    ? "bg-blue-50/30"
                                    : ""
                              }`}
                            >
                              {filter === "Pending" && (
                                <td className="col-span-2 md:table-cell px-4 py-3 md:px-6 md:py-6 text-left md:text-center border-b border-gray-50 md:border-none">
                                  <div className="flex items-center gap-3 md:block">
                                    <input
                                      type="checkbox"
                                      checked={selectedRequests.has(request._id)}
                                      onChange={() =>
                                        handleSelectRequest(request._id)
                                      }
                                      className="w-4 h-4 text-[#0056a2] border-gray-300 rounded focus:ring-[#0056a2] cursor-pointer"
                                      disabled={request.status !== "Pending"}
                                    />
                                    <span className="md:hidden text-sm font-bold text-gray-700">Select Request</span>
                                  </div>
                                </td>
                              )}

                              <td className="col-span-2 md:table-cell px-4 py-4 md:px-6 md:py-6 min-w-0 md:min-w-[200px] border-b border-gray-50 md:border-none">
                                <div className="md:hidden text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Intern Details</div>
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-start gap-2 flex-wrap">
                                    <div className="font-bold text-gray-900 text-sm">
                                      {request.internName}
                                    </div>
                                    {urgent && request.status === "Pending" && (
                                      <span className="text-[9px] px-1.5 py-0.5 bg-rose-500 text-white rounded uppercase tracking-wider font-bold animate-pulse mt-0.5">
                                        Urgent
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <div className="text-xs font-bold text-[#0056a2] bg-blue-50 px-2 py-1 rounded-md flex items-center gap-1 w-fit">
                                      <FiUser size={10} className="shrink-0" /> ID:{" "}
                                      {request.internTraineeId || "N/A"}
                                    </div>
                                    <div className="text-xs text-gray-500 font-medium">
                                      NIC: {request.nationalId}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="col-span-1 md:table-cell px-4 py-4 md:px-6 md:py-6 min-w-0 md:min-w-[180px] border-b border-r border-gray-50 md:border-none">
                                <div className="md:hidden text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                  {isStudyLeave ? "Extended Leave Period" : "Leave Date & Time"}
                                </div>
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2 text-sm font-bold text-gray-800 flex-wrap">
                                    <FiCalendar className="text-gray-400 shrink-0" />
                                    <span>{formatDate(request.leaveDate)}</span>
                                    {todayRequest && (
                                      <span className="text-[9px] px-1.5 py-0.5 bg-[#00b4eb] text-white rounded uppercase tracking-wider font-bold mt-0.5">
                                        Today
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-start gap-2 text-xs font-medium text-gray-500 mt-1">
                                    <FiClock className="text-gray-400 shrink-0 mt-0.5" />
                                    <span className="break-words">
                                      {isStudyLeave && request.studyEndDate
                                        ? `Until ${formatDate(request.studyEndDate)}`
                                        : request.leaveTime}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="col-span-1 md:table-cell px-4 py-4 md:px-6 md:py-6 min-w-0 md:min-w-[150px] md:max-w-[200px] border-b border-gray-50 md:border-none">
                                <div className="md:hidden text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Purpose</div>
                                <span
                                  className={`${getPurposeBadgeClass(
                                    request.purpose,
                                  )} whitespace-normal inline-block text-center leading-snug`}
                                >
                                  {request.purpose}
                                </span>
                              </td>

                              <td className="col-span-1 md:table-cell px-4 py-4 md:px-6 md:py-6 min-w-0 md:min-w-[120px] text-sm font-medium text-gray-500 whitespace-normal border-b border-r border-gray-50 md:border-none">
                                <div className="md:hidden text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Submitted</div>
                                {formatDate(request.submittedAt)}
                              </td>

                              <td className="col-span-1 md:table-cell px-4 py-4 md:px-6 md:py-6 min-w-0 md:min-w-[120px] border-b border-gray-50 md:border-none">
                                <div className="md:hidden text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Status</div>
                                <span
                                  className={`${getStatusBadgeClass(
                                    request.status,
                                  )} inline-block whitespace-normal text-center`}
                                >
                                  {request.status}
                                </span>
                              </td>

                              <td className="col-span-2 md:table-cell px-4 py-4 md:px-6 md:py-6 min-w-0 md:min-w-[160px] text-left md:text-right md:border-none bg-slate-50/30 md:bg-transparent">
                                <div className="flex flex-col md:items-end gap-2">
                                  {request.status === "Pending" ? (
                                    <div className="flex flex-col gap-2 w-full md:w-auto">
                                      <div className="grid grid-cols-2 gap-2">
                                        <button
                                          onClick={() =>
                                            handleQuickAction(
                                              request._id,
                                              "approve",
                                            )
                                          }
                                          disabled={processing}
                                          className="p-2 flex justify-center bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-xl transition-all disabled:opacity-50 border border-green-200 hover:border-transparent"
                                          title="Quick Approve"
                                        >
                                          <FiCheck size={16} />
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleQuickAction(request._id, "deny")
                                          }
                                          disabled={processing}
                                          className="p-2 flex justify-center bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all disabled:opacity-50 border border-rose-200 hover:border-transparent"
                                          title="Quick Deny"
                                        >
                                          <FiX size={16} />
                                        </button>
                                      </div>
                                      <button
                                        onClick={() => openReviewModal(request)}
                                        className="px-3 py-2 w-full bg-white text-[#0056a2] hover:bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-sm"
                                        title="Review Details"
                                      >
                                        Review
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => openReviewModal(request)}
                                      className="px-3 py-2 w-full md:w-auto bg-white md:bg-slate-50 text-gray-600 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm md:shadow-none"
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
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]"
            onClick={closeReviewModal}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto flex flex-col relative"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
                {selectedRequest.proofDocument?.filename && (
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
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]"
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
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
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
                {documentViewer.loading ? (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white rounded-xl shadow-sm p-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0056a2] mb-4"></div>
                    <p className="text-gray-500 font-bold animate-pulse">Opening Document...</p>
                  </div>
                ) : documentViewer.type === "pdf" ? (
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
