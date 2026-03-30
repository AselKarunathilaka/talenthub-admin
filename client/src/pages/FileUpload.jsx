import React, { useState } from "react";
import axios from "axios";
import {
  X,
  FileUp,
  Loader2,
  Download,
  FileText,
  MailCheckIcon,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";
import { toast, Toaster } from "react-hot-toast";
import { api } from "../api/apiConfig";
import { motion } from "framer-motion";

const EmailUpload = () => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadTemplate, setDownloadTemplate] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (
      selectedFile &&
      (selectedFile.name.endsWith(".txt"))
    ) {
      setFile(selectedFile);
      setMessage("");
    } else {
      setMessage("Please select a valid Excel file (.txt)");
      setFile(null);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloadTemplate(true);
    try {
      const response = await api.get("/interns/email-template", {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "intern_emails_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

      toast.success("Template downloaded successfully!");
    } catch (error) {
      toast.error("Error downloading template");
      console.error("Download error:", error);
    } finally {
      setDownloadTemplate(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file first.");
      toast.error("Please select a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);

    try {
      const response = await api.post("/interns/update-emails", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        toast.success(response.data.message || "Emails updated successfully!");
        setFile(null);
        setMessage("");
      } else {
        setMessage(response.data.message || "Error updating emails.");
        toast.error(response.data.message || "Error updating emails.");
      }
    } catch (error) {
      const errorMsg =
        error.response?.data?.message || "Error updating emails.";
      setMessage(errorMsg);
      toast.error(errorMsg);
      console.error("Upload error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Navbar />

        <motion.div
          className="flex-1 py-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto">
            <motion.div
              className="bg-white p-6 rounded-xl shadow-md mb-6 border border-gray-100"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <div className="flex justify-between items-center mb-6 mt-20">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-2xl bg-blue-50">
                    <MailCheckIcon className="h-10 w-auto text-4xl text-[#00ade3]" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-800">
                      Email Upload
                    </h1>
                    <p className="text-gray-500">
                      Update intern emails in bulk using an Excel or CSV file.
                    </p>
                  </div>
                </div>
                {/* <motion.button
                  onClick={handleDownloadTemplate}
                  disabled={downloadTemplate}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-[#00ade3] text-white hover:bg-[#0095c7] transition"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </motion.button> */}
              </div>

              {/* Instructions box */}
              <motion.div
                className="bg-blue-50 border-l-4 border-[#00ade3] p-4 mb-6 rounded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex">
                  <svg
                    className="h-5 w-5 text-[#00ade3]"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Instructions
                    </h3>
                    <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-blue-700">
                      <li>File must contain Intern ID and Email columns</li>
                      <li>
                        Only .txt files are
                        accepted
                      </li>
                      <li>Maximum file size: 5MB</li>
                    </ul>
                  </div>
                </div>
              </motion.div>

              {/* File upload area */}
              <motion.div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const droppedFile = e.dataTransfer.files[0];
                  if (
                    droppedFile &&
                    (droppedFile.name.endsWith(".xlsx") ||
                      droppedFile.name.endsWith(".xls") ||
                      droppedFile.name.endsWith(".csv"))
                  ) {
                    setFile(droppedFile);
                    setMessage("");
                  } else {
                    setMessage(
                      "Please select a valid Excel file (.xlsx, .xls, .csv)"
                    );
                  }
                }}
                className={`mt-4 border-2 border-dashed rounded-lg p-12 text-center transition-all duration-200 ${
                  isDragging
                    ? "border-[#00ade3] bg-blue-50"
                    : "border-gray-300 hover:border-[#00ade3]"
                }`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex flex-col items-center justify-center space-y-4">
                  <FileUp className="h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-[#00ade3] hover:text-[#0095c7]"
                    >
                      <span>Upload a file</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="sr-only"
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">Text files up to 5MB</p>
                </div>
              </motion.div>

              {/* Display selected file */}
              {file && (
                <motion.div
                  className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm font-medium text-gray-700">
                      {file.name}
                    </span>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </motion.div>
              )}

              {/* Upload button */}
              <motion.div
                className="flex justify-center mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <motion.button
                  onClick={handleUpload}
                  disabled={loading || !file}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white ${
                    loading || !file
                      ? "bg-[#66d1ff] cursor-not-allowed"
                      : "bg-[#00ade3] hover:bg-[#0095c7]"
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      Processing...
                    </>
                  ) : (
                    "Update Emails"
                  )}
                </motion.button>
              </motion.div>

              {/* Message Display */}
              {message && (
                <motion.div
                  className={`p-4 rounded-lg mt-4 text-center text-sm ${
                    message.includes("Error") || message.includes("invalid")
                      ? "bg-red-50 border border-red-200 text-red-700"
                      : "bg-green-50 border border-green-200 text-green-700"
                  }`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <p>{message}</p>
                </motion.div>
              )}
            </motion.div>

            {/* Table */}
            <motion.div
              className="bg-white p-6 rounded-xl shadow-md border border-gray-100"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                Expected File Format
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Intern ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        INT001
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        intern1@example.com
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        INT002
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        intern2@example.com
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      <Toaster position="bottom-right" reverseOrder={false} />
    </div>
  );
};

export default EmailUpload;
