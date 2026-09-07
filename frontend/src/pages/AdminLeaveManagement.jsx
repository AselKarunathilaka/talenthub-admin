import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  FiSearch,
  FiRotateCcw,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
} from "react-icons/fi";
import { Bike, GraduationCap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../api/apiConfig";
import { getAdminSession, hasAdminPermission } from "../utils/adminAuth";

const AdminLeaveManagement = ({ requestType = "short_leave" }) => {
  const isStudyLeave = requestType === "study_leave";
  const currentAdmin = getAdminSession()?.user;
  const canManageLeave = currentAdmin?.role !== "supervisor" && hasAdminPermission("leave.manage");
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
  const location = useLocation();
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [documentViewer, setDocumentViewer] = useState({
    show: false,
    url: "",
    type: "",
    loading: false,
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
    return requestType === "study_leave" ? "" : new Date().toISOString().split("T")[0];
  });

  // Bulk operations
  const [selectedRequests, setSelectedRequests] = useState(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkAdminResponse, setBulkAdminResponse] = useState("");
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [triggeringEmail, setTriggeringEmail] = useState(false);

  // Single Action Popup Modal
  const [actionModal, setActionModal] = useState({
    open: false,
    action: "",
    requestId: null,
    requestName: "",
    adminResponse: "",
  });

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  const closeAllModals = () => {
    setSelectedRequest(null);
    setActionModal({
      open: false,
      action: "",
      requestId: null,
      requestName: "",
      adminResponse: "",
    });
    setIsBulkModalOpen(false);
    if (documentViewer.url && documentViewer.url.startsWith("blob:")) {
      URL.revokeObjectURL(documentViewer.url);
    }
    setDocumentViewer({ show: false, url: "", type: "", loading: false });
  };

  const [prevRequestType, setPrevRequestType] = useState(requestType);
  if (requestType !== prevRequestType) {
    setPrevRequestType(requestType);
    closeAllModals();
    setLeaveRequests([]);
    setStats({ total: 0, pending: 0, approved: 0, denied: 0 });
    setFilter("Pending");
    setPagination({ page: 1, limit: 10, total: 0, totalPages: 0 });
    setSelectedDate(requestType === "study_leave" ? "" : new Date().toISOString().split("T")[0]);
    setSelectedRequests(new Set());
    setIsSelectAll(false);
    setSearchQuery("");
  }

  // Close any open popup when clicking Short Leave or Extended Leave navigation
  useEffect(() => {
    closeAllModals();
  }, [location.pathname, location.key, requestType]);

  // Dynamic detection of sidebar width to center popups exactly in the content area
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined" || window.innerWidth < 1024) return 0;
    try {
      const isCollapsed = JSON.parse(localStorage.getItem("isSidebarCollapsed") || "false");
      return isCollapsed ? 90 : 260;
    } catch {
      return 260;
    }
  });

  useEffect(() => {
    const updateSidebarWidth = () => {
      const mainEl = document.querySelector("main.overflow-y-auto") || document.querySelector("main");
      if (mainEl) {
        const rect = mainEl.getBoundingClientRect();
        setSidebarWidth(Math.round(rect.left));
      } else {
        if (window.innerWidth < 1024) {
          setSidebarWidth(0);
        } else {
          try {
            const isCollapsed = JSON.parse(localStorage.getItem("isSidebarCollapsed") || "false");
            setSidebarWidth(isCollapsed ? 90 : 260);
          } catch {
            setSidebarWidth(260);
          }
        }
      }
    };

    updateSidebarWidth();
    window.addEventListener("resize", updateSidebarWidth);
    const interval = setInterval(updateSidebarWidth, 250);
    return () => {
      window.removeEventListener("resize", updateSidebarWidth);
      clearInterval(interval);
    };
  }, []);

  const fetchIdRef = useRef(0);

  // When any modal is open, temporarily switch scroll-behavior to 'auto' to eliminate wheel/scroll latency
  const isAnyModalOpen = Boolean(selectedRequest || actionModal.open || isBulkModalOpen || documentViewer.show);

  useEffect(() => {
    const scroller =
      document.querySelector("main.overflow-y-auto") ||
      document.querySelector("main");
    if (!scroller) return;

    if (isAnyModalOpen) {
      scroller.style.scrollBehavior = "auto";
    } else {
      scroller.style.scrollBehavior = "";
    }

    return () => {
      if (scroller) {
        scroller.style.scrollBehavior = "";
      }
    };
  }, [isAnyModalOpen]);

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

      toast.success(
        status === "Pending"
          ? "Leave request restored to pending successfully"
          : `Leave request ${status.toLowerCase()} successfully`,
      );
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

  const handleApproveAll = async () => {
    if (!window.confirm(`Are you sure you want to approve ALL ${stats.pending} pending requests?`)) {
      return;
    }
    setProcessing(true);
    try {
      const params = {
        page: 1,
        limit: 10000,
        requestType,
        status: "Pending"
      };
      
      if (selectedDate && isStudyLeave) {
        params.submittedDate = selectedDate;
      } else if (selectedDate) {
        params.date = selectedDate;
      }

      const response = await getAllLeaveRequests(params);
      const allPendingIds = response.data.map(req => req._id);

      if (allPendingIds.length === 0) {
        toast.error("No pending requests to approve.");
        return;
      }

      await bulkUpdateLeaveRequestStatus(allPendingIds, {
        status: "Approved",
        adminResponse: "Bulk approved by Admin",
      });

      toast.success(`Successfully approved all ${allPendingIds.length} requests!`);
      fetchLeaveRequests();
      fetchStats();
    } catch (error) {
      console.error("Error approving all requests:", error);
      toast.error(error.message || "Failed to approve all requests");
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
      const targetStatus = filter === "Denied" ? "Denied" : "Pending";
      const toastId = toast.loading(`Selecting all ${targetStatus.toLowerCase()} requests...`);
      try {
        const params = {
          limit: 10000,
          requestType,
          status: targetStatus,
        };
        
        if (selectedDate && isStudyLeave) {
          params.submittedDate = selectedDate;
        } else if (selectedDate) {
          params.date = selectedDate;
        }

        const response = await getAllLeaveRequests(params);
        
        const allIds = response.data
          .filter((request) => request.status === targetStatus)
          .map((request) => request._id);
          
        setSelectedRequests(new Set(allIds));
        setIsSelectAll(true);
        toast.success(`Selected ${allIds.length} ${targetStatus.toLowerCase()} requests`, { id: toastId });
      } catch (error) {
        console.error(`Error fetching all ${targetStatus.toLowerCase()} requests for selection:`, error);
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

      let targetStatus = "Approved";
      if (bulkAction === "deny") targetStatus = "Denied";
      else if (bulkAction === "restore") targetStatus = "Pending";

      const response = await bulkUpdateLeaveRequestStatus(requestsArray, {
        status: targetStatus,
        adminResponse: bulkAdminResponse.trim() || undefined,
      });

      const actionText =
        bulkAction === "restore"
          ? "restored to pending"
          : bulkAction === "approve"
            ? "approved"
            : "denied";

      toast.success(
        `Successfully ${actionText} ${selectedRequests.size} request(s)${
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

  const handleQuickAction = (requestId, action, requestName = "") => {
    setActionModal({
      open: true,
      action,
      requestId,
      requestName,
      adminResponse: "",
    });
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
        return "px-2 sm:px-2.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold uppercase tracking-wider bg-green-100 text-green-700 border border-green-200";
      case "Denied":
        return "px-2 sm:px-2.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200";
      case "Pending":
        return "px-2 sm:px-2.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200";
      default:
        return "px-2 sm:px-2.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-200";
    }
  };

  const getPurposeBadgeClass = (purpose) => {
    return purpose === "Official"
      ? "px-2 sm:px-2.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-[#0056a2] border border-blue-200"
      : "px-2 sm:px-2.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200";
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

  const filteredRequests = searchQuery.trim()
    ? leaveRequests.filter((request) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          (request.internName && request.internName.toLowerCase().includes(q)) ||
          (request.internTraineeId && request.internTraineeId.toString().toLowerCase().includes(q)) ||
          (request.nationalId && request.nationalId.toLowerCase().includes(q))
        );
      })
    : leaveRequests;

  const displayedStats = (() => {
    const baseStats = {
      total: stats.total || 0,
      pending: stats.pending !== undefined ? stats.pending : (stats.Pending || 0),
      approved: stats.approved !== undefined ? stats.approved : (stats.Approved || 0),
      denied: stats.denied !== undefined ? stats.denied : (stats.Denied || 0),
    };

    if (filter === "all") baseStats.total = Math.max(baseStats.total, pagination.total);
    if (filter === "Pending") baseStats.pending = Math.max(baseStats.pending, pagination.total);
    if (filter === "Approved") baseStats.approved = Math.max(baseStats.approved, pagination.total);
    if (filter === "Denied") baseStats.denied = Math.max(baseStats.denied, pagination.total);

    baseStats.total = Math.max(baseStats.total, baseStats.pending + baseStats.approved + baseStats.denied);
    
    return baseStats;
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

  const scrollAnimFrameRef = useRef(null);
  const accumulatedDeltaYRef = useRef(0);
  const accumulatedDeltaXRef = useRef(0);
  const scrollerRef = useRef(null);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);

  const getScroller = () => {
    if (!scrollerRef.current || !scrollerRef.current.isConnected) {
      scrollerRef.current =
        document.querySelector("main.overflow-y-auto") ||
        document.querySelector("main");
    }
    return scrollerRef.current;
  };

  const handleBackdropWheel = (e) => {
    const scroller = getScroller();
    if (!scroller) return;

    let deltaY = e.deltaY;
    let deltaX = e.deltaX;
    if (e.deltaMode === 1) {
      deltaY *= 24;
      deltaX *= 24;
    } else if (e.deltaMode === 2) {
      deltaY *= window.innerHeight;
      deltaX *= window.innerWidth;
    }

    accumulatedDeltaYRef.current += deltaY;
    accumulatedDeltaXRef.current += deltaX;

    if (!scrollAnimFrameRef.current) {
      scrollAnimFrameRef.current = requestAnimationFrame(() => {
        if (scroller) {
          scroller.scrollTop += accumulatedDeltaYRef.current;
          if (accumulatedDeltaXRef.current) {
            scroller.scrollLeft += accumulatedDeltaXRef.current;
          }
        }
        accumulatedDeltaYRef.current = 0;
        accumulatedDeltaXRef.current = 0;
        scrollAnimFrameRef.current = null;
      });
    }
  };

  const handleBackdropTouchStart = (e) => {
    if (e.touches && e.touches.length > 0) {
      touchStartYRef.current = e.touches[0].clientY;
      touchStartXRef.current = e.touches[0].clientX;
    }
  };

  const handleBackdropTouchMove = (e) => {
    if (e.touches && e.touches.length > 0) {
      const touchY = e.touches[0].clientY;
      const touchX = e.touches[0].clientX;
      const deltaY = touchStartYRef.current - touchY;
      const deltaX = touchStartXRef.current - touchX;
      touchStartYRef.current = touchY;
      touchStartXRef.current = touchX;

      const scroller = getScroller();
      if (!scroller) return;

      accumulatedDeltaYRef.current += deltaY;
      accumulatedDeltaXRef.current += deltaX;

      if (!scrollAnimFrameRef.current) {
        scrollAnimFrameRef.current = requestAnimationFrame(() => {
          if (scroller) {
            scroller.scrollTop += accumulatedDeltaYRef.current;
            if (accumulatedDeltaXRef.current) {
              scroller.scrollLeft += accumulatedDeltaXRef.current;
            }
          }
          accumulatedDeltaYRef.current = 0;
          accumulatedDeltaXRef.current = 0;
          scrollAnimFrameRef.current = null;
        });
      }
    }
  };

  return (
    <AdminNavigation>
      <div className="min-h-full relative bg-slate-50 font-sans text-gray-800 flex flex-col select-none">
        <div className="flex-1 w-full flex flex-col">
          <div className="relative flex-1 p-3 sm:p-6 sm:px-8 mx-auto max-w-[1400px] w-full min-w-0 flex flex-col gap-4 sm:gap-6">
          {/* Header Section */}
          <div className="relative z-10 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 pt-2 mb-8">
            {/* Left: Title */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="p-2.5 sm:p-3 md:p-3.5 bg-gradient-to-br from-[#000066] to-[#006600] shadow-md rounded-lg sm:rounded-xl md:rounded-2xl border border-[#006600]/20 flex-shrink-0"
              >
                {isStudyLeave ? (
                  <FiClock className="text-white h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6" />
                ) : (
                  <Bike className="text-white h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-6 lg:w-6" />
                )}
              </motion.div>
              <div className="flex flex-col justify-center">
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight"
                >
                  {pageCopy.title}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="text-slate-500 mt-0.5 sm:mt-1 text-[10px] sm:text-xs md:text-sm lg:text-base font-medium max-w-xl"
                >
                  {pageCopy.description}
                </motion.p>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.2 }}
              className="flex gap-3 flex-col sm:flex-row flex-wrap sm:justify-end sm:items-center w-full md:w-auto"
            >
              {!isStudyLeave && canManageLeave && (
                <button
                  onClick={handleTriggerApprovedShortLeaveEmail}
                  disabled={triggeringEmail}
                  className={`bg-white text-[#15803d] border border-[#15803d]/30 px-3 sm:px-4 md:px-5 h-9 sm:h-10 md:h-[42px] rounded-xl font-bold text-[10px] sm:text-xs md:text-sm shadow-sm hover:bg-green-50 transition-all flex items-center justify-center gap-1.5 sm:gap-2 w-full sm:w-auto ${
                    triggeringEmail ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  title="Manually send approved short leave email to gate staff"
                >
                  <FiSend className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4 md:h-4 ${triggeringEmail ? "animate-pulse" : ""}`} />
                  {triggeringEmail ? "Sending..." : "Send Gate Email"}
                </button>
              )}

              <div 
                className="relative bg-white shadow-sm border border-slate-200/80 px-3 sm:px-4 h-9 sm:h-10 md:h-[42px] rounded-xl flex items-center gap-1.5 w-full sm:w-auto min-w-[140px] sm:min-w-[180px] md:min-w-[200px] hover:border-slate-300 transition-colors cursor-pointer select-none"
                onClick={() => {
                  const el = document.getElementById("datePickerAdmin");
                  if (el) {
                    try {
                      el.showPicker();
                    } catch (err) {
                      el.focus();
                    }
                  }
                }}
              >
                <FiCalendar className="text-slate-400 w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 pointer-events-none" />
                <div className="flex-1 flex items-center min-w-0 pointer-events-none">
                  <span className={`text-[10px] sm:text-xs md:text-sm font-bold select-none truncate ${
                    selectedDate ? "text-slate-700" : "text-slate-400 font-medium"
                  }`}>
                    {selectedDate ? selectedDate.replace(/-/g, "/") : "yyyy/mm/dd"}
                  </span>
                </div>
                <input
                  id="datePickerAdmin"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  tabIndex={-1}
                  className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                  aria-label="Filter by date"
                />
                {selectedDate && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDate("");
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="ml-1 sm:ml-2 text-slate-400 hover:text-rose-500 transition-colors p-0.5 sm:p-1 flex-shrink-0 z-10"
                    title="Clear date filter"
                  >
                    <FiX className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                  </button>
                )}
              </div>

              {filter !== "Pending" && (
                <button
                  onClick={() => {
                    setFilter("Pending");
                    setPagination((prev) => ({ ...prev, page: 1 }));
                    setSelectedRequests(new Set());
                    setIsSelectAll(false);
                  }}
                  className="w-full sm:w-auto h-9 sm:h-10 md:h-[42px] px-3 sm:px-4 text-[10px] sm:text-xs md:text-sm font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-xl transition-all border border-amber-200 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <FiClock className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Switch to Pending
                </button>
              )}

              {canManageLeave && filter === "Pending" && displayedStats.pending > 0 && (
                <button
                  onClick={handleApproveAll}
                  disabled={processing}
                  className="w-full sm:w-auto h-9 sm:h-10 md:h-[42px] px-3 sm:px-4 md:px-5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 sm:gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-400 text-[10px] sm:text-xs md:text-sm"
                >
                  <FiCheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4 md:h-4" />
                  APPROVE ALL {displayedStats.pending}
                </button>
              )}
            </motion.div>
          </div>

          {/* Premium Stat Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-4"
          >
            {/* Pending Card */}
            <div 
              onClick={() => { setFilter("Pending"); setPagination((prev) => ({ ...prev, page: 1 })); setSelectedRequests(new Set()); setIsSelectAll(false); }}
              className={`rounded-2xl sm:rounded-3xl border p-2.5 sm:p-3 md:p-3 lg:p-4 flex items-center gap-2 sm:gap-2.5 lg:gap-3 relative overflow-hidden group transition-all duration-200 cursor-pointer ${
                filter === "Pending" 
                  ? "bg-gradient-to-br from-amber-50/90 via-amber-50 to-orange-50/90 border-2 border-amber-500 shadow-lg shadow-amber-500/15 ring-4 ring-amber-500/15 scale-[1.02] z-10" 
                  : "bg-white border-slate-200/80 shadow-xs hover:border-amber-400 hover:bg-slate-50/80 opacity-80 hover:opacity-100"
              }`}
            >
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-100/50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 shrink-0 rounded-lg sm:rounded-xl flex items-center justify-center border z-10 transition-all ${
                filter === "Pending" 
                  ? "bg-amber-500 text-white border-amber-500 shadow-sm" 
                  : "bg-amber-50 text-amber-500 border-amber-200/60 group-hover:bg-amber-100"
              }`}>
                <FiClock className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4 md:h-4 lg:w-5 lg:h-5" />
              </div>
              <div className="z-10 text-left min-w-0 flex-1">
                <div className={`text-lg sm:text-xl md:text-xl lg:text-2xl font-extrabold tracking-tight truncate ${
                  filter === "Pending" ? "text-amber-700" : "text-amber-600"
                }`}>
                  {displayedStats.pending}
                </div>
                <div className={`text-[9px] sm:text-[10px] md:text-[10px] lg:text-xs uppercase tracking-wider mt-0.5 leading-tight truncate ${
                  filter === "Pending" ? "font-black text-amber-800" : "font-bold text-amber-600/80"
                }`}>
                  Pending
                </div>
              </div>
            </div>

            {/* Approved Card */}
            <div 
              onClick={() => { setFilter("Approved"); setPagination((prev) => ({ ...prev, page: 1 })); setSelectedRequests(new Set()); setIsSelectAll(false); }}
              className={`rounded-2xl sm:rounded-3xl border p-2.5 sm:p-3 md:p-3 lg:p-4 flex items-center gap-2 sm:gap-2.5 lg:gap-3 relative overflow-hidden group transition-all duration-200 cursor-pointer ${
                filter === "Approved" 
                  ? "bg-gradient-to-br from-emerald-50/90 via-green-50 to-teal-50/90 border-2 border-emerald-600 shadow-lg shadow-emerald-500/15 ring-4 ring-emerald-500/15 scale-[1.02] z-10" 
                  : "bg-white border-slate-200/80 shadow-xs hover:border-emerald-400 hover:bg-slate-50/80 opacity-80 hover:opacity-100"
              }`}
            >
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-100/50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 shrink-0 rounded-lg sm:rounded-xl flex items-center justify-center border z-10 transition-all ${
                filter === "Approved" 
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" 
                  : "bg-green-50 text-emerald-600 border-green-200/60 group-hover:bg-green-100"
              }`}>
                <FiCheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4 md:h-4 lg:w-5 lg:h-5" />
              </div>
              <div className="z-10 text-left min-w-0 flex-1">
                <div className={`text-lg sm:text-xl md:text-xl lg:text-2xl font-extrabold tracking-tight truncate ${
                  filter === "Approved" ? "text-emerald-800" : "text-emerald-600"
                }`}>
                  {displayedStats.approved}
                </div>
                <div className={`text-[9px] sm:text-[10px] md:text-[10px] lg:text-xs uppercase tracking-wider mt-0.5 leading-tight truncate ${
                  filter === "Approved" ? "font-black text-emerald-800" : "font-bold text-emerald-600/80"
                }`}>
                  Approved
                </div>
              </div>
            </div>

            {/* Denied Card */}
            <div 
              onClick={() => { setFilter("Denied"); setPagination((prev) => ({ ...prev, page: 1 })); setSelectedRequests(new Set()); setIsSelectAll(false); }}
              className={`rounded-2xl sm:rounded-3xl border p-2.5 sm:p-3 md:p-3 lg:p-4 flex items-center gap-2 sm:gap-2.5 lg:gap-3 relative overflow-hidden group transition-all duration-200 cursor-pointer ${
                filter === "Denied" 
                  ? "bg-gradient-to-br from-rose-50/90 via-red-50 to-pink-50/90 border-2 border-rose-600 shadow-lg shadow-rose-500/15 ring-4 ring-rose-500/15 scale-[1.02] z-10" 
                  : "bg-white border-slate-200/80 shadow-xs hover:border-rose-400 hover:bg-slate-50/80 opacity-80 hover:opacity-100"
              }`}
            >
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-100/50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 shrink-0 rounded-lg sm:rounded-xl flex items-center justify-center border z-10 transition-all ${
                filter === "Denied" 
                  ? "bg-rose-600 text-white border-rose-600 shadow-sm" 
                  : "bg-rose-50 text-rose-600 border-rose-200/60 group-hover:bg-rose-100"
              }`}>
                <FiX className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4 md:h-4 lg:w-5 lg:h-5" />
              </div>
              <div className="z-10 text-left min-w-0 flex-1">
                <div className={`text-lg sm:text-xl md:text-xl lg:text-2xl font-extrabold tracking-tight truncate ${
                  filter === "Denied" ? "text-rose-800" : "text-rose-600"
                }`}>
                  {displayedStats.denied}
                </div>
                <div className={`text-[9px] sm:text-[10px] md:text-[10px] lg:text-xs uppercase tracking-wider mt-0.5 leading-tight truncate ${
                  filter === "Denied" ? "font-black text-rose-800" : "font-bold text-rose-600/80"
                }`}>
                  Denied
                </div>
              </div>
            </div>
            {/* Total Card */}
            <div 
              onClick={() => { setFilter("all"); setPagination((prev) => ({ ...prev, page: 1 })); setSelectedRequests(new Set()); setIsSelectAll(false); }}
              className={`rounded-2xl sm:rounded-3xl border p-3 sm:p-4 md:p-4 lg:p-5 flex items-center gap-2.5 sm:gap-3 lg:gap-4 relative overflow-hidden group transition-all duration-200 cursor-pointer ${
                filter === "all" 
                  ? "bg-gradient-to-br from-blue-50/90 via-sky-50 to-indigo-50/80 border-2 border-[#0056a2] shadow-lg shadow-[#0056a2]/15 ring-4 ring-[#0056a2]/15 scale-[1.02] z-10" 
                  : "bg-white border-slate-200/80 shadow-xs hover:border-[#0056a2]/40 hover:bg-slate-50/80 opacity-80 hover:opacity-100"
              }`}
            >
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-gray-50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
              <div className={`w-8 h-8 sm:w-10 sm:h-10 md:w-10 md:h-10 lg:w-12 lg:h-12 shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center border z-10 transition-all ${
                filter === "all" 
                  ? "bg-[#0056a2] text-white border-[#0056a2] shadow-sm" 
                  : "bg-slate-100 text-slate-500 border-slate-200 group-hover:bg-[#0056a2]/10 group-hover:text-[#0056a2]"
              }`}>
                <FiFileText className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 lg:w-6 lg:h-6" />
              </div>
              <div className="z-10 text-left min-w-0 flex-1">
                <div className={`text-xl sm:text-2xl md:text-2xl lg:text-3xl font-extrabold tracking-tight truncate ${
                  filter === "all" ? "text-[#0056a2]" : "text-gray-800"
                }`}>
                  {displayedStats.total}
                </div>
                <div className={`text-[10px] sm:text-[11px] md:text-xs lg:text-sm uppercase tracking-wider mt-0.5 leading-tight truncate ${
                  filter === "all" ? "font-black text-[#0056a2]" : "font-bold text-gray-500"
                }`}>
                  Total
                </div>
              </div>
            </div>

          </motion.div>

          {/* Bulk Actions Bar */}
          <AnimatePresence>
            {canManageLeave && (filter === "Pending" || filter === "Denied") && selectedRequests.size > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 bg-[#0056a2]/5 border border-[#0056a2]/20 rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col lg:flex-row items-center justify-between gap-3 sm:gap-4 overflow-hidden shadow-sm"
              >
                <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto justify-center lg:justify-start">
                  <div className="bg-[#0056a2] text-white w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center font-extrabold text-xs sm:text-sm shadow-md shadow-blue-500/20 shrink-0">
                    {selectedRequests.size}
                  </div>
                  <span className="text-[#0056a2] font-extrabold text-xs sm:text-sm">
                    Request{selectedRequests.size > 1 ? "s" : ""} Selected
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full lg:w-auto mt-2 lg:mt-0">
                  {filter === "Pending" ? (
                    <>
                      {/* Deny Selected on LEFT */}
                      <button
                        onClick={() => handleBulkAction("deny")}
                        disabled={processing}
                        className="flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-700 hover:to-red-600 text-white rounded-xl font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 w-full"
                      >
                        <FiX className="w-4 h-4 shrink-0" />
                        <span className="truncate">Deny <span className="hidden sm:inline">Selected</span></span>
                      </button>
                      {/* Approve Selected on RIGHT */}
                      <button
                        onClick={() => handleBulkAction("approve")}
                        disabled={processing}
                        className="flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-[#15803d] to-[#50b748] hover:from-[#136b33] hover:to-[#439e3c] text-white rounded-xl font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg shadow-green-500/20 transition-all disabled:opacity-50 w-full"
                      >
                        <FiCheckCircle className="w-4 h-4 shrink-0" />
                        <span className="truncate">Approve <span className="hidden sm:inline">Selected</span></span>
                      </button>
                    </>
                  ) : (
                    /* Restore Selected for Denied tab */
                    <button
                      onClick={() => handleBulkAction("restore")}
                      disabled={processing}
                      className="flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 w-full"
                    >
                      <FiRotateCcw className="w-4 h-4 shrink-0" />
                      <span className="truncate">Restore <span className="hidden sm:inline">Selected</span></span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedRequests(new Set());
                      setIsSelectAll(false);
                    }}
                    className="px-4 sm:px-5 py-2 sm:py-2.5 bg-gray-200/60 sm:bg-transparent text-gray-600 sm:text-gray-500 hover:bg-gray-200 sm:hover:bg-slate-200/50 hover:text-gray-800 rounded-xl font-bold text-xs sm:text-sm transition-colors text-center w-full sm:w-auto"
                  >
                    Clear <span className="hidden sm:inline">Selection</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search Bar */}
          <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.2 }}
              className="mb-4 select-none"
            >
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiSearch className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Intern ID, Name, or NIC..."
                  className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0056a2]/30 focus:border-[#0056a2]/50 shadow-sm transition-all select-text"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-rose-500 transition-colors"
                    title="Clear search"
                  >
                    <FiX size={16} />
                  </button>
                )}
              </div>
              {searchQuery.trim() && (
                <p className="mt-2 text-xs text-gray-500 font-medium pl-1">
                  {filteredRequests.length === 0
                    ? "No results found"
                    : `${filteredRequests.length} result${filteredRequests.length !== 1 ? "s" : ""} found`}
                </p>
              )}
            </motion.div>

          {/* Content Body */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0056a2]"></div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-3xl shadow-sm border border-dashed border-gray-300 p-8 sm:p-12 md:p-16 text-center"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <FiFileText className="h-8 w-8 sm:h-10 sm:w-10 text-slate-300" />
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-gray-700 mb-1.5 sm:mb-2">
                {pageCopy.empty}
              </h4>
              <p className="text-xs sm:text-sm text-gray-500">
                {selectedDate
                  ? `No requests found for ${formatSelectedDate()}.`
                  : "Try adjusting your filters."}
              </p>
              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
                {(selectedDate || filter !== "Pending") && (
                  <button
                    onClick={() => {
                      setSelectedDate("");
                      setFilter("Pending");
                    }}
                    className="w-full sm:w-auto px-4 sm:px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-xs sm:text-sm hover:bg-gray-50 shadow-sm"
                  >
                    Clear All Filters & Reset to Pending
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedDate(new Date().toISOString().split("T")[0]);
                    setFilter("Pending");
                  }}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2.5 bg-[#0056a2] text-white rounded-xl font-bold text-xs sm:text-sm hover:bg-[#00488a] shadow-sm shadow-blue-500/20"
                >
                  View Today's Pending
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Mobile Select All */}
              {canManageLeave && (filter === "Pending" || filter === "Denied") && filteredRequests.length > 0 && (
                <div className="xl:hidden flex items-center justify-between mb-4 bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
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
              <motion.div 
                className="bg-transparent xl:bg-white rounded-2xl shadow-none xl:shadow-sm border-none xl:border border-slate-200/80 overflow-hidden mb-6 z-10 relative"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                <div className="overflow-hidden xl:overflow-x-auto">
                  <table className="w-full text-left text-sm block xl:table border-collapse">
                    <thead className="hidden xl:table-header-group bg-slate-50/80">
                      <tr className="xl:table-row">
                        {canManageLeave && (filter === "Pending" || filter === "Denied") && (
                          <th className="px-2 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-3 md:py-3.5 text-center w-8 sm:w-12 border-b border-slate-200/80">
                            <button
                              onClick={handleSelectAll}
                              className="flex items-center justify-center transition-transform hover:scale-110"
                              title={
                                isSelectAll ? "Deselect all" : "Select all"
                              }
                            >
                              {isSelectAll ? (
                                <FiCheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-[#0056a2]" />
                              ) : (
                                <FiSquare className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300 hover:text-gray-400" />
                              )}
                            </button>
                          </th>
                        )}
                        <th className="px-2 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-3 font-bold text-slate-500 uppercase tracking-wider text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] text-left border-b border-slate-200/80 whitespace-nowrap">
                          Intern Details
                        </th>
                        <th className="px-2 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-3 font-bold text-slate-500 uppercase tracking-wider text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] text-center border-b border-slate-200/80 whitespace-nowrap">
                          {isStudyLeave
                            ? "Extended Leave Period"
                            : "Leave Date & Time"}
                        </th>
                        <th className="px-2 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-3 font-bold text-slate-500 uppercase tracking-wider text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] text-center border-b border-slate-200/80 whitespace-nowrap">
                          Purpose
                        </th>
                        <th className="px-2 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-3 font-bold text-slate-500 uppercase tracking-wider text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] text-center border-b border-slate-200/80 whitespace-nowrap">
                          Submitted
                        </th>
                        <th className="px-2 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-3 font-bold text-slate-500 uppercase tracking-wider text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] text-center border-b border-slate-200/80 whitespace-nowrap">
                          Status
                        </th>
                        <th className="px-2 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-3 font-bold text-slate-500 uppercase tracking-wider text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] text-center border-b border-slate-200/80 whitespace-nowrap">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="block xl:table-row-group bg-transparent xl:bg-white divide-y-0 xl:divide-y divide-slate-200/60 p-0 xl:p-0 space-y-4 xl:space-y-0">
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
                              className={`block xl:table-row transition-colors hover:bg-slate-50/50 relative bg-white rounded-2xl xl:rounded-none shadow-sm xl:shadow-none border border-slate-200/80 xl:border-none p-4 xl:p-0 ${
                                urgent && request.status === "Pending"
                                  ? "xl:bg-rose-50/30"
                                  : todayRequest
                                    ? "xl:bg-blue-50/30"
                                    : ""
                              }`}
                            >
                              <div className={`xl:hidden absolute inset-0 rounded-2xl opacity-10 pointer-events-none z-0 ${
                                urgent && request.status === "Pending" ? "bg-rose-500" : todayRequest ? "bg-blue-500" : "bg-transparent"
                              }`}></div>

                              {canManageLeave && (filter === "Pending" || filter === "Denied") && (
                                <td className="flex xl:table-cell items-center justify-between xl:justify-center px-0 md:px-4 lg:px-5 py-2.5 md:py-3 lg:py-4 border-b border-dashed border-slate-200/80 xl:border-solid xl:border-slate-50/50 z-10 relative">
                                  <span className="xl:hidden text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select</span>
                                  <div className="flex items-center justify-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedRequests.has(request._id)}
                                      onChange={() =>
                                        handleSelectRequest(request._id)
                                      }
                                      className="w-4 h-4 text-[#0056a2] border-gray-300 rounded focus:ring-[#0056a2] cursor-pointer"
                                      disabled={request.status !== filter}
                                    />
                                  </div>
                                </td>
                              )}

                              <td className="block xl:table-cell px-0 md:px-4 lg:px-5 py-2.5 md:py-3 lg:py-4 border-b border-dashed border-slate-200/80 xl:border-solid xl:border-slate-50/50 z-10 relative">
                                <div className="flex flex-col gap-1.5 sm:gap-2">
                                  <div className="flex items-start gap-1.5 sm:gap-2 flex-wrap">
                                    <div className="font-bold text-gray-900 text-sm md:text-sm">
                                      {highlightMatch(request.internName, searchQuery.trim())}
                                    </div>
                                    {urgent && request.status === "Pending" && (
                                      <span className="text-[9px] px-1.5 py-0.5 bg-rose-500 text-white rounded uppercase tracking-wider font-bold animate-pulse mt-0.5 whitespace-nowrap">
                                        Urgent
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (request.internTraineeId && navigator.clipboard) {
                                          navigator.clipboard.writeText(String(request.internTraineeId));
                                          toast.success("Copied Intern ID!");
                                        }
                                      }}
                                      className="text-[11px] sm:text-xs md:text-sm font-bold text-[#0056a2] bg-blue-50 hover:bg-blue-100 px-2 py-0.5 sm:py-1 rounded-md flex items-center gap-1 w-fit whitespace-nowrap cursor-pointer transition-colors border border-blue-100"
                                      title="Click to copy Intern ID"
                                    >
                                      <FiUser className="w-3.5 h-3.5 shrink-0" /> ID:{" "}
                                      {highlightMatch(request.internTraineeId?.toString() || "N/A", searchQuery.trim())}
                                    </div>
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (request.nationalId && navigator.clipboard) {
                                          navigator.clipboard.writeText(String(request.nationalId));
                                          toast.success("Copied NIC!");
                                        }
                                      }}
                                      className="text-[11px] sm:text-xs md:text-sm text-gray-700 hover:text-gray-900 font-semibold whitespace-nowrap cursor-pointer transition-colors bg-slate-50 hover:bg-slate-100 px-2 py-0.5 sm:py-1 rounded-md border border-slate-200"
                                      title="Click to copy NIC"
                                    >
                                      NIC: {highlightMatch(request.nationalId, searchQuery.trim())}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="flex xl:table-cell items-center justify-between xl:justify-center px-0 md:px-4 lg:px-5 py-2.5 md:py-3 lg:py-4 text-right xl:text-center border-b border-dashed border-slate-200/80 xl:border-solid xl:border-slate-50/50 z-10 relative">
                                <span className="xl:hidden text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date & Time</span>
                                <div className="flex flex-col gap-1 items-end xl:items-center">
                                  <div className="flex items-center gap-1.5 text-[11px] md:text-[13px] font-bold text-gray-800 flex-wrap justify-end xl:justify-center">
                                    <FiCalendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400 shrink-0" />
                                    <span className="whitespace-nowrap">{formatDate(request.leaveDate)}</span>
                                    {todayRequest && (
                                      <span className="text-[9px] px-1.5 py-0.5 bg-[#00b4eb] text-white rounded uppercase tracking-wider font-bold mt-0.5 whitespace-nowrap">
                                        Today
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-start justify-end xl:justify-center gap-2 text-[11px] md:text-[13px] font-medium text-gray-500 mt-0.5 whitespace-nowrap">
                                    <FiClock className="w-3 h-3 md:w-3.5 md:h-3.5 text-gray-400 shrink-0 mt-0.5" />
                                    <span>
                                      {isStudyLeave && request.studyEndDate
                                        ? `Until ${formatDate(request.studyEndDate)}`
                                        : request.leaveTime}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="flex xl:table-cell items-center justify-between xl:justify-center px-0 md:px-4 lg:px-5 py-2.5 md:py-3 lg:py-4 text-right xl:text-center border-b border-dashed border-slate-200/80 xl:border-solid xl:border-slate-50/50 z-10 relative">
                                <span className="xl:hidden text-[10px] font-bold text-slate-500 uppercase tracking-wider">Purpose</span>
                                <span
                                  className={`${getPurposeBadgeClass(
                                    request.purpose,
                                  )} whitespace-normal inline-block text-right xl:text-center leading-snug`}
                                >
                                  {request.purpose}
                                </span>
                              </td>

                              <td className="flex xl:table-cell items-center justify-between xl:justify-center px-0 md:px-4 lg:px-5 py-2.5 md:py-3 lg:py-4 text-[11px] md:text-[13px] font-medium text-gray-500 text-right xl:text-center whitespace-nowrap border-b border-dashed border-slate-200/80 xl:border-solid xl:border-slate-50/50 z-10 relative">
                                <span className="xl:hidden text-[10px] font-bold text-slate-500 uppercase tracking-wider">Submitted</span>
                                <span>{formatDate(request.submittedAt)}</span>
                              </td>

                              <td className="flex xl:table-cell items-center justify-between xl:justify-center px-0 md:px-4 lg:px-5 py-2.5 md:py-3 lg:py-4 text-right xl:text-center border-b border-dashed border-slate-200/80 xl:border-solid xl:border-slate-50/50 z-10 relative">
                                <span className="xl:hidden text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</span>
                                <span
                                  className={`${getStatusBadgeClass(
                                    request.status,
                                  )} inline-block whitespace-normal text-right xl:text-center`}
                                >
                                  {request.status}
                                </span>
                              </td>

                              <td className="block xl:table-cell px-0 md:px-4 lg:px-5 pt-4 pb-1 md:py-3 lg:py-4 text-center border-0 xl:border-b border-slate-50/50 z-10 relative">
                                <div className="flex flex-col md:flex-row xl:flex-col items-center justify-center md:justify-end xl:justify-center gap-2">
                                  {request.status === "Pending" && canManageLeave ? (
                                    <div className="flex flex-col md:flex-row xl:flex-col gap-2 w-full md:w-auto">
                                      <div className="grid grid-cols-2 md:flex xl:grid xl:grid-cols-2 gap-2 w-full md:w-auto">
                                        <button
                                          onClick={() =>
                                            handleQuickAction(
                                              request._id,
                                              "approve",
                                              request.internName,
                                            )
                                          }
                                          disabled={processing}
                                          className="p-2 md:px-3 md:py-2 xl:p-2 flex items-center justify-center gap-1.5 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-xl transition-all disabled:opacity-50 border border-green-200 hover:border-transparent"
                                          title="Quick Approve"
                                        >
                                          <FiCheck className="w-4 h-4" />
                                          <span className="hidden md:inline xl:hidden text-xs font-bold">Approve</span>
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleQuickAction(
                                              request._id,
                                              "deny",
                                              request.internName,
                                            )
                                          }
                                          disabled={processing}
                                          className="p-2 md:px-3 md:py-2 xl:p-2 flex items-center justify-center gap-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all disabled:opacity-50 border border-rose-200 hover:border-transparent"
                                          title="Quick Deny"
                                        >
                                          <FiX className="w-4 h-4" />
                                          <span className="hidden md:inline xl:hidden text-xs font-bold">Deny</span>
                                        </button>
                                      </div>
                                      <button
                                        onClick={() => openReviewModal(request)}
                                        className="px-3 py-2 w-full md:w-auto xl:w-full bg-white text-[#0056a2] hover:bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-sm"
                                        title="Review Details"
                                      >
                                        Review
                                      </button>
                                    </div>
                                  ) : request.status === "Denied" && canManageLeave ? (
                                    <div className="flex flex-col sm:flex-row xl:flex-col gap-2 w-full sm:w-auto items-stretch sm:items-center">
                                      <button
                                        onClick={() => openReviewModal(request)}
                                        className="px-3 py-2 w-full sm:w-auto bg-slate-50 text-gray-600 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm"
                                      >
                                        Details
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleQuickAction(
                                            request._id,
                                            "restore",
                                            request.internName,
                                          )
                                        }
                                        disabled={processing}
                                        className="px-3 py-2 w-full sm:w-auto flex items-center justify-center gap-1.5 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-200 hover:border-transparent rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                                        title="Restore to Pending"
                                      >
                                        <FiRotateCcw className="w-3 h-3" />
                                        Restore
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => openReviewModal(request)}
                                      className="px-3 py-2 w-full sm:w-auto md:w-auto xl:w-full bg-slate-50 text-gray-600 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm"
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

                {/* Pagination */}
                {pagination.total > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-slate-50/80 border-t border-slate-200/80">
                    <p className="text-xs sm:text-sm text-slate-500 font-medium">
                      Showing{" "}
                      <span className="font-bold text-slate-700">
                        {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)}
                      </span>{" "}
                      of <span className="font-bold text-slate-700">{pagination.total}</span>{" "}
                      requests
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPagination((prev) => ({ ...prev, page: 1 }))}
                        disabled={pagination.page === 1}
                        title="First"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none"
                      >
                        <FiChevronsLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                        disabled={pagination.page === 1}
                        title="Previous"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none"
                      >
                        <FiChevronLeft className="h-4 w-4" />
                      </button>
                      
                      {(() => {
                        const totalPages = pagination.totalPages || 1;
                        const page = pagination.page || 1;
                        const s = new Set([1, totalPages]);
                        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
                          s.add(i);
                        }
                        const pageNums = [...s].sort((a, b) => a - b);
                        
                        return pageNums.map((p, idx, arr) => (
                          <React.Fragment key={p}>
                            {arr[idx - 1] && p - arr[idx - 1] > 1 && (
                              <span className="px-1 text-slate-400 text-xs font-bold">…</span>
                            )}
                            <button
                              onClick={() => setPagination((prev) => ({ ...prev, page: p }))}
                              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all focus:outline-none ${
                                p === page
                                  ? "bg-gradient-to-r from-[#000066] to-[#006600] text-white shadow-md shadow-[#006600]/20"
                                  : "text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        ));
                      })()}

                      <button
                        onClick={() => setPagination((prev) => ({ ...prev, page: pagination.page + 1 }))}
                        disabled={pagination.page >= pagination.totalPages}
                        title="Next"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none"
                      >
                        <FiChevronRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setPagination((prev) => ({ ...prev, page: pagination.totalPages }))}
                        disabled={pagination.page >= pagination.totalPages}
                        title="Last"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none"
                      >
                        <FiChevronsRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </>
          )}
          </div>
        </div>

      {/* Review Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <React.Fragment>
            <motion.div
              className="fixed inset-0 z-[25] pointer-events-auto bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200 transform-gpu will-change-transform"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeReviewModal}
              onWheel={handleBackdropWheel}
              onTouchStart={handleBackdropTouchStart}
              onTouchMove={handleBackdropTouchMove}
            />
            <motion.div
              style={{ left: `${sidebarWidth}px` }}
              className="fixed top-[64px] bottom-[40px] right-0 z-[28] pointer-events-none flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200 max-w-2xl lg:max-w-3xl w-full h-[min(580px,calc(100vh-125px))] flex flex-col relative pointer-events-auto overflow-hidden my-auto"
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00b4eb] to-[#0056a2]"></div>

                {/* Modal Header */}
                <div className="shrink-0 flex items-center justify-between px-3.5 py-2.5 sm:px-5 sm:py-3.5 border-b border-gray-100 bg-slate-50/70">
                  <h2 className="text-xs sm:text-sm md:text-base font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2.5">
                    <div className="p-1 sm:p-1.5 bg-[#00b4eb]/10 rounded-lg">
                      <FiFileText className="text-[#0056a2] text-xs sm:text-sm" />
                    </div>
                    {pageCopy.details}
                  </h2>
                  <button
                    onClick={closeReviewModal}
                    className="text-gray-400 hover:text-gray-700 p-1 sm:p-1.5 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200 shadow-sm focus:outline-none"
                  >
                    <FiX className="text-sm sm:text-base" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-3 sm:p-4 md:p-5 space-y-2.5 sm:space-y-3.5 flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
                    {/* Intern Info Card */}
                    <div className="bg-slate-50 rounded-lg sm:rounded-xl p-2.5 sm:p-3.5 border border-slate-100 flex flex-col sm:flex-row gap-2 sm:gap-3 justify-between">
                      <div>
                        <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                          Intern Name
                        </span>
                        <span className="text-xs sm:text-sm md:text-base font-bold text-gray-900">
                          {selectedRequest.internName}
                        </span>
                      </div>
                      <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3">
                        <div>
                          <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                            Intern ID
                          </span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedRequest.internTraineeId && navigator.clipboard) {
                                navigator.clipboard.writeText(String(selectedRequest.internTraineeId));
                                toast.success("Copied Intern ID!");
                              }
                            }}
                            className="text-[10px] sm:text-xs md:text-[13px] font-bold text-[#0056a2] bg-blue-50 hover:bg-blue-100 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md border border-blue-200 inline-block cursor-pointer transition-colors shadow-xs"
                            title="Click to copy Intern ID"
                          >
                            {selectedRequest.internTraineeId || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                            NIC
                          </span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedRequest.nationalId && navigator.clipboard) {
                                navigator.clipboard.writeText(String(selectedRequest.nationalId));
                                toast.success("Copied NIC!");
                              }
                            }}
                            className="text-[10px] sm:text-xs md:text-[13px] font-bold text-gray-800 bg-white hover:bg-gray-100 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md border border-gray-200 inline-block cursor-pointer transition-colors shadow-xs"
                            title="Click to copy NIC"
                          >
                            {selectedRequest.nationalId}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Dates Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                      <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-gray-100 shadow-sm">
                        <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                          <FiCalendar className="text-[9px]" /> Leave Date
                        </span>
                        <span className="text-[11px] sm:text-xs font-bold text-gray-900">
                          {formatDate(selectedRequest.leaveDate)}
                        </span>
                      </div>
                      {isStudyLeave && selectedRequest.studyEndDate ? (
                        <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-gray-100 shadow-sm">
                          <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                            <FiCalendar className="text-[9px]" /> End Date
                          </span>
                          <span className="text-[11px] sm:text-xs font-bold text-gray-900">
                            {formatDate(selectedRequest.studyEndDate)}
                          </span>
                        </div>
                      ) : (
                        <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-gray-100 shadow-sm">
                          <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                            <FiClock className="text-[9px]" /> Leave Time
                          </span>
                          <span className="text-[11px] sm:text-xs font-bold text-gray-900">
                            {selectedRequest.leaveTime}
                          </span>
                        </div>
                      )}
                      <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-gray-100 shadow-sm">
                        <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                          Purpose
                        </span>
                        <span className={getPurposeBadgeClass(selectedRequest.purpose)}>
                          {selectedRequest.purpose}
                        </span>
                      </div>
                      <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-gray-100 shadow-sm">
                        <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                          Submitted At
                        </span>
                        <span className="text-[10px] sm:text-xs font-semibold text-gray-700">
                          {formatDateTime(selectedRequest.submittedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Reason */}
                    <div>
                      <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                        Reason
                      </span>
                      <div className="bg-white rounded-lg sm:rounded-xl p-2.5 sm:p-3 border border-gray-100 shadow-sm text-[11px] sm:text-xs text-gray-800 font-medium leading-relaxed">
                        {selectedRequest.reason}
                      </div>
                    </div>

                    {/* Proof Document */}
                    {selectedRequest.proofDocument?.filename && (
                      <div className="flex items-center justify-between bg-blue-50/70 rounded-lg sm:rounded-xl p-2.5 sm:p-3 border border-blue-100">
                        <div className="flex-1 min-w-0 mr-2 sm:mr-3">
                          <span className="text-[8px] sm:text-[9px] font-bold text-[#0056a2] uppercase tracking-wider block mb-0.5">
                            Proof Document
                          </span>
                          <span className="text-[10px] sm:text-[11px] font-medium text-gray-600 truncate block">
                            {selectedRequest.proofDocument.filename}
                          </span>
                        </div>
                        <button
                          onClick={() => handleViewDocument(selectedRequest._id)}
                          className="text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white text-[#0056a2] border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-1.5 shrink-0"
                        >
                          <FiEye className="text-xs" /> View
                        </button>
                      </div>
                    )}

                    {/* Current Status */}
                    <div className="flex items-center gap-2.5 sm:gap-3 py-1.5 border-t border-gray-100">
                      <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                        Current Status:
                      </span>
                      <span className={getStatusBadgeClass(selectedRequest.status)}>
                        {selectedRequest.status}
                      </span>
                    </div>

                    {/* Previous Review Info */}
                    {selectedRequest.reviewedBy && (
                      <div className="bg-slate-50 rounded-lg sm:rounded-xl p-2.5 sm:p-3 border border-slate-100 space-y-1.5 sm:space-y-2">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-[11px] sm:text-xs gap-0.5">
                          <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                            Reviewed By:
                          </span>
                          <span className="font-bold text-gray-800 break-all text-[11px] sm:text-xs">
                            {selectedRequest.reviewedBy?.email}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-[11px] sm:text-xs gap-0.5">
                          <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                            Reviewed At:
                          </span>
                          <span className="font-semibold text-gray-800 text-[11px] sm:text-xs">
                            {formatDateTime(selectedRequest.reviewedAt)}
                          </span>
                        </div>
                        {selectedRequest.adminResponse && (
                          <div className="pt-1.5 border-t border-slate-200">
                            <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                              Previous Admin Response
                            </span>
                            <p className="text-[11px] sm:text-xs text-gray-800 font-medium bg-white p-2 rounded-lg border border-gray-200">
                              {selectedRequest.adminResponse}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Admin Action Area */}
                    {selectedRequest.status === "Pending" && canManageLeave && (
                      <div className="pt-2.5 sm:pt-3 border-t border-gray-200">
                        <span className="text-[8px] sm:text-[9px] font-bold text-[#0056a2] uppercase tracking-wider block mb-1 flex items-center gap-1">
                          <FiFileText className="text-xs" /> Admin Response (Optional)
                        </span>
                        <textarea
                          value={adminResponse}
                          onChange={(e) => setAdminResponse(e.target.value)}
                          placeholder="Add a comment or reason for your decision..."
                          rows="3"
                          className="w-full px-2.5 sm:px-3 py-2 sm:py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent transition-all resize-none text-[11px] sm:text-xs font-medium text-gray-800 select-text min-h-[76px] sm:min-h-[88px]"
                        />
                        <div className="flex gap-2 pt-2 sm:pt-2.5">
                          <button
                            onClick={() =>
                              handleStatusUpdate(
                                selectedRequest._id,
                                "Approved",
                                adminResponse,
                              )
                            }
                            disabled={processing}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 px-3.5 h-9 sm:h-10 rounded-lg text-xs sm:text-sm font-bold text-white transition-all shadow-sm ${
                              processing
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-gradient-to-r from-[#15803d] to-[#50b748] hover:shadow-md hover:shadow-green-500/20 ring-1 ring-green-400/50"
                            }`}
                          >
                            <FiCheckCircle className="text-xs sm:text-sm" />{" "}
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
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 px-3.5 h-9 sm:h-10 rounded-lg text-xs sm:text-sm font-bold text-white transition-all shadow-sm ${
                              processing
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-gradient-to-r from-rose-600 to-red-500 hover:shadow-md hover:shadow-red-500/20 ring-1 ring-red-400/50"
                            }`}
                          >
                            <FiX className="text-xs sm:text-sm" />{" "}
                            {processing ? "Processing..." : "Deny"}
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedRequest.status === "Denied" && canManageLeave && (
                      <div className="pt-2.5 sm:pt-3 border-t border-gray-200">
                        <button
                          onClick={() =>
                            handleStatusUpdate(
                              selectedRequest._id,
                              "Pending",
                              adminResponse || selectedRequest.adminResponse,
                            )
                          }
                          disabled={processing}
                          className={`w-full flex items-center justify-center gap-1.5 py-2 sm:py-2.5 px-3.5 h-9 sm:h-10 rounded-lg text-xs sm:text-sm font-bold text-white transition-all shadow-sm ${
                            processing
                              ? "bg-gray-400 cursor-not-allowed"
                              : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 hover:shadow-md hover:shadow-amber-500/20 ring-1 ring-amber-400/50"
                          }`}
                        >
                          <FiRotateCcw className="text-xs sm:text-sm" />{" "}
                          {processing ? "Restoring..." : "Restore to Pending"}
                        </button>
                      </div>
                    )}
                  </div>
              </motion.div>
            </motion.div>
            </React.Fragment>
            )}
      </AnimatePresence>

      {/* Single Action Confirmation Modal */}
      <AnimatePresence>
        {actionModal.open && canManageLeave && (
          <React.Fragment>
            <motion.div
              className="fixed inset-0 z-[25] pointer-events-auto bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200 transform-gpu will-change-transform"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() =>
                !processing &&
                setActionModal({
                  open: false,
                  action: "",
                  requestId: null,
                  requestName: "",
                  adminResponse: "",
                })
              }
              onWheel={handleBackdropWheel}
              onTouchStart={handleBackdropTouchStart}
              onTouchMove={handleBackdropTouchMove}
            />
            <motion.div
              style={{ left: `${sidebarWidth}px` }}
              className="fixed top-[64px] bottom-[40px] right-0 z-[28] pointer-events-none flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-sm w-full flex flex-col relative overflow-hidden pointer-events-auto max-h-full my-auto"
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <div
                  className={`absolute top-0 left-0 w-full h-1 ${
                    actionModal.action === "approve"
                      ? "bg-green-500"
                      : actionModal.action === "deny"
                        ? "bg-rose-500"
                        : "bg-amber-500"
                  }`}
                ></div>

                <div className="shrink-0 px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-gray-100 bg-slate-50/70 flex justify-between items-center">
                  <h2 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                    {actionModal.action === "approve" ? (
                      <FiCheckCircle className="text-green-600 text-sm sm:text-base shrink-0" />
                    ) : actionModal.action === "deny" ? (
                      <FiX className="text-rose-600 text-sm sm:text-base shrink-0" />
                    ) : (
                      <FiRotateCcw className="text-amber-600 text-sm sm:text-base shrink-0" />
                    )}
                    <span>
                      {actionModal.action === "approve"
                        ? "Approve Leave Request"
                        : actionModal.action === "deny"
                          ? "Deny Leave Request"
                          : "Restore Leave Request"}
                    </span>
                  </h2>
                  <button
                    onClick={() =>
                      !processing &&
                      setActionModal({
                        open: false,
                        action: "",
                        requestId: null,
                        requestName: "",
                        adminResponse: "",
                      })
                    }
                    className="text-gray-400 hover:text-gray-700 p-1 sm:p-1.5 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200 shadow-sm focus:outline-none"
                    disabled={processing}
                  >
                    <FiX className="text-sm sm:text-base" />
                  </button>
                </div>

                <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3 flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
                    <div
                      className={`p-2.5 sm:p-3 rounded-lg sm:rounded-xl border ${
                        actionModal.action === "approve"
                          ? "bg-green-50 border-green-100 text-green-800"
                          : actionModal.action === "deny"
                            ? "bg-rose-50 border-rose-100 text-rose-800"
                            : "bg-amber-50 border-amber-100 text-amber-800"
                      }`}
                    >
                      <p className="text-[11px] sm:text-xs font-semibold leading-relaxed">
                        Are you sure you want to{" "}
                        <span className="underline">
                          {actionModal.action === "restore"
                            ? "restore to pending"
                            : actionModal.action}
                        </span>{" "}
                        the leave request
                        {actionModal.requestName ? (
                          <>
                            {" "}
                            for{" "}
                            <span className="font-bold">
                              {actionModal.requestName}
                            </span>
                          </>
                        ) : null}
                        ?
                      </p>
                    </div>

                    <div>
                      <span className="text-[8px] sm:text-[9px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                        Admin Response (Optional)
                      </span>
                      <textarea
                        value={actionModal.adminResponse}
                        onChange={(e) =>
                          setActionModal((prev) => ({
                            ...prev,
                            adminResponse: e.target.value,
                          }))
                        }
                        placeholder={`Add an optional comment or reason...`}
                        rows="2"
                        className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent transition-all resize-none text-[11px] sm:text-xs font-medium text-gray-800 select-text"
                        disabled={processing}
                      />
                    </div>

                    <div className="flex gap-2 pt-1 sm:pt-2">
                      <button
                        onClick={() =>
                          !processing &&
                          setActionModal({
                            open: false,
                            action: "",
                            requestId: null,
                            requestName: "",
                            adminResponse: "",
                          })
                        }
                        disabled={processing}
                        className="flex-1 px-3 py-1.5 sm:py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (actionModal.action === "approve") {
                            await handleStatusUpdate(
                              actionModal.requestId,
                              "Approved",
                              actionModal.adminResponse,
                            );
                          } else if (actionModal.action === "deny") {
                            await handleStatusUpdate(
                              actionModal.requestId,
                              "Denied",
                              actionModal.adminResponse,
                            );
                          } else if (actionModal.action === "restore") {
                            await handleStatusUpdate(
                              actionModal.requestId,
                              "Pending",
                              actionModal.adminResponse,
                            );
                          }
                          setActionModal({
                            open: false,
                            action: "",
                            requestId: null,
                            requestName: "",
                            adminResponse: "",
                          });
                        }}
                        disabled={processing}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-3 rounded-lg text-xs font-bold text-white transition-all shadow-sm ${
                          processing
                            ? "bg-gray-400 cursor-not-allowed"
                            : actionModal.action === "approve"
                              ? "bg-gradient-to-r from-[#15803d] to-[#50b748] hover:shadow-md hover:shadow-green-500/20"
                              : actionModal.action === "deny"
                                ? "bg-gradient-to-r from-rose-600 to-red-500 hover:shadow-md hover:shadow-red-500/20"
                                : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 hover:shadow-md hover:shadow-amber-500/20"
                        }`}
                      >
                        {processing
                          ? "Processing..."
                          : actionModal.action === "approve"
                            ? "Approve"
                            : actionModal.action === "deny"
                              ? "Deny"
                              : "Restore"}
                      </button>
                    </div>
                  </div>
              </motion.div>
            </motion.div>
            </React.Fragment>
            )}
      </AnimatePresence>

      {/* Bulk Action Modal */}
      <AnimatePresence>
        {isBulkModalOpen && canManageLeave && (
          <React.Fragment>
            <motion.div
              className="fixed inset-0 z-[25] pointer-events-auto bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200 transform-gpu will-change-transform"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !processing && setIsBulkModalOpen(false)}
              onWheel={handleBackdropWheel}
              onTouchStart={handleBackdropTouchStart}
              onTouchMove={handleBackdropTouchMove}
            />
            <motion.div
              style={{ left: `${sidebarWidth}px` }}
              className="fixed top-[64px] bottom-[40px] right-0 z-[28] pointer-events-none flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-sm w-full flex flex-col relative overflow-hidden pointer-events-auto max-h-full my-auto"
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <div
                  className={`absolute top-0 left-0 w-full h-1 ${
                    bulkAction === "approve"
                      ? "bg-green-500"
                      : bulkAction === "deny"
                        ? "bg-rose-500"
                        : "bg-amber-500"
                  }`}
                ></div>

                <div className="shrink-0 px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-gray-100 bg-slate-50/70 flex justify-between items-center">
                  <h2 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                    {bulkAction === "approve" ? (
                      <FiCheckCircle className="text-green-600 text-sm sm:text-base shrink-0" />
                    ) : bulkAction === "deny" ? (
                      <FiX className="text-rose-600 text-sm sm:text-base shrink-0" />
                    ) : (
                      <FiRotateCcw className="text-amber-600 text-sm sm:text-base shrink-0" />
                    )}
                    <span>
                      Bulk{" "}
                      {bulkAction === "approve"
                        ? "Approve"
                        : bulkAction === "deny"
                          ? "Deny"
                          : "Restore"}
                    </span>
                  </h2>
                  <button
                    onClick={() => !processing && setIsBulkModalOpen(false)}
                    className="text-gray-400 hover:text-gray-700 p-1 sm:p-1.5 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200 shadow-sm focus:outline-none"
                    disabled={processing}
                  >
                    <FiX className="text-sm sm:text-base" />
                  </button>
                </div>

                <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3 flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
                    <div
                      className={`p-2.5 sm:p-3 rounded-lg sm:rounded-xl border ${
                        bulkAction === "approve"
                          ? "bg-green-50 border-green-100"
                          : bulkAction === "deny"
                            ? "bg-rose-50 border-rose-100"
                            : "bg-amber-50 border-amber-100"
                      }`}
                    >
                      <p
                        className={`text-[11px] sm:text-xs font-semibold leading-relaxed ${
                          bulkAction === "approve"
                            ? "text-green-800"
                            : bulkAction === "deny"
                              ? "text-rose-800"
                              : "text-amber-800"
                        }`}
                      >
                        You are about to{" "}
                        {bulkAction === "approve"
                          ? "approve"
                          : bulkAction === "deny"
                            ? "deny"
                            : "restore"}{" "}
                        <span className="text-xs sm:text-sm font-bold">{selectedRequests.size}</span>{" "}
                        request(s)
                        {bulkAction === "restore" ? " back to pending" : ""}.
                      </p>
                    </div>

                    <div>
                      <span className="text-[8px] sm:text-[9px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                        Admin Response (Optional - applies to all)
                      </span>
                      <textarea
                        value={bulkAdminResponse}
                        onChange={(e) => setBulkAdminResponse(e.target.value)}
                        placeholder={`Add a comment for ${
                          bulkAction === "approve"
                            ? "approving"
                            : bulkAction === "deny"
                              ? "denying"
                              : "restoring"
                        } these requests...`}
                        rows="2"
                        className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent transition-all resize-none text-[11px] sm:text-xs font-medium select-text"
                        disabled={processing}
                      />
                    </div>

                    <div className="flex gap-2 pt-1 sm:pt-2">
                      <button
                        onClick={() => !processing && setIsBulkModalOpen(false)}
                        disabled={processing}
                        className="flex-1 px-3 py-1.5 sm:py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmBulkAction}
                        disabled={processing}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-3 rounded-lg text-xs font-bold text-white transition-all shadow-sm ${
                          processing
                            ? "bg-gray-400 cursor-not-allowed"
                            : bulkAction === "approve"
                              ? "bg-gradient-to-r from-[#15803d] to-[#50b748] hover:shadow-md hover:shadow-green-500/20"
                              : bulkAction === "deny"
                                ? "bg-gradient-to-r from-rose-600 to-red-500 hover:shadow-md hover:shadow-red-500/20"
                                : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 hover:shadow-md hover:shadow-amber-500/20"
                        }`}
                      >
                        {processing
                          ? "Processing..."
                          : `Confirm ${
                              bulkAction === "approve"
                                ? "Approve"
                                : bulkAction === "deny"
                                  ? "Deny"
                                  : "Restore"
                            }`}
                      </button>
                    </div>
                  </div>
              </motion.div>
            </motion.div>
            </React.Fragment>
            )}
      </AnimatePresence>

      {/* Document Viewer Modal */}
      <AnimatePresence>
        {documentViewer.show && (
          <React.Fragment>
            <motion.div
              className="fixed inset-0 z-[25] pointer-events-auto bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200 transform-gpu will-change-transform"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDocumentViewer}
              onWheel={handleBackdropWheel}
              onTouchStart={handleBackdropTouchStart}
              onTouchMove={handleBackdropTouchMove}
            />
            <motion.div
              style={{ left: `${sidebarWidth}px` }}
              className="fixed top-[64px] bottom-[40px] right-0 z-[28] pointer-events-none flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200 max-w-4xl lg:max-w-5xl w-full h-[min(580px,calc(100vh-125px))] flex flex-col overflow-hidden pointer-events-auto my-auto"
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00b4eb] to-[#0056a2]"></div>

                <div className="shrink-0 flex items-center justify-between px-3.5 py-2.5 sm:px-5 sm:py-3.5 border-b border-gray-100 bg-slate-50/70">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm md:text-base font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                      <FiFileText className="text-[#0056a2] text-xs sm:text-sm" /> Document Viewer
                    </h3>
                    {documentViewer.type && (
                      <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-[#0056a2] border border-blue-200">
                        {documentViewer.type}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={closeDocumentViewer}
                    className="text-gray-400 hover:text-gray-700 p-1 sm:p-1.5 rounded-lg bg-white hover:bg-gray-100 transition-colors border border-gray-200 shadow-sm focus:outline-none"
                  >
                    <FiX className="text-sm sm:text-base" />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 sm:p-4 bg-slate-100/50 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] flex flex-col">
                    {documentViewer.loading ? (
                      <div className="flex flex-col items-center justify-center h-full w-full bg-white rounded-lg sm:rounded-xl shadow-sm p-4 flex-1 min-h-0">
                        <div className="animate-spin rounded-full h-8 sm:h-10 w-8 sm:w-10 border-t-2 border-b-2 border-[#0056a2] mb-2 sm:mb-3"></div>
                        <p className="text-gray-500 text-xs sm:text-sm font-semibold animate-pulse">Opening Document...</p>
                      </div>
                    ) : documentViewer.type === "pdf" ? (
                      <iframe
                        src={documentViewer.url}
                        className="w-full h-full min-h-0 border-0 rounded-lg sm:rounded-xl bg-white shadow-sm flex-1"
                        title="Document Viewer"
                      />
                    ) : documentViewer.type === "image" ? (
                      <div className="flex items-center justify-center h-full w-full bg-white rounded-lg sm:rounded-xl shadow-sm p-2 sm:p-4 overflow-hidden flex-1 min-h-0">
                        <img
                          src={documentViewer.url}
                          alt="Document"
                          className="max-w-full max-h-full object-contain rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="text-center py-8 sm:py-16 bg-white rounded-lg sm:rounded-xl shadow-sm h-full w-full flex flex-col items-center justify-center px-4">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                          <FiFileText className="text-slate-300 text-xl sm:text-2xl" />
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 font-medium mb-3 sm:mb-4">
                          This file type cannot be previewed.
                        </p>
                        <a
                          href={documentViewer.url}
                          download
                          className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-[#0056a2] text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-shadow"
                        >
                          <FiFileText className="text-xs sm:text-sm" /> Download File
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex justify-end gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 border-t border-gray-100 bg-white">
                  <a
                    href={documentViewer.url}
                    download
                    className="px-3 sm:px-4 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm transition-colors"
                  >
                    Download
                  </a>
                  <button
                    onClick={closeDocumentViewer}
                    className="px-3 sm:px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-900 shadow-sm transition-colors"
                  >
                    Close Viewer
                  </button>
                </div>
              </motion.div>
            </motion.div>
            </React.Fragment>
            )}
      </AnimatePresence>
      </div>
    </AdminNavigation>
  );
};

export default AdminLeaveManagement;
