import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaQrcode, FaCalendarDay, FaUsers, FaDownload, FaExpand, FaSpinner, FaCopy } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { adminApi } from '../api/adminApi';
import logo from '../assets/sltlogo.jpg';

const AdminQRManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('meeting'); // 'meeting' or 'daily'
  const [meetingTitle, setMeetingTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleGenerate = async () => {
    if (activeTab === 'meeting' && !meetingTitle.trim()) {
      toast.error('Please enter a meeting title');
      return;
    }

    try {
      setLoading(true);
      setQrCodeData(null);
      const response = await adminApi.generateQRCode(activeTab, activeTab === 'meeting' ? meetingTitle : '');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-gray-800 overflow-hidden font-sans">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
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
              {activeTab === 'meeting' ? meetingTitle : 'Daily Attendance'}
            </h1>
            <p className="text-2xl text-gray-500 mb-12">Please scan using your TalentHub App</p>
            <div className="bg-white p-6 rounded-3xl shadow-2xl border-4 border-gray-100">
              <img src={qrCodeData.qrCode} alt="Generated QR" className="w-[500px] h-[500px] object-contain" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navbar */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm fixed top-0 left-0 right-0 z-30 h-[4.5rem] border-b border-gray-100">
        <div className="flex items-center justify-between h-full px-6 lg:px-8">
          <div className="flex items-center space-x-4 cursor-pointer" onClick={() => navigate('/admin/dashboard')}>
            <img src={logo} alt="SLT Logo" className="h-10 w-auto rounded-lg shadow-sm" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900">SLT Admin Portal</span>
              <span className="text-sm text-gray-600 font-medium">QR Management</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-[5.5rem] pb-8 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto">
          
          <div className="flex items-center space-x-4 mb-8">
            <motion.button
              onClick={() => navigate('/admin/dashboard')}
              className="flex items-center space-x-2 px-4 py-2 bg-white/80 backdrop-blur-sm hover:bg-gray-50 rounded-xl border border-gray-200 shadow-sm transition-all text-gray-700 font-medium"
              whileHover={{ scale: 1.05, x: -5 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </motion.button>
          </div>

          <div className="text-center mb-10">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3 tracking-tight">
              Generate <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">Attendance QR</span>
            </h2>
            <p className="text-gray-500 text-lg">Create secure QR codes for daily check-ins or special meetings.</p>
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
                        <label className="block text-sm font-bold text-gray-700 mb-2">Meeting Title</label>
                        <input
                          type="text"
                          value={meetingTitle}
                          onChange={(e) => setMeetingTitle(e.target.value)}
                          placeholder="e.g., Monthly Progress Review"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium text-gray-800 outline-none"
                        />
                      </div>
                      <div className="p-4 bg-blue-50 text-blue-800 rounded-2xl text-sm font-medium border border-blue-100">
                        This will generate a secure JSON-encoded QR code specifically for this meeting event.
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
      </div>
    </div>
  );
};

export default AdminQRManagement;
