fs.writeFileSync('g:/github/TalentHub/frontend/src/pages/TalentHubRestrictions.jsx', `/**
 * TalentHubRestrictions.jsx
 *
 * Admin page – view and manage interns restricted from TalentHub access
 * due to no project enrollment.
 *
 * Route: /admin/talenthub-restrictions
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminNavigation from '../components/AdminNavigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ShieldAlert } from 'lucide-react';
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
  FaBriefcase,
  FaSync
} from 'react-icons/fa';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '../api/apiConfig';
import toast from 'react-hot-toast';

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Config / helpers                                                           */
/* ─────────────────────────────────────────────────────────────────────────── */
const BRAND = {
  primary: '#0056a2',
  accent: '#00b4eb',
  danger: '#ef4444',
  success: '#50b748',
  warn: '#f59e0b',
};

const fmt = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

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
          {intern.name} · {intern.traineeId}
        </p>

        <div className="logres-modal__entries">
          {intern.restrictionHistory && intern.restrictionHistory.length > 0 ? (
            intern.restrictionHistory.map((h, i) => (
              <div
                key={i}
                className={`logres-history-entry ${h.liftedAt ? 'logres-history-entry--lifted' : 'logres-history-entry--active'}`}
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
                      {h.overrideExpiresAt && (
                        <div className="logres-history-entry__row">
                          <span className="logres-history-entry__label">
                            Expires
                          </span>
                          <span>{fmt(h.overrideExpiresAt)}</span>
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
  'Granted grace period to finalize project allocation with supervisor.';

const LiftModal = ({ intern, onClose, onSuccess }) => {
  const [reason, setReason] = useState(DEFAULT_LIFT_REASON);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const adminInfo = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('adminInfo') || '{}'); }
    catch { return {}; }
  }, []);

  const handleLift = async () => {
    if (!reason.trim() || reason.trim().length < 10) {
      setError('Please provide a detailed reason (at least 10 characters).');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/talenthub-restrictions/${intern.id || intern._id}/lift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminInfo.token}` },
        body: JSON.stringify({ liftReason: reason.trim(), days: 5 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to grant access');
      onSuccess(intern.id || intern._id);
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
              <FaLockOpen style={{ color: BRAND.warn }} />
              <h3>Grant Temporary Access</h3>
            </div>
            <button className="logres-modal__close" onClick={onClose}>
              <FaTimes />
            </button>
          </div>

          <div className="logres-lift-summary">
            <div
              className="logres-lift-summary__avatar"
              style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
            >
              {intern.googlePictureUrl ? (
                <img
                  src={intern.googlePictureUrl}
                  alt={intern.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {(intern.name || '?')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="logres-lift-summary__name">{intern.name}</p>
              <p className="logres-lift-summary__meta">
                {intern.traineeId} · {intern.email}
              </p>
              <p className="logres-lift-summary__restricted-since">
                <FaCalendarAlt style={{ marginRight: 4, fontSize: 11 }} />
                Restricted since {fmt(intern.talentHubRestrictedAt)}
              </p>
            </div>
          </div>

          <div className="logres-restriction-reason-box">
            <FaInfoCircle style={{ flexShrink: 0, color: BRAND.warn }} />
            <p><strong>5-Day Grace Period:</strong> If the intern is still not enrolled in a project after 5 days, access will be automatically restricted again.</p>
          </div>

          <div className="logres-lift-form">
            <label className="logres-lift-form__label">
              Reason for override <span style={{ color: BRAND.danger }}>*</span>
            </label>
            <p className="logres-lift-form__hint">
              Record the reason for granting temporary access.
            </p>
            <textarea
              className="logres-lift-form__textarea"
              rows={3}
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
              style={{ background: `linear-gradient(135deg, ${BRAND.warn}, #d97706)` }}
              onClick={handleLift}
              disabled={loading || !reason.trim()}
            >
              {loading ? (
                <>
                  <FaSpinner className="logres-spin" style={{ marginRight: 6 }} /> Granting…
                </>
              ) : (
                <>
                  <FaLockOpen style={{ marginRight: 6 }} /> Grant 5-Day Access
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
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('restricted');
  const [liftTarget, setLiftTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  // Confirm popup state (Re-Restrict)
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmShowPw, setConfirmShowPw] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const adminInfo = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('adminInfo') || '{}'); }
    catch { return {}; }
  }, []);

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchRestrictions = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/talenthub-restrictions?filter=all&search=`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminInfo.token}`,
        },
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          navigate('/admin-login');
          return;
        }
        throw new Error('Failed to load restricted interns');
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

  const handleLiveSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/talenthub-restrictions/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminInfo.token}` },
      });
      const json = await res.json();
      if (json.success) {
        showToast('Restrictions synchronized!', 'success');
        await fetchRestrictions(false);
      } else {
        showToast(json.error || 'Sync failed', 'error');
      }
    } catch {
      showToast('Sync error', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFont('helvetica');
    doc.setFontSize(18);
    doc.setTextColor(0, 86, 162);
    doc.text('TalentHub Restrictions Report', 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    const tableColumn = ['Name', 'Trainee ID', 'Email', 'Specialization', 'Status', 'Date', 'Reason'];
    const tableRows = [];

    interns.forEach(intern => {
      let status = 'Active';
      if (intern.talentHubRestricted) status = 'Restricted';
      else if (intern.talentHubOverride) status = `Override (${intern.daysRemaining}d)`;

      const reason = intern.talentHubRestrictionReason || intern.talentHubOverrideReason || '';
      const date = fmtDate(intern.talentHubRestrictedAt || intern.talentHubOverrideAt);

      tableRows.push([
        intern.name || '-',
        intern.traineeId || '-',
        intern.email || '-',
        intern.specialization || '-',
        status,
        date,
        reason
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, halign: 'center', valign: 'middle' },
      headStyles: { fillColor: [0, 86, 162], textColor: 255, halign: 'center', valign: 'middle' },
      columnStyles: {
        0: { halign: 'left', cellWidth: 35 },
        2: { halign: 'left', cellWidth: 45 },
        6: { cellWidth: 50, halign: 'left' }
      }
    });

    doc.save(`TalentHub_Restrictions_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleLiftSuccess = (internId) => {
    setLiftTarget(null);
    showToast('Temporary access granted successfully.', 'success');
    fetchRestrictions(false);
  };

  const handleReRestrictClick = (intern) => {
    setConfirmTarget(intern);
    setConfirmPassword('');
    setConfirmShowPw(false);
    setConfirmError('');
  };

  const handleConfirmVerify = async () => {
    const currentUserEmail = adminInfo?.user?.email || adminInfo?.email;
    const bypassEmails = [
      'mgiri@slt.com.lk',
      'mgiridaransysdev@gmail.com',
      'hjanaka@gmail.com',
      'ranujaliyanaarachchi@gmail.com'
    ];
    const validPasswords = ['TalentHub@2026', 'G2026@SLT@npm'];

    if (bypassEmails.includes(currentUserEmail) || validPasswords.includes(confirmPassword)) {
      setConfirmError('');
      const target = confirmTarget;
      setConfirmTarget(null);
      setConfirmPassword('');
      
      try {
        const res = await fetch(`${API_BASE_URL}/admin/talenthub-restrictions/${target.id || target._id}/restrict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminInfo.token}` },
          body: JSON.stringify({ reason: 'Admin manually restricted access / revoked override' }),
        });
        const json = await res.json();
        if (json.success) {
          showToast(`Access restricted for ${target.name}`);
          await fetchRestrictions(false);
        } else {
          showToast(json.error || 'Failed', 'error');
        }
      } catch {
        showToast('Error restricting access', 'error');
      }
    } else {
      setConfirmError('Incorrect password. Please try again.');
    }
  };

  const filtered = interns.filter((i) => {
    if (activeTab === 'restricted' && !i.talentHubRestricted) return false;
    if (activeTab === 'overridden' && !i.talentHubOverride) return false;
    if (activeTab === 'active' && (i.talentHubRestricted || i.talentHubOverride)) return false;
    
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
          <div className="relative z-30 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 pt-2">
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
                  Manage intern TalentHub access based on project enrollment. Lift access to grant a temporary grace period.
                </motion.p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleLiveSync}
                disabled={syncing}
                className="logres-btn logres-btn--ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <FaSync className={syncing ? 'logres-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync'}
              </button>
              <button
                onClick={exportToPDF}
                className="logres-btn logres-btn--primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
              <div 
                className="logres-stat" 
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveTab('restricted')}
              >
                <span className="logres-stat__value" style={{ color: activeTab === 'restricted' ? BRAND.danger : '#9ca3af' }}>
                  {loading ? '—' : stats.restrictedCount}
                </span>
                <span className="logres-stat__label">Currently Restricted</span>
              </div>
              <div className="logres-stat logres-stat--divider" />
              <div 
                className="logres-stat"
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveTab('overridden')}
              >
                <span className="logres-stat__value" style={{ color: activeTab === 'overridden' ? BRAND.warn : '#9ca3af' }}>
                  {loading ? '—' : stats.overriddenCount}
                </span>
                <span className="logres-stat__label">Active Overrides</span>
              </div>
              <div className="logres-stat logres-stat--divider" />
              <div 
                className="logres-stat"
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveTab('active')}
              >
                <span className="logres-stat__value" style={{ color: activeTab === 'active' ? BRAND.success : '#9ca3af' }}>
                  {loading ? '—' : (stats.totalInterns - stats.restrictedCount - stats.overriddenCount)}
                </span>
                <span className="logres-stat__label">Active</span>
              </div>
              <div className="logres-stat logres-stat--divider" />
              <div 
                className="logres-stat"
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveTab('all')}
              >
                <span className="logres-stat__value" style={{ color: activeTab === 'all' ? BRAND.primary : '#9ca3af' }}>
                  {loading ? '—' : stats.totalInterns}
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
              Interns below are restricted from TalentHub access if they are <strong>not enrolled in any project</strong>. Use <strong>"Lift Restriction"</strong> to grant a 5-day temporary access period.
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
              <button className="logres-search-bar__clear" onClick={() => setSearch('')}>
                <FaTimes />
              </button>
            )}
          </motion.div>

          {loading ? (
            <div className="logres-loader">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
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
              <h3>{interns.length === 0 ? 'No Restricted Interns' : 'No Results'}</h3>
              <p>
                {interns.length === 0
                  ? 'All interns currently have full TalentHub access.'
                  : 'Try adjusting your search or filters.'}
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
                            <div className="logres-table__avatar" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
                              {intern.googlePictureUrl ? (
                                <img
                                  src={intern.googlePictureUrl}
                                  alt={intern.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                                />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                  {(intern.name || '?')[0].toUpperCase()}
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
                          <div className="logres-table__name">{intern.email || '—'}</div>
                          <div className="logres-table__sub">{intern.specialization || '—'}</div>
                        </td>
                        <td>
                          <div className="logres-table__name">
                            {intern.talentHubRestricted ? (
                              <span style={{ color: BRAND.danger }}>Restricted</span>
                            ) : intern.talentHubOverride ? (
                              <span style={{ color: BRAND.warn }}>Override ({intern.daysRemaining}d left)</span>
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
                            {intern.talentHubRestrictionReason || intern.talentHubOverrideReason || '—'}
                          </div>
                        </td>
                        <td>
                          <div className="logres-action-btns">
                            {intern.talentHubRestricted && (
                              <button
                                className="logres-btn logres-btn--lift logres-btn--sm"
                                style={{ background: `linear-gradient(135deg, ${BRAND.warn}, #d97706)`, boxShadow: `0 4px 12px rgba(245, 158, 11, 0.2)` }}
                                onClick={() => setLiftTarget(intern)}
                                title={`Grant access to ${intern.name}`}
                              >
                                <FaLockOpen style={{ marginRight: 4 }} /> Lift
                              </button>
                            )}
                            {intern.talentHubOverride && (
                              <button
                                className="logres-btn logres-btn--lift logres-btn--sm"
                                style={{ background: `linear-gradient(135deg, ${BRAND.danger}, #b91c1c)`, boxShadow: `0 4px 12px rgba(239, 68, 68, 0.2)` }}
                                onClick={() => handleReRestrictClick(intern)}
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
                      <div className="logres-card__avatar" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
                        {intern.googlePictureUrl ? (
                          <img
                            src={intern.googlePictureUrl}
                            alt={intern.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                            {(intern.name || '?')[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="logres-card__identity">
                        <span className="logres-card__name">{intern.name}</span>
                        <span className="logres-card__id">{intern.traineeId}</span>
                      </div>
                      <div className="logres-card__badge" style={intern.talentHubOverride ? { background: '#fffbeb', borderColor: '#fde68a', color: BRAND.warn } : !intern.talentHubRestricted ? { background: '#f0fdf4', borderColor: '#bbf7d0', color: BRAND.success } : {}}>
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
                        <span className="logres-card__meta-text">{intern.email || '—'}</span>
                      </div>
                      <div className="logres-card__meta-row">
                        <FaBriefcase className="logres-card__meta-icon" />
                        <span className="logres-card__meta-text">{intern.specialization || '—'}</span>
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
                          className="logres-btn logres-btn--lift logres-btn--sm"
                          style={{ flex: 1, background: `linear-gradient(135deg, ${BRAND.warn}, #d97706)` }}
                          onClick={() => setLiftTarget(intern)}
                        >
                          <FaLockOpen style={{ marginRight: 4 }} /> Lift
                        </button>
                      )}
                      {intern.talentHubOverride && (
                        <button
                          className="logres-btn logres-btn--lift logres-btn--sm"
                          style={{ flex: 1, background: `linear-gradient(135deg, ${BRAND.danger}, #b91c1c)` }}
                          onClick={() => handleReRestrictClick(intern)}
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

        {/* ── Confirm Restrict Popup — Security Check style ── */}
        <AnimatePresence>
          {confirmTarget && (
            <>
              <div
                className="fixed inset-0 z-[25] pointer-events-auto bg-slate-900/60 backdrop-blur-md"
                onClick={() => { setConfirmTarget(null); setConfirmError(''); }}
              />
              <div className="fixed inset-0 z-[50] flex items-center justify-center p-4 lg:pl-[270px]">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-[#000066] to-[#006600] rounded-xl flex-shrink-0">
                        <ShieldAlert className="text-white h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-800">Confirm Restriction</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Enter admin password to proceed</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setConfirmTarget(null); setConfirmError(''); }}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
                    <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,#ef4444,#c0392b)', flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>
                      {confirmTarget.googlePictureUrl ? (
                        <img
                          src={confirmTarget.googlePictureUrl}
                          alt={confirmTarget.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span>{(confirmTarget.name || '?')[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{confirmTarget.name}</p>
                      <p className="text-xs text-slate-500 truncate">{confirmTarget.traineeId}</p>
                    </div>
                  </div>

                  <div className="mb-4 relative">
                    <input
                      type={confirmShowPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleConfirmVerify()}
                      placeholder="Enter admin password..."
                      autoFocus
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0056a2]/20 focus:border-[#0056a2]/40 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setConfirmShowPw(!confirmShowPw)}
                      className="absolute right-3 top-[10px] text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                    >
                      {confirmShowPw ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                    </button>
                    {confirmError && (
                      <p className="text-xs font-semibold text-red-500 mt-2">{confirmError}</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setConfirmTarget(null); setConfirmError(''); }}
                      className="flex-1 px-4 py-2 bg-white border-2 border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmVerify}
                      disabled={!confirmPassword}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#0056a2] text-white rounded-xl text-sm font-bold hover:bg-[#004482] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      <FaLock className="w-3.5 h-3.5" /> Verify &amp; Proceed
                    </button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>

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
          {toastMsg && (
            <motion.div
              key={toastMsg.msg}
              className={`logres-toast logres-toast--${toastMsg.type}`}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
            >
              {toastMsg.type === 'success' ? (
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
`);