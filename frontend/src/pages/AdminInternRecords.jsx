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
                      className="overflow-hidden rounded-[20px] border border-[#dfe8ee] bg-white shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                    >
                      <div className="bg-gradient-to-r from-[#083f4e] via-[#0f4967] to-[#0a4462] px-4 py-3 text-white">
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/10">
                            <FaEye className="text-[11px]" />
                          </div>
                          <h3 className="text-lg font-bold leading-none">My Record</h3>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-sm text-white/90">
                          <span>
                            Trainee ID: <span className="font-bold text-white">{intern.traineeId || intern.Trainee_ID || "N/A"}</span>
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-2 text-[11px] text-white/80">
                          <FaRegClock className="text-[10px]" />
                          <span>{getRelativeTime(record.createdAt)}</span>
                        </div>
                      </div>

                      <div className="bg-[#edf3f6] p-4">
                        <div className="mb-4 flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-full border border-[#d0e1f9] bg-[#dfeefa] px-3 py-1 text-[11px] font-semibold text-[#2a4f7d]">
                            {record.stack || "Full-stack Development"}
                          </span>
                          {record.status === "wfh" && (
                            <span className="inline-flex items-center rounded-full border border-[#ddd2ff] bg-[#ece3ff] px-3 py-1 text-[11px] font-semibold text-[#5d4ec4]">
                              Work From Home
                            </span>
                          )}
                          {record.status === "leave" && (
                            <span className="inline-flex items-center rounded-full border border-[#ffd9d9] bg-[#ffe9e9] px-3 py-1 text-[11px] font-semibold text-[#b93d3d]">
                              On Leave
                            </span>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="rounded-xl border border-[#d9e6f2] bg-[#dfeaf8] px-3 py-2.5">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                              <FaTasks className="text-xs text-[#4d75f2]" />
                              <span>Tasks Completed</span>
                            </div>
                            <div className="text-sm leading-relaxed text-gray-700">
                              {taskText}
                            </div>
                          </div>

                          <div className="rounded-xl border border-[#f0df9f] bg-[#f9f0c9] px-3 py-2.5">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                              <FaExclamationTriangle className="text-[11px] text-[#d18a00]" />
                              <span>Challenges Faced</span>
                            </div>
                            <div className="text-sm leading-relaxed text-gray-700">
                              {challengesText}
                            </div>
                          </div>

                          <div className="rounded-xl border border-[#bfe7d1] bg-[#d9f0e2] px-3 py-2.5">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                              <FaEye className="text-[11px] text-[#1f9c69]" />
                              <span>Plans for Tomorrow</span>
                            </div>
                            <div className="text-sm leading-relaxed text-gray-700">
                              {plansText}
                            </div>
                          </div>
                        </div>
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