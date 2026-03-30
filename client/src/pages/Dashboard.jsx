import React, { useEffect, useState } from "react";
import { fetchInterns, fetchAttendanceStatsForToday, fetchAttendanceStatsByType } from "../api/internApi";
import DashboardCard from "../components/DashboardCard";
import Layout from "../components/Layout";
import {
  Users,
  CheckCircle,
  XCircle,
  WifiOff,
  Clock,
  TrendingUp,
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
import { motion, AnimatePresence } from "framer-motion";
import Loader from "../components/Loader";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      when: "beforeChildren",
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

const cardVariants = {
  hover: {
    y: -5,
    transition: {
      duration: 0.2,
      ease: "easeOut",
    },
  },
};

const combinedVariants = {
  ...itemVariants,
  ...cardVariants,
};

const Dashboard = () => {
  const [internCount, setInternCount] = useState(0);
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    absent: 0,
  });
  const [attendanceStatsByType, setAttendanceStatsByType] = useState({
    dailyAttendance: { present: 0, absent: 0 },
    meetingAttendance: { present: 0, absent: 0 },
    total: { present: 0, absent: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [activeTab, setActiveTab] = useState("daily");

  const loadAttendanceStats = async () => {
    try {
      const stats = await fetchAttendanceStatsForToday();
      if (stats) {
        setAttendanceStats(stats);
      } else {
        setAttendanceStats({ present: 0, absent: 0 });
      }

      // Load stats by type
      const statsByType = await fetchAttendanceStatsByType();
      if (statsByType) {
        setAttendanceStatsByType(statsByType);
      }
    } catch (error) {
      setError("Error fetching attendance stats.");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      setIsNetworkError(false);

      try {
        const interns = await fetchInterns();
        setInternCount(interns.length);
        await loadAttendanceStats();
      } catch (error) {
        setError(error.message);
        if (
          !navigator.onLine ||
          error.message.includes("network") ||
          error.name === "TypeError"
        ) {
          setIsNetworkError(true);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();

    const handleOnline = () => {
      if (isNetworkError) {
        loadData();
      }
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [isNetworkError]);

  const getActiveAttendanceData = () => {
    if (activeTab === "daily") {
      return attendanceStatsByType.dailyAttendance;
    } else if (activeTab === "meeting") {
      return attendanceStatsByType.meetingAttendance;
    }
    return attendanceStatsByType.total;
  };

  const activeData = getActiveAttendanceData();
  
  const chartData = {
    labels: ["Present", "Absent"],
    datasets: [
      {
        label: `${activeTab === "daily" ? "Daily" : activeTab === "meeting" ? "Meeting" : "Total"} Attendance`,
        data: [activeData?.present || 0, activeData?.absent || 0],
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
        backgroundColor: "rgba(17, 24, 39, 0.8)",
        titleFont: {
          size: 13,
          family: "'Inter', sans-serif",
          weight: "600",
        },
        bodyFont: {
          size: 12,
          family: "'Inter', sans-serif",
        },
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        boxPadding: 4,
        callbacks: {
          label: function (context) {
            const label = context.label || "";
            const value = context.raw || 0;
            const total = activeData.present + activeData.absent;
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
    responsive: true,
    animation: {
      duration: 1000,
      easing: "easeOutQuart",
    },
  };

  const totalInterns = internCount;
  const presentPercentage =
    totalInterns > 0
      ? Math.round((activeData.present / totalInterns) * 100)
      : 0;
  const absentPercentage =
    totalInterns > 0
      ? Math.round((activeData.absent / totalInterns) * 100)
      : 0;

  const renderContent = () => {
    if (loading) {
      return <Loader />;
    }

    if (error) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full flex flex-col items-center justify-center mt-16"
        >
          {isNetworkError ? (
            <>
              <motion.div
                animate={{
                  y: [0, -5, 0],
                  transition: { repeat: Infinity, duration: 2 },
                }}
              >
                <WifiOff className="h-16 w-16 text-red-500 mb-4" />
              </motion.div>
              <h3 className="text-xl font-semibold text-red-600 mb-2">
                Network Connection Error
              </h3>
              <p className="text-gray-600 mb-6 text-center max-w-md">
                Unable to connect to the server. Please check your internet
                connection and try again.
              </p>
            </>
          ) : (
            <>
              <div className="text-red-500 text-lg font-medium mb-4">
                Error: {error}
              </div>
            </>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition duration-300 flex items-center"
          >
            <span>Retry</span>
          </motion.button>
        </motion.div>
      );
    }

    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col md:flex-row md:items-center md:justify-between mb-6"
        >          

          <div className="flex items-center gap-4 mt-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
                delay: 0.2,
              }}
              className="p-4 rounded-2xl"
            >
              <LayoutDashboardIcon className="h-10 w-auto text-4xl text-green-600" />
            </motion.div>
            <div>
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-3xl font-bold text-[#060B27]"
              >
                Dashboard
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="text-gray-500"
              >
                Get a quick overview of your activities, stats, and insights.
              </motion.p>
            </div>
          </div>

          <motion.div whileHover={{ scale: 1.05 }} className="mt-4 md:mt-0">
            <span className="bg-blue-50 text-blue-700 py-2 px-4 rounded-full text-sm font-medium">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </motion.div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6"
        >
          <motion.div
            variants={combinedVariants}
            whileHover="hover"
          >
            <DashboardCard
              title="Total Interns"
              count={internCount}
              color="bg-blue-500"
              icon={<Users size={50} className="text-blue-600" />}
            />
          </motion.div>
          
          <motion.div
            variants={combinedVariants}
            whileHover="hover"
          >
            <DashboardCard
              title="Daily Attendance"
              count={attendanceStatsByType?.dailyAttendance?.present || 0}
              color="bg-green-500"
              icon={<CheckCircle size={50} className="text-green-600" />}
            />
          </motion.div>

          <motion.div
            variants={combinedVariants}
            whileHover="hover"
          >
            <DashboardCard
              title="Meeting Attendance"
              count={attendanceStatsByType?.meetingAttendance?.present || 0}
              color="bg-purple-500"
              icon={<CheckCircle size={50} className="text-purple-600" />}
            />
          </motion.div>

          <motion.div
            variants={combinedVariants}
            whileHover="hover"
          >
            <DashboardCard
              title="Total Present"
              count={attendanceStatsByType?.total?.present || 0}
              color="bg-indigo-500"
              icon={<CheckCircle size={50} className="text-indigo-600" />}
            />
          </motion.div>

          <motion.div
            variants={combinedVariants}
            whileHover="hover"
          >
            <DashboardCard
              title="Total Absent"
              count={attendanceStatsByType?.total?.absent || 0}
              color="bg-red-500"
              icon={<XCircle size={50} className="text-red-600" />}
            />
          </motion.div>
        </motion.div>

        {/* Enhanced Attendance Visualization */}
        <motion.div
          variants={itemVariants}
          className="mt-8 md:mt-12 grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6"
        >
          <motion.div
            whileHover={{ y: -2 }}
            className="lg:col-span-3 bg-white shadow-lg rounded-2xl p-4 md:p-8 border border-gray-100"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <h3 className="text-xl md:text-2xl font-semibold text-gray-800">
                Attendance Overview
              </h3>
              <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
                {["daily", "meeting", "total"].map((tab) => (
                  <motion.button
                    key={tab}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab(tab)}
                    className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md flex items-center gap-1.5 whitespace-nowrap ${
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
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <span className="text-xs sm:text-sm font-medium text-gray-700">
                  Attendance Rate: {presentPercentage}%
                </span>
                <span className="text-xs sm:text-sm font-medium text-gray-700">
                  {activeData.present}/{totalInterns} Present
                </span>
              </div>
              <div className="relative pt-2">
                <div className="flex h-4 overflow-hidden text-xs bg-gray-100 rounded-full">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${presentPercentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500 shadow-none"
                  ></motion.div>
                </div>
              </div>
            </div>

            {/* Enhanced Chart */}
            <div className="h-64 md:h-64">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </motion.div>

          {/* Redesigned Attendance Metrics section */}
          <motion.div
            whileHover={{ y: -2 }}
            className="lg:col-span-2 bg-white shadow-lg rounded-2xl p-4 md:p-8 border border-gray-100"
          >
            <h3 className="text-xl md:text-2xl font-semibold text-gray-800 mb-6">
              Attendance Insights
            </h3>
            <div className="space-y-6">
              {/* Attendance Trend */}
              <motion.div
                whileHover={{ x: 5 }}
                className="bg-blue-50 p-4 rounded-xl"
              >
                <div className="flex items-center text-blue-700 font-medium mb-2">
                  <TrendingUp size={16} className="mr-2" />
                  <span className="text-sm">Recent Attendance Trend</span>
                </div>
                <p className="text-sm text-gray-700">
                  {presentPercentage > 75
                    ? "Excellent attendance rate today!"
                    : presentPercentage > 50
                    ? "Good attendance rate today."
                    : "Lower than usual attendance rate today."}
                </p>
              </motion.div>

              {/* Attendance Stats */}
              <div className="grid grid-cols-2 gap-4">
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className="bg-indigo-50 p-4 rounded-xl"
                >
                  <p className="text-sm text-indigo-700 font-medium mb-1">
                    Present Rate
                  </p>
                  <p className="text-lg font-bold text-indigo-800">
                    {presentPercentage}%
                  </p>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className="bg-purple-50 p-4 rounded-xl"
                >
                  <p className="text-sm text-purple-700 font-medium mb-1">
                    Absent Rate
                  </p>
                  <p className="text-lg font-bold text-purple-800">
                    {absentPercentage}%
                  </p>
                </motion.div>
              </div>

              {/* Additional Metrics */}
              <div className="pt-4 border-t border-gray-200 space-y-3">
                {[
                  {
                    label: "Total Attendance Marked",
                    value: attendanceStats.present + attendanceStats.absent,
                  },
                  {
                    label: "Attendance Status",
                    value:
                      presentPercentage > 75
                        ? "Excellent"
                        : presentPercentage > 50
                        ? "Good"
                        : "Low",
                  },
                  {
                    label: "Last Updated",
                    value: new Date().toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  },
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex justify-between items-center"
                  >
                    <p className="text-gray-500">{item.label}</p>
                    <p className="font-semibold text-gray-800">{item.value}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <Layout>
      <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
    </Layout>
  );
};

export default Dashboard;
