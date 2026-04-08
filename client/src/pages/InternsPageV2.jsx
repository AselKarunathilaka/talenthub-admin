import { useEffect, useMemo, useState } from "react";
import { api, getAuthHeaders } from "../api/apiConfig";
import { clearAttendance, markAttendance } from "../api/internApi";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { toast, Toaster } from "react-hot-toast";
import {
  Search,
  Filter,
  Calendar,
  Users,
  ChevronLeft,
  ChevronRight,
  FileDown,
} from "lucide-react";
import InternHistory from "../components/interns/InternHistory";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const getTodayDate = () => new Date().toISOString().split("T")[0];

const InternsPageV2 = () => {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecialization, setSelectedSpecialization] = useState("");
  const [savingAttendance, setSavingAttendance] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  // Frontend-only neutral reset layer. Does NOT touch DB.
  // key format: `${selectedDate}__${internId}`
  const [frontendNeutralOverrides, setFrontendNeutralOverrides] = useState({});

  const internsPerPage = 10;

  const makeOverrideKey = (date, internId) => `${date}__${internId}`;

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSpecialization, selectedDate]);

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

  const internsWithEffectiveStatus = useMemo(() => {
    return interns.map((intern) => {
      const overrideKey = makeOverrideKey(selectedDate, intern._id);
      const isNeutralized = frontendNeutralOverrides[overrideKey] === true;

      return {
        ...intern,
        effectiveAttendanceStatus: isNeutralized
          ? "Not Marked"
          : intern.attendanceStatus || "Not Marked",
      };
    });
  }, [interns, selectedDate, frontendNeutralOverrides]);

  const filteredInterns = useMemo(() => {
    return internsWithEffectiveStatus.filter((intern) => {
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
        (intern.fieldOfSpecialization || "") === selectedSpecialization;

      return matchesSearchTerm && specializationMatch;
    });
  }, [internsWithEffectiveStatus, searchTerm, selectedSpecialization]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredInterns.length / internsPerPage)
  );

  const paginatedInterns = filteredInterns.slice(
    (currentPage - 1) * internsPerPage,
    currentPage * internsPerPage
  );

  const todayAttendanceRows = useMemo(() => {
    return filteredInterns
      .filter((intern) => {
        const status = intern.effectiveAttendanceStatus || "Not Marked";
        return status === "Present" || status === "Absent";
      })
      .map((intern) => {
        const manualEntry = (intern.attendance || [])
          .filter((entry) => {
            const sameDate =
              new Date(entry.date).toDateString() ===
              new Date(selectedDate).toDateString();
            return sameDate && (entry.type || "manual") === "manual";
          })
          .sort(
            (a, b) =>
              new Date(b.timeMarked || b.date) -
              new Date(a.timeMarked || a.date)
          )[0];

        return {
          key: intern._id,
          internId: intern._id,
          traineeId: String(intern.traineeId || ""),
          traineeName: intern.traineeName || "N/A",
          fieldOfSpecialization:
            intern.fieldOfSpecialization || intern.field_of_spec_name || "",
          institute: intern.institute || intern.Institute || "",
          status: intern.effectiveAttendanceStatus || "Not Marked",
          attendanceType: "Manual",
          rawType: "manual",
          method: "Manual Method",
          checkInTime: manualEntry?.timeMarked || manualEntry?.date || "",
        };
      })
      .sort((a, b) =>
        a.traineeId.localeCompare(b.traineeId, undefined, { numeric: true })
      );
  }, [filteredInterns, selectedDate]);

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
      toast.error("Intern ID is missing.");
      return;
    }

    const intern = interns.find((item) => item._id === id);
    if (!intern) {
      toast.error("Intern not found.");
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

    // User is actively changing this row again, so remove neutral override for this row.
    const overrideKey = makeOverrideKey(selectedDate, id);
    setFrontendNeutralOverrides((prev) => {
      const next = { ...prev };
      delete next[overrideKey];
      return next;
    });

    setInterns((prevInterns) =>
      prevInterns.map((item) => {
        if (item._id !== id) return item;

        const filteredAttendance = (item.attendance || []).filter((entry) => {
          const sameDate =
            new Date(entry.date).toDateString() ===
            new Date(selectedDate).toDateString();
          const sameType = (entry.type || "manual") === "manual";
          return !(sameDate && sameType);
        });

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
      console.error("Error updating attendance:", error);
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

      toast.error(`Error updating attendance: ${errorMessage}`);
    } finally {
      setSavingAttendance((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleAttendanceButtonDoubleClick = (event, intern, status) => {
    event.stopPropagation();
    if (savingAttendance[intern._id]) return;

    const currentStatus = intern.effectiveAttendanceStatus || "Not Marked";
    const shouldClear = currentStatus === status;
    handleMarkAttendance(intern._id, status, shouldClear);
  };

  const addFooter = (doc) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Page ${pageNumber}`, 14, pageHeight - 8);
    doc.text(
      "SLTMobitel Internship Attendance System",
      pageWidth - 78,
      pageHeight - 8
    );
  };

  const exportDetailedPdf = () => {
    const markedInterns = filteredInterns.filter(
      (intern) =>
        intern.effectiveAttendanceStatus === "Present" ||
        intern.effectiveAttendanceStatus === "Absent"
    );

    const presentCount = filteredInterns.filter(
      (intern) => intern.effectiveAttendanceStatus === "Present"
    ).length;

    const absentCount = filteredInterns.filter(
      (intern) => intern.effectiveAttendanceStatus === "Absent"
    ).length;

    const unmarkedCount = filteredInterns.filter(
      (intern) =>
        !intern.effectiveAttendanceStatus ||
        intern.effectiveAttendanceStatus === "Not Marked"
    ).length;

    const specializationMap = {};

    filteredInterns.forEach((intern) => {
      const spec =
        intern.fieldOfSpecialization ||
        intern.field_of_spec_name ||
        "Unspecified";

      if (!specializationMap[spec]) {
        specializationMap[spec] = {
          specialization: spec,
          present: 0,
          absent: 0,
          unmarked: 0,
        };
      }

      if (intern.effectiveAttendanceStatus === "Present") {
        specializationMap[spec].present += 1;
      } else if (intern.effectiveAttendanceStatus === "Absent") {
        specializationMap[spec].absent += 1;
      } else {
        specializationMap[spec].unmarked += 1;
      }
    });

    const specializationSummaryRows = Object.values(specializationMap).sort(
      (a, b) => a.specialization.localeCompare(b.specialization)
    );

    const doc = new jsPDF("p", "mm", "a4");

    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, 210, 32, "F");

    doc.setTextColor(20, 40, 80);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Intern Attendance Report", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(`Date: ${selectedDate}`, 14, 42);
    doc.text(`Generated At: ${new Date().toLocaleString()}`, 14, 49);
    doc.text(
      `Specialization Filter: ${
        selectedSpecialization || "All Specializations"
      }`,
      14,
      56
    );
    doc.text(`Search Filter: ${searchTerm || "None"}`, 14, 63);
    doc.text(`Marked Attendance Count: ${markedInterns.length}`, 14, 70);
    doc.text(`Present: ${presentCount}`, 14, 77);
    doc.text(`Absent: ${absentCount}`, 55, 77);
    doc.text(`Unmarked: ${unmarkedCount}`, 90, 77);

    autoTable(doc, {
      startY: 85,
      head: [
        [
          "Trainee ID",
          "Name",
          "Field of Specialization",
          "Institute",
          "Attendance",
        ],
      ],
      body: markedInterns.map((intern) => [
        intern.traineeId || "",
        intern.traineeName || "",
        intern.fieldOfSpecialization || "",
        intern.institute || "",
        intern.effectiveAttendanceStatus || "",
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [47, 132, 191],
        textColor: 255,
        fontStyle: "bold",
      },
      bodyStyles: {
        textColor: 40,
      },
      alternateRowStyles: {
        fillColor: [248, 249, 251],
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 48 },
        2: { cellWidth: 42 },
        3: { cellWidth: 48 },
        4: { cellWidth: 25 },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: () => {
        addFooter(doc);
      },
    });

    let summaryStartY = doc.lastAutoTable.finalY + 10;
    const pageHeight = doc.internal.pageSize.getHeight();

    if (summaryStartY + 45 > pageHeight - 20) {
      doc.addPage();
      summaryStartY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 40, 80);
    doc.text("Attendance Summary by Specialization", 14, summaryStartY);

    autoTable(doc, {
      startY: summaryStartY + 4,
      head: [["Specialization", "Present", "Absent", "Unmarked"]],
      body: specializationSummaryRows.map((row) => [
        row.specialization,
        String(row.present),
        String(row.absent),
        String(row.unmarked),
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [22, 101, 52],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 249, 251],
      },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 28, halign: "center" },
        2: { cellWidth: 28, halign: "center" },
        3: { cellWidth: 28, halign: "center" },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: () => {
        addFooter(doc);
      },
    });

    doc.save(`Attendance_Report_${selectedDate}.pdf`);
  };

  const resetFrontendView = () => {
    const neutralMap = {};
    interns.forEach((intern) => {
      neutralMap[makeOverrideKey(selectedDate, intern._id)] = true;
    });

    setFrontendNeutralOverrides((prev) => ({
      ...prev,
      ...neutralMap,
    }));

    setSearchTerm("");
    setSelectedSpecialization("");
    setCurrentPage(1);

    toast.success("View reset to neutral. Database data was not changed.");
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

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

                <button
                  onClick={exportDetailedPdf}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
                >
                  <FileDown size={18} />
                  Export PDF
                </button>

                <button
                  onClick={resetFrontendView}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition"
                >
                  Reset View
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    Intern Attendance
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Double-click Present or Absent to mark attendance. Double-click the active button again to clear it.
                  </p>
                </div>

                <div className="text-sm text-gray-500">
                  Showing{" "}
                  {filteredInterns.length === 0
                    ? 0
                    : (currentPage - 1) * internsPerPage + 1}
                  -
                  {Math.min(currentPage * internsPerPage, filteredInterns.length)} of{" "}
                  {filteredInterns.length}
                </div>
              </div>

              {loading ? (
                <div className="p-10 text-center text-gray-500">
                  Loading interns...
                </div>
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
                        {paginatedInterns.length > 0 ? (
                          paginatedInterns.map((intern) => (
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
                                      intern.effectiveAttendanceStatus === "Present"
                                        ? "Double-click to clear Present"
                                        : "Double-click to mark Present"
                                    }
                                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                                      intern.effectiveAttendanceStatus === "Present"
                                        ? "bg-green-700 text-white"
                                        : "bg-green-100 text-gray-500 hover:bg-green-200"
                                    } ${
                                      savingAttendance[intern._id]
                                        ? "opacity-60 cursor-not-allowed"
                                        : ""
                                    }`}
                                  >
                                    {savingAttendance[intern._id]
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
                                      intern.effectiveAttendanceStatus === "Absent"
                                        ? "Double-click to clear Absent"
                                        : "Double-click to mark Absent"
                                    }
                                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                                      intern.effectiveAttendanceStatus === "Absent"
                                        ? "bg-red-700 text-white"
                                        : "bg-red-100 text-gray-500 hover:bg-red-200"
                                    } ${
                                      savingAttendance[intern._id]
                                        ? "opacity-60 cursor-not-allowed"
                                        : ""
                                    }`}
                                  >
                                    {savingAttendance[intern._id]
                                      ? "Saving..."
                                      : "❌ Absent"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" className="p-8 text-center text-gray-500">
                              No interns found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {filteredInterns.length > 0 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>

                      <div className="text-sm font-medium text-gray-700">
                        Page {currentPage} of {totalPages}
                      </div>

                      <button
                        onClick={() =>
                          setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                        }
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <InternHistory
              rows={todayAttendanceRows}
              onResetView={resetFrontendView}
            />
          </div>
        </main>
      </div>

      <Toaster position="top-right" />
    </div>
  );
};

export default InternsPageV2;