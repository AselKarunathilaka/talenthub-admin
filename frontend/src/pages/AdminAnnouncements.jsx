import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaBullhorn,
  FaPaperPlane,
  FaTrash,
  FaSpinner,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimes,
  FaFilter,
  FaCalendarAlt,
  FaSearch,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaEye,
  FaEyeSlash,
  FaLock,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { announcementApi } from "../api/adminApi";
import { API_BASE_URL } from "../api/apiConfig";
import AdminNavigation from "../components/AdminNavigation";
import { Megaphone } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatDateTime = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "important", label: "Important" },
  { value: "urgent", label: "Urgent" },
];

const priorityStyle = {
  normal: "bg-blue-50 text-[#0056a2] border-[#0056a2] shadow-sm",
  important: "bg-amber-50 text-amber-700 border-amber-500 shadow-sm",
  urgent: "bg-rose-50 text-rose-700 border-rose-500 shadow-sm",
};

const priorityDot = {
  normal: "bg-[#0056a2]",
  important: "bg-amber-500",
  urgent: "bg-rose-500",
};

const PAGE_SIZE = 5;

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ toast, onDismiss }) => (
  <AnimatePresence>
    {toast && (
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className={`fixed bottom-6 right-6 z-50 flex items-center space-x-3 px-5 py-3 rounded-2xl shadow-xl border max-w-sm ${
          toast.type === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : toast.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-blue-50 border-blue-200 text-[#0056a2]"
        }`}
      >
        {toast.type === "success" ? (
          <FaCheckCircle className="flex-shrink-0 h-4 w-4 text-green-500" />
        ) : toast.type === "error" ? (
          <FaExclamationTriangle className="flex-shrink-0 h-4 w-4 text-rose-500" />
        ) : (
          <FaBullhorn className="flex-shrink-0 h-4 w-4 text-[#0056a2]" />
        )}
        <p className="text-sm font-bold flex-1">{toast.message}</p>
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100">
          <FaTimes className="h-3 w-3" />
        </button>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const AdminAnnouncements = () => {
  const navigate = useNavigate();

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
  const [showAsPopup, setShowAsPopup] = useState(false);
  const [alwaysDisplay, setAlwaysDisplay] = useState(false);
  const [sending, setSending] = useState(false);

  // List state
  const [announcements, setAnnouncements] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [filterPriority, setFilterPriority] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // UI state
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
    const [error, setError] = useState(null);

  // Security Check State
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmShowPw, setConfirmShowPw] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [securitySaving, setSecuritySaving] = useState(false);

  const showToast = (msg, type = "info") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAnnouncements = async () => {
    setLoadingList(true);
    try {
      const data = await announcementApi.getAll();
      const sorted = [...data].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );
      setAnnouncements(sorted);
    } catch (err) {
      setError("Failed to load announcements.");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
    if (!adminInfo.token) {
      navigate("/admin-login");
      return;
    }
    fetchAnnouncements();
  }, [navigate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterPriority, searchTerm]);

  // ── Send ───────────────────────────────────────────────────────────────────
  
  const executeSend = async () => {
    setSending(true);
    try {
      await announcementApi.create({
        title: title.trim(),
        message: message.trim(),
        priority,
        showAsPopup,
        alwaysDisplay,
      });
      showToast("Announcement sent successfully!", "success");
      setTitle("");
      setMessage("");
      setPriority("normal");
      setShowAsPopup(false);
      setAlwaysDisplay(false);
      setCurrentPage(1);
      fetchAnnouncements();
    } catch (err) {
      showToast(err.message || "Failed to send announcement.", "error");
    } finally {
      setSending(false);
    }
  };

  
  const handleConfirmVerify = async () => {
    if (!confirmPassword) {
      setConfirmError("Please enter the security password");
      return;
    }
    setSecuritySaving(true);
    setConfirmError("");
    try {
      let action = "Send announcemt for all interns in admin side";
      let extraInfo = `Title: ${title}`;
      if (confirmTarget?.type === "delete") {
        action = "Delete anncounement in admin side";
        extraInfo = `Title: ${confirmTarget.title}`;
      }

      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      const res = await fetch(`${API_BASE_URL}/admin/attendance/verify-security`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminInfo.token}` },
        body: JSON.stringify({
          securityPin: confirmPassword,
          action,
          extraInfo,
        }),
      });

      const data = await res.json();
      if (res.ok && (data.success || data.message)) {
        setConfirmError("");
        const target = confirmTarget;
        setConfirmTarget(null);
        setConfirmPassword("");
        
        if (target?.type === "send") {
          executeSend();
        } else if (target?.type === "delete") {
          executeDelete(target.id);
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


  const handleSend = async () => {
    if (!title.trim()) {
      showToast("Title is required.", "error");
      return;
    }
    if (!message.trim()) {
      showToast("Message is required.", "error");
      return;
    }
    const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
    if (adminInfo?.user?.requireSecurityCheck === false) {
      executeSend();
      return;
    }
    setConfirmTarget({ type: 'send' });
  };


  const handleDeleteClick = (announcement) => {
    const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
    if (adminInfo?.user?.requireSecurityCheck === false) {
      executeDelete(announcement._id);
      return;
    }
    setConfirmTarget({ type: 'delete', id: announcement._id, title: announcement.title });
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const executeDelete = async (id) => {
    setDeletingId(id);
    try {
      await announcementApi.delete(id);
      setAnnouncements((prev) => prev.filter((a) => a._id !== id));
      setCurrentPage((prev) => {
        const remaining = announcements.filter((a) => a._id !== id);
        const newTotal = Math.max(1, Math.ceil(remaining.length / PAGE_SIZE));
        return Math.min(prev, newTotal);
      });
      showToast("Announcement deleted.", "info");
    } catch (err) {
      showToast("Failed to delete announcement.", "error");
    } finally {
      setDeletingId(null);
      
    }
  };

  const toggleExpand = (id) =>
    setExpandedId((prev) => (prev === id ? null : id));

  // ── Filter + paginate ──────────────────────────────────────────────────────
  const filtered = announcements.filter((a) => {
    const matchesPriority =
      filterPriority === "all" || a.priority === filterPriority;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.message.toLowerCase().includes(q);
    return matchesPriority && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const goTo = (p) => setCurrentPage(Math.max(1, Math.min(p, totalPages)));

  const pageNumbers = () => {
    if (totalPages <= 5)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 3) return [1, 2, 3, 4, "…", totalPages];
    if (safePage >= totalPages - 2)
      return [
        1,
        "…",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    return [1, "…", safePage - 1, safePage, safePage + 1, "…", totalPages];
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <AdminNavigation>
      <div className="min-h-full relative font-sans text-slate-800 flex flex-col select-none">
        <main className="relative flex-1 p-3 sm:p-6 sm:px-8 mx-auto max-w-[1400px] w-full flex flex-col gap-5 sm:gap-6 min-w-0">
            {/* Page Header */}
            <div className="relative flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6 pt-2">
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="p-2.5 sm:p-3 md:p-3.5 bg-gradient-to-br from-[#000066] to-[#006600] shadow-md rounded-lg sm:rounded-xl md:rounded-2xl border border-[#006600]/20 flex-shrink-0"
                >
                  <Megaphone className="text-white h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
                </motion.div>
                <div className="flex flex-col justify-center">
                  <motion.h1
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight"
                  >
                    Announcements
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    className="text-slate-500 mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base font-medium max-w-xl"
                  >
                    Broadcast messages and important notices to all interns
                  </motion.p>
                </div>
              </div>
            </div>

            {/* Error banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="mb-4 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start space-x-3"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <FaExclamationTriangle className="text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-rose-700 flex-1">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="text-rose-500 hover:text-rose-700 text-xl font-bold"
                  >
                    ×
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-6">
              {/* ── Compose Panel ── */}
              <motion.div
                className="xl:col-span-5 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-auto xl:h-[calc(100vh-40px)] xl:min-h-[700px] xl:sticky xl:top-6"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
              >
                <div className="flex items-center space-x-3 mb-6">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <FaBullhorn className="text-[#0056a2]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-gray-900">
                      New Announcement
                    </h3>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                      Compose & Send
                    </p>
                  </div>
                </div>

                <div className="flex-1 xl:overflow-y-auto pr-2 px-1 -mx-1 pb-4 space-y-5 xl:[&::-webkit-scrollbar]:w-2 xl:[&::-webkit-scrollbar-track]:bg-transparent xl:[&::-webkit-scrollbar-thumb]:bg-slate-200 xl:[&::-webkit-scrollbar-thumb]:rounded-full hover:xl:[&::-webkit-scrollbar-thumb]:bg-slate-300">
                  {/* Title */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                      Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Monthly Review Reminder"
                      maxLength={100}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#00b4eb]/30 outline-none text-sm font-semibold text-gray-700 transition-all"
                    />
                    <p className="text-[10px] font-bold text-gray-400 mt-1.5 text-right">
                      {title.length}/100
                    </p>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                      Message <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={5}
                      placeholder="Write your announcement here..."
                      maxLength={1000}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#00b4eb]/30 outline-none text-sm font-semibold text-gray-700 transition-all resize-none"
                    />
                    <p className="text-[10px] font-bold text-gray-400 mt-1.5 text-right">
                      {message.length}/1000
                    </p>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                      Priority
                    </label>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {PRIORITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPriority(opt.value)}
                          className={`w-full flex items-center justify-center space-x-1.5 px-1 sm:px-2 py-2.5 rounded-xl border-2 text-[10px] sm:text-xs font-bold transition-all ${
                            priority === opt.value
                              ? priorityStyle[opt.value]
                              : "bg-slate-50 border-slate-200 text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${priorityDot[opt.value]}`}
                          />
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Show as Popup Toggle */}
                  <div className="flex items-center space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAsPopup(!showAsPopup)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#00b4eb] focus:ring-offset-2 ${
                        showAsPopup ? "bg-[#0056a2]" : "bg-gray-200"
                      }`}
                      role="switch"
                      aria-checked={showAsPopup}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          showAsPopup ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-900">
                        Show as Popup
                      </span>
                      <span className="text-[10px] font-medium text-gray-500 mt-0.5">
                        Display this announcement as a popup to interns when they login
                      </span>
                    </span>
                  </div>

                  {/* Always Display Toggle */}
                  <div className="flex items-center space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setAlwaysDisplay(!alwaysDisplay)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#00b4eb] focus:ring-offset-2 ${
                        alwaysDisplay ? "bg-amber-500" : "bg-gray-200"
                      }`}
                      role="switch"
                      aria-checked={alwaysDisplay}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          alwaysDisplay ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-900">
                        Always Display
                      </span>
                      <span className="text-[10px] font-medium text-gray-500 mt-0.5">
                        Show once per day instead of dismissing permanently when closed
                      </span>
                    </span>
                  </div>

                  {/* Send button */}
                  <div className="pt-2">
                    <motion.button
                      onClick={handleSend}
                      disabled={sending}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3.5 bg-[#0056a2] hover:bg-[#00488a] disabled:bg-gray-300 text-white rounded-2xl text-sm font-bold transition-all shadow-sm shadow-blue-500/20 disabled:cursor-not-allowed disabled:shadow-none"
                      whileHover={{ scale: sending ? 1 : 1.02 }}
                      whileTap={{ scale: sending ? 1 : 0.98 }}
                    >
                      {sending ? (
                        <>
                          <FaSpinner className="h-4 w-4 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <FaPaperPlane className="h-4 w-4" />
                          <span>Send to All Interns</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              </motion.div>

              {/* ── Announcements List ── */}
              <motion.div
                className="xl:col-span-7 flex flex-col gap-4 md:gap-6 h-auto xl:h-[calc(100vh-40px)] xl:min-h-[700px]"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                {/* Filters */}
                <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search announcements..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-[#00b4eb]/30 outline-none transition-all"
                      />
                    </div>
                    <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                      <FaFilter className="text-gray-400 h-4 w-4" />
                      <select
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className="bg-transparent border-0 focus:ring-0 text-sm font-bold text-gray-700 outline-none pr-1 cursor-pointer"
                      >
                        <option value="all">All Priorities</option>
                        <option value="normal">Normal</option>
                        <option value="important">Important</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* List card */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[400px] lg:min-h-0">
                  <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
                    <h3 className="text-lg font-extrabold text-gray-900">
                      Sent Announcements
                    </h3>
                    <div className="flex items-center gap-2">
                      {loadingList && (
                        <FaSpinner className="animate-spin text-[#00b4eb] h-4 w-4" />
                      )}
                      {!loadingList && (
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">
                          {filtered.length} total
                        </span>
                      )}
                    </div>
                  </div>

                  {loadingList ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0056a2] mx-auto mb-4"></div>
                        <p className="text-sm font-bold text-gray-500">
                          Loading announcements...
                        </p>
                      </div>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-20 px-4">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaBullhorn className="h-8 w-8 text-slate-300" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-700 mb-1">
                        No announcements yet
                      </h3>
                      <p className="text-sm font-medium text-gray-400">
                        {searchTerm || filterPriority !== "all"
                          ? "No announcements match your filters."
                          : "Compose and send your first announcement."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="divide-y divide-gray-100 xl:overflow-y-auto flex-1 xl:[&::-webkit-scrollbar]:w-2 xl:[&::-webkit-scrollbar-track]:bg-transparent xl:[&::-webkit-scrollbar-thumb]:bg-slate-200 xl:[&::-webkit-scrollbar-thumb]:rounded-full hover:xl:[&::-webkit-scrollbar-thumb]:bg-slate-300">
                        {paginated.map((a) => {
                          const isExpanded = expandedId === a._id;
                          return (
                            <div
                              key={a._id}
                              className="p-5 md:p-6 hover:bg-slate-50/50 transition-colors group"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start space-x-4 flex-1 min-w-0">
                                  <div
                                    className={`mt-1.5 flex-shrink-0 h-3 w-3 rounded-full shadow-sm ${priorityDot[a.priority] || "bg-[#0056a2]"}`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    {/* Title + priority badge */}
                                    <div className="flex flex-wrap items-center gap-3 mb-2">
                                      <h4 className="text-base font-bold text-gray-900 truncate">
                                        {a.title}
                                      </h4>
                                      <span
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${priorityStyle[a.priority] || priorityStyle.normal}`}
                                      >
                                        {a.priority}
                                      </span>
                                      {a.showAsPopup && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-200">
                                          Popup
                                        </span>
                                      )}
                                      {a.alwaysDisplay && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200">
                                          Daily
                                        </span>
                                      )}
                                    </div>

                                    <p
                                      className={`text-sm font-medium text-gray-600 mt-1 whitespace-pre-wrap break-words transition-all duration-200 leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}
                                    >
                                      {a.message}
                                    </p>

                                    <div className="flex flex-wrap items-center gap-3 mt-3">
                                      <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                                        <FaCalendarAlt className="h-3 w-3" />
                                        {formatDateTime(a.createdAt)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center space-x-2 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <motion.button
                                    onClick={() => toggleExpand(a._id)}
                                    className="p-2 rounded-xl text-gray-400 hover:text-[#0056a2] hover:bg-blue-50 transition-colors"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    title={isExpanded ? "Collapse" : "Expand"}
                                  >
                                    <motion.div
                                      animate={{ rotate: isExpanded ? 180 : 0 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <FaChevronDown className="h-4 w-4" />
                                    </motion.div>
                                  </motion.button>

                                  <motion.button
                                    onClick={() => handleDeleteClick(a)}
                                    disabled={deletingId === a._id}
                                    className="p-2 rounded-xl text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    title="Delete"
                                  >
                                    {deletingId === a._id ? (
                                      <FaSpinner className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <FaTrash className="h-4 w-4" />
                                    )}
                                  </motion.button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-100 bg-slate-50/50 flex-shrink-0">
                          <div className="flex items-center justify-between gap-4">
                            <motion.button
                              onClick={() => goTo(safePage - 1)}
                              disabled={safePage === 1}
                              className="flex items-center space-x-2 px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                              whileHover={{ scale: safePage === 1 ? 1 : 1.02 }}
                              whileTap={{ scale: safePage === 1 ? 1 : 0.98 }}
                            >
                              <FaChevronLeft className="h-3 w-3" />
                              <span>Prev</span>
                            </motion.button>

                            <div className="hidden sm:flex items-center gap-1.5">
                              {pageNumbers().map((p, i) =>
                                p === "…" ? (
                                  <span
                                    key={`e-${i}`}
                                    className="px-2 text-gray-400 text-xs font-bold select-none"
                                  >
                                    …
                                  </span>
                                ) : (
                                  <motion.button
                                    key={p}
                                    onClick={() => goTo(p)}
                                    className={`w-9 h-9 flex items-center justify-center text-xs font-bold rounded-xl border transition-all ${
                                      safePage === p
                                        ? "bg-[#0056a2] text-white border-[#0056a2] shadow-sm shadow-blue-500/20"
                                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                    }`}
                                    whileHover={{
                                      scale: safePage === p ? 1 : 1.05,
                                    }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    {p}
                                  </motion.button>
                                ),
                              )}
                            </div>

                            <motion.button
                              onClick={() => goTo(safePage + 1)}
                              disabled={safePage === totalPages}
                              className="flex items-center space-x-2 px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                              whileHover={{
                                scale: safePage === totalPages ? 1 : 1.02,
                              }}
                              whileTap={{
                                scale: safePage === totalPages ? 1 : 0.98,
                              }}
                            >
                              <span>Next</span>
                              <FaChevronRight className="h-3 w-3" />
                            </motion.button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          </main>
      </div>

      

      
        {/* ── Security Check Backdrop ── */}
        <AnimatePresence>
          {confirmTarget && (
            <motion.div
              key="announcement-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[20] pointer-events-none bg-slate-900/60 backdrop-blur-md"
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
              <div className="fixed left-0 lg:left-[260px] right-0 bottom-[80px] lg:bottom-[40px] top-[64px] z-[50] pointer-events-none flex flex-col items-center justify-center px-4 pt-6 pb-8">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ type: "spring", damping: 26, stiffness: 320 }}
                  onAnimationComplete={() => {
                    document.getElementById('announcement-security-password-input')?.focus();
                  }}
                  className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-sm pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-start mb-3 sm:mb-4">
                    
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-800">Security Check</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {confirmTarget?.type === "delete" ? "Enter password to delete announcement" : "Enter password to send announcement"}
                      </p>
                    </div>
                    <button
                      onClick={() => { setConfirmTarget(null); setConfirmError(""); }}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  </div>

                  
                  <div className={`flex items-center gap-3 border rounded-xl p-3 mb-4 ${confirmTarget?.type === "delete" ? "bg-rose-50 border-rose-100" : "bg-blue-50 border-blue-100"}`}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: confirmTarget?.type === "delete" ? 'linear-gradient(135deg,#f43f5e,#e11d48)' : 'linear-gradient(135deg,#3b82f6,#2563eb)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>
                      {confirmTarget?.type === "delete" ? <FaTrash /> : <FaBullhorn />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {confirmTarget?.type === "delete" ? "Delete Announcement" : "Mass Announcement"}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {confirmTarget?.type === "delete" ? "Action cannot be undone" : "To: All Interns"}
                      </p>
                    </div>
                  </div>

                  <div className="mb-3 sm:mb-5 relative">
                    <input
                      id="announcement-security-password-input"
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

                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-4">
                    <button
                      onClick={() => { setConfirmTarget(null); setConfirmError(""); }}
                      className="flex-1 px-4 py-2 sm:py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                    >
                      Cancel
                    </button>
                    
                    <button
                      onClick={handleConfirmVerify}
                      disabled={securitySaving || !confirmPassword}
                      className={`flex-1 flex items-center justify-center px-4 py-2 sm:py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer ${confirmTarget?.type === "delete" ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"}`}
                    >
                      {securitySaving ? <FaSpinner className="w-4 h-4 animate-spin" /> : (confirmTarget?.type === "delete" ? "Verify & Delete" : "Verify & Send")}
                    </button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </AdminNavigation>
  );
};

export default AdminAnnouncements;

