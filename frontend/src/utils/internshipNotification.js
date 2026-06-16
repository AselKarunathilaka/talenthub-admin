/**
 * Frontend utility for internship end date notifications
 * Mirrors backend calculation logic for consistency
 */

/**
 * Calculate days until internship ends and determine if notification should be shown
 * @param {Date|string} endDate - The internship end date
 * @returns {Object} - Notification data
 */
export const calculateInternshipEndNotification = (endDate) => {
  if (!endDate) {
    return {
      shouldNotify: false,
      daysRemaining: null,
      message: null,
      urgency: null
    };
  }

  const now = new Date();
  const end = new Date(endDate);
  
  // Reset time to start of day for accurate day calculation
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  // Calculate difference in milliseconds
  const timeDiff = end.getTime() - now.getTime();
  const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  
  // Only notify if within 30 days (1 month) and internship hasn't ended
  if (daysRemaining <= 30 && daysRemaining >= 0) {
    let urgency = 'low';
    let message = '';
    
    if (daysRemaining === 0) {
      urgency = 'critical';
      message = 'Your internship ends today!';
    } else if (daysRemaining === 1) {
      urgency = 'critical';
      message = 'Your internship ends tomorrow!';
    } else if (daysRemaining <= 3) {
      urgency = 'high';
      message = `Your internship ends in ${daysRemaining} days`;
    } else if (daysRemaining <= 7) {
      urgency = 'medium';
      message = `Your internship ends in ${daysRemaining} days`;
    } else {
      urgency = 'low';
      message = `Your internship ends in ${daysRemaining} days`;
    }
    
    return {
      shouldNotify: true,
      daysRemaining,
      message,
      urgency,
      endDate: end
    };
  }
  
  return {
    shouldNotify: false,
    daysRemaining,
    message: null,
    urgency: null,
    endDate: end
  };
};