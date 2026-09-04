import React, { useState, useEffect, useRef } from "react";
import { Menu, LogOut, User, ChevronDown } from "lucide-react";

const Navbar = ({ onMenuClick, user, activeTitle, onLogout, customActions }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const userName = user?.name || user?.supervisorName || user?.Trainee_Name || user?.email || "User";
  const userPic = user?.picture || user?.profilePicUrl;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between bg-gradient-to-r from-[#000066] to-[#006600] px-4 shadow-md border-b border-white/10 sm:px-6 lg:px-8">
      {/* Left side: Mobile menu button & Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="inline-flex items-center justify-center rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#00b4eb] lg:hidden transition-colors"
          aria-expanded="false"
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-bold text-white tracking-tight hidden sm:block drop-shadow-sm">
          {activeTitle}
        </h1>
      </div>

      {/* Right side: Custom Actions & Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Render any passed custom actions (like YouTube link, download agreement) */}
        {customActions && (
          <div className="flex items-center gap-1 sm:gap-2">
            {customActions}
          </div>
        )}


        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 sm:gap-3 rounded-full p-1 sm:p-1.5 md:pr-4 bg-white/10 backdrop-blur-md border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:bg-white/20 hover:border-white/30 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#00b4eb] md:min-w-[160px] justify-center md:justify-between pointer-events-none md:pointer-events-auto"
          >
            {userPic ? (
              <img
                src={userPic}
                alt="Profile"
                referrerPolicy="no-referrer"
                className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 rounded-full object-cover border border-slate-200 shadow-sm"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=000066&color=ffffff&bold=true`;
                }}
              />
            ) : (
              <div className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 rounded-full bg-gradient-to-br from-[#000066] to-[#00b4eb] flex items-center justify-center text-white font-bold shadow-sm text-xs sm:text-sm md:text-base">
                {getInitials(userName)}
              </div>
            )}
            
            <div className="hidden md:flex md:flex-col md:items-start text-left flex-1 min-w-[120px] px-1">
              <span className="text-sm font-semibold text-white truncate w-full">
                {userName}
              </span>
              <span className="text-xs text-white/70 truncate w-full">
                {user?.role || user?.designation || "Member"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-white/80 hidden md:block shrink-0" />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="hidden md:block absolute right-0 mt-3 w-full min-w-[160px] md:min-w-full origin-top-right rounded-2xl bg-white shadow-2xl border border-slate-100 ring-1 ring-black/5 focus:outline-none p-1.5 transform transition-all duration-200 z-[100]">
              <div className="px-3 py-2.5 border-b border-slate-100 mb-1.5 md:hidden">
                <p className="text-sm font-bold text-slate-900 truncate">{userName}</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  if (onLogout) onLogout();
                }}
                className="group flex w-full items-center justify-center md:justify-start gap-2.5 rounded-xl px-4 py-2.5 text-sm font-bold text-[#ef4444] bg-red-50/50 hover:bg-[#ef4444] hover:text-white transition-all duration-300"
              >
                <LogOut className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;