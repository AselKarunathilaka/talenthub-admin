import React, { useState, useEffect } from "react";
import { FaTimes, FaFilePdf, FaDownload, FaEye, FaSpinner, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../api/apiConfig";
import { getAdminSession } from "../utils/adminAuth";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";

const AdminUniversityExportModal = ({ isOpen, onClose, preselectedUniversities = [], availableUniversities = [] }) => {
  const [selectedUniversities, setSelectedUniversities] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedUniversities(preselectedUniversities);
      setReportData([]);
      setPreviewMode(false);
    }
  }, [isOpen, preselectedUniversities]);

  const handleToggleUniversity = (uni) => {
    if (selectedUniversities.includes(uni)) {
      setSelectedUniversities(selectedUniversities.filter((u) => u !== uni));
    } else {
      setSelectedUniversities([...selectedUniversities, uni]);
    }
  };

  const fetchReportData = async () => {
    if (selectedUniversities.length === 0) {
      toast.error("Please select at least one university.");
      return;
    }

    try {
      setIsLoading(true);
      const token = getAdminSession()?.token;

      // Fetch data for all selected universities in parallel
      const fetchPromises = selectedUniversities.map(async (uniName) => {
        const response = await fetch(`${API_BASE_URL}/university/students?universityName=${encodeURIComponent(uniName)}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data for ${uniName}`);
        }
        
        const data = await response.json();
        return {
          universityName: uniName,
          supervisorName: data.supervisorName || "N/A",
          students: data.students || []
        };
      });

      const results = await Promise.all(fetchPromises);
      setReportData(results);
      setPreviewMode(true);
      toast.success("Preview generated successfully.");
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to fetch report data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Convert image URL to Base64 for PDF
  const loadProfileImageBase64 = (url) => {
    return new Promise((resolve) => {
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width || 140;
          canvas.height = img.naturalHeight || img.height || 140;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL("image/jpeg", 0.9);
          resolve(dataURL);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const generatePDF = async () => {
    try {
      setIsLoading(true);
      const doc = new jsPDF("landscape", "mm", "a4");
      
      const pageWidth = doc.internal.pageSize.width;
      
      // Document Metadata
      doc.setProperties({
        title: "TalentHub Intern Report",
        subject: "University Interns Audit",
        author: "TalentHub System",
      });

      // Cover Page / Global Header
      doc.setFillColor(0, 0, 102);
      doc.rect(0, 0, pageWidth, 25, "F");
      
      doc.setFillColor(0, 102, 0);
      doc.rect(0, 25, pageWidth, 2.5, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("TALENTHUB  •  INTERN UNIVERSITY REPORT", 14, 15);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(200, 200, 200);
      const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      doc.text(`Generated on ${dateStr}`, 14, 21);

      let currentY = 35;

      for (let i = 0; i < reportData.length; i++) {
        const uniData = reportData[i];
        
        // If not first university and not enough space, add new page
        if (i > 0) {
          doc.addPage();
          currentY = 15;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(`University: ${uniData.universityName}`, 14, currentY);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Supervisor: ${uniData.supervisorName} | Total Interns: ${uniData.students.length}`, 14, currentY + 6);
        
        currentY += 12;

        if (uniData.students.length === 0) {
          doc.setFont("helvetica", "italic");
          doc.text("No interns found for this university.", 14, currentY + 5);
          currentY += 15;
          continue;
        }

        const tableBody = uniData.students.map((student) => {
          // Projects formatted horizontally: "Project A - 85%, Project B - 85%"
          // Using overall quality score as requested
          const qScore = student.qualityScore || 0;
          const projText = (student.enrolledProjects || []).length > 0
            ? student.enrolledProjects.map(p => `${p.name} — ${qScore}%`).join(", ")
            : "No Projects";

          return [
            student.name || "N/A",
            student.traineeId || "N/A",
            "N/A", // University ID missing from schema
            student.fieldOfSpecialization || "Not Specified",
            uniData.supervisorName || "N/A",
            projText
          ];
        });

        autoTable(doc, {
          startY: currentY,
          head: [["Name", "Trainee ID", "University ID", "Specialization", "Supervisor", "Projects"]],
          body: tableBody,
          theme: "striped",
          headStyles: {
            fillColor: [0, 0, 102],
            textColor: 255,
            fontSize: 9,
            fontStyle: "bold",
          },
          styles: {
            fontSize: 8,
            cellPadding: 3,
            textColor: [50, 50, 50],
          },
          columnStyles: {
            0: { cellWidth: 35, fontStyle: "bold" },
            1: { cellWidth: 25 },
            2: { cellWidth: 25, halign: "center" },
            3: { cellWidth: 35 },
            4: { cellWidth: 35 },
            5: { cellWidth: 'auto' }, // Projects take remaining space
          },
          didDrawPage: (data) => {
            // Footer
            const pageHeight = doc.internal.pageSize.height;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 20, pageHeight - 10, { align: "right" });
            doc.text("TalentHub Official Compliance Audit", 14, pageHeight - 10);
          }
        });

        currentY = doc.lastAutoTable.finalY + 10;
      }

      doc.save(`TalentHub_University_Report_${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success("PDF exported successfully!");
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Failed to generate PDF.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-full flex flex-col overflow-hidden border border-slate-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div>
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <FaFilePdf className="text-red-500" />
                {previewMode ? "Report Preview" : "Generate Export"}
              </h2>
              <p className="text-slate-500 text-sm font-medium mt-1">
                {previewMode ? "Review the data before downloading the PDF." : "Select universities to include in the combined PDF report."}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <FaTimes className="w-6 h-6" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 flex-1 overflow-y-auto">
            {!previewMode ? (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3 text-blue-800">
                  <FaExclamationCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium">
                    You can select multiple universities to generate a combined, grouped report. The report will strictly include the required fields: Profile, Trainee ID, University ID, Name, Specialization, Supervisor, and Projects.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-slate-700 mb-3 uppercase tracking-wider text-sm">Select Universities</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {availableUniversities.map((uni, idx) => {
                      const isSelected = selectedUniversities.includes(uni);
                      return (
                        <button
                          key={idx}
                          onClick={() => handleToggleUniversity(uni)}
                          className={`flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all ${
                            isSelected 
                              ? "border-blue-500 bg-blue-50/50 shadow-sm" 
                              : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <span className={`text-sm font-bold truncate ${isSelected ? "text-blue-800" : "text-slate-600"}`} title={uni}>
                            {uni}
                          </span>
                          {isSelected && <FaCheckCircle className="text-blue-500 shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8 bg-slate-50 rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-inner">
                {/* Print/Preview styling layout mimicking the PDF */}
                
                <div className="border-b-4 border-blue-900 pb-4 mb-6">
                  <h1 className="text-xl font-black text-blue-900 uppercase tracking-widest">TalentHub • Intern University Report</h1>
                  <p className="text-slate-500 text-sm font-medium mt-1">Generated on {new Date().toLocaleDateString()}</p>
                </div>

                {reportData.map((uniData, idx) => (
                  <div key={idx} className="mb-10 last:mb-0 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="mb-4">
                      <h3 className="text-lg font-black text-slate-800">{uniData.universityName}</h3>
                      <div className="flex items-center gap-4 text-sm font-semibold text-slate-500 mt-1">
                        <span>Supervisor: {uniData.supervisorName}</span>
                        <span>&bull;</span>
                        <span>Total Interns: {uniData.students.length}</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white border-b border-slate-200">
                            <th className="p-3 text-xs font-bold uppercase tracking-wider rounded-tl-lg">Name</th>
                            <th className="p-3 text-xs font-bold uppercase tracking-wider">Trainee ID</th>
                            <th className="p-3 text-xs font-bold uppercase tracking-wider">University ID</th>
                            <th className="p-3 text-xs font-bold uppercase tracking-wider">Specialization</th>
                            <th className="p-3 text-xs font-bold uppercase tracking-wider">Supervisor</th>
                            <th className="p-3 text-xs font-bold uppercase tracking-wider rounded-tr-lg">Projects</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {uniData.students.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="p-6 text-center text-slate-500 font-medium italic">
                                No interns found for this university.
                              </td>
                            </tr>
                          ) : (
                            uniData.students.map((student, sIdx) => {
                              const qScore = student.qualityScore || 0;
                              return (
                                <tr key={sIdx} className="hover:bg-slate-50">
                                  <td className="p-3 text-sm font-bold text-slate-700">{student.name || "N/A"}</td>
                                  <td className="p-3 text-sm font-medium text-slate-600">{student.traineeId || "N/A"}</td>
                                  <td className="p-3 text-sm font-bold text-rose-500 bg-rose-50 text-center rounded m-1">N/A</td>
                                  <td className="p-3 text-sm font-medium text-slate-600">{student.fieldOfSpecialization || "Not Specified"}</td>
                                  <td className="p-3 text-sm font-medium text-slate-600">{uniData.supervisorName}</td>
                                  <td className="p-3 text-sm font-medium text-slate-600">
                                    <div className="flex flex-wrap gap-1">
                                      {(student.enrolledProjects || []).length > 0 ? (
                                        student.enrolledProjects.map((p, pIdx) => (
                                          <span key={pIdx} className="inline-block px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs">
                                            {p.name} <span className="font-bold text-blue-600 ml-1">{qScore}%</span>
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-slate-400 italic">No Projects</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-slate-100 bg-white flex items-center justify-end gap-3 shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            
            {!previewMode ? (
              <button
                onClick={fetchReportData}
                disabled={isLoading || selectedUniversities.length === 0}
                className="flex items-center gap-2 px-8 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <FaSpinner className="animate-spin" /> : <FaEye />}
                Preview Report
              </button>
            ) : (
              <>
                <button
                  onClick={() => setPreviewMode(false)}
                  className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors mr-auto"
                >
                  Back
                </button>
                <button
                  onClick={generatePDF}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <FaSpinner className="animate-spin" /> : <FaDownload />}
                  Download PDF
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AdminUniversityExportModal;
