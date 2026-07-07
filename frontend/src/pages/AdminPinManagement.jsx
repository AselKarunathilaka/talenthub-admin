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
<<<<<<< HEAD

=======
  const [enrollmentData, setEnrollmentData] = useState({ stats: {}, profiles: [] });
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profileSearch, setProfileSearch] = useState('');
  const [profileFilter, setProfileFilter] = useState('all');
  const [showProfilesModal, setShowProfilesModal] = useState(false);

  const fetchEnrollmentProfiles = useCallback(async () => {
    try {
      setProfilesLoading(true);
      setEnrollmentData(await adminApi.getFaceEnrollmentProfiles());
    } catch (error) {
      toast.error(error.message || 'Failed to load face enrollment profiles', {
        id: 'face-enrollment-profiles-load',
      });
      console.error(error);
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  const openProfilesModal = () => {
    setShowProfilesModal(true);
    fetchEnrollmentProfiles();
  };
>>>>>>> talenthub/main

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
<<<<<<< HEAD

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
=======
  const filteredProfiles = enrollmentData.profiles.filter((profile) => {
    const query = profileSearch.trim().toLowerCase();
    const matchesSearch = !query || [
      profile.traineeName,
      profile.traineeId,
      profile.email,
      profile.team,
      profile.institute,
    ].some((value) => String(value || '').toLowerCase().includes(query));
    const matchesFilter =
      profileFilter === 'all' ||
      (profileFilter === 'complete' && profile.isComplete) ||
      (profileFilter === 'incomplete' && profile.isActive && !profile.isComplete) ||
      (profileFilter === 'inactive' && !profile.isActive);
    return matchesSearch && matchesFilter;
  });

  const formatDateTime = (value) => value
    ? new Date(value).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : 'Never';

  return (
    <AdminNavigation>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-gray-800 overflow-hidden font-sans relative">
        <div className="pt-8 pb-8 px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-end gap-4 mb-8">
              <motion.button
                type="button"
                onClick={openProfilesModal}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white/90 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <FaUsers className="h-4 w-4" />
              <span>Face Enrollment Profiles</span>
            </motion.button>
          </div>

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
                  <KeyRound className="text-[#0056a2] h-8 w-8" />
                </div>
                PIN
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

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <FaKey className="w-32 h-32" />
                </div>

                <div className="relative z-10">
                  <h3 className="text-xl font-bold text-gray-800 mb-6">Configuration</h3>
                  <label className="block">
                    <span className="block text-sm font-bold text-gray-700 mb-2">Project Name</span>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      placeholder="e.g., TalentHub Development"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all font-medium text-gray-800 outline-none"
                    />
                  </label>

                  <div className="mt-5 p-4 bg-emerald-50 text-emerald-800 rounded-2xl text-sm font-medium border border-emerald-100">
                    Generate this PIN for the selected project. Interns must enter the current PIN before marking Face Attendance Daily + Meeting.
                  </div>

                  <button
                    type="button"
                    onClick={() => fetchFacePin(true)}
                    disabled={pinLoading || !projectName.trim()}
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
                    <p className="text-lg font-medium">Enter project name and generate to view PIN</p>
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
                      {facePinData.projectName}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      <AnimatePresence>
        {showProfilesModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(event) => event.target === event.currentTarget && setShowProfilesModal(false)}
          >
            <motion.section
              className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
            >
            <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Face Enrollment Profiles</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Interns registered for face daily and meeting attendance.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchEnrollmentProfiles}
                  disabled={profilesLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FaRedo className={`h-3.5 w-3.5 ${profilesLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setShowProfilesModal(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-800"
                  aria-label="Close face enrollment profiles"
                  title="Close"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-px bg-gray-100 sm:grid-cols-3">
              {[
                { label: 'Total Interns', value: enrollmentData.stats.totalInterns || 0, icon: FaUsers, color: 'text-blue-700 bg-blue-50' },
                { label: 'Enrolled Interns', value: enrollmentData.stats.enrolled || 0, icon: FaUserCheck, color: 'text-emerald-700 bg-emerald-50' },
                { label: 'Not Enrolled Interns', value: enrollmentData.stats.notEnrolled || 0, icon: FaUserClock, color: 'text-rose-700 bg-rose-50' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white px-5 py-4">
                  <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="mt-3 text-2xl font-bold text-gray-900">{value}</div>
                  <div className="text-xs font-semibold text-gray-500">{label}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row">
              <div className="relative flex-1">
                <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={profileSearch}
                  onChange={(event) => setProfileSearch(event.target.value)}
                  placeholder="Search intern name, ID, email or team"
                  className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <select
                value={profileFilter}
                onChange={(event) => setProfileFilter(event.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="all">All profiles</option>
                <option value="complete">Ready for attendance</option>
                <option value="incomplete">Incomplete profiles</option>
                <option value="inactive">Inactive profiles</option>
              </select>
            </div>

            {profilesLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
                <FaSpinner className="h-4 w-4 animate-spin" />
                Loading enrollment profiles...
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-500">
                No face enrollment profiles found.
              </div>
            ) : (
              <div className="max-h-[48vh] overflow-auto">
                <table className="w-full min-w-[58rem] divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Intern', 'Team / Institute', 'Enrollment', 'Samples', 'Last Face Match', 'Status'].map((label) => (
                        <th key={label} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProfiles.map((profile) => (
                      <tr key={profile._id} className="hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <div className="text-sm font-semibold text-gray-900">{profile.traineeName}</div>
                          <div className="text-xs text-gray-500">{profile.traineeId} · {profile.email || 'No email'}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-sm text-gray-800">{profile.team || 'Not assigned'}</div>
                          <div className="text-xs text-gray-500">{profile.institute || 'Not specified'}</div>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">{formatDateTime(profile.enrolledAt)}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-gray-800">{profile.sampleCount}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{formatDateTime(profile.lastMatchedAt)}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            profile.isComplete
                              ? 'bg-emerald-50 text-emerald-700'
                              : profile.isActive
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-gray-100 text-gray-600'
                          }`}>
                            {profile.isComplete && <FaCheckCircle className="h-3 w-3" />}
                            {profile.isComplete ? 'Ready' : profile.isActive ? 'Incomplete' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
>>>>>>> talenthub/main
  </AdminNavigation>
  );
};

export default AdminPinManagement;
