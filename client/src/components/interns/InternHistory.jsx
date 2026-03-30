import { useEffect, useState, useCallback } from "react";
import {
  Clock,
  User,
  AlertCircle,
  X,
  Loader,
  Calendar,
  Search,
  RefreshCw,
  Users,
  Activity,
  Timer,
  Monitor,
} from "lucide-react";
import { fetchTodayAttendanceByType } from "../../api/internApi";
import { toast } from "react-hot-toast";

const InternHistory = () => {
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeAttendanceType, setActiveAttendanceType] = useState("all");

  const fetchAttendanceLogs = useCallback(
    async (isManualRefresh = false) => {
      try {
        if (attendanceLogs.length === 0 || isManualRefresh) {
          setIsLoading(true);
        } else {
          setIsRefreshing(true);
        }

        const attendanceType =
          activeAttendanceType === "all" ? null : activeAttendanceType;
        const logs = await fetchTodayAttendanceByType(attendanceType);

        if (logs) {
          const groupedLogs = {};

          logs.forEach((log) => {
            const traineeId = log.Trainee_ID || log.traineeId || "";

            if (!groupedLogs[traineeId]) {
              groupedLogs[traineeId] = {
                Trainee_ID: log.Trainee_ID,
                Trainee_Name: log.Trainee_Name,
                field_of_spec_name: log.field_of_spec_name,
                Institute: log.Institute,
                Training_StartDate: log.Training_StartDate,
                Training_EndDate: log.Training_EndDate,
                Trainee_Email: log.Trainee_Email,
                Trainee_HomeAddress: log.Trainee_HomeAddress,
                attendanceRecords: [],
              };
            }

            // Process attendance info
            if (Array.isArray(log.attendanceInfo)) {
              log.attendanceInfo.forEach((info) => {
                groupedLogs[traineeId].attendanceRecords.push(info);
              });
            } else if (log.attendanceInfo) {
              groupedLogs[traineeId].attendanceRecords.push(log.attendanceInfo);
            }
          });

          // Convert grouped logs to array and format combined data
          const formattedLogs = Object.values(groupedLogs).map((log) => {
            const types = [];
            const methods = [];
            const times = [];

            log.attendanceRecords.forEach((record) => {
              // Determine type
              let type = "";
              if (record.type === "Daily") type = "Daily";
              else if (record.type === "Meeting") type = "Meeting";
              else if (record.type === "Manual") type = "Manual";
              else if (record.type === "Online Meeting")
                type = "Online Meeting";
              else type = record.type;

              // Determine method
              let method = "";
              if (record.type === "Online Meeting") {
                method =
                  record.method === "CSV Upload"
                    ? "CSV Upload"
                    : "Manual Entry";
              } else if (record.type === "Daily" || record.type === "Meeting") {
                method = "QR Code Scan";
              } else if (
                record.type === "Manual" ||
                record.method === "Manual Entry"
              ) {
                method = "Manual Method";
              } else if (record.method === "QR Code Scan") {
                method = "QR Code Scan";
              } else {
                method = record.method;
              }

              // Determine time - empty for online meetings
              let time = "";
              if (record.type !== "Online Meeting") {
                time = new Date(record.time).toLocaleTimeString();
              }

              types.push(type);
              methods.push(method);
              times.push(time);
            });

            return {
              ...log,
              types: types,
              methods: methods,
              times: times,
            };
          });

          setAttendanceLogs(formattedLogs);
        } else {
          setAttendanceLogs([]);
        }
      } catch (err) {
        console.error("Fetching logs error", err);
        if (isManualRefresh) {
          toast.error("Failed to fetch attendance logs", {
            icon: <AlertCircle size={18} />,
          });
        }
        setAttendanceLogs([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeAttendanceType, attendanceLogs.length]
  );

  useEffect(() => {
    fetchAttendanceLogs();
    const interval = setInterval(fetchAttendanceLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchAttendanceLogs]);

  const filteredLogs = attendanceLogs.filter((log) => {
    if (!log || typeof log !== "object") return false;
    const traineeId =
      typeof log.Trainee_ID === "string" ? log.Trainee_ID.toLowerCase() : "";
    const name =
      typeof log.Trainee_Name === "string"
        ? log.Trainee_Name.toLowerCase()
        : "";
    const term = searchTerm ? searchTerm.toLowerCase() : "";
    return traineeId.includes(term) || name.includes(term);
  });

  return (
    <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-100">
      <div className="p-6 border-b border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Today&apos;s Marked Attendance
            </h3>
            <p className="text-gray-500 text-sm mt-1">
              Trainees who have checked in today • {filteredLogs.length}{" "}
              trainees
              {isRefreshing && (
                <span className="text-blue-600 ml-2">• Updating...</span>
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
              {[
                { key: "all", label: "All", icon: Activity },
                { key: "daily", label: "Daily", icon: Timer },
                { key: "meeting", label: "Meeting", icon: Users },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveAttendanceType(key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-1.5 transition-all ${
                    activeAttendanceType === key
                      ? "bg-white shadow text-blue-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <div className="relative w-full sm:w-64">
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

              <button
                onClick={() => fetchAttendanceLogs(true)}
                disabled={isLoading || isRefreshing}
                className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh attendance data"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    isLoading || isRefreshing ? "animate-spin" : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {isRefreshing && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-2 text-sm text-blue-700 flex items-center">
            <Loader className="h-4 w-4 animate-spin mr-2" />
            Refreshing attendance data...
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">
              Loading attendance data...
            </span>
          </div>
        ) : filteredLogs.length > 0 ? (
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
                  Attendance Type
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Method
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Check-in Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.map((log, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center">
                      <User className="h-4 w-4 text-gray-400 mr-2" />
                      {log.Trainee_ID || ""}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <div className="flex items-center">
                      <User className="h-4 w-4 text-gray-400 mr-2" />
                      {log.Trainee_Name || ""}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex flex-wrap gap-1">
                      {log.types.map((type, idx) => (
                        <span key={idx}>
                          {type === "Daily" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <Timer className="h-3 w-3 mr-1" />
                              Daily
                            </span>
                          )}
                          {type === "Meeting" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              <Users className="h-3 w-3 mr-1" />
                              Meeting
                            </span>
                          )}
                          {type === "Online Meeting" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Monitor className="h-3 w-3 mr-1" />
                              Online Meeting
                            </span>
                          )}
                          {type === "Manual" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              <User className="h-3 w-3 mr-1" />
                              Manual
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {log.methods.join(", ")}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {log.times.filter((t) => t !== "").join(", ")}
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
                  {activeAttendanceType === "daily"
                    ? "No daily attendance records found for today"
                    : activeAttendanceType === "meeting"
                    ? "No meeting attendance records found for today"
                    : "No trainees have checked in today"}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {(filteredLogs.length > 0 || attendanceLogs.length > 0) && (
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{filteredLogs.length}</span>
              {searchTerm ? " matching" : ""}
              {activeAttendanceType === "daily"
                ? " daily attendance"
                : activeAttendanceType === "meeting"
                ? " meeting attendance"
                : " attendance"}{" "}
              records
            </p>
            {searchTerm && filteredLogs.length !== attendanceLogs.length && (
              <p className="text-sm text-gray-500">
                (Filtered from{" "}
                <span className="font-medium">{attendanceLogs.length}</span>{" "}
                total)
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            <span>Auto-refreshes every 5 seconds</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternHistory;
