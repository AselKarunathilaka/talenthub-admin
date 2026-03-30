import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Search, Calendar, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

const InternSelectionModal = ({
  isOpen,
  onClose,
  interns,
  selectedInterns,
  onSelectInterns,
  onMarkAttendance,
  defaultDate = new Date().toISOString().split("T")[0]
}) => {
  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [localSelected, setLocalSelected] = useState([]);
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [attendanceStatus, setAttendanceStatus] = useState("Present");
  const [isMarking, setIsMarking] = useState(false);
  const [markedCount, setMarkedCount] = useState(0);
  const [markingProgress, setMarkingProgress] = useState(0);

  // Initialize with passed selected interns
  useEffect(() => {
    setLocalSelected([...selectedInterns]);
  }, [selectedInterns, isOpen]);

  // Filter interns based on search term and selection
  const filteredInterns = interns.filter(intern => {
    if (!searchTerm) return localSelected.includes(intern._id);
    
    const searchLower = searchTerm.toLowerCase();
    return (
      intern.traineeId?.toLowerCase().includes(searchLower) ||
      intern.traineeName?.toLowerCase().includes(searchLower)
    );
  });

  // Toggle selection for a single intern
  const toggleInternSelection = internId => {
    setLocalSelected(prev => 
      prev.includes(internId)
        ? prev.filter(id => id !== internId)
        : [...prev, internId]
    );
    if (searchTerm) setSearchTerm("");
  };

  // Toggle selection for all visible interns
  const handleSelectAll = () => {
    setLocalSelected(prev => 
      prev.length === filteredInterns.length
        ? []
        : filteredInterns.map(intern => intern._id)
    );
    setSearchTerm("");
  };

  // Handle date changes with validation
  const handleDateChange = e => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    
    if (newDate < new Date().toISOString().split("T")[0]) {
      toast("You're selecting a past date", { icon: "⚠️", duration: 2000 });
    }
  };

  // Confirm selection and close modal
  const handleConfirmSelection = () => {
    onSelectInterns(localSelected);
    onClose();
  };

  // Mark attendance for selected interns
  const handleMarkAttendance = async () => {
    if (!localSelected.length) {
      toast.error("Please select at least one intern");
      return;
    }

    setIsMarking(true);
    setMarkedCount(0);
    const totalToMark = localSelected.length;

    try {
      for (let i = 0; i < localSelected.length; i++) {
        const internId = localSelected[i];
        try {
          await onMarkAttendance(internId, attendanceStatus, selectedDate);
          setMarkedCount(prev => prev + 1);
          setMarkingProgress(Math.round(((i + 1) / totalToMark) * 100));
        } catch (error) {
          console.error(`Error marking attendance for ${internId}:`, error);
        }
      }

      toast.success(`Marked ${markedCount}/${totalToMark} interns as ${attendanceStatus}`);
      setLocalSelected([]);
    } finally {
      setIsMarking(false);
      setMarkingProgress(0);
    }
  };

  // Status color mapping
  const statusColors = {
    Present: { bg: "bg-green-600", hover: "hover:bg-green-700" },
    Absent: { bg: "bg-red-600", hover: "hover:bg-red-700" }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                Intern Selection
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Controls */}
            <div className="p-4 space-y-3 sm:space-y-0 sm:flex sm:space-x-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>

              <select
                value={attendanceStatus}
                onChange={(e) => setAttendanceStatus(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
              </select>
            </div>

            {/* Progress indicator */}
            {isMarking && (
              <div className="px-4 pt-1 pb-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${markingProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1 text-right">
                  Marked {markedCount} of {localSelected.length}
                </p>
              </div>
            )}

            {/* Interns list */}
            <div className="flex-1 overflow-y-auto">
              {filteredInterns.length > 0 ? (
                <>
                  <div className="p-3 bg-gray-50 flex justify-between items-center">
                    <button
                      onClick={handleSelectAll}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-2 transition-colors"
                    >
                      <CheckCircle2 size={16} />
                      {localSelected.length === filteredInterns.length
                        ? "Deselect all"
                        : "Select all"}
                    </button>
                    <span className="text-sm text-gray-500">
                      {filteredInterns.length} {filteredInterns.length === 1 ? "intern" : "interns"}
                    </span>
                  </div>

                  <ul className="divide-y divide-gray-100">
                    {filteredInterns.map(intern => (
                      <li key={intern._id}>
                        <button
                          onClick={() => !isMarking && toggleInternSelection(intern._id)}
                          disabled={isMarking}
                          className={`w-full text-left p-4 flex items-center justify-between transition-colors ${
                            localSelected.includes(intern._id)
                              ? "bg-blue-50/50"
                              : "hover:bg-gray-50"
                          } ${isMarking ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
                        >
                          <div className="space-y-1">
                            <p className="font-medium text-gray-900">
                              {intern.traineeName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {intern.traineeId} • {intern.fieldOfSpecialization}
                            </p>
                          </div>
                          {localSelected.includes(intern._id) && (
                            <div className="p-1 rounded-full bg-blue-100 text-blue-600">
                              <Check className="h-4 w-4" />
                            </div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  {searchTerm
                    ? "No matching interns found"
                    : "No interns selected"}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {localSelected.length} {localSelected.length === 1 ? "intern" : "interns"} selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    disabled={isMarking}
                    className={`px-4 py-2 border rounded-lg transition-colors ${
                      isMarking
                        ? "border-gray-200 text-gray-400 cursor-not-allowed"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmSelection}
                    disabled={isMarking}
                    className={`px-4 py-2 bg-blue-600 text-white rounded-lg transition-colors ${
                      isMarking
                        ? "opacity-70 cursor-not-allowed"
                        : "hover:bg-blue-700"
                    }`}
                  >
                    Save Selection
                  </button>
                </div>
              </div>

              <button
                onClick={handleMarkAttendance}
                disabled={isMarking || !localSelected.length}
                className={`w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  isMarking
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : !localSelected.length
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : `${statusColors[attendanceStatus].bg} text-white ${statusColors[attendanceStatus].hover}`
                }`}
              >
                {isMarking ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5" />
                    Processing...
                  </>
                ) : (
                  <>
                    {attendanceStatus === "Present" ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <AlertCircle size={18} />
                    )}
                    Mark as {attendanceStatus}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InternSelectionModal;