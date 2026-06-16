import React, { useState } from "react";
import { FileText, CheckCircle, AlertCircle, Download } from "lucide-react";
import agreementPdf from "../assets/Trainee_Guidelines_Agreement[34454]_251111_135146.pdf";

const AgreementModal = ({ onAccept, internName }) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState("iframe"); // 'iframe' or 'native'
  const [hasOpenedPdf, setHasOpenedPdf] = useState(false);

  // Detect iOS devices
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  const handleScroll = (e) => {
    const element = e.target;
    const scrolledToBottom =
      element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
    if (scrolledToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = async () => {
    if (!hasAccepted) return;
    setIsLoading(true);
    try {
      await onAccept();
    } catch (error) {
      console.error("Error accepting agreement:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // On iOS/mobile, checkbox should be enabled once user has tapped open/download
  const isCheckboxEnabled =
    isIOS || viewMode === "native" ? hasOpenedPdf : hasScrolledToBottom;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-4xl w-full h-[95vh] sm:h-auto sm:max-h-[90vh] flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#00102F] to-[#001a4d] text-white px-4 sm:px-6 py-4 sm:py-5 rounded-t-xl sm:rounded-t-2xl flex-shrink-0">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <FileText className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-bold truncate">
                Trainee Guidelines & Agreement
              </h2>
              <p className="text-blue-200 text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">
                Welcome, {internName}! Please review and accept to continue.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col p-3 sm:p-6 min-h-0">
          {/* PDF Viewer */}
          <div
            className="border-2 border-gray-200 rounded-lg overflow-auto mb-3 sm:mb-4 h-[35vh] sm:h-[40vh] flex-shrink-0"
            onScroll={handleScroll}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {isIOS || viewMode === "native" ? (
              <div className="flex flex-col items-center justify-center h-full p-4 bg-gradient-to-br from-blue-50 to-gray-50">
                <FileText className="h-16 w-16 text-blue-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2 text-center">
                  Trainee Guidelines & Agreement
                </h3>
                <p className="text-sm text-gray-600 text-center mb-6 max-w-md">
                  Please open and read the complete agreement document before
                  accepting.
                </p>
                <div className="space-y-3 w-full max-w-sm">
                  {/* Open in new tab */}
                  <a
                    href={agreementPdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setHasOpenedPdf(true)}
                    className="flex items-center justify-center space-x-2 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md"
                  >
                    <FileText className="h-5 w-5" />
                    <span>Open PDF in New Tab</span>
                  </a>
                  {/* Download */}
                  <a
                    href={agreementPdf}
                    download="Trainee_Guidelines_Agreement.pdf"
                    onClick={() => setHasOpenedPdf(true)}
                    className="flex items-center justify-center space-x-2 w-full px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                  >
                    <Download className="h-5 w-5" />
                    <span>Download PDF</span>
                  </a>
                </div>

                {/* Confirmation hint */}
                {hasOpenedPdf ? (
                  <p className="text-xs text-green-600 font-medium mt-4 text-center flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    Document opened — you can now check the box below.
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-6 text-center max-w-md">
                    Tap a button above to open the document, then return here to
                    accept.
                  </p>
                )}
              </div>
            ) : (
              <iframe
                src={agreementPdf}
                className="w-full h-full"
                title="Trainee Guidelines Agreement"
                onLoad={(e) => {
                  const iframe = e.target;
                  if (iframe.contentWindow) {
                    try {
                      const contentHeight =
                        iframe.contentWindow.document.body.scrollHeight;
                      const iframeHeight = iframe.clientHeight;
                      if (contentHeight <= iframeHeight) {
                        setHasScrolledToBottom(true);
                      }
                    } catch {
                      setTimeout(() => setHasScrolledToBottom(true), 3000);
                    }
                  }
                }}
              />
            )}
          </div>

          {/* Scroll Indicator — only for desktop iframe view */}
          {!hasScrolledToBottom && !isIOS && viewMode === "iframe" && (
            <div className="flex items-center justify-center space-x-2 text-amber-600 bg-amber-50 py-2 px-3 sm:px-4 rounded-lg mb-3 sm:mb-4 animate-pulse flex-shrink-0">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-center">
                Please scroll through the entire document to continue
              </span>
            </div>
          )}

          {/* iOS-specific hint when PDF not yet opened */}
          {(isIOS || viewMode === "native") && !hasOpenedPdf && (
            <div className="flex items-center justify-center space-x-2 text-amber-600 bg-amber-50 py-2 px-3 sm:px-4 rounded-lg mb-3 sm:mb-4 animate-pulse flex-shrink-0">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-center">
                Please open the PDF above before accepting
              </span>
            </div>
          )}

          {/* Checkbox */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4 flex-shrink-0">
            <label className="flex items-start space-x-2 sm:space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={hasAccepted}
                onChange={(e) => setHasAccepted(e.target.checked)}
                disabled={!isCheckboxEnabled}
                className="mt-0.5 sm:mt-1 h-5 w-5 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium text-sm sm:text-base ${isCheckboxEnabled ? "text-gray-900" : "text-gray-400"}`}
                >
                  I have read and agree to the Trainee Guidelines and Agreement
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  By checking this box, you acknowledge that you have read,
                  understood, and agree to comply with all terms and conditions
                  outlined in the trainee guidelines.
                </p>
              </div>
            </label>
          </div>

          {/* Accept Button */}
          <div className="flex justify-end flex-shrink-0 pt-2">
            <button
              onClick={handleAccept}
              disabled={!hasAccepted || isLoading}
              className={`px-4 sm:px-6 py-3 rounded-lg font-semibold text-sm sm:text-base flex items-center justify-center space-x-2 transition-all w-full sm:w-auto
                ${
                  hasAccepted && !isLoading
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
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
