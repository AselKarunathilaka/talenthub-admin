import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaSearch, FaCalendarAlt, FaDownload, FaUser, FaArrowLeft,
  FaFilter, FaSort, FaFileExport, FaEye, FaExclamationTriangle,
  FaShieldAlt, FaTasks, FaRegSmile, FaRegClock, FaChartLine
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi, csvUtils, notificationUtils } from '../api/adminApi';
import logo from '../assets/sltlogo.jpg';

const AdminDailyRecords = () => {
  const navigate = useNavigate();
  const [dailyRecords, setDailyRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch all daily records
  const fetchDailyRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check admin authentication
      const adminInfo = JSON.parse(localStorage.getItem('adminInfo') || '{}');
      if (!adminInfo.token) {
        setError('Admin authentication required');
        navigate('/admin-login');
        return;
      }

      // Fetch all daily records from the API
      const records = await adminApi.getAllDailyRecords();
      setDailyRecords(records);

    } catch (error) {
      console.error('Error fetching daily records:', error);
      setError('Failed to load daily records. Please try again.');
      
      // If it's an auth error, redirect to login
      if (error.message.includes('403') || error.message.includes('401')) {
        localStorage.removeItem('adminInfo');
        navigate('/admin-login');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchDailyRecords();
  }, [fetchDailyRecords]);

  // Filter and sort records
  const getFilteredRecords = () => {
    let filtered = [...dailyRecords];

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(record => 
        record.Trainee_Name?.toLowerCase().includes(searchLower) ||
        record.Trainee_ID?.toLowerCase().includes(searchLower)
      );
    }

    // Date filter
    if (dateFilter) {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.date).toDateString();
        const filterDate = new Date(dateFilter).toDateString();
        return recordDate === filterDate;
      });
    }

    // Sort records
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'name':
          aValue = a.Trainee_Name || '';
          bValue = b.Trainee_Name || '';
          break;
        case 'traineeId':
          aValue = a.Trainee_ID || '';
          bValue = b.Trainee_ID || '';
          break;
        default:
          return 0;
      }

      if (sortBy === 'date') {
        return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
      } else {
        const comparison = aValue.localeCompare(bValue);
        return sortOrder === 'desc' ? -comparison : comparison;
      }
    });

    return filtered;
  };

  const filteredRecords = getFilteredRecords();

  // Export records to CSV
  const handleExportCSV = async () => {
    try {
      if (filteredRecords.length === 0) {
        notificationUtils.showInfo('No records to export.');
        return;
      }

      // Format data for CSV export
      const csvData = filteredRecords.map(record => ({
        'Date': new Date(record.date).toLocaleDateString(),
        'Trainee Name': record.Trainee_Name || 'N/A',
        'Trainee ID': record.Trainee_ID || 'N/A',
        'Created At': new Date(record.createdAt).toLocaleString()
      }));

      // Convert to CSV and download
      const csv = convertToCSV(csvData);
      downloadCSV(csv, `daily_records_${new Date().toISOString().split('T')[0]}.csv`);
      
      notificationUtils.showSuccess(`Daily records CSV with ${filteredRecords.length} records downloaded successfully`);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      notificationUtils.showError('Failed to export CSV report');
    }
  };

  // Helper function to convert array to CSV
  const convertToCSV = (data) => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header] || '';
          // Escape quotes and wrap in quotes if contains comma
          return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        }).join(',')
      )
    ].join('\n');
    
    return csvContent;
  };

  // Helper function to download CSV
  const downloadCSV = (csvContent, filename) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
          <p className="text-gray-600 font-medium">Loading daily records...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center max-w-md p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-lg">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <FaExclamationTriangle className="text-4xl text-red-500 mb-4 mx-auto" />
          </motion.div>
          <p className="text-gray-700 mb-6">{error}</p>
          <div className="flex justify-center space-x-4">
            <motion.button 
              onClick={fetchDailyRecords}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white rounded-xl transition-all shadow-md hover:shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Retry
            </motion.button>
            <motion.button 
              onClick={() => navigate('/admin/dashboard')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Back to Dashboard
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

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
                <span className="text-xs sm:text-sm text-gray-600 truncate">Daily Records</span>
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
                      Daily Records
                    </span>
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600">View and manage all intern daily logbook records</p>
                </div>
              </div>
              <motion.div 
                className="text-left sm:text-right w-full sm:w-auto bg-white/80 backdrop-blur-sm p-3 rounded-2xl border border-gray-100 shadow-sm"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <p className="text-xs sm:text-sm text-gray-500">Total Records</p>
                <p className="text-xl sm:text-2xl font-bold text-cyan-600">{dailyRecords.length}</p>
              </motion.div>
            </motion.div>

            {/* Statistics */}
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <div className="bg-white/80 backdrop-blur-sm p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-gray-500 mb-1">Total Records</p>
                    <p className="text-xl md:text-2xl font-bold text-gray-800">{dailyRecords.length}</p>
                  </div>
                  <FaCalendarAlt className="text-xl md:text-2xl text-blue-500" />
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-gray-500 mb-1">Filtered Records</p>
                    <p className="text-xl md:text-2xl font-bold text-green-600">{filteredRecords.length}</p>
                  </div>
                  <FaFilter className="text-xl md:text-2xl text-green-500" />
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-gray-500 mb-1">Unique Interns</p>
                    <p className="text-xl md:text-2xl font-bold text-purple-600">
                      {new Set(dailyRecords.map(r => r.Trainee_ID)).size}
                    </p>
                  </div>
                  <FaUser className="text-xl md:text-2xl text-purple-500" />
                </div>
              </div>
            </motion.div>

            {/* Controls */}
            <motion.div 
              className="bg-white/80 backdrop-blur-sm p-4 sm:p-5 lg:p-6 rounded-2xl border border-gray-100 shadow-sm mb-4 sm:mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              <div className="flex flex-col space-y-3 sm:space-y-4 xl:flex-row xl:space-y-0 xl:space-x-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <motion.input
                      type="text"
                      placeholder="Search by name or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 shadow-sm"
                      whileFocus={{ scale: 1.01 }}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 xl:space-x-4">
                  {/* Date Filter */}
                  <motion.div 
                    className="flex items-center space-x-2 bg-white p-2 rounded-xl border border-gray-200 shadow-sm"
                    whileHover={{ y: -2 }}
                  >
                    <FaCalendarAlt className="text-blue-500 h-4 w-4 flex-shrink-0" />
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="px-3 py-1.5 text-sm sm:text-base bg-transparent border-0 focus:ring-0 focus:outline-none text-gray-900 flex-1 sm:flex-none"
                    />
                  </motion.div>

                  {/* Sort */}
                  <motion.div 
                    className="flex items-center space-x-2 bg-white p-2 rounded-xl border border-gray-200 shadow-sm"
                    whileHover={{ y: -2 }}
                  >
                    <FaSort className="text-blue-500 h-4 w-4 flex-shrink-0" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-1.5 text-sm sm:text-base bg-transparent border-0 focus:ring-0 focus:outline-none text-gray-900 flex-1 sm:flex-none"
                    >
                      <option value="date" className="bg-white">Sort by Date</option>
                      <option value="name" className="bg-white">Sort by Name</option>
                      <option value="traineeId" className="bg-white">Sort by Trainee ID</option>
                    </select>
                    <motion.button
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                      className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-700 text-sm sm:text-base flex-shrink-0"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {sortOrder === 'desc' ? '↓' : '↑'}
                    </motion.button>
                  </motion.div>

                  {/* Export Button */}
                  <motion.button
                    onClick={handleExportCSV}
                    disabled={filteredRecords.length === 0}
                    className="flex items-center justify-center px-3 md:px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-xl hover:from-green-600 hover:to-teal-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-300 text-sm md:text-base shadow-sm hover:shadow-md"
                    whileHover={{ scale: filteredRecords.length > 0 ? 1.05 : 1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FaFileExport className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                    <span className="whitespace-nowrap">Export CSV</span>
                  </motion.button>
                </div>
              </div>
              <motion.p 
                className="text-xs sm:text-sm text-gray-500 mt-2 sm:mt-3 flex items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <FaRegSmile className="mr-1.5 text-amber-500" />
                Showing {filteredRecords.length} of {dailyRecords.length} records
              </motion.p>
            </motion.div>

            {/* Records Table */}
            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.3 }}
            >
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100">
                <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                  Daily Records ({filteredRecords.length})
                </h2>
              </div>

              {filteredRecords.length === 0 ? (
                <motion.div 
                  className="text-center py-8 md:py-12 px-4 bg-white/50 rounded-2xl"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    animate={{ 
                      y: [0, -10, 0],
                      rotate: [0, 5, 0]
                    }}
                    transition={{ 
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <FaTasks className="mx-auto h-8 w-8 md:h-12 md:w-12 text-gray-400 mb-3 md:mb-4" />
                  </motion.div>
                  <h3 className="text-base md:text-lg font-medium text-gray-700 mb-2">No records found</h3>
                  <p className="text-gray-500 text-sm md:text-base">
                    {searchTerm || dateFilter 
                      ? 'Try adjusting your search terms or date filter.' 
                      : 'No daily records have been submitted yet.'
                    }
                  </p>
                </motion.div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block lg:hidden">
                    <div className="divide-y divide-gray-100">
                      {filteredRecords.map((record) => (
                        <motion.div 
                          key={record._id} 
                          className="p-4 hover:bg-gray-50/50 transition-colors"
                          whileHover={{ y: -2 }}
                          transition={{ duration: 0.1 }}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0 h-8 w-8">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 flex items-center justify-center shadow-sm">
                                  <FaUser className="text-blue-600 h-3 w-3" />
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {record.Trainee_Name || 'N/A'}
                                </div>
                                <div className="text-xs text-gray-600">
                                  ID: {record.Trainee_ID || 'N/A'}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-medium text-gray-900">
                                {new Date(record.date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(record.createdAt).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-500">
                              <FaRegClock className="inline mr-1" />
                              {new Date(record.date).toLocaleDateString()}
                            </div>
                            <motion.button
                              onClick={() => navigate(`/admin/intern/${record.internId}/records`)}
                              className="flex items-center text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 px-2 py-1 rounded-xl transition-colors text-xs shadow-sm"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <FaEye className="mr-1 h-3 w-3" />
                              View
                            </motion.button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Intern Details
                          </th>
                          <th className="px-6 py-3 pl-12 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredRecords.map((record) => (
                          <motion.tr 
                            key={record._id} 
                            className="hover:bg-gray-50/80 transition-colors"
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.1 }}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {new Date(record.date).toLocaleDateString()}
                              </div>
                              <div className="text-sm text-gray-500">
                                {new Date(record.createdAt).toLocaleTimeString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 flex items-center justify-center shadow-sm">
                                    <FaUser className="text-blue-600" />
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {record.Trainee_Name || 'N/A'}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    ID: {record.Trainee_ID || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center" colSpan={2}>
                              <motion.button
                                onClick={() => navigate(`/admin/intern/${record.internId}/records`)}
                                className="flex items-center text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 px-3 py-1 rounded-xl transition-colors shadow-sm mx-auto"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <FaEye className="mr-2" />
                                View Records
                              </motion.button>
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
    </div>
  );
};

export default AdminDailyRecords;