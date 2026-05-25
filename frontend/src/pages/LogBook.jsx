import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiBook,
  FiAlertTriangle,
  FiTarget,
  FiInfo,
  FiCalendar,
  FiCheckCircle,
  FiAlertCircle,
  FiLoader,
  FiArrowRight,
  FiMonitor,
  FiServer,
  FiClipboard,
  FiLayers,
  FiCloud,
  FiWifi,
  FiSmartphone,
  FiUmbrella,
  FiClock,
} from "react-icons/fi";
import Navigation from "../components/Navigation";
import EntryFeedbackIndicator from "../components/EntryFeedbackIndicator";
import SuccessCheckmarkAnimation from "../components/SuccessCheckmarkAnimation";
import {
  evaluateLocalHeuristicsSync,
  formatValidationResult,
} from "../utils/entryHeuristics";
import { rateLimitedBatchValidate } from "../utils/batchValidation";

// Utility function to check if current time is after 10 AM (Sri Lankan time)
const checkLeaveTimeRestriction = () => {
  try {
    const now = new Date();
    const sriLankanOffset = 5.5 * 60;
    const localOffset = now.getTimezoneOffset();
    const sriLankanTime = new Date(
      now.getTime() + (localOffset + sriLankanOffset) * 60000,
    );
    const tenAM = new Date(sriLankanTime);
    tenAM.setHours(10, 0, 0, 0);
    const currentTime = sriLankanTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const isAfter10AM = sriLankanTime > tenAM;
    return {
      isAfter10AM,
      currentTime: currentTime + " (Sri Lankan Time)",
      message: isAfter10AM
        ? `Leave applications are not allowed after 10:00 AM. Current time: ${currentTime} (Sri Lankan Time)`
        : "Leave application is allowed",
    };
  } catch (error) {
    console.error("Error checking time restriction:", error);
    return {
      isAfter10AM: false,
      currentTime: new Date().toLocaleTimeString(),
      message: "Leave application is allowed",
    };
  }
};

const Logbook = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    stack: "",
    tasks: "",
    challenges: "",
    plans: "",
    status: "working",
  });

  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeRestriction, setTimeRestriction] = useState(
    checkLeaveTimeRestriction(),
  );
  const [validationResults, setValidationResults] = useState({
    tasks: null,
    challenges: null,
    plans: null,
  });
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // ── NEW: tracks whether the intern lacks a project assignment ──────────────
  // null  = check in progress (show spinner on button)
  // true  = blocked (no project assigned)
  // false = allowed
  const [projectAccessBlocked, setProjectAccessBlocked] = useState(null);

  const pendingSubmitRef = useRef(null);

  const HIGHLIGHT_MSG = "Please fix the highlighted fields above.";

  // ── Check project access on mount ─────────────────────────────────────────
  useEffect(() => {
    const checkAccess = async () => {
      const authToken = localStorage.getItem("authToken");
      if (!authToken) {
        setProjectAccessBlocked(false);
        return;
      }

      try {
        const { API_BASE_URL, API_ENDPOINTS } =
          await import("../api/apiConfig");
        const res = await fetch(
          `${API_BASE_URL}${API_ENDPOINTS.RECORDS.LIST}/check-project-access`,
          { headers: { Authorization: `Bearer ${authToken}` } },
        );

        if (!res.ok) {
          const data = await res.json();
          // Block the form and show the amber banner immediately
          setProjectAccessBlocked(true);
          setStatusMessage({
            type: "project_error",
            text: data.error,
          });
        } else {
          setProjectAccessBlocked(false);
        }
      } catch (err) {
        // Network error — don't block; the submit will catch it too
        console.error("Project access check failed:", err);
        setProjectAccessBlocked(false);
      }
    };

    checkAccess();
  }, []);

  const submitRecord = useCallback(async (authToken, recordPayload) => {
    try {
      const { API_BASE_URL, API_ENDPOINTS } = await import("../api/apiConfig");
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.RECORDS.LIST}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(recordPayload),
      });

      const data = await res.json();

      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: "Log submitted successfully!",
        });
        setValidationResults({ tasks: null, challenges: null, plans: null });
        setFormData({
          stack: "",
          tasks: "",
          challenges: "",
          plans: "",
          status: "working",
        });
      } else if (data.timeRestriction) {
        setStatusMessage({
          type: "error",
          text:
            data.error || "Leave applications are not allowed after 10:00 AM.",
        });
        setTimeRestriction(checkLeaveTimeRestriction());
      } else if (
        data.code === "NO_ACTIVE_PROJECT" ||
        data.code === "NO_TALENT_TRAIL_RECORD"
      ) {
        setProjectAccessBlocked(true);
        setStatusMessage({
          type: "project_error",
          text: data.error,
        });
      } else {
        setStatusMessage({
          type: "error",
          text: data.error || "Submission failed.",
        });
      }
    } catch (error) {
      console.error("Submit error:", error);
      setStatusMessage({
        type: "error",
        text: "Failed to submit log. Check your connection.",
      });
    } finally {
      setIsSubmitting(false);
      setShowSuccessAnimation(false);
      pendingSubmitRef.current = null;
    }
  }, []);

  const handleAnimationComplete = useCallback(() => {
    const pending = pendingSubmitRef.current;
    if (pending) {
      submitRecord(pending.authToken, pending.payload);
    } else {
      setIsSubmitting(false);
      setShowSuccessAnimation(false);
    }
  }, [submitRecord]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);
    setShowSuccessAnimation(false);

    const authToken = localStorage.getItem("authToken");

    if (!authToken) {
      setStatusMessage({
        type: "error",
        text: "Authentication required. Please log in again.",
      });
      setIsSubmitting(false);
      navigate("/");
      return;
    }

    const isOnLeave = formData.status === "leave";

    const payload = {
      date: new Date().toISOString().split("T")[0],
      stack: isOnLeave ? "On Leave" : formData.stack,
      task: isOnLeave ? "On Leave" : formData.tasks.trim(),
      progress: isOnLeave
        ? "On Leave"
        : formData.challenges.trim() || "No challenges faced",
      blockers: isOnLeave
        ? "On Leave"
        : formData.plans.trim() || "No specific plans",
      status: formData.status,
    };

    if (formData.status === "leave") {
      const currentTimeCheck = checkLeaveTimeRestriction();
      if (currentTimeCheck.isAfter10AM) {
        setStatusMessage({ type: "error", text: currentTimeCheck.message });
        setIsSubmitting(false);
        return;
      }
    }

    if (
      (formData.status === "working" || formData.status === "wfh") &&
      (!payload.stack || !payload.task)
    ) {
      setStatusMessage({
        type: "error",
        text: "Please select a task stack and fill in all required fields.",
      });
      setIsSubmitting(false);
      return;
    }

    if (formData.status !== "leave") {
      const fieldChecks = [
        { key: "tasks", value: formData.tasks },
        { key: "challenges", value: formData.challenges },
        { key: "plans", value: formData.plans },
      ];

      for (const { value } of fieldChecks) {
        if (!value || !value.trim()) continue;
        const localFail = evaluateLocalHeuristicsSync(value);
        if (localFail) {
          setStatusMessage({ type: "error", text: HIGHLIGHT_MSG });
          setIsSubmitting(false);
          return;
        }
      }

      try {
        const validationResponse = await rateLimitedBatchValidate({
          tasks: formData.tasks.trim(),
          challenges: formData.challenges.trim(),
          plans: formData.plans.trim(),
        });

        if (!validationResponse.ok) {
          setStatusMessage({
            type: "error",
            text: "Validation service unavailable. Please try again shortly.",
          });
          setIsSubmitting(false);
          return;
        }

        const results = await validationResponse.json();
        const trimmed = {
          tasks: formData.tasks.trim(),
          challenges: formData.challenges.trim(),
          plans: formData.plans.trim(),
        };

        const isFieldValid = (key) => {
          if (!trimmed[key]) return true;
          const field = results[key];
          return field?.valid !== false;
        };

        const allValid = ["tasks", "challenges", "plans"].every(isFieldValid);

        if (allValid) {
          setValidationResults({ tasks: null, challenges: null, plans: null });
          pendingSubmitRef.current = { authToken, payload };
          setShowSuccessAnimation(true);
          return;
        }

        setValidationResults({
          tasks: trimmed.tasks
            ? formatValidationResult(
                results.tasks?.valid !== false,
                results.tasks?.reason,
              )
            : null,
          challenges: trimmed.challenges
            ? formatValidationResult(
                results.challenges?.valid !== false,
                results.challenges?.reason,
              )
            : null,
          plans: trimmed.plans
            ? formatValidationResult(
                results.plans?.valid !== false,
                results.plans?.reason,
              )
            : null,
        });

        setStatusMessage({ type: "error", text: HIGHLIGHT_MSG });
        setIsSubmitting(false);
        return;
      } catch (validationError) {
        console.error("Batch validation error:", validationError);
        setStatusMessage({
          type: "error",
          text: "Validation failed. Check your connection and try again.",
        });
        setIsSubmitting(false);
        return;
      }
    }

    await submitRecord(authToken, payload);
  };

  useEffect(() => {
    let timer;
    if (statusMessage?.type === "success") {
      timer = setTimeout(() => {
        setStatusMessage(null);
        navigate("/DailyRecords");
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [statusMessage, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRestriction(checkLeaveTimeRestriction());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (formData.status === "leave" && timeRestriction.isAfter10AM) {
      setFormData((prev) => ({ ...prev, status: "working" }));
      setStatusMessage({
        type: "error",
        text: "Leave option is no longer available after 10:00 AM. Status changed to Working.",
      });
    }
  }, [timeRestriction.isAfter10AM, formData.status]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setStatusMessage(null);
    if (name === "tasks" || name === "challenges" || name === "plans") {
      setValidationResults((prev) => ({ ...prev, [name]: null }));
    }
  };

  // ── Derived: is the submit button disabled? ────────────────────────────────
  // Disabled while: access check is in progress (null), blocked by project
  // restriction (true), currently submitting, or the success animation is playing.
  const isSubmitDisabled =
    projectAccessBlocked !== false || isSubmitting || showSuccessAnimation;

  // All form fields are disabled when project access is blocked or still checking
  const areFieldsDisabled = !!projectAccessBlocked;

  // Label shown inside the button
  const submitButtonContent = () => {
    if (projectAccessBlocked === null) {
      return (
        <>
          <FiLoader className="animate-spin h-5 w-5 mr-2" />
          Checking access...
        </>
      );
    }
    if (projectAccessBlocked) {
      return (
        <>
          <FiAlertTriangle className="h-5 w-5 mr-2" />
          Project Assignment Required
        </>
      );
    }
    if (isSubmitting || showSuccessAnimation) {
      return (
        <>
          <FiLoader className="animate-spin h-5 w-5 mr-2" />
          Submitting...
        </>
      );
    }
    return (
      <>
        <FiCalendar className="h-5 w-5 mr-2" />
        Submit Logbook
      </>
    );
  };

  const stackOptions = [
    {
      value: "Front-end Development",
      label: "Front-end Development",
      icon: <FiMonitor className="mr-2" />,
    },
    {
      value: "Back-end Development",
      label: "Back-end Development",
      icon: <FiServer className="mr-2" />,
    },
    {
      value: "Full-stack Development",
      label: "Full-stack Development",
      icon: <FiServer className="mr-2" />,
    },
    {
      value: "Project Management",
      label: "Project Management",
      icon: <FiClipboard className="mr-2" />,
    },
    {
      value: "QA",
      label: "Quality Assurance",
      icon: <FiCheckCircle className="mr-2" />,
    },
    {
      value: "Documentation",
      label: "Documentation",
      icon: <FiBook className="mr-2" />,
    },
    {
      value: "UI-UX",
      label: "UI/UX Design",
      icon: <FiLayers className="mr-2" />,
    },
    {
      value: "Cloud",
      label: "Cloud Services",
      icon: <FiCloud className="mr-2" />,
    },
    {
      value: "IOT",
      label: "Internet of Things (IoT)",
      icon: <FiWifi className="mr-2" />,
    },
    {
      value: "Mobile",
      label: "Mobile Application Development",
      icon: <FiSmartphone className="mr-2" />,
    },
    {
      value: "AI/ML",
      label: "Artificial Intelligence and Machine Learning",
      icon: <FiMonitor className="mr-2" />,
    },
    {
      value: "DataScience",
      label: "Data Science",
      icon: <FiServer className="mr-2" />,
    },
  ];

  return (
    <>
      {showSuccessAnimation && (
        <SuccessCheckmarkAnimation onComplete={handleAnimationComplete} />
      )}
      <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50">
        <Navigation />

        <div className="flex-1 w-full lg:mt-20 lg:px-10">
          <main className="mx-auto px-4 py-6 md:py-8 lg:py-10 max-w-7xl">
            {/* Page Header */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                    <FiBook className="mr-3 text-blue-600" />
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Daily Logbook
                    </span>
                  </h1>
                  <p className="text-gray-500 mt-2 text-base">
                    Track your daily progress and achievements
                  </p>
                </div>
                <button
                  onClick={() => navigate("/DailyRecords")}
                  className="inline-flex items-center px-5 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 group"
                >
                  <FiBook className="mr-2 text-blue-600 group-hover:text-blue-700" />
                  View Records
                  <FiArrowRight className="ml-2 text-gray-400 group-hover:text-blue-600 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
              {/* Form Section */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg mr-3">
                        <FiBook className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-800">
                          Daily Activity Log
                        </h2>
                        <p className="text-blue-600 text-sm mt-1">
                          Complete your daily work summary
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Status Selection */}
                      <div className="space-y-4">
                        <label className="flex items-center text-sm font-medium text-gray-700">
                          <FiUmbrella className="mr-2 text-blue-500" />
                          Status <span className="text-red-500 ml-1">*</span>
                        </label>
                        <div className="flex flex-wrap gap-6">
                          <label
                            className={`flex items-center ${areFieldsDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <input
                              type="radio"
                              name="status"
                              value="working"
                              checked={formData.status === "working"}
                              onChange={handleChange}
                              disabled={areFieldsDisabled}
                              className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 ${areFieldsDisabled ? "cursor-not-allowed" : ""}`}
                            />
                            <span className="ml-2 text-gray-700">Working</span>
                          </label>
                          <label
                            className={`flex items-center ${areFieldsDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <input
                              type="radio"
                              name="status"
                              value="wfh"
                              checked={formData.status === "wfh"}
                              onChange={handleChange}
                              disabled={areFieldsDisabled}
                              className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 ${areFieldsDisabled ? "cursor-not-allowed" : ""}`}
                            />
                            <span className="ml-2 text-gray-700">
                              Work From Home
                            </span>
                          </label>
                          <label
                            className={`flex items-center ${areFieldsDisabled || timeRestriction.isAfter10AM ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <input
                              type="radio"
                              name="status"
                              value="leave"
                              checked={formData.status === "leave"}
                              onChange={handleChange}
                              disabled={
                                areFieldsDisabled || timeRestriction.isAfter10AM
                              }
                              className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 ${areFieldsDisabled || timeRestriction.isAfter10AM ? "cursor-not-allowed" : ""}`}
                            />
                            <span className="ml-2 text-gray-700 flex items-center">
                              On Leave
                              {timeRestriction.isAfter10AM && (
                                <FiClock
                                  className="ml-1 text-red-500"
                                  title="Not available after 10:00 AM"
                                />
                              )}
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Time restriction notification */}
                      {timeRestriction.isAfter10AM && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                          <div className="flex items-start">
                            <FiClock className="text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                            <div className="text-sm">
                              <p className="text-red-800 font-medium mb-1">
                                Leave Applications Closed
                              </p>
                              <p className="text-red-700">
                                Leave applications are not available after 10:00
                                AM. Current time: {timeRestriction.currentTime}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Conditional fields based on status */}
                      {formData.status === "working" ||
                      formData.status === "wfh" ? (
                        <>
                          {/* Task Stack */}
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-medium text-gray-700">
                              <FiMonitor className="mr-2 text-blue-500" />
                              Task Stack{" "}
                              <span className="text-red-500 ml-1">*</span>
                            </label>
                            <select
                              name="stack"
                              value={formData.stack}
                              onChange={handleChange}
                              required={formData.status === "working"}
                              disabled={areFieldsDisabled}
                              className={`w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 ${areFieldsDisabled ? "bg-gray-100 cursor-not-allowed opacity-60" : "bg-white"}`}
                            >
                              <option value="" disabled>
                                Select your stack...
                              </option>
                              {stackOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Tasks Completed */}
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-medium text-gray-700">
                              <FiCheckCircle className="mr-2 text-blue-500" />
                              Tasks Completed{" "}
                              <span className="text-red-500 ml-1">*</span>
                            </label>
                            <textarea
                              name="tasks"
                              value={formData.tasks}
                              onChange={handleChange}
                              required={formData.status === "working"}
                              disabled={areFieldsDisabled}
                              rows={4}
                              placeholder="What did you accomplish today? Be specific..."
                              className={`w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 ${areFieldsDisabled ? "bg-gray-100 cursor-not-allowed opacity-60" : ""}`}
                            />
                            <EntryFeedbackIndicator
                              text={formData.tasks}
                              forcedResult={validationResults.tasks}
                            />
                          </div>

                          {/* Challenges Faced */}
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-medium text-gray-700">
                              <FiAlertTriangle className="mr-2 text-blue-500" />
                              Challenges Faced
                            </label>
                            <textarea
                              name="challenges"
                              value={formData.challenges}
                              onChange={handleChange}
                              disabled={areFieldsDisabled}
                              rows={3}
                              placeholder="Any obstacles or difficulties you encountered..."
                              className={`w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 ${areFieldsDisabled ? "bg-gray-100 cursor-not-allowed opacity-60" : ""}`}
                            />
                            <EntryFeedbackIndicator
                              text={formData.challenges}
                              forcedResult={validationResults.challenges}
                            />
                          </div>

                          {/* Plans for Tomorrow */}
                          <div className="space-y-2">
                            <label className="flex items-center text-sm font-medium text-gray-700">
                              <FiTarget className="mr-2 text-blue-500" />
                              Plans for Tomorrow
                            </label>
                            <textarea
                              name="plans"
                              value={formData.plans}
                              onChange={handleChange}
                              disabled={areFieldsDisabled}
                              rows={3}
                              placeholder="What will you focus on tomorrow?"
                              className={`w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 ${areFieldsDisabled ? "bg-gray-100 cursor-not-allowed opacity-60" : ""}`}
                            />
                            <EntryFeedbackIndicator
                              text={formData.plans}
                              forcedResult={validationResults.plans}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                          <p className="text-blue-700 flex items-center">
                            <FiInfo className="mr-2" />
                            No further details needed for leave days.
                          </p>
                        </div>
                      )}

                      {/* ── Status / error messages ──────────────────────────────── */}
                      {statusMessage && (
                        <div
                          className={`flex items-start gap-3 p-4 rounded-xl border-l-4 ${
                            statusMessage.type === "success"
                              ? "bg-green-50 border-green-500 text-green-800"
                              : statusMessage.type === "project_error"
                                ? "bg-amber-50 border-amber-500 text-amber-900"
                                : "bg-red-50 border-red-500 text-red-800"
                          }`}
                        >
                          {statusMessage.type === "success" ? (
                            <FiCheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                          ) : statusMessage.type === "project_error" ? (
                            <FiAlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                          ) : (
                            <FiAlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                          )}

                          <div className="flex-1">
                            {statusMessage.type === "project_error" ? (
                              <>
                                <p className="font-semibold text-amber-900 mb-1">
                                  Team Assignment Required
                                </p>
                                <p className="text-sm text-amber-800 mb-3">
                                  {statusMessage.text}
                                </p>
                                <p className="text-sm text-amber-800 mb-2">
                                  To submit logbook entries, you must first join
                                  a project team on{" "}
                                  <a
                                    href="https://talenttrail.slt.lk"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold underline decoration-amber-600 hover:text-amber-900"
                                  >
                                    talenttrail.slt.lk
                                  </a>
                                  . Follow these steps:
                                </p>
                                <ol className="text-sm text-amber-800 space-y-1.5 list-decimal list-inside mb-3">
                                  <li>
                                    Go to{" "}
                                    <a
                                      href="https://talenttrail.slt.lk"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium underline hover:text-amber-900"
                                    >
                                      talenttrail.slt.lk
                                    </a>{" "}
                                    and log in with your credentials
                                  </li>
                                  <li>
                                    Browse the available projects and find the
                                    project that you are assigned to.
                                  </li>
                                  <li>
                                    Select the project and send a request to
                                    join the team
                                  </li>
                                  <li>
                                    Wait for the admin to approve your request
                                  </li>
                                  <li>
                                    Once approved, return here and try
                                    submitting your logbook again
                                  </li>
                                </ol>
                                <p className="text-xs text-amber-700 border-t border-amber-200 pt-2 mt-2">
                                  Already joined a team? Team data is synced
                                  every 5 minutes — please wait a moment and
                                  refresh, or contact your administrator if the
                                  issue persists.
                                </p>
                              </>
                            ) : (
                              <>
                                <span className="font-medium">
                                  {statusMessage.text}
                                </span>
                                {statusMessage.type === "success" && (
                                  <div className="text-green-700 text-xs mt-1">
                                    Redirecting to records...
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Submit Button */}
                      <div className="pt-4">
                        <button
                          type="submit"
                          disabled={isSubmitDisabled}
                          className={`w-full flex justify-center items-center px-6 py-3.5 rounded-xl text-base font-medium text-white transition-all duration-300 ${
                            isSubmitDisabled
                              ? projectAccessBlocked
                                ? "bg-amber-400 text-amber-700 cursor-not-allowed"
                                : "bg-gray-400 cursor-not-allowed"
                              : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-md hover:shadow-lg"
                          }`}
                        >
                          {submitButtonContent()}
                        </button>

                        {/* Hint text under button when blocked */}
                        {projectAccessBlocked && (
                          <p className="text-center text-xs text-amber-700 mt-2">
                            You must be assigned to a project on{" "}
                            <a
                              href="https://talenttrail.slt.lk"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium underline"
                            >
                              talenttrail.slt.lk
                            </a>{" "}
                            before submitting.
                          </p>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              {/* Info Sidebar */}
              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <FiInfo className="h-5 w-5 text-blue-600" />
                    </div>
                    Tips for Better Logging
                  </h3>
                  <ul className="space-y-3 text-sm text-gray-600">
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      Be specific about tasks completed
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      Include time spent on each major task
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      Document any challenges for future reference
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      Plan ahead for tomorrow's priorities
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      Mark "On Leave" when taking time off
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      Use "Work From Home" when working remotely
                    </li>
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2 flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <FiCalendar className="h-5 w-5 text-blue-600" />
                    </div>
                    Today's Summary
                  </h3>
                  <div className="space-y-2 text-blue-700">
                    <p className="flex items-center">
                      <span className="font-medium mr-2">Date:</span>
                      {new Date().toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p className="flex items-center">
                      <span className="font-medium mr-2">Week:</span>
                      Week {Math.ceil(new Date().getDate() / 7)} of{" "}
                      {new Date().toLocaleString("default", { month: "long" })}
                    </p>
                    <p className="flex items-center">
                      <span className="font-medium mr-2">Status:</span>
                      {formData.status === "working" ? (
                        <span className="text-green-600">Working</span>
                      ) : formData.status === "wfh" ? (
                        <span className="text-purple-600">Work From Home</span>
                      ) : (
                        <span className="text-blue-600">On Leave</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export default Logbook;
