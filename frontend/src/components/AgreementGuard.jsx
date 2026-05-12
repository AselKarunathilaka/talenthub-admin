import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AgreementModal from "./AgreementModal";
import { API_BASE_URL, API_ENDPOINTS } from "../api/apiConfig";
import { handleUnauthorized } from "../utils/sessionUtils";
import toast from "react-hot-toast";

const AgreementGuard = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [showAgreement, setShowAgreement] = useState(false);
  const [internData, setInternData] = useState(null);
  const navigate = useNavigate();
  const internId = localStorage.getItem("internId");

  useEffect(() => {
    const checkAgreementStatus = async () => {
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
    };

    checkAgreementStatus();
  }, [internId, navigate]);

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

  if (showAgreement) {
    return (
      <AgreementModal
        onAccept={handleAcceptAgreement}
        internName={internData?.Trainee_Name || internData?.traineeName || "User"}
      />
    );
  }

  return <>{children}</>;
};

export default AgreementGuard;