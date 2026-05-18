import React, { useState, useRef, useEffect } from "react";
import { Camera, Check, Loader, ShieldCheck, X } from "lucide-react";
import * as faceapi from "face-api.js";
import toast from "react-hot-toast";
import { apiFetch } from "../utils/api";

const FaceRegistrationModal = ({ isOpen, onClose, onEnrollmentComplete }) => {
  const [step, setStep] = useState("intro"); // intro, capturing, review, uploading, success
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameCountRef = useRef(0);

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
    }
  }, [step]);

  const startCamera = async () => {
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
      setStep("capturing");
      await attachStreamToVideo();
    } catch (error) {
      console.error("Camera error:", error);
      toast.error("Cannot access camera. Allow camera permission and use HTTPS or localhost.");
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
  };

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);

    try {
      const detections = await faceapi
        .detectAllFaces(canvasRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        toast.error("No face detected. Please adjust your position.");
        return;
      }

      const descriptor = Array.from(detections[0].descriptor);
      setFrames([...frames, descriptor]);
      frameCountRef.current += 1;
      toast.success(`Frame ${frameCountRef.current}/3 captured`);

      if (frameCountRef.current >= 3) {
        stopCamera();
        setStep("review");
      }
    } catch (error) {
      console.error("Frame capture error:", error);
      toast.error("Error capturing frame. Please try again.");
    }
  };

  const submitEnrollment = async () => {
    if (frames.length < 3) {
      toast.error("Please capture at least 3 frames");
      return;
    }

    setLoading(true);
    try {
      // Average descriptors
      const avgDescriptor = frames[0].map((_, i) => {
        const sum = frames.reduce((acc, frame) => acc + frame[i], 0);
        return sum / frames.length;
      });

      const response = await apiFetch("/face-attendance/enroll", {
        method: "POST",
        body: JSON.stringify({
          descriptor: avgDescriptor,
          metadata: {
            enrollmentMethod: "login-popup",
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (response.ok) {
        setStep("success");
        toast.success("Face registered successfully!");
        setTimeout(() => {
          if (onEnrollmentComplete) {
            onEnrollmentComplete();
          }
          onClose();
        }, 2000);
      } else {
        const error = await response.json();
        toast.error(error.message || "Enrollment failed. Please try again.");
        setStep("intro");
      }
    } catch (error) {
      console.error("Enrollment error:", error);
      toast.error("Error during enrollment. Please try again.");
      setStep("intro");
    } finally {
      setLoading(false);
    }
  };

  const resetCapture = () => {
    setFrames([]);
    frameCountRef.current = 0;
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
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
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
                      <p className="text-sm font-medium text-gray-800">3 clear face photos</p>
                      <p className="text-xs text-gray-500 mt-0.5">From different angles</p>
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
                />
                <canvas ref={canvasRef} className="hidden" width={640} height={480} />
                
                {/* Crosshair overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-32 h-32 border-2 border-green-400 rounded-full opacity-60"></div>
                  <div className="absolute w-px h-12 bg-green-400 opacity-50"></div>
                  <div className="absolute h-px w-12 bg-green-400 opacity-50"></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">Progress</span>
                  <span className="text-sm font-bold text-orange-600">{frameCountRef.current}/3 frames</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-orange-400 to-orange-600 h-3 rounded-full transition-all duration-300 flex items-center justify-center"
                    style={{ width: `${(frameCountRef.current / 3) * 100}%` }}
                  >
                    {(frameCountRef.current / 3) * 100 > 15 && (
                      <span className="text-white text-xs font-bold">{Math.round((frameCountRef.current / 3) * 100)}%</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={captureFrame}
                  disabled={frameCountRef.current >= 3}
                  className="w-full bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Capture Frame ({frameCountRef.current}/3)
                </button>

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
                Move your head slightly for each frame to capture different angles.
              </div>
            </div>
          )}

          {/* Review Step */}
          {step === "review" && (
            <div className="space-y-5">
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-green-900">Perfect! Ready to register</p>
                    <p className="text-sm text-green-700 mt-1">
                      {frames.length} frames captured successfully. Your face signature is ready to be stored.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                <p className="leading-relaxed">
                  Your face signature will be <strong>securely encrypted</strong> and stored on our servers. No photos are kept—only mathematical face data.
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={submitEnrollment}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Registering face...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Complete Registration
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    resetCapture();
                    startCamera();
                  }}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition"
                >
                  Retake Frames
                </button>
              </div>
            </div>
          )}

          {/* Success Step */}
          {step === "success" && (
            <div className="space-y-6 py-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center">
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
