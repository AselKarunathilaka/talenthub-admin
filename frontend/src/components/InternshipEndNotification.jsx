import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * InternshipEndNotification Component
 * Displays notification when intern's end date is within 30 days
 */
const InternshipEndNotification = ({ notification, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!notification || !notification.shouldNotify || !isVisible) {
    return null;
  }

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

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

  const styling = getNotificationStyling(notification.urgency);

  const formatEndDate = (date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.95 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`rounded-lg border-2 p-4 mb-6 shadow-lg ${styling.bgColor}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className={`text-2xl ${styling.iconColor} flex-shrink-0`}>
              {styling.icon}
            </div>
            <div className="flex-1">
              <div className={`font-semibold text-lg ${styling.textColor} mb-1`}>
                Internship Ending Soon
              </div>
              <div className={`${styling.textColor} mb-2`}>
                {notification.message}
              </div>
              <div className={`text-sm ${styling.textColor} opacity-75`}>
                End date: {formatEndDate(notification.endDate)}
              </div>
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            className={`ml-4 px-3 py-1 rounded-md text-white text-sm font-medium transition-colors duration-200 ${styling.buttonColor} flex-shrink-0`}
          >
            Dismiss
          </button>
        </div>

        {/* Progress bar for visual representation */}
        {notification.daysRemaining <= 30 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Days remaining</span>
              <span>{notification.daysRemaining}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, (notification.daysRemaining / 30) * 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-2 rounded-full transition-colors duration-300 ${
                  notification.daysRemaining <= 3 ? 'bg-red-500' :
                  notification.daysRemaining <= 7 ? 'bg-orange-500' :
                  notification.daysRemaining <= 14 ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`}
              />
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default InternshipEndNotification;