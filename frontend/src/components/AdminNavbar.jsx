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
            <Link to="/admin/dashboard" className="flex items-center gap-2 group">
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
    </>
  );
};

export default AdminNavbar;
