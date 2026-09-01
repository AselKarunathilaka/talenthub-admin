import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import {
  FaSearch,
  FaSort,
  FaExclamationTriangle,
  FaTasks,
  FaEye,
  FaTimes,
  FaRegClock,
} from "react-icons/fa";
import {
  FiUser,
  FiCalendar,
  FiCheckSquare,
  FiAlertTriangle,
  FiPlus,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { adminApi } from "../api/adminApi";

// Helper to format relative time
const getRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days} day${days !== 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  if (mins > 0) return `${mins} min${mins !== 1 ? "s" : ""} ago`;
  return "Just now";
};

const AdminInternRecords = () => {
  const { internId } = useParams();
  const navigate = useNavigate();

  const [internDetails, setInternDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // desc = newest first

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

  const filteredRecords = useMemo(() => {
    if (!internDetails?.records) return [];
    let filtered = [...internDetails.records];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.task?.toLowerCase().includes(q) ||
          r.progress?.toLowerCase().includes(q) ||
          r.blockers?.toLowerCase().includes(q) ||
          r.stack?.toLowerCase().includes(q),
      );
    }

    filtered.sort((a, b) => {
      const da = new Date(a.createdAt || a.date);
      const db = new Date(b.createdAt || b.date);
      return sortOrder === "desc" ? db - da : da - db;
    });

    return filtered;
  }, [internDetails, searchTerm, sortOrder]);

  const intern = internDetails?.intern || {};

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

  if (error) {
    return (
      <AdminNavigation>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="text-center max-w-md p-8 bg-white rounded-2xl border border-gray-100 shadow-sm">
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
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-7xl w-full">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight"
              >
                Logbook Records
              </motion.h1>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex-1 sm:w-64">
                  <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search records..."
                    className="w-full pl-11 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm shadow-sm transition-all"
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

                {/* Sort */}
                <motion.button
                  onClick={() => setSortOrder((o) => (o === "desc" ? "asc" : "desc"))}
                  className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-all shadow-sm hover:bg-gray-50"
                >
                  <FaSort className="text-blue-400 h-4 w-4" />
                  <span>{sortOrder === "desc" ? "Newest" : "Oldest"}</span>
                </motion.button>
              </div>
            </div>

            {/* Records Grid Layout */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              {filteredRecords.length === 0 ? (
                <motion.div
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-12 text-center col-span-full"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <h3 className="text-base font-semibold text-gray-500 mb-1">
                    No records found
                  </h3>
                  <p className="text-sm text-gray-400">
                    {searchTerm
                      ? "Try adjusting your search criteria."
                      : "This intern hasn't submitted any logbook entries yet."}
                  </p>
                </motion.div>
              ) : (
                filteredRecords.map((record, idx) => {
                  const taskText = record.task?.trim() || "No tasks completed in this task";
                  const challengesText =
                    record.progress?.trim() || "no challenges faced in this task";
                  const plansText =
                    record.blockers?.trim() || "No specific plans for tomorrow";

                  return (
                    <motion.div
                      key={record._id}
                      className="flex min-w-0 flex-col overflow-hidden bg-white transition-all duration-300 hover:bg-indigo-50"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                      style={{
                        borderRadius: 20,
                        border: "1.5px solid rgba(0, 180, 235, 0.2)",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
                      }}
                    >
                      <div className="flex-shrink-0 bg-gradient-to-r from-[#006600] to-[#000066] p-4 text-white md:p-5">
                        <div className="mb-3 flex items-center gap-2 md:gap-3">
                          <div className="rounded-lg bg-white/15 p-1.5 md:p-2 backdrop-blur-sm">
                            <FiUser className="flex-shrink-0 text-xs text-white md:text-sm" />
                          </div>
                          <span className="truncate text-sm font-semibold text-white md:text-base">
                            My Record
                          </span>
                        </div>

                        <div className="mt-3 flex flex-col gap-2 text-white/80 sm:flex-row sm:items-center sm:gap-3">
                          <span className="text-xs font-medium text-white/90 md:text-sm">
                            Trainee ID:
                          </span>
                          <span className="rounded-lg border border-white/10 bg-white/15 px-2 py-1 font-mono text-xs font-semibold text-white shadow-sm md:text-sm">
                            {intern.traineeId || intern.Trainee_ID || "No ID Available"}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-white/80">
                          <div className="flex items-center gap-2 text-xs md:text-sm">
                            <FiCalendar className="flex-shrink-0 text-white/70" />
                            <span className="truncate font-medium text-white/90">
                              {new Date(record.createdAt || record.date).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <div className="text-xs font-medium text-white/70 md:text-sm">
                            {getRelativeTime(record.createdAt || record.date)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col space-y-4 p-4 md:p-5">
                        <div className="mb-2 flex flex-wrap gap-2">
                          {record.stack && !(record.status === "leave" && record.stack === "On Leave") && (
                            <span className="inline-block rounded-full border border-blue-100 bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 md:px-3">
                              {record.stack}
                            </span>
                          )}
                          {record.status === "wfh" && (
                            <span className="inline-block rounded-full border border-purple-100 bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700 md:px-3">
                              Work From Home
                            </span>
                          )}
                          {record.status === "leave" && (
                            <span className="inline-block rounded-full border border-blue-100 bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 md:px-3">
                              On Leave
                            </span>
                          )}
                        </div>

                        <div className="space-y-2 md:space-y-3">
                          <h4 className="flex items-center gap-2 font-semibold text-gray-800 md:gap-3">
                            <div className="flex-shrink-0 rounded-lg bg-blue-100 p-1.5 md:p-2">
                              <FiCheckSquare className="flex-shrink-0 text-xs text-blue-600 md:text-sm" />
                            </div>
                            <span className="text-sm md:text-lg">Tasks Completed</span>
                          </h4>
                          <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 p-3 md:p-5">
                            <p className="overflow-wrap-anywhere whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-700 md:text-sm">
                              {taskText}
                            </p>
                          </div>
                        </div>

                        {record.progress && (
                          <div className="space-y-2 md:space-y-3">
                            <h4 className="flex items-center gap-2 font-semibold text-gray-800 md:gap-3">
                              <div className="flex-shrink-0 rounded-lg bg-amber-100 p-1.5 md:p-2">
                                <FiAlertTriangle className="flex-shrink-0 text-xs text-amber-600 md:text-sm" />
                              </div>
                              <span className="text-sm md:text-lg">Challenges Faced</span>
                            </h4>
                            <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100 p-3 md:p-5">
                              <p className="overflow-wrap-anywhere whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-700 md:text-sm">
                                {challengesText}
                              </p>
                            </div>
                          </div>
                        )}

                        {record.blockers && (
                          <div className="space-y-2 md:space-y-3">
                            <h4 className="flex items-center gap-2 font-semibold text-gray-800 md:gap-3">
                              <div className="flex-shrink-0 rounded-lg bg-emerald-100 p-1.5 md:p-2">
                                <FiPlus className="flex-shrink-0 text-xs text-emerald-600 md:text-sm" />
                              </div>
                              <span className="text-sm md:text-lg">Plans for Tomorrow</span>
                            </h4>
                            <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100 p-3 md:p-5">
                              <p className="overflow-wrap-anywhere whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-700 md:text-sm">
                                {plansText}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          </main>
        </div>
      </div>
    </AdminNavigation>
  );
};

export default AdminInternRecords;