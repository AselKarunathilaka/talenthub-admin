import React, { useState, useEffect } from "react";
import { getMyLeaveRequests, deleteLeaveRequest } from "../api/leaveRequestApi";
import { API_BASE_URL } from "../api/apiConfig";
import LeaveRequestForm from "../components/LeaveRequestForm";
import Navigation from "../components/Navigation";
import SectionTip from "../components/SectionTip";
import toast from "react-hot-toast";
import {
  FiFileText,
  FiCalendar,
  FiClock,
  FiTrash2,
  FiPlus,
  FiX,
  FiEye,
  FiChevronDown,
  FiCheckCircle,
  FiList,
  FiInfo,
  FiShield
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bike, GraduationCap } from "lucide-react";

const MyLeaveRequests = ({ requestType = "short_leave" }) => {
  const isStudyLeave = requestType === "study_leave";
  const pageCopy = isStudyLeave
    ? {
        title: "My Extended Leave Requests",
        description: "View and manage your extended leave requests",
        newButton: "New Extended Leave Request",
        duplicate:
          "You already have an extended leave request for today. Only one request per day is allowed.",
        emptyTitle: "No extended leave requests found",
        emptyToday: "You haven't submitted any extended leave requests today.",
      }
    : {
        title: "My Short Leave Requests",
        description: "View and manage your short leave permission requests",
        newButton: "New Short Leave Request",
        duplicate:
          "You already have a short leave request for today. Only one request per day is allowed.",
        emptyTitle: "No short leave requests found",
        emptyToday: "You haven't submitted any short leave requests today.",
      };
  const navigate = useNavigate();
  const [documentViewer, setDocumentViewer] = useState({
    show: false,
    url: "",
    type: "",
  });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs: "list" | "new"
  const [activeTab, setActiveTab] = useState("new");
  
  // Accordion state
  const [expandedId, setExpandedId] = useState(null);

  // Date filter — defaults to today for short leave, empty (all) for study leave
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(isStudyLeave ? "" : todayStr);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    const authToken = localStorage.getItem("authToken");
    const internId = localStorage.getItem("internId");

    if (!authToken) {
      toast.error("Please log in to view leave requests");
      navigate("/");
      return;
    }

    if (!internId) {
      console.warn("No internId in localStorage, but authToken exists. Continuing...");
    }

    fetchLeaveRequests();
  }, [selectedDate, pagination.page, requestType]);

  const fetchLeaveRequests = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        date: selectedDate,
        requestType: requestType,
      };

      const response = await getMyLeaveRequests(params);
      setLeaveRequests(response.data);
      setPagination(response.pagination);
    } catch (error) {
      console.error("[MyLeaveRequests] Error fetching leave requests:", error);

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
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this leave request?")) {
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
    setActiveTab("list");
    setSelectedDate(isStudyLeave ? "" : todayStr);
    fetchLeaveRequests();
  };

  const handleViewDocument = async (leaveRequestId) => {
    try {
      const authToken = localStorage.getItem("authToken");
      const adminInfo = localStorage.getItem("adminInfo");
      const token = authToken || (adminInfo ? JSON.parse(adminInfo).token : null);

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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "All Dates";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const isToday = selectedDate === todayStr;

  const hasRequestForToday = () => {
    if (selectedDate !== todayStr) return false;
    return leaveRequests.some((request) => {
      const requestDate = new Date(request.leaveDate).toISOString().split("T")[0];
      return requestDate === todayStr;
    });
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-sans">
      <Navigation />
      <div className="flex-1 w-full lg:mt-20 lg:px-6 xl:px-10 pb-10">
        <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
          <SectionTip sectionKey={isStudyLeave ? "extendedleave" : "shortleave"} />
          {/* Header & Date Picker */}
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
              className="bg-white rounded-3xl shadow-sm border border-gray-100 p-2 sm:p-3 flex items-center gap-3 min-w-[280px]"
            >
              <div className="flex-1 bg-slate-50 rounded-2xl p-3 flex items-center gap-3 border border-slate-100">
                <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                  <FiCalendar className="text-[#00b4eb] h-5 w-5" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Filter Date</label>
                  <input 
                    type="date" 
                    value={selectedDate} 
                    max={isStudyLeave ? undefined : todayStr}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                      setActiveTab("list");
                    }} 
                    className="bg-transparent text-sm font-bold text-gray-800 w-full focus:outline-none cursor-pointer" 
                  />
                  {selectedDate && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDate("");
                        setPagination((prev) => ({ ...prev, page: 1 }));
                        setActiveTab("list");
                      }}
                      className="ml-2 text-gray-400 hover:text-rose-500 transition-colors p-1"
                      title="Clear date filter"
                    >
                      <FiX size={14} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Main Content Area */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[600px]">
            {/* Tab Switcher */}
            <div className="flex border-b border-gray-100 bg-slate-50/50 p-2 gap-2">
              <button 
                onClick={() => {
                  if (hasRequestForToday() && activeTab === "list") {
                     toast.error(pageCopy.duplicate);
                     return;
                  }
                  setActiveTab("new");
                }} 
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all duration-100 ${
                  activeTab === "new" 
                    ? "bg-gradient-to-r from-[#0056a2] to-[#00b4eb] text-white shadow-lg shadow-blue-500/30 ring-1 ring-blue-400/50" 
                    : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200/50"
                }`}
              >
                <FiPlus size={18} /> New Request
              </button>
              <button 
                onClick={() => setActiveTab("list")} 
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all duration-100 ${
                  activeTab === "list" 
                    ? "bg-gradient-to-r from-[#15803d] to-[#50b748] text-white shadow-lg shadow-green-500/30 ring-1 ring-green-400/50" 
                    : "bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 ring-1 ring-gray-200/50"
                }`}
              >
                <FiList size={18} /> My Requests
              </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 relative bg-slate-50/30 p-4 sm:p-6 overflow-hidden">
              <AnimatePresence mode="wait">
                {activeTab === "new" ? (
                  <motion.div
                    key="new-request"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LeaveRequestForm onSuccess={handleFormSuccess} requestType={requestType} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="list-requests"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4 max-w-4xl mx-auto"
                  >
                    {loading ? (
                      <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0056a2]"></div>
                      </div>
                    ) : leaveRequests.length === 0 ? (
                      <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FiFileText className="h-8 w-8 text-slate-300" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-700">{pageCopy.emptyTitle}</h4>
                        <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
                          {isToday 
                            ? pageCopy.emptyToday 
                            : selectedDate 
                              ? `No requests found for ${formatDisplayDate(selectedDate)}.`
                              : "No requests found."}
                        </p>
                        {isToday && (
                          <button 
                            onClick={() => setActiveTab("new")} 
                            className="mt-6 px-6 py-2.5 bg-[#0056a2] text-white font-bold rounded-xl shadow-md shadow-[#0056a2]/20 hover:bg-[#00488a] transition-all"
                          >
                            Create Request
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <h3 className="text-xl font-extrabold text-gray-800 tracking-tight mb-4 px-2">
                          {selectedDate ? `Requests for ${formatDisplayDate(selectedDate)}` : "All Requests"}
                        </h3>
                        {leaveRequests.map((request) => (
                          <motion.div
                            layout
                            key={request._id}
                            className={`bg-white rounded-2xl shadow-sm border transition-all duration-200 overflow-hidden ${
                              expandedId === request._id ? "border-[#00b4eb] shadow-md ring-1 ring-[#00b4eb]/20" : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            {/* Card Header / Summary */}
                            <div 
                              onClick={() => toggleExpand(request._id)}
                              className="p-5 flex items-center justify-between cursor-pointer group select-none"
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                  request.status === "Approved" ? "bg-green-50 text-[#50b748]" :
                                  request.status === "Denied" ? "bg-rose-50 text-rose-500" :
                                  "bg-blue-50 text-[#0056a2]"
                                }`}>
                                  {request.status === "Approved" ? <FiCheckCircle size={24} /> :
                                   request.status === "Denied" ? <FiX size={24} /> :
                                   <FiClock size={24} />}
                                </div>
                                <div>
                                  <h4 className="text-lg font-bold text-gray-900 leading-tight">
                                    {isStudyLeave
                                      ? `${formatDate(request.leaveDate)}${request.studyEndDate && request.studyEndDate !== request.leaveDate ? ` - ${formatDate(request.studyEndDate)}` : ""}`
                                      : request.leaveTime}
                                  </h4>
                                  <p className="text-sm font-medium text-gray-500 mt-0.5">
                                    {request.purpose} Purpose
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <div className="hidden sm:block">
                                  <span className={getStatusBadgeClass(request.status)}>
                                    {request.status}
                                  </span>
                                </div>
                                <div className={`p-2 rounded-full transition-transform duration-200 ${expandedId === request._id ? 'rotate-180 bg-slate-100 text-gray-800' : 'bg-slate-50 text-gray-400 group-hover:bg-slate-100'}`}>
                                  <FiChevronDown />
                                </div>
                              </div>
                            </div>

                            {/* Expanded Details */}
                            <AnimatePresence>
                              {expandedId === request._id && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="border-t border-gray-100 bg-slate-50/50"
                                >
                                  <div className="p-5 space-y-4">
                                    <div className="sm:hidden mb-2">
                                      <span className={getStatusBadgeClass(request.status)}>
                                        {request.status}
                                      </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                          <FiInfo className="text-gray-400" />
                                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reason</span>
                                        </div>
                                        <p className="text-sm text-gray-800 font-medium">{request.reason}</p>
                                      </div>

                                      <div className="space-y-3">
                                        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
                                          <span className="text-xs font-bold text-gray-500 uppercase">National ID</span>
                                          <span className="text-sm font-bold text-gray-900 bg-slate-100 px-2 py-0.5 rounded-md">{request.nationalId || "—"}</span>
                                        </div>
                                        
                                        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
                                          <span className="text-xs font-bold text-gray-500 uppercase">Submitted At</span>
                                          <span className="text-sm font-medium text-gray-600">{formatDate(request.submittedAt)}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {request.adminResponse && (
                                      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                                        <FiShield className="text-[#0056a2] mt-0.5" size={18} />
                                        <div>
                                          <span className="text-xs font-bold text-[#0056a2] uppercase tracking-wider block mb-1">Admin Response</span>
                                          <p className="text-sm text-gray-800 font-medium">{request.adminResponse}</p>
                                        </div>
                                      </div>
                                    )}

                                    {request.proofDocument && request.proofDocument.data && (
                                      <div className="flex items-center gap-2 pt-2">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleViewDocument(request._id); }}
                                          className="text-sm px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-bold flex items-center gap-2 rounded-xl transition-all shadow-sm"
                                        >
                                          <FiEye className="text-[#00b4eb]" /> View Proof Document
                                        </button>
                                      </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap items-center justify-end gap-3 pt-4 mt-2 border-t border-gray-200">
                                      {request.status === "Pending" && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleDelete(request._id); }}
                                          className="flex items-center gap-2 px-4 py-2.5 text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-xl transition-all font-bold text-sm shadow-sm"
                                        >
                                          <FiTrash2 /> Delete Request
                                        </button>
                                      )}
                                      
                                      {request.status === "Approved" && request.passToken && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); navigate(`/leave-pass/${request.passToken}`); }}
                                          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#15803d] to-[#50b748] hover:shadow-lg hover:shadow-green-500/30 text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                          <FiCheckCircle size={18} />
                                          View Leave Pass
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        ))}

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                          <div className="pt-6 pb-2 flex items-center justify-center gap-4">
                            <button
                              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                              disabled={pagination.page === 1}
                              className="px-4 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm"
                            >
                              Previous
                            </button>
                            <span className="text-sm font-bold text-gray-500 bg-white px-4 py-2 rounded-xl border border-gray-100">
                              Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <button
                              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                              disabled={pagination.page === pagination.totalPages}
                              className="px-4 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>

      {/* Document Viewer Modal */}
      <AnimatePresence>
        {documentViewer.show && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
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
                    <p className="text-gray-600 font-medium mb-6">This file type cannot be previewed in the browser.</p>
                    <a
                      href={documentViewer.url}
                      download
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#0056a2] text-white font-bold rounded-xl hover:bg-[#00488a] transition-all shadow-md shadow-blue-500/20"
                    >
                      <FiFileText /> Download File
                    </a>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100 bg-white">
                <a
                  href={documentViewer.url}
                  download
                  className="px-6 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Download
                </a>
                <button
                  onClick={closeDocumentViewer}
                  className="px-6 py-2.5 text-sm font-bold text-white bg-slate-800 rounded-xl hover:bg-slate-900 transition-colors shadow-sm"
                >
                  Close Viewer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyLeaveRequests;
