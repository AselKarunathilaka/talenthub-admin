import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FaUsers, FaUserCheck, FaUserTimes, FaExclamationTriangle, FaSearch, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  Building2,
  Users,
  Search,
  Filter,
  LogOut,
  Calendar,
  Clock,
  BookOpen,
  ScanLine,
  Activity,
  Award,
  Sparkles,
  ChevronRight,
  ChevronDown,

  AlertCircle,
  FolderGit2,
  MessageSquare,
  Send,
  X,
  RefreshCw,
  ExternalLink,
  MapPin,
  Mail,
  UserCheck,
  UserX,
  UserMinus,
  AlertTriangle,
  TrendingUp,
  Shield,
  Layers,
  ArrowUpDown,
  CheckCircle,
  GitCommit,
} from "lucide-react";
import { API_BASE_URL } from "../api/apiConfig";
import sltLogo from "../assets/sltlogoOnly.png";
import talentHubLogo from "../assets/talenthubwhitebg.jpeg";

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
          <span className="text-xs font-bold text-slate-700">{value}%</span>
        </div>
      </div>
      {label && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1.5 whitespace-nowrap">{label}</span>}
    </div>
  );
};

// Reusable Metric Card Component for Summary Section
const MetricCard = ({ title, value, icon, colorClass, gradient, delay, isActive, onClick }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    whileHover={{ y: -5 }}
    onClick={onClick}
    className={`bg-white rounded-3xl p-6 shadow-lg hover:shadow-xl border-2 transition-all duration-300 overflow-hidden relative group flex flex-col justify-center cursor-pointer ${isActive ? colorClass : 'border-transparent'}`}
  >
    {/* Background Pattern */}
    <div className={`absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-gradient-to-br ${gradient} rounded-full opacity-10 group-hover:scale-150 transition-transform duration-700 ease-out`} />
    
    <div className="flex items-center justify-between relative z-10">
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
          {title}
        </p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl sm:text-4xl font-bold text-slate-800">
            {value}
          </h3>
        </div>
      </div>
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg transform group-hover:rotate-12 transition-transform duration-300 shrink-0`}>
        {icon}
      </div>
    </div>
    
    {isActive && (
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-30" />
    )}
  </motion.div>
);

// Module-level in-memory cache to preserve state when navigating back and forth
let universityDashboardCache = {
  students: [],
  metrics: {
    totalInterns: 0,
    activeInterns: 0,
    inactiveInterns: 0,
    lowPerformers: 0,
    terminatedInterns: 0,
  },
  supervisor: null,
  searchQuery: "",
  selectedSpec: "all",
  selectedStatus: "all",
  sortBy: "all",
  hasLoadedOnce: false,
};

const UniversityDashboard = () => {
  const navigate = useNavigate();
  const [supervisor, setSupervisor] = useState(() => {
    if (universityDashboardCache.supervisor) return universityDashboardCache.supervisor;
    try {
      return JSON.parse(localStorage.getItem("universityUser") || "null");
    } catch {
      return null;
    }
  });
  const [students, setStudents] = useState(() => universityDashboardCache.students || []);
  const [metrics, setMetrics] = useState(() => universityDashboardCache.metrics || {
    totalInterns: 0,
    activeInterns: 0,
    inactiveInterns: 0,
    lowPerformers: 0,
    terminatedInterns: 0,
  });
  const [loading, setLoading] = useState(() => !universityDashboardCache.hasLoadedOnce);
  const [searchQuery, setSearchQuery] = useState(() => universityDashboardCache.searchQuery || "");
  const [selectedSpec, setSelectedSpec] = useState(() => universityDashboardCache.selectedSpec || "all");
  const [selectedStatus, setSelectedStatus] = useState(() => universityDashboardCache.selectedStatus || "all");
  const [sortBy, setSortBy] = useState(() => universityDashboardCache.sortBy || "all");
  
  const [lightboxImage, setLightboxImage] = useState(null);
  const [isLightboxFallback, setIsLightboxFallback] = useState(false);

  // Keep module cache synchronized with current filters
  useEffect(() => {
    universityDashboardCache.searchQuery = searchQuery;
    universityDashboardCache.selectedSpec = selectedSpec;
    universityDashboardCache.selectedStatus = selectedStatus;
    universityDashboardCache.sortBy = sortBy;
  }, [searchQuery, selectedSpec, selectedStatus, sortBy]);

  // Profile dropdown menu state & ref
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getAuthToken = () => {
    return (
      localStorage.getItem("universityToken") ||
      localStorage.getItem("authToken") ||
      (() => {
        try {
          return JSON.parse(localStorage.getItem("adminInfo") || "{}")?.token || "";
        } catch {
          return "";
        }
      })()
    );
  };

  const handleLogout = () => {
    universityDashboardCache = {
      students: [],
      metrics: {
        totalInterns: 0,
        activeInterns: 0,
        inactiveInterns: 0,
        lowPerformers: 0,
        terminatedInterns: 0,
      },
      supervisor: null,
      searchQuery: "",
      selectedSpec: "all",
      selectedStatus: "all",
      sortBy: "all",
      hasLoadedOnce: false,
    };
    localStorage.removeItem("universityToken");
    localStorage.removeItem("universityUser");
    navigate("/university-login");
  };

  // ─── Single unified fetch: students + all commits in parallel ───────────────
  const fetchAllData = useCallback(async () => {
    const alreadyLoaded = universityDashboardCache.hasLoadedOnce;
    if (!alreadyLoaded) setLoading(true);

    const token = getAuthToken();
    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    try {
      // ── Step 1: Fetch student list ────────────────────────────────────────
      const res = await fetch(`${API_BASE_URL}/university/students`, { headers });

      if (res.status === 401 && !token) { handleLogout(); return; }

      const data = await res.json();
      if (!res.ok) return;

      const studentList = data.students || [];

      const total = data.totalInterns ?? data.totalStudents ?? studentList.length;
      const activeCount   = studentList.filter((s) => s.status === "active"     || (!s.isInactive && !s.isTerminated && !s.logbookRestricted)).length;
      const inactiveCount = studentList.filter((s) => s.isInactive && !s.isTerminated && !s.logbookRestricted).length;
      const terminatedCount = studentList.filter((s) => s.isTerminated || s.logbookRestricted || s.status === "terminated").length;
      const lowPerfCount  = studentList.filter((s) => s.isLowPerformer || s.restrictionCount >= 2).length;

      const updatedMetrics = {
        totalInterns:      total,
        activeInterns:     data.activeInterns     ?? activeCount,
        inactiveInterns:   data.inactiveInterns   ?? inactiveCount,
        terminatedInterns: data.terminatedInterns ?? terminatedCount,
        lowPerformers:     data.lowPerformers     ?? lowPerfCount,
      };

      // Merge supervisor info
      let mergedSup = supervisor;
      const storedUser = localStorage.getItem("universityUser");
      if (storedUser) {
        try { mergedSup = { ...supervisor, ...JSON.parse(storedUser) }; } catch (_) {}
      } else if (data.universityName) {
        mergedSup = { ...supervisor, universityName: data.universityName,
          supervisorName: data.supervisorName || supervisor?.supervisorName || "University Supervisor" };
      }

      // ── Step 2: Fetch commits for all active students in parallel ─────────
      // Only re-fetch students that don't already have commits in cache
      const cachedStudentsMap = new Map(
        (universityDashboardCache.students || []).map((s) => [s.id, s])
      );

      const studentsNeedingCommits = studentList.filter((s) => {
        const cached = cachedStudentsMap.get(s.id);
        return !s.isInactive && !s.isTerminated &&
               (cached?.commitsCount === undefined || cached?.commitsCount === 0);
      });

      // Merge cached commit counts into fresh student list immediately
      const studentsWithCachedCommits = studentList.map((s) => {
        const cached = cachedStudentsMap.get(s.id);
        return cached?.commitsCount !== undefined
          ? { ...s, commitsCount: cached.commitsCount }
          : s;
      });

      // Fetch all missing commits concurrently (no artificial batch delays)
      const commitResults = await Promise.allSettled(
        studentsNeedingCommits.map(async (st) => {
          try {
            const r = await fetch(`${API_BASE_URL}/university/students/${st.id}/git-commits`, { headers });
            if (!r.ok) return { id: st.id, count: 0 };
            const d = await r.json();
            let count = 0;
            if (d?.totalCommits !== undefined) {
              count = Number(d.totalCommits) || 0;
            } else {
              const projects = Array.isArray(d) ? d : (d?.projectCommits || []);
              const all = [];
              function walk(node) {
                if (!node) return;
                if (Array.isArray(node.commits))     all.push(...node.commits);
                if (Array.isArray(node.modules))     node.modules.forEach(walk);
                if (Array.isArray(node.children))    node.children.forEach(walk);
                if (Array.isArray(node.subProjects)) node.subProjects.forEach(walk);
              }
              projects.forEach(walk);
              count = all.length;
            }
            return { id: st.id, count };
          } catch {
            return { id: st.id, count: 0 };
          }
        })
      );

      // Build commit count map from results
      const commitMap = new Map();
      commitResults.forEach((result) => {
        if (result.status === "fulfilled" && result.value) {
          commitMap.set(result.value.id, result.value.count);
        }
      });

      // Merge commit counts into final student list
      const finalStudents = studentsWithCachedCommits.map((s) =>
        commitMap.has(s.id) ? { ...s, commitsCount: commitMap.get(s.id) } : s
      );

      // ── Step 3: Commit everything to state + cache at once ────────────────
      setStudents(finalStudents);
      setMetrics(updatedMetrics);
      setSupervisor(mergedSup);

      universityDashboardCache.students      = finalStudents;
      universityDashboardCache.metrics       = updatedMetrics;
      universityDashboardCache.supervisor    = mergedSup;
      universityDashboardCache.hasLoadedOnce = true;

    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);



  // Distinct Specializations
  const specializations = useMemo(() => {
    return Array.from(
      new Set(students.map((s) => s.fieldOfSpecialization).filter(Boolean))
    );
  }, [students]);

  // Fast Instant Filter & Sort Students
  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return students
      .filter((s) => {
        const matchesSearch =
          !query ||
          (s.name || "").toLowerCase().includes(query) ||
          (s.traineeId || "").toLowerCase().includes(query) ||
          (s.email || "").toLowerCase().includes(query) ||
          (s.fieldOfSpecialization || "").toLowerCase().includes(query);

        const matchesSpec =
          selectedSpec === "all" || s.fieldOfSpecialization === selectedSpec;

        const matchesStatus =
          selectedStatus === "all" ||
          (selectedStatus === "active" && (s.status === "active" || (!s.isInactive && !s.isTerminated && !s.logbookRestricted))) ||
          (selectedStatus === "inactive" && (s.status === "inactive" || (s.isInactive && !s.isTerminated && !s.logbookRestricted))) ||
          (selectedStatus === "low_performers" && (s.isLowPerformer || s.restrictionCount >= 2)) ||
          (selectedStatus === "terminated" && (s.status === "terminated" || s.isTerminated || s.logbookRestricted));

        return matchesSearch && matchesSpec && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "all") {
          const scoreA =
            ((a.dailyAttendanceRate ?? a.attendanceRate ?? 0) +
              (a.meetingAttendanceRate ?? 0) +
              (a.workQualityRate ?? a.qualityScore ?? 0)) /
            3;
          const scoreB =
            ((b.dailyAttendanceRate ?? b.attendanceRate ?? 0) +
              (b.meetingAttendanceRate ?? 0) +
              (b.workQualityRate ?? b.qualityScore ?? 0)) /
            3;
          return scoreB - scoreA;
        }
        if (sortBy === "daily_attendance") return (b.dailyAttendanceRate ?? b.attendanceRate ?? 0) - (a.dailyAttendanceRate ?? a.attendanceRate ?? 0);
        if (sortBy === "meeting_attendance") return (b.meetingAttendanceRate ?? 0) - (a.meetingAttendanceRate ?? 0);
        if (sortBy === "quality") return (b.workQualityRate ?? b.qualityScore ?? 0) - (a.workQualityRate ?? a.qualityScore ?? 0);
        if (sortBy === "commits") return (b.commitsCount ?? 0) - (a.commitsCount ?? 0);
        if (sortBy === "logbooks") return (b.logbookCount ?? 0) - (a.logbookCount ?? 0);
        return 0;
      });
  }, [students, searchQuery, selectedSpec, selectedStatus, sortBy]);

  // Google Profile Picture resolution
  const profilePictureUrl = supervisor?.picture || supervisor?.googlePictureUrl || "";

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans select-none">
      {/* ─── Top Brand Navigation Bar (Exact TalentHub Gradient) ─── */}
      <header
        className="sticky top-0 z-40 shadow-lg text-white select-none"
        style={{
          background: "linear-gradient(135deg, #000066 0%, #006600 100%)",
        }}
      >
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* ─── LEFT CORNER: SLT Logo + TalentHub Logo + Title & Subtitle + University & Supervisor Info ─── */}
            <div className="flex items-center gap-2.5 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <img
                  src={sltLogo}
                  alt="SLT Mobitel"
                  className="h-8 sm:h-10 w-auto object-contain select-none"
                />
                <img
                  src={talentHubLogo}
                  alt="TalentHub"
                  className="h-8 sm:h-10 w-auto rounded-md object-contain select-none"
                />
              </div>

              <div className="flex flex-col justify-center">
                <span className="text-xl sm:text-2xl font-extrabold tracking-tight leading-none text-white">
                  <span className="text-[#00b4eb]">Talent</span>
                  <span className="text-[#50b748]">Hub</span>
                </span>
                <span className="text-xs sm:text-[13px] text-white/80 font-normal mt-1 leading-none tracking-normal">
                  University Portal
                </span>
              </div>

              {/* Divider */}
              <div className="h-10 sm:h-11 w-px bg-white/25 hidden md:block mx-1.5 sm:mx-2" />

              {/* University Name & Supervisor Name */}
              <div className="hidden md:flex flex-col justify-center leading-tight">
                <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[220px] lg:max-w-[380px]">
                  {supervisor?.universityName || "University Supervision"}
                </span>
                <span className="text-[11px] text-white/70 mt-0.5 truncate max-w-[220px] lg:max-w-[380px]">
                  {supervisor?.supervisorName
                    ? `Supervisor: ${supervisor.supervisorName}`
                    : "Academic Supervision"}
                </span>
              </div>
            </div>

            {/* ─── RIGHT CORNER: Profile Button with Google Image & Dropdown ─── */}
            <div className="flex items-center gap-2 sm:gap-3.5">
              {/* Profile Avatar / Trigger Button */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen((prev) => !prev)}
                  className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-full sm:rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 transition-all cursor-pointer"
                >
                  {profilePictureUrl ? (
                    <img
                      src={profilePictureUrl}
                      alt={supervisor?.supervisorName || "Supervisor"}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover shadow-sm ring-2 ring-emerald-400"
                    />
                  ) : (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[#00b4eb] to-[#50b748] flex items-center justify-center font-bold text-xs sm:text-sm text-white shadow ring-2 ring-white/30">
                      {(supervisor?.supervisorName || "U")[0].toUpperCase()}
                    </div>
                  )}

                  <div className="hidden md:flex flex-col text-left leading-tight pr-1">
                    <span className="text-xs font-bold text-white max-w-[130px] truncate">
                      {supervisor?.supervisorName || "Supervisor"}
                    </span>
                    <span className="text-[10px] text-white/70 max-w-[130px] truncate">
                      {supervisor?.universityName || "University"}
                    </span>
                  </div>

                  <ChevronDown
                    className={`h-3.5 w-3.5 text-white/70 transition-transform ${
                      isProfileOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Profile & Logout Dropdown Menu */}
                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white text-slate-800 shadow-2xl border border-slate-200 overflow-hidden z-50"
                    >
                      {/* Dropdown Header with Profile Picture */}
                      <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex items-center gap-3">
                        {profilePictureUrl ? (
                          <img
                            src={profilePictureUrl}
                            alt={supervisor?.supervisorName || "Supervisor"}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500 shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#000066] to-[#006600] text-white flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0">
                            {(supervisor?.supervisorName || "U")[0].toUpperCase()}
                          </div>
                        )}

                        <div className="overflow-hidden">
                          <h4 className="font-bold text-sm text-slate-900 truncate">
                            {supervisor?.supervisorName || "University Supervisor"}
                          </h4>
                          <p className="text-xs text-slate-500 truncate">
                            {supervisor?.email || "Academic Supervisor"}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Authorized Supervisor
                          </span>
                        </div>
                      </div>

                      {/* University Details */}
                      <div className="p-3.5 space-y-2 text-xs border-b border-slate-100">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Building2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">
                            {supervisor?.universityName || "NSBM Green University"}
                          </span>
                        </div>
                        {supervisor?.department && (
                          <div className="flex items-center gap-2 text-slate-600 pl-6">
                            <span>Department: {supervisor.department}</span>
                          </div>
                        )}
                      </div>

                      {/* Dropdown Actions */}
                      <div className="p-2">
                        <button
                          onClick={() => {
                            setIsProfileOpen(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main White Page Body ─── */}
      {/* ─── Main White Page Body ─── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 select-none">
        
        {/* Header Section */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
                  <Building2 className="w-6 h-6" />
                </div>
                <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
                  University Dashboard
                </h1>
              </div>
              <p className="text-slate-500 font-medium ml-[52px]">
                {supervisor?.universityName || "University Supervision"} • {new Date().getFullYear()} Active Term
              </p>
            </div>
          </div>
        </div>

        {/* Selection & Search Section */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Specialization Filter */}
            <div className="space-y-2 md:col-span-1">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                Filter by Specialization
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Filter className="w-4 h-4" />
                </div>
                <select
                  value={selectedSpec}
                  onChange={(e) => setSelectedSpec(e.target.value)}
                  className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border-2 border-slate-200 text-slate-700 rounded-2xl font-medium focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="all">All Specializations ({students.length})</option>
                  {specializations.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec} ({students.filter((s) => s.fieldOfSpecialization === spec).length})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2 md:col-span-1">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                Filter by Status
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Filter className="w-4 h-4" />
                </div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border-2 border-slate-200 text-slate-700 rounded-2xl font-medium focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="all">All Statuses ({students.length})</option>
                  <option value="active">Active ({metrics.activeInterns})</option>
                  <option value="inactive">Inactive ({metrics.inactiveInterns})</option>
                  <option value="low_performers">Low Performers ({metrics.lowPerformers})</option>
                  {metrics.terminatedInterns > 0 && (
                    <option value="terminated">Terminated ({metrics.terminatedInterns})</option>
                  )}
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="space-y-2 md:col-span-1">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                Search Interns
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search name, ID, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 text-slate-700 rounded-2xl font-medium focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Data Display Section */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="w-16 h-16 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
              <p className="text-slate-500 font-bold">Loading university data...</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Summary Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                <MetricCard
                  title="Total Interns"
                  value={metrics.totalInterns}
                  icon={<FaUsers className="w-6 h-6" />}
                  colorClass="border-blue-500"
                  gradient="from-blue-500 to-indigo-600"
                  delay={0.1}
                  isActive={selectedStatus === "all"}
                  onClick={() => setSelectedStatus("all")}
                />
                <MetricCard
                  title="Active Interns"
                  value={metrics.activeInterns}
                  icon={<FaUserCheck className="w-6 h-6" />}
                  colorClass="border-emerald-500"
                  gradient="from-emerald-500 to-teal-600"
                  delay={0.2}
                  isActive={selectedStatus === "active"}
                  onClick={() => setSelectedStatus("active")}
                />
                <MetricCard
                  title="Inactive Interns"
                  value={metrics.inactiveInterns}
                  icon={<FaUserTimes className="w-6 h-6" />}
                  colorClass="border-amber-500"
                  gradient="from-amber-400 to-orange-500"
                  delay={0.3}
                  isActive={selectedStatus === "inactive"}
                  onClick={() => setSelectedStatus("inactive")}
                />
                <MetricCard
                  title="Low Performers"
                  value={metrics.lowPerformers}
                  icon={<FaExclamationTriangle className="w-6 h-6" />}
                  colorClass="border-rose-500"
                  gradient="from-rose-500 to-red-600"
                  delay={0.4}
                  isActive={selectedStatus === "low_performers"}
                  onClick={() => setSelectedStatus("low_performers")}
                />
              </div>

              {/* Interns List */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h2 className="text-xl font-bold text-slate-800">
                    Intern Roster
                  </h2>
                  <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold shadow-sm">
                    {filteredStudents.length} Results
                  </span>
                </div>
                
                <div className="p-4 sm:p-6 divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                      <FaSearch className="w-12 h-12 text-slate-200 mb-4" />
                      <p className="font-medium text-lg">No interns found matching your criteria.</p>
                    </div>
                  ) : (
                    filteredStudents.map((student, idx) => {
                      const specStr = (student.fieldOfSpecialization || "").toLowerCase();
                      const hideCommits = NO_COMMITS_ROLES.some(role => specStr.includes(role));

                      return (
                        <div key={student.id || idx} className="py-6 first:pt-2 last:pb-2 flex flex-col xl:flex-row gap-6 xl:items-center hover:bg-slate-50/50 transition-colors p-4 rounded-2xl cursor-pointer" onClick={() => navigate(`/university/student/${student.id}`, { state: { student } })}>
                          
                          {/* Profile Info Section */}
                          <div className="flex items-start gap-4 xl:w-2/5 min-w-[300px]">
                            {student.googlePictureUrl ? (
                              <img 
                                src={student.googlePictureUrl} 
                                alt={student.name} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  let original = student.googlePictureUrl || "";
                                  let highRes = original;
                                  if (highRes.includes("googleusercontent.com")) {
                                    highRes = highRes.replace(/=s\d+(-c)?/g, "=s800-c");
                                  }
                                  setIsLightboxFallback(false);
                                  setLightboxImage({ original, highRes });
                                }}
                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-sm border-2 border-white ring-2 ring-slate-100 shrink-0 cursor-pointer hover:scale-105 transition-transform" 
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
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Fullscreen Image Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-12 cursor-pointer"
          >
            <button 
              className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/50 p-2 rounded-full transition-colors z-50"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxImage(null);
              }}
            >
              <FaTimes className="w-6 h-6" />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={isLightboxFallback ? lightboxImage.original : lightboxImage.highRes}
              alt="Profile Fullscreen"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl ring-4 ring-white/10"
              onError={() => setIsLightboxFallback(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Footer ─── */}
      <footer
        className="text-white/80 py-4 mt-auto"
        style={{ background: "linear-gradient(135deg, #000066 0%, #006600 100%)" }}
      >
        <div className="px-4 sm:px-6 flex items-center justify-between gap-4">
          <p className="text-xs">© {new Date().getFullYear()} TalentHub . SLT Mobitel . All rights reserved.</p>
          <p className="text-xs text-white/60">TalentHub University Portal System</p>
        </div>
      </footer>
    </div>
  );
};

export default UniversityDashboard;
