import React, { useState } from "react";
import { FileText, CheckCircle, AlertCircle } from "lucide-react";
import agreementPdf from "../assets/Trainee_Guidelines_Agreement[34454]_251111_135146.pdf";

const AgreementModal = ({ onAccept, internName }) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleScroll = (e) => {
    const element = e.target;
    const scrolledToBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
    if (scrolledToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = async () => {
    if (!hasAccepted) {
      return;
    }
    
    setIsLoading(true);
    try {
      await onAccept();
    } catch (error) {
      console.error("Error accepting agreement:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#00102F] to-[#001a4d] text-white px-6 py-5 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <FileText className="h-7 w-7" />
            <div>
              <h2 className="text-2xl font-bold">Trainee Guidelines & Agreement</h2>
              <p className="text-blue-200 text-sm mt-1">Welcome, {internName}! Please review and accept to continue.</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-6">
          {/* PDF Viewer */}
          <div 
            className="flex-1 border-2 border-gray-200 rounded-lg overflow-hidden mb-4"
            onScroll={handleScroll}
          >
            <iframe
              src={agreementPdf}
              className="w-full h-full"
              title="Trainee Guidelines Agreement"
              onLoad={(e) => {
                // Check if iframe content is scrollable
                const iframe = e.target;
                if (iframe.contentWindow) {
                  try {
                    const contentHeight = iframe.contentWindow.document.body.scrollHeight;
                    const iframeHeight = iframe.clientHeight;
                    if (contentHeight <= iframeHeight) {
                      setHasScrolledToBottom(true);
                    }
                  } catch (error) {
                    // Cross-origin restriction, enable after timeout
                    setTimeout(() => setHasScrolledToBottom(true), 3000);
                  }
                }
              }}
            />
          </div>

          {/* Scroll Indicator */}
          {!hasScrolledToBottom && (
            <div className="flex items-center justify-center space-x-2 text-amber-600 bg-amber-50 py-2 px-4 rounded-lg mb-4 animate-pulse">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Please scroll through the entire document to continue</span>
            </div>
          )}

          {/* Checkbox */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <label className="flex items-start space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={hasAccepted}
                onChange={(e) => setHasAccepted(e.target.checked)}
                disabled={!hasScrolledToBottom}
                className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <p className={`font-medium ${hasScrolledToBottom ? 'text-gray-900' : 'text-gray-400'}`}>
                  I have read and agree to the Trainee Guidelines and Agreement
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  By checking this box, you acknowledge that you have read, understood, and agree to comply with all terms and conditions outlined in the trainee guidelines.
                </p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <a
              href={agreementPdf}
              download="Trainee_Guidelines_Agreement.pdf"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center space-x-2 transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>Download PDF</span>
            </a>

            <button
              onClick={handleAccept}
              disabled={!hasAccepted || isLoading}
              className={`px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 transition-all
                ${hasAccepted && !isLoading
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  <span>Accept & Continue</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgreementModal;
