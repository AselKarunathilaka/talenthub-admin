/* eslint-disable react/prop-types */
import jsPDF from "jspdf";
import "jspdf-autotable";
import logoURL from "../assets/slt logo.jpg";
import { AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  User,
  Video,
  Check,
  X,
  Search,
  Download,
  Upload,
  Filter,
  RefreshCw,
  FileText,
  Edit,
  Clock,
} from "lucide-react";

const AttendanceContent = ({
  showManualForm,
  setShowManualForm,
  manualForm,
  setManualForm,
  isSubmittingManual,
  handleManualAttendance,
  meetingName,
  setMeetingName,
  selectedDate,
  handleDateChange,
  isUploading,
  handleFileUpload,
  stats,
  showFilters,
  setShowFilters,
  filterDate,
  setFilterDate,
  filterMeeting,
  setFilterMeeting,
  applyFilters,
  clearFilters,
  searchTerm,
  setSearchTerm,
  isLoading,
  attendanceRecords,
  downloadTemplate,
}) => {
  // Group records by trainee
  const groupRecordsByTrainee = (records) => {
    const grouped = {};

    records.forEach((record) => {
      const traineeId = record.traineeId || "N/A";

      if (!grouped[traineeId]) {
        grouped[traineeId] = {
          traineeId: traineeId,
          traineeName: record.traineeName || "N/A",
          status: record.status,
          meetingDetails: [], // Changed to store meeting-method pairs
        };
      }

      // Store meeting name with its corresponding method
      const meetingName = record.meetingName || "N/A";
      const method = getMethodDisplayName(record.markedBy);

      // Check if this meeting is already added
      const existingMeeting = grouped[traineeId].meetingDetails.find(
        (detail) => detail.meeting === meetingName
      );

      if (!existingMeeting) {
        grouped[traineeId].meetingDetails.push({
          meeting: meetingName,
          method: method,
        });
      }
    });

    return Object.values(grouped);
  };

  // Helper function to convert markedBy values to display names
  const getMethodDisplayName = (markedBy) => {
    switch (markedBy) {
      case "manual_system":
        return "Manual Entry";
      case "csv_upload_system":
        return "CSV Upload";
      case "unknown":
        return "Unknown";
      default:
        return markedBy || "Unknown";
    }
  };

  // Generate PDF report for online meeting attendance
  const generateOnlineAttendancePDF = () => {
    try {
      const doc = new jsPDF();
      const marginLeft = 14;

      // Header
      doc.setFillColor(248, 249, 250);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 40, "F");

      // Add logo
      try {
        doc.addImage(logoURL, "JPEG", marginLeft, 15, 40, 15);
      } catch (error) {
        console.error("Error loading logo:", error);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(70, 70, 70);
      doc.text("Online Meeting Attendance Report", marginLeft, 50);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Date: ${new Date(selectedDate).toLocaleDateString()}`,
        marginLeft,
        60
      );

      // Total attendance count
      const totalRecords = groupRecordsByTrainee(attendanceRecords).length;
      doc.text(`Total Trainees: ${totalRecords}`, marginLeft, 70);
      doc.text(
        `Total Attendance Records: ${attendanceRecords.length}`,
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

      // Prepare table data - grouped by trainee
      const groupedRecords = groupRecordsByTrainee(attendanceRecords);
      const tableData = groupedRecords.map((record) => [
        record.traineeId || "N/A",
        record.traineeName || "N/A",
        record.meetingDetails.map((d) => d.meeting).join(", ") || "N/A",
        record.status || "N/A",
        record.meetingDetails.map((d) => d.method).join(", ") || "Unknown",
      ]);

      doc.autoTable({
        head: [["Trainee ID", "Name", "Meeting Names", "Status", "Method"]],
        body: tableData,
        startY: 95,
        theme: "grid",
        styles: {
          fontSize: 9,
          cellPadding: 5,
          lineWidth: 0.1,
          overflow: "linebreak",
        },
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
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 35 },
          2: { cellWidth: 50 },
          3: { cellWidth: 25 },
          4: { cellWidth: 35 },
        },
      });

      // Footer with page numbers
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

      // Filename
      const fileName = `Online_Attendance_Report_${selectedDate}.pdf`;
      doc.save(fileName);

      toast.success("PDF downloaded successfully!", {
        icon: <Download size={18} />,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF report", {
        icon: <AlertCircle size={18} />,
      });
    }
  };

  // Combined filtering logic for display
  const filteredRecords = attendanceRecords.filter((record) => {
    const traineeId = record.traineeId || "";
    const traineeName = record.traineeName || "";

    const matchesSearch =
      traineeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      traineeName.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  // Group the filtered records
  const groupedRecords = groupRecordsByTrainee(filteredRecords);

  return (
    <>
      {/* Manual Attendance Marking Form */}
      {showManualForm && (
        <div className="bg-gradient-to-br from-green-50 to-blue-50 shadow-md rounded-xl p-6 border-2 border-green-200 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <User className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Manual Attendance Marking
                </h3>
                <p className="text-sm text-gray-600">
                  Mark attendance for individual interns
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowManualForm(false)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Intern ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={manualForm.internId}
                  onChange={(e) =>
                    setManualForm({
                      ...manualForm,
                      internId: e.target.value,
                    })
                  }
                  placeholder="Enter intern ID"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meeting Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={manualForm.meetingName}
                  onChange={(e) =>
                    setManualForm({
                      ...manualForm,
                      meetingName: e.target.value,
                    })
                  }
                  placeholder="Enter meeting name"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={manualForm.date}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, date: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={manualForm.status}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, status: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
              <p className="text-xs text-blue-700 flex items-center gap-2">
                <Clock size={14} />
                <span>
                  <strong>Note:</strong> Time will be automatically recorded by
                  the system when you submit
                </span>
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setManualForm({
                    internId: "",
                    meetingName: "",
                    status: "Present",
                    date: new Date().toISOString().split("T")[0],
                  });
                }}
                className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                disabled={isSubmittingManual}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleManualAttendance}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmittingManual}
              >
                {isSubmittingManual ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Mark Attendance
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Name Input Section */}
      <div className="bg-white shadow-sm rounded-xl p-6 border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Video className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={meetingName}
                onChange={(e) => setMeetingName(e.target.value)}
                placeholder="Enter meeting name (e.g., Daily Standup, Sprint Review)"
                className="pl-10 pr-4 py-3 w-full bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {meetingName.trim() && (
              <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
                <Check size={14} />
                Ready to upload attendance for:{" "}
                <span className="font-medium">{meetingName}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <label
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg transition-colors shadow-sm cursor-pointer ${
                  meetingName.trim() && !isUploading
                    ? "bg-blue-300 text-black hover:bg-blue-700 hover:text-white"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Upload Report
                  </>
                )}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading || !meetingName.trim()}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-sm font-medium">Total Interns</h3>
            <span className="p-2 bg-blue-50 rounded-lg">
              <User className="h-5 w-5 text-blue-500" />
            </span>
          </div>
          <p className="text-2xl font-bold mt-2">{stats.totalInterns}</p>
          <p className="text-xs text-gray-500 mt-1">
            Tracked for selected date
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-sm font-medium">Present</h3>
            <span className="p-2 bg-green-50 rounded-lg">
              <Check className="h-5 w-5 text-green-500" />
            </span>
          </div>
          <p className="text-2xl font-bold mt-2 text-green-600">
            {stats.present}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.totalInterns > 0
              ? `${Math.round((stats.present / stats.totalInterns) * 100)}%`
              : "0%"}{" "}
            attendance rate
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-sm font-medium">Absent</h3>
            <span className="p-2 bg-red-50 rounded-lg">
              <X className="h-5 w-5 text-red-500" />
            </span>
          </div>
          <p className="text-2xl font-bold mt-2 text-red-600">{stats.absent}</p>
          <p className="text-xs text-gray-500 mt-1">Did not attend</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-sm font-medium">Meetings</h3>
            <span className="p-2 bg-orange-50 rounded-lg">
              <Video className="h-5 w-5 text-orange-500" />
            </span>
          </div>
          <p className="text-2xl font-bold mt-2">
            {stats.meetings?.length || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Total meetings today</p>
        </div>
      </div>

      {/* Meetings Breakdown */}
      {stats.meetings && stats.meetings.length > 0 && (
        <div className="bg-white shadow-sm rounded-xl p-6 border border-gray-100 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Meeting Breakdown
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.meetings.map((meeting, index) => (
              <div
                key={index}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Video className="h-4 w-4 text-blue-500" />
                  <h4 className="font-medium text-gray-800 text-sm">
                    {meeting.meetingName}
                  </h4>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600 flex items-center gap-1">
                    <Check size={14} />
                    {meeting.present} Present
                  </span>
                  <span className="text-red-600 flex items-center gap-1">
                    <X size={14} />
                    {meeting.absent} Absent
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance Records Table */}
      <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                Attendance Records
              </h3>
              <p className="text-gray-500 text-sm mt-1">
                {selectedDate && (
                  <>
                    Default Date:{" "}
                    <span className="font-medium text-blue-600">
                      {new Date(selectedDate).toLocaleDateString()}
                    </span>
                  </>
                )}
              </p>
            </div>

            <button
              className="flex items-center justify-center gap-2 bg-blue-50 px-5 py-2.5 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors shadow-sm border border-blue-200"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={18} />
              {showFilters ? "Hide" : "Show"} Filters
            </button>
          </div>

          {/* Filters Section */}
          {showFilters && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Filter Records
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Filter by Date
                  </label>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Filter by Meeting
                  </label>
                  <input
                    type="text"
                    value={filterMeeting}
                    onChange={(e) => setFilterMeeting(e.target.value)}
                    placeholder="Enter meeting name"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={applyFilters}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Apply Filters
                  </button>
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
              </div>
              {(filterDate || filterMeeting) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs text-gray-600">Active filters:</span>
                  {filterDate && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      Date: {new Date(filterDate).toLocaleDateString()}
                    </span>
                  )}
                  {filterMeeting && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      Meeting: {filterMeeting}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by trainee ID or name..."
                className="pl-10 pr-4 py-2 w-full bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            <button
              onClick={() => handleDateChange(selectedDate)}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <RefreshCw
                size={16}
                className={isLoading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-500">
                Loading attendance records...
              </p>
            </div>
          ) : groupedRecords.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trainee ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Meeting Names
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groupedRecords.map((record, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-400 mr-2" />
                        {record.traineeId}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {record.traineeName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="flex items-start">
                        <Video className="h-4 w-4 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="break-words">
                          {record.meetingDetails
                            .map((detail) => detail.meeting)
                            .join(", ")}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          record.status === "Present"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {record.status === "Present" ? (
                          <span className="flex items-center gap-1">
                            <Check size={12} />
                            Present
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <X size={12} />
                            Absent
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-start">
                        {record.meetingDetails.some(
                          (d) => d.method === "Manual Entry"
                        ) ? (
                          <Edit className="h-4 w-4 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                        )}
                        <span className="break-words">
                          {record.meetingDetails
                            .map((detail) => detail.method)
                            .join(", ")}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              {searchTerm || filterDate || filterMeeting ? (
                <>
                  <Search className="mx-auto h-12 w-12 text-gray-300" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No matching records
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your filters or search term
                  </p>
                  <button
                    onClick={clearFilters}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                  >
                    <RefreshCw size={16} />
                    Clear All Filters
                  </button>
                </>
              ) : (
                <>
                  <Upload className="mx-auto h-12 w-12 text-gray-300" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No attendance records
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Enter a meeting name and upload a Teams attendance CSV file
                    to get started
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                  >
                    <Download size={16} />
                    Download Sample Template
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {groupedRecords.length > 0 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">
                  Showing{" "}
                  <span className="font-medium">{groupedRecords.length}</span>
                  {searchTerm || filterDate || filterMeeting
                    ? " filtered"
                    : ""}{" "}
                  trainees
                </p>
                {(searchTerm || filterDate || filterMeeting) &&
                  groupedRecords.length !==
                    groupRecordsByTrainee(attendanceRecords).length && (
                    <p className="text-sm text-gray-500">
                      (Filtered from{" "}
                      <span className="font-medium">
                        {groupRecordsByTrainee(attendanceRecords).length}
                      </span>{" "}
                      total)
                    </p>
                  )}
              </div>
              {/* ADD THIS BUTTON HERE */}
              <button
                onClick={generateOnlineAttendancePDF}
                disabled={attendanceRecords.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AttendanceContent;
