import React, { useState, useRef } from "react";
import { createLeaveRequest } from "../api/leaveRequestApi";
import toast from "react-hot-toast";
import { FiFileText, FiCalendar, FiClock, FiUpload, FiX, FiCheckCircle } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const isValidSriLankanNIC = (nic) => {
  const nicRegex = /^(\d{9}[VXvx]|\d{12})$/;
  return nicRegex.test(nic);
};

const LeaveRequestForm = ({ onSuccess, requestType = "short_leave" }) => {
  const isStudyLeave = requestType === "study_leave";
  const [formData, setFormData] = useState({
    leaveDate: "",
    studyEndDate: "",
    leaveTime: isStudyLeave ? "Full Day" : "",
    nationalId: "",
    purpose: isStudyLeave ? "Academic Exams / Study" : "Personal",
    reason: "",
  });

  const [proofDocument, setProofDocument] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "nationalId" ? value.toUpperCase().trim() : value,
    }));
  };

  /* ===============================
     Handle File Upload
  ================================ */
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    validateAndSetFile(file);
  };

  const validateAndSetFile = (file) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setProofDocument(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    validateAndSetFile(file);
  };

  const removeFile = () => {
    setProofDocument(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ===============================
     Submit Form
  ================================ */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      (!isStudyLeave && !formData.leaveTime) ||
      !formData.nationalId ||
      !formData.purpose ||
      !formData.reason ||
      (isStudyLeave && !formData.leaveDate)
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!isValidSriLankanNIC(formData.nationalId)) {
      toast.error("Invalid NIC number. Use 9 digits + V/X or 12-digit new NIC format");
      return;
    }

    if (formData.reason.length < 10) {
      toast.error("Reason must be at least 10 characters long");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    if (isStudyLeave) {
      if (!formData.studyEndDate) {
        toast.error("Please select the final extended leave date");
        return;
      }

      if (formData.studyEndDate < formData.leaveDate) {
        toast.error("End date cannot be before start date");
        return;
      }

      if (!proofDocument) {
        toast.error("Proof document is required for formal extended leave");
        return;
      }
    }

    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append("leaveDate", isStudyLeave ? formData.leaveDate : today);
      if (isStudyLeave && formData.studyEndDate) {
        submitData.append("studyEndDate", formData.studyEndDate);
      }
      submitData.append("leaveTime", isStudyLeave ? "Full Day" : formData.leaveTime);
      submitData.append("nationalId", formData.nationalId);
      submitData.append("purpose", formData.purpose);
      submitData.append("reason", formData.reason);
      submitData.append("requestType", requestType);
      if (proofDocument) {
        submitData.append("proofDocument", proofDocument);
      }

      await createLeaveRequest(submitData);
      toast.success(
        isStudyLeave
          ? "Extended leave request submitted successfully"
          : "Leave request submitted successfully",
      );

      setFormData({
        leaveDate: "",
        studyEndDate: "",
        leaveTime: isStudyLeave ? "Full Day" : "",
        nationalId: "",
        purpose: isStudyLeave ? "Academic Exams / Study" : "Personal",
        reason: "",
      });

      setProofDocument(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error submitting leave request:", error);
      if (error.message && error.message.includes("past")) {
        toast.error("Leave date cannot be in the past. Please ensure your system date/time is correct and try again.", { duration: 5000 });
      } else if (error.message && error.message.includes("already exists")) {
        toast.error("You already have a leave request for this date. Only one request per day is allowed.", { duration: 4000 });
      } else {
        const errorMessage =
          error.message ||
          error.error ||
          error.details?.join?.(", ") ||
          "Failed to submit leave request";
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  const inputClasses = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-[#00b4eb] focus:border-transparent transition-all text-sm font-medium text-gray-800 outline-none";
  const labelClasses = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
    >
      <div className="bg-gradient-to-r from-slate-50 to-white p-6 md:p-8 border-b border-gray-100 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00b4eb] via-[#0056a2] to-[#50b748]"></div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shadow-inner">
            <FiFileText className="text-[#0056a2] text-2xl" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              {isStudyLeave ? "New Extended Leave Request" : "New Short Leave Request"}
            </h2>
            <p className="text-gray-500 text-sm font-medium mt-1">
              {isStudyLeave ? "Submit your extended leave with required proof document" : "Submit your request to exit SLT premises early"}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div whileTap={{ scale: 0.995 }} className="min-w-0">
            <label className={labelClasses}>
              <FiCalendar className="text-[#00b4eb]" /> {isStudyLeave ? "Start Date *" : "Leave Date *"}
            </label>
            {isStudyLeave ? (
              <>
                <input
                  type="date"
                  name="leaveDate"
                  value={formData.leaveDate}
                  onChange={handleChange}
                  min={today}
                  required
                  className={`${inputClasses} appearance-none`}
                />
                <p className="text-[10px] text-gray-400 font-bold mt-1.5 uppercase">Select the first day of your leave</p>
              </>
            ) : (
              <>
                <input
                  type="date"
                  name="leaveDate"
                  value={today}
                  readOnly
                  className={`${inputClasses} appearance-none opacity-70 cursor-not-allowed pointer-events-none`}
                />
                <p className="text-[10px] text-gray-400 font-bold mt-1.5 uppercase">Date is automatically set to today</p>
              </>
            )}
          </motion.div>

          {isStudyLeave ? (
            <motion.div whileTap={{ scale: 0.995 }} className="min-w-0">
              <label className={labelClasses}>
                <FiCalendar className="text-[#00b4eb]" /> End Date *
              </label>
              <input
                type="date"
                name="studyEndDate"
                value={formData.studyEndDate}
                onChange={handleChange}
                min={formData.leaveDate || today}
                required
                className={`${inputClasses} appearance-none`}
              />
              <p className="text-[10px] text-gray-400 font-bold mt-1.5 uppercase">Select the final day of your leave</p>
            </motion.div>
          ) : (
            <motion.div whileTap={{ scale: 0.995 }} className="min-w-0">
              <label className={labelClasses}>
                <FiClock className="text-[#00b4eb]" /> Leave Time *
              </label>
              <input
                type="time"
                name="leaveTime"
                value={formData.leaveTime}
                onChange={handleChange}
                required
                className={`${inputClasses} appearance-none`}
              />
            </motion.div>
          )}

          <motion.div whileTap={{ scale: 0.995 }} className="min-w-0">
            <label className={labelClasses}>
              <span className="w-3 h-3 rounded-full border-2 border-[#00b4eb] flex items-center justify-center text-[#00b4eb] text-[6px]">ID</span>
              National ID Number *
            </label>
            <input
              type="text"
              name="nationalId"
              value={formData.nationalId}
              onChange={handleChange}
              placeholder="e.g. 123456789V or 200012345678"
              required
              className={`${inputClasses} ${
                formData.nationalId && !isValidSriLankanNIC(formData.nationalId)
                  ? "border-red-300 bg-red-50 focus:ring-red-500"
                  : ""
              }`}
            />
            {formData.nationalId && !isValidSriLankanNIC(formData.nationalId) && (
              <p className="text-xs text-rose-500 font-medium mt-1.5 flex items-center gap-1">
                <FiX /> Invalid NIC format
              </p>
            )}
          </motion.div>

          <motion.div whileTap={{ scale: 0.995 }} className="min-w-0">
            <label className={labelClasses}>
              <span className="w-3 h-3 rounded-full border-2 border-[#00b4eb] flex items-center justify-center text-[#00b4eb] text-[6px]">?</span>
              Purpose *
            </label>
            {isStudyLeave ? (
              <input
                type="text"
                name="purpose"
                value="Academic Exams / Study"
                readOnly
                className={`${inputClasses} appearance-none opacity-70 cursor-not-allowed pointer-events-none`}
              />
            ) : (
              <select
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                required
                className={`${inputClasses} appearance-none cursor-pointer`}
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em" }}
              >
                <option value="Personal">Personal</option>
                <option value="Official">Official</option>
              </select>
            )}
          </motion.div>
        </div>

        <motion.div whileTap={{ scale: 0.995 }}>
          <label className={labelClasses}>Reason *</label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            rows="3"
            minLength="10"
            required
            placeholder="Please provide a detailed reason..."
            className={`${inputClasses} resize-none`}
          />
          <div className="flex justify-between items-center mt-1.5">
            <p className="text-[10px] text-gray-400 font-bold uppercase">10 characters minimum</p>
            <p className={`text-[10px] font-bold ${formData.reason.length < 10 ? 'text-rose-400' : 'text-[#50b748]'}`}>
              {formData.reason.length} chars
            </p>
          </div>
        </motion.div>

        <div>
          <label className={labelClasses}>
            <FiUpload className="text-[#00b4eb]" /> Proof Document {isStudyLeave ? "*" : "(Optional)"}
          </label>
          <div 
            className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-200 ${
              isDragging ? "border-[#00b4eb] bg-blue-50/50" : proofDocument ? "border-[#50b748] bg-green-50/30" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="hidden"
              id="file-upload"
            />
            
            <AnimatePresence mode="wait">
              {!proofDocument ? (
                <motion.div 
                  key="upload-prompt"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center text-center cursor-pointer"
                  onClick={() => fileInputRef.current.click()}
                >
                  <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                    <FiUpload className="text-gray-400 text-xl" />
                  </div>
                  <p className="text-sm font-bold text-gray-700">Click to upload or drag and drop</p>
                  <p className="text-xs font-medium text-gray-400 mt-1">PDF, JPG, PNG or DOC (max. 5MB)</p>
                </motion.div>
              ) : (
                <motion.div 
                  key="file-info"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#50b748]/30 shadow-sm"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                      <FiFileText className="text-[#50b748] text-lg" />
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-bold text-gray-800 truncate">{proofDocument.name}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">{(proofDocument.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); removeFile(); }}
                    className="p-2 hover:bg-red-50 text-gray-400 hover:text-rose-500 rounded-lg transition-colors shrink-0"
                  >
                    <FiX />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl text-white font-extrabold flex items-center justify-center gap-2 transition-all duration-300 ${
              loading
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-gradient-to-r from-[#0056a2] to-[#00b4eb] hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.01] active:scale-[0.99]"
            }`}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Submitting...</span>
              </div>
            ) : (
              <>
                <FiCheckCircle className="text-lg" />
                Submit Request
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default LeaveRequestForm;
