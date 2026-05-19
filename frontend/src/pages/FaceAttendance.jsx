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
} from "lucide-react";
import * as faceapi from "face-api.js";
import toast from "react-hot-toast";
import { BrowserMultiFormatReader } from "@zxing/library";
import { useNavigate } from "react-router-dom";
import Navigation from "../components/Navigation";
import { apiFetch } from "../utils/api";

const SLT_OFFICE = {
  latitude: 6.9271,
  longitude: 79.8612,
  radiusKm: 2,
};

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";

const validateQRCodeFormat = (qrCode, scanMode, meetingTitle = "") => {
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
    return (
      parsed.type === "meeting_attendance" &&
      typeof parsed.meetingTitle === "string" &&
      parsed.meetingTitle.trim() &&
      (!meetingTitle.trim() || parsed.meetingTitle.trim() === meetingTitle.trim()) &&
      (!parsed.timestamp || !Number.isNaN(parseInt(parsed.timestamp, 10)))
    );
  } catch {
    return false;
  }
};

const getDistanceKm = (fromLocation) => {
  if (!fromLocation) return null;

  const earthRadiusKm = 6371;
  const dLat = ((fromLocation.latitude - SLT_OFFICE.latitude) * Math.PI) / 180;
  const dLng = ((fromLocation.longitude - SLT_OFFICE.longitude) * Math.PI) / 180;
  const officeLatRad = (SLT_OFFICE.latitude * Math.PI) / 180;
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
  const [cooldown, setCooldown] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [qrMode, setQrMode] = useState("daily");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingPin, setMeetingPin] = useState("");
  const [qrScanning, setQrScanning] = useState(false);
  const [qrProcessing, setQrProcessing] = useState(false);
  const [qrScanSuccess, setQrScanSuccess] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const qrVideoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const processedQrRef = useRef(false);

  const distanceKm = getDistanceKm(location);
  const actualLocationValid = distanceKm !== null && distanceKm <= SLT_OFFICE.radiusKm;
  const locationValid = !sltLocationRequired || actualLocationValid;
  const meetingDetailsReady = meetingTitle.trim().length > 0 && /^\d{6}$/.test(meetingPin.trim());
  const attendanceLocationReady = attendanceType === "meeting" ? actualLocationValid : locationValid;
  const canStartCamera =
    mode === "enroll" ||
    (attendanceLocationReady && (attendanceType !== "meeting" || meetingDetailsReady));
  const enrollmentProgress = Math.min(enrollmentFrames.length, 5);

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
      } catch (error) {
        console.error("Failed to load attendance settings:", error);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationError("");
      },
      (error) => {
        console.warn("Geolocation error:", error);
        setLocationError("Location permission is required for attendance.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
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

  const startCamera = async () => {
    if (mode !== "enroll" && attendanceType === "meeting" && !actualLocationValid) {
      toast.error(locationError || "You must be within SLT office radius to mark meeting attendance.");
      return;
    }

    if (mode !== "enroll" && !requireValidLocation("You must be within SLT office radius.")) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Camera access requires a supported browser on HTTPS or localhost.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraActive(true);
      await attachStreamToVideo();
    } catch (error) {
      console.error("Camera access error:", error);
      toast.error("Camera access failed. Allow camera permission and use HTTPS or localhost.");
      setCameraActive(false);
    }
  };

  const captureFrameForDescriptor = async () => {
    if (!videoRef.current || !canvasRef.current) return null;

    const ctx = canvasRef.current.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);

    try {
      const detections = await faceapi
        .detectAllFaces(canvasRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length !== 1) {
        return {
          error:
            detections.length === 0
              ? "No face detected. Center your face in the frame."
              : "More than one face detected. Only one person should be in frame.",
        };
      }

      return {
        descriptor: Array.from(detections[0].descriptor),
      };
    } catch (error) {
      console.error("Error extracting face descriptor:", error);
      return { error: "Could not read face data from the camera frame." };
    }
  };

  const handleEnrollmentCapture = async () => {
    setLoading(true);
    const frameData = await captureFrameForDescriptor();

    if (!frameData || frameData.error) {
      toast.error(frameData?.error || "No face detected.");
      setLoading(false);
      return;
    }

    setEnrollmentFrames((current) => [...current, frameData.descriptor]);
    toast.success(`Enrollment frame ${enrollmentFrames.length + 1} captured.`);
    setLoading(false);
  };

  const completeEnrollment = async () => {
    if (enrollmentFrames.length < 5) {
      toast.error("Capture at least 5 frames before completing enrollment.");
      return;
    }

    setLoading(true);
    try {
      const avgDescriptor = enrollmentFrames[0].map((_, index) => {
        const sum = enrollmentFrames.reduce((acc, frame) => acc + frame[index], 0);
        return sum / enrollmentFrames.length;
      });

      const response = await apiFetch("/face-attendance/enroll", {
        method: "POST",
        body: JSON.stringify({
          descriptor: avgDescriptor,
          metadata: {
            location: location || null,
            enrollmentMethod: "face-attendance-page",
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.message || "Face enrollment failed.");
        return;
      }

      toast.success("Face enrolled successfully.");
      showSuccess("Face profile is ready for attendance.");
      setMode("recognize");
      setEnrollmentFrames([]);
      stopCamera();
    } catch (error) {
      console.error("Enrollment error:", error);
      toast.error("Enrollment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFaceRecognition = async () => {
    if (!requireValidLocation("You must be within SLT office radius to mark attendance.")) return;

    if (attendanceType === "meeting" && !meetingTitle.trim()) {
      toast.error("Enter the meeting title before marking meeting attendance.");
      return;
    }

    if (attendanceType === "meeting" && !/^\d{6}$/.test(meetingPin.trim())) {
      toast.error("Enter the 6-digit meeting PIN from the meeting room.");
      return;
    }

    setLoading(true);
    const frameData = await captureFrameForDescriptor();

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
          meetingTitle: attendanceType === "meeting" ? meetingTitle.trim() : undefined,
          meetingPin: attendanceType === "meeting" ? meetingPin.trim() : undefined,
          metadata: {
            location: location || null,
            source: "browser-camera",
            meetingTitle: attendanceType === "meeting" ? meetingTitle.trim() : undefined,
            meetingPin: attendanceType === "meeting" ? meetingPin.trim() : undefined,
          },
        }),
      });

      const result = await response.json();

      if (response.ok) {
        const traineeName = result.intern?.traineeName || "you";
        toast.success(`Attendance marked for ${traineeName}.`);
        showSuccess(
          attendanceType === "meeting"
            ? "Daily and meeting attendance marked."
            : "Daily attendance marked.",
        );
        stopCamera();
        setCooldown(true);
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

    if (qrMode === "meeting" && !meetingTitle.trim()) {
      toast.error("Enter the meeting title before scanning.");
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
        if (!validateQRCodeFormat(qrData, qrMode, meetingTitle)) {
          toast.error(
            qrMode === "daily"
              ? "Scan a valid daily attendance QR code."
              : "Scan the QR code generated for this meeting.",
          );
          return;
        }

        processedQrRef.current = true;
        setQrProcessing(true);
        setQrScanSuccess(true);

        try {
          const internId = localStorage.getItem("internId");
          const payload = {
            qrCode: qrData,
            internId,
            lat: location?.latitude ?? null,
            lng: location?.longitude ?? null,
          };

          const response = await apiFetch(
            qrMode === "daily" ? "/qrcode/scan" : "/qrcode/scan-meeting",
            {
              method: "POST",
              body: JSON.stringify(
                qrMode === "daily"
                  ? { ...payload, scanType: "daily" }
                  : { ...payload, meetingTitle: meetingTitle.trim() },
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
              : "Daily attendance marked using QR backup.",
          );
          stopQRScanner();
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
                ? "Location check off by admin"
                : locationValid
                  ? `Within office radius (${distanceKm.toFixed(2)} km)`
                  : locationError || "Outside the allowed office radius"}
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
                          ? "Capture five clear frames to create or refresh your face profile."
                          : "Choose daily or meeting attendance, then capture your face."}
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

                      {attendanceType === "meeting" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">Meeting title *</span>
                            <input
                              type="text"
                              value={meetingTitle}
                              onChange={(event) => setMeetingTitle(event.target.value)}
                              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              placeholder="Enter today's meeting title"
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

                  {cameraActive && (
                    <div className="space-y-4">
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-slate-200">
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" width={640} height={480} />
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                          <div className="w-36 h-44 rounded-full border-2 border-emerald-300/80 shadow-[0_0_0_999px_rgba(15,23,42,0.18)]" />
                        </div>
                      </div>

                      {mode === "enroll" && (
                        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                          <div className="flex items-center justify-between text-sm font-semibold text-blue-900">
                            <span>Enrollment frames</span>
                            <span>{enrollmentProgress}/5</span>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                            <div
                              className="h-full rounded-full bg-blue-600 transition-all"
                              style={{ width: `${(enrollmentProgress / 5) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {cooldown && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          Attendance was recorded. Please wait before trying again.
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {mode === "enroll" ? (
                          <>
                            <button
                              type="button"
                              onClick={handleEnrollmentCapture}
                              disabled={loading || enrollmentFrames.length >= 5}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white disabled:bg-slate-300"
                            >
                              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                              Capture Frame
                            </button>
                            <button
                              type="button"
                              onClick={completeEnrollment}
                              disabled={loading || enrollmentFrames.length < 5}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white disabled:bg-slate-300"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Complete Enrollment
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={handleFaceRecognition}
                            disabled={loading || cooldown}
                            className="sm:col-span-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white disabled:bg-slate-300"
                          >
                            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            Mark Attendance
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Square className="w-4 h-4" />
                          Stop Camera
                        </button>
                      </div>
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

                {qrMode === "meeting" && (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Meeting title</span>
                    <input
                      type="text"
                      value={meetingTitle}
                      onChange={(event) => setMeetingTitle(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      placeholder="Enter the exact meeting title"
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
                    disabled={qrProcessing || !locationValid}
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
