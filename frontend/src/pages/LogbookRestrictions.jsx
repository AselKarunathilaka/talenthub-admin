/**
 * LogbookRestrictions.jsx
 *
 * Admin page – view all currently restricted interns and lift restrictions
 * after a valid reason (supervisor meeting) has been recorded.
 *
 * Route: /admin/logbook-restrictions
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import { motion, AnimatePresence } from "framer-motion";
import { Lock } from "lucide-react";
import {
  FaLock,
  FaLockOpen,
  FaArrowLeft,
  FaSearch,
  FaExclamationTriangle,
  FaCheckCircle,
  FaSpinner,
  FaHistory,
  FaUserShield,
  FaTimes,
  FaCalendarAlt,
  FaInfoCircle,
  FaShieldAlt,
  FaSignOutAlt,
  FaDownload,
} from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Swal from "sweetalert2";
import logo from "../assets/sltlogo.jpg";
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
/*  API helpers                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */
async function apiFetch(path, options = {}) {
  const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
  const res = await fetch(`${API_BASE_URL}/admin/logbook-restrictions${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(adminInfo.token && { Authorization: `Bearer ${adminInfo.token}` }),
      ...(options.headers || {}),
    },
  });
  return res;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  History Modal                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */
const HistoryModal = ({ intern, onClose }) => (
  <AnimatePresence>
    <motion.div
      key="overlay"
      className="logres-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="logres-modal"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="logres-modal__header">
          <div className="logres-modal__title-row">
            <FaHistory style={{ color: BRAND.primary }} />
            <h3>Restriction History</h3>
          </div>
          <button className="logres-modal__close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <p className="logres-modal__sub">
          {intern.traineeName} · {intern.traineeId}
        </p>

        <div className="logres-modal__entries">
          {intern.restrictionHistory && intern.restrictionHistory.length > 0 ? (
            intern.restrictionHistory.map((h, i) => (
              <div
                key={i}
                className={`logres-history-entry ${h.liftedAt ? "logres-history-entry--lifted" : "logres-history-entry--active"}`}
              >
                <div className="logres-history-entry__badge">
                  {h.liftedAt ? (
                    <FaLockOpen style={{ color: BRAND.success }} />
                  ) : (
                    <FaLock style={{ color: BRAND.danger }} />
                  )}
                </div>
                <div className="logres-history-entry__body">
                  <div className="logres-history-entry__row">
                    <span className="logres-history-entry__label">
                      Restricted
                    </span>
                    <span>{fmt(h.restrictedAt)}</span>
                  </div>
                  <div className="logres-history-entry__reason">
                    {h.restrictionReason}
                  </div>
                  {h.autoRestricted !== undefined && (
                    <span
                      className={`logres-tag ${h.autoRestricted ? "logres-tag--auto" : "logres-tag--manual"}`}
                    >
                      {h.autoRestricted ? "Auto-restricted" : "Manual"}
                    </span>
                  )}
                  {h.liftedAt && (
                    <>
                      <div className="logres-history-entry__divider" />
                      <div className="logres-history-entry__row">
                        <span className="logres-history-entry__label">
                          Lifted
                        </span>
                        <span>{fmt(h.liftedAt)}</span>
                      </div>
                      {h.liftedBy && (
                        <div className="logres-history-entry__row">
                          <span className="logres-history-entry__label">
                            By
                          </span>
                          <span>{h.liftedBy}</span>
                        </div>
                      )}
                      {h.liftReason && (
                        <div className="logres-history-entry__reason logres-history-entry__reason--lift">
                          {h.liftReason}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="logres-modal__empty">No history available.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Lift Modal                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */
const DEFAULT_LIFT_REASON =
  "Intern met with supervisor and provided a valid explanation. Access restored as per supervisor approval.";

const LiftModal = ({ intern, onClose, onSuccess }) => {
  const [reason, setReason] = useState(DEFAULT_LIFT_REASON);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLift = async () => {
    if (!reason.trim() || reason.trim().length < 15) {
      setError("Please provide a detailed reason (at least 15 characters).");
      return;
    }
    
    const { value: password } = await Swal.fire({
      title: 'Enter Password',
      html: `
        <div style="font-size: 14px; color: #4b5563; margin-bottom: 16px;">Admin Password required.</div>
        <div class="logres-pw-wrapper">
          <input type="text" name="username" value="" tabindex="-1" autocomplete="username" style="opacity: 0; position: absolute; top: 0; left: 0; width: 1px; height: 1px; z-index: -1;" />
          <input type="password" id="logres-password-input" class="logres-swal-input" placeholder="Enter your password" autocomplete="current-password" />
          <div class="logres-pw-toggle" id="logres-pw-toggle">
            <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 640 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M320 400c-75.85 0-137.25-58.71-142.9-133.11L72.2 185.82c-13.79 17.3-26.48 35.59-36.72 55.59a32.35 32.35 0 0 0 0 29.19C89.71 376.41 197.07 448 320 448c26.91 0 52.87-4 77.89-10.46L346 397.39a144.13 144.13 0 0 1-26 2.61zm313.82 58.1l-110.55-85.44a331.25 331.25 0 0 0 81.25-102.07 32.35 32.35 0 0 0 0-29.19C550.29 135.59 442.93 64 320 64a308.15 308.15 0 0 0-147.32 37.7L45.46 3.37A16 16 0 0 0 23 6.18L3.37 31.45A16 16 0 0 0 6.18 53.9l588.36 454.73a16 16 0 0 0 22.46-2.81l19.64-25.27a16 16 0 0 0-2.82-22.45zm-183.72-142l-39.3-30.38A94.75 94.75 0 0 0 416 256a94.76 94.76 0 0 0-121.31-92.21A47.65 47.65 0 0 1 304 192a46.64 46.64 0 0 1-1.54 10l-73.61-56.89A142.31 142.31 0 0 1 320 112a143.92 143.92 0 0 1 144 144c0 21.63-5.29 41.79-13.9 60.11z"></path></svg>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Verify & Restore',
      confirmButtonColor: BRAND.primary,
      cancelButtonColor: BRAND.ghost,
      customClass: {
        container: 'logres-swal-container',
        popup: 'logres-swal-popup',
        title: 'logres-swal-title',
        confirmButton: 'logres-btn logres-btn--primary',
        cancelButton: 'logres-btn logres-btn--ghost'
      },
      didOpen: () => {
        const toggle = document.getElementById('logres-pw-toggle');
        const input = document.getElementById('logres-password-input');
        
        const eyeSVG = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 576 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M288 144a110.94 110.94 0 0 0-31.24 5 55.4 55.4 0 0 1 7.24 27 56 56 0 0 1-56 56 55.4 55.4 0 0 1-27-7.24A111.71 111.71 0 1 0 288 144zm284.52 97.4C518.29 135.59 410.93 64 288 64S57.68 135.64 3.48 241.41a32.35 32.35 0 0 0 0 29.19C57.71 376.41 165.07 448 288 448s230.32-71.64 284.52-177.41a32.35 32.35 0 0 0 0-29.19zM288 400c-98.65 0-189.09-55-237.93-144C98.91 167 189.34 112 288 112s189.09 55 237.93 144C477.1 345 386.66 400 288 400z"></path></svg>`;
        const eyeSlashSVG = toggle.innerHTML;

        toggle.addEventListener('click', () => {
          if (input.type === 'password') {
            input.type = 'text';
            toggle.innerHTML = eyeSVG;
          } else {
            input.type = 'password';
            toggle.innerHTML = eyeSlashSVG;
          }
        });
      },
      preConfirm: () => {
        const password = document.getElementById('logres-password-input').value;
        if (!password) {
          Swal.showValidationMessage('You need to enter the password!');
          return false;
        }
        return password;
      }
    });

    if (!password) {
      return; // Cancelled
    }

    if (password !== 'TalentHub@2026' && password !== 'G2026@SLT@npm') {
      Swal.fire({
        icon: 'error',
        title: 'Incorrect Password',
        text: 'The password you entered is incorrect.',
        confirmButtonColor: BRAND.primary,
      });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/${intern._id}/lift`, {
        method: "POST",
        body: JSON.stringify({ liftReason: reason.trim(), liftedBy: "Admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to lift restriction");
      onSuccess(intern._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="logres-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="logres-modal logres-modal--lift"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="logres-modal__header">
            <div className="logres-modal__title-row">
              <FaLockOpen style={{ color: BRAND.success }} />
              <h3>Lift Logbook Restriction</h3>
            </div>
            <button className="logres-modal__close" onClick={onClose}>
              <FaTimes />
            </button>
          </div>

          {/* Intern summary */}
          <div className="logres-lift-summary">
            <div
              className="logres-lift-summary__avatar"
              style={{ padding: 0, overflow: "hidden", position: "relative" }}
            >
              <img
                src={`${API_BASE_URL}/interns/${intern._id}/profile-picture`}
                alt={intern.traineeName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  e.target.style.display = "none";
                  if (e.target.nextSibling)
                    e.target.nextSibling.style.display = "flex";
                }}
              />
              <div
                style={{
                  display: "none",
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {(intern.traineeName || "?")[0].toUpperCase()}
              </div>
            </div>
            <div>
              <p className="logres-lift-summary__name">{intern.traineeName}</p>
              <p className="logres-lift-summary__meta">
                {intern.traineeId} · {intern.email}
              </p>
              <p className="logres-lift-summary__restricted-since">
                <FaCalendarAlt style={{ marginRight: 4, fontSize: 11 }} />
                Restricted since {fmt(intern.logbookRestrictedAt)}
              </p>
            </div>
          </div>

          {/* Current restriction reason */}
          {intern.logbookRestrictionReason && (
            <div className="logres-restriction-reason-box">
              <FaInfoCircle style={{ flexShrink: 0, color: BRAND.warn }} />
              <p>{intern.logbookRestrictionReason}</p>
            </div>
          )}

          {/* Lift reason input */}
          <div className="logres-lift-form">
            <label className="logres-lift-form__label">
              Reason for lifting restriction{" "}
              <span style={{ color: BRAND.danger }}>*</span>
            </label>
            <p className="logres-lift-form__hint">
              Record the valid reason provided by the intern after meeting with
              their supervisor.
            </p>
            <textarea
              className="logres-lift-form__textarea"
              rows={4}
              placeholder="e.g. Intern met with supervisor on 08 Jun 2026. Medical emergency confirmed with documentation. Access restored as per supervisor approval."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
            />
            {error && (
              <p className="logres-lift-form__error">
                <FaExclamationTriangle style={{ marginRight: 6 }} />
                {error}
              </p>
            )}
          </div>

          <div className="logres-modal__actions">
            <button
              className="logres-btn logres-btn--ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="logres-btn logres-btn--lift"
              onClick={handleLift}
              disabled={loading || !reason.trim()}
            >
              {loading ? (
                <>
                  <FaSpinner
                    className="logres-spin"
                    style={{ marginRight: 6 }}
                  />{" "}
                  Lifting…
                </>
              ) : (
                <>
                  <FaLockOpen style={{ marginRight: 6 }} /> Restore Access
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Main Page Component                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */
const LogbookRestrictions = () => {
  const navigate = useNavigate();
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [liftTarget, setLiftTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const exportToPDF = () => {
    const doc = new jsPDF("landscape");
    doc.setFont("helvetica");

    // Title
    doc.setFontSize(18);
    doc.setTextColor(0, 86, 162); // BRAND.primary
    doc.text("Logbook Restrictions Report", 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    const tableColumn = [
      "Name",
      "Trainee ID",
      "Restricted Since",
      "Day 1",
      "Day 2",
      "Day 3",
      "Day 4",
      "Day 5",
      "Reason"
    ];

    const tableRows = [];

    interns.forEach(intern => {
      const reason = intern.logbookRestrictionReason || "";
      
      const rowData = [
        intern.traineeName || "-",
        intern.traineeId || "-",
        fmtDate(intern.logbookRestrictedAt)
      ];

      for (let i = 0; i < 5; i++) {
        if (intern.heatmap && intern.heatmap[i]) {
          const h = intern.heatmap[i];
          const dateFmt = new Date(h.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          rowData.push(`${dateFmt}\n${h.submitted ? "Submitted" : "Not Submitted"}`);
        } else {
          rowData.push("-");
        }
      }

      rowData.push(reason);
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, halign: "center", valign: "middle" },
      headStyles: { fillColor: [0, 86, 162], textColor: 255, halign: "center", valign: "middle" },
      columnStyles: {
        0: { halign: "left" }, // Name
        1: { halign: "center" }, // ID
        2: { halign: "center" }, // Restricted Since
        8: { cellWidth: 50, halign: "left" } // Reason
      },
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index >= 3 && data.column.index <= 7) {
          const raw = data.cell.raw;
          if (raw && typeof raw === 'string') {
             if (raw.includes('Not Submitted')) {
                data.cell.styles.textColor = [220, 38, 38]; // Red text
                data.cell.styles.fontStyle = 'bold';
             } else if (raw.includes('Submitted')) {
                data.cell.styles.textColor = [37, 99, 235]; // Blue text
                data.cell.styles.fontStyle = 'bold';
             }
          }
        }
      }
    });

    const dateSuffix = new Date().toISOString().split('T')[0];
    doc.save(`Logbook_Restrictions_${dateSuffix}.pdf`);
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchRestricted = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch("/");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          navigate("/admin-login");
          return;
        }
        throw new Error("Failed to load restricted interns");
      }
      const data = await res.json();
      setInterns(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchRestricted();
  }, [fetchRestricted]);

  const handleLiftSuccess = (internId) => {
    setInterns((prev) => prev.filter((i) => i._id !== internId));
    setLiftTarget(null);
    showToast("Logbook access successfully restored.", "success");
  };

  const filtered = interns.filter((i) => {
    const q = search.toLowerCase();
    return (
      !q ||
      i.traineeName?.toLowerCase().includes(q) ||
      i.traineeId?.toLowerCase().includes(q) ||
      i.email?.toLowerCase().includes(q)
    );
  });

  /* ── Render ── */
  return (
    <AdminNavigation>
      <div className="logres-root relative z-10">
        {/* Ambient */}
        <div className="logres-ambient absolute inset-0 overflow-hidden pointer-events-none">
          <div className="logres-ambient__orb logres-ambient__orb--1 absolute" />
          <div className="logres-ambient__orb logres-ambient__orb--2 absolute" />
        </div>

        {/* Main */}
        <div className="logres-content relative z-10 pt-4">
          <main className="logres-main">
            {/* Back + title */}
            <div className="mb-8">
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
              >
                <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl">
                  <Lock className="text-[#0056a2] h-8 w-8" />
                </div>
                Logbook Restrictions
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05, duration: 0.2 }}
                className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
              >
                Interns restricted due to submitting fewer than 3 logs in a working week (excluding weekends & public holidays). Lift access after supervisor approval.
              </motion.p>
            </div>

            {/* Stats bar */}
            <motion.div
              className="logres-stats-bar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ flexWrap: "wrap", justifyContent: "space-between" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                <div className="logres-stat">
                  <span
                    className="logres-stat__value"
                    style={{ color: BRAND.danger }}
                  >
                    {loading ? "—" : interns.length}
                  </span>
                  <span className="logres-stat__label">Currently Restricted</span>
                </div>
                <div className="logres-stat logres-stat--divider" />
                <div className="logres-stat">
                  <span
                    className="logres-stat__value"
                    style={{ color: BRAND.warn }}
                  >
                    {loading ? "—" : filtered.length}
                  </span>
                  <span className="logres-stat__label">Shown (filtered)</span>
                </div>
              </div>

              <button
                onClick={exportToPDF}
                className="logres-btn logres-btn--primary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: BRAND.primary,
                  color: "white",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  fontWeight: "600",
                  border: "none",
                  cursor: "pointer",
                  marginLeft: "auto",
                  transition: "background 0.2s"
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#004482")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND.primary)}
              >
                <FaDownload /> Export PDF
              </button>
            </motion.div>

            {/* Info banner */}
            <motion.div
              className="logres-info-banner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              <FaInfoCircle
                style={{ flexShrink: 0, color: BRAND.primary, marginTop: 2 }}
              />
              <p>
                Interns below are automatically restricted for submitting fewer than <strong>3 logbook </strong>entries within a <strong> 5 working-day </strong>period <strong>(</strong>excluding weekends and public holidays<strong>)</strong>. Use <strong> "Lift Restriction" </strong>to restore access and record the supervisor's reason.
              </p>
            </motion.div>

            {/* Search */}
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
                data-lpignore="true"
              />
              {search && (
                <button
                  className="logres-search-bar__clear"
                  onClick={() => setSearch("")}
                >
                  <FaTimes />
                </button>
              )}
            </motion.div>

            {/* Content */}
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
                <FaExclamationTriangle
                  style={{ fontSize: 36, color: BRAND.danger }}
                />
                <p>{error}</p>
                <button
                  className="logres-btn logres-btn--primary"
                  onClick={fetchRestricted}
                >
                  Retry
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <motion.div
                className="logres-empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="logres-empty__icon">
                  <FaCheckCircle
                    style={{ color: BRAND.success, fontSize: 40 }}
                  />
                </div>
                <h3>
                  {interns.length === 0
                    ? "No Restricted Interns"
                    : "No Results"}
                </h3>
                <p>
                  {interns.length === 0
                    ? "All interns currently have full logbook access. Restrictions are applied automatically at the end of each weekly check."
                    : "Try adjusting your search."}
                </p>
              </motion.div>
            ) : (
              <motion.div
                className="logres-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
              >
                {/* Desktop table */}
                <div className="logres-table-wrapper">
                  <table className="logres-table">
                    <thead>
                      <tr>
                        <th>Intern</th>
                        <th>Contact / Field</th>
                        <th>Restricted Since</th>
                        <th>Reason</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((intern, idx) => (
                        <motion.tr
                          key={intern._id}
                          className="logres-table__row"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                        >
                          <td>
                            <div className="logres-table__intern-cell">
                              <div className="logres-table__avatar" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
                                <img
                                  src={`${API_BASE_URL}/interns/${intern._id}/profile-picture`}
                                  alt={intern.traineeName}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                                <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                  {(intern.traineeName || "?")[0].toUpperCase()}
                                </div>
                              </div>
                              <div>
                                <div className="logres-table__name">
                                  {intern.traineeName}
                                </div>
                                <div className="logres-table__sub">
                                  {intern.traineeId}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="logres-table__name">
                              {intern.email || "—"}
                            </div>
                            <div className="logres-table__sub">
                              {intern.fieldOfSpecialization || "—"}
                            </div>
                          </td>
                          <td>
                            <div className="logres-table__name">
                              {fmtDate(intern.logbookRestrictedAt)}
                            </div>
                            <div className="logres-table__sub">
                              {intern.logbookRestrictedAt
                                ? `${Math.floor(
                                    (Date.now() -
                                      new Date(
                                        intern.logbookRestrictedAt,
                                      ).getTime()) /
                                      86400000,
                                  )} days ago`
                                : "—"}
                            </div>
                          </td>
                          <td>
                            <div
                              className="logres-reason-cell"
                              title={intern.logbookRestrictionReason}
                            >
                              {intern.logbookRestrictionReason || "—"}
                            </div>
                          </td>
                          <td>
                            <div className="logres-action-btns">
                              <button
                                className="logres-btn logres-btn--lift logres-btn--sm"
                                onClick={() => setLiftTarget(intern)}
                                title={`Lift restriction for ${intern.traineeName}`}
                              >
                                <FaLockOpen style={{ marginRight: 4 }} /> Lift
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
                      key={intern._id}
                      className="logres-card"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                    >
                      <div className="logres-card__top">
                        <div className="logres-card__avatar" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
                          <img
                            src={`${API_BASE_URL}/interns/${intern._id}/profile-picture`}
                            alt={intern.traineeName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                            {(intern.traineeName || "?")[0].toUpperCase()}
                          </div>
                        </div>
                        <div className="logres-card__identity">
                          <span className="logres-card__name">
                            {intern.traineeName}
                          </span>
                          <span className="logres-card__id">
                            {intern.traineeId}
                          </span>
                        </div>
                        <div className="logres-card__badge">
                          <FaLock style={{ marginRight: 4, fontSize: 10 }} />{" "}
                          Restricted
                        </div>
                      </div>
                      <div className="logres-card__meta">
                        <span>📧 {intern.email}</span>
                        <span>🎯 {intern.fieldOfSpecialization}</span>
                        <span>
                          🔒 Since {fmtDate(intern.logbookRestrictedAt)}
                        </span>
                      </div>
                      {intern.logbookRestrictionReason && (
                        <p className="logres-card__reason">
                          {intern.logbookRestrictionReason}
                        </p>
                      )}
                      <div className="logres-card__actions">
                        <button
                          className="logres-btn logres-btn--lift logres-btn--sm"
                          onClick={() => setLiftTarget(intern)}
                        >
                          <FaLockOpen style={{ marginRight: 4 }} /> Lift
                          Restriction
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </main>
        </div>

        {/* Modals */}
        {liftTarget && (
          <LiftModal
            intern={liftTarget}
            onClose={() => setLiftTarget(null)}
            onSuccess={handleLiftSuccess}
          />
        )}
        {historyTarget && (
          <HistoryModal
            intern={historyTarget}
            onClose={() => setHistoryTarget(null)}
          />
        )}

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.msg}
              className={`logres-toast logres-toast--${toast.type}`}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
            >
              {toast.type === "success" ? (
                <FaCheckCircle style={{ marginRight: 8 }} />
              ) : (
                <FaExclamationTriangle style={{ marginRight: 8 }} />
              )}
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        <style>{`
        /* ── Root ── */
        .logres-root {
          min-height: 100vh;
          background: #f0f4f8;
          position: relative;
          font-family: 'Segoe UI', system-ui, sans-serif;
        }

        /* ── Ambient ── */
        .logres-ambient { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
        .logres-ambient__orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.06;
        }
        .logres-ambient__orb--1 {
          width: 500px; height: 500px;
          background: #0056a2;
          top: -100px; right: -100px;
        }
        .logres-ambient__orb--2 {
          width: 400px; height: 400px;
          background: #ef4444;
          bottom: -80px; left: -80px;
        }

        /* ── Content layout ── */
        .logres-content { position: relative; z-index: 1; padding-top: 8px; }
        .logres-main { max-width: 1200px; margin: 0 auto; padding: 24px 24px 60px; }

        /* ── Page head ── */
        .logres-page-head { margin-bottom: 24px; }
        .logres-back-btn {
          display: inline-flex; align-items: center;
          padding: 8px 16px; border-radius: 10px;
          border: 1.5px solid #e0e0e0; background: white;
          font-size: 13px; font-weight: 600; color: #6b7280;
          cursor: pointer; transition: all 0.2s; margin-bottom: 20px;
        }
        .logres-back-btn:hover { border-color: #0056a2; color: #0056a2; }
        .logres-page-head__title-block {
          display: flex; align-items: center; gap: 16px;
        }
        .logres-page-head__icon {
          width: 52px; height: 52px; border-radius: 16px;
          background: linear-gradient(135deg, #ef4444, #c0392b);
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 22px; flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(239,68,68,0.25);
        }
        .logres-page-head__title-block h1 {
          font-size: 26px; font-weight: 800; color: #1a1a2e; margin: 0 0 4px;
        }
        .logres-page-head__title-block p { color: #6b7280; font-size: 14px; margin: 0; }

        /* ── Stats bar ── */
        .logres-stats-bar {
          display: flex; align-items: center; gap: 24px;
          padding: 16px 20px; background: white;
          border-radius: 14px; border: 1px solid #f0f0f0;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          margin-bottom: 16px;
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
        @media (min-width: 768px) { .logres-table-wrapper { display: block; } }
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
        @media (min-width: 768px) { .logres-cards-mobile { display: none; } }
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
        .logres-card__identity { flex: 1; }
        .logres-card__name { display: block; font-size: 15px; font-weight: 700; color: #1a1a2e; }
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
            padding-left: 270px !important; /* Offset to center relative to main content area */
          }
        }
        
        /* ── SweetAlert Customization ── */
        .logres-swal-popup {
          border-radius: 20px !important;
          padding: 32px 24px 24px !important;
          font-family: 'Segoe UI', system-ui, sans-serif !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15) !important;
          max-width: 380px !important; /* Reduced width */
          width: 100% !important;
        }
        .logres-swal-title {
          font-size: 19px !important;
          font-weight: 700 !important;
          color: #1a1a2e !important;
          margin-bottom: 12px !important;
        }
        .logres-pw-wrapper {
          position: relative;
          width: 100%;
          margin: 0;
        }
        .logres-swal-input {
          border: 1.5px solid #e0e0e0 !important;
          border-radius: 12px !important;
          padding: 12px 42px 12px 16px !important;
          font-size: 15px !important;
          color: #1a1a2e !important;
          transition: all 0.2s !important;
          text-align: center !important;
          letter-spacing: 2px !important;
          width: 100% !important;
          box-sizing: border-box !important;
          outline: none !important;
          display: block !important;
        }
        .logres-swal-input:focus {
          border-color: #0056a2 !important;
          box-shadow: 0 0 0 3px rgba(0,86,162,0.1) !important;
        }
        .logres-pw-toggle {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          cursor: pointer;
          color: #9ca3af;
          font-size: 18px;
          transition: color 0.2s;
          z-index: 10;
        }
        .logres-pw-toggle:hover { color: #0056a2; }
        
        
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

        /* ── Lift modal specifics ── */
        .logres-lift-summary {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 24px; background: #fafafa;
          border-bottom: 1px solid #f0f0f0;
        }
        .logres-lift-summary__avatar {
          width: 48px; height: 48px; border-radius: 50%;
          background: linear-gradient(135deg, #ef4444, #c0392b);
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 18px; font-weight: 700; flex-shrink: 0;
        }
        .logres-lift-summary__name { font-size: 16px; font-weight: 700; color: #1a1a2e; margin: 0 0 3px; }
        .logres-lift-summary__meta { font-size: 12px; color: #9ca3af; margin: 0 0 3px; }
        .logres-lift-summary__restricted-since {
          font-size: 12px; color: #ef4444; display: flex; align-items: center; margin: 0;
        }
        .logres-restriction-reason-box {
          display: flex; gap: 10px; align-items: flex-start;
          margin: 16px 24px 0;
          padding: 12px 14px;
          background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;
        }
        .logres-restriction-reason-box p { font-size: 13px; color: #92400e; margin: 0; }
        .logres-lift-form { padding: 16px 24px 0; }
        .logres-lift-form__label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 4px; }
        .logres-lift-form__hint { font-size: 12px; color: #9ca3af; margin: 0 0 10px; }
        .logres-lift-form__textarea {
          width: 100%; padding: 12px 14px;
          border: 1.5px solid #e0e0e0; border-radius: 12px;
          font-size: 13px; font-family: inherit; resize: vertical;
          outline: none; transition: border-color 0.2s; color: #1a1a2e;
          box-sizing: border-box;
        }
        .logres-lift-form__textarea:focus { border-color: #50b748; }
        .logres-lift-form__error {
          display: flex; align-items: center;
          font-size: 12px; color: #ef4444; margin-top: 6px;
        }

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

export default LogbookRestrictions;
