import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  FaUser,
  FaCalendarAlt,
  FaArrowLeft,
  FaExclamationTriangle,
  FaSearch,
  FaFilter,
  FaSort,
  FaTasks,
  FaEye,
  FaShieldAlt,
  FaRegSmile,
  FaRegClock,
  FaChartLine,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../api/adminApi";
import logo from "../assets/sltlogo.jpg";

const AdminInternRecords = () => {
  const { internId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [internDetails, setInternDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [filterPeriod, setFilterPeriod] = useState("all");

  useEffect(() => {
    fetchInternDetails();
  }, [internId]);

  const fetchInternDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check admin authentication
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      if (!adminInfo.token) {
        navigate("/admin-login");
        return;
      }

      const data = await adminApi.getInternDetails(internId);
      setInternDetails(data);
    } catch (error) {
      console.error("Error fetching intern details:", error);
      setError("Failed to load intern records");

      if (error.message.includes("403") || error.message.includes("401")) {
        localStorage.removeItem("adminInfo");
        navigate("/admin-login");
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
      filtered = filtered.filter(
        (record) =>
          record.task?.toLowerCase().includes(searchLower) ||
          record.progress?.toLowerCase().includes(searchLower) ||
          record.blockers?.toLowerCase().includes(searchLower) ||
          record.date?.toLowerCase().includes(searchLower),
      );
    }

    // Period filter
    if (filterPeriod !== "all") {
      const now = new Date();
      const filterDate = new Date();

      switch (filterPeriod) {
        case "week":
          filterDate.setDate(now.getDate() - 7);
          break;
        case "month":
          filterDate.setDate(now.getDate() - 30);
          break;
        case "3months":
          filterDate.setDate(now.getDate() - 90);
          break;
        default:
          break;
      }

      if (filterPeriod !== "all") {
        filtered = filtered.filter(
          (record) => new Date(record.createdAt) >= filterDate,
        );
      }
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date":
          return new Date(b.createdAt) - new Date(a.createdAt);
        case "dateOld":
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-t-4 border-b-4 border-green-500 rounded-full mx-auto mb-6"
          />
          <p className="text-gray-600 font-medium">Loading intern records...</p>
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
              onClick={fetchInternDetails}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white rounded-xl transition-all shadow-md hover:shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Retry
            </motion.button>
            <motion.button
              onClick={() => navigate("/admin/dashboard")}
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

  const { intern } = internDetails;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-gray-800 overflow-hidden">
      {/* Enhanced floating background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-80 h-80 rounded-full bg-blue-100/40 -top-20 -left-20"
          animate={{
            y: [0, -30, 0],
            x: [0, 20, 0],
            rotate: [0, 5, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-cyan-100/40 top-1/4 right-0"
          animate={{
            y: [0, 20, 0],
            x: [0, -20, 0],
            rotate: [0, -5, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />
        <motion.div
          className="absolute w-64 h-64 rounded-full bg-green-100/40 bottom-20 left-1/4"
          animate={{
            y: [0, -20, 0],
            x: [0, 15, 0],
            rotate: [0, 3, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
        <motion.div
          className="absolute w-72 h-72 rounded-full bg-purple-100/40 bottom-0 right-20"
          animate={{
            y: [0, 25, 0],
            x: [0, -15, 0],
            rotate: [0, -3, 0],
          }}
          transition={{
            duration: 17,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 3,
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
                navigate("/admin-login");
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
                <span className="text-sm sm:text-lg font-semibold text-gray-900 truncate">
                  SLT Admin Portal
                </span>
                <span className="text-xs sm:text-sm text-gray-600 truncate">
                  Intern Records
                </span>
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
                <span className="text-sm font-medium text-gray-800">
                  Administrator
                </span>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                localStorage.removeItem("adminInfo");
                navigate("/admin-login");
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
                  onClick={() => {
                    if (location.state?.from === "daily-records") {
                      navigate("/admin/daily-records");
                    } else {
                      navigate(`/admin/intern/${internId}`);
                    }
                  }}
                  className="flex items-center px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all border border-gray-200 shadow-sm hover:shadow-md"
                  whileHover={{ x: -3 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FaArrowLeft className="mr-2" />
                  {location.state?.from === "daily-records"
                    ? "Back to Daily Records"
                    : "Back to Details"}
                </motion.button>
                <div>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">
                      Logbook Records
                    </span>
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600">
                    {intern?.traineeName} - {intern?.traineeId}
                  </p>
                </div>
              </div>
              <motion.div
                className="text-left sm:text-right w-full sm:w-auto bg-white/80 backdrop-blur-sm p-3 rounded-2xl border border-gray-100 shadow-sm"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <p className="text-xs sm:text-sm text-gray-500">
                  Total Records
                </p>
                <p className="text-xl sm:text-2xl font-bold text-cyan-600">
                  {internDetails?.records?.length || 0}
                </p>
              </motion.div>
            </motion.div>

            {/* Search and Filter Controls */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm p-4 sm:p-5 lg:p-6 rounded-2xl border border-gray-100 shadow-sm mb-4 sm:mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <div className="flex flex-col space-y-3 sm:space-y-4 xl:flex-row xl:space-y-0 xl:space-x-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <motion.input
                      type="text"
                      placeholder="Search in tasks, progress, and blockers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 shadow-sm"
                      whileFocus={{ scale: 1.01 }}
                    />
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                  {/* Period Filter */}
                  <motion.div
                    className="flex items-center space-x-2 bg-white p-2 rounded-xl border border-gray-200 shadow-sm"
                    whileHover={{ y: -2 }}
                  >
                    <FaFilter className="text-blue-500 h-4 w-4 flex-shrink-0" />
                    <select
                      value={filterPeriod}
                      onChange={(e) => setFilterPeriod(e.target.value)}
                      className="px-3 py-1.5 text-sm sm:text-base bg-transparent border-0 focus:ring-0 focus:outline-none text-gray-900 flex-1 sm:flex-none"
                    >
                      <option value="all" className="bg-white">
                        All Time
                      </option>
                      <option value="week" className="bg-white">
                        Last Week
                      </option>
                      <option value="month" className="bg-white">
                        Last Month
                      </option>
                      <option value="3months" className="bg-white">
                        Last 3 Months
                      </option>
                    </select>
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
                      <option value="date" className="bg-white">
                        Newest First
                      </option>
                      <option value="dateOld" className="bg-white">
                        Oldest First
                      </option>
                    </select>
                  </motion.div>
                </div>
              </div>
              <motion.p
                className="text-xs sm:text-sm text-gray-500 mt-2 sm:mt-3 flex items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <FaRegSmile className="mr-1.5 text-amber-500" />
                Showing {filteredRecords.length} of{" "}
                {internDetails?.records?.length || 0} records
              </motion.p>
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
                    className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 lg:p-12 text-center"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      animate={{
                        y: [0, -10, 0],
                        rotate: [0, 5, 0],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <FaTasks className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mb-3 sm:mb-4" />
                    </motion.div>
                    <h3 className="text-base sm:text-lg font-medium text-gray-700 mb-2">
                      No records found
                    </h3>
                    <p className="text-sm sm:text-base text-gray-500">
                      {searchTerm || filterPeriod !== "all"
                        ? "Try adjusting your search or filter criteria."
                        : "This intern hasn't submitted any logbook entries yet."}
                    </p>
                  </motion.div>
                ) : (
                  filteredRecords.map((record, index) => (
                    <motion.div
                      key={record._id}
                      className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 overflow-hidden"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      whileHover={{
                        y: -3,
                        boxShadow:
                          "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                      }}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-3">
                        <div className="flex items-start sm:items-center space-x-3 flex-1 min-w-0">
                          <motion.div
                            className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 flex items-center justify-center flex-shrink-0 shadow-sm"
                            whileHover={{ scale: 1.1, rotate: 5 }}
                          >
                            <FaCalendarAlt className="text-blue-600 text-sm sm:text-base" />
                          </motion.div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                              {new Date(record.date).toLocaleDateString(
                                "en-US",
                                {
                                  weekday:
                                    window.innerWidth < 640 ? "short" : "long",
                                  year: "numeric",
                                  month:
                                    window.innerWidth < 640 ? "short" : "long",
                                  day: "numeric",
                                },
                              )}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-500 flex items-center">
                              <FaRegClock className="mr-1.5 text-gray-400" />
                              Submitted:{" "}
                              {new Date(record.createdAt).toLocaleDateString()}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-1 sm:mt-2">
                              {/* Show stack only if it's not "On Leave" when status is leave */}
                              {record.stack &&
                                !(
                                  record.status === "leave" &&
                                  record.stack === "On Leave"
                                ) && (
                                  <motion.span
                                    className="inline-block px-2 sm:px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800"
                                    whileHover={{ scale: 1.05 }}
                                  >
                                    {record.stack}
                                  </motion.span>
                                )}

                              {/* Show status badge for Work From Home */}
                              {record.status === "wfh" && (
                                <motion.span
                                  className="inline-block px-2 sm:px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800"
                                  whileHover={{ scale: 1.05 }}
                                >
                                  Work From Home
                                </motion.span>
                              )}
                              {/* Show status badge for On Leave */}
                              {record.status === "leave" && (
                                <motion.span
                                  className="inline-block px-2 sm:px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800"
                                  whileHover={{ scale: 1.05 }}
                                >
                                  On Leave
                                </motion.span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                          <motion.span
                            className="inline-flex items-center px-2 sm:px-2.5 py-1 sm:py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 shadow-sm"
                            whileHover={{ scale: 1.05 }}
                          >
                            <FaTasks className="mr-1" />
                            Daily Record
                          </motion.span>
                        </div>
                      </div>

                      {/* Record Details */}
                      <div className="space-y-3 sm:space-y-4">
                        {/* Task */}
                        {record.task && (
                          <motion.div
                            className="border-l-4 border-blue-400 pl-3 sm:pl-4 py-2 bg-blue-50/50 rounded-r-lg"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                          >
                            <h4 className="font-medium text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base flex items-center">
                              <FaChartLine className="mr-2 text-blue-500" />
                              Tasks Completed
                            </h4>
                            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                              {record.task}
                            </p>
                          </motion.div>
                        )}

                        {/* Progress */}
                        {record.progress &&
                          record.progress !== "No challenges faced" && (
                            <motion.div
                              className="border-l-4 border-green-400 pl-3 sm:pl-4 py-2 bg-green-50/50 rounded-r-lg"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.2 }}
                            >
                              <h4 className="font-medium text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base flex items-center">
                                <FaExclamationTriangle className="mr-2 text-green-500" />
                                Challenges Faced
                              </h4>
                              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                                {record.progress}
                              </p>
                            </motion.div>
                          )}

                        {/* Blockers */}
                        {record.blockers &&
                          record.blockers !== "No specific plans" && (
                            <motion.div
                              className="border-l-4 border-amber-400 pl-3 sm:pl-4 py-2 bg-amber-50/50 rounded-r-lg"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.3 }}
                            >
                              <h4 className="font-medium text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base flex items-center">
                                <FaEye className="mr-2 text-amber-500" />
                                Plans for Tomorrow
                              </h4>
                              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                                {record.blockers}
                              </p>
                            </motion.div>
                          )}
                      </div>

                      {!record.task &&
                        (!record.progress ||
                          record.progress === "No challenges faced") &&
                        (!record.blockers ||
                          record.blockers === "No specific plans") && (
                          <motion.div
                            className="text-center py-3 sm:py-4 text-gray-500 bg-gray-50/50 rounded-lg mt-3"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                          >
                            <FaExclamationTriangle className="mx-auto h-6 w-6 sm:h-8 sm:w-8 mb-2 text-gray-400" />
                            <p className="text-xs sm:text-sm">
                              No detailed information available for this record
                            </p>
                          </motion.div>
                        )}
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminInternRecords;
