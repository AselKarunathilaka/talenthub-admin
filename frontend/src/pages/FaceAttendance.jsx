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
} from "lucide-react";
import * as faceapi from "face-api.js";
import toast from "react-hot-toast";
import { BrowserMultiFormatReader } from "@zxing/library";
import { useNavigate } from "react-router-dom";
import Navigation from "../components/Navigation";
import FaceScanGuide from "../components/FaceScanGuide";
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
const ENROLLMENT_DIRECTIONS = ["center", "left", "center", "right", "center"];
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

const FaceAttendance = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("face");
  const [mode, setMode] = useState("recognize");
  const [attendanceType, setAttendanceType] = useState("daily");
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
  const [qrMode, setQrMode] = useState("daily");
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
  const meetingDetailsReady = projectName.trim().length > 0 && /^\d{6}$/.test(meetingPin.trim());
  const attendanceLocationReady = locationValid;
  const dailyAttendanceCompleted =
    attendanceType === "daily" && dailyAttendanceStatus.state === "checked_out";
  const canStartCamera =
    mode === "enroll" ||
    (attendanceLocationReady &&
      !dailyAttendanceCompleted &&
      (attendanceType !== "meeting" || meetingDetailsReady));
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
        setLocation(freshLocation);
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
    setLocation(freshLocation);
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

  const switchTab = (tab) => {
    stopCamera();
    stopQRScanner();

    if (tab === "qr") {
      navigate("/scan-qr");
      return;
    }

    setActiveTab(tab);
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
      attendanceType === "meeting" &&
      sltLocationRequired &&
      !actualLocationValid
    ) {
      toast.error(locationError || "You must be within SLT office radius to mark meeting attendance.");
      return;
    }

    if (mode !== "enroll" && !requireValidLocation("You must be within SLT office radius.")) return;
    if (mode !== "enroll" && attendanceType === "meeting") {
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
    if (!cameraActive) return undefined;

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
  }, [cameraActive, mode]);

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

    if (attendanceType === "meeting" && !projectName.trim()) {
      toast.error("Enter the project name before marking meeting attendance.");
      return;
    }

    if (attendanceType === "meeting" && !/^\d{6}$/.test(meetingPin.trim())) {
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
          attendanceType,
          attendanceAction:
            attendanceType === "daily" ? attendanceAction : undefined,
          projectName: attendanceType === "meeting" ? projectName.trim() : undefined,
          meetingPin: attendanceType === "meeting" ? meetingPin.trim() : undefined,
          metadata: {
            location: attendanceLocation || null,
            source: "browser-camera",
            projectName: attendanceType === "meeting" ? projectName.trim() : undefined,
            meetingPin: attendanceType === "meeting" ? meetingPin.trim() : undefined,
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
            : `Check-in recorded for ${traineeName}.`
        );
        showSuccess(
          attendanceType === "meeting"
            ? "Daily and meeting attendance marked."
            : result.checkedOut
              ? "Check-out recorded successfully."
              : "Check-in recorded successfully."
        );
        stopCamera();
        setCooldown(true);
        if (attendanceType === "daily") await refreshDailyStatus();
        window.setTimeout(() => setCooldown(false), 60000);
        return;
      }

      if (response.status === 400 && result.alreadyMarked) {
        toast.error(result.message || "Attendance is already marked today.");
        showSuccess(result.message || "Attendance already marked today.");
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

    if (qrMode === "meeting" && !projectName.trim()) {
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
        if (!validateQRCodeFormat(qrData, qrMode, projectName)) {
          toast.error(
            qrMode === "daily"
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
            qrMode === "daily" ? "/qrcode/scan" : "/qrcode/scan-meeting",
            {
              method: "POST",
              body: JSON.stringify(
                qrMode === "daily"
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
            qrMode === "meeting"
              ? "Meeting attendance marked using QR backup."
              : data.checkedOut
                ? "Check-out recorded using QR backup."
                : "Check-in recorded using QR backup.",
          );
          stopQRScanner();
          if (qrMode === "daily") await refreshDailyStatus();
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

  if (!modelsLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 max-w-sm w-full text-center">
          <Loader className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-4" />
          <h2 className="text-lg font-semibold text-slate-900">Loading face recognition</h2>
          <p className="text-sm text-slate-500 mt-2">This usually takes a few seconds.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Navigation />

      <main className="flex-1 w-full lg:mt-20 lg:px-10">
        {enrollmentSuccess && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="animate-[fadeIn_0.25s_ease-out] rounded-2xl border border-emerald-100 bg-white px-8 py-7 text-center shadow-2xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-9 w-9 text-emerald-600" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-900">Face Enrollment Complete</h2>
              <p className="mt-2 text-sm text-slate-500">Your refreshed biometric profile is ready.</p>
            </div>
          </div>
        )}
        <div className="mx-auto px-4 py-6 md:py-8 lg:py-10 max-w-6xl">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-950">Face Attendance</h1>
              <p className="text-slate-500 mt-1">
                Face recognition works alongside the existing QR Attendance flow.
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                mode === "enroll" || locationValid
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {mode === "enroll" || locationValid ? (
                <MapPin className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
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
            <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => switchTab("face")}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
                activeTab === "face" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Camera className="w-4 h-4" />
              Face
            </button>
            <button
              type="button"
              onClick={() => switchTab("qr")}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              <QrCode className="w-4 h-4" />
              QR Attendance
            </button>
          </div>

          {activeTab === "face" && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 p-4 md:p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {mode === "enroll" ? "Enroll Face" : "Mark Attendance"}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        {mode === "enroll"
                          ? "Hold your face inside the oval while clear samples are captured automatically."
                          : "Choose daily or meeting attendance, then center your face for a clear scan."}
                      </p>
                    </div>
                    <div className="inline-flex rounded-lg bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMode("recognize");
                          setEnrollmentFrames([]);
                          stopCamera();
                        }}
                        className={`rounded-md px-3 py-2 text-sm font-semibold ${
                          mode === "recognize" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"
                        }`}
                      >
                        Attendance
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("enroll");
                          stopCamera();
                        }}
                        className={`rounded-md px-3 py-2 text-sm font-semibold ${
                          mode === "enroll" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"
                        }`}
                      >
                        Enroll
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 md:p-5 space-y-5">
                  {mode === "recognize" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setAttendanceType("daily")}
                          className={`rounded-lg border p-4 text-left transition ${
                            attendanceType === "daily"
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 hover:border-blue-300"
                          }`}
                        >
                          <ShieldCheck className="w-5 h-5 text-blue-600 mb-2" />
                          <div className="font-semibold text-slate-900">Daily Attendance</div>
                          <div className="text-sm text-slate-500 mt-1">Marks today's regular attendance.</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttendanceType("meeting")}
                          className={`rounded-lg border p-4 text-left transition ${
                            attendanceType === "meeting"
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 hover:border-blue-300"
                          }`}
                        >
                          <Users className="w-5 h-5 text-blue-600 mb-2" />
                          <div className="font-semibold text-slate-900">Daily + Meeting</div>
                          <div className="text-sm text-slate-500 mt-1">Marks daily attendance and today's meeting.</div>
                        </button>
                      </div>

                      {attendanceType === "daily" && (
                        <DailyAttendanceActionControl
                          action={attendanceAction}
                          onActionChange={setAttendanceAction}
                          status={dailyAttendanceStatus}
                          loading={dailyStatusLoading}
                        />
                      )}

                      {attendanceType === "meeting" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">Project Name *</span>
                            <input
                              type="text"
                              value={projectName}
                              onChange={(event) => setProjectName(event.target.value)}
                              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              placeholder="Enter today's project name"
                            />
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">Meeting PIN *</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={meetingPin}
                              onChange={(event) => setMeetingPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 tracking-[0.25em] font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              placeholder="000000"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {!cameraActive && (
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={loading || !canStartCamera}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white disabled:bg-slate-300"
                    >
                      <Camera className="w-5 h-5" />
                      Start Camera
                    </button>
                  )}
                </div>
              </section>

              <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm h-fit">
                <h3 className="font-semibold text-slate-900">Capture Checklist</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                    <span>Use bright, even lighting.</span>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                    <span>Keep only your face in the frame.</span>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                    <span>Look directly at the camera for recognition.</span>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                    <span>Use QR Attendance if face recognition fails.</span>
                  </div>
                </div>
              </aside>
            </div>
          )}

          {cameraActive && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 sm:px-4 sm:py-6">
              <div className="max-h-[calc(100dvh-1rem)] w-full max-w-3xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 md:px-5">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      {mode === "enroll"
                        ? "Enroll Face"
                        : attendanceType === "meeting"
                          ? "Daily + Meeting Attendance"
                          : "Daily Attendance"}
                    </h2>
                    <p className="text-sm text-slate-500">
                      Keep your face centered in the frame.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={stopCamera}
                    aria-label="Close camera"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4 p-4 md:p-5">
                  <div className="relative mx-auto aspect-[4/3] max-h-[52dvh] w-full overflow-hidden rounded-lg border border-slate-200 bg-black sm:max-h-[56dvh]">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />
                    <canvas ref={canvasRef} className="hidden" width={640} height={480} />
                    <canvas
                      ref={meshCanvasRef}
                      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
                      width={640}
                      height={480}
                      style={{ transform: "scaleX(-1)" }}
                    />
                    <FaceScanGuide
                      ready={faceGuide.ready}
                      enrollment={mode === "enroll"}
                      sampleCount={enrollmentProgress}
                      requiredSamples={REQUIRED_ENROLLMENT_SAMPLES}
                      direction={ENROLLMENT_DIRECTIONS[enrollmentProgress] || "center"}
                    />
                  </div>

                  <div
                    className={`rounded-lg border px-4 py-3 text-center text-sm font-semibold ${
                      faceGuide.ready
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {faceGuide.message}
                  </div>

                  {mode === "enroll" && (
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                      <div className="flex items-center justify-between text-sm font-semibold text-blue-900">
                        <span>Clear face samples</span>
                        <span>{enrollmentProgress}/{REQUIRED_ENROLLMENT_SAMPLES}</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all"
                          style={{ width: `${(enrollmentProgress / REQUIRED_ENROLLMENT_SAMPLES) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {cooldown && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Attendance was recorded. Please wait before trying again.
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {mode === "enroll" ? (
                      <div className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 py-3 font-semibold text-blue-700">
                        {loading ? <Loader className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                        {loading ? "Saving Face Profile..." : "Scanning Automatically"}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleFaceRecognition}
                        disabled={loading || cooldown || !faceGuide.ready}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white disabled:bg-slate-300"
                      >
                        {loading ? <Loader className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        {attendanceType === "daily"
                          ? attendanceAction === "check_out"
                            ? "Check Out"
                            : "Check In"
                          : "Mark Attendance"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Square className="h-4 w-4" />
                      Stop Camera
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "qr" && (
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden max-w-4xl">
              <div className="border-b border-slate-200 p-4 md:p-5">
                <h2 className="text-lg font-semibold text-slate-900">QR Attendance Scanner</h2>
                <p className="text-sm text-slate-500 mt-1">Use the existing QR attendance scanner when needed.</p>
              </div>

              <div className="p-4 md:p-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setQrMode("daily")}
                    className={`rounded-lg border p-4 text-left transition ${
                      qrMode === "daily" ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5 text-blue-600 mb-2" />
                    <div className="font-semibold text-slate-900">Daily QR</div>
                    <div className="text-sm text-slate-500 mt-1">Scan the daily attendance code.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrMode("meeting")}
                    className={`rounded-lg border p-4 text-left transition ${
                      qrMode === "meeting" ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    <Users className="w-5 h-5 text-blue-600 mb-2" />
                    <div className="font-semibold text-slate-900">Meeting QR</div>
                    <div className="text-sm text-slate-500 mt-1">Scan a meeting attendance code.</div>
                  </button>
                </div>

                {qrMode === "daily" && (
                  <DailyAttendanceActionControl
                    action={attendanceAction}
                    onActionChange={setAttendanceAction}
                    status={dailyAttendanceStatus}
                    loading={dailyStatusLoading}
                  />
                )}

                {qrMode === "meeting" && (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Project Name</span>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="Enter the exact project name"
                    />
                  </label>
                )}

                <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                  {!qrScanning && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-4">
                      <QrCode className="w-14 h-14 text-slate-300 mb-3" />
                      <h3 className="font-semibold text-slate-600">Scanner ready</h3>
                      <p className="text-sm text-slate-400 mt-1">Start the scanner and place the QR code inside the frame.</p>
                    </div>
                  )}
                  <video ref={qrVideoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                  {qrScanning && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-52 h-52 rounded-lg border-2 border-blue-300 shadow-[0_0_0_999px_rgba(15,23,42,0.16)]" />
                    </div>
                  )}
                  {qrScanSuccess && (
                    <div className="absolute inset-0 bg-emerald-500/15 flex items-center justify-center">
                      <div className="rounded-lg bg-white px-4 py-3 shadow-sm text-emerald-700 font-semibold flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        QR detected
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={qrScanning ? stopQRScanner : startQRScanner}
                    disabled={
                      qrProcessing ||
                      !locationValid ||
                      (qrMode === "daily" &&
                        dailyAttendanceStatus.state === "checked_out")
                    }
                    className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold text-white disabled:bg-slate-300 ${
                      qrScanning ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {qrProcessing ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : qrScanning ? (
                      <Square className="w-4 h-4" />
                    ) : (
                      <ScanLine className="w-4 h-4" />
                    )}
                    {qrScanning ? "Stop Scanner" : "Start Scanner"}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchTab("face")}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Camera className="w-4 h-4" />
                    Back to Face
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default FaceAttendance;
