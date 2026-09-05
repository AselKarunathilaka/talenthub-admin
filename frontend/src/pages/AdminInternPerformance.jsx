import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart2,
  Users,
  Calendar,
  Filter,
  Search,
  Download,
  X,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { FaSpinner, FaCalendarAlt, FaVideo, FaStar } from "react-icons/fa";
import { API_BASE_URL } from "../api/apiConfig";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Constants ─────────────────────────────────────────────────────────────────
const BATCH   = 30;   // interns per batch
const THRESH  = 80;   // % threshold

// ── Auth ──────────────────────────────────────────────────────────────────────
const authHeaders = () => {
  const { token } = JSON.parse(localStorage.getItem("adminInfo") || "{}");
  return { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) };
};

// ── Colour helper ─────────────────────────────────────────────────────────────
const rc = (r) =>
  r >= 80
    ? { bar: "#22c55e", text: "text-green-600" }
    : r >= 60
    ? { bar: "#f59e0b", text: "text-amber-600" }
    : { bar: "#ef4444", text: "text-red-500" };

const status = (m, d, p) => {
  const a = (m + d + p) / 3;
  return a >= 80
    ? { label: "Good",    cls: "bg-green-100 text-green-700 border-green-200" }
    : a >= 60
    ? { label: "At Risk", cls: "bg-amber-100 text-amber-700 border-amber-200" }
    : { label: "Poor",    cls: "bg-red-100 text-red-600 border-red-200"       };
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "N/A";

// ── Tiny skeleton bar ─────────────────────────────────────────────────────────
const BarSkeleton = () => (
  <div className="space-y-1">
    <div className="flex justify-between">
      <div className="h-2 w-8 bg-gray-200 rounded animate-pulse" />
      <div className="h-2 w-6 bg-gray-100 rounded animate-pulse" />
    </div>
    <div className="h-1.5 bg-gray-100 rounded-full animate-pulse" />
  </div>
);

// ── Progress bar ──────────────────────────────────────────────────────────────
const Bar = ({ rate, label, icon }) => {
  const c = rc(rate);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-gray-500 font-medium">{icon}{label}</span>
        <span className={`font-bold ${c.text}`}>{rate}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, rate)}%`, backgroundColor: c.bar }} />
      </div>
    </div>
  );
};

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, color, loading }) => (
  <div className="rounded-2xl border border-gray-100 p-4 bg-white shadow-sm flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: `${color}18` }}>
      <span style={{ color }}>{icon}</span>
    </div>
    <div className="flex-1">
      {loading ? (
        <div className="space-y-2">
          <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <p className="text-2xl font-extrabold text-gray-800 leading-tight">{value}</p>
          <p className="text-xs font-semibold text-gray-500">{label}</p>
          {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
        </>
      )}
    </div>
  </div>
);

// ── Filter pill ───────────────────────────────────────────────────────────────
const Pill = ({ label, active, onClick }) => (
  <button onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-150
      ${active ? "bg-[#000066] text-white border-[#000066]"
               : "bg-white text-gray-500 border-gray-200 hover:border-[#000066] hover:text-[#000066]"}`}>
    {label}
  </button>
);

// ── Sort icon ─────────────────────────────────────────────────────────────────
const SI = ({ f, sf, sd }) =>
  sf === f ? (sd === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
           : <ChevronDown className="h-3 w-3 opacity-25" />;

// ── Skeleton row ──────────────────────────────────────────────────────────────
const SkelRow = () => (
  <tr className="animate-pulse border-b border-gray-50">
    <td className="px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="space-y-1.5"><div className="h-3 bg-gray-200 rounded w-32" /><div className="h-2.5 bg-gray-100 rounded w-20" /></div>
      </div>
    </td>
    <td className="px-4 py-4"><div className="h-3 bg-gray-200 rounded w-24" /></td>
    <td className="px-4 py-4"><BarSkeleton /></td>
    <td className="px-4 py-4"><BarSkeleton /></td>
    <td className="px-4 py-4"><BarSkeleton /></td>
    <td className="px-4 py-4"><div className="h-6 bg-gray-100 rounded-full w-14 animate-pulse" /></td>
  </tr>
);

// ── Skeleton card ─────────────────────────────────────────────────────────────
const SkelCard = () => (
  <div className="animate-pulse bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-gray-200" />
      <div className="flex-1 space-y-1.5"><div className="h-3.5 bg-gray-200 rounded w-36" /><div className="h-2.5 bg-gray-100 rounded w-24" /></div>
      <div className="h-6 w-16 bg-gray-100 rounded-full" />
    </div>
    <div className="h-2.5 bg-gray-100 rounded w-40" />
    <BarSkeleton /><BarSkeleton /><BarSkeleton />
  </div>
);

// ── Table row (memoised) ──────────────────────────────────────────────────────
const Row = React.memo(({ intern, idx, hasMetrics }) => {
  const m  = intern.meetingAttendanceRate ?? 0;
  const d  = intern.dailyAttendanceRate   ?? 0;
  const p  = intern.performanceQuality    ?? 0;
  const mc = rc(m); const dc = rc(d); const pc = rc(p);
  const st = status(m, d, p);
  const ini = (intern.traineeName || "?")[0].toUpperCase();

  return (
    <motion.tr
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.012, 0.25), duration: 0.15 }}
      className="hover:bg-gray-50/70 transition-colors border-b border-gray-50"
    >
      {/* Intern */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#000066] to-[#006600] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {ini}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate text-sm leading-tight">{intern.traineeName}</p>
            <p className="text-[11px] text-gray-400">
              {intern.traineeId}
              {intern.institute && <span className="ml-1 text-gray-300">· {intern.institute}</span>}
            </p>
          </div>
        </div>
      </td>
      {/* Start date */}
      <td className="px-4 py-3.5">
        <div className="text-xs text-gray-600 font-medium">{fmtDate(intern.trainingStartDate)}</div>
        {intern.weekdays && <div className="text-[10px] text-gray-400 mt-0.5">{intern.weekdays} weekdays</div>}
      </td>
      {/* Meeting */}
      <td className="px-4 py-3.5 w-[155px]">
        {!hasMetrics ? <BarSkeleton /> : (
          <>
            <div className="flex justify-between text-xs mb-1">
              <span className={`font-bold ${mc.text}`}>{m}%</span>
              <span className="text-gray-400 text-[10px]">{intern.meetingWeeksPresent}wk</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100,m)}%`, backgroundColor: mc.bar }} />
            </div>
          </>
        )}
      </td>
      {/* Daily */}
      <td className="px-4 py-3.5 w-[155px]">
        {!hasMetrics ? <BarSkeleton /> : (
          <>
            <div className="flex justify-between text-xs mb-1">
              <span className={`font-bold ${dc.text}`}>{d}%</span>
              <span className="text-gray-400 text-[10px]">{intern.dailyDaysPresent}d</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100,d)}%`, backgroundColor: dc.bar }} />
            </div>
          </>
        )}
      </td>
      {/* Quality */}
      <td className="px-4 py-3.5 w-[155px]">
        {!hasMetrics ? <BarSkeleton /> : (
          <>
            <div className="flex justify-between text-xs mb-1">
              <span className={`font-bold ${pc.text}`}>{p}%</span>
              <span className="text-gray-400 text-[10px]">{intern.logbookEntries} logs, {intern.commitsCount || 0} commits</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100,p)}%`, backgroundColor: pc.bar }} />
            </div>
          </>
        )}
      </td>
      {/* Status */}
      <td className="px-4 py-3.5 no-print">
        {!hasMetrics
          ? <div className="h-6 w-14 bg-gray-100 rounded-full animate-pulse" />
          : <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${st.cls}`}>{st.label}</span>
        }
      </td>
    </motion.tr>
  );
});
Row.displayName = "Row";

// ── Mobile card (memoised) ────────────────────────────────────────────────────
const Card = React.memo(({ intern, idx, hasMetrics }) => {
  const m = intern.meetingAttendanceRate ?? 0;
  const d = intern.dailyAttendanceRate   ?? 0;
  const p = intern.performanceQuality    ?? 0;
  const st  = status(m, d, p);
  const ini = (intern.traineeName || "?")[0].toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.015, 0.2) }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#000066] to-[#006600] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {ini}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 truncate text-sm">{intern.traineeName}</p>
          <p className="text-xs text-gray-400 truncate">{intern.traineeId} · {intern.institute}</p>
        </div>
        {hasMetrics
          ? <span className={`text-[11px] font-bold border px-2.5 py-1 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
          : <div className="h-6 w-14 bg-gray-100 rounded-full animate-pulse flex-shrink-0" />
        }
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <FaCalendarAlt className="text-gray-400 flex-shrink-0" />
        <span>Started {fmtDate(intern.trainingStartDate)}</span>
      </div>
      {!hasMetrics ? (
        <div className="space-y-2"><BarSkeleton /><BarSkeleton /><BarSkeleton /></div>
      ) : (
        <div className="space-y-2">
          <Bar rate={m} label={`Meeting (${intern.meetingWeeksPresent}wk)`} icon={<FaVideo className="text-[10px] text-green-500" />} />
          <Bar rate={d} label={`Daily (${intern.dailyDaysPresent}d)`}        icon={<Calendar className="h-3 w-3 text-blue-500" />} />
          <Bar rate={p} label={`Quality (${intern.logbookEntries} logs, ${intern.commitsCount || 0} commits)`} icon={<FaStar className="text-[10px] text-purple-500" />} />
        </div>
      )}
    </motion.div>
  );
});
Card.displayName = "Card";

// ── Main component ────────────────────────────────────────────────────────────
const AdminInternPerformance = () => {
  const navigate = useNavigate();

  const [internMap, setInternMap]   = useState(new Map());
  const [orderedIds, setOrderedIds] = useState([]); // stable sort order from server
  const [total, setTotal]           = useState(0);
  const [summaryData, setSummaryData] = useState(null); // Fast exact summary counts
  const [loadedPages, setLoadedPages] = useState(new Set());
  const [totalPages, setTotalPages]   = useState(1);
  const [firstLoading, setFirstLoading] = useState(true);
  const [error, setError]             = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const [searchTerm, setSearchTerm]   = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField]     = useState("traineeId");
  const [sortDir, setSortDir]         = useState("asc");
  const [meetingF, setMeetingF]       = useState("all");
  const [dailyF, setDailyF]           = useState("all");
  const [perfF, setPerfF]             = useState("all");
  const [exportLoading, setExportLoading] = useState(false);

  const sentinelRef  = useRef(null);
  const observerRef  = useRef(null);
  const fetchingRef  = useRef(false);
  const currentPageRef = useRef(0);

  // ── Fetch one page ─────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (page, isFirst = false) => {
    if (fetchingRef.current || loadedPages.has(page)) return;
    fetchingRef.current = true;
    if (isFirst) setFirstLoading(true); else setBatchLoading(true);

    try {
      const { token } = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      if (!token) { navigate("/admin-login"); return; }

      const res = await fetch(
        `${API_BASE_URL}/admin/intern-performance?page=${page}&limit=${BATCH}`,
        { headers: authHeaders() }
      );
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("adminInfo"); navigate("/admin-login"); return;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`);

      const data = await res.json();
      const newInterns = data.interns || [];

      setInternMap((prev) => {
        const next = new Map(prev);
        for (const intern of newInterns) {
          const id = String(intern._id);
          next.set(id, { ...(prev.get(id) || {}), ...intern, _metricsLoaded: true });
        }
        return next;
      });

      // On first page, establish the order from the server's sort
      if (isFirst) {
        setOrderedIds(newInterns.map((i) => String(i._id)));
        setTotal(data.total || 0);
        setTotalPages(data.pages || 1);
        currentPageRef.current = 1;
      } else {
        setOrderedIds((prev) => {
          const existing = new Set(prev);
          const additions = newInterns.map((i) => String(i._id)).filter((id) => !existing.has(id));
          return [...prev, ...additions];
        });
      }

      setLoadedPages((prev) => new Set([...prev, page]));
      currentPageRef.current = Math.max(currentPageRef.current, page);
      setError(null);
    } catch (err) {
      console.error("[InternPerformance] fetch error:", err);
      if (isFirst) setError(err.message || "Failed to load.");
    } finally {
      fetchingRef.current = false;
      if (isFirst) setFirstLoading(false); else setBatchLoading(false);
    }
  }, [navigate, loadedPages]);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPage(1, true);
  }, []); // eslint-disable-line

  // ── Auto-load next batches in background until complete ──────────────────────
  useEffect(() => {
    if (!firstLoading && totalPages > 1 && currentPageRef.current < totalPages) {
      const timer = setTimeout(() => {
        fetchPage(currentPageRef.current + 1, false);
      }, 500); // Slight delay so UI stays responsive while fetching
      return () => clearTimeout(timer);
    }
  }, [firstLoading, totalPages, loadedPages, internMap.size]);

  // ── IntersectionObserver — lazy-load next batch ─────────────────────────────
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          !fetchingRef.current &&
          !firstLoading &&
          currentPageRef.current < totalPages &&
          !loadedPages.has(currentPageRef.current + 1)
        ) {
          fetchPage(currentPageRef.current + 1, false);
        }
      },
      { rootMargin: "400px" }
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [firstLoading, totalPages, loadedPages, fetchPage]);

  // ── Hard refresh ────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setInternMap(new Map()); setOrderedIds([]); setTotal(0); setSummaryData(null);
    setLoadedPages(new Set()); setTotalPages(1); setError(null);
    fetchingRef.current = false; currentPageRef.current = 0;
    // small tick to let state reset, then reload
    setTimeout(() => {
      fetchPage(1, true);
    }, 0);
  }, [fetchPage]); // eslint-disable-line

  // ── PDF export (jsPDF) ──────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    setExportLoading(true);
    try {
      let exportData = Array.from(internMap.values());
      
      // If we haven't loaded everything, fetch all at once for the PDF
      if (internMap.size < total || total === 0) {
        const { token } = JSON.parse(localStorage.getItem("adminInfo") || "{}");
        const res = await fetch(`${API_BASE_URL}/admin/intern-performance`, { headers: authHeaders() });
        if (!res.ok) throw new Error("Export failed");
        const data = await res.json();
        exportData = data.interns || [];
        // Optimistically update local state to finish loading instantly
        setInternMap((prev) => {
          const next = new Map(prev);
          exportData.forEach(intern => next.set(String(intern._id), { ...intern, _metricsLoaded: true }));
          return next;
        });
        setTotal(data.total || 0);
      }

      // Apply current search/filter to export data
      const q = searchTerm.toLowerCase();
      let filtered = exportData.filter((intern) => {
        if (q &&
          !intern.traineeName?.toLowerCase().includes(q) &&
          !intern.traineeId?.toLowerCase().includes(q) &&
          !intern.email?.toLowerCase().includes(q) &&
          !intern.institute?.toLowerCase().includes(q)
        ) return false;
        const m = intern.meetingAttendanceRate ?? 0;
        const d = intern.dailyAttendanceRate   ?? 0;
        const p = intern.performanceQuality    ?? 0;
        if (meetingF === "above" && m <  THRESH) return false;
        if (meetingF === "below" && m >= THRESH) return false;
        if (dailyF   === "above" && d <  THRESH) return false;
        if (dailyF   === "below" && d >= THRESH) return false;
        if (perfF    === "above" && p <  THRESH) return false;
        if (perfF    === "below" && p >= THRESH) return false;
        return true;
      });

      // Sort matching UI
      const key = SORT_KEYS[sortField] || "traineeId";
      filtered.sort((a, b) => {
        let va = a[key]; let vb = b[key];
        if (typeof va === "string") va = va.toLowerCase();
        if (typeof vb === "string") vb = vb.toLowerCase();
        if (va == null) va = ""; if (vb == null) vb = "";
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });

      const doc = new jsPDF("landscape");
      
      // Header
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 102); // #000066
      doc.text("SLT Mobitel - Intern Performance Overview", 14, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleString("en-US")} | Total Interns: ${filtered.length}`, 14, 22);
      
      // Table Data
      const tableColumn = ["Intern Name", "ID", "Start Date", "Meeting", "Daily", "Work Quality", "Status"];
      const tableRows = filtered.map(intern => {
        const m = intern.meetingAttendanceRate ?? 0;
        const d = intern.dailyAttendanceRate ?? 0;
        const p = intern.performanceQuality ?? 0;
        const st = status(m, d, p);
        return [
          intern.traineeName || "-",
          intern.traineeId || "-",
          fmtDate(intern.trainingStartDate),
          `${m.toFixed(0)}% (${intern.meetingWeeksPresent}wk)`,
          `${d.toFixed(0)}% (${intern.dailyDaysPresent}d)`,
          `${p.toFixed(0)}% (${intern.logbookEntries} logs, ${intern.commitsCount || 0} commits)`,
          st.label
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 28,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [0, 0, 102], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] }
      });
      
      doc.save("Intern_Performance_Report.pdf");
    } catch (err) {
      alert("Export failed: " + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  // ── Filtering + sorting (client-side, instant on already-loaded data) ──────
  const SORT_KEYS = useMemo(() => ({
    name:        "traineeName",
    meeting:     "meetingAttendanceRate",
    daily:       "dailyAttendanceRate",
    performance: "performanceQuality",
    start:       "trainingStartDate",
  }), []);

  const sorted = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const list = orderedIds
      .map((id) => internMap.get(id))
      .filter(Boolean)
      .filter((intern) => {
        if (q &&
          !intern.traineeName?.toLowerCase().includes(q) &&
          !intern.traineeId?.toLowerCase().includes(q) &&
          !intern.email?.toLowerCase().includes(q) &&
          !intern.institute?.toLowerCase().includes(q)
        ) return false;

        const m = intern.meetingAttendanceRate ?? 0;
        const d = intern.dailyAttendanceRate   ?? 0;
        const p = intern.performanceQuality    ?? 0;
        if (meetingF === "above" && m <  THRESH) return false;
        if (meetingF === "below" && m >= THRESH) return false;
        if (dailyF   === "above" && d <  THRESH) return false;
        if (dailyF   === "below" && d >= THRESH) return false;
        if (perfF    === "above" && p <  THRESH) return false;
        if (perfF    === "below" && p >= THRESH) return false;
        return true;
      });

    const key = SORT_KEYS[sortField] || "traineeId";
    list.sort((a, b) => {
      let va = a[key]; let vb = b[key];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va == null) va = ""; if (vb == null) vb = "";
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [orderedIds, internMap, searchTerm, meetingF, dailyF, perfF, sortField, sortDir, SORT_KEYS]);

  // ── Auto-load missing commits (Prioritize Visible/Sorted) ────────────────
  useEffect(() => {
    if (internMap.size === 0 || firstLoading) return;

    // First try to find missing commits from the currently sorted/filtered list
    let missing = sorted.filter(
      (i) => (i.commitsCount === 0 || i.commitsCount === undefined) && !i._commitsFetched
    ).slice(0, 5);

    // If all sorted ones are done, pick from the rest of the map
    if (missing.length === 0) {
      missing = Array.from(internMap.values()).filter(
        (i) => (i.commitsCount === 0 || i.commitsCount === undefined) && !i._commitsFetched
      ).slice(0, 5);
    }

    if (missing.length === 0) return;

    const fetchCommits = async () => {
      // Mark as fetching immediately to prevent duplicate triggers
      setInternMap((prev) => {
        const next = new Map(prev);
        missing.forEach(m => {
          const intern = next.get(String(m._id));
          if (intern) next.set(String(m._id), { ...intern, _commitsFetched: true });
        });
        return next;
      });

      const results = await Promise.allSettled(missing.map(async (intern) => {
        const res = await fetch(`${API_BASE_URL}/admin/intern/${intern._id}/git-commits`, {
          headers: authHeaders()
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        
        let count = 0;
        if (data && data.totalCommits !== undefined) {
          count = data.totalCommits;
        } else if (data) {
          let all = [];
          const projects = Array.isArray(data) ? data : (data.projectCommits || []);
          function walk(node) {
            if (!node) return;
            if (Array.isArray(node.commits)) all.push(...node.commits);
            if (Array.isArray(node.modules)) node.modules.forEach(walk);
            if (Array.isArray(node.children)) node.children.forEach(walk);
            if (Array.isArray(node.subProjects)) node.subProjects.forEach(walk);
          }
          projects.forEach(walk);
          count = all.length;
        }
        return { id: String(intern._id), count };
      }));

      // Update state with newly fetched commit counts
      setInternMap((prev) => {
        const next = new Map(prev);
        results.forEach((r) => {
          if (r.status === "fulfilled" && r.value.count > 0) {
            const internId = r.value.id;
            const intern = next.get(internId);
            if (intern) {
              const newCount = r.value.count;
              const expectedCommits = Math.max(1, Math.ceil((intern.weekdays || 1) / 5) * 2);
              const commitRate = Math.min(100, Math.round((newCount / expectedCommits) * 100));
              
              const p = Math.round(((intern.dailyAttendanceRate || 0) + (intern.meetingAttendanceRate || 0) + (intern.logbookRate || 0) + commitRate) / 4);
              
              next.set(internId, { 
                ...intern, 
                commitsCount: newCount, 
                commitRate, 
                performanceQuality: p 
              });
            }
          }
        });
        return next;
      });
    };

    const timer = setTimeout(fetchCommits, 500); // pull faster
    return () => clearTimeout(timer);
  }, [sorted, internMap, firstLoading]);

  const toggleSort = (f) => {
    if (sortField === f) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(f); setSortDir("asc"); }
  };

  const clearFilters = () => {
    setMeetingF("all"); setDailyF("all"); setPerfF("all"); setSearchTerm("");
  };

  const allLoaded  = internMap.size >= total && total > 0;
  const loadedCount = internMap.size;
  
  // Use map filtering for exact counts once fully loaded
  const meetingAbove = [...internMap.values()].filter((i) => (i.meetingAttendanceRate ?? 0) >= THRESH).length;
  const dailyAbove   = [...internMap.values()].filter((i) => (i.dailyAttendanceRate   ?? 0) >= THRESH).length;
  const perfAbove    = [...internMap.values()].filter((i) => (i.performanceQuality    ?? 0) >= THRESH).length;
  const pct = (n) => (total > 0 ? ((n / total) * 100).toFixed(0) : 0);
  const activeFilters = (meetingF !== "all" ? 1 : 0) + (dailyF !== "all" ? 1 : 0) + (perfF !== "all" ? 1 : 0);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #perf-print, #perf-print * { visibility: visible !important; }
          #perf-print { position: fixed; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { margin: 15mm; size: A4 landscape; }
        }
      `}</style>

      <AdminNavigation>
        <div className="min-h-screen bg-gray-50">

          {/* Header */}
          <div className="no-print bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8 py-5 shadow-sm">
            <div className="max-w-screen-2xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#000066] to-[#006600] flex items-center justify-center shadow-md">
                  <BarChart2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-gray-900 leading-tight">Intern Performance Overview</h1>
                  <p className="text-xs text-gray-500">
                    Active interns · meeting · daily · work quality
                    {total > 0 && (
                      <span className="ml-2 font-semibold text-[#000066]">
                        ({loadedCount}/{total} loaded{!allLoaded && " — scroll for more"})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={handleRefresh} disabled={firstLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-all">
                  <RefreshCw className={`h-3.5 w-3.5 ${firstLoading ? "animate-spin" : ""}`} />Refresh
                </button>
                <button onClick={handleExportPDF} disabled={exportLoading || firstLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#000066] to-[#006600] text-white text-sm font-semibold hover:opacity-90 transition-all shadow-sm disabled:opacity-60">
                  {exportLoading ? <FaSpinner className="animate-spin h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                  {exportLoading ? "Loading…" : "Export PDF"}
                </button>
              </div>
            </div>
          </div>

          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

            {/* Stat cards (show skeleton until all data is loaded to ensure exact counts) */}
            <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard loading={!allLoaded} icon={<Users className="h-5 w-5" />}       label="Active Interns"    value={total || "—"} sub="currently active"                            color="#000066" />
              <StatCard loading={!allLoaded} icon={<FaVideo className="text-base" />}    label="Meeting ≥80%"      value={meetingAbove} sub={`${pct(meetingAbove)}% of interns`}          color="#22c55e" />
              <StatCard loading={!allLoaded} icon={<Calendar className="h-5 w-5" />}     label="Daily ≥80%"        value={dailyAbove}   sub={`${pct(dailyAbove)}% of interns`}            color="#3b82f6" />
              <StatCard loading={!allLoaded} icon={<FaStar className="text-base" />}     label="Performance ≥80%"  value={perfAbove}    sub={`${pct(perfAbove)}% of interns`}             color="#8b5cf6" />
            </div>

            {/* Search + filter bar */}
            <div className="no-print bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, ID, email, institute…"
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#000066]/20 focus:border-[#000066] placeholder:text-gray-400" />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <button onClick={() => setShowFilters((v) => !v)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all
                    ${showFilters || activeFilters > 0 ? "bg-[#000066] text-white border-[#000066]"
                                                       : "bg-white text-gray-600 border-gray-200 hover:border-[#000066] hover:text-[#000066]"}`}>
                  <Filter className="h-4 w-4" />Filters
                  {activeFilters > 0 && (
                    <span className="bg-white text-[#000066] rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">{activeFilters}</span>
                  )}
                </button>
                {activeFilters > 0 && (
                  <button onClick={clearFilters}
                    className="px-4 py-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 text-sm font-semibold flex items-center gap-1.5">
                    <X className="h-4 w-4" />Clear
                  </button>
                )}
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                    <div className="pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { label: "Meeting Attendance", icon: <FaVideo className="text-[#22c55e]" />, val: meetingF, set: setMeetingF },
                        { label: "Daily Attendance",   icon: <Calendar className="h-3 w-3 text-[#3b82f6]" />, val: dailyF, set: setDailyF },
                        { label: "Performance",        icon: <FaStar className="text-[#8b5cf6]" />, val: perfF, set: setPerfF },
                      ].map(({ label, icon, val, set }) => (
                        <div key={label}>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">{icon}{label}</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Pill label="All"   active={val === "all"}   onClick={() => set("all")} />
                            <Pill label="≥ 80%" active={val === "above"} onClick={() => set("above")} />
                            <Pill label="< 80%" active={val === "below"} onClick={() => set("below")} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!firstLoading && (
                <p className="text-xs text-gray-400">
                  Showing <span className="font-semibold text-gray-700">{sorted.length}</span> of{" "}
                  <span className="font-semibold text-gray-700">{total}</span> active interns
                  {!allLoaded && <span className="ml-1 text-amber-500">· scroll to load more metrics</span>}
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center border border-red-100">
                  <AlertCircle className="h-7 w-7 text-red-400" />
                </div>
                <div className="text-center">
                  <p className="text-gray-800 font-semibold">{error}</p>
                  <button onClick={handleRefresh} className="mt-3 px-4 py-2 rounded-xl bg-[#000066] text-white text-sm font-semibold hover:opacity-90">
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* Printable region */}
            {!error && (
              <div id="perf-print">
                <div className="hidden print:block mb-6">
                  <h2 className="text-xl font-bold">SLT Mobitel — Intern Performance Overview</h2>
                  <p className="text-sm text-gray-500 mt-1">Generated: {new Date().toLocaleString("en-US")} | Active Interns: {total}</p>
                  <div className="border-b border-gray-300 mt-3" />
                </div>

                {/* Desktop table */}
                <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#000066]/5 to-[#006600]/5 border-b border-gray-100">
                        {[
                          { k: "name",        lbl: "Intern",      icon: null },
                          { k: "start",       lbl: "Start Date",  icon: null },
                          { k: "meeting",     lbl: "Meeting",     icon: <FaVideo className="text-green-500 text-[10px]" /> },
                          { k: "daily",       lbl: "Daily",       icon: <Calendar className="h-3 w-3 text-blue-500" /> },
                          { k: "performance", lbl: "Work Quality",icon: <FaStar className="text-purple-500 text-[10px]" /> },
                        ].map(({ k, lbl, icon }) => (
                          <th key={k} className="text-left px-4 lg:px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <button onClick={() => toggleSort(k)} className="flex items-center gap-1 hover:text-gray-800 transition-colors no-print">
                              {icon}{lbl}<SI f={k} sf={sortField} sd={sortDir} />
                            </button>
                            <span className="hidden print:inline">{lbl}</span>
                          </th>
                        ))}
                        <th className="text-left px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider no-print">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {firstLoading && Array.from({ length: 8 }).map((_, i) => <SkelRow key={i} />)}
                      {!firstLoading && sorted.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-16 text-center">
                            <div className="flex flex-col items-center gap-3 text-gray-400">
                              <BarChart2 className="h-10 w-10 opacity-30" />
                              <p className="font-medium">No interns match your filters</p>
                              {activeFilters > 0 && <button onClick={clearFilters} className="text-sm text-[#000066] underline">Clear filters</button>}
                            </div>
                          </td>
                        </tr>
                      )}
                      {sorted.map((intern, idx) => (
                        <Row key={String(intern._id)} intern={intern} idx={idx} hasMetrics={!!intern._metricsLoaded} />
                      ))}
                      {batchLoading && Array.from({ length: 4 }).map((_, i) => <SkelRow key={`m${i}`} />)}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden no-print space-y-3">
                  {firstLoading && Array.from({ length: 5 }).map((_, i) => <SkelCard key={i} />)}
                  {!firstLoading && sorted.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-16 bg-white rounded-2xl border border-gray-100">
                      <BarChart2 className="h-10 w-10 text-gray-300" />
                      <p className="text-sm text-gray-400 font-medium">No interns match your filters</p>
                    </div>
                  )}
                  {sorted.map((intern, idx) => (
                    <Card key={String(intern._id)} intern={intern} idx={idx} hasMetrics={!!intern._metricsLoaded} />
                  ))}
                  {batchLoading && Array.from({ length: 3 }).map((_, i) => <SkelCard key={`m${i}`} />)}
                </div>
              </div>
            )}

            {/* Sentinel for IntersectionObserver */}
            <div ref={sentinelRef} className="h-4" />

            {/* Footer */}
            {allLoaded && sorted.length > 0 && (
              <div className="no-print flex items-center justify-between text-xs text-gray-400 pb-4">
                <span className="text-green-500 font-medium">✓ All {total} interns loaded</span>
                <div className="flex items-center gap-4">
                  {[["#22c55e","≥ 80% Good"],["#f59e0b","60–79% At Risk"],["#ef4444","< 60% Poor"]].map(([c,l]) => (
                    <span key={l} className="flex items-center gap-1.5">
                      <span className="w-3 h-1.5 rounded-full inline-block" style={{ backgroundColor: c }} />{l}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </AdminNavigation>
    </>
  );
};

export default AdminInternPerformance;
