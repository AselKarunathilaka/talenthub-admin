import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, LogOut, ChevronDown, Menu } from 'lucide-react';
import logo from "../assets/slt logo.jpg";

const Navbar = ({ onMenuClick }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => 
    location.pathname === path ? 'text-[#4FB846] after:w-full' : 'after:w-0';

  const navLinks = [
    { path: '/', label: 'Dashboard' },
    { path: '/teams', label: 'Team Overview' },
    { path: '/interns-history', label: 'Interns' },
    { path: '/projects', label: 'Projects' },
    { path: '/week-overview', label: 'Week Overview' },
    { path: '/attendancesummary', label: 'Attendance Summary' },
    { path: '/availbleintern', label: 'Interns Availability' },
    { path: '/help', label: 'Instructions' },
];

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  // Close dropdown when clicking outside
  const handleClickOutside = () => {
    if (isDropdownOpen) {
      setIsDropdownOpen(false);
    }
  };

  return (
    <nav className="bg-[#00102F] text-white fixed top-0 right-0 left-0 lg:left-auto w-full py-3 md:py-6 z-40 border-b border-white/5">
      <div className="max-w-full px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Hamburger Menu Button for Mobile */}
          <button
            onClick={onMenuClick}
            className="lg:hidden hamburger-button text-white hover:text-gray-300 transition-colors p-2"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Logo */}
          <div className="flex items-center">
            <img
              src={logo}
              alt="SLT Logo"
              className="h-10 w-24 md:h-12 md:w-32 object-contain transition-all duration-300 transform group-hover:scale-105"
            />
          </div>

          {/* Desktop Navigation - Hidden on mobile and tablet */}
          <div className="hidden xl:flex items-center space-x-4 2xl:space-x-8 flex-1 justify-start ml-8 2xl:ml-32">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-gray-300 hover:text-[#4FB846] transition-all duration-200 py-2 relative text-sm 2xl:text-base
                          after:content-[''] after:absolute after:bottom-0 after:left-0 after:h-0.5 
                          after:bg-[#4FB846] after:transition-all after:duration-300 hover:after:w-full
                          ${isActive(link.path)}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div className="relative p-2 md:p-5">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-3 text-gray-300 transition-all duration-200 group"
            >
              <div className="w-9 h-9 rounded-full bg-[#001845] flex items-center justify-center shadow-lg shadow-[#4FB846]/5 group-hover:shadow-[#4FB846]/20 transition-all duration-300">
                <User className="h-5 w-5" />
              </div>
              <span className="hidden md:block font-medium">User</span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div
                className="absolute right-0 mt-2 p-3 w-48 bg-[#001845] rounded-lg shadow-xl shadow-black/20 py-1 
                         transition-all duration-300 border border-white/5 z-50"
              >
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-3 text-white rounded-xl hover:bg-red-500 hover:text-white transition-all duration-200 group"
                >
                  <LogOut className="h-4 w-4 mr-3 transition-transform duration-200 group-hover:translate-x-1" />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
