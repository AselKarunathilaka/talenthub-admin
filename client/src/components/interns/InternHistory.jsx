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

const getTodayKey = () => new Date().toISOString().split("T")[0];

const safeString = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString();
};

const getNormalizedRecord = (record) => {
  const rawType = record.rawType || record.type || "manual";

  if (rawType === "daily_qr" || rawType === "Daily") {
    return {
      rawType: "daily_qr",
      type: "Daily",
      method: record.method || "QR Code Scan",
      time: record.time || record.timeMarked || record.date || "",
    };
  }

  if (rawType === "qr" || rawType === "Meeting") {
    return {
      rawType: "qr",
      type: "Meeting",
      method: record.method || "QR Code Scan",
      time: record.time || record.timeMarked || record.date || "",
    };
  }

  if (rawType === "online_attendance" || rawType === "Online Meeting") {
    return {
      rawType: "online_attendance",
      type: "Online Meeting",
      method: record.method || "CSV Upload",
      time: record.time || record.timeMarked || record.date || "",
    };
  }

  return {
    rawType: "manual",
    type: "Manual",
    method: record.method || "Manual Method",
    time: record.time || record.timeMarked || record.date || "",
  };
};

const buildFormattedLog = (log) => {
  const normalizedRecords = (log.attendanceRecords || []).map(getNormalizedRecord);

  return {
    ...log,
    attendanceRecords: normalizedRecords,
    types: normalizedRecords.map((record) => record.type),
    methods: normalizedRecords.map((record) => record.method),
    times: normalizedRecords.map((record) =>
      record.type === "Online Meeting" ? "" : formatTime(record.time)
    ),
  };
};

const shouldShowForActiveTab = (rawType, activeAttendanceType) => {
  if (activeAttendanceType === "all") return true;
  if (activeAttendanceType === "daily") return rawType === "daily_qr";
  return ["manual", "qr", "online_attendance"].includes(rawType);
};

const InternHistory = () => {
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeAttendanceType, setActiveAttendanceType] = useState("all");

  const normalizeServerLogs = useCallback((logs) => {
    const groupedLogs = {};

    (logs || []).forEach((log, index) => {
      const traineeId = safeString(log.traineeId ?? log.Trainee_ID ?? "", "").trim();
      const traineeName = safeString(log.traineeName ?? log.Trainee_Name ?? "", "N/A").trim();
      const fieldOfSpecialization = safeString(
        log.fieldOfSpecialization ?? log.field_of_spec_name ?? "",
        ""
      ).trim();
      const institute = safeString(log.institute ?? log.Institute ?? "", "").trim();
      const internId = safeString(log._id ?? log.internId ?? "", "");
      const key = traineeId || internId || `row-${index}`;

      if (!groupedLogs[key]) {
        groupedLogs[key] = {
          key,
          internId,
          traineeId,
          traineeName,
          fieldOfSpecialization,
          institute,
          attendanceRecords: [],
        };
      }

      const infoList = Array.isArray(log.attendanceInfo)
        ? log.attendanceInfo
        : log.attendanceInfo
        ? [log.attendanceInfo]
        : [];

      infoList.forEach((info) => {
        groupedLogs[key].attendanceRecords.push({
          rawType: info.rawType || info.type,
          type: info.type,
          method: info.method,
          time: info.time || info.timeMarked || info.date,
        });
      });
    });

    return Object.values(groupedLogs).map(buildFormattedLog);
  }, []);

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
          setAttendanceLogs(normalizeServerLogs(logs));
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
    [activeAttendanceType, attendanceLogs.length, normalizeServerLogs]
  );

  useEffect(() => {
    fetchAttendanceLogs();
    const interval = setInterval(fetchAttendanceLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchAttendanceLogs]);

  useEffect(() => {
    const handleRealtimeAttendanceChange = (event) => {
      const detail = event.detail;
      if (!detail) return;

      const today = getTodayKey();
      if (detail.attendanceDate !== today) return;

      const traineeId = safeString(detail.traineeId ?? "", "").trim();
      const traineeName = safeString(detail.traineeName ?? "", "N/A").trim();
      const internId = safeString(detail.internId ?? "", "");
      const rawType = detail.type || "manual";

      setAttendanceLogs((prevLogs) => {
        let nextLogs = prevLogs.map((log) => ({
          ...log,
          attendanceRecords: [...(log.attendanceRecords || [])],
        }));

        const existingIndex = nextLogs.findIndex(
          (log) =>
            log.traineeId === traineeId ||
            (internId && log.internId === internId)
        );

        if (detail.cleared) {
          if (existingIndex === -1) return prevLogs;

          nextLogs[existingIndex].attendanceRecords = nextLogs[
            existingIndex
          ].attendanceRecords.filter((record) => record.rawType !== rawType);

          if (nextLogs[existingIndex].attendanceRecords.length === 0) {
            nextLogs.splice(existingIndex, 1);
          } else {
            nextLogs[existingIndex] = buildFormattedLog(nextLogs[existingIndex]);
          }

          return nextLogs;
        }

        if (!shouldShowForActiveTab(rawType, activeAttendanceType)) {
          return prevLogs;
        }

        const newRecord = getNormalizedRecord({
          rawType,
          method:
            rawType === "manual"
              ? "Manual Method"
              : rawType === "online_attendance"
              ? "CSV Upload"
              : "QR Code Scan",
          time: detail.timeMarked,
        });

        if (existingIndex === -1) {
          nextLogs.unshift(
            buildFormattedLog({
              key: traineeId || internId || `${Date.now()}`,
              internId,
              traineeId,
              traineeName,
              fieldOfSpecialization: detail.fieldOfSpecialization || "",
              institute: detail.institute || "",
              attendanceRecords: [newRecord],
            })
          );
          return nextLogs;
        }

        nextLogs[existingIndex] = {
          ...nextLogs[existingIndex],
          traineeId: traineeId || nextLogs[existingIndex].traineeId,
          traineeName: traineeName || nextLogs[existingIndex].traineeName,
          fieldOfSpecialization:
            detail.fieldOfSpecialization ||
            nextLogs[existingIndex].fieldOfSpecialization,
          institute: detail.institute || nextLogs[existingIndex].institute,
          attendanceRecords: [
            newRecord,
            ...nextLogs[existingIndex].attendanceRecords.filter(
              (record) => record.rawType !== rawType
            ),
          ],
        };

        nextLogs[existingIndex] = buildFormattedLog(nextLogs[existingIndex]);

        return nextLogs;
      });
    };

    window.addEventListener("attendance:changed", handleRealtimeAttendanceChange);
    return () => {
      window.removeEventListener("attendance:changed", handleRealtimeAttendanceChange);
    };
  }, [activeAttendanceType]);

  const filteredLogs = attendanceLogs.filter((log) => {
    const traineeId = safeString(log.traineeId, "").toLowerCase();
    const traineeName = safeString(log.traineeName, "").toLowerCase();
    const term = searchTerm.toLowerCase();
    return traineeId.includes(term) || traineeName.includes(term);
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
              Trainees who have checked in today • {filteredLogs.length} trainees
              {isRefreshing && <span className="text-blue-600 ml-2">• Updating...</span>}
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
            <span className="ml-2 text-gray-600">Loading attendance data...</span>
          </div>
        ) : filteredLogs.length > 0 ? (
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
                  Attendance Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check-in Time
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.map((log, index) => (
                <tr key={log.key || index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center">
                      <User className="h-4 w-4 text-gray-400 mr-2" />
                      {log.traineeId || "N/A"}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <div className="flex items-center">
                      <User className="h-4 w-4 text-gray-400 mr-2" />
                      {log.traineeName || "N/A"}
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
                    {log.times.filter(Boolean).join(", ") || "—"}
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
                <span className="font-medium">{attendanceLogs.length}</span> total)
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