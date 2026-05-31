import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaCalendarCheck,
  FaUsers,
  FaSpinner,
  FaUser,
  FaSearch,
  FaRegPaperPlane,
  FaCheckCircle,
  FaFileExcel,
  FaBell,
  FaFilter,
  FaTimes,
  FaClock,
  FaChartBar,
  FaEnvelope,
  FaMapMarkerAlt,
  FaChevronDown,
  FaEdit,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../api/apiConfig";

// ── API helpers ──────────────────────────────────────────────────────────────
const getAuthHeaders = () => {
  const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
  return {
    "Content-Type": "application/json",
    ...(adminInfo.token && { Authorization: `Bearer ${adminInfo.token}` }),
  };
};

const attendanceApi = {
  getByDate: async (date) => {
    const res = await fetch(
      `${API_BASE_URL}/admin/attendance/by-date?date=${date}`,
      { headers: getAuthHeaders() },
    );
    if (!res.ok) throw new Error((await res.json()).error || "Request failed");
    return res.json();
  },

  triggerReport: async (recipients) => {
    const res = await fetch(`${API_BASE_URL}/admin/attendance/trigger-report`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ recipients }),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Request failed");
    return res.json();
  },

  exportExcel: (date) => {
    return fetch(`${API_BASE_URL}/admin/attendance/export-excel?date=${date}`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Attendance_Report_${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    });
  },

  exportNonAttendanceExcel: async () => {
    const res = await fetch(
      `${API_BASE_URL}/admin/attendance/export-non-attendance-excel`,
      { headers: getAuthHeaders() },
    );
    if (!res.ok) throw new Error("Non-attendance export failed");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const d = new Date();
    const localToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    a.download = `Non_Attendance_Report_${localToday}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  getSettings: async () => {
    const res = await fetch(`${API_BASE_URL}/admin/attendance/settings`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok)
      throw new Error((await res.json()).message || "Settings request failed");
    return res.json();
  },

  updateSettings: async (settings) => {
    const res = await fetch(`${API_BASE_URL}/admin/attendance/settings`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(settings),
    });
    if (!res.ok)
      throw new Error((await res.json()).message || "Settings update failed");
    return res.json();
  },
};

// ── Timezone-safe "today" helper ─────────────────────────────────────────────
const getLocalToday = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ toast, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };

  return (
    <motion.div
      className={`fixed bottom-6 right-6 z-50 flex items-center space-x-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm ${colors[toast.type]}`}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
    >
      <span className="text-sm font-medium">{toast.text}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <FaTimes className="h-3 w-3" />
      </button>
    </motion.div>
  );
};

// ── TypeBadge ─────────────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => {
  const map = {
    qr: { label: "QR", cls: "bg-purple-100 text-purple-700 border-purple-200" },
    daily_qr: {
      label: "Daily QR",
      cls: "bg-indigo-100 text-indigo-700 border-indigo-200",
    },
    face_meeting: {
      label: "Face Meeting",
      cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    face: {
      label: "Face",
      cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    manual: {
      label: "Manual",
      cls: "bg-amber-100 text-amber-700 border-amber-200",
    },
    daily: { label: "Daily", cls: "bg-cyan-100 text-cyan-700 border-cyan-200" },
    // ── NEW types ──────────────────────────────────────────────────────────────
    manual_daily: {
      label: "Manual Daily",
      cls: "bg-teal-100 text-teal-700 border-teal-200",
    },
    manual_meeting: {
      label: "Manual Meeting",
      cls: "bg-orange-100 text-orange-700 border-orange-200",
    },
  };
  const { label, cls } = map[type] || {
    label: type,
    cls: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      {label}
    </span>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const AdminInternAttendance = () => {
  const navigate = useNavigate();

  const today = getLocalToday();

  const [selectedDate, setSelectedDate] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingNonAttendance, setExportingNonAttendance] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  const [toast, setToast] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [sltLocationRequired, setSltLocationRequired] = useState(true);
  const [expandedInterns, setExpandedInterns] = useState({});

  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [recipientInput, setRecipientInput] = useState("");
  const [recipients, setRecipients] = useState(["mgiri@slt.com.lk"]);

  const showToast = (text, type = "info") => setToast({ text, type });

  const fetchAttendance = async (date) => {
    setLoading(true);
    setData(null);
    try {
      const result = await attendanceApi.getByDate(date);
      setData(result);
    } catch (err) {
      showToast(err.message || "Failed to load attendance", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    const fetchSettings = async () => {
      setSettingsLoading(true);
      try {
        const result = await attendanceApi.getSettings();
        setSltLocationRequired(result.settings?.sltLocationRequired !== false);
      } catch (err) {
        showToast(err.message || "Failed to load attendance settings", "error");
      } finally {
        setSettingsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleToggleLocationRequirement = async () => {
    const nextValue = !sltLocationRequired;
    setSltLocationRequired(nextValue);
    setSettingsSaving(true);
    try {
      const result = await attendanceApi.updateSettings({
        sltLocationRequired: nextValue,
      });
      setSltLocationRequired(result.settings?.sltLocationRequired !== false);
      showToast(
        nextValue
          ? "SLT location requirement enabled for intern attendance"
          : "SLT location requirement disabled. Interns can mark attendance anywhere",
        "success",
      );
    } catch (err) {
      setSltLocationRequired(!nextValue);
      showToast(err.message || "Failed to update location setting", "error");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleExport = async () => {
    if (!data || data.count === 0) {
      showToast("No records to export for this date", "info");
      return;
    }
    setExporting(true);
    try {
      await attendanceApi.exportExcel(selectedDate);
      showToast("Excel report downloaded successfully", "success");
    } catch (err) {
      showToast(err.message || "Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleExportNonAttendance = async () => {
    setExportingNonAttendance(true);
    try {
      await attendanceApi.exportNonAttendanceExcel();
      showToast("Non-attendance Excel downloaded successfully", "success");
    } catch (err) {
      showToast(err.message || "Export failed", "error");
    } finally {
      setExportingNonAttendance(false);
    }
  };

  const addRecipient = () => {
    const trimmed = recipientInput.trim();
    if (!trimmed || recipients.includes(trimmed)) return;
    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      showToast("Please enter a valid email address", "error");
      return;
    }
    setRecipients((prev) => [...prev, trimmed]);
    setRecipientInput("");
  };

  const removeRecipient = (email) =>
    setRecipients((prev) => prev.filter((r) => r !== email));

  const toggleInternMeetings = (internId) => {
    setExpandedInterns((current) => ({
      ...current,
      [internId]: !current[internId],
    }));
  };

  const handleTriggerReport = async () => {
    if (recipients.length === 0) {
      showToast("Add at least one recipient", "error");
      return;
    }
    setTriggering(true);
    try {
      const result = await attendanceApi.triggerReport(recipients);
      if (result.success) {
        showToast(
          result.result?.emailSent
            ? `Report sent to ${recipients.length} recipient(s) ✓`
            : "Check complete — all interns attended (no email sent)",
          "success",
        );
        setShowTriggerModal(false);
      } else {
        showToast(result.error || "Trigger failed", "error");
      }
    } catch (err) {
      showToast(err.message || "Trigger failed", "error");
    } finally {
      setTriggering(false);
    }
  };

  const filtered = (data?.interns || []).filter((intern) => {
    const q = searchTerm.toLowerCase();
    return (
      intern.name.toLowerCase().includes(q) ||
      intern.id.toLowerCase().includes(q) ||
      intern.email.toLowerCase().includes(q) ||
      intern.team.toLowerCase().includes(q)
    );
  });
  const filteredDaily = (data?.dailyInterns || []).filter((intern) => {
    const q = searchTerm.toLowerCase();
    return (
      intern.name.toLowerCase().includes(q) ||
      intern.id.toLowerCase().includes(q) ||
      intern.email.toLowerCase().includes(q) ||
      intern.team.toLowerCase().includes(q)
    );
  });

  const formatDateLabel = (dateStr) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const blobs = [
    {
      cls: "w-80 h-80 bg-blue-100/40 -top-20 -left-20",
      dur: 15,
      dx: 20,
      dy: -30,
    },
    {
      cls: "w-96 h-96 bg-cyan-100/40 top-1/4 right-0",
      dur: 18,
      dx: -20,
      dy: 20,
      delay: 2,
    },
    {
      cls: "w-64 h-64 bg-green-100/40 bottom-20 left-1/4",
      dur: 20,
      dx: 15,
      dy: -20,
      delay: 1,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-gray-800 overflow-hidden">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {blobs.map((b, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full ${b.cls}`}
            animate={{ y: [0, b.dy, 0], x: [0, b.dx, 0] }}
            transition={{
              duration: b.dur,
              repeat: Infinity,
              ease: "easeInOut",
              delay: b.delay || 0,
            }}
          />
        ))}
      </div>

      <AnimatePresence>
        {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* ── Send Report Modal ── */}
      <AnimatePresence>
        {showTriggerModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) =>
              e.target === e.currentTarget && setShowTriggerModal(false)
            }
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md p-6"
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <FaBell className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      Send Non-Attendance Report
                    </h3>
                    <p className="text-xs text-gray-500">
                      Triggers the weekly email + Excel attachment
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTriggerModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-800">
                This will check all active interns for meeting attendance over
                the <strong>past 14 days</strong> and email a non-attendance
                report (Excel attached) to the recipients below.
              </div>

              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Recipients
              </label>
              <div className="flex flex-wrap gap-2 mb-3 min-h-[36px]">
                {recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-xs text-indigo-700 font-medium"
                  >
                    <span>{email}</span>
                    <button
                      onClick={() => removeRecipient(email)}
                      className="opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <FaTimes className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                {recipients.length === 0 && (
                  <span className="text-xs text-gray-400 italic">
                    No recipients added
                  </span>
                )}
              </div>

              <div className="flex space-x-2 mb-5">
                <input
                  type="email"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRecipient()}
                  placeholder="Add email address..."
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                />
                <motion.button
                  onClick={addRecipient}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Add
                </motion.button>
              </div>

              <div className="flex space-x-3">
                <motion.button
                  onClick={() => setShowTriggerModal(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handleTriggerReport}
                  disabled={triggering || recipients.length === 0}
                  whileHover={{ scale: triggering ? 1 : 1.02 }}
                  whileTap={{ scale: triggering ? 1 : 0.98 }}
                  className="flex-1 flex items-center justify-center space-x-2 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-sm font-semibold transition-all shadow-sm disabled:cursor-not-allowed"
                >
                  {triggering ? (
                    <>
                      <FaSpinner className="h-3.5 w-3.5 animate-spin" />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <FaRegPaperPlane className="h-3.5 w-3.5" />
                      <span>Send Report</span>
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page ── */}
      <div className="pt-2 sm:pt-4">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-[92rem] mx-auto space-y-4 md:space-y-5">
            {/* ── Header ── */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* ── Nav row: Back + Manual Attendance button ── */}
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <motion.button
                  onClick={() => navigate("/admin/dashboard")}
                  className="flex items-center space-x-2 px-3 py-2 bg-white/80 backdrop-blur-sm hover:bg-gray-50 rounded-xl border border-gray-200 shadow-sm transition-all"
                  whileHover={{ scale: 1.05, x: -5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaArrowLeft className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">
                    Back to Dashboard
                  </span>
                </motion.button>

                {/* ── NEW: Manual Attendance shortcut ── */}
                <motion.button
                  onClick={() => navigate("/admin/manual-attendance")}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaEdit className="h-3.5 w-3.5" />
                  Manual Attendance
                </motion.button>
              </div>

              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">
                  Attendance Management
                </span>
              </h2>
              <p className="text-gray-600 text-sm md:text-base">
                Review daily and meeting attendance records separately
              </p>
            </motion.div>

            {/* SLT Location Toggle */}
            <motion.div
              className="flex justify-end"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03, duration: 0.25 }}
            >
              <div className="inline-flex items-center gap-3 rounded-lg border border-gray-200 bg-white/90 px-3 py-2 shadow-sm">
                <div className="inline-flex items-center gap-2">
                  <FaMapMarkerAlt
                    className={`h-3.5 w-3.5 ${sltLocationRequired ? "text-blue-600" : "text-gray-400"}`}
                  />
                  <span className="text-xs font-semibold text-gray-700">
                    SLT location
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sltLocationRequired ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}
                  >
                    {sltLocationRequired ? "Required" : "Off"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLocationRequirement}
                  disabled={settingsLoading || settingsSaving}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${sltLocationRequired ? "bg-blue-600" : "bg-gray-300"}`}
                  aria-pressed={sltLocationRequired}
                  aria-label="Toggle SLT location requirement"
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${sltLocationRequired ? "translate-x-5" : "translate-x-0.5"}`}
                  />
                  <span className="sr-only">
                    {sltLocationRequired
                      ? "Location required"
                      : "Location not required"}
                  </span>
                </button>
              </div>
            </motion.div>

            {/* Non-Attendance Report section divider */}
            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05, duration: 0.3 }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">
                Non-Attendance Report
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </motion.div>

            {/* Non-Attendance Report card */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              <div className="px-4 md:px-6 py-3.5 border-b border-gray-100 bg-gradient-to-r from-indigo-50/70 to-purple-50/40 flex items-center space-x-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <FaChartBar className="h-3 w-3 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Non-Attendance Report
                  </h3>
                  <p className="text-xs text-gray-500">
                    Interns who missed meetings in the past 14 days
                  </p>
                </div>
              </div>
              <div className="px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-gray-500 max-w-sm">
                  Download or email the non-attendance report for all active
                  interns over the{" "}
                  <span className="font-medium text-gray-700">
                    past 14 days
                  </span>
                  .
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <motion.button
                    onClick={handleExportNonAttendance}
                    disabled={exportingNonAttendance}
                    whileHover={{ scale: exportingNonAttendance ? 1 : 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:cursor-not-allowed"
                  >
                    {exportingNonAttendance ? (
                      <FaSpinner className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FaFileExcel className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {exportingNonAttendance ? "Exporting…" : "Export Report"}
                    </span>
                  </motion.button>
                  <motion.button
                    onClick={() => setShowTriggerModal(true)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm"
                  >
                    <FaRegPaperPlane className="h-3.5 w-3.5" />
                    <span>Share Report</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Daily Attendance section divider */}
            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">
                Attendance Records
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </motion.div>

            {/* Toolbar */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              <div className="px-4 md:px-6 py-3.5 border-b border-gray-100 bg-gradient-to-r from-blue-50/70 to-cyan-50/40 flex items-center space-x-3">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <FaCalendarCheck className="h-3 w-3 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Attendance Filters
                  </h3>
                  <p className="text-xs text-gray-500">
                    Filter daily and meeting attendance by date or intern
                  </p>
                </div>
              </div>
              <div className="p-4 md:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                    {/* Date picker */}
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                        Filter by Date
                      </label>
                      <div className="flex items-center space-x-2">
                        <div className="relative">
                          <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 pointer-events-none" />
                          <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-gray-900 text-sm shadow-sm"
                          />
                        </div>
                        {selectedDate !== today && (
                          <motion.button
                            onClick={() => setSelectedDate(today)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-medium transition-colors"
                          >
                            Today
                          </motion.button>
                        )}
                      </div>
                    </div>
                    {/* Search */}
                    <div className="flex-1 sm:max-w-xs">
                      <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                        Search Interns
                      </label>
                      <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Name, ID or email…"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm shadow-sm"
                        />
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <FaTimes className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 sm:max-w-[13rem]">
                      <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                        Attendance Type
                      </label>
                      <select
                        value={attendanceFilter}
                        onChange={(e) => setAttendanceFilter(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm shadow-sm"
                      >
                        <option value="all">All attendance</option>
                        <option value="daily">Daily attendance</option>
                        <option value="meeting">Meeting attendance</option>
                      </select>
                    </div>
                  </div>
                  {/* Export */}
                  <div className="flex flex-wrap gap-2">
                    <motion.button
                      onClick={handleExport}
                      disabled={exporting || !data || data.count === 0}
                      whileHover={{
                        scale:
                          exporting || !data || data.count === 0 ? 1 : 1.04,
                      }}
                      whileTap={{ scale: 0.96 }}
                      className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:cursor-not-allowed"
                    >
                      {exporting ? (
                        <FaSpinner className="h-4 w-4 animate-spin" />
                      ) : (
                        <FaFileExcel className="h-4 w-4" />
                      )}
                      <span>Export Meeting List</span>
                      {data && data.count > 0 && (
                        <span className="bg-white/25 px-1.5 py-0.5 rounded-full text-xs">
                          {data.count}
                        </span>
                      )}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ══════════════════════════════════════════════════
                DAILY ATTENDANCE TABLE
            ══════════════════════════════════════════════════ */}
            {attendanceFilter !== "meeting" && (
              <motion.div
                className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.3 }}
              >
                <div className="px-4 md:px-6 py-4 border-b border-gray-200">
                  <h2 className="text-base md:text-lg font-semibold text-gray-900">
                    Daily Attendance — {formatDateLabel(selectedDate)}
                  </h2>
                  {!loading && data && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {searchTerm
                        ? `${filteredDaily.length} of ${data.dailyCount || 0} shown`
                        : `${data.dailyCount || 0} intern${data.dailyCount !== 1 ? "s" : ""} marked for the day`}
                    </p>
                  )}
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <FaSpinner className="mr-2 h-4 w-4 animate-spin" />
                    <span className="text-sm">Fetching daily attendance…</span>
                  </div>
                ) : filteredDaily.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 px-4">
                    <FaCalendarCheck className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                    <h3 className="text-sm font-medium text-gray-600">
                      No daily attendance records
                    </h3>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="w-10 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                          <th className="min-w-[16rem] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Intern</th>
                          <th className="min-w-[16rem] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                          <th className="min-w-[12rem] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Team / Field</th>
                          <th className="w-28 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                          <th className="w-28 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredDaily.map((intern, idx) => (
                          <tr key={intern._id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-4 text-sm text-gray-400 font-mono">{idx + 1}</td>
                            <td className="px-4 py-4">
                              <p className="text-sm font-semibold text-gray-900">{intern.name}</p>
                              <p className="text-xs text-gray-500">{intern.id}</p>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-700">{intern.email}</td>
                            <td className="px-4 py-4">
                              <p className="text-sm font-medium text-gray-800">{intern.team}</p>
                              <p className="text-xs text-gray-500">{intern.fieldOfSpecialization}</p>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-700">{intern.timeMarked}</td>
                            <td className="px-4 py-4"><TypeBadge type={intern.type} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {/* ══════════════════════════════════════════════════
                MEETING ATTENDANCE TABLE
            ══════════════════════════════════════════════════ */}
            {attendanceFilter !== "daily" && (
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-base md:text-lg font-semibold text-gray-900">
                    {loading
                      ? "Loading…"
                      : data
                        ? `Meeting Attendance — ${formatDateLabel(selectedDate)}`
                        : "Meeting Attendance Records"}
                  </h2>
                  {!loading && data && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {searchTerm
                        ? `${filtered.length} of ${data.count} shown`
                        : `${data.count} intern${data.count !== 1 ? "s" : ""} marked present`}
                    </p>
                  )}
                </div>
                {loading && (
                  <FaSpinner className="animate-spin text-blue-500 h-5 w-5" />
                )}
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-10 h-10 border-t-4 border-b-4 border-blue-400 rounded-full mb-4"
                  />
                  <p className="text-sm">Fetching attendance…</p>
                </div>
              ) : !data || data.count === 0 ? (
                <div className="text-center py-16 bg-gray-50 px-4">
                  <FaCalendarCheck className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-base font-medium text-gray-600 mb-1">
                    No attendance records
                  </h3>
                  <p className="text-sm text-gray-400">
                    No interns were marked present on{" "}
                    {formatDateLabel(selectedDate)}.
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 px-4">
                  <FaSearch className="mx-auto h-10 w-10 text-gray-300 mb-4" />
                  <h3 className="text-base font-medium text-gray-600 mb-1">
                    No results
                  </h3>
                  <p className="text-sm text-gray-400">
                    Try a different search term.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="block lg:hidden">
                    <div className="divide-y divide-gray-100">
                      {filtered.map((intern) => (
                        <motion.div
                          key={intern._id}
                          className="p-4 hover:bg-gray-50 transition-colors"
                          whileHover={{ y: -1 }}
                          transition={{ duration: 0.1 }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <div className="h-9 w-9 rounded-full bg-gradient-to-r from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                                <FaUser className="text-indigo-600 text-xs" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">
                                  {intern.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {intern.id}
                                </p>
                              </div>
                            </div>
                            <TypeBadge type={intern.type} />
                          </div>
                          <div className="ml-12 space-y-0.5">
                            <p className="text-xs text-gray-600 truncate">
                              📧 {intern.email}
                            </p>
                            <p className="text-xs text-gray-500">
                              🎓 {intern.fieldOfSpecialization}
                            </p>
                            <p className="text-xs text-gray-500">
                              👥 {intern.team}
                            </p>
                            {intern.timeMarked !== "—" && (
                              <p className="text-xs text-gray-500">
                                🕐 {intern.timeMarked}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleInternMeetings(intern._id)}
                              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                            >
                              <span>
                                {intern.meetingCount ||
                                  intern.meetings?.length ||
                                  0}{" "}
                                meeting
                                {(intern.meetingCount ||
                                  intern.meetings?.length ||
                                  0) !== 1
                                  ? "s"
                                  : ""}
                              </span>
                              <FaChevronDown
                                className={`h-3 w-3 transition-transform ${expandedInterns[intern._id] ? "rotate-180" : ""}`}
                              />
                            </button>
                            {expandedInterns[intern._id] && (
                              <div className="mt-2 space-y-1 rounded-xl border border-blue-100 bg-blue-50/50 p-2">
                                {(intern.meetings || []).map(
                                  (meeting, index) => (
                                    <div
                                      key={`${intern._id}-${meeting.meetingName}-${index}`}
                                      className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs"
                                    >
                                      <span className="font-medium text-gray-800">
                                        {meeting.meetingName}
                                      </span>
                                      <span className="text-gray-500">
                                        {meeting.timeMarked}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Desktop table */}
                  <div className="hidden lg:block w-full">
                    <table className="w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="w-10 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            #
                          </th>
                          <th className="min-w-[18rem] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Intern
                          </th>
                          <th className="min-w-[18rem] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Contact
                          </th>
                          <th className="min-w-[14rem] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Team / Field
                          </th>
                          <th className="min-w-[14rem] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Institute
                          </th>
                          <th className="w-28 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Meetings
                          </th>
                          <th className="w-36 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filtered.map((intern, idx) => (
                          <React.Fragment key={intern._id}>
                            <motion.tr
                              className="hover:bg-gray-50 transition-colors"
                              whileHover={{ y: -1 }}
                              transition={{ duration: 0.1 }}
                            >
                              <td className="px-4 py-4 text-sm text-gray-400 font-mono">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center space-x-3 min-w-0">
                                  <div className="h-9 w-9 rounded-full bg-gradient-to-r from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                                    <FaUser className="text-indigo-600 text-xs" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                      {intern.name}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                      {intern.id}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <p
                                  className="text-sm text-gray-800 truncate"
                                  title={intern.email}
                                >
                                  {intern.email}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <p className="text-sm font-medium text-gray-800 truncate">
                                  {intern.team}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {intern.fieldOfSpecialization}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <p className="text-sm text-gray-700 truncate">
                                  {intern.institute}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleInternMeetings(intern._id)
                                  }
                                  className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                                >
                                  <span>
                                    {intern.meetingCount ||
                                      intern.meetings?.length ||
                                      0}
                                  </span>
                                  <FaChevronDown
                                    className={`h-3 w-3 transition-transform ${expandedInterns[intern._id] ? "rotate-180" : ""}`}
                                  />
                                </button>
                              </td>
                              <td className="px-4 py-4">
                                <TypeBadge type={intern.type} />
                              </td>
                            </motion.tr>
                            {expandedInterns[intern._id] && (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="bg-blue-50/40 px-4 py-3"
                                >
                                  <div className="ml-14 rounded-xl border border-blue-100 bg-white p-3">
                                    <div className="grid grid-cols-[1fr_8rem_8rem] px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                      <div>Meeting Name</div>
                                      <div className="text-center">Time</div>
                                      <div className="text-right">Type</div>
                                    </div>
                                    <div className="space-y-2">
                                      {(intern.meetings || []).map(
                                        (meeting, index) => (
                                          <div
                                            key={`${intern._id}-${meeting.meetingName}-${index}`}
                                            className="grid grid-cols-[1fr_8rem_8rem] items-center rounded-lg bg-gray-50 px-2 py-2 text-sm"
                                          >
                                            <div className="font-medium text-gray-900">
                                              {meeting.meetingName}
                                            </div>
                                            <div className="flex items-center justify-center gap-1.5 text-gray-600">
                                              <FaClock className="h-3 w-3 text-gray-400" />
                                              {meeting.timeMarked}
                                            </div>
                                            <div className="text-right">
                                              <TypeBadge type={meeting.type} />
                                            </div>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-4 md:px-6 py-3 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs text-gray-500 text-center">
                      Showing {filtered.length} present intern
                      {filtered.length !== 1 ? "s" : ""} for{" "}
                      {formatDateLabel(selectedDate)}
                    </p>
                  </div>
                </>
              )}
            </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminInternAttendance;
