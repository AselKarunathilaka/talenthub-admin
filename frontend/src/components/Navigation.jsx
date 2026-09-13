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
  ExternalLink,
} from "lucide-react";
import logo from "../assets/talenthubwhitebg.jpeg";
import Layout from "./Layout";
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
  const [profileImgError, setProfileImgError] = useState(false);

  // Profile picture state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [profilePicHash, setProfilePicHash] = useState(Date.now());

  const traineeId = localStorage.getItem("internId");
  // Primary URL: backend endpoint (serves uploaded pic or redirects to Google pic)
  const profilePicUrl = traineeId
    ? `${API_BASE_URL}${API_ENDPOINTS.INTERNS.LIST}/${traineeId}/profile-picture?t=${profilePicHash}`
    : "";
  // Guaranteed fallback: ui-avatars with intern's initials
  const avatarFallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(internName || "Intern")}&background=000066&color=ffffff&bold=true`;



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
      setProfileImgError(false); // reset error so new image is loaded
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


  const handleLogout = () => {
    localStorage.removeItem("internId");
    navigate("/");
  };

  const handleAnnouncementsToggle = () => {
    navigate("/announcements");
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

  const handleTalentTrailClick = () => {
    window.open(
      "https://talenttrail.slt.lk/",
      "_blank",
      "noopener,noreferrer",
    );
  };

  const navLinks = [
    { to: "/dashboard", label: "Dashboard", icon: <Home className="h-5 w-5" /> },
    { to: "/attendance", label: "Attendance", icon: <ScanLine className="h-5 w-5" /> },
    { to: "/log-book", label: "Log Book", icon: <BookOpen className="h-5 w-5" /> },
    { to: "/leave-requests", label: "Short Leave", icon: <Bike className="h-5 w-5" /> },
    { to: "/study-leave-requests", label: "Extended Leave", icon: <GraduationCap className="h-5 w-5" /> },
    { to: "/seat-reservation", label: "Seat Reservation", icon: <Armchair className="h-5 w-5" /> },
    { onClick: handleTalentTrailClick, label: "Talent Trail", icon: <ExternalLink className="h-5 w-5" />, isExternal: true },
    { onClick: handleDownloadAgreement, label: "Guidelines", icon: <FileText className="h-5 w-5" />, isExternal: true },
    { onClick: handleYouTubeClick, label: "Digital Serendib", icon: <Youtube className="h-5 w-5" />, isExternal: true },
  ];
  const isActive = (path) => location.pathname === path;

  const effectivelyCollapsed = isSidebarCollapsed && isDesktop;

  const customActions = (
    <button
      onClick={handleAnnouncementsToggle}
      className="relative p-2 text-white bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 rounded-full transition-all duration-300 flex items-center justify-center mr-1 md:mr-2 shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
      title="Announcements"
    >
      <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-[#000066]"></span>
        </span>
      )}
    </button>
  );

  const userData = {
    name: internName,
    email: internEmail,
    role: "Intern",
    Trainee_ID: displayInternId || traineeId,
    profilePicUrl: profileImgError ? avatarFallbackUrl : (profilePicUrl || avatarFallbackUrl),
  };

  return (
    <>
      <Layout
        navLinks={navLinks}
        user={userData}
        onLogout={handleLogout}
        customActions={customActions}
        activeTitle={navLinks.find(link => isActive(link.to))?.label || (isActive("/announcements") ? "Announcements" : "Dashboard")}
        sidebarMode="list"
      >
        {children}
      </Layout>

      {/* Profile Picture Upload Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-sm w-full p-6 relative overflow-hidden">
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
    </>
  );
};

export default Navigation;