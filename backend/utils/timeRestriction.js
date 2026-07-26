const moment = require("moment-timezone");

/**
 * Check if the current time is after 10:00 AM in Sri Lankan timezone
 * @returns {boolean} - True if current time is after 10 AM, false otherwise
 */
const isAfter10AM = () => {
  try {
    const currentTime = moment().tz("Asia/Colombo");
    const tenAM = moment().tz("Asia/Colombo").set({
      hour: 10,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    return currentTime.isAfter(tenAM);
  } catch (error) {
    console.error("Error checking time restriction:", error);
    return false;
  }
};

/**
 * Get current time in Sri Lankan timezone formatted for display
 * @returns {string} - Current time in HH:mm format
 */
const getCurrentSriLankanTime = () => {
  try {
    return moment().tz("Asia/Colombo").format("HH:mm");
  } catch (error) {
    console.error("Error getting current time:", error);
    return new Date().toLocaleTimeString();
  }
};

/**
 * Check if leave submission is allowed based on current time
 * @returns {object} - Object containing allowed status and message
 */
const checkLeaveSubmissionAllowed = () => {
  const isAfter10 = isAfter10AM();
  const currentTime = getCurrentSriLankanTime();

  return {
    allowed: !isAfter10,
    message: isAfter10
      ? `Leave applications are not allowed after 10:00 AM. Current time: ${currentTime}`
      : "Leave application is allowed",
    currentTime: currentTime,
  };
};

// ★ New: returns today's date in Sri Lankan time as "YYYY-MM-DD"
const getSriLankanDateString = () => {
  try {
    return moment().tz("Asia/Colombo").format("YYYY-MM-DD");
  } catch (error) {
    console.error("Error getting Sri Lankan date string:", error);
    // Fallback: UTC date — better than crashing, though it can be off by a day
    // near the SL midnight boundary if this ever actually triggers.
    return new Date().toISOString().split("T")[0];
  }
};

module.exports = {
  isAfter10AM,
  getCurrentSriLankanTime,
  checkLeaveSubmissionAllowed,
  getSriLankanDateString, // ★ New
};
