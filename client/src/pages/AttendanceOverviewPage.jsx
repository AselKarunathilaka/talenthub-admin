import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Pencil, X, CheckCircle, Loader2, TrashIcon, Calendar, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { api, getAuthHeaders } from "../api/apiConfig";
import Navbar from "../components/Navbar";

const AttendanceOverviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [intern, setIntern] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [filteredAttendance, setFilteredAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedSpecialization, setEditedSpecialization] = useState("");
  const [specializations, setSpecializations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [selectedDate, setSelectedDate] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState("Present");
  const [filterStatus, setFilterStatus] = useState("All");
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    absent: 0,
    total: 0,
    percentage: 0
  });

  // Format date function
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Calculate attendance statistics
  useEffect(() => {
    if (attendanceHistory.length > 0) {
      const present = attendanceHistory.filter(entry => entry.status === "Present").length;
      const absent = attendanceHistory.filter(entry => entry.status === "Absent").length;
      const total = attendanceHistory.length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      
      setAttendanceStats({
        present,
        absent,
        total,
        percentage
      });
    }
  }, [attendanceHistory]);

  // Fetch intern data on component mount
  useEffect(() => {
    const fetchInternData = async () => {
      try {
        const response = await api.get(`/interns/${id}`, getAuthHeaders());
        setIntern(response.data);
        setAttendanceHistory(response.data.attendance);
        setFilteredAttendance(response.data.attendance);
        setEditedName(response.data.traineeName);
        setEditedSpecialization(response.data.fieldOfSpecialization);
        setLoading(false);

        // Fetch specializations from the list of interns
        const allInterns = await api.get("/interns", getAuthHeaders());
        const uniqueSpecializations = Array.from(
          new Set(allInterns.data.map((intern) => intern.fieldOfSpecialization))
        ).sort();
        setSpecializations(uniqueSpecializations);
      } catch (error) {
        console.error("Error fetching intern data:", error);
        toast.error("Access denied! Please log in.");
        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
        }
      }
    };

    fetchInternData();
  }, [id, navigate]);

  // Handle changing attendance status
  const handleStatusChange = async (date, currentStatus) => {
    const newStatus = currentStatus === "Present" ? "Absent" : "Present";
    try {
      const response = await api.put(
        `/interns/update-attendance/${intern._id}`,
        { date, status: newStatus },
        getAuthHeaders()
      );

      if (response.status === 200) {
        const updatedAttendance = attendanceHistory.map((entry) =>
          new Date(entry.date).toLocaleDateString() === new Date(date).toLocaleDateString()
            ? { ...entry, status: newStatus }
            : entry
        );
        setAttendanceHistory(updatedAttendance);
        setFilteredAttendance(updatedAttendance);
        toast.success(`Attendance updated to ${newStatus} on ${formatDate(date)}.`);
      }
    } catch (error) {
      toast.error("Error updating attendance.");
    }
  };

  // Handle removing intern
  const handleRemoveIntern = async () => {
    const confirmRemove = window.confirm("Are you sure you want to remove this intern?");
    if (!confirmRemove) return;

    setDeleting(true);
    try {
      const response = await api.delete(`/interns/${intern._id}`, getAuthHeaders());
      if (response.status === 200) {
        toast.success("Intern removed successfully.");
        navigate("/interns");
      } else {
        toast.error("Error removing intern.");
      }
    } catch (error) {
      toast.error("Error removing intern.");
    }
    setDeleting(false);
  };

  // Handle saving profile changes
  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const response = await api.put(
        `/interns/update/${intern._id}`,
        { traineeName: editedName, fieldOfSpecialization: editedSpecialization },
        getAuthHeaders()
      );

      if (response.status === 200) {
        setIntern({ ...intern, traineeName: editedName, fieldOfSpecialization: editedSpecialization });
        toast.success("Intern profile updated successfully.");
        setIsProfileModalOpen(false);
      } else {
        toast.error("Error updating profile.");
      }
    } catch (error) {
      toast.error("Error updating profile.");
    }
    setSaving(false);
  };

  // Mark attendance for a specific date
  const handleMarkAttendance = async () => {
    if (!selectedDate) {
      toast.error("Please select a date.");
      return;
    }
    
    try {
      const response = await api.put(
        `/interns/attendance/${intern._id}/update`,
        { date: selectedDate, status: attendanceStatus },
        getAuthHeaders()
      );
      if (response.status === 200) {
        // Check if the date already exists in the attendance history
        const existingIndex = attendanceHistory.findIndex(
          entry => new Date(entry.date).toLocaleDateString() === new Date(selectedDate).toLocaleDateString()
        );
        
        let updatedAttendance;
        if (existingIndex >= 0) {
          // Update existing entry
          updatedAttendance = attendanceHistory.map((entry, index) => 
            index === existingIndex ? { ...entry, status: attendanceStatus } : entry
          );
        } else {
          // Add new entry
          updatedAttendance = [...attendanceHistory, { date: selectedDate, status: attendanceStatus }];
        }
        
        setAttendanceHistory(updatedAttendance);
        setFilteredAttendance(updatedAttendance);
        toast.success("Attendance updated successfully!");
        setIsAttendanceModalOpen(false);
      }
    } catch (error) {
      toast.error("Error marking attendance for this date.");
    }
  };

  // Select a date and show that specific day's attendance
  const handleDateSelection = (date) => {
    setSelectedDate(date);

    if (date) {
      const foundEntry = attendanceHistory.find(
        entry => new Date(entry.date).toLocaleDateString() === new Date(date).toLocaleDateString()
      );

      if (foundEntry) {
        setFilteredAttendance([foundEntry]);
      } else {
        toast.error("Attendance not marked for this day.");
        setFilteredAttendance([]);
      }
    } else {
      // Reset to show all attendance when date is cleared
      handleFilterByStatus(filterStatus);
    }
  };

  // Filter attendance by status
  const handleFilterByStatus = (status) => {
    setFilterStatus(status);
    
    if (status === "All") {
      setFilteredAttendance(attendanceHistory);
    } else {
      setFilteredAttendance(attendanceHistory.filter(entry => entry.status === status));
    }
    
    // Reset pagination when filter changes
    setCurrentPage(1);
  };

  // Clear filters
  const clearFilters = () => {
    setSelectedDate("");
    setFilterStatus("All");
    setFilteredAttendance(attendanceHistory);
    setCurrentPage(1);
  };

  // Slice attendance for pagination
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredAttendance.slice(indexOfFirstRow, indexOfLastRow);

  // Change page
  const handlePageChange = (pageNumber) => setCurrentPage(pageNumber);

  if (loading) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Loading attendance data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1">
        <Navbar />
        
        {/* Main content with increased top padding to avoid navbar overlap */}
        <div className="p-6 md:p-8 mt-20 md:mt-24">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                  {intern.traineeName}
                </h1>
                <p className="text-gray-500 text-sm md:text-base">
                  Field of Specialization: <span className="font-medium">{intern.fieldOfSpecialization}</span>
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <Pencil size={16} />
                  <span>Edit Profile</span>
                </button>
                
                <button
                  onClick={() => setIsAttendanceModalOpen(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <CheckCircle size={16} />
                  <span>Mark Attendance</span>
                </button>
                
                <button
                  onClick={handleRemoveIntern}
                  disabled={deleting}
                  className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-100 transition-colors shadow-sm disabled:opacity-50"
                >
                  <TrashIcon size={16} />
                  <span>{deleting ? "Removing..." : "Remove Intern"}</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 mb-2">Total Days</p>
              <p className="text-2xl font-bold text-gray-800">{attendanceStats.total}</p>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 mb-2">Present</p>
              <p className="text-2xl font-bold text-green-600">{attendanceStats.present}</p>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 mb-2">Absent</p>
              <p className="text-2xl font-bold text-red-600">{attendanceStats.absent}</p>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 mb-2">Attendance Rate</p>
              <p className="text-2xl font-bold text-blue-600">{attendanceStats.percentage}%</p>
            </div>
          </div>
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-500" />
                <span className="font-medium text-gray-700">Filter Attendance</span>
              </div>
              
              <div className="flex flex-wrap gap-4">
                <div className="w-full md:w-auto">
                  <select
                    onChange={(e) => handleFilterByStatus(e.target.value)}
                    value={filterStatus}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="All">All Status</option>
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                  </select>
                </div>
                
                <div className="w-full md:w-auto flex items-center">
                  <div className="relative flex-1">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => handleDateSelection(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {selectedDate && (
                    <button 
                      onClick={() => handleDateSelection("")}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                
                <button
                  onClick={clearFilters}
                  className="text-gray-500 hover:text-gray-700 text-sm underline"
                >
                  Clear filters
                </button>
              </div>
            </div>
          </div>
          
          {/* Attendance Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRows.length > 0 ? (
                    currentRows.map((entry) => (
                      <tr key={entry.date} className="hover:bg-gray-50 border-b border-gray-100">
                        <td className="py-3 px-4 text-sm text-gray-800">{formatDate(entry.date)}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            entry.status === "Present" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button 
                            onClick={() => handleStatusChange(entry.date, entry.status)} 
                            className={`text-xs font-medium px-3 py-1.5 rounded-md ${
                              entry.status === "Present"
                                ? "bg-red-50 text-red-600 hover:bg-red-100"
                                : "bg-green-50 text-green-600 hover:bg-green-100"
                            }`}
                          >
                            {entry.status === "Present" ? "Mark Absent" : "Mark Present"}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="py-12 text-center text-gray-500">
                        No attendance records found for the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {filteredAttendance.length > rowsPerPage && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
                <div className="flex items-center text-sm text-gray-500">
                  Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredAttendance.length)} of {filteredAttendance.length} records
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-md bg-white border border-gray-300 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-gray-700">Page {currentPage}</span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === Math.ceil(filteredAttendance.length / rowsPerPage)}
                    className="p-2 rounded-md bg-white border border-gray-300 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Modals */}
          {/* Profile Edit Modal */}
          {isProfileModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Edit Profile</h2>
                  <button 
                    onClick={() => setIsProfileModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trainee Name</label>
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Field of Specialization</label>
                    <select
                      value={editedSpecialization}
                      onChange={(e) => setEditedSpecialization(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Specialization</option>
                      {specializations.map((spec, idx) => (
                        <option key={idx} value={spec}>{spec}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button 
                    onClick={() => setIsProfileModalOpen(false)} 
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveChanges} 
                    disabled={saving} 
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? (
                      <span className="flex items-center">
                        <Loader2 size={16} className="animate-spin mr-2" />
                        Saving...
                      </span>
                    ) : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Mark Attendance Modal */}
          {isAttendanceModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Mark Attendance</h2>
                  <button 
                    onClick={() => setIsAttendanceModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <div className="flex items-center">
                      <Calendar size={16} className="absolute ml-3 text-gray-400" />
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="attendanceStatus"
                          value="Present"
                          checked={attendanceStatus === "Present"}
                          onChange={() => setAttendanceStatus("Present")}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-gray-700">Present</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="attendanceStatus"
                          value="Absent"
                          checked={attendanceStatus === "Absent"}
                          onChange={() => setAttendanceStatus("Absent")}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-gray-700">Absent</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button 
                    onClick={() => setIsAttendanceModalOpen(false)} 
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleMarkAttendance} 
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    disabled={!selectedDate}
                  >
                    Mark Attendance
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <ToastContainer position="bottom-right" />
    </div>
  );
};

export default AttendanceOverviewPage;