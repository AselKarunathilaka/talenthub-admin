// ExportModal.jsx
// Export log report modal for daily records.
// Uses the standard SLT Mobitel PDF template for all universities.

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FaFilePdf, FaTimes, FaSpinner } from "react-icons/fa";

const ExportModal = ({ isPreview = false, onClose, onExport, isExporting }) => {
  const [mode, setMode] = useState("all"); // 'single' | 'range' | 'all'
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleExport = () => {
    const params = { template: "default" };
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

  const modalContent = (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 pt-16 pb-10 bg-slate-900/40 backdrop-blur-sm pointer-events-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden max-h-[calc(100vh-140px)] flex flex-col" onClick={(e) => e.stopPropagation()}>
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
              All your log records will be included in the exported PDF.
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
            disabled={!isValid() || isExporting}
            className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow"
          >
            {isExporting ? (
              <>
                <FaSpinner className="animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <FaFilePdf />
                Export PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.getElementById("layout-modal-root") || document.body) : modalContent;
};

export default ExportModal;
