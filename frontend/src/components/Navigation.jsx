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
} from "lucide-react";
import logo from "../assets/talenthubwhitebg.jpeg";
import axios from "axios";
import { API_BASE_URL, API_ENDPOINTS } from "../api/apiConfig";
import leaveFormPdf from "../assets/34453_251111_135120.pdf";
import agreementPdf from "../assets/Trainee_Guidelines_Agreement[34454]_251111_135146.pdf";
import imageCompression from "browser-image-compression";
import { toast } from "react-hot-toast";

// Read-state helpers
const READ_KEY = "readAnnouncementIds";

const getReadIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

// Navigation Component
const Navigation = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNavbarHidden, setIsNavbarHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [internEmail, setInternEmail] = useState("");
  const [internName, setInternName] = useState("");
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
      const readIds = getReadIds();
      const count = data.filter((a) => !readIds.has(a._id)).length;
      setUnreadCount(count);
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    if (!traineeId) return;
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 2 * 60 * 1000);
    return () => clearInterval(interval);
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

  // Responsive & scroll handlers
  useEffect(() => {
    if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerWidth >= 1024) {
        const currentScrollY = window.scrollY;
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          setIsScrollingUp(false);
          setIsNavbarHidden(true);
        } else if (currentScrollY < lastScrollY) {
          setIsScrollingUp(true);
          setIsNavbarHidden(false);
        }
        setLastScrollY(currentScrollY);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

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

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="lg:hidden fixed top-0 w-full z-50 shadow-2xl bg-gradient-to-r from-[#006600] to-[#000066]">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <Link to="/" onClick={() => localStorage.clear()} className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-white">TalentHub</span>
              <img src={logo} alt="SLT Logo" className="h-8 w-auto rounded-md border border-white/10" />
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

      {/* Desktop Top Bar */}
      <header
        className={`hidden lg:flex items-center justify-between bg-gradient-to-r from-[#006600] to-[#000066] shadow-2xl fixed top-0 right-0 z-30 h-[5.5rem] px-8
          transition-all duration-500 ease-out
          ${isNavbarHidden ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"}`}
        style={{ left: "270px", width: "calc(100% - 270px)" }}
      >
        <div className="flex items-center justify-between w-full">
          <h2 className="text-2xl font-bold text-white">
            {isActive("/announcements") ? "Announcements" : (navLinks.find((link) => isActive(link.to))?.label || "Dashboard")}
          </h2>

          <div className="flex items-center space-x-6">
            <button 
              onClick={handleAnnouncementsToggle} 
              className={`relative p-2 rounded-xl backdrop-blur-sm border transition-all duration-300 ${isActive("/announcements") ? "bg-[#f43f5e]/20 border-[#f43f5e]/50 text-[#f43f5e] shadow-[0_0_15px_rgba(244,63,94,0.3)]" : "bg-white/5 border-white/10 text-white hover:text-[#00b4eb] hover:bg-white/10"}`}
              aria-label="Toggle Announcements"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow-lg animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <div className="flex items-center space-x-3 mr-4 bg-white/5 backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/10">
              {/* Clickable Avatar for desktop */}
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="h-9 w-9 rounded-full overflow-hidden border-2 border-white/20 hover:border-[#00b4eb] transition-all cursor-pointer shadow-md focus:outline-none focus:ring-2 focus:ring-[#00b4eb]"
              >
                <img
                  src={profilePicUrl}
                  alt="Profile"
                  className="h-full w-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                />
                <div className="hidden h-full w-full bg-gradient-to-br from-[#00b4eb] to-[#0056a2] items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
              </button>
              <div className="flex flex-col">
                <span className="text-xs text-white/60">Welcome back,</span>
                <span className="text-sm font-semibold text-white">{internName}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-30 transition-opacity duration-300 backdrop-blur-sm
          ${isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"} lg:hidden`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky inset-y-0 left-0 z-40
          bg-gradient-to-b from-[#006600] to-[#000066] shadow-2xl transition-all duration-300 ease-out
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 w-[270px] h-screen lg:top-0`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header with TalentHub + Logo */}
          <div className="px-4 py-6 border-b border-white/10 flex items-center gap-3">
            <Link to="/" onClick={() => localStorage.clear()} className="flex-shrink-0">
              <img src={logo} alt="SLT Logo" className="h-10 w-auto rounded-md border border-white/10 hover:border-[#00b4eb]/50 transition-all duration-300" />
            </Link>
            <span className="text-2xl font-extrabold tracking-tight">
              <span className="text-[#ffffff]">TalentHub</span>
            </span>
          </div>

          {/* Mobile User Profile */}
          <div className="lg:hidden px-4 py-5 border-b border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="flex items-center space-x-3">
              {/* Clickable Avatar for mobile sidebar */}
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="h-10 w-10 rounded-full overflow-hidden border-2 border-white/20 hover:border-[#00b4eb] transition-all shadow-md focus:outline-none"
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
              <div className="flex flex-col">
                <span className="text-xs text-white/60">Welcome,</span>
                <span className="text-sm font-semibold text-white">{internName || "User"}</span>
                {internEmail && (
                  <span className="text-xs text-white/40 truncate max-w-[180px]">{internEmail}</span>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 py-4 lg:py-6 flex-1 flex flex-col justify-evenly gap-2 lg:gap-0 overflow-y-auto">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center px-4 py-3.5 lg:py-6 rounded-xl mx-2 transition-all duration-200 group border focus:outline-none
                  ${isActive(link.to)
                    ? "bg-white/10 shadow-lg backdrop-blur-sm border-white/10"
                    : "border-transparent text-white/70 hover:bg-white/5"
                  }`}
                style={{ '--hover-color': link.hoverColor }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span
                  className={`mr-3 relative transition-colors duration-200 ${isActive(link.to) ? "text-[var(--hover-color)]" : "text-white/60 group-hover:text-[var(--hover-color)]"}`}
                >
                  {link.icon}
                  {link.badge > 0 && (
                    <span className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow-md animate-pulse">
                      {link.badge > 9 ? "9+" : link.badge}
                    </span>
                  )}
                </span>
                <span
                  className={`font-medium flex-1 transition-colors duration-200 ${isActive(link.to) ? "text-white" : "group-hover:text-[var(--hover-color)]"}`}
                >
                  {link.label}
                </span>
                {isActive(link.to) && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-[var(--hover-color)] shadow-glow" />
                )}
              </Link>
            ))}
          </nav>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/10 space-y-2">
            <button
              onClick={handleYouTubeClick}
              className="flex items-center w-full px-4 py-2.5 text-white/70 rounded-xl hover:bg-white/5 hover:text-[#ff3333] transition-all duration-200 group"
            >
              <Youtube className="h-5 w-5 mr-3 group-hover:text-[#ff3333]" />
              <span className="text-sm font-medium">Digital Serendib</span>
            </button>

            <button
              onClick={handleDownloadAgreement}
              className="flex items-center w-full px-4 py-2.5 text-white/70 rounded-xl hover:bg-white/5 hover:text-[#00b4eb] transition-all duration-200 group"
            >
              <FileText className="h-5 w-5 mr-3 group-hover:text-[#00b4eb]" />
              <span className="text-sm font-medium">Guidelines Agreement</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2.5 text-white/70 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group mt-4"
            >
              <LogOut className="h-5 w-5 mr-3 group-hover:text-red-400" />
              <span className="font-medium">Logout</span>
              <span className="ml-auto text-xs text-white/30">v1.0.0</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Spacers for fixed headers */}
      <div className="lg:hidden h-16" />
      <div className="hidden lg:block h-[5.5rem]" />

      {/* Profile Picture Upload Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-b from-[#006600] to-[#000066] border border-white/10 rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-white">Profile Picture</h3>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="text-white/50 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center py-4">
              {/* Preview ring */}
              <div className="h-28 w-28 rounded-full overflow-hidden mb-4 border-4 border-[#00b4eb]/40 shadow-xl relative group cursor-pointer">
                <img
                  src={profilePicUrl}
                  alt="Profile Preview"
                  className="h-full w-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                />
                <div className="hidden h-full w-full bg-gradient-to-br from-[#00b4eb] to-[#0056a2] items-center justify-center">
                  <User className="h-12 w-12 text-white/60" />
                </div>
                {/* Hover overlay */}
                <label className="absolute inset-0 bg-black/60 hidden group-hover:flex flex-col items-center justify-center cursor-pointer text-white">
                  <Camera className="h-6 w-6 mb-1" />
                  <span className="text-xs font-medium">Update</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfilePicUpload} disabled={uploadingPic} />
                </label>
              </div>

              <p className="text-sm font-semibold text-white mb-1">{internName}</p>
              <p className="text-xs text-white/50 text-center mb-5">Hover the image above or click the button below to upload a new photo.</p>

              <label
                className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all ${
                  uploadingPic
                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                    : 'bg-[#00b4eb] hover:bg-[#0096c7] text-white cursor-pointer shadow-lg shadow-[#00b4eb]/20'
                }`}
              >
                {uploadingPic ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
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