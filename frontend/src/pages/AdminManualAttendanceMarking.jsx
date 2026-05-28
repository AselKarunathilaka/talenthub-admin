import React, { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaSearch,
  FaCalendarCheck,
  FaUsers,
  FaSpinner,
  FaCheckCircle,
  FaTimesCircle,
  FaTimes,
  FaClipboardList,
  FaVideo,
  FaUser,
  FaChevronRight,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../api/apiConfig";

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
const ModeSelector = ({ mode, onChange }) => (
  <div className="grid grid-cols-2 gap-3">
    {[
      {
        key: "daily",
        label: "Daily Attendance",
        sub: "Mark intern's daily check-in",
        icon: FaClipboardList,
        color: "from-cyan-500 to-blue-500",
        lightBg: "bg-cyan-50 border-cyan-200",
        activeBg: "bg-gradient-to-br from-cyan-500 to-blue-500",
      },
      {
        key: "meeting",
        label: "Meeting Attendance",
        sub: "Mark intern's meeting presence",
        icon: FaVideo,
        color: "from-indigo-500 to-purple-500",
        lightBg: "bg-indigo-50 border-indigo-200",
        activeBg: "bg-gradient-to-br from-indigo-500 to-purple-500",
      },
    ].map(({ key, label, sub, icon: Icon, lightBg, activeBg }) => {
      const isActive = mode === key;
      return (
        <motion.button
          key={key}
          onClick={() => onChange(key)}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className={`relative flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all text-center ${
            isActive
              ? "border-transparent text-white shadow-lg"
              : `${lightBg} border hover:shadow-sm text-gray-700`
          }`}
          style={
            isActive
              ? {
                  background: `linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))`,
                }
              : {}
          }
        >
          {/* gradient background for active */}
          {isActive && (
            <div
              className={`absolute inset-0 rounded-2xl ${activeBg}`}
              style={{ zIndex: 0 }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isActive ? "bg-white/20" : "bg-white shadow-sm"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${isActive ? "text-white" : "text-gray-600"}`}
              />
            </div>
            <div>
              <p
                className={`text-sm font-bold ${isActive ? "text-white" : "text-gray-800"}`}
              >
                {label}
              </p>
              <p
                className={`text-xs mt-0.5 ${isActive ? "text-white/80" : "text-gray-500"}`}
              >
                {sub}
              </p>
            </div>
          </div>
        </motion.button>
      );
    })}
  </div>
);

// ── Input Mode Selector (Single vs Bulk) ──────────────────────────────────────
const InputModeSelector = ({ inputMode, onChange }) => (
  <div className="grid grid-cols-2 gap-2">
    {[
      {
        key: "single",
        label: "Single",
        sub: "Mark one at a time",
      },
      {
        key: "bulk",
        label: "Bulk",
        sub: "Mark multiple at once",
      },
    ].map(({ key, label, sub }) => {
      const isActive = inputMode === key;
      return (
        <motion.button
          key={key}
          onClick={() => onChange(key)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`flex flex-col items-center gap-1 py-2.5 px-3 rounded-xl border transition-all text-center ${
            isActive
              ? "border-blue-400 bg-blue-50 shadow-sm"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <p
            className={`text-xs font-bold ${isActive ? "text-blue-700" : "text-gray-700"}`}
          >
            {label}
          </p>
          <p
            className={`text-[10px] ${isActive ? "text-blue-600" : "text-gray-500"}`}
          >
            {sub}
          </p>
        </motion.button>
      );
    })}
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
const AdminManualAttendance = () => {
  const navigate = useNavigate();
  const today = getLocalToday();
  const searchDebounce = useRef(null);

  const [inputMode, setInputMode] = useState("single"); // "single" | "bulk"
  const [mode, setMode] = useState("daily"); // "daily" | "meeting"
  const [selectedDate, setSelectedDate] = useState(today);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [status, setStatus] = useState("Present"); // "Present" | "Absent"
  const [meetingName, setMeetingName] = useState("");
  const [marking, setMarking] = useState(false);
  const [toast, setToast] = useState(null);
  const [recentMarks, setRecentMarks] = useState([]);
  const [bulkInternIds, setBulkInternIds] = useState(""); // Comma/newline separated IDs
  const [bulkResults, setBulkResults] = useState(null); // { succeeded: [...], failed: [...] }

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
        mode, // "daily" | "meeting"
        ...(mode === "meeting" && { meetingName: meetingName.trim() }),
      };

      const result = await manualAttendanceApi.markAttendance(payload);

      showToast(
        `${status} marked for ${selectedIntern.Trainee_Name} (${mode === "daily" ? "daily" : "meeting"})`,
        "success",
      );

      // Add to recent marks log
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

      // Reset intern selection
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

      // Add successful marks to recent marks log
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

      // Reset bulk input
      setBulkInternIds("");
    } catch (err) {
      showToast(err.message || "Failed to mark bulk attendance", "error");
      setBulkResults(null);
    } finally {
      setMarking(false);
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

  const bgBlobs = [
    {
      cls: "w-72 h-72 bg-blue-100/50 -top-16 -left-16",
      dy: -20,
      dx: 15,
      dur: 14,
    },
    {
      cls: "w-96 h-96 bg-indigo-100/30 top-1/3 -right-20",
      dy: 25,
      dx: -15,
      dur: 18,
      delay: 2,
    },
    {
      cls: "w-56 h-56 bg-cyan-100/40 bottom-20 left-1/3",
      dy: -15,
      dx: 20,
      dur: 16,
      delay: 1,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 text-gray-800 overflow-x-hidden">
      {/* Animated blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {bgBlobs.map((b, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full blur-3xl ${b.cls}`}
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

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <motion.button
            onClick={() => navigate("/admin/intern-attendance")}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm text-sm font-medium text-gray-600 hover:bg-white transition-all mb-4"
            whileHover={{ x: -4, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <FaArrowLeft className="h-3.5 w-3.5" />
            Back to Attendance
          </motion.button>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              Manual Attendance
            </span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Mark daily or meeting attendance for individual interns
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-5">
          {/* ── Left: Form ── */}
          <div className="space-y-5">
            {/* Input mode selector (Single vs Bulk) */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.02 }}
            >
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Input Mode
              </label>
              <InputModeSelector mode={inputMode} onChange={setInputMode} />
            </motion.div>

            {/* Mode selector */}
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
                  placeholder="ID001, ID002, ID003&#10;or&#10;ID001&#10;ID002&#10;ID003"
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
              disabled={
                inputMode === "single"
                  ? !canSubmitSingle || marking
                  : !canSubmitBulk || marking
              }
              whileHover={{
                scale:
                  (inputMode === "single" ? canSubmitSingle : canSubmitBulk) &&
                  !marking
                    ? 1.02
                    : 1,
              }}
              whileTap={{
                scale:
                  (inputMode === "single" ? canSubmitSingle : canSubmitBulk) &&
                  !marking
                    ? 0.98
                    : 1,
              }}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl text-white text-sm font-bold transition-all shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background:
                  (inputMode === "single" ? canSubmitSingle : canSubmitBulk) &&
                  !marking
                    ? mode === "daily"
                      ? "linear-gradient(135deg, #06b6d4, #3b82f6)"
                      : "linear-gradient(135deg, #6366f1, #8b5cf6)"
                    : undefined,
                backgroundColor:
                  (inputMode === "single" ? canSubmitSingle : canSubmitBulk) &&
                  !marking
                    ? undefined
                    : "#d1d5db",
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
      </div>
    </div>
  );
};

export default AdminManualAttendance;
