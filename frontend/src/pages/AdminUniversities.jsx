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
  Filter
} from "lucide-react";
import AdminNavigation from "../components/AdminNavigation";
import { adminApi } from "../api/adminApi";
import toast from "react-hot-toast";

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

const AdminUniversities = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("students"); // "students" | "approved" | "requests"
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // For viewing students of a selected university
  const [selectedFilterUni, setSelectedFilterUni] = useState("all");
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  const [confirmModal, setConfirmModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

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
    try {
      setLoadingStudents(true);
      const data = await adminApi.getStudentsByUniversity(universityName);
      setStudents(data.students || []);
    } catch (err) {
      toast.error(err.message || "Failed to load students");
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadUniversities();
    loadStudents("all");
  }, []);

  const handleAction = async (action, id, reason = "") => {
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
      setConfirmModal(null);
      setRejectionReason("");
    } catch (err) {
      toast.error(err.message || `Failed to ${action} university`);
    }
  };

  const handleViewStudentsClick = (uniName) => {
    setActiveTab("students");
    setSelectedFilterUni(uniName);
    loadStudents(uniName);
  };

  const handleUniFilterChange = (e) => {
    const val = e.target.value;
    setSelectedFilterUni(val);
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

  return (
    <AdminNavigation>
      <div className="min-h-full relative font-sans text-slate-800 flex flex-col select-none">
        <main className="relative flex-1 p-3 sm:p-6 sm:px-8 mx-auto max-w-[1400px] w-full flex flex-col gap-5 sm:gap-6 min-w-0">
          
          {/* Header */}
          <div className="relative z-30 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 pt-2">
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

          <div className="flex flex-wrap gap-2 sm:gap-3 mb-2">
            <button
              onClick={() => setActiveTab("students")}
              className={`flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-bold transition-all duration-200 ${
                activeTab === "students"
                  ? "bg-white border-[#00b4eb]/30 shadow-sm ring-2 ring-[#00b4eb]/20 text-slate-900"
                  : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>University Students</span>
            </button>
            <button
              onClick={() => setActiveTab("approved")}
              className={`flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-bold transition-all duration-200 ${
                activeTab === "approved"
                  ? "bg-white border-[#00b4eb]/30 shadow-sm ring-2 ring-[#00b4eb]/20 text-slate-900"
                  : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Approved Universities</span>
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-bold transition-all duration-200 ${
                activeTab === "requests"
                  ? "bg-white border-[#00b4eb]/30 shadow-sm ring-2 ring-[#00b4eb]/20 text-slate-900"
                  : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <Mail className="h-4 w-4" />
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
                <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm w-full">
                  <Search className="h-5 w-5 text-slate-400 mr-3 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search students by name, ID or email..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400"
                  />
                  {studentSearch && (
                    <button onClick={() => setStudentSearch("")}>
                      <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                    </button>
                  )}
                </div>
                
                <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm w-full sm:w-64 shrink-0 relative">
                  <Filter className="h-5 w-5 text-slate-400 mr-3 shrink-0" />
                  <select 
                    value={selectedFilterUni}
                    onChange={handleUniFilterChange}
                    className="w-full bg-transparent border-none outline-none text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                  >
                    <option value="all">All Universities</option>
                    {universities.filter(u => u.status === 'approved').map(u => (
                      <option key={u._id} value={u.universityName}>
                        {u.universityName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loadingStudents ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="font-medium text-sm">Loading students...</span>
                </div>
              ) : (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 sm:p-6 divide-y divide-slate-100">
                    {filteredStudents.length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                        <Search className="w-12 h-12 text-slate-200 mb-4" />
                        <p className="font-medium text-lg">No students found matching your criteria.</p>
                      </div>
                    ) : (
                      filteredStudents.map((student, idx) => {
                        const specStr = (student.fieldOfSpecialization || "").toLowerCase();
                        const hideCommits = NO_COMMITS_ROLES.some(role => specStr.includes(role));

                        return (
                          <div key={student.id || idx} className="py-6 first:pt-2 last:pb-2 flex flex-col xl:flex-row gap-6 xl:items-center hover:bg-slate-50/50 transition-colors p-4 rounded-2xl cursor-pointer" onClick={() => navigate(`/admin/universities/students/${student.id}`)}>
                            
                            {/* Profile Info Section */}
                            <div className="flex items-start gap-4 xl:w-2/5 min-w-[300px]">
                              {student.googlePictureUrl ? (
                                <img 
                                  src={student.googlePictureUrl} 
                                  alt={student.name} 
                                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-sm border-2 border-white ring-2 ring-slate-100 shrink-0" 
                                />
                              ) : (
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-black shadow-sm border-2 border-white ring-2 ring-slate-100 shrink-0">
                                  {student.name ? student.name.charAt(0).toUpperCase() : "?"}
                                </div>
                              )}
                              
                              <div className="flex-1 min-w-0 pt-1">
                                <h3 className="font-bold text-slate-800 text-lg sm:text-xl truncate" title={student.name}>
                                  {student.name}
                                </h3>
                                {/* Email directly under name */}
                                <div className="text-sm text-slate-500 font-medium truncate mb-2" title={student.email}>
                                  {student.email}
                                </div>
                                {/* Trainee ID, Specialization, Uni ID */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500 font-medium">
                                  <span className="flex items-center gap-1.5 text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md">
                                    {student.traineeId}
                                  </span>
                                  <span className="flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md truncate max-w-[150px]" title={student.fieldOfSpecialization}>
                                    {student.fieldOfSpecialization || "Not Specified"}
                                  </span>
                                  {student.team && student.team.toLowerCase() !== "general" && student.team.toLowerCase() !== "n/a" && student.team.toLowerCase() !== "unassigned" && (
                                    <span className="flex items-center gap-1 border border-slate-200 px-2 py-0.5 rounded-md">
                                      <span className="text-slate-400">Team:</span>
                                      <span className="font-bold text-slate-700">{student.team}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Metrics & Rating Section */}
                            <div className="flex-1 flex flex-col sm:flex-row items-center gap-6 justify-end w-full mt-4 xl:mt-0">
                              
                              {/* Circular Progress Bars */}
                              <div className="flex items-center gap-4 sm:gap-8 justify-center">
                                <CircularProgress value={student.dailyAttendanceRate ?? student.attendanceRate ?? 0} label="Daily Att." size={55} />
                                <CircularProgress value={student.meetingAttendanceRate ?? 0} label="Meeting Att." size={55} />
                                <CircularProgress value={student.workQualityRate ?? student.qualityScore ?? 0} label="Performance" size={55} />
                              </div>

                              {/* Vertical Line & Counts */}
                              <div className="pl-6 sm:pl-8 border-l-2 border-slate-200 flex items-center gap-6 sm:gap-8 justify-center shrink-0">
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Projects</span>
                                  <span className="text-3xl font-black text-slate-700">{student.projectsCount ?? (student.enrolledProjects?.length || 0)}</span>
                                </div>
                                <div className="flex flex-col items-center min-w-[50px]">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Commits</span>
                                  <span className="text-3xl font-black text-slate-700">
                                    {hideCommits ? "N/A" : (student.commitsCount || 0)}
                                  </span>
                                </div>
                              </div>

                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
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
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-500 border-b border-slate-200">
                        <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">University</th>
                        <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">Contact</th>
                        <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">Status</th>
                        {activeTab === "approved" && (
                          <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-right">Students</th>
                        )}
                        {activeTab === "requests" && (
                          <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider">Requested At</th>
                        )}
                        <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUniversities.map((uni) => (
                        <tr key={uni._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900">{uni.universityName}</p>
                            <p className="text-xs text-slate-500 font-medium">{uni.department}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-700">{uni.supervisorName}</p>
                            <p className="text-xs text-slate-500">{uni.email}</p>
                            <p className="text-xs text-slate-400">{uni.contactNumber}</p>
                          </td>
                          <td className="px-6 py-4">
                            {uni.status === "approved" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                              </span>
                            ) : uni.status === "rejected" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                                <XCircle className="h-3.5 w-3.5" /> Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                                <Clock className="h-3.5 w-3.5" /> Pending
                              </span>
                            )}
                          </td>
                          {activeTab === "approved" && (
                            <td className="px-6 py-4 text-right">
                              <span className="inline-flex items-center justify-center bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-full text-xs">
                                {uni.studentCount || 0}
                              </span>
                            </td>
                          )}
                          {activeTab === "requests" && (
                            <td className="px-6 py-4 text-xs font-medium text-slate-600">
                              {new Date(uni.requestedAt).toLocaleDateString()}
                            </td>
                          )}
                          <td className="px-6 py-4 text-right">
                            {activeTab === "approved" ? (
                              <button
                                onClick={() => handleViewStudentsClick(uni.universityName)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                              >
                                View Students <ChevronRight className="h-3 w-3" />
                              </button>
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
              )}
            </div>
          )}

        </main>
      </div>

      {/* Confirmation Modals */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 sm:p-8"
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
                  onClick={() => handleAction(confirmModal.action, confirmModal.uni._id, rejectionReason)}
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
          </motion.div>
        )}
      </AnimatePresence>

    </AdminNavigation>
  );
};

export default AdminUniversities;
