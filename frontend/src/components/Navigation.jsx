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
  Megaphone,
} from "lucide-react";
import logo from "../assets/talenthubwhitebg.jpeg";
import axios from "axios";
import { API_BASE_URL, API_ENDPOINTS } from "../api/apiConfig";
import leaveFormPdf from "../assets/34453_251111_135120.pdf";
import agreementPdf from "../assets/Trainee_Guidelines_Agreement[34454]_251111_135146.pdf";

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

  const traineeId = localStorage.getItem("internId");

  // Hover colors for each nav item (different light colors per component)
  const navLinks = [
    { to: "/dashboard", label: "Dashboard", icon: <Home className="h-5 w-5" />, hoverColor: "#50b748" },
    { to: "/announcements", label: "Announcements", icon: <Megaphone className="h-5 w-5" />, hoverColor: "#f43f5e", badge: unreadCount },
    { to: "/face-attendance", label: "Face Attendance", icon: <Camera className="h-5 w-5" />, hoverColor: "#f97316" },
    { to: "/scan-qr", label: "QR Attendance", icon: <QrCode className="h-5 w-5" />, hoverColor: "#dfdf66ff" },
    //{ to: "/availability", label: "Availability", icon: <Calendar className="h-5 w-5" />, hoverColor: "#14b8a6" },
    { to: "/log-book", label: "Log Book", icon: <BookOpen className="h-5 w-5" />, hoverColor: "#a78bfa" },
    { to: "/leave-requests", label: "Short Leave", icon: <FileText className="h-5 w-5" />, hoverColor: "#00b4eb" },
    { to: "/seat-reservation", label: "Seat Reservation", icon: <Armchair className="h-5 w-5" />, hoverColor: "#ec4899" },
  ];

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

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem("internId");
    navigate("/");
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

          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <Link to="/announcements" className="relative">
                <Megaphone className="h-5 w-5 text-white/80" />
                <span className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow-lg animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              </Link>
            )}
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#00b4eb] to-[#0056a2] flex items-center justify-center text-white font-medium text-sm shadow-md">
              {internName
                ? internName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                : "U"}
            </div>
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
            {navLinks.find((link) => isActive(link.to))?.label || "Dashboard"}
          </h2>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3 mr-4 bg-white/5 backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/10">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#00b4eb] to-[#0056a2] flex items-center justify-center shadow-md">
                <User className="h-5 w-5 text-white" />
              </div>
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
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#00b4eb] to-[#0056a2] flex items-center justify-center text-white font-medium shadow-md">
                {internName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
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
          <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center px-4 py-3 rounded-xl mx-2 transition-all duration-200 group
                  ${isActive(link.to)
                    ? "bg-white/10 shadow-lg backdrop-blur-sm border border-white/10"
                    : "text-white/70 hover:bg-white/5"
                  }`}
                style={{ '--hover-color': link.hoverColor }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span
                  className={`mr-3 relative transition-colors duration-200 ${isActive(link.to) ? "text-[#00b4eb]" : "text-white/60 group-hover:text-[var(--hover-color)]"}`}
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
                  <span className="ml-auto h-2 w-2 rounded-full bg-[#00b4eb] shadow-glow" />
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

      {children}
    </>
  );
};

export default Navigation;