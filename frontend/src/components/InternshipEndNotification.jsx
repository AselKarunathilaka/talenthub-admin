import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertOctagon, AlertTriangle, Clock, Calendar, X } from 'lucide-react';

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
        containerClass: 'bg-gradient-to-br from-red-100 via-red-100/70 to-rose-100 border border-red-200/60 shadow-[0_12px_40px_rgb(220,38,38,0.35)]',
        textColor: 'text-red-950',
        subTextColor: 'text-red-800/80',
        iconColor: 'text-red-600 bg-white shadow-sm ring-1 ring-red-100',
        icon: AlertOctagon,
        buttonClass: 'bg-gradient-to-r from-red-600 to-rose-500 text-white hover:from-red-500 hover:to-rose-400 shadow-md hover:shadow-red-500/25 border-0',
        progressBg: 'bg-red-200/50',
        progressFill: 'bg-gradient-to-r from-red-500 to-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]',
        accentColor: 'text-red-600'
      },
      high: {
        containerClass: 'bg-gradient-to-br from-amber-100 via-orange-100/70 to-yellow-100 border border-orange-200/60 shadow-[0_12px_40px_rgb(249,115,22,0.35)]',
        textColor: 'text-orange-950',
        subTextColor: 'text-orange-800/80',
        iconColor: 'text-orange-600 bg-white shadow-sm ring-1 ring-orange-100',
        icon: AlertTriangle,
        buttonClass: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-400 hover:to-amber-400 shadow-md hover:shadow-orange-500/25 border-0',
        progressBg: 'bg-orange-200/50',
        progressFill: 'bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_0_12px_rgba(249,115,22,0.6)]',
        accentColor: 'text-orange-600'
      },
      medium: {
        containerClass: 'bg-gradient-to-br from-yellow-100 via-amber-100/70 to-yellow-100 border border-yellow-200/60 shadow-[0_12px_40px_rgb(234,179,8,0.35)]',
        textColor: 'text-yellow-950',
        subTextColor: 'text-yellow-800/80',
        iconColor: 'text-yellow-600 bg-white shadow-sm ring-1 ring-yellow-100',
        icon: Clock,
        buttonClass: 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white hover:from-yellow-400 hover:to-amber-400 shadow-md hover:shadow-yellow-500/25 border-0',
        progressBg: 'bg-yellow-200/50',
        progressFill: 'bg-gradient-to-r from-yellow-400 to-amber-500 shadow-[0_0_12px_rgba(234,179,8,0.6)]',
        accentColor: 'text-yellow-600'
      },
      low: {
        containerClass: 'bg-gradient-to-br from-blue-100 via-indigo-100/70 to-blue-100 border border-blue-200/60 shadow-[0_12px_40px_rgb(59,130,246,0.35)]',
        textColor: 'text-blue-950',
        subTextColor: 'text-blue-800/80',
        iconColor: 'text-blue-600 bg-white shadow-sm ring-1 ring-blue-100',
        icon: Calendar,
        buttonClass: 'bg-gradient-to-r from-blue-600 to-indigo-500 text-white hover:from-blue-500 hover:to-indigo-400 shadow-md hover:shadow-blue-500/25 border-0',
        progressBg: 'bg-blue-200/50',
        progressFill: 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]',
        accentColor: 'text-blue-600'
      }
    };
    
    return styles[urgency] || styles.low;
  };

  const styling = getNotificationStyling(notification.urgency);
  const IconComponent = styling.icon;

  const formatEndDate = (date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
        className={`relative overflow-hidden mb-6 sm:mb-8 ${styling.containerClass} backdrop-blur-xl group`}
        style={{
          borderRadius: 'clamp(16px, 4vw, 24px)',
          padding: 'clamp(12px, 4vw, 20px)'
        }}
      >
        {/* Subtle background glow effect */}
        <div className={`absolute top-0 right-0 w-40 h-40 sm:w-64 sm:h-64 bg-white/40 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none`} />

        <div className="flex flex-col md:flex-row md:items-start justify-between relative z-10" style={{ gap: 'clamp(12px, 3vw, 16px)' }}>
          <div className="flex items-start" style={{ gap: 'clamp(10px, 3vw, 16px)' }}>
            <motion.div 
              initial={{ rotate: -10, scale: 0.9 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2, type: "spring" }}
              className={`rounded-xl sm:rounded-2xl flex-shrink-0 ${styling.iconColor} relative`}
              style={{ padding: 'clamp(6px, 2vw, 10px)' }}
            >
              <IconComponent style={{ width: 'clamp(16px, 4vw, 20px)', height: 'clamp(16px, 4vw, 20px)' }} />
              <div className={`absolute inset-0 rounded-xl sm:rounded-2xl ring-2 ring-white/50 pointer-events-none`} />
            </motion.div>
            
            <div className="flex-1 space-y-0.5 sm:space-y-1 pt-0.5">
              <h3 className={`font-extrabold tracking-tight ${styling.textColor} flex items-center gap-1.5 sm:gap-2`} style={{ fontSize: 'clamp(15px, 4.5vw, 20px)', lineHeight: 1.2 }}>
                Internship Ending Soon
              </h3>
              <p className={`font-semibold ${styling.subTextColor} leading-snug max-w-xl`} style={{ fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
                {notification.message}
              </p>
              <div className={`font-bold ${styling.subTextColor} opacity-90 flex items-center gap-1 sm:gap-1.5 pt-1`} style={{ fontSize: 'clamp(10px, 3vw, 12px)' }}>
                <Calendar className="opacity-70" style={{ width: 'clamp(12px, 3.5vw, 14px)', height: 'clamp(12px, 3.5vw, 14px)' }} />
                <span>End date: <span className={styling.textColor}>{formatEndDate(notification.endDate)}</span></span>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            className={`group/btn relative w-full md:w-auto font-bold transition-all duration-300 flex-shrink-0 active:scale-95 ${styling.buttonClass} overflow-hidden`}
            style={{ 
              padding: 'clamp(8px, 2.5vw, 10px) clamp(16px, 4vw, 20px)', 
              borderRadius: 'clamp(8px, 2.5vw, 12px)',
              fontSize: 'clamp(11px, 3.5vw, 12px)',
              marginTop: 'clamp(4px, 2vw, 0px)' 
            }}
          >
            <span className="relative z-10 flex items-center justify-center gap-1 sm:gap-1.5">
              <X className="opacity-70 transition-transform group-hover/btn:rotate-90" style={{ width: 'clamp(12px, 3.5vw, 14px)', height: 'clamp(12px, 3.5vw, 14px)' }} />
              Dismiss
            </span>
          </button>
        </div>

        {/* Progress bar for visual representation */}
        {notification.daysRemaining <= 30 && (
          <div className="relative z-10" style={{ marginTop: 'clamp(12px, 4vw, 20px)' }}>
            <div className="flex justify-between items-end font-black text-gray-500/80 uppercase tracking-widest px-1" style={{ fontSize: 'clamp(9px, 2.5vw, 12px)', marginBottom: 'clamp(6px, 2vw, 12px)' }}>
              <span>Days remaining</span>
              <span className={`${styling.accentColor}`} style={{ fontSize: 'clamp(11px, 3vw, 14px)' }}>{notification.daysRemaining}</span>
            </div>
            <div className={`w-full ${styling.progressBg} rounded-full overflow-visible relative shadow-inner`} style={{ height: 'clamp(6px, 1.5vw, 10px)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, (notification.daysRemaining / 30) * 100)}%` }}
                transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                className={`absolute top-0 left-0 h-full rounded-full ${styling.progressFill}`}
              />
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default InternshipEndNotification;