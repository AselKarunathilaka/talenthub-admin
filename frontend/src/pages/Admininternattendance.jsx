import React, { useState, useEffect, useMemo } from "react";
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
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
  FaEnvelope,
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaEyeSlash,
  FaGraduationCap,
  FaUniversity,
  FaCheck,
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

  exportMeetingWithoutDailyExcel: (date) =>
    fetch(
      `${API_BASE_URL}/admin/attendance/export-meeting-without-daily?date=${date}`,
      { headers: getAuthHeaders() },
    ).then((res) =>
      downloadBlob(res, `Meeting_Without_Daily_Report_${date}.xlsx`),
    ),

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
      className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-lg sm:rounded-full text-[10px] sm:text-xs font-medium border ${cls}`}
    >
      {label}
    </span>
  );
};

// ── Pagination ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 15;

const Pagination = ({ current, totalPages, totalItems, onChange }) => {
  if (totalItems === 0) return null;

  const limit = PAGE_SIZE;
  const from = (current - 1) * limit + 1;
  const to = Math.min(current * limit, totalItems);

  const hasPrevPage = current > 1;
  const hasNextPage = current < totalPages;

  const pageNums = (() => {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const s = new Set([1, totalPages]);
    for (
      let i = Math.max(2, current - 2);
      i <= Math.min(totalPages - 1, current + 2);
      i++
    )
      s.add(i);
    return [...s].sort((a, b) => a - b);
  })();

  const btn = (onClick, disabled, icon, title) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none"
    >
      {icon}
    </button>
  );

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200/80 bg-slate-50/80 rounded-b-xl sm:rounded-b-[14px] md:rounded-b-2xl">
      <p className="text-xs sm:text-sm text-slate-500 font-medium">
        Showing{" "}
        <span className="font-bold text-slate-700">
          {from} - {to}
        </span>{" "}
        of <span className="font-bold text-slate-700">{totalItems}</span>{" "}
        records
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {btn(() => onChange(1), !hasPrevPage, <FaAngleDoubleLeft className="h-3 w-3" />, "First")}
          {btn(() => onChange(current - 1), !hasPrevPage, <FaChevronLeft className="h-3 w-3" />, "Previous")}
          {pageNums.map((p, idx, arr) => (
            <React.Fragment key={p}>
              {arr[idx - 1] && p - arr[idx - 1] > 1 && (
                <span className="px-1 text-slate-400 text-xs font-bold">…</span>
              )}
              <button
                onClick={() => onChange(p)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all focus:outline-none ${p === current ? "bg-gradient-to-r from-[#000066] to-[#006600] text-white shadow-md shadow-[#006600]/20" : "text-slate-600 hover:bg-slate-200"}`}
              >
                {p}
              </button>
            </React.Fragment>
          ))}
          {btn(() => onChange(current + 1), !hasNextPage, <FaChevronRight className="h-3 w-3" />, "Next")}
          {btn(() => onChange(totalPages), !hasNextPage, <FaAngleDoubleRight className="h-3 w-3" />, "Last")}
        </div>
      )}
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
        <FaCalendarCheck className="mx-auto h-12 w-12 text-gray-300 mb-3 sm:mb-4" />
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
      <div className="block xl:hidden divide-y divide-gray-100">
        {paginated.map((intern) => (
          <motion.div
            key={intern._id}
            className="p-4 hover:bg-gray-50 transition-colors"
            whileHover={{ y: -1 }}
            transition={{ duration: 0.1 }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-start space-x-3">
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-r from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                  <FaUser className="text-indigo-600 text-xs" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-tight">
                    {intern.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex text-[10px] sm:text-xs text-slate-600 sm:text-slate-500 bg-slate-100 sm:bg-transparent px-2 sm:px-0 py-0.5 sm:py-0 rounded-lg sm:rounded-none border border-slate-200/60 sm:border-transparent font-medium">
                      {intern.id}
                    </span>
                    <div className="sm:hidden">
                      <TypeBadge type={intern.type} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="hidden sm:block">
                <TypeBadge type={intern.type} />
              </div>
            </div>
            <div className="ml-12 space-y-0.5">
              <p className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1.5">
                <FaGraduationCap className="text-gray-400" /> {intern.fieldOfSpecialization}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1.5">
                <FaUniversity className="text-gray-400" /> {intern.institute}
              </p>
              {!isMeeting && intern.timeMarked !== "—" && (
                <div className="flex flex-col gap-0.5">
                  <p className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1.5">
                    <FaClock className="text-gray-400" /> {intern.timeMarked} (In)
                  </p>
                  {intern.checkOutTime && (
                    <p className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1.5">
                      <FaClock className="text-gray-400" /> {intern.checkOutTime} (Out)
                    </p>
                  )}
                </div>
              )}
              {isMeeting && intern.meetings?.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleInternMeetings(intern._id)}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-semibold text-blue-700"
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

      {/* ── Desktop table ── */}
      <div className="hidden xl:block overflow-x-auto w-full">
        <table className="w-full text-left text-sm divide-y divide-gray-100">
          <thead className="bg-slate-50/80 border-b border-gray-100">
            <tr>
              <th className="px-3 py-3 font-bold text-slate-500 uppercase tracking-wider text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px]">
                #
              </th>
              <th className="px-3 py-3 font-bold text-slate-500 uppercase tracking-wider text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] text-center">
                ID
              </th>
              <th className="px-3 py-3 font-bold text-slate-500 uppercase tracking-wider text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px]">
                Name
              </th>
              <th className="px-3 py-3 font-bold text-slate-500 uppercase tracking-wider text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] text-center">
                Specialization
              </th>
              <th className="px-3 py-3 font-bold text-slate-500 uppercase tracking-wider text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] text-center">
                University
              </th>
              <th className="px-3 py-3 font-bold text-slate-500 uppercase tracking-wider text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] text-center">
                {isMeeting ? "Meetings" : "Check-in / Out"}
              </th>
              <th className="px-3 py-3 font-bold text-slate-500 uppercase tracking-wider text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] text-center">
                Type
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paginated.map((intern, idx) => (
              <React.Fragment key={intern._id}>
                <tr className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-3 py-3.5 text-[10px] sm:text-xs lg:text-sm font-medium text-slate-400 font-mono w-12 text-left">
                    {(page - 1) * PAGE_SIZE + idx + 1}
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <span className="text-[8px] sm:text-[9px] lg:text-[11px] font-semibold text-slate-500 font-mono block">
                      {intern.id}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-[#000066]/10 text-[#000066] flex items-center justify-center font-bold text-sm sm:text-base flex-shrink-0 overflow-hidden shadow-inner relative border border-slate-200">
                        <img
                          src={`${API_BASE_URL}/interns/${intern._id}/profile-picture`}
                          alt={intern.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className="w-full h-full flex items-center justify-center hidden bg-gradient-to-br from-[#000066]/20 to-[#006600]/20">
                          {(intern.name || "?")[0].toUpperCase()}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] sm:text-xs lg:text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#000066] transition-colors break-words">
                          {intern.name}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <span className="text-[10px] sm:text-xs lg:text-sm text-slate-600 block truncate">
                      {intern.fieldOfSpecialization || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-left">
                    <span
                      className="text-[10px] sm:text-xs lg:text-sm text-slate-700 block truncate"
                      title={intern.institute}
                    >
                      {intern.institute || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    {isMeeting ? (
                      <button
                        type="button"
                        onClick={() => toggleInternMeetings(intern._id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#000066]/5 px-2 py-1 text-[10px] sm:text-xs lg:text-xs sm:text-sm font-semibold text-[#000066] hover:bg-[#000066]/10 transition-colors focus:outline-none"
                      >
                        <span>
                          {intern.meetingCount || intern.meetings?.length || 0}
                        </span>
                        <FaChevronDown
                          className={`h-2.5 w-2.5 transition-transform ${expandedInterns[intern._id] ? "rotate-180" : ""}`}
                        />
                      </button>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 text-[10px] sm:text-xs lg:text-sm font-medium text-slate-500">
                        <div className="flex items-center gap-1">
                          <FaClock className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                          <span className="truncate">{intern.timeMarked}</span>
                        </div>
                        {intern.checkOutTime && (
                          <div className="flex items-center gap-1">
                            <FaClock className="h-3 w-3 text-amber-500 flex-shrink-0" />
                            <span className="truncate text-slate-400">
                              {intern.checkOutTime}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <TypeBadge type={intern.type} />
                  </td>
                </tr>

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
      <Pagination current={page} totalPages={totalPages} totalItems={filtered.length} onChange={setPage} />
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
  const [exportingMissingDaily, setExportingMissingDaily] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);
  const [toast, setToast] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [sltLocationRequired, setSltLocationRequired] = useState(true);
  const [showPasswordPopup, setShowPasswordPopup] = useState(false);
  const [passwordPopupAction, setPasswordPopupAction] = useState("");
  const [securityPassword, setSecurityPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
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
    if (sltLocationRequired) {
      setPasswordPopupAction("location");
      setShowPasswordPopup(true);
      setSecurityPassword("");
      setPasswordError("");
      return;
    }
    await submitLocationToggle(true, null);
  };
  
  const handleMarkAttendanceClick = () => {
    setPasswordPopupAction("attendance");
    setShowPasswordPopup(true);
    setSecurityPassword("");
    setPasswordError("");
  };

  const handlePasswordVerify = async () => {
    if (passwordPopupAction === "location") {
      await submitLocationToggle(false, securityPassword);
    } else if (passwordPopupAction === "attendance") {
      setSettingsSaving(true);
      setPasswordError("");
      try {
        const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
        const res = await fetch(`${API_BASE_URL}/admin/attendance/verify-security`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(adminInfo.token && { Authorization: `Bearer ${adminInfo.token}` }),
          },
          body: JSON.stringify({ securityPin: securityPassword, action: "manual attendance" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Invalid password");
        
        setShowPasswordPopup(false);
        showToast("Security verification successful", "success");
        navigate("/admin/manual-attendance");
      } catch (err) {
        setPasswordError(err.message || "Invalid password");
      } finally {
        setSettingsSaving(false);
      }
    }
  };

  const submitLocationToggle = async (required, password) => {
    setSettingsSaving(true);
    setPasswordError("");
    try {
      const payload = { sltLocationRequired: required };
      if (!required) {
        if (!password) {
          setPasswordError("Password is required");
          setSettingsSaving(false);
          return;
        }
        payload.securityPin = password;
      }
      const result = await attendanceApi.updateSettings(payload);
      setSltLocationRequired(result.settings?.sltLocationRequired !== false);
      if (!required) setShowPasswordPopup(false);
      showToast(`Location checking ${required ? "enabled" : "disabled"}`, "success");
    } catch (err) {
      if (!required) {
        setPasswordError(err.message || "Invalid password");
      } else {
        showToast(err.message || "Failed to update settings", "error");
      }
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
            ? `Report sent to ${recipients.length} recipient(s)`
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
  const filtered = useMemo(() => {
    if (!activeData?.interns) return [];
    if (!searchTerm) return activeData.interns;
    const q = searchTerm.toLowerCase();
    return activeData.interns.filter((intern) => {
      return (
        intern.name.toLowerCase().includes(q) ||
        String(intern.id).toLowerCase().includes(q) ||
        (intern.fieldOfSpecialization || "").toLowerCase().includes(q) ||
        (intern.institute || "").toLowerCase().includes(q)
      );
    });
  }, [activeData, searchTerm]);

  const formatDateLabel = (dateStr) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <AdminNavigation>
      <div className="min-h-full relative font-sans text-slate-800 flex flex-col select-none">
        <main className="relative flex-1 p-3 sm:p-6 sm:px-8 mx-auto max-w-[1400px] w-full flex flex-col gap-4 sm:gap-6 min-w-0">
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
                  <div className="flex items-center justify-between mb-3 sm:mb-5">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <FaBell className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">
                          Send Non-Attendance Report
                        </h3>
                        <p className="text-[10px] sm:text-xs text-gray-500">
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

                  <div className="mb-3 sm:mb-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-800">
                    This will check all active interns for meeting attendance
                    over the <strong>past 14 days</strong> and email a
                    non-attendance report to the recipients below.
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

                  <div className="flex space-x-2 mb-3 sm:mb-5">
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
                      className="flex-1 flex items-center justify-center space-x-2 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm disabled:cursor-not-allowed"
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

          {/* Header Section */}
          <div className="flex flex-col gap-4 sm:gap-6 transition-all duration-300">
            <div className="relative flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6 pt-2">
            {/* Left: Title */}
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="p-2.5 sm:p-3 md:p-3.5 bg-gradient-to-br from-[#000066] to-[#006600] shadow-md rounded-lg sm:rounded-xl md:rounded-2xl border border-[#006600]/20 flex-shrink-0"
              >
                <ScanLine className="text-white h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
              </motion.div>
              <div className="flex flex-col justify-center">
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-xl sm:text-3xl md:text-4xl leading-tight font-extrabold text-slate-900 tracking-tight"
                >
                  Attendance
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="text-slate-500 mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base font-medium max-w-xl"
                >
                  Browse intern attendance and absentees
                </motion.p>
              </div>
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
                    onClick={handleMarkAttendanceClick}
                    className="flex-1 bg-gradient-to-r from-[#000066] to-[#006600] text-white px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-sm shadow-md shadow-[#006600]/20 hover:opacity-90 transition-all flex items-center justify-center gap-1.5 sm:gap-2 focus:outline-none"
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-1">
              {/* Tabs */}
                  <div className="flex bg-gray-50 p-1.5 rounded-2xl shadow-inner border border-gray-200/60 w-full sm:w-[320px] relative">
                    <button
                      onClick={() => {
                        setActiveTab("meeting");
                        setSearchTerm("");
                        setExpandedInterns({});
                      }}
                      className={`relative flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-xs sm:text-sm font-bold rounded-xl transition-all w-1/2 z-10 ${
                        activeTab === "meeting"
                          ? "text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <FaUsers className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="whitespace-nowrap">
                        Meeting {meetingData ? `(${meetingData.count})` : ""}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("daily");
                        setSearchTerm("");
                        setExpandedInterns({});
                      }}
                      className={`relative flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-xs sm:text-sm font-bold rounded-xl transition-all w-1/2 z-10 ${
                        activeTab === "daily"
                          ? "text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <FaCalendarCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="whitespace-nowrap">
                        Daily {dailyData ? `(${dailyData.count})` : ""}
                      </span>
                    </button>

                    <div
                      className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-300 ease-out shadow-sm"
                      style={{
                        background:
                          activeTab === "meeting"
                            ? "linear-gradient(135deg, #003399 0%, #000066 100%)"
                            : "linear-gradient(135deg, #009900 0%, #006600 100%)",
                        left: activeTab === "meeting" ? "6px" : "calc(50%)",
                      }}
                    />
                  </div>

                  {/* Reports Actions */}
                <div className="flex w-full md:w-auto mt-2 md:mt-0">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full sm:w-[320px] gap-2 sm:gap-4 bg-red-50 p-1.5 rounded-xl border border-red-100">
                      <div className="flex items-center justify-center px-2 py-1 sm:py-0">
                        <span className="text-[10px] sm:text-xs font-bold text-red-600 uppercase tracking-wider whitespace-nowrap">
                          Absentees List
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <button
                          onClick={async () => {
                            setExportingNonAttendance(true);
                            try {
                              await attendanceApi.exportNonAttendanceExcel();
                              showToast(
                                "Non-attendance Excel downloaded",
                                "success",
                              );
                            } catch (err) {
                              showToast(
                                err.message || "Export failed",
                                "error",
                              );
                            } finally {
                              setExportingNonAttendance(false);
                            }
                          }}
                          disabled={exportingNonAttendance}
                          className="flex flex-1 sm:flex-none justify-center items-center space-x-1.5 px-3 py-2 sm:py-1.5 bg-white text-emerald-600 hover:bg-emerald-50 border border-gray-200 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                          title="Export non-attendance report (last 14 days)"
                        >
                          {exportingNonAttendance ? (
                            <FaSpinner className="h-3 w-3 animate-spin" />
                          ) : (
                            <FaFileExcel className="h-3 w-3" />
                          )}
                          <span>Excel</span>
                        </button>

                        <button
                          onClick={() => setShowTriggerModal(true)}
                          className="flex flex-1 sm:flex-none justify-center items-center space-x-1.5 px-3 py-2 sm:py-1.5 bg-white text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-lg text-xs font-semibold transition-all"
                          title="Email non-attendance report to managers"
                        >
                          <FaEnvelope className="h-3 w-3" />
                          <span>Email</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-gray-100 m-0" />

                {/* Bottom Toolbar Row: Filters */}
                <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-4 p-1">
                  <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full md:w-auto">
                    {/* Date Selector */}
                    <div className="flex-1 sm:flex-none">
                      <label className="block text-[10px] sm:text-xs lg:text-xs sm:text-sm font-bold text-slate-700 mb-1.5">Select Date</label>
                      <div className="flex gap-2 h-[42px] sm:h-[46px] lg:h-[48px]">
                        <div 
                          className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-lg sm:rounded-xl px-3 w-full sm:w-auto relative cursor-pointer focus-within:border-[#000066]/40 transition-colors flex-1 shadow-sm" 
                          onClick={() => document.getElementById('date-picker-input')?.showPicker?.()}
                        >
                          <FaCalendarDay className="text-[#000066] h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <input
                            id="date-picker-input"
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                            onMouseDown={(e) => e.preventDefault()}
                            className="bg-transparent text-xs sm:text-xs sm:text-sm font-bold text-slate-800 w-full focus:outline-none cursor-pointer"
                            style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                          />
                        </div>
                        {selectedDate !== today && (
                          <button
                            onClick={() => setSelectedDate(today)}
                            className="px-4 h-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-lg sm:rounded-xl text-xs sm:text-xs sm:text-sm font-bold transition-all whitespace-nowrap shadow-sm"
                          >
                            Today
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="flex-1 w-full lg:min-w-[400px]">
                    <label htmlFor="search-input" className="block text-[10px] sm:text-xs lg:text-xs sm:text-sm font-bold text-slate-700 mb-1.5">Search Records</label>
                    <div className="flex items-center space-x-2">
                      <div className="relative flex-1 group h-[42px] sm:h-[46px] lg:h-[48px]">
                        <FaSearch className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-[#000066]/70 transition-colors h-3.5 w-3.5 sm:h-4 sm:w-5" />
                        <input
                          id="search-input"
                          type="text"
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          placeholder="Search by name, ID, field, or institute..."
                          className="w-full h-full pl-8 sm:pl-11 pr-3 sm:pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-lg sm:rounded-xl focus:ring-0 focus:outline-none focus:border-[#000066]/40 text-slate-900 text-xs sm:text-sm shadow-sm transition-all"
                        />
                        {searchInput && (
                          <button
                            onClick={() => setSearchInput("")}
                            className="absolute right-2.5 sm:right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-white p-1 rounded-full shadow-sm focus:outline-none"
                          >
                            <FaTimes className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* ── Meeting Without Daily Report ── */}
              <motion.div
                className="bg-white p-3 sm:p-5 rounded-2xl border border-amber-200 shadow-sm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.3 }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-100 rounded-xl flex-shrink-0">
                      <FaUsers className="text-amber-600 h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                        Meeting Attendance Without Daily Check-in
                      </h3>
                      <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                        Interns who attended a meeting but didn't mark daily
                        attendance on {formatDateLabel(selectedDate)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (!meetingData || meetingData.count === 0) {
                        showToast("No records to export", "info");
                        return;
                      }
                      setExportingMissingDaily(true);
                      try {
                        await attendanceApi.exportMeetingWithoutDailyExcel(
                          selectedDate,
                        );
                        showToast(
                          "Meeting-without-daily report downloaded",
                          "success",
                        );
                      } catch (err) {
                        showToast(err.message || "Export failed", "error");
                      } finally {
                        setExportingMissingDaily(false);
                      }
                    }}
                    disabled={exportingMissingDaily || !meetingData || meetingData.count === 0}
                    className="flex items-center gap-1.5 px-3 sm:px-2.5 py-1 sm:px-3 sm:py-1.5 sm:px-4 sm:py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg sm:rounded-xl text-xs sm:text-xs sm:text-sm font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-full sm:w-auto justify-center focus:outline-none"
                  >
                    {exportingMissingDaily ? (
                      <FaSpinner className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FaFileExcel className="h-3.5 w-3.5 text-white/90" />
                    )}
                    <span>Download Excel</span>
                  </button>
                </div>
              </motion.div>

              {/* ── Attendance Table ── */}
              <motion.div
                className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 bg-slate-50/80">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight leading-snug">
                      {loading ? (
                        "Loading…"
                      ) : activeData ? (
                        <>
                          {activeTab === "meeting" ? "Meeting" : "Daily"} Attendance - {formatDateLabel(selectedDate)}
                        </>
                      ) : (
                        "Attendance Records"
                      )}
                    </h2>
                    {!loading && activeData && (
                      <p className="text-sm text-gray-500 font-medium mt-0.5">
                        {searchTerm
                          ? `${filtered.length} of ${activeData.count} shown`
                          : `${activeData.count} intern${activeData.count !== 1 ? "s" : ""} marked present`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto mt-2 sm:mt-0">
                    {loading && (
                      <FaSpinner className="animate-spin text-[#00b4eb] h-5 w-5 self-center" />
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
                            showToast(
                              err.message || "PDF export failed",
                              "error",
                            );
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
                            showToast(
                              err.message || "PDF export failed",
                              "error",
                            );
                          } finally {
                            setExportingDailyPdf(false);
                          }
                        }
                      }}
                      disabled={
                        (activeTab === "meeting"
                          ? exportingMeetingPdf
                          : exportingDailyPdf) ||
                        (activeTab === "meeting"
                          ? meetingData?.count
                          : dailyData?.count) === 0
                      }
                      className="flex items-center gap-1.5 px-3 sm:px-2.5 py-1 sm:px-3 sm:py-1.5 sm:px-4 sm:py-2 bg-[#000066] hover:bg-[#000066]/90 text-white rounded-lg sm:rounded-xl text-xs sm:text-xs sm:text-sm font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-full sm:w-auto justify-center focus:outline-none"
                    >
                      {(
                        activeTab === "meeting"
                          ? exportingMeetingPdf
                          : exportingDailyPdf
                      ) ? (
                        <FaSpinner className="h-3.5 w-3.5 animate-spin text-white" />
                      ) : (
                        <FaFilePdf className="h-3.5 w-3.5 text-white/80" />
                      )}
                      <span>Download PDF</span>
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
                      className="w-10 h-10 border-t-4 border-b-4 border-blue-400 rounded-full mb-3 sm:mb-4"
                    />
                    <p className="text-sm">Fetching attendance…</p>
                  </div>
                ) : filtered.length === 0 && searchTerm ? (
                  <div className="text-center py-16 bg-gray-50 px-4">
                    <FaSearch className="mx-auto h-10 w-10 text-gray-300 mb-3 sm:mb-4" />
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
            </div> {/* End of blur wrapper */}
        </main>
        
        {/* Password Modal placed outside main but inside relative container to cover everything except navbar/sidebar */}
        <AnimatePresence>
          {showPasswordPopup && (
            <>
              {/* Overlay covering full screen, under navbar/sidebar */}
              <div 
                className="fixed inset-0 z-[25] pointer-events-auto bg-slate-900/60 backdrop-blur-md transition-all duration-300" 
                onClick={() => setShowPasswordPopup(false)}
              />
              
              {/* Modal container - sticky to center in viewport while respecting content area horizontal bounds */}
              <div className="absolute inset-x-0 top-0 h-full z-50 pointer-events-none">
                <div className="sticky top-[30vh] w-full flex justify-center px-4 pointer-events-none">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-sm pointer-events-auto"
                  >
                    <div className="flex justify-between items-start mb-3 sm:mb-4">
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-800">Security Check</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {passwordPopupAction === "attendance" ? "Enter password to access manual marking" : "Enter password to disable location requirement"}
                        </p>
                      </div>
                      <button 
                        onClick={() => setShowPasswordPopup(false)}
                        className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
                      >
                        <FaTimes className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mb-3 sm:mb-5 relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={securityPassword}
                        onChange={(e) => setSecurityPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handlePasswordVerify()}
                        placeholder="Enter password..."
                        autoFocus
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-[10px] text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                      >
                        {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                      </button>
                      {passwordError && (
                        <p className="text-xs font-semibold text-red-500 mt-2">{passwordError}</p>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowPasswordPopup(false)}
                        className="flex-1 px-2.5 py-1 sm:px-3 sm:py-1.5 sm:px-4 sm:py-2 bg-white border-2 border-slate-300 text-slate-700 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePasswordVerify}
                        disabled={settingsSaving || !securityPassword}
                        className="flex-1 flex items-center justify-center px-2.5 py-1 sm:px-3 sm:py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        {settingsSaving ? <FaSpinner className="w-4 h-4 animate-spin" /> : "Verify"}
                      </button>
                    </div>
                  </motion.div>
                </div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AdminNavigation>
  );
};

export default AdminInternAttendance;
