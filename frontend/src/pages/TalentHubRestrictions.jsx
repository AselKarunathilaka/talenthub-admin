/**
 * TalentHubRestrictions.jsx
 *
 * Admin page – view and manage interns restricted from TalentHub access
 * due to no project enrollment.
 *
 * Route: /admin/talenthub-restrictions
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import AdminNavigation from "../components/AdminNavigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  Shield,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  User,
  History,
  X,
  Building,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Swal from "sweetalert2";
import { API_BASE_URL } from "../api/apiConfig";
import toast from "react-hot-toast";

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* ── History Modal ───────────────────────────────────────────────────────── */
const HistoryModal = ({ intern, onClose }) => {
  if (!intern) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.97 }}
          transition={{ type: "spring", damping: 22, stiffness: 260 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-[#000066] to-[#0056a2] text-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <History className="w-4.5 h-4.5 text-[#00b4eb]" />
              </div>
              <div>
                <h3 className="text-base font-bold leading-tight">Restriction History</h3>
                <p className="text-[11px] text-blue-200 leading-tight">{intern.name} · {intern.traineeId}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Entries */}
          <div className="p-5 overflow-y-auto space-y-3 flex-1">
            {intern.restrictionHistory && intern.restrictionHistory.length > 0 ? (
              intern.restrictionHistory.map((item, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border p-4 text-sm space-y-2 ${
                    item.liftedAt
                      ? "bg-emerald-50 border-emerald-100"
                      : "bg-red-50 border-red-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        item.liftedAt
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : "bg-red-100 text-red-700 border-red-200"
                      }`}
                    >
                      {item.liftedAt ? "Lifted / Restored" : "Restricted"}
                    </span>
                    <span className="text-[11px] text-slate-400">{formatDateTime(item.restrictedAt)}</span>
                  </div>

                  <p className="text-slate-700 text-xs leading-relaxed">
                    <span className="font-semibold">Reason:</span> {item.restrictionReason}
                  </p>

                  {item.liftedAt && (
                    <div className="bg-white/70 rounded-xl p-3 text-[11px] space-y-1 text-slate-600 border border-slate-100">
                      <div><span className="font-semibold">Lifted:</span> {formatDateTime(item.liftedAt)}</div>
                      {item.liftedBy && <div><span className="font-semibold">By:</span> {item.liftedBy}</div>}
                      {item.liftReason && <div><span className="font-semibold">Details:</span> {item.liftReason}</div>}
                      {item.overrideExpiresAt && (
                        <div><span className="font-semibold">Override Expiry:</span> {formatDateTime(item.overrideExpiresAt)}</div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-slate-400 text-sm">
                <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No restriction history recorded.
              </div>
            )}
          </div>

          <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex-shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

/* ── Mobile Intern Card ───────────────────────────────────────────────────── */
const InternCard = ({ intern, onLift, onRestrict, onViewHistory }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
    >
      {/* Status stripe */}
      <div
        className={`h-1 w-full ${
          intern.talentHubRestricted
            ? "bg-gradient-to-r from-red-500 to-rose-600"
            : intern.talentHubOverride
            ? "bg-gradient-to-r from-amber-400 to-orange-500"
            : "bg-gradient-to-r from-emerald-400 to-green-500"
        }`}
      />

      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start gap-3">
          {/* Avatar */}
          {intern.googlePictureUrl ? (
            <img
              src={intern.googlePictureUrl}
              alt={intern.name}
              className="w-11 h-11 rounded-2xl object-cover border border-slate-200 flex-shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#000066] to-[#0056a2] text-white flex items-center justify-center font-bold text-base flex-shrink-0 shadow-sm">
              {intern.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-slate-900 text-sm truncate">{intern.name}</h4>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg flex-shrink-0">
                {intern.traineeId}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">{intern.email}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">{intern.specialization}</p>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center justify-between mt-3 gap-2">
          <div>
            {intern.talentHubRestricted ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                <Lock className="w-3 h-3" /> Restricted
              </span>
            ) : intern.talentHubOverride ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="w-3 h-3 animate-pulse" />
                Override · {intern.daysRemaining !== null ? `${intern.daysRemaining}d left` : "5d"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> Active
              </span>
            )}
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 cursor-pointer"
          >
            {expanded ? "Less" : "Details"}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Expanded details */}
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="mt-3 space-y-2 border-t border-slate-100 pt-3"
          >
            {(intern.talentHubRestrictionReason || intern.talentHubOverrideReason) && (
              <div className={`rounded-xl p-3 text-[11px] ${intern.talentHubRestricted ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                <p className="font-bold mb-0.5">Reason</p>
                <p>{intern.talentHubRestrictionReason || intern.talentHubOverrideReason}</p>
              </div>
            )}
            {intern.institute && (
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <Building className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{intern.institute}</span>
              </div>
            )}
            <div className="text-[11px] text-slate-400">
              {formatDate(intern.talentHubRestrictedAt || intern.talentHubOverrideAt)}
            </div>
          </motion.div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          {intern.talentHubRestricted && (
            <button
              onClick={() => onLift(intern)}
              className="flex-1 py-2 rounded-xl font-bold text-[11px] bg-gradient-to-r from-[#000066] to-[#0056a2] text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Unlock className="w-3.5 h-3.5" /> Lift Restriction
            </button>
          )}
          {intern.talentHubOverride && (
            <button
              onClick={() => onRestrict(intern)}
              className="flex-1 py-2 rounded-xl font-bold text-[11px] bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" /> Revoke
            </button>
          )}
          <button
            onClick={() => onViewHistory(intern)}
            className={`py-2 px-3 rounded-xl font-bold text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center gap-1.5 cursor-pointer ${!intern.talentHubRestricted && !intern.talentHubOverride ? "flex-1" : ""}`}
          >
            <History className="w-3.5 h-3.5" /> History
          </button>
        </div>
      </div>
    </motion.div>
  );
};

/* ══ Main Component ══════════════════════════════════════════════════════════ */
const TalentHubRestrictions = () => {
  const [interns, setInterns] = useState([]);
  const [stats, setStats] = useState({
    totalInterns: 0,
    restrictedCount: 0,
    overriddenCount: 0,
    enrolledCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState("restricted");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecialization, setSelectedSpecialization] = useState("All");
  const [selectedHistoryIntern, setSelectedHistoryIntern] = useState(null);

  const adminInfo = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("adminInfo") || "{}"); }
    catch { return {}; }
  }, []);

  const fetchRestrictions = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/talenthub-restrictions?filter=all&search=`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminInfo.token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      if (json.success) {
        setInterns(json.data || []);
        if (json.stats) setStats(json.stats);
      }
    } catch {
      toast.error("Failed to load restriction records");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [adminInfo.token]);

  useEffect(() => { fetchRestrictions(); }, [fetchRestrictions]);

  const handleLiveSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/talenthub-restrictions/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminInfo.token}` },
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Restrictions synchronized!");
        await fetchRestrictions(false);
      } else {
        toast.error(json.error || "Sync failed");
      }
    } catch { toast.error("Sync error"); }
    finally { setSyncing(false); }
  };

  const handleLiftRestriction = async (intern) => {
    const { value: formValues } = await Swal.fire({
      title: "Grant Temporary Access",
      html: `
        <div style="text-align:left;font-size:13px;color:#334155;line-height:1.6">
          <p style="margin-bottom:10px">Grant <strong>${intern.name}</strong> (${intern.traineeId}) temporary TalentHub access.</p>
          <div style="background:#fef3c7;border:1px solid #fcd34d;padding:10px 12px;border-radius:10px;margin-bottom:12px;font-size:12px;color:#92400e">
            ⏳ <strong>5-Day Grace Period:</strong> If the intern is still not enrolled in a project after 5 days, access will be automatically restricted again with a warning.
          </div>
          <label style="display:block;font-weight:600;margin-bottom:6px;font-size:12px">Reason for Override</label>
          <textarea id="swal-override-reason" class="swal2-textarea" placeholder="e.g. Granted grace period to finalize project allocation with supervisor." style="width:100%;margin:0;min-height:80px;font-size:13px;border-radius:10px"></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Grant 5-Day Access",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#0056a2",
      cancelButtonColor: "#64748b",
      focusConfirm: false,
      preConfirm: () => {
        const reason = document.getElementById("swal-override-reason").value;
        if (!reason?.trim()) {
          Swal.showValidationMessage("Please provide a reason");
          return false;
        }
        return { reason: reason.trim() };
      },
    });
    if (!formValues) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/talenthub-restrictions/${intern.id}/lift`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminInfo.token}` },
        body: JSON.stringify({ liftReason: formValues.reason, days: 5 }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`5-day access granted to ${intern.name}!`);
        await fetchRestrictions(false);
      } else {
        toast.error(json.error || "Failed to lift restriction");
      }
    } catch { toast.error("Error lifting restriction"); }
  };

  const handleReRestrict = async (intern) => {
    const result = await Swal.fire({
      title: "Revoke Override & Restrict?",
      text: `Restrict TalentHub access for ${intern.name}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Restrict",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/talenthub-restrictions/${intern.id}/restrict`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminInfo.token}` },
        body: JSON.stringify({ reason: "Admin manually restricted access / revoked override" }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Access restricted for ${intern.name}`);
        await fetchRestrictions(false);
      } else {
        toast.error(json.error || "Failed");
      }
    } catch { toast.error("Error restricting access"); }
  };

  const specializations = useMemo(() => {
    const set = new Set();
    interns.forEach((i) => { if (i.specialization && i.specialization !== "Not Specified") set.add(i.specialization); });
    return ["All", ...Array.from(set).sort()];
  }, [interns]);

  const filteredInterns = useMemo(() => {
    return interns.filter((intern) => {
      if (activeTab === "restricted" && !intern.talentHubRestricted) return false;
      if (activeTab === "overridden" && !intern.talentHubOverride) return false;
      if (selectedSpecialization !== "All" && intern.specialization !== selectedSpecialization) return false;
      if (searchTerm.trim()) {
        const t = searchTerm.toLowerCase().trim();
        return (
          intern.name.toLowerCase().includes(t) ||
          intern.traineeId.toLowerCase().includes(t) ||
          intern.email.toLowerCase().includes(t) ||
          intern.specialization.toLowerCase().includes(t) ||
          (intern.institute || "").toLowerCase().includes(t)
        );
      }
      return true;
    });
  }, [interns, activeTab, selectedSpecialization, searchTerm]);

  /* ── CSV Export ─────────────────────────────────────────────────────────── */
  const handleExportCSV = () => {
    if (!filteredInterns.length) { toast.error("No data to export"); return; }
    const headers = ["Trainee ID", "Name", "Email", "Specialization", "University", "Access Status", "Reason", "Override Active", "Days Remaining", "Date"];
    const rows = filteredInterns.map((i) => [
      `"${i.traineeId}"`,
      `"${i.name}"`,
      `"${i.email}"`,
      `"${i.specialization}"`,
      `"${i.institute || ""}"`,
      `"${i.talentHubRestricted ? "Restricted" : i.talentHubOverride ? "Override" : "Active"}"`,
      `"${i.talentHubRestrictionReason || i.talentHubOverrideReason || "N/A"}"`,
      `"${i.talentHubOverride ? "Yes" : "No"}"`,
      `"${i.daysRemaining !== null ? i.daysRemaining : "N/A"}"`,
      `"${formatDate(i.talentHubRestrictedAt || i.talentHubOverrideAt)}"`,
    ]);
    const csv = "data:text/csv;charset=utf-8," + encodeURIComponent([headers.join(","), ...rows.map((r) => r.join(","))].join("\n"));
    const a = document.createElement("a");
    a.href = csv;
    a.download = `TalentHub_Restrictions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("CSV exported!");
  };

  /* ── PDF Export ─────────────────────────────────────────────────────────── */
  const handleExportPDF = () => {
    if (!filteredInterns.length) { toast.error("No data to export"); return; }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();

    // Header bar — plain solid blue (original style)
    doc.setFillColor(0, 86, 162);  // #0056a2
    doc.rect(0, 0, pageW, 24, "F");
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("TalentHub Restrictions Report", 14, 15);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generated: ${new Date().toLocaleString()}  |  Filter: ${activeTab.toUpperCase()}  |  Records: ${filteredInterns.length}`,
      pageW - 14, 15, { align: "right" }
    );

    const tableData = filteredInterns.map((i) => [
      i.traineeId,
      i.name,
      i.email,
      i.specialization,
      i.talentHubRestricted ? "Restricted" : i.talentHubOverride ? `Override (${i.daysRemaining ?? 5}d left)` : "Active",
      i.talentHubRestrictionReason || i.talentHubOverrideReason || "—",
      formatDate(i.talentHubRestrictedAt || i.talentHubOverrideAt),
    ]);

    // Column widths — total must fit inside pageW minus margins (297 - 28 = 269mm usable)
    const colWidths = {
      0: 22,   // Trainee ID
      1: 54,   // Name        ← widened
      2: 54,   // Email
      3: 28,   // Specialization
      4: 24,   // Status
      5: 55,   // Reason
      6: 32,   // Date        ← widened
    };
    const totalColW = Object.values(colWidths).reduce((a, b) => a + b, 0); // 269mm
    const marginX = Math.max(10, (pageW - totalColW) / 2); // auto-centre

    autoTable(doc, {
      head: [["Trainee ID", "Name", "Email", "Specialization", "Status", "Reason", "Date"]],
      body: tableData,
      startY: 29,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
        valign: "middle",
        overflow: "linebreak",
        lineColor: [210, 218, 228],
        lineWidth: 0.3,
        font: "helvetica",
        textColor: [25, 35, 55],
      },
      headStyles: {
        fillColor: [0, 86, 162],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "center",
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      },
      columnStyles: {
        0: { halign: "center", cellWidth: colWidths[0] },
        1: { cellWidth: colWidths[1] },
        2: { cellWidth: colWidths[2] },
        3: { cellWidth: colWidths[3] },
        4: { halign: "center", cellWidth: colWidths[4] },
        5: { cellWidth: colWidths[5], overflow: "linebreak" },
        6: { halign: "center", cellWidth: colWidths[6] },
      },
      alternateRowStyles: { fillColor: [247, 250, 255] },
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          const val = String(data.cell.raw || "");
          let r = 30, g = 30, b = 30;
          if (val.includes("Restricted")) { r = 220; g = 38; b = 38; }
          else if (val.includes("Override")) { r = 217; g = 119; b = 6; }
          else { r = 5; g = 150; b = 105; }
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(r, g, b);
        }
      },
      margin: { left: marginX, right: marginX },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(150);
      doc.text(`TalentHub Restrictions · Page ${i} of ${pageCount}`, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
    }

    doc.save(`TalentHub_Restrictions_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF report downloaded!");
  };

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <AdminNavigation>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-3 sm:p-5 lg:p-7 space-y-4 sm:space-y-5">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Colored top accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#000066] via-[#0056a2] to-[#00b4eb]" />
          <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center shadow-md shadow-red-500/25 text-white flex-shrink-0">
                <ShieldAlert className="w-5.5 h-5.5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  TalentHub Restrictions
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-snug">
                  Manage intern TalentHub access based on project enrollment
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleLiveSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all cursor-pointer disabled:opacity-60 border border-slate-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-blue-600" : ""}`} />
                <span>{syncing ? "Syncing…" : "Sync"}</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>

              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-xs transition-all cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── KPI Cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-4 sm:p-5 flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-black text-slate-900">{stats.restrictedCount}</div>
              <div className="text-[10px] sm:text-xs font-bold text-red-500 uppercase tracking-wide leading-tight">Restricted</div>
              <div className="text-[10px] text-slate-400 leading-tight hidden sm:block">No project assigned</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4 sm:p-5 flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-black text-slate-900">{stats.overriddenCount}</div>
              <div className="text-[10px] sm:text-xs font-bold text-amber-600 uppercase tracking-wide leading-tight">Overrides</div>
              <div className="text-[10px] text-slate-400 leading-tight hidden sm:block">5-day admin override</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex items-center gap-3 col-span-2 lg:col-span-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xl sm:text-2xl font-black text-slate-900">{stats.totalInterns}</div>
              <div className="text-[10px] sm:text-xs font-bold text-blue-600 uppercase tracking-wide leading-tight">Total Checked</div>
              <div className="text-[10px] text-slate-400 leading-tight hidden sm:block">All active interns</div>
            </div>
          </div>
        </div>

        {/* ── Search + Filters ────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-5 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, ID, email, specialization…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer">
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>

          {/* Tabs + Specialization in one row */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {/* Status tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar flex-1">
              {[
                { id: "restricted", label: "Restricted", count: stats.restrictedCount, color: "red" },
                { id: "overridden", label: "Overrides", count: stats.overriddenCount, color: "amber" },
                { id: "all", label: "All", count: stats.totalInterns, color: "slate" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === tab.id
                      ? tab.color === "red"
                        ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                        : tab.color === "amber"
                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                        : "bg-slate-800 text-white shadow-md shadow-slate-800/15"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === tab.id ? "bg-white/25 text-white" : "bg-white text-slate-600 border border-slate-200"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Specialization filter */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedSpecialization}
                onChange={(e) => setSelectedSpecialization(e.target.value)}
                className="text-xs py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-700 cursor-pointer"
              >
                {specializations.map((s) => (
                  <option key={s} value={s}>{s === "All" ? "All Specializations" : s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-500">Evaluating project restrictions…</p>
          </div>
        ) : filteredInterns.length === 0 ? (
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm py-16 text-center space-y-2 px-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">
              {activeTab === "restricted"
                ? "No restricted interns!"
                : "No records match your filters."}
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              {activeTab === "restricted"
                ? "All active interns are currently enrolled in at least one project."
                : "Try adjusting your search or filter options."}
            </p>
          </div>
        ) : (
          <>
            {/* ── Mobile cards ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
              {filteredInterns.map((intern) => (
                <InternCard
                  key={intern.id}
                  intern={intern}
                  onLift={handleLiftRestriction}
                  onRestrict={handleReRestrict}
                  onViewHistory={setSelectedHistoryIntern}
                />
              ))}
            </div>

            {/* ── Desktop table ───────────────────────────────────────────── */}
            <div className="hidden lg:block bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ tableLayout: "fixed", borderCollapse: "separate", borderSpacing: 0 }}>
                  {/* Column widths */}
                  <colgroup>
                    <col style={{ width: "22%" }} />{/* Intern */}
                    <col style={{ width: "11%" }} />{/* Trainee ID */}
                    <col style={{ width: "15%" }} />{/* Specialization */}
                    <col style={{ width: "13%" }} />{/* Access Status */}
                    <col style={{ width: "18%" }} />{/* Reason */}
                    <col style={{ width: "11%" }} />{/* Date */}
                    <col style={{ width: "10%" }} />{/* Actions */}
                  </colgroup>

                  {/* ── Header ── */}
                  <thead>
                    <tr style={{ background: "linear-gradient(135deg, #000066 0%, #003d99 40%, #006600 100%)" }}>
                      {[
                        "Intern",
                        "Trainee ID",
                        "Specialization",
                        "Access Status",
                        "Restriction Reason",
                        "Date",
                        "Actions",
                      ].map((h, idx) => (
                        <th
                          key={idx}
                          className="py-4 px-4 text-center text-[11px] font-extrabold uppercase tracking-widest text-white/95 first:pl-6 last:pr-6"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                    {/* Matching gradient underline */}
                    <tr>
                      <td
                        colSpan={7}
                        className="h-[2px] p-0"
                        style={{ background: "linear-gradient(90deg, #000066, #003d99, #006600)" }}
                      />
                    </tr>
                  </thead>

                  {/* ── Body ── */}
                  <tbody>
                    {filteredInterns.map((intern, rowIdx) => (
                      <motion.tr
                        key={intern.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: rowIdx * 0.03 }}
                        className={`border-b border-slate-100 transition-colors hover:bg-blue-50/40 ${
                          rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                        }`}
                      >
                        {/* ── Intern ── */}
                        <td className="py-3.5 pl-6 pr-3">
                          <div className="flex items-center gap-3">
                            {intern.googlePictureUrl ? (
                              <img
                                src={intern.googlePictureUrl}
                                alt={intern.name}
                                className="w-9 h-9 rounded-xl object-cover border border-slate-200 flex-shrink-0 shadow-sm"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#000066] to-[#0056a2] text-white flex items-center justify-center font-black text-sm flex-shrink-0 shadow-sm">
                                {intern.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-[13px] truncate leading-snug">{intern.name}</div>
                              <div className="text-[11px] text-slate-400 truncate">{intern.email}</div>
                              {intern.institute && (
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Building className="w-2.5 h-2.5 flex-shrink-0" />
                                  <span className="truncate">{intern.institute}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* ── Trainee ID ── */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {intern.traineeId}
                          </span>
                        </td>

                        {/* ── Specialization ── */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="text-[12px] font-semibold text-slate-700 leading-snug">{intern.specialization}</span>
                        </td>

                        {/* ── Access Status ── */}
                        <td className="py-3.5 px-4 text-center">
                          {intern.talentHubRestricted ? (
                            <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
                              <Lock className="w-3 h-3" /> Restricted
                            </span>
                          ) : intern.talentHubOverride ? (
                            <span
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap"
                              title={`Expires: ${formatDateTime(intern.talentHubOverrideExpiresAt)}`}
                            >
                              <Clock className="w-3 h-3 animate-pulse" />
                              Override · {intern.daysRemaining !== null ? `${intern.daysRemaining}d` : "5d"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          )}
                        </td>

                        {/* ── Reason ── */}
                        <td className="py-3.5 px-4">
                          <p
                            className={`text-[12px] leading-relaxed break-words ${
                              intern.talentHubRestrictionReason
                                ? "font-semibold text-red-600"
                                : intern.talentHubOverrideReason
                                ? "text-amber-700 font-medium"
                                : "text-slate-400 italic"
                            }`}
                          >
                            {intern.talentHubRestrictionReason || intern.talentHubOverrideReason || "—"}
                          </p>
                        </td>

                        {/* ── Date ── */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="text-[11px] text-slate-500 whitespace-nowrap">
                            {formatDate(intern.talentHubRestrictedAt || intern.talentHubOverrideAt)}
                          </span>
                        </td>

                        {/* ── Actions ── */}
                        <td className="py-3.5 pr-5 pl-2">
                          <div className="flex items-center justify-center gap-1.5">
                            {intern.talentHubRestricted && (
                              <button
                                onClick={() => handleLiftRestriction(intern)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-[11px] bg-gradient-to-r from-[#000066] to-[#0056a2] hover:opacity-90 text-white shadow-sm transition-all cursor-pointer whitespace-nowrap"
                              >
                                <Unlock className="w-3 h-3" />
                                Lift
                              </button>
                            )}
                            {intern.talentHubOverride && (
                              <button
                                onClick={() => handleReRestrict(intern)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold text-[11px] bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-all cursor-pointer whitespace-nowrap"
                              >
                                <Lock className="w-3 h-3" />
                                Revoke
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedHistoryIntern(intern)}
                              title="View History"
                              className="p-1.5 rounded-xl bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-700 transition-colors cursor-pointer"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table footer */}
              <div className="px-6 py-3 bg-gradient-to-r from-slate-50 to-blue-50/40 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">
                  Showing <span className="font-bold text-slate-600">{filteredInterns.length}</span> of {stats.totalInterns} interns
                </span>
                <span className="text-[10px] text-slate-300 uppercase tracking-wider font-bold">{activeTab}</span>
              </div>
            </div>
          </>
        )}

        {/* Result count (mobile) */}
        {!loading && filteredInterns.length > 0 && (
          <p className="lg:hidden text-[11px] text-center text-slate-400 font-medium pb-2">
            Showing {filteredInterns.length} of {stats.totalInterns} intern{stats.totalInterns !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* History Modal */}
      {selectedHistoryIntern && (
        <HistoryModal
          intern={selectedHistoryIntern}
          onClose={() => setSelectedHistoryIntern(null)}
        />
      )}
    </AdminNavigation>
  );
};

export default TalentHubRestrictions;
