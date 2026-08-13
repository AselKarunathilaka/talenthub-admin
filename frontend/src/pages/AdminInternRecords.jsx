import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import { BookOpen } from "lucide-react";
import {
  FaSearch,
  FaCalendarAlt,
  FaUser,
  FaSort,
  FaExclamationTriangle,
  FaRegClock,
  FaTasks,
  FaChartLine,
  FaFilter,
  FaTimes,
  FaRegSmile,
} from "react-icons/fa";
import { motion } from "framer-motion";
import { adminApi } from "../api/adminApi";

const AdminInternRecords = () => {
  const { internId } = useParams();
  const navigate = useNavigate();

  const [internDetails, setInternDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // desc = newest first
  const [filterPeriod, setFilterPeriod] = useState("all");

  useEffect(() => {
    fetchInternDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internId]);

  const fetchInternDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      if (!adminInfo.token) {
        navigate("/admin-login");
        return;
      }

      const data = await adminApi.getInternDetails(internId);
      setInternDetails(data);
    } catch (err) {
      console.error("Error fetching intern details:", err);
      setError("Failed to load intern records. Please try again.");
      if (err.message?.includes("403") || err.message?.includes("401")) {
        localStorage.removeItem("adminInfo");
        navigate("/admin-login");
      }
    } finally {
      setLoading(false);
    }
  };

  // Filtering / sorting logic
  const filteredRecords = useMemo(() => {
    if (!internDetails?.records) return [];

    let filtered = [...internDetails.records];

    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.task?.toLowerCase().includes(q) ||
          r.progress?.toLowerCase().includes(q) ||
          r.blockers?.toLowerCase().includes(q) ||
          r.date?.toLowerCase().includes(q) ||
          r.stack?.toLowerCase().includes(q),
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
      filtered = filtered.filter(
        (r) => new Date(r.createdAt) >= filterDate || new Date(r.date) >= filterDate,
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const da = new Date(a.createdAt || a.date);
      const db = new Date(b.createdAt || b.date);
      return sortOrder === "desc" ? db - da : da - db;
    });

    return filtered;
  }, [internDetails, searchTerm, sortOrder, filterPeriod]);

  const intern = internDetails?.intern || {};
  const totalRecords = internDetails?.records?.length || 0;

  // Status badge helper
  const statusBadgeClass = (s) =>
    ({
      working: "bg-green-100 text-green-700 border-green-200",
      wfh: "bg-blue-100 text-blue-700 border-blue-200",
      leave: "bg-orange-100 text-orange-700 border-orange-200",
      study_leave: "bg-sky-100 text-sky-700 border-sky-200",
    })[s] || "bg-gray-100 text-gray-600 border-gray-200";

  const statusLabel = (s) =>
    s === "wfh"
      ? "WFH"
      : s === "study_leave"
        ? "Extended Leave"
        : s
          ? s.charAt(0).toUpperCase() + s.slice(1)
          : "Working";

  // Loading Screen
  if (loading) {
    return (
      <AdminNavigation>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-t-4 border-b-4 border-[#00b4eb] rounded-full mx-auto mb-4"
            />
            <p className="text-gray-500 font-medium">Loading logbook records...</p>
          </div>
        </div>
      </AdminNavigation>
    );
  }

  // Error Screen
  if (error) {
    return (
      <AdminNavigation>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="text-center max-w-md p-8 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <FaExclamationTriangle className="text-4xl text-red-500 mb-4 mx-auto" />
            <p className="text-gray-700 mb-6">{error}</p>
            <div className="flex justify-center">
              <motion.button
                onClick={fetchInternDetails}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-xl shadow-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Retry
              </motion.button>
            </div>
          </div>
        </div>
      </AdminNavigation>
    );
  }

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
                    <BookOpen className="text-[#0056a2] h-8 w-8" />
                  </div>
                  Logbook Records
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="text-gray-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
                >
                  {intern.traineeName || intern.Trainee_Name || "Intern"} —{" "}
                  {intern.traineeId || intern.Trainee_ID || "N/A"}
                </motion.p>
              </div>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.2 }}
                className="bg-white rounded-3xl shadow-sm border border-gray-100 p-3 flex flex-wrap items-center gap-3"
              >
                <div className="flex-1 min-w-[180px] bg-slate-50 rounded-2xl p-3 flex items-center gap-3 border border-slate-100">
                  <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                    <FaUser className="text-[#00b4eb] h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                      Trainee
                    </p>
                    <p className="text-sm font-bold text-gray-800 truncate">
                      {intern.traineeName || intern.Trainee_Name || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="w-32 text-center p-3 bg-blue-50/80 rounded-2xl border border-blue-100">
                  <div className="text-2xl font-black text-cyan-600 leading-none mb-1">
                    {totalRecords}
                  </div>
                  <div className="text-[10px] font-bold text-blue-500/80 uppercase tracking-wider">
                    Total Records
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Search / Filter Bar */}
            <motion.div
              className="bg-white p-4 md:p-6 rounded-3xl border border-gray-100 shadow-sm mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between space-y-3 lg:space-y-0 lg:space-x-4">
                <div className="flex-1">
                  <label
                    htmlFor="search-input"
                    className="block text-sm font-bold text-gray-700 mb-2"
                  >
                    Search Records
                  </label>
                  <div className="relative flex-1">
                    <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      id="search-input"
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search tasks, challenges, plans, stack..."
                      className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent text-gray-900 text-sm shadow-sm transition-all"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-white p-1 rounded-full shadow-sm"
                      >
                        <FaTimes className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex items-center space-x-2 bg-slate-50 border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                    <FaFilter className="text-blue-400 h-4 w-4" />
                    <select
                      value={filterPeriod}
                      onChange={(e) => setFilterPeriod(e.target.value)}
                      className="bg-transparent text-sm font-bold text-gray-700 focus:outline-none cursor-pointer"
                    >
                      <option value="all">All Time</option>
                      <option value="week">Last Week</option>
                      <option value="month">Last Month</option>
                      <option value="3months">Last 3 Months</option>
                    </select>
                  </div>

                  <motion.button
                    onClick={() =>
                      setSortOrder((o) => (o === "desc" ? "asc" : "desc"))
                    }
                    className="flex items-center space-x-2 px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-2xl text-sm font-bold transition-all shadow-sm hover:bg-gray-50"
                  >
                    <FaSort className="text-blue-400 h-4 w-4" />
                    <span>{sortOrder === "desc" ? "↓ Newest" : "↑ Oldest"}</span>
                  </motion.button>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-3 font-medium flex items-center">
                <FaRegSmile className="mr-1.5 text-amber-500" />
                Showing {filteredRecords.length} of {totalRecords} records
                {searchTerm && " · filtered by search"}
              </p>
            </motion.div>

            {/* Records Table */}
            <motion.div
              className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              {/* Table title bar */}
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/80">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                    All Submissions —{" "}
                    <span className="text-blue-600">
                      {intern.traineeName || intern.Trainee_Name || "Intern"}
                    </span>
                  </h2>
                  <p className="text-sm text-gray-500 font-medium mt-0.5">
                    {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""} shown
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="relative min-h-[300px]">
                {!loading && filteredRecords.length === 0 ? (
                  <motion.div
                    className="text-center py-16 px-4"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <FaCalendarAlt className="mx-auto h-12 w-12 text-gray-200 mb-4" />
                    </motion.div>
                    <h3 className="text-base font-semibold text-gray-500 mb-1">
                      No records found
                    </h3>
                    <p className="text-sm text-gray-400">
                      {searchTerm || filterPeriod !== "all"
                        ? "Try adjusting your search or filter criteria."
                        : "This intern hasn't submitted any logbook entries yet."}
                    </p>
                  </motion.div>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="block lg:hidden divide-y divide-gray-100">
                      {filteredRecords.map((record, idx) => {
                        const status = record.status || "working";
                        return (
                          <motion.div
                            key={record._id}
                            className="p-4 hover:bg-gray-50/60 transition-colors"
                            whileHover={{ y: -1 }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 flex items-center justify-center shadow-sm flex-shrink-0">
                                  <FaCalendarAlt className="text-blue-600 h-4 w-4" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {idx + 1}.{" "}
                                    {new Date(record.date).toLocaleDateString(
                                      "en-US",
                                      {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      },
                                    )}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    <FaRegClock className="inline mr-1" />
                                    {new Date(record.createdAt).toLocaleString(
                                      "en-US",
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusBadgeClass(status)}`}
                              >
                                {statusLabel(status)}
                              </span>
                            </div>

                            {record.stack &&
                              !(
                                record.status === "leave" &&
                                record.stack === "On Leave"
                              ) && (
                                <span className="inline-block mb-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                  {record.stack}
                                </span>
                              )}

                            {record.task && (
                              <p className="text-xs text-gray-700 line-clamp-2 mt-1">
                                <FaChartLine className="inline mr-1 text-blue-500" />
                                {record.task}
                              </p>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/80 border-b border-gray-100">
                          <tr>
                            {["#", "Date", "Stack", "Status", "Tasks Completed", "Submitted At"].map(
                              (h) => (
                                <th
                                  key={h}
                                  className="px-6 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs"
                                >
                                  {h}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filteredRecords.map((record, idx) => {
                            const status = record.status || "working";
                            return (
                              <motion.tr
                                key={record._id}
                                className="hover:bg-slate-50/50 transition-colors group align-top"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.02 }}
                              >
                                <td className="px-6 py-4 text-sm text-gray-400 w-12">
                                  {idx + 1}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 flex items-center justify-center shadow-sm flex-shrink-0">
                                      <FaCalendarAlt className="text-blue-600" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">
                                        {new Date(record.date).toLocaleDateString(
                                          "en-US",
                                          {
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                          },
                                        )}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {new Date(record.date).toLocaleDateString(
                                          "en-US",
                                          { weekday: "long" },
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {record.stack &&
                                  !(
                                    record.status === "leave" &&
                                    record.stack === "On Leave"
                                  ) ? (
                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                      {record.stack}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-xs">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass(status)}`}
                                  >
                                    {statusLabel(status)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 max-w-md">
                                  {record.task ? (
                                    <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
                                      {record.task}
                                    </p>
                                  ) : (
                                    <span className="text-gray-400 text-xs">
                                      No task info
                                    </span>
                                  )}

                                  {record.progress &&
                                    record.progress !== "No challenges faced" && (
                                      <p className="mt-2 text-xs text-green-700 bg-green-50/60 border-l-2 border-green-400 px-2 py-1 rounded-r">
                                        <strong>Challenges:</strong> {record.progress}
                                      </p>
                                    )}
                                  {record.blockers &&
                                    record.blockers !== "No specific plans" && (
                                      <p className="mt-1 text-xs text-amber-700 bg-amber-50/60 border-l-2 border-amber-400 px-2 py-1 rounded-r">
                                        <strong>Plans:</strong> {record.blockers}
                                      </p>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(record.createdAt).toLocaleString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </main>
        </div>
      </div>
    </AdminNavigation>
  );
};

export default AdminInternRecords;