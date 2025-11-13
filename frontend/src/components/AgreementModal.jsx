import React, { useState } from "react";
import { FileText, CheckCircle, AlertCircle, Download } from "lucide-react";
import agreementPdf from "../assets/Trainee_Guidelines_Agreement[34454]_251111_135146.pdf";

const AgreementModal = ({ onAccept, internName }) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState('iframe'); // 'iframe' or 'native'

  // Detect iOS devices
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#00102F] to-[#001a4d] text-white px-4 sm:px-6 py-4 sm:py-5 rounded-t-xl sm:rounded-t-2xl">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <FileText className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-bold truncate">Trainee Guidelines & Agreement</h2>
              <p className="text-blue-200 text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">Welcome, {internName}! Please review and accept to continue.</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col p-3 sm:p-6">
          {/* PDF Viewer */}
          <div 
            className="flex-1 border-2 border-gray-200 rounded-lg overflow-auto mb-3 sm:mb-4 min-h-[200px] max-h-[45vh] sm:min-h-[300px] sm:max-h-[50vh] -webkit-overflow-scrolling-touch"
            onScroll={handleScroll}
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {isIOS || viewMode === 'native' ? (
              // For iOS and mobile - use direct link with download option
              <div className="flex flex-col items-center justify-center h-full p-4 bg-gradient-to-br from-blue-50 to-gray-50">
                <FileText className="h-16 w-16 text-blue-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2 text-center">Trainee Guidelines & Agreement</h3>
                <p className="text-sm text-gray-600 text-center mb-6 max-w-md">
                  Please download and read the complete agreement document before accepting.
                </p>
                <div className="space-y-3 w-full max-w-sm">
                  <a
                    href={agreementPdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-2 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md"
                  >
                    <FileText className="h-5 w-5" />
                    <span>Open PDF in New Tab</span>
                  </a>
                  <a
                    href={agreementPdf}
                    download="Trainee_Guidelines_Agreement.pdf"
                    className="flex items-center justify-center space-x-2 w-full px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                    onClick={() => {
                      // Enable acceptance after a short delay (assuming they downloaded)
                      setTimeout(() => setHasScrolledToBottom(true), 2000);
                    }}
                  >
                    <Download className="h-5 w-5" />
                    <span>Download PDF</span>
                  </a>
                </div>
                <p className="text-xs text-gray-500 mt-6 text-center max-w-md">
                  After reviewing the document, you can return here to accept the agreement.
                </p>
              </div>
            ) : (
              // For desktop - use iframe
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
            )}
          </div>

          {/* Scroll Indicator */}
          {!hasScrolledToBottom && !isIOS && viewMode === 'iframe' && (
            <div className="flex items-center justify-center space-x-2 text-amber-600 bg-amber-50 py-2 px-3 sm:px-4 rounded-lg mb-3 sm:mb-4 animate-pulse">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-center">Please scroll through the entire document to continue</span>
            </div>
          )}

          {/* Checkbox */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4 flex-shrink-0">
            <label className="flex items-start space-x-2 sm:space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={hasAccepted}
                onChange={(e) => setHasAccepted(e.target.checked)}
                disabled={!hasScrolledToBottom}
                className="mt-0.5 sm:mt-1 h-5 w-5 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm sm:text-base ${hasScrolledToBottom ? 'text-gray-900' : 'text-gray-400'}`}>
                  I have read and agree to the Trainee Guidelines and Agreement
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  By checking this box, you acknowledge that you have read, understood, and agree to comply with all terms and conditions outlined in the trainee guidelines.
                </p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 flex-shrink-0 pt-2">
            <a
              href={agreementPdf}
              download="Trainee_Guidelines_Agreement.pdf"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center justify-center sm:justify-start space-x-2 transition-colors py-2 sm:py-0"
            >
              <FileText className="h-4 w-4" />
              <span>Download PDF</span>
            </a>

            <button
              onClick={handleAccept}
              disabled={!hasAccepted || isLoading}
              className={`px-4 sm:px-6 py-3 rounded-lg font-semibold text-sm sm:text-base flex items-center justify-center space-x-2 transition-all
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
