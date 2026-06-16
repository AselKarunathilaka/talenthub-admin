import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, AlertTriangle, ArrowRight } from 'lucide-react';

/**
 * NoProjectNotification Component
 * Displays a dismissable popup when an intern has no project assigned.
 * Shown once per login session using sessionStorage.
 */
const NoProjectNotification = ({ onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
          >
            {/* Top gradient accent */}
            <div
              className="h-2"
              style={{
                background: 'linear-gradient(90deg, #f59e0b, #f97316, #ef4444)',
              }}
            />

            {/* Content */}
            <div className="px-6 pt-6 pb-8">
              {/* Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', damping: 15 }}
                className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-5"
                style={{
                  background: 'linear-gradient(135deg, #fef3c7, #fed7aa)',
                }}
              >
                <FolderOpen className="h-8 w-8 text-amber-600" />
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-xl font-bold text-gray-900 text-center mb-2"
              >
                No Project Assigned
              </motion.h2>

              {/* Message */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-gray-600 text-center text-sm leading-relaxed mb-6"
              >
                You are not currently assigned to any project. Please contact your supervisor or team lead to get assigned to a project as soon as possible.
              </motion.p>

              {/* Info card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="rounded-xl p-4 mb-6 flex items-start gap-3"
                style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}
              >
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-amber-800 text-xs leading-relaxed">
                  Being assigned to a project is essential for tracking your progress and contributions during your internship.
                </p>
              </motion.div>

              {/* Action button */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onClick={handleDismiss}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 hover:shadow-lg cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Understood
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NoProjectNotification;