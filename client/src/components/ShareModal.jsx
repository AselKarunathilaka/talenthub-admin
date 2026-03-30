import React, { useState, useRef } from 'react';
import QRCode from 'react-qr-code';
import { X, Copy, Share2, Info, Download } from 'lucide-react';

const ShareModal = ({
  showModal,
  closeModal,
  internData,
  selectedDate,
  selectedSpecialization,
  searchTeam,
  searchTerm
}) => {
  const [activeTab, setActiveTab] = useState('qr');
  const [copied, setCopied] = useState(false);
  const maxMessageLength = 1800; // Reduced for QR code safety
  const maxLinesPerChunk = 20; // Limit lines per chunk

  // Generate the intern message using the passed selectedDate and matching attendance records
  const generateInternMessage = () => {
    let message = `*SLT Report*\nDate: ${new Date(selectedDate).toLocaleDateString()}\n`;
    message += `Spec: ${selectedSpecialization || "All"} | Team: ${searchTeam || "All"}\n`;
    if (searchTerm) message += `Search: "${searchTerm}"\n\n`;
    message += `ID | Name | Attendance\n-----------------------\n`;

    const formattedSelectedDate = new Date(selectedDate).toLocaleDateString();

    // Compare attendance dates using toLocaleDateString for consistency
    internData.forEach((intern) => {
      const attendance = intern.attendance.find((entry) => {
        const entryDate = new Date(entry.date).toLocaleDateString();
        return entryDate === formattedSelectedDate;
      })?.status || 'N/A';

      if (attendance !== 'N/A') {
        message += `${intern.traineeId} | ${intern.traineeName} | ${attendance}\n`;
      }
    });

    return message;
  };

  // Split the message into chunks if needed
  const splitMessage = (message) => {
    const lines = message.split('\n');
    const chunks = [];
    let currentChunk = [];
    let charCount = 0;

    lines.forEach((line) => {
      if ((charCount + line.length) > maxMessageLength || currentChunk.length >= maxLinesPerChunk) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        charCount = 0;
      }
      currentChunk.push(line);
      charCount += line.length + 1; // +1 for newline
    });

    if (currentChunk.length > 0) chunks.push(currentChunk.join('\n'));
    return chunks;
  };

  const message = generateInternMessage();
  const chunks = splitMessage(message);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const downloadAsText = () => {
    const element = document.createElement("a");
    const file = new Blob([message], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "intern-report.txt";
    element.click();
  };

  if (!showModal) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 p-4"
      onClick={closeModal}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 bg-[#00102F]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Share2 size={22} />
            Share Attendance Report
          </h2>
          <button
            onClick={closeModal}
            className="text-white hover:bg-[#001c4d] p-1 rounded-full"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button 
            className={`flex-1 py-3 ${activeTab === 'qr' ? 'border-b-2 border-[#00102F] text-[#00102F]' : 'text-gray-500'}`}
            onClick={() => setActiveTab('qr')}
          >
            QR Share
          </button>
          <button 
            className={`flex-1 py-3 ${activeTab === 'text' ? 'border-b-2 border-[#00102F] text-[#00102F]' : 'text-gray-500'}`}
            onClick={() => setActiveTab('text')}
          >
            Text Report
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-grow">
          {activeTab === 'qr' ? (
            <>
              <div className="mb-6 bg-blue-50 p-4 rounded-lg flex items-start gap-3">
                <Info size={20} className="shrink-0 mt-1 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-800">
                    Scan {chunks.length > 1 && 'each'} QR code{chunks.length > 1 && 's'} to get full report. 
                    {chunks.length > 1 && ' Each part contains a portion of the data.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {chunks.map((chunk, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <div className="bg-white p-4 rounded-lg border-2 border-gray-100">
                      <QRCode
                        value={`https://wa.me/?text=${encodeURIComponent(chunk)}`}
                        size={256}
                        level="L"
                        fgColor="#00102F"
                        bgColor="#ffffff"
                      />
                    </div>
                    {chunks.length > 1 && (
                      <span className="mt-2 px-3 py-1 bg-gray-100 rounded-full text-sm">
                        Part {index + 1}/{chunks.length}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-8 text-center">
                <button
                  onClick={shareViaWhatsApp}
                  className="bg-[#25D366] hover:bg-[#1da851] text-white px-6 py-3 rounded-lg flex items-center gap-2 mx-auto"
                >
                  <Share2 size={18} />
                  Open WhatsApp Direct
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-medium text-gray-700">Report Preview</h3>
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className={`px-3 py-1.5 rounded flex items-center gap-1 text-sm ${
                      copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <Copy size={16} />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={downloadAsText}
                    className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 flex items-center gap-1 text-sm"
                  >
                    <Download size={16} />
                    Download
                  </button>
                </div>
              </div>
              
              <pre className="bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-x-auto text-sm font-mono">
                {message}
              </pre>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex justify-end">
          <button
            onClick={closeModal}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg border"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
