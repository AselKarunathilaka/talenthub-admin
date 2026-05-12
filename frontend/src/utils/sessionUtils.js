/**
 * sessionUtils.js
 * src/utils/sessionUtils.js
 *
 * Single shared utility for handling session expiry across the whole app.
 * All API files (api.js, adminApi.js, adminSeatApi.js, leaveRequestApi.js)
 * call handleUnauthorized() whenever they receive a 401 response.
 */

/**
 * Clears all stored session data, stores an expiry message,
 * and redirects the user to the correct login page.
 *
 * @param {string} message - Optional message to show on the login page
 */
export const handleUnauthorized = (message = "Your session has expired. Please log in again.") => {
  // Detect which role was logged in so we redirect to the right login page
  const wasAdmin     = !!localStorage.getItem("adminInfo");
  const wasGateStaff = !!localStorage.getItem("gateStaffInfo");

  // Clear every possible session key
  localStorage.removeItem("adminInfo");
  localStorage.removeItem("authToken");
  localStorage.removeItem("internId");
  localStorage.removeItem("gateStaffInfo");
  localStorage.removeItem("token");
  localStorage.removeItem("userData");

  // Store the message so the login page can display it (cleared after first read)
  sessionStorage.setItem("sessionMessage", message);

  // Redirect — use replace so the browser back button doesn't return to the
  // protected page after the user is logged out
  if (wasGateStaff) {
    window.location.replace("/gate-staff-login");
  } else if (wasAdmin) {
    window.location.replace("/admin-login");
  } else {
    window.location.replace("/");
  }
};

/**
 * Reads and clears the session message stored by handleUnauthorized.
 * Call this inside login page components to show the expiry banner.
 *
 * @returns {string} The message, or empty string if none.
 */
export const getSessionMessage = () => {
  const msg = sessionStorage.getItem("sessionMessage") || "";
  if (msg) sessionStorage.removeItem("sessionMessage");
  return msg;
};