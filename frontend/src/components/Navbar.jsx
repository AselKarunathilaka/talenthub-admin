import React, { useState, useEffect, useRef } from "react";
import { Menu, LogOut, ChevronDown, Camera } from "lucide-react";
import ProfilePictureModal from "./ProfilePictureModal";
import { API_BASE_URL, API_ENDPOINTS } from "../api/apiConfig";

const Navbar = ({ onMenuClick, user, activeTitle, onLogout, customActions, hideSidebar }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [picHash, setPicHash] = useState(Date.now());
  const [livePicFailed, setLivePicFailed] = useState(false);
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

  const isUserAdmin = () => {
    if (user?.isAdmin !== undefined) return !!user.isAdmin;
    try {
      const adminInfo = localStorage.getItem("adminInfo");
      return !!adminInfo;
    } catch {
      return false;
    }
  };

  const isAdmin = isUserAdmin();

  const getEffectiveAdminId = () => {
    if (user?.adminId) return user.adminId;
    if (user?.id) return user.id;
    if (user?._id) return user._id;
    try {
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "null");
      return adminInfo?.user?.id || adminInfo?.user?._id || null;
    } catch {
      return null;
    }
  };

  const getEffectiveInternId = () => {
    return user?.internId || user?.Trainee_ID || localStorage.getItem("internId") || null;
  };

  // Build a live picture URL that respects picHash for cache-busting
  const buildLivePicUrl = () => {
    if (isAdmin) {
      const adminId = getEffectiveAdminId();
      return adminId ? `${API_BASE_URL}/admin/profile-picture/${adminId}?t=${picHash}` : null;
    }
    const traineeId = getEffectiveInternId();
    if (traineeId) {
      return `${API_BASE_URL}${API_ENDPOINTS.INTERNS.LIST}/${traineeId}/profile-picture?t=${picHash}`;
    }
    return null;
  };

  const livePicUrl = buildLivePicUrl();
  // Display live picture if not failed; otherwise fall back to OAuth / passed picture
  const userPic = (!livePicFailed && livePicUrl) ? livePicUrl : (user?.picture || user?.profilePicUrl);

  const getAuthToken = () => {
    if (isAdmin) {
      try {
        const adminInfo = localStorage.getItem("adminInfo");
        if (adminInfo) {
          const parsed = JSON.parse(adminInfo);
          return parsed.token || parsed.authToken;
        }
      } catch {}
      return localStorage.getItem("authToken") || localStorage.getItem("token") || null;
    }
    const authToken = localStorage.getItem("authToken");
    if (authToken) return authToken;
    const token = localStorage.getItem("token");
    if (token) return token;
    try {
      const userData = localStorage.getItem("userData");
      if (userData) {
        const parsed = JSON.parse(userData);
        return parsed.token || parsed.authToken;
      }
    } catch {}
    return null;
  };

  const getUploadUrl = () => {
    if (isAdmin) {
      const adminId = getEffectiveAdminId();
      return adminId ? `${API_BASE_URL}/admin/profile-picture/${adminId}` : null;
    }
    const traineeId = getEffectiveInternId();
    return traineeId ? `${API_BASE_URL}${API_ENDPOINTS.INTERNS.LIST}/${traineeId}/profile-picture` : null;
  };

  const getFetchUrl = () => {
    if (isAdmin) {
      const adminId = getEffectiveAdminId();
      return adminId ? `${API_BASE_URL}/admin/profile-picture/${adminId}` : null;
    }
    const traineeId = getEffectiveInternId();
    return traineeId ? `${API_BASE_URL}${API_ENDPOINTS.INTERNS.LIST}/${traineeId}/profile-picture` : null;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleProfileClick = () => {
    setDropdownOpen(false);
    setProfileModalOpen(true);
  };

  const handleSuccess = () => {
    setLivePicFailed(false);
    setPicHash(Date.now());
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between bg-gradient-to-r from-[#000066] to-[#006600] px-4 shadow-md border-b border-white/10 sm:px-6 lg:px-8">
        {/* Left side: Mobile menu button & Title */}
        <div className="flex items-center gap-4">
          {!hideSidebar && (
            <button
              onClick={onMenuClick}
              className="inline-flex items-center justify-center rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#00b4eb] lg:hidden transition-colors"
              aria-expanded="false"
            >
              <span className="sr-only">Open sidebar</span>
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
          <h1 className="text-xl font-bold text-white tracking-tight hidden sm:block drop-shadow-sm">
            {activeTitle}
          </h1>
        </div>

        {/* Right side: Custom Actions & Profile */}
        <div className="flex items-center gap-3 sm:gap-4">
          {customActions && (
            <div className="flex items-center gap-1 sm:gap-2">
              {customActions}
            </div>
          )}

          {/* Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 sm:gap-3 rounded-full p-1 sm:p-1.5 pr-3 sm:pr-4 bg-white/10 backdrop-blur-md border border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:bg-white/20 hover:border-white/30 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#00b4eb] min-w-[125px] md:min-w-[160px] justify-between pointer-events-auto"
            >
              {/* Profile picture with camera overlay on hover - clicking opens profile modal */}
              <div
                className="relative group cursor-pointer flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleProfileClick();
                }}
                title="Change profile picture"
              >
                {userPic ? (
                  <img
                    src={userPic}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 rounded-full object-cover border border-slate-200 shadow-sm"
                    onError={(e) => {
                      if (!livePicFailed && livePicUrl) {
                        setLivePicFailed(true);
                      } else {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          userName
                        )}&background=000066&color=ffffff&bold=true`;
                      }
                    }}
                  />
                ) : (
                  <div className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 rounded-full bg-gradient-to-br from-[#000066] to-[#00b4eb] flex items-center justify-center text-white font-bold shadow-sm text-xs sm:text-sm md:text-base">
                    {getInitials(userName)}
                  </div>
                )}
                {/* Camera icon overlay */}
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white" />
                </div>
              </div>

              <div className="flex flex-col items-start text-left flex-1 min-w-[75px] md:min-w-[120px] px-1">
                <span className="text-xs sm:text-sm font-semibold text-white truncate w-full leading-tight">
                  {userName}
                </span>
                <span className="text-[10px] sm:text-xs text-white/70 truncate w-full leading-tight">
                  {user?.role || user?.designation || (isAdmin ? "Admin" : "Intern")}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/80 shrink-0" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-3 w-full min-w-[180px] md:min-w-full origin-top-right rounded-2xl bg-white shadow-2xl border border-slate-100 ring-1 ring-black/5 focus:outline-none p-1.5 transform transition-all duration-200 z-[100]">
                {/* Change Photo */}
                <button
                  onClick={handleProfileClick}
                  className="group flex w-full items-center justify-center md:justify-start gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200 mb-1"
                >
                  <Camera className="h-4 w-4 text-[#00b4eb]" />
                  Change Photo
                </button>

                {/* Divider */}
                <div className="h-px bg-slate-100 mx-2 mb-1" />

                {/* Sign Out */}
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

      {/* Profile Picture Modal */}
      <ProfilePictureModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        uploadUrl={getUploadUrl()}
        fetchUrl={getFetchUrl()}
        authToken={getAuthToken()}
        userName={userName}
        onSuccess={handleSuccess}
        isAdmin={isAdmin}
      />
    </>
  );
};

export default Navbar;