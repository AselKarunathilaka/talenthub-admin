// Navbar.jsx - Redesigned
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Home, LogIn, UserPlus } from "lucide-react";
import logo from "../assets/sltlogo.jpg";

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isMobileMenuOpen && !e.target.closest('.mobile-menu-container')) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isMobileMenuOpen]);

  const navLinks = [
    { to: "/", label: "Home", icon: <Home className="h-5 w-5" /> },
    { to: "/login", label: "Login", icon: <LogIn className="h-5 w-5" /> },
    { to: "/register", label: "Register", icon: <UserPlus className="h-5 w-5" /> },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <header className="fixed top-0 w-full z-50 shadow-2xl bg-gradient-to-b from-[#006600] to-[#000066]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo + TalentHub Brand */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <span className="text-2xl font-extrabold tracking-tight">
                <span className="text-[#00b4eb]">Talent</span>
                <span className="text-[#50b748]">Hub</span>
              </span>
              <div className="h-8 w-px bg-white/20 group-hover:bg-white/40 transition" />
              <img
                src={logo}
                alt="SLT Logo"
                className="h-9 w-auto rounded-md border border-white/10 shadow-lg group-hover:border-[#00b4eb]/50 transition-all duration-300"
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200
                  ${isActive(link.to)
                    ? "bg-white/10 text-white shadow-lg backdrop-blur-sm"
                    : "text-white/80 hover:text-white hover:bg-white/5"
                  }`}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }}
              className="mobile-menu-container relative inline-flex items-center justify-center p-2.5 rounded-xl
                bg-white/5 backdrop-blur-sm border border-white/10
                text-white hover:text-[#00b4eb] hover:bg-white/10
                focus:outline-none focus:ring-2 focus:ring-[#00b4eb]/50 transition-all duration-200"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`lg:hidden fixed inset-x-0 top-16 bg-gradient-to-b from-[#006600] to-[#000066] shadow-2xl
          transition-all duration-300 ease-out z-40 border-t border-white/10
          ${isMobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"}`}
      >
        <div className="px-4 py-6 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200
                ${isActive(link.to)
                  ? "bg-white/10 text-white shadow-md"
                  : "text-white/80 hover:text-white hover:bg-white/5"
                }`}
            >
              {link.icon}
              <span>{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
};

export default Navbar;