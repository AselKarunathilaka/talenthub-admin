import React, { useState, useEffect, useCallback } from 'react';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
Chart.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FaUser, FaEnvelope, FaIdCard, FaBuilding, FaUsers, 
  FaCalendarAlt, FaChartLine, FaArrowLeft, FaExclamationTriangle,
  FaCheckCircle, FaTimesCircle, FaShieldAlt, FaFileAlt, FaTasks,
  FaClock, FaChartPie, FaHistory, FaRegCalendarCheck, FaEye, FaCertificate,
  FaCalendarCheck, FaChevronLeft, FaChevronRight, FaCircle, FaVideo, FaUserCheck
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../api/adminApi';
import logo from '../assets/sltlogo.jpg';

// ─── Helper: get all calendar days for a given month ───────────────────────
const getCalendarDays = (year, month) => {
  const days = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday-start: 0=Mon…6=Sun
  let startDow = firstDay.getDay(); // 0=Sun…6=Sat
  startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon=0
  for (let i = 0; i < startDow; i++) days.push(null); // padding
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  return days;
};

// ─── Helper: colour + label for a day dot ───────────────────────────────────
const getDayMeta = (dailyMap, date) => {
  if (!date) return null;
  const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const entry = dailyMap[key];
  if (!entry) return { color: '#d1d5db', label: 'No Record', bg: 'bg-gray-200' };
  const st = (entry.status || '').toLowerCase();
  if (st === 'present') return { color: '#22c55e', label: 'Present', bg: 'bg-green-500' };
  return { color: '#d1d5db', label: 'No Record', bg: 'bg-gray-200' };
};

const AdminInternDetails = () => {
  const { internId } = useParams();
  const navigate = useNavigate();
  const [internDetails, setInternDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [recentRecords, setRecentRecords] = useState([]);

  // Attendance tab state
  const [attendanceData, setAttendanceData] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [attendanceSubTab, setAttendanceSubTab] = useState('daily'); // 'daily' | 'meeting'
  const [tooltip, setTooltip] = useState(null); // { x, y, label }

  useEffect(() => {
    fetchInternDetails();
    fetchAttendance();
  }, [internId]);

  const fetchAttendance = useCallback(async () => {
    if (attendanceData) return; // already loaded
    try {
      setAttendanceLoading(true);
      setAttendanceError(null);
      const data = await adminApi.getInternAttendance(internId);
      setAttendanceData(data);
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setAttendanceError('Failed to load attendance data.');
    } finally {
      setAttendanceLoading(false);
    }
  }, [internId, attendanceData]);

  const fetchInternDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const adminInfo = JSON.parse(localStorage.getItem('adminInfo') || '{}');
      if (!adminInfo.token) {
        navigate('/admin-login');
        return;
      }

      const data = await adminApi.getInternDetails(internId);
      setInternDetails(data);
      
      // Get recent 5 records for the preview
      if (data.records && data.records.length > 0) {
        setRecentRecords(data.records.slice(0, 5));
      }

    } catch (error) {
      console.error('Error fetching intern details:', error);
      setError('Failed to load intern details');
      
      if (error.message.includes('403') || error.message.includes('401')) {
        localStorage.removeItem('adminInfo');
        navigate('/admin-login');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (statistics) => {
    if (statistics.isOverdue) {
      return (
        <motion.div 
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-600 border border-red-200"
        >
          <FaExclamationTriangle className="mr-2" />
          Overdue
        </motion.div>
      );
    } else if (statistics.totalRecords === 0) {
      return (
        <motion.div 
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 border border-gray-200"
        >
          <FaTimesCircle className="mr-2" />
          Inactive
        </motion.div>
      );
    } else {
      return (
        <motion.div 
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-600 border border-green-200"
        >
          <FaCheckCircle className="mr-2" />
          Active
        </motion.div>
      );
    }
  };

  const getWeeklyActivityData = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const activityCount = [0, 0, 0, 0, 0, 0, 0];
    
    if (internDetails?.records && Array.isArray(internDetails.records)) {
      internDetails.records.forEach(record => {
        const day = new Date(record.createdAt).getDay();
        // Convert Sunday (0) to 6, Monday (1) to 0, etc.
        const adjustedDay = (day + 6) % 7;
        activityCount[adjustedDay]++;
      });
    }
    
    return {
      labels: days,
      datasets: [
        {
          label: 'Records',
          data: activityCount,
          backgroundColor: '#3b82f6',
          borderRadius: 4,
          hoverBackgroundColor: '#2563eb',
        }
      ]
    };
  };

  const getMonthlyStackData = () => {
    if (!internDetails?.records || !Array.isArray(internDetails.records)) return null;
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    
    const monthlyRecords = internDetails.records.filter(r => {
      const d = new Date(r.createdAt);
      return d.getMonth() === month && d.getFullYear() === year && r.stack;
    });
    
    if (monthlyRecords.length === 0) return null;
    
    const stackCounts = {};
    monthlyRecords.forEach(r => {
      stackCounts[r.stack] = (stackCounts[r.stack] || 0) + 1;
    });
    
    const labels = Object.keys(stackCounts);
    const data = Object.values(stackCounts);
    
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            '#38bdf8', '#34d399', '#a78bfa', '#fbbf24', '#f87171', 
            '#f472b6', '#60a5fa', '#facc15', '#4ade80', '#818cf8'
          ],
          borderWidth: 0,
          hoverOffset: 10,
        },
      ],
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-t-4 border-b-4 border-green-500 rounded-full mx-auto mb-6"
          />
          <p className="text-gray-600 font-medium">Loading intern details...</p>
        </div>
      </div>
    );
  }

  if (error || !internDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <motion.div 
          className="text-center max-w-md p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-lg"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <FaExclamationTriangle className="text-4xl text-red-500 mb-4 mx-auto" />
          <p className="text-red-600 mb-6">{error || 'Intern details not found'}</p>
          <div className="flex justify-center space-x-4">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchInternDetails}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              Retry
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/admin/dashboard')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all"
            >
              Back to Dashboard
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  const { intern, statistics } = internDetails;
  const monthlyStackChartData = getMonthlyStackData();
  const weeklyActivityData = getWeeklyActivityData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-gray-800 overflow-hidden">
      {/* Enhanced floating background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute w-80 h-80 rounded-full bg-blue-100/40 -top-20 -left-20"
          animate={{
            y: [0, -30, 0],
            x: [0, 20, 0],
            rotate: [0, 5, 0]
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute w-96 h-96 rounded-full bg-cyan-100/40 top-1/4 right-0"
          animate={{
            y: [0, 20, 0],
            x: [0, -20, 0],
            rotate: [0, -5, 0]
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
        />
        <motion.div 
          className="absolute w-64 h-64 rounded-full bg-green-100/40 bottom-20 left-1/4"
          animate={{
            y: [0, -20, 0],
            x: [0, 15, 0],
            rotate: [0, 3, 0]
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
        <motion.div 
          className="absolute w-72 h-72 rounded-full bg-purple-100/40 bottom-0 right-20"
          animate={{
            y: [0, 25, 0],
            x: [0, -15, 0],
            rotate: [0, -3, 0]
          }}
          transition={{
            duration: 17,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 3
          }}
        />
      </div>

      {/* Enhanced Top Navbar */}
      <motion.header 
        className="bg-white/80 backdrop-blur-md shadow-sm fixed top-0 left-0 right-0 z-30 h-[4.5rem] sm:h-[5.5rem] border-b border-gray-100"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
      >
        <div className="flex items-center justify-between h-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
            <motion.div
              className="flex items-center space-x-2 sm:space-x-4 cursor-pointer"
              onClick={() => {
                localStorage.clear();
                navigate('/admin-login');
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.img 
                src={logo} 
                alt="SLT Logo" 
                className="h-8 sm:h-10 w-auto rounded-lg border border-gray-200 flex-shrink-0 shadow-sm" 
                whileHover={{ rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              />
              <div className="hidden sm:flex flex-col min-w-0">
                <span className="text-sm sm:text-lg font-semibold text-gray-900 truncate">SLT Admin Portal</span>
                <span className="text-xs sm:text-sm text-gray-600 truncate">Intern Details</span>
              </div>
            </motion.div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-6 flex-shrink-0">
            <div className="hidden md:flex items-center space-x-3 mr-4 p-2 bg-gray-50 rounded-xl">
              <motion.div 
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 flex items-center justify-center transition-all duration-300 group-hover:bg-gray-200 border border-gray-200 shadow-sm"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <FaUser className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </motion.div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">Welcome back,</span>
                <span className="text-sm font-medium text-gray-800">Administrator</span>
              </div>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                localStorage.removeItem('adminInfo');
                navigate('/admin-login');
              }}
              className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 text-xs sm:text-sm text-red-600 hover:text-white hover:bg-gradient-to-r from-red-500 to-orange-500 rounded-xl transition-all duration-200 border border-red-200 hover:border-red-600 cursor-pointer shadow-sm hover:shadow-md"
            >
              <FaShieldAlt className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Logout</span>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="pt-[4.5rem] sm:pt-[5.5rem]">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            
            {/* Header with Back Button */}
            <motion.div 
              className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <motion.button
                  onClick={() => navigate('/admin/dashboard')}
                  className="flex items-center px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all border border-gray-200 shadow-sm hover:shadow-md"
                  whileHover={{ x: -3 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FaArrowLeft className="mr-2" />
                  Back to Dashboard
                </motion.button>
                <div>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">
                      Intern Profile
                    </span>
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600">Detailed information and performance metrics</p>
                </div>
              </div>
              <div className="w-full sm:w-auto">
                {getStatusBadge(statistics)}
              </div>
            </motion.div>

            {/* Tabs Navigation */}
            <div className="mb-4 sm:mb-6 border-b border-gray-200">
              <nav className="flex space-x-1 overflow-x-auto">
                {['overview', 'activity', 'records', 'attendance'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      if (tab === 'attendance') fetchAttendance();
                    }}
                    className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab
                        ? 'bg-white text-blue-600 border-t border-l border-r border-gray-200'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'overview' && (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Intern Profile Card */}
                    <motion.div 
                      className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                    >
                      <div className="flex flex-col md:flex-row items-start md:items-center mb-4 sm:mb-6 gap-4 sm:gap-6">
                        <div className="relative mx-auto md:mx-0">
                          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                            <FaUser className="text-white text-3xl sm:text-4xl" />
                          </div>
                          <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1 border-2 border-white">
                            <FaCheckCircle className="text-white text-sm" />
                          </div>
                        </div>
                        <div className="flex-1 w-full md:w-auto">
                          <div className="flex flex-col gap-4">
                            <div className="text-center md:text-left">
                              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{intern.traineeName}</h3>
                              <p className="text-sm sm:text-base text-gray-600">Trainee ID: {intern.traineeId}</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => window.open(`mailto:${intern.email}`, '_blank')}
                                className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-400 hover:to-cyan-400 transition-colors text-sm shadow-sm hover:shadow-md"
                              >
                                <FaEnvelope className="mr-2" />
                                Contact
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => navigate(`/admin/intern/${internId}/certificate`)}
                                className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl hover:from-amber-400 hover:to-yellow-400 transition-colors text-sm shadow-sm hover:shadow-md"
                              >
                                <FaCertificate className="mr-2" />
                                Certificate
                              </motion.button>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                            <div className="flex items-center bg-gray-50 p-3 rounded-xl">
                              <FaEnvelope className="text-gray-500 mr-3 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm text-gray-500">Email</p>
                                <p className="text-sm sm:text-base text-gray-900 font-medium truncate">{intern.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center bg-gray-50 p-3 rounded-xl">
                              <FaBuilding className="text-gray-500 mr-3 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm text-gray-500">Specialization</p>
                                <p className="text-sm sm:text-base text-gray-900 font-medium truncate">{intern.fieldOfSpecialization || 'Not specified'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* Statistics Cards */}
                    <motion.div 
                      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.3 }}
                    >
                      <div className="bg-white/80 backdrop-blur-sm p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs sm:text-sm text-gray-500 mb-1">Total Records</p>
                            <p className="text-2xl sm:text-3xl font-bold text-gray-800">{statistics.totalRecords}</p>
                          </div>
                          <div className="p-2 sm:p-3 rounded-full bg-blue-100">
                            <FaFileAlt className="text-xl sm:text-2xl text-blue-600" />
                          </div>
                        </div>
                        <div className="mt-2 h-1 bg-blue-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full" 
                            style={{ width: `${Math.min(100, statistics.totalRecords)}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="bg-white/80 backdrop-blur-sm p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs sm:text-sm text-gray-500 mb-1">This Week</p>
                            <p className="text-2xl sm:text-3xl font-bold text-gray-800">{statistics.weeklyRecords}</p>
                          </div>
                          <div className="p-2 sm:p-3 rounded-full bg-green-100">
                            <FaTasks className="text-xl sm:text-2xl text-green-600" />
                          </div>
                        </div>
                        <div className="mt-2 h-1 bg-green-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full" 
                            style={{ width: `${Math.min(100, statistics.weeklyRecords * 20)}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="bg-white/80 backdrop-blur-sm p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs sm:text-sm text-gray-500 mb-1">This Month</p>
                            <p className="text-2xl sm:text-3xl font-bold text-gray-800">{statistics.monthlyRecords}</p>
                          </div>
                          <div className="p-2 sm:p-3 rounded-full bg-purple-100">
                            <FaRegCalendarCheck className="text-xl sm:text-2xl text-purple-600" />
                          </div>
                        </div>
                        <div className="mt-2 h-1 bg-purple-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-500 rounded-full" 
                            style={{ width: `${Math.min(100, statistics.monthlyRecords * 10)}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="bg-white/80 backdrop-blur-sm p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs sm:text-sm text-gray-500 mb-1">Days Since Last</p>
                            <p className="text-2xl sm:text-3xl font-bold text-gray-800">
                              {statistics.daysSinceLastSubmission !== null ? statistics.daysSinceLastSubmission : 'Never'}
                            </p>
                          </div>
                          <div className="p-2 sm:p-3 rounded-full bg-amber-100">
                            <FaClock className="text-xl sm:text-2xl text-amber-600" />
                          </div>
                        </div>
                        <div className="mt-2 h-1 bg-amber-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-amber-500 rounded-full" 
                            style={{ width: `${statistics.daysSinceLastSubmission ? Math.max(5, 100 - (statistics.daysSinceLastSubmission * 5)) : 0}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Attendance Summary (New) */}
                      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-4 sm:p-5 shadow-sm col-span-1 lg:col-span-2">
                        <h3 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center">
                          <FaCalendarCheck className="mr-2 text-indigo-500" />
                          Attendance Summary
                        </h3>
                        {attendanceLoading ? (
                          <div className="h-16 flex items-center justify-center">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-6 h-6 border-t-2 border-b-2 border-indigo-500 rounded-full" />
                          </div>
                        ) : attendanceError ? (
                          <div className="text-red-500 text-xs text-center py-2">{attendanceError}</div>
                        ) : attendanceData ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {(() => {
                              const daily = attendanceData.dailyAttendance || [];
                              const meeting = attendanceData.meetingAttendance || [];
                              
                              const totalDailyPresent = daily.filter(e => (e.status||'').toLowerCase() === 'present').length;
                              const totalDailyAbsent  = daily.filter(e => (e.status||'').toLowerCase() === 'absent').length;
                              
                              const totalMeetingPresent = meeting.filter(e => (e.status||'').toLowerCase() === 'present').length;
                              const totalMeetingAbsent  = meeting.filter(e => (e.status||'').toLowerCase() !== 'present').length;

                              return (
                                <>
                                  <div className="bg-white/60 rounded-xl p-3 border border-indigo-50 flex flex-col items-center justify-center text-center">
                                    <span className="text-2xl font-bold text-green-600">{totalDailyPresent}</span>
                                    <span className="text-[10px] sm:text-xs text-gray-600 font-medium">Daily Present</span>
                                  </div>
                                  <div className="bg-white/60 rounded-xl p-3 border border-indigo-50 flex flex-col items-center justify-center text-center">
                                    <span className="text-2xl font-bold text-red-500">{totalDailyAbsent}</span>
                                    <span className="text-[10px] sm:text-xs text-gray-600 font-medium">Daily Absent</span>
                                  </div>
                                  <div className="bg-white/60 rounded-xl p-3 border border-indigo-50 flex flex-col items-center justify-center text-center">
                                    <span className="text-2xl font-bold text-blue-600">{totalMeetingPresent}</span>
                                    <span className="text-[10px] sm:text-xs text-gray-600 font-medium">Meetings Attended</span>
                                  </div>
                                  <div className="bg-white/60 rounded-xl p-3 border border-indigo-50 flex flex-col items-center justify-center text-center">
                                    <span className="text-2xl font-bold text-orange-500">{totalMeetingAbsent}</span>
                                    <span className="text-[10px] sm:text-xs text-gray-600 font-medium">Meetings Missed</span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="text-gray-500 text-xs text-center py-2">No attendance data available</div>
                        )}
                      </div>
                    </motion.div>


                    {/* Charts Section */}
                    <motion.div 
                      className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6, duration: 0.3 }}
                    >
                      {/* Weekly Activity Chart */}
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                            <FaChartLine className="mr-2 text-blue-500" />
                            Weekly Activity
                          </h3>
                          <span className="text-xs text-gray-500">Last 7 days</span>
                        </div>
                        <div className="h-48 sm:h-64">
                          <Bar 
                            data={weeklyActivityData}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              scales: {
                                y: {
                                  beginAtZero: true,
                                  grid: {
                                    color: 'rgba(0, 0, 0, 0.05)'
                                  },
                                  ticks: {
                                    color: 'rgba(0, 0, 0, 0.6)',
                                    font: { size: 10 }
                                  }
                                },
                                x: {
                                  grid: {
                                    color: 'rgba(0, 0, 0, 0.05)'
                                  },
                                  ticks: {
                                    color: 'rgba(0, 0, 0, 0.6)',
                                    font: { size: 10 }
                                  }
                                }
                              },
                              plugins: {
                                legend: {
                                  display: false
                                },
                                tooltip: {
                                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                  titleColor: '#1f2937',
                                  bodyColor: '#4b5563',
                                  borderColor: 'rgba(0, 0, 0, 0.1)',
                                  borderWidth: 1,
                                }
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* Stack Distribution Chart */}
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                            <FaChartPie className="mr-2 text-purple-500" />
                            Stack Distribution
                          </h3>
                          <span className="text-xs text-gray-500">Current Month</span>
                        </div>
                        {monthlyStackChartData ? (
                          <div className="flex flex-col items-center">
                            <div className="h-40 sm:h-48 w-full">
                              <Pie 
                                data={monthlyStackChartData} 
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: {
                                      position: window.innerWidth < 640 ? 'bottom' : 'right',
                                      labels: {
                                        color: 'rgba(0, 0, 0, 0.7)',
                                        padding: window.innerWidth < 640 ? 10 : 20,
                                        usePointStyle: true,
                                        pointStyle: 'circle',
                                        font: {
                                          size: window.innerWidth < 640 ? 8 : 10
                                        }
                                      }
                                    },
                                    tooltip: {
                                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                      titleColor: '#1f2937',
                                      bodyColor: '#4b5563',
                                      borderColor: 'rgba(0, 0, 0, 0.1)',
                                      borderWidth: 1,
                                    }
                                  },
                                  cutout: '60%',
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="h-40 sm:h-48 flex items-center justify-center">
                            <p className="text-gray-500 text-xs sm:text-sm text-center">No stack data available for this month</p>
                          </div>
                        )}
                      </div>
                    </motion.div>

                    {/* Recent Records Preview */}
                    {recentRecords.length > 0 && (
                      <motion.div 
                        className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm mt-4 sm:mt-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 0.3 }}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                            <FaHistory className="mr-2 text-cyan-500" />
                            Recent Activity
                          </h3>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate(`/admin/intern/${internId}/records`)}
                            className="text-xs sm:text-sm text-cyan-600 hover:text-cyan-700 flex items-center"
                          >
                            View All Records <FaArrowLeft className="ml-1 rotate-180" />
                          </motion.button>
                        </div>
                        
                        {/* Mobile Card View */}
                        <div className="block sm:hidden space-y-3">
                          {recentRecords.map((record, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 * index }}
                              className="bg-gray-50 rounded-xl p-3 border border-gray-200"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {record.taskDescription || record.task || 'N/A'}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {formatDate(record.createdAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {record.stack || 'N/A'}
                                </span>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => navigate(`/admin/intern/${internId}/records`)}
                                  className="flex items-center text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 px-2 py-1 rounded-xl transition-colors text-xs shadow-sm"
                                >
                                  <FaEye className="mr-1 h-3 w-3" />
                                  View
                                </motion.button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                        
                        {/* Desktop Table View */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stack</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {recentRecords.map((record, index) => (
                                <motion.tr
                                  key={index}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.1 * index }}
                                  className="hover:bg-gray-50"
                                >
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    {formatDate(record.createdAt)}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    <div className="max-w-xs truncate">{record.taskDescription || record.task || 'N/A'}</div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {record.stack || 'N/A'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    <motion.button
                                      onClick={() => navigate(`/admin/intern/${internId}/records`)}
                                      className="flex items-center text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 px-3 py-1 rounded-xl transition-colors shadow-sm"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                    >
                                      <FaEye className="mr-2" />
                                      View
                                    </motion.button>
                                  </td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm space-y-6 sm:space-y-8">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <FaChartLine className="mr-2 text-blue-500" />
                      Activity Analytics
                    </h3>
                    {/* Weekly Activity Chart */}
                    <div className="mb-6 sm:mb-8">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-1">
                        <span className="text-sm sm:text-base font-medium text-gray-900">Weekly Activity</span>
                        <span className="text-xs text-gray-500">Last 7 days</span>
                      </div>
                      <div className="h-48 sm:h-56">
                        <Bar 
                          data={weeklyActivityData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                              y: {
                                beginAtZero: true,
                                grid: { color: 'rgba(0,0,0,0.05)' },
                                ticks: { 
                                  color: 'rgba(0,0,0,0.6)',
                                  font: { size: window.innerWidth < 640 ? 9 : 11 }
                                }
                              },
                              x: {
                                grid: { color: 'rgba(0,0,0,0.05)' },
                                ticks: { 
                                  color: 'rgba(0,0,0,0.6)',
                                  font: { size: window.innerWidth < 640 ? 9 : 11 }
                                }
                              }
                            },
                            plugins: {
                              legend: { display: false },
                              tooltip: {
                                backgroundColor: 'rgba(255,255,255,0.95)',
                                titleColor: '#1f2937',
                                bodyColor: '#4b5563',
                                borderColor: 'rgba(0,0,0,0.1)',
                                borderWidth: 1,
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                    {/* Stack Distribution Chart */}
                    <div className="mb-6 sm:mb-8">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-1">
                        <span className="text-sm sm:text-base font-medium text-gray-900">Stack Distribution (Current Month)</span>
                      </div>
                      {monthlyStackChartData ? (
                        <div className="h-40 sm:h-48 w-full">
                          <Pie 
                            data={monthlyStackChartData}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: {
                                  position: window.innerWidth < 640 ? 'bottom' : 'right',
                                  labels: {
                                    color: 'rgba(0,0,0,0.7)',
                                    padding: window.innerWidth < 640 ? 10 : 20,
                                    usePointStyle: true,
                                    pointStyle: 'circle',
                                    font: { size: window.innerWidth < 640 ? 8 : 10 }
                                  }
                                },
                                tooltip: {
                                  backgroundColor: 'rgba(255,255,255,0.95)',
                                  titleColor: '#1f2937',
                                  bodyColor: '#4b5563',
                                  borderColor: 'rgba(0,0,0,0.1)',
                                  borderWidth: 1,
                                }
                              },
                              cutout: '60%',
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-40 sm:h-48 flex items-center justify-center">
                          <p className="text-gray-500 text-xs sm:text-sm text-center">No stack data available for this month</p>
                        </div>
                      )}
                    </div>
                    {/* Extra Activity Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                      {/* Most Active Day */}
                      <div className="bg-blue-50 p-3 sm:p-4 rounded-xl border border-blue-100">
                        <p className="text-xs sm:text-sm text-blue-600 mb-1">Most Active Day</p>
                        <p className="text-lg sm:text-xl font-bold text-gray-900">
                          {(() => {
                            const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
                            const counts = weeklyActivityData.datasets[0].data;
                            const maxIdx = counts.indexOf(Math.max(...counts));
                            return days[maxIdx] || 'N/A';
                          })()}
                        </p>
                      </div>
                      {/* Average Records Per Week */}
                      <div className="bg-green-50 p-3 sm:p-4 rounded-xl border border-green-100">
                        <p className="text-xs sm:text-sm text-green-600 mb-1">Avg. Records/Week</p>
                        <p className="text-lg sm:text-xl font-bold text-gray-900">
                          {(() => {
                            const total = weeklyActivityData.datasets[0].data.reduce((a,b)=>a+b,0);
                            return (total/7).toFixed(2);
                          })()}
                        </p>
                      </div>
                      {/* Total Stacks Used This Month */}
                      <div className="bg-purple-50 p-3 sm:p-4 rounded-xl border border-purple-100 sm:col-span-2 xl:col-span-1">
                        <p className="text-xs sm:text-sm text-purple-600 mb-1">Stacks Used (Month)</p>
                        <p className="text-lg sm:text-xl font-bold text-gray-900">
                          {monthlyStackChartData ? monthlyStackChartData.labels.length : 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'attendance' && (() => {
                  // ── Build lookup maps from attendance data ──────────────────
                  const dailyMap = {};
                  if (attendanceData?.dailyAttendance) {
                    attendanceData.dailyAttendance.forEach(entry => {
                      const d = new Date(entry.date);
                      if (!isNaN(d.getTime())) {
                        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                        dailyMap[key] = entry;
                      }
                    });
                  }

                  // Group meeting attendance by date for the calendar
                  const meetingMap = {};
                  if (attendanceData?.meetingAttendance) {
                    attendanceData.meetingAttendance.forEach(entry => {
                      const d = new Date(entry.date);
                      if (!isNaN(d.getTime())) {
                        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                        // If there are multiple meetings in a day, present takes priority
                        if (!meetingMap[key] || (entry.status || '').toLowerCase() === 'present') {
                          meetingMap[key] = entry;
                        }
                      }
                    });
                  }

                  // Determine active map based on selected sub-tab
                  const activeMap = attendanceSubTab === 'daily' ? dailyMap : meetingMap;
                  const activeData = attendanceSubTab === 'daily' ? (attendanceData?.dailyAttendance || []) : (attendanceData?.meetingAttendance || []);

                  // Calendar helpers
                  const year  = calendarMonth.getFullYear();
                  const month = calendarMonth.getMonth();
                  const calDays = getCalendarDays(year, month);
                  const monthLabel = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

                  // Monthly stats for current view
                  const monthKeys = Object.keys(activeMap).filter(k => {
                    const [y, m] = k.split('-').map(Number);
                    return y === year && m === month + 1;
                  });
                  const mPresent = monthKeys.filter(k => (activeMap[k]?.status || '').toLowerCase() === 'present').length;

                  return (
                    <div className="space-y-5">
                      {/* ── Header ────────────────────────────────────────── */}
                      <motion.div
                        className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm"
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                      >
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center mb-4">
                          <FaCalendarCheck className="mr-2 text-blue-500" />
                          Attendance Overview
                        </h3>

                        {/* Sub-tabs: Daily / Meeting */}
                        <div className="flex space-x-2 mb-5">
                          {['daily', 'meeting'].map(sub => (
                            <button
                              key={sub}
                              onClick={() => setAttendanceSubTab(sub)}
                              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                                attendanceSubTab === sub
                                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {sub === 'daily' ? <FaRegCalendarCheck className="text-lg opacity-90" /> : <FaVideo className="text-lg opacity-90" />}
                              {sub === 'daily' ? 'Daily Attendance' : 'Meeting Attendance'}
                            </button>
                          ))}
                        </div>

                        {/* Loading / Error states */}
                        {attendanceLoading && (
                          <div className="flex justify-center items-center py-16">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              className="w-10 h-10 border-t-4 border-b-4 border-blue-400 rounded-full"
                            />
                          </div>
                        )}
                        {attendanceError && !attendanceLoading && (
                          <div className="text-center py-12 text-red-500 text-sm">{attendanceError}</div>
                        )}

                        {/* ════════ ATTENDANCE CALENDAR ════════ */}
                        {!attendanceLoading && !attendanceError && (
                          <div>
                            {/* Month navigation + stats strip */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                >
                                  <FaChevronLeft className="h-3 w-3" />
                                </button>
                                <span className="text-sm font-semibold text-gray-800 min-w-[130px] text-center">{monthLabel}</span>
                                <button
                                  onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                >
                                  <FaChevronRight className="h-3 w-3" />
                                </button>
                              </div>
                              {/* Stats pills */}
                              <div className="flex flex-wrap gap-2 text-xs">
                                <span className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">
                                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Present: {mPresent}
                                </span>
                              </div>
                            </div>

                            {/* Calendar grid */}
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr>
                                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                                      <th key={d} className="text-center pb-2 text-xs font-semibold text-gray-500 w-[14.28%]">{d}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.from({ length: Math.ceil(calDays.length / 7) }, (_, w) => (
                                    <tr key={w}>
                                      {calDays.slice(w * 7, w * 7 + 7).map((day, di) => {
                                        const meta = getDayMeta(activeMap, day);
                                        const isToday = day && day.toDateString() === new Date().toDateString();
                                        return (
                                          <td key={di} className="py-1 text-center">
                                            {day ? (
                                              <div className="flex justify-center group relative py-1">
                                                <div
                                                  className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 shadow-sm ${
                                                    isToday ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                                                  }`}
                                                  style={{ backgroundColor: meta?.color ?? '#e5e7eb' }}
                                                  onMouseEnter={e => {
                                                    const r = e.target.getBoundingClientRect();
                                                    setTooltip({ x: r.left, y: r.top, label: meta?.label ?? 'No Record', date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
                                                  }}
                                                  onMouseLeave={() => setTooltip(null)}
                                                >
                                                  <span className={`text-[10px] sm:text-xs font-semibold ${
                                                    (meta?.label === 'Present') ? 'text-white' : (isToday ? 'text-blue-700' : 'text-gray-600')
                                                  }`}>
                                                    {day.getDate()}
                                                  </span>
                                                </div>
                                              </div>
                                            ) : <div className="h-10" />}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Legend */}
                            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3 text-xs text-gray-600">
                              {[
                                { color: '#22c55e', label: 'Present' },
                                { color: '#d1d5db', label: 'No Record' },
                              ].map(({ color, label }) => (
                                <span key={label} className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: color }}></span>
                                  {label}
                                </span>
                              ))}
                            </div>

                            {/* All-time summary circles */}
                            <div className="mt-8 flex justify-center gap-8 sm:gap-16">
                              <div className="flex flex-col items-center">
                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-green-100 flex items-center justify-center bg-white shadow-sm mb-2">
                                  <span className="text-2xl sm:text-3xl font-bold text-green-500">
                                    {(attendanceData?.dailyAttendance || []).filter(e => (e.status||'').toLowerCase() === 'present').length}
                                  </span>
                                </div>
                                <span className="text-xs sm:text-sm font-medium text-gray-600 text-center">Daily<br/>Present</span>
                              </div>
                              <div className="flex flex-col items-center">
                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-blue-100 flex items-center justify-center bg-white shadow-sm mb-2">
                                  <span className="text-2xl sm:text-3xl font-bold text-blue-500">
                                    {(attendanceData?.meetingAttendance || []).filter(e => (e.status||'').toLowerCase() === 'present').length}
                                  </span>
                                </div>
                                <span className="text-xs sm:text-sm font-medium text-gray-600 text-center">Meetings<br/>Attended</span>
                              </div>
                            </div>

                            {/* Attendance records list */}
                            {activeData.length > 0 ? (
                              <div className="mt-6">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                  {attendanceSubTab === 'daily' ? 'Daily' : 'Meeting'} Attendance Records
                                </h4>
                                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                  {activeData
                                    .filter(e => {
                                      const d = new Date(e.date);
                                      return d.getFullYear() === year && d.getMonth() === month;
                                    })
                                    .map((entry, idx) => {
                                      const d = new Date(entry.date);
                                      const isPresent = (entry.status || '').toLowerCase() === 'present';
                                      return (
                                        <div
                                          key={idx}
                                          className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl px-3 py-2.5 text-sm"
                                        >
                                          <div className="flex items-center gap-3">
                                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                              isPresent ? 'bg-green-500' : 'bg-gray-300'
                                            }`} />
                                            <div>
                                              <p className="font-medium text-gray-800 text-xs sm:text-sm">
                                                {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                              </p>
                                              {entry.meetingName && (
                                                <p className="text-[10px] sm:text-xs text-gray-500 truncate max-w-[160px]">{entry.meetingName}</p>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 text-right">
                                            {entry.time && (
                                              <span className="text-[10px] text-gray-400 hidden sm:inline">{entry.time}</span>
                                            )}
                                            <span className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full ${
                                              isPresent
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-200 text-gray-500'
                                            }`}>
                                              {entry.status || 'No Record'}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                                {activeData.filter(e => {
                                  const d = new Date(e.date);
                                  return d.getFullYear() === year && d.getMonth() === month;
                                }).length === 0 && (
                                  <p className="text-center text-gray-400 text-xs py-6">
                                    No records for {monthLabel}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="mt-6 text-center py-10 text-gray-400 text-sm">
                                No {attendanceSubTab} attendance records found.
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    </div>
                  );
                })()}

                {/* Global tooltip for calendar dots */}
                {tooltip && (
                  <div
                    className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none shadow-xl"
                    style={{ top: tooltip.y - 48, left: tooltip.x + 12 }}
                  >
                    <span className="text-gray-300">{tooltip.date}</span><br/>
                    <span className="font-semibold">{tooltip.label}</span>
                  </div>
                )}

                {activeTab === 'records' && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                        <FaFileAlt className="mr-2 text-blue-500" />
                        All Record History
                      </h3>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(`/admin/intern/${internId}/records`)}
                        className="flex items-center px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-400 hover:to-cyan-400 transition-colors text-xs sm:text-sm shadow-sm hover:shadow-md"
                      >
                        <FaFileAlt className="mr-2" />
                        View Full Records
                      </motion.button>
                    </div>
                    {internDetails.records && internDetails.records.length > 0 ? (
                      <>
                        {/* Mobile Card View */}
                        <div className="block sm:hidden space-y-3 max-h-[400px] overflow-y-auto">
                          {internDetails.records.map((record, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.02 * index }}
                              className="bg-gray-50 rounded-xl p-3 border border-gray-200"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">
                                    {record.taskDescription || record.task || 'N/A'}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {formatDate(record.createdAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {record.stack || 'N/A'}
                                </span>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => navigate(`/admin/intern/${internId}/records`)}
                                  className="flex items-center text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 px-2 py-1 rounded-xl transition-colors text-xs shadow-sm"
                                >
                                  <FaEye className="mr-1 h-3 w-3" />
                                  View
                                </motion.button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                        
                        {/* Desktop Table View */}
                        <div className="hidden sm:block overflow-x-auto max-h-[500px]">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stack</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {internDetails.records.map((record, index) => (
                                <motion.tr
                                  key={index}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.02 * index }}
                                  className="hover:bg-gray-50"
                                >
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    {formatDate(record.createdAt)}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    <div className="max-w-xs truncate">{record.taskDescription || record.task || 'N/A'}</div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {record.stack || 'N/A'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    <motion.button
                                      onClick={() => navigate(`/admin/intern/${internId}/records`)}
                                      className="flex items-center text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 px-3 py-1 rounded-xl transition-colors shadow-sm"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                    >
                                      <FaEye className="mr-2" />
                                      View
                                    </motion.button>
                                  </td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="h-32 sm:h-48 flex items-center justify-center">
                        <p className="text-gray-500 text-xs sm:text-sm text-center">No records found for this intern.</p>
                      </div>
                    )}
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminInternDetails;