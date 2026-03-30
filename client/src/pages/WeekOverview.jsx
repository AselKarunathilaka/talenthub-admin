import React, { useEffect, useState } from "react";
import { api, getAuthHeaders } from "../api/apiConfig";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { Toaster, toast } from "react-hot-toast";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import logoURL from "../assets/slt logo.jpg";
import {
  Calendar,
  Download,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Search,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const WeekOverview = () => {
  const [attendedInterns, setAttendedInterns] = useState([]);
  const [notAttendedInterns, setNotAttendedInterns] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    absent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState("This Week");
  const [activeTab, setActiveTab] = useState("attended");
  const [attendanceData, setAttendanceData] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  

  // Fetch attendance stats for the week
  const fetchWeeklyAttendanceStats = async (week) => {
    setLoading(true);
    try {
      const response = await api.get(
        `/interns/weekly-attendance-stats?week=${week}`,
        getAuthHeaders()
      );

      // Process all interns to determine who attended at least one day
      const allInterns = [
        ...response.data.attendedInterns,
        ...response.data.notAttendedInterns,
      ];

      const sortedAttendedInterns = allInterns
        .filter((intern) => intern.attendance.length > 0) // At least one attendance record
        .sort((a, b) => a.traineeId.localeCompare(b.traineeId));

      const sortedNotAttendedInterns = allInterns
        .filter((intern) => intern.attendance.length === 0) // No attendance records
        .sort((a, b) => a.traineeId.localeCompare(b.traineeId));

      setAttendedInterns(sortedAttendedInterns);
      setNotAttendedInterns(sortedNotAttendedInterns);
      setAttendanceStats({
        present: sortedAttendedInterns.length,
        absent: sortedNotAttendedInterns.length,
      });

      // Process data for chart
      generateAttendanceChartData(
        sortedAttendedInterns,
        sortedNotAttendedInterns
      );
    } catch (error) {
      console.error("Error fetching weekly attendance stats:", error);
      toast.error("Failed to fetch attendance stats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeeklyAttendanceStats(selectedWeek);
  }, [selectedWeek]);

  // Reset pagination when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Generate chart data
  const generateAttendanceChartData = (attended, notAttended) => {
    const weekdays = getWeekDays();
    const chartData = weekdays.map((day) => {
      const totalInterns = attended.length + notAttended.length;
      const presentCount = attended.filter((intern) =>
        intern.attendance.some(
          (att) =>
            new Date(att.date).toLocaleDateString("en-US", {
              weekday: "short",
            }) === day
        )
      ).length;
      const absentCount = totalInterns - presentCount;

      return {
        day,
        present: presentCount,
        absent: absentCount,
      };
    });

    setAttendanceData(chartData);
  };

  // Get only weekdays (Mon-Fri)
  const getWeekDays = () => {
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    return weekdays;
  };

  const weekDays = getWeekDays();

  // Current date for the report
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Generate report for attended interns
  const generateAttendedReport = () => {
    const doc = new jsPDF();

    // Add a subtle header bar
    doc.setFillColor(248, 249, 250); // Very light gray/almost white
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 40, "F");

    // Add logo
    const logoWidth = 40;
    const logoHeight = 15;
    const marginLeft = 14;
    try {
      doc.addImage(logoURL, "JPEG", marginLeft, 15, logoWidth, logoHeight);
    } catch (error) {
      console.error("Error adding logo:", error);
      // Continue without the logo
    }

    // Header section text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(70, 70, 70); // Dark gray
    doc.text("Present Interns Attendance Report", marginLeft, 50);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100); // Medium gray
    doc.text(`Date: ${currentDate}`, marginLeft, 60);

    // Add week info and total present count
    doc.text(
      `Week: ${selectedWeek} • Total Present: ${attendedInterns.length}`,
      marginLeft,
      70
    );

    // Add a divider line below the header section
    doc.setDrawColor(230, 230, 230); // Light gray
    doc.line(marginLeft, 85, doc.internal.pageSize.getWidth() - marginLeft, 85);

    // Define legend for present/absent icons
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("Legend:", marginLeft, 90);

    // Present icon legend
    doc.setFillColor(39, 174, 96); // Green
    doc.circle(marginLeft + 20, 90, 2, "F");
    doc.text("Present", marginLeft + 25, 90);

    // Absent icon legend
    doc.setFillColor(192, 57, 43); // Red
    doc.circle(marginLeft + 60, 90, 2, "F");
    doc.text("No Attendance", marginLeft + 65, 90);

    // Prepare table headers and data with shorter "Attendance" header text
    const headers = [
      ["Trainee ID", "Name", "Mon", "Tue", "Wed", "Thu", "Fri", "Status"],
    ];

    const tableData = attendedInterns.map((intern) => [
      intern.traineeId,
      intern.traineeName,
      ...weekDays.map((day) => {
        const attendance = intern.attendance.find(
          (att) =>
            new Date(att.date).toLocaleDateString("en-US", {
              weekday: "short",
            }) === day
        );
        return attendance ? attendance.status : "No Attendance";
      }),
      "Present",
    ]);

    // Generate table with the attendance data, starting below the header
    doc.autoTable({
      head: headers,
      body: tableData,
      startY: 100, // Start after the legend
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 6,
        lineWidth: 0.1,
        overflow: "linebreak",
        cellWidth: "auto",
      },
      headStyles: {
        fillColor: [39, 174, 96], // Bright green color like in the image
        textColor: 255, // White text
        fontStyle: "bold",
        lineColor: [39, 174, 96], // Match border with fill color
        halign: "center", // Center align headers
        valign: "middle",
      },
      columnStyles: {
        0: { cellWidth: 23 }, // Trainee ID
        1: { cellWidth: 38 }, // Name
        2: { cellWidth: 20, halign: "center" }, // Mon
        3: { cellWidth: 20, halign: "center" }, // Tue
        4: { cellWidth: 20, halign: "center" }, // Wed
        5: { cellWidth: 20, halign: "center" }, // Thu
        6: { cellWidth: 20, halign: "center" }, // Fri
        7: { cellWidth: 25, halign: "center" }, // Status - shortened to fix cutoff
      },
      bodyStyles: {
        fillColor: 255, // White
        textColor: 80, // Dark gray
        lineColor: [220, 220, 220], // Light gray for row borders
        valign: "middle",
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245], // Very slight gray for alternate rows
      },
      didDrawCell: function (data) {
        // Add icons instead of text for Present/No Attendance
        if (
          data.section === "body" &&
          data.column.index >= 2 &&
          data.column.index <= 6
        ) {
          const value = data.cell.raw;
          // Reset the text content to empty
          data.cell.text = [];

          // Get cell position
          const x = data.cell.x + data.cell.width / 2;
          const y = data.cell.y + data.cell.height / 2;

          if (value === "Present") {
            // Draw green circle for Present
            doc.setFillColor(39, 174, 96); // Green
            doc.circle(x, y, 3, "F");
          } else if (value === "No Attendance") {
            // Draw red circle for No Attendance
            doc.setFillColor(192, 57, 43); // Red
            doc.circle(x, y, 3, "F");
          }
        }
      },
      willDrawCell: function (data) {
        // Remove text content from cells that will have icons
        if (
          data.section === "body" &&
          data.column.index >= 2 &&
          data.column.index <= 6
        ) {
          data.cell.text = [];
        }
      },
      didParseCell: function (data) {
        // Format the status in the last column
        if (data.section === "body" && data.column.index === 7) {
          data.cell.styles.textColor = [39, 174, 96]; // Green text for Present status
        }
      },
      margin: { left: marginLeft, right: marginLeft },
    });

    // Add footer with page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    // Generate a filename with the current date
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const fileName = `Present_Interns_Report_${day}_${month}_${year}.pdf`;

    doc.save(fileName);
    toast.success("Present interns report downloaded successfully");
  };

  const generateNotAttendedReport = () => {
    const doc = new jsPDF();

    // Add a subtle header bar
    doc.setFillColor(248, 249, 250); // Very light gray/almost white
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 40, "F");

    // Add logo
    const logoWidth = 40;
    const logoHeight = 15;
    const marginLeft = 14;
    try {
      doc.addImage(logoURL, "JPEG", marginLeft, 15, logoWidth, logoHeight);
    } catch (error) {
      console.error("Error adding logo:", error);
      // Continue without the logo
    }

    // Header section text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(70, 70, 70); // Dark gray
    doc.text("Absent Interns Attendance Report", marginLeft, 50);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100); // Medium gray
    doc.text(`Date: ${currentDate}`, marginLeft, 60);

    // Add week info and total absent count
    doc.text(
      `Week: ${selectedWeek} • Total Absent: ${notAttendedInterns.length}`,
      marginLeft,
      70
    );

    // Add a divider line below the header section
    doc.setDrawColor(230, 230, 230); // Light gray
    doc.line(marginLeft, 85, doc.internal.pageSize.getWidth() - marginLeft, 85);

    // Define legend for present/absent icons
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("Legend:", marginLeft, 90);

    // Present icon legend
    doc.setFillColor(39, 174, 96); // Green
    doc.circle(marginLeft + 20, 90, 2, "F");
    doc.text("Present", marginLeft + 25, 90);

    // Absent icon legend
    doc.setFillColor(192, 57, 43); // Red
    doc.circle(marginLeft + 60, 90, 2, "F");
    doc.text("No Attendance", marginLeft + 65, 90);

    // Prepare table headers and data with shorter "Status" header text
    const headers = [
      ["Trainee ID", "Name", "Mon", "Tue", "Wed", "Thu", "Fri", "Status"],
    ];

    const tableData = notAttendedInterns.map((intern) => [
      intern.traineeId,
      intern.traineeName,
      ...weekDays.map((day) => {
        const attendance = intern.attendance.find(
          (att) =>
            new Date(att.date).toLocaleDateString("en-US", {
              weekday: "short",
            }) === day
        );
        return attendance ? attendance.status : "No Attendance";
      }),
      intern.attendance.length === 0 ? "No Attendance" : "Absent",
    ]);

    // Generate table with the attendance data, starting below the header
    doc.autoTable({
      head: headers,
      body: tableData,
      startY: 100, // Start after the legend
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 6,
        lineWidth: 0.1,
        overflow: "linebreak",
        cellWidth: "auto",
      },
      headStyles: {
        fillColor: [255, 86, 48], // Red color for absent report
        textColor: 255, // White text
        fontStyle: "bold",
        lineColor: [255, 86, 48], // Match border with fill color
        halign: "center", // Center align headers
        valign: "middle",
      },
      columnStyles: {
        0: { cellWidth: 23 }, // Trainee ID
        1: { cellWidth: 38 }, // Name
        2: { cellWidth: 20, halign: "center" }, // Mon
        3: { cellWidth: 20, halign: "center" }, // Tue
        4: { cellWidth: 20, halign: "center" }, // Wed
        5: { cellWidth: 20, halign: "center" }, // Thu
        6: { cellWidth: 20, halign: "center" }, // Fri
        7: { cellWidth: 25, halign: "center" }, // Status - shortened to fix cutoff
      },
      bodyStyles: {
        fillColor: 255, // White
        textColor: 80, // Dark gray
        lineColor: [220, 220, 220], // Light gray for row borders
        valign: "middle",
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245], // Very slight gray for alternate rows
      },
      didDrawCell: function (data) {
        // Add icons instead of text for Present/No Attendance
        if (
          data.section === "body" &&
          data.column.index >= 2 &&
          data.column.index <= 6
        ) {
          const value = data.cell.raw;
          // Reset the text content to empty
          data.cell.text = [];

          // Get cell position
          const x = data.cell.x + data.cell.width / 2;
          const y = data.cell.y + data.cell.height / 2;

          if (value === "Present") {
            // Draw green circle for Present
            doc.setFillColor(39, 174, 96); // Green
            doc.circle(x, y, 3, "F");
          } else if (value === "No Attendance") {
            // Draw red circle for No Attendance
            doc.setFillColor(192, 57, 43); // Red
            doc.circle(x, y, 3, "F");
          }
        }
      },
      willDrawCell: function (data) {
        // Remove text content from cells that will have icons
        if (
          data.section === "body" &&
          data.column.index >= 2 &&
          data.column.index <= 6
        ) {
          data.cell.text = [];
        }
      },
      didParseCell: function (data) {
        // Format the status in the last column
        if (data.section === "body" && data.column.index === 7) {
          if (data.cell.raw === "Absent" || data.cell.raw === "No Attendance") {
            data.cell.styles.textColor = [192, 57, 43]; // Red text for Absent status
          } else {
            data.cell.styles.textColor = [39, 174, 96]; // Green text for Present status (if any)
          }
        }
      },
      margin: { left: marginLeft, right: marginLeft },
    });

    // Add footer with page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    // Generate a filename with the current date
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const fileName = `Absent_Interns_Report_${day}_${month}_${year}.pdf`;

    doc.save(fileName);
    toast.success("Absent interns report downloaded successfully");
  };

  // Search functionality
  const filterInterns = (interns) => {
    if (!searchQuery) return interns;

    return interns.filter(
      (intern) =>
        intern.traineeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        intern.traineeId.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Get current items for pagination
  const getDisplayedInterns = () => {
    const interns =
      activeTab === "attended" ? attendedInterns : notAttendedInterns;
    const filteredInterns = filterInterns(interns);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return filteredInterns.slice(indexOfFirstItem, indexOfLastItem);
  };

  // Total pages calculation
  const filteredInterns = filterInterns(
    activeTab === "attended" ? attendedInterns : notAttendedInterns
  );
  const totalItems = filteredInterns.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto pt-24 px-6">
          <div className="max-w-7xl mx-auto py-6">
            {/* Dashboard Header */}
            <div className="mb-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-3xl font-bold my-5 text-gray-900">
                    Weekly Attendance Dashboard
                  </h1>
                  <p className="mt-2 text-gray-600">
                    Monitor and track intern attendance performance
                  </p>
                </div>
                <div className="mt-4 lg:mt-0 flex flex-col sm:flex-row gap-4">
                  {/* Week Selector */}
                  <div className="flex items-center">
                    <Calendar className="mr-2 text-gray-500" size={20} />
                    <select
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value)}
                      className="pl-2 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="This Week">This Week</option>
                      <option value="Last Week">Last Week</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="bg-green-100 p-3 rounded-full">
                    <UserCheck className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-500">
                      Present Interns
                    </h3>
                    <p className="text-2xl font-semibold text-gray-900">
                      {attendedInterns.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="bg-red-100 p-3 rounded-full">
                    <UserX className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-500">
                      Absent Interns
                    </h3>
                    <p className="text-2xl font-semibold text-gray-900">
                      {notAttendedInterns.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-500">
                      Attendance Rate
                    </h3>
                    <p className="text-2xl font-semibold text-gray-900">
                      {attendanceStats.present + attendanceStats.absent > 0
                        ? (
                            (attendanceStats.present /
                              (attendanceStats.present +
                                attendanceStats.absent)) *
                            100
                          ).toFixed(1) + "%"
                        : "0%"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Attendance Chart - Modernized with grey for absent */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Weekly Attendance Overview
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={attendanceData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
                    barGap={8}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#EDEDED"
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "#64748B" }}
                      axisLine={{ stroke: "#E5E7EB" }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(value) => `${value}`}
                      tick={{ fill: "#64748B" }}
                      axisLine={{ stroke: "#E5E7EB" }}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        // Check if the data corresponds to present or absent
                        if (name === "present") {
                          return [
                            `Present Interns: ${value}`,
                            "Present Interns",
                          ];
                        } else if (name === "absent") {
                          return [`Absent Interns: ${value}`, "Absent Interns"];
                        }
                        return value;
                      }}
                      contentStyle={{
                        borderRadius: "6px",
                        border: "1px solid #E5E7EB",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                      }}
                    />

                    <Legend wrapperStyle={{ paddingTop: 10 }} />
                    <Bar
                      dataKey="present"
                      name="Present"
                      fill="#36B37E"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="absent"
                      name="Absent"
                      fill="#A0AEC0"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab("attended")}
                    className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center ${
                      activeTab === "attended"
                        ? "border-green-500 text-green-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <UserCheck className="mr-2" size={18} />
                    Present Interns
                  </button>
                  <button
                    onClick={() => setActiveTab("notAttended")}
                    className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center ${
                      activeTab === "notAttended"
                        ? "border-red-500 text-red-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <UserX className="mr-2" size={18} />
                    Absent Interns
                  </button>
                </nav>
              </div>

              <div className="p-6">
                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
                  </div>
                ) : activeTab === "attended" ? (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Present Interns ({filterInterns(attendedInterns).length}
                        )
                      </h3>
                      <div className="flex items-center space-x-4">
                        {/* Search bar moved to same line as Download Report */}
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <Search className="text-gray-400" size={16} />
                          </div>
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setCurrentPage(1); // Reset to first page on search
                            }}
                            placeholder="Search interns..."
                            className="pl-9 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                        <button
                          onClick={generateAttendedReport}
                          className="flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
                        >
                          <Download size={16} className="mr-2" />
                          Download Report
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Trainee ID
                            </th>
                            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Name
                            </th>
                            {weekDays.map((day, index) => (
                              <th
                                key={index}
                                className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                {day}
                              </th>
                            ))}
                            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {getDisplayedInterns().length > 0 ? (
                            getDisplayedInterns().map((intern) => (
                              <tr key={intern._id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {intern.traineeId}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {intern.traineeName}
                                </td>
                                {weekDays.map((day, index) => {
                                  const attendance = intern.attendance.find(
                                    (att) =>
                                      new Date(att.date).toLocaleDateString(
                                        "en-US",
                                        { weekday: "short" }
                                      ) === day
                                  );
                                  return (
                                    <td
                                      key={index}
                                      className="px-6 py-4 whitespace-nowrap text-sm"
                                    >
                                      {attendance ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                          {attendance.status}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                          No Data
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Present
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={weekDays.length + 3}
                                className="px-6 py-12 text-center text-gray-500"
                              >
                                {searchQuery
                                  ? "No matching interns found."
                                  : "No present interns found for this week."}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Absent Interns (
                        {filterInterns(notAttendedInterns).length})
                      </h3>
                      <div className="flex items-center space-x-4">
                        {/* Search bar moved to same line as Download Report */}
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <Search className="text-gray-400" size={16} />
                          </div>
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setCurrentPage(1); // Reset to first page on search
                            }}
                            placeholder="Search interns..."
                            className="pl-9 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                        <button
                          onClick={generateNotAttendedReport}
                          className="flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                        >
                          <Download size={16} className="mr-2" />
                          Download Report
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Trainee ID
                            </th>
                            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Name
                            </th>
                            {weekDays.map((day, index) => (
                              <th
                                key={index}
                                className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                {day}
                              </th>
                            ))}
                            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {getDisplayedInterns().length > 0 ? (
                            getDisplayedInterns().map((intern) => (
                              <tr key={intern._id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {intern.traineeId}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {intern.traineeName}
                                </td>
                                {weekDays.map((day, index) => {
                                  const attendance = intern.attendance.find(
                                    (att) =>
                                      new Date(att.date).toLocaleDateString(
                                        "en-US",
                                        { weekday: "short" }
                                      ) === day
                                  );
                                  return (
                                    <td
                                      key={index}
                                      className="px-6 py-4 whitespace-nowrap text-sm"
                                    >
                                      {attendance ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                          {attendance.status}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                          No Data
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    {intern.attendance.length === 0
                                      ? "No Attendance"
                                      : "Absent"}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={weekDays.length + 3}
                                className="px-6 py-12 text-center text-gray-500"
                              >
                                {searchQuery
                                  ? "No matching interns found."
                                  : "No absent interns found for this week."}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Pagination */}
                {totalItems > itemsPerPage && (
                  <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                    <div className="flex flex-1 justify-between sm:hidden">
                      <button
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(prev - 1, 1))
                        }
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${
                          currentPage === 1
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        Previous
                      </button>
                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(prev + 1, totalPages)
                          )
                        }
                        disabled={currentPage === totalPages}
                        className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${
                          currentPage === totalPages
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Showing{" "}
                          <span className="font-medium">
                            {Math.min(
                              (currentPage - 1) * itemsPerPage + 1,
                              totalItems
                            )}
                          </span>{" "}
                          to{" "}
                          <span className="font-medium">
                            {Math.min(currentPage * itemsPerPage, totalItems)}
                          </span>{" "}
                          of <span className="font-medium">{totalItems}</span>{" "}
                          results
                        </p>
                      </div>
                      <div>
                        <nav
                          className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                          aria-label="Pagination"
                        >
                          <button
                            onClick={() =>
                              setCurrentPage((prev) => Math.max(prev - 1, 1))
                            }
                            disabled={currentPage === 1}
                            className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 ${
                              currentPage === 1
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <span className="sr-only">Previous</span>
                            <ChevronLeft
                              className="h-5 w-5"
                              aria-hidden="true"
                            />
                          </button>

                          {/* Page numbers */}
                          {[...Array(totalPages)].map((_, index) => {
                            const pageNumber = index + 1;
                            // Show current page, first, last, and pages around current
                            if (
                              pageNumber === 1 ||
                              pageNumber === totalPages ||
                              (pageNumber >= currentPage - 1 &&
                                pageNumber <= currentPage + 1)
                            ) {
                              return (
                                <button
                                  key={pageNumber}
                                  onClick={() => setCurrentPage(pageNumber)}
                                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                    currentPage === pageNumber
                                      ? "bg-green-600 text-white"
                                      : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                  }`}
                                >
                                  {pageNumber}
                                </button>
                              );
                            } else if (
                              (pageNumber === currentPage - 2 &&
                                currentPage > 3) ||
                              (pageNumber === currentPage + 2 &&
                                currentPage < totalPages - 2)
                            ) {
                              // Show ellipsis
                              return (
                                <span
                                  key={pageNumber}
                                  className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300"
                                >
                                  ...
                                </span>
                              );
                            }
                            return null;
                          })}

                          <button
                            onClick={() =>
                              setCurrentPage((prev) =>
                                Math.min(prev + 1, totalPages)
                              )
                            }
                            disabled={currentPage === totalPages}
                            className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 ${
                              currentPage === totalPages
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <span className="sr-only">Next</span>
                            <ChevronRight
                              className="h-5 w-5"
                              aria-hidden="true"
                            />
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
};

export default WeekOverview;
