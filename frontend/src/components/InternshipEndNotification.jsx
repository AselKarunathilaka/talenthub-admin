import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertOctagon, AlertTriangle, Clock, Calendar } from 'lucide-react';

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
        containerClass: 'bg-red-50/80 border border-red-100 shadow-sm',
        textColor: 'text-red-900',
        subTextColor: 'text-red-700',
        iconColor: 'text-red-600 bg-red-100/50',
        icon: <AlertOctagon className="w-6 h-6" />,
        buttonClass: 'bg-white text-red-700 hover:bg-red-50 border border-red-200/60 shadow-sm',
        progressBg: 'bg-red-200/50',
        progressFill: 'bg-red-500'
      },
      high: {
        containerClass: 'bg-orange-50/80 border border-orange-100 shadow-sm',
        textColor: 'text-orange-900',
        subTextColor: 'text-orange-700',
        iconColor: 'text-orange-600 bg-orange-100/50',
        icon: <AlertTriangle className="w-6 h-6" />,
        buttonClass: 'bg-white text-orange-700 hover:bg-orange-50 border border-orange-200/60 shadow-sm',
        progressBg: 'bg-orange-200/50',
        progressFill: 'bg-orange-500'
      },
      medium: {
        containerClass: 'bg-yellow-50/80 border border-yellow-100 shadow-sm',
        textColor: 'text-yellow-900',
        subTextColor: 'text-yellow-700',
        iconColor: 'text-yellow-600 bg-yellow-100/50',
        icon: <Clock className="w-6 h-6" />,
        buttonClass: 'bg-white text-yellow-700 hover:bg-yellow-50 border border-yellow-200/60 shadow-sm',
        progressBg: 'bg-yellow-200/50',
        progressFill: 'bg-yellow-500'
      },
      low: {
        containerClass: 'bg-blue-50/80 border border-blue-100 shadow-sm',
        textColor: 'text-blue-900',
        subTextColor: 'text-blue-700',
        iconColor: 'text-blue-600 bg-blue-100/50',
        icon: <Calendar className="w-6 h-6" />,
        buttonClass: 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200/60 shadow-sm',
        progressBg: 'bg-blue-200/50',
        progressFill: 'bg-blue-500'
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
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.98 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={`relative overflow-hidden rounded-2xl p-5 mb-6 ${styling.containerClass} backdrop-blur-sm`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl flex-shrink-0 ${styling.iconColor}`}>
              {styling.icon}
            </div>
            <div className="flex-1 space-y-1">
              <h3 className={`font-semibold text-lg tracking-tight ${styling.textColor}`}>
                Internship Ending Soon
              </h3>
              <p className={`text-sm font-medium ${styling.subTextColor} leading-relaxed`}>
                {notification.message}
              </p>
              <div className={`text-xs font-medium ${styling.subTextColor} opacity-80 flex items-center gap-1.5 pt-1`}>
                <Calendar className="w-3.5 h-3.5" />
                End date: {formatEndDate(notification.endDate)}
              </div>
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex-shrink-0 active:scale-95 ${styling.buttonClass}`}
          >
            Dismiss
          </button>
        </div>

        {/* Progress bar for visual representation */}
        {notification.daysRemaining <= 30 && (
          <div className="mt-6">
            <div className="flex justify-between items-end text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              <span>Days remaining</span>
              <span className={`text-sm ${styling.textColor}`}>{notification.daysRemaining}</span>
            </div>
            <div className={`w-full ${styling.progressBg} rounded-full h-1.5 overflow-hidden`}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, (notification.daysRemaining / 30) * 100)}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                className={`h-full rounded-full ${styling.progressFill}`}
              />
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default InternshipEndNotification;