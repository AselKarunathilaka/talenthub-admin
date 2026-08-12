// Navigation.jsx - Redesigned & Overhauled
import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  Home,
  QrCode,
  Camera,
  Calendar,
  LogOut,
  User,
  BookOpen,
  Download,
  FileText,
  CalendarCheck,
  Youtube,
  Armchair,
  Bell,
  ScanLine,
  GraduationCap,
  Bike,
  PanelLeftClose,
  PanelLeft,
  PanelLeftOpen,
} from "lucide-react";
import logo from "../assets/talenthubwhitebg.jpeg";
import axios from "axios";
import { API_BASE_URL, API_ENDPOINTS } from "../api/apiConfig";
import leaveFormPdf from "../assets/34453_251111_135120.pdf";
import agreementPdf from "../assets/Trainee_Guidelines_Agreement[34454]_251111_135146.pdf";
import imageCompression from "browser-image-compression";
import { toast } from "react-hot-toast";


// Navigation Component
const Navigation = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("isSidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem("isSidebarCollapsed", JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [internEmail, setInternEmail] = useState("");
  const [internName, setInternName] = useState("");
  const [displayInternId, setDisplayInternId] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  // Profile picture state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [profilePicHash, setProfilePicHash] = useState(Date.now());

  const traineeId = localStorage.getItem("internId");
  const profilePicUrl = traineeId
    ? `${API_BASE_URL}${API_ENDPOINTS.INTERNS.LIST}/${traineeId}/profile-picture?t=${profilePicHash}`
    : "";



  // Fetch trainee profile
  useEffect(() => {
    if (!traineeId) return;
    const fetchTraineeData = async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}${API_ENDPOINTS.INTERNS.LIST}/page/${traineeId}`,
        );
        if (res.data) {
          setInternEmail(res.data.Trainee_Email || res.data.email || "");
          setInternName(res.data.Trainee_Name || res.data.traineeName || "");
          setDisplayInternId(res.data.Trainee_ID || "");
        }
      } catch (error) {
        console.error("Error fetching trainee data:", error);
      }
    };
    fetchTraineeData();
  }, [traineeId]);

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

  const refreshUnreadCount = async () => {
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
      setUnreadCount(data.length);
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    if (!traineeId) return;
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 2 * 60 * 1000);
    
    window.addEventListener('announcementsUpdated', refreshUnreadCount);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('announcementsUpdated', refreshUnreadCount);
    };
  }, [traineeId]);

  useEffect(() => {
    if (location.pathname === "/announcements") {
      setUnreadCount(0);
    }
  }, [location.pathname]);

  // Profile picture upload handler
  const handleProfilePicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploadingPic(true);
      const options = { maxSizeMB: 0.02, maxWidthOrHeight: 150, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      const formData = new FormData();
      formData.append("image", compressedFile);
      const token = getInternToken();
      await axios.post(
        `${API_BASE_URL}${API_ENDPOINTS.INTERNS.LIST}/${traineeId}/profile-picture`,
        formData,
        { headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` } }
      );
      toast.success("Profile picture updated!");
      setProfilePicHash(Date.now());
      setIsProfileModalOpen(false);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload profile picture");
    } finally {
      setUploadingPic(false);
    }
  };

  // Responsive handlers
  useEffect(() => {
    if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      if (window.innerWidth >= 1024) setIsMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const navLinks = [
    { to: "/dashboard", label: "Dashboard", icon: <Home className="h-5 w-5" />, hoverColor: "#48cef7ff" },
    { to: "/attendance", label: "Attendance", icon: <ScanLine className="h-5 w-5" />, hoverColor: "#f9f116ff" },
    { to: "/log-book", label: "Log Book", icon: <BookOpen className="h-5 w-5" />, hoverColor: "#68de5fff" },
    { to: "/leave-requests", label: "Short Leave", icon: <Bike className="h-5 w-5" />, hoverColor: "#a486fcff" },
    { to: "/study-leave-requests", label: "Extended Leave", icon: <GraduationCap className="h-5 w-5" />, hoverColor: "#f19e63ff" },
    { to: "/seat-reservation", label: "Seat Reservation", icon: <Armchair className="h-5 w-5" />, hoverColor: "#ff81c0ff" },
  ];
  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem("internId");
    navigate("/");
  };

  const handleAnnouncementsToggle = () => {
    if (location.pathname === "/announcements") {
      navigate("/dashboard");
    } else {
      navigate("/announcements");
    }
  };

  const handleDownloadLeaveForm = () => {
    const link = document.createElement("a");
    link.href = leaveFormPdf;
    link.download = "Intern_Leave_Form.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAgreement = () => {
    const link = document.createElement("a");
    link.href = agreementPdf;
    link.download = "Trainee_Guidelines_Agreement.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleYouTubeClick = () => {
    window.open(
      "https://youtube.com/@digitalserendib?si=9A0u6vWxGWY5EdnG",
      "_blank",
      "noopener,noreferrer",
    );
  };

  const effectivelyCollapsed = isSidebarCollapsed && isDesktop;

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="lg:hidden fixed top-0 w-full z-50 shadow-2xl bg-gradient-to-r from-[#006600] to-[#000066] select-none">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-2 group">
              <img src={logo} alt="TalentHub Logo" className="h-8 w-auto rounded-md border border-white/10 hover:border-[#00b4eb]/50 transition-all duration-300" />
              <span className="text-xl font-extrabold text-white">TalentHub</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {/* Announcement toggle button (from main) */}
              <button 
                onClick={handleAnnouncementsToggle} 
                className={`relative p-1.5 rounded-full transition-all duration-300 border ${isActive("/announcements") ? "bg-[#f43f5e]/20 border-[#f43f5e]/50 text-[#f43f5e] shadow-[0_0_10px_rgba(244,63,94,0.3)]" : "bg-white/5 border-white/10 text-white/80 hover:text-white hover:bg-white/10"}`}
                aria-label="Toggle Announcements"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow-lg animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {/* Clickable Avatar (our profile picture feature) */}
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="h-8 w-8 rounded-full overflow-hidden border-2 border-white/30 hover:border-[#00b4eb] transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-[#00b4eb]"
              >
                <img
                  src={profilePicUrl}
                  alt="Profile"
                  className="h-full w-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                />
                <div className="hidden h-full w-full bg-gradient-to-br from-[#00b4eb] to-[#0056a2] items-center justify-center text-white font-medium text-sm">
                  {internName ? internName.split(" ").map((n) => n[0]).join("") : "U"}
                </div>
              </button>
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10
                text-white hover:text-[#00b4eb] hover:bg-white/10 transition-all duration-200"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Top Bar Removed per requirements */}

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-30 transition-opacity duration-300 backdrop-blur-sm
          ${isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"} lg:hidden`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-16 lg:top-0 bottom-0 left-0 z-40
          bg-gradient-to-b from-[#006600] to-[#000066] shadow-2xl transition-[width,transform] duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-[width,transform]
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 ${effectivelyCollapsed ? "lg:w-[80px]" : "lg:w-[270px]"} w-[270px] h-[calc(100dvh-64px)] lg:h-[100dvh] select-none flex flex-col`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Sidebar Header with TalentHub + Logo */}
          <div className="hidden lg:flex py-6 border-b border-white/10 items-center transition-all duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
            <div className="flex items-center w-full">
              <div 
                className="relative h-12 w-12 ml-4 flex-shrink-0 flex items-center justify-center cursor-pointer group"
                onClick={() => setIsSidebarCollapsed(false)}
                title={effectivelyCollapsed ? "Expand menu" : ""}
              >
                <img src={logo} alt="TalentHub Logo" className={`absolute h-10 w-10 rounded-md border border-white/10 transition-all duration-300 ease-in-out ${effectivelyCollapsed ? "opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-75" : "hover:border-[#00b4eb]/50"}`} />
                {effectivelyCollapsed && (
                  <PanelLeftOpen className="absolute h-6 w-6 text-white/70 transition-all duration-300 ease-in-out opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 group-hover:text-white" />
                )}
              </div>

              {!effectivelyCollapsed && (
                <div className="flex items-center justify-between flex-1 pr-4 pl-3 overflow-hidden">
                  <Link to="/dashboard" className="flex items-center group">
                    <span className="text-2xl font-extrabold tracking-tight whitespace-nowrap animate-in fade-in duration-300 text-[#ffffff]">
                      TalentHub
                    </span>
                  </Link>
                  <button 
                    onClick={() => setIsSidebarCollapsed(true)}
                    className="hidden lg:flex relative p-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors flex-shrink-0 group/collapse"
                    title="Collapse menu"
                  >
                    <PanelLeft className="h-5 w-5 absolute top-2 left-2 transition-opacity duration-200 opacity-100 group-hover/collapse:opacity-0" />
                    <PanelLeftClose className="h-5 w-5 transition-opacity duration-200 opacity-0 group-hover/collapse:opacity-100" />
                  </button>
                </div>
              )}
            </div>
          </div>


          {/* Navigation Links */}
          <nav className="py-4 lg:py-4 flex-1 flex flex-col justify-start gap-1 lg:gap-2 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                title={effectivelyCollapsed ? link.label : ""}
                className={`flex items-center h-12 ml-4 ${effectivelyCollapsed ? "w-12" : "mr-4"} rounded-xl transition-all duration-200 group focus:outline-none ${isActive(link.to) ? "" : "text-white/70"}`}
                style={{ '--hover-color': link.hoverColor }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center relative">
                  <span className={`transition-colors duration-200 ${isActive(link.to) ? "text-[var(--hover-color)]" : "text-white/60 group-hover:text-[var(--hover-color)]"}`}>
                    {link.icon}
                  </span>
                  {link.badge > 0 && (
                    <span className="absolute top-2 right-2 h-4 w-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow-md animate-pulse">
                      {link.badge > 9 ? "9+" : link.badge}
                    </span>
                  )}
                </div>

                {!effectivelyCollapsed && (
                  <>
                    <span className={`font-medium flex-1 transition-colors duration-200 whitespace-nowrap animate-in fade-in duration-300 pl-2 ${isActive(link.to) ? "text-white" : "group-hover:text-[var(--hover-color)]"}`}>
                      {link.label}
                    </span>
                    {isActive(link.to) && (
                      <span className="ml-auto mr-3 h-2 w-2 rounded-full bg-[var(--hover-color)] shadow-glow animate-in zoom-in duration-300" />
                    )}
                  </>
                )}
              </Link>
            ))}
          </nav>

          {/* Footer Actions */}
          <div className="border-t border-white/10 flex flex-col gap-2 py-4">
            <button 
              onClick={handleAnnouncementsToggle} 
              className={`flex items-center h-12 ml-4 ${effectivelyCollapsed ? "w-12" : "mr-4"} rounded-xl transition-all duration-300 group ${isActive("/announcements") ? "text-[#f43f5e]" : "text-white/70 hover:text-white"}`}
              title={effectivelyCollapsed ? "Announcements" : ""}
            >
              <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center relative">
                <Bell className={`h-5 w-5 group-hover:text-[#f43f5e]`} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 h-4 w-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow-lg animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              {!effectivelyCollapsed && <span className="text-sm font-medium whitespace-nowrap animate-in fade-in pl-2">Announcements</span>}
            </button>

            <button
              onClick={handleYouTubeClick}
              className={`flex items-center h-12 ml-4 ${effectivelyCollapsed ? "w-12" : "mr-4"} text-white/70 rounded-xl hover:text-[#ff3333] transition-all duration-200 group`}
              title={effectivelyCollapsed ? "Digital Serendib" : ""}
            >
              <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
                <Youtube className={`h-5 w-5 group-hover:text-[#ff3333]`} />
              </div>
              {!effectivelyCollapsed && <span className="text-sm font-medium whitespace-nowrap animate-in fade-in pl-2">Digital Serendib</span>}
            </button>

            <button
              onClick={handleDownloadAgreement}
              className={`flex items-center h-12 ml-4 ${effectivelyCollapsed ? "w-12" : "mr-4"} text-white/70 rounded-xl hover:text-[#00b4eb] transition-all duration-200 group`}
              title={effectivelyCollapsed ? "Guidelines Agreement" : ""}
            >
              <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
                <FileText className={`h-5 w-5 group-hover:text-[#00b4eb]`} />
              </div>
              {!effectivelyCollapsed && <span className="text-sm font-medium whitespace-nowrap animate-in fade-in pl-2">Guidelines Agreement</span>}
            </button>

            {/* User Profile + Logout */}
            <div 
              className={`mt-2 h-12 flex items-center transition-all duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] ml-4 rounded-xl border border-white/10 bg-white/5 ${effectivelyCollapsed ? "w-12 justify-center hover:bg-white/10 cursor-pointer group" : "mr-4 pr-2 pl-1 justify-between relative"}`}
              onClick={effectivelyCollapsed ? handleLogout : undefined}
              title={effectivelyCollapsed ? "Logout" : ""}
            >
              {effectivelyCollapsed ? (
                <div className="flex items-center justify-center p-0 text-rose-500 group-hover:text-rose-400 transition-all duration-200 w-full h-full">
                  <LogOut className="h-6 w-6" />
                </div>
              ) : (
                <>
                  {/* Left: Clickable Avatar */}
                  <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className="h-10 w-10 flex-shrink-0 rounded-full overflow-hidden border-2 border-white/20 hover:border-[#00b4eb] transition-all shadow-md focus:outline-none relative z-10"
                    title="Profile"
                  >
                    <img
                      src={profilePicUrl}
                      alt="Profile"
                      className="h-full w-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                    <div className="hidden h-full w-full bg-gradient-to-br from-[#00b4eb] to-[#0056a2] items-center justify-center text-white font-medium">
                      {internName ? internName.split(" ").map((n) => n[0]).join("") : "U"}
                    </div>
                  </button>
                  
                  {/* Center: ID */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden animate-in fade-in duration-300">
                    <span className="text-[15px] font-bold text-white/90 tracking-[0.4em]" title={displayInternId || traineeId}>{displayInternId || "ID"}</span>
                  </div>

                  {/* Right: Logout */}
                  <button
                    onClick={handleLogout}
                    className="p-2 text-rose-500 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 relative z-10"
                    title="Logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Spacers for fixed headers */}
      <div className="lg:hidden h-16" />

      {/* Profile Picture Upload Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-sm w-full p-6 relative overflow-hidden">
            {/* Background accent */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-[#00b4eb]/20 to-indigo-500/20 rounded-t-3xl" />
            
            <div className="relative flex justify-between items-center mb-6">
              <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">Profile Picture</h3>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 bg-white/50 hover:bg-slate-100 rounded-full p-2 transition-colors backdrop-blur-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative flex flex-col items-center justify-center py-2">
              {/* Preview ring */}
              <div className="h-32 w-32 rounded-full overflow-hidden mb-5 border-4 border-white shadow-xl relative group cursor-pointer ring-4 ring-[#00b4eb]/20 bg-slate-50">
                <img
                  src={profilePicUrl}
                  alt="Profile Preview"
                  className="h-full w-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                />
                <div className="hidden h-full w-full bg-gradient-to-br from-[#00b4eb] to-[#0056a2] items-center justify-center">
                  <User className="h-14 w-14 text-white/90" />
                </div>
                {/* Hover overlay */}
                <label className="absolute inset-0 bg-slate-900/60 hidden group-hover:flex flex-col items-center justify-center cursor-pointer text-white transition-all backdrop-blur-sm">
                  <Camera className="h-7 w-7 mb-1 text-white" />
                  <span className="text-xs font-bold tracking-wide">UPDATE</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfilePicUpload} disabled={uploadingPic} />
                </label>
              </div>

              <p className="text-lg font-bold text-slate-800 mb-1">{internName}</p>
              <p className="text-sm text-slate-500 text-center mb-8">Hover the image above or click below to choose a new photo.</p>

              <label
                className={`w-full py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-[15px] transition-all duration-300 ${
                  uploadingPic
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#00b4eb] to-blue-600 hover:to-blue-700 text-white cursor-pointer shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5'
                }`}
              >
                {uploadingPic ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-slate-500"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Camera className="h-5 w-5" />
                    Choose & Upload Photo
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleProfilePicUpload} disabled={uploadingPic} />
              </label>
            </div>
          </div>
        </div>
      )}

      {children}
    </>
  );
};

export default Navigation;