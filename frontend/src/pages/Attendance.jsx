import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle,
  Loader,
  MapPin,
  QrCode,
  ScanLine,
  ShieldCheck,
  Square,
  Users,
  X,
  XCircle,
  Scan,
  Info,
  ChevronRight
} from "lucide-react";
import * as faceapi from "face-api.js";
import toast from "react-hot-toast";
import { BrowserMultiFormatReader } from "@zxing/library";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Navigation from "../components/Navigation";
import SectionTip from "../components/SectionTip";
import FaceScanGuide from "../components/FaceScanGuide";
import WhatsAppSupportButton from "../components/WhatsAppSupportButton";
import DailyAttendanceActionControl from "../components/DailyAttendanceActionControl";
import { apiFetch } from "../utils/api";
import { useDailyAttendanceStatus } from "../hooks/useDailyAttendanceStatus";
import { clearFaceMesh, drawFaceMesh } from "../utils/faceMesh";
import {
  getDeviceTimeEvidence,
  requestFreshLocation,
  toAttendanceEvidence,
} from "../utils/attendanceEvidence";
import { getCameraErrorMessage, requestFaceCameraStream } from "../utils/cameraAccess";

const SLT_OFFICE = {
  latitude: 6.9271,
  longitude: 79.8612,
  radiusKm: 2,
};

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
const REQUIRED_ENROLLMENT_SAMPLES = 5;
const ENROLLMENT_CAPTURE_DELAY_MS = 1900;
const ENROLLMENT_PROMPTS = [
  "Look straight at the camera and hold still.",
  "Turn your head slightly to the left.",
  "Return to the center and hold still.",
  "Turn your head slightly to the right.",
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
const normalizeProjectName = (value) => String(value || "").trim().replace(/\s+/g, " ");
const getProjectKey = (value) => normalizeProjectName(value);

const validateQRCodeFormat = (qrCode, scanMode, projectName = "") => {
  if (!qrCode || typeof qrCode !== "string") return false;

  if (scanMode === "daily") {
    if (!qrCode.includes("daily_attendance_") && !qrCode.includes("attendance_session_")) {
      return false;
    }
    const qrCodeParts = qrCode.split("_");
    const timestamp = parseInt(qrCodeParts[qrCodeParts.length - 1], 10);
    return !Number.isNaN(timestamp);
  }

  try {
    const parsed = JSON.parse(qrCode);
    const qrProjectName = normalizeProjectName(parsed.projectName || parsed.meetingTitle || "");
    return (
      parsed.type === "meeting_attendance" &&
      qrProjectName &&
      (!projectName.trim() || getProjectKey(qrProjectName) === getProjectKey(projectName)) &&
      (!parsed.timestamp || !Number.isNaN(parseInt(parsed.timestamp, 10)))
    );
  } catch {
    return false;
  }
};

const getDistanceKm = (fromLocation, officeLocation = SLT_OFFICE) => {
  if (!fromLocation) return null;

  const earthRadiusKm = 6371;
  const dLat = ((fromLocation.latitude - officeLocation.latitude) * Math.PI) / 180;
  const dLng = ((fromLocation.longitude - officeLocation.longitude) * Math.PI) / 180;
  const officeLatRad = (officeLocation.latitude * Math.PI) / 180;
  const currentLatRad = (fromLocation.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(officeLatRad) *
      Math.cos(currentLatRad) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

const Attendance = () => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const [activeTab, setActiveTab] = useState("meeting"); // "meeting" or "daily"
  const [activeMethod, setActiveMethod] = useState("face"); // "face" or "qr"
  const [mode, setMode] = useState("recognize"); // "recognize" or "enroll" (for face)
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [enrollmentFrames, setEnrollmentFrames] = useState([]);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [sltLocationRequired, setSltLocationRequired] = useState(true);
  const [officeLocation, setOfficeLocation] = useState(SLT_OFFICE);
  const [cooldown, setCooldown] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [projectName, setProjectName] = useState("");
  const [meetingPin, setMeetingPin] = useState("");
  const [qrScanning, setQrScanning] = useState(false);
  const [qrProcessing, setQrProcessing] = useState(false);
  const [qrScanSuccess, setQrScanSuccess] = useState(false);
  const [faceGuide, setFaceGuide] = useState({
    ready: false,
    message: "Center your face inside the oval",
  });
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(false);
  const {
    attendanceAction,
    setAttendanceAction,
    status: dailyAttendanceStatus,
    statusLoading: dailyStatusLoading,
    refreshDailyStatus,
  } = useDailyAttendanceStatus();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const meshCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const qrVideoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const processedQrRef = useRef(false);
  const liveDescriptorRef = useRef(null);
  const enrollmentFramesRef = useRef([]);
  const lastAutoCaptureRef = useRef(0);
  const inspectBusyRef = useRef(false);
  const stableFaceChecksRef = useRef(0);
  const enrollmentSubmitStartedRef = useRef(false);

  const distanceKm = getDistanceKm(location, officeLocation);
  const actualLocationValid = distanceKm !== null && distanceKm <= officeLocation.radiusKm;
  const locationValid = !sltLocationRequired || actualLocationValid;
  const meetingDetailsReadyFace = projectName.trim().length > 0 && /^\d{6}$/.test(meetingPin.trim());
  const meetingDetailsReadyQr = projectName.trim().length > 0;
  const attendanceLocationReady = locationValid;
  const dailyAttendanceCompleted =
    activeTab === "daily" && dailyAttendanceStatus.state === "checked_out";
  
  const canStartCamera =
    modelsLoaded &&
    (mode === "enroll" ||
    (attendanceLocationReady &&
      !dailyAttendanceCompleted &&
      (activeTab !== "meeting" || meetingDetailsReadyFace)));
  
  const canStartQr =
    attendanceLocationReady &&
    !dailyAttendanceCompleted &&
    (activeTab !== "meeting" || meetingDetailsReadyQr);

  const enrollmentProgress = Math.min(enrollmentFrames.length, REQUIRED_ENROLLMENT_SAMPLES);

  const attachStreamToVideo = async () => {
    if (!videoRef.current || !streamRef.current) return;

    videoRef.current.srcObject = streamRef.current;
    try {
      await videoRef.current.play();
    } catch (error) {
      console.warn("Camera preview autoplay was blocked:", error);
    }
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(""), 3500);
  };

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
        toast.error("Face recognition models could not be loaded.");
      }
    };

    loadModels();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await apiFetch("/face-attendance/settings");
        const result = await response.json();
        setSltLocationRequired(result.settings?.sltLocationRequired !== false);
        if (result.settings?.locationPolicy) {
          setOfficeLocation({
            latitude: result.settings.locationPolicy.latitude,
            longitude: result.settings.locationPolicy.longitude,
            radiusKm: result.settings.locationPolicy.radiusMeters / 1000,
          });
        }
      } catch (error) {
        console.error("Failed to load attendance settings:", error);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    requestFreshLocation()
      .then((freshLocation) => {
        setLocation({
          latitude: freshLocation.latitude ?? freshLocation.lat ?? null,
          longitude: freshLocation.longitude ?? freshLocation.lng ?? null,
          accuracy: freshLocation.accuracy ?? null,
          capturedAt: freshLocation.capturedAt ?? null,
        });
        setLocationError("");
      })
      .catch((error) => {
        console.warn("Geolocation error:", error);
        setLocationError(error.message);
      });
  }, []);

  const getFreshAttendanceLocation = async () => {
    if (!sltLocationRequired) return location;

    const freshLocation = await requestFreshLocation();
    setLocation({
          latitude: freshLocation.latitude ?? freshLocation.lat ?? null,
          longitude: freshLocation.longitude ?? freshLocation.lng ?? null,
          accuracy: freshLocation.accuracy ?? null,
          capturedAt: freshLocation.capturedAt ?? null,
        });
    setLocationError("");
    return freshLocation;
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
    setFaceGuide({ ready: false, message: "Center your face inside the oval" });
  };

  const stopQRScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.reset();
      qrScannerRef.current = null;
    }

    processedQrRef.current = false;
    setQrScanning(false);
    setQrProcessing(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      stopQRScanner();
    };
  }, []);

  useEffect(() => {
    if (cameraActive) {
      attachStreamToVideo();
    }
  }, [cameraActive]);

  const switchMethod = (method) => {
    stopCamera();
    stopQRScanner();
    setActiveMethod(method);
  };

  const switchTab = (tab) => {
    stopCamera();
    stopQRScanner();
    setActiveTab(tab);
    setProjectName("");
    setMeetingPin("");
  };

  const requireValidLocation = (message) => {
    if (!sltLocationRequired) return true;
    if (locationValid) return true;

    toast.error(locationError || message);
    return false;
  };

  const validateMeetingPinBeforeCamera = async () => {
    const response = await apiFetch("/face-attendance/meeting-pin/validate", {
      method: "POST",
      body: JSON.stringify({
        projectName: normalizeProjectName(projectName),
        meetingPin: meetingPin.trim(),
      }),
    });
    const result = await response.json();

    if (!response.ok || !result.valid) {
      throw new Error(result.message || "Invalid or expired face attendance PIN.");
    }

    return result;
  };

  const startCamera = async () => {
    if (
      mode !== "enroll" &&
      activeTab === "meeting" &&
      sltLocationRequired &&
      !actualLocationValid
    ) {
      toast.error(locationError || "You must be within SLT office radius to mark meeting attendance.");
      return;
    }

    if (mode !== "enroll" && !requireValidLocation("You must be within SLT office radius.")) return;
    if (mode !== "enroll" && activeTab === "meeting") {
      if (!projectName.trim()) {
        toast.error("Enter the project name before starting the camera.");
        return;
      }

      if (!/^\d{6}$/.test(meetingPin.trim())) {
        toast.error("Enter the 6-digit meeting PIN before starting the camera.");
        return;
      }

      try {
        setLoading(true);
        await validateMeetingPinBeforeCamera();
      } catch (error) {
        toast.error(error.message || "Invalid or expired face attendance PIN.");
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    try {
      const stream = await requestFaceCameraStream();

      streamRef.current = stream;
      lastAutoCaptureRef.current = Date.now();
      enrollmentSubmitStartedRef.current = false;
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
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);

    try {
      const detections = await faceapi
        .detectAllFaces(canvasRef.current, FACE_DETECTOR_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length !== 1) {
        clearFaceMesh(meshCanvasRef.current);
        return {
          error:
            detections.length === 0
              ? "No face detected. Center your face in the frame."
              : "More than one face detected. Only one person should be in frame.",
        };
      }

      const detection = detections[0];
      drawFaceMesh(meshCanvasRef.current, detection.landmarks);
      const { box } = detection.detection;
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const centered =
        Math.abs(centerX - 320) <= 105 &&
        Math.abs(centerY - 240) <= 95;
      const largeEnough = box.width >= 135 && box.height >= 150;

      if (!centered) {
        return { error: "Move your face into the center oval." };
      }

      if (!largeEnough) {
        return { error: "Move a little closer to the camera." };
      }

      return { descriptor: Array.from(detection.descriptor) };
    } catch (error) {
      clearFaceMesh(meshCanvasRef.current);
      console.error("Error extracting face descriptor:", error);
      return { error: "Could not read face data from the camera frame." };
    }
  };

  const inspectFacePosition = async () => {
    if (!videoRef.current || !canvasRef.current) return null;

    const ctx = canvasRef.current.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);

    try {
      const detections = await faceapi.detectAllFaces(
        canvasRef.current,
        FACE_GUIDE_DETECTOR_OPTIONS,
      );

      if (detections.length !== 1) {
        return {
          error:
            detections.length === 0
              ? "No face detected. Center your face in the frame."
              : "More than one face detected. Only one person should be in frame.",
        };
      }

      const { box } = detections[0];
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const centered = Math.abs(centerX - 320) <= 105 && Math.abs(centerY - 240) <= 95;
      const largeEnough = box.width >= 135 && box.height >= 150;

      if (!centered) return { error: "Move your face into the center oval." };
      if (!largeEnough) return { error: "Move a little closer to the camera." };

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
    if (!cameraActive || activeMethod !== "face") return undefined;

    let cancelled = false;
    const inspectFace = async () => {
      if (inspectBusyRef.current) return;
      if (
        mode === "enroll" &&
        enrollmentFramesRef.current.length >= REQUIRED_ENROLLMENT_SAMPLES
      ) {
        setFaceGuide({
          ready: true,
          message: "Face samples are ready. Complete enrollment.",
        });
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
            message: positionData?.error || "Center your face inside the oval",
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
              ? enrollmentFramesRef.current.length >= REQUIRED_ENROLLMENT_SAMPLES
                ? "Face samples are ready. Complete enrollment."
                : ENROLLMENT_PROMPTS[enrollmentFramesRef.current.length]
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
        const isDistinct =
          !previousFrame ||
          Math.sqrt(
            previousFrame.reduce((sum, value, index) => {
              const difference = value - frameData.descriptor[index];
              return sum + difference * difference;
            }, 0),
          ) >= 0.035;

        if (!isDistinct) {
          setFaceGuide({ ready: true, message: ENROLLMENT_PROMPTS[currentFrames.length] });
          return;
        }

        lastAutoCaptureRef.current = Date.now();
        setEnrollmentFrames((frames) => [...frames, frameData.descriptor]);
        setFaceGuide({
          ready: true,
          message:
            currentFrames.length + 1 >= REQUIRED_ENROLLMENT_SAMPLES
              ? "Face samples are ready. Complete enrollment."
              : ENROLLMENT_PROMPTS[currentFrames.length + 1],
        });
      } finally {
        inspectBusyRef.current = false;
      }
    };

    inspectFace();
    const timer = window.setInterval(inspectFace, FACE_GUIDE_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [cameraActive, mode, activeMethod]);

  const completeEnrollment = async () => {
    if (enrollmentFrames.length < REQUIRED_ENROLLMENT_SAMPLES) {
      toast.error("Hold still until all clear face samples are captured.");
      return;
    }
    if (enrollmentSubmitStartedRef.current) return;

    enrollmentSubmitStartedRef.current = true;
    stopCamera();
    setLoading(true);
    try {
      for (const [index, descriptor] of enrollmentFrames.entries()) {
        const response = await apiFetch("/face-attendance/enroll", {
          method: "POST",
          body: JSON.stringify({
            descriptor,
            metadata: {
              location: location || null,
              enrollmentMethod: "face-attendance-page-guided",
              replaceExisting: index === 0,
              ...getDeviceTimeEvidence(),
            },
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          toast.error(result.message || "Face enrollment failed.");
          return;
        }
      }

      toast.success("Face enrolled successfully.");
      showSuccess("Face profile is ready for attendance.");
      setEnrollmentSuccess(true);
      setMode("recognize");
      setEnrollmentFrames([]);
      window.setTimeout(() => setEnrollmentSuccess(false), 1800);
    } catch (error) {
      console.error("Enrollment error:", error);
      toast.error("Enrollment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      mode === "enroll" &&
      enrollmentFrames.length >= REQUIRED_ENROLLMENT_SAMPLES &&
      !enrollmentSubmitStartedRef.current
    ) {
      completeEnrollment();
    }
  }, [enrollmentFrames, mode]);

  const handleFaceRecognition = async () => {
    if (!requireValidLocation("You must be within SLT office radius to mark attendance.")) return;

    if (activeTab === "meeting" && !projectName.trim()) {
      toast.error("Enter the project name before marking meeting attendance.");
      return;
    }

    if (activeTab === "meeting" && !/^\d{6}$/.test(meetingPin.trim())) {
      toast.error("Enter the 6-digit meeting PIN from the meeting room.");
      return;
    }

    setLoading(true);
    let attendanceLocation;
    try {
      attendanceLocation = await getFreshAttendanceLocation();
    } catch (error) {
      setLocationError(error.message);
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Always use a fresh, full-quality descriptor for verification. The live
    // loop only checks positioning so it cannot submit an old camera frame.
    const frameData = await captureFreshDescriptorForVerification();

    if (!frameData || frameData.error) {
      toast.error(frameData?.error || "No face detected.");
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch("/face-attendance/scan", {
        method: "POST",
        body: JSON.stringify({
          descriptor: frameData.descriptor,
          attendanceType: activeTab,
          attendanceAction:
            activeTab === "daily" ? attendanceAction : undefined,
          projectName: activeTab === "meeting" ? projectName.trim() : undefined,
          meetingPin: activeTab === "meeting" ? meetingPin.trim() : undefined,
          metadata: {
            location: attendanceLocation || null,
            source: "browser-camera",
            projectName: activeTab === "meeting" ? projectName.trim() : undefined,
            meetingPin: activeTab === "meeting" ? meetingPin.trim() : undefined,
            ...getDeviceTimeEvidence(),
          },
        }),
      });

      const result = await response.json();

      if (response.ok) {
        const traineeName = result.intern?.traineeName || "you";
        toast.success(
          result.checkedOut
            ? `Check-out recorded for ${traineeName}.`
            : activeTab === "daily"
              ? `Check-in recorded for ${traineeName}.`
              : `Attendance marked for ${traineeName}.`,
        );
        showSuccess(
          activeTab === "meeting"
            ? "Daily and meeting attendance marked."
            : result.checkedOut
              ? "Check-out recorded successfully."
              : "Check-in recorded successfully.",
        );
        stopCamera();
        setCooldown(true);
        if (activeTab === "daily") await refreshDailyStatus();
        window.setTimeout(() => setCooldown(false), 60000);
        return;
      }

      if (response.status === 400 && result.alreadyMarked) {
        toast.error("Attendance is already marked today.");
        showSuccess("Attendance already marked today.");
        stopCamera();
        setCooldown(true);
        window.setTimeout(() => setCooldown(false), 60000);
        return;
      }

      toast.error(result.message || "Face was not recognized. Try again or use QR backup.");
    } catch (error) {
      console.error("Face recognition error:", error);
      toast.error("Face recognition failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startQRScanner = async () => {
    if (!requireValidLocation("You must be within SLT office radius to use QR backup.")) return;

    if (activeTab === "meeting" && !projectName.trim()) {
      toast.error("Enter the project name before scanning.");
      return;
    }

    try {
      processedQrRef.current = false;
      const codeReader = new BrowserMultiFormatReader();
      qrScannerRef.current = codeReader;
      setQrScanning(true);

      await codeReader.decodeFromVideoDevice(null, qrVideoRef.current, async (result) => {
        if (!result || processedQrRef.current) return;

        const qrData = result.getText();
        if (!validateQRCodeFormat(qrData, activeTab, projectName)) {
          toast.error(
            activeTab === "daily"
              ? "Scan a valid daily attendance QR code."
              : "Scan the QR code generated for this project.",
          );
          return;
        }

        processedQrRef.current = true;
        setQrProcessing(true);
        setQrScanSuccess(true);

        try {
          const internId = localStorage.getItem("internId");
          const attendanceLocation = await getFreshAttendanceLocation();
          const payload = {
            qrCode: qrData,
            internId,
            ...toAttendanceEvidence(attendanceLocation),
          };

          const response = await apiFetch(
            activeTab === "daily" ? "/qrcode/scan" : "/qrcode/scan-meeting",
            {
              method: "POST",
              body: JSON.stringify(
                activeTab === "daily"
                  ? { ...payload, scanType: "daily", attendanceAction }
                  : { ...payload, projectName: projectName.trim() },
              ),
            },
          );

          const data = await response.json();

          if (!response.ok) {
            toast.error(data.message || "QR backup failed.");
            processedQrRef.current = false;
            return;
          }

          toast.success(data.message || "QR backup attendance marked.");
          showSuccess(
            activeTab === "meeting"
              ? "Meeting attendance marked using QR backup."
              : data.checkedOut
                ? "Check-out recorded using QR backup."
                : "Check-in recorded using QR backup.",
          );
          stopQRScanner();
          if (activeTab === "daily") await refreshDailyStatus();
        } catch (error) {
          console.error("QR backup error:", error);
          toast.error("QR backup failed. Please try again.");
          processedQrRef.current = false;
        } finally {
          setQrProcessing(false);
          window.setTimeout(() => setQrScanSuccess(false), 1200);
        }
      });
    } catch (error) {
      console.error("QR scanner error:", error);
      toast.error("QR scanner could not start. Check camera permissions.");
      stopQRScanner();
    }
  };


  const containerVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { delayChildren: 0.1, staggerChildren: 0.05 } },
  };

  const itemVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-sans">
      <Navigation />

      <div className="flex-1 w-full lg:mt-20 lg:px-6 xl:px-10 pb-10">
        <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
          <SectionTip sectionKey="attendance" />
          {enrollmentSuccess && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="animate-[fadeIn_0.25s_ease-out] rounded-2xl border border-[#50b748]/30 bg-white px-8 py-7 text-center shadow-2xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#50b748]/10">
                <CheckCircle className="h-9 w-9 text-[#50b748]" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-900">Face Enrollment Complete</h2>
              <p className="mt-2 text-sm text-slate-500">Your refreshed biometric profile is ready.</p>
            </div>
          </div>
        )}
        
          {/* Header & Status */}
          <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-950 flex items-center gap-3 tracking-tight">
                <div className="p-2.5 bg-[#00b4eb]/10 rounded-2xl">
                  <ScanLine className="text-[#0056a2] h-8 w-8" />
                </div>
                Attendance
              </h1>
              <p className="text-slate-500 mt-2 text-sm sm:text-base font-medium max-w-xl">
                Mark your daily or meeting attendance seamlessly.
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold shadow-sm ${
                mode === "enroll" || locationValid
                  ? "border-[#50b748]/30 bg-[#50b748]/10 text-[#50b748]"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {mode === "enroll" || locationValid ? (
                <MapPin className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              {mode === "enroll"
                ? "Face enrollment works from anywhere"
                : !sltLocationRequired
                ? "Ready to scan"
                : locationValid
                  ? "Ready to scan"
                  : "Outside SLT premises"}
            </div>
          </div>

          {successMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-xl border-2 border-[#50b748]/30 bg-[#50b748]/10 px-5 py-4 text-[#50b748] flex items-center gap-3 shadow-sm"
            >
              <CheckCircle className="w-6 h-6 flex-shrink-0" />
              <span className="font-bold">{successMessage}</span>
            </motion.div>
          )}

          {/* Top Level Tab Switcher (from Dashboard) */}
          <motion.div
            className="flex mb-8 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 w-full md:max-w-md relative"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button
              onClick={() => switchTab("meeting")}
              className={`relative z-10 flex-1 py-3 px-4 text-sm font-bold rounded-xl transition-all duration-300 ${
                activeTab === "meeting"
                  ? "text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Meeting Attendance
            </button>
            <button
              onClick={() => switchTab("daily")}
              className={`relative z-10 flex-1 py-3 px-4 text-sm font-bold rounded-xl transition-all duration-300 ${
                activeTab === "daily"
                  ? "text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Daily Attendance
            </button>

            <div
              className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-300 ease-out shadow-md"
              style={{
                background:
                  activeTab === "meeting"
                    ? "linear-gradient(135deg, #00b4eb 0%, #0056a2 100%)" // blue
                    : "linear-gradient(135deg, #50b748 0%, #2e7d32 100%)", // green
                left: activeTab === "meeting" ? "6px" : "calc(50%)",
              }}
            />
          </motion.div>

          {/* Main Content Area */}
          <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
            <motion.div className="lg:col-span-2 space-y-6" variants={containerVariants} initial="initial" animate="animate">
              


              {/* Scanner Container */}
              <motion.div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden" variants={itemVariants}>
                
                {/* Method Switcher Header */}
                <div className="flex border-b border-gray-100 bg-slate-50/50 p-2 gap-2">
                  <button onClick={() => switchMethod("face")} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 ${activeMethod === "face" ? "bg-white text-[#0056a2] shadow-sm border border-gray-200" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}>
                    <Camera size={18} /> Face ID
                  </button>
                  <button onClick={() => switchMethod("qr")} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 ${activeMethod === "qr" ? "bg-white text-[#0056a2] shadow-sm border border-gray-200" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}>
                    <QrCode size={18} /> QR Scanner
                  </button>
                </div>

                <div className="p-6">
                  {activeTab === "daily" && mode === "recognize" && (
                    <div className="mb-4">
                      <DailyAttendanceActionControl
                        action={attendanceAction}
                        onActionChange={setAttendanceAction}
                        status={dailyAttendanceStatus}
                        loading={dailyStatusLoading}
                      />
                    </div>
                  )}

                  {/* FACE ID VIEW */}
                  {activeMethod === "face" && (
                    <div className="space-y-4">
                      {mode === "enroll" && (
                        <div className="flex items-center gap-3 bg-[#00b4eb]/10 border border-[#00b4eb]/30 p-4 rounded-2xl mb-4">
                          <ShieldCheck className="text-[#0056a2]" />
                          <div>
                            <h3 className="font-bold text-[#0056a2]">Face Enrollment Mode</h3>
                            <p className="text-xs text-[#0056a2]/80 font-medium mt-0.5">Capture {REQUIRED_ENROLLMENT_SAMPLES} angles to complete registration.</p>
                          </div>
                        </div>
                      )}

                      <div className="relative aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden shadow-inner ring-1 ring-slate-200">
                        {cameraActive ? (
                          <>
                            <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} muted playsInline />
                            <canvas ref={canvasRef} width="640" height="480" className="hidden" />
                            <canvas
                              ref={meshCanvasRef}
                              width="640"
                              height="480"
                              className="absolute inset-0 h-full w-full object-cover z-10 pointer-events-none"
                              style={{ transform: "scaleX(-1)" }}
                            />
                            <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-4">
                              <FaceScanGuide
                                ready={faceGuide.ready}
                                message={faceGuide.message}
                                mode={mode}
                                progress={enrollmentProgress}
                                total={REQUIRED_ENROLLMENT_SAMPLES}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10">
                            {!modelsLoaded ? (
                              <>
                                <Loader className="h-16 w-16 animate-spin text-slate-300 mb-4" />
                                <p className="text-sm font-bold text-slate-500 max-w-xs text-center px-4">
                                  Loading face recognition modules...
                                </p>
                              </>
                            ) : (
                              <>
                                <Camera className="h-16 w-16 text-slate-300 mb-4" />
                                <p className="text-sm font-bold text-slate-500 max-w-xs text-center px-4">
                                  {mode === "enroll"
                                    ? "Start the camera to enroll your face."
                                    : "Start the camera to mark your attendance."}
                                </p>
                              </>
                            )}
                          </div>
                        )}
                        {loading && (
                          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
                            <Loader className="h-10 w-10 animate-spin text-[#00b4eb]" />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        {cameraActive ? (
                          <>
                            {mode === "recognize" && (
                              <button
                                type="button"
                                onClick={handleFaceRecognition}
                                disabled={loading || cooldown || !faceGuide.ready}
                                className={`flex-1 py-4 px-6 rounded-2xl font-bold text-white shadow-lg transition-all ${
                                  loading || cooldown || !faceGuide.ready
                                    ? "bg-slate-300 cursor-not-allowed shadow-none"
                                    : "bg-gradient-to-r from-[#00b4eb] to-[#0056a2] hover:shadow-blue-500/30 active:scale-95"
                                }`}
                              >
                                {loading
                                  ? "Verifying..."
                                  : cooldown
                                    ? "Wait 60s"
                                    : activeTab === "daily"
                                      ? attendanceAction === "check_out"
                                        ? "Verify & Check Out"
                                        : "Verify & Check In"
                                      : "Verify & Mark Attendance"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={stopCamera}
                              disabled={loading}
                              className="px-6 py-4 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border-2 border-slate-200 transition-all active:scale-95 disabled:opacity-50"
                            >
                              Stop
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={startCamera}
                            disabled={!canStartCamera || cooldown}
                            className={`flex-1 py-4 px-6 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
                              !canStartCamera || cooldown
                                ? "bg-slate-300 cursor-not-allowed shadow-none"
                                : "bg-gradient-to-r from-[#50b748] to-[#2e7d32] hover:shadow-green-500/30 active:scale-95"
                            }`}
                          >
                            {!modelsLoaded ? (
                              <>
                                <Loader className="h-5 w-5 animate-spin" />
                                Initializing...
                              </>
                            ) : (
                              <>
                                <Camera className="h-5 w-5" />
                                {cooldown ? "Wait 60s" : "Start Camera"}
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {mode === "recognize" && !cameraActive && (
                        <div className="pt-2 text-center">
                          <button
                            type="button"
                            onClick={() => setMode("enroll")}
                            className="text-xs font-bold text-[#0056a2] hover:underline"
                          >
                            Need to update your face profile? Enroll again.
                          </button>
                        </div>
                      )}
                      {mode === "enroll" && !cameraActive && (
                        <div className="pt-2 text-center">
                          <button
                            type="button"
                            onClick={() => setMode("recognize")}
                            className="text-xs font-bold text-slate-500 hover:underline"
                          >
                            Cancel Enrollment
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* QR CODE VIEW */}
                  {activeMethod === "qr" && (
                    <div className="space-y-4">
                      <div className="relative aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden shadow-inner ring-1 ring-slate-200">
                        {qrScanning ? (
                          <>
                            <video
                              ref={qrVideoRef}
                              className="absolute inset-0 h-full w-full object-cover"
                              autoPlay
                              muted
                              playsInline
                            />
                            {/* Scanning overlay effect */}
                            <div className="absolute inset-0 pointer-events-none">
                              <div className="absolute inset-0 flex items-center justify-center">
                                <motion.div
                                  className="w-48 h-48 border-2 border-[#00b4eb]/50 rounded-2xl shadow-[0_0_20px_rgba(0,180,235,0.3)]"
                                  animate={{ borderColor: ["rgba(0, 180, 235, 0.3)", "rgba(0, 180, 235, 0.8)", "rgba(0, 180, 235, 0.3)"] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                />
                              </div>
                            </div>
                            
                            {qrScanSuccess && (
                              <motion.div
                                className="absolute inset-0 bg-[#00b4eb]/30 backdrop-blur-sm flex items-center justify-center z-40"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                <motion.div
                                  className="bg-white px-5 py-4 rounded-2xl shadow-xl flex items-center"
                                  initial={{ scale: 0.8 }}
                                  animate={{ scale: 1 }}
                                >
                                  <CheckCircle size={24} className="text-[#00b4eb] mr-3" />
                                  <span className="font-bold text-gray-800 text-lg">Scan Successful!</span>
                                </motion.div>
                              </motion.div>
                            )}

                            {qrProcessing && !qrScanSuccess && (
                              <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
                                <Loader className="h-10 w-10 animate-spin text-[#00b4eb]" />
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10">
                            <QrCode className="h-16 w-16 text-slate-300 mb-4" />
                            <p className="text-sm font-bold text-slate-500 max-w-xs text-center px-4">
                              Start the scanner and point your camera at the QR code.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        {qrScanning ? (
                          <button
                            type="button"
                            onClick={stopQRScanner}
                            className="flex-1 px-6 py-4 rounded-2xl font-bold text-red-600 bg-red-50 hover:bg-red-100 border-2 border-red-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            <XCircle size={20} /> Stop Scanner
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={startQRScanner}
                            disabled={!canStartQr}
                            className={`flex-1 py-4 px-6 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
                              !canStartQr
                                ? "bg-slate-300 cursor-not-allowed shadow-none"
                                : "bg-gradient-to-r from-[#00b4eb] to-[#0056a2] hover:shadow-blue-500/30 active:scale-95"
                            }`}
                          >
                            <Scan size={20} /> Start Scanner
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </motion.div>
            </motion.div>

            {/* Sidebar / Tips */}
            <motion.div className="space-y-6" variants={itemVariants}>
              
              {/* Meeting Inputs */}
              <AnimatePresence>
                {activeTab === "meeting" && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden p-6"
                  >
                    <h2 className="text-lg font-bold text-gray-800 mb-4">Meeting Details</h2>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                          Project Name
                        </label>
                        <input
                          type="text"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          placeholder="Enter project name..."
                          className="w-full px-4 py-3 bg-slate-50 border-2 border-gray-100 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#00b4eb] focus:ring-4 focus:ring-[#00b4eb]/10 transition-all"
                        />
                      </div>
                      {activeMethod === "face" && (
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                            Meeting PIN (6 Digits)
                          </label>
                          <input
                            type="text"
                            value={meetingPin}
                            onChange={(e) => setMeetingPin(e.target.value)}
                            placeholder="Enter PIN..."
                            maxLength={6}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-gray-100 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#00b4eb] focus:ring-4 focus:ring-[#00b4eb]/10 transition-all"
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-slate-50/80 px-6 py-5 border-b border-gray-100">
                  <h3 className="font-extrabold text-gray-800 flex items-center text-lg">
                    <Info size={20} className="mr-2 text-[#00b4eb]" />
                    Quick Tips
                  </h3>
                </div>
                <div className="p-6">
                  {activeMethod === "face" ? (
                    <div className="space-y-4">
                      {[
                        "Ensure your face is well-lit and clearly visible.",
                        "Remove masks, sunglasses, or heavy accessories.",
                        "Center your face inside the oval guide.",
                        "Hold your device steady during the scan.",
                        "If verification fails, try enrolling your face again."
                      ].map((tip, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00b4eb]/10 text-[#00b4eb] font-bold text-xs flex items-center justify-center mt-0.5">
                            {index + 1}
                          </div>
                          <p className="text-gray-600 text-sm font-medium leading-relaxed">{tip}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {[
                        "Hold steady 15-30cm from the QR code.",
                        "Ensure good lighting to avoid glare on the screen.",
                        "Make sure the entire QR code is visible in the frame.",
                        "Wait for the success confirmation before leaving.",
                      ].map((tip, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00b4eb]/10 text-[#00b4eb] font-bold text-xs flex items-center justify-center mt-0.5">
                            {index + 1}
                          </div>
                          <p className="text-gray-600 text-sm font-medium leading-relaxed">{tip}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#00b4eb]/10 to-[#0056a2]/10 border border-[#0056a2]/20 rounded-3xl p-6">
                <h3 className="font-extrabold text-[#0056a2] mb-2">Need Help?</h3>
                <p className="text-[#0056a2]/80 text-sm mb-4 font-medium">
                  If you're experiencing persistent issues with {activeMethod === "face" ? "face recognition" : "the QR scanner"}, contact IT support.
                </p>
                <WhatsAppSupportButton
                  className="w-full"
                  variant="light"
                />
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Attendance;
