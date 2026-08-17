import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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

const CircularProgressRing = ({
  percentage = 0,
  size = 54,
  strokeWidth = 4.5,
  trackColor = "#e2e8f0",
  strokeColor = "#2563eb",
  textColor = "text-blue-700",
  label = "",
  icon: Icon = null,
  iconColor = "text-blue-600",
}) => {
  const cleanPct = Math.min(100, Math.max(0, Number(percentage) || 0));
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - cleanPct / 100);

  let dynTrackColor = "#fee2e2";
  let dynStrokeColor = "#ef4444";
  let dynTextColor = "text-red-700";
  let dynIconColor = "text-red-600";

  if (cleanPct >= 75) {
    dynTrackColor = "#dbeafe";
    dynStrokeColor = "#3b82f6";
    dynTextColor = "text-blue-700";
    dynIconColor = "text-blue-600";
  } else if (cleanPct >= 50) {
    dynTrackColor = "#fef3c7";
    dynStrokeColor = "#f59e0b";
    dynTextColor = "text-amber-700";
    dynIconColor = "text-amber-600";
  }

  return (
    <div className="flex flex-col items-center justify-center gap-1 flex-1 min-w-0">
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <svg
          className="w-full h-full -rotate-90 transform"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={dynTrackColor}
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={dynStrokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[12px] font-black ${dynTextColor} tracking-tight`}>
            {cleanPct}%
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center mt-0.5">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </span>
        {Icon && <Icon className={`h-3 w-3 mt-0.5 ${dynIconColor}`} />}
      </div>
    </div>
  );
};

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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 select-none">
        {/* Welcome Header */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          {/* Top row: university badge + year tag */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] sm:text-xs font-bold border border-emerald-200 uppercase tracking-wide min-w-0">
              <Building2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">{supervisor?.universityName || "University Supervision"}</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-[10px] sm:text-xs font-bold border border-slate-200 shrink-0">
              <Calendar className="h-3 w-3 text-slate-500" />
              <span className="hidden xs:inline sm:inline">Active Term: </span>{new Date().getFullYear()}
            </span>
          </div>

          {/* Heading scales from xs to 3xl smoothly */}
          <h1 className="text-[clamp(1rem,4vw,1.875rem)] font-extrabold text-slate-900 tracking-tight leading-tight">
            Intern Supervision & Evaluation
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Monitoring internship progress, attendance and evaluation ratings for your students at SLT
          </p>
        </div>

        {/* ─── KPI Metrics Cards (Clickable Fast Filter Cards) ─── */}
        <div
          className={`grid gap-3 sm:gap-4 ${
            metrics.terminatedInterns > 0
              ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
              : "grid-cols-2 sm:grid-cols-4"
          }`}
        >
          {/* Total Interns */}
          <div
            onClick={() => setSelectedStatus("all")}
            className={`p-4 sm:p-5 rounded-2xl bg-white border shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
              selectedStatus === "all"
                ? "border-sky-500 ring-2 ring-sky-500/20 shadow-sky-100"
                : "border-slate-200/90 hover:border-sky-300"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Total Interns</span>
                <div className={`p-2 rounded-xl ${selectedStatus === "all" ? "bg-sky-500 text-white" : "bg-sky-50 text-sky-600"}`}>
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {metrics.totalInterns}
              </div>
            </div>
            <span className="text-[11px] text-slate-400 mt-2 block">All university interns</span>
          </div>

          {/* Active Interns */}
          <div
            onClick={() => setSelectedStatus("active")}
            className={`p-4 sm:p-5 rounded-2xl bg-white border shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
              selectedStatus === "active"
                ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-emerald-100"
                : "border-slate-200/90 hover:border-emerald-300"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Active Interns</span>
                <div className={`p-2 rounded-xl ${selectedStatus === "active" ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600"}`}>
                  <UserCheck className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
                {metrics.activeInterns}
              </div>
            </div>
            <span className="text-[11px] text-emerald-600/70 mt-2 block">Currently active in Interns</span>
          </div>

          {/* Inactive Interns */}
          <div
            onClick={() => setSelectedStatus("inactive")}
            className={`p-4 sm:p-5 rounded-2xl bg-white border shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
              selectedStatus === "inactive"
                ? "border-slate-600 ring-2 ring-slate-400/20 shadow-slate-100"
                : "border-slate-200/90 hover:border-slate-400"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Inactive Interns</span>
                <div className={`p-2 rounded-xl ${selectedStatus === "inactive" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600"}`}>
                  <UserX className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-700">
                {metrics.inactiveInterns}
              </div>
            </div>
            <span className="text-[11px] text-slate-400 mt-2 block">Completed / past interns</span>
          </div>

          {/* Low Performers */}
          <div
            onClick={() => setSelectedStatus("low_performers")}
            className={`p-4 sm:p-5 rounded-2xl bg-white border shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
              selectedStatus === "low_performers"
                ? "border-amber-500 ring-2 ring-amber-500/20 shadow-amber-100"
                : "border-slate-200/90 hover:border-amber-300"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Low Performers</span>
                <div className={`p-2 rounded-xl ${selectedStatus === "low_performers" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-600"}`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-600">
                {metrics.lowPerformers}
              </div>
            </div>
            <span className="text-[11px] text-amber-600/80 mt-2 block">Underperforming Interns</span>
          </div>

          {/* Terminated Interns - Render only if terminated count > 0 */}
          {metrics.terminatedInterns > 0 && (
            <div
              onClick={() => setSelectedStatus("terminated")}
              className={`col-span-2 sm:col-span-1 p-4 sm:p-5 rounded-2xl bg-white border shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                selectedStatus === "terminated"
                  ? "border-rose-500 ring-2 ring-rose-500/20 shadow-rose-100"
                  : "border-slate-200/90 hover:border-rose-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500">Terminated Interns</span>
                  <div className={`p-2 rounded-xl ${selectedStatus === "terminated" ? "bg-rose-500 text-white" : "bg-rose-50 text-rose-600"}`}>
                    <UserMinus className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-rose-600">
                  {metrics.terminatedInterns}
                </div>
              </div>
              <span className="text-[11px] text-rose-500/80 mt-2 block">Work & Disciplinary Issue Interns</span>
            </div>
          )}
        </div>

        {/* ─── Search & Instant Filter Toolbar ─── */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-3">
          {/* Mobile: stacked. sm+: search left | dropdowns right in one row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* LEFT: Search bar — grows to fill remaining space */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, ID, specialization..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-[#00b4eb] focus:ring-1 focus:ring-[#00b4eb]/20 focus:bg-white transition-all placeholder:text-slate-400 select-text cursor-text"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 hover:bg-slate-200 rounded-full p-1 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* RIGHT: 3 dropdowns — stacked on mobile, side-by-side on sm+ */}
            <div className="grid grid-cols-1 xs:grid-cols-3 sm:grid-cols-3 gap-2 sm:shrink-0">
              {/* Specialization Filter */}
              <select
                value={selectedSpec}
                onChange={(e) => setSelectedSpec(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-700 text-xs font-medium focus:outline-none focus:border-[#00b4eb] focus:ring-1 focus:ring-[#00b4eb]/20 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_10px_center] bg-[length:14px_14px] pr-8 select-none"
              >
                <option value="all">All Specializations ({students.length})</option>
                {specializations.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec} ({students.filter((s) => s.fieldOfSpecialization === spec).length})
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-700 text-xs font-medium focus:outline-none focus:border-[#00b4eb] focus:ring-1 focus:ring-[#00b4eb]/20 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_10px_center] bg-[length:14px_14px] pr-8 select-none"
              >
                <option value="all">All Statuses ({students.length})</option>
                <option value="active">Active ({metrics.activeInterns})</option>
                <option value="inactive">Inactive ({metrics.inactiveInterns})</option>
                <option value="low_performers">Low Performers ({metrics.lowPerformers})</option>
                {metrics.terminatedInterns > 0 && (
                  <option value="terminated">Terminated ({metrics.terminatedInterns})</option>
                )}
              </select>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-700 text-xs font-medium focus:outline-none focus:border-[#00b4eb] focus:ring-1 focus:ring-[#00b4eb]/20 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_10px_center] bg-[length:14px_14px] pr-8 select-none"
              >
                <option value="all">Overall Rate</option>
                <option value="daily_attendance">Daily Attendance</option>
                <option value="meeting_attendance">Meeting Attendance</option>
                <option value="quality">Work Quality</option>
                <option value="commits">GitHub Commits</option>
                <option value="logbooks">Logbooks Count</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing <strong>{filteredStudents.length}</strong> of{" "}
              <strong>{students.length}</strong> interns
            </span>
            {(searchQuery || selectedSpec !== "all" || selectedStatus !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedSpec("all");
                  setSelectedStatus("all");
                }}
                className="text-xs font-bold text-sky-600 hover:text-sky-800 cursor-pointer transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* ─── Student Cards Grid (Clean White Cards with Crisp Borders) ─── */}
        {loading ? (
          <div className="py-24 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-medium">
              Loading {supervisor?.universityName || "university"} intern records...
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-20 text-center rounded-2xl bg-white border border-slate-200 shadow-sm">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No interns found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No students match your current search or filter criteria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                className="rounded-2xl p-4 sm:p-5 bg-white hover:bg-slate-50/80 border border-slate-200/90 hover:border-emerald-500/50 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
                onClick={() => navigate(`/university/student/${student.id}`, { state: { student } })}
              >
                <div>
                  {/* Top Card Bar */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#000066] to-[#006600] flex items-center justify-center font-bold text-white text-sm shadow-md overflow-hidden flex-shrink-0">
                        <img 
                          src={`${API_BASE_URL}/interns/${student.id}/profile-picture`} 
                          alt={student.name} 
                          className="w-full h-full object-cover bg-white" 
                          onError={(e) => { e.target.src = student.googlePictureUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(student.name || 'Intern') + '&background=random' }} 
                        />
                      </div>

                      <div className="overflow-hidden">
                        <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                          {student.name}
                        </h3>
                        {/* ID Tag Row: All status, team, specialization and performance badges */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            ID: {student.traineeId}
                          </span>
                          {student.fieldOfSpecialization && (
                            <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                              {student.fieldOfSpecialization}
                            </span>
                          )}
                          {student.team &&
                            student.team.toLowerCase() !== "general" &&
                            student.team.toLowerCase() !== "n/a" &&
                            student.team.toLowerCase() !== "unassigned" && (
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                {student.team}
                              </span>
                            )}
                          {(student.isTerminated || student.logbookRestricted || student.status === "terminated") && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Terminated
                            </span>
                          )}
                          {!student.isTerminated && !student.logbookRestricted && student.status !== "terminated" && student.isInactive && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Inactive
                            </span>
                          )}
                          {(student.isLowPerformer || student.restrictionCount >= 2) && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 shadow-xs">
                              <AlertTriangle className="h-3 w-3 text-rose-600" />
                              Low Performer
                            </span>
                          )}
                          {!student.isLowPerformer && (student.restrictionCount === 1) && student.logbookRestricted && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              Restricted (1/2)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3 Circular Progress Rings (Daily Attendance, Meeting Attendance, Work Quality) */}
                  <div className="flex items-center justify-between gap-1.5 mb-4 p-3 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 shadow-xs">
                    <CircularProgressRing
                      percentage={student.dailyAttendanceRate ?? student.attendanceRate ?? 0}
                      size={54}
                      strokeWidth={4.5}
                      trackColor="#e0f2fe"
                      strokeColor="#2563eb"
                      textColor="text-blue-700"
                      label="Daily"
                      icon={ScanLine}
                      iconColor="text-blue-600"
                    />

                    <div className="w-[1px] h-10 bg-slate-200/90 shrink-0" />

                    <CircularProgressRing
                      percentage={student.meetingAttendanceRate ?? 0}
                      size={54}
                      strokeWidth={4.5}
                      trackColor="#ede9fe"
                      strokeColor="#7c3aed"
                      textColor="text-purple-700"
                      label="Meeting"
                      icon={Users}
                      iconColor="text-purple-600"
                    />

                    <div className="w-[1px] h-10 bg-slate-200/90 shrink-0" />

                    <CircularProgressRing
                      percentage={student.workQualityRate ?? student.qualityScore ?? 0}
                      size={54}
                      strokeWidth={4.5}
                      trackColor="#d1fae5"
                      strokeColor="#059669"
                      textColor="text-emerald-700"
                      label="Quality"
                      icon={Activity}
                      iconColor="text-emerald-600"
                    />
                  </div>

                  {/* Stats Row (Projects, Logbooks, Commits) */}
                  <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 pb-3 mb-3 border-b border-slate-100 text-center">
                    <div className="flex flex-col items-center p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                        <FolderGit2 className="h-3 w-3 text-purple-600" /> Projects
                      </div>
                      <span className="font-bold text-xs text-slate-800 mt-0.5">
                        {student.projectsCount ?? (student.enrolledProjects?.length || 0)}
                      </span>
                    </div>

                    <div className="flex flex-col items-center p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                        <BookOpen className="h-3 w-3 text-emerald-600" /> Logbooks
                      </div>
                      <span className="font-bold text-xs text-slate-800 mt-0.5">
                        {student.logbookCount ?? 0}
                      </span>
                    </div>

                    <div className="flex flex-col items-center p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                        <GitCommit className="h-3 w-3 text-sky-600" /> Commits
                      </div>
                      <span className="font-bold text-xs text-slate-800 mt-0.5">
                        {student.commitsCount ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/university/student/${student.id}`, { state: { student } }); }}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer select-none active:scale-[0.98]"
                >
                  <span>View Full Details</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

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
