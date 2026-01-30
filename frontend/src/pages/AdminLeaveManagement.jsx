import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllLeaveRequests,
  updateLeaveRequestStatus,
  getLeaveRequestStats,
} from "../api/leaveRequestApi";
import { downloadApprovedLeaveReport } from "../api/adminApi";
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
} from "react-icons/fi";
import logo from "../assets/sltlogo.jpg";

const AdminLeaveManagement = () => {
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
  const [reportRange, setReportRange] = useState({
    startDate: "",
    endDate: "",
  });

  // New states for bulk operations
  const [selectedRequests, setSelectedRequests] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(""); // "approve" or "deny"
  const [bulkAdminResponse, setBulkAdminResponse] = useState("");
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isSelectAll, setIsSelectAll] = useState(false);

  useEffect(() => {
    // Check if admin is logged in
    const adminInfo = localStorage.getItem("adminInfo");

    if (!adminInfo) {
      toast.error("Please log in as admin to access this page");
      navigate("/admin-login");
      return;
    }

    fetchLeaveRequests();
    fetchStats();
  }, [filter, pagination.page]);

  const fetchLeaveRequests = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (filter !== "all") {
        params.status = filter;
      }

      const response = await getAllLeaveRequests(params);
      setLeaveRequests(response.data);
      setPagination(response.pagination);
      // Clear selections when data changes
      setSelectedRequests(new Set());
      setIsSelectAll(false);
    } catch (error) {
      console.error("Error fetching leave requests:", error);

      // If admin access is denied, redirect
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
      const response = await getLeaveRequestStats();
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleViewDocument = async (leaveRequestId) => {
    try {
      // Get auth token
      const authToken = localStorage.getItem("authToken");
      const adminInfo = localStorage.getItem("adminInfo");
      const token =
        authToken || (adminInfo ? JSON.parse(adminInfo).token : null);

      // Fetch document with authentication
      const response = await fetch(
        `http://localhost:5000/api/leave-requests/${leaveRequestId}/document`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load document");
      }

      // Get the blob and create object URL
      const blob = await response.blob();
      const fileUrl = URL.createObjectURL(blob);
      const contentType = response.headers.get("Content-Type");

      // Determine file type from content type
      const fileType = contentType?.includes("pdf")
        ? "pdf"
        : contentType?.includes("image")
          ? "image"
          : "other";

      setDocumentViewer({ show: true, url: fileUrl, type: fileType });
    } catch (error) {
      console.error("Error loading document:", error);
      toast.error("Failed to load document");
    }
  };

  const closeDocumentViewer = () => {
    // Revoke object URL to free memory
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
      const allIds = leaveRequests
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

      // Process each request individually
      const promises = requestsArray.map((requestId) =>
        updateLeaveRequestStatus(requestId, {
          status: bulkAction === "approve" ? "Approved" : "Denied",
          adminResponse: bulkAdminResponse.trim() || undefined,
        }),
      );

      await Promise.all(promises);

      toast.success(
        `Successfully ${bulkAction === "approve" ? "approved" : "denied"} ${selectedRequests.size} request(s)`,
        {
          id: toastId,
        },
      );

      // Reset and refresh
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
      const blob = await downloadApprovedLeaveReport({
        startDate: reportRange.startDate || undefined,
        endDate: reportRange.endDate || undefined,
      });

      const url = URL.createObjectURL(blob);
      const fileName = `approved-leaves-report${
        reportRange.startDate ? `-${reportRange.startDate}` : ""
      }${reportRange.endDate ? `-to-${reportRange.endDate}` : ""}.pdf`;
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header with Logo */}
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
              Short Leave Request Management
            </h1>
            <p className="text-gray-600 mt-1">
              Review and manage intern short leave requests
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-3xl font-bold text-gray-900">
              {stats.total}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total Requests</div>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow-sm border border-yellow-200 p-6">
            <div className="text-3xl font-bold text-yellow-800">
              {stats.pending}
            </div>
            <div className="text-sm text-yellow-600 mt-1">Pending</div>
          </div>
          <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-6">
            <div className="text-3xl font-bold text-green-800">
              {stats.approved}
            </div>
            <div className="text-sm text-green-600 mt-1">Approved</div>
          </div>
          <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-6">
            <div className="text-3xl font-bold text-red-800">
              {stats.denied}
            </div>
            <div className="text-sm text-red-600 mt-1">Denied</div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "Pending", count: stats.pending },
              { key: "Approved", count: stats.approved },
              { key: "Denied", count: stats.denied },
              { key: "all", count: stats.total, label: "All" },
            ].map(({ key, count, label }) => (
              <button
                key={key}
                onClick={() => {
                  setFilter(key);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                  setSelectedRequests(new Set());
                  setIsSelectAll(false);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filter === key
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {label || key} ({count})
              </button>
            ))}
          </div>
        </div>

        {/* Download Approved Leave Report */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="reportStartDate"
            >
              Start Date
            </label>
            <input
              id="reportStartDate"
              type="date"
              value={reportRange.startDate}
              onChange={(e) =>
                setReportRange((prev) => ({
                  ...prev,
                  startDate: e.target.value,
                }))
              }
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="reportEndDate"
            >
              End Date
            </label>
            <input
              id="reportEndDate"
              type="date"
              value={reportRange.endDate}
              onChange={(e) =>
                setReportRange((prev) => ({ ...prev, endDate: e.target.value }))
              }
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleDownloadApprovedReport}
            className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm hover:bg-indigo-700 transition-colors"
          >
            Download Approved Leaves PDF
          </button>
        </div>

        {/* Bulk Actions Bar - Only show for pending requests */}
        {filter === "Pending" && selectedRequests.size > 0 && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-blue-700 font-medium">
                  {selectedRequests.size} request(s) selected
                </span>
              </div>
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
        ) : leaveRequests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FiFileText className="mx-auto text-gray-400 text-6xl mb-4" />
            <p className="text-gray-600 text-lg">
              No short leave requests found
            </p>
          </div>
        ) : (
          <>
            {/* Requests Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {/* Add checkbox column header */}
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
                        Leave Date & Time
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
                    {leaveRequests.map((request) => (
                      <tr key={request._id} className="hover:bg-gray-50">
                        {/* Add checkbox for pending requests */}
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {request.internName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {request.nationalId}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 flex items-center gap-2">
                            <FiCalendar className="text-gray-400" />
                            {formatDate(request.leaveDate)}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                            <FiClock className="text-gray-400" />
                            {request.leaveTime}
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
                          <span className={getStatusBadgeClass(request.status)}>
                            {request.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => openReviewModal(request)}
                            className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
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
                  Short Leave Request Details
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
                      NIC
                    </label>
                    <p className="text-sm text-gray-900">
                      {selectedRequest.nationalId}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Leave Date
                    </label>
                    <p className="text-sm text-gray-900 flex items-center gap-2">
                      <FiCalendar className="text-gray-400" />
                      {formatDate(selectedRequest.leaveDate)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Leave Time
                    </label>
                    <p className="text-sm text-gray-900 flex items-center gap-2">
                      <FiClock className="text-gray-400" />
                      {selectedRequest.leaveTime}
                    </p>
                  </div>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                    {selectedRequest.reason}
                  </p>
                </div>

                {selectedRequest.proofDocument &&
                  selectedRequest.proofDocument.data && (
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
              {/* Modal Header */}
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

              {/* Modal Body */}
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
              {/* Modal Header */}
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

              {/* Modal Content */}
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

              {/* Modal Footer */}
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
