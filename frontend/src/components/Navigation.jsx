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

      {/* Mobile Menu Backdrop - heavy blur behind the panel */}
      <div
        className={`fixed top-16 inset-x-0 bottom-0 z-30 transition-all duration-300
          ${isMobileMenuOpen ? "opacity-100 backdrop-blur-xl bg-black/40" : "opacity-0 pointer-events-none"} lg:hidden`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Sidebar / Full-Screen Mobile Menu */}
      <aside
        className={`fixed lg:sticky top-16 lg:top-0 lg:bottom-0 left-0 right-0 lg:right-auto z-40
          bg-gradient-to-b from-[#006600] to-[#000066] shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-[width,transform,opacity]
          ${isMobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none lg:translate-y-0 lg:opacity-100 lg:pointer-events-auto"}
          ${effectivelyCollapsed ? "lg:w-[80px]" : "lg:w-[270px]"} max-h-[calc(100dvh-64px)] lg:max-h-none lg:h-[100dvh] select-none flex flex-col rounded-b-3xl lg:rounded-none`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Sidebar Header with TalentHub + Logo */}
          <div className="hidden lg:flex py-6 border-b border-white/10 items-center transition-all duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
            <div className="flex items-center w-full overflow-hidden">
              <div 
                className="relative h-12 w-12 ml-4 flex-shrink-0 flex items-center justify-center cursor-pointer group"
                onClick={() => setIsSidebarCollapsed(false)}
                title={effectivelyCollapsed ? "Expand menu" : ""}
              >
                <img src={logo} alt="TalentHub Logo" className={`absolute h-10 w-10 rounded-md border border-white/10 transition-all duration-300 ease-in-out ${effectivelyCollapsed ? "opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-75" : "hover:border-[#00b4eb]/50"}`} />
                <PanelLeftOpen className={`absolute h-6 w-6 text-white/70 transition-all duration-300 ease-in-out ${effectivelyCollapsed ? "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 group-hover:text-white" : "opacity-0 scale-75 pointer-events-none"}`} />
              </div>

              <div className={`flex items-center justify-between flex-1 pr-4 pl-3 overflow-hidden transition-all duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${effectivelyCollapsed ? "opacity-0 w-0 pr-0 pl-0" : "opacity-100"}`}>
                <Link to="/dashboard" className="flex items-center group">
                  <span className="text-2xl font-extrabold tracking-tight whitespace-nowrap text-[#ffffff]">
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
            </div>
          </div>


          {/* Navigation Links */}
          <nav className="p-4 lg:p-0 lg:py-4 lg:flex-1 grid grid-cols-2 content-start gap-3 lg:flex lg:flex-col lg:justify-start lg:gap-2 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                title={effectivelyCollapsed ? link.label : ""}
                className={`
                  transition-all duration-300 group focus:outline-none
                  /* Desktop Layout */
                  lg:flex lg:flex-row lg:items-center lg:justify-start lg:h-12 lg:ml-4 lg:overflow-hidden ${effectivelyCollapsed ? "lg:w-12" : "lg:mr-4"} lg:rounded-xl lg:p-0
                  /* Mobile Layout (Glassmorphism Grid) */
                  flex flex-col items-center justify-center p-4 rounded-2xl border
                  ${isActive(link.to) 
                    ? "bg-white/15 border-[var(--hover-color)]/40 shadow-[0_4px_20px_var(--hover-bg)] text-white ring-1 ring-[var(--hover-color)]/20 lg:bg-white/10 lg:border-white/10 lg:shadow-none lg:ring-0" 
                    : "bg-white/5 hover:bg-white/10 hover:border-white/20 border-white/10 text-white/70 lg:text-white/70 lg:bg-transparent lg:border-transparent lg:hover:bg-white/5 lg:hover:border-transparent"}
                `}
                style={{ '--hover-color': link.hoverColor, '--hover-bg': `${link.hoverColor}25` }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div 
                  className={`
                    w-10 h-10 lg:w-12 lg:h-12 flex-shrink-0 flex items-center justify-center relative rounded-[10px] lg:rounded-none mb-2 lg:mb-0 transition-all duration-300
                    ${isActive(link.to) 
                      ? "bg-[var(--hover-bg)] text-[var(--hover-color)] lg:bg-transparent" 
                      : "bg-white/5 lg:bg-transparent text-[var(--hover-color)] lg:text-white/60 lg:group-hover:text-[var(--hover-color)]"}
                  `}
                >
                  {link.icon}
                  {link.badge > 0 && (
                    <span className="absolute -top-1 -right-1 lg:top-2 lg:right-2 h-4 w-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow-md animate-pulse">
                      {link.badge > 9 ? "9+" : link.badge}
                    </span>
                  )}
                </div>

                {/* Text label - always rendered, fades via CSS on desktop */}
                <span className={`font-semibold lg:font-medium text-[11px] lg:text-sm lg:flex-1 whitespace-nowrap lg:pl-2 tracking-tight lg:tracking-normal transition-all duration-150 ${effectivelyCollapsed ? "lg:opacity-0 lg:w-0 lg:overflow-hidden lg:pl-0" : "lg:opacity-100"} ${isActive(link.to) ? "text-white" : "text-white/80 lg:group-hover:text-[var(--hover-color)]"}`}>
                  {link.label}
                </span>
                {/* Active Dot - Desktop Only */}
                <span className={`hidden lg:block mr-3 h-2 w-2 rounded-full bg-[var(--hover-color)] shadow-glow transition-all duration-150 ${isActive(link.to) && !effectivelyCollapsed ? "opacity-100 ml-auto" : "opacity-0 w-0 mr-0"}`} />
              </Link>
            ))}
          </nav>

          {/* Footer Actions */}
          <div className="flex flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:px-0 lg:pb-4 lg:gap-2 lg:border-t lg:border-white/10 lg:mt-auto lg:pt-4">
            {/* Announcements - full width on mobile */}
            <button 
              onClick={() => { handleAnnouncementsToggle(); setIsMobileMenuOpen(false); }} 
              className={`
                transition-all duration-300 group
                /* Desktop */
                lg:flex lg:flex-row lg:items-center lg:justify-start lg:h-12 lg:ml-4 lg:overflow-hidden ${effectivelyCollapsed ? "lg:w-12" : "lg:mr-4"} lg:rounded-xl lg:p-0
                /* Mobile */
                flex flex-col items-center justify-center p-4 rounded-2xl border
                ${isActive("/announcements") 
                  ? "bg-[#f43f5e]/10 border-[#f43f5e]/40 shadow-[0_4px_20px_rgba(244,63,94,0.15)] text-[#f43f5e] ring-1 ring-[#f43f5e]/20 lg:bg-white/10 lg:border-white/10 lg:shadow-none lg:ring-0" 
                  : "bg-white/5 hover:bg-white/10 hover:border-white/20 border-white/10 text-white/70 lg:bg-transparent lg:border-transparent lg:hover:bg-white/5 lg:hover:border-transparent"}
              `}
              title={effectivelyCollapsed ? "Announcements" : ""}
            >
              <div className="w-10 h-10 lg:w-12 lg:h-12 flex-shrink-0 flex items-center justify-center relative rounded-[10px] lg:rounded-none mb-2 lg:mb-0 bg-[#f43f5e]/10 lg:bg-transparent transition-colors">
                <Bell className="h-5 w-5 text-[#f43f5e]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 lg:top-2 lg:right-2 h-4 w-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow-lg animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className={`font-semibold lg:font-medium text-[11px] lg:text-sm whitespace-nowrap lg:pl-2 tracking-tight lg:tracking-normal transition-all duration-150 ${effectivelyCollapsed ? "lg:opacity-0 lg:w-0 lg:overflow-hidden lg:pl-0" : "lg:opacity-100"} ${isActive("/announcements") ? "text-[#f43f5e]" : "text-white/80"}`}>Announcements</span>
            </button>

            {/* Digital Serendib + Guidelines - side by side on mobile */}
            <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-col lg:gap-2">
              <button
                onClick={handleYouTubeClick}
                className={`
                  transition-all duration-300 group
                  /* Desktop */
                  lg:flex lg:flex-row lg:items-center lg:justify-start lg:h-12 lg:ml-4 lg:overflow-hidden ${effectivelyCollapsed ? "lg:w-12" : "lg:mr-4"} lg:rounded-xl lg:p-0
                  /* Mobile */
                  flex flex-col items-center justify-center p-4 rounded-2xl border bg-white/5 hover:bg-white/10 hover:border-white/20 border-white/10 text-white/70 lg:bg-transparent lg:border-transparent lg:hover:bg-white/5 lg:hover:border-transparent
                `}
                title={effectivelyCollapsed ? "Digital Serendib" : ""}
              >
                <div className="w-10 h-10 lg:w-12 lg:h-12 flex-shrink-0 flex items-center justify-center relative rounded-[10px] lg:rounded-none mb-2 lg:mb-0 bg-[#ff3333]/10 lg:bg-transparent transition-colors">
                  <Youtube className="h-5 w-5 text-[#ff3333] lg:text-white/60 lg:group-hover:text-[#ff3333]" />
                </div>
                <span className={`font-semibold lg:font-medium text-[11px] lg:text-sm whitespace-nowrap lg:pl-2 tracking-tight lg:tracking-normal transition-all duration-150 ${effectivelyCollapsed ? "lg:opacity-0 lg:w-0 lg:overflow-hidden lg:pl-0" : "lg:opacity-100"} text-white/80 lg:text-white/70 lg:group-hover:text-white`}>Digital Serendib</span>
              </button>

              <button
                onClick={handleDownloadAgreement}
                className={`
                  transition-all duration-300 group
                  /* Desktop */
                  lg:flex lg:flex-row lg:items-center lg:justify-start lg:h-12 lg:ml-4 lg:overflow-hidden ${effectivelyCollapsed ? "lg:w-12" : "lg:mr-4"} lg:rounded-xl lg:p-0
                  /* Mobile */
                  flex flex-col items-center justify-center p-4 rounded-2xl border bg-white/5 hover:bg-white/10 hover:border-white/20 border-white/10 text-white/70 lg:bg-transparent lg:border-transparent lg:hover:bg-white/5 lg:hover:border-transparent
                `}
                title={effectivelyCollapsed ? "Guidelines Agreement" : ""}
              >
                <div className="w-10 h-10 lg:w-12 lg:h-12 flex-shrink-0 flex items-center justify-center relative rounded-[10px] lg:rounded-none mb-2 lg:mb-0 bg-[#00b4eb]/10 lg:bg-transparent transition-colors">
                  <FileText className="h-5 w-5 text-[#00b4eb] lg:text-white/60 lg:group-hover:text-[#00b4eb]" />
                </div>
                <span className={`font-semibold lg:font-medium text-[11px] lg:text-sm whitespace-nowrap lg:pl-2 tracking-tight lg:tracking-normal transition-all duration-150 ${effectivelyCollapsed ? "lg:opacity-0 lg:w-0 lg:overflow-hidden lg:pl-0" : "lg:opacity-100"} text-white/80 lg:text-white/70 lg:group-hover:text-white`}>Guidelines Agreement</span>
              </button>
            </div>

            {/* User Profile + Logout */}
            <div 
              className={`
                relative h-12 flex items-center transition-all duration-150
                lg:mt-2 lg:ml-4 lg:rounded-xl overflow-hidden
                ${effectivelyCollapsed ? "lg:w-12 lg:justify-center lg:cursor-pointer lg:hover:bg-white/10" : "lg:mr-4 lg:pr-2 lg:pl-1 lg:justify-between"}
                /* Mobile */
                mx-0 px-3 bg-white/5 border border-white/10 rounded-2xl
              `}
              onClick={effectivelyCollapsed ? handleLogout : undefined}
              title={effectivelyCollapsed ? "Logout" : ""}
            >
              {/* Collapsed: Logout icon (desktop only) */}
              <div className={`absolute inset-0 items-center justify-center text-rose-500 hover:text-rose-400 transition-all duration-150 hidden ${effectivelyCollapsed ? "lg:flex" : ""}`}>
                <LogOut className="h-6 w-6" />
              </div>
              
              {/* Expanded: Avatar + ID + Logout */}
              <div className={`flex items-center w-full transition-all duration-150 ${effectivelyCollapsed ? "lg:opacity-0 lg:pointer-events-none" : "lg:opacity-100"}`}>
                {/* Left: Clickable Avatar */}
                <button
                  onClick={(e) => { e.stopPropagation(); setIsProfileModalOpen(true); }}
                  className="h-9 w-9 flex-shrink-0 rounded-full overflow-hidden border-2 border-white/20 hover:border-[#00b4eb] transition-all shadow-md focus:outline-none relative z-10"
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
                <div className="flex-1 flex items-center justify-center pointer-events-none overflow-hidden">
                  <span className="text-[15px] font-bold text-white/90 tracking-[0.4em]" title={displayInternId || traineeId}>{displayInternId || "ID"}</span>
                </div>

                {/* Right: Logout Button */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                  className="relative z-10 p-2 text-rose-500 hover:bg-white/10 hover:text-rose-400 rounded-xl transition-all duration-200 flex-shrink-0"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
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