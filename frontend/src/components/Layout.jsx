import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { useLocation } from "react-router-dom";
import { useTour } from "../context/TourContext";

const Layout = ({
  children,
  navLinks = [],
  user = null,
  activeTitle = "Dashboard",
  onLogout,
  customActions = null,
  sidebarMode = "grid",
  hideSidebar = false,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("isSidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });
  const location = useLocation();

  const tour = useTour();
  const shouldSidebarBeOpenForTour = tour?.isTourActive && tour?.currentStep?.element?.includes('data-tour="sidebar-');

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem("isSidebarCollapsed", JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // If the Guided Tour explicitly needs the sidebar for the current step,
  // ensure it is open automatically (this fixes timing issues when navigating between pages).
  useEffect(() => {
    if (shouldSidebarBeOpenForTour && window.innerWidth < 1024) {
      setIsMobileOpen(true);
    }
  }, [shouldSidebarBeOpenForTour]);

  // Close mobile sidebar on route change, UNLESS the guided tour
  // is active and specifically trying to highlight a sidebar link on this new route.
  useEffect(() => {
    if (shouldSidebarBeOpenForTour) {
        // The tour is navigating to this page explicitly to show a sidebar link.
        // DO NOT close the sidebar! It will be frozen open until they click Next.
        return;
    }
    setIsMobileOpen(false);
  }, [location.pathname, shouldSidebarBeOpenForTour]);

  // Allow the guided tour to open/close the mobile sidebar programmatically —
  // sidebar links (TalentTrail, Guidelines, etc.) live inside this drawer,
  // which is translated off-screen (not display:none) until opened, so the
  // tour can't highlight them without this.
  useEffect(() => {
    const openHandler = () => setIsMobileOpen(true);
    const closeHandler = () => setIsMobileOpen(false);
    window.addEventListener("talenthub-tour-open-sidebar", openHandler);
    window.addEventListener("talenthub-tour-close-sidebar", closeHandler);
    return () => {
      window.removeEventListener("talenthub-tour-open-sidebar", openHandler);
      window.removeEventListener("talenthub-tour-close-sidebar", closeHandler);
    };
  }, []);

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
      {!hideSidebar && isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity duration-300 ease-in-out"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Component */}
      {!hideSidebar && (
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
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-300">
        
        {/* Main scrollable container spans full height so scrollbar goes under headers/footers */}
        <main className="absolute inset-0 overflow-y-auto bg-[#f8fafc] scroll-smooth pt-[64px] pb-[40px]">
          <div className="mx-auto w-full max-w-7xl min-h-full flex flex-col p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>

        <div id="layout-modal-root" className="absolute inset-0 z-20 pointer-events-none" />

        <div className="absolute top-0 left-0 right-0 z-30 pointer-events-auto">
          <Navbar
            onMenuClick={() => setIsMobileOpen(true)}
            user={user}
            activeTitle={activeTitle}
            onLogout={onLogout}
            customActions={customActions}
            hideSidebar={hideSidebar}
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
