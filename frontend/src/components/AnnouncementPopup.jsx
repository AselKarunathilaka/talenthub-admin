import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, AlertTriangle, Info } from "lucide-react";
import { API_BASE_URL } from "../api/apiConfig";

const READ_KEY = "readAnnouncementIds";

const getReadIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

const saveReadIds = (set) => {
  localStorage.setItem(READ_KEY, JSON.stringify([...set]));
};

const getInternToken = () => {
  const authToken = localStorage.getItem("authToken");
  if (authToken) return authToken;

  const userData = localStorage.getItem("userData");
  if (userData) {
    try {
      const parsed = JSON.parse(userData);
      if (parsed.token) return parsed.token;
      if (parsed.authToken) return parsed.authToken;
    } catch {
      return userData;
    }
  }
  return null;
};

const PRIORITY_META = {
  urgent: {
    label: "Urgent",
    badgeClass: "bg-rose-100 text-rose-700",
    icon: <AlertTriangle className="h-5 w-5 text-rose-500" />,
  },
  important: {
    label: "Important",
    badgeClass: "bg-amber-100 text-amber-700",
    icon: <Bell className="h-5 w-5 text-amber-500" />,
  },
  normal: {
    label: "Normal",
    badgeClass: "bg-blue-50 text-[#0056a2]",
    icon: <Info className="h-5 w-5 text-[#0056a2]" />,
  },
};

const AnnouncementPopup = () => {
  const [popups, setPopups] = useState([]);
  const [totalPopups, setTotalPopups] = useState(0);

  useEffect(() => {
    const fetchPopups = async () => {
      try {
        const token = getInternToken();
        if (!token) return;

        const res = await fetch(`${API_BASE_URL}/announcements/active`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (!res.ok) return;

        const data = await res.json();
        const readIds = getReadIds();
        
        const unreadPopups = data
          .filter(a => a.showAsPopup && !readIds.has(a._id))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          
        setPopups(unreadPopups);
        setTotalPopups(unreadPopups.length);
      } catch (err) {
        console.error("Error fetching popup announcements:", err);
      }
    };
    
    fetchPopups();
  }, []);

  const handleDismiss = (id) => {
    const readIds = getReadIds();
    readIds.add(id);
    saveReadIds(readIds);
    setPopups((prev) => prev.filter(p => p._id !== id));
  };

  if (popups.length === 0) return null;

  const currentPopup = popups[0];
  const meta = PRIORITY_META[currentPopup.priority] || PRIORITY_META.normal;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
        >
          {/* Header */}
          <div className="bg-slate-50 border-b border-gray-100 p-5 flex items-start justify-between relative">
            <div className="flex items-center gap-3 pr-8">
              <div className="p-2.5 bg-white rounded-2xl shadow-sm border border-gray-100 flex-shrink-0">
                {meta.icon}
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 leading-tight">
                  {currentPopup.title}
                </h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${meta.badgeClass}`}>
                    {meta.label}
                  </span>
                  <span className="text-xs font-bold text-gray-400">
                    {new Date(currentPopup.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => handleDismiss(currentPopup._id)}
              className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            <p className="text-gray-700 whitespace-pre-wrap font-medium leading-relaxed">
              {currentPopup.message}
            </p>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-gray-100 bg-slate-50 flex justify-between items-center gap-3">
            {totalPopups > 1 ? (
              <span className="text-xs font-bold text-gray-400">
                Announcement {totalPopups - popups.length + 1} of {totalPopups}
              </span>
            ) : (
              <span />
            )}
            <button
              onClick={() => handleDismiss(currentPopup._id)}
              className="px-6 py-2.5 bg-[#0056a2] hover:bg-[#00488a] text-white rounded-xl text-sm font-bold shadow-sm shadow-blue-500/20 transition-all"
            >
              {popups.length > 1 ? "Next" : "Dismiss"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AnnouncementPopup;
