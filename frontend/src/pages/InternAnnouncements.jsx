import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Bell,
  AlertTriangle,
  Info,
  CheckCircle2,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navigation from "../components/Navigation";
import SectionTip from "../components/SectionTip";
import { API_BASE_URL } from "../api/apiConfig";

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

const PRIORITY_META = {
  urgent: {
    label: "Urgent",
    unreadClass: "border-l-4 border-rose-500 bg-rose-50 ring-1 ring-rose-200",
    readClass: "border-l-4 border-rose-200 bg-white",
    badgeClass: "bg-rose-100 text-rose-700",
    icon: (
      <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
    ),
  },
  important: {
    label: "Important",
    unreadClass:
      "border-l-4 border-amber-500 bg-amber-50 ring-1 ring-amber-200",
    readClass: "border-l-4 border-amber-200 bg-white",
    badgeClass: "bg-amber-100 text-amber-700",
    icon: <Bell className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />,
  },
  normal: {
    label: "Normal",
    unreadClass: "border-l-4 border-[#0056a2] bg-blue-50 ring-1 ring-blue-200",
    readClass: "border-l-4 border-blue-200 bg-white",
    badgeClass: "bg-blue-50 text-[#0056a2]",
    icon: <Info className="h-4 w-4 text-[#0056a2] flex-shrink-0 mt-0.5" />,
  },
};

const READ_KEY = "readAnnouncementIds";
const PAGE_SIZE = 5;

const getReadIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

const saveReadIds = (set) => {
  localStorage.setItem(READ_KEY, JSON.stringify([...set]));
};

// ─── Token helper ─────────────────────────────────────────────────────────────
const getInternToken = () => {
  const authToken = localStorage.getItem("authToken");
  if (authToken) return authToken;

  const userData = localStorage.getItem("userData");
  if (userData) {
    try {
      const parsed = JSON.parse(userData);
      if (parsed.token) return parsed.token;
      if (parsed.authToken) return parsed.authToken;
    } catch {
      return userData;
    }
  }
  return null;
};

// ─── Fetch helper ─────────────────────────────────────────────────────────────
const fetchActiveAnnouncements = async () => {
  const token = getInternToken();
  const res = await fetch(`${API_BASE_URL}/announcements/active`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch announcements: ${res.status}`);
  return res.json();
};

// ─── Main Component ───────────────────────────────────────────────────────────
const InternAnnouncements = () => {
  const navigate = useNavigate();

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [readIds, setReadIds] = useState(getReadIds);
  const [filterPriority, setFilterPriority] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Auth guard
  useEffect(() => {
    const internId = localStorage.getItem("internId");
    if (!internId) navigate("/");
  }, [navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchActiveAnnouncements();
      const sorted = [...data].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );
      setAnnouncements(sorted);
    } catch (err) {
      setError("Failed to load announcements. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterPriority]);

  // Mark an individual announcement as read when expanded
  const toggleExpand = (id) => {
    setExpandedId((prev) => {
      const next = prev === id ? null : id;
      if (next) {
        // Mark as read on expand
        const updated = new Set(readIds);
        updated.add(id);
        setReadIds(updated);
        saveReadIds(updated);
      }
      return next;
    });
  };

  // Filter
  const filtered = announcements.filter(
    (a) => filterPriority === "all" || a.priority === filterPriority,
  );

  // Pagination
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

  const unreadCount = announcements.filter((a) => !readIds.has(a._id)).length;

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("internId");
    localStorage.removeItem("userData");
    navigate("/");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-sans text-gray-800">
      <Navigation onLogout={handleLogout} />

      <div className="flex-1 w-full lg:mt-20 lg:px-6 xl:px-10 pb-10">
        <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1200px] w-full">
          <SectionTip sectionKey="announcements" />
          {/* Page Header */}
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
              >
                <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl relative">
                  <Bell className="text-[#0056a2] h-8 w-8" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 inline-flex items-center justify-center h-6 w-6 bg-rose-500 text-white text-xs font-bold rounded-full shadow-sm ring-2 ring-white">
                      {unreadCount}
                    </span>
                  )}
                </div>
                Announcements
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05, duration: 0.2 }}
                className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
              >
                Important notices and updates from management
              </motion.p>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex w-full sm:w-fit overflow-x-auto scrollbar-hide gap-1 sm:gap-3 mb-6 bg-white p-1.5 sm:p-2 rounded-2xl border border-gray-100 shadow-sm">
            {["all", "urgent", "important", "normal"].map((f) => (
              <button
                key={f}
                onClick={() => setFilterPriority(f)}
                className={`flex-1 sm:flex-none whitespace-nowrap text-center px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wide sm:tracking-widest rounded-xl transition-all ${
                  filterPriority === f
                    ? f === "urgent"
                      ? "bg-rose-100 text-rose-800"
                      : f === "important"
                        ? "bg-amber-100 text-amber-800"
                        : f === "normal"
                          ? "bg-blue-50 text-[#0056a2]"
                          : "bg-gray-800 text-white"
                    : "bg-transparent text-gray-500 hover:bg-gray-50"
                }`}
              >
                {f === "all" ? "All" : PRIORITY_META[f]?.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0056a2] mb-4"></div>
              <p className="text-sm font-bold text-gray-500">
                Loading announcements...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <AlertTriangle className="h-12 w-12 text-rose-400 mb-4" />
              <p className="text-sm font-bold text-rose-600 mb-5">{error}</p>
              <button
                onClick={load}
                className="px-6 py-2.5 bg-[#0056a2] hover:bg-[#00488a] text-white rounded-xl font-bold shadow-sm shadow-blue-500/20 transition-all"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-1">
                No announcements
              </h3>
              <p className="text-sm font-medium text-gray-400">
                {filterPriority !== "all"
                  ? "No announcements match this filter."
                  : "There are no announcements at the moment."}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex-1">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-lg font-extrabold text-gray-900">
                  Inbox
                </h3>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">
                  {filtered.length} total
                </span>
              </div>
              
              <div className="divide-y divide-gray-100">
                {paginated.map((a) => {
                  const meta =
                    PRIORITY_META[a.priority] || PRIORITY_META.normal;
                  const isRead = readIds.has(a._id);
                  const isExpanded = expandedId === a._id;

                  return (
                    <div
                      key={a._id}
                      className={`transition-all w-full group ${
                        isRead ? "bg-white hover:bg-slate-50/50" : "bg-[#00b4eb]/5 hover:bg-[#00b4eb]/10"
                      } ${meta.unreadClass.replace("bg-", "ignore-bg-").replace("ring-", "ignore-ring-")}`}
                      style={{ 
                        borderLeftWidth: '4px',
                        borderLeftColor: isRead ? 'transparent' : (
                          a.priority === 'urgent' ? '#f43f5e' : 
                          a.priority === 'important' ? '#f59e0b' : '#0056a2'
                        )
                      }}
                    >
                      {/* Header row */}
                      <button
                        className="w-full text-left px-5 sm:px-6 py-5 min-w-0"
                        onClick={() => toggleExpand(a._id)}
                      >
                        <div className="flex items-start justify-between gap-4 min-w-0">
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className={`mt-0.5 p-2 rounded-xl flex-shrink-0 ${isRead ? 'bg-gray-50' : 'bg-white shadow-sm'}`}>
                              {meta.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Title row */}
                              <div className="flex flex-wrap items-center gap-3 mb-2">
                                <span
                                  className={`text-base font-bold break-words min-w-0 ${
                                    isRead ? "text-gray-700" : "text-gray-900"
                                  }`}
                                  style={{
                                    wordBreak: "break-word",
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  {a.title}
                                </span>
                                <span
                                  className={`text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full font-black flex-shrink-0 ${meta.badgeClass}`}
                                >
                                  {meta.label}
                                </span>
                                {!isRead && (
                                  <span className="text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full font-black bg-blue-600 text-white flex-shrink-0">
                                    New
                                  </span>
                                )}
                              </div>

                              {/* Message preview (collapsed) */}
                              {!isExpanded && (
                                <p
                                  className={`text-sm font-medium leading-relaxed ${isRead ? "text-gray-400" : "text-gray-600"}`}
                                  style={{
                                    wordBreak: "break-word",
                                    overflowWrap: "anywhere",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 1,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                  }}
                                >
                                  {a.message}
                                </p>
                              )}

                              {/* Date */}
                              <div className="flex items-center gap-1.5 mt-2.5">
                                <Calendar className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                <span className="text-xs font-bold text-gray-400">
                                  {formatDateTime(a.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Chevron */}
                          <div className="flex-shrink-0 mt-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <div className="p-2 rounded-xl text-gray-400 hover:text-[#0056a2] hover:bg-blue-50 transition-colors">
                              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                                <ChevronDown className="h-4 w-4" />
                              </motion.div>
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Expanded body */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-5 sm:px-6 pb-5 pt-0 min-w-0"
                          >
                            <div className="ml-12 border-t border-gray-100 pt-4 min-w-0">
                              <p
                                className="text-sm font-medium text-gray-700 whitespace-pre-wrap leading-relaxed min-w-0"
                                style={{
                                  wordBreak: "break-word",
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {a.message}
                              </p>
                              <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-gray-400">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                                <span>Marked as Read</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-100 bg-slate-50/50">
                  <div className="flex items-center justify-between gap-4">
                    <motion.button
                      onClick={() => goTo(safePage - 1)}
                      disabled={safePage === 1}
                      className="flex items-center space-x-2 px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                      whileHover={{ scale: safePage === 1 ? 1 : 1.02 }}
                      whileTap={{ scale: safePage === 1 ? 1 : 0.98 }}
                    >
                      <ChevronLeft className="h-3 w-3" />
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
                      <ChevronRight className="h-3 w-3" />
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default InternAnnouncements;
