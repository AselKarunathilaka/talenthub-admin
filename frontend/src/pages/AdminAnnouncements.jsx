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
  normal: "bg-blue-100 text-blue-700 border-blue-200",
  important: "bg-amber-100 text-amber-700 border-amber-200",
  urgent: "bg-red-100 text-red-700 border-red-200",
};

const priorityDot = {
  normal: "bg-blue-500",
  important: "bg-amber-500",
  urgent: "bg-red-500",
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
        className={`fixed bottom-6 right-6 z-50 flex items-center space-x-3 px-5 py-3 rounded-2xl shadow-xl border backdrop-blur-sm max-w-sm ${
          toast.type === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : toast.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-blue-50 border-blue-200 text-blue-800"
        }`}
      >
        {toast.type === "success" ? (
          <FaCheckCircle className="flex-shrink-0 h-4 w-4 text-green-500" />
        ) : toast.type === "error" ? (
          <FaExclamationTriangle className="flex-shrink-0 h-4 w-4 text-red-500" />
        ) : (
          <FaBullhorn className="flex-shrink-0 h-4 w-4 text-blue-500" />
        )}
        <p className="text-sm font-medium flex-1">{toast.message}</p>
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
      });
      showToast("Announcement sent successfully!", "success");
      setTitle("");
      setMessage("");
      setPriority("normal");
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
            </div>

            {/* Error banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <FaExclamationTriangle className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 flex-1">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-500 hover:text-red-700 text-xl font-bold"
                  >
                    ×
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-6">
              {/* ── Compose Panel ── */}
              <motion.div
                className="xl:col-span-2 bg-white/80 backdrop-blur-sm p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm h-fit"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
              >
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
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Monthly Review Reminder"
                      maxLength={100}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder-gray-400 shadow-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {title.length}/100
                    </p>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={5}
                      placeholder="Write your announcement here..."
                      maxLength={1000}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder-gray-400 shadow-sm resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {message.length}/1000
                    </p>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Priority
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {PRIORITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPriority(opt.value)}
                          className={`flex items-center justify-center space-x-1.5 px-2 py-2 rounded-xl border text-xs font-medium transition-all ${
                            priority === opt.value
                              ? priorityStyle[opt.value] +
                                " ring-2 ring-offset-1 ring-current"
                              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
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

                  {/* Send button */}
                  <motion.button
                    onClick={handleSend}
                    disabled={sending}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed"
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
                className="xl:col-span-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                {/* Filters */}
                <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-gray-100 shadow-sm mb-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search announcements..."
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                      />
                    </div>
                    <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                      <FaFilter className="text-gray-400 h-3.5 w-3.5" />
                      <select
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className="bg-transparent border-0 focus:ring-0 text-sm text-gray-700 pr-1"
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
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900">
                      Sent Announcements
                    </h3>
                    <div className="flex items-center gap-2">
                      {loadingList && (
                        <FaSpinner className="animate-spin text-blue-500 h-4 w-4" />
                      )}
                      {!loadingList && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {filtered.length} total
                        </span>
                      )}
                    </div>
                  </div>

                  {loadingList ? (
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
                          Loading announcements...
                        </p>
                      </div>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-12 md:py-16 bg-gray-50 px-4">
                      <FaBullhorn className="mx-auto h-10 w-10 text-gray-300 mb-4" />
                      <h3 className="text-base font-medium text-gray-600 mb-1">
                        No announcements yet
                      </h3>
                      <p className="text-sm text-gray-400">
                        {searchTerm || filterPriority !== "all"
                          ? "No announcements match your filters."
                          : "Compose and send your first announcement above."}
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
                                    >
                                      {a.message}
                                    </p>

                                    <div className="flex flex-wrap items-center gap-3 mt-2">
                                      <span className="text-xs text-gray-400 flex items-center gap-1">
                                        <FaCalendarAlt className="h-2.5 w-2.5" />
                                        {formatDateTime(a.createdAt)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center space-x-1 flex-shrink-0">
                                  <motion.button
                                    onClick={() => toggleExpand(a._id)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    title={isExpanded ? "Collapse" : "Expand"}
                                  >
                                    <motion.div
                                      animate={{ rotate: isExpanded ? 180 : 0 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <FaChevronDown className="h-3.5 w-3.5" />
                                    </motion.div>
                                  </motion.button>

                                  <motion.button
                                    onClick={() => setConfirmDelete(a._id)}
                                    disabled={deletingId === a._id}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    title="Delete"
                                  >
                                    {deletingId === a._id ? (
                                      <FaSpinner className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <FaTrash className="h-3.5 w-3.5" />
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
                        <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/60">
                          <div className="flex items-center justify-between gap-2">
                            <motion.button
                              onClick={() => goTo(safePage - 1)}
                              disabled={safePage === 1}
                              className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                              whileHover={{ scale: safePage === 1 ? 1 : 1.04 }}
                              whileTap={{ scale: safePage === 1 ? 1 : 0.96 }}
                            >
                              <FaChevronLeft className="h-3 w-3" />
                              <span>Prev</span>
                            </motion.button>

                            <div className="flex items-center gap-1">
                              {pageNumbers().map((p, i) =>
                                p === "…" ? (
                                  <span
                                    key={`e-${i}`}
                                    className="px-2 text-gray-400 text-xs select-none"
                                  >
                                    …
                                  </span>
                                ) : (
                                  <motion.button
                                    key={p}
                                    onClick={() => goTo(p)}
                                    className={`min-w-[2rem] h-8 px-2 text-xs font-medium rounded-lg border transition-all ${
                                      safePage === p
                                        ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-blue-400 shadow-sm"
                                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                    }`}
                                    whileHover={{
                                      scale: safePage === p ? 1 : 1.08,
                                    }}
                                    whileTap={{ scale: 0.94 }}
                                  >
                                    {p}
                                  </motion.button>
                                ),
                              )}
                            </div>

                            <motion.button
                              onClick={() => goTo(safePage + 1)}
                              disabled={safePage === totalPages}
                              className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                              whileHover={{
                                scale: safePage === totalPages ? 1 : 1.04,
                              }}
                              whileTap={{
                                scale: safePage === totalPages ? 1 : 0.96,
                              }}
                            >
                              <span>Next</span>
                              <FaChevronRight className="h-3 w-3" />
                            </motion.button>
                          </div>

                          <p className="text-center text-xs text-gray-400 mt-2">
                            Showing {(safePage - 1) * PAGE_SIZE + 1}–
                            {Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
                            {filtered.length} announcements
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </main>
      </div>

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
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
                  </p>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
    </AdminNavigation>
  );
};

export default AdminAnnouncements;
