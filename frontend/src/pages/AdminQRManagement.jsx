import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import AdminNavigation from '../components/AdminNavigation';
import { QrCode } from "lucide-react";
import { FaArrowLeft, FaQrcode, FaCalendarDay, FaUsers, FaDownload, FaExpand, FaSpinner, FaCopy } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { adminApi } from '../api/adminApi';
import logo from '../assets/sltlogo.jpg';

const AdminQRManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('meeting'); // 'meeting' or 'daily'
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleGenerate = async () => {
    if (activeTab === 'meeting' && !projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    try {
      setLoading(true);
      setQrCodeData(null);
      const response = await adminApi.generateQRCode(activeTab, activeTab === 'meeting' ? projectName : '');
      setQrCodeData(response);
      toast.success(`${activeTab === 'meeting' ? 'Meeting' : 'Daily'} QR Code generated successfully`);
    } catch (error) {
      toast.error('Failed to generate QR Code');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    if (!qrCodeData?.qrCode) return;
    const a = document.createElement('a');
    a.href = qrCodeData.qrCode;
    a.download = `${activeTab}_qr_code_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('QR Code downloaded');
  };

  const copyToClipboard = () => {
    if (!qrCodeData?.sessionId) return;
    navigator.clipboard.writeText(qrCodeData.sessionId);
    toast.success('QR Code content copied to clipboard');
  };

  return (
    <AdminNavigation>
<<<<<<< HEAD
      <div className="min-h-screen bg-slate-50 font-sans text-gray-800 pb-10 flex flex-col">
        
        {/* Full Screen Mode */}
        <AnimatePresence>
          {isFullScreen && qrCodeData && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-8"
            >
              <button 
                onClick={() => setIsFullScreen(false)}
                className="absolute top-8 right-8 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl font-bold text-lg transition-colors"
              >
                Close Fullscreen
              </button>
              <h1 className="text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">
                {activeTab === 'meeting' ? projectName : 'Daily Attendance'}
              </h1>
              <p className="text-2xl text-gray-500 mb-12">Please scan using your TalentHub App</p>
              <div className="bg-white p-6 rounded-3xl shadow-2xl border-4 border-gray-100">
                <img src={qrCodeData.qrCode} alt="Generated QR" className="w-[500px] h-[500px] object-contain" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                    <QrCode className="text-[#0056a2] h-8 w-8" />
                  </div>
                  Generate QR
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
                >
                  Create secure QR codes for daily check-ins or special meetings.
                </motion.p>
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
                        onClick={() => { setActiveTab("meeting"); setQrCodeData(null); }}
                        className={`relative z-10 flex-1 py-3 px-2 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                          activeTab === "meeting"
                            ? "text-white"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <FaUsers className={activeTab === "meeting" ? "text-white/90" : ""} />
                        <span>Meeting</span>
                      </button>
                      <button
                        onClick={() => { setActiveTab("daily"); setQrCodeData(null); }}
                        className={`relative z-10 flex-1 py-3 px-2 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                          activeTab === "daily"
                            ? "text-white"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <FaCalendarDay className={activeTab === "daily" ? "text-white/90" : ""} />
                        <span>Daily</span>
                      </button>

                      <div
                        className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-300 ease-out shadow-sm"
                        style={{
                          background:
                            activeTab === "meeting"
                              ? "linear-gradient(135deg, #00b4eb 0%, #0056a2 100%)"
                              : "linear-gradient(135deg, #50b748 0%, #2e7d32 100%)",
                          left: activeTab === "meeting" ? "6px" : "calc(50%)",
                        }}
                      />
                    </div>

                    <div className="flex-1 relative flex flex-col justify-center min-h-[220px]">
                      <AnimatePresence mode="wait">
                        {activeTab === 'meeting' && (
                          <motion.div key="meeting-form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col justify-center space-y-6 w-full">
                            <label className="block">
                              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Project Name</span>
                              <input
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="e.g., TalentHub Development"
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-[#00b4eb] transition-all font-semibold text-gray-800 outline-none text-base"
                              />
                            </label>

                            <div className="p-5 bg-blue-50/60 text-[#0056a2] rounded-2xl text-sm font-medium border border-blue-100/60 leading-relaxed shadow-sm">
                              <div className="flex items-start gap-3">
                                <FaUsers className="w-5 h-5 flex-shrink-0 mt-0.5 opacity-80" />
                                <p>This will generate a secure JSON-encoded QR code specifically for this project meeting.</p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                        {activeTab === 'daily' && (
                          <motion.div key="daily-form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col justify-center w-full">
                            <div className="p-5 bg-cyan-50/60 text-cyan-800 rounded-2xl text-sm font-medium border border-cyan-100/60 leading-relaxed shadow-sm">
                              <div className="flex items-start gap-3">
                                <FaCalendarDay className="w-5 h-5 flex-shrink-0 mt-0.5 opacity-80" />
                                <p>Generates the standard daily check-in code. Ensure interns are within 2km of SLT premises to successfully scan.</p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={loading}
                      className="mt-8 w-full py-4 bg-gradient-to-r from-[#00b4eb] to-[#0056a2] hover:shadow-blue-500/30 text-white rounded-2xl font-bold text-lg shadow-lg transition-all flex items-center justify-center space-x-3 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
                    >
                      {loading ? (
                        <><FaSpinner className="animate-spin text-xl" /><span>Generating...</span></>
                      ) : (
                        <><FaQrcode className="text-xl" /><span>Generate QR Code</span></>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Main QR Display */}
              <motion.div 
                className="lg:col-span-2 space-y-6 h-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-gray-100 min-h-[400px] lg:min-h-[500px] flex flex-col items-center justify-center relative overflow-hidden h-full">
                  {!qrCodeData ? (
                    <div className="text-center text-gray-400 space-y-4">
                      <FaQrcode className="w-20 h-20 mx-auto opacity-10" />
                      <p className="text-base font-medium">Configure and generate to view QR Code</p>
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      className="w-full flex flex-col items-center relative z-10"
                    >
                      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-10 inline-block">
                        <img src={qrCodeData.qrCode} alt="Generated QR" className="w-64 h-64 sm:w-80 sm:h-80 object-contain" />
                      </div>
                      
                      <div className="flex flex-wrap justify-center gap-4 w-full">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setIsFullScreen(true)}
                          className="flex items-center space-x-2 px-6 py-3 bg-[#00b4eb]/10 hover:bg-[#00b4eb]/20 text-[#0056a2] rounded-xl font-bold transition-colors"
                        >
                          <FaExpand />
                          <span>Present</span>
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={downloadQR}
                          className="flex items-center space-x-2 px-6 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold transition-colors"
                        >
                          <FaDownload />
                          <span>Download</span>
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={copyToClipboard}
                          className="flex items-center space-x-2 px-6 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-bold transition-colors"
                        >
                          <FaCopy />
                          <span>Copy Code</span>
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>

            </div>
          </main>
=======
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-gray-800 overflow-hidden font-sans relative">
        {/* Background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute w-80 h-80 rounded-full bg-blue-100/40 -top-20 -left-20" animate={{ y: [0, -30, 0], x: [0, 20, 0] }} transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute w-96 h-96 rounded-full bg-cyan-100/40 top-1/4 right-0" animate={{ y: [0, 20, 0], x: [0, -20, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }} />
      </div>

      {/* Full Screen Mode */}
      <AnimatePresence>
        {isFullScreen && qrCodeData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-8"
          >
            <button 
              onClick={() => setIsFullScreen(false)}
              className="absolute top-8 right-8 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl font-bold text-lg transition-colors"
            >
              Close Fullscreen
            </button>
            <h1 className="text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">
              {activeTab === 'meeting' ? projectName : 'Daily Attendance'}
            </h1>
            <p className="text-2xl text-gray-500 mb-12">Please scan using your TalentHub App</p>
            <div className="bg-white p-6 rounded-3xl shadow-2xl border-4 border-gray-100">
              <img src={qrCodeData.qrCode} alt="Generated QR" className="w-[500px] h-[500px] object-contain" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Main Content */}
      <div className="pb-8 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto">
          
          

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
                  <QrCode className="text-[#0056a2] h-8 w-8" />
                </div>
                QR
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05, duration: 0.2 }}
                className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
              >
                Create secure QR codes for daily check-ins or special meetings.
              </motion.p>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Panel: Controls */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <FaQrcode className="w-32 h-32" />
                </div>
                
                <h3 className="text-xl font-bold text-gray-800 mb-6">Configuration</h3>
                
                {/* Tabs */}
                <div className="flex p-1 bg-gray-100 rounded-2xl mb-8 relative z-10">
                  <button
                    onClick={() => { setActiveTab('meeting'); setQrCodeData(null); }}
                    className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                      activeTab === 'meeting' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <FaUsers />
                    <span>Meeting</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('daily'); setQrCodeData(null); }}
                    className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                      activeTab === 'daily' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <FaCalendarDay />
                    <span>Daily Check-in</span>
                  </button>
                </div>

                {/* Forms */}
                <AnimatePresence mode="wait">
                  {activeTab === 'meeting' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4 mb-8">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Project Name</label>
                        <input
                          type="text"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          placeholder="e.g., TalentHub Development"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium text-gray-800 outline-none"
                        />
                      </div>
                      <div className="p-4 bg-blue-50 text-blue-800 rounded-2xl text-sm font-medium border border-blue-100">
                        This will generate a secure JSON-encoded QR code specifically for this project.
                      </div>
                    </motion.div>
                  )}
                  {activeTab === 'daily' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-8">
                      <div className="p-4 bg-cyan-50 text-cyan-800 rounded-2xl text-sm font-medium border border-cyan-100">
                        Generates the standard daily check-in code. Ensure interns are within 2km of SLT premises to successfully scan.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  onClick={handleGenerate}
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 transition-all flex items-center justify-center space-x-3 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><FaSpinner className="animate-spin text-xl" /><span>Generating...</span></>
                  ) : (
                    <><FaQrcode className="text-xl" /><span>Generate QR Code</span></>
                  )}
                </motion.button>
              </div>

            </div>

            {/* Right Panel: Display */}
            <div className="lg:col-span-7">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 sm:p-12 shadow-xl border border-gray-100 min-h-[500px] flex flex-col items-center justify-center relative">
                {!qrCodeData ? (
                  <div className="text-center text-gray-400 space-y-4">
                    <FaQrcode className="w-24 h-24 mx-auto opacity-20" />
                    <p className="text-lg font-medium">Configure and generate to view QR Code</p>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    className="w-full flex flex-col items-center"
                  >
                    <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-8 inline-block">
                      <img src={qrCodeData.qrCode} alt="Generated QR" className="w-64 h-64 sm:w-80 sm:h-80 object-contain" />
                    </div>
                    
                    <div className="flex flex-wrap justify-center gap-4 w-full">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsFullScreen(true)}
                        className="flex items-center space-x-2 px-6 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-semibold transition-colors"
                      >
                        <FaExpand />
                        <span>Present</span>
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={downloadQR}
                        className="flex items-center space-x-2 px-6 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-semibold transition-colors"
                      >
                        <FaDownload />
                        <span>Download</span>
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={copyToClipboard}
                        className="flex items-center space-x-2 px-6 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-semibold transition-colors"
                      >
                        <FaCopy />
                        <span>Copy Code</span>
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
            
          </div>
        </div>
>>>>>>> talenthub/main
        </div>
      </div>
    </AdminNavigation>
  );
};

export default AdminQRManagement;
