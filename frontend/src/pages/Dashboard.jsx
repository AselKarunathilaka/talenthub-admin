import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import Navigation from "../components/Navigation";
import InternshipEndNotification from "../components/InternshipEndNotification";
import NoProjectNotification from "../components/NoProjectNotification";
import FaceRegistrationModal from "../components/FaceRegistrationModal";
import OnboardingTour from "../components/OnboardingTour";
import FeatureTipModal from "../components/FeatureTipModal";
import WhatsAppSupportButton from "../components/WhatsAppSupportButton";
import AnnouncementPopup from "../components/AnnouncementPopup";
import DailyRecordsHeatmap from "../components/DailyRecordsHeatmap";
import CommitHeatmap from "../components/CommitHeatmap";
import {
  Users,
  User,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  Clock,
  ChevronDown,
  QrCode,
  Camera,
  Folder,
  Bell,
  Mail,
  Building,
  Activity,
  GraduationCap,
  ClipboardList,
  BookOpen,
  BarChart2,
  GitCommit,
  TrendingUp,
  TrendingDown,
  Percent,
  PenTool,
  Star,
} from "lucide-react";
import { api } from "../utils/api";
import { formatDate } from "../utils/formatDate";
import { calculateInternshipEndNotification } from "../utils/internshipNotification";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, API_ENDPOINTS } from "../api/apiConfig";
import {
  isNoCommitSpecialization,
  calcWorkingDays as calcWorkingDaysUtil,
  calcElapsedWeeks as calcElapsedWeeksUtil,
  calcDailyAttendanceRate,
  calcMeetingAttendanceRate,
  calcLogbookRate,
  calcPerformanceRate,
  getPerformanceStatus,
  getMondayWeekKey,
  toDateStr,
} from "../utils/analyticsCalculations";

const getPerformanceColors = (percentage) => {
  const cleanPct = Math.min(100, Math.max(0, Number(percentage) || 0));
  if (cleanPct >= 75) {
    return { track: "#dbeafe", stroke: "#3b82f6", text: "#1d4ed8" }; // blue
  } else if (cleanPct >= 50) {
    return { track: "#fef3c7", stroke: "#f59e0b", text: "#d97706" }; // amber
  }
  return { track: "#fee2e2", stroke: "#ef4444", text: "#dc2626" }; // red
};

const Dashboard = ({ previewInternId = null, isPreview = false }) => {
  const effectiveInternId = previewInternId || localStorage.getItem("internId");

  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    absent: 0,
  });
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [filteredAttendance, setFilteredAttendance] = useState([]);
  const [meetingAttendance, setMeetingAttendance] = useState([]);
  const [filteredMeetingAttendance, setFilteredMeetingAttendance] = useState(
    [],
  );
  const [dailyRecords, setDailyRecords] = useState([]);
  const [dailyAttendanceStats, setDailyAttendanceStats] = useState({
    present: 0,
    absent: 0,
  });
  const [commitsCount, setCommitsCount] = useState(0);
  const [logbooksCount, setLogbooksCount] = useState(0);
  const [logbookRecords, setLogbookRecords] = useState([]);
  const [recordCounts, setRecordCounts] = useState(null);
  const [gitCommitsData, setGitCommitsData] = useState(null);
  const [activeTab, setActiveTab] = useState("daily");
  const [heatmapView, setHeatmapView] = useState("logbook");
  const [universityFeedbacks, setUniversityFeedbacks] = useState([]);
  const [showCricketPopup, setShowCricketPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [expandedMeetingDates, setExpandedMeetingDates] = useState({});
  const [error, setError] = useState(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [internData, setInternData] = useState(null);
  const [internProjects, setInternProjects] = useState([]);
  const [endDateNotification, setEndDateNotification] = useState(null);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [projectPopupPending, setProjectPopupPending] = useState(false);
  const [showNoProjectPopup, setShowNoProjectPopup] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [isNewIntern, setIsNewIntern] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const rowsPerPage = 10;
  const initialLoadStartedRef = useRef(false);
  const faceModalOpenRef = useRef(false);
  const navigate = useNavigate();
  const cricketRegistrationLink =
    "https://linktr.ee/CricketFiestaRegistrationLinks";
  const cricketPosterUrl = "/images/cricket-fiesta-poster.jpg";

  const loadInternData = async () => {
    try {
      const internId = effectiveInternId;

      if (!internId) {
        throw new Error("Authentication error: missing internId");
      }

      const response = await api.get(`/interns/${internId}`);

      if (response) {
        setInternData(response);
        if (response.records && Array.isArray(response.records)) {
          setLogbooksCount(response.records.length);
          setLogbookRecords(response.records);
        }
        if (typeof response.commitsCount === "number") {
          setCommitsCount((prev) => prev || response.commitsCount);
        } else if (Array.isArray(response.gitCommits)) {
          setCommitsCount((prev) => prev || response.gitCommits.length);
        }

        // Check if internship end date notification should be shown
        if (response.Training_EndDate) {
          const notification = calculateInternshipEndNotification(
            response.Training_EndDate,
          );

          let shouldShow = notification.shouldNotify;
          const lastDismissedStr = localStorage.getItem(
            "internshipEndDismissedDate",
          );
          if (shouldShow && lastDismissedStr) {
            const lastDismissed = new Date(lastDismissedStr);
            const today = new Date();
            if (lastDismissed.toDateString() === today.toDateString()) {
              shouldShow = false;
            }
          }

          if (shouldShow) {
              setEndDateNotification(notification);
          } else {
            setEndDateNotification(null);
          }
        }
        return response; // Return data so loadAllData can use it directly
      } else {
        throw new Error("No intern data returned from API");
      }
    } catch (err) {
      console.error("Error fetching intern data:", err);
      // Don't show error for intern data as it's not critical for attendance functionality
      return null;
    }
  };

  const loadAttendanceData = async () => {
    try {
      const internId = effectiveInternId;

      if (!internId) {
        throw new Error("Authentication error: missing internId");
      }

      const response = await api.get(`/interns/attendance/${internId}`);

      if (response) {

        // Set daily attendance (for the Daily Attendance section)
        const dailyAttendanceData =
          response.dailyAttendance ||
          response.attendance?.filter((entry) => !entry.isMeeting) ||
          [];
        setAttendanceHistory(dailyAttendanceData);
        setFilteredAttendance(dailyAttendanceData);
        setDailyRecords(dailyAttendanceData);

        // Set meeting attendance (for the Attendance History section)
        const meetingAttendanceData =
          response.meetingAttendance ||
          response.attendance?.filter((entry) => entry.isMeeting) ||
          [];
        setMeetingAttendance(meetingAttendanceData);
        setFilteredMeetingAttendance(meetingAttendanceData);

        const meetingDateKey = (entry) => {
          const date = entry.date ? new Date(entry.date) : null;
          return date && !Number.isNaN(date.getTime())
            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
            : String(entry.date || "");
        };
        const meetingPresentCount = meetingAttendanceData.filter(
          (entry) => entry.status === "Present",
        ).length;
        const meetingAbsentCount = meetingAttendanceData.filter(
          (entry) => entry.status === "Absent",
        ).length;

        setAttendanceStats({
          present: meetingPresentCount,
          absent: meetingAbsentCount,
        });
        // Set daily attendance stats based on the daily attendance data
        setDailyAttendanceStats({
          present: dailyAttendanceData.filter((entry) => {
            const s = (entry.status || "").toLowerCase();
            return s === "present" || s === "late";
          }).length,
          absent: dailyAttendanceData.filter((entry) => {
            const s = (entry.status || "").toLowerCase();
            return s === "absent";
          }).length,
        });
      } else {
        throw new Error("No data returned from API");
      }
    } catch (err) {
      console.error("Error fetching attendance data:", err);
      setError("Error fetching attendance data.");
      if (!navigator.onLine || err.message.includes("network")) {
        setIsNetworkError(true);
      } else {
        toast.error("An error occurred while fetching the attendance data.");
      }
    }
  };

  const loadGitCommitsData = async () => {
    try {
      const internId = effectiveInternId;
      if (!internId) return;
      const data = await api.get(`/interns/${internId}/git-commits`);
      if (data) {
        setGitCommitsData(data);
        if (data.totalCommits !== undefined) {
          setCommitsCount(data.totalCommits);
        } else {
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
          setCommitsCount(all.length);
        }
      }
    } catch (error) {
      console.error("Error fetching git commits:", error);
    }
  };

  const checkFaceEnrollment = async () => {
    try {
      const data = await api.get("/face-attendance/profile");
      return Boolean(data.profile && data.profile.isActive);
    } catch (error) {
      console.error("Error checking face enrollment:", error);
      return true;
    }
  };

  const loadLogbooksData = async () => {
    try {
      const internId = effectiveInternId;
      if (internId) {
        let records = [];
        try {
          const res = await api.get(`/interns/${internId}`);
          if (res && Array.isArray(res.records)) {
            records = res.records;
          }
        } catch {}

        if (!records.length) {
          try {
            const data = await api.get("/records");
            if (Array.isArray(data)) {
              records = data;
            }
          } catch {}
        }

        if (records.length > 0) {
          setLogbooksCount(records.length);
          setLogbookRecords(records);
        }
      }
    } catch (error) {
      console.error("Error fetching logbooks count:", error);
    }
  };

  const loadUniversityFeedbacks = async () => {
    try {
      const internId = effectiveInternId;
      if (!internId) return;
      const data = await api.get(`/interns/${internId}/university-feedback`);
      if (data && Array.isArray(data.feedbacks)) {
        setUniversityFeedbacks(data.feedbacks);
      }
    } catch (error) {
      console.error("Error fetching university feedbacks:", error);
    }
  };

  const loadHolidays = async () => {
    try {
      const year = new Date().getFullYear();
      const res = await fetch(`${API_BASE_URL}/holidays/${year}`);
      if (res.ok) {
        const data = await res.json();
        setHolidays(Array.isArray(data) ? data : (data.holidays || []));
      }
    } catch (err) {
      console.error("Error fetching holidays:", err);
    }
  };

  const loadRecordCounts = async () => {
    try {
      const internId = effectiveInternId;
      if (!internId) return;
      let data = null;
      try {
        data = await api.get(`/interns/${internId}/record-counts`);
      } catch {
        try {
          data = await api.get(`/admin/intern/${internId}/record-counts`);
        } catch {
          data = null;
        }
      }
      if (data) {
        setRecordCounts(data);
      }
    } catch (err) {
      console.error("Error fetching record counts:", err);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    const [fetchedInternData] = await Promise.all([
      loadInternData(), // Load intern details including end date
      loadAttendanceData(), // Load attendance data
      loadGitCommitsData(), // Load git commits data
      loadLogbooksData(), // Load actual logbooks count
      loadRecordCounts(), // Load direct collection counts
      loadUniversityFeedbacks(), // Load university supervisor feedbacks
      loadHolidays(), // Load holidays
    ]);
    setLoading(false);

    const internId = effectiveInternId;

    // Always fetch projects (needed for both intern and admin preview)
    try {
      if (internId) {
        const projectCheck = await api.get(
          `/interns/${internId}/projects/check`,
        );
        if (projectCheck?.projects) {
          setInternProjects(projectCheck.projects);
        }
        if (!isPreview) {
          const hasProject =
            projectCheck?.hasProject === true ||
            (Array.isArray(projectCheck?.projects) &&
              projectCheck.projects.length > 0);
          if (projectCheck && !hasProject) {
            if (faceModalOpenRef.current) {
              setProjectPopupPending(true);
            } else {
              setShowNoProjectPopup(true);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error checking intern projects:", err);
    }

    if (!isPreview) {
      const shouldPromptFace = Boolean(
        internId && !(await checkFaceEnrollment()),
      );

      if (shouldPromptFace) {
        faceModalOpenRef.current = true;
        setShowFaceModal(true);
      }

      // Show onboarding tour after all other modals are settled
      try {
        if (internId && fetchedInternData) {
          const TOUR_VERSION = "v1.0-initial";
          const seenVersion = fetchedInternData.tourSeenVersion ?? null;
          if (seenVersion === null || seenVersion !== TOUR_VERSION) {
            const isNew = seenVersion === null;
            setIsNewIntern(isNew);
            if (!shouldPromptFace) {
              setShowTour(true);
            }
          }
        }
      } catch (err) {
        // Non-critical
      }
    }
  };

  useEffect(() => {
    if (!isPreview) {
      const internId = localStorage.getItem("internId");
      if (!internId) {
        navigate("/");
      }
    }
  }, [navigate, isPreview]);

  useEffect(() => {
    if (isPreview) return;
    const deadline = new Date("2025-12-31T23:59:59");
    const now = new Date();
    const dismissedUntil = localStorage.getItem("cricketFiestaDismissed");

    if (now <= deadline && dismissedUntil !== "2025-12-31") {
      setShowCricketPopup(true);
    }
  }, [isPreview]);

  useEffect(() => {
    loadAllData();
  }, [effectiveInternId]);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("internId");
    localStorage.removeItem("userData");
    navigate("/");
  };

  const closeFaceRegistration = () => {
    faceModalOpenRef.current = false;
    setShowFaceModal(false);
    if (projectPopupPending) {
      setProjectPopupPending(false);
      setShowNoProjectPopup(true);
    }
    // Show tour after face modal closes (if applicable)
    if (internData) {
      const seenVersion = internData.tourSeenVersion ?? null;
      const TOUR_VERSION = "v1.0-initial";
      if (seenVersion === null || seenVersion !== TOUR_VERSION) {
        setIsNewIntern(seenVersion === null);
        setShowTour(true);
      }
    }
  };

  // Meeting attendance rate: weeks attended ÷ total weeks (Training_StartDate to Training_EndDate)
  const presentPercentage = (() => {
    if (!internData?.Training_StartDate) return 0;

    // Count unique weeks where intern attended at least one meeting
    const meetingDateKey = (entry) => {
      const date = entry.date ? new Date(entry.date) : null;
      if (!date || isNaN(date.getTime())) return null;
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(new Date(d).setDate(diff));
      return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    };

    const weeksPresent = new Set(
      meetingAttendance
        .filter((e) => e.status === "Present" && e.date)
        .map((entry) => {
          const d = new Date(entry.date);
          if (isNaN(d.getTime())) return null;
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(new Date(d).setDate(diff));
          return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
        })
        .filter(Boolean),
    ).size;

    const start = new Date(internData.Training_StartDate);
    const end = internData?.Training_EndDate
      ? new Date(internData.Training_EndDate)
      : null;
    const now = new Date();
    const measureTo = now;
    if (isNaN(start) || measureTo <= start) return 0;
    const weeksHeld = Math.max(
      1,
      Math.ceil((measureTo - start) / (1000 * 60 * 60 * 24 * 7)),
    );
    return Math.min(100, Math.round((weeksPresent / weeksHeld) * 100));
  })();

  const handleDateSelection = (date) => {
    setSelectedDate(date);

    if (date) {
      const dateString = new Date(date).toLocaleDateString();
      const foundMeetingEntries = meetingAttendance.filter(
        (entry) => new Date(entry.date).toLocaleDateString() === dateString,
      );

      if (foundMeetingEntries.length > 0) {
        setFilteredMeetingAttendance(foundMeetingEntries);
      } else {
        toast.error("No meeting attendance records found for this day.");
        setFilteredMeetingAttendance([]);
      }
    } else {
      // Reset to show all meeting attendance
      setFilteredMeetingAttendance(meetingAttendance);
    }
  };

  const handleFilterByStatus = (status) => {
    setFilterStatus(status);

    if (status === "All") {
      setFilteredMeetingAttendance(meetingAttendance);
    } else {
      // Meeting attendance is always "Present", so no filtering needed for meetings
      setFilteredMeetingAttendance(meetingAttendance);
    }
    setCurrentPage(1);
  };

  const getMeetingDateGroups = () => {
    const groups = new Map();

    filteredMeetingAttendance.forEach((entry) => {
      let date;
      try {
        date = entry.date ? new Date(entry.date) : new Date();
        if (Number.isNaN(date.getTime())) {
          throw new Error("Invalid date");
        }
      } catch {
        date = null;
      }

      const dateKey = date
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        : String(entry.date || "unknown");
      const fallbackLabel = entry.date || "N/A";
      const group = groups.get(dateKey) || {
        dateKey,
        formattedDate: date
          ? date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
          : fallbackLabel,
        dayName: date
          ? date.toLocaleDateString("en-US", { weekday: "short" })
          : "N/A",
        dateNumber: date ? date.getDate() : "-",
        meetings: [],
      };

      group.meetings.push(entry);
      groups.set(dateKey, group);
    });

    return Array.from(groups.values());
  };

  const toggleMeetingDate = (dateKey) => {
    setExpandedMeetingDates((current) => ({
      ...current,
      [dateKey]: !current[dateKey],
    }));
  };

  const getMeetingMethodMeta = (method) => {
    const normalizedMethod = String(method || "")
      .toLowerCase()
      .trim();

    // Face recognition - handles both raw and normalized values
    if (
      normalizedMethod === "face recognition" ||
      normalizedMethod === "face" ||
      normalizedMethod === "face_meeting"
    ) {
      return {
        label: "Face",
        className: "bg-indigo-50 text-indigo-700 border-indigo-100",
        Icon: Camera,
      };
    }

    // QR - handles both raw and normalized values
    if (
      normalizedMethod === "qr" ||
      normalizedMethod === "daily_qr" ||
      normalizedMethod === "meeting"
    ) {
      return {
        label: "QR",
        className: "bg-purple-50 text-purple-700 border-purple-100",
        Icon: QrCode,
      };
    }
    // Logbook - auto-marked when intern submits their daily logbook entry
    if (normalizedMethod === "daily") {
      return {
        label: "Logbook",
        className: "bg-teal-50 text-teal-700 border-teal-100",
        Icon: ClipboardList,
      };
    }

    // Manual - admin manually marked attendance
    if (
      normalizedMethod === "manual" ||
      normalizedMethod === "manual_meeting" ||
      normalizedMethod === "manual_daily"
    ) {
      return {
        label: "Manual",
        className: "bg-amber-50 text-amber-700 border-amber-100",
        Icon: PenTool,
      };
    }

    return {
      label: "Unknown",
      className: "bg-gray-50 text-gray-600 border-gray-100",
      Icon: Clock,
    };
  };


  // ── Synced Metrics Calculations (Exact match with AdminInternDetails & AdminAnalytics) ──
  const workingDays = useMemo(() => {
    const startDateVal = internData?.Training_StartDate || internData?.startDate;
    if (!startDateVal) return 1;
    const now = new Date();
    const holidaySet = new Set((holidays || []).map((h) => (typeof h === "string" ? h : h.date)));
    return calcWorkingDaysUtil(startDateVal, now, holidaySet);
  }, [internData, holidays]);

  const elapsedWeeks = useMemo(() => {
    const startDateVal = internData?.Training_StartDate || internData?.startDate;
    if (!startDateVal) return 0;
    const now = new Date();
    return calcElapsedWeeksUtil(startDateVal, now);
  }, [internData]);

  const attendedDaysCount = useMemo(() => {
    const startDateVal = internData?.Training_StartDate || internData?.startDate;
    const startDStr = toDateStr(startDateVal);
    const todayDStr = toDateStr(new Date());
    const records = attendanceHistory.length > 0 ? attendanceHistory : dailyRecords;
    const holidaySet = new Set((holidays || []).map((h) => (typeof h === "string" ? h : h.date)));
    return new Set(
      records
        .filter((r) => {
          if (!r.date) return false;
          const s = (r.status || "").toLowerCase();
          const isPresent = s === "present" || s === "late" || !r.status;
          if (!isPresent) return false;
          const dStr = toDateStr(r.date); // Colombo YYYY-MM-DD
          if (!dStr) return false;
          if (startDStr && dStr < startDStr) return false;
          if (todayDStr && dStr > todayDStr) return false;
          const dow = new Date(dStr + "T12:00:00Z").getUTCDay();
          const isWeekend = dow === 0 || dow === 6;
          const isHoliday = holidaySet.has(dStr);
          return !isWeekend && !isHoliday;
        })
        .map((r) => toDateStr(r.date))
        .filter(Boolean)
    ).size;
  }, [internData, attendanceHistory, dailyRecords, holidays]);

  const dailyAttendanceRate = useMemo(() => {
    const startDateVal = internData?.Training_StartDate || internData?.startDate;
    if (!startDateVal) return 0;
    return calcDailyAttendanceRate(attendedDaysCount, workingDays);
  }, [internData, attendedDaysCount, workingDays]);

  const attendedMeetingWeeksCount = useMemo(() => {
    const startDateVal = internData?.Training_StartDate || internData?.startDate;
    const startMonKey = getMondayWeekKey(startDateVal);
    const todayMonKey = getMondayWeekKey(new Date());
    const holidaySet = new Set((holidays || []).map((h) => (typeof h === "string" ? h : h.date)));
    const isWorkingDay = (dateVal) => {
      if (!dateVal) return false;
      const dStr = toDateStr(dateVal);
      if (!dStr) return false;
      const dow = new Date(dStr + "T12:00:00Z").getUTCDay();
      return dow !== 0 && dow !== 6 && !holidaySet.has(dStr);
    };

    return new Set(
      (meetingAttendance || [])
        .filter((r) => {
          const s = (r.status || "").toLowerCase();
          const isPresent = s === "present" || s === "late" || !r.status;
          if (!isPresent || !r.date || !isWorkingDay(r.date)) return false;
          const wKey = getMondayWeekKey(r.date);
          if (!wKey) return false;
          if (startMonKey && wKey < startMonKey) return false;
          if (todayMonKey && wKey >= todayMonKey) return false;
          return true;
        })
        .map((r) => getMondayWeekKey(r.date))
        .filter(Boolean)
    ).size;
  }, [internData, meetingAttendance, holidays]);

  const meetingAttendanceRate = useMemo(() => {
    const startDateVal = internData?.Training_StartDate || internData?.startDate;
    if (!startDateVal) return 0;
    return calcMeetingAttendanceRate(attendedMeetingWeeksCount, elapsedWeeks);
  }, [internData, attendedMeetingWeeksCount, elapsedWeeks]);

  const validLogbookCount = useMemo(() => {
    const startDateVal = internData?.Training_StartDate || internData?.startDate;
    const startDStr = toDateStr(startDateVal);
    const todayDStr = toDateStr(new Date());
    const holidaySet = new Set((holidays || []).map((h) => (typeof h === "string" ? h : h.date)));
    // Use actual logbook records (DailyRecord entries) — same source as AdminInternDetails
    // Falls back to daily attendance records if logbook records not yet loaded
    const records = logbookRecords.length > 0 ? logbookRecords : (dailyRecords.length > 0 ? dailyRecords : attendanceHistory);
    return records.filter((r) => {
      if (!r.date) return false;
      const status = (r.status || r.recordStatus || "working").toLowerCase();
      if (status === "leave" || status === "study_leave") return false;
      const dStr = toDateStr(r.date);
      if (!dStr) return false;
      if (startDStr && dStr < startDStr) return false;
      if (todayDStr && dStr > todayDStr) return false;
      const dow = new Date(dStr + "T12:00:00Z").getUTCDay();
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = holidaySet.has(dStr);
      return !isWeekend && !isHoliday;
    }).length;
  }, [internData, logbookRecords, dailyRecords, attendanceHistory, holidays]);

  const logbookRate = useMemo(() => {
    const startDateVal = internData?.Training_StartDate || internData?.startDate;
    if (!startDateVal) return 0;
    return calcLogbookRate(validLogbookCount, workingDays);
  }, [internData, validLogbookCount, workingDays]);

  const performanceRate = useMemo(() => {
    const startDateVal = internData?.Training_StartDate || internData?.startDate;
    if (!startDateVal) return 0;
    const spec = internData?.field_of_spec_name || internData?.fieldOfSpecialization || internData?.specialization || "";
    return calcPerformanceRate({
      logbookRate,
      meetingAttendanceRate,
      commitsCount,
      workingDays,
      specialization: spec,
    });
  }, [internData, logbookRate, meetingAttendanceRate, commitsCount, workingDays]);

  const workQualityRate = performanceRate;

  const totalDailyCount =
    recordCounts?.totalDailyAttendance ?? (attendanceHistory || []).length;
  const totalMeetingCount =
    recordCounts?.totalMeetingAttendance ?? (meetingAttendance || []).length;
  const totalLogbookCount =
    recordCounts?.totalLogbook ??
    (logbookRecords.length > 0 ? logbookRecords.length : logbooksCount);

  const [expandedGroups, setExpandedGroups] = useState({});
  const toggleGroup = (dateKey) => {
    setExpandedGroups((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  // Live countdown timer (ticks every second)
  const [countdownTime, setCountdownTime] = useState(null);
  useEffect(() => {
    if (!internData?.Training_EndDate) return;
    const endDate = new Date(internData.Training_EndDate);
    const tick = () => {
      const msLeft = endDate - new Date();
      if (msLeft <= 0) {
        setCountdownTime(null);
        return;
      }
      const days = Math.floor(msLeft / (1000 * 60 * 60 * 24));
      const hours = Math.floor((msLeft / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((msLeft / (1000 * 60)) % 60);
      const secs = Math.floor((msLeft / 1000) % 60);
      setCountdownTime({ days, hours, mins, secs });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [internData?.Training_EndDate]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-500 font-medium">Loading your dashboard...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-white rounded-3xl p-8 max-w-lg mx-auto mt-12 text-center border border-red-100 shadow-sm">
          {isNetworkError ? (
            <>
              <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Connection Error</h3>
              <p className="text-gray-500 mb-6">Unable to connect to the server. Please check your connection and try again.</p>
            </>
          ) : (
            <p className="text-gray-500 mb-6">Error: {error}</p>
          )}
          <button onClick={() => window.location.reload()} className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 transition">
            Retry Connection
          </button>
        </div>
      );
    }

    const lastSeenDate = internData?.updatedAt
      ? new Date(internData.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : null;

    const traineeId = effectiveInternId;
    const profilePicUrl = traineeId
      ? `${API_BASE_URL}${API_ENDPOINTS.INTERNS.LIST}/${traineeId}/profile-picture`
      : "";

    return (
      <div className="bento-container">
        <InternshipEndNotification
          notification={endDateNotification}
          onDismiss={() => {
            setEndDateNotification(null);
            localStorage.setItem("internshipEndDismissedDate", new Date().toISOString());
          }}
        />

        {/* ===== Beautiful Hero Banner ===== */}
        <motion.div
          className="hero-banner-card relative w-full rounded-3xl overflow-hidden mb-8 shadow-2xl bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] border border-slate-700/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          {/* Decorative Glows */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl mix-blend-screen" />
            <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl mix-blend-screen" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(0,180,235,0.05)_0%,transparent_60%)]" />
          </div>

          {/* Support Button */}
          <div className="absolute top-3 right-3 xs:top-4 xs:right-4 xm:top-4 xm:right-4 sm:top-6 sm:right-6 z-20 scale-[0.75] xs:scale-[0.85] xm:scale-[0.9] sm:scale-100 origin-top-right">
            <WhatsAppSupportButton size="sm" className="shadow-lg hover:scale-105 border border-[#25D366]/30" />
          </div>

          <div className="relative z-10 px-3 pt-10 pb-4 xs:px-5 xs:pt-12 xs:pb-5 xm:px-6 xm:pt-12 xm:pb-5 sm:px-10 sm:py-10 flex flex-row items-end min-h-[130px] xs:min-h-[150px] sm:min-h-0 gap-2.5 xs:gap-4 xm:gap-5 sm:gap-8">

            {/* Profile Picture */}
            <div className="relative group flex-shrink-0">
              <div className="w-14 h-14 xs:w-18 xs:h-18 xm:w-20 xm:h-20 sm:w-28 sm:h-28 rounded-lg xs:rounded-xl xm:rounded-2xl sm:rounded-3xl overflow-hidden border-[2px] xs:border-[3px] border-white/10 shadow-2xl bg-gradient-to-br from-[#00b4eb] to-indigo-600 flex items-center justify-center" style={{width: 'clamp(62px, 18vw, 112px)', height: 'clamp(62px, 18vw, 112px)'}}>
                <img
                  src={profilePicUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                />
                <div className="hidden w-full h-full items-center justify-center font-black text-white" style={{fontSize: 'clamp(16px, 4.5vw, 36px)'}}>
                  {(internData?.Trainee_Name || internData?.name) ? (internData?.Trainee_Name || internData?.name).charAt(0).toUpperCase() : "U"}
                </div>
              </div>
              <div className="absolute bg-emerald-500 rounded-full border-[#1e293b] shadow-lg flex items-center justify-center" style={{width: 'clamp(15px, 4.2vw, 28px)', height: 'clamp(15px, 4.2vw, 28px)', borderWidth: 'clamp(2px, 0.6vw, 4px)', bottom: 'clamp(-2px, -0.5vw, -8px)', right: 'clamp(-2px, -0.5vw, -8px)'}} title="Active">
                <div className="bg-white rounded-full animate-pulse" style={{width: 'clamp(6px, 1.8vw, 8px)', height: 'clamp(6px, 1.8vw, 8px)'}} />
              </div>
            </div>

            {/* Main Info */}
            <div className="flex-1 text-left flex flex-col justify-end min-w-0 pr-2 xs:pr-4 mb-1">
              <span className="text-blue-300/80 font-bold uppercase tracking-widest block truncate" style={{fontSize: 'clamp(8px, 2.2vw, 12px)', marginBottom: 'clamp(2px, 0.5vw, 6px)'}}>
                Welcome Back
              </span>
              <h1 className="font-extrabold text-white tracking-tight drop-shadow-md leading-tight" style={{fontSize: 'clamp(15px, 4.2vw, 31px)', marginBottom: 'clamp(4px, 1vw, 12px)', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                {(internData?.Trainee_Name || internData?.name) || "User"}
              </h1>

              <div className="flex flex-nowrap items-center justify-start overflow-hidden" style={{gap: 'clamp(3px, 1vw, 12px)'}}>
                <span className="flex items-center whitespace-nowrap rounded bg-white/10 text-white border border-white/10 backdrop-blur-md font-semibold shadow-sm" style={{gap: 'clamp(2px, 0.8vw, 6px)', padding: 'clamp(2px, 0.5vw, 6px) clamp(4px, 1.2vw, 12px)', fontSize: 'clamp(10px, 2.5vw, 13px)', borderRadius: 'clamp(4px, 1vw, 12px)'}}>
                  <User className="text-[#00b4eb] shrink-0" style={{width: 'clamp(12px, 2.8vw, 14px)', height: 'clamp(12px, 2.8vw, 14px)'}} />
                  {internData?.Trainee_ID || internData?.internId || "ID Not Assigned"}
                </span>

                {countdownTime?.days > 0 ? (
                  <span className="hidden sm:flex items-center whitespace-nowrap text-blue-100 border border-blue-500/30 backdrop-blur-md font-semibold shadow-sm" style={{gap: 'clamp(2px, 0.8vw, 6px)', padding: 'clamp(2px, 0.5vw, 6px) clamp(4px, 1.2vw, 12px)', fontSize: 'clamp(10px, 2.5vw, 13px)', borderRadius: 'clamp(4px, 1vw, 12px)', background: 'rgba(59,130,246,0.2)'}}>
                    <Calendar className="text-blue-400 shrink-0" style={{width: 'clamp(12px, 2.8vw, 14px)', height: 'clamp(12px, 2.8vw, 14px)'}} />
                    {countdownTime.days} Days Left
                  </span>
                ) : internData?.Training_Status === "Ended" ? (
                  <span className="hidden sm:flex items-center whitespace-nowrap text-red-200 border border-red-500/30 backdrop-blur-md font-semibold" style={{gap: 'clamp(2px, 0.8vw, 6px)', padding: 'clamp(2px, 0.5vw, 6px) clamp(4px, 1.2vw, 12px)', fontSize: 'clamp(10px, 2.5vw, 13px)', borderRadius: 'clamp(4px, 1vw, 12px)', background: 'rgba(239,68,68,0.2)'}}>
                    Training Ended
                  </span>
                ) : null}

                {lastSeenDate && (
                  <span className="flex items-center whitespace-nowrap text-slate-300 border border-white/5 backdrop-blur-md font-semibold" style={{gap: 'clamp(2px, 0.8vw, 6px)', padding: 'clamp(2px, 0.5vw, 6px) clamp(4px, 1.2vw, 12px)', fontSize: 'clamp(10px, 2.5vw, 13px)', borderRadius: 'clamp(4px, 1vw, 12px)', background: 'rgba(255,255,255,0.05)'}}>
                    <Clock className="text-slate-400 shrink-0" style={{width: 'clamp(12px, 2.8vw, 14px)', height: 'clamp(12px, 2.8vw, 14px)'}} />
                    Last seen: {lastSeenDate}
                  </span>
                )}
              </div>
            </div>

          </div>
        </motion.div>

        {/* ===== Bento Grid ===== */}
        <div className="bento-grid">

          {/* === Row 1: Info Cards === */}

          {/* Tile 1 – Personal Information */}
          <div className="bento-card bento-card--info">
            <div className="bento-card-header">
              <h2 className="bento-card-title" style={{ fontSize: 15 }}>
                <div className="bento-card-icon bento-card-icon--indigo" style={{ width: 32, height: 32 }}><User size={16} /></div>
                Personal Information
              </h2>
            </div>
            <div className="bento-card-body" style={{ gap: 14 }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Name</p>
                <p className="text-sm font-semibold text-gray-900">{internData?.Trainee_Name || internData?.name || "Not specified"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Email</p>
                <p className="text-sm font-medium text-gray-800 break-all">{internData?.Trainee_Email || "Not specified"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Institute</p>
                <p className="text-sm font-medium text-gray-800">{internData?.Institute || "Not specified"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Specialization</p>
                <p className="text-sm font-medium text-gray-800">{internData?.field_of_spec_name || "Not specified"}</p>
              </div>
            </div>
          </div>

          {/* Tile 1b – Training Period */}
          <div className="bento-card bento-card--info flex flex-col">
            <div className="bento-card-header">
              <h2 className="bento-card-title" style={{ fontSize: 15 }}>
                <div className="bento-card-icon bento-card-icon--emerald" style={{ width: 32, height: 32 }}><Calendar size={16} /></div>
                Training Period
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", flex: 1 }}>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Start Date</p>
                <p className="text-sm font-semibold text-slate-800">{internData?.Training_StartDate ? formatDate(internData.Training_StartDate) : "N/A"}</p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">End Date</p>
                <p className="text-sm font-semibold text-slate-800">{internData?.Training_EndDate ? formatDate(internData.Training_EndDate) : "N/A"}</p>
              </div>
              {internData?.Training_StartDate && internData?.Training_EndDate && (() => {
                const start = new Date(internData.Training_StartDate);
                const end = new Date(internData.Training_EndDate);
                const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                const weeks = Math.floor(totalDays / 7);
                const remainingDays = totalDays % 7;
                const msLeft = end - new Date();
                const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
                const hoursLeft = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const isEnded = msLeft <= 0;
                return (
                  <>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Duration</p>
                      <p className="text-sm font-semibold text-slate-800">{weeks}w {remainingDays}d</p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Status</p>
                      <p className={`text-sm font-bold ${!isEnded ? "text-emerald-600" : "text-red-600"}`}>{!isEnded ? `${daysLeft}d left` : "Ended"}</p>
                    </div>
                    <div className="col-span-2 mt-1">
                      {countdownTime ? (
                        <div style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)", border: "1px solid #a7f3d0", borderRadius: 12, padding: "10px 10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                          <div style={{ textAlign: "center", minWidth: 40 }}>
                            <p style={{ fontSize: 'clamp(13px, 4vw, 20px)', fontWeight: 900, color: "#059669", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{String(countdownTime.days).padStart(2, "0")}</p>
                            <p style={{ fontSize: 9, fontWeight: 700, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 2 }}>Days</p>
                          </div>
                          <div style={{ width: 1, height: 26, background: "#a7f3d0" }} />
                          <div style={{ textAlign: "center", minWidth: 40 }}>
                            <p style={{ fontSize: 'clamp(13px, 4vw, 20px)', fontWeight: 900, color: "#059669", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{String(countdownTime.hours).padStart(2, "0")}</p>
                            <p style={{ fontSize: 9, fontWeight: 700, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 2 }}>Hrs</p>
                          </div>
                          <div style={{ width: 1, height: 26, background: "#a7f3d0" }} />
                          <div style={{ textAlign: "center", minWidth: 40 }}>
                            <p style={{ fontSize: 'clamp(13px, 4vw, 20px)', fontWeight: 900, color: "#059669", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{String(countdownTime.mins).padStart(2, "0")}</p>
                            <p style={{ fontSize: 9, fontWeight: 700, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 2 }}>Mins</p>
                          </div>
                          <div style={{ width: 1, height: 26, background: "#a7f3d0" }} />
                          <div style={{ textAlign: "center", minWidth: 40 }}>
                            <p style={{ fontSize: 'clamp(13px, 4vw, 20px)', fontWeight: 900, color: "#059669", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{String(countdownTime.secs).padStart(2, "0")}</p>
                            <p style={{ fontSize: 9, fontWeight: 700, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 2 }}>Secs</p>
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "10px 14px", textAlign: "center" }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>Internship Ended</p>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Tile 1c – Project Assignments */}
          <div className="bento-card bento-card--info flex flex-col">
            <div className="bento-card-header">
              <h2 className="bento-card-title" style={{ fontSize: 15 }}>
                <div className="bento-card-icon bento-card-icon--blue" style={{ width: 32, height: 32 }}><Folder size={16} /></div>
                Project Assignments
              </h2>
            </div>
            <div className="bento-card-body overflow-y-auto flex-1 pr-2 custom-scrollbar">
              {internProjects && internProjects.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {internProjects.map((proj, pi) => (
                    <div key={pi} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", minHeight: 52 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb", flexShrink: 0 }}>
                        <Folder size={16} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.projectName}</p>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", margin: 0, marginTop: 2 }}>{proj.status ? proj.status.replace(/_/g, " ") : "N/A"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-5 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Folder className="w-7 h-7 text-slate-300 mb-1.5" />
                  <p className="text-xs font-medium text-slate-500">No projects assigned</p>
                </div>
              )}
            </div>
          </div>

          {/* Tile 1b2 – Attendance Rates (Compact) */}
          <div className="bento-card bento-card--half flex flex-col" style={{ containerType: "inline-size" }}>
            <div className="bento-card-header">
              <h2 className="bento-card-title" style={{ fontSize: 15 }}>
                <div className="bento-card-icon bento-card-icon--purple" style={{ width: 32, height: 32 }}><Activity size={16} /></div>
                Attendance & Performance Rates
              </h2>
            </div>
            <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center", flex: 1, paddingBottom: 8, flexWrap: "nowrap", minWidth: 0, width: "100%" }}>

              {/* Daily Ring */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                <div className="att-ring-wrap" style={{ position: "relative", width: "100%", maxWidth: 130, aspectRatio: "1 / 1" }}>
                  <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block", transform: "rotate(-90deg)" }}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke={getPerformanceColors(dailyAttendanceRate).track} strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={getPerformanceColors(dailyAttendanceRate).stroke} strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 42}`} strokeDashoffset={`${2 * Math.PI * 42 * (1 - dailyAttendanceRate / 100)}`}
                      style={{ transition: "stroke-dashoffset 1.6s ease" }} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 'clamp(9px, 3.5cqw, 24px)', fontWeight: 900, color: getPerformanceColors(dailyAttendanceRate).text, lineHeight: 1 }}>{dailyAttendanceRate}%</span>
                  </div>
                </div>
                <span style={{ fontSize: 'clamp(7px, 1.8cqw, 11px)', fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.2 }}>Daily<br /> Attendance</span>
              </div>

              {/* Divider */}
              <div style={{ width: 1, alignSelf: "stretch", background: "#e2e8f0", flexShrink: 0, margin: "12px 0" }} />

              {/* Meeting Ring */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                <div className="att-ring-wrap" style={{ position: "relative", width: "100%", maxWidth: 130, aspectRatio: "1 / 1" }}>
                  <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block", transform: "rotate(-90deg)" }}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke={getPerformanceColors(meetingAttendanceRate).track} strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={getPerformanceColors(meetingAttendanceRate).stroke} strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 42}`} strokeDashoffset={`${2 * Math.PI * 42 * (1 - meetingAttendanceRate / 100)}`}
                      style={{ transition: "stroke-dashoffset 1.6s ease" }} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 'clamp(9px, 3.5cqw, 24px)', fontWeight: 900, color: getPerformanceColors(meetingAttendanceRate).text, lineHeight: 1 }}>{meetingAttendanceRate}%</span>
                  </div>
                </div>
                <span style={{ fontSize: 'clamp(7px, 1.8cqw, 11px)', fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.2 }}>Meeting<br /> Attendance</span>
              </div>

              {/* Divider */}
              <div style={{ width: 1, alignSelf: "stretch", background: "#e2e8f0", flexShrink: 0, margin: "12px 0" }} />

              {/* Work Quality */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                <div className="att-ring-wrap" style={{ position: "relative", width: "100%", maxWidth: 130, aspectRatio: "1 / 1" }}>
                  <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block", transform: "rotate(-90deg)" }}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke={workQualityRate >= 75 ? "#dbeafe" : workQualityRate >= 50 ? "#fef08a" : "#fecaca"} strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={workQualityRate >= 75 ? "#3b82f6" : workQualityRate >= 50 ? "#eab308" : "#ef4444"} strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 42}`} strokeDashoffset={`${2 * Math.PI * 42 * (1 - workQualityRate / 100)}`}
                      style={{ transition: "stroke-dashoffset 1.6s ease" }} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 'clamp(9px, 3.5cqw, 24px)', fontWeight: 900, color: workQualityRate >= 75 ? "#2563eb" : workQualityRate >= 50 ? "#ca8a04" : "#dc2626", lineHeight: 1 }}>{workQualityRate}%</span>
                  </div>
                </div>
                <span style={{ fontSize: 'clamp(7px, 1.8cqw, 11px)', fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.2 }}>Work<br /> Performance</span>
              </div>

            </div>
          </div>


          {/* === Row 3: Recent Activity (wide) === */}
          <div className="bento-card bento-card--half flex flex-col">
            <div className="bento-card-header">
              <h2 className="bento-card-title">
                <div className="bento-card-icon bento-card-icon--purple"><Activity size={18} /></div>
                Recent Activity
              </h2>
            </div>
            <div className="bento-card-body flex-1">
              {(() => {
                const merged = [
                  ...(filteredAttendance || []).map(a => ({ ...a, activityType: 'Daily Logbook', icon: <Building size={11} /> })),
                  ...(meetingAttendance || []).map(a => ({ ...a, activityType: 'Meeting', icon: <Users size={11} /> }))
                ].sort((a, b) => new Date(b.date) - new Date(a.date));

                return merged && merged.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {merged.slice(0, 3).map((entry, idx) => {
                      const d = new Date(entry.date);
                      const isPresent = entry.status === "Present";
                      const isMeeting = entry.activityType === "Meeting";
                      return (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", minHeight: 52 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: isMeeting ? "#ede9fe" : "#dbeafe", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: isMeeting ? "#7c3aed" : "#2563eb", lineHeight: 1 }}>{d.toLocaleString("en-US", { month: "short" })}</span>
                            <span style={{ fontSize: 14, fontWeight: 900, color: isMeeting ? "#6d28d9" : "#1d4ed8", lineHeight: 1, marginTop: 1 }}>{d.getDate()}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", margin: 0 }}>{entry.activityType}</p>
                            <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", margin: 0, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                              {entry.icon} {entry.checkInTime || entry.time || "N/A"}
                            </p>
                          </div>
                          <span style={{ padding: "3px 9px", borderRadius: 7, fontSize: 10, fontWeight: 700, flexShrink: 0, background: isPresent ? "#dcfce7" : "#fee2e2", color: isPresent ? "#15803d" : "#dc2626" }}>
                            {entry.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-6 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <Activity size={24} className="mb-2 opacity-40" />
                    <span className="text-xs font-medium">No recent activity</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ===== Deep Dive Content Container ===== */}
        <div style={{ display: "flex", flexDirection: "column", gap: 'clamp(12px, 3vw, 24px)', marginTop: 'clamp(16px, 4vw, 32px)' }}>

          {/* ══ Intern Valid Submissions & Attendance Overview Cards ══ */}
          {(() => {
            const internSpec =
              internData?.field_of_spec_name ||
              internData?.fieldOfSpecialization ||
              internData?.specialization ||
              "";
            const isNoCommitRole = isNoCommitSpecialization(internSpec);

            return (
              <motion.div
                className="w-full"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${isNoCommitRole ? 'xl:grid-cols-5' : 'xl:grid-cols-6'} gap-4`}>
                  {/* 1. Working Days */}
                  <motion.div
                    className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between"
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="absolute right-2 top-2 opacity-10">
                      <Calendar size={80} />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                          <Calendar className="text-white w-4 h-4" />
                        </span>
                        <span className="text-xs font-bold tracking-wider uppercase text-slate-200">
                          Working Days
                        </span>
                      </div>
                      <h4 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">
                        {workingDays}
                      </h4>
                      <p className="text-[11px] text-slate-300">
                        Total Working Days
                      </p>
                    </div>
                  </motion.div>

                  {/* 2. Expected Meetings */}
                  <motion.div
                    className="bg-gradient-to-br from-cyan-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between"
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="absolute right-2 top-2 opacity-10">
                      <Users size={80} />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                          <Users className="text-white w-4 h-4" />
                        </span>
                        <span className="text-xs font-bold tracking-wider uppercase text-cyan-100">
                          Expected Meetings
                        </span>
                      </div>
                      <h4 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">
                        {elapsedWeeks}
                      </h4>
                      <p className="text-[11px] text-cyan-100">
                        Total Expected Weeks
                      </p>
                    </div>
                  </motion.div>

                  {/* 3. Daily Attendance */}
                  <motion.div
                    className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between"
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="absolute right-2 top-2 opacity-10">
                      <CheckCircle size={80} />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                          <CheckCircle className="text-white w-4 h-4" />
                        </span>
                        <span className="text-xs font-bold tracking-wider uppercase text-blue-100">
                          Daily Attendance
                        </span>
                      </div>
                      <h4 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">
                        {attendedDaysCount}
                      </h4>
                      <p className="text-[11px] text-blue-100">
                        Valid Submissions
                      </p>
                    </div>
                  </motion.div>

                  {/* 4. Meeting Attendance */}
                  <motion.div
                    className="bg-gradient-to-br from-purple-500 to-indigo-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between"
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="absolute right-2 top-2 opacity-10">
                      <Users size={80} />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                          <Users className="text-white w-4 h-4" />
                        </span>
                        <span className="text-xs font-bold tracking-wider uppercase text-purple-100">
                          Meeting Attendance
                        </span>
                      </div>
                      <h4 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">
                        {attendedMeetingWeeksCount}
                      </h4>
                      <p className="text-[11px] text-purple-100">
                        Valid Submissions
                      </p>
                    </div>
                  </motion.div>

                  {/* 5. Logbook Records */}
                  <motion.div
                    className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between"
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="absolute right-2 top-2 opacity-10">
                      <BookOpen size={80} />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                          <BookOpen className="text-white w-4 h-4" />
                        </span>
                        <span className="text-xs font-bold tracking-wider uppercase text-emerald-100">
                          Logbook Records
                        </span>
                      </div>
                      <h4 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">
                        {validLogbookCount}
                      </h4>
                      <p className="text-[11px] text-emerald-100">
                        Valid Submissions
                      </p>
                    </div>
                  </motion.div>

                  {/* 6. Git Commits */}
                  {!isNoCommitRole && (
                    <motion.div
                      className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between"
                      whileHover={{ y: -3 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="absolute right-2 top-2 opacity-10">
                        <GitCommit size={80} />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                            <GitCommit className="text-white w-4 h-4" />
                          </span>
                          <span className="text-xs font-bold tracking-wider uppercase text-amber-100">
                            Git Commits
                          </span>
                        </div>
                        <h4 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">
                          {commitsCount}
                        </h4>
                        <p className="text-[11px] text-amber-100">
                          Valid Submissions
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })()}

          {/* ── Logbook / Commits Section ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 'clamp(12px, 3vw, 20px)', padding: 'clamp(12px, 3vw, 20px) 0' }}>
          {/* Heatmap External Toggle */}
          <div className="w-full max-w-[400px] mx-auto px-4">
            <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 w-full relative">
              <button
                onClick={() => setHeatmapView("logbook")}
                className={`relative z-10 flex-1 py-2.5 px-4 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                  heatmapView === "logbook"
                    ? "text-white"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <BookOpen size={16} className="shrink-0" />
                <span className="truncate">Logbook</span>
              </button>
              <button
                onClick={() => setHeatmapView("commits")}
                className={`relative z-10 flex-1 py-2.5 px-4 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                  heatmapView === "commits"
                    ? "text-white"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <GitCommit size={16} className="shrink-0" />
                <span className="truncate">Commits</span>
              </button>
              <div
                className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-300 ease-out shadow-md"
                style={{
                  background:
                    heatmapView === "logbook"
                      ? "linear-gradient(135deg, #50b748 0%, #2e7d32 100%)"
                      : "linear-gradient(135deg, #00b4eb 0%, #0056a2 100%)",
                  left: heatmapView === "logbook" ? "6px" : "calc(50%)",
                }}
              />
            </div>
          </div>

          {/* Heatmap Card */}
          <div className="bento-deep-content" style={{ margin: 0 }}>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <h3 style={{ fontSize: 'clamp(16px, 4vw, 22px)', fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
                    {heatmapView === "logbook" ? "Daily Logbook Activity Heatmap" : "GitHub Code Commit Activity Heatmap"}
                  </h3>
                  <p style={{ fontSize: 'clamp(11px, 3vw, 13px)', color: "#64748b", margin: 0 }}>
                    {heatmapView === "logbook"
                      ? "Visualize your daily logbook submissions throughout your internship"
                      : "Visualize your GitHub code commits across assigned projects"}
                  </p>
                </div>
                {heatmapView === "commits" && gitCommitsData?.githubUsername && (
                  <span className="text-xs font-mono text-slate-600 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                    GitHub: @{gitCommitsData.githubUsername}
                  </span>
                )}
              </div>
              {heatmapView === "logbook" ? (
                <DailyRecordsHeatmap
                  startDate={internData?.Training_StartDate}
                  endDate={internData?.Training_EndDate}
                  records={logbookRecords}
                />
              ) : (
                <CommitHeatmap
                  startDate={internData?.Training_StartDate}
                  endDate={internData?.Training_EndDate}
                  internId={effectiveInternId}
                  commitData={gitCommitsData}
                />
              )}
            </motion.div>
          </div>

          </div>{/* end logbook section */}

          {/* ── Daily / Meeting Attendance Section ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 'clamp(12px, 3vw, 20px)', paddingTop: 'clamp(4px, 1vw, 8px)', paddingBottom: 'clamp(12px, 3vw, 20px)' }}>
          {/* ── Beautiful External Toggle ── */}
          <div className="w-full max-w-[400px] mx-auto px-4">
            <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 w-full relative">
              <button
                onClick={() => setActiveTab("daily")}
                className={`relative z-10 flex-1 py-2.5 px-4 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                  activeTab === "daily"
                    ? "text-white"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <BookOpen size={16} className="shrink-0" />
                <span className="truncate">Daily<span className="hidden sm:inline"> Attendance</span></span>
              </button>
              <button
                onClick={() => setActiveTab("meeting")}
                className={`relative z-10 flex-1 py-2.5 px-4 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                  activeTab === "meeting"
                    ? "text-white"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Users size={16} className="shrink-0" />
                <span className="truncate">Meeting<span className="hidden sm:inline"> Attendance</span></span>
              </button>
              <div
                className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-300 ease-out shadow-md"
                style={{
                  background:
                    activeTab === "daily"
                      ? "linear-gradient(135deg, #50b748 0%, #2e7d32 100%)"
                      : "linear-gradient(135deg, #00b4eb 0%, #0056a2 100%)",
                  left: activeTab === "daily" ? "6px" : "calc(50%)",
                }}
              />
            </div>
          </div>

          {/* Tables Card */}
          <div className="bento-deep-content" style={{ margin: 0 }}>
            <AnimatePresence mode="wait">
              {activeTab === "daily" && (
                <motion.div key="daily" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                  <div className="flex flex-col lg:flex-row justify-between items-center lg:items-end mb-6 gap-6 text-center lg:text-left">
                    <div>
                      <h3 className="text-[15px] xs:text-[17px] xm:text-[18px] sm:text-xl font-extrabold" style={{ color: "#0f172a", marginBottom: 4 }}>Daily Attendance History</h3>
                      <p className="text-[10px] xs:text-[11px] xm:text-xs sm:text-sm" style={{ color: "#64748b", margin: 0 }}>Your detailed daily attendance records</p>
                    </div>
                    <div className="flex flex-row flex-nowrap justify-center gap-1 xs:gap-1.5 xm:gap-2 sm:gap-3 w-full lg:w-auto">
                      <div className="flex flex-row items-center gap-1 xs:gap-1.5 xm:gap-2 sm:gap-3 px-1.5 py-1 xs:px-2 xs:py-1.5 xm:px-3 xm:py-2 sm:px-4 sm:py-2.5 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-[6px] xs:rounded-lg sm:rounded-xl border border-emerald-200 flex-1 sm:flex-none">
                        <div className="w-4 h-4 xs:w-5 xs:h-5 xm:w-6 xm:h-6 sm:w-8 sm:h-8 rounded-[4px] xs:rounded-md sm:rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-2.5 h-2.5 xs:w-3 xs:h-3 xm:w-3.5 xm:h-3.5 sm:w-4 sm:h-4" color="#fff" />
                        </div>
                        <div className="text-left">
                          <p className="text-[7px] xs:text-[8px] xm:text-[9px] sm:text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider m-0">Present</p>
                          <p className="text-[10px] xs:text-[11px] xm:text-xs sm:text-lg font-black text-emerald-900 m-0 leading-none">{attendedDaysCount}</p>
                        </div>
                      </div>
                      <div className="flex flex-row items-center gap-1 xs:gap-1.5 xm:gap-2 sm:gap-3 px-1.5 py-1 xs:px-2 xs:py-1.5 xm:px-3 xm:py-2 sm:px-4 sm:py-2.5 bg-gradient-to-br from-rose-50 to-rose-100 rounded-[6px] xs:rounded-lg sm:rounded-xl border border-rose-200 flex-1 sm:flex-none">
                        <div className="w-4 h-4 xs:w-5 xs:h-5 xm:w-6 xm:h-6 sm:w-8 sm:h-8 rounded-[4px] xs:rounded-md sm:rounded-lg bg-rose-500 flex items-center justify-center shrink-0">
                          <TrendingDown className="w-2.5 h-2.5 xs:w-3 xs:h-3 xm:w-3.5 xm:h-3.5 sm:w-4 sm:h-4" color="#fff" />
                        </div>
                        <div className="text-left">
                          <p className="text-[7px] xs:text-[8px] xm:text-[9px] sm:text-[10px] font-extrabold text-rose-600 uppercase tracking-wider m-0">Absent</p>
                          <p className="text-[10px] xs:text-[11px] xm:text-xs sm:text-lg font-black text-rose-900 m-0 leading-none">{Math.max(0, workingDays - attendedDaysCount)}</p>
                        </div>
                      </div>
                      <div className="flex flex-row items-center gap-1 xs:gap-1.5 xm:gap-2 sm:gap-3 px-1.5 py-1 xs:px-2 xs:py-1.5 xm:px-3 xm:py-2 sm:px-4 sm:py-2.5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-[6px] xs:rounded-lg sm:rounded-xl border border-blue-200 flex-1 sm:flex-none">
                        <div className="w-4 h-4 xs:w-5 xs:h-5 xm:w-6 xm:h-6 sm:w-8 sm:h-8 rounded-[4px] xs:rounded-md sm:rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                          <Percent className="w-2.5 h-2.5 xs:w-3 xs:h-3 xm:w-3.5 xm:h-3.5 sm:w-4 sm:h-4" color="#fff" />
                        </div>
                        <div className="text-left">
                          <p className="text-[7px] xs:text-[8px] xm:text-[9px] sm:text-[10px] font-extrabold text-blue-600 uppercase tracking-wider m-0">Rate</p>
                          <p className="text-[10px] xs:text-[11px] xm:text-xs sm:text-lg font-black text-blue-900 m-0 leading-none">{dailyAttendanceRate}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {filteredAttendance && filteredAttendance.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto overflow-y-auto touch-pan-x touch-pan-y overscroll-x-contain overscroll-y-auto no-scrollbar max-h-[242px] sm:max-h-[320px]">
                        <table className="w-max sm:w-full mx-auto border-collapse" style={{ tableLayout: "auto" }}>
                          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr className="border-b border-slate-200 text-slate-500 text-[9px] sm:text-xs uppercase tracking-wider font-bold">
                              <th className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center whitespace-nowrap">Date</th>
                              <th className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center whitespace-nowrap">Check In</th>
                              <th className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center whitespace-nowrap">Check Out</th>
                              <th className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center whitespace-nowrap">Method</th>
                              <th className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center whitespace-nowrap">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {filteredAttendance.map((entry, idx) => {
                              let date, dayName, formattedDate, dateNumber;
                              try {
                                const rawDateStr = String(entry.date || "");
                                if (rawDateStr.includes("-")) {
                                  const parts = rawDateStr.slice(0, 10).split("-").map(Number);
                                  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
                                    date = new Date(parts[0], parts[1] - 1, parts[2]);
                                  } else { date = new Date(entry.date); }
                                } else { date = new Date(entry.date); }
                                dayName = date.toLocaleDateString("en-US", { weekday: "short" });
                                formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                                dateNumber = date.getDate();
                              } catch (error) { dayName = "N/A"; formattedDate = entry.date || "N/A"; dateNumber = "-"; }
                              const methodMeta = getMeetingMethodMeta(entry.attendanceMethod || entry.method || entry.markedBy || entry.type);
                              const MethodIcon = methodMeta.Icon;
                              const isPresent = entry.status === "Present";
                              return (
                                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center">
                                    <div className="flex items-center justify-center">
                                      <span className="font-semibold text-slate-800 text-[10px] sm:text-xs">{formattedDate}</span>
                                    </div>
                                  </td>
                                  <td className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center">
                                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 text-slate-600 text-[10px] sm:text-xs font-medium">
                                      {entry.checkInTime || entry.time ? (
                                        <><Clock size={11} className="text-emerald-500 shrink-0 hidden sm:block" /> {entry.checkInTime || entry.time}</>
                                      ) : <span className="text-slate-400">—</span>}
                                    </div>
                                  </td>
                                  <td className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center">
                                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 text-slate-600 text-[10px] sm:text-xs font-medium">
                                      {entry.checkOutTime ? (
                                        <><Clock size={11} className="text-amber-500 shrink-0 hidden sm:block" /> {entry.checkOutTime}</>
                                      ) : <span className="text-slate-400">—</span>}
                                    </div>
                                  </td>
                                  <td className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center">
                                    <span className={`inline-flex items-center justify-center gap-0.5 sm:gap-1.5 px-0.5 sm:px-2 sm:px-2 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-xs font-bold ${methodMeta.className}`} title={methodMeta.label}>
                                      <MethodIcon size={12} className="shrink-0" />
                                      <span className="hidden sm:inline">{methodMeta.label}</span>
                                    </span>
                                  </td>
                                  <td className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center">
                                    <span className={`inline-flex px-1 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-xs font-bold ${isPresent ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                                      {entry.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>No daily attendance records found</div>
                  )}
                </motion.div>
              )}

              {activeTab === "meeting" && (
                <motion.div key="meeting" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                  <div className="flex flex-col lg:flex-row justify-between items-center lg:items-end mb-3 xs:mb-4 xm:mb-5 sm:mb-6 gap-3 xs:gap-4 sm:gap-6 text-center lg:text-left">
                    <div>
                      <h3 className="text-[15px] xs:text-[17px] xm:text-[18px] sm:text-xl font-extrabold" style={{ color: "#0f172a", marginBottom: 4 }}>Meeting Attendance History</h3>
                      <p className="text-[10px] xs:text-[11px] xm:text-xs sm:text-sm" style={{ color: "#64748b", margin: 0 }}>Your detailed meeting attendance records</p>
                    </div>
                    <div className="flex flex-row flex-nowrap justify-center gap-1 xs:gap-1.5 xm:gap-2 sm:gap-3 w-full lg:w-auto">
                      <div className="flex flex-row items-center gap-1 xs:gap-1.5 xm:gap-2 sm:gap-3 px-1.5 py-1 xs:px-2 xs:py-1.5 xm:px-3 xm:py-2 sm:px-4 sm:py-2.5 bg-gradient-to-br from-violet-50 to-violet-100 rounded-[6px] xs:rounded-lg sm:rounded-xl border border-violet-200 flex-1 sm:flex-none">
                        <div className="w-4 h-4 xs:w-5 xs:h-5 xm:w-6 xm:h-6 sm:w-8 sm:h-8 rounded-[4px] xs:rounded-md sm:rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-2.5 h-2.5 xs:w-3 xs:h-3 xm:w-3.5 xm:h-3.5 sm:w-4 sm:h-4" color="#fff" />
                        </div>
                        <div className="text-left">
                          <p className="text-[7px] xs:text-[8px] xm:text-[9px] sm:text-[10px] font-extrabold text-violet-600 uppercase tracking-wider m-0">Present</p>
                          <p className="text-[10px] xs:text-[11px] xm:text-xs sm:text-lg font-black text-violet-900 m-0 leading-none">{attendedMeetingWeeksCount}</p>
                        </div>
                      </div>
                      <div className="flex flex-row items-center gap-1 xs:gap-1.5 xm:gap-2 sm:gap-3 px-1.5 py-1 xs:px-2 xs:py-1.5 xm:px-3 xm:py-2 sm:px-4 sm:py-2.5 bg-gradient-to-br from-rose-50 to-rose-100 rounded-[6px] xs:rounded-lg sm:rounded-xl border border-rose-200 flex-1 sm:flex-none">
                        <div className="w-4 h-4 xs:w-5 xs:h-5 xm:w-6 xm:h-6 sm:w-8 sm:h-8 rounded-[4px] xs:rounded-md sm:rounded-lg bg-rose-500 flex items-center justify-center shrink-0">
                          <TrendingDown className="w-2.5 h-2.5 xs:w-3 xs:h-3 xm:w-3.5 xm:h-3.5 sm:w-4 sm:h-4" color="#fff" />
                        </div>
                        <div className="text-left">
                          <p className="text-[7px] xs:text-[8px] xm:text-[9px] sm:text-[10px] font-extrabold text-rose-600 uppercase tracking-wider m-0">Absent</p>
                          <p className="text-[10px] xs:text-[11px] xm:text-xs sm:text-lg font-black text-rose-900 m-0 leading-none">{Math.max(0, elapsedWeeks - attendedMeetingWeeksCount)}</p>
                        </div>
                      </div>
                      <div className="flex flex-row items-center gap-1 xs:gap-1.5 xm:gap-2 sm:gap-3 px-1.5 py-1 xs:px-2 xs:py-1.5 xm:px-3 xm:py-2 sm:px-4 sm:py-2.5 bg-gradient-to-br from-purple-50 to-purple-100 rounded-[6px] xs:rounded-lg sm:rounded-xl border border-purple-200 flex-1 sm:flex-none">
                        <div className="w-4 h-4 xs:w-5 xs:h-5 xm:w-6 xm:h-6 sm:w-8 sm:h-8 rounded-[4px] xs:rounded-md sm:rounded-lg bg-purple-500 flex items-center justify-center shrink-0">
                          <Percent className="w-2.5 h-2.5 xs:w-3 xs:h-3 xm:w-3.5 xm:h-3.5 sm:w-4 sm:h-4" color="#fff" />
                        </div>
                        <div className="text-left">
                          <p className="text-[7px] xs:text-[8px] xm:text-[9px] sm:text-[10px] font-extrabold text-purple-600 uppercase tracking-wider m-0">Rate</p>
                          <p className="text-[10px] xs:text-[11px] xm:text-xs sm:text-lg font-black text-purple-900 m-0 leading-none">{meetingAttendanceRate}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {filteredMeetingAttendance && filteredMeetingAttendance.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto overflow-y-auto touch-pan-x touch-pan-y overscroll-x-contain overscroll-y-auto no-scrollbar max-h-[242px] sm:max-h-[320px]">
                        <table className="w-max sm:w-full mx-auto border-collapse" style={{ tableLayout: "auto" }}>
                          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr className="border-b border-slate-200 text-slate-500 text-[9px] sm:text-xs uppercase tracking-wider font-bold">
                              <th className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center whitespace-nowrap">Date</th>
                              <th className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center">Meeting Name</th>
                              <th className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center whitespace-nowrap">Time</th>
                              <th className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center whitespace-nowrap">Method</th>
                              <th className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center whitespace-nowrap">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {filteredMeetingAttendance.map((entry, idx) => {
                              const d = new Date(entry.date);
                              const isPresent = entry.status === "Present";
                              const methodMeta = getMeetingMethodMeta(entry.attendanceMethod || entry.method || entry.markedBy || entry.type);
                              const MethodIcon = methodMeta.Icon;
                              return (
                                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center">
                                    <div className="flex items-center justify-center">
                                      <span className="font-semibold text-slate-800 text-[10px] sm:text-xs">
                                        {`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center text-[10px] sm:text-sm font-semibold text-slate-800 break-words">
                                    {entry.meetingName || entry.type || "Meeting"}
                                  </td>
                                  <td className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center">
                                    <div className="flex items-center justify-center gap-0.5 sm:gap-1 text-slate-600 text-[10px] sm:text-xs font-medium">
                                      <Clock size={11} className="text-slate-400 shrink-0 hidden sm:block" />
                                      {entry.checkInTime || entry.time || "N/A"}
                                    </div>
                                  </td>
                                  <td className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center">
                                    <span className={`inline-flex items-center justify-center gap-0.5 sm:gap-1.5 px-0.5 sm:px-2 sm:px-2 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-xs font-bold ${methodMeta.className}`} title={methodMeta.label}>
                                      <MethodIcon size={12} className="shrink-0" />
                                      <span className="hidden sm:inline">{methodMeta.label}</span>
                                    </span>
                                  </td>
                                  <td className="px-0.5 sm:px-4 py-2 sm:py-3.5 text-center">
                                    <span className={`inline-flex px-1 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-xs font-bold ${isPresent ? "bg-indigo-100 text-indigo-700" : "bg-rose-100 text-rose-700"}`}>
                                      {entry.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>No meeting attendance records found</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>{/* end attendance section */}
        </div>{/* end deep dive container */}

        {/* ===== University Supervisor Feedback Section ===== */}
        {universityFeedbacks && universityFeedbacks.length > 0 && (
          <div style={{ marginTop: 'clamp(20px, 4vw, 36px)' }}>
            <div className="bento-card" style={{ padding: 'clamp(18px, 3vw, 28px)' }}>
              <div className="bento-card-header" style={{ marginBottom: 16 }}>
                <h2 className="bento-card-title" style={{ fontSize: 'clamp(15px, 3vw, 18px)' }}>
                  <div className="bento-card-icon" style={{ width: 34, height: 34, background: "linear-gradient(135deg, rgba(80, 183, 72, 0.15) 0%, rgba(0, 180, 235, 0.15) 100%)", color: "#2e7d32" }}>
                    <GraduationCap size={18} />
                  </div>
                  University Supervisor Feedback
                </h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {universityFeedbacks.length} Feedback{universityFeedbacks.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {universityFeedbacks.map((fb, idx) => (
                  <div
                    key={fb._id || idx}
                    className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                  >
                    <div>
                      {/* Header: Supervisor details & Rating */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#50b748] to-[#00b4eb] text-white font-black text-sm flex items-center justify-center shadow-sm shrink-0 overflow-hidden border border-slate-200">
                            {fb.picture || fb.supervisorPicture ? (
                              <img
                                src={fb.picture || fb.supervisorPicture}
                                alt={fb.supervisorName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                                }}
                              />
                            ) : null}
                            <span style={{ display: fb.picture || fb.supervisorPicture ? "none" : "flex" }} className="w-full h-full items-center justify-center">
                              {(fb.supervisorName || "U")[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-sm font-extrabold text-slate-800 leading-tight">
                              {fb.supervisorName}
                            </h4>
                            <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                              <Building size={12} className="shrink-0" />
                              <span className="truncate">{fb.universityName || internData?.Institute || "University"}</span>
                            </p>
                          </div>
                        </div>

                        {/* Star Rating Badge */}
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 shrink-0">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={12}
                                className={star <= (fb.rating || 5) ? "text-amber-400 fill-amber-400" : "text-slate-200"}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-black text-amber-700 ml-1">
                            {fb.rating || 5}.0
                          </span>
                        </div>
                      </div>

                      {/* Comment */}
                      <div className="relative pl-3.5 border-l-2 border-emerald-400 my-3">
                        <p className="text-xs text-slate-600 leading-relaxed italic">
                          "{fb.comment}"
                        </p>
                      </div>

                      {/* Tags */}
                      {Array.isArray(fb.tags) && fb.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {fb.tags.map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/60"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Date Footer */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {fb.createdAt ? new Date(fb.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Recent"}
                      </span>
                      {fb.supervisorEmail && (
                        <span className="truncate max-w-[150px]">{fb.supervisorEmail}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isPreview) {
    return (
      <div className="bento-page-bg cursor-default select-none rounded-2xl overflow-hidden p-2 sm:p-4">
        <div className="bento-page-content w-full">
          <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, paddingBottom: 16 }}>
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bento-page-bg cursor-default select-none">
      <Navigation onLogout={handleLogout} />
      <div className="bento-page-content">
        <AnnouncementPopup />
        {showFaceModal && (
          <FaceRegistrationModal
            isOpen={showFaceModal}
            onClose={closeFaceRegistration}
            onEnrollmentComplete={closeFaceRegistration}
          />
        )}
        {showNoProjectPopup && (
          <NoProjectNotification onDismiss={() => setShowNoProjectPopup(false)} />
        )}
        {showTour && (
          <OnboardingTour
            internData={internData}
            internId={effectiveInternId}
            isNewIntern={isNewIntern}
          />
        )}
        {showCricketPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4 py-6">
            <div className="relative w-full max-w-md sm:max-w-lg rounded-2xl bg-white shadow-2xl">
              <button
                onClick={() => {
                  localStorage.setItem("cricketFiestaDismissed", "2025-12-31");
                  setShowCricketPopup(false);
                }}
                className="absolute right-3 top-3 text-gray-500 hover:text-gray-800"
                aria-label="Close cricket fiesta announcement"
              >
                ✕
              </button>
              <div className="h-full rounded-2xl bg-white p-6 text-center">
                <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-2">
                  <img src={cricketPosterUrl} alt="Cricket Fiesta poster" className="w-full max-h-[32rem] rounded-lg object-contain" />
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-500 mt-1">Register before December 31st to secure your spot.</p>
                </div>
                <div className="mt-6 flex flex-col gap-3">
                  <a href={cricketRegistrationLink} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700">
                    Open Registration Links
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem("cricketFiestaDismissed", "2025-12-31");
                      setShowCricketPopup(false);
                    }}
                    className="text-sm font-medium text-gray-600 underline"
                  >
                    Maybe later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, paddingBottom: 16 }}>
            {renderContent()}
          </div>
        </div>
        <FeatureTipModal />
      </div>
    </div>
  );
};

export default Dashboard;
