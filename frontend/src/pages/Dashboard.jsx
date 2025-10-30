import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import Navigation from "../components/Navigation";
import InternshipEndNotification from "../components/InternshipEndNotification";
import { Users, CheckCircle, XCircle, Loader2, Calendar, Clock } from "lucide-react";
import { api } from "../utils/api";
import { formatDate } from "../utils/formatDate";
import { calculateInternshipEndNotification } from "../utils/internshipNotification";
import { motion } from "framer-motion"; // Import framer-motion

const Dashboard = () => {
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    absent: 0,
  });
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [filteredAttendance, setFilteredAttendance] = useState([]);
  const [meetingAttendance, setMeetingAttendance] = useState([]);
  const [filteredMeetingAttendance, setFilteredMeetingAttendance] = useState([]);
  const [dailyRecords, setDailyRecords] = useState([]);
  const [dailyAttendanceStats, setDailyAttendanceStats] = useState({
    present: 0,
    absent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [error, setError] = useState(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [internData, setInternData] = useState(null);
  const [endDateNotification, setEndDateNotification] = useState(null);
  const rowsPerPage = 10;
  const navigate = useNavigate();

  const loadInternData = async () => {
    try {
      const internId = localStorage.getItem("internId");

      if (!internId) {
        throw new Error("Authentication error: missing internId");
      }

      const response = await api.get(`/interns/${internId}`);

      if (response) {
        console.log("Intern Data Response:", response); // Debug log
        setInternData(response);
        
        // Check if internship end date notification should be shown
        if (response.Training_EndDate) {
          const notification = calculateInternshipEndNotification(response.Training_EndDate);
          console.log("End date notification:", notification); // Debug log
          setEndDateNotification(notification);
        }
      } else {
        throw new Error("No intern data returned from API");
      }
    } catch (err) {
      console.error("Error fetching intern data:", err);
      // Don't show error for intern data as it's not critical for attendance functionality
    }
  };

  const loadAttendanceData = async () => {
    try {
      const internId = localStorage.getItem("internId");

      if (!internId) {
        throw new Error("Authentication error: missing internId");
      }

      const response = await api.get(`/interns/attendance/${internId}`);

      if (response) {
        console.log("Full API Response:", response); // Debug log
        
        // Set daily attendance (for the Daily Attendance section)
        const dailyAttendanceData = response.dailyAttendance || response.attendance?.filter(entry => !entry.isMeeting) || [];
        console.log("Daily Attendance Data:", dailyAttendanceData); // Debug log
        setAttendanceHistory(dailyAttendanceData);
        setFilteredAttendance(dailyAttendanceData);
        
        // Set meeting attendance (for the Attendance History section)
        const meetingAttendanceData = response.meetingAttendance || response.attendance?.filter(entry => entry.isMeeting) || [];
        console.log("Meeting Attendance Data:", meetingAttendanceData); // Debug log
        setMeetingAttendance(meetingAttendanceData);
        setFilteredMeetingAttendance(meetingAttendanceData);
        
        // Set attendance stats with fallback
        const stats = response.stats || {
          present: dailyAttendanceData.filter(entry => entry.status === "Present").length,
          absent: dailyAttendanceData.filter(entry => entry.status === "Absent").length
        };
        
        setAttendanceStats({
          present: stats.present,
          absent: stats.absent,
        });
        
        // Set daily attendance stats based on the daily attendance data
        setDailyAttendanceStats({
          present: dailyAttendanceData.filter(entry => entry.status === "Present").length,
          absent: dailyAttendanceData.filter(entry => entry.status === "Absent").length,
        });
      } else {
        throw new Error("No data returned from API");
      }
    } catch (err) {
      console.error("Error fetching attendance data:", err);
      setError("Error fetching attendance data.");
      if (!navigator.onLine || err.message.includes("network")) {
        setIsNetworkError(true);
      } else {
        toast.error("An error occurred while fetching the attendance data.");
      }
    }
  };



  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadInternData(), // Load intern details including end date
      loadAttendanceData() // Load attendance data
    ]);
    setLoading(false);
  };

  useEffect(() => {
    const internId = localStorage.getItem("internId");
    if (!internId) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    loadAllData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("internId");
    navigate("/");
  };

  const totalAttendance = attendanceStats.present + attendanceStats.absent;
  const presentPercentage = totalAttendance > 0
    ? Math.round((attendanceStats.present / totalAttendance) * 100)
    : 0;

  const handleDateSelection = (date) => {
    setSelectedDate(date);

    if (date) {
      const dateString = new Date(date).toLocaleDateString();
      const foundMeetingEntries = meetingAttendance.filter(
        (entry) =>
          new Date(entry.date).toLocaleDateString() === dateString
      );

      if (foundMeetingEntries.length > 0) {
        setFilteredMeetingAttendance(foundMeetingEntries);
      } else {
        toast.error("No meeting attendance records found for this day.");
        setFilteredMeetingAttendance([]);
      }
    } else {
      // Reset to show all meeting attendance
      setFilteredMeetingAttendance(meetingAttendance);
    }
  };

  const handleFilterByStatus = (status) => {
    setFilterStatus(status);

    if (status === "All") {
      setFilteredMeetingAttendance(meetingAttendance);
    } else {
      // Meeting attendance is always "Present", so no filtering needed for meetings
      setFilteredMeetingAttendance(meetingAttendance);
    }
    setCurrentPage(1);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="w-full flex flex-col items-center justify-center mt-8">
          <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-3" />
          <p className="text-gray-600 font-medium">Loading your data...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="w-full flex flex-col items-center justify-center mt-8">
          {isNetworkError ? (
            <>
              <XCircle className="h-12 w-12 text-red-500 mb-3" />
              <h3 className="text-lg font-semibold text-red-600 mb-2">
                Connection Error
              </h3>
              <p className="text-gray-600 mb-4 text-center max-w-md">
                Unable to connect to the server. Please check your connection.
              </p>
            </>
          ) : (
            <div className="text-red-500 text-base font-medium mb-3">
              Error: {error}
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition duration-300"
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <>
        {/* Internship End Date Notification */}
        <InternshipEndNotification 
          notification={endDateNotification}
          onDismiss={() => setEndDateNotification(null)}
        />

        {/* Daily Attendance Section */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Daily Attendance
          </h2>
          <p className="text-gray-600 mt-1">
            Your daily internship attendance with timestamps
          </p>

          {/* Daily Attendance Stats */}
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <motion.div
              className="bg-white p-4 rounded-lg shadow-sm flex flex-col"
              whileHover={{ scale: 1.03 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-sm text-gray-500 mb-1">Present Days</span>
              <div className="flex items-center">
                <span className="text-xl font-bold text-green-600">{dailyAttendanceStats.present}</span>
                <CheckCircle className="h-5 w-5 text-green-500 ml-auto" />
              </div>
            </motion.div>

            <motion.div
              className="bg-white p-4 rounded-lg shadow-sm flex flex-col"
              whileHover={{ scale: 1.03 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-sm text-gray-500 mb-1">Absent Days</span>
              <div className="flex items-center">
                <span className="text-xl font-bold text-red-600">{dailyAttendanceStats.absent}</span>
                <XCircle className="h-5 w-5 text-red-500 ml-auto" />
              </div>
            </motion.div>

            <motion.div
              className="bg-white p-4 rounded-lg shadow-sm flex flex-col col-span-2 sm:col-span-1"
              whileHover={{ scale: 1.03 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-sm text-gray-500 mb-1">Daily Rate</span>
              <div className="flex items-center">
                <span className="text-xl font-bold text-gray-800">
                  {dailyAttendanceStats.present + dailyAttendanceStats.absent > 0
                    ? Math.round((dailyAttendanceStats.present / (dailyAttendanceStats.present + dailyAttendanceStats.absent)) * 100)
                    : 0}%
                </span>
                <span className={`ml-auto px-2 py-1 text-xs rounded-full ${
                  dailyAttendanceStats.present + dailyAttendanceStats.absent > 0 &&
                  Math.round((dailyAttendanceStats.present / (dailyAttendanceStats.present + dailyAttendanceStats.absent)) * 100) >= 80
                    ? "bg-green-100 text-green-800"
                    : dailyAttendanceStats.present + dailyAttendanceStats.absent > 0 &&
                      Math.round((dailyAttendanceStats.present / (dailyAttendanceStats.present + dailyAttendanceStats.absent)) * 100) >= 60
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
                }`}>
                  {dailyAttendanceStats.present + dailyAttendanceStats.absent > 0 &&
                   Math.round((dailyAttendanceStats.present / (dailyAttendanceStats.present + dailyAttendanceStats.absent)) * 100) >= 80
                    ? "Excellent"
                    : dailyAttendanceStats.present + dailyAttendanceStats.absent > 0 &&
                      Math.round((dailyAttendanceStats.present / (dailyAttendanceStats.present + dailyAttendanceStats.absent)) * 100) >= 60
                    ? "Good"
                    : "Needs Improvement"}
                </span>
              </div>
            </motion.div>
          </motion.div>

          {/* Daily Attendance Records */}
          <motion.div
            className="mt-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-700 flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Recent Daily Attendance
              </h3>
              <motion.button
                onClick={() => navigate('/scan-qr')}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Clock className="h-3 w-3 mr-1" />
                Scan QR
              </motion.button>
            </div>

            {attendanceHistory.length > 0 ? (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="grid grid-cols-4 text-sm font-medium text-gray-500 bg-gray-50 p-3">
                  <div>Date</div>
                  <div className="text-center">Status</div>
                  <div className="text-center">Time</div>
                  <div className="text-right">Day</div>
                </div>

                <div className="divide-y divide-gray-100">
                  {attendanceHistory
                    .slice(0, 5) // Show only recent 5 records - show all statuses
                    .map((entry, index) => {
                      console.log("Processing entry:", entry); // Debug log
                      
                      // Handle date parsing more robustly
                      let date, dayName, formattedDate;
                      try {
                        date = entry.date ? new Date(entry.date) : new Date();
                        if (isNaN(date.getTime())) {
                          throw new Error("Invalid date");
                        }
                        dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                        formattedDate = date.toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        });
                      } catch (error) {
                        console.error("Date parsing error:", error, "Entry:", entry);
                        dayName = 'N/A';
                        formattedDate = entry.date || 'N/A';
                      }

                      return (
                        <motion.div
                          key={`${entry.date}-${index}`}
                          className="grid grid-cols-4 items-center p-3 hover:bg-gray-50"
                          whileHover={{ backgroundColor: "#f9f9f9" }}
                          transition={{ duration: 0.1 }}
                        >
                          <div className="text-sm font-medium text-gray-800">
                            {formattedDate}
                          </div>
                          <div className="text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              entry.status === "Present"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}>
                              {entry.status === "Present" ? (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              ) : (
                                <XCircle className="h-3 w-3 mr-1" />
                              )}
                              {entry.status}
                            </span>
                          </div>
                          <div className="text-center text-xs text-gray-600">
                            {entry.time || '-'}
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            {dayName}
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No daily attendance records found</p>
                <p className="text-xs text-gray-400 mt-1">Attendance will appear here after QR scanning</p>
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* My Attendance Section (Meeting Attendance) */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Meeting Attendance
          </h2>
          <p className="text-gray-600 mt-1">
            Track your meeting attendance records
          </p>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        >
          <motion.div
            className="bg-white p-4 rounded-lg shadow-sm flex flex-col"
            whileHover={{ scale: 1.03 }}
            transition={{ duration: 0.2 }}
          >
            <span className="text-sm text-gray-500 mb-1">Present Days</span>
            <div className="flex items-center">
              <span className="text-xl font-bold text-gray-800">{attendanceStats.present}</span>
              <CheckCircle className="h-5 w-5 text-green-500 ml-auto" />
            </div>
          </motion.div>

          <motion.div
            className="bg-white p-4 rounded-lg shadow-sm flex flex-col"
            whileHover={{ scale: 1.03 }}
            transition={{ duration: 0.2 }}
          >
            <span className="text-sm text-gray-500 mb-1">Absent Days</span>
            <div className="flex items-center">
              <span className="text-xl font-bold text-gray-800">{attendanceStats.absent}</span>
              <XCircle className="h-5 w-5 text-red-500 ml-auto" />
            </div>
          </motion.div>

          <motion.div
            className="bg-white p-4 rounded-lg shadow-sm flex flex-col col-span-2 sm:col-span-1"
            whileHover={{ scale: 1.03 }}
            transition={{ duration: 0.2 }}
          >
            <span className="text-sm text-gray-500 mb-1">Attendance Rate</span>
            <div className="flex items-center">
              <span className="text-xl font-bold text-gray-800">{presentPercentage}%</span>
              <span className={`ml-auto px-2 py-1 text-xs rounded-full ${
                presentPercentage >= 80 ? "bg-green-100 text-green-800" :
                presentPercentage >= 60 ? "bg-yellow-100 text-yellow-800" :
                "bg-red-100 text-red-800"
              }`}>
                {presentPercentage >= 80 ? "Excellent" :
                 presentPercentage >= 60 ? "Good" : "Needs Improvement"}
              </span>
            </div>
          </motion.div>
        </motion.div>

        {/* Filter Controls - Simple mobile first design */}
        <motion.div
          className="mt-6 flex flex-wrap gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.3 }}
        >
          <motion.button
            onClick={() => handleFilterByStatus("All")}
            className={`px-3 py-1.5 text-sm rounded-full ${
              filterStatus === "All"
                ? "bg-blue-100 text-blue-800 font-medium"
                : "bg-gray-100 text-gray-600"
            }`}
            whileTap={{ scale: 0.95 }}
          >
            All
          </motion.button>
          <motion.button
            onClick={() => handleFilterByStatus("Present")}
            className={`px-3 py-1.5 text-sm rounded-full ${
              filterStatus === "Present"
                ? "bg-green-100 text-green-800 font-medium"
                : "bg-gray-100 text-gray-600"
            }`}
            whileTap={{ scale: 0.95 }}
          >
            Present
          </motion.button>
          <motion.button
            onClick={() => handleFilterByStatus("Absent")}
            className={`px-3 py-1.5 text-sm rounded-full ${
              filterStatus === "Absent"
                ? "bg-red-100 text-red-800 font-medium"
                : "bg-gray-100 text-gray-600"
            }`}
            whileTap={{ scale: 0.95 }}
          >
            Absent
          </motion.button>
        </motion.div>

        {/* Improved Attendance Records */}
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.3 }}
        >
          <h3 className="font-medium text-gray-700 mb-3 flex items-center">
            <Calendar className="h-4 w-4 mr-1" />
            Attendance History
          </h3>

          {filteredMeetingAttendance.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="grid grid-cols-4 text-sm font-medium text-gray-500 bg-gray-50 p-3">
                <div>Date</div>
                <div className="text-center">Meeting name</div>
                <div className="text-center">Status</div>
                <div className="text-right">Day</div>
              </div>

              <div className="divide-y divide-gray-100">
                {filteredMeetingAttendance.map((entry, index) => {
                  console.log("Processing meeting entry:", entry); // Debug log
                  
                  // Handle date parsing more robustly
                  let date, dayName, formattedDate;
                  try {
                    date = entry.date ? new Date(entry.date) : new Date();
                    if (isNaN(date.getTime())) {
                      throw new Error("Invalid date");
                    }
                    dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                    formattedDate = date.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    });
                  } catch (error) {
                    console.error("Meeting date parsing error:", error, "Entry:", entry);
                    dayName = 'N/A';
                    formattedDate = entry.date || 'N/A';
                  }

                  return (
                    <motion.div
                      key={`${entry.date}-${entry.type}-${index}`}
                      className="grid grid-cols-4 items-center p-3 hover:bg-gray-50"
                      whileHover={{ backgroundColor: "#f9f9f9" }}
                      transition={{ duration: 0.1 }}
                    >
                      <div className="text-sm font-medium text-gray-800">
                        {formattedDate}
                      </div>
                      <div className="text-center">
                        <span className="text-sm text-gray-900 font-medium">
                          {entry.meetingName || entry.type || 'Meeting'}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          entry.status === "Present"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                          {entry.status === "Present" ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {entry.status}
                        </span>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        {dayName}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No meeting attendance records found</p>
              <p className="text-xs text-gray-400 mt-1">Meeting attendance will appear here after QR scanning</p>
            </div>
          )}
        </motion.div>
      </>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Navigation onLogout={handleLogout} />
      <div className="flex-1 flex flex-col lg:mt-7 lg:px-10">
        <div className="h-16" />
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
