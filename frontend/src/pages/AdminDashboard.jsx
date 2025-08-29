  import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaUsers, FaSearch, FaDownload, FaBell, FaExclamationTriangle, 
  FaCheckCircle, FaTimesCircle, FaCalendarAlt, FaFileExport,
  FaFilter, FaSort, FaUser, FaTasks, FaSpinner, FaShieldAlt
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi, csvUtils, notificationUtils } from '../api/adminApi';
import logo from '../assets/sltlogo.jpg';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [dashboardStats, setDashboardStats] = useState(null);
  const [internReport, setInternReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [showNotifications, setShowNotifications] = useState(false);
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const adminInfo = JSON.parse(localStorage.getItem('adminInfo') || '{}');
      if (!adminInfo.token) {
        setError('Admin authentication required');
        navigate('/admin-login');
        return;
      }

      const statsData = await adminApi.getDashboardStats();
      setDashboardStats(statsData);
      setInternReport([]);
      setHasSearched(false);

    } catch (error) {
      console.error('Error in fetchData:', error);
      setError('Failed to load dashboard data. Please try again.');
      
      if (error.message.includes('403') || error.message.includes('401')) {
        localStorage.removeItem('adminInfo');
        navigate('/admin-login');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Search for interns
  const searchInterns = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      if (filterStatus !== 'all') {
        try {
          setSearchLoading(true);
          const reportData = await adminApi.searchInterns('*');
          setInternReport(reportData);
          setHasSearched(true);
        } catch (error) {
          console.error('Error loading all interns:', error);
          setInternReport([]);
        } finally {
          setSearchLoading(false);
        }
      } else {
        setInternReport([]);
        setHasSearched(false);
      }
      return;
    }

    try {
      setSearchLoading(true);
      const reportData = await adminApi.searchInterns(searchQuery.trim());
      setInternReport(reportData);
      setHasSearched(true);
    } catch (error) {
      console.error('Error searching interns:', error);
      setInternReport([]);
    } finally {
      setSearchLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchInterns(searchTerm);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchInterns]);

  useEffect(() => {
    if (filterStatus !== 'all' && (!searchTerm || searchTerm.trim().length < 2)) {
      searchInterns('');
    }
  }, [filterStatus, searchInterns, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSendNotifications = async () => {
    if (!dashboardStats?.overdueList || dashboardStats.overdueList.length === 0) {
      notificationUtils.showInfo('No overdue interns to notify');
      return;
    }

    try {
      setSendingNotifications(true);
      // Only send to the overdue intern with traineeId '2706' for testing
      const intern = dashboardStats.overdueList.find(i => i.traineeId === '2706');
      if (!intern) {
        notificationUtils.showInfo('No overdue intern with traineeId 2706 found for test.');
        return;
      }
      const emailBody = `Dear ${intern.traineeName},\n\nYou are overdue in submitting your logbook. Please submit it as soon as possible.\n\nThank you.`;
      // Pass the intern and body to the API (adjust API as needed)
      const result = await adminApi.sendOverdueNotifications([
        {
          id: intern._id,
          name: intern.traineeName,
          traineeId: intern.traineeId,
          email: intern.email,
          body: emailBody
        }
      ]);
      notificationUtils.showSuccess(
        `Test notification sent to ${intern.traineeName} (${intern.email}).`
      );
    } catch (error) {
      console.error('Error sending notifications:', error);
      notificationUtils.showError('Failed to send test notification');
    } finally {
      setSendingNotifications(false);
    }
  };

  const handleExportOverdueCSV = async () => {
    try {
      if (!dashboardStats?.overdueList || dashboardStats.overdueList.length === 0) {
        notificationUtils.showInfo('No overdue interns to export.');
        return;
      }

      await csvUtils.downloadInternReport(dashboardStats.overdueList, 'overdue_interns');
      notificationUtils.showSuccess(`Overdue interns CSV report with ${dashboardStats.overdueList.length} interns downloaded successfully`);
    } catch (error) {
      console.error('Error exporting overdue interns CSV:', error);
      notificationUtils.showError('Failed to export overdue interns CSV report');
    }
  };

  const handleExportSubmittedCSV = async () => {
    try {
      let submittedInterns = [];
      
      if (internReport && internReport.length > 0) {
        submittedInterns = internReport.filter(intern => !intern.isOverdue && intern.totalRecords > 0);
      } else {
        try {
          setSearchLoading(true);
          const allInterns = await adminApi.getInternReport();
          submittedInterns = allInterns.filter(intern => !intern.isOverdue && intern.totalRecords > 0);
        } catch (error) {
          console.error('Error loading interns for submitted export:', error);
          notificationUtils.showError('Failed to load intern data for export. Please try again or search for interns first.');
          return;
        } finally {
          setSearchLoading(false);
        }
      }

      if (submittedInterns.length === 0) {
        notificationUtils.showInfo('No submitted interns found to export.');
        return;
      }

      await csvUtils.downloadInternReport(submittedInterns, 'submitted_interns');
      notificationUtils.showSuccess(`Submitted interns CSV report with ${submittedInterns.length} interns downloaded successfully`);
    } catch (error) {
      console.error('Error exporting submitted interns CSV:', error);
      notificationUtils.showError('Failed to export submitted interns CSV report');
    }
  };
  // Download On Leave Excel
  const handleDownloadOnLeaveExcel = async () => {
    try {
      const blob = await adminApi.downloadOnLeaveExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'on_leave_interns.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download on-leave Excel');
    }
  };

  const handleExportPreviousDayCSV = async () => {
    try {
      // Get previous day submissions
      const previousDaySubmissions = await adminApi.getPreviousDaySubmissions();
      
      if (previousDaySubmissions.length === 0) {
        notificationUtils.showInfo('No interns submitted records on the previous day.');
        return;
      }

      // Format the date for filename
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      await csvUtils.downloadInternReport(previousDaySubmissions, `previous_day_submissions_${dateStr}`);
      notificationUtils.showSuccess(`Previous day submissions CSV report with ${previousDaySubmissions.length} interns downloaded successfully`);
    } catch (error) {
      console.error('Error exporting previous day submissions CSV:', error);
      notificationUtils.showError('Failed to export previous day submissions CSV report');
    }
  };

  const getFilteredInterns = () => {
    if (!internReport || internReport.length === 0) return [];

    return internReport.filter(intern => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          intern.traineeName?.toLowerCase().includes(searchLower) ||
          intern.traineeId?.toLowerCase().includes(searchLower) ||
          intern.email?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      switch (filterStatus) {
        case 'submitted':
          return !intern.isOverdue && intern.totalRecords > 0;
        case 'notsubmitted':
          return intern.totalRecords === 0;
        case 'overdue':
          return intern.isOverdue;
        default:
          return true;
      }
    }).sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.traineeName || '').localeCompare(b.traineeName || '');
        case 'id':
          return (a.traineeId || '').localeCompare(b.traineeId || '');
        case 'records':
          return (b.totalRecords || 0) - (a.totalRecords || 0);
        case 'lastSubmitted':
          const aDays = a.daysSinceLastSubmission || 999;
          const bDays = b.daysSinceLastSubmission || 999;
          return aDays - bDays;
        default:
          return 0;
      }
    });
  };

  const filteredInterns = getFilteredInterns();

  const getStatusBadge = (intern) => {
    if (intern.isOverdue) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
          <FaExclamationTriangle className="mr-1" />
          Overdue
        </span>
      );
    } else if (intern.totalRecords === 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
          <FaTimesCircle className="mr-1" />
          Not Submitted
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
          <FaCheckCircle className="mr-1" />
          Submitted
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-950 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-t-4 border-b-4 border-green-400 rounded-full mx-auto mb-6"
          />
          <p className="text-white/80 font-medium">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-950 flex items-center justify-center">
        <div className="text-center max-w-md p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <FaExclamationTriangle className="text-4xl text-red-400 mb-4 mx-auto" />
          <p className="text-red-100 mb-6">{error}</p>
          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-green-500/90 hover:bg-green-400/90 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-950 text-gray-100 overflow-hidden">
      {/* Floating background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-80 h-80 rounded-full bg-green-500/10 -top-20 -left-20 animate-float" style={{ animationDelay: "0s" }}></div>
        <div className="absolute w-96 h-96 rounded-full bg-blue-600/10 top-1/4 right-0 animate-float" style={{ animationDelay: "3s" }}></div>
        <div className="absolute w-64 h-64 rounded-full bg-purple-500/10 bottom-20 left-1/4 animate-float" style={{ animationDelay: "6s" }}></div>
        <div className="absolute w-72 h-72 rounded-full bg-cyan-500/10 bottom-0 right-20 animate-float" style={{ animationDelay: "9s" }}></div>
      </div>

      {/* Top Navbar */}
      <header className="bg-gradient-to-r from-gray-900/90 to-blue-950/90 backdrop-blur-lg shadow-lg fixed top-0 left-0 right-0 z-30 h-[4.5rem] sm:h-[5.5rem] border-b border-white/10">
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
                    <img 
                      src={logo} 
                      alt="SLT Logo" 
                      className="h-8 sm:h-10 w-auto rounded-md border border-white/10 flex-shrink-0" 
                    />
              <div className="hidden sm:flex flex-col min-w-0">
                <span className="text-sm sm:text-lg font-semibold text-white/90 truncate">Admin Portal</span>
                <span className="text-xs sm:text-sm text-blue-100/70 truncate hidden sm:block">Intern Management System</span>
              </div>
                  </motion.div>
                </div>

          <div className="flex items-center space-x-2 sm:space-x-6 flex-shrink-0">
            <div className="hidden md:flex items-center space-x-3 mr-4">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-white/10 flex items-center justify-center transition-all duration-300 border border-white/10">
                <FaUser className="h-4 w-4 sm:h-5 sm:w-5 text-white/80" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-white/70">Welcome back,</span>
                <span className="text-sm font-medium text-white">Administrator</span>
              </div>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                localStorage.removeItem('adminInfo');
                navigate('/admin-login');
              }}
              className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 text-xs sm:text-sm text-red-200 hover:text-white hover:bg-red-600/20 rounded-lg transition-all duration-200 border border-red-300/20 hover:border-red-300/40 cursor-pointer"
            >
              <FaShieldAlt className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Logout</span>
            </motion.button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="pt-[4.5rem] sm:pt-[5.5rem]">
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            
            {/* Header */}
            <motion.div 
              className="mb-4 md:mb-6"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-400">
                  Intern Management
                </span>
              </h2>
              <p className="text-white/70 text-sm md:text-base">Monitor and manage intern logbook submissions</p>
            </motion.div>

            {/* Statistics Cards */}
            <motion.div 
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <motion.div 
                className="bg-white/5 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-white/10"
                whileHover={{ scale: 1.03 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-white/70 mb-1">Total Interns</p>
                    <p className="text-xl sm:text-2xl font-bold text-white">
                      {dashboardStats?.totalInterns || 0}
                    </p>
                  </div>
                  <FaUsers className="text-2xl sm:text-3xl text-blue-400" />
                </div>
              </motion.div>

              <motion.div 
                className="bg-white/5 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-white/10"
                whileHover={{ scale: 1.03 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-white/70 mb-1">Submitted Interns</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-400">
                      {dashboardStats?.submittedInterns || 0}
                    </p>
                  </div>
                  <FaCheckCircle className="text-2xl sm:text-3xl text-green-400" />
                </div>
              </motion.div>

              <motion.div 
                className="bg-white/5 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-white/10"
                whileHover={{ scale: 1.03 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-white/70 mb-1">Overdue Interns</p>
                    <p className="text-xl sm:text-2xl font-bold text-red-400">
                      {dashboardStats?.overdueInterns || 0}
                    </p>
                  </div>
                  <FaExclamationTriangle className="text-2xl sm:text-3xl text-red-400" />
                </div>
              </motion.div>

              <motion.div 
                className="bg-white/5 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-white/10"
                whileHover={{ scale: 1.03 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-white/70 mb-1">Total Records</p>
                    <p className="text-xl sm:text-2xl font-bold text-purple-400">
                      {dashboardStats?.totalRecords || 0}
                    </p>
                  </div>
                  <FaTasks className="text-2xl sm:text-3xl text-purple-400" />
                </div>
              </motion.div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div 
              className="bg-white/5 backdrop-blur-sm p-4 md:p-6 rounded-xl border border-white/10 mb-4 md:mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base md:text-lg lg:text-xl font-semibold text-white">Quick Actions</h2>
                <div className="text-xs text-white/70 bg-white/10 px-2 py-1 rounded-full">
                  Admin Tools
                </div>
              </div>
              <div className="flex flex-row flex-nowrap gap-3 overflow-x-auto pb-2">
                <motion.button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="group relative flex items-center justify-center px-3 md:px-3 py-2.5 bg-gradient-to-r from-amber-500/80 to-orange-500/80 text-white rounded-lg hover:from-amber-500 hover:to-orange-500 transition-all duration-300 shadow-md hover:shadow-lg text-xs font-medium min-h-[2.5rem]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="absolute inset-0 bg-white rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                  <FaBell className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                  <span className="flex-1 text-left">
                    <span className="block">{showNotifications ? 'Hide' : 'Show'} Notifications</span>
                    <span className="block text-xs opacity-90">
                      {dashboardStats?.overdueInterns || 0} overdue
                    </span>
                  </span>
                </motion.button>

                <motion.button
                  onClick={handleSendNotifications}
                  disabled={sendingNotifications || !dashboardStats?.overdueList?.length}
                  className="group relative flex items-center justify-center px-3 md:px-3 py-2.5 bg-gradient-to-r from-red-500/80 to-pink-500/80 text-white rounded-lg hover:from-red-500 hover:to-pink-500 disabled:from-gray-600/80 disabled:to-gray-600/80 disabled:cursor-not-allowed transition-all duration-300 shadow-md hover:shadow-lg disabled:hover:shadow-md text-xs font-medium min-h-[2.5rem]"
                  whileHover={{ scale: sendingNotifications || !dashboardStats?.overdueList?.length ? 1 : 1.02 }}
                  whileTap={{ scale: sendingNotifications || !dashboardStats?.overdueList?.length ? 1 : 0.98 }}
                >
                  <div className="absolute inset-0 bg-white rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                  {sendingNotifications ? (
                    <FaSpinner className="mr-2 h-3 w-3 md:h-4 md:w-4 animate-spin" />
                  ) : (
                    <FaBell className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                  )}
                  <span className="flex-1 text-left">
                    <span className="block">Send Notifications</span>
                    <span className="block text-xs opacity-90">
                      {sendingNotifications ? 'Sending...' : 'Email overdue interns'}
                    </span>
                  </span>
                </motion.button>

                <motion.button
                  onClick={() => navigate('/admin/daily-records')}
                  className="group relative flex items-center justify-center px-3 md:px-3 py-2.5 bg-gradient-to-r from-emerald-500/80 to-teal-500/80 text-white rounded-lg hover:from-emerald-500 hover:to-teal-500 transition-all duration-300 shadow-md hover:shadow-lg text-xs font-medium min-h-[2.5rem]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="absolute inset-0 bg-white rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                  <FaCalendarAlt className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                  <span className="flex-1 text-left">
                    <span className="block">View Daily Records</span>
                    <span className="block text-xs opacity-90">
                      All interns' records
                    </span>
                  </span>
                </motion.button>

                <motion.button
                  onClick={handleExportOverdueCSV}
                  disabled={!dashboardStats?.overdueList?.length}
                  className="group relative flex items-center justify-center px-3 md:px-3 py-2.5 bg-gradient-to-r from-red-600/80 to-red-700/80 text-white rounded-lg hover:from-red-600 hover:to-red-700 disabled:from-gray-600/80 disabled:to-gray-600/80 disabled:cursor-not-allowed transition-all duration-300 shadow-md hover:shadow-lg disabled:hover:shadow-md text-xs font-medium min-h-[2.5rem]"
                  whileHover={{ scale: !dashboardStats?.overdueList?.length ? 1 : 1.02 }}
                  whileTap={{ scale: !dashboardStats?.overdueList?.length ? 1 : 0.98 }}
                >
                  <div className="absolute inset-0 bg-white rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                  <FaFileExport className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                  <span className="flex-1 text-left">
                    <span className="block">Export Overdue</span>
                    <span className="block text-xs opacity-90">
                      {dashboardStats?.overdueList?.length ? `${dashboardStats.overdueList.length} overdue` : 'No overdue'}
                    </span>
                  </span>
                </motion.button>

                <motion.button
                  onClick={handleExportSubmittedCSV}
                  className="group relative flex items-center justify-center px-3 md:px-3 py-2.5 bg-gradient-to-r from-green-500/80 to-green-600/80 text-white rounded-lg hover:from-green-500 hover:to-green-600 transition-all duration-300 shadow-md hover:shadow-lg text-xs font-medium min-h-[2.5rem]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="absolute inset-0 bg-white rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                  <FaFileExport className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                  <span className="flex-1 text-left">
                    <span className="block">Export Submitted</span>
                    <span className="block text-xs opacity-90">
                      {dashboardStats?.submittedInterns ? `${dashboardStats.submittedInterns} submitted` : 'Submitted interns'}
                    </span>
                  </span>
                </motion.button>

                <motion.button
                  onClick={handleExportPreviousDayCSV}
                  className="group relative flex items-center justify-center px-3 md:px-3 py-2.5 bg-gradient-to-r from-blue-500/80 to-blue-600/80 text-white rounded-lg hover:from-blue-500 hover:to-blue-600 transition-all duration-300 shadow-md hover:shadow-lg text-xs font-medium min-h-[2.5rem]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="absolute inset-0 bg-white rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                  <FaDownload className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                  <span className="flex-1 text-left">
                    <span className="block">Export Previous Day</span>
                    <span className="block text-xs opacity-90">
                      Yesterday's submissions
                    </span>
                  </span>
                </motion.button>

                <motion.button
                  onClick={handleDownloadOnLeaveExcel}
                  className="group relative flex items-center justify-center px-3 md:px-3 py-2.5 bg-gradient-to-r from-blue-700/80 to-blue-900/80 text-white rounded-lg hover:from-blue-700 hover:to-blue-900 transition-all duration-300 shadow-md hover:shadow-lg text-xs font-medium min-h-[2.5rem]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="absolute inset-0 bg-white rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                  <FaDownload className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                  <span className="flex-1 text-left">
                    <span className="block">Download On Leave</span>
                    <span className="block text-xs opacity-90">
                      Get list of on-leave interns
                    </span>
                  </span>
                </motion.button>
              </div>
            </motion.div>

            {/* Notifications Panel */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div 
                  className="bg-white/5 backdrop-blur-sm p-4 md:p-6 rounded-xl border border-white/10 mb-4 md:mb-6"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <h3 className="text-base md:text-lg font-semibold text-white mb-4">
                    Overdue Interns ({dashboardStats?.overdueList?.length || 0})
                  </h3>
                  {dashboardStats?.overdueList?.length > 0 ? (
                    <div className="space-y-3">
                      {dashboardStats.overdueList.map((intern) => (
                        <motion.div 
                          key={intern._id} 
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20 gap-3 sm:gap-0"
                          whileHover={{ scale: 1.01 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="flex-1">
                            <p className="font-medium text-white text-sm md:text-base">{intern.traineeName}</p>
                            <p className="text-xs md:text-sm text-white/70">ID: {intern.traineeId}</p>
                            <p className="text-xs md:text-sm text-white/70 truncate">{intern.email}</p>
                          </div>
                          <div className="text-left sm:text-right flex-shrink-0">
                            <p className="text-xs md:text-sm text-red-300">
                              Last: {intern.lastSubmission ? 
                                new Date(intern.lastSubmission).toLocaleDateString() : 'Never'
                              }
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 md:py-8 bg-white/5 rounded-lg">
                      <p className="text-white/60 text-sm md:text-base">No overdue interns found.</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search and Filter Controls */}
            <motion.div 
              className="bg-white/5 backdrop-blur-sm p-4 md:p-6 rounded-xl border border-white/10 mb-4 md:mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.3 }}
            >
              <div className="flex flex-col space-y-3 md:space-y-4 xl:flex-row xl:space-y-0 xl:space-x-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-3 w-3 md:h-4 md:w-4" />
                    {searchLoading && (
                      <FaSpinner className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 h-3 w-3 md:h-4 md:w-4 animate-spin" />
                    )}
                    <input
                      type="text"
                      placeholder="Search by name, trainee ID, or email (min 2 characters)..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 md:pl-10 pr-8 md:pr-10 py-2 md:py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-green-400/50 focus:border-transparent text-white placeholder-white/40 text-sm md:text-base"
                    />
                  </div>
                  {searchTerm.length > 0 && searchTerm.length < 2 && (
                    <p className="text-xs text-white/50 mt-1">Type at least 2 characters to search</p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 xl:space-x-4">
                  {/* Filter by Status */}
                  <div className="flex items-center space-x-2">
                    <FaFilter className="text-white/60 h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-2 md:px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-green-400/50 focus:border-transparent text-white text-sm md:text-base flex-1 sm:flex-none"
                    >
                      <option value="all" className="bg-gray-800">All Status</option>
                      <option value="submitted" className="bg-gray-800">Submitted</option>
                      <option value="notsubmitted" className="bg-gray-800">Not Submitted</option>
                      <option value="overdue" className="bg-gray-800">Overdue</option>
                    </select>
                  </div>

                  {/* Sort */}
                  <div className="flex items-center space-x-2">
                    <FaSort className="text-white/60 h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-2 md:px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-green-400/50 focus:border-transparent text-white text-sm md:text-base flex-1 sm:flex-none"
                    >
                      <option value="name" className="bg-gray-800">Sort by Name</option>
                      <option value="id" className="bg-gray-800">Sort by Trainee ID</option>
                      <option value="records" className="bg-gray-800">Sort by Records Count</option>
                      <option value="lastSubmitted" className="bg-gray-800">Sort by Last Submission</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Interns Table */}
            <motion.div 
              className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.3 }}
            >
              <div className="px-4 md:px-6 py-4 border-b border-white/10">
                <h2 className="text-base md:text-lg lg:text-xl font-semibold text-white">
                  {(!hasSearched && filterStatus === 'all') ? 'Search for Interns' : `Search Results (${filteredInterns.length})`}
                </h2>
                {(!hasSearched && filterStatus === 'all') && (
                  <p className="text-xs md:text-sm text-white/60 mt-1">
                    Use the search bar above to find specific interns or select a filter option
                  </p>
                )}
              </div>

              {(!hasSearched && filterStatus === 'all') ? (
                <div className="text-center py-12 md:py-16 bg-white/5 px-4">
                  <FaSearch className="mx-auto h-8 w-8 md:h-12 md:w-12 text-white/40 mb-4" />
                  <h3 className="text-base md:text-lg font-medium text-white mb-2">Search for Interns</h3>
                  <p className="text-white/60 mb-4 text-sm md:text-base">
                    Enter a name, trainee ID, or email to find specific interns and view their records.
                  </p>
                  <div className="bg-blue-500/10 border border-blue-400/20 rounded-lg p-3 md:p-4 max-w-md mx-auto">
                    <p className="text-xs md:text-sm text-blue-300">
                      💡 <strong>Tip:</strong> Type at least 2 characters to start searching or use the filter dropdown to see all interns by status
                    </p>
                  </div>
                </div>
              ) : filteredInterns.length === 0 ? (
                <div className="text-center py-8 md:py-12 bg-white/5 px-4">
                  <FaUser className="mx-auto h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 text-white/40" />
                  <h3 className="mt-2 text-sm md:text-base font-medium text-white">No interns found</h3>
                  <p className="mt-1 text-xs md:text-sm text-white/60">
                    Try adjusting your search terms or check the spelling.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block lg:hidden">
                    <div className="divide-y divide-white/10">
                      {filteredInterns.map((intern) => (
                        <motion.div 
                          key={intern._id} 
                          className="p-4 hover:bg-white/5"
                          whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                          transition={{ duration: 0.1 }}
                        >
                          {/* Header with avatar and name */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0 h-8 w-8">
                                <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                                  <FaUser className="text-white/80 text-xs" />
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-white">
                                  {intern.traineeName || 'N/A'}
                                </div>
                                <div className="text-xs text-white/60">
                                  ID: {intern.traineeId || 'N/A'}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              {getStatusBadge(intern)}
                            </div>
                          </div>
                          
                          {/* Contact info */}
                          <div className="mb-3">
                            <div className="text-xs text-white/80 truncate">
                              📧 {intern.email || 'N/A'}
                            </div>
                            <div className="text-xs text-white/60 truncate">
                              🎯 {intern.fieldOfSpecialization || 'N/A'}
                            </div>
                          </div>
                          
                          {/* Stats and last submission */}
                          <div className="flex justify-between items-center mb-3">
                            <div className="text-xs text-white/80">
                              📊 {intern.totalRecords || 0} records
                            </div>
                          </div>
                          
                          <div className="mb-3">
                            <div className="text-xs text-white/80">
                              📅 Last: {intern.lastSubmission ? 
                                new Date(intern.lastSubmission).toLocaleDateString() : 'Never'
                              }
                            </div>
                            <div className="text-xs text-white/60">
                              ⏰ {intern.daysSinceLastSubmission !== null && intern.daysSinceLastSubmission !== undefined ? 
                                `${intern.daysSinceLastSubmission} days ago` : 'No submissions'
                              }
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex space-x-2">
                            <button
                              onClick={() => navigate(`/admin/intern/${intern._id}`)}
                              className="flex-1 text-cyan-400 hover:text-cyan-300 hover:bg-white/10 px-2 py-1 rounded-lg transition-colors text-xs text-center"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => navigate(`/admin/intern/${intern._id}/records`)}
                              className="flex-1 text-green-400 hover:text-green-300 hover:bg-white/10 px-2 py-1 rounded-lg transition-colors text-xs text-center"
                            >
                              View Records
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-white/10">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider min-w-[200px]">
                            Intern Details
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider min-w-[180px]">
                            Contact
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider min-w-[120px]">
                            Records
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider min-w-[140px]">
                            Last Submission
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider min-w-[100px]">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider min-w-[150px]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {filteredInterns.map((intern) => (
                          <motion.tr 
                            key={intern._id} 
                            className="hover:bg-white/5"
                            whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                            transition={{ duration: 0.1 }}
                          >
                            <td className="px-6 py-4 whitespace-nowrap min-w-[200px]">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                                    <FaUser className="text-white/80" />
                                  </div>
                                </div>
                                <div className="ml-4 flex-1">
                                  <div className="text-sm font-medium text-white truncate max-w-[120px]">
                                    {intern.traineeName || 'N/A'}
                                  </div>
                                  <div className="text-sm text-white/60 truncate">
                                    ID: {intern.traineeId || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap min-w-[180px]">
                              <div className="text-sm text-white truncate max-w-[150px]" title={intern.email}>
                                {intern.email || 'N/A'}
                              </div>
                              <div className="text-sm text-white/60 truncate max-w-[150px]" title={intern.fieldOfSpecialization}>
                                {intern.fieldOfSpecialization || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap min-w-[120px]">
                              <div className="text-sm font-medium text-white">
                                {intern.totalRecords || 0} records
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap min-w-[140px]">
                              <div className="text-sm text-white">
                                {intern.lastSubmission ? 
                                  new Date(intern.lastSubmission).toLocaleDateString() : 'Never'
                                }
                              </div>
                              <div className="text-sm text-white/60">
                                {intern.daysSinceLastSubmission !== null && intern.daysSinceLastSubmission !== undefined ? 
                                  `${intern.daysSinceLastSubmission} days ago` : 'No submissions'
                                }
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap min-w-[100px]">
                              {getStatusBadge(intern)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium min-w-[150px]">
                              <div className="flex flex-col space-y-1">
                                <button
                                  onClick={() => navigate(`/admin/intern/${intern._id}`)}
                                  className="text-cyan-400 hover:text-cyan-300 text-sm text-left"
                                >
                                  View Details
                                </button>
                                <button
                                  onClick={() => navigate(`/admin/intern/${intern._id}/records`)}
                                  className="text-green-400 hover:text-green-300 text-sm text-left"
                                >
                                  View Records
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </main>
      </div>

      {/* Global styles for animations */}
      <style jsx="true" global>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0) rotate(0deg);
          }
          25% {
            transform: translateY(-20px) translateX(10px) rotate(2deg);
          }
          50% {
            transform: translateY(10px) translateX(-10px) rotate(-2deg);
          }
          75% {
            transform: translateY(-10px) translateX(15px) rotate(1deg);
          }
        }
        .animate-float {
          animation: float 12s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;