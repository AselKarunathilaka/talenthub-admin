import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AgreementModal from "./AgreementModal";
import TalentHubRestrictedModal from "./TalentHubRestrictedModal";
import { API_BASE_URL, API_ENDPOINTS } from "../api/apiConfig";
import { handleUnauthorized } from "../utils/sessionUtils";
import { Clock, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

const AgreementGuard = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [showAgreement, setShowAgreement] = useState(false);
  const [internData, setInternData] = useState(null);
  const navigate = useNavigate();
  const internId = localStorage.getItem("internId");

  const checkAgreementStatus = useCallback(async () => {
    if (!internId) {
      navigate("/");
      return;
    }

    try {
      const response = await axios.get(
        `${API_BASE_URL}${API_ENDPOINTS.INTERNS.LIST}/page/${internId}`
      );

      const intern = response.data;
      setInternData(intern);

      if (!intern.agreementAccepted) {
        setShowAgreement(true);
      }
    } catch (error) {
      console.error("Error checking agreement status:", error);

      // ✅ Handle session expiry
      if (error.response?.status === 401) {
        const code = error.response?.data?.code || "";
        const msg = code === "TOKEN_EXPIRED"
          ? "Your session has expired. Please log in again."
          : "Your session is invalid. Please log in again.";
        handleUnauthorized(msg);
        return;
      }

      toast.error("Failed to load user data");
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [internId, navigate]);

  useEffect(() => {
    checkAgreementStatus();
  }, [checkAgreementStatus]);

  const handleAcceptAgreement = async () => {
    try {
      await axios.put(
        `${API_BASE_URL}${API_ENDPOINTS.INTERNS.LIST}/${internId}/accept-agreement`
      );
      toast.success("Agreement accepted successfully!");
      setShowAgreement(false);
    } catch (error) {
      console.error("Error accepting agreement:", error);

      // ✅ Handle session expiry
      if (error.response?.status === 401) {
        const code = error.response?.data?.code || "";
        const msg = code === "TOKEN_EXPIRED"
          ? "Your session has expired. Please log in again."
          : "Your session is invalid. Please log in again.";
        handleUnauthorized(msg);
        return;
      }

      toast.error("Failed to accept agreement. Please try again.");
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00102F] to-[#001a4d]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // 1. TalentHub Project Restriction check
  if (internData && internData.talentHubRestricted && !internData.talentHubOverride) {
    return (
      <TalentHubRestrictedModal
        internName={internData.Trainee_Name || internData.traineeName || "Intern"}
        reason={internData.talentHubRestrictionReason || "No project assigned"}
        onRecheck={checkAgreementStatus}
      />
    );
  }

  // 2. Agreement Acceptance check
  if (showAgreement) {
    return (
      <AgreementModal
        onAccept={handleAcceptAgreement}
        internName={internData?.Trainee_Name || internData?.traineeName || "User"}
      />
    );
  }

  return (
    <>
      {/* Temporary 5-day Admin Override Warning Banner */}
      {internData?.talentHubOverride && (
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-600 text-white px-4 py-2.5 text-xs sm:text-sm font-medium shadow-md flex items-center justify-center gap-2 relative z-40">
          <Clock className="w-4 h-4 flex-shrink-0 animate-pulse" />
          <span>
            <strong>Temporary Access (Admin Override):</strong> You have{" "}
            <span className="font-bold underline">
              {internData.daysRemaining !== null ? `${internData.daysRemaining} day${internData.daysRemaining === 1 ? "" : "s"}` : "5 days"}
            </span>{" "}
            to get enrolled in a project with your supervisor before TalentHub access is restricted.
          </span>
        </div>
      )}
      {children}
    </>
  );
};

export default AgreementGuard;