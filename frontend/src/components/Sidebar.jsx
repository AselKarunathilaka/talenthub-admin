import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Home, QrCode, Calendar, LogOut } from "lucide-react";

const Sidebar = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change (mobile only)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        // Don't auto-close on large screens
        return;
      }
      setIsSidebarOpen(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar when route changes (mobile only)
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [location]);

  const navLinks = [
    { to: "/dashboard", label: "Dashboard", icon: <Home className="h-5 w-5" /> },
    { to: "/scan-qr", label: "QR Attendance", icon: <QrCode className="h-5 w-5" /> },
    { to: "/availability", label: "Availability", icon: <Calendar className="h-5 w-5" /> }
  ];

  const isActive = (path) => location.pathname === path;

  // Calculate dynamic classes for the sidebar
  const sidebarClasses = `
    fixed inset-y-0 left-0 z-40 w-64 bg-[#00102F] transition-transform duration-300 ease-in-out transform 
    ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
    lg:translate-x-0 lg:static lg:inset-auto lg:h-screen
  `;

  // Overlay for mobile
  const overlayClasses = `
    fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300
    ${isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}
    lg:hidden
  `;

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="fixed top-4 left-4 z-50 lg:hidden">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-md text-white bg-[#00102F] hover:bg-[#001a4d] focus:outline-none focus:ring-2 focus:ring-green-500"
          aria-expanded={isSidebarOpen}
        >
          <span className="sr-only">Open sidebar</span>
          {isSidebarOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Overlay */}
      <div 
        className={overlayClasses}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={sidebarClasses}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="px-4 py-6 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">SLT Dashboard</h2>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center px-4 py-3 rounded-md transition-colors duration-200 ${
                  isActive(link.to)
                    ? "bg-gray-800 text-green-500"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
                aria-current={isActive(link.to) ? "page" : undefined}
              >
                <span className="mr-3">{link.icon}</span>
                <span className="font-medium">{link.label}</span>
              </Link>
            ))}
          </nav>

          {/* Footer Section */}
          <div className="p-4 border-t border-gray-700">
            <button className="flex items-center w-full px-4 py-2 text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors duration-200">
              <LogOut className="h-5 w-5 mr-3" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
