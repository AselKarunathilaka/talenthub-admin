import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import { Lightbulb } from "lucide-react";
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
  FaToggleOn,
  FaToggleOff,
  FaMagic,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { featureTipAdminApi } from "../api/adminApi";

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
const AdminFeatureTips = () => {
  const navigate = useNavigate();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [section, setSection] = useState("");
  const [emoji, setEmoji] = useState("✨");
  const [color, setColor] = useState("#0ea5e9");
  const [sending, setSending] = useState(false);

  // List state
  const [tips, setTips] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // UI state
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState(null);

  const showToast = (msg, type = "info") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchTips = async () => {
    setLoadingList(true);
    try {
      const data = await featureTipAdminApi.getAll();
      setTips(data);
    } catch (err) {
      setError("Failed to load feature tips.");
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
    fetchTips();
  }, [navigate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchTerm]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!title.trim() || !description.trim()) {
      showToast("Title and Description are required.", "error");
      return;
    }

    setSending(true);
    try {
      await featureTipAdminApi.create({
        title,
        description,
        section,
        emoji,
        color,
      });
      showToast("Feature tip created successfully!", "success");
      setTitle("");
      setDescription("");
      setSection("");
      setEmoji("✨");
      setColor("#0ea5e9");
      setCurrentPage(1);
      fetchTips();
    } catch (err) {
      showToast(err.message || "Failed to create feature tip.", "error");
    } finally {
      setSending(false);
    }
  };

  // ── Toggle Status ──────────────────────────────────────────────────────────
  const handleToggle = async (id) => {
    setTogglingId(id);
    try {
      const updated = await featureTipAdminApi.toggle(id);
      setTips((prev) =>
        prev.map((t) => (t._id === id ? { ...t, isActive: updated.isActive } : t))
      );
      showToast(
        updated.isActive ? "Tip is now active" : "Tip deactivated",
        "success"
      );
    } catch (err) {
      showToast("Failed to toggle feature tip status.", "error");
    } finally {
      setTogglingId(null);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await featureTipAdminApi.delete(id);
      setTips((prev) => prev.filter((a) => a._id !== id));
      showToast("Feature tip deleted.", "info");
    } catch (err) {
      showToast("Failed to delete feature tip.", "error");
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  // ── Filter + paginate ──────────────────────────────────────────────────────
  const filtered = tips.filter((t) => {
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && t.isActive) ||
      (filterStatus === "inactive" && !t.isActive);
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.section || "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const goTo = (p) => setCurrentPage(Math.max(1, Math.min(p, totalPages)));

  const pageNumbers = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 3) return [1, 2, 3, 4, "…", totalPages];
    if (safePage >= totalPages - 2) return [1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "…", safePage - 1, safePage, safePage + 1, "…", totalPages];
  };

  // ── Pre-defined colors
  const COLOR_OPTIONS = [
    { value: "#0ea5e9", label: "Blue" },
    { value: "#10b981", label: "Green" },
    { value: "#f59e0b", label: "Amber" },
    { value: "#ec4899", label: "Pink" },
    { value: "#8b5cf6", label: "Purple" },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <AdminNavigation>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-pink-50 text-gray-800 relative z-10 overflow-hidden">
        {/* Floating BG blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-80 h-80 rounded-full bg-blue-100/40 -top-20 -left-20"
          animate={{ y: [0, -30, 0], x: [0, 20, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-pink-100/40 top-1/4 right-0"
          animate={{ y: [0, 20, 0], x: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
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
                  <Lightbulb className="text-[#0056a2] h-8 w-8" />
                </div>
                Feature Tips
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05, duration: 0.2 }}
                className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
              >
                Create "What's New" modals to announce new features to all interns.
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
                  <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 text-xl font-bold">×</button>
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
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center shadow-sm">
                    <FaMagic className="h-4 w-4 text-pink-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      New Feature Tip
                    </h3>
                    <p className="text-xs text-gray-500">
                      Shown to every intern once upon login
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. 🆕 Study Leave feature is now live!"
                      maxLength={120}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder="Explain what the feature is and how to use it..."
                      maxLength={1000}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm shadow-sm resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Section (Optional)
                      </label>
                      <input
                        type="text"
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        placeholder="e.g. Logbook"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Emoji
                      </label>
                      <input
                        type="text"
                        value={emoji}
                        onChange={(e) => setEmoji(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-center text-lg"
                        maxLength={2}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Accent Color
                    </label>
                    <div className="flex gap-2">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setColor(c.value)}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${color === c.value ? "border-gray-800 scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>

                  <motion.button
                    onClick={handleCreate}
                    disabled={sending}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed"
                    whileHover={{ scale: sending ? 1 : 1.02 }}
                    whileTap={{ scale: sending ? 1 : 0.98 }}
                  >
                    {sending ? (
                      <><FaSpinner className="h-4 w-4 animate-spin" /><span>Saving...</span></>
                    ) : (
                      <><FaPaperPlane className="h-4 w-4" /><span>Publish Tip</span></>
                    )}
                  </motion.button>
                </div>
              </motion.div>

              {/* ── Tips List ── */}
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
                        placeholder="Search feature tips..."
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm shadow-sm"
                      />
                    </div>
                    <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                      <FaFilter className="text-gray-400 h-3.5 w-3.5" />
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-transparent border-0 focus:ring-0 text-sm text-gray-700 pr-1"
                      >
                        <option value="all">All</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* List card */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900">
                      Feature Tips List
                    </h3>
                  </div>

                  {loadingList ? (
                    <div className="flex justify-center py-16">
                      <FaSpinner className="animate-spin text-pink-500 h-8 w-8" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      No feature tips found.
                    </div>
                  ) : (
                    <>
                      <div className="divide-y divide-gray-100">
                        {paginated.map((t) => {
                          const isExpanded = expandedId === t._id;
                          return (
                            <div key={t._id} className={`p-4 md:p-5 transition-colors ${!t.isActive ? 'bg-gray-50 opacity-70' : 'hover:bg-gray-50/70'}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start space-x-3 flex-1 min-w-0">
                                  <div 
                                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white"
                                    style={{ backgroundColor: t.color || '#0ea5e9' }}
                                  >
                                    {t.emoji}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className={`text-sm font-semibold truncate ${!t.isActive ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                        {t.title}
                                      </h4>
                                      {t.section && (
                                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-md text-gray-600">
                                          {t.section}
                                        </span>
                                      )}
                                      {!t.isActive && (
                                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                                          Inactive
                                        </span>
                                      )}
                                    </div>
                                    <p className={`text-sm text-gray-600 mt-1 whitespace-pre-wrap transition-all ${isExpanded ? "" : "line-clamp-2"}`}>
                                      {t.description}
                                    </p>
                                    <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                      <FaCalendarAlt /> {formatDateTime(t.createdAt)}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button onClick={() => handleToggle(t._id)} className="p-2 text-gray-400 hover:text-blue-500" title="Toggle Active">
                                    {togglingId === t._id ? <FaSpinner className="animate-spin" /> : t.isActive ? <FaToggleOn className="text-green-500 text-lg" /> : <FaToggleOff className="text-lg" />}
                                  </button>
                                  <button onClick={() => toggleExpand(t._id)} className="p-2 text-gray-400 hover:text-blue-500" title="Expand">
                                    <FaChevronDown className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                  <button onClick={() => setConfirmDelete(t._id)} className="p-2 text-gray-400 hover:text-red-500" title="Delete">
                                    {deletingId === t._id ? <FaSpinner className="animate-spin" /> : <FaTrash />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {totalPages > 1 && (
                        <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/60">
                          <div className="flex items-center justify-between gap-2">
                            <motion.button onClick={() => goTo(safePage - 1)} disabled={safePage === 1} className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"><FaChevronLeft /><span>Prev</span></motion.button>
                            <div className="flex items-center gap-1">
                              {pageNumbers().map((p, i) => p === "…" ? <span key={`e-${i}`} className="px-2 text-xs text-gray-400">…</span> : <button key={p} onClick={() => goTo(p)} className={`min-w-[2rem] h-8 text-xs rounded-lg border ${safePage === p ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white' : 'bg-white text-gray-600'}`}>{p}</button>)}
                            </div>
                            <motion.button onClick={() => goTo(safePage + 1)} disabled={safePage === totalPages} className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"><span>Next</span><FaChevronRight /></motion.button>
                          </div>
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
          <motion.div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <h4 className="text-base font-semibold text-gray-900 mb-2">Delete Feature Tip</h4>
              <p className="text-sm text-gray-500 mb-4">This action cannot be undone.</p>
              <div className="flex space-x-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancel</button>
                <button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium">Delete</button>
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

export default AdminFeatureTips;
