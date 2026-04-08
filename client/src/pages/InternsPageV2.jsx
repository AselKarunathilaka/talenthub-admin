import { useEffect, useMemo, useState } from "react";
import { api, getAuthHeaders } from "../api/apiConfig";
import { clearAttendance, markAttendance } from "../api/internApi";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { toast, Toaster } from "react-hot-toast";
import { Search, Filter, Calendar, Users } from "lucide-react";
import InternHistory from "../components/interns/InternHistory";

const getTodayDate = () => new Date().toISOString().split("T")[0];

const InternsPageV2 = () => {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecialization, setSelectedSpecialization] = useState("");
  const [savingAttendance, setSavingAttendance] = useState({});

  const fetchInterns = async (dateToFetch = selectedDate) => {
    try {
      setLoading(true);
      const response = await api.get(
        `/interns?date=${dateToFetch}`,
        getAuthHeaders()
      );
      setInterns(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching interns:", error);
      toast.error("Failed to fetch intern data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterns(selectedDate);
  }, [selectedDate]);

  const specializations = useMemo(() => {
    return Array.from(
      new Set(
        interns
          .map(
            (intern) =>
              intern.fieldOfSpecialization || intern.field_of_spec_name || ""
          )
          .filter(Boolean)
      )
    ).sort();
  }, [interns]);

  const filteredInterns = interns.filter((intern) => {
    const searchTermLower = searchTerm.toLowerCase();
    const traineeId = String(intern.traineeId ?? "").toLowerCase();
    const traineeName = String(intern.traineeName ?? "").toLowerCase();
    const team = String(intern.team ?? "").toLowerCase();

    const matchesSearchTerm =
      traineeId.includes(searchTermLower) ||
      traineeName.includes(searchTermLower) ||
      team.includes(searchTermLower) ||
      !searchTerm;

    const specializationMatch =
      selectedSpecialization === "" ||
      intern.fieldOfSpecialization === selectedSpecialization;

    return matchesSearchTerm && specializationMatch;
  });

  const emitAttendanceRealtimeUpdate = (
    intern,
    status,
    shouldClear,
    timeMarked
  ) => {
    window.dispatchEvent(
      new CustomEvent("attendance:changed", {
        detail: {
          internId: intern._id,
          traineeId: String(intern.traineeId ?? ""),
          traineeName: intern.traineeName ?? "",
          fieldOfSpecialization: intern.fieldOfSpecialization ?? "",
          institute: intern.institute ?? "",
          attendanceDate: selectedDate,
          type: "manual",
          status,
          cleared: shouldClear,
          timeMarked,
        },
      })
    );
  };

  const handleMarkAttendance = async (id, status, shouldClear = false) => {
    if (!id) {
      toast.error("Intern ID is missing or undefined!");
      return;
    }

    const intern = interns.find((item) => item._id === id);
    if (!intern) {
      toast.error("Intern not found!");
      return;
    }

    const previousInterns = interns.map((item) => ({
      ...item,
      attendance: Array.isArray(item.attendance) ? [...item.attendance] : [],
    }));

    const previousStatus = intern.attendanceStatus || "Not Marked";
    const nextStatus = shouldClear ? "Not Marked" : status;
    const nowIso = new Date().toISOString();

    setSavingAttendance((prev) => ({ ...prev, [id]: true }));

    setInterns((prevInterns) =>
      prevInterns.map((item) => {
        if (item._id !== id) return item;

        const filteredAttendance = (item.attendance || []).filter(
          (entry) =>
            new Date(entry.date).toDateString() !==
            new Date(selectedDate).toDateString()
        );

        return {
          ...item,
          attendanceStatus: nextStatus,
          attendance:
            nextStatus === "Not Marked"
              ? filteredAttendance
              : [
                  ...filteredAttendance,
                  {
                    date: selectedDate,
                    status: nextStatus,
                    type: "manual",
                    timeMarked: nowIso,
                    timestamp: nowIso,
                  },
                ],
          updatedAt: nowIso,
        };
      })
    );

    emitAttendanceRealtimeUpdate(intern, nextStatus, shouldClear, nowIso);

    try {
      if (shouldClear) {
        const response = await clearAttendance(id, selectedDate, "manual");
        if (!response) {
          throw new Error("Failed to clear attendance");
        }
      } else {
        const response = await markAttendance(
          id,
          status,
          selectedDate,
          "manual",
          nowIso
        );
        if (!response) {
          throw new Error("Failed to mark attendance");
        }
      }

      toast.success(
        shouldClear
          ? `Attendance cleared for ${intern.traineeName}`
          : `Attendance marked as ${status} for ${intern.traineeName}`
      );
    } catch (error) {
      console.error("Error updating attendance:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        fullError: error,
      });

      setInterns(previousInterns);

      emitAttendanceRealtimeUpdate(
        intern,
        previousStatus,
        previousStatus === "Not Marked",
        nowIso
      );

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Unknown error occurred";

      toast.error(`Error updating attendance: ${errorMessage}. Please try again.`);
    } finally {
      setSavingAttendance((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleAttendanceButtonDoubleClick = (event, intern, status) => {
    event.stopPropagation();

    if (savingAttendance[intern._id]) return;

    const shouldClear = intern.attendanceStatus === status;
    handleMarkAttendance(intern._id, status, shouldClear);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="text-green-600" size={28} />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Interns</h1>
                  <p className="text-gray-500">
                    Manage attendance by date and specialization
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="text-gray-500" size={18} />
                <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Search by ID, Name, Team"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="relative">
                  <Calendar
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <select
                  value={selectedSpecialization}
                  onChange={(e) => setSelectedSpecialization(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All Specializations</option>
                  {specializations.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-800">
                  Intern Attendance
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Double-click Present or Absent to mark attendance. Double-click
                  the active button again to clear it.
                </p>
              </div>

              {loading ? (
                <div className="p-10 text-center text-gray-500">Loading interns...</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-4 text-left font-semibold text-gray-600">
                            Trainee ID
                          </th>
                          <th className="p-4 text-left font-semibold text-gray-600">
                            Name
                          </th>
                          <th className="p-4 text-left font-semibold text-gray-600">
                            Field of Specialization
                          </th>
                          <th className="p-4 text-left font-semibold text-gray-600">
                            Institute
                          </th>
                          <th className="p-4 text-center font-semibold text-gray-600">
                            Attendance
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredInterns.length > 0 ? (
                          filteredInterns.map((intern) => (
                            <tr key={intern._id} className="hover:bg-gray-50">
                              <td className="p-4 border-b">{intern.traineeId}</td>
                              <td className="p-4 border-b">{intern.traineeName}</td>
                              <td className="p-4 border-b">
                                {intern.fieldOfSpecialization}
                              </td>
                              <td className="p-4 border-b">
                                {intern.institute || "-"}
                              </td>
                              <td className="p-4 border-b text-center">
                                <div className="flex justify-center gap-4">
                                  <button
                                    onClick={(e) => e.stopPropagation()}
                                    onDoubleClick={(e) =>
                                      handleAttendanceButtonDoubleClick(
                                        e,
                                        intern,
                                        "Present"
                                      )
                                    }
                                    disabled={savingAttendance[intern._id]}
                                    title={
                                      intern.attendanceStatus === "Present"
                                        ? "Double-click to clear Present"
                                        : "Double-click to mark Present"
                                    }
                                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                                      intern.attendanceStatus === "Present"
                                        ? "bg-green-700 text-white"
                                        : "bg-green-100 text-gray-500 hover:bg-green-200"
                                    } ${
                                      savingAttendance[intern._id]
                                        ? "opacity-60 cursor-not-allowed"
                                        : ""
                                    }`}
                                  >
                                    {savingAttendance[intern._id] &&
                                    intern.attendanceStatus === "Present"
                                      ? "Saving..."
                                      : "✅ Present"}
                                  </button>

                                  <button
                                    onClick={(e) => e.stopPropagation()}
                                    onDoubleClick={(e) =>
                                      handleAttendanceButtonDoubleClick(
                                        e,
                                        intern,
                                        "Absent"
                                      )
                                    }
                                    disabled={savingAttendance[intern._id]}
                                    title={
                                      intern.attendanceStatus === "Absent"
                                        ? "Double-click to clear Absent"
                                        : "Double-click to mark Absent"
                                    }
                                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                                      intern.attendanceStatus === "Absent"
                                        ? "bg-red-700 text-white"
                                        : "bg-red-100 text-gray-500 hover:bg-red-200"
                                    } ${
                                      savingAttendance[intern._id]
                                        ? "opacity-60 cursor-not-allowed"
                                        : ""
                                    }`}
                                  >
                                    {savingAttendance[intern._id] &&
                                    intern.attendanceStatus === "Absent"
                                      ? "Saving..."
                                      : "❌ Absent"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan="5"
                              className="p-8 text-center text-gray-500"
                            >
                              No interns found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <p className="mt-3 px-6 pb-6 text-sm text-gray-500">
                    Double-click Present or Absent to mark attendance.
                    Double-click the active button again to clear it.
                  </p>
                </>
              )}
            </div>

            <InternHistory />
          </div>
        </main>
      </div>

      <Toaster position="top-right" />
    </div>
  );
};

export default InternsPageV2;