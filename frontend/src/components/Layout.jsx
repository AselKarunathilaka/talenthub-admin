import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { useLocation } from "react-router-dom";

const Layout = ({
  children,
  navLinks = [],
  user = null,
  activeTitle = "Dashboard",
  onLogout,
  customActions = null,
  sidebarMode = "grid",
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("isSidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });
  const location = useLocation();

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem("isSidebarCollapsed", JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Handle window resize for mobile sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="flex h-[100dvh] bg-[#f8fafc] overflow-hidden font-sans text-slate-800">
      {/* Mobile Sidebar Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity duration-300 ease-in-out"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Component */}
      <Sidebar
        navLinks={navLinks}
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        onLogout={onLogout}
        user={user}
        mode={sidebarMode}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-300">
        
        {/* Main scrollable container spans full height so scrollbar goes under headers/footers */}
        <main className="absolute inset-0 overflow-y-auto bg-[#f8fafc] scroll-smooth pt-[64px] pb-[40px]">
          <div className="mx-auto w-full max-w-7xl min-h-full flex flex-col p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>

        <div className="absolute top-0 left-0 right-0 z-30 pointer-events-auto">
          <Navbar
            onMenuClick={() => setIsMobileOpen(true)}
            user={user}
            activeTitle={activeTitle}
            onLogout={onLogout}
            customActions={customActions}
          />
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-auto">
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default Layout;
