import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FaUser, FaCalendarAlt, FaArrowLeft, FaExclamationTriangle,
  FaSearch, FaFilter, FaSort, FaTasks, FaEye, FaShieldAlt
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../api/adminApi';
import logo from '../assets/sltlogo.jpg';

const AdminInternRecords = () => {
  const { internId } = useParams();
  const navigate = useNavigate();
  const [internDetails, setInternDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [filterPeriod, setFilterPeriod] = useState('all');

  useEffect(() => {
    fetchInternDetails();
  }, [internId]);

  const fetchInternDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check admin authentication
      const adminInfo = JSON.parse(localStorage.getItem('adminInfo') || '{}');
      if (!adminInfo.token) {
        navigate('/admin-login');
        return;
      }

      const data = await adminApi.getInternDetails(internId);
      setInternDetails(data);

    } catch (error) {
      console.error('Error fetching intern details:', error);
      setError('Failed to load intern records');
      
      if (error.message.includes('403') || error.message.includes('401')) {
        localStorage.removeItem('adminInfo');
        navigate('/admin-login');
      }
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRecords = () => {
    if (!internDetails?.records) return [];

    let filtered = [...internDetails.records];

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(record => 
        record.task?.toLowerCase().includes(searchLower) ||
        record.progress?.toLowerCase().includes(searchLower) ||
        record.blockers?.toLowerCase().includes(searchLower) ||
        record.date?.toLowerCase().includes(searchLower)
      );
    }

    // Period filter
    if (filterPeriod !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (filterPeriod) {
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setDate(now.getDate() - 30);
          break;
        case '3months':
          filterDate.setDate(now.getDate() - 90);
          break;
        default:
          break;
      }
      
      if (filterPeriod !== 'all') {
        filtered = filtered.filter(record => new Date(record.createdAt) >= filterDate);
      }
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'dateOld':
          return new Date(a.createdAt) - new Date(b.createdAt);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredRecords = getFilteredRecords();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-950 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-t-4 border-b-4 border-green-400 rounded-full mx-auto mb-6"
          />
          <p className="text-white/80 font-medium">Loading intern records...</p>
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
          <div className="flex justify-center space-x-4">
            <button 
              onClick={fetchInternDetails}
              className="px-4 py-2 bg-green-500/90 hover:bg-green-400/90 text-white rounded-lg transition-colors"
            >
              Retry
            </button>
            <button 
              onClick={() => navigate('/admin/dashboard')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { intern } = internDetails;

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
                <span className="text-sm sm:text-lg font-semibold text-white/90 truncate">SLT Admin Portal</span>
                <span className="text-xs sm:text-sm text-blue-100/70 truncate">Intern Records</span>
              </div>
            </motion.div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-6 flex-shrink-0">
            <div className="hidden md:flex items-center space-x-3 mr-4">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-white/10 flex items-center justify-center transition-all duration-300 group-hover:bg-white/20 border border-white/10">
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
            
            {/* Header with Back Button */}
            <motion.div 
              className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={() => navigate(`/admin/intern/${internId}`)}
                  className="flex items-center px-3 sm:px-4 py-2 text-sm sm:text-base text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-white/10"
                >
                  <FaArrowLeft className="mr-2" />
                  Back to Details
                </button>
                <div>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-400">
                      Logbook Records
                    </span>
                  </h2>
                  <p className="text-sm sm:text-base text-white/70">{intern?.traineeName} - {intern?.traineeId}</p>
                </div>
              </div>
              <div className="text-left sm:text-right w-full sm:w-auto">
                <p className="text-xs sm:text-sm text-white/70">Total Records</p>
                <p className="text-xl sm:text-2xl font-bold text-cyan-400">{internDetails?.records?.length || 0}</p>
              </div>
            </motion.div>

            {/* Search and Filter Controls */}
            <motion.div 
              className="bg-white/5 backdrop-blur-sm p-3 sm:p-4 lg:p-6 rounded-xl border border-white/10 mb-4 sm:mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <div className="flex flex-col space-y-3 sm:space-y-4 xl:flex-row xl:space-y-0 xl:space-x-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search in tasks, progress, and blockers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 sm:py-3 text-sm sm:text-base bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-green-400/50 focus:border-transparent text-white placeholder-white/40"
                    />
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                  {/* Period Filter */}
                  <div className="flex items-center space-x-2">
                    <FaFilter className="text-white/60 h-4 w-4 flex-shrink-0" />
                    <select
                      value={filterPeriod}
                      onChange={(e) => setFilterPeriod(e.target.value)}
                      className="px-3 py-2 text-sm sm:text-base bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-green-400/50 focus:border-transparent text-white flex-1 sm:flex-none"
                    >
                      <option value="all" className="bg-gray-800">All Time</option>
                      <option value="week" className="bg-gray-800">Last Week</option>
                      <option value="month" className="bg-gray-800">Last Month</option>
                      <option value="3months" className="bg-gray-800">Last 3 Months</option>
                    </select>
                  </div>

                  {/* Sort */}
                  <div className="flex items-center space-x-2">
                    <FaSort className="text-white/60 h-4 w-4 flex-shrink-0" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2 text-sm sm:text-base bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-green-400/50 focus:border-transparent text-white flex-1 sm:flex-none"
                    >
                      <option value="date" className="bg-gray-800">Newest First</option>
                      <option value="dateOld" className="bg-gray-800">Oldest First</option>
                    </select>
                  </div>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-white/60 mt-2 sm:mt-3">
                Showing {filteredRecords.length} of {internDetails?.records?.length || 0} records
              </p>
            </motion.div>

            {/* Records List */}
            <motion.div 
              className="space-y-3 sm:space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              <AnimatePresence>
                {filteredRecords.length === 0 ? (
                  <motion.div 
                    className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 sm:p-8 lg:p-12 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <FaTasks className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-white/40 mb-3 sm:mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-white mb-2">No records found</h3>
                    <p className="text-sm sm:text-base text-white/60">
                      {searchTerm || filterPeriod !== 'all' 
                        ? 'Try adjusting your search or filter criteria.' 
                        : 'This intern hasn\'t submitted any logbook entries yet.'
                      }
                    </p>
                  </motion.div>
                ) : (
                  filteredRecords.map((record, index) => (
                    <motion.div 
                      key={record._id} 
                      className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 sm:p-6"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-3">
                        <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0">
                          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                            <FaCalendarAlt className="text-white/80 text-sm sm:text-base" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-semibold text-white">
                              {new Date(record.date).toLocaleDateString('en-US', {
                                weekday: window.innerWidth < 640 ? 'short' : 'long',
                                year: 'numeric',
                                month: window.innerWidth < 640 ? 'short' : 'long',
                                day: 'numeric'
                              })}
                            </h3>
                            <p className="text-xs sm:text-sm text-white/60">
                              Submitted: {new Date(record.createdAt).toLocaleDateString()}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-1 sm:mt-2">
                              {/* Show stack only if it's not "On Leave" when status is leave */}
                              {record.stack && !(record.status === 'leave' && record.stack === 'On Leave') && (
                                <span className="inline-block px-2 sm:px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                  {record.stack}
                                </span>
                              )}
                              
                              {/* Show status badge for Work From Home */}
                              {record.status === 'wfh' && (
                                <span className="inline-block px-2 sm:px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                                  Work From Home
                                </span>
                              )}
                              {/* Show status badge for On Leave */}
                              {record.status === 'leave' && (
                                <span className="inline-block px-2 sm:px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                  On Leave
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                          <span className="inline-flex items-center px-2 sm:px-2.5 py-1 sm:py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                            <FaTasks className="mr-1" />
                            Daily Record
                          </span>
                        </div>
                      </div>

                      {/* Record Details */}
                      <div className="space-y-3 sm:space-y-4">
                        {/* Task */}
                        {record.task && (
                          <div className="border-l-4 border-blue-500/70 pl-3 sm:pl-4 py-2">
                            <h4 className="font-medium text-white mb-1 sm:mb-2 text-sm sm:text-base">Tasks Completed</h4>
                            <p className="text-xs sm:text-sm text-white/80 leading-relaxed">{record.task}</p>
                          </div>
                        )}

                        {/* Progress */}
                        {record.progress && record.progress !== "No challenges faced" && (
                          <div className="border-l-4 border-green-500/70 pl-3 sm:pl-4 py-2">
                            <h4 className="font-medium text-white mb-1 sm:mb-2 text-sm sm:text-base">Challenges Faced</h4>
                            <p className="text-xs sm:text-sm text-white/80 leading-relaxed">{record.progress}</p>
                          </div>
                        )}

                        {/* Blockers */}
                        {record.blockers && record.blockers !== "No specific plans" && (
                          <div className="border-l-4 border-orange-500/70 pl-3 sm:pl-4 py-2">
                            <h4 className="font-medium text-white mb-1 sm:mb-2 text-sm sm:text-base">Plans for Tomorrow</h4>
                            <p className="text-xs sm:text-sm text-white/80 leading-relaxed">{record.blockers}</p>
                          </div>
                        )}
                      </div>

                      {(!record.task && (!record.progress || record.progress === "No challenges faced") && (!record.blockers || record.blockers === "No specific plans")) && (
                        <div className="text-center py-3 sm:py-4 text-white/60">
                          <FaExclamationTriangle className="mx-auto h-6 w-6 sm:h-8 sm:w-8 mb-2" />
                          <p className="text-xs sm:text-sm">No detailed information available for this record</p>
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </main>
      </div>

      {/* Global styles for animations */}
      <style jsx global>{`
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

export default AdminInternRecords;