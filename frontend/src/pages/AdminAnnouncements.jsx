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
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { announcementApi } from "../api/adminApi";
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
<<<<<<< HEAD
  normal: "bg-blue-50 text-[#0056a2] border-blue-200",
  important: "bg-amber-50 text-amber-700 border-amber-200",
  urgent: "bg-rose-50 text-rose-700 border-rose-200",
};

const priorityDot = {
  normal: "bg-[#0056a2]",
  important: "bg-amber-500",
  urgent: "bg-rose-500",
=======
  normal: "bg-blue-100 text-blue-700 border-blue-200",
  important: "bg-amber-100 text-amber-700 border-amber-200",
  urgent: "bg-red-100 text-red-700 border-red-200",
};

const priorityDot = {
  normal: "bg-blue-500",
  important: "bg-amber-500",
  urgent: "bg-red-500",
>>>>>>> talenthub/main
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
<<<<<<< HEAD
        className={`fixed bottom-6 right-6 z-50 flex items-center space-x-3 px-5 py-3 rounded-2xl shadow-xl border max-w-sm ${
          toast.type === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : toast.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-blue-50 border-blue-200 text-[#0056a2]"
=======
        className={`fixed bottom-6 right-6 z-50 flex items-center space-x-3 px-5 py-3 rounded-2xl shadow-xl border backdrop-blur-sm max-w-sm ${
          toast.type === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : toast.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-blue-50 border-blue-200 text-blue-800"
>>>>>>> talenthub/main
        }`}
      >
        {toast.type === "success" ? (
          <FaCheckCircle className="flex-shrink-0 h-4 w-4 text-green-500" />
        ) : toast.type === "error" ? (
<<<<<<< HEAD
          <FaExclamationTriangle className="flex-shrink-0 h-4 w-4 text-rose-500" />
        ) : (
          <FaBullhorn className="flex-shrink-0 h-4 w-4 text-[#0056a2]" />
        )}
        <p className="text-sm font-bold flex-1">{toast.message}</p>
=======
          <FaExclamationTriangle className="flex-shrink-0 h-4 w-4 text-red-500" />
        ) : (
          <FaBullhorn className="flex-shrink-0 h-4 w-4 text-blue-500" />
        )}
        <p className="text-sm font-medium flex-1">{toast.message}</p>
>>>>>>> talenthub/main
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
<<<<<<< HEAD
  const [showAsPopup, setShowAsPopup] = useState(false);
=======
>>>>>>> talenthub/main
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
  const handleSend = async () => {
    if (!title.trim()) {
      showToast("Title is required.", "error");
      return;
    }
    if (!message.trim()) {
      showToast("Message is required.", "error");
      return;
    }

    setSending(true);
    try {
      await announcementApi.create({
        title: title.trim(),
        message: message.trim(),
        priority,
<<<<<<< HEAD
        showAsPopup,
=======
>>>>>>> talenthub/main
      });
      showToast("Announcement sent successfully!", "success");
      setTitle("");
      setMessage("");
      setPriority("normal");
<<<<<<< HEAD
      setShowAsPopup(false);
=======
>>>>>>> talenthub/main
      setCurrentPage(1);
      fetchAnnouncements();
    } catch (err) {
      showToast(err.message || "Failed to send announcement.", "error");
    } finally {
      setSending(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
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
      setConfirmDelete(null);
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
<<<<<<< HEAD
      <div className="min-h-screen bg-slate-50 font-sans text-gray-800 pb-10 flex flex-col">
        <div className="flex-1 w-full lg:mt-4 lg:px-6 xl:px-10">
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
            {/* Page Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
                >
                  <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl">
                    <Megaphone className="text-[#0056a2] h-8 w-8" />
                  </div>
                  Announcements
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
                >
                  Broadcast messages and important notices to all interns
                </motion.p>
              </div>
=======
    <div className="min-h-screen bg-gray-50 text-gray-800 overflow-hidden">
      {/* Floating BG blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-80 h-80 rounded-full bg-blue-100/40 -top-20 -left-20"
          animate={{ y: [0, -30, 0], x: [0, 20, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-cyan-100/40 top-1/4 right-0"
          animate={{ y: [0, 20, 0], x: [0, -20, 0] }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />
        <motion.div
          className="absolute w-64 h-64 rounded-full bg-green-100/40 bottom-20 left-1/4"
          animate={{ y: [0, -20, 0], x: [0, 15, 0] }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
      </div>

      <div className="pt-2 sm:pt-4">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
              >
                <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl">
                  <Megaphone className="text-[#0056a2] h-8 w-8" />
                </div>
                Announcements
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05, duration: 0.2 }}
                className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
              >
                Broadcast messages and important notices to all interns
              </motion.p>
>>>>>>> talenthub/main
            </div>

            {/* Error banner */}
            <AnimatePresence>
              {error && (
                <motion.div
<<<<<<< HEAD
                  className="mb-4 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start space-x-3"
=======
                  className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3"
>>>>>>> talenthub/main
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
<<<<<<< HEAD
                  <FaExclamationTriangle className="text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-rose-700 flex-1">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="text-rose-500 hover:text-rose-700 text-xl font-bold"
=======
                  <FaExclamationTriangle className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 flex-1">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-500 hover:text-red-700 text-xl font-bold"
>>>>>>> talenthub/main
                  >
                    ×
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-6">
              {/* ── Compose Panel ── */}
              <motion.div
<<<<<<< HEAD
                className="xl:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-fit"
=======
                className="xl:col-span-2 bg-white/80 backdrop-blur-sm p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm h-fit"
>>>>>>> talenthub/main
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
              >
<<<<<<< HEAD
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
=======
                <div className="flex items-center space-x-2 mb-5">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center shadow-sm">
                    <FaBullhorn className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      New Announcement
                    </h3>
                    <p className="text-xs text-gray-500">
                      Compose and send to all interns
>>>>>>> talenthub/main
                    </p>
                  </div>
                </div>

<<<<<<< HEAD
                <div className="space-y-5">
                  {/* Title */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                      Title <span className="text-rose-500">*</span>
=======
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Title <span className="text-red-500">*</span>
>>>>>>> talenthub/main
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Monthly Review Reminder"
                      maxLength={100}
<<<<<<< HEAD
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#00b4eb]/30 outline-none text-sm font-semibold text-gray-700 transition-all"
                    />
                    <p className="text-[10px] font-bold text-gray-400 mt-1.5 text-right">
=======
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder-gray-400 shadow-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">
>>>>>>> talenthub/main
                      {title.length}/100
                    </p>
                  </div>

                  {/* Message */}
                  <div>
<<<<<<< HEAD
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                      Message <span className="text-rose-500">*</span>
=======
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Message <span className="text-red-500">*</span>
>>>>>>> talenthub/main
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={5}
                      placeholder="Write your announcement here..."
                      maxLength={1000}
<<<<<<< HEAD
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#00b4eb]/30 outline-none text-sm font-semibold text-gray-700 transition-all resize-none"
                    />
                    <p className="text-[10px] font-bold text-gray-400 mt-1.5 text-right">
=======
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder-gray-400 shadow-sm resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">
>>>>>>> talenthub/main
                      {message.length}/1000
                    </p>
                  </div>

                  {/* Priority */}
                  <div>
<<<<<<< HEAD
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                      Priority
                    </label>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
=======
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Priority
                    </label>
                    <div className="grid grid-cols-3 gap-2">
>>>>>>> talenthub/main
                      {PRIORITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPriority(opt.value)}
<<<<<<< HEAD
                          className={`flex items-center justify-center space-x-1.5 px-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                            priority === opt.value
                              ? priorityStyle[opt.value] +
                                " ring-2 ring-offset-1 ring-current"
                              : "bg-slate-50 border-slate-200 text-gray-500 hover:bg-gray-100"
=======
                          className={`flex items-center justify-center space-x-1.5 px-2 py-2 rounded-xl border text-xs font-medium transition-all ${
                            priority === opt.value
                              ? priorityStyle[opt.value] +
                                " ring-2 ring-offset-1 ring-current"
                              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
>>>>>>> talenthub/main
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${priorityDot[opt.value]}`}
                          />
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

<<<<<<< HEAD
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

=======
>>>>>>> talenthub/main
                  {/* Send button */}
                  <motion.button
                    onClick={handleSend}
                    disabled={sending}
<<<<<<< HEAD
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3.5 bg-[#0056a2] hover:bg-[#00488a] disabled:bg-gray-300 text-white rounded-2xl text-sm font-bold transition-all shadow-sm shadow-blue-500/20 disabled:cursor-not-allowed disabled:shadow-none"
=======
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed"
>>>>>>> talenthub/main
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
              </motion.div>

              {/* ── Announcements List ── */}
              <motion.div
<<<<<<< HEAD
                className="xl:col-span-3 flex flex-col gap-4 md:gap-6"
=======
                className="xl:col-span-3"
>>>>>>> talenthub/main
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                {/* Filters */}
<<<<<<< HEAD
                <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
=======
                <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-gray-100 shadow-sm mb-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
>>>>>>> talenthub/main
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search announcements..."
<<<<<<< HEAD
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-[#00b4eb]/30 outline-none transition-all"
                      />
                    </div>
                    <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                      <FaFilter className="text-gray-400 h-4 w-4" />
                      <select
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className="bg-transparent border-0 focus:ring-0 text-sm font-bold text-gray-700 outline-none pr-1 cursor-pointer"
=======
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                      />
                    </div>
                    <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                      <FaFilter className="text-gray-400 h-3.5 w-3.5" />
                      <select
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className="bg-transparent border-0 focus:ring-0 text-sm text-gray-700 pr-1"
>>>>>>> talenthub/main
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
<<<<<<< HEAD
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex-1">
                  <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-lg font-extrabold text-gray-900">
=======
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900">
>>>>>>> talenthub/main
                      Sent Announcements
                    </h3>
                    <div className="flex items-center gap-2">
                      {loadingList && (
<<<<<<< HEAD
                        <FaSpinner className="animate-spin text-[#00b4eb] h-4 w-4" />
                      )}
                      {!loadingList && (
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">
=======
                        <FaSpinner className="animate-spin text-blue-500 h-4 w-4" />
                      )}
                      {!loadingList && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
>>>>>>> talenthub/main
                          {filtered.length} total
                        </span>
                      )}
                    </div>
                  </div>

                  {loadingList ? (
<<<<<<< HEAD
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0056a2] mx-auto mb-4"></div>
                        <p className="text-sm font-bold text-gray-500">
=======
                    <div className="flex items-center justify-center py-16">
                      <div className="text-center">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="w-10 h-10 border-t-4 border-b-4 border-blue-500 rounded-full mx-auto mb-3"
                        />
                        <p className="text-sm text-gray-500">
>>>>>>> talenthub/main
                          Loading announcements...
                        </p>
                      </div>
                    </div>
                  ) : filtered.length === 0 ? (
<<<<<<< HEAD
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
=======
                    <div className="text-center py-12 md:py-16 bg-gray-50 px-4">
                      <FaBullhorn className="mx-auto h-10 w-10 text-gray-300 mb-4" />
                      <h3 className="text-base font-medium text-gray-600 mb-1">
                        No announcements yet
                      </h3>
                      <p className="text-sm text-gray-400">
                        {searchTerm || filterPriority !== "all"
                          ? "No announcements match your filters."
                          : "Compose and send your first announcement above."}
>>>>>>> talenthub/main
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="divide-y divide-gray-100">
                        {paginated.map((a) => {
                          const isExpanded = expandedId === a._id;
                          return (
                            <div
                              key={a._id}
<<<<<<< HEAD
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
                                    </div>

                                    <p
                                      className={`text-sm font-medium text-gray-600 mt-1 whitespace-pre-wrap break-words transition-all duration-200 leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}
=======
                              className="p-4 md:p-5 hover:bg-gray-50/70 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start space-x-3 flex-1 min-w-0">
                                  <div
                                    className={`mt-1.5 flex-shrink-0 h-2.5 w-2.5 rounded-full ${priorityDot[a.priority] || "bg-blue-500"}`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    {/* Title + priority badge */}
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <h4 className="text-sm font-semibold text-gray-900 truncate">
                                        {a.title}
                                      </h4>
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${priorityStyle[a.priority] || priorityStyle.normal}`}
                                      >
                                        {a.priority}
                                      </span>
                                    </div>

                                    <p
                                      className={`text-sm text-gray-600 mt-1 whitespace-pre-wrap break-words transition-all duration-200 ${isExpanded ? "" : "line-clamp-2"}`}
>>>>>>> talenthub/main
                                    >
                                      {a.message}
                                    </p>

<<<<<<< HEAD
                                    <div className="flex flex-wrap items-center gap-3 mt-3">
                                      <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                                        <FaCalendarAlt className="h-3 w-3" />
=======
                                    <div className="flex flex-wrap items-center gap-3 mt-2">
                                      <span className="text-xs text-gray-400 flex items-center gap-1">
                                        <FaCalendarAlt className="h-2.5 w-2.5" />
>>>>>>> talenthub/main
                                        {formatDateTime(a.createdAt)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions */}
<<<<<<< HEAD
                                <div className="flex items-center space-x-2 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <motion.button
                                    onClick={() => toggleExpand(a._id)}
                                    className="p-2 rounded-xl text-gray-400 hover:text-[#0056a2] hover:bg-blue-50 transition-colors"
=======
                                <div className="flex items-center space-x-1 flex-shrink-0">
                                  <motion.button
                                    onClick={() => toggleExpand(a._id)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
>>>>>>> talenthub/main
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    title={isExpanded ? "Collapse" : "Expand"}
                                  >
                                    <motion.div
                                      animate={{ rotate: isExpanded ? 180 : 0 }}
                                      transition={{ duration: 0.2 }}
                                    >
<<<<<<< HEAD
                                      <FaChevronDown className="h-4 w-4" />
=======
                                      <FaChevronDown className="h-3.5 w-3.5" />
>>>>>>> talenthub/main
                                    </motion.div>
                                  </motion.button>

                                  <motion.button
                                    onClick={() => setConfirmDelete(a._id)}
                                    disabled={deletingId === a._id}
<<<<<<< HEAD
                                    className="p-2 rounded-xl text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50"
=======
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
>>>>>>> talenthub/main
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    title="Delete"
                                  >
                                    {deletingId === a._id ? (
<<<<<<< HEAD
                                      <FaSpinner className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <FaTrash className="h-4 w-4" />
=======
                                      <FaSpinner className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <FaTrash className="h-3.5 w-3.5" />
>>>>>>> talenthub/main
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
<<<<<<< HEAD
                        <div className="px-6 py-4 border-t border-gray-100 bg-slate-50/50">
                          <div className="flex items-center justify-between gap-4">
                            <motion.button
                              onClick={() => goTo(safePage - 1)}
                              disabled={safePage === 1}
                              className="flex items-center space-x-2 px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                              whileHover={{ scale: safePage === 1 ? 1 : 1.02 }}
                              whileTap={{ scale: safePage === 1 ? 1 : 0.98 }}
=======
                        <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/60">
                          <div className="flex items-center justify-between gap-2">
                            <motion.button
                              onClick={() => goTo(safePage - 1)}
                              disabled={safePage === 1}
                              className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                              whileHover={{ scale: safePage === 1 ? 1 : 1.04 }}
                              whileTap={{ scale: safePage === 1 ? 1 : 0.96 }}
>>>>>>> talenthub/main
                            >
                              <FaChevronLeft className="h-3 w-3" />
                              <span>Prev</span>
                            </motion.button>

<<<<<<< HEAD
                            <div className="hidden sm:flex items-center gap-1.5">
=======
                            <div className="flex items-center gap-1">
>>>>>>> talenthub/main
                              {pageNumbers().map((p, i) =>
                                p === "…" ? (
                                  <span
                                    key={`e-${i}`}
<<<<<<< HEAD
                                    className="px-2 text-gray-400 text-xs font-bold select-none"
=======
                                    className="px-2 text-gray-400 text-xs select-none"
>>>>>>> talenthub/main
                                  >
                                    …
                                  </span>
                                ) : (
                                  <motion.button
                                    key={p}
                                    onClick={() => goTo(p)}
<<<<<<< HEAD
                                    className={`w-9 h-9 flex items-center justify-center text-xs font-bold rounded-xl border transition-all ${
                                      safePage === p
                                        ? "bg-[#0056a2] text-white border-[#0056a2] shadow-sm shadow-blue-500/20"
                                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                    }`}
                                    whileHover={{
                                      scale: safePage === p ? 1 : 1.05,
                                    }}
                                    whileTap={{ scale: 0.95 }}
=======
                                    className={`min-w-[2rem] h-8 px-2 text-xs font-medium rounded-lg border transition-all ${
                                      safePage === p
                                        ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-blue-400 shadow-sm"
                                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                    }`}
                                    whileHover={{
                                      scale: safePage === p ? 1 : 1.08,
                                    }}
                                    whileTap={{ scale: 0.94 }}
>>>>>>> talenthub/main
                                  >
                                    {p}
                                  </motion.button>
                                ),
                              )}
                            </div>

                            <motion.button
                              onClick={() => goTo(safePage + 1)}
                              disabled={safePage === totalPages}
<<<<<<< HEAD
                              className="flex items-center space-x-2 px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                              whileHover={{
                                scale: safePage === totalPages ? 1 : 1.02,
                              }}
                              whileTap={{
                                scale: safePage === totalPages ? 1 : 0.98,
=======
                              className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                              whileHover={{
                                scale: safePage === totalPages ? 1 : 1.04,
                              }}
                              whileTap={{
                                scale: safePage === totalPages ? 1 : 0.96,
>>>>>>> talenthub/main
                              }}
                            >
                              <span>Next</span>
                              <FaChevronRight className="h-3 w-3" />
                            </motion.button>
                          </div>
<<<<<<< HEAD
=======

                          <p className="text-center text-xs text-gray-400 mt-2">
                            Showing {(safePage - 1) * PAGE_SIZE + 1}–
                            {Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
                            {filtered.length} announcements
                          </p>
>>>>>>> talenthub/main
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            </div>
<<<<<<< HEAD
          </main>
        </div>
=======
          </div>
        </main>
>>>>>>> talenthub/main
      </div>

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
<<<<<<< HEAD
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
=======
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
>>>>>>> talenthub/main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
<<<<<<< HEAD
              className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-sm w-full"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
            >
              <div className="flex flex-col items-center text-center space-y-4 mb-6">
                <div className="h-16 w-16 rounded-full bg-rose-100 flex items-center justify-center">
                  <FaTrash className="h-8 w-8 text-rose-500" />
                </div>
                <div>
                  <h4 className="text-xl font-extrabold text-gray-900 mb-1">
                    Delete Announcement?
                  </h4>
                  <p className="text-sm font-medium text-gray-500">
                    This action cannot be undone. Are you sure you want to permanently delete this announcement?
=======
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-100"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <FaTrash className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-gray-900">
                    Delete Announcement
                  </h4>
                  <p className="text-sm text-gray-500">
                    This action cannot be undone.
>>>>>>> talenthub/main
                  </p>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setConfirmDelete(null)}
<<<<<<< HEAD
                  className="flex-1 px-4 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-bold transition-colors shadow-sm"
=======
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
>>>>>>> talenthub/main
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
<<<<<<< HEAD
                  className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm shadow-red-500/20"
=======
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm"
>>>>>>> talenthub/main
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
<<<<<<< HEAD
=======
    </div>
>>>>>>> talenthub/main
    </AdminNavigation>
  );
};

export default AdminAnnouncements;
