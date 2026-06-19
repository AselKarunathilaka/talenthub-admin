import React, { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  FaArrowLeft,
  FaSearch,
  FaCalendarCheck,
  FaUpload,
  FaUsers,
  FaSpinner,
  FaCheckCircle,
  FaTimesCircle,
  FaTimes,
  FaClipboardList,
  FaVideo,
  FaUser,
  FaChevronRight,
  FaLayerGroup,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../api/apiConfig";
import AdminNavigation from "../components/AdminNavigation";


// ── Auth ─────────────────────────────────────────────────────────────────────
const getAuthHeaders = () => {
  const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
  return {
    "Content-Type": "application/json",
    ...(adminInfo.token && { Authorization: `Bearer ${adminInfo.token}` }),
  };
};

// ── Local today (timezone-safe) ───────────────────────────────────────────────
const getLocalToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ── API ───────────────────────────────────────────────────────────────────────
const manualAttendanceApi = {
  searchIntern: async (query) => {
    const res = await fetch(
      `${API_BASE_URL}/admin/manual-attendance/search?q=${encodeURIComponent(query)}`,
      { headers: getAuthHeaders() },
    );
    if (!res.ok) throw new Error((await res.json()).error || "Search failed");
    return res.json();
  },

  markAttendance: async (payload) => {
    const res = await fetch(`${API_BASE_URL}/admin/manual-attendance/mark`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Mark failed");
    return res.json();
  },

  bulkMarkAttendance: async (payload) => {
    const res = await fetch(
      `${API_BASE_URL}/admin/manual-attendance/bulk-mark`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok)
      throw new Error((await res.json()).error || "Bulk mark failed");
    return res.json();
  },
};

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ toast, onClose }) => {
  React.useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  const styles = {
    success: "bg-emerald-50 border-emerald-300 text-emerald-800",
    error: "bg-red-50 border-red-300 text-red-800",
    info: "bg-blue-50 border-blue-300 text-blue-800",
  };

  return (
    <motion.div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl max-w-sm backdrop-blur-sm ${styles[toast.type]}`}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
    >
      {toast.type === "success" && (
        <FaCheckCircle className="h-4 w-4 flex-shrink-0" />
      )}
      {toast.type === "error" && (
        <FaTimesCircle className="h-4 w-4 flex-shrink-0" />
      )}
      <span className="text-sm font-medium flex-1">{toast.text}</span>
      <button onClick={onClose} className="opacity-50 hover:opacity-100">
        <FaTimes className="h-3 w-3" />
      </button>
    </motion.div>
  );
};

// ── Intern Search Result Card ─────────────────────────────────────────────────
const InternCard = ({ intern, onSelect, selected }) => (
  <motion.button
    onClick={() => onSelect(intern)}
    className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
      selected
        ? "border-blue-400 bg-blue-50 shadow-sm"
        : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
    }`}
    whileHover={{ y: -1 }}
    whileTap={{ scale: 0.99 }}
  >
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0">
        <FaUser className="text-indigo-500 text-xs" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {intern.Trainee_Name}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {intern.Trainee_ID} · {intern.Institute || "—"} ·{" "}
          {intern.field_of_spec_name || "—"}
        </p>
      </div>
      {selected && (
        <FaCheckCircle className="text-blue-500 h-4 w-4 flex-shrink-0" />
      )}
    </div>
  </motion.button>
);

// ── Mode Selector ─────────────────────────────────────────────────────────────
const ModeSelector = ({ mode, onChange }) => {
  const options = [
    {
      key: "daily",
      label: "Daily Attendance",
      sub: "Mark intern's daily check-in",
      icon: FaClipboardList,
      // Inline gradient styles for active state
      activeGradient: "linear-gradient(135deg, #06b6d4, #3b82f6)",
      activeShadow: "0 8px 24px rgba(6,182,212,0.35)",
      // Inactive colours
      inactiveBorder: "#a5f3fc",
      inactiveBg: "#ecfeff",
      inactiveIcon: "#0891b2",
      inactiveText: "#0e7490",
    },
    {
      key: "meeting",
      label: "Meeting Attendance",
      sub: "Mark intern's meeting presence",
      icon: FaVideo,
      activeGradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
      activeShadow: "0 8px 24px rgba(99,102,241,0.35)",
      inactiveBorder: "#c7d2fe",
      inactiveBg: "#eef2ff",
      inactiveIcon: "#6366f1",
      inactiveText: "#4338ca",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => {
        const isActive = mode === opt.key;
        const Icon = opt.icon;
        return (
          <motion.button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            style={
              isActive
                ? {
                    background: opt.activeGradient,
                    boxShadow: opt.activeShadow,
                    border: "2px solid transparent",
                  }
                : {
                    background: opt.inactiveBg,
                    border: `2px solid ${opt.inactiveBorder}`,
                    boxShadow: "none",
                  }
            }
            className="relative flex flex-col items-center gap-2 p-5 rounded-2xl transition-all text-center"
          >
            {/* Icon container */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: isActive ? "rgba(255,255,255,0.2)" : "#ffffff",
                boxShadow: isActive ? "none" : "0 1px 4px rgba(0,0,0,0.08)",
              }}
            >
              <Icon
                className="h-5 w-5"
                style={{ color: isActive ? "#ffffff" : opt.inactiveIcon }}
              />
            </div>

            {/* Text */}
            <div>
              <p
                className="text-sm font-bold"
                style={{ color: isActive ? "#ffffff" : opt.inactiveText }}
              >
                {opt.label}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{
                  color: isActive
                    ? "rgba(255,255,255,0.8)"
                    : opt.inactiveText + "99",
                }}
              >
                {opt.sub}
              </p>
            </div>

            {/* Active checkmark badge */}
            {isActive && (
              <motion.div
                className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-white/30 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <FaCheckCircle className="h-3 w-3 text-white" />
              </motion.div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};

// ── Input Mode Selector (Single vs Bulk) ──────────────────────────────────────
const InputModeSelector = ({ inputMode, onChange }) => {
  const options = [
    {
      key: "single",
      label: "Single",
      sub: "Mark one at a time",
      icon: FaUser,
      activeGradient: "linear-gradient(135deg, #3b82f6, #6366f1)",
      activeShadow: "0 6px 18px rgba(59,130,246,0.35)",
      inactiveBorder: "#e2e8f0",
      inactiveBg: "#ffffff",
      inactiveIcon: "#94a3b8",
      inactiveText: "#475569",
    },
    {
      key: "bulk",
      label: "Bulk",
      sub: "Mark multiple at once",
      icon: FaLayerGroup,
      activeGradient: "linear-gradient(135deg, #3b82f6, #6366f1)",
      activeShadow: "0 6px 18px rgba(59,130,246,0.35)",
      inactiveBorder: "#e2e8f0",
      inactiveBg: "#ffffff",
      inactiveIcon: "#94a3b8",
      inactiveText: "#475569",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const isActive = inputMode === opt.key;
        const Icon = opt.icon;
        return (
          <motion.button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={
              isActive
                ? {
                    background: opt.activeGradient,
                    boxShadow: opt.activeShadow,
                    border: "2px solid transparent",
                  }
                : {
                    background: opt.inactiveBg,
                    border: `2px solid ${opt.inactiveBorder}`,
                    boxShadow: "none",
                  }
            }
            className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl transition-all"
          >
            <Icon
              className="h-3.5 w-3.5 flex-shrink-0"
              style={{ color: isActive ? "#ffffff" : opt.inactiveIcon }}
            />
            <div className="text-left">
              <p
                className="text-xs font-bold leading-tight"
                style={{ color: isActive ? "#ffffff" : opt.inactiveText }}
              >
                {opt.label}
              </p>
              <p
                className="text-[10px] leading-tight mt-0.5"
                style={{
                  color: isActive
                    ? "rgba(255,255,255,0.75)"
                    : opt.inactiveText + "88",
                }}
              >
                {opt.sub}
              </p>
            </div>
            {isActive && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="ml-auto"
              >
                <FaCheckCircle className="h-3.5 w-3.5 text-white/80" />
              </motion.div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const AdminManualAttendance = () => {
  const navigate = useNavigate();
  const today = getLocalToday();
  const searchDebounce = useRef(null);

  const [inputMode, setInputMode] = useState("single");
  const [mode, setMode] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(today);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [status, setStatus] = useState("Present");
  const [meetingName, setMeetingName] = useState("");
  const [marking, setMarking] = useState(false);
  const [toast, setToast] = useState(null);
  const [recentMarks, setRecentMarks] = useState([]);
  const [bulkInternIds, setBulkInternIds] = useState("");
  const [bulkResults, setBulkResults] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedExcelFileName, setUploadedExcelFileName] = useState("");

  const showToast = (text, type = "info") => setToast({ text, type });

  // ── Search ──────────────────────────────────────────────────────────────
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await manualAttendanceApi.searchIntern(query);
        setSearchResults(data.interns || []);
      } catch (err) {
        showToast(err.message || "Search failed", "error");
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  }, []);

  const handleSelectIntern = (intern) => {
    setSelectedIntern(intern);
    setSearchQuery(intern.Trainee_Name);
    setSearchResults([]);
  };

  // ── Mark Attendance ─────────────────────────────────────────────────────
  const handleMark = async () => {
    if (!selectedIntern) {
      showToast("Please select an intern first", "error");
      return;
    }
    if (mode === "meeting" && !meetingName.trim()) {
      showToast("Please enter a meeting name", "error");
      return;
    }

    setMarking(true);
    try {
      const payload = {
        internId: selectedIntern._id,
        date: selectedDate,
        status,
        mode,
        ...(mode === "meeting" && { meetingName: meetingName.trim() }),
      };

      await manualAttendanceApi.markAttendance(payload);

      showToast(
        `${status} marked for ${selectedIntern.Trainee_Name} (${mode === "daily" ? "daily" : "meeting"})`,
        "success",
      );

      setRecentMarks((prev) => [
        {
          id: Date.now(),
          internName: selectedIntern.Trainee_Name,
          internId: selectedIntern.Trainee_ID,
          mode,
          status,
          date: selectedDate,
          meetingName: mode === "meeting" ? meetingName.trim() : null,
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        ...prev.slice(0, 9),
      ]);

      setSelectedIntern(null);
      setSearchQuery("");
      setMeetingName("");
    } catch (err) {
      showToast(err.message || "Failed to mark attendance", "error");
    } finally {
      setMarking(false);
    }
  };

  // ── Bulk Mark Attendance ────────────────────────────────────────────────
  const handleBulkMark = async () => {
    const ids = bulkInternIds
      .split(/[\n,]+/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (ids.length === 0) {
      showToast("Please enter at least one intern ID", "error");
      return;
    }

    if (mode === "meeting" && !meetingName.trim()) {
      showToast("Please enter a meeting name", "error");
      return;
    }

    setMarking(true);
    try {
      const payload = {
        internIds: ids,
        date: selectedDate,
        status,
        mode,
        ...(mode === "meeting" && { meetingName: meetingName.trim() }),
      };

      const result = await manualAttendanceApi.bulkMarkAttendance(payload);

      setBulkResults(result);

      const successCount = result.results.filter((r) => r.success).length;
      const failureCount = result.results.filter((r) => !r.success).length;

      showToast(
        `${successCount} marked successfully${failureCount > 0 ? `, ${failureCount} failed` : ""}`,
        failureCount === 0 ? "success" : "info",
      );

      const successfulMarks = result.results
        .filter((r) => r.success)
        .map((r) => ({
          id: Date.now() + Math.random(),
          internName: r.internName,
          internId: r.internId,
          mode,
          status,
          date: selectedDate,
          meetingName: mode === "meeting" ? meetingName.trim() : null,
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));

      setRecentMarks((prev) => [
        ...successfulMarks,
        ...prev.slice(0, 10 - successfulMarks.length),
      ]);

      setBulkInternIds("");
    } catch (err) {
      showToast(err.message || "Failed to mark bulk attendance", "error");
      setBulkResults(null);
    } finally {
      setMarking(false);
    }
  };

  const handleTxtUpload = async (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  try {
    const text = await file.text();

    const ids = text
      .split(/[\n,\r]+/)
      .map((id) => id.trim())
      .filter(Boolean);

    setBulkInternIds(ids.join("\n"));
    setUploadedFileName(file.name);

    showToast(
      `${ids.length} IDs loaded from file`,
      "success"
    );
  } catch (error) {
    showToast(
      "Failed to read TXT file",
      "error"
    );
  }
};

const handleExcelUpload = async (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  try {
    const data = await file.arrayBuffer();

    const workbook = XLSX.read(data, {
      type: "array",
    });

    const sheetName = workbook.SheetNames[0];

    const worksheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
    });

    const headerRowIndex = rows.findIndex(
      (row) =>
        String(row[0] || "").trim() === "Intern ID" &&
        String(row[2] || "").trim() === "Status"
    );

    if (headerRowIndex === -1) {
      showToast(
        "Could not find Intern ID / Status columns",
        "error"
      );
      return;
    }

    const presentIds = [];

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];

      const internId = String(row[0] || "").trim();
      const status = String(row[2] || "").trim();

      // Stop when Attendance Summary is reached
      if (
        internId.toLowerCase().includes("attendance summary")
      ) {
        break;
      }

      if (
        internId &&
        status.toLowerCase() === "present"
      ) {
        presentIds.push(internId);
      }
    }

    setBulkInternIds(presentIds.join("\n"));

    setUploadedExcelFileName(file.name);

    showToast(
      `${presentIds.length} present interns loaded`,
      "success"
    );
  } catch (error) {
    console.error(error);

    showToast(
      "Failed to read Excel file",
      "error"
    );
  }
};


  const canSubmitSingle =
    selectedIntern &&
    selectedDate &&
    (mode === "daily" || (mode === "meeting" && meetingName.trim()));

  const canSubmitBulk =
    bulkInternIds.trim().length > 0 &&
    selectedDate &&
    (mode === "daily" || (mode === "meeting" && meetingName.trim()));

  const canSubmit = inputMode === "single" ? canSubmitSingle : canSubmitBulk;

  // Submit button gradient matches the selected attendance mode
  const submitGradient =
    mode === "daily"
      ? "linear-gradient(135deg, #06b6d4, #3b82f6)"
      : "linear-gradient(135deg, #6366f1, #8b5cf6)";

  return (
    <AdminNavigation>
      <div className="min-h-screen bg-slate-50 font-sans text-gray-800 pb-10 flex flex-col">
        <AnimatePresence>
          {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
        </AnimatePresence>

        <div className="flex-1 w-full lg:mt-4 lg:px-6 xl:px-10">
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
            {/* ── Header ── */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-8"
            >
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                  Manual Attendance
                </span>
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                Mark daily or meeting attendance for individual interns
              </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-[1fr_1fr_400px] gap-5 sm:gap-6">
              {/* ── Left: Form ── */}
              <div className="space-y-5 lg:col-span-2 xl:col-span-2">
            {/* Input mode selector */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.02 }}
            >
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Input Mode
              </label>
              <InputModeSelector
                inputMode={inputMode}
                onChange={setInputMode}
              />
            </motion.div>

            {/* Attendance type selector */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Attendance Type
              </label>
              <ModeSelector
                mode={mode}
                onChange={(m) => {
                  setMode(m);
                  setMeetingName("");
                }}
              />
            </motion.div>

            {/* Date */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Date
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent focus:bg-white transition-all"
                />
                {selectedDate !== today && (
                  <motion.button
                    onClick={() => setSelectedDate(today)}
                    className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition-colors border border-blue-200"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    Today
                  </motion.button>
                )}
              </div>
            </motion.div>

            {/* Intern Search (SINGLE mode) */}
            {inputMode === "single" && (
              <motion.div
                className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  Search Intern
                </label>
                <div className="relative">
                  <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      handleSearch(e.target.value);
                      if (selectedIntern) setSelectedIntern(null);
                    }}
                    placeholder="Type ID, name or email…"
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent focus:bg-white transition-all"
                  />
                  {searchLoading && (
                    <FaSpinner className="absolute right-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-400 animate-spin" />
                  )}
                  {searchQuery && !searchLoading && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults([]);
                        setSelectedIntern(null);
                      }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <FaTimes className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Search Results */}
                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.div
                      className="mt-2 space-y-1.5 max-h-56 overflow-y-auto pr-1"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {searchResults.map((intern) => (
                        <InternCard
                          key={intern._id}
                          intern={intern}
                          onSelect={handleSelectIntern}
                          selected={selectedIntern?._id === intern._id}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Selected intern display */}
                <AnimatePresence>
                  {selectedIntern && (
                    <motion.div
                      className="mt-3 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                    >
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-200 to-blue-200 flex items-center justify-center flex-shrink-0">
                        <FaUser className="text-indigo-600 text-xs" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-blue-900 truncate">
                          {selectedIntern.Trainee_Name}
                        </p>
                        <p className="text-xs text-blue-600 truncate">
                          {selectedIntern.Trainee_ID} ·{" "}
                          {selectedIntern.team || "No team"}
                        </p>
                      </div>
                      <FaCheckCircle className="text-blue-500 h-4 w-4 flex-shrink-0" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {searchQuery &&
                  !searchLoading &&
                  searchResults.length === 0 &&
                  !selectedIntern && (
                    <p className="text-xs text-gray-400 mt-2 text-center py-2">
                      No interns found matching "{searchQuery}"
                    </p>
                  )}
              </motion.div>
            )}

            {/* Bulk Input (BULK mode) */}
            {inputMode === "bulk" && (
              <motion.div
                className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  Intern IDs <span className="text-red-400">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Enter IDs separated by comma or newline
                </p>
                <textarea
                  value={bulkInternIds}
                  onChange={(e) => setBulkInternIds(e.target.value)}
                  placeholder={`ID001, ID002, ID003\nor\nID001\nID002\nID003`}
                  className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent focus:bg-white transition-all resize-none font-mono"
                />
                {bulkInternIds.trim().length > 0 && (
                  <p className="text-xs text-blue-600 mt-2">
                    {
                      bulkInternIds
                        .split(/[\n,]+/)
                        .filter((id) => id.trim().length > 0).length
                    }{" "}
                    IDs detected
                  </p>
                )}
                
                <div className="mt-3">
                  <label className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl cursor-pointer hover:bg-blue-100 transition-all">
                    <FaUpload className="text-blue-600" />

                    <span className="text-sm font-medium text-blue-700">

                    </span>

                    <input
                      type="file"
                      accept=".txt"
                      className="hidden"
                      onChange={handleTxtUpload}
                    />
                  </label>

                  {uploadedFileName && (
                    <p className="mt-2 text-xs text-green-600">
                      Loaded: {uploadedFileName}
                    </p>
                  )}
                </div>   

                <div className="mt-3">
                    <label className="flex items-center justify-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl cursor-pointer hover:bg-green-100 transition-all">
                      <FaUpload className="text-green-600" />

                      <span className="text-sm font-medium text-green-700">
                        Upload Attendance Excel
                      </span>

                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleExcelUpload}
                      />
                    </label>

                    {uploadedExcelFileName && (
                      <p className="mt-2 text-xs text-green-600">
                        Loaded: {uploadedExcelFileName}
                      </p>
                    )}
                  </div>             
                
              </motion.div>
            )}

            {/* Meeting Name (only for meeting mode) */}
            <AnimatePresence>
              {mode === "meeting" && (
                <motion.div
                  className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5"
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                    Meeting Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={meetingName}
                    onChange={(e) => setMeetingName(e.target.value)}
                    placeholder="e.g. Weekly Standup, Project Review…"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent focus:bg-white transition-all"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Status
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    val: "Present",
                    icon: FaCheckCircle,
                    activeClass:
                      "bg-emerald-500 text-white border-transparent shadow-lg shadow-emerald-200",
                    inactiveClass:
                      "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300",
                  },
                  {
                    val: "Absent",
                    icon: FaTimesCircle,
                    activeClass:
                      "bg-red-500 text-white border-transparent shadow-lg shadow-red-200",
                    inactiveClass:
                      "bg-red-50 text-red-700 border-red-200 hover:border-red-300",
                  },
                ].map(({ val, icon: Icon, activeClass, inactiveClass }) => (
                  <motion.button
                    key={val}
                    onClick={() => setStatus(val)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className={`flex items-center justify-center gap-2.5 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${status === val ? activeClass : inactiveClass}`}
                  >
                    <Icon className="h-4 w-4" />
                    {val}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Submit */}
            <motion.button
              onClick={inputMode === "single" ? handleMark : handleBulkMark}
              disabled={!canSubmit || marking}
              whileHover={{ scale: canSubmit && !marking ? 1.02 : 1 }}
              whileTap={{ scale: canSubmit && !marking ? 0.98 : 1 }}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl text-white text-sm font-bold transition-all shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: canSubmit && !marking ? submitGradient : "#d1d5db",
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              {marking ? (
                <>
                  <FaSpinner className="h-4 w-4 animate-spin" />
                  Marking…
                </>
              ) : (
                <>
                  {mode === "daily" ? (
                    <FaClipboardList className="h-4 w-4" />
                  ) : (
                    <FaVideo className="h-4 w-4" />
                  )}
                  {inputMode === "single" ? "Mark" : "Bulk Mark"} {status} ·{" "}
                  {mode === "daily" ? "Daily" : "Meeting"}
                </>
              )}
            </motion.button>

            {/* Bulk Results */}
            <AnimatePresence>
              {bulkResults && (
                <motion.div
                  className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">
                    Bulk Mark Results
                  </h3>
                  <div className="space-y-2">
                    {bulkResults.results.map((result, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
                          result.success
                            ? "bg-emerald-50 border border-emerald-200"
                            : "bg-red-50 border border-red-200"
                        }`}
                      >
                        {result.success ? (
                          <FaCheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <FaTimesCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs font-semibold truncate ${
                              result.success
                                ? "text-emerald-800"
                                : "text-red-800"
                            }`}
                          >
                            {result.internId}
                          </p>
                          {result.internName && (
                            <p
                              className={`text-[11px] truncate ${
                                result.success
                                  ? "text-emerald-600"
                                  : "text-red-600"
                              }`}
                            >
                              {result.internName}
                            </p>
                          )}
                        </div>
                        {!result.success && result.error && (
                          <span className="text-[10px] text-red-600 flex-shrink-0 max-w-[100px] text-right">
                            {result.error}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Right: Recent Activity ── */}
          <motion.div
            className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-fit"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-slate-50">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <FaCalendarCheck className="h-3.5 w-3.5 text-blue-500" />
                Recent Marks
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">This session only</p>
            </div>

            {recentMarks.length === 0 ? (
              <div className="px-5 py-12 text-center text-gray-400">
                <FaClipboardList className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-xs">No marks yet in this session</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
                <AnimatePresence initial={false}>
                  {recentMarks.map((mark) => (
                    <motion.div
                      key={mark.id}
                      className="px-5 py-3.5"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            mark.status === "Present"
                              ? "bg-emerald-100"
                              : "bg-red-100"
                          }`}
                        >
                          {mark.status === "Present" ? (
                            <FaCheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <FaTimesCircle className="h-3.5 w-3.5 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {mark.internName}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {mark.internId} · {mark.date}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                mark.mode === "daily"
                                  ? "bg-cyan-100 text-cyan-700"
                                  : "bg-indigo-100 text-indigo-700"
                              }`}
                            >
                              {mark.mode === "daily" ? "Daily" : "Meeting"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                mark.status === "Present"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {mark.status}
                            </span>
                            {mark.meetingName && (
                              <span className="text-[10px] text-gray-400 truncate max-w-[100px]">
                                "{mark.meetingName}"
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                          {mark.timestamp}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  </AdminNavigation>
  );
};

export default AdminManualAttendance;
