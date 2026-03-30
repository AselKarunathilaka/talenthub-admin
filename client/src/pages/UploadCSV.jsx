import React, { useState } from "react";
import { api } from "../api/apiConfig"; // API configuration
import { useNavigate } from "react-router-dom";
import { FileUp, X, Loader2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { toast } from "react-toastify";
import { Toaster } from "react-hot-toast";

const UploadCSV = () => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.name.endsWith(".xlsx")) {
      setFile(selectedFile);
      setMessage("");
    } else {
      setMessage("Please select a valid .xlsx file.");
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);

    try {
      const response = await api.post("/interns/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        toast.success("File uploaded successfully!");
        setFile(null); // Reset file input
      } else {
        setMessage("Error uploading the file.");
      }
    } catch (error) {
      setMessage("Error uploading file.");
      console.error("Error uploading:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      <Sidebar />
      <div className="flex flex-1">
        <Navbar />

        <div className="flex-1 py-8 px-6 sm:px-10 flex items-center justify-center">
          <div className="bg-[#001845] p-8 rounded-xl shadow-lg w-full max-w-md relative border border-gray-700">
            <button
              onClick={() => navigate(-1)}
              className="absolute top-4 right-4 text-gray-400 hover:text-[#4FB846] transition-colors duration-200"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-semibold text-white text-center mb-8">
              Upload Excel File
            </h2>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile && droppedFile.name.endsWith(".xlsx")) {
                  setFile(droppedFile);
                  setMessage("");
                }
              }}
              className={`border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? "border-[#4FB846] bg-[#001845]"
                  : "border-gray-600 hover:border-[#4FB846]"
              }`}
            >
              <FileUp className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-300 mb-2">Drag & Drop or Click to Upload</p>
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-block px-4 py-2 bg-[#001845] text-[#4FB846] rounded-lg cursor-pointer hover:text-white transition-colors duration-200"
              >
                Select File
              </label>
              {file && (
                <p className="mt-4 text-sm text-gray-400">Selected: {file.name}</p>
              )}
            </div>

            <button
              onClick={handleUpload}
              className={`w-full bg-[#4FB846] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#3da635] transition-colors duration-200 mt-4 ${
                loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="animate-spin h-5 w-5 text-white inline-block mr-2" />
              ) : null}
              Upload File
            </button>

            {message && (
              <div
                className={`mt-4 p-4 rounded-lg ${
                  message.includes("Error")
                    ? "bg-red-900/20 text-red-400"
                    : "bg-green-900/20 text-green-400"
                }`}
              >
                <p className="text-center text-sm">{message}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Toaster position="bottom-right" reverseOrder={false} />
    </div>
  );
};

export default UploadCSV;
