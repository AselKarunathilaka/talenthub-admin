import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaKey, FaShieldAlt, FaSpinner, FaTimes } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { adminApi } from '../api/adminApi';
import logo from '../assets/sltlogo.jpg';

const AdminPinManagement = () => {
  const navigate = useNavigate();
  const [meetingTitle, setMeetingTitle] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [facePinData, setFacePinData] = useState(null);
  const [pinCountdown, setPinCountdown] = useState(0);

  const fetchFacePin = useCallback(async (rotate = false) => {
    if (!meetingTitle.trim()) {
      toast.error('Please enter a meeting title first');
      return;
    }

    try {
      setPinLoading(true);
      const response = await adminApi.getFaceMeetingPin(meetingTitle.trim(), { rotate });
      setFacePinData(response);
      setPinCountdown(response.ttlSeconds || 0);
    } catch (error) {
      toast.error(error.message || 'Failed to generate face attendance PIN');
      console.error(error);
    } finally {
      setPinLoading(false);
    }
  }, [meetingTitle]);

  useEffect(() => {
    if (!facePinData) return undefined;

    const timer = window.setInterval(() => {
      setPinCountdown((current) => {
        if (current <= 1) {
          fetchFacePin();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [facePinData, fetchFacePin]);

  useEffect(() => {
    setFacePinData(null);
    setPinCountdown(0);
  }, [meetingTitle]);

  const stopPinGeneration = async () => {
    if (!meetingTitle.trim()) {
      setFacePinData(null);
      setPinCountdown(0);
      return;
    }

    try {
      setStopLoading(true);
      await adminApi.stopFaceMeetingPin(meetingTitle.trim());
      setFacePinData(null);
      setPinCountdown(0);
      toast.success('Current PIN stopped. Generate again for a fresh PIN.');
    } catch (error) {
      toast.error(error.message || 'Failed to stop current PIN');
      console.error(error);
    } finally {
      setStopLoading(false);
    }
  };

  const generateButtonLabel = facePinData ? 'Generate Fresh PIN' : 'Generate PIN';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-gray-800 overflow-hidden font-sans">
      <header className="bg-white/80 backdrop-blur-md shadow-sm fixed top-0 left-0 right-0 z-30 h-[4.5rem] border-b border-gray-100">
        <div className="flex items-center justify-between h-full px-6 lg:px-8">
          <div className="flex items-center space-x-4 cursor-pointer" onClick={() => navigate('/admin/dashboard')}>
            <img src={logo} alt="SLT Logo" className="h-10 w-auto rounded-lg shadow-sm" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900">SLT Admin Portal</span>
              <span className="text-sm text-gray-600 font-medium">PIN Management</span>
            </div>
          </div>
        </div>
      </header>

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
              Generate <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-cyan-600">Face Meeting PIN</span>
            </h2>
            <p className="text-gray-500 text-lg">Create the 5-minute PIN for Face Attendance Daily + Meeting.</p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <FaKey className="w-32 h-32" />
                </div>

                <div className="relative z-10">
                  <h3 className="text-xl font-bold text-gray-800 mb-6">Configuration</h3>
                  <label className="block">
                    <span className="block text-sm font-bold text-gray-700 mb-2">Meeting Title</span>
                    <input
                      type="text"
                      value={meetingTitle}
                      onChange={(event) => setMeetingTitle(event.target.value)}
                      placeholder="e.g., Monthly Progress Review"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all font-medium text-gray-800 outline-none"
                    />
                  </label>

                  <div className="mt-5 p-4 bg-emerald-50 text-emerald-800 rounded-2xl text-sm font-medium border border-emerald-100">
                    Generate this PIN inside the meeting cabin. Interns must enter the current PIN before marking Face Attendance Daily + Meeting.
                  </div>

                  <button
                    type="button"
                    onClick={() => fetchFacePin(true)}
                    disabled={pinLoading || !meetingTitle.trim()}
                    className="mt-6 w-full py-4 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-100 transition-all flex items-center justify-center space-x-3 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {pinLoading ? (
                      <><FaSpinner className="animate-spin text-xl" /><span>Generating...</span></>
                    ) : (
                      <><FaKey className="text-xl" /><span>{generateButtonLabel}</span></>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 sm:p-12 shadow-xl border border-gray-100 min-h-[500px] flex flex-col items-center justify-center relative">
                {!facePinData ? (
                  <div className="text-center text-gray-400 space-y-4">
                    <FaShieldAlt className="w-24 h-24 mx-auto opacity-20" />
                    <p className="text-lg font-medium">Enter meeting title and generate to view PIN</p>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative w-full max-w-lg rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-cyan-50 p-8 text-center"
                  >
                    <button
                      type="button"
                      onClick={stopPinGeneration}
                      disabled={stopLoading}
                      className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-gray-500 shadow-sm transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Stop current PIN"
                      title="Stop current PIN"
                    >
                      {stopLoading ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaTimes className="h-4 w-4" />}
                    </button>
                    <div className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700">Current PIN</div>
                    <div className="mt-5 text-6xl sm:text-7xl font-extrabold tracking-[0.18em] text-gray-900">
                      {facePinData.pin}
                    </div>
                    <div className="mt-5 text-base font-semibold text-gray-600">
                      Changes in {Math.floor(pinCountdown / 60)}:{String(pinCountdown % 60).padStart(2, '0')}
                    </div>
                    <div className="mt-3 text-sm text-gray-500 truncate">
                      {facePinData.meetingTitle}
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

export default AdminPinManagement;
