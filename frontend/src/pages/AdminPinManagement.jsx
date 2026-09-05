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
  FaCopy,
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { adminApi } from '../api/adminApi';
import { API_BASE_URL } from '../api/apiConfig';
import logo from '../assets/sltlogo.jpg';

const AdminPinManagement = () => {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [facePinData, setFacePinData] = useState(null);
  const [pinCountdown, setPinCountdown] = useState(0);
  const [projects, setProjects] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = React.useRef(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
        const headers = {
          "Content-Type": "application/json",
          ...(adminInfo.token && { Authorization: `Bearer ${adminInfo.token}` }),
        };
        const response = await fetch(`${API_BASE_URL}/admin/talenttrail/projects`, { headers });
        if (response.ok) {
          const data = await response.json();
          setProjects(data);
        }
      } catch (err) {
        console.error("Failed to load projects", err);
      }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const filteredProjects = React.useMemo(() => {
    if (!projectName) return projects.slice(0, 50);
    const query = projectName.toLowerCase();
    return projects
      .filter(p => (p.projectName || p.name || "").toLowerCase().includes(query))
      .slice(0, 50);
  }, [projects, projectName]);
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
      <div className="min-h-full relative font-sans text-slate-800 flex flex-col">
        <main className="relative flex-1 p-3 sm:p-6 sm:px-8 mx-auto max-w-[1400px] w-full flex flex-col gap-5 sm:gap-6 min-w-0">
            
            {/* Header Section */}
            <div className="relative z-30 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 pt-2 mb-8">
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="p-2.5 sm:p-3 md:p-3.5 bg-gradient-to-br from-[#000066] to-[#006600] shadow-md rounded-lg sm:rounded-xl md:rounded-2xl border border-[#006600]/20 flex-shrink-0"
                >
                  <KeyRound className="text-white h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
                </motion.div>
                <div className="flex flex-col justify-center">
                  <motion.h1
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight"
                  >
                    Generate PIN
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    className="text-slate-500 mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base font-medium max-w-xl"
                  >
                    Create the 5-minute PIN for Face Attendance Daily + Meeting.
                  </motion.p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12 lg:gap-8 items-stretch">
              
              {/* Sidebar Configuration */}
              <motion.div 
                className="lg:col-span-5 space-y-6 h-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-white rounded-3xl p-4 sm:p-6 lg:p-8 shadow-sm border border-gray-100 relative overflow-hidden h-full flex flex-col">

                  <div className="relative z-10 flex-1 flex flex-col">
                    <h3 className="text-xl font-extrabold text-gray-900 mb-6">Configuration</h3>
                    
                    <div className="flex flex-col space-y-5 mt-2">
                      <label className="block relative" ref={dropdownRef}>
                        <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Project Name</span>
                        <div className="relative">
                          <input
                            type="text"
                            value={projectName}
                            onChange={(event) => {
                              setProjectName(event.target.value);
                              setIsDropdownOpen(true);
                            }}
                            onFocus={() => setIsDropdownOpen(true)}
                            placeholder="Ex. TalentHub"
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-[#00b4eb] transition-all font-semibold text-gray-800 outline-none text-base"
                          />
                          {projectName && (
                            <button 
                              type="button" 
                              onClick={() => setProjectName("")} 
                              className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full transition-colors z-10"
                            >
                              <FaTimes className="w-3 h-3 text-slate-600" />
                            </button>
                          )}
                        </div>
                        
                        <AnimatePresence>
                          {isDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] z-50 overflow-hidden flex flex-col max-h-[220px]"
                            >
                              <div className="overflow-y-auto custom-scrollbar flex-1 p-1.5">
                                {projects.length === 0 ? (
                                  <div className="px-4 py-4 text-xs text-slate-500 text-center font-medium flex items-center justify-center gap-2">
                                    <FaSpinner className="animate-spin text-blue-500" /> Loading projects...
                                  </div>
                                ) : filteredProjects.length === 0 ? (
                                  <div className="px-4 py-3 text-xs text-slate-500 text-center font-medium">
                                    No projects found
                                  </div>
                                ) : (
                                  filteredProjects.map((proj) => {
                                      const pName = proj.projectName || proj.name;
                                      return (
                                        <div
                                          key={proj._id || pName}
                                          onClick={() => {
                                            setProjectName(pName);
                                            setIsDropdownOpen(false);
                                          }}
                                          className="px-4 py-3 rounded-xl text-sm cursor-pointer flex items-center justify-between transition-colors hover:bg-blue-50/50 hover:text-blue-700 text-slate-700 font-medium"
                                        >
                                          <span className="truncate">{pName}</span>
                                        </div>
                                      );
                                  })
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </label>

                      <div className="p-4 bg-blue-50/60 text-[#0056a2] rounded-2xl text-xs font-medium border border-blue-100/60 leading-relaxed shadow-sm">
                        <div className="flex items-start gap-2.5">
                          <FaShieldAlt className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-80" />
                          <p>Generate this PIN for the selected project. Interns must enter the current PIN before marking Face Attendance Daily + Meeting.</p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => fetchFacePin(true)}
                      disabled={pinLoading}
                      className="mt-5 w-full py-3 sm:py-4 bg-gradient-to-r from-[#000066] to-[#006600] hover:from-[#000050] hover:to-[#005000] text-white rounded-2xl font-bold text-base sm:text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center space-x-2 sm:space-x-3 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
                    >
                      {pinLoading ? (
                        <><FaSpinner className="animate-spin text-lg sm:text-xl" /><span>Generating...</span></>
                      ) : (
                        <><FaKey className="text-lg sm:text-xl" /><span>{generateButtonLabel}</span></>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Main PIN Display */}
              <motion.div 
                className="lg:col-span-7 space-y-6 h-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                <div className="bg-white rounded-3xl p-4 sm:p-8 md:p-12 shadow-sm border border-gray-100 min-h-[350px] flex flex-col items-center justify-center relative overflow-hidden h-full">
                  {!facePinData ? (
                    <div className="text-center text-gray-400 space-y-4">
                      <FaShieldAlt className="w-16 h-16 sm:w-20 sm:h-20 mx-auto opacity-10" />
                      <p className="text-sm sm:text-base font-medium px-4">Enter project name and generate to view PIN</p>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative w-full max-w-lg rounded-3xl border-2 border-[#00b4eb]/20 bg-[#00b4eb]/5 p-5 sm:p-10 text-center shadow-inner mt-2 sm:mt-0"
                    >
                      <button
                        type="button"
                        onClick={stopPinGeneration}
                        disabled={stopLoading}
                        className="absolute right-2 sm:right-4 top-2 sm:top-4 inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm border border-gray-100 transition hover:bg-red-50 hover:text-red-600 hover:border-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Stop current PIN"
                        title="Stop current PIN"
                      >
                        {stopLoading ? <FaSpinner className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <FaTimes className="h-3 w-3 sm:h-4 sm:w-4" />}
                      </button>
                      
                      <div className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#0056a2] mt-2 sm:mt-0">Current PIN</div>
                      
                      <div className="mt-4 sm:mt-6 mb-2 text-4xl sm:text-7xl md:text-8xl font-black tracking-[0.1em] sm:tracking-[0.15em] text-gray-900 drop-shadow-sm w-full overflow-hidden break-all sm:break-normal">
                        {facePinData.pin}
                      </div>

                      <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-[#00b4eb]/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 w-full">
                        {/* Project Name */}
                        <div className="inline-flex justify-center items-center bg-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-gray-100 shadow-sm text-xs sm:text-sm font-bold text-gray-700 w-full sm:max-w-[200px]">
                          <span className="truncate">{facePinData.projectName}</span>
                        </div>

                        {/* Timer */}
                        <div className="inline-flex justify-center items-center gap-2 bg-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-gray-100 shadow-sm text-xs sm:text-sm font-bold text-gray-600 w-full sm:w-auto">
                          <FaUserClock className="text-[#00b4eb]" />
                          {Math.floor(pinCountdown / 60)}:{String(pinCountdown % 60).padStart(2, '0')}
                        </div>

                        {/* Copy Button */}
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`Project: ${facePinData.projectName}\nPIN: ${facePinData.pin}`);
                            toast.success("Project and PIN copied!");
                          }}
                          className="inline-flex justify-center items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-all shadow-sm font-bold text-xs sm:text-sm active:scale-95 w-full sm:w-auto"
                        >
                          <FaCopy /> Copy
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>

            </div>
          </main>
      </div>
  </AdminNavigation>
  );
};

export default AdminPinManagement;
