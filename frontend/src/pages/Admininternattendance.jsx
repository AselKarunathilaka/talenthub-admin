import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
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
  FaChartBar,
  FaMapMarkerAlt,
  FaChevronDown,
  FaEdit,
  FaFilePdf,
  FaCalendarDay,
  FaUsers,
  FaChevronLeft,
  FaChevronRight,
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
        <table className="w-full table-fixed divide-y divide-gray-100">
          <colgroup>
            <col style={{ width: "4%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                #
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Field
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Institute
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {isMeeting ? "Meetings" : "Check-in / Out"}
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Type
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.map((intern, idx) => (
              <React.Fragment key={intern._id}>
                <motion.tr
                  className="hover:bg-gray-50 transition-colors"
                  whileHover={{ y: -1 }}
                  transition={{ duration: 0.1 }}
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
          ? "SLT location requirement enabled"
          : "SLT location requirement disabled",
        "success",
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

  const blobs = [
    {
      cls: "w-80 h-80 bg-blue-100/40 -top-20 -left-20",
      dur: 15,
      dx: 20,
      dy: -30,
    },
    {
      cls: "w-96 h-96 bg-cyan-100/40 top-1/4 right-0",
      dur: 18,
      dx: -20,
      dy: 20,
      delay: 2,
    },
    {
      cls: "w-64 h-64 bg-green-100/40 bottom-20 left-1/4",
      dur: 20,
      dx: 15,
      dy: -20,
      delay: 1,
    },
  ];

  return (
    <AdminNavigation>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-gray-800 overflow-hidden relative">
        {/* Background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {blobs.map((b, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full ${b.cls}`}
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
      <div className="pt-2 sm:pt-4">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-[92rem] mx-auto space-y-4 md:space-y-5">
            {/* ── Header ── */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                
                <motion.button
                  onClick={() => navigate("/admin/manual-attendance")}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-sm text-sm font-semibold transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FaEdit className="h-3.5 w-3.5" />
                  Manual Attendance
                </motion.button>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">
                  Intern Attendance
                </span>
              </h2>
              <p className="text-gray-600 text-sm md:text-base">
                View attendance records and exports
              </p>
            </motion.div>

            {/* SLT Location Toggle */}
            <motion.div
              className="flex justify-end"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03, duration: 0.25 }}
            >
              <div className="inline-flex items-center gap-3 rounded-lg border border-gray-200 bg-white/90 px-3 py-2 shadow-sm">
                <div className="inline-flex items-center gap-2">
                  <FaMapMarkerAlt
                    className={`h-3.5 w-3.5 ${sltLocationRequired ? "text-blue-600" : "text-gray-400"}`}
                  />
                  <span className="text-xs font-semibold text-gray-700">
                    SLT location
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sltLocationRequired ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}
                  >
                    {sltLocationRequired ? "Required" : "Off"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLocationRequirement}
                  disabled={settingsLoading || settingsSaving}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${sltLocationRequired ? "bg-blue-600" : "bg-gray-300"}`}
                  aria-pressed={sltLocationRequired}
                  aria-label="Toggle SLT location requirement"
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${sltLocationRequired ? "translate-x-5" : "translate-x-0.5"}`}
                  />
                </button>
              </div>
            </motion.div>

            {/* Non-Attendance Report card */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              <div className="px-4 md:px-6 py-3.5 border-b border-gray-100 bg-gradient-to-r from-indigo-50/70 to-purple-50/40 flex items-center space-x-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <FaChartBar className="h-3 w-3 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Non-Attendance Report
                  </h3>
                  <p className="text-xs text-gray-500">
                    Interns who missed meetings in the past 14 days
                  </p>
                </div>
              </div>
              <div className="px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-gray-500 max-w-sm">
                  Download or email the non-attendance report for all active
                  interns over the{" "}
                  <span className="font-medium text-gray-700">
                    past 14 days
                  </span>
                  .
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
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
                    whileHover={{ scale: exportingNonAttendance ? 1 : 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:cursor-not-allowed"
                  >
                    {exportingNonAttendance ? (
                      <FaSpinner className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FaFileExcel className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {exportingNonAttendance ? "Exporting…" : "Export Report"}
                    </span>
                  </motion.button>
                  <motion.button
                    onClick={() => setShowTriggerModal(true)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm"
                  >
                    <FaRegPaperPlane className="h-3.5 w-3.5" />
                    <span>Share Report</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Section divider */}
            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">
                Daily Attendance Records
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </motion.div>

            {/* Toolbar */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              {/* Tabs */}
              <div className="flex border-b border-gray-100">
                {[
                  {
                    key: "meeting",
                    label: "Meeting Attendance",
                    icon: FaUsers,
                    count: meetingData?.count,
                  },
                  {
                    key: "daily",
                    label: "Daily Attendance",
                    icon: FaCalendarDay,
                    count: dailyData?.count,
                  },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setSearchTerm("");
                      setExpandedInterns({});
                    }}
                    className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-all border-b-2 ${
                      activeTab === tab.key
                        ? "border-blue-500 text-blue-600 bg-blue-50/40"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {tab.count != null && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.key ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Controls row */}
              <div className="p-4 md:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                    {/* Date picker */}
                    <div className="flex-1">
                      <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                        Filter by Date
                      </label>
                      <div className="flex items-center space-x-2">
                        <div className="relative">
                          <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 pointer-events-none" />
                          <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-gray-900 text-sm shadow-sm"
                          />
                        </div>
                        {selectedDate !== today && (
                          <motion.button
                            onClick={() => setSelectedDate(today)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-medium transition-colors"
                          >
                            Today
                          </motion.button>
                        )}
                      </div>
                    </div>
                    {/* Search */}
                    <div className="flex-1 sm:max-w-xs">
                      <label className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                        Search Interns
                      </label>
                      <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Name, ID, field or institute…"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm shadow-sm"
                        />
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <FaTimes className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Export buttons */}
                  <div className="flex flex-wrap gap-2">
                    {activeTab === "meeting" && (
                      <>
                        <motion.button
                          onClick={async () => {
                            if (!meetingData || meetingData.count === 0) {
                              showToast("No records to export", "info");
                              return;
                            }
                            setExportingMeetingPdf(true);
                            try {
                              await attendanceApi.exportMeetingPdf(
                                selectedDate,
                              );
                              showToast("Meeting PDF downloaded", "success");
                            } catch (err) {
                              showToast(
                                err.message || "PDF export failed",
                                "error",
                              );
                            } finally {
                              setExportingMeetingPdf(false);
                            }
                          }}
                          disabled={
                            exportingMeetingPdf ||
                            !meetingData ||
                            meetingData.count === 0
                          }
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:cursor-not-allowed"
                        >
                          {exportingMeetingPdf ? (
                            <FaSpinner className="h-4 w-4 animate-spin" />
                          ) : (
                            <FaFilePdf className="h-4 w-4" />
                          )}
                          <span>Export PDF</span>
                        </motion.button>
                      </>
                    )}

                    {activeTab === "daily" && (
                      <motion.button
                        onClick={async () => {
                          if (!dailyData || dailyData.count === 0) {
                            showToast("No records to export", "info");
                            return;
                          }
                          setExportingDailyPdf(true);
                          try {
                            await attendanceApi.exportDailyPdf(selectedDate);
                            showToast(
                              "Daily attendance PDF downloaded",
                              "success",
                            );
                          } catch (err) {
                            showToast(
                              err.message || "PDF export failed",
                              "error",
                            );
                          } finally {
                            setExportingDailyPdf(false);
                          }
                        }}
                        disabled={
                          exportingDailyPdf ||
                          !dailyData ||
                          dailyData.count === 0
                        }
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:cursor-not-allowed"
                      >
                        {exportingDailyPdf ? (
                          <FaSpinner className="h-4 w-4 animate-spin" />
                        ) : (
                          <FaFilePdf className="h-4 w-4" />
                        )}
                        <span>Export PDF</span>
                        {dailyData && dailyData.count > 0 && (
                          <span className="bg-white/25 px-1.5 py-0.5 rounded-full text-xs">
                            {dailyData.count}
                          </span>
                        )}
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Attendance Table ── */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-base md:text-lg font-semibold text-gray-900">
                    {loading
                      ? "Loading…"
                      : activeData
                        ? `${activeTab === "meeting" ? "Meeting" : "Daily"} Attendance — ${formatDateLabel(selectedDate)}`
                        : "Attendance Records"}
                  </h2>
                  {!loading && activeData && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {searchTerm
                        ? `${filtered.length} of ${activeData.count} shown`
                        : `${activeData.count} intern${activeData.count !== 1 ? "s" : ""} marked present`}
                    </p>
                  )}
                </div>
                {loading && (
                  <FaSpinner className="animate-spin text-blue-500 h-5 w-5" />
                )}
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
      </div>
    </AdminNavigation>
  );
};

export default AdminInternAttendance;
