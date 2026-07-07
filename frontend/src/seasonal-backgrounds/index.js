/**
 * Seasonal Backgrounds — Season Registry & Date Logic
 *
 * Central config that maps season keys to date ranges.
 * Used by SeasonalBackground.jsx and the backend override system.
 */

/**
 * All recognised seasons/events for the Login page background.
 *
 * - `allMonth: true`  → active for the entire month
 * - `day` / `endDay`  → active only on specific day(s) within the month
 */
export const SEASONS = [
  {
    key: "new-year",
    label: "New Year",
    month: 1,
    day: 1,
    endDay: 1,
  },
  {
    key: "independence-day",
    label: "Independence Day",
    month: 2,
    day: 4,
    endDay: 4,
  },
  {
    key: "sinhala-tamil-new-year",
    label: "Sinhala and Tamil New Year",
    month: 4,
    allMonth: true,
  },
  {
    key: "vesak-festival",
    label: "Vesak Festival",
    month: 5,
    allMonth: true,
  },
  {
    key: "poson-festival",
    label: "Poson Festival",
    month: 6,
    allMonth: true,
  },
  {
    key: "halloween",
    label: "Halloween",
    month: 10,
    day: 31,
    endDay: 31,
  },
  {
    key: "christmas",
    label: "Christmas",
    month: 12,
    allMonth: true,
  },
];

/**
 * Map of season keys to their lazy-loaded background components.
 * Only seasons with a designed background are listed here.
 * Seasons without an entry fall back to the default gradient.
 */
export const SEASON_COMPONENTS = {
  "poson-festival": () =>
    import("./poson-festival/PosonBackground").then((m) => ({
      default: m.default,
    })),
  // Future seasons can be added here as they are designed:
  // "vesak-festival": () => import("./vesak-festival/VesakBackground"),
  // "christmas": () => import("./christmas/ChristmasBackground"),
};

/**
 * Determine which season is active for a given date.
 * @param {Date} date - The date to check (defaults to now)
 * @returns {string|null} The season key, or null for default
 */
export function getActiveSeason(date = new Date()) {
  const month = date.getMonth() + 1; // 1-indexed
  const day = date.getDate();

  for (const season of SEASONS) {
    if (season.month !== month) continue;

    if (season.allMonth) return season.key;

    if (day >= season.day && day <= season.endDay) return season.key;
  }

  return null; // No active season → use default gradient
}

/**
 * Look up a season definition by key.
 * @param {string} key
 * @returns {object|undefined}
 */
export function getSeasonByKey(key) {
  return SEASONS.find((s) => s.key === key);
}

/**
 * Check whether a season key has a designed background component.
 * @param {string} key
 * @returns {boolean}
 */
export function hasSeasonComponent(key) {
  return key != null && key in SEASON_COMPONENTS;
}
