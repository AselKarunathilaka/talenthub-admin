// this is created for the dashboard sticky note to start the guided tour.

import React from 'react';
import { Lightbulb, Rocket, Clock, X } from 'lucide-react';
import { useTour } from '../context/TourContext';

export const DashboardStickyNote = () => {
  const { isTourCompleted, hasPausedTour, isDismissedForSession, startTour, remindMeLater, skipTour } = useTour();

  // Hide sticky note if permanently completed/dismissed OR dismissed for the current session
  if (isTourCompleted || isDismissedForSession) return null;

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-100 via-orange-100 to-amber-50 p-5 shadow-sm border border-amber-200/80 transition-all hover:shadow-md">
      {/* Decorative Sticky Pin Graphic Accent */}
      <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-amber-400/30 blur-sm" />

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Note Content */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md">
            <Lightbulb className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-amber-950">
              Welcome to TalentHub! Need a Quick Walkthrough?
            </h3>
            <p className="text-xs sm:text-sm text-amber-800/90 mt-0.5 leading-relaxed">
              Take a short guided tour to explore how logbooks, attendance, seat reservations, and performance tracking work.
            </p>
          </div>
        </div>

        {/* 3-Button Actions Group */}
        <div className="flex flex-wrap items-center gap-2 self-end lg:self-center shrink-0">
          {/* 1. Primary Action: Start Tour */}
          <button
            onClick={() => startTour()}
            className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-amber-700 hover:shadow-lg active:scale-95"
          >
            <span>{hasPausedTour ? 'Resume Tour' : 'Start Tour'}</span>
            <Rocket className="w-3.5 h-3.5" />
          </button>

          {/* 2. Middle Action: Remind Me Later (Session-based) */}
          <button
            onClick={remindMeLater}
            className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-200/50 px-3 py-2 text-xs font-medium text-amber-900 transition-all hover:bg-amber-200 hover:text-amber-950"
            title="Hide for this browser session. Will show up again next time you log in."
          >
            <span>Remind Me Later</span>
            <Clock className="w-3.5 h-3.5" />
          </button>

          {/* 3. Dismiss Action: Skip Permanently */}
          <button
            onClick={skipTour}
            className="flex items-center gap-1.5 rounded-xl border border-amber-300/80 bg-white/70 px-3 py-2 text-xs font-medium text-amber-900/80 transition-all hover:bg-white hover:text-amber-950"
            title="Don't show this message again"
          >
            <span>Don't Show Again</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};