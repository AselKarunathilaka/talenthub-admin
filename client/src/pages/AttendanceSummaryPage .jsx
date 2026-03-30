import React, { useEffect, useState } from "react";
import { api, getAuthHeaders } from "../api/apiConfig";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  CalendarFold,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { FileText, FileSpreadsheet, ArrowDownCircle } from "lucide-react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Loader from "../components/Loader";
import { motion } from "framer-motion";
import {
  generatePresentReports,
  exportPresentReport,
  exportPresentPDF,
  generateAbsentReports,
  exportAbsentReport,
  exportAbsentPDF,
} from "./../utils/attendanceSummary/reportUtils";

// Utility function to format date as dd/mm/yyyy
const formatDate = (date) => {
  if (!date) return "N/A";
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Invalid Date";
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
};

const AttendanceSummaryPage = () => {
  const [interns, setInterns] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [month, setMonth] = useState("");
  const [week, setWeek] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(true);
  const navigate = useNavigate();

  const itemsPerPage = 10;

  useEffect(() => {
    fetchInterns();
  }, []);

  const fetchInterns = async () => {
    setLoading(true);
    try {
      const response = await api.get("/interns", getAuthHeaders());
      const internsData = response.data.map((intern) => {
        const processedIntern = intern._doc || intern;
        return {
          ...processedIntern,
          attendance: processedIntern.attendance || [],
        };
      });
      setInterns(internsData);
    } catch (error) {
      console.error("Error fetching interns:", error);
      if (error.response?.status === 401) {
        toast.error("Session expired. Please log in again.");
        navigate("/login");
      } else {
        toast.error("Failed to fetch interns. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getWeeksInMonth = (month, year) => {
    const weeks = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let currentWeekStart = new Date(firstDay);
    if (currentWeekStart.getDay() > 0) {
      currentWeekStart.setDate(
        currentWeekStart.getDate() - currentWeekStart.getDay()
      );
    }

    while (currentWeekStart <= lastDay) {
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);

      weeks.push({
        start: new Date(currentWeekStart),
        end: new Date(currentWeekEnd),
        weekNumber: weeks.length + 1,
      });

      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    return weeks;
  };

  const wasPresentInDateRange = (intern, rangeStart, rangeEnd) => {
    return intern.attendance.some((entry) => {
      const entryDate = new Date(entry.date);
      return (
        entryDate >= rangeStart &&
        entryDate <= rangeEnd &&
        entry.status === "Present"
      );
    });
  };

  const wasAbsentAllWeekdays = (intern, rangeStart, rangeEnd) => {
    const weekdays = [];
    const current = new Date(rangeStart);

    while (current <= rangeEnd) {
      if (current.getDay() >= 1 && current.getDay() <= 5) {
        weekdays.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    return weekdays.every((weekday) => {
      return !intern.attendance.some((entry) => {
        const entryDate = new Date(entry.date);
        return (
          entryDate.getDate() === weekday.getDate() &&
          entryDate.getMonth() === weekday.getMonth() &&
          entryDate.getFullYear() === weekday.getFullYear() &&
          entry.status === "Present"
        );
      });
    });
  };

  const getFilteredInterns = () => {
    let filtered = [...interns];

    if (searchQuery) {
      filtered = filtered.filter(
        (intern) =>
          intern.traineeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          intern.traineeName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredInterns = getFilteredInterns();
  const weeks = month ? getWeeksInMonth(parseInt(month), year) : [];

  const getInternsWithStatus = () => {
    let rangeStart, rangeEnd;

    if (week && month) {
      const selectedWeek = weeks[parseInt(week) - 1];
      if (!selectedWeek) return filteredInterns;
      rangeStart = selectedWeek.start;
      rangeEnd = selectedWeek.end;
    } else if (startDate && endDate) {
      rangeStart = new Date(startDate);
      rangeEnd = new Date(endDate);
    } else {
      return filteredInterns;
    }

    return filteredInterns.map((intern) => {
      const isPresent = wasPresentInDateRange(intern, rangeStart, rangeEnd);
      let absentAllWeekdays = false;

      if (!isPresent) {
        absentAllWeekdays = wasAbsentAllWeekdays(intern, rangeStart, rangeEnd);
      }

      return {
        ...intern,
        status: isPresent ? "Present" : "Absent",
        absentAllWeekdays,
      };
    });
  };

  const internsWithStatus = getInternsWithStatus();
  const paginatedInterns = internsWithStatus.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Navbar />
      <Sidebar />

      <div className="flex-1 p-6 bg-gray-100 mt-20 pt-16">
        <div className="flex items-center gap-4">
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
            <CalendarFold className="h-10 w-auto text-4xl text-green-600" />
          </motion.div>
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-3xl font-bold text-[#060B27]"
            >
              Weekly Attendance Summary
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-gray-500"
            >
              Track intern weekly presence (at least one day present counts as
              present for the week)
            </motion.p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <button
            className="flex items-center bg-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-300"
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <Filter className="mr-2" size={18} />
            Filters
          </button>
        </div>

        {filterOpen && (
          <div className="bg-white shadow-md rounded-md p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Search by ID or Name"
                  className="border rounded-md p-2 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <select
                  className="border rounded-md p-2 w-full"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <option key={i} value={new Date().getFullYear() - 2 + i}>
                      {new Date().getFullYear() - 2 + i}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Month
                </label>
                <select
                  className="border rounded-md p-2 w-full"
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    setWeek("");
                  }}
                >
                  <option value="">Select Month</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>
                      {new Date(0, i).toLocaleString("default", {
                        month: "long",
                      })}
                    </option>
                  ))}
                </select>
              </div>

              {month && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Week
                  </label>
                  <select
                    className="border rounded-md p-2 w-full"
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                    disabled={!month}
                  >
                    <option value="">Select Week</option>
                    {weeks.map((weekObj, index) => (
                      <option key={index} value={weekObj.weekNumber}>
                        Week {weekObj.weekNumber} (
                        {formatDate(weekObj.start)} - {formatDate(weekObj.end)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  className="border rounded-md p-2 w-full"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setMonth("");
                    setWeek("");
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  className="border rounded-md p-2 w-full"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setMonth("");
                    setWeek("");
                  }}
                  disabled={!startDate}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-6">
              <button
                onClick={() => exportAbsentPDF({ filteredInterns, month, week, year, startDate, endDate })}
                className="flex items-center gap-2 bg-red-500 text-white px-5 py-2.5 rounded-lg hover:bg-red-600 transition-colors duration-200 shadow hover:shadow-md active:scale-95"
              >
                <FileText size={18} />
                <span>Export Absent List (PDF)</span>
                <ArrowDownCircle size={18} />
              </button>

              <button
                onClick={() => exportAbsentReport({ filteredInterns, month, week, year, startDate, endDate })}
                className="flex items-center gap-2 bg-rose-500 text-white px-5 py-2.5 rounded-lg hover:bg-rose-600 transition-colors duration-200 shadow hover:shadow-md active:scale-95"
              >
                <FileSpreadsheet size={18} />
                <span>Export Absent List (Excel)</span>
                <ArrowDownCircle size={18} />
              </button>

              <button
                onClick={() => exportPresentPDF({ filteredInterns, month, week, year, startDate, endDate })}
                className="flex items-center gap-2 bg-green-500 text-white px-5 py-2.5 rounded-lg hover:bg-green-600 transition-colors duration-200 shadow hover:shadow-md active:scale-95"
              >
                <FileText size={18} />
                <span>Export Present List (PDF)</span>
                <ArrowDownCircle size={18} />
              </button>

              <button
                onClick={() => exportPresentReport({ filteredInterns, month, week, year, startDate, endDate })}
                className="flex items-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-600 transition-colors duration-200 shadow hover:shadow-md active:scale-95"
              >
                <FileSpreadsheet size={18} />
                <span>Export Present List (Excel)</span>
                <ArrowDownCircle size={18} />
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <Loader />
        ) : (
          <div className="overflow-x-auto bg-white rounded-md shadow-md">
            <table className="w-full text-left">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-4">Trainee ID</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Specialization</th>
                  <th className="p-4">Team</th>
                  <th className="p-4">Institute</th>
                  <th className="p-4">Start Date</th>
                  <th className="p-4">End Date</th>
                  <th className="p-4 text-center">Weekly Status</th>
                  <th className="p-4 text-center">Absent Entire Week</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInterns.map((intern) => (
                  <tr key={intern._id} className="hover:bg-gray-50 border-b">
                    <td className="p-4">{intern.traineeId}</td>
                    <td className="p-4">{intern.traineeName}</td>
                    <td className="p-4">{intern.fieldOfSpecialization}</td>
                    <td className="p-4">{intern.team}</td>
                    <td className="p-4">{intern.institute || "N/A"}</td>
                    <td className="p-4">
                      {formatDate(intern.trainingStartDate)}
                    </td>
                    <td className="p-4">
                      {formatDate(intern.trainingEndDate)}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          intern.status === "Present"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {intern.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {intern.status === "Absent" && (
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            intern.absentAllWeekdays
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {intern.absentAllWeekdays ? "Yes" : "No"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-center items-center mt-6 space-x-4">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-2 bg-gray-200 rounded-full disabled:opacity-50"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-medium">
            {currentPage} / {Math.ceil(internsWithStatus.length / itemsPerPage)}
          </span>
          <button
            onClick={() =>
              setCurrentPage((prev) =>
                Math.min(
                  prev + 1,
                  Math.ceil(internsWithStatus.length / itemsPerPage)
                )
              )
            }
            disabled={
              currentPage === Math.ceil(internsWithStatus.length / itemsPerPage)
            }
            className="p-2 bg-gray-200 rounded-full disabled:opacity-50"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceSummaryPage;