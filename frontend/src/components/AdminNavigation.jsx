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
  Users,
  Shield,
  LogOut,
} from "lucide-react";
import logo from "../assets/talenthubwhitebg.jpeg";
import AdminNavbar from "./AdminNavbar";
import agreementPdf from "../assets/Trainee_Guidelines_Agreement[34454]_251111_135146.pdf";
import { getAdminSession, hasAdminPermission } from "../utils/adminAuth";

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
    { to: "/admin/dashboard", label: "Dashboard", icon: <Home className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "dashboard.view" },
    { to: "/admin/daily-records", label: "Daily Logs", icon: <BookOpen className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "daily_logs.view" },
    { to: "/admin/intern-attendance", label: "Attendance", icon: <ScanLine className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "attendance.view" },
    { to: "/admin/face-attendance", label: "Face ID", icon: <ScanFace className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "attendance.manage" },
    { to: "/admin/qr-management", label: "QR", icon: <QrCode className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "attendance.manage" },
    { to: "/admin/pin-management", label: "PIN", icon: <KeyRound className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "attendance.manage" },
    { to: "/admin/leave-requests", label: "Short Leave", icon: <Bike className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "leave.view" },
    { to: "/admin/study-leave-requests", label: "Extended Leave", icon: <GraduationCap className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "leave.view" },
    { to: "/admin/intern-locations", label: "Locations", icon: <MapPin className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "interns.view" },
    { to: "/admin/seat-management", label: "Seat Layout", icon: <Armchair className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "seats.manage" },
    { to: "/admin/inactive-interns", label: "Inactive Interns", icon: <UserX className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "interns.manage" },
    { to: "/admin/logbook-restrictions", label: "Log Restrictions", icon: <Lock className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "settings.manage" },
    //{ to: "/admin/users", label: "Users", icon: <Users className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "users.manage" },
  ].filter((link) => !link.permission || hasAdminPermission(link.permission));

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
      <AdminNavbar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} activeTitle={activeTitle} user={getAdminSession()?.user} />

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
          <div className="flex flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:px-4 lg:pb-4 lg:gap-2 lg:border-t lg:border-white/10 lg:mt-auto lg:pt-4">
            
            {/* Digital Serendib + Guidelines - side by side on mobile */}
            <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-col lg:gap-2">
              <button
                onClick={handleYouTubeClick}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border bg-white/5 hover:bg-white/10 hover:border-white/20 border-white/10 text-white/70 lg:flex-row lg:justify-start lg:p-0 lg:h-12 lg:px-4 lg:rounded-xl lg:bg-transparent lg:border-transparent lg:hover:bg-white/5 lg:hover:border-transparent transition-all duration-300 group"
              >
                <div className="w-10 h-10 lg:w-auto lg:h-auto flex-shrink-0 flex items-center justify-center rounded-[10px] lg:rounded-none mb-2 lg:mb-0 bg-[#ff3333]/10 lg:bg-transparent">
                  <SquarePlay className="h-5 w-5 text-[#ff3333] lg:text-white/60 lg:mr-3 lg:group-hover:text-[#ff3333] transition-colors" />
                </div>
                <span className="font-semibold lg:font-medium text-[11px] lg:text-sm whitespace-nowrap text-white/80 lg:text-white/70 lg:group-hover:text-white">Digital Serendib</span>
              </button>

              <button
                onClick={handleDownloadAgreement}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border bg-white/5 hover:bg-white/10 hover:border-white/20 border-white/10 text-white/70 lg:flex-row lg:justify-start lg:p-0 lg:h-12 lg:px-4 lg:rounded-xl lg:bg-transparent lg:border-transparent lg:hover:bg-white/5 lg:hover:border-transparent transition-all duration-300 group"
              >
                <div className="w-10 h-10 lg:w-auto lg:h-auto flex-shrink-0 flex items-center justify-center rounded-[10px] lg:rounded-none mb-2 lg:mb-0 bg-[#00b4eb]/10 lg:bg-transparent">
                  <FileText className="h-5 w-5 text-[#00b4eb] lg:text-white/60 lg:mr-3 lg:group-hover:text-[#00b4eb] transition-colors" />
                </div>
                <span className="font-semibold lg:font-medium text-[11px] lg:text-sm whitespace-nowrap text-white/80 lg:text-white/70 lg:group-hover:text-white">Guidelines Agreement</span>
              </button>
            </div>

            {/* User Profile + Logout */}
            <div 
              className="relative h-16 lg:h-12 flex items-center transition-all duration-150 lg:mt-2 bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
            >
              <div className="flex items-center h-full w-full justify-between pl-1">
                {/* Left: Avatar */}
                <div className="h-11 w-11 lg:h-9 lg:w-9 flex-shrink-0 rounded-full overflow-hidden border-2 border-white/20 hover:border-[#00b4eb] transition-all bg-gradient-to-br from-[#00b4eb] to-[#0056a2] flex items-center justify-center text-white font-medium ml-1 lg:ml-2 shadow-md">
                   <Shield className="h-5 w-5 lg:h-4 lg:w-4 text-white" />
                </div>
                
                {/* Center: Role */}
                <div className="flex-1 flex items-center justify-center pointer-events-none overflow-hidden">
                  <span className="text-[13px] font-bold text-white/90 tracking-[0.3em] ml-2">
                     {getAdminSession()?.user?.role === 'SUPERVISOR' ? 'S U P E R V I S O R' : 'A D M I N'}
                  </span>
                </div>

                {/* Right: Logout Button */}
                <button
                  onClick={handleLogout}
                  className="h-full px-5 lg:px-4 flex items-center justify-center bg-rose-500/20 hover:bg-rose-500/80 border-l border-white/10 transition-all duration-200 flex-shrink-0 group"
                  title="Logout"
                >
                  <LogOut className="h-6 w-6 lg:h-5 lg:w-5 text-rose-200 group-hover:text-white transition-colors" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Spacers for fixed headers */}
      <div className="lg:hidden h-16" />

      <main className="flex-1 lg:ml-[270px] transition-all duration-300">
        <div className="lg:ml-[0px]">
          {children}
        </div>
      </main>
    </>
  );
};

export default AdminNavigation;
