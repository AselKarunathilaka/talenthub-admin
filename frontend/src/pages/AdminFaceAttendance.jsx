import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import {
  AlertCircle,
  Camera,
  CheckCircle,
  Loader,
  Search,
  Users,
  Video,
  UserCheck,
  ArrowLeft,
  X,
  ScanFace,
} from "lucide-react";
import * as faceapi from "face-api.js";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../api/apiConfig";
import { adminApi } from "../api/adminApi";
import { ChevronDown, Check } from "lucide-react";
import {
  getDeviceTimeEvidence,
  requestFreshLocation,
} from "../utils/attendanceEvidence";
import { getCameraErrorMessage, requestFaceCameraStream } from "../utils/cameraAccess";
import {
  FaCheckCircle,
  FaRedo,
  FaSearch,
  FaSpinner,
  FaTimes,
  FaUserCheck,
  FaUserClock,
  FaUsers,
} from "react-icons/fa";

// ── Shared Utils & Constants ──────────────────────────────────────────────────
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
const REQUIRED_ENROLLMENT_SAMPLES = 5;
const ENROLLMENT_CAPTURE_DELAY_MS = 1900;
const ENROLLMENT_PROMPTS = [
  "Look straight at the camera and hold still.",
  "Turn head slightly to the left.",
  "Return to the center and hold still.",
  "Turn head slightly to the right.",
  "Return to the center for the final scan.",
];

const FACE_DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,
  scoreThreshold: 0.45,
});
const FACE_GUIDE_DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 160,
  scoreThreshold: 0.45,
});
const FACE_GUIDE_INTERVAL_MS = 100;
const REQUIRED_STABLE_FACE_CHECKS = 2;

const getAuthHeaders = () => {
  const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
  return {
    "Content-Type": "application/json",
    ...(adminInfo.token && { Authorization: `Bearer ${adminInfo.token}` }),
  };
};

const normalizeProjectName = (value) => String(value || "").trim().replace(/\s+/g, " ");

// Simplified drawing function to avoid external dependency
const drawFaceMesh = (canvas, landmarks) => {
  if (!canvas || !landmarks) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw landmarks
  ctx.fillStyle = "#3b82f6";
  landmarks.positions.forEach((pt) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI);
    ctx.fill();
  });
};

const clearFaceMesh = (canvas) => {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

// ── API ───────────────────────────────────────────────────────────────────────
const adminFaceApi = {
  searchIntern: async (query) => {
    const res = await fetch(
      `${API_BASE_URL}/admin/manual-attendance/search?q=${encodeURIComponent(query)}`,
      { headers: getAuthHeaders() },
    );
    if (!res.ok) throw new Error((await res.json()).error || "Search failed");
    return res.json();
  },

  enrollIntern: async (payload) => {
    const res = await fetch(`${API_BASE_URL}/admin/face-attendance/enroll-intern`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Enrollment failed");
    return data;
  },

  scanIntern: async (payload) => {
    const res = await fetch(`${API_BASE_URL}/admin/face-attendance/scan-intern`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Scan failed");
    return data;
  },

  validateMeetingPin: async (payload) => {
    const res = await fetch(`${API_BASE_URL}/admin/face-attendance/meeting-pin/validate`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.valid) throw new Error(data.message || "Invalid or expired PIN.");
    return data;
  }
};

// ── Components ────────────────────────────────────────────────────────────────
const InternCard = ({ intern, onSelect, selected }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect(intern)}
      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center gap-4 group ${
        selected
          ? "border-blue-400 bg-blue-50/80 shadow-md ring-4 ring-blue-50"
          : "border-slate-100 bg-white hover:border-blue-200 hover:bg-slate-50 hover:shadow-sm"
      }`}
    >
      <div className={`relative h-12 w-12 rounded-full overflow-hidden flex-shrink-0 transition-transform duration-300 ${selected ? 'ring-2 ring-blue-500 scale-105' : 'ring-1 ring-slate-200 group-hover:scale-105 group-hover:ring-blue-300'}`}>
        <img
          src={`${API_BASE_URL}/interns/${intern._id}/profile-picture`}
          alt="Profile"
          className="w-full h-full object-cover bg-slate-100"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(intern.Trainee_Name)}&background=random`;
          }}
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className={`text-[15px] font-bold truncate transition-colors ${selected ? 'text-blue-900' : 'text-slate-800'}`}>
          {intern.Trainee_Name}
        </p>
        <p className="text-xs font-semibold text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300"></span>
          {intern.Trainee_ID}
        </p>
      </div>
    </motion.button>
  );
};

const AdminFaceAttendance = () => {
  const navigate = useNavigate();
  const searchDebounce = useRef(null);

  // States
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("meeting"); // "enroll", "daily", "meeting"
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIntern, setSelectedIntern] = useState(null);

  const [enrollmentData, setEnrollmentData] = useState({ stats: {}, profiles: [] });
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profileSearch, setProfileSearch] = useState('');
  const [profileFilter, setProfileFilter] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showProfilesModal, setShowProfilesModal] = useState(false);
  
  // Camera & Face logic
  const [cameraActive, setCameraActive] = useState(false);
  const [enrollmentFrames, setEnrollmentFrames] = useState([]);
  const [faceGuide, setFaceGuide] = useState({ ready: false, message: "Center face in the oval" });
  const [meetingTitle, setMeetingTitle] = useState("");
  const [projects, setProjects] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const dropdownRef = useRef(null);

  // Pagination for profiles
  const [profilePage, setProfilePage] = useState(1);
  const PROFILES_PER_PAGE = 30;

  const [videoDims, setVideoDims] = useState({ width: 640, height: 480 });
  const [sltLocationRequired, setSltLocationRequired] = useState(true);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const meshCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const liveDescriptorRef = useRef(null);
  const enrollmentFramesRef = useRef([]);
  const lastAutoCaptureRef = useRef(0);
  const inspectBusyRef = useRef(false);
  const stableFaceChecksRef = useRef(0);
  const submitStartedRef = useRef(false);

  const fetchEnrollmentProfiles = useCallback(async () => {
    try {
      setProfilesLoading(true);
      setEnrollmentData(await adminApi.getFaceEnrollmentProfiles());
    } catch (error) {
      toast.error(error.message || 'Failed to load face enrollment profiles', {
        id: 'face-enrollment-profiles-load',
      });
      console.error(error);
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  const openProfilesModal = () => {
    setShowProfilesModal(true);
    // Silent refresh so data loads instantly from pre-fetch
    adminApi.getFaceEnrollmentProfiles().then(data => setEnrollmentData(data)).catch(console.error);
  };

  const filteredProfiles = enrollmentData.profiles.filter((profile) => {
    const query = profileSearch.trim().toLowerCase();
    const matchesSearch = !query || [
      profile.traineeName,
      profile.traineeId,
      profile.email,
      profile.team,
      profile.institute,
    ].some((value) => String(value || '').toLowerCase().includes(query));
    const matchesFilter =
      profileFilter === 'all' ||
      (profileFilter === 'complete' && profile.isComplete) ||
      (profileFilter === 'incomplete' && profile.isActive && !profile.isComplete) ||
      (profileFilter === 'inactive' && !profile.isActive);
    return matchesSearch && matchesFilter;
  });

  const paginatedProfiles = filteredProfiles.slice(0, profilePage * PROFILES_PER_PAGE);

  useEffect(() => {
    // Reset pagination when search or filter changes
    setProfilePage(1);
  }, [profileSearch, profileFilter]);

  // Handle clicking outside custom dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDateTime = (value) => value
    ? new Date(value).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : 'Never';

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (error) {
        console.error("Error loading face-api models:", error);
        toast.error("Failed to load face recognition models.");
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    const loadAttendanceSettings = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/attendance/settings`, {
          headers: getAuthHeaders(),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Failed to load attendance settings.");
        setSltLocationRequired(result.settings?.sltLocationRequired !== false);
      } catch (error) {
        // Keep the secure default when settings cannot be loaded. The backend
        // remains the authority and will return a useful location error.
        console.error("Failed to load attendance settings:", error);
      }
    };

    loadAttendanceSettings();
  }, []);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/talenttrail/projects`, {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setProjects(data);
        }
      } catch (err) {
        console.error("Failed to load projects", err);
      }
    };
    loadProjects();
    
    // Pre-load enrollment profiles for instant display
    fetchEnrollmentProfiles();
  }, [fetchEnrollmentProfiles]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await adminFaceApi.searchIntern(query);
        setSearchResults(data.interns || []);
      } catch (err) {
        toast.error(err.message || "Search failed");
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  }, []);

  const handleSelectIntern = (intern) => {
    setSelectedIntern(intern);
    setSearchQuery(intern.Trainee_Name);
    setSearchResults([]);
    // Do not stop camera so admin can continuously scan interns
    if (cameraActive) {
      setFaceGuide({ ready: false, message: "Center face in the oval" });
      stableFaceChecksRef.current = 0;
      liveDescriptorRef.current = null;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    liveDescriptorRef.current = null;
    stableFaceChecksRef.current = 0;
    clearFaceMesh(meshCanvasRef.current);
    setFaceGuide({ ready: false, message: "Center face in the oval" });
  };

  const attachStreamToVideo = async () => {
    if (!videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    try {
      await videoRef.current.play();
    } catch (error) {
      console.warn("Camera preview autoplay was blocked:", error);
    }
  };

  useEffect(() => {
    if (cameraActive) attachStreamToVideo();
  }, [cameraActive]);

  const startCamera = async () => {
    if (!selectedIntern) {
      toast.error("Please select an intern first.");
      return;
    }

    if (mode === "meeting") {
      if (!meetingTitle.trim()) {
        toast.error("Provide a valid meeting title.");
        return;
      }
    }

    try {
      const stream = await requestFaceCameraStream();
      streamRef.current = stream;
      lastAutoCaptureRef.current = Date.now();
      stableFaceChecksRef.current = 0;
      submitStartedRef.current = false;
      setEnrollmentFrames([]);
      setCameraActive(true);
      await attachStreamToVideo();
    } catch (error) {
      console.error("Camera access error:", error);
      toast.error(getCameraErrorMessage(error));
      setCameraActive(false);
    }
  };

  const captureFrameForDescriptor = async () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const ctx = canvasRef.current.getContext("2d");
    
    // Ensure canvas matches video native dimensions to prevent squishing on mobile portrait
    const vWidth = videoRef.current.videoWidth || 640;
    const vHeight = videoRef.current.videoHeight || 480;
    
    if (canvasRef.current.width !== vWidth) canvasRef.current.width = vWidth;
    if (canvasRef.current.height !== vHeight) canvasRef.current.height = vHeight;
    if (meshCanvasRef.current.width !== vWidth) meshCanvasRef.current.width = vWidth;
    if (meshCanvasRef.current.height !== vHeight) meshCanvasRef.current.height = vHeight;

    ctx.drawImage(videoRef.current, 0, 0, vWidth, vHeight);
    
    try {
      const detections = await faceapi
        .detectAllFaces(canvasRef.current, FACE_DETECTOR_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length !== 1) {
        clearFaceMesh(meshCanvasRef.current);
        return { error: detections.length === 0 ? "No face detected." : "More than one face detected." };
      }

      const detection = detections[0];
      drawFaceMesh(meshCanvasRef.current, detection.landmarks);
      const { box } = detection.detection;
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      
      const targetCenterX = vWidth / 2;
      const targetCenterY = vHeight / 2;
      
      // Dynamic center threshold based on video size
      const centered = Math.abs(centerX - targetCenterX) <= (vWidth * 0.2) && Math.abs(centerY - targetCenterY) <= (vHeight * 0.2);
      const largeEnough = box.width >= (vWidth * 0.2) && box.height >= (vHeight * 0.2);

      if (!centered) return { error: "Move face into the center." };
      if (!largeEnough) return { error: "Move closer to the camera." };

      return { descriptor: Array.from(detection.descriptor) };
    } catch (err) {
      clearFaceMesh(meshCanvasRef.current);
      return { error: "Could not read face data." };
    }
  };

  const inspectFacePosition = async () => {
    if (!videoRef.current || !canvasRef.current) return null;

    const ctx = canvasRef.current.getContext("2d");
    const vWidth = videoRef.current.videoWidth || 640;
    const vHeight = videoRef.current.videoHeight || 480;

    if (canvasRef.current.width !== vWidth) canvasRef.current.width = vWidth;
    if (canvasRef.current.height !== vHeight) canvasRef.current.height = vHeight;
    ctx.drawImage(videoRef.current, 0, 0, vWidth, vHeight);

    try {
      const detections = await faceapi.detectAllFaces(
        canvasRef.current,
        FACE_GUIDE_DETECTOR_OPTIONS,
      ).withFaceLandmarks();

      if (detections.length !== 1) {
        clearFaceMesh(meshCanvasRef.current);
        return {
          error:
            detections.length === 0
              ? "No face detected."
              : "More than one face detected.",
        };
      }

      const detection = detections[0];
      drawFaceMesh(meshCanvasRef.current, detection.landmarks);
      
      const { box } = detection.detection;
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const centered =
        Math.abs(centerX - vWidth / 2) <= vWidth * 0.2 &&
        Math.abs(centerY - vHeight / 2) <= vHeight * 0.2;
      const largeEnough = box.width >= vWidth * 0.2 && box.height >= vHeight * 0.2;

      if (!centered) return { error: "Move face into the center." };
      if (!largeEnough) return { error: "Move closer to the camera." };

      return { ready: true };
    } catch (error) {
      console.error("Error inspecting face position:", error);
      return { error: "Could not read the camera frame." };
    }
  };

  const updateFaceGuide = (nextGuide) => {
    setFaceGuide((currentGuide) =>
      currentGuide.ready === nextGuide.ready && currentGuide.message === nextGuide.message
        ? currentGuide
        : nextGuide,
    );
  };

  const captureFreshDescriptorForVerification = async () => {
    while (inspectBusyRef.current) {
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    }

    inspectBusyRef.current = true;
    try {
      return await captureFrameForDescriptor();
    } finally {
      inspectBusyRef.current = false;
    }
  };

  useEffect(() => {
    enrollmentFramesRef.current = enrollmentFrames;
  }, [enrollmentFrames]);

  useEffect(() => {
    if (!cameraActive) return undefined;
    let cancelled = false;
    
    const inspectFace = async () => {
      if (inspectBusyRef.current) return;
      if (mode === "enroll" && enrollmentFramesRef.current.length >= REQUIRED_ENROLLMENT_SAMPLES) {
        setFaceGuide({ ready: true, message: "Face samples ready. Submitting..." });
        return;
      }
      
      inspectBusyRef.current = true;
      try {
        const positionData = await inspectFacePosition();
        if (cancelled) return;
        if (!positionData || positionData.error) {
          stableFaceChecksRef.current = 0;
          liveDescriptorRef.current = null;
          clearFaceMesh(meshCanvasRef.current);
          updateFaceGuide({
            ready: false,
            message: positionData?.error || "Center face in oval",
          });
          return;
        }

        stableFaceChecksRef.current = Math.min(
          stableFaceChecksRef.current + 1,
          REQUIRED_STABLE_FACE_CHECKS,
        );
        const faceIsStable = stableFaceChecksRef.current >= REQUIRED_STABLE_FACE_CHECKS;
        updateFaceGuide({
          ready: faceIsStable,
          message:
            !faceIsStable
              ? "Hold still for a moment..."
              : mode === "enroll"
                ? ENROLLMENT_PROMPTS[enrollmentFramesRef.current.length] || "Face samples ready. Submitting..."
                : "Face is ready.",
        });

        if (!faceIsStable || mode !== "enroll") return;

        const currentFrames = enrollmentFramesRef.current;
        if (currentFrames.length >= REQUIRED_ENROLLMENT_SAMPLES) return;
        if (Date.now() - lastAutoCaptureRef.current < ENROLLMENT_CAPTURE_DELAY_MS) return;

        const frameData = await captureFrameForDescriptor();
        if (cancelled || !frameData || frameData.error) return;
        liveDescriptorRef.current = frameData.descriptor;

        const previousFrame = currentFrames[currentFrames.length - 1];
        const isDistinct = !previousFrame || Math.sqrt(
          previousFrame.reduce((sum, val, idx) => {
            const diff = val - frameData.descriptor[idx];
            return sum + diff * diff;
          }, 0)
        ) >= 0.035;

        if (!isDistinct) {
          setFaceGuide({ ready: true, message: ENROLLMENT_PROMPTS[currentFrames.length] });
          return;
        }

        lastAutoCaptureRef.current = Date.now();
        setEnrollmentFrames((frames) => [...frames, frameData.descriptor]);
        setFaceGuide({ ready: true, message: ENROLLMENT_PROMPTS[currentFrames.length + 1] || "Done." });
      } finally {
        inspectBusyRef.current = false;
      }
    };

    inspectFace();
    const timer = setInterval(inspectFace, FACE_GUIDE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [cameraActive, mode]);

  useEffect(() => {
    if (mode === "enroll" && enrollmentFrames.length >= REQUIRED_ENROLLMENT_SAMPLES && !submitStartedRef.current) {
      completeEnrollment();
    }
  }, [enrollmentFrames, mode]);

  const completeEnrollment = async () => {
    if (enrollmentFrames.length < REQUIRED_ENROLLMENT_SAMPLES) return;
    submitStartedRef.current = true;
    stopCamera();
    setLoading(true);
    
    try {
      for (const [index, descriptor] of enrollmentFrames.entries()) {
        await adminFaceApi.enrollIntern({
          internId: selectedIntern._id,
          descriptor,
          metadata: { replaceExisting: index === 0 }
        });
      }
      toast.success(`Face enrolled successfully for ${selectedIntern.Trainee_Name}`);
      setEnrollmentFrames([]);
    } catch (err) {
      toast.error(err.message || "Enrollment failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async () => {
    setLoading(true);

    let attendanceLocation = null;
    if (sltLocationRequired) {
      try {
        attendanceLocation = await requestFreshLocation();
      } catch (error) {
        toast.error(error.message || "A fresh location is required to mark attendance.");
        setLoading(false);
        return;
      }
    }

    // Verify the person currently in front of the camera, not a descriptor
    // cached by an earlier preview scan.
    const frameData = await captureFreshDescriptorForVerification();
    
    if (!frameData || frameData.error) {
      toast.error(frameData?.error || "No face detected.");
      setLoading(false);
      return;
    }

    try {
      const response = await adminFaceApi.scanIntern({
        internId: selectedIntern._id,
        descriptor: frameData.descriptor,
        attendanceType: mode,
        meetingTitle: mode === "meeting" ? meetingTitle.trim() : undefined,
        metadata: {
          location: attendanceLocation,
          source: "admin-browser-camera",
          ...getDeviceTimeEvidence(),
        },
      });
      
      const successMessage = response.checkedOut
        ? `Check-out recorded for ${selectedIntern.Trainee_Name}`
        : mode === "daily"
          ? `Check-in recorded for ${selectedIntern.Trainee_Name}`
          : response.message || "Attendance marked.";

      toast.success(successMessage);
      // Keep camera active for the next scan instead of stopping
      setFaceGuide({ ready: false, message: "Attendance marked. Next person..." });
      stableFaceChecksRef.current = 0;
      liveDescriptorRef.current = null;
    } catch (err) {
      toast.error(err.message || "Failed to verify face.");
      if (err.message && err.message.includes("already out of office")) {
        // Only stop if strictly necessary, but better to keep it running
      }
    } finally {
      setLoading(false);
    }
  };



  return (
    <AdminNavigation>
      <main className="relative flex-1 p-3 sm:p-6 sm:px-8 mx-auto max-w-[1400px] w-full flex flex-col gap-5 sm:gap-6 min-w-0 select-none font-sans text-slate-800 h-full">
          
          {/* Header Section */}
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 pt-2">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="p-2.5 sm:p-3 md:p-3.5 bg-gradient-to-br from-[#000066] to-[#006600] shadow-md rounded-lg sm:rounded-xl md:rounded-2xl border border-[#006600]/20 flex-shrink-0"
              >
                <ScanFace className="text-white h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
              </motion.div>
              <div className="flex flex-col justify-center">
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight"
                >
                  Face ID
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="text-slate-500 mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base font-medium max-w-xl"
                >
                  Enroll faces or mark camera attendance on behalf of interns.
                </motion.p>
              </div>
            </div>

            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              type="button"
              onClick={openProfilesModal}
              className="inline-flex items-center justify-center gap-2.5 bg-white border border-slate-200 shadow-sm px-6 py-3.5 rounded-xl md:rounded-[16px] text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 hover:shadow group w-full xl:w-auto"
              whileTap={{ scale: 0.98 }}
            >
              <div className="p-1.5 rounded-lg bg-[#000066]/10 text-[#000066] group-hover:bg-[#000066]/20 transition-colors">
                <FaUsers className="h-4 w-4" />
              </div>
              <span>Enrollment Profiles</span>
            </motion.button>
          </div>

          <div className="grid gap-6 xl:grid-cols-12 items-stretch z-10 relative flex-1">
              
              {/* Sidebar Configuration */}
              <motion.div 
                className="xl:col-span-4 space-y-6 flex flex-col"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 relative flex-1 flex flex-col">
                  
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">Configuration</h3>
                  </div>
                  
                  {/* Segmented Control */}
                  <div className="flex mb-8 bg-slate-100/80 p-1.5 rounded-2xl w-full relative border border-slate-200/50">
                    <button
                      onClick={() => { setMode("meeting"); stopCamera(); }}
                      className={`relative z-10 flex-1 py-2.5 px-1 text-[13px] font-bold rounded-xl transition-all duration-300 flex items-center justify-center ${
                        mode === "meeting" ? "text-white" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <span>Meeting</span>
                    </button>
                    <button
                      onClick={() => { setMode("daily"); stopCamera(); }}
                      className={`relative z-10 flex-1 py-2.5 px-1 text-[13px] font-bold rounded-xl transition-all duration-300 flex items-center justify-center ${
                        mode === "daily" ? "text-white" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <span>Daily</span>
                    </button>
                    <button
                      onClick={() => { setMode("enroll"); stopCamera(); }}
                      className={`relative z-10 flex-1 py-2.5 px-1 text-[13px] font-bold rounded-xl transition-all duration-300 flex items-center justify-center ${
                        mode === "enroll" ? "text-white" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <span>Enrol</span>
                    </button>

                    <div
                      className={`absolute top-1.5 bottom-1.5 rounded-xl transition-all duration-400 ease-out shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-white/20 ${
                        mode === 'meeting' ? 'bg-blue-600' : mode === 'daily' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{
                        width: "calc(33.333% - 4px)",
                        left:
                          mode === "meeting"
                            ? "6px"
                            : mode === "daily"
                            ? "calc(33.333% + 2px)"
                            : "calc(66.666% - 2px)",
                      }}
                    />
                  </div>

                  <div className="flex-1 flex flex-col space-y-6">
                    
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 px-1">
                        Select Intern
                      </label>
                      <div className="relative mb-3">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            handleSearch(e.target.value);
                            if (selectedIntern) setSelectedIntern(null);
                          }}
                          placeholder="Search by name or ID..."
                          className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-blue-100/50 focus:border-blue-400 focus:bg-white transition-all outline-none"
                        />
                        {searchQuery && (
                          <button onClick={() => { setSearchQuery(""); setSearchResults([]); setSelectedIntern(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full transition-colors">
                            <X className="w-3 h-3 text-slate-600" />
                          </button>
                        )}
                      </div>
                      
                      <AnimatePresence>
                        {searchResults.length > 0 && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2 max-h-[30vh] overflow-y-auto mb-4 custom-scrollbar pr-1">
                            {searchResults.map((intern) => (
                              <InternCard key={intern._id} intern={intern} onSelect={handleSelectIntern} selected={selectedIntern?._id === intern._id} />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      {selectedIntern && (
                        <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="p-4 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 rounded-2xl border border-blue-200/60 flex items-center gap-4 mt-2 relative overflow-hidden shadow-sm">
                          <div className="absolute top-0 right-0 p-3 opacity-10">
                            <UserCheck className="w-16 h-16 text-blue-600" />
                          </div>
                          <div className="w-14 h-14 rounded-full shadow-sm flex items-center justify-center flex-shrink-0 overflow-hidden ring-4 ring-white relative z-10">
                            <img
                              src={`${API_BASE_URL}/interns/${selectedIntern._id}/profile-picture`}
                              alt="Profile"
                              className="w-full h-full object-cover bg-slate-100"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedIntern.Trainee_Name)}&background=random`;
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1 relative z-10">
                            <p className="text-sm font-bold text-slate-900 truncate tracking-tight">{selectedIntern.Trainee_Name}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">{selectedIntern.Trainee_ID}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    <AnimatePresence mode="wait">
                      {mode === 'meeting' && (
                        <motion.div key="meeting-form" initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -10, height: 0 }} className="space-y-4 relative">
                          <label className="block relative" ref={dropdownRef}>
                            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 px-1">Project Name</span>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Type to search project..."
                                value={meetingTitle}
                                onChange={(e) => {
                                  setMeetingTitle(e.target.value);
                                  setIsDropdownOpen(true);
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100/50 focus:border-blue-400 focus:bg-white transition-all font-semibold text-slate-800 outline-none text-sm"
                              />
                              {meetingTitle && (
                                <button onClick={() => setMeetingTitle("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full transition-colors z-10">
                                  <X className="w-3 h-3 text-slate-600" />
                                </button>
                              )}
                            </div>

                            <AnimatePresence>
                              {isDropdownOpen && projects.filter(p => (p.projectName || p.name || "").toLowerCase().includes(meetingTitle.toLowerCase())).length > 0 && (
                                <motion.div
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 5 }}
                                  className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] z-50 overflow-hidden flex flex-col max-h-[220px]"
                                >
                                  <div className="overflow-y-auto custom-scrollbar flex-1 p-1.5">
                                    {projects
                                      .filter(p => (p.projectName || p.name || "").toLowerCase().includes(meetingTitle.toLowerCase()))
                                      .slice(0, 3)
                                      .map((proj) => {
                                        const pName = proj.projectName || proj.name;
                                        return (
                                          <div
                                            key={proj._id || pName}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              setMeetingTitle(pName);
                                              setIsDropdownOpen(false);
                                            }}
                                            className="px-4 py-3 rounded-xl text-sm cursor-pointer flex items-center justify-between transition-colors hover:bg-blue-50/50 hover:text-blue-700 text-slate-700 font-medium"
                                          >
                                            <span className="truncate">{pName}</span>
                                          </div>
                                        );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </label>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>
                </div>
              </motion.div>

              {/* Main Camera Display */}
              <motion.div 
                className="xl:col-span-8 space-y-6 flex flex-col"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl p-3 sm:p-4 md:p-6 min-h-[300px] sm:min-h-[500px] lg:min-h-[600px] flex flex-col relative overflow-hidden h-full">
                  
                  <div className={`relative flex-1 rounded-2xl overflow-hidden min-h-[200px] sm:min-h-[400px] flex items-center justify-center border border-slate-700/50 transition-all duration-500 ${cameraActive ? 'bg-black' : 'bg-slate-900/50'}`}>
                    
                    {/* Glowing scanning effect behind the video when active */}
                    {cameraActive && (
                      <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(59,130,246,0.15)] pointer-events-none z-10" />
                    )}

                    {loading && (
                      <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white rounded-2xl" style={{ borderRadius: '1rem' }}>
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <ScanFace className="w-6 h-6 text-blue-400 animate-pulse" />
                          </div>
                        </div>
                        <p className="mt-4 text-sm font-bold tracking-widest uppercase text-blue-300">Processing</p>
                      </div>
                    )}

                    {!modelsLoaded ? (
                      <div className="text-center p-8 max-w-sm flex flex-col items-center justify-center h-full text-slate-300">
                        <Loader className="w-10 h-10 animate-spin mb-5 text-blue-500" />
                        <h3 className="text-white font-bold text-xl mb-2 tracking-tight">Initializing AI Models</h3>
                        <p className="text-slate-400 text-sm font-medium leading-relaxed">Downloading neural network assets for facial recognition...</p>
                      </div>
                    ) : !cameraActive ? (
                      <div className="text-center p-8 max-w-md flex flex-col items-center justify-center h-full">
                        <div className="relative w-24 h-24 mb-8">
                          <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping" />
                          <div className="relative w-full h-full rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center shadow-lg backdrop-blur-sm">
                            <Camera className="w-10 h-10 text-slate-400" />
                          </div>
                        </div>
                        <h3 className="text-white font-bold text-2xl mb-3 tracking-tight">Camera Inactive</h3>
                        <p className="text-slate-400 text-sm mb-10 font-medium leading-relaxed">Select an intern and configure settings, then initialize the camera to begin scanning.</p>
                        
                        <button
                          onClick={startCamera}
                          disabled={!selectedIntern || loading || (mode === "meeting" && !meetingTitle.trim())}
                          className="group relative px-6 py-3 sm:px-8 sm:py-4 bg-white text-slate-900 rounded-2xl font-bold shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed overflow-hidden w-full sm:w-auto"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="relative flex items-center justify-center gap-2 w-full">
                            <ScanFace className="w-5 h-5" />
                            Initialize Scanner
                          </span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <video
                          ref={videoRef}
                          className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                          style={{ transform: "scaleX(-1)", borderRadius: "1rem" }}
                          playsInline
                          muted
                          onLoadedMetadata={(e) => {
                            setVideoDims({
                              width: e.target.videoWidth || 640,
                              height: e.target.videoHeight || 480
                            });
                          }}
                        />
                        <canvas
                          ref={canvasRef}
                          width={videoDims.width}
                          height={videoDims.height}
                          className="hidden"
                        />
                        <canvas
                          ref={meshCanvasRef}
                          width={videoDims.width}
                          height={videoDims.height}
                          className="absolute inset-0 w-full h-full object-cover z-20 pointer-events-none rounded-2xl"
                          style={{ transform: "scaleX(-1)", borderRadius: "1rem" }}
                        />
                        
                        
                        
                        {/* Overlay Guides */}
                        <div className="absolute top-6 inset-x-6 z-20 flex justify-between items-start">
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`px-5 py-2.5 rounded-full text-[13px] font-bold shadow-xl backdrop-blur-md border transition-all duration-300 flex items-center gap-2 ${
                            faceGuide.ready ? "bg-emerald-500/90 text-white border-emerald-400/50" : "bg-slate-900/80 text-white border-slate-700/50"
                          }`}>
                            {faceGuide.ready && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                            {faceGuide.message}
                          </motion.div>
                          
                          <button onClick={stopCamera} className="w-11 h-11 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all backdrop-blur-md border border-slate-700/50 shadow-xl hover:scale-105 active:scale-95">
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Mode specific controls overlay */}
                        <div className="absolute bottom-6 inset-x-6 z-20 flex flex-col items-center pointer-events-none">
                          <div className="w-full max-w-md mx-auto pointer-events-auto">
                            {mode === "enroll" ? (
                              <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50 shadow-2xl relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent pointer-events-none" />
                                <div className="flex justify-between items-end mb-4 relative z-10">
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Enrollment Progress</p>
                                    <p className="text-white font-bold text-xl">{selectedIntern?.Trainee_Name}</p>
                                  </div>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-black text-blue-400 leading-none">{enrollmentFrames.length}</span>
                                    <span className="text-slate-500 font-bold">/ {REQUIRED_ENROLLMENT_SAMPLES}</span>
                                  </div>
                                </div>
                                <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden shadow-inner relative z-10">
                                  <div 
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-500 ease-out rounded-full relative"
                                    style={{ width: `${(enrollmentFrames.length / REQUIRED_ENROLLMENT_SAMPLES) * 100}%` }}
                                  >
                                    <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={handleMarkAttendance}
                                disabled={!faceGuide.ready}
                                className={`w-full py-5 rounded-3xl font-black text-[15px] tracking-wide uppercase transition-all duration-300 shadow-2xl relative overflow-hidden ${
                                  faceGuide.ready 
                                    ? 'bg-white text-slate-900 hover:scale-[1.02] active:scale-[0.98]' 
                                    : 'bg-slate-800/80 text-slate-500 backdrop-blur-md border border-slate-700/50 cursor-not-allowed'
                                }`}
                              >
                                {faceGuide.ready && (
                                  <div className="absolute inset-0 bg-gradient-to-r from-blue-100/50 to-indigo-100/50 opacity-0 hover:opacity-100 transition-opacity" />
                                )}
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                  <CheckCircle className={`w-5 h-5 ${faceGuide.ready ? 'text-emerald-500' : 'text-slate-600'}`} />
                                  Mark Attendance
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>

          </div>

        <AnimatePresence>
        {showProfilesModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[25] bg-slate-900/60 backdrop-blur-sm pointer-events-auto" 
              onClick={() => setShowProfilesModal(false)}
            />
            
            <div className="absolute inset-0 z-[28] pointer-events-none p-2 xl:p-0">
              <div className="w-full h-full xl:h-auto xl:sticky xl:top-[5vh] flex justify-center xl:px-4 pointer-events-none">
              <motion.section
                className="w-full h-full xl:h-auto xl:max-w-6xl xl:max-h-[90vh] overflow-hidden rounded-2xl xl:rounded-3xl bg-white shadow-2xl flex flex-col pointer-events-auto xl:border border-slate-200/50"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
              >
                {/* Modal Header */}
                <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:px-8 sm:py-6 xl:flex-row xl:items-center xl:justify-between bg-white z-10 shrink-0 relative">
                  <div className="pr-10 xl:pr-0">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Face Enrollment Profiles</h3>
                    <p className="mt-1.5 text-sm text-slate-500 font-medium">
                      Manage intern face ID registrations and attendance readiness.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 w-full xl:w-auto">
                    <button
                      type="button"
                      onClick={fetchEnrollmentProfiles}
                      disabled={profilesLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-50 px-5 py-2.5 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60 flex-1 xl:flex-none"
                    >
                      <FaRedo className={`h-3.5 w-3.5 ${profilesLoading ? 'animate-spin' : ''}`} />
                      Refresh Data
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProfilesModal(false)}
                      className="absolute top-4 right-4 xl:relative xl:top-auto xl:right-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
                    >
                      <FaTimes className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 sm:px-8 bg-slate-50/50 shrink-0">
                  {[
                    { label: 'Total Interns', value: enrollmentData.stats.totalInterns || 0, icon: FaUsers, color: 'text-blue-600 bg-blue-100', border: 'border-blue-200' },
                    { label: 'Enrolled & Ready', value: enrollmentData.stats.enrolled || 0, icon: FaUserCheck, color: 'text-emerald-600 bg-emerald-100', border: 'border-emerald-200' },
                    { label: 'Action Required', value: enrollmentData.stats.notEnrolled || 0, icon: FaUserClock, color: 'text-amber-600 bg-amber-100', border: 'border-amber-200' },
                  ].map(({ label, value, icon: Icon, color, border }) => (
                    <div key={label} className={`bg-white p-5 rounded-2xl border ${border} shadow-sm flex items-center gap-4`}>
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-2xl font-black text-slate-900 leading-none">{value}</div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-1">{label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Filters */}
                <div className="flex flex-col gap-3 border-y border-slate-100 p-5 sm:px-8 bg-white shrink-0 xl:flex-row relative z-20">
                  <div className="relative flex-1">
                    <FaSearch className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={profileSearch}
                      onChange={(event) => setProfileSearch(event.target.value)}
                      placeholder="Search intern name, ID, or team..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-11 text-sm font-medium outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100/50 focus:bg-white"
                    />
                    {profileSearch && (
                      <button onClick={() => setProfileSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full transition-colors">
                        <X className="w-3 h-3 text-slate-600" />
                      </button>
                    )}
                  </div>
                  <div className="relative min-w-[240px]">
                    <button
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition hover:bg-slate-100 focus:border-blue-400 focus:ring-4 focus:ring-blue-100/50"
                    >
                      <div className="flex items-center gap-2">
                         {(() => {
                           const filterOptions = [
                             { value: 'all', label: 'All Profiles', icon: Users },
                             { value: 'complete', label: 'Ready for Attendance', icon: CheckCircle },
                             { value: 'incomplete', label: 'Incomplete Samples', icon: AlertCircle },
                             { value: 'inactive', label: 'Not Enrolled', icon: X },
                           ];
                           const opt = filterOptions.find(o => o.value === profileFilter) || filterOptions[0];
                           return (
                             <>
                               <opt.icon className="h-4 w-4 text-blue-600" />
                               <span>{opt.label}</span>
                             </>
                           );
                         })()}
                      </div>
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    </button>
                    <AnimatePresence>
                      {isFilterOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 mt-2 w-full origin-top-right rounded-xl bg-white p-1.5 shadow-xl border border-slate-100 z-50"
                        >
                          {[
                             { value: 'all', label: 'All Profiles', icon: Users },
                             { value: 'complete', label: 'Ready for Attendance', icon: CheckCircle },
                             { value: 'incomplete', label: 'Incomplete Samples', icon: AlertCircle },
                             { value: 'inactive', label: 'Not Enrolled', icon: X },
                          ].map((option) => (
                             <button
                               key={option.value}
                               onClick={() => { setProfileFilter(option.value); setIsFilterOpen(false); }}
                               className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold rounded-lg transition-colors ${profileFilter === option.value ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                             >
                               <option.icon className={`h-4 w-4 ${profileFilter === option.value ? 'text-blue-600' : 'text-slate-400'}`} />
                               {option.label}
                             </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Table / List Area */}
                {profilesLoading ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-24 text-slate-500 bg-slate-50/50 flex-1">
                    <Loader className="h-8 w-8 animate-spin text-blue-500" />
                    <span className="font-bold tracking-wide">Loading Profiles...</span>
                  </div>
                ) : filteredProfiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-slate-500 bg-slate-50/50 flex-1">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <FaSearch className="h-6 w-6 text-slate-400" />
                    </div>
                    <span className="font-bold text-lg text-slate-700">No profiles found</span>
                    <span className="text-sm mt-1">Try adjusting your search or filters.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto overflow-y-auto flex-1 bg-white custom-scrollbar">
                    {/* Desktop Table View */}
                    <table className="hidden xl:table w-full min-w-[60rem] text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 w-[25%]">Intern Profile</th>
                          <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 text-center w-[20%]">University</th>
                          <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 text-center w-[15%]">Face Samples</th>
                          <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 text-center w-[20%]">Last Face Match</th>
                          <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 text-center w-[20%]">Enrollment Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedProfiles.map((profile) => (
                          <tr key={profile._id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-slate-100 overflow-hidden ring-2 ring-slate-100 group-hover:ring-blue-100 transition-colors shrink-0">
                                  <img
                                    src={`${API_BASE_URL}/interns/${profile.internId || profile._id}/profile-picture`}
                                    alt={profile.traineeName}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.traineeName)}&background=random`;
                                    }}
                                  />
                                </div>
                                <div>
                                  <div className="text-[13px] font-bold text-slate-900">{profile.traineeName}</div>
                                  <div className="text-[10px] font-bold text-slate-500 mt-0.5 tracking-wider">{profile.traineeId}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-left">
                              <div className="text-[13px] font-semibold text-slate-700">{profile.institute || 'No institute'}</div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="inline-flex items-center justify-center gap-2">
                                <div className="text-[13px] font-black text-slate-800">{profile.sampleCount} <span className="text-slate-400 font-medium">/ {REQUIRED_ENROLLMENT_SAMPLES}</span></div>
                                {profile.sampleCount > 0 && profile.sampleCount < REQUIRED_ENROLLMENT_SAMPLES && (
                                  <span className="w-2 h-2 rounded-full bg-amber-500" title="Incomplete samples"></span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="text-[13px] font-semibold text-slate-700">{formatDateTime(profile.lastMatchedAt)}</div>
                              {profile.enrolledAt && <div className="text-[9px] font-medium text-slate-400 mt-0.5">Enrolled: {formatDateTime(profile.enrolledAt)}</div>}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                                profile.isComplete
                                  ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                                  : profile.isActive
                                    ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                                    : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                              }`}>
                                {profile.isComplete && <FaCheckCircle className="h-3 w-3" />}
                                {profile.isComplete ? 'Ready' : profile.isActive ? 'Incomplete' : 'Not Enrolled'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Mobile Card View */}
                    <div className="flex flex-col gap-4 p-4 xl:hidden bg-slate-50/50">
                      {paginatedProfiles.map((profile) => (
                        <div key={`mobile-${profile._id}`} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-4">
                          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                            <div className="h-12 w-12 rounded-full bg-slate-100 overflow-hidden ring-2 ring-slate-100 shrink-0">
                              <img
                                src={`${API_BASE_URL}/interns/${profile.internId || profile._id}/profile-picture`}
                                alt={profile.traineeName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.traineeName)}&background=random`;
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-slate-900 truncate">{profile.traineeName}</div>
                              <div className="text-[11px] font-bold text-slate-500 tracking-wider truncate mt-0.5">{profile.traineeId}</div>
                              <div className="text-[12px] font-semibold text-slate-700 truncate mt-1">{profile.institute || 'No institute'}</div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Face Samples</span>
                              <div className="text-sm font-black text-slate-800 flex items-center justify-center gap-1.5">
                                {profile.sampleCount} <span className="text-slate-400 font-medium text-xs">/ {REQUIRED_ENROLLMENT_SAMPLES}</span>
                                {profile.sampleCount > 0 && profile.sampleCount < REQUIRED_ENROLLMENT_SAMPLES && (
                                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                )}
                              </div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status</span>
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                                profile.isComplete ? 'bg-emerald-100 text-emerald-700' : profile.isActive ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {profile.isComplete ? 'Ready' : profile.isActive ? 'Incomplete' : 'Not Enrolled'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-center justify-center text-center pt-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Match</span>
                            <div className="text-[13px] font-bold text-slate-700">{formatDateTime(profile.lastMatchedAt)}</div>
                            {profile.enrolledAt && <div className="text-[10px] font-medium text-slate-400 mt-0.5">Enrolled: {formatDateTime(profile.enrolledAt)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {filteredProfiles.length > paginatedProfiles.length && (
                      <div className="w-full flex justify-center py-6 bg-slate-50/50 border-t border-slate-100">
                        <button
                          onClick={() => setProfilePage(p => p + 1)}
                          className="px-6 py-3 bg-white border border-slate-200 shadow-sm text-slate-700 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-xl text-sm font-bold transition-all"
                        >
                          Load More Profiles ({filteredProfiles.length - paginatedProfiles.length} remaining)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.section>
              </div>
            </div>
          </>
        )}
        </AnimatePresence>

      </main>
    </AdminNavigation>
  );
};

export default AdminFaceAttendance;
