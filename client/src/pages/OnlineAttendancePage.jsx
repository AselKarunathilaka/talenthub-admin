import { useState, useEffect } from "react";
import { api, getAuthHeaders } from "../api/apiConfig";
import { toast, Toaster } from "react-hot-toast";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { Video, AlertCircle, Check, Download } from "lucide-react";
import { motion } from "framer-motion";
import AttendanceContent from "./OnlineAttendanceContent";

const OnlineAttendancePage = () => {
  // Add mobile menu state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [meetingName, setMeetingName] = useState("");
  const [stats, setStats] = useState({
    totalInterns: 0,
    present: 0,
    absent: 0,
    meetings: [],
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [filterMeeting, setFilterMeeting] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({
    internId: "",
    meetingName: "",
    status: "Present",
    date: new Date().toISOString().split("T")[0],
  });
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // Fetch attendance records for selected date
  const fetchAttendanceByDate = async (date) => {
    setIsLoading(true);
    try {
      const response = await api.get(
        `/online-attendance/date?date=${date}`,
        getAuthHeaders()
      );

      if (response.data && response.data.records) {
        setAttendanceRecords(response.data.records);
        toast.success(`Loaded ${response.data.totalRecords} records`, {
          icon: <Check size={18} />,
        });
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch attendance records",
        {
          icon: <AlertCircle size={18} />,
        }
      );
      setAttendanceRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch attendance statistics
  const fetchStats = async (date) => {
    try {
      const response = await api.get(
        `/online-attendance/stats?date=${date}`,
        getAuthHeaders()
      );

      if (response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  // Fetch attendance by meeting name
  const fetchAttendanceByMeeting = async (meetingName) => {
    if (!meetingName) {
      toast.error("Please enter a meeting name", {
        icon: <AlertCircle size={18} />,
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.get(
        `/online-attendance/meeting?meetingName=${encodeURIComponent(
          meetingName
        )}`,
        getAuthHeaders()
      );

      if (response.data && response.data.records) {
        setAttendanceRecords(response.data.records);
        toast.success(
          `Loaded ${response.data.totalRecords} records for "${meetingName}"`,
          {
            icon: <Check size={18} />,
          }
        );
      }
    } catch (error) {
      console.error("Error fetching attendance by meeting:", error);
      toast.error("Failed to fetch attendance by meeting", {
        icon: <AlertCircle size={18} />,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    fetchAttendanceByDate(selectedDate);
    fetchStats(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update data when date changes
  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    fetchAttendanceByDate(newDate);
    fetchStats(newDate);
  };

  // Parse Teams CSV file
  const parseTeamsCSV = (csvText) => {
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) {
      toast.error("CSV file is empty or invalid", {
        icon: <AlertCircle size={18} />,
      });
      return [];
    }

    const records = [];
    const headerLine = lines[0];
    const separator = headerLine.includes("\t")
      ? "\t"
      : headerLine.includes(";")
      ? ";"
      : ",";

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fields = line.split(separator).map((f) => f.trim());

      if (fields.length < 3) {
        console.warn(`Skipping invalid line ${i + 1}: insufficient fields`);
        continue;
      }

      const fullName = fields[0].replace(/^"|"$/g, "").trim();
      const action = fields[1].replace(/^"|"$/g, "").trim();
      const timestamp = fields[2].replace(/^"|"$/g, "").trim();

      if (!fullName || !action || !timestamp) {
        console.warn(`Skipping line ${i + 1}: missing data`);
        continue;
      }

      records.push({
        "Full Name": fullName,
        "User Action": action,
        Timestamp: timestamp,
      });
    }

    console.log(`Parsed ${records.length} records from CSV`);
    console.table(records.slice(0, 5));
    return records;
  };

  // Handle file upload and send to backend
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!meetingName.trim()) {
      toast.error("Please enter a meeting name before uploading", {
        icon: <AlertCircle size={18} />,
      });
      event.target.value = "";
      return;
    }

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file", {
        icon: <AlertCircle size={18} />,
      });
      return;
    }

    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const csvText = e.target?.result;
        if (typeof csvText === "string") {
          const records = parseTeamsCSV(csvText);

          if (records.length > 0) {
            try {
              console.log("Sending attendance data to backend...");

              const response = await api.post(
                "/online-attendance/upload",
                {
                  csvData: records,
                  date: selectedDate,
                  meetingName: meetingName.trim(),
                },
                getAuthHeaders()
              );

              if (response.data) {
                console.log("Backend response:", response.data);

                toast.success(
                  `Successfully processed ${response.data.success} attendance records for "${meetingName}"`,
                  {
                    icon: <Check size={18} />,
                    duration: 4000,
                  }
                );

                if (response.data.failed > 0) {
                  toast.error(
                    `${response.data.failed} records failed to process. Check console for details.`,
                    {
                      icon: <AlertCircle size={18} />,
                      duration: 5000,
                    }
                  );
                  console.error("Failed records:", response.data.errors);
                }

                await fetchAttendanceByDate(selectedDate);
                await fetchStats(selectedDate);
                setMeetingName("");
              }
            } catch (apiError) {
              console.error("API Error:", apiError);
              toast.error(
                apiError.response?.data?.message ||
                  "Failed to save attendance to database",
                {
                  icon: <AlertCircle size={18} />,
                  duration: 5000,
                }
              );
            }
          } else {
            toast.error("No valid records found in CSV", {
              icon: <AlertCircle size={18} />,
            });
          }
        }
        setIsUploading(false);
      };

      reader.onerror = () => {
        toast.error("Failed to read file", {
          icon: <AlertCircle size={18} />,
        });
        setIsUploading(false);
      };

      reader.readAsText(file);
    } catch (error) {
      console.error("File upload error", error);
      toast.error("Failed to process file", {
        icon: <AlertCircle size={18} />,
      });
      setIsUploading(false);
    }

    event.target.value = "";
  };

  // Download template CSV
  const downloadTemplate = () => {
    const template = `Full Name,User Action,Timestamp
John Doe_1234,Joined,10/14/25 9:48:15 PM
John Doe_1234,Left,10/14/25 11:18:15 PM
Jane Smith_5678,Joined,10/14/25 9:49:08 PM
Jane Smith_5678,Left,10/14/25 11:19:08 PM
Mike Johnson_9012,Joined,10/14/25 9:50:00 PM
Mike Johnson_9012,Left,10/14/25 11:20:00 PM`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "teams_attendance_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success("Template downloaded successfully", {
      icon: <Download size={18} />,
    });
  };

  // Apply combined filters
  const applyFilters = () => {
    if (filterDate && filterMeeting) {
      setIsLoading(true);
      api
        .get(
          `/online-attendance/meeting?meetingName=${encodeURIComponent(
            filterMeeting
          )}`,
          getAuthHeaders()
        )
        .then((response) => {
          if (response.data && response.data.records) {
            const filteredByDate = response.data.records.filter(
              (record) =>
                new Date(record.date).toISOString().split("T")[0] === filterDate
            );
            setAttendanceRecords(filteredByDate);
            toast.success(`Loaded ${filteredByDate.length} records`, {
              icon: <Check size={18} />,
            });
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          toast.error("Failed to fetch filtered records", {
            icon: <AlertCircle size={18} />,
          });
        })
        .finally(() => setIsLoading(false));
    } else if (filterDate) {
      fetchAttendanceByDate(filterDate);
    } else if (filterMeeting) {
      fetchAttendanceByMeeting(filterMeeting);
    } else {
      fetchAttendanceByDate(selectedDate);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setFilterDate("");
    setFilterMeeting("");
    setSearchTerm("");
    fetchAttendanceByDate(selectedDate);
  };

  // Handle manual attendance submission
  const handleManualAttendance = async (e) => {
    e.preventDefault();

    if (!manualForm.internId || !manualForm.meetingName) {
      toast.error("Please fill in all required fields", {
        icon: <AlertCircle size={18} />,
      });
      return;
    }

    setIsSubmittingManual(true);

    try {
      const response = await api.post(
        "/online-attendance/mark",
        {
          internId: manualForm.internId,
          meetingName: manualForm.meetingName,
          status: manualForm.status,
          date: manualForm.date,
        },
        getAuthHeaders()
      );

      if (response.data) {
        toast.success(
          `Attendance marked as ${manualForm.status} for intern ${manualForm.internId}`,
          {
            icon: <Check size={18} />,
            duration: 4000,
          }
        );

        setManualForm({
          internId: "",
          meetingName: "",
          status: "Present",
          date: new Date().toISOString().split("T")[0],
        });

        await fetchAttendanceByDate(selectedDate);
        await fetchStats(selectedDate);
        setShowManualForm(false);
      }
    } catch (error) {
      console.error("Error marking manual attendance:", error);
      toast.error(
        error.response?.data?.message || "Failed to mark attendance",
        {
          icon: <AlertCircle size={18} />,
          duration: 5000,
        }
      );
    } finally {
      setIsSubmittingManual(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Pass mobile menu props to Sidebar */}
      <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />

      <div className="flex-1 flex flex-col">
        <div className="sticky top-0 z-10 bg-white shadow-sm">
          {/* Pass menu toggle handler to Navbar */}
          <Navbar onMenuClick={() => setIsMobileOpen(!isMobileOpen)} />
        </div>
        <Toaster position="top-right" />

        <div className="h-20" />

        <main className="flex-1 p-6 md:p-8 lg:p-10 overflow-y-auto">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
            <div className="flex items-center gap-4 mt-5">
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
                <Video className="h-10 w-auto text-4xl text-blue-600" />
              </motion.div>
              <div>
                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="text-3xl font-bold text-[#060B27]"
                >
                  Online Meeting Attendance
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="text-gray-500"
                >
                  Upload Teams attendance reports and track online attendance
                </motion.p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                className="flex items-center justify-center gap-2 bg-green-100 px-5 py-2.5 text-green-700 rounded-lg hover:bg-green-200 transition-colors shadow-sm border border-green-200"
                onClick={() => setShowManualForm(!showManualForm)}
              >
                <Check size={18} />
                {showManualForm ? "Hide Manual Form" : "Manual Marking"}
              </button>
              <button
                className="flex items-center justify-center gap-2 bg-gray-100 px-5 py-2.5 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors shadow-sm border border-gray-200"
                onClick={downloadTemplate}
              >
                <Download size={18} />
                Download Template
              </button>
            </div>
          </div>

          <AttendanceContent
            showManualForm={showManualForm}
            setShowManualForm={setShowManualForm}
            manualForm={manualForm}
            setManualForm={setManualForm}
            isSubmittingManual={isSubmittingManual}
            handleManualAttendance={handleManualAttendance}
            meetingName={meetingName}
            setMeetingName={setMeetingName}
            selectedDate={selectedDate}
            handleDateChange={handleDateChange}
            isUploading={isUploading}
            handleFileUpload={handleFileUpload}
            stats={stats}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            filterDate={filterDate}
            setFilterDate={setFilterDate}
            filterMeeting={filterMeeting}
            setFilterMeeting={setFilterMeeting}
            applyFilters={applyFilters}
            clearFilters={clearFilters}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            isLoading={isLoading}
            attendanceRecords={attendanceRecords}
            downloadTemplate={downloadTemplate}
          />
        </main>
      </div>
    </div>
  );
};

export default OnlineAttendancePage;
