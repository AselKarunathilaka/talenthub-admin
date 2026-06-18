import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import AdminNavigation from '../components/AdminNavigation';
import { KeyRound } from "lucide-react";
import {
  FaCheckCircle,
  FaKey,
  FaRedo,
  FaSearch,
  FaShieldAlt,
  FaSpinner,
  FaTimes,
  FaUserCheck,
  FaUserClock,
  FaUsers,
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { adminApi } from '../api/adminApi';
import logo from '../assets/sltlogo.jpg';

const AdminPinManagement = () => {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [facePinData, setFacePinData] = useState(null);
  const [pinCountdown, setPinCountdown] = useState(0);


  const fetchFacePin = useCallback(async (rotate = false) => {
    if (!projectName.trim()) {
      toast.error('Please enter a project name first');
      return;
    }

    try {
      setPinLoading(true);
      const response = await adminApi.getFaceMeetingPin(projectName.trim(), { rotate });
      setFacePinData(response);
      setPinCountdown(response.ttlSeconds || 0);
    } catch (error) {
      toast.error(error.message || 'Failed to generate face attendance PIN');
      console.error(error);
    } finally {
      setPinLoading(false);
    }
  }, [projectName]);

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
  }, [projectName]);

  const stopPinGeneration = async () => {
    if (!projectName.trim()) {
      setFacePinData(null);
      setPinCountdown(0);
      return;
    }

    try {
      setStopLoading(true);
      await adminApi.stopFaceMeetingPin(projectName.trim());
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
    <AdminNavigation>
      <div className="min-h-screen bg-slate-50 font-sans text-gray-800 pb-10 flex flex-col">
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
                    <KeyRound className="text-[#0056a2] h-8 w-8" />
                  </div>
                  Generate PIN
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
                >
                  Create the 5-minute PIN for Face Attendance Daily + Meeting.
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
                    
                    <div className="flex-1 flex flex-col justify-center space-y-8">
                      <label className="block">
                        <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Project Name</span>
                        <input
                          type="text"
                          value={projectName}
                          onChange={(event) => setProjectName(event.target.value)}
                          placeholder="e.g., TalentHub Development"
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-[#00b4eb] transition-all font-semibold text-gray-800 outline-none text-base"
                        />
                      </label>

                      <div className="p-5 bg-blue-50/60 text-[#0056a2] rounded-2xl text-sm font-medium border border-blue-100/60 leading-relaxed shadow-sm">
                        <div className="flex items-start gap-3">
                          <FaShieldAlt className="w-5 h-5 flex-shrink-0 mt-0.5 opacity-80" />
                          <p>Generate this PIN for the selected project. Interns must enter the current PIN before marking Face Attendance Daily + Meeting.</p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => fetchFacePin(true)}
                      disabled={pinLoading}
                      className="mt-8 w-full py-4 bg-gradient-to-r from-[#00b4eb] to-[#0056a2] hover:shadow-blue-500/30 text-white rounded-2xl font-bold text-lg shadow-lg transition-all flex items-center justify-center space-x-3 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
                    >
                      {pinLoading ? (
                        <><FaSpinner className="animate-spin text-xl" /><span>Generating...</span></>
                      ) : (
                        <><FaKey className="text-xl" /><span>{generateButtonLabel}</span></>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Main PIN Display */}
              <motion.div 
                className="lg:col-span-2 space-y-6 h-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-gray-100 min-h-[400px] lg:min-h-[500px] flex flex-col items-center justify-center relative overflow-hidden h-full">
                  {!facePinData ? (
                    <div className="text-center text-gray-400 space-y-4">
                      <FaShieldAlt className="w-20 h-20 mx-auto opacity-10" />
                      <p className="text-base font-medium">Enter project name and generate to view PIN</p>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative w-full max-w-lg rounded-3xl border-2 border-[#00b4eb]/20 bg-[#00b4eb]/5 p-8 sm:p-10 text-center shadow-inner"
                    >
                      <button
                        type="button"
                        onClick={stopPinGeneration}
                        disabled={stopLoading}
                        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm border border-gray-100 transition hover:bg-red-50 hover:text-red-600 hover:border-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Stop current PIN"
                        title="Stop current PIN"
                      >
                        {stopLoading ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaTimes className="h-4 w-4" />}
                      </button>
                      
                      <div className="text-xs font-black uppercase tracking-[0.25em] text-[#0056a2]">Current PIN</div>
                      
                      <div className="mt-6 text-6xl sm:text-7xl md:text-8xl font-black tracking-[0.15em] text-gray-900 drop-shadow-sm">
                        {facePinData.pin}
                      </div>
                      
                      <div className="mt-8 inline-flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm text-sm font-bold text-gray-600">
                        <FaUserClock className="text-[#00b4eb]" />
                        Changes in {Math.floor(pinCountdown / 60)}:{String(pinCountdown % 60).padStart(2, '0')}
                      </div>
                      
                      <div className="mt-4 text-sm font-medium text-gray-500 truncate px-4">
                        Project: <span className="font-bold text-gray-700">{facePinData.projectName}</span>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>

            </div>
          </main>
        </div>
      </div>
  </AdminNavigation>
  );
};

export default AdminPinManagement;
