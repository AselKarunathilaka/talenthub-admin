import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import { ScanLine } from "lucide-react";
import {
  FaArrowLeft,
  FaCalendarCheck,
  FaSpinner,
  FaUser,
  FaSearch,
  FaRegPaperPlane,
  FaFileExcel,
  FaBell,
  FaFilter,
  FaTimes,
  FaClock,
  FaCalendarAlt,
  FaChartBar,
  FaMapMarkerAlt,
  FaChevronDown,
  FaEdit,
  FaFilePdf,
  FaCalendarDay,
  FaUsers,
  FaChevronLeft,
  FaChevronRight,
  FaEnvelope,
  FaCheckCircle,
  FaTimesCircle,
  FaClipboardList,
  FaVideo,
  FaLayerGroup,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../api/apiConfig";

// ── API helpers ───────────────────────────────────────────────────────────────
const getAuthHeaders = () => {
  const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
  return {
    "Content-Type": "application/json",
    ...(adminInfo.token && { Authorization: `Bearer ${adminInfo.token}` }),
  };
};

async function downloadBlob(res, filename) {
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

const attendanceApi = {
  getMeetingByDate: async (date) => {
    const res = await fetch(
      `${API_BASE_URL}/admin/attendance/by-date?date=${date}`,
      { headers: getAuthHeaders() },
    );
    if (!res.ok) throw new Error((await res.json()).error || "Request failed");
    return res.json();
  },

  getDailyByDate: async (date) => {
    const res = await fetch(
      `${API_BASE_URL}/admin/attendance/by-date-daily?date=${date}`,
      { headers: getAuthHeaders() },
    );
    if (!res.ok) throw new Error((await res.json()).error || "Request failed");
    return res.json();
  },

  exportMeetingPdf: (date) =>
    fetch(`${API_BASE_URL}/admin/attendance/export-meeting-pdf?date=${date}`, {
      headers: getAuthHeaders(),
    }).then((res) =>
      downloadBlob(res, `Meeting_Attendance_Report_${date}.pdf`),
    ),

  exportDailyPdf: (date) =>
    fetch(`${API_BASE_URL}/admin/attendance/export-daily-pdf?date=${date}`, {
      headers: getAuthHeaders(),
    }).then((res) => downloadBlob(res, `Daily_Attendance_Report_${date}.pdf`)),

  exportMeetingExcel: (date) =>
    fetch(`${API_BASE_URL}/admin/attendance/export-excel?date=${date}`, {
      headers: getAuthHeaders(),
    }).then((res) => downloadBlob(res, `Attendance_Report_${date}.xlsx`)),

  triggerReport: async (recipients) => {
    const res = await fetch(`${API_BASE_URL}/admin/attendance/trigger-report`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ recipients }),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Request failed");
    return res.json();
  },

  exportNonAttendanceExcel: async () => {
    const res = await fetch(
      `${API_BASE_URL}/admin/attendance/export-non-attendance-excel`,
      { headers: getAuthHeaders() },
    );
    if (!res.ok) throw new Error("Non-attendance export failed");
    const d = new Date();
    const localToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    await downloadBlob(res, `Non_Attendance_Report_${localToday}.xlsx`);
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

const getLocalToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    face_meeting: {
      label: "Face Meeting",
      cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    meeting: {
      label: "Meeting",
      cls: "bg-blue-100 text-blue-700 border-blue-200",
    },
    manual: {
      label: "Manual",
      cls: "bg-amber-100 text-amber-700 border-amber-200",
    },
    manual_meeting: {
      label: "Manual Meeting",
      cls: "bg-orange-100 text-orange-700 border-orange-200",
    },
    daily: { label: "Daily", cls: "bg-cyan-100 text-cyan-700 border-cyan-200" },
    daily_qr: {
      label: "Daily QR",
      cls: "bg-indigo-100 text-indigo-700 border-indigo-200",
    },
    face: {
      label: "Face Recog.",
      cls: "bg-teal-100 text-teal-700 border-teal-200",
    },
    manual_daily: {
      label: "Manual Daily",
      cls: "bg-lime-100 text-lime-700 border-lime-200",
    },
  };
  const { label, cls } = map[type] || {
    label: type || "—",
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

// ── Pagination ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 15;

const Pagination = ({ current, total, onChange }) => {
  if (total <= 1) return null;

  const pages = [];
  const delta = 1;
  const left = current - delta;
  const right = current + delta + 1;
  let last = 0;

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= left && i < right)) {
      if (last && i - last > 1) pages.push("...");
      pages.push(i);
      last = i;
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 py-3 px-4 border-t border-gray-100 bg-gray-50">
      <button
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <FaChevronLeft className="h-3 w-3" />
      </button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 text-xs text-gray-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-semibold transition-colors ${
              p === current
                ? "bg-blue-500 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            {p}
          </button>
        ),
      )}

      <button
        onClick={() => onChange(current + 1)}
        disabled={current === total}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <FaChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
};

// ── Attendance Table ──────────────────────────────────────────────────────────
const AttendanceTable = ({
  filtered,
  selectedDate,
  isMeeting,
  expandedInterns,
  toggleInternMeetings,
}) => {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [filtered.length, isMeeting]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatDateLabel = (dateStr) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-50 px-4">
        <FaCalendarCheck className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-base font-medium text-gray-600 mb-1">
          No attendance records
        </h3>
        <p className="text-sm text-gray-400">
          No interns were marked present on {formatDateLabel(selectedDate)}.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile cards ── */}
      <div className="block lg:hidden divide-y divide-gray-100">
        {paginated.map((intern) => (
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
                  <p className="text-xs text-gray-500">{intern.id}</p>
                </div>
              </div>
              <TypeBadge type={intern.type} />
            </div>
            <div className="ml-12 space-y-0.5">
              <p className="text-xs text-gray-500">
                🎓 {intern.fieldOfSpecialization}
              </p>
              <p className="text-xs text-gray-500">🏛️ {intern.institute}</p>
              {!isMeeting && intern.timeMarked !== "—" && (
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs text-gray-500">🕐 {intern.timeMarked} (In)</p>
                  {intern.checkOutTime && (
                    <p className="text-xs text-gray-500">🕐 {intern.checkOutTime} (Out)</p>
                  )}
                </div>
              )}
              {isMeeting && intern.meetings?.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleInternMeetings(intern._id)}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                  >
                    <span>
                      {intern.meetingCount || intern.meetings?.length || 0}{" "}
                      meeting
                      {(intern.meetingCount || intern.meetings?.length || 0) !==
                      1
                        ? "s"
                        : ""}
                    </span>
                    <FaChevronDown
                      className={`h-3 w-3 transition-transform ${expandedInterns[intern._id] ? "rotate-180" : ""}`}
                    />
                  </button>
                  {expandedInterns[intern._id] && (
                    <div className="mt-2 space-y-1 rounded-xl border border-blue-100 bg-blue-50/50 p-2">
                      {intern.meetings.map((meeting, index) => (
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
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Desktop table — 7 fixed columns ── */}
      <div className="hidden lg:block w-full">
        <table className="w-full text-left text-sm table-fixed divide-y divide-gray-100">
          <colgroup>
            <col style={{ width: "4%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead className="bg-slate-50/80 border-b border-gray-100">
            <tr>
              <th className="px-3 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">
                #
              </th>
              <th className="px-3 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">
                ID
              </th>
              <th className="px-3 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">
                Name
              </th>
              <th className="px-3 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">
                Field
              </th>
              <th className="px-3 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">
                Institute
              </th>
              <th className="px-3 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">
                {isMeeting ? "Meetings" : "Check-in / Out"}
              </th>
              <th className="px-3 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">
                Type
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paginated.map((intern, idx) => (
              <React.Fragment key={intern._id}>
                <motion.tr
                  className="hover:bg-slate-50/50 transition-colors group"
                >
                  <td className="px-3 py-3 text-xs text-gray-400 font-mono">
                    {(page - 1) * PAGE_SIZE + idx + 1}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs font-mono text-gray-600 truncate block">
                      {intern.id}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-r from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <FaUser className="text-indigo-600 text-[10px]" />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {intern.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-gray-600 truncate block">
                      {intern.fieldOfSpecialization || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className="text-xs text-gray-700 truncate block"
                      title={intern.institute}
                    >
                      {intern.institute || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {isMeeting ? (
                      <button
                        type="button"
                        onClick={() => toggleInternMeetings(intern._id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        <span>
                          {intern.meetingCount || intern.meetings?.length || 0}
                        </span>
                        <FaChevronDown
                          className={`h-2.5 w-2.5 transition-transform ${expandedInterns[intern._id] ? "rotate-180" : ""}`}
                        />
                      </button>
                    ) : (
                      <div className="flex flex-col gap-1 text-xs text-gray-700">
                        <div className="flex items-center gap-1">
                          <FaClock className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                          <span className="truncate">{intern.timeMarked}</span>
                        </div>
                        {intern.checkOutTime && (
                          <div className="flex items-center gap-1">
                            <FaClock className="h-3 w-3 text-amber-500 flex-shrink-0" />
                            <span className="truncate text-gray-500">{intern.checkOutTime}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <TypeBadge type={intern.type} />
                  </td>
                </motion.tr>

                {/* Meeting expansion row */}
                {isMeeting && expandedInterns[intern._id] && (
                  <tr>
                    <td colSpan={7} className="bg-blue-50/40 px-4 py-3">
                      <div className="ml-10 rounded-xl border border-blue-100 bg-white p-3">
                        <div className="grid grid-cols-[1fr_8rem_8rem] px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          <div>Meeting Name</div>
                          <div className="text-center">Time</div>
                          <div className="text-right">Type</div>
                        </div>
                        <div className="space-y-1.5">
                          {(intern.meetings || []).map((meeting, index) => (
                            <div
                              key={`${intern._id}-${meeting.meetingName}-${index}`}
                              className="grid grid-cols-[1fr_8rem_8rem] items-center rounded-lg bg-gray-50 px-2 py-2 text-xs"
                            >
                              <div className="font-medium text-gray-900 truncate">
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
                          ))}
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

      {/* ── Pagination ── */}
      <Pagination current={page} total={totalPages} onChange={setPage} />

      {/* ── Footer count ── */}
      {filtered.length > 0 && (
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            {filtered.length} intern{filtered.length !== 1 ? "s" : ""} • page{" "}
            {page} of {totalPages || 1}
          </p>
        </div>
      )}
    </>
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



// ── Main Component ─────────────────────────────────────────────────────────────
const AdminInternAttendance = () => {
  const navigate = useNavigate();
  const today = getLocalToday();

  const [activeTab, setActiveTab] = useState("meeting");
  const [selectedDate, setSelectedDate] = useState(today);
  const [meetingData, setMeetingData] = useState(null);
  const [dailyData, setDailyData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [exportingMeetingPdf, setExportingMeetingPdf] = useState(false);
  const [exportingDailyPdf, setExportingDailyPdf] = useState(false);
  const [exportingNonAttendance, setExportingNonAttendance] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [sltLocationRequired, setSltLocationRequired] = useState(true);
  const [expandedInterns, setExpandedInterns] = useState({});

  // ── Manual Attendance State ──
  const searchDebounce = useRef(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualInputMode, setManualInputMode] = useState("single");
  const [manualMode, setManualMode] = useState("daily");
  const [manualSelectedDate, setManualSelectedDate] = useState(today);
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [manualSearchResults, setManualSearchResults] = useState([]);
  const [manualSearchLoading, setManualSearchLoading] = useState(false);
  const [manualSelectedIntern, setManualSelectedIntern] = useState(null);
  const [manualStatus, setManualStatus] = useState("Present");
  const [manualMeetingName, setManualMeetingName] = useState("");
  const [manualMarking, setManualMarking] = useState(false);
  const [manualRecentMarks, setManualRecentMarks] = useState([]);
  const [manualBulkInternIds, setManualBulkInternIds] = useState("");
  const [manualBulkResults, setManualBulkResults] = useState(null);

  const handleManualSearch = useCallback((query) => {
    setManualSearchQuery(query);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!query.trim()) {
      setManualSearchResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setManualSearchLoading(true);
      try {
        const data = await manualAttendanceApi.searchIntern(query);
        setManualSearchResults(data.interns || []);
      } catch (err) {
        showToast(err.message || "Search failed", "error");
        setManualSearchResults([]);
      } finally {
        setManualSearchLoading(false);
      }
    }, 350);
  }, []);

  const handleSelectIntern = (intern) => {
    setManualSelectedIntern(intern);
    setManualSearchQuery(intern.Trainee_Name);
    setManualSearchResults([]);
  };

  const handleMark = async () => {
    if (!manualSelectedIntern) {
      showToast("Please select an intern first", "error");
      return;
    }
    if (manualMode === "meeting" && !manualMeetingName.trim()) {
      showToast("Please enter a meeting name", "error");
      return;
    }

    setManualMarking(true);
    try {
      const payload = {
        internId: manualSelectedIntern._id,
        date: manualSelectedDate,
        status: manualStatus,
        mode: manualMode,
        ...(manualMode === "meeting" && { meetingName: manualMeetingName.trim() }),
      };

      await manualAttendanceApi.markAttendance(payload);

      showToast(
        `${manualStatus} marked for ${manualSelectedIntern.Trainee_Name} (${manualMode === "daily" ? "daily" : "meeting"})`,
        "success",
      );

      setManualRecentMarks((prev) => [
        {
          id: Date.now(),
          internName: manualSelectedIntern.Trainee_Name,
          internId: manualSelectedIntern.Trainee_ID,
          mode: manualMode,
          status: manualStatus,
          date: manualSelectedDate,
          meetingName: manualMode === "meeting" ? manualMeetingName.trim() : null,
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        ...prev.slice(0, 9),
      ]);

      setManualSelectedIntern(null);
      setManualSearchQuery("");
      setManualMeetingName("");
    } catch (err) {
      showToast(err.message || "Failed to mark attendance", "error");
    } finally {
      setManualMarking(false);
    }
  };

  const handleBulkMark = async () => {
    const ids = manualBulkInternIds
      .split(/[\n,]+/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (ids.length === 0) {
      showToast("Please enter at least one intern ID", "error");
      return;
    }

    if (manualMode === "meeting" && !manualMeetingName.trim()) {
      showToast("Please enter a meeting name", "error");
      return;
    }

    setManualMarking(true);
    try {
      const payload = {
        internIds: ids,
        date: manualSelectedDate,
        status: manualStatus,
        mode: manualMode,
        ...(manualMode === "meeting" && { meetingName: manualMeetingName.trim() }),
      };

      const result = await manualAttendanceApi.bulkMarkAttendance(payload);

      setManualBulkResults(result);

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
          mode: manualMode,
          status: manualStatus,
          date: manualSelectedDate,
          meetingName: manualMode === "meeting" ? manualMeetingName.trim() : null,
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));

      setManualRecentMarks((prev) => [
        ...successfulMarks,
        ...prev.slice(0, 10 - successfulMarks.length),
      ]);

      setManualBulkInternIds("");
    } catch (err) {
      showToast(err.message || "Failed to mark bulk attendance", "error");
      setManualBulkResults(null);
    } finally {
      setManualMarking(false);
    }
  };

  const canSubmitSingle =
    manualSelectedIntern &&
    manualSelectedDate &&
    (manualMode === "daily" || (manualMode === "meeting" && manualMeetingName.trim()));

  const canSubmitBulk =
    manualBulkInternIds.trim().length > 0 &&
    manualSelectedDate &&
    (manualMode === "daily" || (manualMode === "meeting" && manualMeetingName.trim()));

  const canSubmit = manualInputMode === "single" ? canSubmitSingle : canSubmitBulk;

  const submitGradient =
    manualMode === "daily"
      ? "linear-gradient(135deg, #06b6d4, #3b82f6)"
      : "linear-gradient(135deg, #6366f1, #8b5cf6)";

  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [recipientInput, setRecipientInput] = useState("");
  const [recipients, setRecipients] = useState(["mgiri@slt.com.lk"]);

  const showToast = (text, type = "info") => setToast({ text, type });

  const fetchAttendance = async (date) => {
    setLoading(true);
    setMeetingData(null);
    setDailyData(null);
    try {
      const [meeting, daily] = await Promise.all([
        attendanceApi.getMeetingByDate(date),
        attendanceApi.getDailyByDate(date),
      ]);
      setMeetingData(meeting);
      setDailyData(daily);
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
          ? "SLT Location Requirement ON"
          : "SLT Location Requirement OFF",
        nextValue ? "success" : "error"
      );
    } catch (err) {
      setSltLocationRequired(!nextValue);
      showToast(err.message || "Failed to update location setting", "error");
    } finally {
      setSettingsSaving(false);
    }
  };

  const toggleInternMeetings = (internId) =>
    setExpandedInterns((cur) => ({ ...cur, [internId]: !cur[internId] }));

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
            : "Check complete — all interns attended",
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

  const activeData = activeTab === "meeting" ? meetingData : dailyData;
  const filtered = (activeData?.interns || []).filter((intern) => {
    const q = searchTerm.toLowerCase();
    return (
      intern.name.toLowerCase().includes(q) ||
      String(intern.id).toLowerCase().includes(q) ||
      (intern.fieldOfSpecialization || "").toLowerCase().includes(q) ||
      (intern.institute || "").toLowerCase().includes(q)
    );
  });

  const formatDateLabel = (dateStr) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });



  return (
    <AdminNavigation>
      <div className="min-h-screen bg-slate-50 font-sans text-gray-800 pb-10 flex flex-col">
        <div className="flex-1 w-full lg:mt-4 lg:px-6 xl:px-10">

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
                report to the recipients below.
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
      <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
        <div className="space-y-4 md:space-y-5">
            {/* ── Header Row ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
                >
                  <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl">
                    <ScanLine className="text-[#0056a2] h-7 w-7" />
                  </div>
                  Attendance
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.2 }}
                  className="mt-2 text-sm text-gray-500 font-medium"
                >
                  Browse intern attendance and absentees
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.2 }}
                className="flex flex-row items-center gap-2 sm:gap-3 w-full md:w-auto"
              >
                {/* SLT Location Toggle */}
                <div className="flex-1 flex items-center justify-between gap-1 sm:gap-3 rounded-xl border border-gray-200 bg-white px-2.5 sm:px-3 py-2 shadow-sm">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <FaMapMarkerAlt
                      className={`h-3.5 w-3.5 sm:h-3.5 sm:w-3.5 ${sltLocationRequired ? "text-blue-600" : "text-gray-400"}`}
                    />
                    <span className="text-[11px] sm:text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Location
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleLocationRequirement}
                    disabled={settingsLoading || settingsSaving}
                    className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${sltLocationRequired ? "bg-blue-600" : "bg-gray-300"}`}
                    aria-pressed={sltLocationRequired}
                    aria-label="Toggle SLT location requirement"
                  >
                    <span
                      className={`inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white shadow transition-transform ${sltLocationRequired ? "translate-x-4 sm:translate-x-5" : "translate-x-0.5"}`}
                    />
                  </button>
                </div>


                <button
                  onClick={() => setShowManualModal(true)}
                  className="flex-1 bg-gradient-to-r from-[#0056a2] to-[#00b4eb] text-white px-2.5 sm:px-4 py-2 sm:py-2 rounded-xl font-bold text-[11px] sm:text-sm shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-1.5 sm:gap-2"
                >
                  <FaEdit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="whitespace-nowrap">Mark Attendance</span>
                </button>
              </motion.div>
            </div>

            {/* ── Unified Toolbar ── */}
            <motion.div
              className="bg-white p-2.5 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-2.5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              {/* Top Toolbar Row: Tabs & Reports */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-1">
                {/* Tabs */}
                <div className="flex bg-gray-50 p-1.5 rounded-2xl shadow-inner border border-gray-200/60 w-full sm:w-[320px] relative">
                  <button
                    onClick={() => {
                      setActiveTab("meeting");
                      setSearchTerm("");
                      setExpandedInterns({});
                    }}
                    className={`relative z-10 flex-1 py-2 px-2 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                      activeTab === "meeting"
                        ? "text-white"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <span>Meeting</span>
                    {meetingData?.count != null && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold transition-colors ${activeTab === "meeting" ? "bg-white/20 text-white shadow-sm" : "bg-gray-200 text-gray-500"}`}>
                        {meetingData.count}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("daily");
                      setSearchTerm("");
                      setExpandedInterns({});
                    }}
                    className={`relative z-10 flex-1 py-2 px-2 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                      activeTab === "daily"
                        ? "text-white"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <span>Daily</span>
                    {dailyData?.count != null && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold transition-colors ${activeTab === "daily" ? "bg-white/20 text-white shadow-sm" : "bg-gray-200 text-gray-500"}`}>
                        {dailyData.count}
                      </span>
                    )}
                  </button>

                  <div
                    className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-300 ease-out shadow-sm"
                    style={{
                      background:
                        activeTab === "meeting"
                          ? "linear-gradient(135deg, #00b4eb 0%, #0056a2 100%)"
                          : "linear-gradient(135deg, #50b748 0%, #2e7d32 100%)",
                      left: activeTab === "meeting" ? "6px" : "calc(50%)",
                    }}
                  />
                </div>

                {/* Reports Actions */}
                <div className="flex w-full lg:w-auto mt-2 lg:mt-0">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full sm:w-auto gap-2 sm:gap-4 bg-red-50 p-1.5 rounded-xl border border-red-100">
                    <div className="flex items-center justify-center px-2 py-1 sm:py-0">
                      <span className="text-[10px] sm:text-xs font-bold text-red-600 uppercase tracking-wider whitespace-nowrap">
                        Absentees List
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <motion.button
                        onClick={async () => {
                          setExportingNonAttendance(true);
                          try {
                            await attendanceApi.exportNonAttendanceExcel();
                            showToast("Non-attendance Excel downloaded", "success");
                          } catch (err) {
                            showToast(err.message || "Export failed", "error");
                          } finally {
                            setExportingNonAttendance(false);
                          }
                        }}
                        disabled={exportingNonAttendance}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex flex-1 sm:flex-none justify-center items-center space-x-1.5 px-3 py-2 sm:py-1.5 bg-white text-emerald-600 hover:bg-emerald-50 border border-gray-200 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                        title="Export non-attendance report (last 14 days)"
                      >
                        {exportingNonAttendance ? (
                          <FaSpinner className="h-3 w-3 animate-spin" />
                        ) : (
                          <FaFileExcel className="h-3 w-3" />
                        )}
                        <span>Excel</span>
                      </motion.button>
                      
                      <motion.button
                        onClick={() => setShowTriggerModal(true)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex flex-1 sm:flex-none justify-center items-center space-x-1.5 px-3 py-2 sm:py-1.5 bg-white text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-lg text-xs font-semibold transition-all"
                        title="Email non-attendance report to managers"
                      >
                        <FaEnvelope className="h-3 w-3" />
                        <span>Email</span>
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-gray-100 m-0" />

              {/* Bottom Toolbar Row: Filters */}
              <div className="flex flex-col sm:flex-row items-center gap-3 p-1">
                {/* Date Selector */}
                <div className="flex items-center gap-2 bg-slate-50 border border-gray-100 rounded-xl px-3 py-2 w-full sm:w-auto">
                  <FaCalendarDay className="text-[#00b4eb] h-4 w-4" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-sm font-semibold text-gray-800 w-full focus:outline-none cursor-pointer"
                  />
                </div>
                {selectedDate !== today && (
                  <button
                    onClick={() => setSelectedDate(today)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    Today
                  </button>
                )}

                {/* Search Bar */}
                <div className="relative w-full flex-1">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, ID, field, or institute..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#00b4eb] text-sm transition-all"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full"
                    >
                      <FaTimes className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            {/* ── Attendance Table ── */}
            <motion.div
              className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/80">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight leading-snug">
                    {loading
                      ? "Loading…"
                      : activeData
                        ? (
                          <>
                            {activeTab === "meeting" ? "Meeting" : "Daily"} Attendance — <br />
                            {formatDateLabel(selectedDate)}
                          </>
                        )
                        : "Attendance Records"}
                  </h2>
                  {!loading && activeData && (
                    <p className="text-sm text-gray-500 font-medium mt-0.5">
                      {searchTerm
                        ? `${filtered.length} of ${activeData.count} shown`
                        : `${activeData.count} intern${activeData.count !== 1 ? "s" : ""} marked present`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {loading && (
                    <FaSpinner className="animate-spin text-[#00b4eb] h-5 w-5" />
                  )}
                  <motion.button
                    onClick={async () => {
                      if (activeTab === "meeting") {
                        if (!meetingData || meetingData.count === 0) {
                          showToast("No records to export", "info");
                          return;
                        }
                        setExportingMeetingPdf(true);
                        try {
                          await attendanceApi.exportMeetingPdf(selectedDate);
                          showToast("Meeting PDF downloaded", "success");
                        } catch (err) {
                          showToast(err.message || "PDF export failed", "error");
                        } finally {
                          setExportingMeetingPdf(false);
                        }
                      } else {
                        if (!dailyData || dailyData.count === 0) {
                          showToast("No records to export", "info");
                          return;
                        }
                        setExportingDailyPdf(true);
                        try {
                          await attendanceApi.exportDailyPdf(selectedDate);
                          showToast("Daily PDF downloaded", "success");
                        } catch (err) {
                          showToast(err.message || "PDF export failed", "error");
                        } finally {
                          setExportingDailyPdf(false);
                        }
                      }
                    }}
                    disabled={(activeTab === "meeting" ? exportingMeetingPdf : exportingDailyPdf) || ((activeTab === "meeting" ? meetingData?.count : dailyData?.count) === 0)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-bold shadow-sm border border-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {(activeTab === "meeting" ? exportingMeetingPdf : exportingDailyPdf) ? (
                      <FaSpinner className="h-3.5 w-3.5 animate-spin text-[#00b4eb]" />
                    ) : (
                      <FaFilePdf className="h-3.5 w-3.5 text-red-500" />
                    )}
                    <span className="hidden sm:inline">Export PDF</span>
                  </motion.button>
                </div>
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
              ) : filtered.length === 0 && searchTerm ? (
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
                <AttendanceTable
                  filtered={filtered}
                  selectedDate={selectedDate}
                  isMeeting={activeTab === "meeting"}
                  expandedInterns={expandedInterns}
                  toggleInternMeetings={toggleInternMeetings}
                />
              )}
            </motion.div>
        </div>
      </main>
      </div>

      <AnimatePresence>
        {showManualModal && (
          <motion.div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-950/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(event) => event.target === event.currentTarget && setShowManualModal(false)}
          >
            <motion.section
              className="max-h-[95vh] sm:max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl sm:rounded-3xl border border-gray-100 bg-white shadow-2xl flex flex-col"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
            >
              <div className="flex flex-col gap-4 border-b border-gray-100 p-4 sm:px-6 sm:py-5 sm:flex-row sm:items-center sm:justify-between bg-white z-10 relative shadow-sm shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Manual Attendance</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Mark daily or meeting attendance for individual interns
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-800"
                    aria-label="Close modal"
                    title="Close"
                  >
                    <FaTimes className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto overflow-y-auto flex-1 bg-slate-50 min-h-0 min-w-0 p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-[1fr_1fr_400px] gap-5 sm:gap-6">
                  {/* ── Left: Form ── */}
                  <div className="space-y-5 lg:col-span-2 xl:col-span-2">
                    {/* Configuration Section (Type & Mode & Date) */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-6">
                      
                      {/* Attendance Type Tab Switcher */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                          Attendance Type
                        </label>
                        <div className="relative flex p-1.5 bg-gray-100/80 rounded-2xl border border-gray-200/60 shadow-inner">
                          <button
                            type="button"
                            onClick={() => {
                              setManualMode("meeting");
                              setManualMeetingName("");
                            }}
                            className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-all duration-300 rounded-xl ${
                              manualMode === "meeting"
                                ? "text-white shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                            }`}
                          >
                            <FaVideo className="h-4 w-4" />
                            <span>Meeting</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              setManualMode("daily");
                              setManualMeetingName("");
                            }}
                            className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-all duration-300 rounded-xl ${
                              manualMode === "daily"
                                ? "text-white shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                            }`}
                          >
                            <FaClipboardList className="h-4 w-4" />
                            <span>Daily</span>
                          </button>

                          <div
                            className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-300 ease-out shadow-sm pointer-events-none"
                            style={{
                              background:
                                manualMode === "meeting"
                                  ? "linear-gradient(135deg, #00b4eb 0%, #0056a2 100%)"
                                  : "linear-gradient(135deg, #50b748 0%, #2e7d32 100%)",
                              left: manualMode === "meeting" ? "6px" : "calc(50%)",
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Input Mode (Single/Bulk) Tab Switcher */}
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                            Input Mode
                          </label>
                          <div className="relative flex p-1 bg-gray-100/50 rounded-2xl border border-gray-200 h-[68px] items-center">
                            <button
                              onClick={() => setManualInputMode("single")}
                              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all h-full flex items-center justify-center ${
                                manualInputMode === "single"
                                  ? "bg-white text-blue-600 shadow-sm border border-gray-200/50"
                                  : "text-gray-500 hover:text-gray-700"
                              }`}
                            >
                              <FaUser className="mr-2" /> Single
                            </button>
                            <button
                              onClick={() => setManualInputMode("bulk")}
                              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all h-full flex items-center justify-center ${
                                manualInputMode === "bulk"
                                  ? "bg-white text-blue-600 shadow-sm border border-gray-200/50"
                                  : "text-gray-500 hover:text-gray-700"
                              }`}
                            >
                              <FaLayerGroup className="mr-2" /> Bulk
                            </button>
                          </div>
                        </div>

                        {/* Date Selector */}
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                            Date
                          </label>
                          <div className="flex-1 bg-slate-50 rounded-2xl p-2.5 flex items-center gap-3 border border-slate-200 transition-all hover:border-blue-200 h-[68px]">
                            <div className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-100 shrink-0">
                              <FaCalendarAlt className="text-[#00b4eb] h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                                Select Date
                              </label>
                              <input
                                type="date"
                                value={manualSelectedDate}
                                max={today}
                                onChange={(e) => setManualSelectedDate(e.target.value)}
                                className="bg-transparent text-sm font-bold text-gray-800 w-full focus:outline-none cursor-pointer p-0 border-none"
                              />
                            </div>
                            {manualSelectedDate !== today && (
                              <motion.button
                                onClick={() => setManualSelectedDate(today)}
                                className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold transition-colors hover:bg-blue-100 uppercase tracking-wider shrink-0"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                Today
                              </motion.button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Intern Search (SINGLE mode) */}
                    {manualInputMode === "single" && (
                      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6">
                        <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                          Search Intern
                        </label>
                        <div className="relative">
                          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            value={manualSearchQuery}
                            onChange={(e) => {
                              handleManualSearch(e.target.value);
                              if (manualSelectedIntern) setManualSelectedIntern(null);
                            }}
                            placeholder="Type ID, name or email…"
                            className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent focus:bg-white transition-all"
                          />
                          {manualSearchLoading && (
                            <FaSpinner className="absolute right-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-400 animate-spin" />
                          )}
                          {manualSearchQuery && !manualSearchLoading && (
                            <button
                              onClick={() => {
                                setManualSearchQuery("");
                                setManualSearchResults([]);
                                setManualSelectedIntern(null);
                              }}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              <FaTimes className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Search Results */}
                        <AnimatePresence>
                          {manualSearchResults.length > 0 && (
                            <motion.div
                              className="mt-2 space-y-1.5 max-h-56 overflow-y-auto pr-1"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                            >
                              {manualSearchResults.map((intern) => (
                                <InternCard
                                  key={intern._id}
                                  intern={intern}
                                  onSelect={handleSelectIntern}
                                  selected={manualSelectedIntern?._id === intern._id}
                                />
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Selected intern display */}
                        <AnimatePresence>
                          {manualSelectedIntern && (
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
                                  {manualSelectedIntern.Trainee_Name}
                                </p>
                                <p className="text-xs text-blue-600 truncate">
                                  {manualSelectedIntern.Trainee_ID} ·{" "}
                                  {manualSelectedIntern.team || "No team"}
                                </p>
                              </div>
                              <FaCheckCircle className="text-blue-500 h-4 w-4 flex-shrink-0" />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {manualSearchQuery &&
                          !manualSearchLoading &&
                          manualSearchResults.length === 0 &&
                          !manualSelectedIntern && (
                            <p className="text-xs text-gray-400 mt-2 text-center py-2">
                              No interns found matching "{manualSearchQuery}"
                            </p>
                          )}
                      </div>
                    )}

                    {/* Bulk Input (BULK mode) */}
                    {manualInputMode === "bulk" && (
                      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6">
                        <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                          Intern IDs <span className="text-red-400">*</span>
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                          Enter IDs separated by comma or newline
                        </p>
                        <textarea
                          value={manualBulkInternIds}
                          onChange={(e) => setManualBulkInternIds(e.target.value)}
                          placeholder={`ID001, ID002, ID003\nor\nID001\nID002\nID003`}
                          className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent focus:bg-white transition-all resize-none font-mono"
                        />
                        {manualBulkInternIds.trim().length > 0 && (
                          <p className="text-xs text-blue-600 mt-2">
                            {
                              manualBulkInternIds
                                .split(/[\n,]+/)
                                .filter((id) => id.trim().length > 0).length
                            }{" "}
                            IDs detected
                          </p>
                        )}
                      </div>
                    )}

                    {/* Meeting Name (only for meeting mode) */}
                    <AnimatePresence>
                      {manualMode === "meeting" && (
                        <motion.div
                          className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6"
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
                            value={manualMeetingName}
                            onChange={(e) => setManualMeetingName(e.target.value)}
                            placeholder="e.g. Weekly Standup, Project Review…"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent focus:bg-white transition-all"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Status */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6">
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
                            onClick={() => setManualStatus(val)}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            className={`flex items-center justify-center gap-2.5 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${manualStatus === val ? activeClass : inactiveClass}`}
                          >
                            <Icon className="h-4 w-4" />
                            {val}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Submit */}
                    <motion.button
                      onClick={manualInputMode === "single" ? handleMark : handleBulkMark}
                      disabled={!canSubmit || manualMarking}
                      whileHover={{ scale: canSubmit && !manualMarking ? 1.02 : 1 }}
                      whileTap={{ scale: canSubmit && !manualMarking ? 0.98 : 1 }}
                      className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl text-white text-sm font-bold transition-all shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        background: canSubmit && !manualMarking ? submitGradient : "#d1d5db",
                      }}
                    >
                      {manualMarking ? (
                        <>
                          <FaSpinner className="h-4 w-4 animate-spin" />
                          Marking…
                        </>
                      ) : (
                        <>
                          {manualMode === "daily" ? (
                            <FaClipboardList className="h-4 w-4" />
                          ) : (
                            <FaVideo className="h-4 w-4" />
                          )}
                          {manualInputMode === "single" ? "Mark" : "Bulk Mark"} {manualStatus} ·{" "}
                          {manualMode === "daily" ? "Daily" : "Meeting"}
                        </>
                      )}
                    </motion.button>

                    {/* Bulk Results */}
                    <AnimatePresence>
                      {manualBulkResults && (
                        <motion.div
                          className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                        >
                          <h3 className="text-sm font-semibold text-gray-800 mb-3">
                            Bulk Mark Results
                          </h3>
                          <div className="space-y-2">
                            {manualBulkResults.results.map((result, idx) => (
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
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-fit">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-slate-50">
                      <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <FaCalendarCheck className="h-3.5 w-3.5 text-blue-500" />
                        Recent Marks
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">This session only</p>
                    </div>

                    {manualRecentMarks.length === 0 ? (
                      <div className="px-5 py-12 text-center text-gray-400">
                        <FaClipboardList className="h-8 w-8 mx-auto mb-3 opacity-30" />
                        <p className="text-xs">No marks yet in this session</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
                        <AnimatePresence initial={false}>
                          {manualRecentMarks.map((mark) => (
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
                  </div>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
    </AdminNavigation>
  );
};

export default AdminInternAttendance;
