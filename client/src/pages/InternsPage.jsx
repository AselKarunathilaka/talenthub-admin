import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { toast, Toaster } from "react-hot-toast";
import {
  FileSpreadsheet,
  FileText,
  Share2,
  X,
  Calendar,
  AlertTriangle,
  Search,
  Filter,
  ChevronDown,
  AlertCircle,
  UploadCloud,
  Loader2,
  CheckCircle2,
  User2,
} from "lucide-react";
import * as XLSX from "xlsx";
import Sidebar from "../components/Sidebar";
import { api, getAuthHeaders } from "../api/apiConfig";
import { markAttendance } from "../api/internApi";
import Navbar from "../components/Navbar";
import logoURL from "../assets/slt logo.jpg";
import ShareModal from "../components/ShareModal";
import "../App.css";
import { motion, AnimatePresence } from "framer-motion";

const InternsPage = () => {
  // State declarations
  const [interns, setInterns] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecialization, setSelectedSpecialization] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [file, setFile] = useState(null);
  const [dateWarning, setDateWarning] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const navigate = useNavigate();

  // Fetch all interns and update their attendance status for the selected date
  const fetchInterns = async () => {
    setLoading(true);
    try {
      const response = await api.get(
        `/interns?date=${selectedDate}`,
        getAuthHeaders()
      );

      // Process the data and ensure attendance array exists
      const internsData = response.data.map((intern) => {
        const processedIntern = intern._doc || intern;
        return {
          ...processedIntern,
          attendance: processedIntern.attendance || [], // Ensure attendance is always an array
        };
      });

      // Add attendance status for the selected date
      const updatedInterns = internsData.map((intern) => {
        const attendanceForDate = intern.attendance.find((entry) => {
          try {
            const entryDate = new Date(entry.date).toLocaleDateString();
            const selectedDateFormatted = new Date(
              selectedDate
            ).toLocaleDateString();
            return entryDate === selectedDateFormatted;
          } catch (error) {
            console.error("Error comparing dates:", error);
            return false;
          }
        });

        return {
          ...intern,
          attendanceStatus: attendanceForDate
            ? attendanceForDate.status
            : "Not Marked",
        };
      });

      setInterns(updatedInterns);
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

  // Fetch interns whenever the selected date changes or on initial render
  useEffect(() => {
    fetchInterns();
  }, [selectedDate]);

  // Reset pagination when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSpecialization, selectedDate]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (uploading) {
        e.preventDefault();
        e.returnValue =
          "You have an upload in progress. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [uploading]);

  // Handler for the date selector input change
  const handleDateChange = (e) => {
    const date = new Date(e.target.value);
    const isoDate = date.toISOString().split("T")[0];
    setSelectedDate(isoDate);
  };

  // Clear date input to default (today)
  const clearDate = () => {
    const today = new Date().toISOString().split("T")[0];
    setSelectedDate(today);
  };

  // Filter interns on the client side based on search criteria
  const filteredInterns = interns.filter((intern) => {
    const searchTermLower = searchTerm.toLowerCase();

    // Check if any field matches the search term
    const matchesSearchTerm =
      intern.traineeId?.toLowerCase().includes(searchTermLower) ||
      intern.traineeName?.toLowerCase().includes(searchTermLower) ||
      intern.team?.toLowerCase().includes(searchTermLower) ||
      !searchTerm;

    const specializationMatch =
      selectedSpecialization === "" ||
      intern.fieldOfSpecialization === selectedSpecialization;

    return matchesSearchTerm && specializationMatch;
  });

  // Mark attendance for a specific intern for the selected date
  const handleMarkAttendance = async (id, status) => {
    if (!id) {
      toast.error("Intern ID is missing or undefined!");
      return;
    }

    const intern = interns.find((intern) => intern._id === id);
    if (!intern) {
      toast.error("Intern not found!");
      return;
    }

    try {
      const response = await markAttendance(id, status, selectedDate, 'manual');

      if (response.status === 200) {
        fetchInterns();
        toast.success(
          `Attendance marked as ${status} for ${intern.traineeName}`
        );
      }
    } catch (error) {
      console.error(
        "Error marking attendance:",
        error.response?.data || error.message
      );
      toast.error("Error marking attendance. Make sure you are logged in.");
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredInterns.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentInterns = filteredInterns.slice(
    indexOfFirstItem,
    indexOfLastItem
  );

  const paginate = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    setCurrentPage(pageNumber);
  };

  // Get a unique list of specializations for the dropdown
  const uniqueSpecializations = Array.from(
    new Set(
      interns.map((intern) => intern.fieldOfSpecialization).filter(Boolean)
    )
  );

  // Generate PDF report of intern attendance
  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      const marginLeft = 14;

      // Draw header bar
      doc.setFillColor(248, 249, 250);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 40, "F");

      // Add logo
      const logoWidth = 40;
      const logoHeight = 15;
      try {
        doc.addImage(logoURL, "JPEG", marginLeft, 15, logoWidth, logoHeight);
      } catch (error) {
        console.error("Error adding logo:", error);
      }

      // Sort interns by traineeId
      const sortedInterns = [...filteredInterns].sort((a, b) =>
        (a.traineeId || "").localeCompare(b.traineeId || "")
      );

      // Prepare table data
      const tableData = sortedInterns
        .map((intern) => {
          const attendanceForDate = (intern.attendance || []).find((entry) => {
            try {
              const entryDate = new Date(entry.date).toLocaleDateString();
              const selectedDateFormatted = new Date(
                selectedDate
              ).toLocaleDateString();
              return entryDate === selectedDateFormatted;
            } catch (error) {
              return false;
            }
          });

          if (!attendanceForDate) return null;

          return [
            intern.traineeId || "",
            intern.traineeName || "",
            intern.fieldOfSpecialization || "",
            intern.team || "",
            attendanceForDate.status || "",
          ];
        })
        .filter(Boolean);

      const totalAttendanceCount = tableData.length;

      // Header texts
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(70, 70, 70);
      doc.text("Intern Attendance Report", marginLeft, 50);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Date: ${selectedDate}`, marginLeft, 60);

      // Update sortingInfo without searchTeam
      let sortingInfo = `Sorted by: ${selectedSpecialization || "None"}`;
      if (searchTerm) sortingInfo += ` • Search: "${searchTerm}"`;
      doc.text(sortingInfo, marginLeft, 70);

      doc.text(
        `Total Attendance Count: ${totalAttendanceCount}`,
        marginLeft,
        80
      );

      // Divider line
      doc.setDrawColor(230, 230, 230);
      doc.line(
        marginLeft,
        85,
        doc.internal.pageSize.getWidth() - marginLeft,
        85
      );

      // Auto-generate table
      doc.autoTable({
        head: [
          [
            "Trainee ID",
            "Name",
            "Field of Specialization",
            "Team",
            "Attendance",
          ],
        ],
        body: tableData,
        startY: 95,
        theme: "grid",
        styles: { fontSize: 10, cellPadding: 6, lineWidth: 0.1 },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: "bold",
          lineColor: [220, 220, 220],
        },
        bodyStyles: {
          fillColor: 255,
          textColor: 80,
          lineColor: [240, 240, 240],
        },
        alternateRowStyles: { fillColor: [252, 252, 252] },
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

      // Use selectedDate for the filename
      const fileName = `Attendance_Report_${selectedDate.replace(
        /-/g,
        "_"
      )}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF report");
    }
  };

  // Generate Excel report of intern attendance
  const generateExcel = () => {
    try {
      const headers = [
        "Trainee ID",
        "Name",
        "Field of Specialization",
        "Team",
        "Attendance",
      ];
      const excelData = filteredInterns.map((intern) => {
        const attendanceForDate = (intern.attendance || []).find((entry) => {
          try {
            const entryDate = new Date(entry.date).toLocaleDateString();
            const selectedDateFormatted = new Date(
              selectedDate
            ).toLocaleDateString();
            return entryDate === selectedDateFormatted;
          } catch (error) {
            return false;
          }
        });

        return [
          intern.traineeId || "",
          intern.traineeName || "",
          intern.fieldOfSpecialization || "",
          intern.team || "",
          attendanceForDate ? attendanceForDate.status : "Not Marked",
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...excelData]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Intern Attendance");

      ws["!cols"] = [
        { wch: 15 },
        { wch: 30 },
        { wch: 25 },
        { wch: 20 },
        { wch: 15 },
      ];

      const fileName = `intern-attendance-report-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Excel file downloaded successfully!");
    } catch (error) {
      console.error("Error generating Excel:", error);
      toast.error("Failed to generate Excel report");
    }
  };

  // File input change handler
  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFile(file);
      setUploadSuccess(false);
    }
  };

  // Upload file for adding interns
  // Upload file for adding interns
  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file first.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const headers = {
        "Content-Type": "multipart/form-data",
        ...getAuthHeaders().headers,
      };

      // Add progress event listener
      const config = {
        headers,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      };

      const response = await api.post("/interns/upload", formData, config);

      if (response.data.addedCount > 0) {
        setUploadSuccess(true);
        toast.success(
          `${response.data.addedCount} interns added successfully!`
        );
        await fetchInterns();

        // Reset after success
        setTimeout(() => {
          setUploadSuccess(false);
          setSelectedFile(null);
          setFile(null);
        }, 2000);
      } else {
        toast.error("No new interns were added.");
      }
    } catch (error) {
      console.error("Error uploading:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Error uploading file. Please try again.";
      toast.error(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Share click function
  const handleShareClick = () => {
    setShowModal(true);
  };

  // Close the modal
  const closeModal = () => {
    setShowModal(false);
  };

  return (
    <div className="flex flex-col md:flex-row relative">
      {/* Full-page loading overlay during upload */}
      {uploading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex flex-col items-center justify-center">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
            <Loader2 className="animate-spin h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Uploading File...
            </h3>
            <p className="text-gray-600 mb-4">
              Please wait while we process your file. Do not refresh or close
              the page.
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500 mt-2">This may take a while</p>
          </div>
        </div>
      )}

      <Navbar />
      <Sidebar />
      <div
        className={`flex-1 bg-gray-50 p-8 space-y-6 mt-24 ${
          uploading ? "opacity-50" : ""
        }`}
      >
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                  delay: 0.2
                }}
                className="p-4 rounded-2xl"
              >
                <User2 className="h-10 w-auto text-4xl text-green-600" />
              </motion.div>
              <div>
                <motion.h1 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="text-3xl font-bold text-[#060B27]"
                >
                  Intern Managment
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="text-gray-500"
                >
                  Manage your interns efficiently and effectively.
                </motion.p>
              </div>
            </div>
          <div className="flex items-center gap-3">
            {/* File Input */}
            <div className="relative">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={uploading}
              />
              <label
                htmlFor="file-upload"
                className={`cursor-pointer p-3 border ${
                  uploadSuccess
                    ? "border-green-500 bg-green-50"
                    : "border-[#4FB846] hover:bg-gray-50"
                } rounded-lg transition-colors duration-200 inline-flex items-center gap-2 w-60`}
              >
                {uploadSuccess ? (
                  <>
                    <CheckCircle2 className="text-green-500" size={18} />
                    <span className="truncate text-green-700">
                      Upload Successful!
                    </span>
                  </>
                ) : selectedFile ? (
                  <>
                    <FileText size={18} className="text-gray-500" />
                    <span className="truncate text-gray-600">
                      {selectedFile.name}
                    </span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={18} className="text-gray-500" />
                    <span className="text-gray-600">Choose Excel File</span>
                  </>
                )}
              </label>
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile || uploadSuccess}
              className={`bg-[#0D103A] text-white font-semibold py-3 px-8 rounded-lg hover:bg-[#0D103A]/90 transition duration-200 shadow-sm ${
                uploading || !selectedFile || uploadSuccess
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              Upload
            </button>
          </div>
        </div>

        {/* Search & Export Controls */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8 p-4 bg-white rounded-xl shadow-lg">
          {/* Search & Filter Section */}
          <div className="flex flex-wrap gap-3 items-center flex-1">
            {/* Search Input with Icon */}
            <div className="relative w-full sm:w-64">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder="Search by ID, Name, or Team"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setSearchTerm("")}
                className="p-3 pl-10 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 text-gray-400"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Specialization Dropdown */}
            <div className="relative w-full sm:w-64">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Filter size={18} />
              </div>
              <select
                value={selectedSpecialization}
                onChange={(e) => setSelectedSpecialization(e.target.value)}
                className="p-3 pl-10 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm appearance-none"
              >
                <option value="">All Specializations</option>
                {uniqueSpecializations.map((spec, index) => (
                  <option key={index} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                <ChevronDown size={18} />
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Selector with Enhanced Warning */}
            <div className="relative w-full sm:w-auto">
              <div className="absolute -top-2 left-3 px-2 bg-white text-xs font-semibold text-gray-600 z-10">
                Select Date
              </div>

              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500">
                  <Calendar size={18} />
                </div>

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    const currentDate = new Date().toISOString().split("T")[0];

                    handleDateChange(e);

                    // Check if selected date is before current date
                    if (newDate < currentDate) {
                      setDateWarning(true);
                    } else {
                      setDateWarning(false);
                    }
                  }}
                  max={new Date().toISOString().split("T")[0]}
                  className={`p-3 pl-10 pr-10 w-full border-2 ${
                    dateWarning ? "border-yellow-500" : "border-gray-200"
                  } rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all duration-200`}
                />

                {selectedDate && (
                  <button
                    onClick={() => {
                      clearDate();
                      setDateWarning(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors duration-200"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Enhanced Warning Message */}
              {dateWarning && (
                <div className="absolute -bottom-12 left-0 right-0 flex items-center gap-2 text-sm font-medium text-white bg-yellow-500 px-3 py-2 rounded-lg shadow-md animate-slideIn z-20">
                  <AlertTriangle size={30} />
                  <span>Warning: You've selected a past date!</span>
                </div>
              )}
            </div>

            {/* Export & Share Buttons */}
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={generatePDF}
                className="bg-blue-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-all duration-200 hover:shadow-md"
              >
                <FileText size={18} />
                <span className="font-medium">Report</span>
              </button>

              <button
                onClick={generateExcel}
                className="bg-green-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-all duration-200 hover:shadow-md"
              >
                <FileSpreadsheet size={18} />
                <span className="font-medium">Excel</span>
              </button>

              <button
                onClick={handleShareClick}
                className="bg-[#0ea5e9] text-white px-4 py-2.5 rounded-lg flex items-center gap-2 hover:bg-[#0284c7] transition-all duration-200 hover:shadow-md"
              >
                <Share2 size={18} />
                <span className="font-medium">Share</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">
              Loading interns data...
            </p>
          </div>
        )}

        <ShareModal
          showModal={showModal}
          closeModal={closeModal}
          internData={filteredInterns}
          selectedDate={selectedDate}
          selectedSpecialization={selectedSpecialization}
          searchTerm={searchTerm}
        />

        {/* Interns Table */}
        {!loading && (
          <>
            <div className="overflow-x-auto shadow-md rounded-lg bg-white">
              <table className="w-full border-collapse table-auto">
                <thead className="bg-gray-100">
                  <tr className="text-left text-sm text-gray-600">
                    <th className="p-4">Trainee ID</th>
                    <th className="p-4">Name</th>
                    <th className="p-4">Field of Specialization</th>
                    <th className="p-4">Team</th>
                    <th className="p-4 text-center">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {currentInterns.length > 0 ? (
                    currentInterns.map((intern) => (
                      <tr
                        key={intern._id}
                        className="hover:bg-gray-50 transition-all cursor-pointer"
                        onClick={() => navigate(`/attendance/${intern._id}`)}
                      >
                        <td className="p-4 border-b">
                          {intern.traineeId || ""}
                        </td>
                        <td className="p-4 border-b">
                          {intern.traineeName || ""}
                        </td>
                        <td className="p-4 border-b">
                          {intern.fieldOfSpecialization || ""}
                        </td>
                        <td className="p-4 border-b">{intern.team || ""}</td>
                        <td className="p-4 border-b text-center">
                          <div className="flex justify-center gap-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAttendance(intern._id, "Present");
                              }}
                              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                                intern.attendanceStatus === "Present"
                                  ? "bg-green-700 text-white"
                                  : "bg-green-100 text-gray-500 hover:bg-green-200"
                              }`}
                            >
                              ✅ Present
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAttendance(intern._id, "Absent");
                              }}
                              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                                intern.attendanceStatus === "Absent"
                                  ? "bg-red-700 text-white"
                                  : "bg-red-100 text-gray-500 hover:bg-red-200"
                              }`}
                            >
                              ❌ Absent
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="p-4 text-center text-gray-500">
                        No interns found matching your criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredInterns.length > 0 && (
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300"
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast notifications */}
      <Toaster position="top-right" />
    </div>
  );
};

export default InternsPage;
