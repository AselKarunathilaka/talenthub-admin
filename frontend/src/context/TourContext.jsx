// this file is for the guided tour context
// This context tracks tour progress, cross-page navigation, backend status sync, and dev testing triggers (?testTour=true).

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, getAuthToken } from '../utils/api';
import { TOUR_STEPS } from '../config/tourSteps';
import { GuidedTour } from '../components/GuidedTour';

const TourContext = createContext();

export const TourProvider = ({ children }) => {
  const [isTourActive, setIsTourActive] = useState(false);
  const [isTourCompleted, setIsTourCompleted] = useState(false); // Hidden only after confirmed completion/dismissal
  const [hasPausedTour, setHasPausedTour] = useState(false);
  const [isDismissedForSession, setIsDismissedForSession] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  // Resolve the logged-in intern's ID directly from localStorage — no prop needed
  const [internId, setInternId] = useState(() => localStorage.getItem('internId'));
  const navigate = useNavigate();
  const location = useLocation();

  const waitForElement = (selector, timeout = 3000) => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearInterval(interval);
          resolve(el);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          resolve(null);
        }
      }, 50);
    });
  };

  // Re-sync internId if the user logs in after the provider mounts or navigation occurs
  useEffect(() => {
    const id = localStorage.getItem('internId');
    if (id && id !== internId) {
      setInternId(id);
    }
  }, [location.pathname, internId]);

  // On internId load, check permanent status (localStorage + DB) AND session status (sessionStorage)
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const forceTestTour = queryParams.get('testTour') === 'true';

    if (!internId) return; // Not logged in yet — leave sticky note visible (false default)

    const localCompleted = localStorage.getItem(`talenthub_tour_completed_${internId}`);
    const pausedStep = localStorage.getItem(`talenthub_tour_paused_${internId}`);
    const sessionDismissed = sessionStorage.getItem(`talenthub_tour_session_dismissed_${internId}`);

    if (forceTestTour) {
      setIsTourCompleted(false);
      setIsDismissedForSession(false);
      setHasPausedTour(false);
      startTour(0);
      return;
    }

    // Fast path: localStorage already says completed on this device — hide immediately
    if (localCompleted === 'true') {
      setIsTourCompleted(true);
      setHasPausedTour(false);
      setIsDismissedForSession(sessionDismissed === 'true');
      // Background sync: Ensure server DB also reflects completion (e.g. if completed prior to fix)
      api.put('/interns/tour-status', { hasCompletedTour: true, internId }).catch(() => {});
      return;
    }

    // Otherwise verify against the DB to ensure account-wide persistence across all devices
    api.get(`/interns/${internId}`)
      .then((data) => {
        const completed = data?.hasCompletedTour === true;
        setIsTourCompleted(completed);
        if (completed) {
          localStorage.setItem(`talenthub_tour_completed_${internId}`, 'true');
          localStorage.removeItem(`talenthub_tour_paused_${internId}`);
          setHasPausedTour(false);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch tour status from server:', err);
      });

    // A paused tour is intentionally persistent until completion or "Don't Show Again".
    setHasPausedTour(pausedStep !== null && Number.isInteger(Number(pausedStep)));

    // Check temporary session dismissal
    setIsDismissedForSession(sessionDismissed === 'true');
  }, [internId, location.search]);

  // Route switcher when navigating between step routes
  useEffect(() => {
    if (!isTourActive) return;

    const currentStep = TOUR_STEPS[currentStepIndex];
    if (currentStep && location.pathname !== currentStep.route) {
      navigate(currentStep.route);
    }
  }, [currentStepIndex, isTourActive]);

  const startTour = (fromStepIndex = null) => {
    const resumeIndex = fromStepIndex === null
      ? Number(localStorage.getItem(`talenthub_tour_paused_${internId}`))
      : fromStepIndex;
    const index = Number.isInteger(resumeIndex) && resumeIndex >= 0 && resumeIndex < TOUR_STEPS.length
      ? resumeIndex
      : 0;

    setCurrentStepIndex(index);
    setIsTourActive(true);
  };

  // 1. Session Dismissal ("Remind Me Later")
  const remindMeLater = () => {
    setIsDismissedForSession(true);
    if (internId) {
      sessionStorage.setItem(`talenthub_tour_session_dismissed_${internId}`, 'true');
    }
  };

  // 2. Permanent Completion / Dismissal ("Don't Show Again" or Finishing Tour)
  const persistCompletion = async () => {
    setIsTourCompleted(true);
    setIsTourActive(false);

    if (internId) {
      localStorage.setItem(`talenthub_tour_completed_${internId}`, 'true');
      localStorage.removeItem(`talenthub_tour_paused_${internId}`);
      setHasPausedTour(false);
      try {
        await api.put('/interns/tour-status', { hasCompletedTour: true, internId });
      } catch (err) {
        console.warn('Could not persist tour status to server:', err);
      }
    }
  };

  // Closing an info card pauses the tour. It must never mark the tour complete.
  const pauseTour = () => {
    setIsTourActive(false);
    if (internId) {
      localStorage.setItem(`talenthub_tour_paused_${internId}`, String(currentStepIndex));
    }
    setHasPausedTour(true);
  };

  // "Don't Show Again" and completing the full tour permanently dismiss the tour.
  const skipTour = () => {
    persistCompletion();
  };

  const finishTour = () => {
    persistCompletion();
  };

  const nextStep = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      if (internId) {
        localStorage.setItem(`talenthub_tour_paused_${internId}`, String(nextIndex));
      }
    } else {
      finishTour();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      const previousIndex = currentStepIndex - 1;
      setCurrentStepIndex(previousIndex);
      if (internId) {
        localStorage.setItem(`talenthub_tour_paused_${internId}`, String(previousIndex));
      }
    }
  };

  // Global console testing helper to reset both permanent and session states
  window.resetTalentHubTour = async () => {
    const id = internId || localStorage.getItem('internId');
    if (id) {
      localStorage.removeItem(`talenthub_tour_completed_${id}`);
      localStorage.removeItem(`talenthub_tour_paused_${id}`);
      sessionStorage.removeItem(`talenthub_tour_session_dismissed_${id}`);
      try {
        await api.put('/interns/tour-status', { hasCompletedTour: false, internId: id });
      } catch (err) {
        console.warn('Could not reset tour status on server:', err);
      }
    }
    setIsTourCompleted(false);
    setHasPausedTour(false);
    setIsDismissedForSession(false);
    startTour(0);
    console.log('[Tour] TalentHub Tour Status Reset Successfully!');
  };

  return (
    <TourContext.Provider
      value={{
        isTourActive,
        isTourCompleted,
        hasPausedTour,
        isDismissedForSession,
        currentStepIndex,
        totalSteps: TOUR_STEPS.length,
        currentStep: TOUR_STEPS[currentStepIndex],
        startTour,
        remindMeLater,
        skipTour,
        pauseTour,
        finishTour,
        nextStep,
        prevStep,
        waitForElement
      }}
    >
      <GuidedTour />
      {children}
    </TourContext.Provider>
  );
};

export const useTour = () => useContext(TourContext);