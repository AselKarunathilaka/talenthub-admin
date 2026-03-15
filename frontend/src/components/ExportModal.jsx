// ExportModal.jsx
// Drop-in replacement for the inline ExportModal in DailyRecords.jsx.
// Fetches available templates from the API on mount so the list is always in sync.

import React, { useState, useEffect, useRef } from "react";
import {
  FaFilePdf,
  FaFileExcel,
  FaTimes,
  FaSpinner,
  FaUniversity,
  FaChevronDown,
  FaSearch,
  FaFileWord,
} from "react-icons/fa";

const ExportModal = ({ onClose, onExport, isExporting }) => {
  const [mode, setMode] = useState("all"); // 'single' | 'range' | 'all'
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [templateId, setTemplateId] = useState("default");
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const isExcelTemplate = templateId === "iit";
  const isWordTemplate = templateId === "sliit";

  // Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  // Fetch available templates from the backend on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const { API_BASE_URL, API_ENDPOINTS } =
          await import("../api/apiConfig");

        // Reuse the same auth token logic as the parent component
        const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
        const studentInfo = JSON.parse(
          localStorage.getItem("studentInfo") || "{}",
        );
        const authToken =
          adminInfo.token ||
          localStorage.getItem("authToken") ||
          studentInfo.token;

        const res = await fetch(
          `${API_BASE_URL}${API_ENDPOINTS.RECORDS.EXPORT_TEMPLATES}`,
          { headers: { Authorization: `Bearer ${authToken}` } },
        );

        if (res.ok) {
          const data = await res.json();
          setTemplates(data);
          // Keep templateId in sync – fall back to first entry if current id isn't available
          if (data.length > 0 && !data.find((t) => t.id === templateId)) {
            setTemplateId(data[0].id);
          }
        }
      } catch (err) {
        console.warn("Could not load templates, using defaults.", err);
        // Fallback list so the modal still works if the endpoint is unreachable
        setTemplates([
          { id: "default", label: "Standard (SLT)" },
          //{ id: "nsbm", label: "NSBM Green University" },
          { id: "sliit", label: "SLIIT" },
          { id: "iit", label: "IIT" },
        ]);
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = () => {
    const params = { template: templateId };
    if (mode === "single" && date) params.date = date;
    else if (mode === "range" && startDate && endDate) {
      params.startDate = startDate;
      params.endDate = endDate;
    }
    onExport(params);
  };

  const isValid = () => {
    if (mode === "single") return !!date;
    if (mode === "range") return startDate && endDate && startDate <= endDate;
    return true;
  };

  // Filter templates based on search term
  const filteredTemplates = templates.filter((template) =>
    template.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Get selected template label
  const selectedTemplate = templates.find((t) => t.id === templateId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <FaFilePdf className="text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">
              Export Log Report
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg hover:bg-gray-100"
          >
            <FaTimes />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-5">
          {/* University / Template Selector - Searchable Dropdown */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <FaUniversity className="text-indigo-500" />
              University Template
            </label>

            {loadingTemplates ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                <FaSpinner className="animate-spin" /> Loading templates…
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                {/* Dropdown Button */}
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-xl text-gray-800 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <span className="truncate">
                    {selectedTemplate?.label || "Select a template"}
                  </span>
                  <FaChevronDown
                    className={`text-gray-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 flex flex-col">
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-100">
                      <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                        <input
                          type="text"
                          placeholder="Search templates..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>

                    {/* Template List */}
                    <div className="overflow-y-auto flex-1">
                      {filteredTemplates.length > 0 ? (
                        filteredTemplates.map((tmpl) => (
                          <button
                            key={tmpl.id}
                            onClick={() => {
                              setTemplateId(tmpl.id);
                              setIsDropdownOpen(false);
                              setSearchTerm("");
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                              templateId === tmpl.id
                                ? "bg-indigo-50 text-indigo-700 font-medium"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {tmpl.label}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No templates found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date Range Selector */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Select export range
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "all", label: "All Records" },
                { value: "range", label: "Date Range" },
                { value: "single", label: "Single Day" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition ${
                    mode === opt.value
                      ? "bg-indigo-600 text-white border-indigo-600 shadow"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Inputs */}
          {mode === "single" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          )}

          {mode === "range" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
          )}

          {mode === "all" && (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
              All your log records will be included in the exported{" "}
              {isExcelTemplate
                ? "Excel file"
                : isWordTemplate
                  ? "Word document"
                  : "PDF"}
              .
            </p>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!isValid() || isExporting || loadingTemplates}
            className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow"
          >
            {isExporting ? (
              <>
                <FaSpinner className="animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                {isExcelTemplate ? (
                  <FaFileExcel />
                ) : isWordTemplate ? (
                  <FaFileWord />
                ) : (
                  <FaFilePdf />
                )}
                Export{" "}
                {isExcelTemplate ? "Excel" : isWordTemplate ? "Word" : "PDF"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
