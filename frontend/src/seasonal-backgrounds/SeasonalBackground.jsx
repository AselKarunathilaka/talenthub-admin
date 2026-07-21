import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  getActiveSeason,
  hasSeasonComponent,
  SEASON_COMPONENTS,
} from "./index";
import { API_BASE_URL } from "../utils/api";
import "./SeasonalBackground.css";

/**
 * SeasonalBackground — Renders the appropriate seasonal background
 * behind the Login page content.
 *
 * Logic:
 * 1. On mount, calls GET /api/login-season to check for a backend override
 * 2. If the backend returns an override key → use that season
 * 3. If no override → auto-detect from the current date
 * 4. If the resolved season has a designed component → lazy-load & render it
 * 5. If not → render nothing (the Login page shows its default gradient)
 *
 * @param {function} onSeasonResolved - Callback with (seasonKey|null).
 *        Login.jsx uses this to know whether to swap its gradient.
 */
export default function SeasonalBackground({ onSeasonResolved }) {
  const [SeasonComponent, setSeasonComponent] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      let seasonKey = null;

      // 1. Check backend override
      try {
        const res = await fetch(`${API_BASE_URL}/api/login-season`);
        if (res.ok) {
          const data = await res.json();
          if (data.seasonKey) {
            seasonKey = data.seasonKey;
          }
        }
      } catch {
        // Backend unreachable — fall through to date-based detection
      }

      // 2. Fall back to date-based auto-detection
      if (!seasonKey) {
        seasonKey = getActiveSeason();
      }

      if (cancelled) return;

      // 3. Check if we have a component for this season
      if (hasSeasonComponent(seasonKey)) {
        try {
          const mod = await SEASON_COMPONENTS[seasonKey]();
          if (!cancelled) {
            setSeasonComponent(() => mod.default);
            onSeasonResolved?.(seasonKey);
          }
        } catch (err) {
          console.warn(
            `[SeasonalBackground] Failed to load component for "${seasonKey}":`,
            err
          );
          onSeasonResolved?.(null);
        }
      } else {
        // No designed background for this season → default gradient
        onSeasonResolved?.(null);
      }
    }

    resolve();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!SeasonComponent) return null;

  return (
    <Suspense fallback={null}>
      <SeasonComponent />
    </Suspense>
  );
}
