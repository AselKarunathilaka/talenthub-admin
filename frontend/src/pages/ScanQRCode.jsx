import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { BrowserMultiFormatReader } from '@zxing/library';
import { api } from '../utils/api';
import { Camera, Scan, XCircle, Info, CheckCircle, ChevronRight } from 'lucide-react';
import Navigation from '../components/Navigation';
import { motion } from 'framer-motion';

const ScanQRCode = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanner, setScanner] = useState(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [hasCameraAccess, setHasCameraAccess] = useState(true);
  const videoRef = useRef(null);

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

    const codeReader = new BrowserMultiFormatReader();
    setScanner(codeReader);

    codeReader.decodeFromVideoDevice(null, videoRef.current, async (result, error) => {
      if (result) {
        const qrData = result.getText();
        const internId = localStorage.getItem("internId");

        setScanSuccess(true);
        setTimeout(() => setScanSuccess(false), 1500);

        try {
          const res = await api.post('/qrcode/scan', { qrCode: qrData, internId });
          toast.success(res.message || "Attendance marked successfully!");
          setIsScanning(false);
        } catch (err) {
          console.error("Failed to mark attendance:", err);
          toast.error(err.response?.data?.message || "Failed to mark attendance");
        }
      }

      if (error && !(error instanceof TypeError)) {
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
    setIsScanning(false);
  };

  useEffect(() => {
    checkCameraAccess();
  }, []);

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
          <motion.div className="mb-6 md:mb-8" variants={itemVariants}>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">QR Code Scanner</h1>
            <p className="text-gray-500 mt-1 text-sm md:text-base">Scan your attendance QR code quickly and easily</p>
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
                          {hasCameraAccess ? 'Camera is ready' : 'Camera access required'}
                        </h3>
                        <p className="text-gray-400 text-sm max-w-xs">
                          {hasCameraAccess
                            ? 'Press start to begin scanning'
                            : 'Please enable camera permissions to scan'}
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
                      onClick={() => setIsScanning(!isScanning)}
                      disabled={!hasCameraAccess}
                      className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center font-medium text-sm transition-all ${
                        isScanning
                          ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 animate-pulse-soft'
                          : 'bg-gradient-to-r from-blue-100 to-blue-200 text-gray-800 hover:shadow-md hover:from-blue-200 hover:to-blue-300'
                      } ${!hasCameraAccess ? 'opacity-50 cursor-not-allowed animate-shake' : ''}`}
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