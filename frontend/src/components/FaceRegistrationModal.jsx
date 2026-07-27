import React, { useState, useRef, useEffect } from "react";
import { Camera, Check, Loader, ShieldCheck, X } from "lucide-react";
import * as faceapi from "face-api.js";
import toast from "react-hot-toast";
import { apiFetch } from "../utils/api";
import FaceScanGuide from "./FaceScanGuide";
import { clearFaceMesh, drawFaceMesh } from "../utils/faceMesh";
import { getCameraErrorMessage, requestFaceCameraStream } from "../utils/cameraAccess";

const FACE_DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,
  scoreThreshold: 0.45,
});
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

const FaceRegistrationModal = ({ isOpen, onClose, onEnrollmentComplete }) => {
  const [step, setStep] = useState("intro"); // intro, capturing, review, uploading, success
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceGuide, setFaceGuide] = useState("Center your face inside the oval");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const meshCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameCountRef = useRef(0);
  const captureBusyRef = useRef(false);
  const lastCaptureRef = useRef(0);
  const framesRef = useRef([]);
  const submitStartedRef = useRef(false);

  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  const attachStreamToVideo = async () => {
    if (!videoRef.current || !streamRef.current) return;

    videoRef.current.srcObject = streamRef.current;
    try {
      await videoRef.current.play();
    } catch (error) {
      console.warn("Camera preview autoplay was blocked:", error);
    }
  };

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (error) {
        console.error("Error loading face-api models:", error);
        toast.error("Failed to load face recognition. Please refresh.");
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (step === "capturing") {
      attachStreamToVideo();
      const timer = window.setInterval(() => captureFrame(), 700);
      return () => window.clearInterval(timer);
    }
    return undefined;
  }, [step]);

  const startCamera = async () => {
    try {
      const stream = await requestFaceCameraStream();
      streamRef.current = stream;
      lastCaptureRef.current = Date.now();
      submitStartedRef.current = false;
      setFaceGuide(ENROLLMENT_PROMPTS[0]);
      setStep("capturing");
      await attachStreamToVideo();
    } catch (error) {
      console.error("Camera error:", error);
      toast.error(getCameraErrorMessage(error));
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
    clearFaceMesh(meshCanvasRef.current);
  };

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current || captureBusyRef.current) return;
    if (Date.now() - lastCaptureRef.current < ENROLLMENT_CAPTURE_DELAY_MS) return;
    captureBusyRef.current = true;

    const ctx = canvasRef.current.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);

    try {
      const detections = await faceapi
        .detectAllFaces(canvasRef.current, FACE_DETECTOR_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length !== 1) {
        clearFaceMesh(meshCanvasRef.current);
        setFaceGuide(
          detections.length === 0
            ? "Center your face inside the oval"
            : "Only one person should be visible",
        );
        return;
      }

      const detection = detections[0];
      drawFaceMesh(meshCanvasRef.current, detection.landmarks);
      const { box } = detection.detection;
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      if (Math.abs(centerX - 320) > 105 || Math.abs(centerY - 240) > 95) {
        setFaceGuide("Move your face into the center oval");
        return;
      }
      if (box.width < 135 || box.height < 150) {
        setFaceGuide("Move a little closer to the camera");
        return;
      }

      const descriptor = Array.from(detection.descriptor);
      const previousFrame = framesRef.current[framesRef.current.length - 1];
      const isDistinct =
        !previousFrame ||
        Math.sqrt(
          previousFrame.reduce((sum, value, index) => {
            const difference = value - descriptor[index];
            return sum + difference * difference;
          }, 0),
        ) >= 0.035;

      if (!isDistinct) {
        setFaceGuide(ENROLLMENT_PROMPTS[frameCountRef.current]);
        return;
      }

      lastCaptureRef.current = Date.now();
      setFrames((current) => [...current, descriptor]);
      frameCountRef.current += 1;
      setFaceGuide(
        frameCountRef.current >= REQUIRED_ENROLLMENT_SAMPLES
          ? "Clear face samples captured"
          : ENROLLMENT_PROMPTS[frameCountRef.current],
      );

      if (frameCountRef.current >= REQUIRED_ENROLLMENT_SAMPLES) {
        stopCamera();
        setStep("review");
      }
    } catch (error) {
      clearFaceMesh(meshCanvasRef.current);
      console.error("Frame capture error:", error);
      setFaceGuide("Hold still while the camera checks your face");
    } finally {
      captureBusyRef.current = false;
    }
  };

  const submitEnrollment = async () => {
    if (frames.length < REQUIRED_ENROLLMENT_SAMPLES) {
      toast.error("Please complete the guided face scan");
      return;
    }
    if (submitStartedRef.current) return;

    submitStartedRef.current = true;
    stopCamera();
    setStep("uploading");
    setLoading(true);
    try {
      for (const [index, descriptor] of frames.entries()) {
        const response = await apiFetch("/face-attendance/enroll", {
            method: "POST",
            body: JSON.stringify({
              descriptor,
              metadata: {
                enrollmentMethod: "login-popup-guided",
                timestamp: new Date().toISOString(),
                replaceExisting: index === 0,
              },
            }),
          });
        if (!response.ok) {
          const error = await response.json();
          toast.error(error.message || "Enrollment failed. Please try again.");
          setStep("intro");
          return;
        }
      }

        setStep("success");
        toast.success("Face registered successfully!");
        setTimeout(() => {
          if (onEnrollmentComplete) {
            onEnrollmentComplete();
          }
          onClose();
        }, 2000);
    } catch (error) {
      console.error("Enrollment error:", error);
      toast.error("Error during enrollment. Please try again.");
      setStep("intro");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      step === "review" &&
      frames.length >= REQUIRED_ENROLLMENT_SAMPLES &&
      !submitStartedRef.current
    ) {
      submitEnrollment();
    }
  }, [step, frames]);

  const resetCapture = () => {
    setFrames([]);
    frameCountRef.current = 0;
    lastCaptureRef.current = 0;
    submitStartedRef.current = false;
    setFaceGuide("Center your face inside the oval");
    setStep("intro");
  };

  if (!isOpen) return null;

  if (!modelsLoaded) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full border-t-4 border-orange-500">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center mb-6">
              <Loader className="w-8 h-8 animate-spin text-orange-600" />
            </div>
            <p className="text-center text-gray-900 font-semibold text-lg">
              Initializing face recognition...
            </p>
            <p className="text-center text-gray-500 text-sm mt-2">
              Loading advanced face detection models
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative max-h-[calc(100dvh-1rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="h-2 bg-gradient-to-r from-orange-400 via-orange-500 to-red-500" />

        <button
          onClick={onClose}
          className="absolute right-4 top-5 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
          aria-label="Close face registration"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-6 pt-6 pb-8">
          {/* Intro Step */}
          {step === "intro" && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                  <Camera className="h-8 w-8 text-orange-600" />
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900">Register Your Face</h2>
                <p className="text-gray-600 text-sm mt-2 leading-relaxed">
                  One-time setup for secure attendance. You can complete this before continuing.
                </p>
              </div>

              <div className="rounded-xl p-4 flex items-start gap-3 bg-amber-50 border border-amber-200">
                <ShieldCheck className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-amber-800 text-xs leading-relaxed">
                  Only your mathematical face signature is stored. No photos are saved.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-gray-900 text-base">What you need:</h3>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                    <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">5 guided face scans</p>
                      <p className="text-xs text-gray-500 mt-0.5">Follow the prompts for clear angles</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                    <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Good lighting</p>
                      <p className="text-xs text-gray-500 mt-0.5">Avoid shadows and backlighting</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200">
                    <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Clear face visibility</p>
                      <p className="text-xs text-gray-500 mt-0.5">Remove masks and glasses</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={startCamera}
                  className="w-full bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white font-bold py-4 rounded-xl transition hover:shadow-lg flex items-center justify-center gap-3"
                >
                  <Camera className="w-5 h-5" />
                  Start Face Registration
                </button>

                <button
                  onClick={onClose}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition"
                >
                  Skip for Now
                </button>
              </div>
            </div>
          )}

          {/* Capturing Step */}
          {step === "capturing" && (
            <div className="space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <strong>Position tip:</strong> Center your face in the frame. Good lighting helps.
              </div>

              <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-lg bg-black" style={{ aspectRatio: "4/3" }}>
                    <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
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
                  ready={frameCountRef.current > 0}
                  enrollment
                  sampleCount={frameCountRef.current}
                  requiredSamples={REQUIRED_ENROLLMENT_SAMPLES}
                  direction={ENROLLMENT_DIRECTIONS[frameCountRef.current] || "center"}
                />
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-800">
                {faceGuide}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">Progress</span>
                  <span className="text-sm font-bold text-orange-600">{frameCountRef.current}/{REQUIRED_ENROLLMENT_SAMPLES} scans</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-orange-400 to-orange-600 h-3 rounded-full transition-all duration-300 flex items-center justify-center"
                    style={{ width: `${(frameCountRef.current / REQUIRED_ENROLLMENT_SAMPLES) * 100}%` }}
                  >
                    {(frameCountRef.current / REQUIRED_ENROLLMENT_SAMPLES) * 100 > 15 && (
                      <span className="text-white text-xs font-bold">{Math.round((frameCountRef.current / REQUIRED_ENROLLMENT_SAMPLES) * 100)}%</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={() => {
                    stopCamera();
                    resetCapture();
                  }}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>

              <div className="text-xs text-amber-800 text-center p-3 bg-amber-50 border border-amber-200 rounded-lg">
                Samples are captured automatically. Keep your face centered and move slightly when prompted.
              </div>
            </div>
          )}

          {step === "uploading" && (
            <div className="flex flex-col items-center py-12 text-center">
              <Loader className="h-12 w-12 animate-spin text-orange-500" />
              <h3 className="mt-5 text-xl font-bold text-gray-900">Saving Face Profile</h3>
              <p className="mt-2 text-sm text-gray-500">Your secure biometric samples are being stored.</p>
            </div>
          )}

          {/* Success Step */}
          {step === "success" && (
            <div className="space-y-6 py-4">
              <div className="flex justify-center">
                <div className="animate-[fadeIn_0.3s_ease-out] w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
              </div>
              
              <div className="text-center space-y-3">
                <h3 className="text-xl font-bold text-gray-900">Registration Complete</h3>
                <p className="text-gray-600 leading-relaxed">
                  Your face has been successfully registered. You're all set to use face recognition for attendance.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2 text-sm text-green-900">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>Face signature stored securely</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>Ready for next attendance marking</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>Can use anytime from dashboard</span>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Redirecting to dashboard...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceRegistrationModal;
