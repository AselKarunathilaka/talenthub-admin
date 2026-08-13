import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Megaphone, Shield } from "lucide-react";
import logo from "../assets/talenthubwhitebg.jpeg";

const AdminNavbar = ({ isMobileMenuOpen, setIsMobileMenuOpen, activeTitle, user }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleAnnouncementsToggle = () => {
    if (location.pathname === "/admin/announcements") {
      navigate("/admin/dashboard");
    } else {
      navigate("/admin/announcements");
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="lg:hidden fixed top-0 w-full z-[9999] shadow-2xl bg-gradient-to-r from-[#000066] to-[#006600]">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <Link to="/admin/dashboard" className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-white">TalentHub</span>
              <img src={logo} alt="TalentHub Logo" className="h-8 w-auto rounded-md border border-white/10" />
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={handleAnnouncementsToggle} 
                className={`relative p-1.5 rounded-full transition-all duration-300 border ${isActive("/admin/announcements") ? "bg-[#f43f5e]/20 border-[#f43f5e]/50 text-[#f43f5e] shadow-[0_0_10px_rgba(244,63,94,0.3)]" : "bg-white/5 border-white/10 text-white/80 hover:text-white hover:bg-white/10"}`}
                aria-label="Toggle Announcements"
              >
                <Megaphone className="h-5 w-5" />
              </button>

              {/* Profile Avatar for Mobile */}
              <div className="h-8 w-8 rounded-full overflow-hidden border-2 border-white/30 hover:border-[#00b4eb] transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-[#00b4eb]">
                <div className="flex h-full w-full bg-gradient-to-br from-[#00b4eb] to-[#0056a2] items-center justify-center">
                  <Shield className="h-4 w-4 text-white" />
                </div>
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
        </div>
      </header>

      {/* Desktop Top Bar Removed per requirements */}
    </>
  );
};

export default AdminNavbar;
