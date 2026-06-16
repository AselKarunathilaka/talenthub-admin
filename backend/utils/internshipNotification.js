/**
 * Internship End Date Notification Service
 * Calculates and provides notifications for interns when their internship end date is approaching
 */

/**
 * Calculate days until internship ends and determine if notification should be shown
 * @param {Date|string} endDate - The internship end date
 * @returns {Object} - Notification data
 */
const calculateInternshipEndNotification = (endDate) => {
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

/**
 * Get notification styling based on urgency level
 * @param {string} urgency - The urgency level (critical, high, medium, low)
 * @returns {Object} - CSS classes and icon information
 */
const getNotificationStyling = (urgency) => {
  const styles = {
    critical: {
      bgColor: 'bg-red-50 border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-500',
      icon: '🚨',
      buttonColor: 'bg-red-600 hover:bg-red-700'
    },
    high: {
      bgColor: 'bg-orange-50 border-orange-200',
      textColor: 'text-orange-800',
      iconColor: 'text-orange-500',
      icon: '⚠️',
      buttonColor: 'bg-orange-600 hover:bg-orange-700'
    },
    medium: {
      bgColor: 'bg-yellow-50 border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-500',
      icon: '⏰',
      buttonColor: 'bg-yellow-600 hover:bg-yellow-700'
    },
    low: {
      bgColor: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-500',
      icon: '📅',
      buttonColor: 'bg-blue-600 hover:bg-blue-700'
    }
  };
  
  return styles[urgency] || styles.low;
};

module.exports = {
  calculateInternshipEndNotification,
  getNotificationStyling
};