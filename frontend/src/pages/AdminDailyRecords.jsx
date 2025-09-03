import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaSearch, FaCalendarAlt, FaDownload, FaUser, FaArrowLeft,
  FaFilter, FaSort, FaFileExport, FaEye, FaExclamationTriangle,
  FaShieldAlt
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
        record.traineeName?.toLowerCase().includes(searchLower) ||
        record.traineeId?.toLowerCase().includes(searchLower)
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
          aValue = a.traineeName || '';
          bValue = b.traineeName || '';
          break;
        case 'traineeId':
          aValue = a.traineeId || '';
          bValue = b.traineeId || '';
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
        'Trainee Name': record.traineeName || 'N/A',
        'Trainee ID': record.traineeId || 'N/A',
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-950 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-t-4 border-b-4 border-green-400 rounded-full mx-auto mb-6"
          />
          <p className="text-white/80 font-medium">Loading daily records...</p>
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
              onClick={fetchDailyRecords}
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
                <span className="text-xs sm:text-sm text-blue-100/70 truncate">Daily Records</span>
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
              className="mb-4 md:mb-6 flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
                <button
                  onClick={() => navigate('/admin/dashboard')}
                  className="flex items-center justify-center sm:justify-start px-3 md:px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-white/10 text-sm md:text-base"
                >
                  <FaArrowLeft className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                  Back to Dashboard
                </button>
                <div className="text-center sm:text-left">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-400">
                      Daily Records
                    </span>
                  </h2>
                  <p className="text-white/70 text-sm md:text-base">View and manage all intern daily logbook records</p>
                </div>
              </div>
            </motion.div>

            {/* Statistics */}
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <div className="bg-white/5 backdrop-blur-sm p-4 md:p-6 rounded-xl border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-white/70 mb-1">Total Records</p>
                    <p className="text-xl md:text-2xl font-bold text-white">{dailyRecords.length}</p>
                  </div>
                  <FaCalendarAlt className="text-xl md:text-2xl text-cyan-400" />
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-sm p-4 md:p-6 rounded-xl border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-white/70 mb-1">Filtered Records</p>
                    <p className="text-xl md:text-2xl font-bold text-green-400">{filteredRecords.length}</p>
                  </div>
                  <FaFilter className="text-xl md:text-2xl text-green-400" />
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-sm p-4 md:p-6 rounded-xl border border-white/10 sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-white/70 mb-1">Unique Interns</p>
                    <p className="text-xl md:text-2xl font-bold text-purple-400">
                      {new Set(dailyRecords.map(r => r.traineeId)).size}
                    </p>
                  </div>
                  <FaUser className="text-xl md:text-2xl text-purple-400" />
                </div>
              </div>
            </motion.div>

            {/* Controls */}
            <motion.div 
              className="bg-white/5 backdrop-blur-sm p-4 md:p-6 rounded-xl border border-white/10 mb-4 md:mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              <div className="flex flex-col space-y-3 md:space-y-4 xl:flex-row xl:space-y-0 xl:space-x-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-3 w-3 md:h-4 md:w-4" />
                    <input
                      type="text"
                      placeholder="Search by name or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 md:pl-10 pr-3 md:pr-4 py-2 md:py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-green-400/50 focus:border-transparent text-white placeholder-white/40 text-sm md:text-base"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 xl:space-x-4">
                  {/* Date Filter */}
                  <div className="flex items-center space-x-2">
                    <FaCalendarAlt className="text-white/60 h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="px-2 md:px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-green-400/50 focus:border-transparent text-white text-sm md:text-base flex-1 sm:flex-none"
                    />
                  </div>

                  {/* Sort */}
                  <div className="flex items-center space-x-2">
                    <FaSort className="text-white/60 h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-2 md:px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-green-400/50 focus:border-transparent text-white text-sm md:text-base flex-1 sm:flex-none"
                    >
                      <option value="date" className="bg-gray-800">Sort by Date</option>
                      <option value="name" className="bg-gray-800">Sort by Name</option>
                      <option value="traineeId" className="bg-gray-800">Sort by Trainee ID</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                      className="px-2 md:px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-white text-sm md:text-base flex-shrink-0"
                    >
                      {sortOrder === 'desc' ? '↓' : '↑'}
                    </button>
                  </div>

                  {/* Export Button */}
                  <button
                    onClick={handleExportCSV}
                    disabled={filteredRecords.length === 0}
                    className="flex items-center justify-center px-3 md:px-4 py-2 bg-gradient-to-r from-green-500 to-cyan-500 text-white rounded-lg hover:from-green-400 hover:to-cyan-400 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all duration-300 text-sm md:text-base"
                  >
                    <FaFileExport className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                    <span className="whitespace-nowrap">Export CSV</span>
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Records Table */}
            <motion.div 
              className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.3 }}
            >
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-white/10">
                <h2 className="text-lg md:text-xl font-semibold text-white">
                  Daily Records ({filteredRecords.length})
                </h2>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="text-center py-8 md:py-12 px-4">
                  <FaCalendarAlt className="mx-auto h-8 w-8 md:h-12 md:w-12 text-white/40 mb-3 md:mb-4" />
                  <h3 className="text-base md:text-lg font-medium text-white mb-2">No records found</h3>
                  <p className="text-white/60 text-sm md:text-base">
                    {searchTerm || dateFilter 
                      ? 'Try adjusting your search terms or date filter.' 
                      : 'No daily records have been submitted yet.'
                    }
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block lg:hidden">
                    <div className="divide-y divide-white/10">
                      {filteredRecords.map((record) => (
                        <motion.div 
                          key={record._id} 
                          className="p-4 hover:bg-white/5"
                          whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                          transition={{ duration: 0.1 }}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0 h-8 w-8">
                                <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                                  <FaUser className="text-white/80 h-3 w-3" />
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-white">
                                  {record.traineeName || 'N/A'}
                                </div>
                                <div className="text-xs text-white/60">
                                  ID: {record.traineeId || 'N/A'}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-medium text-white">
                                {new Date(record.date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </div>
                              <div className="text-xs text-white/60">
                                {new Date(record.createdAt).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-white/80">
                            </div>
                            <button
                              onClick={() => navigate(`/admin/intern/${record.internId}/records`)}
                              className="flex items-center text-cyan-400 hover:text-cyan-300 hover:bg-white/10 px-2 py-1 rounded-lg transition-colors text-xs"
                            >
                              <FaEye className="mr-1 h-3 w-3" />
                              View
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
                          <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                            Intern Details
                          </th>
                          <th className="px-6 py-3 pl-12 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {filteredRecords.map((record) => (
                          <motion.tr 
                            key={record._id} 
                            className="hover:bg-white/5"
                            whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                            transition={{ duration: 0.1 }}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-white">
                                {new Date(record.date).toLocaleDateString()}
                              </div>
                              <div className="text-sm text-white/60">
                                {new Date(record.createdAt).toLocaleTimeString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                                    <FaUser className="text-white/80" />
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-white">
                                    {record.traineeName || 'N/A'}
                                  </div>
                                  <div className="text-sm text-white/60">
                                    ID: {record.traineeId || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center" colSpan={2}>
                              <button
                                onClick={() => navigate(`/admin/intern/${record.internId}/records`)}
                                className="flex items-center text-cyan-400 hover:text-cyan-300 hover:bg-white/10 px-3 py-1 rounded-lg transition-colors"
                              >
                                <FaEye className="mr-2" />
                                View Records
                              </button>
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
      <style jsx="true" global="true">{`
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

export default AdminDailyRecords;