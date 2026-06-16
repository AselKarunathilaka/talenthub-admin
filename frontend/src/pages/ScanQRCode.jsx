import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { BrowserMultiFormatReader } from '@zxing/library';
import { apiFetch } from '../utils/api';
import { AlertCircle, Camera, Scan, XCircle, Info, CheckCircle, ChevronRight, MapPin } from 'lucide-react';
import Navigation from '../components/Navigation';
import { motion } from 'framer-motion';
import { requestFreshLocation, toAttendanceEvidence } from '../utils/attendanceEvidence';

const SLT_OFFICE = {
  latitude: 6.9271,
  longitude: 79.8612,
  radiusKm: 2,
};

const normalizeProjectName = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const getProjectKey = (value) => normalizeProjectName(value);

const getDistanceKm = (fromLocation, officeLocation = SLT_OFFICE) => {
  if (!Number.isFinite(fromLocation?.lat) || !Number.isFinite(fromLocation?.lng)) return null;

  const earthRadiusKm = 6371;
  const dLat = ((fromLocation.lat - officeLocation.latitude) * Math.PI) / 180;
  const dLng = ((fromLocation.lng - officeLocation.longitude) * Math.PI) / 180;
  const officeLatRad = (officeLocation.latitude * Math.PI) / 180;
  const currentLatRad = (fromLocation.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(officeLatRad) *
      Math.cos(currentLatRad) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

// Function to validate QR code format based on scan mode
const validateQRCodeFormat = (qrCode, scanMode, projectName = '') => {
  if (!qrCode || typeof qrCode !== 'string') {
    return false;
  }

  if (scanMode === 'daily') {
    // Daily attendance: legacy string format
    if (!qrCode.includes('daily_attendance_') && !qrCode.includes('attendance_session_')) {
      return false;
    }
    // Extract timestamp for validation
    const qrCodeParts = qrCode.split('_');
    const timestamp = parseInt(qrCodeParts[qrCodeParts.length - 1]);
    if (isNaN(timestamp)) {
      return false;
    }
    return true;
  } else {
    // Meeting attendance: expect JSON format
    let parsed;
    try {
      parsed = JSON.parse(qrCode);
    } catch (e) {
      return false;
    }
    const qrProjectName = normalizeProjectName(parsed.projectName || parsed.meetingTitle || '');
    // Must have type and projectName
    if (
      parsed.type !== 'meeting_attendance' ||
      !qrProjectName
    ) {
      return false;
    }
    // Project name must match
    if (projectName.trim() && getProjectKey(qrProjectName) !== getProjectKey(projectName)) {
      return false;
    }
    // Timestamp validation (optional, if present)
    if (parsed.timestamp && isNaN(parseInt(parsed.timestamp))) {
      return false;
    }
    return true;
  }
};

const ScanQRCode = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanner, setScanner] = useState(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [hasCameraAccess, setHasCameraAccess] = useState(true);
  const [scanMode, setScanMode] = useState('daily'); // 'daily' or 'meeting'
  const [location, setLocation] = useState({ lat: null, lng: null });
  const [locationError, setLocationError] = useState("");
  const [sltLocationRequired, setSltLocationRequired] = useState(true);
  const [officeLocation, setOfficeLocation] = useState(SLT_OFFICE);
  const [projectName, setProjectName] = useState('');
  const [showMeetingInput, setShowMeetingInput] = useState(false);
  const videoRef = useRef(null);
  const isProcessingRef = useRef(false);
  const scanModeRef = useRef(scanMode);
  const projectNameRef = useRef(projectName);
  const sltLocationRequiredRef = useRef(sltLocationRequired);

  // Keep refs in sync with state so the scanner callback always reads the latest values
  useEffect(() => { scanModeRef.current = scanMode; }, [scanMode]);
  useEffect(() => { projectNameRef.current = projectName; }, [projectName]);
  useEffect(() => { sltLocationRequiredRef.current = sltLocationRequired; }, [sltLocationRequired]);

  const distanceKm = getDistanceKm(location, officeLocation);
  const actualLocationValid = distanceKm !== null && distanceKm <= officeLocation.radiusKm;
  const locationValid = !sltLocationRequired || actualLocationValid;
  const canStartScanner = hasCameraAccess && locationValid;

  const checkCameraAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setHasCameraAccess(true);
    } catch (err) {
      setHasCameraAccess(false);
    }
  };

  const startScanning = () => {
    if (scanner || !hasCameraAccess) return;

    if (!locationValid) {
      toast.error(locationError || "You must be within SLT office radius to scan QR attendance.");
      return;
    }

    if (scanMode === 'meeting' && !projectName.trim()) {
      toast.error('Please enter a project name first');
      setShowMeetingInput(true);
      return;
    }

    isProcessingRef.current = false;
    const codeReader = new BrowserMultiFormatReader();
    setScanner(codeReader);

    codeReader.decodeFromVideoDevice(null, videoRef.current, async (result, error) => {
      if (result) {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        const qrData = result.getText();
        const internId = localStorage.getItem("internId");
        const currentScanMode = scanModeRef.current;
        const currentProjectName = projectNameRef.current;

        // Debug: log scanned data so we can diagnose format mismatches
        console.log('[QR Scanner] Scanned data:', qrData);
        console.log('[QR Scanner] Current scan mode:', currentScanMode);

        // For meeting mode, provide explicit mismatch feedback before generic validation
        if (currentScanMode === 'meeting') {
          try {
            const parsed = JSON.parse(qrData);
            const scannedProjectName = normalizeProjectName(parsed?.projectName || parsed?.meetingTitle || '');
            const typedProjectName = normalizeProjectName(currentProjectName || '');

            if (!typedProjectName) {
              toast.error('Please enter a project name first');
              setShowMeetingInput(true);
              setTimeout(() => { isProcessingRef.current = false; }, 1500);
              return;
            }

            if (
              parsed?.type === 'meeting_attendance' &&
              scannedProjectName &&
              getProjectKey(scannedProjectName) !== getProjectKey(typedProjectName)
            ) {
              toast.error(`Project name does not match QR project name: "${scannedProjectName}"`);
              setTimeout(() => { isProcessingRef.current = false; }, 2000);
              return;
            }
          } catch (e) {
            // Let generic validation handle non-JSON or invalid meeting QR payloads.
          }
        }

        // Validate QR code format before processing
        if (!validateQRCodeFormat(qrData, currentScanMode, currentProjectName)) {
          const expectedFormat = currentScanMode === 'daily' ? 'daily attendance' : 'meeting attendance';
          console.warn('[QR Scanner] Validation failed. Expected:', expectedFormat, 'Got:', qrData.substring(0, 100));
          toast.error(`Invalid QR code format. Please scan a valid ${expectedFormat} QR code.`);
          setTimeout(() => { isProcessingRef.current = false; }, 2000); // Unlock after 2s
          return;
        }

        if (!locationValid) {
          toast.error(locationError || "You must be within SLT office radius to scan QR attendance.");
          stopScanning();
          isProcessingRef.current = false;
          return;
        }

        setScanSuccess(true);
        setTimeout(() => setScanSuccess(false), 1500);
        try {
          const freshLocation = sltLocationRequiredRef.current
            ? await requestFreshLocation()
            : location;
          setLocation({
            lat: freshLocation?.latitude ?? freshLocation?.lat ?? null,
            lng: freshLocation?.longitude ?? freshLocation?.lng ?? null,
            accuracy: freshLocation?.accuracy ?? null,
            capturedAt: freshLocation?.capturedAt ?? null,
          });
          const attendanceEvidence = toAttendanceEvidence(freshLocation);

          if (currentScanMode === 'daily') {
            const response = await apiFetch('/qrcode/scan', {
              method: 'POST',
              body: JSON.stringify({
                qrCode: qrData,
                internId,
                scanType: 'daily',
                ...attendanceEvidence
              })
            });
            const res = await response.json();
            if (!response.ok) {
              throw new Error(res.message || 'Failed to mark attendance');
            }
            toast.success(res.message || 'Daily attendance marked successfully!');
            setIsScanning(false);
          } else {
            if (!currentProjectName.trim()) {
              toast.error("Please enter a project name first");
              isProcessingRef.current = false;
              return;
            }
            const response = await apiFetch('/qrcode/scan-meeting', {
              method: 'POST',
              body: JSON.stringify({
                qrCode: qrData,
                internId,
                projectName: currentProjectName.trim(),
                ...attendanceEvidence
              })
            });
            const res = await response.json();
            if (!response.ok) {
              throw new Error(res.message || 'Failed to mark meeting attendance');
            }
            toast.success(res.message || 'Meeting attendance marked successfully!');
            setIsScanning(false);
          }
        } catch (err) {
          console.error("Failed to mark attendance:", err);
          toast.error(err.message || "Failed to mark attendance");
        } finally {
          // If we didn't stop scanning (e.g. error occurred), unlock after a delay so they can try again
          setTimeout(() => { isProcessingRef.current = false; }, 3000);
        }
      }

      if (error && !(error instanceof TypeError) && error.name !== 'NotFoundException' && error.name !== 'NotFoundException2') {
        console.error("Scanning error:", error);
      }
    }).catch(err => {
      console.error('Error during scanning: ', err);
      toast.error("Camera access failed. Please check permissions.");
      setHasCameraAccess(false);
    });
  };

  const stopScanning = () => {
    if (scanner) {
      scanner.reset();
      setScanner(null);
    }
    isProcessingRef.current = false;
    setScanSuccess(false);
    setIsScanning(false);
  };

  const handleScanModeChange = (nextMode) => {
    stopScanning();
    setScanMode(nextMode);
    setShowMeetingInput(nextMode === 'meeting');
  };

  useEffect(() => {
    checkCameraAccess();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await apiFetch("/face-attendance/settings");
        const result = await response.json();
        const isLocationRequired = result.settings?.sltLocationRequired !== false;
        setSltLocationRequired(isLocationRequired);
        if (result.settings?.locationPolicy) {
          setOfficeLocation({
            latitude: result.settings.locationPolicy.latitude,
            longitude: result.settings.locationPolicy.longitude,
            radiusKm: result.settings.locationPolicy.radiusMeters / 1000,
          });
        }
        if (!isLocationRequired) {
          setLocationError("");
          toast.dismiss();
        }
      } catch (error) {
        console.error("Failed to load attendance settings:", error);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    if (!sltLocationRequired) {
      setLocationError("");
      return;
    }

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }

    requestFreshLocation()
      .then((freshLocation) => {
        setLocation({
          lat: freshLocation.latitude,
          lng: freshLocation.longitude,
          accuracy: freshLocation.accuracy,
          capturedAt: freshLocation.capturedAt,
        });
        setLocationError("");
      })
      .catch((error) => {
        console.warn("Geolocation error:", error);
        setLocationError(error.message);
        if (sltLocationRequiredRef.current && isScanning) {
          toast.error("Location access denied. Please enable location to mark attendance.");
          stopScanning();
        }
      });
  }, [isScanning, sltLocationRequired]);

  useEffect(() => {
    if (isScanning && hasCameraAccess) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => {
      if (scanner) {
        scanner.reset();
      }
    };
  }, [isScanning, hasCameraAccess]);

  const containerVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { delayChildren: 0.2, staggerChildren: 0.1 } },
  };

  const itemVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-white">
      <Navigation />

      <motion.div
        className="flex-1 w-full lg:mt-20 lg:px-10"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        <motion.main className="mx-auto px-4 py-6 md:py-8 lg:py-10 max-w-7xl" variants={itemVariants}>
          <motion.div className="mb-6 md:mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between" variants={itemVariants}>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">QR Code Scanner</h1>
              <p className="text-gray-500 mt-1 text-sm md:text-base">Scan your attendance QR code quickly and easily</p>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                locationValid
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {locationValid ? (
                <MapPin className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              {!sltLocationRequired
                ? "Ready to scan"
                : locationValid
                  ? "Ready to scan"
                  : "Outside SLT premises"}
            </div>
          </motion.div>

          {/* Mode Selection */}
          <motion.div className="mb-6" variants={itemVariants}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Scan Type</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleScanModeChange('daily')}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                    scanMode === 'daily'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-blue-300 text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      scanMode === 'daily' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold">Daily Attendance</h3>
                      <p className="text-sm opacity-75">Mark your daily work attendance</p>
                    </div>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleScanModeChange('meeting')}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                    scanMode === 'meeting'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-green-300 text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      scanMode === 'meeting' ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <Camera className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold">Meeting Attendance</h3>
                      <p className="text-sm opacity-75">Mark attendance for meetings</p>
                    </div>
                  </div>
                </motion.button>
              </div>

              {/* Meeting Title Input */}
              {showMeetingInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 pt-4 border-t border-gray-200"
                >
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Enter project name..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </motion.div>
              )}
            </div>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
            {/* Scanner Section */}
            <motion.div className="lg:col-span-2 space-y-6" variants={itemVariants}>
              <motion.div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" variants={itemVariants}>
                <div className="bg-gradient-to-r from-blue-100 to-blue-200 px-5 py-4">
                <div className="flex items-center justify-between">
  <div>
    <h2 className="text-lg font-semibold text-gray-800 flex items-center">
      <Scan className="mr-2 animate-scan-icon" size={20} />
      QR Scanner
    </h2>
    <p className="text-gray-600 text-xs mt-1">
      {isScanning ? 'Scanning active' : 'Ready to scan'}
    </p>
  </div>
  <motion.div
    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[0.9rem] font-medium ${
      isScanning ? 'bg-blue-500 text-white animate-pulse' : 'bg-white text-blue-500'
    }`}
    initial={{ scale: 0.8 }}
    animate={{ scale: 1 }}
    transition={{ duration: 0.3 }}
  >
    {isScanning && (
      <span className="h-2 w-2 rounded-full bg-red-500 mr-1" />
    )}
    {isScanning ? 'Live' : 'Standby'}
  </motion.div>
</div>

                </div>

                <div className="p-5">
                  <motion.div
                    className={`relative aspect-video rounded-lg overflow-hidden transition-all duration-300 ${
                      scanSuccess ? 'ring-4 ring-blue-300 animate-scan-success' :
                      isScanning ? 'ring-2 ring-blue-200 animate-scan-active' : 'bg-gray-100'
                    }`}
                    initial={{ opacity: 0.9 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                  >
                    {(!isScanning || !hasCameraAccess) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 z-10 p-4 text-center">
                        <Camera size={48} className="text-gray-300 mb-3 animate-camera-icon" />
                        <h3 className="font-medium text-gray-500 mb-1">
                          {!hasCameraAccess
                            ? 'Camera access required'
                            : !locationValid
                              ? 'Location access required'
                              : 'Camera is ready'}
                        </h3>
                        <p className="text-gray-400 text-sm max-w-xs">
                          {!hasCameraAccess
                            ? 'Please enable camera permissions to scan'
                            : !locationValid
                              ? locationError || 'You must be within SLT office radius to scan'
                              : 'Press start to begin scanning'}
                        </p>
                      </div>
                    )}

                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      autoPlay
                      muted
                      playsInline
                    />

                    {isScanning && hasCameraAccess && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <motion.div
                            className="w-48 h-48 border-2 border-blue-100/50 rounded-lg animate-scan-focus"
                            animate={{ borderColor: ["rgba(191, 219, 254, 0.5)", "rgba(147, 197, 253, 0.7)", "rgba(191, 219, 254, 0.5)"] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        </div>
                        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/10 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/10 to-transparent"></div>
                      </div>
                    )}

                    {scanSuccess && (
                      <motion.div
                        className="absolute inset-0 bg-blue-100/50 backdrop-blur-sm flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <motion.div
                          className="bg-white px-4 py-3 rounded-lg shadow-lg flex items-center animate-ping-once"
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <CheckCircle size={20} className="text-blue-500 mr-2 animate-check-icon" />
                          <span className="font-medium text-blue-700">Scan Successful!</span>
                        </motion.div>
                      </motion.div>
                    )}
                  </motion.div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <motion.button
                      onClick={() => {
                        if (isScanning) {
                          setIsScanning(false);
                          return;
                        }

                        if (!canStartScanner) {
                          toast.error(
                            !hasCameraAccess
                              ? "Please enable camera permissions to scan."
                              : locationError || "You must be within SLT office radius to scan QR attendance.",
                          );
                          return;
                        }

                        setIsScanning(true);
                      }}
                      disabled={!isScanning && !canStartScanner}
                      className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center font-medium text-sm transition-all ${
                        isScanning
                          ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 animate-pulse-soft'
                          : 'bg-gradient-to-r from-blue-100 to-blue-200 text-gray-800 hover:shadow-md hover:from-blue-200 hover:to-blue-300'
                      } ${!isScanning && !canStartScanner ? 'opacity-50 cursor-not-allowed animate-shake' : ''}`}
                      whileTap={{ scale: 0.95 }}
                    >
                      {isScanning ? (
                        <>
                          <XCircle size={18} className="mr-2 animate-x-icon" />
                          Stop Scanner
                        </>
                      ) : (
                        <>
                          <Scan size={18} className="mr-2 animate-scan-icon" />
                          Start Scanner
                        </>
                      )}
                    </motion.button>

                    {!hasCameraAccess && (
                      <motion.button
                        onClick={checkCameraAccess}
                        className="flex-1 py-3 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm flex items-center justify-center transition-all animate-fade-in"
                        whileTap={{ scale: 0.95 }}
                      >
                        <Camera size={18} className="mr-2 animate-camera-icon" />
                        Check Camera
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Quick Tips */}
              <motion.div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5" variants={itemVariants}>
                <h3 className="font-medium text-gray-900 flex items-center mb-3">
                  <Info size={18} className="text-blue-400 mr-2 animate-info-icon" />
                  Quick Tips
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: '🔍', text: 'Hold steady 15-50cm from code' },
                    { icon: '💡', text: 'Ensure good lighting' },
                    { icon: '📱', text: 'Clean camera lens' },
                    { icon: '🔄', text: 'Try different angles if needed' }
                  ].map((tip, index) => (
                    <motion.div key={index} className="flex items-start gap-2 animate-fade-in" variants={itemVariants} style={{ transitionDelay: `${0.2 + index * 0.05}s` }}>
                      <span className="text-lg mt-0.5 animate-icon-bounce">{tip.icon}</span>
                      <p className="text-sm text-gray-600">{tip.text}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* Instructions Section */}
            <motion.div className="space-y-6" variants={itemVariants}>
              <motion.div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" variants={itemVariants}>
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-5 py-4">
                  <h3 className="font-medium text-gray-800 flex items-center">
                    <CheckCircle size={18} className="mr-2 text-blue-400 animate-check-icon" />
                    How to Scan
                  </h3>
                </div>
                <div className="p-5">
                  <ol className="space-y-4">
                    {[
                      "Open the camera scanner by pressing 'Start Scanner'",
                      "Position the QR code within the frame",
                      "Hold your device steady until scanned",
                      "Wait for the success confirmation"
                    ].map((step, index) => (
                      <motion.li key={index} className="flex items-start gap-3 animate-slide-in-left" variants={itemVariants} style={{ transitionDelay: `${0.3 + index * 0.05}s` }}>
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-500 font-medium text-sm flex items-center justify-center mt-0.5 animate-number-bounce">
                          {index + 1}
                        </div>
                        <p className="text-gray-700 text-sm">{step}</p>
                      </motion.li>
                    ))}
                  </ol>
                </div>
              </motion.div>

              <motion.div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" variants={itemVariants}>
                <div className="bg-gradient-to-r from-blue-100 to-blue-200 px-5 py-4">
                  <h3 className="font-medium text-gray-800 flex items-center">
                    <Info size={18} className="mr-2 text-blue-400 animate-info-icon" />
                    Troubleshooting
                  </h3>
                </div>
                <div className="p-5">
                  <div className="space-y-4">
                    {[
                      "Camera not working? Check browser permissions",
                      "QR code not scanning? Try moving closer/farther",
                      "Still having issues? Try restarting the scanner",
                      "Contact support if problems persist"
                    ].map((item, index) => (
                      <motion.div key={index} className="flex items-start gap-3 animate-slide-in-right" variants={itemVariants} style={{ transitionDelay: `${0.4 + index * 0.05}s` }}>
                        <ChevronRight size={16} className="flex-shrink-0 text-blue-400 mt-0.5 animate-chevron" />
                        <p className="text-gray-700 text-sm">{item}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>

              <motion.div className="bg-blue-50 border border-blue-100 rounded-xl p-5 animate-fade-in" variants={itemVariants}>
                <h3 className="font-medium text-gray-800 mb-2 animate-text-slide-up">Need Help?</h3>
                <p className="text-gray-600 text-sm mb-3 animate-text-slide-up" style={{ transitionDelay: '0.1s' }}>
                  If you're experiencing issues with the scanner, our support team is here to help.
                </p>
                <motion.button
                  className="w-full py-2 px-4 bg-white border border-blue-200 text-blue-500 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors animate-button-bounce"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Contact Support
                </motion.button>
              </motion.div>
            </motion.div>
          </div>
        </motion.main>
      </motion.div>
    </div>
  );
};

export default ScanQRCode;
