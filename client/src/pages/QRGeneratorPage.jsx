import React, { useEffect, useState } from "react";
import jsPDF from "jspdf";
import logoURL from "../assets/slt logo.jpg";
import "jspdf-autotable";
import { api, getAuthHeaders } from "../api/apiConfig";
import { toast, Toaster } from "react-hot-toast";
import Layout from "../components/Layout";
import { Dialog } from "@headlessui/react";
import {
  Clock,
  User,
  QrCode,
  AlertCircle,
  Check,
  X,
  Loader,
  Calendar,
  Search,
  Download,
  RefreshCw,
  QrCodeIcon,
} from "lucide-react";
import { motion } from "framer-motion";

const QRGeneratorPage = () => {
  // Generate PDF report for today's QR meeting attendance
  const generateMeetingPDF = () => {
    try {
      const doc = new jsPDF();
      const marginLeft = 14;

      // Header
      doc.setFillColor(248, 249, 250);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 40, "F");
      // Add logo
      try {
        doc.addImage(logoURL, "JPEG", marginLeft, 15, 40, 15);
      } catch (error) {}
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(70, 70, 70);
      doc.text("QR Meeting Attendance Report", marginLeft, 50);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, marginLeft, 60);
      if (displayMeetingTitle) doc.text(`Meeting Title: ${displayMeetingTitle}`, marginLeft, 70);

      // Total attendance count
      doc.text(`Total Meeting Attendance: ${attendanceLogs.length}`, marginLeft, 80);

      // Divider line
      doc.setDrawColor(230, 230, 230);
      doc.line(marginLeft, 85, doc.internal.pageSize.getWidth() - marginLeft, 85);

      // Prepare table data
      const tableData = attendanceLogs.map((log) => [
  log.traineeId || "",
  log.traineeName || "",
        log.time || "",
        (log.meetingTitles && log.meetingTitles.length > 0 ? log.meetingTitles.join(", ") : displayMeetingTitle || ""),
        log.type === "qr" ? "Meeting QR" : log.type || ""
      ]);

      doc.autoTable({
        head: [["Trainee ID", "Name", "Check-in Time", "Meeting Title", "Type"]],
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

      // Footer with page numbers
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
      }

      // Filename
      const fileName = `QR_Meeting_Attendance_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating meeting PDF:", error);
      toast.error("Failed to generate meeting PDF report");
    }
  };
  const [qrCode, setQrCode] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [displayMeetingTitle, setDisplayMeetingTitle] = useState("");
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [isExpired, setIsExpired] = useState(false); // Track QR code expiry status
  const [modalOpen, setModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchQRCode = async () => {
    if (!meetingTitle.trim()) {
      toast.error("Please enter a meeting title.", {
        duration: 3000,
        icon: <AlertCircle size={18} />,
      });
      return;
    }
    try {
      setIsLoading(true);
      const response = await api.get(
        `/qrcode/generate-meeting-qr?meetingTitle=${encodeURIComponent(meetingTitle)}`,
        getAuthHeaders()
      );
      if (response.data.qrCode) {
        setQrCode(response.data.qrCode);
        setDisplayMeetingTitle(meetingTitle);
        setIsExpired(false); // QR Code is now active
        toast.success("QR Code generated successfully!", {
          duration: 3000,
          icon: <Check size={18} />,
        });
      } else {
        toast.error("QR code not received.", {
          duration: 3000,
          icon: <X size={18} />,
        });
      }
    } catch (error) {
      console.error("QR Code error", error);
      toast.error("Failed to generate QR code", {
        duration: 3000,
        icon: <AlertCircle size={18} />,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAttendanceLogs = async () => {
    try {
      const response = await api.get("/interns", getAuthHeaders());
      const today = new Date().toDateString();
      
      console.log("Fetching attendance logs for date:", today);
      console.log("Total interns:", response.data.length);
      
      const logs = response.data
        .filter((i) => {
          const hasQRAttendance = i.attendance?.some(
            (a) => {
              const attDate = new Date(a.date).toDateString();
              const isToday = attDate === today;
              const isPresent = a.status === "Present";
              const isQRType = (a.type === "qr");
              return isToday && isPresent && isQRType;
            }
          );
          return hasQRAttendance;
        })
        .map((i) => {
          // Find ALL today's MEETING QR attendance records to handle multiple entries
          const todayAttendances = i.attendance.filter(
            (a) =>
              new Date(a.date).toDateString() === today &&
              a.status === "Present" &&
              (a.type === "qr")
          );
          // Collect all meeting titles for today
          const meetingTitles = todayAttendances
            .map(a => a.meetingName)
            .filter(Boolean);
          // Get the most recent attendance record for time/type
          const todayAttendance = todayAttendances.length > 0 
            ? todayAttendances.reduce((latest, current) => {
                const latestTime = latest.timeMarked ? new Date(latest.timeMarked) : new Date(latest.date);
                const currentTime = current.timeMarked ? new Date(current.timeMarked) : new Date(current.date);
                return currentTime > latestTime ? current : latest;
              })
            : null;
          return {
            traineeId: i.traineeId || i.Trainee_ID || "",
            traineeName: i.traineeName || i.Trainee_Name || "",
            time: todayAttendance?.timeMarked 
              ? new Date(todayAttendance.timeMarked).toLocaleTimeString()
              : new Date().toLocaleTimeString(),
            type: todayAttendance?.type || "qr",
            meetingTitles
          };
        });
      
      console.log("Filtered logs:", logs);
      console.log("Setting attendance logs to state:", logs.map(log => ({
        traineeId: log.traineeId,
        name: log.name,
        time: log.time,
        type: log.type
      })));
      setAttendanceLogs(logs);
    } catch (err) {
      console.error("Fetching logs error", err);
      toast.error("Failed to fetch attendance logs", {
        icon: <AlertCircle size={18} />,
      });
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchAttendanceLogs();
    
    // Set up interval for periodic refresh
    const interval = setInterval(fetchAttendanceLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  // Filter logs based on search term
  const filteredLogs = attendanceLogs.filter(
    (log) =>
  (log.traineeId || log.Trainee_ID || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
  (log.traineeName || log.Trainee_Name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Ensure trainee ID and name are displayed correctly in table and logs
  // If attendanceLogs are built from API, map them to use correct fields
  const displayLogs = filteredLogs.map(log => ({
  ...log,
  traineeId: log.traineeId || log.Trainee_ID || "",
  traineeName: log.traineeName || log.Trainee_Name || ""
  }));
  
  console.log("Component render - attendanceLogs state:", attendanceLogs);
  console.log("Component render - filteredLogs for display:", filteredLogs);

  return (
    <Layout>
      <Toaster position="top-right" />
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 md:mb-8">
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
                <QrCodeIcon className="h-8 w-8 sm:h-10 sm:w-10 text-green-600" />
              </motion.div>
              <div>
                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="text-2xl sm:text-3xl font-bold text-[#060B27]"
                >
                  QR Code Meeting Attendance
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="text-sm sm:text-base text-gray-500"
                >
                  Generate meeting QR codes and monitor all QR-based attendance
                </motion.p>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <input
                type="text"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
                placeholder="Enter Meeting Title"
                value={meetingTitle}
                onChange={e => setMeetingTitle(e.target.value)}
                disabled={isLoading}
              />
              <button
                className={`flex items-center justify-center gap-2 bg-blue-300 px-6 py-2.5 text-black rounded-lg hover:bg-blue-700 hover:text-white transition-colors shadow-sm w-full ${
                  isLoading ? "opacity-70 cursor-not-allowed" : ""
                }`}
                onClick={async () => {
                  if (!isLoading) {
                    await fetchQRCode();
                    setModalOpen(true);
                  }
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <>
                    <QrCode size={18} />
                    Generate QR Code
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-gray-500 text-xs sm:text-sm font-medium">
                  Total Meeting Scans Today
                </h3>
                <span className="p-2 bg-blue-50 rounded-lg">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-bold mt-2">{attendanceLogs.length}</p>
              <p className="text-xs text-gray-500 mt-1">Updated in real-time</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-gray-500 text-xs sm:text-sm font-medium">
                  QR Code Status
                </h3>
                <span
                  className={`p-2 ${
                    qrCode && !isExpired ? "bg-green-50" : "bg-red-50"
                  } rounded-lg`}
                >
                  {qrCode && !isExpired ? (
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  ) : (
                    <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                  )}
                </span>
              </div>
              <p className="text-base sm:text-lg font-semibold mt-2">
                {qrCode && !isExpired ? (
                  <span className="text-green-600">Active</span>
                ) : (
                  <span className="text-red-600">Inactive</span>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {qrCode && !isExpired
                  ? "QR code is ready for scanning"
                  : "Generate a new QR code to start"}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-gray-500 text-xs sm:text-sm font-medium">
                  Current Time
                </h3>
                <span className="p-2 bg-purple-50 rounded-lg">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                </span>
              </div>
              <p className="text-base sm:text-lg font-semibold mt-2" id="current-time">
                {new Date().toLocaleTimeString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date().toDateString()}
              </p>
            </div>
          </div>

          <Dialog
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            className="relative z-50"
          >
            <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <Dialog.Panel className="bg-white rounded-xl shadow-xl max-w-md w-full p-0 overflow-hidden">
                <div className="bg-[#00102F] p-4 text-white">
                  <Dialog.Title className="text-xl font-bold text-center">
                    QR Code Attendance Scanner
                  </Dialog.Title>
                  <p className="text-indigo-100 text-sm text-center mt-1">
                    {qrCode && !isExpired
                      ? "Active QR code ready for scanning"
                      : "QR code needs to be generated"}
                  </p>
                </div>

                <div className="p-6">
                  {qrCode && !isExpired ? (
                    <div className="flex flex-col items-center">
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <div className="relative">
                          <img
                            src={qrCode}
                            alt="QR Code"
                            className="w-64 h-64 object-contain"
                          />
                          <div className="absolute -top-2 -right-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                            <div className="w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse"></div>
                            Active
                          </div>
                        </div>
                      </div>
                      <div className="flex mt-4 gap-2 text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <p className="text-sm">{new Date().toDateString()}</p>
                      </div>
                      {displayMeetingTitle && (
                        <div className="mt-2 text-center">
                          <span className="font-semibold text-blue-700">Meeting:</span> <span className="text-gray-800">{displayMeetingTitle}</span>
                        </div>
                      )}
                      <p className="text-sm text-gray-600 mt-4 text-center">
                        Have trainees scan this QR code with the attendance app
                        to mark their presence
                      </p>
                      <div className="flex gap-3 mt-6 w-full">
                        <button className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm hover:bg-indigo-100 transition-colors">
                          <Download size={16} />
                          Save
                        </button>
                        <button className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm hover:bg-indigo-100 transition-colors">
                          <RefreshCw size={16} />
                          Refresh
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                      </div>
                      <p className="text-center text-red-500 font-medium">
                        QR code is expired or unavailable
                      </p>
                      <p className="text-sm text-gray-500 mt-2 text-center">
                        Generate a new QR code to continue tracking attendance
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-between gap-4">
                  <button
                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                    onClick={() => setModalOpen(false)}
                  >
                    <X size={16} />
                    Close
                  </button>
                  {qrCode && !isExpired ? (
                    <button
                      className="flex-1 bg-red-500 text-white px-4 py-2.5 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                      onClick={() => {
                        setIsExpired(true);
                        toast.error("QR Code expired.", {
                          icon: <AlertCircle size={18} />,
                          duration: 3000,
                        });
                        setModalOpen(false);
                      }}
                    >
                      <AlertCircle size={16} />
                      Expire Code
                    </button>
                  ) : (
                    <button
                      className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                      onClick={fetchQRCode}
                    >
                      <QrCode size={16} />
                      Regenerate
                    </button>
                  )}
                </div>
              </Dialog.Panel>
            </div>
          </Dialog>

          <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Today's Meeting QR Attendance
                  </h3>
                  <p className="text-gray-500 text-sm mt-1">
                    Trainees who have checked in via meeting QR today
                  </p>
                </div>

                <div className="relative w-full md:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search trainees..."
                    className="pl-10 pr-4 py-2 w-full bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="flex justify-end items-center mb-4">
                <button
                  onClick={generateMeetingPDF}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download QR Meeting Attendance PDF
                </button>
              </div>
              {filteredLogs.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Trainee ID
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Name
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Check-in Time
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Meeting Title
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLogs.map((log, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center">
                            <QrCode className="h-4 w-4 text-gray-400 mr-2" />
                            {log.traineeId || log.Trainee_ID || ""}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          <div className="flex items-center">
                            <User className="h-4 w-4 text-gray-400 mr-2" />
                            {log.traineeName || log.Trainee_Name || ""}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 text-gray-400 mr-2" />
                            {log.time}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {log.meetingTitles && log.meetingTitles.length > 0 ? (
                            <span className="font-medium text-blue-700">
                              {log.meetingTitles.join(", ")}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.type === 'qr' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {log.type === 'qr' ? 'Meeting' : 'Daily'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12">
                  {searchTerm ? (
                    <>
                      <Search className="mx-auto h-12 w-12 text-gray-300" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">
                        No matching records
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Try adjusting your search term
                      </p>
                    </>
                  ) : (
                    <>
                      <Calendar className="mx-auto h-12 w-12 text-gray-300" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">
                        No attendance records
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        No trainees have checked in today
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {filteredLogs.length > 0 && (
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  Showing{" "}
                  <span className="font-medium">{filteredLogs.length}</span>
                  {searchTerm ? " matching" : ""} trainees
                </p>
                {searchTerm &&
                  filteredLogs.length !== attendanceLogs.length && (
                    <p className="text-sm text-gray-500">
                      (Filtered from{" "}
                      <span className="font-medium">
                        {attendanceLogs.length}
                      </span>{" "}
                      total)
                    </p>
                  )}
              </div>
            )}
          </div>
    </Layout>
  );
};

export default QRGeneratorPage;
