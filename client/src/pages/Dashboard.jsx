import React, { useEffect, useMemo, useState } from "react";
import { fetchInterns } from "../api/internApi";
import DashboardCard from "../components/DashboardCard";
import Layout from "../components/Layout";
import {
  Users,
  CheckCircle,
  XCircle,
  WifiOff,
  Clock,
  Calendar,
  LayoutDashboardIcon,
} from "lucide-react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { motion } from "framer-motion";
import Loader from "../components/Loader";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const STORAGE_KEY = "frontendAttendanceStateByDate";
const getTodayDate = () => new Date().toISOString().split("T")[0];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, when: "beforeChildren" },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

const Dashboard = () => {
  const [internCount, setInternCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [activeTab, setActiveTab] = useState("daily");
  const [frontendState, setFrontendState] = useState({});

  const today = getTodayDate();

  const loadDashboardBase = async () => {
    try {
      setLoading(true);
      setError(null);
      setIsNetworkError(false);

      const interns = await fetchInterns();
      setInternCount(Array.isArray(interns) ? interns.length : 0);

      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        setFrontendState(saved ? JSON.parse(saved) : {});
      } catch (storageError) {
        console.error("Failed to read frontend attendance state:", storageError);
        setFrontendState({});
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);
      setError(error.message || "Error fetching dashboard data.");
      if (
        !navigator.onLine ||
        String(error.message || "").toLowerCase().includes("network") ||
        error.name === "TypeError"
      ) {
        setIsNetworkError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardBase();

    const handleFocus = () => {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        setFrontendState(saved ? JSON.parse(saved) : {});
      } catch (storageError) {
        console.error("Failed to reload frontend attendance state:", storageError);
      }
    };

    const handleStorageLikeUpdate = () => {
      handleFocus();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("attendance-frontend-state-changed", handleStorageLikeUpdate);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("attendance-frontend-state-changed", handleStorageLikeUpdate);
    };
  }, []);

  const todayStatuses = useMemo(() => {
    return Object.entries(frontendState)
      .filter(([key]) => key.startsWith(`${today}__`))
      .map(([, value]) => value);
  }, [frontendState, today]);

  const presentCount = todayStatuses.filter((value) => value === "Present").length;
  const absentCount = todayStatuses.filter((value) => value === "Absent").length;

  const attendanceStatsByType = useMemo(() => {
    return {
      dailyAttendance: { present: 0, absent: 0 },
      meetingAttendance: { present: presentCount, absent: absentCount },
      total: { present: presentCount, absent: absentCount },
    };
  }, [presentCount, absentCount]);

  const activeData = useMemo(() => {
    if (activeTab === "daily") return attendanceStatsByType.dailyAttendance;
    if (activeTab === "meeting") return attendanceStatsByType.meetingAttendance;
    return attendanceStatsByType.total;
  }, [activeTab, attendanceStatsByType]);

  const totalInterns = internCount || 0;
  const presentPercentage =
    totalInterns > 0 ? Math.round(((activeData.present || 0) / totalInterns) * 100) : 0;

  const chartData = {
    labels: ["Present", "Absent"],
    datasets: [
      {
        label:
          activeTab === "daily"
            ? "Daily Attendance"
            : activeTab === "meeting"
            ? "Meeting Attendance"
            : "Total Attendance",
        data: [activeData.present || 0, activeData.absent || 0],
        backgroundColor: ["rgba(34, 197, 94, 0.8)", "rgba(239, 68, 68, 0.8)"],
        borderColor: ["rgb(22, 163, 74)", "rgb(220, 38, 38)"],
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.6,
        categoryPercentage: 0.8,
      },
    ],
  };

  const chartOptions = {
    maintainAspectRatio: false,
    responsive: true,
    animation: {
      duration: 600,
      easing: "easeOutQuart",
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          drawBorder: false,
          display: true,
          drawOnChartArea: true,
          drawTicks: false,
          borderDash: [5, 5],
          color: "rgba(107, 119, 141, 0.2)",
        },
        ticks: {
          font: {
            size: 12,
            family: "'Inter', sans-serif",
            weight: "500",
          },
          color: "#64748b",
          padding: 10,
        },
      },
      x: {
        grid: {
          drawBorder: false,
          display: false,
          drawOnChartArea: false,
          drawTicks: false,
        },
        ticks: {
          font: {
            size: 12,
            family: "'Inter', sans-serif",
            weight: "500",
          },
          color: "#64748b",
          padding: 10,
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: "top",
        align: "start",
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          padding: 20,
          font: {
            size: 12,
            weight: "600",
            family: "'Inter', sans-serif",
          },
        },
      },
      tooltip: {
        backgroundColor: "rgba(17, 24, 39, 0.85)",
        padding: 12,
        cornerRadius: 8,
      },
    },
  };

  if (loading) {
    return (
      <Layout>
        <Loader />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="w-full flex flex-col items-center justify-center mt-16">
          {isNetworkError ? (
            <>
              <WifiOff className="h-16 w-16 text-red-500 mb-4" />
              <h3 className="text-xl font-semibold text-red-600 mb-2">
                Network Connection Error
              </h3>
              <p className="text-gray-600 mb-6 text-center max-w-md">
                Unable to connect to the server. Please check your internet
                connection and try again.
              </p>
            </>
          ) : (
            <div className="text-red-500 text-lg font-medium mb-4">
              Error: {error}
            </div>
          )}
          <button
            onClick={loadDashboardBase}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition duration-300"
          >
            Retry
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          variants={itemVariants}
          className="flex flex-col md:flex-row md:items-center md:justify-between mb-6"
        >
          <div className="flex items-center gap-4 mt-3">
            <div className="p-4 rounded-2xl">
              <LayoutDashboardIcon className="h-10 w-auto text-green-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#060B27]">Dashboard</h1>
              <p className="text-gray-500">
                Get a quick overview of your activities, stats, and insights.
              </p>
            </div>
          </div>

          <div className="mt-4 md:mt-0">
            <span className="bg-blue-50 text-blue-700 py-2 px-4 rounded-full text-sm font-medium">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6"
        >
          <motion.div variants={itemVariants}>
            <DashboardCard
              title="Total Interns"
              count={internCount}
              color="bg-blue-500"
              icon={<Users size={50} className="text-blue-600" />}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <DashboardCard
              title="Daily Attendance"
              count={0}
              color="bg-green-500"
              icon={<CheckCircle size={50} className="text-green-600" />}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <DashboardCard
              title="Meeting Attendance"
              count={presentCount}
              color="bg-purple-500"
              icon={<CheckCircle size={50} className="text-purple-600" />}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <DashboardCard
              title="Total Present"
              count={presentCount}
              color="bg-indigo-500"
              icon={<CheckCircle size={50} className="text-indigo-600" />}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <DashboardCard
              title="Total Absent"
              count={absentCount}
              color="bg-red-500"
              icon={<XCircle size={50} className="text-red-600" />}
            />
          </motion.div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="mt-8 md:mt-12 grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6"
        >
          <div className="lg:col-span-3 bg-white shadow-lg rounded-2xl p-4 md:p-8 border border-gray-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <h3 className="text-xl md:text-2xl font-semibold text-gray-800">
                Attendance Overview
              </h3>
              <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
                {["daily", "meeting", "total"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-1.5 whitespace-nowrap ${
                      activeTab === tab
                        ? "bg-white shadow text-blue-600"
                        : "text-gray-600"
                    }`}
                  >
                    {tab === "daily" ? (
                      <Clock size={14} />
                    ) : tab === "meeting" ? (
                      <Users size={14} />
                    ) : (
                      <Calendar size={14} />
                    )}
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <span className="text-sm font-medium text-gray-700">
                  Attendance Rate: {presentPercentage}%
                </span>
                <span className="text-sm font-medium text-gray-700">
                  {activeData.present || 0}/{totalInterns} Present
                </span>
              </div>
              <div className="relative pt-2">
                <div className="flex h-4 overflow-hidden text-xs bg-gray-100 rounded-full">
                  <div
                    style={{ width: `${presentPercentage}%` }}
                    className="flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500 shadow-none transition-all duration-500"
                  />
                </div>
              </div>
            </div>

            <div className="h-64">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>

          <div className="lg:col-span-2 bg-white shadow-lg rounded-2xl p-4 md:p-8 border border-gray-100">
            <h3 className="text-xl md:text-2xl font-semibold text-gray-800 mb-5">
              Attendance Insights
            </h3>

            <div className="space-y-4">
              <div className="rounded-xl p-4 bg-blue-50">
                <div className="text-sm text-blue-700 font-semibold mb-1">
                  Today&apos;s Snapshot
                </div>
                <div className="text-gray-700 text-sm">
                  Present: <span className="font-semibold">{presentCount}</span>
                  {" • "}
                  Absent: <span className="font-semibold">{absentCount}</span>
                </div>
              </div>

              <div className="rounded-xl p-4 bg-gray-50">
                <div className="text-sm text-gray-700 font-semibold mb-1">
                  Frontend Attendance State
                </div>
                <div className="text-gray-600 text-sm">
                  Dashboard updates only when attendance is marked or when the view is reset.
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </Layout>
  );
};

export default Dashboard;