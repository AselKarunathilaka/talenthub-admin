import React, { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

import {
  FaSearch,
  FaCalendarCheck,
  FaUpload,
  FaSpinner,
  FaCheckCircle,
  FaTimesCircle,
  FaTimes,
  FaClipboardList,
  FaVideo,
  FaUser,
  FaLayerGroup,
  FaCalendarAlt,
  FaFileImage,
  FaFileExcel,
  FaFilePdf,
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../api/apiConfig";
import AdminNavigation from "../components/AdminNavigation";

// ── Auth & Helpers ──────────────────────────────────────────────────────────
const getAuthHeaders = () => {
  const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
  return {
    "Content-Type": "application/json",
    ...(adminInfo.token && { Authorization: `Bearer ${adminInfo.token}` }),
  };
};

const getLocalToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const manualAttendanceApi = {
  searchIntern: async (query) => {
    const res = await fetch(`${API_BASE_URL}/admin/manual-attendance/search?q=${encodeURIComponent(query)}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error((await res.json()).error || "Search failed");
    return res.json();
  },
  markAttendance: async (payload) => {
    const res = await fetch(`${API_BASE_URL}/admin/manual-attendance/mark`, {
      method: "POST", headers: getAuthHeaders(), body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Mark failed");
    return res.json();
  },
  bulkMarkAttendance: async (payload) => {
    const res = await fetch(`${API_BASE_URL}/admin/manual-attendance/bulk-mark`, {
      method: "POST", headers: getAuthHeaders(), body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Bulk mark failed");
    return res.json();
  },
};

// ── UI Components ───────────────────────────────────────────────────────────
const Toast = ({ toast, onClose }) => {
  React.useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  const styles = {
    success: "bg-emerald-500 border-emerald-400 text-white",
    error: "bg-red-500 border-red-400 text-white",
    info: "bg-blue-500 border-blue-400 text-white",
  };

  return (
    <motion.div
      className={`fixed bottom-8 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl border shadow-2xl ${styles[toast.type]}`}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
    >
      {toast.type === "success" && <FaCheckCircle className="h-5 w-5 flex-shrink-0" />}
      {toast.type === "error" && <FaTimesCircle className="h-5 w-5 flex-shrink-0" />}
      <span className="text-sm font-semibold flex-1">{toast.text}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 transition-opacity">
        <FaTimes className="h-4 w-4" />
      </button>
    </motion.div>
  );
};

const InternCard = ({ intern, onSelect, selected }) => (
  <motion.button
    onClick={() => onSelect(intern)}
    className={`w-full text-left px-4 py-3 rounded-2xl border transition-all ${
      selected ? "border-[#00b4eb] bg-[#00b4eb]/10 shadow-sm" : "border-slate-200 bg-white hover:border-[#00b4eb]/40 hover:bg-slate-50"
    }`}
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.99 }}
  >
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#0056a2] to-[#00b4eb] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
        {intern.Trainee_Name?.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 truncate">{intern.Trainee_Name}</p>
        <p className="text-xs text-slate-500 truncate">{intern.Trainee_ID} · {intern.Institute || "—"}</p>
      </div>
      {selected && <FaCheckCircle className="text-[#0056a2] h-4 w-4 flex-shrink-0" />}
    </div>
  </motion.button>
);

// ── Main Component ──────────────────────────────────────────────────────────
const AdminManualAttendance = () => {
  const navigate = useNavigate();
  const today = getLocalToday();
  const searchDebounce = useRef(null);

  const [inputMode, setInputMode] = useState("single");
  const [mode, setMode] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(today);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [status, setStatus] = useState("Present");
  const [meetingName, setMeetingName] = useState("");
  const [marking, setMarking] = useState(false);
  const [toast, setToast] = useState(null);
  const [recentMarks, setRecentMarks] = useState([]);
  const [bulkInternIds, setBulkInternIds] = useState("");
  const [bulkResults, setBulkResults] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedExcelFileName, setUploadedExcelFileName] = useState("");

  // OCR states
  const [ocrScanning, setOcrScanning] = useState(false);

  const showToast = (text, type = "info") => setToast({ text, type });

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await manualAttendanceApi.searchIntern(query);
        setSearchResults(data.interns || []);
      } catch (err) {
        showToast(err.message || "Search failed", "error");
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  }, []);

  const handleSelectIntern = (intern) => {
    setSelectedIntern(intern);
    setSearchQuery(intern.Trainee_Name);
    setSearchResults([]);
  };

  const handleMark = async () => {
    if (!selectedIntern) return showToast("Please select an intern first", "error");
    if (mode === "meeting" && !meetingName.trim()) return showToast("Please select a meeting type", "error");

    setMarking(true);
    try {
      const payload = {
        internId: selectedIntern._id,
        date: selectedDate,
        status,
        mode,
        ...(mode === "meeting" && { meetingName: meetingName.trim() }),
      };

      await manualAttendanceApi.markAttendance(payload);
      showToast(`${status} marked for ${selectedIntern.Trainee_Name}`, "success");

      setRecentMarks((prev) => [
        {
          id: Date.now(),
          internName: selectedIntern.Trainee_Name,
          internId: selectedIntern.Trainee_ID,
          mode, status, date: selectedDate,
          meetingName: mode === "meeting" ? meetingName.trim() : null,
          timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev.slice(0, 9),
      ]);

      setSelectedIntern(null);
      setSearchQuery("");
      setMeetingName("");
    } catch (err) {
      showToast(err.message || "Failed to mark attendance", "error");
    } finally {
      setMarking(false);
    }
  };

  const handleBulkMark = async () => {
    const ids = [...new Set(bulkInternIds.split(/[\n,]+/).map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) return showToast("Please enter at least one intern ID", "error");
    if (mode === "meeting" && !meetingName.trim()) return showToast("Please select a meeting type", "error");

    setBulkResults(null);
    setMarking(true);
    try {
      const payload = {
        internIds: ids, date: selectedDate, status, mode,
        ...(mode === "meeting" && { meetingName: meetingName.trim() }),
      };

      const result = await manualAttendanceApi.bulkMarkAttendance(payload);
      setBulkResults(result);

      const successCount = result.results.filter((r) => r.success).length;
      const failureCount = result.results.filter((r) => !r.success).length;

      showToast(`${successCount} marked successfully${failureCount > 0 ? `, ${failureCount} failed` : ""}`, failureCount === 0 ? "success" : "info");

      const successfulMarks = result.results.filter((r) => r.success).map((r) => ({
        id: Date.now() + Math.random(),
        internName: r.internName, internId: r.internId, mode, status,
        date: selectedDate,
        meetingName: mode === "meeting" ? meetingName.trim() : null,
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      }));

      setRecentMarks((prev) => [...successfulMarks, ...prev.slice(0, 10 - successfulMarks.length)]);
      setBulkInternIds("");
    } catch (err) {
      showToast(err.message || "Failed to mark bulk attendance", "error");
    } finally {
      setMarking(false);
    }
  };

  const handleImageUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setOcrScanning(true);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("images", files[i]);
      }

      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      const res = await fetch(`${API_BASE_URL}/admin/manual-attendance/extract-ids-from-images`, {
        method: "POST",
        headers: {
          ...(adminInfo.token && { Authorization: `Bearer ${adminInfo.token}` }),
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process images");
      }

      const uniqueIds = data.ids || [];

      if (uniqueIds.length === 0) {
        showToast("No valid Intern IDs found in the images", "error");
      } else {
        setBulkInternIds((prev) => {
          const existing = prev.split(/[\n,]+/).map((id) => id.trim()).filter((id) => id.length > 0);
          const combined = [...new Set([...existing, ...uniqueIds])];
          return combined.join("\n");
        });
        showToast(`${uniqueIds.length} Intern IDs detected successfully.`, "success");
      }
    } catch (error) {
      console.error("OCR Error:", error);
      showToast(error.message || "Failed to process images. Please try again.", "error");
    } finally {
      setOcrScanning(false);
      event.target.value = null;
    }
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) return showToast("Please upload a PDF file", "error");

    try {
      const data = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const ids = [];

      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const page = await pdf.getPage(pageNo);
        const textContent = await page.getTextContent();
        textContent.items.forEach((item) => {
          const value = item.str.trim();
          if (/^\d{4}$/.test(value)) {
            const id = Number(value);
            if (id >= 3000 && id <= 9999) ids.push(value);
          }
        });
      }

      const uniqueIds = [...new Set(ids)];
      if (uniqueIds.length === 0) return showToast("No Trainee IDs found in PDF", "error");

      setBulkInternIds(uniqueIds.join("\n"));
      setUploadedFileName(file.name);
      showToast(`${uniqueIds.length} Trainee IDs imported successfully`, "success");
    } catch (error) {
      showToast("Failed to process PDF file", "error");
    }
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const headerRowIndex = rows.findIndex(
        (row) => String(row[0] || "").trim() === "Intern ID" && String(row[2] || "").trim() === "Status",
      );

      if (headerRowIndex === -1) return showToast("Could not find Intern ID / Status columns", "error");

      const presentIds = [];
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        const internId = String(row[0] || "").trim();
        const status = String(row[2] || "").trim();
        if (internId.toLowerCase().includes("attendance summary")) break;
        if (internId && status.toLowerCase() === "present") presentIds.push(internId);
      }

      setBulkInternIds(presentIds.join("\n"));
      setUploadedExcelFileName(file.name);
      showToast(`${presentIds.length} present interns loaded`, "success");
    } catch (error) {
      showToast("Failed to read Excel file", "error");
    }
  };

  const canSubmitSingle = selectedIntern && selectedDate && (mode === "daily" || (mode === "meeting" && meetingName.trim()));
  const canSubmitBulk = bulkInternIds.trim().length > 0 && selectedDate && (mode === "daily" || (mode === "meeting" && meetingName.trim()));
  const canSubmit = inputMode === "single" ? canSubmitSingle : canSubmitBulk;

  return (
    <AdminNavigation>
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/60 via-slate-50 to-indigo-50/60 font-sans text-slate-800 pb-20 flex flex-col relative">
        
        <AnimatePresence>
          {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
        </AnimatePresence>

        <div className="relative z-10 flex-1 w-full lg:mt-4 lg:px-6 xl:px-10">
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
            
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-3xl sm:text-4xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight"
                >
                  <div className="p-2.5 bg-gradient-to-br from-[#0056a2] to-[#00b4eb] rounded-2xl text-white shadow-lg shadow-[#0056a2]/20">
                    <FaClipboardList className="h-8 w-8" />
                  </div>
                  Manual Attendance
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="text-slate-500 mt-2 text-sm sm:text-base font-medium max-w-xl"
                >
                  Mark daily or meeting attendance for individual interns or in bulk
                </motion.p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Form Column */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Input Mode & Attendance Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <motion.div 
                    className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-3xl border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] p-5"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Input Mode</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setInputMode("single")}
                        className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 transition-all ${inputMode === "single" ? "bg-gradient-to-br from-[#0056a2] to-[#0078c2] border-transparent text-white shadow-md shadow-[#0056a2]/20" : "bg-white/50 text-slate-600 border-slate-200 hover:border-[#00b4eb]/40"}`}
                      >
                        <FaUser className="h-4 w-4" />
                        <span className="text-xs font-bold">Single</span>
                      </button>
                      <button
                        onClick={() => setInputMode("bulk")}
                        className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 transition-all ${inputMode === "bulk" ? "bg-gradient-to-br from-[#0056a2] to-[#0078c2] border-transparent text-white shadow-md shadow-[#0056a2]/20" : "bg-white/50 text-slate-600 border-slate-200 hover:border-[#00b4eb]/40"}`}
                      >
                        <FaLayerGroup className="h-4 w-4" />
                        <span className="text-xs font-bold">Bulk</span>
                      </button>
                    </div>
                  </motion.div>

                  <motion.div 
                    className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-3xl border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] p-5"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                  >
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Attendance Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => { setMode("daily"); setMeetingName(""); }}
                        className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 transition-all ${mode === "daily" ? "bg-gradient-to-br from-[#0056a2] to-[#0078c2] border-transparent text-white shadow-md shadow-[#0056a2]/20" : "bg-white/50 text-slate-600 border-slate-200 hover:border-[#00b4eb]/40"}`}
                      >
                        <FaClipboardList className="h-4 w-4" />
                        <span className="text-xs font-bold">Daily</span>
                      </button>
                      <button
                        onClick={() => setMode("meeting")}
                        className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 transition-all ${mode === "meeting" ? "bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] border-transparent text-white shadow-md shadow-[#6366f1]/20" : "bg-white/50 text-slate-600 border-slate-200 hover:border-[#8b5cf6]/40"}`}
                      >
                        <FaVideo className="h-4 w-4" />
                        <span className="text-xs font-bold">Meeting</span>
                      </button>
                    </div>
                  </motion.div>
                </div>

                {/* Date & Meeting Name */}
                <motion.div 
                  className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-3xl border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] p-5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Date</label>
                      <div className="relative">
                        <FaCalendarAlt className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none z-10" />
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-[#0056a2] focus:border-transparent focus:bg-white transition-all outline-none"
                        />
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {mode === "meeting" && (
                        <motion.div
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                        >
                          <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Meeting Name <span className="text-red-400">*</span></label>
                          <select
                            value={meetingName}
                            onChange={(e) => setMeetingName(e.target.value)}
                            className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-[#0056a2] focus:border-transparent focus:bg-white transition-all outline-none cursor-pointer"
                          >
                            <option value="" disabled>Select type…</option>
                            <option value="General Meeting">General Meeting</option>
                            <option value="Discussion">Discussion</option>
                          </select>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                {/* Search / Bulk Input */}
                <motion.div 
                  className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-3xl border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] p-5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  {inputMode === "single" ? (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Search Intern</label>
                      <div className="relative mb-4">
                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            handleSearch(e.target.value);
                            if (selectedIntern) setSelectedIntern(null);
                          }}
                          placeholder="Type ID, name or email…"
                          className="w-full pl-11 pr-10 py-3.5 bg-white/50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0056a2] focus:border-transparent focus:bg-white transition-all outline-none placeholder-slate-400"
                        />
                        {searchLoading && <FaSpinner className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0056a2] animate-spin" />}
                        {searchQuery && !searchLoading && (
                          <button onClick={() => { setSearchQuery(""); setSearchResults([]); setSelectedIntern(null); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <FaTimes className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <AnimatePresence>
                        {searchResults.length > 0 && (
                          <motion.div className="space-y-2 overflow-y-auto pr-1 max-h-60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {searchResults.map((intern) => (
                              <InternCard key={intern._id} intern={intern} onSelect={handleSelectIntern} selected={selectedIntern?._id === intern._id} />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {selectedIntern && (
                          <motion.div className="p-4 bg-[#00b4eb]/5 border border-[#00b4eb]/20 rounded-2xl flex items-center gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#0056a2] to-[#00b4eb] flex items-center justify-center text-white font-bold">
                              {selectedIntern.Trainee_Name?.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{selectedIntern.Trainee_Name}</p>
                              <p className="text-xs text-slate-500 truncate">{selectedIntern.Trainee_ID} · {selectedIntern.team || "No team"}</p>
                            </div>
                            <FaCheckCircle className="text-[#0056a2] h-5 w-5 flex-shrink-0" />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {searchQuery && !searchLoading && searchResults.length === 0 && !selectedIntern && (
                        <div className="flex flex-col items-center justify-center text-slate-400 py-8">
                          <FaSearch className="h-8 w-8 mb-2 opacity-30" />
                          <p className="text-sm font-medium">No interns found matching "{searchQuery}"</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Intern IDs <span className="text-red-400">*</span></label>
                      <textarea
                        value={bulkInternIds}
                        onChange={(e) => setBulkInternIds(e.target.value)}
                        placeholder={`ID001, ID002, ID003\nor\nID001\nID002\nID003`}
                        className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0056a2] focus:border-transparent focus:bg-white transition-all resize-none font-mono outline-none placeholder-slate-400 h-32"
                      />
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                        <label className={`flex flex-col items-center justify-center gap-2 px-4 py-4 rounded-xl transition-all cursor-pointer ${ocrScanning ? "bg-indigo-50 border border-indigo-200 opacity-80" : "bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 hover:from-indigo-100 hover:to-purple-100"}`}>
                          {ocrScanning ? <FaSpinner className="text-indigo-600 animate-spin h-5 w-5" /> : <FaFileImage className="text-indigo-600 h-5 w-5" />}
                          <span className="text-xs font-bold text-slate-700 text-center">{ocrScanning ? "Scanning..." : "Upload Image"}</span>
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="hidden" onChange={handleImageUpload} disabled={ocrScanning} />
                        </label>

                        <label className="flex flex-col items-center justify-center gap-2 px-4 py-4 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 cursor-pointer hover:from-emerald-100 hover:to-green-100 transition-all">
                          <FaFileExcel className="text-[#50b748] h-5 w-5" />
                          <span className="text-xs font-bold text-slate-700 text-center">Upload Excel</span>
                          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
                        </label>

                        <label className="flex flex-col items-center justify-center gap-2 px-4 py-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 cursor-pointer hover:from-amber-100 hover:to-orange-100 transition-all">
                          <FaFilePdf className="text-amber-600 h-5 w-5" />
                          <span className="text-xs font-bold text-slate-700 text-center">Upload PDF</span>
                          <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
                        </label>
                      </div>

                      {uploadedFileName && <p className="mt-3 text-xs text-amber-600 font-bold flex items-center gap-1.5"><FaCheckCircle /> Loaded: {uploadedFileName}</p>}
                      {uploadedExcelFileName && <p className="mt-3 text-xs text-[#50b748] font-bold flex items-center gap-1.5"><FaCheckCircle /> Loaded: {uploadedExcelFileName}</p>}
                      
                      {bulkInternIds.trim().length > 0 && (
                        <p className="mt-3 text-xs text-[#0056a2] font-bold">{bulkInternIds.split(/[\n,]+/).filter((id) => id.trim().length > 0).length} IDs detected</p>
                      )}
                    </div>
                  )}
                </motion.div>

                {/* Status & Submit */}
                <motion.div 
                  className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-3xl border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] p-5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Status</label>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                      onClick={() => setStatus("Present")}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${status === "Present" ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md shadow-emerald-500/20" : "bg-[#50b748]/10 text-[#15803d] border border-[#50b748]/20"}`}
                    >
                      <FaCheckCircle className="h-4 w-4" /> Present
                    </button>
                    <button
                      onClick={() => setStatus("Absent")}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${status === "Absent" ? "bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-md shadow-rose-500/20" : "bg-[#ef4444]/10 text-[#b91c1c] border border-[#ef4444]/20"}`}
                    >
                      <FaTimesCircle className="h-4 w-4" /> Absent
                    </button>
                  </div>

                  <motion.button
                    onClick={inputMode === "single" ? handleMark : handleBulkMark}
                    disabled={!canSubmit || marking}
                    whileHover={{ scale: canSubmit && !marking ? 1.01 : 1 }}
                    whileTap={{ scale: canSubmit && !marking ? 0.99 : 1 }}
                    className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-white text-sm font-bold transition-all shadow-lg disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none ${
                      mode === "daily" ? "bg-gradient-to-r from-[#0056a2] to-[#00b4eb] hover:from-[#004488] hover:to-[#009bd4] shadow-[#0056a2]/20" : "bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#4f46e5] hover:to-[#7c3aed] shadow-[#6366f1]/20"
                    }`}
                  >
                    {marking ? (
                      <><FaSpinner className="h-5 w-5 animate-spin" /> Marking…</>
                    ) : (
                      <>
                        {mode === "daily" ? <FaClipboardList className="h-5 w-5" /> : <FaVideo className="h-5 w-5" />}
                        {inputMode === "single" ? "Mark" : "Bulk Mark"} {status} - {mode === "daily" ? "Daily" : "Meeting"}
                      </>
                    )}
                  </motion.button>
                </motion.div>

                {/* Bulk Results */}
                <AnimatePresence>
                  {bulkResults && (
                    <motion.div className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-3xl border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <h3 className="text-sm font-bold text-slate-800 mb-3">Bulk Mark Results</h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {bulkResults.results.map((result, idx) => (
                          <div key={idx} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border ${result.success ? "bg-[#50b748]/10 border-[#50b748]/20" : "bg-[#ef4444]/10 border-[#ef4444]/20"}`}>
                            {result.success ? <FaCheckCircle className="h-4 w-4 text-[#50b748] flex-shrink-0" /> : <FaTimesCircle className="h-4 w-4 text-[#ef4444] flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-bold truncate ${result.success ? "text-[#15803d]" : "text-[#b91c1c]"}`}>{result.internId}</p>
                              {result.internName && <p className={`text-[11px] truncate ${result.success ? "text-[#15803d]/80" : "text-[#b91c1c]/80"}`}>{result.internName}</p>}
                            </div>
                            {!result.success && result.error && <span className="text-[10px] text-[#b91c1c] flex-shrink-0 max-w-[100px] text-right">{result.error}</span>}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right Activity Panel - Redesigned */}
              <motion.div 
                className="lg:col-span-4"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="bg-white/80 md:bg-white/20 md:backdrop-blur-3xl rounded-3xl border border-[#00b4eb]/20 shadow-[0_0_15px_rgba(0,180,235,0.1)] overflow-hidden h-fit sticky top-24 flex flex-col">
                  <div className="px-6 py-5 border-b border-slate-100/80 bg-white/30">
                    <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                      <FaCalendarCheck className="h-4 w-4 text-[#0056a2]" /> Recent Marks
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Latest activity in this session</p>
                  </div>

                  {recentMarks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 text-slate-400">
                      <div className="w-20 h-20 rounded-3xl bg-slate-100/80 flex items-center justify-center mb-4 border border-slate-200/50 shadow-sm">
                        <FaClipboardList className="h-8 w-8 text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-500">No marks yet</p>
                      <p className="text-xs text-slate-400 mt-1.5">Activity will appear here as you mark.</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                      <AnimatePresence initial={false}>
                        {recentMarks.map((mark) => (
                          <motion.div 
                            key={mark.id} 
                            className="bg-white/70 border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all"
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, scale: 0.9 }}
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm flex-shrink-0 border border-slate-200">
                                {mark.internName?.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">{mark.internName}</p>
                                <p className="text-xs text-slate-500 truncate">{mark.internId}</p>
                              </div>
                              <span className="text-[10px] text-slate-400 flex-shrink-0 font-medium bg-slate-100 px-2 py-1 rounded-md">{mark.timestamp}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-wrap pl-13">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${mark.status === "Present" ? "bg-[#50b748]/10 text-[#15803d]" : "bg-[#ef4444]/10 text-[#b91c1c]"}`}>
                                {mark.status === "Present" ? <FaCheckCircle className="h-2.5 w-2.5" /> : <FaTimesCircle className="h-2.5 w-2.5" />}
                                {mark.status}
                              </span>
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${mark.mode === "daily" ? "bg-[#00b4eb]/10 text-[#0056a2]" : "bg-indigo-100 text-indigo-700"}`}>
                                {mark.mode === "daily" ? "Daily" : "Meeting"}
                              </span>
                              {mark.meetingName && <span className="text-[10px] text-slate-500 truncate max-w-[100px] italic bg-slate-100 px-2 py-1 rounded-md">"{mark.meetingName}"</span>}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </motion.div>

            </div>
          </main>
        </div>
      </div>
    </AdminNavigation>
  );
};

export default AdminManualAttendance;