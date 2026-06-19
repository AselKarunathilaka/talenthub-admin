import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
  FiArrowLeft,
  FiMonitor,
  FiServer,
  FiClipboard,
  FiLayers,
  FiCloud,
  FiWifi,
  FiSmartphone,
  FiUmbrella,
  FiClock,
  FiCheck,
  FiSend,
  FiLock,
} from "react-icons/fi";
import Navigation from "../components/Navigation";
import SectionTip from "../components/SectionTip";
import EntryFeedbackIndicator from "../components/EntryFeedbackIndicator";
import SuccessCheckmarkAnimation from "../components/SuccessCheckmarkAnimation";
import {
  evaluateLocalHeuristicsSync,
  formatValidationResult,
} from "../utils/entryHeuristics";
import { rateLimitedBatchValidate } from "../utils/batchValidation";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Utility – check if current time is after 10 AM (Sri Lankan time)         */
/* ────────────────────────────────────────────────────────────────────────── */
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

/* ────────────────────────────────────────────────────────────────────────── */
/*  Color palettes keyed by status                                           */
/* ────────────────────────────────────────────────────────────────────────── */
const STATUS_PALETTES = {
  working: {
    primary: "#0056a2",
    light: "#00b4eb",
    bg: "rgba(0, 86, 162, 0.06)",
    border: "rgba(0, 180, 235, 0.35)",
    glow: "0 0 20px rgba(0, 180, 235, 0.15)",
    gradient: "linear-gradient(135deg, #0056a2, #00b4eb)",
    barBg: "#00b4eb",
    text: "#0056a2",
    softBg: "#e8f4fd",
    label: "Working",
  },
  wfh: {
    primary: "#2d8a3e",
    light: "#50b748",
    bg: "rgba(80, 183, 72, 0.06)",
    border: "rgba(80, 183, 72, 0.35)",
    glow: "0 0 20px rgba(80, 183, 72, 0.15)",
    gradient: "linear-gradient(135deg, #2d8a3e, #50b748)",
    barBg: "#50b748",
    text: "#2d8a3e",
    softBg: "#edf7ec",
    label: "Work From Home",
  },
  leave: {
    primary: "#c0392b",
    light: "#e74c3c",
    bg: "rgba(231, 76, 60, 0.06)",
    border: "rgba(231, 76, 60, 0.35)",
    glow: "0 0 20px rgba(231, 76, 60, 0.15)",
    gradient: "linear-gradient(135deg, #c0392b, #e74c3c)",
    barBg: "#e74c3c",
    text: "#c0392b",
    softBg: "#fdecea",
    label: "On Leave",
  },
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  Motivational quotes                                                      */
/* ────────────────────────────────────────────────────────────────────────── */
const MOTIVATIONAL_QUOTES = [
  "Small daily improvements lead to staggering results.",
  "Your logbook tells the story of your growth.",
  "Every task logged is a step towards mastery.",
  "Consistency beats intensity. Keep logging!",
  "Great developers document their journey.",
  "Today's challenges are tomorrow's expertise.",
  "Your future self will thank you for this entry.",
  "Progress, not perfection. Log what matters.",
];

/* ────────────────────────────────────────────────────────────────────────── */
/*  Stepper Steps                                                            */
/* ────────────────────────────────────────────────────────────────────────── */
const STEPS = [
  { id: 0, label: "Status", icon: FiUmbrella },
  { id: 1, label: "Stack", icon: FiMonitor },
  { id: 2, label: "Details", icon: FiBook },
];

/* ────────────────────────────────────────────────────────────────────────── */
/*  ★ LogbookRestricted — shown when the intern's logbook is locked          */
/* ────────────────────────────────────────────────────────────────────────── */
const LogbookRestricted = ({ reason, restrictedAt }) => {
  const fmtDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div
      style={{
        background: "white",
        borderRadius: 20,
        overflow: "hidden",
        border: "2px solid #fecaca",
        boxShadow: "0 4px 24px rgba(239,68,68,0.08)",
        maxWidth: 640,
        margin: "0 auto",
      }}
    >
      {/* Red header */}
      <div
        style={{
          background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
          padding: "24px",
          borderBottom: "1px solid #fecaca",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "linear-gradient(135deg, #ef4444, #c0392b)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 4px 14px rgba(239,68,68,0.3)",
          }}
        >
          <FiLock size={26} color="white" />
        </div>
        <div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "#7f1d1d",
              margin: 0,
            }}
          >
            Logbook Access Restricted
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#991b1b",
              marginTop: 5,
              marginBottom: 0,
            }}
          >
            Your logbook has been locked due to missing weekly submissions.
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 24 }}>
        {/* Restriction detail box */}
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 20,
          }}
        >
          {restrictedAt && (
            <p
              style={{
                fontSize: 12,
                color: "#ef4444",
                fontWeight: 600,
                margin: "0 0 6px",
              }}
            >
              🔒 Restricted on {fmtDate(restrictedAt)}
            </p>
          )}
          {reason && (
            <p
              style={{
                fontSize: 13,
                color: "#991b1b",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              {reason}
            </p>
          )}
        </div>

        <p
          style={{
            fontSize: 14,
            color: "#7f1d1d",
            lineHeight: 1.7,
            marginBottom: 20,
          }}
        >
          Your logbook access has been automatically restricted because no
          logbook entries were submitted for an entire 5-working-day period. To
          regain access, please follow the steps below:
        </p>

        {/* Steps */}
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {[
            {
              step: "1",
              text: "Contact your supervisor and explain the reason for missing submissions.",
            },
            {
              step: "2",
              text: "If your reason is valid, the supervisor will notify the administrator to lift the restriction.",
            },
            {
              step: "3",
              text: "Once the administrator approves and lifts your restriction, you will be able to submit logbook entries again.",
            },
            {
              step: "4",
              text: "Ensure you submit your logbook every working day going forward to avoid future restrictions.",
            },
          ].map((item) => (
            <li
              key={item.step}
              style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #ef4444, #c0392b)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {item.step}
              </span>
              <span
                style={{
                  fontSize: 14,
                  color: "#7f1d1d",
                  lineHeight: 1.5,
                  paddingTop: 3,
                }}
              >
                {item.text}
              </span>
            </li>
          ))}
        </ol>

        <div style={{ borderTop: "1px solid #fecaca", paddingTop: 16 }}>
          <p
            style={{
              fontSize: 12,
              color: "#991b1b",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            If you believe this restriction was applied in error, please contact
            your administrator immediately. Access is restored by the admin
            after a supervisor-approved meeting.
          </p>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main Component                                                           */
/* ────────────────────────────────────────────────────────────────────────── */
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
  const [projectAccessBlocked, setProjectAccessBlocked] = useState(null);
  const [extendedLeaveBlocked, setExtendedLeaveBlocked] = useState(null);
  const [activeStep, setActiveStep] = useState(0);

  /* ── ★ New: logbook restriction state ── */
  const [logbookRestriction, setLogbookRestriction] = useState({
    checking: true,
    restricted: false,
    reason: null,
    restrictedAt: null,
  });

  const pendingSubmitRef = useRef(null);

  const HIGHLIGHT_MSG = "Please fix the highlighted fields above.";

  // Random motivational quote
  const [quote] = useState(
    () =>
      MOTIVATIONAL_QUOTES[
        Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)
      ],
  );

  // Current palette
  const palette = STATUS_PALETTES[formData.status] || STATUS_PALETTES.working;

  /* ── Progress bar calculation ─────────────────────────────────────────── */
  const completionProgress = useMemo(() => {
    if (formData.status === "leave") return 100;

    let filled = 0;
    // 1) Status selected (always true since default is "working")
    if (formData.status) filled++;
    // 2) Stack selected
    if (formData.stack) filled++;
    // 3) Tasks filled
    if (formData.tasks.trim()) filled++;
    // 4) Challenges filled
    if (formData.challenges.trim()) filled++;
    // 5) Plans filled
    if (formData.plans.trim()) filled++;

    return filled * 20;
  }, [formData]);

  /* ── ★ Check logbook restriction on mount ── */
  useEffect(() => {
    const checkRestriction = async () => {
      const authToken = localStorage.getItem("authToken");
      if (!authToken) {
        setLogbookRestriction({
          checking: false,
          restricted: false,
          reason: null,
          restrictedAt: null,
        });
        return;
      }
      try {
        const { API_BASE_URL, API_ENDPOINTS } =
          await import("../api/apiConfig");
        const res = await fetch(
          `${API_BASE_URL}${API_ENDPOINTS.RECORDS.LIST}/status`,
          { headers: { Authorization: `Bearer ${authToken}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setLogbookRestriction({
            checking: false,
            restricted: !!data.logbookRestricted,
            reason: data.logbookRestrictionReason || null,
            restrictedAt: data.logbookRestrictedAt || null,
          });
        } else {
          // If the status endpoint doesn't exist yet, fail open
          setLogbookRestriction({
            checking: false,
            restricted: false,
            reason: null,
            restrictedAt: null,
          });
        }
      } catch {
        setLogbookRestriction({
          checking: false,
          restricted: false,
          reason: null,
          restrictedAt: null,
        });
      }
    };
    checkRestriction();
  }, []);

  /* ── Check project access on mount ────────────────────────────────────── */
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
          setProjectAccessBlocked(true);
          setStatusMessage({
            type: "project_error",
            text: data.error,
          });
        } else {
          setProjectAccessBlocked(false);
        }
      } catch (err) {
        console.error("Project access check failed:", err);
        setProjectAccessBlocked(false);
      }
    };

    checkAccess();
  }, []);

  /* ── Check for extended leave on mount ────────────────────────────────── */
  useEffect(() => {
    const checkExtendedLeave = async () => {
      const authToken = localStorage.getItem("authToken");
      if (!authToken) {
        setExtendedLeaveBlocked(false);
        return;
      }

      try {
        const { API_BASE_URL, API_ENDPOINTS } =
          await import("../api/apiConfig");
        const res = await fetch(
          `${API_BASE_URL}${API_ENDPOINTS.RECORDS.LIST}`,
          { headers: { Authorization: `Bearer ${authToken}` } },
        );

        if (res.ok) {
          const records = await res.json();
          const today = new Date();
          const sriLankanOffset = 5.5 * 60;
          const localOffset = today.getTimezoneOffset();
          const sriLankanTime = new Date(
            today.getTime() + (localOffset + sriLankanOffset) * 60000,
          );
          const dateStr = sriLankanTime.toISOString().split("T")[0];

          const todayRecord = records.find(
            (r) => r.status === "study_leave" && r.date === dateStr,
          );

          if (todayRecord) {
            setExtendedLeaveBlocked(true);
          } else {
            setExtendedLeaveBlocked(false);
          }
        } else {
          setExtendedLeaveBlocked(false);
        }
      } catch (err) {
        console.error("Extended leave check failed:", err);
        setExtendedLeaveBlocked(false);
      }
    };

    checkExtendedLeave();
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
        setActiveStep(0);
      } else if (data.code === "LOGBOOK_RESTRICTED") {
        /* ── ★ Handle restriction returned from server mid-session ── */
        setLogbookRestriction({
          checking: false,
          restricted: true,
          reason: data.reason || data.error,
          restrictedAt: data.restrictedAt || null,
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
          text: data.error || data.message,
        });
      } else {
        setStatusMessage({
          type: "error",
          text: data.error || data.message || "Submission failed.",
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

    // ── Mandatory field check for all three fields ──
    if (formData.status !== "leave") {
      if (
        !formData.tasks.trim() ||
        !formData.challenges.trim() ||
        !formData.plans.trim()
      ) {
        setStatusMessage({
          type: "error",
          text: "All three fields (Tasks, Challenges, Plans) are required.",
        });
        setIsSubmitting(false);
        // Jump to the fields step so users can see what's missing
        setActiveStep(2);
        return;
      }
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
          let errorText =
            "Validation service unavailable. Please try again shortly.";
          try {
            const errBody = await validationResponse.json();
            if (errBody.error) errorText = errBody.error;
            else if (errBody.message) errorText = errBody.message;
          } catch {
            /* use default */
          }
          console.error(
            `[LogBook] Validation endpoint returned ${validationResponse.status}: ${errorText}`,
          );
          setStatusMessage({
            type: "error",
            text: errorText,
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

  /* ── Stepper navigation ───────────────────────────────────────────────── */
  const isOnLeave = formData.status === "leave";

  // Determine which steps are reachable
  const canGoToStep = (stepId) => {
    if (stepId === 0) return true;
    if (stepId === 1) return !!formData.status;
    if (stepId === 2) return isOnLeave || !!formData.stack;
    return false;
  };

  const goNext = () => {
    if (isOnLeave && activeStep === 0) {
      // Skip stack entirely, go straight to submit (leave mode)
      setActiveStep(2);
      return;
    }
    if (activeStep < 2) setActiveStep((s) => s + 1);
  };

  const goPrev = () => {
    if (isOnLeave && activeStep === 2) {
      setActiveStep(0);
      return;
    }
    if (activeStep > 0) setActiveStep((s) => s - 1);
  };

  /* ── Derived states ───────────────────────────────────────────────────── */
  const isSubmitDisabled =
    projectAccessBlocked !== false ||
    extendedLeaveBlocked !== false ||
    isSubmitting ||
    showSuccessAnimation;

  const areFieldsDisabled = !!projectAccessBlocked || !!extendedLeaveBlocked;

  const submitButtonContent = () => {
    if (projectAccessBlocked === null || extendedLeaveBlocked === null) {
      return (
        <>
          <FiLoader
            className="logbook-spin"
            style={{ width: 20, height: 20, marginRight: 8 }}
          />
          Checking access...
        </>
      );
    }
    if (projectAccessBlocked) {
      return (
        <>
          <FiAlertTriangle style={{ width: 20, height: 20, marginRight: 8 }} />
          Project Assignment Required
        </>
      );
    }
    if (isSubmitting || showSuccessAnimation) {
      return (
        <>
          <FiLoader
            className="logbook-spin"
            style={{ width: 20, height: 20, marginRight: 8 }}
          />
          Submitting...
        </>
      );
    }
    return (
      <>
        <FiSend style={{ width: 20, height: 20, marginRight: 8 }} />
        Submit Logbook
      </>
    );
  };

  const stackOptions = [
    {
      value: "Front-end Development",
      label: "Front-end Development",
      icon: <FiMonitor />,
    },
    {
      value: "Back-end Development",
      label: "Back-end Development",
      icon: <FiServer />,
    },
    {
      value: "Full-stack Development",
      label: "Full-stack Development",
      icon: <FiServer />,
    },
    {
      value: "Project Management",
      label: "Project Management",
      icon: <FiClipboard />,
    },
    { value: "QA", label: "Quality Assurance", icon: <FiCheckCircle /> },
    { value: "Documentation", label: "Documentation", icon: <FiBook /> },
    { value: "UI-UX", label: "UI/UX Design", icon: <FiLayers /> },
    { value: "Cloud", label: "Cloud Services", icon: <FiCloud /> },
    { value: "IOT", label: "Internet of Things (IoT)", icon: <FiWifi /> },
    {
      value: "Mobile",
      label: "Mobile Application Development",
      icon: <FiSmartphone />,
    },
    {
      value: "AI/ML",
      label: "Artificial Intelligence and Machine Learning",
      icon: <FiMonitor />,
    },
    { value: "DataScience", label: "Data Science", icon: <FiServer /> },
  ];

  /* ──────────────────────────────────────────────────────────────────────── */
  /*  STATUS OPTIONS (styled cards)                                          */
  /* ──────────────────────────────────────────────────────────────────────── */
  const statusOptions = [
    {
      value: "working",
      label: "Working",
      description: "I'm at the office today",
      icon: FiMonitor,
      palette: STATUS_PALETTES.working,
    },
    {
      value: "wfh",
      label: "Work From Home",
      description: "Working remotely today",
      icon: FiCloud,
      palette: STATUS_PALETTES.wfh,
    },
    {
      value: "leave",
      label: "On Leave",
      description: "Taking time off today",
      icon: FiUmbrella,
      palette: STATUS_PALETTES.leave,
      disabled: timeRestriction.isAfter10AM,
    },
  ];

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                                 */
  /* ════════════════════════════════════════════════════════════════════════ */
  return (
    <>
      {showSuccessAnimation && (
        <SuccessCheckmarkAnimation onComplete={handleAnimationComplete} />
      )}

      <div
        className="flex flex-col lg:flex-row min-h-screen bg-slate-50 font-sans"
        style={{ background: "#f0f4f8" }}
      >
        <Navigation />

        <div className="flex-1 w-full lg:mt-20 lg:px-6 xl:px-10 pb-10">
          <main className="flex-1 p-4 sm:p-6 mx-auto max-w-[1600px] w-full">
            <SectionTip sectionKey="logbook" />

            {/* ───── Page Header ───── */}
            <div style={{ marginBottom: 32 }} className="logbook-fade-in">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                  <h1
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: "#1a1a2e",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        color: "#1a1a2e",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                        transition: "all 0.4s ease",
                      }}
                    >
                      <FiBook style={{ color: palette.light }} />
                      Daily Logbook
                    </span>
                  </h1>
                  <p
                    style={{
                      color: "#6b7280",
                      marginTop: 6,
                      fontSize: 15,
                      fontStyle: "italic",
                    }}
                  >
                    "{quote}"
                  </p>
                </div>
                <button
                  onClick={() => navigate("/DailyRecords")}
                  className="logbook-view-records-btn"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "10px 20px",
                    background: "white",
                    border: `1.5px solid ${palette.border}`,
                    borderRadius: 14,
                    fontSize: 14,
                    fontWeight: 600,
                    color: palette.primary,
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  <FiBook style={{ marginRight: 8, color: palette.light }} />
                  View Records
                  <FiArrowRight style={{ marginLeft: 8, opacity: 0.5 }} />
                </button>
              </div>
            </div>

            {/* ───── ★ Step 1: Restriction check loading ───── */}
            {logbookRestriction.checking && (
              <div
                className="logbook-fade-in"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "60px 24px",
                  background: "white",
                  borderRadius: 20,
                  border: "1px solid #f0f0f0",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                }}
              >
                <FiLoader
                  className="logbook-spin"
                  size={28}
                  style={{ color: "#ef4444", marginBottom: 16 }}
                />
                <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>
                  Checking logbook access…
                </p>
                <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
                  Verifying your submission status
                </p>
              </div>
            )}

            {/* ───── ★ Step 2: Logbook Restricted UI ───── */}
            {!logbookRestriction.checking && logbookRestriction.restricted && (
              <div className="logbook-fade-in">
                <LogbookRestricted
                  reason={logbookRestriction.reason}
                  restrictedAt={logbookRestriction.restrictedAt}
                />
              </div>
            )}

            {/* ───── Step 3: Normal form flow (only when not restricted) ───── */}
            {!logbookRestriction.checking && !logbookRestriction.restricted && (
              <>
                {/* ───── Project Access Blocked — Standalone Instruction Card ───── */}
                {projectAccessBlocked === true && (
                  <div
                    className="logbook-card logbook-fade-in"
                    style={{
                      background: "white",
                      borderRadius: 20,
                      overflow: "hidden",
                      border: "2px solid #fde68a",
                      boxShadow: "0 4px 24px rgba(245, 158, 11, 0.08)",
                      maxWidth: 640,
                      margin: "0 auto",
                    }}
                  >
                    {/* Amber header bar */}
                    <div
                      style={{
                        background:
                          "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                        padding: "20px 24px",
                        borderBottom: "1px solid #fde68a",
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          background:
                            "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <FiAlertTriangle size={24} color="white" />
                      </div>
                      <div>
                        <h2
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: "#92400e",
                            margin: 0,
                          }}
                        >
                          Team Assignment Required
                        </h2>
                        <p
                          style={{
                            fontSize: 13,
                            color: "#a16207",
                            marginTop: 4,
                          }}
                        >
                          You need to join a project before using the logbook
                        </p>
                      </div>
                    </div>

                    {/* Body content */}
                    <div style={{ padding: "24px" }}>
                      {statusMessage?.type === "project_error" && (
                        <div
                          style={{
                            background: "#fffbeb",
                            border: "1px solid #fde68a",
                            borderRadius: 12,
                            padding: "12px 16px",
                            marginBottom: 20,
                          }}
                        >
                          <p
                            style={{
                              fontSize: 13,
                              color: "#92400e",
                              fontWeight: 500,
                              margin: 0,
                            }}
                          >
                            {statusMessage.text}
                          </p>
                        </div>
                      )}

                      <p
                        style={{
                          fontSize: 14,
                          color: "#a16207",
                          marginBottom: 16,
                          lineHeight: 1.6,
                        }}
                      >
                        To submit logbook entries, you must first join a project
                        team on{" "}
                        <a
                          href="https://talenttrail.slt.lk"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontWeight: 600,
                            textDecoration: "underline",
                            color: "#92400e",
                          }}
                        >
                          TalentTrail
                        </a>
                        . Follow these steps:
                      </p>

                      <ol
                        style={{
                          listStyleType: "none",
                          padding: 0,
                          margin: "0 0 20px 0",
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                        }}
                      >
                        {[
                          {
                            step: "1",
                            text: (
                              <>
                                Go to{" "}
                                <a
                                  href="https://talenttrail.slt.lk"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontWeight: 500,
                                    textDecoration: "underline",
                                    color: "#92400e",
                                  }}
                                >
                                  TalentTrail
                                </a>{" "}
                                and log in with your credentials
                              </>
                            ),
                          },
                          {
                            step: "2",
                            text: "Browse the available projects and find the project that you are assigned to.",
                          },
                          {
                            step: "3",
                            text: "Select the project and send a request to join the team",
                          },
                          {
                            step: "4",
                            text: "Wait for the admin to approve your request",
                          },
                          {
                            step: "5",
                            text: "Once approved, return here and try submitting your logbook again",
                          },
                        ].map((item) => (
                          <li
                            key={item.step}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 12,
                            }}
                          >
                            <span
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background:
                                  "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                                color: "white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 13,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {item.step}
                            </span>
                            <span
                              style={{
                                fontSize: 14,
                                color: "#78350f",
                                lineHeight: 1.5,
                                paddingTop: 3,
                              }}
                            >
                              {item.text}
                            </span>
                          </li>
                        ))}
                      </ol>

                      <div
                        style={{
                          borderTop: "1px solid #fde68a",
                          paddingTop: 16,
                          marginTop: 8,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 12,
                            color: "#b45309",
                            margin: 0,
                            lineHeight: 1.5,
                          }}
                        >
                          Already joined a team? Team data is synced every 5
                          minutes — please wait a moment and refresh, or contact
                          your administrator if the issue persists.
                        </p>
                      </div>

                      {/* Action button */}
                      <a
                        href="https://talenttrail.slt.lk"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          width: "100%",
                          padding: "12px 24px",
                          marginTop: 20,
                          borderRadius: 12,
                          background:
                            "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                          color: "white",
                          fontWeight: 600,
                          fontSize: 15,
                          textDecoration: "none",
                          transition: "all 0.3s ease",
                          boxShadow: "0 4px 14px rgba(245, 158, 11, 0.25)",
                        }}
                      >
                        Go to TalentTrail
                        <FiArrowRight size={16} />
                      </a>
                    </div>
                  </div>
                )}

                {/* ───── Extended Leave Blocked — Standalone Instruction Card ───── */}
                {extendedLeaveBlocked === true && (
                  <div
                    className="logbook-card logbook-fade-in"
                    style={{
                      background: "white",
                      borderRadius: 20,
                      overflow: "hidden",
                      border: "2px solid #bae6fd",
                      boxShadow: "0 4px 24px rgba(14, 165, 233, 0.08)",
                      maxWidth: 640,
                      margin: "0 auto",
                      marginBottom: 32,
                    }}
                  >
                    <div
                      style={{
                        background:
                          "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
                        padding: "20px 24px",
                        borderBottom: "1px solid #bae6fd",
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          background:
                            "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <FiUmbrella size={24} color="white" />
                      </div>
                      <div>
                        <h2
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: "#075985",
                            margin: 0,
                          }}
                        >
                          Extended Leave Active
                        </h2>
                        <p
                          style={{
                            fontSize: 13,
                            color: "#0c4a6e",
                            marginTop: 4,
                          }}
                        >
                          No daily update required for today
                        </p>
                      </div>
                    </div>

                    <div style={{ padding: "24px" }}>
                      <p
                        style={{
                          fontSize: 14,
                          color: "#0c4a6e",
                          marginBottom: 16,
                          lineHeight: 1.6,
                        }}
                      >
                        You have an approved Extended Leave for today. The
                        system has automatically updated your logbook for this
                        period. Enjoy your leave!
                      </p>
                      <button
                        onClick={() => navigate("/DailyRecords")}
                        style={{
                          background: "#0ea5e9",
                          color: "white",
                          padding: "10px 20px",
                          borderRadius: "10px",
                          border: "none",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        Return to Daily Records
                      </button>
                    </div>
                  </div>
                )}

                {/* ───── Loading state while checking access ───── */}
                {(projectAccessBlocked === null ||
                  extendedLeaveBlocked === null) && (
                  <div
                    className="logbook-fade-in"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "60px 24px",
                      background: "white",
                      borderRadius: 20,
                      border: "1px solid #f0f0f0",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                    }}
                  >
                    <FiLoader
                      className="logbook-spin"
                      size={28}
                      style={{ color: palette.light, marginBottom: 16 }}
                    />
                    <p
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      Checking status...
                    </p>
                    <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
                      Verifying your project assignment and leave status
                    </p>
                  </div>
                )}

                {/* ───── Main Form Card (only when access is granted) ───── */}
                {projectAccessBlocked === false &&
                  extendedLeaveBlocked === false && (
                    <div
                      className="logbook-card logbook-fade-in"
                      style={{
                        background: "white",
                        borderRadius: 20,
                        overflow: "hidden",
                        border: `2px solid transparent`,
                        borderColor: palette.border,
                        boxShadow: `0 4px 24px rgba(0,0,0,0.06), ${palette.glow}`,
                        transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                        position: "relative",
                      }}
                    >
                      {/* ── Progress bar (top border) ── */}
                      <div
                        style={{
                          height: 4,
                          background: "#e5e7eb",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          className="logbook-progress-fill"
                          style={{
                            height: "100%",
                            width: `${completionProgress}%`,
                            background: palette.gradient,
                            transition:
                              "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                            borderRadius:
                              completionProgress === 100 ? 0 : "0 4px 4px 0",
                          }}
                        />
                        {completionProgress === 100 && (
                          <div
                            className="logbook-shimmer"
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)`,
                            }}
                          />
                        )}
                      </div>

                      {/* ── Stepper Header ── */}
                      <div
                        style={{
                          padding: "20px 24px 16px",
                          borderBottom: "1px solid #f0f0f0",
                          background: palette.bg,
                          transition: "background 0.4s ease",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 0,
                          }}
                        >
                          {STEPS.map((step, idx) => {
                            // Determine if step should be skipped visually for leave
                            if (isOnLeave && step.id === 1) return null;

                            const isActive = activeStep === step.id;
                            const isCompleted =
                              step.id === 0
                                ? activeStep > 0
                                : step.id === 1
                                  ? isOnLeave ||
                                    (activeStep > 1 && !!formData.stack)
                                  : false;

                            const StepIcon = step.icon;

                            return (
                              <React.Fragment key={step.id}>
                                {idx > 0 &&
                                  !(
                                    isOnLeave &&
                                    step.id === 2 &&
                                    idx === 2
                                  ) && (
                                    <div
                                      style={{
                                        flex: 1,
                                        maxWidth: 80,
                                        height: 2,
                                        background:
                                          isCompleted || isActive
                                            ? palette.light
                                            : "#e0e0e0",
                                        transition: "background 0.4s ease",
                                        margin: "0 4px",
                                      }}
                                    />
                                  )}
                                {/* Connector before step 2 (Details) when on leave - since Stack is hidden */}
                                {isOnLeave && step.id === 2 && (
                                  <div
                                    style={{
                                      flex: 1,
                                      maxWidth: 80,
                                      height: 2,
                                      background:
                                        activeStep >= 2
                                          ? palette.light
                                          : "#e0e0e0",
                                      transition: "background 0.4s ease",
                                      margin: "0 4px",
                                    }}
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    canGoToStep(step.id) &&
                                    setActiveStep(step.id)
                                  }
                                  disabled={!canGoToStep(step.id)}
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 6,
                                    cursor: canGoToStep(step.id)
                                      ? "pointer"
                                      : "default",
                                    background: "none",
                                    border: "none",
                                    padding: "4px 12px",
                                    opacity: canGoToStep(step.id) ? 1 : 0.4,
                                    transition: "all 0.3s ease",
                                  }}
                                >
                                  <div
                                    className={
                                      isActive ? "logbook-step-pulse" : ""
                                    }
                                    style={{
                                      width: 40,
                                      height: 40,
                                      borderRadius: "50%",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      background: isCompleted
                                        ? palette.gradient
                                        : isActive
                                          ? palette.gradient
                                          : "#f3f4f6",
                                      color:
                                        isCompleted || isActive
                                          ? "white"
                                          : "#9ca3af",
                                      transition: "all 0.4s ease",
                                      boxShadow: isActive
                                        ? `0 0 0 4px ${palette.bg}`
                                        : "none",
                                    }}
                                  >
                                    {isCompleted ? (
                                      <FiCheck size={18} />
                                    ) : (
                                      <StepIcon size={18} />
                                    )}
                                  </div>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: isActive ? 700 : 500,
                                      color: isActive
                                        ? palette.primary
                                        : "#9ca3af",
                                      transition: "all 0.3s ease",
                                      letterSpacing: 0.3,
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    {step.label}
                                  </span>
                                </button>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>

                      {/* ── Form Body ── */}
                      <div style={{ padding: "24px" }}>
                        <form onSubmit={handleSubmit}>
                          {/* ╔══════════════════════════════════════════════╗ */}
                          {/* ║  STEP 0 — Status Selection                   ║ */}
                          {/* ╚══════════════════════════════════════════════╝ */}
                          <div
                            className="logbook-step-content"
                            style={{
                              display: activeStep === 0 ? "block" : "none",
                            }}
                          >
                            <div
                              style={{ textAlign: "center", marginBottom: 24 }}
                            >
                              <h2
                                style={{
                                  fontSize: 22,
                                  fontWeight: 700,
                                  color: "#1a1a2e",
                                  marginBottom: 6,
                                }}
                              >
                                How are you working today?
                              </h2>
                              <p style={{ color: "#6b7280", fontSize: 14 }}>
                                Select your work status for today
                              </p>
                            </div>

                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#374151",
                                marginBottom: 12,
                              }}
                            >
                              <FiUmbrella
                                style={{ marginRight: 8, color: palette.light }}
                              />
                              Status{" "}
                              <span style={{ color: "#ef4444", marginLeft: 4 }}>
                                *
                              </span>
                            </label>

                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 12,
                                marginBottom: 16,
                              }}
                            >
                              {statusOptions.map((opt) => {
                                const isSelected =
                                  formData.status === opt.value;
                                const isDisabled =
                                  areFieldsDisabled || opt.disabled;
                                const Icon = opt.icon;

                                return (
                                  <label
                                    key={opt.value}
                                    className="logbook-status-card"
                                    style={{
                                      flex: "1 1 160px",
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      padding: "20px 16px",
                                      borderRadius: 16,
                                      border: isSelected
                                        ? `2px solid ${opt.palette.light}`
                                        : "2px solid #e5e7eb",
                                      background: isSelected
                                        ? opt.palette.softBg
                                        : "#fafafa",
                                      cursor: isDisabled
                                        ? "not-allowed"
                                        : "pointer",
                                      opacity: isDisabled ? 0.45 : 1,
                                      transition: "all 0.3s ease",
                                      textAlign: "center",
                                      position: "relative",
                                      overflow: "hidden",
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name="status"
                                      value={opt.value}
                                      checked={isSelected}
                                      onChange={handleChange}
                                      disabled={isDisabled}
                                      style={{
                                        position: "absolute",
                                        opacity: 0,
                                      }}
                                    />
                                    {isSelected && (
                                      <div
                                        style={{
                                          position: "absolute",
                                          top: 8,
                                          right: 8,
                                          width: 20,
                                          height: 20,
                                          borderRadius: "50%",
                                          background: opt.palette.gradient,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                        }}
                                      >
                                        <FiCheck size={12} color="white" />
                                      </div>
                                    )}
                                    <div
                                      style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: "50%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: isSelected
                                          ? opt.palette.gradient
                                          : "#e5e7eb",
                                        marginBottom: 10,
                                        transition: "all 0.3s ease",
                                      }}
                                    >
                                      <Icon
                                        size={22}
                                        color={isSelected ? "white" : "#9ca3af"}
                                      />
                                    </div>
                                    <span
                                      style={{
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: isSelected
                                          ? opt.palette.primary
                                          : "#374151",
                                        marginBottom: 4,
                                      }}
                                    >
                                      {opt.label}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 11,
                                        color: isSelected
                                          ? opt.palette.text
                                          : "#9ca3af",
                                      }}
                                    >
                                      {opt.description}
                                    </span>
                                    {opt.disabled && (
                                      <div
                                        style={{
                                          marginTop: 8,
                                          padding: "4px 10px",
                                          borderRadius: 8,
                                          background: "rgba(239, 68, 68, 0.08)",
                                          border:
                                            "1px solid rgba(239, 68, 68, 0.15)",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: "#dc2626",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 4,
                                          }}
                                        >
                                          <FiClock size={12} /> Closed after
                                          10:00 AM
                                        </span>
                                        <span
                                          style={{
                                            fontSize: 10,
                                            color: "#b91c1c",
                                            display: "block",
                                            marginTop: 2,
                                          }}
                                        >
                                          Now: {timeRestriction.currentTime}
                                        </span>
                                      </div>
                                    )}
                                  </label>
                                );
                              })}
                            </div>

                            {/* Next button */}
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                paddingTop: 12,
                              }}
                            >
                              <button
                                type="button"
                                onClick={goNext}
                                disabled={areFieldsDisabled}
                                className="logbook-next-btn"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "10px 28px",
                                  borderRadius: 12,
                                  border: "none",
                                  background: palette.gradient,
                                  color: "white",
                                  fontWeight: 600,
                                  fontSize: 14,
                                  cursor: areFieldsDisabled
                                    ? "not-allowed"
                                    : "pointer",
                                  transition: "all 0.3s ease",
                                  boxShadow: `0 4px 14px ${palette.bg}`,
                                }}
                              >
                                {isOnLeave ? "Review & Submit" : "Next"}
                                <FiArrowRight style={{ marginLeft: 8 }} />
                              </button>
                            </div>
                          </div>

                          {/* ╔══════════════════════════════════════════════╗ */}
                          {/* ║  STEP 1 — Task Stack                         ║ */}
                          {/* ╚══════════════════════════════════════════════╝ */}
                          <div
                            className="logbook-step-content"
                            style={{
                              display:
                                activeStep === 1 && !isOnLeave
                                  ? "block"
                                  : "none",
                            }}
                          >
                            <div
                              style={{ textAlign: "center", marginBottom: 24 }}
                            >
                              <h2
                                style={{
                                  fontSize: 22,
                                  fontWeight: 700,
                                  color: "#1a1a2e",
                                  marginBottom: 6,
                                }}
                              >
                                What's your focus area?
                              </h2>
                              <p style={{ color: "#6b7280", fontSize: 14 }}>
                                Select the technology stack you worked on
                              </p>
                            </div>

                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#374151",
                                marginBottom: 12,
                              }}
                            >
                              <FiMonitor
                                style={{ marginRight: 8, color: palette.light }}
                              />
                              Task Stack{" "}
                              <span style={{ color: "#ef4444", marginLeft: 4 }}>
                                *
                              </span>
                            </label>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fill, minmax(180px, 1fr))",
                                gap: 10,
                                marginBottom: 20,
                              }}
                            >
                              {stackOptions.map((opt) => {
                                const isSelected = formData.stack === opt.value;
                                return (
                                  <label
                                    key={opt.value}
                                    className="logbook-stack-card"
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 10,
                                      padding: "12px 14px",
                                      borderRadius: 12,
                                      border: isSelected
                                        ? `2px solid ${palette.light}`
                                        : "2px solid #e5e7eb",
                                      background: isSelected
                                        ? palette.softBg
                                        : "#fafafa",
                                      cursor: areFieldsDisabled
                                        ? "not-allowed"
                                        : "pointer",
                                      transition: "all 0.25s ease",
                                      opacity: areFieldsDisabled ? 0.5 : 1,
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name="stack"
                                      value={opt.value}
                                      checked={isSelected}
                                      onChange={handleChange}
                                      disabled={areFieldsDisabled}
                                      style={{
                                        position: "absolute",
                                        opacity: 0,
                                      }}
                                    />
                                    <div
                                      style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 8,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: isSelected
                                          ? palette.gradient
                                          : "#e5e7eb",
                                        color: isSelected ? "white" : "#9ca3af",
                                        transition: "all 0.25s ease",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {React.cloneElement(opt.icon, {
                                        size: 16,
                                      })}
                                    </div>
                                    <span
                                      style={{
                                        fontSize: 13,
                                        fontWeight: isSelected ? 600 : 500,
                                        color: isSelected
                                          ? palette.primary
                                          : "#4b5563",
                                        transition: "color 0.2s ease",
                                      }}
                                    >
                                      {opt.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>

                            {/* Nav buttons */}
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                paddingTop: 12,
                              }}
                            >
                              <button
                                type="button"
                                onClick={goPrev}
                                className="logbook-back-btn"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "10px 24px",
                                  borderRadius: 12,
                                  border: `1.5px solid #e0e0e0`,
                                  background: "white",
                                  color: "#6b7280",
                                  fontWeight: 600,
                                  fontSize: 14,
                                  cursor: "pointer",
                                  transition: "all 0.3s ease",
                                }}
                              >
                                <FiArrowLeft style={{ marginRight: 8 }} />
                                Back
                              </button>
                              <button
                                type="button"
                                onClick={goNext}
                                disabled={!formData.stack}
                                className="logbook-next-btn"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "10px 28px",
                                  borderRadius: 12,
                                  border: "none",
                                  background: formData.stack
                                    ? palette.gradient
                                    : "#d1d5db",
                                  color: "white",
                                  fontWeight: 600,
                                  fontSize: 14,
                                  cursor: formData.stack
                                    ? "pointer"
                                    : "not-allowed",
                                  transition: "all 0.3s ease",
                                  boxShadow: formData.stack
                                    ? `0 4px 14px ${palette.bg}`
                                    : "none",
                                }}
                              >
                                Next
                                <FiArrowRight style={{ marginLeft: 8 }} />
                              </button>
                            </div>
                          </div>

                          {/* ╔══════════════════════════════════════════════╗ */}
                          {/* ║  STEP 2 — The Three Fields (or Leave msg)    ║ */}
                          {/* ╚══════════════════════════════════════════════╝ */}
                          <div
                            className="logbook-step-content"
                            style={{
                              display: activeStep === 2 ? "block" : "none",
                            }}
                          >
                            {isOnLeave ? (
                              /* Leave mode */
                              <div
                                style={{
                                  textAlign: "center",
                                  padding: "24px 0",
                                }}
                              >
                                <div
                                  style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: "50%",
                                    background: palette.gradient,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    margin: "0 auto 16px",
                                  }}
                                >
                                  <FiUmbrella size={28} color="white" />
                                </div>
                                <h2
                                  style={{
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: "#1a1a2e",
                                    marginBottom: 6,
                                  }}
                                >
                                  Taking a Day Off
                                </h2>
                                <div
                                  style={{
                                    background: palette.softBg,
                                    padding: "14px 20px",
                                    borderRadius: 12,
                                    border: `1px solid ${palette.border}`,
                                    maxWidth: 400,
                                    margin: "16px auto",
                                  }}
                                >
                                  <p
                                    style={{
                                      color: palette.text,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: 8,
                                    }}
                                  >
                                    <FiInfo />
                                    No further details needed for leave days.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              /* ── Working / WFH mode — all three fields ── */
                              <>
                                <div
                                  style={{
                                    textAlign: "center",
                                    marginBottom: 20,
                                  }}
                                >
                                  <h2
                                    style={{
                                      fontSize: 22,
                                      fontWeight: 700,
                                      color: "#1a1a2e",
                                      marginBottom: 6,
                                    }}
                                  >
                                    Log your daily impact
                                  </h2>
                                  <p style={{ color: "#6b7280", fontSize: 14 }}>
                                    Complete your daily work summary
                                  </p>
                                </div>

                                {/* ── Tasks Completed ── */}
                                <div style={{ marginBottom: 20 }}>
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: "#374151",
                                      marginBottom: 8,
                                    }}
                                  >
                                    <FiCheckCircle
                                      style={{
                                        marginRight: 8,
                                        color: palette.light,
                                      }}
                                    />
                                    Tasks Completed{" "}
                                    <span
                                      style={{
                                        color: "#ef4444",
                                        marginLeft: 4,
                                      }}
                                    >
                                      *
                                    </span>
                                  </label>
                                  <textarea
                                    name="tasks"
                                    value={formData.tasks}
                                    onChange={handleChange}
                                    required
                                    disabled={areFieldsDisabled}
                                    rows={4}
                                    placeholder="What did you accomplish today? Be specific..."
                                    className="logbook-textarea"
                                    style={{
                                      width: "100%",
                                      padding: "12px 16px",
                                      border: `1.5px solid ${formData.tasks.trim() ? palette.border : "#e0e0e0"}`,
                                      borderRadius: 14,
                                      fontSize: 14,
                                      resize: "vertical",
                                      outline: "none",
                                      transition: "all 0.3s ease",
                                      background: areFieldsDisabled
                                        ? "#f5f5f5"
                                        : "#fafafa",
                                      color: "#1a1a2e",
                                      fontFamily: "inherit",
                                      lineHeight: 1.6,
                                    }}
                                  />
                                  <EntryFeedbackIndicator
                                    text={formData.tasks}
                                    forcedResult={validationResults.tasks}
                                  />
                                </div>

                                {/* ── Challenges Faced ── */}
                                <div style={{ marginBottom: 20 }}>
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: "#374151",
                                      marginBottom: 8,
                                    }}
                                  >
                                    <FiAlertTriangle
                                      style={{
                                        marginRight: 8,
                                        color: palette.light,
                                      }}
                                    />
                                    Challenges Faced{" "}
                                    <span
                                      style={{
                                        color: "#ef4444",
                                        marginLeft: 4,
                                      }}
                                    >
                                      *
                                    </span>
                                  </label>
                                  <textarea
                                    name="challenges"
                                    value={formData.challenges}
                                    onChange={handleChange}
                                    required
                                    disabled={areFieldsDisabled}
                                    rows={3}
                                    placeholder="Any obstacles or difficulties you encountered..."
                                    className="logbook-textarea"
                                    style={{
                                      width: "100%",
                                      padding: "12px 16px",
                                      border: `1.5px solid ${formData.challenges.trim() ? palette.border : "#e0e0e0"}`,
                                      borderRadius: 14,
                                      fontSize: 14,
                                      resize: "vertical",
                                      outline: "none",
                                      transition: "all 0.3s ease",
                                      background: areFieldsDisabled
                                        ? "#f5f5f5"
                                        : "#fafafa",
                                      color: "#1a1a2e",
                                      fontFamily: "inherit",
                                      lineHeight: 1.6,
                                    }}
                                  />
                                  <EntryFeedbackIndicator
                                    text={formData.challenges}
                                    forcedResult={validationResults.challenges}
                                  />
                                </div>

                                {/* ── Plans for Tomorrow ── */}
                                <div style={{ marginBottom: 20 }}>
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: "#374151",
                                      marginBottom: 8,
                                    }}
                                  >
                                    <FiTarget
                                      style={{
                                        marginRight: 8,
                                        color: palette.light,
                                      }}
                                    />
                                    Plans for Tomorrow{" "}
                                    <span
                                      style={{
                                        color: "#ef4444",
                                        marginLeft: 4,
                                      }}
                                    >
                                      *
                                    </span>
                                  </label>
                                  <textarea
                                    name="plans"
                                    value={formData.plans}
                                    onChange={handleChange}
                                    required
                                    disabled={areFieldsDisabled}
                                    rows={3}
                                    placeholder="What will you focus on tomorrow?"
                                    className="logbook-textarea"
                                    style={{
                                      width: "100%",
                                      padding: "12px 16px",
                                      border: `1.5px solid ${formData.plans.trim() ? palette.border : "#e0e0e0"}`,
                                      borderRadius: 14,
                                      fontSize: 14,
                                      resize: "vertical",
                                      outline: "none",
                                      transition: "all 0.3s ease",
                                      background: areFieldsDisabled
                                        ? "#f5f5f5"
                                        : "#fafafa",
                                      color: "#1a1a2e",
                                      fontFamily: "inherit",
                                      lineHeight: 1.6,
                                    }}
                                  />
                                  <EntryFeedbackIndicator
                                    text={formData.plans}
                                    forcedResult={validationResults.plans}
                                  />
                                </div>
                              </>
                            )}

                            {/* ── Status / error messages ── */}
                            {statusMessage && (
                              <div
                                className="logbook-fade-in"
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 12,
                                  padding: "14px 16px",
                                  borderRadius: 14,
                                  borderLeft: `4px solid ${
                                    statusMessage.type === "success"
                                      ? "#50b748"
                                      : statusMessage.type === "project_error"
                                        ? "#f59e0b"
                                        : "#ef4444"
                                  }`,
                                  background:
                                    statusMessage.type === "success"
                                      ? "#f0fdf4"
                                      : statusMessage.type === "project_error"
                                        ? "#fffbeb"
                                        : "#fef2f2",
                                  marginBottom: 16,
                                }}
                              >
                                {statusMessage.type === "success" ? (
                                  <FiCheckCircle
                                    style={{
                                      color: "#50b748",
                                      marginTop: 2,
                                      flexShrink: 0,
                                    }}
                                  />
                                ) : statusMessage.type === "project_error" ? (
                                  <FiAlertTriangle
                                    style={{
                                      color: "#f59e0b",
                                      marginTop: 2,
                                      flexShrink: 0,
                                    }}
                                  />
                                ) : (
                                  <FiAlertCircle
                                    style={{
                                      color: "#ef4444",
                                      marginTop: 2,
                                      flexShrink: 0,
                                    }}
                                  />
                                )}

                                <div style={{ flex: 1 }}>
                                  {statusMessage.type === "project_error" ? (
                                    <>
                                      <p
                                        style={{
                                          fontWeight: 600,
                                          color: "#92400e",
                                          marginBottom: 4,
                                          fontSize: 14,
                                        }}
                                      >
                                        Team Assignment Required
                                      </p>
                                      <p
                                        style={{
                                          fontSize: 13,
                                          color: "#a16207",
                                          marginBottom: 12,
                                        }}
                                      >
                                        {statusMessage.text}
                                      </p>
                                      <p
                                        style={{
                                          fontSize: 13,
                                          color: "#a16207",
                                          marginBottom: 8,
                                        }}
                                      >
                                        To submit logbook entries, you must
                                        first join a project team on{" "}
                                        <a
                                          href="https://talenttrail.slt.lk"
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            fontWeight: 600,
                                            textDecoration: "underline",
                                          }}
                                        >
                                          talenttrail.slt.lk
                                        </a>
                                        . Follow these steps:
                                      </p>
                                      <ol
                                        style={{
                                          fontSize: 13,
                                          color: "#a16207",
                                          listStyleType: "decimal",
                                          paddingLeft: 20,
                                          marginBottom: 12,
                                        }}
                                      >
                                        <li style={{ marginBottom: 6 }}>
                                          Go to{" "}
                                          <a
                                            href="https://talenttrail.slt.lk"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                              fontWeight: 500,
                                              textDecoration: "underline",
                                            }}
                                          >
                                            talenttrail.slt.lk
                                          </a>{" "}
                                          and log in with your credentials
                                        </li>
                                        <li style={{ marginBottom: 6 }}>
                                          Browse the available projects and find
                                          the project that you are assigned to.
                                        </li>
                                        <li style={{ marginBottom: 6 }}>
                                          Select the project and send a request
                                          to join the team
                                        </li>
                                        <li style={{ marginBottom: 6 }}>
                                          Wait for the admin to approve your
                                          request
                                        </li>
                                        <li>
                                          Once approved, return here and try
                                          submitting your logbook again
                                        </li>
                                      </ol>
                                      <p
                                        style={{
                                          fontSize: 11,
                                          color: "#b45309",
                                          borderTop: "1px solid #fde68a",
                                          paddingTop: 8,
                                          marginTop: 8,
                                        }}
                                      >
                                        Already joined a team? Team data is
                                        synced every 5 minutes — please wait a
                                        moment and refresh, or contact your
                                        administrator if the issue persists.
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <span
                                        style={{
                                          fontWeight: 600,
                                          fontSize: 14,
                                          color:
                                            statusMessage.type === "success"
                                              ? "#166534"
                                              : "#991b1b",
                                        }}
                                      >
                                        {statusMessage.text}
                                      </span>
                                      {statusMessage.type === "success" && (
                                        <div
                                          style={{
                                            color: "#15803d",
                                            fontSize: 11,
                                            marginTop: 4,
                                          }}
                                        >
                                          Redirecting to records...
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* ── Nav & Submit buttons ── */}
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                paddingTop: 8,
                              }}
                            >
                              <button
                                type="button"
                                onClick={goPrev}
                                className="logbook-back-btn"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "10px 24px",
                                  borderRadius: 12,
                                  border: "1.5px solid #e0e0e0",
                                  background: "white",
                                  color: "#6b7280",
                                  fontWeight: 600,
                                  fontSize: 14,
                                  cursor: "pointer",
                                  transition: "all 0.3s ease",
                                }}
                              >
                                <FiArrowLeft style={{ marginRight: 8 }} />
                                Back
                              </button>
                              <button
                                type="submit"
                                disabled={isSubmitDisabled}
                                className="logbook-submit-btn"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  padding: "12px 32px",
                                  borderRadius: 14,
                                  border: "none",
                                  background: isSubmitDisabled
                                    ? projectAccessBlocked
                                      ? "#fbbf24"
                                      : "#d1d5db"
                                    : completionProgress === 100
                                      ? palette.gradient
                                      : palette.gradient,
                                  color:
                                    isSubmitDisabled && projectAccessBlocked
                                      ? "#92400e"
                                      : "white",
                                  fontWeight: 700,
                                  fontSize: 15,
                                  cursor: isSubmitDisabled
                                    ? "not-allowed"
                                    : "pointer",
                                  transition: "all 0.4s ease",
                                  boxShadow: isSubmitDisabled
                                    ? "none"
                                    : `0 6px 20px ${palette.bg}`,
                                  minWidth: 180,
                                }}
                              >
                                {submitButtonContent()}
                              </button>
                            </div>

                            {/* Hint text under button when blocked */}
                            {projectAccessBlocked && (
                              <p
                                style={{
                                  textAlign: "center",
                                  fontSize: 12,
                                  color: "#b45309",
                                  marginTop: 8,
                                }}
                              >
                                You must be assigned to a project on{" "}
                                <a
                                  href="https://talenttrail.slt.lk"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontWeight: 500,
                                    textDecoration: "underline",
                                  }}
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
                  )}

                {/* ───── Info Cards (only when access is granted) ───── */}
                {projectAccessBlocked === false && (
                  <div style={{ marginTop: 24 }} className="logbook-fade-in">
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Tips Card */}
                      <InfoCard
                        icon={<FiInfo />}
                        title="Tips for Better Logging"
                        palette={palette}
                      >
                        <ul
                          style={{ listStyle: "none", padding: 0, margin: 0 }}
                        >
                          {[
                            "Always keep a backup of your weekly logs",
                            "Be specific about the tasks you completed",
                            "Only submit descriptive and work-related entries",
                            "Update daily to help you track your progress",
                          ].map((tip, i) => (
                            <li
                              key={i}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 8,
                                padding: "6px 0",
                                fontSize: 13,
                                color: "#4b5563",
                              }}
                            >
                              <span
                                style={{
                                  color: palette.light,
                                  flexShrink: 0,
                                  marginTop: 2,
                                }}
                              >
                                •
                              </span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </InfoCard>

                      {/* Today's Summary Card */}
                      <InfoCard
                        icon={<FiCalendar />}
                        title="Today's Summary"
                        palette={palette}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 14,
                          }}
                        >
                          <SummaryRow
                            label="Date"
                            value={new Date().toLocaleDateString("en-US", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          />
                          <SummaryRow
                            label="Week"
                            value={`Week ${Math.ceil(new Date().getDate() / 7)} of ${new Date().toLocaleString("default", { month: "long" })}`}
                          />
                          <SummaryRow
                            label="Status"
                            value={
                              <span
                                style={{
                                  color: palette.primary,
                                  fontWeight: 600,
                                }}
                              >
                                {palette.label}
                              </span>
                            }
                          />
                        </div>
                      </InfoCard>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
};

/* ════════════════════════════════════════════════════════════════════════════ */
/*  Sub-Components                                                            */
/* ════════════════════════════════════════════════════════════════════════════ */

/** Static info card for sidebar info */
const InfoCard = ({ icon, title, palette, children }) => {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        border: "1px solid #f0f0f0",
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 16px",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: palette.softBg,
            color: palette.light,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#1a1a2e",
            flex: 1,
            textAlign: "left",
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ padding: "14px 16px" }}>{children}</div>
    </div>
  );
};

/** Summary row */
const SummaryRow = ({ label, value }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <span
      style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", minWidth: 60 }}
    >
      {label}:
    </span>
    <span style={{ fontSize: 13, color: "#374151", flex: 1 }}>{value}</span>
  </div>
);

export default Logbook;
