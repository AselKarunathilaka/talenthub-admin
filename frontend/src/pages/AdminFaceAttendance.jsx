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
const FACE_GUIDE_INTERVAL_MS = 500;
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
  
  // Draw an oval guide at the center of the canvas
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radiusX = canvas.width * 0.16; // proportional to width
  const radiusY = canvas.height * 0.28; // proportional to height

  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);

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
const InternCard = ({ intern, onSelect, selected }) => (
  <button
    onClick={() => onSelect(intern)}
    className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
      selected
        ? "border-blue-400 bg-blue-50 shadow-sm"
        : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
    }`}
  >
    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0">
      <UserCheck className="text-indigo-500 w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-slate-900 truncate">
        {intern.Trainee_Name}
      </p>
      <p className="text-xs text-slate-500 truncate">
        {intern.Trainee_ID} · {intern.team || "No team"}
      </p>
    </div>
    {selected && <CheckCircle className="text-blue-500 h-4 w-4 flex-shrink-0" />}
  </button>
);

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
  const [showProfilesModal, setShowProfilesModal] = useState(false);
  
  // Camera & Face logic
  const [cameraActive, setCameraActive] = useState(false);
  const [enrollmentFrames, setEnrollmentFrames] = useState([]);
  const [faceGuide, setFaceGuide] = useState({ ready: false, message: "Center face in the oval" });
  const [meetingTitle, setMeetingTitle] = useState("");
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
    fetchEnrollmentProfiles();
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
    stopCamera();
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
      );

      if (detections.length !== 1) {
        return {
          error:
            detections.length === 0
              ? "No face detected."
              : "More than one face detected.",
        };
      }

      const { box } = detections[0];
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
                : "Face is ready. You can mark attendance.",
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
      stopCamera();
    } catch (err) {
      toast.error(err.message || "Failed to verify face.");
      if (err.message && err.message.includes("already out of office")) {
        stopCamera();
      }
    } finally {
      setLoading(false);
    }
  };



  return (
    <AdminNavigation>
      <div className="min-h-screen bg-slate-50 font-sans text-gray-800 pb-10 flex flex-col">
        <div className="flex-1 w-full lg:mt-4 lg:px-6 xl:px-10">
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
            
            {/* Header Section */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
                >
                  <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl">
                    <ScanFace className="text-[#0056a2] h-8 w-8" />
                  </div>
                  Face ID
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
                >
                  Enroll faces or mark camera attendance on behalf of interns.
                </motion.p>
              </div>

              <div>
                <motion.button
                  type="button"
                  onClick={openProfilesModal}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FaUsers className="h-4 w-4 text-[#0056a2]" />
                  <span>Face Enrollment Profiles</span>
                </motion.button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3 lg:gap-8 items-stretch">
              
              {/* Sidebar Configuration */}
              <motion.div 
                className="lg:col-span-1 space-y-6 h-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 relative overflow-hidden h-full flex flex-col">

                  <div className="relative z-10 flex-1 flex flex-col">
                    <h3 className="text-xl font-extrabold text-gray-900 mb-8">Configuration</h3>
                    
                    {/* Switcher */}
                    <div className="flex mb-8 bg-gray-50 p-1.5 rounded-2xl shadow-inner border border-gray-200/60 w-full relative">
                      <button
                        onClick={() => { setMode("meeting"); stopCamera(); }}
                        className={`relative z-10 flex-1 py-3 px-1 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center ${
                          mode === "meeting" ? "text-white" : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <span>Meeting</span>
                      </button>
                      <button
                        onClick={() => { setMode("daily"); stopCamera(); }}
                        className={`relative z-10 flex-1 py-3 px-1 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center ${
                          mode === "daily" ? "text-white" : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <span>Daily</span>
                      </button>
                      <button
                        onClick={() => { setMode("enroll"); stopCamera(); }}
                        className={`relative z-10 flex-1 py-3 px-1 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center ${
                          mode === "enroll" ? "text-white" : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <span>Enrol</span>
                      </button>

                      <div
                        className="absolute top-1.5 bottom-1.5 rounded-xl transition-all duration-300 ease-out shadow-sm"
                        style={{
                          width: "calc(33.333% - 4px)",
                          background:
                            mode === "meeting"
                              ? "linear-gradient(135deg, #00b4eb 0%, #0056a2 100%)" // Blue
                              : mode === "daily"
                              ? "linear-gradient(135deg, #50b748 0%, #2e7d32 100%)" // Green
                              : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", // Yellow
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
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
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
                            className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-blue-100 focus:border-[#00b4eb] transition-all outline-none"
                          />
                          {searchQuery && (
                            <button onClick={() => { setSearchQuery(""); setSearchResults([]); setSelectedIntern(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors">
                              <X className="w-3 h-3 text-gray-600" />
                            </button>
                          )}
                        </div>
                        
                        <AnimatePresence>
                          {searchResults.length > 0 && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2 max-h-48 overflow-y-auto mb-4 custom-scrollbar">
                              {searchResults.map((intern) => (
                                <InternCard key={intern._id} intern={intern} onSelect={handleSelectIntern} selected={selectedIntern?._id === intern._id} />
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {selectedIntern && (
                          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100/60 flex items-center gap-4 mt-2">
                            <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                              <CheckCircle className="w-5 h-5 text-[#0056a2]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">{selectedIntern.Trainee_Name}</p>
                              <p className="text-xs font-semibold text-gray-500 truncate">{selectedIntern.Trainee_ID}</p>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      <AnimatePresence mode="wait">
                        {mode === 'meeting' && (
                          <motion.div key="meeting-form" initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -10, height: 0 }} className="space-y-4">
                            <label className="block">
                              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Meeting Title</span>
                              <input
                                type="text"
                                placeholder="e.g. Weekly Standup"
                                value={meetingTitle}
                                onChange={(e) => setMeetingTitle(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-[#00b4eb] transition-all font-semibold text-gray-800 outline-none text-sm"
                              />
                            </label>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Main Camera Display */}
              <motion.div 
                className="lg:col-span-2 space-y-6 h-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 min-h-[400px] lg:min-h-[500px] flex flex-col relative overflow-hidden h-full">
                  
                  <div className="relative flex-1 bg-slate-950 rounded-2xl overflow-hidden min-h-[300px] flex items-center justify-center border-4 border-slate-900 shadow-inner">
                    {loading && (
                      <div className="absolute inset-0 z-50 bg-slate-950/80 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                        <Loader className="w-10 h-10 animate-spin mb-4 text-[#00b4eb]" />
                        <p className="text-sm font-semibold tracking-wide">Processing...</p>
                      </div>
                    )}

                    {!modelsLoaded ? (
                      <div className="text-center p-6 max-w-sm flex flex-col items-center justify-center h-full text-slate-300">
                        <Loader className="w-12 h-12 animate-spin mb-4 text-blue-500" />
                        <h3 className="text-slate-100 font-bold text-xl mb-2">Loading AI Models</h3>
                        <p className="text-slate-400 text-sm font-medium">Downloading neural network assets...</p>
                      </div>
                    ) : !cameraActive ? (
                      <div className="text-center p-6 max-w-sm flex flex-col items-center justify-center h-full">
                        <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-6 shadow-inner">
                          <Camera className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-slate-200 font-bold text-lg mb-2">Camera is inactive</h3>
                        <p className="text-slate-400 text-sm mb-8 font-medium">Select an intern and action in the configuration panel, then start the camera.</p>
                        <button
                          onClick={startCamera}
                          disabled={!selectedIntern || loading}
                          className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                        >
                          Start Camera
                        </button>
                      </div>
                    ) : (
                      <>
                        <video
                          ref={videoRef}
                          className="absolute inset-0 w-full h-full object-cover"
                          style={{ transform: "scaleX(-1)" }}
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
                          className="absolute inset-0 w-full h-full object-cover z-10"
                          style={{ transform: "scaleX(-1)" }}
                        />
                        
                        {/* Overlay Guides */}
                        <div className="absolute top-4 inset-x-4 sm:top-6 sm:inset-x-6 z-20 flex justify-between items-start">
                          <div className={`px-4 py-2 rounded-xl text-sm font-bold shadow-lg backdrop-blur-md border ${
                            faceGuide.ready ? "bg-emerald-500/80 text-white border-emerald-400" : "bg-slate-900/80 text-white border-slate-700"
                          }`}>
                            {faceGuide.message}
                          </div>
                          
                          <button onClick={stopCamera} className="w-10 h-10 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors backdrop-blur-md border border-slate-700 shadow-lg">
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Mode specific controls overlay */}
                        <div className="absolute bottom-6 inset-x-6 z-20">
                          {mode === "enroll" ? (
                            <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-5 border border-slate-700 shadow-2xl">
                              <div className="flex justify-between text-sm text-slate-200 font-bold mb-3">
                                <span>Enrollment Progress</span>
                                <span className="text-blue-400">{enrollmentFrames.length} / {REQUIRED_ENROLLMENT_SAMPLES}</span>
                              </div>
                              <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                <div 
                                  className="h-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] transition-all duration-300"
                                  style={{ width: `${(enrollmentFrames.length / REQUIRED_ENROLLMENT_SAMPLES) * 100}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={handleMarkAttendance}
                              disabled={!faceGuide.ready}
                              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-400 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98]"
                            >
                              Mark Attendance
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>

            </div>
          </main>
        </div>

        <AnimatePresence>
        {showProfilesModal && (
          <motion.div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-950/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(event) => event.target === event.currentTarget && setShowProfilesModal(false)}
          >
            <motion.section
              className="max-h-[95vh] sm:max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl sm:rounded-3xl border border-gray-100 bg-white shadow-2xl flex flex-col"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
            >
              <div className="flex flex-col gap-4 border-b border-gray-100 p-4 sm:px-6 sm:py-5 sm:flex-row sm:items-center sm:justify-between bg-white z-10 relative shadow-sm shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Face Enrollment Profiles</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Interns registered for face daily and meeting attendance.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={fetchEnrollmentProfiles}
                    disabled={profilesLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FaRedo className={`h-3.5 w-3.5 text-[#00b4eb] ${profilesLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProfilesModal(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-800"
                    aria-label="Close face enrollment profiles"
                    title="Close"
                  >
                    <FaTimes className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-px bg-gray-100 z-0 shrink-0">
                {[
                  { label: 'Total Interns', value: enrollmentData.stats.totalInterns || 0, icon: FaUsers, color: 'text-[#0056a2] bg-[#00b4eb]/10' },
                  { label: 'Enrolled Interns', value: enrollmentData.stats.enrolled || 0, icon: FaUserCheck, color: 'text-[#15803d] bg-[#50b748]/10' },
                  { label: 'Not Enrolled Interns', value: enrollmentData.stats.notEnrolled || 0, icon: FaUserClock, color: 'text-rose-700 bg-rose-50' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-white p-3 sm:px-6 sm:py-5 flex flex-col items-center sm:items-start text-center sm:text-left">
                    <div className={`inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="mt-2 sm:mt-4 text-xl sm:text-3xl font-black text-gray-900 leading-none">{value}</div>
                    <div className="text-[9px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-wider text-gray-500 mt-1 sm:mt-1">{label}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:px-6 sm:py-4 sm:flex-row bg-slate-50 z-0 shrink-0">
                <div className="relative flex-1">
                  <FaSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={profileSearch}
                    onChange={(event) => setProfileSearch(event.target.value)}
                    placeholder="Search intern name, ID, email or team"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium outline-none transition focus:border-[#00b4eb] focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <select
                  value={profileFilter}
                  onChange={(event) => setProfileFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium outline-none transition focus:border-[#00b4eb] focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">All profiles</option>
                  <option value="complete">Ready for attendance</option>
                  <option value="incomplete">Incomplete profiles</option>
                  <option value="inactive">Inactive profiles</option>
                </select>
              </div>

              {profilesLoading ? (
                <div className="flex items-center justify-center gap-3 py-20 text-sm font-medium text-gray-500 bg-white flex-1">
                  <FaSpinner className="h-5 w-5 animate-spin text-[#00b4eb]" />
                  Loading enrollment profiles...
                </div>
              ) : filteredProfiles.length === 0 ? (
                <div className="py-20 text-center text-sm font-medium text-gray-500 bg-white flex-1">
                  No face enrollment profiles found.
                </div>
              ) : (
                <div className="overflow-x-auto overflow-y-auto flex-1 bg-white min-h-0 min-w-0">
                  <table className="w-full min-w-[58rem] divide-y divide-gray-100">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      <tr>
                        {['Intern', 'Team / Institute', 'Enrollment', 'Samples', 'Last Face Match', 'Status'].map((label) => (
                          <th key={label} className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredProfiles.map((profile) => (
                        <tr key={profile._id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-gray-900">{profile.traineeName}</div>
                            <div className="text-xs font-medium text-gray-500 mt-0.5">{profile.traineeId} · {profile.email || 'No email'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-semibold text-gray-800">{profile.team || 'Not assigned'}</div>
                            <div className="text-xs font-medium text-gray-500 mt-0.5">{profile.institute || 'Not specified'}</div>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-600">{formatDateTime(profile.enrolledAt)}</td>
                          <td className="px-6 py-4 text-sm font-black text-gray-800">{profile.sampleCount}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-600">{formatDateTime(profile.lastMatchedAt)}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
                              profile.isComplete
                                ? 'bg-[#50b748]/10 text-[#15803d]'
                                : profile.isActive
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-gray-100 text-gray-600'
                            }`}>
                              {profile.isComplete && <FaCheckCircle className="h-3 w-3" />}
                              {profile.isComplete ? 'Ready' : profile.isActive ? 'Incomplete' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.section>
          </motion.div>
        )}
        </AnimatePresence>

      </div>
    </AdminNavigation>
  );
};

export default AdminFaceAttendance;
