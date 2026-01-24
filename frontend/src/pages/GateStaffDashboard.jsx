import React, { useState, useEffect } from "react";
import {
  LogOut,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Clock,
  User,
  Shield,
} from "lucide-react";
import { motion } from "framer-motion";
import { API_BASE_URL } from "../api/apiConfig";
import logo from "../assets/sltlogo.jpg";

export default function GateStaffDashboard() {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [searchId, setSearchId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterMode, setFilterMode] = useState("date"); // "date" or "all"
  const itemsPerPage = 10;

  useEffect(() => {
    fetchLeaveRequests();
  }, [selectedDate, filterMode]);

  const fetchLeaveRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        window.location.href = "/gate-staff-login";
        return;
      }

      let url;
      if (filterMode === "date" && selectedDate) {
        url = `${API_BASE_URL}/gate-staff/approved-leaves/by-date/${selectedDate}`;
      } else {
        url = `${API_BASE_URL}/gate-staff/approved-leaves`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("token");
          window.location.href = "/gate-staff-login";
          return;
        }
        throw new Error(`Failed to fetch leave requests: ${response.status}`);
      }

      const data = await response.json();
      setLeaveRequests(data);
    } catch (error) {
      console.error("Error fetching leave requests:", error);
      setError("Failed to load leave requests. Please try again.");
      setLeaveRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = leaveRequests;

    if (searchId.trim()) {
      const searchTerm = searchId.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          req.internId?.toLowerCase().includes(searchTerm) ||
          req.name?.toLowerCase().includes(searchTerm) ||
          req.nationalId?.toLowerCase().includes(searchTerm),
      );
    }

    setFilteredRequests(filtered);
    setCurrentPage(1);
  }, [searchId, leaveRequests]);

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequests = filteredRequests.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("gateStaffInfo");
    window.location.href = "/gate-staff-login";
  };

  const formatTime = (startTime, endTime) => {
    if (!startTime || startTime === "00:00") return "N/A";

    try {
      const [sh, sm] = startTime.split(":");
      const startDate = new Date();
      startDate.setHours(parseInt(sh), parseInt(sm));

      let endStr = "";
      if (endTime && endTime !== "00:00") {
        const [eh, em] = endTime.split(":");
        const endDate = new Date();
        endDate.setHours(parseInt(eh), parseInt(em));
        endStr = ` – ${endDate.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}`;
      }

      return startDate
        .toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        .replace(/^0+/, "");
    } catch (e) {
      return `${startTime || "N/A"} ${endTime ? `– ${endTime}` : ""}`;
    }
  };

  const clearFilters = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
    setSearchId("");
    setFilterMode("date");
  };

  const handleViewAllLeaves = () => {
    setFilterMode("all");
    setSelectedDate("");
  };

  const handleViewByDate = () => {
    setFilterMode("date");
    setSelectedDate(new Date().toISOString().split("T")[0]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
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
      </div>

      {/* Enhanced Header */}
      <motion.header
        className="bg-white/80 backdrop-blur-md shadow-sm fixed top-0 left-0 right-0 z-30 h-[4.5rem] sm:h-[5.5rem] border-b border-gray-100"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
      >
        <div className="flex items-center justify-between h-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
            <motion.div
              className="flex items-center space-x-2 sm:space-x-4"
              whileHover={{ scale: 1.02 }}
            >
              <motion.img
                src={logo}
                alt="SLT Logo"
                className="h-8 sm:h-10 w-auto rounded-lg border border-gray-200 flex-shrink-0 shadow-sm"
                whileHover={{ rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-sm sm:text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600 truncate">
                  Gate Staff Portal
                </span>
                <span className="text-xs sm:text-sm text-gray-600 truncate">
                  Approved Short Leave Requests
                </span>
              </div>
            </motion.div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            <div className="hidden md:flex items-center space-x-3 mr-4 p-2 bg-gray-50 rounded-xl">
              <motion.div
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 flex items-center justify-center border border-gray-200 shadow-sm"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </motion.div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">Welcome,</span>
                <span className="text-sm font-medium text-gray-800">
                  Gate Staff
                </span>
              </div>
            </div>

            <motion.button
              onClick={fetchLeaveRequests}
              disabled={loading}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: loading ? 1 : 1.05 }}
              whileTap={{ scale: loading ? 1 : 0.95 }}
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline text-sm">Refresh</span>
            </motion.button>

            <motion.button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl hover:from-red-600 hover:to-orange-600 transition-all duration-200 shadow-sm hover:shadow-md border border-red-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogOut size={18} />
              <span className="hidden sm:inline text-sm">Logout</span>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="pt-[4.5rem] sm:pt-[5.5rem]">
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Error Message */}
            {error && (
              <motion.div
                className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-xl shadow-sm"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <p className="text-sm text-red-700">{error}</p>
              </motion.div>
            )}

            {/* View Mode Toggle */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 sm:p-6 mb-6 border border-gray-100"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Filter size={18} className="text-blue-600" />
                  View Mode:
                </span>
                <div className="flex gap-2 flex-wrap">
                  <motion.button
                    onClick={handleViewByDate}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm ${
                      filterMode === "date"
                        ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Calendar size={16} className="inline mr-2" />
                    By Date
                  </motion.button>
                  <motion.button
                    onClick={handleViewAllLeaves}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm ${
                      filterMode === "all"
                        ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    All Leaves
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Filters Section */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-6 mb-6 border border-gray-100"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Filter size={20} className="text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Filters
                  </h2>
                </div>
                {(filterMode === "all" || searchId) && (
                  <motion.button
                    onClick={clearFilters}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Clear Filters
                  </motion.button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar size={16} className="inline mr-2 text-blue-600" />
                    Leave Date{" "}
                    {filterMode === "date" && (
                      <span className="text-red-500">*</span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      if (e.target.value) setFilterMode("date");
                    }}
                    disabled={filterMode === "all"}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed shadow-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Search size={16} className="inline mr-2 text-blue-600" />
                    Search by ID, Name or NIC
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Intern ID / Name / National ID..."
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all"
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Results Info */}
            <motion.div
              className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="text-sm text-gray-600 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                Showing{" "}
                <span className="font-semibold text-blue-600">
                  {paginatedRequests.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-blue-600">
                  {filteredRequests.length}
                </span>{" "}
                requests
              </div>
              {filterMode === "date" && selectedDate && (
                <div className="text-sm text-gray-500 flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                  <Calendar size={14} className="text-blue-600" />
                  {new Date(selectedDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              )}
            </motion.div>

            {/* Table Section */}
            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden border border-gray-100"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {loading ? (
                <div className="p-12 text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-16 h-16 border-t-4 border-b-4 border-blue-500 rounded-full mx-auto mb-4"
                  />
                  <p className="text-gray-500">Loading leave requests...</p>
                </div>
              ) : paginatedRequests.length === 0 ? (
                <div className="p-12 text-center">
                  <Search size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No leave requests found
                  </h3>
                  <p className="text-gray-500">
                    {searchId
                      ? "No matching records — try different search terms"
                      : filterMode === "date"
                        ? "No approved leaves for selected date"
                        : "No approved leave requests available"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          National ID
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Trainee ID
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {paginatedRequests.map((request, index) => (
                        <motion.tr
                          key={request.id}
                          className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.01 }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-blue-500" />
                              {new Date(request.leaveDate).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1 rounded-lg inline-flex">
                              <Clock size={14} className="text-blue-600" />
                              <span className="font-medium">
                                {formatTime(request.startTime, request.endTime)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                            {request.nationalId || "—"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 flex items-center justify-center">
                                <User size={14} className="text-blue-600" />
                              </div>
                              <span className="font-medium">
                                {request.name || "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                            {request.internId || "—"}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>

            {/* Pagination */}
            {totalPages > 1 && (
              <motion.div
                className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-gray-100"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="text-sm text-gray-600">
                  Page{" "}
                  <span className="font-semibold text-blue-600">
                    {currentPage}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-blue-600">
                    {totalPages}
                  </span>
                </div>
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white hover:border-transparent disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gray-900 flex items-center gap-1 transition-all shadow-sm"
                    whileHover={{ scale: currentPage === 1 ? 1 : 1.05 }}
                    whileTap={{ scale: currentPage === 1 ? 1 : 0.95 }}
                  >
                    <ChevronLeft size={16} />
                    Prev
                  </motion.button>
                  <motion.button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white hover:border-transparent disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gray-900 flex items-center gap-1 transition-all shadow-sm"
                    whileHover={{
                      scale: currentPage === totalPages ? 1 : 1.05,
                    }}
                    whileTap={{ scale: currentPage === totalPages ? 1 : 0.95 }}
                  >
                    Next
                    <ChevronRight size={16} />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
