/**
 * TalentHubRestrictions.jsx
 *
 * Admin page – view and manage interns restricted from TalentHub access
 * due to no project enrollment.
 *
 * Route: /admin/talenthub-restrictions
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, X } from "lucide-react";
import {
  FaLock,
  FaLockOpen,
  FaTimes,
  FaSearch,
  FaExclamationTriangle,
  FaCheckCircle,
  FaSpinner,
  FaHistory,
  FaCalendarAlt,
  FaInfoCircle,
  FaDownload,
  FaEye,
  FaEyeSlash,
  FaEnvelope,
  FaBriefcase
} from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { API_BASE_URL } from "../api/apiConfig";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Config / helpers                                                           */
/* ─────────────────────────────────────────────────────────────────────────── */
const BRAND = {
  primary: "#0056a2",
  accent: "#00b4eb",
  danger: "#ef4444",
  success: "#50b748",
  warn: "#f59e0b",
};

const fmt = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  History Modal                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */
const HistoryModal = ({ intern, onClose }) => (
  <AnimatePresence>
    {intern && (
      <motion.div key="modal-wrapper-animate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[22] pointer-events-none">
      <div
        className="fixed inset-0 z-[49] pointer-events-auto"
        onClick={onClose}
      />
      <div className="fixed left-0 lg:left-[260px] right-0 bottom-0 top-[64px] z-[50] pointer-events-none flex flex-col items-center justify-center px-4 pt-6 pb-[80px] lg:pb-8">
        <motion.div
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 xl:p-6 w-full max-w-lg pointer-events-auto max-h-full overflow-y-auto no-scrollbar flex flex-col"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <FaHistory className="text-blue-600" />
              <h3 className="text-base xl:text-lg font-extrabold text-slate-800">Restriction History</h3>
            </div>
            <button className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors cursor-pointer" onClick={onClose}>
              <FaTimes />
            </button>
          </div>

          <p className="text-xs xl:text-sm font-semibold text-slate-700 mb-3 xl:mb-4">
            {intern.name} • {intern.traineeId}
          </p>

          <div className="space-y-4">
            {intern.restrictionHistory && intern.restrictionHistory.length > 0 ? (
              intern.restrictionHistory.map((h, i) => (
                <div key={i} className={`flex flex-col xl:flex-row gap-2 xl:gap-4 p-3 xl:p-4 rounded-lg xl:rounded-xl border ${h.liftedAt ? "bg-emerald-50/50 border-emerald-100" : "bg-rose-50/50 border-rose-100"}`}>
                  <div className="mt-0 xl:mt-1 flex justify-start xl:block">
                    {h.liftedAt ? (
                      <FaCheckCircle className="text-emerald-500 text-lg" />
                    ) : (
                      <FaLock className="text-rose-500 text-lg" />
                    )}
                  </div>
                  <div className="flex-1 text-xs xl:text-sm min-w-0">
                    <div className="flex flex-col xl:flex-row xl:justify-between mb-1 gap-1 xl:gap-0">
                      <span className="font-bold text-slate-700">Restricted</span>
                      <span className="text-slate-500">{fmt(h.restrictedAt)}</span>
                    </div>
                    <div className="text-slate-600 mb-3">{h.restrictionReason}</div>
                    
                    {h.liftedAt && (
                      <>
                        <div className="h-px bg-slate-200 my-3" />
                        <div className="flex flex-col xl:flex-row xl:justify-between mb-1 gap-1 xl:gap-0">
                          <span className="font-bold text-slate-700">Lifted</span>
                          <span className="text-slate-500">{fmt(h.liftedAt)}</span>
                        </div>
                        {h.liftedBy && (
                          <div className="flex flex-col xl:flex-row xl:justify-between mb-1 gap-1 xl:gap-0">
                            <span className="font-semibold text-slate-700">By</span>
                            <span className="text-slate-500">{h.liftedBy}</span>
                          </div>
                        )}
                        {h.liftReason && (
                          <div className="text-slate-600 italic mt-2">{h.liftReason}</div>
                        )}
                        {h.overrideExpiresAt && (
                          <div className="flex justify-between mt-2">
                            <span className="font-semibold text-slate-700">Expires</span>
                            <span className="text-slate-500">{fmt(h.overrideExpiresAt)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-500 py-4">No history found.</p>
            )}
          </div>
        </motion.div>
      </div>
          </motion.div>
    )}
  </AnimatePresence>
);

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Main Page Component                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */
const TalentHubRestrictions = () => {
  const navigate = useNavigate();
  const [interns, setInterns] = useState([]);
  const [stats, setStats] = useState({
    totalInterns: 0,
    restrictedCount: 0,
    overriddenCount: 0,
    enrolledCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("restricted");
  const [historyTarget, setHistoryTarget] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  // Confirm popup state (Re-Restrict / Lift)
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmType, setConfirmType] = useState(null); // 'lift' or 'revoke'
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmShowPw, setConfirmShowPw] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [securitySaving, setSecuritySaving] = useState(false);

  const adminInfo = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("adminInfo") || "{}"); }
    catch { return {}; }
  }, []);

  const showToast = (msg, type = "success") => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchRestrictions = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/talenthub-restrictions?filter=all&search=`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminInfo.token}`,
        },
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          navigate("/admin-login");
          return;
        }
        throw new Error("Failed to load restricted interns");
      }
      const json = await res.json();
      if (json.success) {
        setInterns(json.data || []);
        if (json.stats) setStats(json.stats);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [adminInfo.token, navigate]);

  useEffect(() => {
    fetchRestrictions();
  }, [fetchRestrictions]);

  const exportToPDF = () => {
    const doc = new jsPDF("landscape");
    doc.setFont("helvetica");
    doc.setFontSize(18);
    doc.setTextColor(0, 86, 162);
    doc.text("TalentHub Restrictions Report", 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    const tableColumn = ["Name", "Trainee ID", "Email", "Specialization", "Status", "Date", "Reason"];
    const tableRows = [];

    interns.forEach(intern => {
      let status = "Active";
      if (intern.talentHubRestricted) status = "Restricted";
      else if (intern.talentHubOverride) status = `Override`;

      const reason = intern.talentHubRestrictionReason || intern.talentHubOverrideReason || "";
      const date = fmtDate(intern.talentHubRestrictedAt || intern.talentHubOverrideAt);

      tableRows.push([
        intern.name || "-",
        intern.traineeId || "-",
        intern.email || "-",
        intern.specialization || "-",
        status,
        date,
        reason
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, halign: "center", valign: "middle" },
      headStyles: { fillColor: [0, 86, 162], textColor: 255, halign: "center", valign: "middle" },
      columnStyles: {
        0: { halign: "left", cellWidth: 35 },
        2: { halign: "left", cellWidth: 45 },
        6: { cellWidth: 50, halign: "left" }
      }
    });

    doc.save(`TalentHub_Restrictions_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const executeAction = async (target, type) => { try { const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}"); let endpoint = ""; let body = {}; let successMsg = ""; if (type === "lift") { endpoint = `/admin/talenthub-restrictions/${target.id || target._id}/lift`; body = { liftReason: "Admin granted temporary access" }; successMsg = `Temporary access granted for ${target.name}`; } else { endpoint = `/admin/talenthub-restrictions/${target.id || target._id}/restrict`; body = { reason: "Admin manually restricted access / revoked override" }; successMsg = `Access restricted for ${target.name}`; } const res = await fetch(`${API_BASE_URL}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminInfo.token}` }, body: JSON.stringify(body) }); const json = await res.json(); if (json.success) { showToast(successMsg); await fetchRestrictions(false); } else { showToast(json.error || "Failed", "error"); } } catch { showToast("Error processing request", "error"); } }; const handleConfirmClick = (intern, type) => { const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}"); if (adminInfo?.user?.requireSecurityCheck === false) { executeAction(intern, type); return; }
    setConfirmTarget(intern);
    setConfirmType(type);
    setConfirmPassword("");
    setConfirmShowPw(false);
    setConfirmError("");
  };

  const handleConfirmVerify = async () => {
    if (!confirmPassword) {
      setConfirmError("Please enter the security password");
      return;
    }
    setSecuritySaving(true);
    setConfirmError("");
    try {
      const internName = confirmTarget?.name || "";
      const internId = confirmTarget?.traineeId || "N/A";
      const action = confirmType === "lift" ? "talenthub restriction lift" : "talenthub restriction revoke";

      const response = await fetch(`${API_BASE_URL}/admin/attendance/verify-security`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminInfo.token}` },
        body: JSON.stringify({
          securityPin: confirmPassword,
          action,
          extraInfo: `Intern: ${internName} (ID: ${internId})`,
        }),
      });

      const data = await response.json();
      if (response.ok && (data.success || data.message)) {
        setConfirmError("");
        const target = confirmTarget;
        const type = confirmType;

        setConfirmTarget(null);
        setConfirmType(null);
        setConfirmPassword("");

        try {
          let endpoint = "";
          let body = {};
          let successMsg = "";

          if (type === "lift") {
            endpoint = `/admin/talenthub-restrictions/${target.id || target._id}/lift`;
            body = { liftReason: "Admin granted temporary access" };
            successMsg = `Temporary access granted for ${target.name}`;
          } else {
            endpoint = `/admin/talenthub-restrictions/${target.id || target._id}/restrict`;
            body = { reason: "Admin manually restricted access / revoked override" };
            successMsg = `Access restricted for ${target.name}`;
          }

          const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminInfo.token}` },
            body: JSON.stringify(body),
          });
          const json = await res.json();
          if (json.success) {
            showToast(successMsg);
            await fetchRestrictions(false);
          } else {
            showToast(json.error || "Failed", "error");
          }
        } catch {
          showToast("Error processing request", "error");
        }
      } else {
        setConfirmError(data.error || data.message || "Invalid security password");
      }
    } catch (err) {
      setConfirmError(err.message || "Invalid security password");
    } finally {
      setSecuritySaving(false);
    }
  };

  const filtered = interns.filter((i) => {
    if (activeTab === "restricted" && !i.talentHubRestricted) return false;
    if (activeTab === "overridden" && !i.talentHubOverride) return false;
    if (activeTab === "active" && (i.talentHubRestricted || i.talentHubOverride)) return false;
    
    const q = search.toLowerCase();
    return (
      !q ||
      i.name?.toLowerCase().includes(q) ||
      i.traineeId?.toLowerCase().includes(q) ||
      i.email?.toLowerCase().includes(q)
    );
  });

  return (
    <AdminNavigation>
      <div className="min-h-full relative font-sans text-slate-800 flex flex-col select-none">
        <main className="relative flex-1 p-3 sm:p-6 sm:px-8 mx-auto max-w-[1400px] w-full flex flex-col gap-5 sm:gap-6 min-w-0">
          <div className="relative z-20 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 pt-2">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="p-2.5 sm:p-3 md:p-3.5 bg-gradient-to-br from-[#000066] to-[#006600] shadow-md rounded-lg sm:rounded-xl md:rounded-2xl border border-[#006600]/20 flex-shrink-0"
              >
                <ShieldAlert className="text-white h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
              </motion.div>
              <div className="flex flex-col justify-center">
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight"
                >
                  TalentHub Restrictions
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="text-slate-500 mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base font-medium max-w-xl"
                >
                  Manage intern TalentHub access based on project enrollment. Automatically restricted every Sunday.
                </motion.p>
              </div>
            </div>
            <div className="flex gap-2 w-full xl:w-auto">
              <button
                onClick={exportToPDF}
                className="logres-btn logres-btn--primary w-full xl:w-auto justify-center"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <FaDownload /> Export PDF
              </button>
            </div>
          </div>

          <motion.div
            className="logres-stats-bar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
              <div 
                className="logres-stat" 
                style={{ cursor: "pointer" }}
                onClick={() => setActiveTab("restricted")}
              >
                <span className="logres-stat__value" style={{ color: activeTab === "restricted" ? BRAND.danger : "#9ca3af" }}>
                  {loading ? "—" : stats.restrictedCount}
                </span>
                <span className="logres-stat__label">Currently Restricted</span>
              </div>
              <div className="logres-stat logres-stat--divider" />
              <div 
                className="logres-stat"
                style={{ cursor: "pointer" }}
                onClick={() => setActiveTab("overridden")}
              >
                <span className="logres-stat__value" style={{ color: activeTab === "overridden" ? BRAND.warn : "#9ca3af" }}>
                  {loading ? "—" : stats.overriddenCount}
                </span>
                <span className="logres-stat__label">Active Overrides</span>
              </div>
              <div className="logres-stat logres-stat--divider" />
              <div 
                className="logres-stat"
                style={{ cursor: "pointer" }}
                onClick={() => setActiveTab("active")}
              >
                <span className="logres-stat__value" style={{ color: activeTab === "active" ? BRAND.success : "#9ca3af" }}>
                  {loading ? "—" : (stats.totalInterns - stats.restrictedCount - stats.overriddenCount)}
                </span>
                <span className="logres-stat__label">Active (Enrolled)</span>
              </div>
              <div className="logres-stat logres-stat--divider" />
              <div 
                className="logres-stat"
                style={{ cursor: "pointer" }}
                onClick={() => setActiveTab("all")}
              >
                <span className="logres-stat__value" style={{ color: activeTab === "all" ? BRAND.primary : "#9ca3af" }}>
                  {loading ? "—" : stats.totalInterns}
                </span>
                <span className="logres-stat__label">Total Interns</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="logres-info-banner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <FaInfoCircle style={{ flexShrink: 0, color: BRAND.primary, marginTop: 2 }} />
            <p>
              Interns below are restricted from TalentHub access if they are <strong>not enrolled in any project</strong>. This is automatically evaluated every Sunday. Use <strong>"Lift"</strong> to grant temporary access.
            </p>
          </motion.div>

          <motion.div
            className="logres-search-bar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <FaSearch className="logres-search-bar__icon" />
            <input
              type="text"
              placeholder="Search by name, trainee ID, or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="logres-search-bar__input"
              autoComplete="off"
            />
            {search && (
              <button className="logres-search-bar__clear" onClick={() => setSearch("")}>
                <FaTimes />
              </button>
            )}
          </motion.div>

          {loading ? (
            <div className="logres-loader">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="logres-loader__spinner"
              />
              <p>Loading restricted interns…</p>
            </div>
          ) : error ? (
            <div className="logres-error">
              <FaExclamationTriangle style={{ fontSize: 36, color: BRAND.danger }} />
              <p>{error}</p>
              <button className="logres-btn logres-btn--primary" onClick={() => fetchRestrictions(true)}>Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <motion.div className="logres-empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="logres-empty__icon">
                <FaCheckCircle style={{ color: BRAND.success, fontSize: 40 }} />
              </div>
              <h3>{interns.length === 0 ? "No Restricted Interns" : "No Results"}</h3>
              <p>
                {interns.length === 0
                  ? "All interns currently have full TalentHub access."
                  : "Try adjusting your search or filters."}
              </p>
            </motion.div>
          ) : (
            <motion.div className="logres-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>

              <div className="logres-table-wrapper">
                <table className="logres-table">
                  <thead>
                    <tr>
                      <th>Intern</th>
                      <th>Contact / Field</th>
                      <th>Status &amp; Date</th>
                      <th>Reason</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((intern, idx) => (
                      <motion.tr
                        key={intern.id}
                        className="logres-table__row"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                      >
                        <td>
                          <div className="logres-table__intern-cell">
                            <div className="logres-table__avatar" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
                              {intern.googlePictureUrl ? (
                                <img
                                  src={intern.googlePictureUrl}
                                  alt={intern.name}
                                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                                />
                              ) : (
                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "inherit", fontWeight: "inherit", color: "inherit" }}>
                                  {(intern.name || "?")[0].toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="logres-table__name">{intern.name}</div>
                              <div className="logres-table__sub">{intern.traineeId}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="logres-table__name">{intern.email || "—"}</div>
                          <div className="logres-table__sub">{intern.specialization || "—"}</div>
                        </td>
                        <td>
                          <div className="logres-table__name">
                            {intern.talentHubRestricted ? (
                              <span style={{ color: BRAND.danger }}>Restricted</span>
                            ) : intern.talentHubOverride ? (
                              <span style={{ color: BRAND.warn }}>Override</span>
                            ) : (
                              <span style={{ color: BRAND.success }}>Active</span>
                            )}
                          </div>
                          <div className="logres-table__sub">
                            {fmtDate(intern.talentHubRestrictedAt || intern.talentHubOverrideAt)}
                          </div>
                        </td>
                        <td>
                          <div className="logres-reason-cell" title={intern.talentHubRestrictionReason || intern.talentHubOverrideReason}>
                            {intern.talentHubRestrictionReason || intern.talentHubOverrideReason || "—"}
                          </div>
                        </td>
                        <td>
                          <div className="logres-action-btns">
                            {intern.talentHubRestricted && (
                              <button
                                className="logres-btn logres-btn--lift logres-btn--sm"
                                style={{ background: `linear-gradient(135deg, ${BRAND.warn}, #d97706)`, boxShadow: `0 4px 12px rgba(245, 158, 11, 0.2)` }}
                                onClick={() => handleConfirmClick(intern, 'lift')}
                                title={`Grant access to ${intern.name}`}
                              >
                                <FaLockOpen style={{ marginRight: 4 }} /> Lift
                              </button>
                            )}
                            {intern.talentHubOverride && (
                              <button
                                className="logres-btn logres-btn--lift logres-btn--sm"
                                style={{ background: `linear-gradient(135deg, ${BRAND.danger}, #b91c1c)`, boxShadow: `0 4px 12px rgba(239, 68, 68, 0.2)` }}
                                onClick={() => handleConfirmClick(intern, 'revoke')}
                                title={`Revoke access for ${intern.name}`}
                              >
                                <FaLock style={{ marginRight: 4 }} /> Revoke
                              </button>
                            )}
                            <button
                              className="logres-btn logres-btn--ghost logres-btn--sm"
                              onClick={() => setHistoryTarget(intern)}
                              title="History"
                            >
                              <FaHistory />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="logres-cards-mobile">
                {filtered.map((intern, idx) => (
                  <motion.div
                    key={intern.id}
                    className="logres-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <div className="logres-card__top">
                      <div className="logres-card__avatar" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
                        {intern.googlePictureUrl ? (
                          <img
                            src={intern.googlePictureUrl}
                            alt={intern.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                          />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "inherit", fontWeight: "inherit", color: "inherit" }}>
                            {(intern.name || "?")[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="logres-card__identity">
                        <span className="logres-card__name">{intern.name}</span>
                        <span className="logres-card__id">{intern.traineeId}</span>
                      </div>
                      <div className="logres-card__badge" style={intern.talentHubOverride ? { background: "#fffbeb", borderColor: "#fde68a", color: BRAND.warn } : !intern.talentHubRestricted ? { background: "#f0fdf4", borderColor: "#bbf7d0", color: BRAND.success } : {}}>
                        {intern.talentHubRestricted ? (
                          <><FaLock style={{ marginRight: 4, fontSize: 10 }} /> Restricted</>
                        ) : intern.talentHubOverride ? (
                          <><FaLockOpen style={{ marginRight: 4, fontSize: 10 }} /> Override</>
                        ) : (
                          <><FaCheckCircle style={{ marginRight: 4, fontSize: 10 }} /> Active</>
                        )}
                      </div>
                    </div>
                    <div className="logres-card__meta">
                      <div className="logres-card__meta-row">
                        <FaEnvelope className="logres-card__meta-icon" />
                        <span className="logres-card__meta-text">{intern.email || "—"}</span>
                      </div>
                      <div className="logres-card__meta-row">
                        <FaBriefcase className="logres-card__meta-icon" />
                        <span className="logres-card__meta-text">{intern.specialization || "—"}</span>
                      </div>
                      <div className="logres-card__meta-row">
                        <FaCalendarAlt className="logres-card__meta-icon" />
                        <span className="logres-card__meta-text">Updated: {fmtDate(intern.talentHubRestrictedAt || intern.talentHubOverrideAt)}</span>
                      </div>
                    </div>
                    {(intern.talentHubRestrictionReason || intern.talentHubOverrideReason) && (
                      <p className="logres-card__reason">{intern.talentHubRestrictionReason || intern.talentHubOverrideReason}</p>
                    )}
                    <div className="logres-card__actions">
                      {intern.talentHubRestricted && (
                        <button
                          className="logres-btn logres-btn--lift logres-btn--sm w-full xl:w-auto justify-center"
                          style={{ flex: 1, background: `linear-gradient(135deg, ${BRAND.warn}, #d97706)` }}
                          onClick={() => handleConfirmClick(intern, 'lift')}
                        >
                          <FaLockOpen style={{ marginRight: 4 }} /> Lift
                        </button>
                      )}
                      {intern.talentHubOverride && (
                        <button
                          className="logres-btn logres-btn--lift logres-btn--sm w-full xl:w-auto justify-center"
                          style={{ flex: 1, background: `linear-gradient(135deg, ${BRAND.danger}, #b91c1c)` }}
                          onClick={() => handleConfirmClick(intern, 'revoke')}
                        >
                          <FaLock style={{ marginRight: 4 }} /> Revoke
                        </button>
                      )}
                      <button
                        className="logres-btn logres-btn--ghost logres-btn--sm"
                        style={(!intern.talentHubRestricted && !intern.talentHubOverride) ? { flex: 1 } : {}}
                        onClick={() => setHistoryTarget(intern)}
                      >
                        <FaHistory />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </main>

        {/* ── Security Check Backdrop ── */}
        <AnimatePresence>
          {(confirmTarget || historyTarget) && (
            <motion.div
              key="talenthub-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[20] pointer-events-none bg-slate-900/60 backdrop-blur-sm"
            />
          )}
        </AnimatePresence>

        {/* ── Security Check Popup ── */}
        <AnimatePresence>
          {confirmTarget && (
            <motion.div key="modal-wrapper-animate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[22] pointer-events-none">
              <div
                className="fixed inset-0 z-[49] pointer-events-auto"
                onClick={() => { setConfirmTarget(null); setConfirmError(""); }}
              />
              <div className="fixed left-0 lg:left-[260px] right-0 bottom-0 top-[64px] z-[50] pointer-events-none flex flex-col items-center justify-center px-4 pt-6 pb-[80px] lg:pb-8">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ type: "spring", damping: 26, stiffness: 320 }}
                  onAnimationComplete={() => {
                    document.getElementById('talenthub-security-password-input')?.focus();
                  }}
                  className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-sm pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-start mb-3 xl:mb-4">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-800">Security Check</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {confirmType === 'lift' ? 'Enter password to lift restriction' : 'Enter password to restrict access'}
                      </p>
                    </div>
                    <button
                      onClick={() => { setConfirmTarget(null); setConfirmError(""); }}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Intern mini-card */}
                  <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
                    <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(135deg,#ef4444,#c0392b)", flexShrink: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 14 }}>
                      {confirmTarget.googlePictureUrl ? (
                        <img
                          src={confirmTarget.googlePictureUrl}
                          alt={confirmTarget.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span>{(confirmTarget.name || "?")[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{confirmTarget.name}</p>
                      <p className="text-xs text-slate-500 truncate">ID: {confirmTarget.traineeId}</p>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 11, fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>
                      <FaLock style={{ fontSize: 9 }} /> Restricted
                    </span>
                  </div>

                  <div className="mb-3 xl:mb-5 relative">
                    <input
                      id="talenthub-security-password-input"
                      type={confirmShowPw ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleConfirmVerify()}
                      placeholder="Enter password..."
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setConfirmShowPw(!confirmShowPw)}
                      className="absolute right-3 top-[10px] text-slate-400 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer"
                    >
                      {confirmShowPw ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                    </button>
                    {confirmError && (
                      <p className="text-xs font-semibold text-rose-500 mt-2">{confirmError}</p>
                    )}
                  </div>

                  <div className="flex flex-col-reverse xl:flex-row gap-2 xl:gap-3 mt-4">
                    <button
                      onClick={() => { setConfirmTarget(null); setConfirmError(""); }}
                      className="flex-1 px-4 py-2 xl:py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmVerify}
                      disabled={securitySaving || !confirmPassword}
                      className="flex-1 flex items-center justify-center px-4 py-2 xl:py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
                    >
                      {securitySaving ? <FaSpinner className="w-4 h-4 animate-spin" /> : "Verify"}
                    </button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modals */}
        <HistoryModal
          intern={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />

        {/* Toast */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              key={toastMsg.msg}
              className={`logres-toast logres-toast--${toastMsg.type}`}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
            >
              {toastMsg.type === "success" ? (
                <FaCheckCircle style={{ marginRight: 8 }} />
              ) : (
                <FaExclamationTriangle style={{ marginRight: 8 }} />
              )}
              {toastMsg.msg}
            </motion.div>
          )}
        </AnimatePresence>

        <style>{`
        /* ── Stats bar ── */
        .logres-stats-bar {
          display: flex; align-items: center; gap: 16px;
          padding: 14px 16px; background: white;
          border-radius: 14px; border: 1px solid #f0f0f0;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          margin-bottom: 16px; flex-wrap: wrap;
          justify-content: space-between;
        }
        @media (max-width: 480px) {
          .logres-stats-bar { flex-direction: column; align-items: stretch; gap: 10px; }
          .logres-stats-bar > div { justify-content: space-between; }
          .logres-stats-bar button { width: 100%; justify-content: center; }
        }
        .logres-stat { display: flex; flex-direction: column; gap: 2px; }
        .logres-stat__value { font-size: 26px; font-weight: 800; }
        .logres-stat__label { font-size: 12px; color: #6b7280; font-weight: 500; }
        .logres-stat--divider { width: 1px; height: 36px; background: #e5e7eb; flex-shrink: 0; }

        /* ── Info banner ── */
        .logres-info-banner {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 14px 18px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 12px; margin-bottom: 20px;
        }
        .logres-info-banner p { font-size: 13px; color: #1e40af; line-height: 1.6; margin: 0; }

        /* ── Search bar ── */
        .logres-search-bar {
          position: relative; margin-bottom: 20px;
        }
        .logres-search-bar__icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: #9ca3af; font-size: 14px;
        }
        .logres-search-bar__input {
          width: 100%; padding: 12px 40px 12px 40px;
          border: 1.5px solid #e0e0e0; border-radius: 12px;
          font-size: 14px; background: white; color: #1a1a2e;
          outline: none; transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .logres-search-bar__input:focus { border-color: #0056a2; }
        .logres-search-bar__clear {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #9ca3af; font-size: 14px; padding: 0;
        }

        /* ── Loader ── */
        .logres-loader {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 14px; padding: 60px 24px;
          background: white; border-radius: 16px;
        }
        .logres-loader__spinner {
          width: 36px; height: 36px; border-radius: 50%;
          border: 3px solid #e5e7eb; border-top-color: #0056a2;
        }
        .logres-loader p { color: #6b7280; font-size: 14px; font-weight: 500; }

        /* ── Error ── */
        .logres-error {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; padding: 48px; background: white; border-radius: 16px;
          text-align: center;
        }
        .logres-error p { color: #ef4444; font-weight: 500; }

        /* ── Empty ── */
        .logres-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; padding: 60px 24px; background: white;
          border-radius: 16px; text-align: center;
          border: 1px solid #f0f0f0;
        }
        .logres-empty__icon {
          width: 72px; height: 72px; border-radius: 50%;
          background: #f0fdf4; display: flex; align-items: center; justify-content: center;
        }
        .logres-empty h3 { font-size: 18px; font-weight: 700; color: #1a1a2e; margin: 0; }
        .logres-empty p { color: #6b7280; font-size: 14px; max-width: 400px; margin: 0; }

        /* ── Table ── */
        .logres-table-wrapper {
          display: none; background: white; border-radius: 16px;
          border: 1px solid #f0f0f0; overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }
        @media (min-width: 1025px) { .logres-table-wrapper { display: block; } }
        .logres-table { width: 100%; border-collapse: collapse; }
        .logres-table thead tr {
          background: #fafafa; border-bottom: 1px solid #f0f0f0;
        }
        .logres-table th {
          padding: 14px 16px; text-align: left;
          font-size: 12px; font-weight: 700; color: #6b7280;
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .logres-table__row {
          border-bottom: 1px solid #f9f9f9; cursor: default;
          transition: background 0.15s;
        }
        .logres-table__row:hover { background: #fafafa; }
        .logres-table td { padding: 14px 16px; vertical-align: middle; }
        .logres-table__intern-cell { display: flex; align-items: center; gap: 10px; }
        .logres-table__avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, #ef4444, #c0392b);
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 14px; font-weight: 700; flex-shrink: 0;
        }
        .logres-table__name { font-size: 14px; font-weight: 600; color: #1a1a2e; }
        .logres-table__sub { font-size: 12px; color: #9ca3af; margin-top: 2px; }
        .logres-reason-cell {
          font-size: 12px; color: #6b7280; max-width: 220px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .logres-action-btns { display: flex; gap: 8px; flex-wrap: wrap; }

        /* ── Mobile cards ── */
        .logres-cards-mobile { display: flex; flex-direction: column; gap: 12px; }
        .logres-card__meta {
          display: flex; flex-direction: column; gap: 6px;
          margin-bottom: 12px;
        }
        .logres-card__meta-row {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; color: #4b5563; min-width: 0;
        }
        .logres-card__meta-icon {
          flex-shrink: 0; font-size: 11px; color: #9ca3af; width: 14px;
        }
        .logres-card__meta-text {
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          min-width: 0; flex: 1;
        }
        .logres-card__reason {
          font-size: 12px; color: #6b7280; background: #fafafa;
          padding: 8px 10px; border-radius: 8px; margin-bottom: 12px;
          border: 1px solid #f0f0f0; word-break: break-word;
          line-height: 1.5;
        }
        .logres-card__actions { display: flex; gap: 8px; }
        @media (max-width: 480px) {
          .logres-card__actions { flex-direction: column; }
          .logres-card__actions .logres-btn { width: 100% !important; justify-content: center; }
        }
        @media (min-width: 1025px) { .logres-cards-mobile { display: none; } }
        .logres-card {
          background: white; border-radius: 16px;
          border: 1.5px solid #fecaca;
          padding: 16px; box-shadow: 0 2px 12px rgba(239,68,68,0.06);
        }
        .logres-card__top { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .logres-card__avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: linear-gradient(135deg, #ef4444, #c0392b);
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 15px; font-weight: 700; flex-shrink: 0;
        }
        .logres-card__identity { flex: 1; min-width: 0; }
        .logres-card__name { display: block; font-size: 15px; font-weight: 700; color: #1a1a2e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .logres-card__id { font-size: 12px; color: #9ca3af; }
        .logres-card__badge {
          display: inline-flex; align-items: center;
          padding: 4px 10px; border-radius: 20px;
          background: #fef2f2; border: 1px solid #fecaca;
          font-size: 11px; font-weight: 700; color: #ef4444;
        }
        .logres-card__meta {
          display: flex; flex-direction: column; gap: 4px;
          font-size: 13px; color: #4b5563; margin-bottom: 10px;
        }
        .logres-card__reason {
          font-size: 12px; color: #6b7280; background: #fafafa;
          padding: 8px 10px; border-radius: 8px; margin-bottom: 12px;
          border: 1px solid #f0f0f0;
        }
        .logres-card__actions { display: flex; gap: 8px; }

        /* ── Buttons ── */
        .logres-btn {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 9px 20px; border-radius: 10px;
          font-size: 13px; font-weight: 600; cursor: pointer;
          transition: all 0.2s; border: none;
        }
        .logres-btn--sm { padding: 6px 12px; font-size: 12px; }
        .logres-btn--primary {
          background: linear-gradient(135deg, #0056a2, #00b4eb) !important;
          color: white !important; box-shadow: 0 4px 12px rgba(0,86,162,0.2) !important;
        }
        .logres-btn--primary:hover {
          background: linear-gradient(135deg, #004485, #00a4d6) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 6px 16px rgba(0,86,162,0.3) !important;
        }
        .logres-btn--lift {
          background: linear-gradient(135deg, #50b748, #2d8a3e);
          color: white; box-shadow: 0 4px 12px rgba(80,183,72,0.2);
        }
        .logres-btn--lift:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(80,183,72,0.3); }
        .logres-btn--lift:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .logres-btn--ghost {
          background: white !important; color: #6b7280 !important;
          border: 1.5px solid #e0e0e0 !important;
        }
        .logres-btn--ghost:hover { border-color: #0056a2 !important; color: #0056a2 !important; background: #f8fafc !important; }
        .logres-btn--ghost:disabled { opacity: 0.5 !important; cursor: not-allowed !important; }

        /* ── Modal overlay ── */
        .logres-modal-overlay {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999;
          background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; box-sizing: border-box;
        }
        @media (min-width: 1024px) {
          .logres-modal-overlay,
          .logres-swal-container {
            padding-left: 270px !important;
          }
        }
        
        .logres-modal {
          background: white; border-radius: 20px;
          width: 100%; max-width: 520px; max-height: 90vh;
          overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        .logres-modal--lift { max-width: 540px; }
        .logres-modal__header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px 0;
        }
        .logres-modal__title-row { display: flex; align-items: center; gap: 10px; }
        .logres-modal__title-row h3 { font-size: 18px; font-weight: 700; color: #1a1a2e; margin: 0; }
        .logres-modal__close {
          width: 32px; height: 32px; border-radius: 8px;
          border: 1.5px solid #e0e0e0; background: white;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #9ca3af; font-size: 14px;
          transition: all 0.2s;
        }
        .logres-modal__close:hover { border-color: #ef4444; color: #ef4444; }
        .logres-modal__sub {
          font-size: 13px; color: #9ca3af; padding: 6px 24px 16px; margin: 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .logres-modal__empty {
          padding: 24px; text-align: center; color: #9ca3af; font-size: 13px;
        }
        .logres-modal__actions {
          display: flex; justify-content: flex-end; gap: 10px;
          padding: 16px 24px 24px;
        }

        /* ── History entries ── */
        .logres-modal__entries { padding: 16px 24px; display: flex; flex-direction: column; gap: 12px; }
        .logres-history-entry {
          display: flex; gap: 12px; padding: 14px;
          border-radius: 12px; border: 1px solid #f0f0f0;
        }
        .logres-history-entry--active { background: #fef2f2; border-color: #fecaca; }
        .logres-history-entry--lifted { background: #f0fdf4; border-color: #bbf7d0; }
        .logres-history-entry__badge { flex-shrink: 0; margin-top: 2px; font-size: 16px; }
        .logres-history-entry__body { flex: 1; }
        .logres-history-entry__row {
          display: flex; gap: 8px; font-size: 13px;
          color: #374151; margin-bottom: 4px;
        }
        .logres-history-entry__label { font-weight: 600; color: #6b7280; min-width: 60px; }
        .logres-history-entry__reason {
          font-size: 12px; color: #6b7280; margin: 6px 0;
          background: rgba(0,0,0,0.03); padding: 6px 8px; border-radius: 6px;
        }
        .logres-history-entry__reason--lift { color: #166534; background: rgba(80,183,72,0.08); }
        .logres-history-entry__divider { height: 1px; background: #e5e7eb; margin: 8px 0; }
        .logres-tag {
          display: inline-block; padding: 2px 8px; border-radius: 6px;
          font-size: 11px; font-weight: 600; margin-top: 4px;
        }
        .logres-tag--auto { background: #fef3c7; color: #92400e; }
        .logres-tag--manual { background: #ede9fe; color: #5b21b6; }


        /* ── Toast ── */
        .logres-toast {
          position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
          display: flex; align-items: center;
          padding: 12px 24px; border-radius: 12px;
          font-size: 14px; font-weight: 600;
          box-shadow: 0 6px 24px rgba(0,0,0,0.15); z-index: 300;
          white-space: nowrap;
        }
        .logres-toast--success { background: #166534; color: white; }
        .logres-toast--error { background: #991b1b; color: white; }

        /* ── Spin animation ── */
        @keyframes logres-spin { to { transform: rotate(360deg); } }
        .logres-spin { animation: logres-spin 0.8s linear infinite; }
      `}</style>
      </div>
    </AdminNavigation>
  );
};

export default TalentHubRestrictions;
