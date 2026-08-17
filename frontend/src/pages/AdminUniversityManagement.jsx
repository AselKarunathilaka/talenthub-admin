import React, { useState, useEffect, useCallback } from "react";
import AdminNavigation from "../components/AdminNavigation";
import {
  GraduationCap,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Mail,
  Phone,
  UserCheck,
  UserX,
  Trash2,
  Eye,
  Calendar,
  Send,
  X,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";
import { API_BASE_URL } from "../api/apiConfig";
import { getAdminSession } from "../utils/adminAuth";

const AdminUniversityManagement = () => {
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    revoked: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getAdminToken = () => {
    const session = getAdminSession();
    return session?.token || "";
  };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(
        `${API_BASE_URL}/university/admin/requests?${params.toString()}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      if (res.ok) {
        setRequests(data.requests || []);
        if (data.counts) setCounts(data.counts);
      } else {
        showToast(data.message || "Failed to load requests", "error");
      }
    } catch (err) {
      console.error("Error fetching university requests:", err);
      showToast("Error connecting to server", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Handle Approve Request
  const handleApprove = async (request) => {
    if (
      !window.confirm(
        `Are you sure you want to approve university access for ${request.supervisorName} (${request.universityName})?\nAn approval email will be sent automatically.`
      )
    ) {
      return;
    }

    setActionLoadingId(request._id);
    try {
      const token = getAdminToken();
      const res = await fetch(
        `${API_BASE_URL}/university/admin/requests/${request._id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      if (res.ok) {
        showToast(`✓ Access approved for ${request.supervisorName}. Email sent!`);
        fetchRequests();
      } else {
        showToast(data.message || "Failed to approve access", "error");
      }
    } catch (err) {
      showToast("Error processing approval", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Reject Modal
  const openRejectModal = (request) => {
    setSelectedRequest(request);
    setRejectionReason(
      "Your institutional credentials could not be verified with the official university roster."
    );
    setRejectModalOpen(true);
  };

  // Confirm Reject
  const handleConfirmReject = async () => {
    if (!selectedRequest) return;
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason.");
      return;
    }

    setActionLoadingId(selectedRequest._id);
    try {
      const token = getAdminToken();
      const res = await fetch(
        `${API_BASE_URL}/university/admin/requests/${selectedRequest._id}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
        }
      );

      const data = await res.json();
      if (res.ok) {
        showToast(
          `Request rejected for ${selectedRequest.supervisorName}. Rejection email sent with reason.`
        );
        setRejectModalOpen(false);
        fetchRequests();
      } else {
        showToast(data.message || "Failed to reject request", "error");
      }
    } catch (err) {
      showToast("Error processing rejection", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Revoke Access
  const handleRevoke = async (request) => {
    if (
      !window.confirm(
        `Are you sure you want to revoke university access for ${request.supervisorName}?`
      )
    ) {
      return;
    }

    setActionLoadingId(request._id);
    try {
      const token = getAdminToken();
      const res = await fetch(
        `${API_BASE_URL}/university/admin/requests/${request._id}/revoke`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      if (res.ok) {
        showToast(`Access revoked for ${request.supervisorName}.`);
        fetchRequests();
      } else {
        showToast(data.message || "Failed to revoke access", "error");
      }
    } catch (err) {
      showToast("Error revoking access", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Delete Record
  const handleDelete = async (request) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the record for ${request.supervisorName}? This action cannot be undone.`
      )
    ) {
      return;
    }

    setActionLoadingId(request._id);
    try {
      const token = getAdminToken();
      const res = await fetch(
        `${API_BASE_URL}/university/admin/requests/${request._id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      if (res.ok) {
        showToast("Record deleted successfully.");
        fetchRequests();
      } else {
        showToast(data.message || "Failed to delete record", "error");
      }
    } catch (err) {
      showToast("Error deleting record", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 animate-pulse">
            <Clock className="h-3.5 w-3.5" /> Pending Review
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">
            <XCircle className="h-3.5 w-3.5" /> Rejected
          </span>
        );
      case "revoked":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
            <AlertCircle className="h-3.5 w-3.5" /> Revoked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
            {status}
          </span>
        );
    }
  };

  return (
    <AdminNavigation>
      <div className="min-h-screen bg-gray-50 text-slate-800 p-4 sm:p-6 lg:p-8">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm font-semibold border backdrop-blur-lg ${
              toast.type === "error"
                ? "bg-rose-50 border-rose-300 text-rose-700"
                : "bg-emerald-50 border-emerald-300 text-emerald-700"
            }`}
          >
            {toast.type === "error" ? (
              <XCircle className="h-5 w-5 text-rose-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-[#50b748]/15 text-[#50b748] border border-[#50b748]/30 shadow-sm">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 flex items-center gap-2">
                  University Login Requests
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Review and authorize Sri Lankan university supervisor access &amp; monitor collaborations
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={fetchRequests}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-800 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* ─── KPI Metrics Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 mt-8">
          {/* Total */}
          <button
            onClick={() => setStatusFilter("all")}
            className={`p-4 rounded-2xl border text-left transition-all duration-200 shadow-sm cursor-pointer ${
              statusFilter === "all"
                ? "bg-blue-50 border-blue-400 ring-2 ring-blue-300/50 scale-[1.02]"
                : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Total Requests</span>
              <Building2 className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800">{counts.total}</div>
            <span className="text-[10px] text-slate-400">Registered Supervisors</span>
          </button>

          {/* Pending */}
          <button
            onClick={() => setStatusFilter("pending")}
            className={`p-4 rounded-2xl border text-left transition-all duration-200 shadow-sm cursor-pointer ${
              statusFilter === "pending"
                ? "bg-amber-50 border-amber-400 ring-2 ring-amber-300/50 scale-[1.02]"
                : "bg-white border-slate-200 hover:border-amber-300 hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-amber-600">Pending Approval</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600">{counts.pending}</div>
            <span className="text-[10px] text-amber-400">Requires Action</span>
          </button>

          {/* Approved */}
          <button
            onClick={() => setStatusFilter("approved")}
            className={`p-4 rounded-2xl border text-left transition-all duration-200 shadow-sm cursor-pointer ${
              statusFilter === "approved"
                ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300/50 scale-[1.02]"
                : "bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-emerald-600">Approved</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">{counts.approved}</div>
            <span className="text-[10px] text-emerald-400">Active Supervisors</span>
          </button>

          {/* Rejected / Revoked */}
          <button
            onClick={() => setStatusFilter("rejected")}
            className={`p-4 rounded-2xl border text-left transition-all duration-200 shadow-sm cursor-pointer ${
              statusFilter === "rejected"
                ? "bg-rose-50 border-rose-400 ring-2 ring-rose-300/50 scale-[1.02]"
                : "bg-white border-slate-200 hover:border-rose-300 hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-rose-600">Rejected / Revoked</span>
              <XCircle className="h-4 w-4 text-rose-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-600">{counts.rejected + counts.revoked}</div>
            <span className="text-[10px] text-rose-400">Access Denied</span>
          </button>
        </div>

        {/* ─── Search & Filters Bar ─── */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-200 shadow-sm mb-6">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
            {[
              { id: "all", label: "All", count: counts.total },
              { id: "pending", label: "Pending", count: counts.pending },
              { id: "approved", label: "Approved", count: counts.approved },
              { id: "rejected", label: "Rejected", count: counts.rejected },
              { id: "revoked", label: "Revoked", count: counts.revoked },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-slate-800 text-white shadow-md"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] md:min-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, university, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs focus:outline-none focus:border-blue-400 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* ─── Requests Table & List ─── */}
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500">Loading university supervisor requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-16 text-center">
              <GraduationCap className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No requests found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? "No supervisors match your search criteria."
                  : "There are currently no university supervisor requests in this category."}
              </p>
            </div>
          ) : (
            <>
              {/* ── Mobile Card List (hidden on md+) ── */}
              <div className="md:hidden divide-y divide-slate-100">
                {requests.map((req) => (
                  <div key={req._id} className="p-4 hover:bg-slate-50 transition-colors">
                    {/* Top row: avatar + name + status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 shrink-0 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-sm overflow-hidden border border-slate-300">
                          {req.picture ? (
                            <img src={req.picture} alt={req.supervisorName} className="w-full h-full object-cover" />
                          ) : (
                            (req.supervisorName || "U")[0].toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm leading-tight">{req.supervisorName}</div>
                          <div className="text-[11px] text-slate-500">{req.designation || "Supervisor / Coordinator"}</div>
                        </div>
                      </div>
                      <div className="shrink-0">{getStatusBadge(req.status)}</div>
                    </div>

                    {/* Info rows */}
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold">{req.universityName}</span>
                        {req.department && <span className="text-slate-400">· {req.department}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Mail className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">{req.email}</span>
                      </div>
                      {req.contactNumber && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Phone className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span>{req.contactNumber}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{req.requestedAt ? new Date(req.requestedAt).toLocaleDateString() : "N/A"}</span>
                        {req.lastLoginAt && (
                          <span className="text-emerald-600">· Last active: {new Date(req.lastLoginAt).toLocaleDateString()}</span>
                        )}
                      </div>
                      {req.rejectionReason && req.status === "rejected" && (
                        <div className="text-[10px] text-rose-500 truncate">
                          Reason: {req.rejectionReason}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {req.status === "pending" && (
                        <>
                          <button onClick={() => handleApprove(req)} disabled={actionLoadingId === req._id}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1">
                            <UserCheck className="h-3.5 w-3.5" /><span>Approve</span>
                          </button>
                          <button onClick={() => openRejectModal(req)} disabled={actionLoadingId === req._id}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1">
                            <UserX className="h-3.5 w-3.5" /><span>Reject</span>
                          </button>
                        </>
                      )}
                      {req.status === "approved" && (
                        <button onClick={() => handleRevoke(req)} disabled={actionLoadingId === req._id}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" /><span>Revoke</span>
                        </button>
                      )}
                      {(req.status === "rejected" || req.status === "revoked") && (
                        <button onClick={() => handleApprove(req)} disabled={actionLoadingId === req._id}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1">
                          <UserCheck className="h-3.5 w-3.5" /><span>Re-Approve</span>
                        </button>
                      )}
                      <button onClick={() => handleDelete(req)} disabled={actionLoadingId === req._id}
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 border border-slate-200 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Desktop Table (hidden on mobile) ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold text-center">Supervisor / Coordinator</th>
                      <th className="py-3.5 px-4 font-semibold text-center">University &amp; Faculty</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Contact Info</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Request Date</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {requests.map((req) => (
                      <tr key={req._id} className="hover:bg-slate-50 transition-colors group">
                        {/* Supervisor Name */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 shrink-0 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-sm overflow-hidden border border-slate-300">
                              {req.picture ? (
                                <img src={req.picture} alt={req.supervisorName} className="w-full h-full object-cover" />
                              ) : (
                                (req.supervisorName || "U")[0].toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 text-sm">{req.supervisorName}</div>
                              <div className="text-[11px] text-slate-500">{req.designation || "Supervisor / Coordinator"}</div>
                            </div>
                          </div>
                        </td>

                        {/* University & Department */}
                        <td className="py-4 px-4">
                          <div className="font-semibold text-slate-800">{req.universityName}</div>
                          <div className="text-[11px] text-slate-500">{req.department || "Faculty / Dept not specified"}</div>
                        </td>

                        {/* Contact Info */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Mail className="h-3.5 w-3.5 text-blue-500" />
                            <span>{req.email}</span>
                          </div>
                          {req.contactNumber && (
                            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-0.5">
                              <Phone className="h-3 w-3 text-emerald-500" />
                              <span>{req.contactNumber}</span>
                            </div>
                          )}
                        </td>

                        {/* Dates */}
                        <td className="py-4 px-4 text-slate-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <span>{req.requestedAt ? new Date(req.requestedAt).toLocaleDateString() : "N/A"}</span>
                          </div>
                          {req.lastLoginAt && (
                            <div className="text-[10px] text-emerald-600 mt-0.5">Last active: {new Date(req.lastLoginAt).toLocaleDateString()}</div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 text-center">
                          {getStatusBadge(req.status)}
                          {req.rejectionReason && req.status === "rejected" && (
                            <div className="text-[10px] text-rose-500 mt-1 max-w-[180px] truncate" title={req.rejectionReason}>Reason: {req.rejectionReason}</div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {req.status === "pending" && (
                              <>
                                <button onClick={() => handleApprove(req)} disabled={actionLoadingId === req._id}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 font-semibold text-xs transition-colors flex items-center gap-1"
                                  title="Approve supervisor and send welcome email">
                                  <UserCheck className="h-3.5 w-3.5" /><span>Approve</span>
                                </button>
                                <button onClick={() => openRejectModal(req)} disabled={actionLoadingId === req._id}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-semibold text-xs transition-colors flex items-center gap-1"
                                  title="Reject request with reason">
                                  <UserX className="h-3.5 w-3.5" /><span>Reject</span>
                                </button>
                              </>
                            )}
                            {req.status === "approved" && (
                              <button onClick={() => handleRevoke(req)} disabled={actionLoadingId === req._id}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 font-semibold text-xs transition-colors flex items-center gap-1"
                                title="Revoke access">
                                <ShieldCheck className="h-3.5 w-3.5" /><span>Revoke</span>
                              </button>
                            )}
                            {(req.status === "rejected" || req.status === "revoked") && (
                              <button onClick={() => handleApprove(req)} disabled={actionLoadingId === req._id}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 font-semibold text-xs transition-colors flex items-center gap-1"
                                title="Re-approve access">
                                <UserCheck className="h-3.5 w-3.5" /><span>Re-Approve</span>
                              </button>
                            )}
                            <button onClick={() => handleDelete(req)} disabled={actionLoadingId === req._id}
                              className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 border border-slate-200 transition-colors"
                              title="Delete record">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ─── Reject Modal with Reason Input ─── */}
        {rejectModalOpen && selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl text-slate-800">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-500 border border-rose-200">
                  <UserX className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Reject University Access
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedRequest.supervisorName} ({selectedRequest.universityName})
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-3">
                Please enter the reason for rejection. This reason will be automatically
                sent to <strong>{selectedRequest.email}</strong> via email.
              </p>

              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                rows={4}
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs focus:outline-none focus:border-rose-400 resize-none mb-4"
                required
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={actionLoadingId === selectedRequest._id}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send Rejection & Email</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminNavigation>
  );
};

export default AdminUniversityManagement;
