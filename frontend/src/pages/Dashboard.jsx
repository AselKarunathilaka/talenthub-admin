import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import Navigation from "../components/Navigation";
import InternshipEndNotification from "../components/InternshipEndNotification";
import NoProjectNotification from "../components/NoProjectNotification";
import FaceRegistrationModal from "../components/FaceRegistrationModal";
import OnboardingTour from "../components/OnboardingTour";
import FeatureTipModal from "../components/FeatureTipModal";
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
  GraduationCap
} from "lucide-react";
import { api } from "../utils/api";
import { formatDate } from "../utils/formatDate";
import { calculateInternshipEndNotification } from "../utils/internshipNotification";
import { motion, AnimatePresence } from "framer-motion";
const Dashboard = () => {
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
  const [activeTab, setActiveTab] = useState("meeting");
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
  const rowsPerPage = 10;
  const initialLoadStartedRef = useRef(false);
  const faceModalOpenRef = useRef(false);
  const navigate = useNavigate();
  const cricketRegistrationLink =
    "https://linktr.ee/CricketFiestaRegistrationLinks";
  const cricketPosterUrl = "/images/cricket-fiesta-poster.jpg";

  const loadInternData = async () => {
    try {
      const internId = localStorage.getItem("internId");

      if (!internId) {
        throw new Error("Authentication error: missing internId");
      }

      const response = await api.get(`/interns/${internId}`);

      if (response) {
        console.log("Intern Data Response:", response); // Debug log
        setInternData(response);

        // Check if internship end date notification should be shown
        if (response.Training_EndDate) {
          const notification = calculateInternshipEndNotification(
            response.Training_EndDate,
          );
          console.log("End date notification:", notification); // Debug log
          setEndDateNotification(notification);
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
      const internId = localStorage.getItem("internId");

      if (!internId) {
        throw new Error("Authentication error: missing internId");
      }

      const response = await api.get(`/interns/attendance/${internId}`);

      if (response) {
        console.log("Full API Response:", response); // Debug log

        // Set daily attendance (for the Daily Attendance section)
        const dailyAttendanceData =
          response.dailyAttendance ||
          response.attendance?.filter((entry) => !entry.isMeeting) ||
          [];
        console.log("Daily Attendance Data:", dailyAttendanceData); // Debug log
        setAttendanceHistory(dailyAttendanceData);
        setFilteredAttendance(dailyAttendanceData);

        // Set meeting attendance (for the Attendance History section)
        const meetingAttendanceData =
          response.meetingAttendance ||
          response.attendance?.filter((entry) => entry.isMeeting) ||
          [];
        console.log("Meeting Attendance Data:", meetingAttendanceData); // Debug log
        setMeetingAttendance(meetingAttendanceData);
        setFilteredMeetingAttendance(meetingAttendanceData);

        const meetingDateKey = (entry) => {
          const date = entry.date ? new Date(entry.date) : null;
          return date && !Number.isNaN(date.getTime())
            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
            : String(entry.date || "");
        };
        const meetingPresentDays = new Set(
          meetingAttendanceData
            .filter((entry) => entry.status === "Present")
            .map(meetingDateKey),
        ).size;
        const meetingAbsentDays = new Set(
          meetingAttendanceData
            .filter((entry) => entry.status === "Absent")
            .map(meetingDateKey),
        ).size;

        setAttendanceStats({
          present: meetingPresentDays,
          absent: meetingAbsentDays,
        });

        // Set daily attendance stats based on the daily attendance data
        setDailyAttendanceStats({
          present: dailyAttendanceData.filter(
            (entry) => entry.status === "Present",
          ).length,
          absent: dailyAttendanceData.filter(
            (entry) => entry.status === "Absent",
          ).length,
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

  const checkFaceEnrollment = async () => {
    try {
      const data = await api.get("/face-attendance/profile");
      return Boolean(data.profile && data.profile.isActive);
    } catch (error) {
      console.error("Error checking face enrollment:", error);
      return true;
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    const [fetchedInternData] = await Promise.all([
      loadInternData(), // Load intern details including end date
      loadAttendanceData(), // Load attendance data
    ]);
    setLoading(false);

    const internId = localStorage.getItem("internId");
    const shouldPromptFace = Boolean(
      internId && !(await checkFaceEnrollment()),
    );

    if (shouldPromptFace) {
      faceModalOpenRef.current = true;
      setShowFaceModal(true);
    }

    // Check if intern has a project — show popup every time if not assigned
    try {
      if (internId) {
        const projectCheck = await api.get(
          `/interns/${internId}/projects/check`,
        );
        if (projectCheck?.projects) {
          setInternProjects(projectCheck.projects);
        }
        const hasProject =
          projectCheck?.hasProject === true ||
          (Array.isArray(projectCheck?.projects) &&
            projectCheck.projects.length > 0);
        if (projectCheck && !hasProject) {
          if (shouldPromptFace || faceModalOpenRef.current) {
            setProjectPopupPending(true);
          } else {
            setShowNoProjectPopup(true);
          }
        }
      }
    } catch (err) {
      console.error("Error checking intern projects:", err);
    }
    // Show onboarding tour after all other modals are settled
    // (face modal takes priority; if no face modal, show tour immediately after load)
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
  };

  useEffect(() => {
    const internId = localStorage.getItem("internId");
    if (!internId) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    const deadline = new Date("2025-12-31T23:59:59");
    const now = new Date();
    const dismissedUntil = localStorage.getItem("cricketFiestaDismissed");

    if (now <= deadline && dismissedUntil !== "2025-12-31") {
      setShowCricketPopup(true);
    }
  }, []);

  useEffect(() => {
    if (initialLoadStartedRef.current) {
      return;
    }

    initialLoadStartedRef.current = true;
    loadAllData();
  }, []);

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

  const totalAttendance = attendanceStats.present + attendanceStats.absent;
  const presentPercentage =
    totalAttendance > 0
      ? Math.round((attendanceStats.present / totalAttendance) * 100)
      : 0;

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

    // Manual - handles both raw and normalized values
    if (
      normalizedMethod === "manual" ||
      normalizedMethod === "manual_meeting" ||
      normalizedMethod === "manual_daily"
    ) {
      return {
        label: "Manual",
        className: "bg-amber-50 text-amber-700 border-amber-100",
        Icon: Users,
      };
    }

    return {
      label: "Unknown",
      className: "bg-gray-50 text-gray-600 border-gray-100",
      Icon: Clock,
    };
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="w-full flex flex-col items-center justify-center mt-12">
          <Loader2
            className="h-10 w-10 animate-spin mb-4"
            style={{ color: "#00b4eb" }}
          />
          <p className="text-gray-500 font-medium">Loading your dashboard...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="w-full flex flex-col items-center justify-center mt-12 bg-white p-8 rounded-3xl shadow-sm border border-red-100 max-w-lg mx-auto">
          {isNetworkError ? (
            <>
              <XCircle className="h-14 w-14 text-red-500 mb-4 opacity-90" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Connection Error
              </h3>
              <p className="text-gray-500 mb-6 text-center">
                Unable to connect to the server. Please check your internet
                connection and try again.
              </p>
            </>
          ) : (
            <div className="text-red-500 text-lg font-medium mb-4">
              Error: {error}
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 text-white rounded-xl font-medium shadow-md transition-transform active:scale-95"
            style={{
              background: "linear-gradient(135deg, #00b4eb 0%, #0056a2 100%)",
            }}
          >
            Retry Connection
          </button>
        </div>
      );
    }

    return (
      <div className="max-w-6xl mx-auto">
        <InternshipEndNotification
          notification={endDateNotification}
          onDismiss={() => setEndDateNotification(null)}
        />

        {/* ── Intern Profile Card (Refactored) ── */}
        {internData && (
          <motion.div
            className="mb-8 bg-white rounded-3xl overflow-hidden group shadow-[0_0_15px_rgba(0,180,235,0.15)] border border-[#00b4eb]/20 hover:shadow-[0_0_30px_rgba(0,180,235,0.35)] hover:border-[#00b4eb]/50 transition-all duration-500"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Header gradient bar */}
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-cyan-50 p-6 sm:p-8 border-b border-gray-100 relative">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                    {internData.Trainee_Name || "—"}
                  </h2>
                  <p className="text-sm font-medium text-gray-500 mt-1 flex items-center gap-2">
                    {internData.Trainee_ID || "—"}
                  </p>
                  
                  {internData.Training_EndDate && (() => {
                    const daysLeft = Math.ceil(
                      (new Date(internData.Training_EndDate) - new Date()) / (1000 * 60 * 60 * 24)
                    );
                    return daysLeft > 0 ? (
                      <div className="mt-4 inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-sm" style={{ background: daysLeft <= 14 ? "linear-gradient(135deg, #ef4444, #dc2626)" : daysLeft <= 30 ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #50b748, #2e7d32)" }}>
                        {daysLeft} DAYS REMAINING
                      </div>
                    ) : (
                      <div className="mt-4 inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                        TRAINING ENDED
                      </div>
                    );
                  })()}
                </div>
                
                {internData.lastSeen && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100/50 text-blue-700 rounded-full text-xs font-semibold shadow-sm border border-blue-200/50">
                    <Clock className="w-3.5 h-3.5" />
                    Last seen: {new Date(internData.lastSeen).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {new Date(internData.lastSeen).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
            </div>

            {/* Grid Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 sm:p-8 bg-gray-50/30">
              
              {/* Personal Information */}
              <div className="bg-white rounded-2xl p-6 shadow-[0_0_15px_rgba(99,102,241,0.15)] border border-indigo-400/20 hover:shadow-[0_0_25px_rgba(99,102,241,0.35)] hover:border-indigo-400/60 transition-all duration-300">
                <h3 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-500" />
                  Personal Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Email</p>
                    <p className="text-sm font-medium text-gray-800 break-all">{internData.Trainee_Email || "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Institute</p>
                    <p className="text-sm font-medium text-gray-800">{internData.Institute || "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Specialization</p>
                    <p className="text-sm font-medium text-gray-800">{internData.field_of_spec_name || "Not specified"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Training Period */}
                <div className="bg-white rounded-2xl p-6 shadow-[0_0_15px_rgba(16,185,129,0.15)] border border-emerald-400/20 hover:shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:border-emerald-400/60 transition-all duration-300">
                  <h3 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-500" />
                    Training Period
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Start Date</p>
                      <p className="text-sm font-medium text-gray-800">{internData.Training_StartDate ? formatDate(internData.Training_StartDate) : "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">End Date</p>
                      <p className="text-sm font-medium text-gray-800">{internData.Training_EndDate ? formatDate(internData.Training_EndDate) : "N/A"}</p>
                    </div>
                    {internData.Training_StartDate && internData.Training_EndDate && (() => {
                      const start = new Date(internData.Training_StartDate);
                      const end = new Date(internData.Training_EndDate);
                      const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                      const weeks = Math.floor(totalDays / 7);
                      const remainingDays = totalDays % 7;
                      const daysLeft = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
                      return (
                        <>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Duration</p>
                            <p className="text-sm font-medium text-gray-800">{weeks} weeks, {remainingDays} days</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Status</p>
                            <p className={`text-sm font-bold ${daysLeft > 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {daysLeft > 0 ? `${daysLeft} days remaining` : "Training ended"}
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Project Assignments */}
                <div className="bg-white rounded-2xl p-6 shadow-[0_0_15px_rgba(59,130,246,0.15)] border border-blue-400/20 hover:shadow-[0_0_25px_rgba(59,130,246,0.35)] hover:border-blue-400/60 transition-all duration-300">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <Folder className="w-5 h-5 text-blue-500" />
                      Project Assignments
                    </h3>
                  </div>
                  {internProjects && internProjects.length > 0 ? (
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {internProjects.map((proj, pi) => (
                        <div key={pi} className="flex items-center gap-4 p-3.5 bg-white rounded-xl shadow-[0_0_10px_rgba(59,130,246,0.1)] border border-blue-300/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:border-blue-300/60 transition-all duration-300">
                          <div className="w-10 h-10 rounded-xl bg-blue-100/50 flex items-center justify-center flex-shrink-0 text-blue-600">
                            <Folder className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-gray-800 truncate">{proj.projectName}</p>
                            <p className="text-xs font-medium text-gray-500 mt-0.5">Status: {proj.status || "N/A"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                      <Folder className="w-8 h-8 text-gray-300 mb-2" />
                      <p className="text-sm font-medium text-gray-500 text-center">No projects assigned</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
        <motion.div
          className="flex mb-8 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 mx-auto max-w-md w-full relative"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => setActiveTab("meeting")}
            className={`relative z-10 flex-1 py-2.5 px-4 text-sm font-semibold rounded-xl transition-all duration-300 ${
              activeTab === "meeting"
                ? "text-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Meeting Attendance
          </button>
          <button
            onClick={() => setActiveTab("daily")}
            className={`relative z-10 flex-1 py-2.5 px-4 text-sm font-semibold rounded-xl transition-all duration-300 ${
              activeTab === "daily"
                ? "text-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Daily Attendance
          </button>

          <div
            className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-300 ease-out shadow-sm"
            style={{
              background:
                activeTab === "meeting"
                  ? "linear-gradient(135deg, #00b4eb 0%, #0056a2 100%)" // blue
                  : "linear-gradient(135deg, #50b748 0%, #2e7d32 100%)", // green
              left: activeTab === "meeting" ? "6px" : "calc(50%)",
            }}
          />
        </motion.div>

        {activeTab === "daily" && (
          <motion.div
            key="daily"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                  Daily Attendance
                </h2>
                <p className="text-gray-500 mt-1 text-sm">
                  Your daily internship attendance overview
                </p>
              </div>
            </div>

            {/* Daily Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              <motion.div
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#50b748]"></div>
                <span className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-1 block">
                  Present
                </span>
                <div className="flex items-center mt-2">
                  <span className="text-3xl font-black text-gray-800">
                    {dailyAttendanceStats.present}
                  </span>
                  <div className="ml-auto p-2 bg-[#50b748]/10 rounded-xl text-[#50b748]">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-red-400"></div>
                <span className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-1 block">
                  Absent
                </span>
                <div className="flex items-center mt-2">
                  <span className="text-3xl font-black text-gray-800">
                    {dailyAttendanceStats.absent}
                  </span>
                  <div className="ml-auto p-2 bg-red-50 rounded-xl text-red-400">
                    <XCircle className="h-5 w-5" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all duration-300 col-span-2 sm:col-span-1"
                whileHover={{ y: -2 }}
              >
                <div
                  className="absolute top-0 left-0 w-1.5 h-full"
                  style={{
                    background: "linear-gradient(to bottom, #00b4eb, #0056a2)",
                  }}
                ></div>
                <span className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-1 block">
                  Daily Rate
                </span>
                <div className="flex items-center mt-2">
                  <span className="text-3xl font-black text-gray-800">
                    {dailyAttendanceStats.present +
                      dailyAttendanceStats.absent >
                    0
                      ? Math.round(
                          (dailyAttendanceStats.present /
                            (dailyAttendanceStats.present +
                              dailyAttendanceStats.absent)) *
                            100,
                        )
                      : 0}
                    %
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Daily History */}
            {attendanceHistory.length > 0 ? (
              <div className="space-y-3">
                {attendanceHistory.slice(0, 10).map((entry, index) => {
                  let date, dayName, formattedDate, dateNumber;
                  try {
                    date = entry.date ? new Date(entry.date) : new Date();
                    dayName = date.toLocaleDateString("en-US", {
                      weekday: "short",
                    });
                    formattedDate = date.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });
                    dateNumber = date.getDate();
                  } catch (error) {
                    dayName = "N/A";
                    formattedDate = entry.date || "N/A";
                    dateNumber = "-";
                  }
                  const methodMeta = getMeetingMethodMeta(
                    entry.attendanceMethod ||
                      entry.method ||
                      entry.markedBy ||
                      entry.type,
                  );
                  const MethodIcon = methodMeta.Icon;

                  return (
                    <motion.div
                      key={`${entry.date}-${index}`}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors"
                      initial={false}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white shadow-inner shrink-0"
                          style={{
                            background:
                              "linear-gradient(135deg, #50b748 0%, #2e7d32 100%)",
                          }}
                        >
                          <span className="text-xs font-bold uppercase opacity-90">
                            {dayName}
                          </span>
                          <span className="text-lg font-black leading-none">
                            {dateNumber}
                          </span>
                        </div>
                        <div className="text-left">
                          <h4 className="font-bold text-gray-900">
                            {formattedDate}
                          </h4>
                          <div className="flex items-center gap-3 mt-1.5 text-xs">
                            <div className="flex flex-col gap-1 text-gray-500 font-medium">
                              {entry.checkInTime || entry.time ? (
                                <>
                                  <span className="flex items-center">
                                    <Clock className="h-3 w-3 mr-1 text-emerald-500" />
                                    {entry.checkInTime || entry.time}
                                  </span>
                                  {entry.checkOutTime && (
                                    <span className="flex items-center text-gray-400">
                                      <Clock className="h-3 w-3 mr-1 text-amber-500" />
                                      {entry.checkOutTime}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1 text-emerald-500" />
                                  -
                                </span>
                              )}
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold ${methodMeta.className}`}
                            >
                              <MethodIcon className="h-3 w-3" />
                              {methodMeta.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                            entry.status === "Present"
                              ? "bg-[#50b748]/10 text-[#50b748]"
                              : "bg-red-50 text-red-500"
                          }`}
                        >
                          {entry.status === "Present" ? (
                            <CheckCircle className="h-3 w-3 mr-1.5" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1.5" />
                          )}
                          {entry.status}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-3xl border border-gray-100">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">
                  No daily attendance records found
                </p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "meeting" && (
          <motion.div
            key="meeting"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                Meeting Attendance
              </h2>
              <p className="text-gray-500 mt-1 text-sm">
                Track your special session and meeting attendances
              </p>
            </div>

            {/* Meeting Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              <motion.div
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#50b748]"></div>
                <span className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-1 block">
                  Present
                </span>
                <div className="flex items-center mt-2">
                  <span className="text-3xl font-black text-gray-800">
                    {attendanceStats.present}
                  </span>
                  <div className="ml-auto p-2 bg-[#50b748]/10 rounded-xl text-[#50b748]">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-red-400"></div>
                <span className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-1 block">
                  Absent
                </span>
                <div className="flex items-center mt-2">
                  <span className="text-3xl font-black text-gray-800">
                    {attendanceStats.absent}
                  </span>
                  <div className="ml-auto p-2 bg-red-50 rounded-xl text-red-400">
                    <XCircle className="h-5 w-5" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all duration-300 col-span-2 sm:col-span-1"
                whileHover={{ y: -2 }}
              >
                <div
                  className="absolute top-0 left-0 w-1.5 h-full"
                  style={{
                    background: "linear-gradient(to bottom, #00b4eb, #0056a2)",
                  }}
                ></div>
                <span className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-1 block">
                  Meeting Rate
                </span>
                <div className="flex items-center mt-2">
                  <span className="text-3xl font-black text-gray-800">
                    {presentPercentage}%
                  </span>
                </div>
              </motion.div>
            </div>



            {/* Meeting History Accordion */}
            {filteredMeetingAttendance.length > 0 ? (
              <div className="space-y-3">
                {getMeetingDateGroups().map((group) => {
                  const isExpanded =
                    expandedMeetingDates[group.dateKey] ?? false;
                  const presentCount = group.meetings.filter(
                    (e) => e.status === "Present",
                  ).length;
                  return (
                    <motion.div
                      key={group.dateKey}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                      initial={false}
                    >
                      <button
                        onClick={() => toggleMeetingDate(group.dateKey)}
                        className="w-full flex items-center justify-between p-5 hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white shadow-inner"
                            style={{
                              background:
                                "linear-gradient(135deg, #00b4eb 0%, #0056a2 100%)",
                            }}
                          >
                            <span className="text-xs font-bold uppercase opacity-90">
                              {group.dayName}
                            </span>
                            <span className="text-lg font-black leading-none">
                              {group.dateNumber}
                            </span>
                          </div>
                          <div className="text-left">
                            <h4 className="font-bold text-gray-900">
                              {group.formattedDate}
                            </h4>
                            <p className="text-sm text-gray-500 font-medium mt-0.5">
                              {group.meetings.length} meeting
                              {group.meetings.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-[#50b748]/10 text-[#50b748]">
                            <CheckCircle className="h-3 w-3 mr-1.5" />
                            {presentCount} Present
                          </span>
                          <div
                            className={`p-2 rounded-lg transition-colors ${isExpanded ? "bg-gray-100" : "bg-gray-50"}`}
                          >
                            <ChevronDown
                              className={`h-5 w-5 text-gray-500 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </div>
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="px-5 pb-5 pt-2 border-t border-gray-50 bg-gray-50/30">
                              <div className="space-y-2.5">
                                {group.meetings.map((entry, index) => {
                                  const methodMeta = getMeetingMethodMeta(
                                    entry.attendanceMethod ||
                                      entry.method ||
                                      entry.markedBy ||
                                      entry.type,
                                  );
                                  const MethodIcon = methodMeta.Icon;

                                  return (
                                    <div
                                      key={`${group.dateKey}-${index}`}
                                      className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-gray-100 shadow-sm"
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-bold text-gray-800">
                                          {entry.meetingName ||
                                            entry.type ||
                                            "Meeting"}
                                        </span>
                                        <div className="flex items-center gap-3 mt-1.5 text-xs">
                                          <span className="flex items-center text-gray-500 font-medium">
                                            <Clock className="h-3 w-3 mr-1" />{" "}
                                            {entry.checkInTime || entry.time || "N/A"}
                                          </span>
                                          <span
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold ${methodMeta.className}`}
                                          >
                                            <MethodIcon className="h-3 w-3" />
                                            {methodMeta.label}
                                          </span>
                                        </div>
                                      </div>
                                      <span
                                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                                          entry.status === "Present"
                                            ? "bg-[#50b748]/10 text-[#50b748]"
                                            : "bg-red-50 text-red-500"
                                        }`}
                                      >
                                        {entry.status}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-3xl border border-gray-100">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">
                  No meeting attendance records found
                </p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-sans">
      <Navigation onLogout={handleLogout} />
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
          internId={localStorage.getItem("internId")}
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
                <img
                  src={cricketPosterUrl}
                  alt="Cricket Fiesta poster"
                  className="w-full max-h-[32rem] rounded-lg object-contain"
                />
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-500 mt-1">
                  Register before December 31st to secure your spot.
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-3">
                <a
                  href={cricketRegistrationLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
                >
                  Open Registration Links
                </a>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(
                      "cricketFiestaDismissed",
                      "2025-12-31",
                    );
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
      <div className="flex-1 w-full lg:mt-20 lg:px-6 xl:px-10 pb-10">
        <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          {renderContent()}
        </main>
      </div>
      <FeatureTipModal />
    </div>
  );
};

export default Dashboard;
