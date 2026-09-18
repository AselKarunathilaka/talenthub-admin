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
  Calendar,
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
  Building2,
  BarChart2,
  TrendingUp,
  ShieldAlert,
  Settings,
  Bell,
} from "lucide-react";
import AdminNavbar from "./AdminNavbar";
import agreementPdf from "../assets/Trainee_Guidelines_Agreement[34454]_251111_135146.pdf";
import { getAdminSession, hasAdminPermission } from "../utils/adminAuth";
import Layout from "./Layout";

const AdminNavigation = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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



  const isActive = (path) => location.pathname === path;

  const adminSession = getAdminSession();
  
  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
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
  
  const navLinks = [
    { to: "/admin/dashboard", label: "Dashboard", icon: <Home className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "dashboard.view" },
    { to: "/admin/daily-records", label: "Daily Logs", icon: <BookOpen className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "daily_logs.view" },
    { to: "/admin/intern-attendance", label: "Intern Attendance", icon: <ScanLine className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "attendance.view" },
    { to: "/admin/face-attendance", label: "Face Attendance", icon: <ScanFace className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "attendance.manage" },
    { to: "/admin/qr-management", label: "QR Management", icon: <QrCode className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "attendance.manage" },
    { to: "/admin/pin-management", label: "Pin Management", icon: <KeyRound className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "attendance.manage" },
    { to: "/admin/leave-requests", label: "Short Leave", icon: <Bike className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "leave.view" },
    { to: "/admin/study-leave-requests", label: "Extended Leave", icon: <GraduationCap className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "leave.view" },
    { to: "/admin/intern-locations", label: "Intern Locations", icon: <MapPin className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "interns.view" },
    { to: "/admin/seat-management", label: "Seat Management", icon: <Armchair className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "seats.manage" },
    { to: "/admin/analytics", label: "Analytics", icon: <TrendingUp className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "interns.view" },
    { to: "/admin/universities", label: "Universities", icon: <Building2 className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "interns.manage" },
    { to: "/admin/inactive-interns", label: "Inactive Interns", icon: <UserX className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "interns.manage" },
    { to: "/admin/logbook-restrictions", label: "Logbook Restrictions", icon: <Lock className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "settings.manage" },
    { to: "/admin/talenthub-restrictions", label: "TalentHub Restrictions", icon: <ShieldAlert className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "settings.manage" },
    { to: "/admin/announcements", label: "Notifications", icon: <Bell className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "dashboard.view" },
    { to: "/admin/holidays", label: "Holidays", icon: <Calendar className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "dashboard.view" },
    { to: "/admin/settings", label: "Settings", icon: <Settings className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "settings.manage" },

    { onClick: handleDownloadAgreement, label: "Guidelines", icon: <FileText className="h-[18px] w-[18px]" />, isExternal: true },
    { onClick: handleYouTubeClick, label: "Digital Serendib", icon: <SquarePlay className="h-[18px] w-[18px]" />, isExternal: true },
  ].filter((link) => {
    const user = adminSession?.user;
    const role = user?.role;

    if (link.isExternal || link.label === "Dashboard") return true;
    
    if (role === "super_admin" || role === "PM") return true;
    
    if (role === "admin" || role === "developer") {
      if (link.label === "Settings") return false;
      return true;
    }
    
    if (user?.visiblePages && user.visiblePages.includes(link.label)) return true;
    return false;
  });
  
  const activeLink = navLinks.find(link => isActive(link.to));
  const activeTitle = activeLink ? activeLink.label : (isActive("/admin/announcements") ? "Announcements" : "Dashboard");
  
  const customActions = null;

  const userData = {
    name: adminSession?.user?.name || adminSession?.user?.email,
    email: adminSession?.user?.email,
    role: adminSession?.user?.role ? adminSession.user.role.replace('_', ' ').toUpperCase() : 'ADMIN',
    picture: adminSession?.user?.picture || null,
  };

  return (
    <>
      <Layout
        navLinks={navLinks}
        user={userData}
        onLogout={handleLogout}
        customActions={customActions}
        activeTitle={activeTitle}
      >
        {children}
      </Layout>

      {showLogoutConfirm && (
        <>
          <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setShowLogoutConfirm(false)} />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 pointer-events-auto transform transition-all scale-100 opacity-100">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
                  <LogOut className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Sign Out</h3>
                <p className="text-sm text-slate-500 mb-6">Are you sure you want to sign out of your account?</p>
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-sm rounded-xl transition-colors">Cancel</button>
                  <button onClick={confirmLogout} className="flex-1 px-4 py-2.5 bg-rose-600 text-white hover:bg-rose-700 font-semibold text-sm rounded-xl shadow-md shadow-rose-500/20 transition-all">Sign Out</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default AdminNavigation;
