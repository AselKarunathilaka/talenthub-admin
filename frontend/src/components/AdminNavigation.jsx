import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  BookOpen,
  ScanLine,
  ScanFace,
  Bike,
  GraduationCap,
  MapPin,
  Armchair,
  QrCode,
  KeyRound,
  UserX,
  Lock,
  Lightbulb,
  SquarePlay,
  FileText,
  LogOut,
} from "lucide-react";
import logo from "../assets/talenthubwhitebg.jpeg";
import AdminNavbar from "./AdminNavbar";
import agreementPdf from "../assets/Trainee_Guidelines_Agreement[34454]_251111_135146.pdf";

const AdminNavigation = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Responsive handlers
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

  const navLinks = [
    { to: "/admin/dashboard", label: "Dashboard", icon: <Home className="h-[18px] w-[18px]" />, hoverColor: "#ffffff" },
    { to: "/admin/daily-records", label: "Daily Logs", icon: <BookOpen className="h-[18px] w-[18px]" />, hoverColor: "#ffffff" },
    { to: "/admin/intern-attendance", label: "Attendance", icon: <ScanLine className="h-[18px] w-[18px]" />, hoverColor: "#ffffff" },
    { to: "/admin/face-attendance", label: "Face ID", icon: <ScanFace className="h-[18px] w-[18px]" />, hoverColor: "#ffffff" },
    { to: "/admin/qr-management", label: "QR", icon: <QrCode className="h-[18px] w-[18px]" />, hoverColor: "#ffffff" },
    { to: "/admin/pin-management", label: "PIN", icon: <KeyRound className="h-[18px] w-[18px]" />, hoverColor: "#ffffff" },
    { to: "/admin/leave-requests", label: "Short Leave", icon: <Bike className="h-[18px] w-[18px]" />, hoverColor: "#ffffff" },
    { to: "/admin/study-leave-requests", label: "Extended Leave", icon: <GraduationCap className="h-[18px] w-[18px]" />, hoverColor: "#ffffff" },
    { to: "/admin/intern-locations", label: "Locations", icon: <MapPin className="h-[18px] w-[18px]" />, hoverColor: "#ffffff" },
    { to: "/admin/seat-management", label: "Seat Layout", icon: <Armchair className="h-[18px] w-[18px]" />, hoverColor: "#ffffff" },
    { to: "/admin/inactive-interns", label: "Terminated", icon: <UserX className="h-[18px] w-[18px]" />, hoverColor: "#ffffff" },
    { to: "/admin/logbook-restrictions", label: "Log Restrictions", icon: <Lock className="h-[18px] w-[18px]" />, hoverColor: "#ffffff" },
  ];

  const isActive = (path) => location.pathname === path;

  const activeLink = navLinks.find(link => isActive(link.to));
  const activeTitle = activeLink ? activeLink.label : (isActive("/admin/announcements") ? "Announcements" : "Dashboard");

  const handleLogout = () => {
    localStorage.removeItem("adminInfo");
    navigate("/admin-login");
  };

  const handleYouTubeClick = () => {
    window.open(
      "https://youtube.com/@digitalserendib?si=9A0u6vWxGWY5EdnG",
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleDownloadAgreement = () => {
    const link = document.createElement("a");
    link.href = agreementPdf;
    link.download = "Trainee_Guidelines_Agreement.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <AdminNavbar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} activeTitle={activeTitle} />

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-[9990] transition-opacity duration-300 backdrop-blur-sm
          ${isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"} lg:hidden`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-[9995]
          bg-gradient-to-b from-[#000066] to-[#006600] shadow-2xl transition-all duration-300 ease-out
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 w-[270px] h-screen lg:top-0`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header with TalentHub + Logo */}
          <div className="px-4 py-6 border-b border-white/10 flex items-center gap-3">
            <Link to="/admin/dashboard" className="flex-shrink-0">
              <img src={logo} alt="TalentHub Logo" className="h-10 w-auto rounded-md border border-white/10 hover:border-[#00b4eb]/50 transition-all duration-300" />
            </Link>
            <span className="text-2xl font-extrabold tracking-tight">
              <span className="text-[#ffffff]">TalentHub</span>
            </span>
          </div>

          {/* Navigation Links - Split into 2 columns on both mobile and desktop */}
          <nav className="px-2 py-2 lg:py-3 flex-1 overflow-y-auto hide-scrollbar flex flex-col justify-evenly">
            <div className="grid grid-cols-2 gap-1.5 h-full content-evenly">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex flex-col items-center justify-center text-center p-2 rounded-xl transition-all duration-200 group border focus:outline-none
                    ${isActive(link.to)
                      ? "bg-white/10 shadow-lg backdrop-blur-sm border-white/10"
                      : "border-transparent text-white/70 hover:bg-white/5"
                    }`}
                  style={{ '--hover-color': link.hoverColor }}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span
                    className={`mb-1 transition-colors duration-200 ${isActive(link.to) ? "text-[var(--hover-color)]" : "text-white/60 group-hover:text-[var(--hover-color)]"}`}
                  >
                    {link.icon}
                  </span>
                  <span
                    className={`font-medium text-[10px] lg:text-xs leading-tight transition-colors duration-200 ${isActive(link.to) ? "text-white" : "group-hover:text-[var(--hover-color)]"}`}
                  >
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          </nav>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/10 space-y-2">
            <button
              onClick={handleYouTubeClick}
              className="flex items-center w-full px-4 py-2.5 text-white/70 rounded-xl hover:bg-white/5 hover:text-[#ff3333] transition-all duration-200 group"
            >
              <SquarePlay className="h-5 w-5 mr-3 group-hover:text-[#ff3333]" />
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
            </button>
          </div>
        </div>
      </aside>

      {/* Spacers for fixed headers */}
      <div className="lg:hidden h-16" />
      <div className="hidden lg:block h-[5.5rem]" />

      <main className="flex-1 lg:ml-[270px] transition-all duration-300">
         <div className="lg:ml-[0px]">
           {children}
         </div>
      </main>
    </>
  );
};

export default AdminNavigation;
