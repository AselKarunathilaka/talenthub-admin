import React, { useState, useEffect } from "react";
import { getMyLeaveRequests, deleteLeaveRequest } from "../api/leaveRequestApi";
import LeaveRequestForm from "../components/LeaveRequestForm";
import Navigation from "../components/Navigation";
import toast from "react-hot-toast";
import {
  FiFileText,
  FiCalendar,
  FiClock,
  FiUser,
  FiTrash2,
  FiPlus,
  FiX,
  FiEye,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const MyLeaveRequests = () => {
  const navigate = useNavigate();
  const [documentViewer, setDocumentViewer] = useState({
    show: false,
    url: "",
    type: "",
  });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    // Check if user is logged in
    const authToken = localStorage.getItem("authToken");
    const internId = localStorage.getItem("internId");

    if (!authToken) {
      toast.error("Please log in to view leave requests");
      navigate("/");
      return;
    }

    // If we have token but no internId, just continue (token contains the ID)
    if (!internId) {
      console.warn(
        "No internId in localStorage, but authToken exists. Continuing...",
      );
    }

    fetchLeaveRequests();
  }, [filter, pagination.page]);

  const fetchLeaveRequests = async () => {
    console.log("[MyLeaveRequests] Starting to fetch leave requests...");
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (filter !== "all") {
        params.status = filter;
      }

      console.log("[MyLeaveRequests] Calling API with params:", params);
      const response = await getMyLeaveRequests(params);
      console.log("[MyLeaveRequests] API response:", response);

      setLeaveRequests(response.data);
      setPagination(response.pagination);
    } catch (error) {
      console.error("[MyLeaveRequests] Error fetching leave requests:", error);
      console.error("[MyLeaveRequests] Error details:", {
        message: error.message,
        response: error.response,
        status: error.response?.status,
      });

      // Handle authentication errors
      if (error.message === "Invalid Token" || error.response?.status === 401) {
        toast.error("Your session has expired. Please log in again.");
        localStorage.removeItem("authToken");
        localStorage.removeItem("internId");
        navigate("/");
        return;
      }

      toast.error(error.message || "Failed to load leave requests");
    } finally {
      setLoading(false);
      console.log("[MyLeaveRequests] Fetch complete. Loading state:", false);
    }
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm("Are you sure you want to delete this leave request?")
    ) {
      return;
    }

    try {
      await deleteLeaveRequest(id);
      toast.success("Leave request deleted successfully");
      fetchLeaveRequests();
    } catch (error) {
      console.error("Error deleting leave request:", error);
      toast.error(error.message || "Failed to delete leave request");
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    fetchLeaveRequests();
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  console.log(
    "[MyLeaveRequests] Rendering component. Loading:",
    loading,
    "Requests:",
    leaveRequests.length,
    "ShowForm:",
    showForm,
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Navigation />
      <div className="flex-1 flex flex-col lg:mt-7 lg:px-10">
        <div className="h-16" />
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <FiFileText className="text-blue-600" />
                  My Short Leave Requests
                </h1>
                <p className="text-gray-600 mt-1">
                  View and manage your short leave permission requests
                </p>
              </div>
              <button
                onClick={() => setShowForm(!showForm)}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                  showForm
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg"
                }`}
              >
                {showForm ? (
                  <>
                    <FiX /> Cancel
                  </>
                ) : (
                  <>
                    <FiPlus /> New Short Leave Request
                  </>
                )}
              </button>
            </div>

            {/* Form Section */}
            {showForm && (
              <div className="mb-6">
                <LeaveRequestForm onSuccess={handleFormSuccess} />
              </div>
            )}

            {/* Filter Section */}
            <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex flex-wrap gap-2">
                {["all", "Pending", "Approved", "Denied"].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setFilter(status);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      filter === status
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {status === "all" ? "All Requests" : status}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : leaveRequests.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <FiFileText className="mx-auto text-gray-400 text-6xl mb-4" />
                <p className="text-gray-600 text-lg mb-4">
                  No short leave requests found
                </p>
                {!showForm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
                  >
                    Create Your First Request
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Requests List */}
                <div className="space-y-4">
                  {leaveRequests.map((request) => (
                    <div
                      key={request._id}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                    >
                      {/* Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 pb-4 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                          <FiCalendar className="text-blue-600 text-xl" />
                          <div>
                            <div className="text-lg font-semibold text-gray-900">
                              {formatDate(request.leaveDate)}
                            </div>
                            <div className="text-sm text-gray-600 flex items-center gap-1">
                              <FiClock className="text-gray-400" />
                              {request.leaveTime}
                            </div>
                          </div>
                        </div>
                        <span className={getStatusBadgeClass(request.status)}>
                          {request.status}
                        </span>
                      </div>

                      {/* Card Body */}
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <span className="text-sm font-medium text-gray-700 min-w-[100px]">
                            National ID:
                          </span>
                          <span className="text-sm text-gray-900">
                            {request.nationalId || "—"}
                          </span>
                        </div>

                        <div className="flex items-start gap-2">
                          <span className="text-sm font-medium text-gray-700 min-w-[100px]">
                            Purpose:
                          </span>
                          <span className="text-sm text-gray-900">
                            {request.purpose}
                          </span>
                        </div>

                        <div className="flex items-start gap-2">
                          <span className="text-sm font-medium text-gray-700 min-w-[100px]">
                            Reason:
                          </span>
                          <span className="text-sm text-gray-900">
                            {request.reason}
                          </span>
                        </div>

                        {request.proofDocument &&
                          request.proofDocument.data && (
                            <div className="flex items-start gap-2">
                              <span className="text-sm font-medium text-gray-700 min-w-[100px]">
                                Proof:
                              </span>
                              <button
                                onClick={() => handleViewDocument(request._id)}
                                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 underline bg-transparent border-none cursor-pointer"
                              >
                                <FiEye /> View Document
                              </button>
                            </div>
                          )}

                        {request.adminResponse && (
                          <div className="mt-4 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-600">
                            <span className="text-sm font-medium text-gray-700 block mb-1">
                              Admin Response:
                            </span>
                            <span className="text-sm text-gray-900">
                              {request.adminResponse}
                            </span>
                          </div>
                        )}

                        {request.reviewedAt && (
                          <div className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="font-medium">Reviewed:</span>
                            <span>{formatDate(request.reviewedAt)}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Footer */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                        <span className="text-xs text-gray-500">
                          Submitted: {formatDate(request.submittedAt)}
                        </span>
                        {request.status === "Pending" && (
                          <button
                            onClick={() => handleDelete(request._id)}
                            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <FiTrash2 /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-center gap-4">
                    <button
                      onClick={() =>
                        setPagination((prev) => ({
                          ...prev,
                          page: prev.page - 1,
                        }))
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
                        setPagination((prev) => ({
                          ...prev,
                          page: prev.page + 1,
                        }))
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
          </div>
        </main>
      </div>

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
  );
};

export default MyLeaveRequests;
