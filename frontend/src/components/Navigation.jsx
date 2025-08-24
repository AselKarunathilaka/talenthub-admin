import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Home, QrCode, Calendar, LogOut, User, BookOpen } from "lucide-react";
import logo from "../assets/sltlogo.jpg";
import axios from "axios";
import { API_BASE_URL, API_ENDPOINTS } from "../api/apiConfig";

const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNavbarHidden, setIsNavbarHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [internEmail, setInternEmail] = useState("");
  const [internName, setInternName] = useState("");

  const traineeId = localStorage.getItem("internId");
  
  useEffect(() => {
    if (!traineeId) return;
  
    const fetchTraineeData = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.INTERNS.LIST}/page/${traineeId}`);
        if (res.data) {
          setInternEmail(res.data.email || "");
          setInternName(res.data.traineeName || "");
        }
      } catch (error) {
        console.error("Error fetching trainee data:", error);
      }
    };
  
    fetchTraineeData();
  }, [traineeId]);

  // Close mobile menu when route changes
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsMobileMenuOpen(false);
    }
  }, [location]);

  // Auto-close mobile menu on resize if window becomes large
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle navbar hide/show on scroll with improved logic
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerWidth >= 1024) {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          // Scrolling down
          setIsScrollingUp(false);
          setIsNavbarHidden(true);
        } else if (currentScrollY < lastScrollY) {
          // Scrolling up
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
    {
      to: "/dashboard",
      label: "Dashboard",
      icon: <Home className="h-5 w-5" />,
    },
    {
      to: "/scan-qr",
      label: "QR Attendance",
      icon: <QrCode className="h-5 w-5" />,
    },
    {
      to: "/availability",
      label: "Availability",
      icon: <Calendar className="h-5 w-5" />,
    },
    {
      to: "/log-book",
      label: "Log Book",
      icon: <BookOpen className="h-5 w-5" />,
    },
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem("internId");
    navigate("/");
  };

  return (
    <>
      {/* Top Navbar (Mobile) */}
      <header className="lg:hidden bg-[#00102F] text-white fixed top-0 w-full z-50 shadow-lg">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex-shrink-0">
            <Link to="/"
            onClick={() => {
                    localStorage.clear();
                }}
            className="flex items-center">
              <img 
                src={logo} 
                alt="SLT Logo" 
                className="h-8 w-auto rounded-md border border-blue-300/20" 
              />
            </Link>
          </div>

          {/* Show user initials on mobile top bar */}
          {internName && (
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm">
                {internName.split(' ').map(n => n[0]).join('')}
              </div>
            </div>
          )}

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-md text-white hover:bg-[#001a4d] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#00102F] transition-all"
            aria-expanded={isMobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </header>

      {/* Top Navbar (Desktop) */}
      <header 
        className={`hidden lg:flex items-center justify-between bg-gradient-to-r from-[#00102F] to-[#001a4d] shadow-lg fixed top-0 right-0 z-30 h-[5.5rem] px-8
          transition-all duration-500 ease-out
          ${isNavbarHidden ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"}
          ${isScrollingUp ? "shadow-xl" : ""}`}
        style={{ left: "16rem", width: "calc(100% - 16rem)" }}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-white/90">
              {navLinks.find(link => isActive(link.to))?.label || "Dashboard"}
            </h2>
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3 mr-4">
              <div className="h-9 w-9 rounded-full bg-blue-100/10 flex items-center justify-center transition-all duration-300 group-hover:bg-blue-100/20 border border-blue-200/20">
                <User className="h-5 w-5 text-blue-300" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-blue-100/70">Welcome back,</span>
                <span className="text-sm font-medium text-white">{internName}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-30 transition-opacity duration-300 backdrop-blur-sm
          ${isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}
          lg:hidden`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden={!isMobileMenuOpen}
      />

      {/* Sidebar */}
      <aside 
        className={`fixed lg:sticky inset-y-0 left-0 z-40 
          bg-gradient-to-b from-[#00102F] to-[#00193d] transition-all duration-300 ease-out 
          ${isMobileMenuOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"} 
          lg:translate-x-0
          w-64
          h-screen
          lg:top-0`}
        aria-label="Sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="px-4 py-6 border-b border-gray-700/50 flex justify-between items-center">
            <Link 
              to="/" 
              className="flex items-center group"
              onClick={() => {
                localStorage.clear();
                setIsMobileMenuOpen(false);
              }}
            >
              <img 
                src={logo} 
                alt="SLT Logo" 
                className="ml-4 h-10 w-auto rounded-md border border-blue-300/20 group-hover:border-blue-300/40 transition-all" 
              />
            </Link>
          </div>

          {/* User Profile in Mobile Drawer */}
          <div className="lg:hidden px-4 py-5 border-b border-gray-700/50">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                {internName.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-blue-100/70">Welcome,</span>
                <span className="text-sm font-medium text-white">{internName || "User"}</span>
                {internEmail && (
                  <span className="text-xs text-gray-400/80 truncate max-w-[160px]">{internEmail}</span>
                )}
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center px-4 py-3 rounded-lg mx-2 transition-all duration-200 group
                  ${isActive(link.to)
                    ? "bg-blue-900/30 text-blue-300 border-l-4 border-blue-400"
                    : "text-gray-300 hover:bg-gray-700/30 hover:text-white"
                  }`}
                aria-current={isActive(link.to) ? "page" : undefined}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className={`mr-3 ${isActive(link.to) ? "text-blue-300" : "text-gray-400 group-hover:text-white"}`}>
                  {link.icon}
                </span>
                <span className="font-medium">{link.label}</span>
                {isActive(link.to) && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
                )}
              </Link>
            ))}
          </nav>

          {/* Footer Section */}
          <div className="p-4 border-t border-gray-700/50">
            <button 
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-gray-300 rounded-lg hover:bg-gray-700/40 hover:text-white transition-all duration-200 group cursor-pointer"
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5 text-gray-400 group-hover:text-white" />
              <span className="ml-3">Logout</span>
              <span className="ml-auto text-xs text-gray-500 group-hover:text-gray-400">v1.0.0</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Spacer for mobile header */}
      <div className="lg:hidden h-16"></div>

      {/* Spacer for desktop top navbar */}
      <div className="hidden lg:block h-[5.5rem]"></div>
    </>
  );
};

export default Navigation;
