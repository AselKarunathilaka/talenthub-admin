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
  const [mode, setMode] = useState("daily"); // "enroll", "daily", "meeting"
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIntern, setSelectedIntern] = useState(null);
  
  // Camera & Face logic
  const [cameraActive, setCameraActive] = useState(false);
  const [enrollmentFrames, setEnrollmentFrames] = useState([]);
  const [faceGuide, setFaceGuide] = useState({ ready: false, message: "Center face in the oval" });
  const [meetingTitle, setMeetingTitle] = useState("");
  const [videoDims, setVideoDims] = useState({ width: 640, height: 480 });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const meshCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const liveDescriptorRef = useRef(null);
  const enrollmentFramesRef = useRef([]);
  const lastAutoCaptureRef = useRef(0);
  const inspectBusyRef = useRef(false);
  const submitStartedRef = useRef(false);

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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 720 }, height: { ideal: 540 }, aspectRatio: { ideal: 4 / 3 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      lastAutoCaptureRef.current = Date.now();
      submitStartedRef.current = false;
      setEnrollmentFrames([]);
      setCameraActive(true);
      await attachStreamToVideo();
    } catch (error) {
      toast.error("Camera access failed. Please check permissions.");
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
        const frameData = await captureFrameForDescriptor();
        if (cancelled) return;
        if (!frameData || frameData.error) {
          liveDescriptorRef.current = null;
          setFaceGuide({ ready: false, message: frameData?.error || "Center face in oval" });
          return;
        }

        liveDescriptorRef.current = frameData.descriptor;
        
        if (mode !== "enroll") {
          setFaceGuide({ ready: true, message: "Face is ready. You can mark attendance." });
          return;
        }

        const currentFrames = enrollmentFramesRef.current;
        if (currentFrames.length >= REQUIRED_ENROLLMENT_SAMPLES) return;
        if (Date.now() - lastAutoCaptureRef.current < ENROLLMENT_CAPTURE_DELAY_MS) return;

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
    const timer = setInterval(inspectFace, 700);
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
    const frameData = liveDescriptorRef.current ? { descriptor: liveDescriptorRef.current } : await captureFrameForDescriptor();
    
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

  if (!modelsLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-sm w-full text-center">
          <Loader className="w-10 h-10 animate-spin mx-auto text-blue-600 mb-4" />
          <h2 className="text-lg font-semibold text-slate-900">Loading AI Models</h2>
          <p className="text-sm text-slate-500 mt-2">Preparing face recognition...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminNavigation>
      <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 relative">
      <div className="max-w-4xl mx-auto">
        

        {/* ── Header ── */}
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
        </div>

        <div className="grid md:grid-cols-[340px_1fr] gap-6">
          {/* Sidebar Controls */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                1. Select Intern
              </label>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    handleSearch(e.target.value);
                    if (selectedIntern) setSelectedIntern(null);
                  }}
                  placeholder="Search by name or ID..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(""); setSearchResults([]); setSelectedIntern(null); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>
              
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2 max-h-48 overflow-y-auto">
                    {searchResults.map((intern) => (
                      <InternCard key={intern._id} intern={intern} onSelect={handleSelectIntern} selected={selectedIntern?._id === intern._id} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              
              {selectedIntern && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">{selectedIntern.Trainee_Name}</p>
                    <p className="text-xs text-blue-700">{selectedIntern.Trainee_ID}</p>
                  </div>
                </div>
              )}
            </div>

            <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 transition-opacity ${!selectedIntern ? 'opacity-50 pointer-events-none' : ''}`}>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                2. Select Action
              </label>
              <div className="space-y-2">
                {[
                  { id: "enroll", label: "Face Enrollment", icon: Camera },
                  { id: "daily", label: "Daily Attendance", icon: UserCheck },
                  { id: "meeting", label: "Meeting Attendance", icon: Video }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { setMode(opt.id); stopCamera(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition ${
                      mode === opt.id ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <opt.icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>

              {mode === "meeting" && (
                <div className="mt-4 space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    placeholder="Meeting Title"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Camera Feed Area */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 overflow-hidden flex flex-col">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              3. Camera View
            </label>
            
            <div className="relative flex-1 bg-slate-950 rounded-lg overflow-hidden min-h-[300px] flex items-center justify-center border border-slate-800">
              {loading && (
                <div className="absolute inset-0 z-50 bg-slate-950/80 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                  <Loader className="w-8 h-8 animate-spin mb-3 text-blue-500" />
                  <p className="text-sm font-medium">Processing...</p>
                </div>
              )}

              {!cameraActive ? (
                <div className="text-center p-6">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <Camera className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-slate-200 font-medium mb-2">Camera is inactive</h3>
                  <p className="text-slate-400 text-sm mb-6">Select an intern and action, then start the camera.</p>
                  <button
                    onClick={startCamera}
                    disabled={!selectedIntern || loading}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
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
                  <div className="absolute top-4 inset-x-4 z-20 flex justify-between items-start">
                    <div className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow-md backdrop-blur-md border ${
                      faceGuide.ready ? "bg-emerald-500/20 text-emerald-100 border-emerald-500/50" : "bg-red-500/20 text-red-100 border-red-500/50"
                    }`}>
                      {faceGuide.message}
                    </div>
                    
                    <button onClick={stopCamera} className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 backdrop-blur-sm">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mode specific controls overlay */}
                  <div className="absolute bottom-6 inset-x-6 z-20">
                    {mode === "enroll" ? (
                      <div className="bg-black/60 backdrop-blur-md rounded-xl p-4 border border-white/10">
                        <div className="flex justify-between text-xs text-slate-300 font-medium mb-2">
                          <span>Enrollment Progress</span>
                          <span>{enrollmentFrames.length} / {REQUIRED_ENROLLMENT_SAMPLES}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${(enrollmentFrames.length / REQUIRED_ENROLLMENT_SAMPLES) * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleMarkAttendance}
                        disabled={!faceGuide.ready}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-xl font-bold shadow-lg transition"
                      >
                        Mark Attendance
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </AdminNavigation>
  );
};

export default AdminFaceAttendance;
