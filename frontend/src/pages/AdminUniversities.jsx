import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Mail,
  GraduationCap,
  AlertCircle,
  Loader2,
  ArrowLeft,
  X,
  FileText,
  Filter,
  Phone
} from "lucide-react";
import AdminNavigation from "../components/AdminNavigation";
import { adminApi } from "../api/adminApi";
import toast from "react-hot-toast";
import { FaEye, FaEyeSlash, FaSpinner } from "react-icons/fa";

// Roles that should display N/A for commits
const NO_COMMITS_ROLES = ["qa", "pm", "ba", "ai/ml", "devops", "cyber security", "cayber security"];

// Circular Progress Component
const CircularProgress = ({ value, label, size = 60, strokeWidth = 5 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  
  // Color logic
  let color = "text-emerald-500";
  if (value < 60) color = "text-rose-500";
  else if (value < 80) color = "text-amber-500";

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* Background Circle */}
        <svg className="absolute top-0 left-0 transform -rotate-90" width={size} height={size}>
          <circle
            className="text-slate-200"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          {/* Progress Circle */}
          <circle
            className={`${color} transition-all duration-1000 ease-out`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-xs font-bold text-slate-700">{Math.round(value)}%</span>
        </div>
      </div>
      {label && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1.5 whitespace-nowrap">{label}</span>}
    </div>
  );
};

const STUDENT_PAGE_SIZE = 25;

const AdminUniversities = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("approved"); // "students" | "approved" | "requests"
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // For viewing students of a selected university
  const [selectedFilterUni, setSelectedFilterUni] = useState("all");
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  const [confirmModal, setConfirmModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Security Popup State
  const [showSecurityPopup, setShowSecurityPopup] = useState(false);
  const [securityPassword, setSecurityPassword] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [studentPage, setStudentPage] = useState(1);

  // Cache: keyed by university name -> student array
  const studentCache = React.useRef({});

  const loadUniversities = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getUniversities();
      setUniversities(data);
    } catch (err) {
      toast.error(err.message || "Failed to load universities");
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async (universityName) => {
    // Serve from cache if available
    const cacheKey = universityName || "all";
    if (studentCache.current[cacheKey]) {
      setStudents(studentCache.current[cacheKey]);
      return;
    }
    try {
      setLoadingStudents(true);
      const data = await adminApi.getStudentsByUniversity(universityName);
      const loaded = data.students || [];
      studentCache.current[cacheKey] = loaded;
      setStudents(loaded);
    } catch (err) {
      toast.error(err.message || "Failed to load students");
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadUniversities();
  }, []);

  const executePendingAction = async () => {
    if (!pendingAction) return;
    const { action, id, reason } = pendingAction;
    try {
      if (action === "approve") {
        await adminApi.approveUniversity(id);
        toast.success("University approved successfully");
      } else if (action === "reject") {
        await adminApi.rejectUniversity(id, reason);
        toast.success("University rejected successfully");
      } else if (action === "delete") {
        await adminApi.deleteUniversity(id);
        toast.success("University deleted successfully");
      }
      loadUniversities();
      setPendingAction(null);
      setRejectionReason("");
    } catch (err) {
      toast.error(err.message || `Failed to ${action} university`);
    }
  };

  const handlePasswordVerify = async () => {
    if (!securityPassword) {
      setPasswordError("Please enter the security password");
      return;
    }
    setSettingsSaving(true);
    setPasswordError("");
    try {
      const { action, uniName, contactName, contactEmail } = pendingAction || {};
      const backendActionName = action === "approve" ? "university approve" : action === "reject" ? "university reject" : "university remove";
      
      let infoString = `University: ${uniName || ''}`;
      if (contactName || contactEmail) {
        infoString += ` (Contact: ${contactName || 'N/A'} - ${contactEmail || 'N/A'})`;
      }
      
      const response = await adminApi.post('/admin/attendance/verify-security', {
        securityPin: securityPassword,
        action: backendActionName,
        extraInfo: infoString
      });

      if (response.success || response.message) {
        setShowSecurityPopup(false);
        setSecurityPassword("");
        setPasswordError("");
        await executePendingAction();
      }
    } catch (err) {
      setPasswordError(err.response?.data?.message || "Invalid security password");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleAction = (action, id, reason = "") => {
    // This is replaced by clicking Yes on confirmModal which triggers security popup
  };


  const handleViewStudentsClick = (uniName) => {
    setActiveTab("students");
    setSelectedFilterUni(uniName);
    loadStudents(uniName);
  };

  const handleUniFilterChange = (e) => {
    const val = e.target.value;
    setSelectedFilterUni(val);
    setStudentPage(1);
    loadStudents(val);
  };

  const filteredUniversities = universities.filter((u) => {
    if (activeTab === "approved") return u.status === "approved";
    return u.status === "pending" || u.status === "rejected" || u.status === "revoked";
  });

  const filteredStudents = students.filter(s => 
    s.name?.toLowerCase().includes(studentSearch.toLowerCase()) || 
    s.traineeId?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const paginatedStudents = filteredStudents.slice(
    (studentPage - 1) * STUDENT_PAGE_SIZE,
    studentPage * STUDENT_PAGE_SIZE
  );

  return (
    <AdminNavigation>
      <div className="min-h-full relative font-sans text-slate-800 flex flex-col select-none">
        <main className="relative flex-1 p-3 sm:p-6 sm:px-8 mx-auto max-w-[1400px] w-full flex flex-col gap-5 sm:gap-6 min-w-0">
          
          {/* Header */}
          <div className="relative z-20 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 pt-2">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="p-2.5 sm:p-3 md:p-3.5 bg-gradient-to-br from-[#000066] to-[#006600] shadow-md rounded-lg sm:rounded-xl md:rounded-2xl border border-[#006600]/20 flex-shrink-0"
              >
                <GraduationCap className="text-white h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
              </motion.div>
              <div className="flex flex-col justify-center">
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight"
                >
                  University Management
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="text-slate-500 mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base font-medium max-w-xl"
                >
                  Manage university access requests and view university students.
                </motion.p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-2 w-full">
            <button
              onClick={() => {
                setActiveTab("students");
                if (students.length === 0 && !loadingStudents) {
                  loadStudents(selectedFilterUni);
                }
              }}
              className={`flex justify-center w-full sm:w-auto items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-bold transition-all duration-200 ${
                activeTab === "students"
                  ? "bg-white border-[#00b4eb]/30 shadow-sm ring-2 ring-[#00b4eb]/20 text-slate-900"
                  : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <Users className="h-4 w-4 shrink-0" />
              <span>University Students</span>
            </button>
            <button
              onClick={() => setActiveTab("approved")}
              className={`flex justify-center w-full sm:w-auto items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-bold transition-all duration-200 ${
                activeTab === "approved"
                  ? "bg-white border-[#00b4eb]/30 shadow-sm ring-2 ring-[#00b4eb]/20 text-slate-900"
                  : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <Building2 className="h-4 w-4 shrink-0" />
              <span>Approved Universities</span>
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`flex justify-center w-full sm:w-auto items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-bold transition-all duration-200 ${
                activeTab === "requests"
                  ? "bg-white border-[#00b4eb]/30 shadow-sm ring-2 ring-[#00b4eb]/20 text-slate-900"
                  : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <Mail className="h-4 w-4 shrink-0" />
              <span>Access Requests</span>
              {universities.filter(u => u.status === "pending").length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-rose-500 text-white text-[10px] rounded-full">
                  {universities.filter(u => u.status === "pending").length}
                </span>
              )}
            </button>
          </div>

          {/* Students View */}
          {activeTab === "students" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-3xl">
                <div className="flex items-center bg-white border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm w-full">
                  <Search className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 mr-2 sm:mr-3 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={studentSearch}
                    onChange={(e) => { setStudentSearch(e.target.value); setStudentPage(1); }}
                    className="w-full bg-transparent border-none outline-none text-xs sm:text-sm font-medium text-slate-700 placeholder:text-slate-400"
                  />
                  {studentSearch && (
                    <button onClick={() => { setStudentSearch(""); setStudentPage(1); }}>
                      <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                    </button>
                  )}
                </div>
                
                <div className="flex items-center bg-white border border-slate-200 rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm w-full sm:w-64 shrink-0 relative">
                  <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 mr-2 sm:mr-3 shrink-0" />
                  <select 
                    value={selectedFilterUni}
                    onChange={handleUniFilterChange}
                    className="w-full bg-transparent border-none outline-none text-xs sm:text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                  >
                    <option value="all">All Universities</option>
                    {universities.filter(u => u.status === 'approved').map(u => u.universityName).filter((v, i, a) => a.indexOf(v) === i).map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {loadingStudents ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center py-20 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="font-medium text-sm">Loading students...</span>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl shadow-sm overflow-hidden flex flex-col">
                  {/* Mobile View */}
                  <div className="block xl:hidden divide-y divide-slate-100">
                    {filteredStudents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Search className="w-10 h-10 text-slate-200 mb-3" />
                        <p className="font-semibold text-slate-500 text-sm">No students found.</p>
                      </div>
                    ) : (
                      paginatedStudents.map((student, idx) => {
                        const specStr = (student.fieldOfSpecialization || "").toLowerCase();
                        const hideCommits = NO_COMMITS_ROLES.some(role => specStr.includes(role));
                        const getRateColor = (v) => v >= 80 ? "text-emerald-600" : v >= 60 ? "text-amber-500" : "text-rose-500";

                        return (
                          <div key={student.id || idx} className="p-4 flex flex-col gap-3 hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/universities/students/${student.id}`)}>
                            <div className="flex items-center gap-3">
                              {student.googlePictureUrl ? (
                                <img src={student.googlePictureUrl} alt={student.name} className="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-200" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling.style.display = "flex"; }} />
                              ) : null}
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 items-center justify-center text-white text-lg font-black shrink-0" style={{ display: student.googlePictureUrl ? "none" : "flex" }}>
                                {student.name ? student.name.charAt(0).toUpperCase() : "?"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 text-sm leading-snug truncate">{student.name}</p>
                                <p className="text-[11px] font-medium text-slate-500 truncate">{student.email}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{student.traineeId}</span>
                                  <span className="text-[10px] font-medium text-slate-600 truncate">{student.fieldOfSpecialization || "—"}</span>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                              <div className="flex flex-col items-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Daily</span>
                                <span className={`text-xs font-black ${getRateColor(student.dailyAttendanceRate ?? student.attendanceRate ?? 0)}`}>{Math.round(student.dailyAttendanceRate ?? student.attendanceRate ?? 0)}%</span>
                              </div>
                              <div className="flex flex-col items-center border-l border-slate-100">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Meet</span>
                                <span className={`text-xs font-black ${getRateColor(student.meetingAttendanceRate ?? 0)}`}>{Math.round(student.meetingAttendanceRate ?? 0)}%</span>
                              </div>
                              <div className="flex flex-col items-center border-l border-slate-100">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Perf</span>
                                <span className={`text-xs font-black ${getRateColor(student.workQualityRate ?? student.qualityScore ?? 0)}`}>{Math.round(student.workQualityRate ?? student.qualityScore ?? 0)}%</span>
                              </div>
                              <div className="flex flex-col items-center border-l border-slate-100">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Comms</span>
                                <span className="text-xs font-black text-slate-700">{hideCommits ? "N/A" : (student.commitsCount || 0)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Desktop View */}
                  <div className="hidden xl:block overflow-x-auto">
                    <table className="w-full text-sm border-separate border-spacing-0 table-fixed">
                      <thead className="bg-slate-50/90">
                        <tr>
                          <th className="w-[32%] px-4 py-3.5 border-b border-slate-200 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Intern</th>
                          <th className="w-[13%] px-3 py-3.5 border-b border-slate-200 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Trainee ID</th>
                          <th className="w-[14%] px-3 py-3.5 border-b border-slate-200 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Specialization</th>
                          <th className="w-[10%] px-3 py-3.5 border-b border-slate-200 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Daily Att.</th>
                          <th className="w-[11%] px-3 py-3.5 border-b border-slate-200 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Meeting Att.</th>
                          <th className="w-[10%] px-3 py-3.5 border-b border-slate-200 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Performance</th>
                          <th className="w-[10%] px-3 py-3.5 border-b border-slate-200 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Commits</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStudents.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="px-4 py-16 text-center">
                              <div className="flex flex-col items-center justify-center">
                                <Search className="w-10 h-10 text-slate-200 mb-3" />
                                <p className="font-semibold text-slate-500">No students found matching your criteria.</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          paginatedStudents.map((student, idx) => {
                            const specStr = (student.fieldOfSpecialization || "").toLowerCase();
                            const hideCommits = NO_COMMITS_ROLES.some(role => specStr.includes(role));
                            const getRateColor = (v) => v >= 80 ? "text-emerald-600" : v >= 60 ? "text-amber-500" : "text-rose-500";

                            return (
                              <tr
                                key={student.id || idx}
                                className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                                onClick={() => navigate(`/admin/universities/students/${student.id}`)}
                              >
                                {/* Intern avatar + name + email */}
                                <td className="px-4 py-3 text-left align-middle">
                                  <div className="flex items-center gap-2.5">
                                    {student.googlePictureUrl ? (
                                      <img
                                        src={student.googlePictureUrl}
                                        alt={student.name}
                                        className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200"
                                        onError={(e) => {
                                          e.currentTarget.onerror = null;
                                          e.currentTarget.style.display = "none";
                                          e.currentTarget.nextElementSibling.style.display = "flex";
                                        }}
                                      />
                                    ) : null}
                                    <div
                                      className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 items-center justify-center text-white text-sm font-black shrink-0"
                                      style={{ display: student.googlePictureUrl ? "none" : "flex" }}
                                    >
                                      {student.name ? student.name.charAt(0).toUpperCase() : "?"}
                                    </div>
                                    <div className="min-w-0 flex-1 pr-2">
                                      <p className="font-bold text-slate-800 text-[13px] leading-snug truncate">{student.name}</p>
                                      <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">{student.email}</p>
                                    </div>
                                  </div>
                                </td>

                                {/* Trainee ID */}
                                <td className="px-3 py-3 text-center align-middle">
                                  <span className="font-mono text-[13px] font-bold text-slate-700">{student.traineeId}</span>
                                </td>

                                {/* Specialization */}
                                <td className="px-3 py-3 text-center align-middle">
                                  <span className="text-[12px] font-medium text-slate-600" title={student.fieldOfSpecialization}>
                                    {student.fieldOfSpecialization || "—"}
                                  </span>
                                </td>

                                {/* Daily Attendance */}
                                <td className="px-3 py-3 text-center align-middle">
                                  <span className={`text-[13px] font-bold ${getRateColor(student.dailyAttendanceRate ?? student.attendanceRate ?? 0)}`}>
                                    {Math.round(student.dailyAttendanceRate ?? student.attendanceRate ?? 0)}%
                                  </span>
                                </td>

                                {/* Meeting Attendance */}
                                <td className="px-3 py-3 text-center align-middle">
                                  <span className={`text-[13px] font-bold ${getRateColor(student.meetingAttendanceRate ?? 0)}`}>
                                    {Math.round(student.meetingAttendanceRate ?? 0)}%
                                  </span>
                                </td>

                                {/* Performance */}
                                <td className="px-3 py-3 text-center align-middle">
                                  <span className={`text-[13px] font-bold ${getRateColor(student.workQualityRate ?? student.qualityScore ?? 0)}`}>
                                    {Math.round(student.workQualityRate ?? student.qualityScore ?? 0)}%
                                  </span>
                                </td>

                                {/* Commits */}
                                <td className="px-3 py-3 text-center align-middle">
                                  <span className="text-[13px] font-bold text-slate-700">
                                    {hideCommits ? "N/A" : (student.commitsCount || 0)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  {filteredStudents.length > STUDENT_PAGE_SIZE && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                      <span className="text-xs font-medium text-slate-500">
                        Showing {(studentPage - 1) * STUDENT_PAGE_SIZE + 1}–{Math.min(studentPage * STUDENT_PAGE_SIZE, filteredStudents.length)} of {filteredStudents.length} students
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                          disabled={studentPage === 1}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          <ChevronRight className="h-4 w-4 rotate-180" />
                        </button>
                        {Array.from({ length: Math.ceil(filteredStudents.length / STUDENT_PAGE_SIZE) }, (_, i) => i + 1)
                          .filter(p => p === 1 || p === Math.ceil(filteredStudents.length / STUDENT_PAGE_SIZE) || Math.abs(p - studentPage) <= 1)
                          .reduce((acc, p, i, arr) => {
                            if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
                            acc.push(p);
                            return acc;
                          }, [])
                          .map((item, i) => item === "..." ? (
                            <span key={`dots-${i}`} className="px-1 text-slate-400 text-xs">…</span>
                          ) : (
                            <button
                              key={item}
                              onClick={() => setStudentPage(item)}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all focus:outline-none cursor-pointer ${studentPage === item ? "bg-gradient-to-r from-[#000066] to-[#006600] text-white shadow-md shadow-[#006600]/20" : "text-slate-600 hover:bg-slate-200"}`}
                            >
                              {item}
                            </button>
                          ))
                        }
                        <button
                          onClick={() => setStudentPage(p => Math.min(Math.ceil(filteredStudents.length / STUDENT_PAGE_SIZE), p + 1))}
                          disabled={studentPage === Math.ceil(filteredStudents.length / STUDENT_PAGE_SIZE)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Universities / Requests List */}
          {activeTab !== "students" && (
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="font-medium text-sm">Loading data...</span>
                </div>
              ) : filteredUniversities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Building2 className="h-12 w-12 mb-3 opacity-50" />
                  <p className="font-semibold text-sm">No {activeTab} universities found.</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {/* Mobile View */}
                  <div className="block xl:hidden divide-y divide-slate-100">
                    {filteredUniversities.map((uni) => (
                      <div key={uni._id} className="p-4 flex flex-col gap-3 hover:bg-slate-50/50 transition-colors">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm leading-snug truncate">{uni.universityName}</p>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">{uni.department}</p>
                          </div>
                          <div className="shrink-0">
                            {uni.status === "approved" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3" /> Approved
                              </span>
                            ) : uni.status === "rejected" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                                <XCircle className="h-3 w-3" /> Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                                <Clock className="h-3 w-3" /> Pending
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-1.5">
                          <p className="font-semibold text-slate-700 text-[13px] truncate">{uni.supervisorName}</p>
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                              <Mail className="h-3 w-3 text-slate-400 shrink-0" /> {uni.email}
                            </span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                              <Phone className="h-3 w-3 text-slate-400 shrink-0" /> {uni.contactNumber}
                            </span>
                          </div>
                        </div>

                        {activeTab === "approved" && (
                          <div className="flex items-center justify-between text-xs font-medium text-slate-600 bg-slate-50/50 px-3 py-2 rounded-lg border border-slate-100">
                            <span>Total Students</span>
                            <span className="font-bold text-slate-800 text-[13px]">{uni.studentCount || 0}</span>
                          </div>
                        )}
                        {activeTab === "requests" && (
                          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 bg-slate-50/50 px-3 py-2 rounded-lg border border-slate-100">
                            <span>Requested At</span>
                            <span className="font-bold text-slate-700 text-xs">{new Date(uni.requestedAt).toLocaleDateString()}</span>
                          </div>
                        )}

                        <div className="pt-2 flex gap-2 justify-end border-t border-slate-100/80">
                          {activeTab === "approved" ? (
                            <>
                              <button onClick={() => handleViewStudentsClick(uni.universityName)} className="inline-flex flex-1 justify-center items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 text-xs font-bold transition-colors">
                                View
                              </button>
                              <button onClick={() => setConfirmModal({ action: "delete", uni })} className="inline-flex flex-1 justify-center items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-colors">
                                Remove
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-2 w-full">
                              {uni.status === "pending" && (
                                <>
                                  <button onClick={() => setConfirmModal({ action: "approve", uni })} className="flex-1 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors">Approve</button>
                                  <button onClick={() => setConfirmModal({ action: "reject", uni })} className="flex-1 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors">Reject</button>
                                </>
                              )}
                              <button onClick={() => setConfirmModal({ action: "delete", uni })} className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors shrink-0"><X className="h-4 w-4" /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop View */}
                  <div className="hidden xl:block overflow-x-auto">
                    <table className="w-full text-sm border-separate border-spacing-0 table-fixed">
                      <thead className="bg-slate-50/90">
                      <tr>
                        <th className="w-[28%] px-4 py-3.5 border-b border-slate-200 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">University</th>
                        <th className="w-[26%] px-3 py-3.5 border-b border-slate-200 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                        <th className="w-[14%] px-3 py-3.5 border-b border-slate-200 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        {activeTab === "approved" && (
                          <th className="w-[10%] px-3 py-3.5 border-b border-slate-200 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Students</th>
                        )}
                        {activeTab === "requests" && (
                          <th className="w-[14%] px-3 py-3.5 border-b border-slate-200 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Requested At</th>
                        )}
                        <th className="px-3 py-3.5 border-b border-slate-200 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUniversities.map((uni) => (
                        <tr key={uni._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 align-middle">
                            <p className="font-bold text-slate-800 text-[13px] leading-snug">{uni.universityName}</p>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">{uni.department}</p>
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <p className="font-semibold text-slate-700 text-[13px]">{uni.supervisorName}</p>
                            <p className="text-[11px] text-slate-500">{uni.email}</p>
                            <p className="text-[11px] text-slate-400">{uni.contactNumber}</p>
                          </td>
                          <td className="px-3 py-3 text-center align-middle">
                            {uni.status === "approved" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3" /> Approved
                              </span>
                            ) : uni.status === "rejected" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 text-[11px] font-bold border border-rose-200">
                                <XCircle className="h-3 w-3" /> Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-200">
                                <Clock className="h-3 w-3" /> Pending
                              </span>
                            )}
                          </td>
                          {activeTab === "approved" && (
                            <td className="px-3 py-3 text-center align-middle">
                              <span className="font-bold text-slate-700 text-[13px]">{uni.studentCount || 0}</span>
                            </td>
                          )}
                          {activeTab === "requests" && (
                            <td className="px-3 py-3 text-center align-middle text-[12px] font-medium text-slate-600">
                              {new Date(uni.requestedAt).toLocaleDateString()}
                            </td>
                          )}
                          <td className="px-3 py-3 text-center align-middle">
                            {activeTab === "approved" ? (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleViewStudentsClick(uni.universityName)}
                                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 text-xs font-bold transition-colors"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => setConfirmModal({ action: "delete", uni })}
                                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2">
                                {uni.status === "pending" && (
                                  <>
                                    <button
                                      onClick={() => setConfirmModal({ action: "approve", uni })}
                                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => setConfirmModal({ action: "reject", uni })}
                                      className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors"
                                    >
                                      Reject
                                    </button>
                                </>
                                )}
                                <button
                                  onClick={() => setConfirmModal({ action: "delete", uni })}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                  title="Delete Record"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* Shared backdrop overlay - persists while any popup is open, prevents flash */}
      <AnimatePresence>
        {(confirmModal || showSecurityPopup) && (
          <motion.div
            key="shared-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[25] pointer-events-none bg-slate-900/60 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Confirmation Modals */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div key="modal-wrapper-animate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[50] pointer-events-none">
            {/* Invisible click-capture for closing modal */}
            <div
              className="fixed inset-0 z-[26] pointer-events-auto"
              onClick={() => {
                setConfirmModal(null);
                setRejectionReason("");
              }}
            />
            <div className="fixed left-0 lg:left-[260px] right-0 bottom-0 top-[64px] z-50 pointer-events-none flex items-center justify-center px-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 sm:p-8 pointer-events-auto"
              >
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {confirmModal.action === "approve" ? "Approve Request?" : 
                 confirmModal.action === "reject" ? "Reject Request?" : "Delete Record?"}
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                {confirmModal.action === "approve" 
                  ? `Are you sure you want to approve access for ${confirmModal.uni.universityName}? They will receive an email and can now log in.`
                  : confirmModal.action === "reject"
                  ? `Are you sure you want to reject access for ${confirmModal.uni.universityName}? They will receive an email notification.`
                  : `Are you sure you want to completely delete the record for ${confirmModal.uni.universityName}? This action cannot be undone.`}
              </p>

              {confirmModal.action === "reject" && (
                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Reason for rejection
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="E.g., Invalid supervisor credentials..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none h-24"
                  />
                </div>
              )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setConfirmModal(null);
                      setRejectionReason("");
                    }}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setPendingAction({
                        action: confirmModal.action,
                        id: confirmModal.uni._id,
                        uniName: confirmModal.uni.universityName,
                        contactName: confirmModal.uni.supervisorName,
                        contactEmail: confirmModal.uni.email,
                        reason: rejectionReason
                      });
                      setConfirmModal(null);
                      setShowSecurityPopup(true);
                    }}
                    className={`flex-1 py-3 text-white text-sm font-bold rounded-xl transition-colors ${
                      confirmModal.action === "approve" ? "bg-emerald-600 hover:bg-emerald-700" :
                      "bg-rose-600 hover:bg-rose-700"
                    }`}
                  >
                    {confirmModal.action === "approve" ? "Yes, Approve" : 
                     confirmModal.action === "reject" ? "Yes, Reject" : "Yes, Delete"}
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security Check Popup */}
      <AnimatePresence>
        {showSecurityPopup && (
          <motion.div key="modal-wrapper-animate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[50] pointer-events-none">
            {/* Invisible click-capture for closing security popup */}
            <div
              className="fixed inset-0 z-[26] pointer-events-auto"
              onClick={() => setShowSecurityPopup(false)}
            />

            {/* Modal container */}
            <div className="fixed left-0 lg:left-[260px] right-0 bottom-0 top-[64px] z-50 pointer-events-none flex items-center justify-center px-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    onAnimationComplete={() => {
                      document.getElementById('uni-security-password-input')?.focus();
                    }}
                    className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-sm pointer-events-auto"
                  >
                    <div className="flex justify-between items-start mb-3 sm:mb-4">
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-800">Security Check</h3>
                        <p className="text-xs text-slate-500 mt-1">Enter password to proceed</p>
                      </div>
                      <button
                        onClick={() => setShowSecurityPopup(false)}
                        className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mb-3 sm:mb-5 relative">
                      <input
                        id="uni-security-password-input"
                        type={showPasswordText ? "text" : "password"}
                        value={securityPassword}
                        onChange={(e) => setSecurityPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handlePasswordVerify()}
                        placeholder="Enter password..."
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute right-3 top-[10px] text-slate-400 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer"
                      >
                        {showPasswordText ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                      </button>
                      {passwordError && (
                        <p className="text-xs font-semibold text-rose-500 mt-2">{passwordError}</p>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowSecurityPopup(false)}
                        className="flex-1 px-4 py-2 sm:py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePasswordVerify}
                        disabled={settingsSaving || !securityPassword}
                        className="flex-1 flex items-center justify-center px-4 py-2 sm:py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
                      >
                        {settingsSaving ? <FaSpinner className="w-4 h-4 animate-spin" /> : "Verify"}
                      </button>
                    </div>
                  </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

    </AdminNavigation>
  );
};

export default AdminUniversities;
