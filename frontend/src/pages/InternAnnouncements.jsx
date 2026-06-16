import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Megaphone,
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
    // unread: strong red left border + light red tint
    unreadClass: "border-l-4 border-red-500 bg-red-50 ring-1 ring-red-200",
    // read: muted border, no background tint
    readClass: "border-l-4 border-red-200 bg-white",
    badgeClass: "bg-red-100 text-red-700",
    icon: (
      <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
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
    unreadClass: "border-l-4 border-blue-500 bg-blue-50 ring-1 ring-blue-200",
    readClass: "border-l-4 border-blue-200 bg-white",
    badgeClass: "bg-blue-100 text-blue-700",
    icon: <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />,
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
    <div className="flex min-h-screen bg-gray-50">
      <Navigation onLogout={handleLogout} />

      <div className="flex-1 flex flex-col lg:mt-7 lg:px-10 min-w-0">
        <div className="h-16" />
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto min-w-0">
          <SectionTip sectionKey="announcements" />
          {/* Page Header */}
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Megaphone className="h-7 w-7 text-blue-600 flex-shrink-0" />
              Announcements
              {unreadCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h2>
            <p className="text-gray-600 mt-1">
              Important notices and updates from management
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2 mb-5">
            {["all", "urgent", "important", "normal"].map((f) => (
              <button
                key={f}
                onClick={() => setFilterPriority(f)}
                className={`px-3 py-1.5 text-sm rounded-full font-medium transition-all capitalize ${
                  filterPriority === f
                    ? f === "urgent"
                      ? "bg-red-100 text-red-800"
                      : f === "important"
                        ? "bg-amber-100 text-amber-800"
                        : f === "normal"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f === "all" ? "All" : PRIORITY_META[f]?.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-3" />
              <p className="text-gray-500 font-medium">
                Loading announcements...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertTriangle className="h-12 w-12 text-red-400 mb-3" />
              <p className="text-red-600 font-medium mb-4">{error}</p>
              <button
                onClick={load}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl shadow-sm">
              <Megaphone className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-base font-medium text-gray-600 mb-1">
                No announcements
              </h3>
              <p className="text-sm text-gray-400">
                {filterPriority !== "all"
                  ? "No announcements match this filter."
                  : "There are no announcements at the moment."}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginated.map((a) => {
                  const meta =
                    PRIORITY_META[a.priority] || PRIORITY_META.normal;
                  const isRead = readIds.has(a._id);
                  const isExpanded = expandedId === a._id;

                  return (
                    <div
                      key={a._id}
                      className={`rounded-xl shadow-sm overflow-hidden transition-all w-full ${
                        isRead ? meta.readClass : meta.unreadClass
                      }`}
                    >
                      {/* Unread indicator bar at top */}
                      {!isRead && (
                        <div className="flex items-center gap-1.5 px-4 pt-2 pb-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                            New
                          </span>
                        </div>
                      )}

                      {/* Header row */}
                      <button
                        className="w-full text-left px-4 py-3 min-w-0"
                        onClick={() => toggleExpand(a._id)}
                      >
                        <div className="flex items-start justify-between gap-3 min-w-0">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {meta.icon}
                            <div className="flex-1 min-w-0">
                              {/* Title row */}
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span
                                  className={`text-sm font-semibold break-words break-all min-w-0 ${
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
                                  className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${meta.badgeClass}`}
                                >
                                  {meta.label}
                                </span>
                                {!isRead && (
                                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-600 text-white flex-shrink-0">
                                    Unread
                                  </span>
                                )}
                              </div>

                              {/* Message preview (collapsed) */}
                              {!isExpanded && (
                                <p
                                  className={`text-sm mt-0.5 ${isRead ? "text-gray-400" : "text-gray-600"}`}
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
                              <div className="flex items-center gap-1 mt-1.5">
                                <Calendar className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                <span className="text-xs text-gray-400">
                                  {formatDateTime(a.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Chevron */}
                          <div className="flex-shrink-0 mt-0.5">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Expanded body */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 min-w-0">
                          <div className="ml-7 border-t border-gray-200/60 pt-3 min-w-0">
                            <p
                              className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed min-w-0"
                              style={{
                                wordBreak: "break-word",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {a.message}
                            </p>
                            <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
                              <CheckCircle2 className="h-3 w-3 text-green-400 flex-shrink-0" />
                              <span>Read</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    {/* Prev */}
                    <button
                      onClick={() => goTo(safePage - 1)}
                      disabled={safePage === 1}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>Prev</span>
                    </button>

                    {/* Page numbers */}
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
                          <button
                            key={p}
                            onClick={() => goTo(p)}
                            className={`min-w-[2rem] h-8 px-2 text-xs font-medium rounded-lg border transition-all ${
                              safePage === p
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            {p}
                          </button>
                        ),
                      )}
                    </div>

                    {/* Next */}
                    <button
                      onClick={() => goTo(safePage + 1)}
                      disabled={safePage === totalPages}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-gray-400">
                    Showing {(safePage - 1) * PAGE_SIZE + 1}–
                    {Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
                    {filtered.length} announcements
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default InternAnnouncements;
