import React, { useState } from 'react';
import { createLeaveRequest } from '../api/leaveRequestApi';
import toast from 'react-hot-toast';
import { FiFileText, FiCalendar, FiClock, FiUpload } from 'react-icons/fi';

const LeaveRequestForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    leaveDate: '',
    leaveTime: '',
    purpose: 'Personal',
    reason: '',
  });
  const [proofDocument, setProofDocument] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        e.target.value = '';
        return;
      }
      setProofDocument(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.leaveDate || !formData.leaveTime || !formData.purpose || !formData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.reason.length < 10) {
      toast.error('Reason must be at least 10 characters long');
      return;
    }

    if (!proofDocument) {
      toast.error('Please upload proof document for your leave request');
      return;
    }

    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('leaveDate', formData.leaveDate);
      submitData.append('leaveTime', formData.leaveTime);
      submitData.append('purpose', formData.purpose);
      submitData.append('reason', formData.reason);
      submitData.append('proofDocument', proofDocument);

      await createLeaveRequest(submitData);
      toast.success('Leave request submitted successfully');

      // Reset form
      setFormData({
        leaveDate: '',
        leaveTime: '',
        purpose: 'Personal',
        reason: '',
      });
      setProofDocument(null);
      
      // Reset file input
      const fileInput = document.getElementById('proofDocument');
      if (fileInput) fileInput.value = '';

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast.error(error.message || 'Failed to submit leave request');
    } finally {
      setLoading(false);
    }
  };

  // Get today's date for min date validation
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header with Logo */}
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Leave Permission Request
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Submit your request to exit SLT premises early
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date and Time Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="leaveDate" className="block text-sm font-medium text-gray-700 mb-2">
              <FiCalendar className="inline mr-2 text-blue-600" />
              Leave Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="leaveDate"
              name="leaveDate"
              value={formData.leaveDate}
              onChange={handleChange}
              min={today}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="leaveTime" className="block text-sm font-medium text-gray-700 mb-2">
              <FiClock className="inline mr-2 text-blue-600" />
              Leave Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              id="leaveTime"
              name="leaveTime"
              value={formData.leaveTime}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Purpose */}
        <div>
          <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-2">
            Purpose <span className="text-red-500">*</span>
          </label>
          <select
            id="purpose"
            name="purpose"
            value={formData.purpose}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
          >
            <option value="Personal">Personal</option>
            <option value="Official">Official</option>
          </select>
        </div>

        {/* Reason */}
        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            id="reason"
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            placeholder="Please provide detailed reason for your leave request (minimum 10 characters)"
            rows="4"
            required
            minLength="10"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.reason.length} / 10 characters minimum
          </p>
        </div>

        {/* Proof Document */}
        <div>
          <label htmlFor="proofDocument" className="block text-sm font-medium text-gray-700 mb-2">
            <FiUpload className="inline mr-2 text-blue-600" />
            Proof Document <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            id="proofDocument"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-500 mt-1">
            Accepted formats: PDF, DOC, DOCX, JPG, PNG (Max 5MB)
          </p>
          {proofDocument && (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
              <FiFileText />
              <span>{proofDocument.name}</span>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
            }`}
          >
            {loading ? 'Submitting...' : 'Submit Leave Request'}
          </button>
        </div>
      </form>

      {/* Note */}
      <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-600 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong className="text-blue-800">Note:</strong> Your request will be sent to the admin for approval. 
          You will receive an email notification once your request is processed.
        </p>
      </div>
    </div>
  );
};

export default LeaveRequestForm;
