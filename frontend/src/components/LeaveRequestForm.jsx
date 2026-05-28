import React, { useState } from "react";
import { createLeaveRequest } from "../api/leaveRequestApi";
import toast from "react-hot-toast";
import { FiFileText, FiCalendar, FiClock, FiUpload } from "react-icons/fi";

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
    purpose: isStudyLeave ? "Study" : "Personal",
    reason: "",
  });

  const [proofDocument, setProofDocument] = useState(null);
  const [loading, setLoading] = useState(false);

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

    if (file) {
      // 5MB limit
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        e.target.value = "";
        return;
      }
      setProofDocument(file);
    }
  };

  /* ===============================
     Submit Form
  ================================ */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Required field validation
    if (
      !formData.leaveDate ||
      (!isStudyLeave && !formData.leaveTime) ||
      !formData.nationalId ||
      !formData.purpose ||
      !formData.reason
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    // NIC validation
    if (!isValidSriLankanNIC(formData.nationalId)) {
      toast.error(
        "Invalid NIC number. Use 9 digits + V/X or 12-digit new NIC format",
      );
      return;
    }

    // Reason length validation
    if (formData.reason.length < 10) {
      toast.error("Reason must be at least 10 characters long");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    if (!isStudyLeave && formData.leaveDate !== today) {
      toast.error(
        "Leave date must be today. Past or future dates are not allowed.",
        {
          duration: 4000,
        },
      );
      return;
    }

    if (isStudyLeave) {
      if (!formData.studyEndDate) {
        toast.error("Please select the final study leave date");
        return;
      }

      if (formData.studyEndDate < formData.leaveDate) {
        toast.error("End date cannot be before start date");
        return;
      }

      if (!proofDocument) {
        toast.error("Proof document is required for formal study leave");
        return;
      }
    }

    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append("leaveDate", formData.leaveDate);
      submitData.append(
        "studyEndDate",
        formData.studyEndDate || formData.leaveDate,
      );
      submitData.append(
        "leaveTime",
        isStudyLeave ? "Full Day" : formData.leaveTime,
      );
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
          ? "Study leave request submitted successfully"
          : "Leave request submitted successfully",
      );

      // Reset form
      setFormData({
        leaveDate: "",
        studyEndDate: "",
        leaveTime: isStudyLeave ? "Full Day" : "",
        nationalId: "",
        purpose: isStudyLeave ? "Study" : "Personal",
        reason: "",
      });

      setProofDocument(null);

      const fileInput = document.getElementById("proofDocument");
      if (fileInput) fileInput.value = "";

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error submitting leave request:", error);

      // Handle specific error cases
      if (error.message && error.message.includes("past")) {
        toast.error(
          "Leave date cannot be in the past. Please ensure your system date/time is correct and try again.",
          { duration: 5000 },
        );
      } else if (error.message && error.message.includes("already exists")) {
        toast.error(
          "You already have a leave request for this date. Only one request per day is allowed.",
          { duration: 4000 },
        );
      } else {
        toast.error(error.message || "Failed to submit leave request");
      }
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">
          {isStudyLeave
            ? "Formal Study Leave Request"
            : "Short Leave Permission Request"}
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          {isStudyLeave
            ? "Submit exam-period study leave with required proof document"
            : "Submit your request to exit SLT premises early"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date, NIC, Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiCalendar className="inline mr-2 text-blue-600" />
              {isStudyLeave ? "Study Leave Start Date *" : "Leave Date *"}
            </label>
            <input
              type="date"
              name="leaveDate"
              value={formData.leaveDate}
              onChange={handleChange}
              min={today}
              max={isStudyLeave ? undefined : today}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {isStudyLeave
                ? "Select the first exam or study leave date"
                : "Only today's date is allowed"}
            </p>
          </div>

          {isStudyLeave && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiCalendar className="inline mr-2 text-blue-600" />
                Study Leave End Date *
              </label>
              <input
                type="date"
                name="studyEndDate"
                value={formData.studyEndDate}
                onChange={handleChange}
                min={formData.leaveDate || today}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              National ID Number *
            </label>
            <input
              type="text"
              name="nationalId"
              value={formData.nationalId}
              onChange={handleChange}
              placeholder="123456789V or 200012345678"
              required
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                formData.nationalId && !isValidSriLankanNIC(formData.nationalId)
                  ? "border-red-500"
                  : "border-gray-300"
              }`}
            />
            {formData.nationalId &&
              !isValidSriLankanNIC(formData.nationalId) && (
                <p className="text-xs text-red-600 mt-1">
                  Enter a valid Sri Lankan NIC (9 digits + V/X or 12 digits)
                </p>
              )}
          </div>

          {!isStudyLeave && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiClock className="inline mr-2 text-blue-600" />
              Leave Time *
            </label>
            <input
              type="time"
              name="leaveTime"
              value={formData.leaveTime}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          )}
        </div>

        {/* Purpose */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Purpose *
          </label>
          <select
            name="purpose"
            value={formData.purpose}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {isStudyLeave ? (
              <option value="Study">Study</option>
            ) : (
              <>
                <option value="Personal">Personal</option>
                <option value="Official">Official</option>
              </>
            )}
          </select>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason *
          </label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            rows="4"
            minLength="10"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.reason.length} / 10 characters minimum
          </p>
        </div>

        {/* Proof Document */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FiUpload className="inline mr-2 text-blue-600" />
            Proof Document {isStudyLeave ? "*" : "(optional)"}
          </label>

          <input
            type="file"
            id="proofDocument"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            required={isStudyLeave}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
          {proofDocument && (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
              <FiFileText />
              {proofDocument.name}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-lg text-white font-semibold ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading
            ? "Submitting..."
            : isStudyLeave
              ? "Submit Study Leave Request"
              : "Submit Short Leave Request"}
        </button>
      </form>
    </div>
  );
};

export default LeaveRequestForm;
