import { useMemo, useState } from "react";
import {
  Clock,
  User,
  X,
  Calendar,
  Search,
  RefreshCw,
  Users,
  Activity,
  Timer,
  Monitor,
  Briefcase,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";

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

const getStatusBadge = (status) => {
  if (status === "Present") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Present
      </span>
    );
  }

  if (status === "Absent") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <XCircle className="h-3 w-3 mr-1" />
        Absent
      </span>
    );
  }

  return null;
};

const getTypeBadge = (type) => {
  if (type === "Daily") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <Timer className="h-3 w-3 mr-1" />
        Daily
      </span>
    );
  }

  if (type === "Meeting") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
        <Users className="h-3 w-3 mr-1" />
        Meeting
      </span>
    );
  }

  if (type === "Online Meeting") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Monitor className="h-3 w-3 mr-1" />
        Online Meeting
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
      <User className="h-3 w-3 mr-1" />
      Manual
    </span>
  );
};

const InternHistory = ({ rows = [], onResetView }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeAttendanceType, setActiveAttendanceType] = useState("all");

  const filteredLogs = useMemo(() => {
    return (rows || []).filter((row) => {
      const traineeId = safeString(row.traineeId, "").toLowerCase();
      const traineeName = safeString(row.traineeName, "").toLowerCase();
      const specialization = safeString(row.fieldOfSpecialization, "").toLowerCase();
      const type = safeString(row.attendanceType, "").toLowerCase();
      const term = searchTerm.toLowerCase();

      const matchesSearch =
        traineeId.includes(term) ||
        traineeName.includes(term) ||
        specialization.includes(term);

      const matchesType =
        activeAttendanceType === "all"
          ? true
          : activeAttendanceType === "daily"
          ? type === "daily"
          : ["manual", "meeting", "online meeting"].includes(type);

      return matchesSearch && matchesType;
    });
  }, [rows, searchTerm, activeAttendanceType]);

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
              <div className="relative w-full sm:w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search trainees or specialization..."
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
                onClick={onResetView}
                className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                title="Reset frontend view only"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {filteredLogs.length > 0 ? (
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
                  Specialization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
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

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <div className="flex items-center">
                      <Briefcase className="h-4 w-4 text-gray-400 mr-2" />
                      {log.fieldOfSpecialization || "N/A"}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {getStatusBadge(log.status)}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-500">
                    {getTypeBadge(log.attendanceType || "Manual")}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-500">
                    {log.method || "Manual Method"}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatTime(log.checkInTime) || "—"}
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

      {(filteredLogs.length > 0 || rows.length > 0) && (
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{filteredLogs.length}</span>
              {searchTerm ? " matching" : ""} attendance records
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            <span>Uses current frontend page state</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternHistory;