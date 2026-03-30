import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import logoURL from "../assets/slt logo.jpg";
import { toast, Toaster } from "react-hot-toast";
import { api, getAuthHeaders } from "../api/apiConfig";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { motion } from "framer-motion";
import {
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Calendar,
  Users,
  Briefcase,
  AlertCircle,
  Loader2,
  UserCheck,
} from "lucide-react";

const AvailableIntern = () => {
  const [interns, setInterns] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDay, setSelectedDay] = useState("All");
  const [selectedCount, setSelectedCount] = useState("All");
  const [selectedSpecialization, setSelectedSpecialization] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const internsPerPage = 10;

  useEffect(() => {
    const fetchInterns = async () => {
      try {
        setLoading(true);
        const res = await api.get("/interns", getAuthHeaders());
        setInterns(res.data);
        setFiltered(res.data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching interns:", error);
        toast.error("Failed to fetch interns data");
        setLoading(false);
      }
    };
    fetchInterns();
  }, []);

  useEffect(() => {
    filterInterns();
  }, [searchTerm, selectedDay, selectedCount, selectedSpecialization]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value.toLowerCase());
    setCurrentPage(1);
  };

  const handleDayChange = (e) => {
    setSelectedDay(e.target.value);
    setCurrentPage(1);
  };

  const handleCountChange = (e) => {
    setSelectedCount(e.target.value);
    setCurrentPage(1);
  };

  const handleSpecializationChange = (e) => {
    setSelectedSpecialization(e.target.value);
    setCurrentPage(1);
  };

  const filterInterns = () => {
    let result = [...interns];

    if (searchTerm) {
      result = result.filter(
        (intern) =>
          intern.traineeId.toString().includes(searchTerm) ||
          intern.traineeName.toLowerCase().includes(searchTerm)
      );
    }

    if (selectedDay !== "All") {
      result = result.filter((intern) =>
        intern.availableDays.includes(selectedDay)
      );
    }

    if (selectedCount !== "All") {
      result = result.filter(
        (intern) => intern.availableDays.length === parseInt(selectedCount)
      );
    }

    if (selectedSpecialization !== "All") {
      result = result.filter(
        (intern) => intern.fieldOfSpecialization === selectedSpecialization
      );
    }

    setFiltered(result);
  };

  const getDayStatus = (availableDays, day) =>
    availableDays.includes(day) ? "Yes" : "No";

  // --------------------- EXCEL REPORT ---------------------
  const handleExportExcel = () => {
    const data = filtered.map((intern) => ({
      "Trainee ID": intern.traineeId,
      "Name": intern.traineeName,
      "Field": intern.fieldOfSpecialization,
      "Monday": getDayStatus(intern.availableDays, "Monday"),
      "Tuesday": getDayStatus(intern.availableDays, "Tuesday"),
      "Wednesday": getDayStatus(intern.availableDays, "Wednesday"),
      "Thursday": getDayStatus(intern.availableDays, "Thursday"),
      "Friday": getDayStatus(intern.availableDays, "Friday"),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Available Interns");
    XLSX.writeFile(workbook, "Available_Interns_Report.xlsx");
    
    toast.success("Excel report downloaded successfully");
  };

  // --------- ORIGINAL PDF FUNCTION AS PROVIDED ---------
  // const handleExportPDF = () => {
  //   try {
  //     const doc = new jsPDF();
  //     const marginLeft = 14;
  
  //     // Header background
  //     doc.setFillColor(248, 249, 250);
  //     doc.rect(0, 0, doc.internal.pageSize.getWidth(), 40, "F");
  
  //     // Add logo
  //     const logoWidth = 40;
  //     const logoHeight = 15;
  //     try {
  //       doc.addImage(logoURL, "JPEG", marginLeft, 15, logoWidth, logoHeight);
  //     } catch (error) {
  //       console.error("Error adding logo:", error);
  //     }
  
  //     // Title
  //     doc.setFont("helvetica", "bold");
  //     doc.setFontSize(16);
  //     doc.setTextColor(70, 70, 70);
  //     doc.text("Available Interns Report", marginLeft, 50);
  
  //     // Info section
  //     doc.setFontSize(10);
  //     doc.setTextColor(100, 100, 100);
  
  //     const dayText = selectedDay !== "All" ? selectedDay : "None";
  //     const countText = selectedCount !== "All" ? selectedCount : "None";
  //     const specializationText = selectedSpecialization !== "All" ? selectedSpecialization : "None";
  
  //     // Only date (YYYY-MM-DD)
  //     const today = new Date().toISOString().split("T")[0];
  
  //     doc.text(`Filtered Day: ${dayText}`, marginLeft, 60);
  //     doc.text(`Available Day Count: ${countText}`, marginLeft, 67);
  //     doc.text(`Specialization: ${specializationText}`, marginLeft, 74);
  //     doc.text(`Total Interns: ${filtered.length}`, marginLeft, 81);
  //     doc.text(`Generated Date: ${today}`, marginLeft, 88);
  
  //     // Divider
  //     doc.setDrawColor(230, 230, 230);
  //     doc.line(marginLeft, 92, doc.internal.pageSize.getWidth() - marginLeft, 92);
  
  //     // Table
  //     const tableColumn = ["Trainee ID", "Name", "Field"];
  //     const tableRows = filtered.map((intern) => [
  //       intern.traineeId || "",
  //       intern.traineeName || "",
  //       intern.fieldOfSpecialization || "",
  //     ]);
  
  //     doc.autoTable({
  //       head: [tableColumn],
  //       body: tableRows,
  //       startY: 100,
  //       theme: "grid",
  //       styles: { fontSize: 10, cellPadding: 6, lineWidth: 0.1 },
  //       headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", lineColor: [220, 220, 220] },
  //       bodyStyles: { fillColor: 255, textColor: 80, lineColor: [240, 240, 240] },
  //       alternateRowStyles: { fillColor: [252, 252, 252] },
  //     });
  
  //     // Footer with pagination
  //     const pageCount = doc.internal.getNumberOfPages();
  //     for (let i = 1; i <= pageCount; i++) {
  //       doc.setPage(i);
  //       doc.setFontSize(9);
  //       doc.setTextColor(150, 150, 150);
  //       const pageWidth = doc.internal.pageSize.getWidth();
  //       doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
  //     }
  
  //     const fileName = `Available_Interns_${dayText.replace(/\s/g, "_")}.pdf`;
  //     doc.save(fileName);
      
  //     toast.success("PDF report downloaded successfully");
  
  //   } catch (error) {
  //     console.error("Error generating PDF:", error);
  //     toast.error("Failed to generate PDF report");
  //   }
  // };
  const handleExportPDF = () => {
    const noFiltersApplied =
      searchTerm.trim() === "" &&
      selectedDay === "All" &&
      selectedCount === "All" &&
      selectedSpecialization === "All";
  
    if (noFiltersApplied) {
      toast.error("Please apply at least one filter before generating the report.");
      return;
    }
  
    try {
      const doc = new jsPDF();
      const marginLeft = 14;
  
      // Header background
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
  
      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(70, 70, 70);
      doc.text("Available Interns Report", marginLeft, 50);
  
      // Info section
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
  
      const dayText = selectedDay !== "All" ? selectedDay : "None";
      const countText = selectedCount !== "All" ? selectedCount : "None";
      const specializationText = selectedSpecialization !== "All" ? selectedSpecialization : "None";
      const today = new Date().toISOString().split("T")[0];
  
      doc.text(`Filtered Day: ${dayText}`, marginLeft, 60);
      doc.text(`Available Day Count: ${countText}`, marginLeft, 67);
      doc.text(`Specialization: ${specializationText}`, marginLeft, 74);
      doc.text(`Total Interns: ${filtered.length}`, marginLeft, 81);
      doc.text(`Generated Date: ${today}`, marginLeft, 88);
  
      doc.setDrawColor(230, 230, 230);
      doc.line(marginLeft, 92, doc.internal.pageSize.getWidth() - marginLeft, 92);
  
      // Table
      const tableColumn = ["Trainee ID", "Name", "Field"];
      const tableRows = filtered.map((intern) => [
        intern.traineeId || "",
        intern.traineeName || "",
        intern.fieldOfSpecialization || "",
      ]);
  
      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 100,
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
  
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, {
          align: "center",
        });
      }
  
      const fileName = `Available_Interns_${dayText.replace(/\s/g, "_")}.pdf`;
      doc.save(fileName);
  
      toast.success("PDF report downloaded successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF report");
    }
  };
  

  const totalPages = Math.ceil(filtered.length / internsPerPage);
  const currentData = filtered.slice(
    (currentPage - 1) * internsPerPage,
    currentPage * internsPerPage
  );

  const specializations = ["All", ...Array.from(new Set(interns.map(i => i.fieldOfSpecialization)))];

  const renderPagination = () => {
    const pages = [];
    pages.push(
      <button
        key="prev"
        disabled={currentPage === 1}
        onClick={() => setCurrentPage((prev) => prev - 1)}
        className="flex items-center justify-center w-9 h-9 rounded-md border border-gray-200 bg-white text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>
    );

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        pages.push(
          <button
            key={i}
            onClick={() => setCurrentPage(i)}
            className={`flex items-center justify-center w-9 h-9 rounded-md border ${
              i === currentPage
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-gray-700 border-gray-200 hover:bg-green-50 hover:border-green-200"
            } transition-colors`}
            aria-label={`Page ${i}`}
            aria-current={i === currentPage ? "page" : undefined}
          >
            {i}
          </button>
        );
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        pages.push(
          <span key={`ellipsis-${i}`} className="flex items-center justify-center w-9 h-9 text-gray-400">
            ...
          </span>
        );
      }
    }

    pages.push(
      <button
        key="next"
        disabled={currentPage === totalPages || totalPages === 0}
        onClick={() => setCurrentPage((prev) => prev + 1)}
        className="flex items-center justify-center w-9 h-9 rounded-md border border-gray-200 bg-white text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    );

    return <div className="flex items-center space-x-2">{pages}</div>;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-x-hidden">
        <Navbar />
        <Toaster position="top-right" />
       
        <div className="p-6 mt-24 flex-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
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
                <UserCheck className="h-10 w-auto text-4xl text-green-600" />
              </motion.div>
              <div>
                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="text-3xl font-bold text-[#060B27]"
                >
                  Available Interns
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="text-gray-500"
                >
                  Manage and view available interns by day and specialization
                </motion.p>
              </div>
            </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleExportExcel}
                  className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm hover:shadow"
                >
                  <FileSpreadsheet size={18} className="text-green-600" />
                  <span className="font-medium">Export Excel</span>
                </button>
                
                <button
                  onClick={handleExportPDF}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-all shadow-sm hover:shadow"
                >
                  <FileText size={18} />
                  <span className="font-medium">Generate Report</span>
                </button>
              </div>
            </div>
            
            {/* Filter section */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100">
              <div className="flex items-center mb-3">
                <Filter size={18} className="text-gray-500 mr-2" />
                <h3 className="font-medium text-gray-700">Filters</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by ID or Name"
                    value={searchTerm}
                    onChange={handleSearch}
                    className="block w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                  />
                </div>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar size={16} className="text-gray-400" />
                  </div>
                  <select 
                    value={selectedDay} 
                    onChange={handleDayChange} 
                    className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 appearance-none bg-white transition-all"
                  >
                    <option value="All">All Days</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <ChevronDown size={16} className="text-gray-400" />
                  </div>
                </div>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users size={16} className="text-gray-400" />
                  </div>
                  <select 
                    value={selectedCount} 
                    onChange={handleCountChange} 
                    className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 appearance-none bg-white transition-all"
                  >
                    <option value="All">All Day Counts</option>
                    <option value="1">1 day available</option>
                    <option value="2">2 days available</option>
                    <option value="3">3 days available</option>
                    <option value="4">4 days available</option>
                    <option value="5">5 days available</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <ChevronDown size={16} className="text-gray-400" />
                  </div>
                </div>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Briefcase size={16} className="text-gray-400" />
                  </div>
                  <select 
                    value={selectedSpecialization} 
                    onChange={handleSpecializationChange} 
                    className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 appearance-none bg-white transition-all"
                  >
                    {specializations.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec === "All" ? "All Specializations" : spec}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <ChevronDown size={16} className="text-gray-400" />
                  </div>
                </div>
              </div>
              
              {filtered.length === 0 && !loading && (
                <div className="mt-4 py-2 px-4 bg-amber-50 border border-amber-100 rounded-lg flex items-center">
                  <AlertCircle size={16} className="text-amber-600 mr-2" />
                  <span className="text-amber-700 text-sm">No interns match your filter criteria. Try adjusting your filters.</span>
                </div>
              )}
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h4 className="text-sm font-medium text-blue-700 mb-1">Total Interns</h4>
                <div className="text-2xl font-bold text-blue-800">{filtered.length}</div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <h4 className="text-sm font-medium text-green-700 mb-1">Selected Day</h4>
                <div className="text-2xl font-bold text-green-800">
                  {selectedDay === "All" ? "All Days" : selectedDay}
                </div>
              </div>
              
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                <h4 className="text-sm font-medium text-indigo-700 mb-1">Selected Field</h4>
                <div className="text-xl font-bold text-indigo-800 truncate">
                  {selectedSpecialization === "All" ? "All Specializations" : selectedSpecialization}
                </div>
              </div>
            </div>
            
            {/* Table */}
            <div className="overflow-auto rounded-lg border border-gray-200 shadow-sm">
              {loading ? (
                <div className="flex items-center justify-center p-12 bg-white">
                  <Loader2 size={32} className="animate-spin text-green-600" />
                  <span className="ml-3 text-gray-600 font-medium">Loading intern data...</span>
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3 text-sm font-semibold text-gray-600 border-b">Trainee ID</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-600 border-b">Name</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-600 text-center border-b">Field</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-600 text-center border-b">Mon</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-600 text-center border-b">Tue</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-600 text-center border-b">Wed</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-600 text-center border-b">Thu</th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-600 text-center border-b">Fri</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentData.length > 0 ? (
                      currentData.map((intern, index) => (
                        <tr 
                          key={intern._id} 
                          className={`text-gray-700 hover:bg-gray-50 transition ${
                            index === currentData.length - 1 ? "" : "border-b border-gray-200"
                          }`}
                        >
                          <td className="px-4 py-3">{intern.traineeId}</td>
                          <td className="px-4 py-3 font-medium">{intern.traineeName}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                              {intern.fieldOfSpecialization}
                            </span>
                          </td>
                          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                            <td key={day} className="p-3 text-center">
                              {intern.availableDays.includes(day) ? (
                                <Check size={18} className="text-green-600 mx-auto" />
                              ) : (
                                <X size={18} className="text-red-500 mx-auto" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-500 bg-white">
                          {loading ? 
                            "Loading data..." : 
                            "No interns found matching your criteria"
                          }
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {currentData.length > 0 && (
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-6">
                <p className="text-sm text-gray-600">
                  Showing {filtered.length > 0 ? (currentPage - 1) * internsPerPage + 1 : 0} to{" "}
                  {Math.min(currentPage * internsPerPage, filtered.length)} of {filtered.length} interns
                </p>
                {renderPagination()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailableIntern;