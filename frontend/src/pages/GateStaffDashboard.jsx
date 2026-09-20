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
import Layout from "../components/Layout";

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

  const customActions = (
    <motion.button
      onClick={fetchLeaveRequests}
      disabled={loading}
      className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-[#00b4eb] to-[#0056a2] text-white rounded-xl hover:from-[#00a0d2] hover:to-[#004785] transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold"
      whileHover={{ scale: loading ? 1 : 1.05 }}
      whileTap={{ scale: loading ? 1 : 0.95 }}
    >
      <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
      <span className="hidden sm:inline">Refresh</span>
    </motion.button>
  );

  const userData = {
    name: "Gate Staff",
    role: "Gate Security",
  };

  return (
    <Layout
      navLinks={[]}
      user={userData}
      onLogout={handleLogout}
      activeTitle="Gate Staff Portal"
      customActions={customActions}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Error Message */}
        {error && (
          <motion.div
            className="bg-red-50 border-l-4 border-red-400 p-4 rounded-xl shadow-sm"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <p className="text-sm text-red-700">{error}</p>
          </motion.div>
        )}

        {/* View Mode Toggle */}
        <motion.div
          className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Filter size={18} className="text-[#00b4eb]" />
              View Mode:
            </span>
            <div className="flex gap-2 flex-wrap">
              <motion.button
                onClick={handleViewByDate}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 shadow-sm ${
                  filterMode === "date"
                    ? "bg-gradient-to-r from-[#00b4eb] to-blue-600 text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Calendar size={16} className="inline mr-2" />
                By Date
              </motion.button>
              <motion.button
                onClick={handleViewAllLeaves}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 shadow-sm ${
                  filterMode === "all"
                    ? "bg-gradient-to-r from-[#00b4eb] to-blue-600 text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
          className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm p-6 border border-gray-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter size={20} className="text-[#00b4eb]" />
              <h2 className="text-lg font-bold text-slate-800">
                Filters
              </h2>
            </div>
            {(filterMode === "all" || searchId) && (
              <motion.button
                onClick={clearFilters}
                className="text-sm text-[#00b4eb] hover:text-blue-700 font-bold"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Clear Filters
              </motion.button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                <Calendar size={16} className="inline mr-2 text-[#00b4eb]" />
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
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed shadow-sm transition-all text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                <Search size={16} className="inline mr-2 text-[#00b4eb]" />
                Search by ID, Name or NIC
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Intern ID / Name / National ID..."
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent shadow-sm transition-all text-sm font-medium"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Results Info */}
        <motion.div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="text-sm font-medium text-slate-600 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-slate-100">
            Showing{" "}
            <span className="font-bold text-[#00b4eb]">
              {paginatedRequests.length}
            </span>{" "}
            of{" "}
            <span className="font-bold text-[#00b4eb]">
              {filteredRequests.length}
            </span>{" "}
            requests
          </div>
          {filterMode === "date" && selectedDate && (
            <div className="text-sm font-medium text-slate-600 flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl shadow-sm border border-slate-100">
              <Calendar size={14} className="text-[#00b4eb]" />
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
          className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm overflow-hidden border border-slate-200"
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
                className="w-16 h-16 border-t-4 border-b-4 border-[#00b4eb] rounded-full mx-auto mb-4"
              />
              <p className="text-slate-500 font-bold">Loading leave requests...</p>
            </div>
          ) : paginatedRequests.length === 0 ? (
            <div className="p-12 text-center">
              <Search size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                No leave requests found
              </h3>
              <p className="text-slate-500 font-medium">
                {searchId
                  ? "No matching records — try different search terms"
                  : filterMode === "date"
                    ? "No approved leaves for selected date"
                    : "No approved leave requests available"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      National ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Trainee ID
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-50">
                  {paginatedRequests.map((request, index) => (
                    <motion.tr
                      key={request.id}
                      className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.01 }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-[#00b4eb]" />
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">
                        <div className="flex items-center gap-1.5 bg-blue-50/50 border border-blue-100 px-3 py-1 rounded-lg inline-flex">
                          <Clock size={14} className="text-[#00b4eb]" />
                          <span className="font-bold text-slate-700">
                            {formatTime(request.startTime, request.endTime)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-bold">
                        {request.nationalId || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center border border-blue-200">
                            <User size={14} className="text-blue-600" />
                          </div>
                          <span className="font-bold text-slate-700">
                            {request.name || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600 bg-blue-50/30 rounded-r-2xl">
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
            className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-slate-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="text-sm font-medium text-slate-600">
              Page{" "}
              <span className="font-bold text-[#00b4eb]">
                {currentPage}
              </span>{" "}
              of{" "}
              <span className="font-bold text-[#00b4eb]">
                {totalPages}
              </span>
            </div>
            <div className="flex gap-2">
              <motion.button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white hover:border-transparent disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:border-slate-200 flex items-center gap-1 transition-all shadow-sm font-bold text-sm"
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
                className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-gradient-to-r hover:from-blue-500 hover:to-cyan-500 hover:text-white hover:border-transparent disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:border-slate-200 flex items-center gap-1 transition-all shadow-sm font-bold text-sm"
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
    </Layout>
  );
}
