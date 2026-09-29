import React, { useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../assets/talenthubwhitebg.jpeg";
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react";

const Sidebar = ({ navLinks = [], isOpen, onClose, onLogout, user, mode = "grid", isCollapsed = false, onToggleCollapse }) => {
  const location = useLocation();
  const navRef = useRef(null);

  useEffect(() => {
    if (navRef.current) {
      const savedScroll = sessionStorage.getItem("sidebarScrollPos");
      if (savedScroll) {
        navRef.current.scrollTop = parseInt(savedScroll, 10);
      }
    }
  }, []);

  const handleScroll = (e) => {
    sessionStorage.setItem("sidebarScrollPos", e.target.scrollTop.toString());
  };

  const isActive = (path) => location.pathname === path;

  // Separate regular links from external/document links
  const regularLinks = navLinks.filter(link => !link.isExternal);
  const externalLinks = navLinks.filter(link => link.isExternal);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-[100] bg-gradient-to-b from-[#000066] to-[#006600] shadow-2xl flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:translate-x-0 lg:static lg:cursor-default
      ${isCollapsed ? "lg:w-[90px] w-[260px]" : "lg:w-[260px] w-[260px]"}
      ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      {/* Header - perfectly matched to Navbar h-16 and color */}
      <div className="flex items-center px-6 h-16 border-b border-white/10 shrink-0 bg-transparent relative z-10">
        <Link to={navLinks[0]?.to || "/"} onClick={onClose} className="flex items-center gap-3 shrink-0 outline-none hover:opacity-90 transition-opacity">
          <img
            src={logo}
            alt="TalentHub Logo"
            className="h-8 w-auto rounded-lg border border-white/10 shadow-md hover:border-[#00b4eb]/50 transition-colors duration-300 flex-shrink-0"
          />
          {!isCollapsed && (
            <span className="text-xl font-extrabold tracking-tight text-white select-none whitespace-nowrap overflow-hidden">
              TalentHub
            </span>
          )}
        </Link>
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex ml-auto text-white/50 hover:text-white transition-colors"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav
        ref={navRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        <div className={isCollapsed ? "flex flex-col gap-1.5" : (mode === "grid" ? "grid grid-cols-3 gap-2" : "flex flex-col gap-1.5")}>
          {regularLinks.map((link, index) => {
            const active = isActive(link.to);

            const linkColor = link.color || "#00b4eb";
            const content = (!isCollapsed && mode === "grid") ? (
              <>
                <div
                  className="mb-1 flex items-center justify-center p-2 transition-transform duration-300 group-hover:scale-110"
                  style={{ color: active ? linkColor : undefined }}
                >
                  {link.icon}
                </div>
                <span className="text-[9px] font-semibold text-center leading-[1.1] tracking-wide px-0.5">
                  {link.label}
                </span>
              </>
            ) : (
              <>
                <div
                  className="flex items-center justify-center p-2 transition-transform duration-300 shrink-0 group-hover:scale-110 text-white/70 group-hover:text-white"
                  style={{ color: active ? linkColor : undefined }}
                >
                  {link.icon}
                </div>
                {!isCollapsed && (
                  <span className={`text-sm font-bold leading-[1.1] tracking-wide px-3 truncate w-full text-left transition-colors duration-300 ${active ? "text-white" : "text-white/70 group-hover:text-white"}`}>
                    {link.label}
                  </span>
                )}
                {/* Active Indicator - accent bar on the right */}
                {active && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-full pointer-events-none" style={{ backgroundColor: linkColor }} />
                )}
              </>
            );

            const className = (!isCollapsed && mode === "grid")
              ? `group flex flex-col items-center justify-center p-1.5 h-20 rounded-xl transition-all duration-300 relative overflow-hidden bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:bg-white/15 hover:border-white/20
              ${active
                ? "text-white shadow-[0_4px_20px_rgba(255,255,255,0.15)] bg-white/15 border-white/30"
                : "text-white/70 hover:text-white"
              }`
              : `group flex items-center ${isCollapsed ? "justify-center w-full h-14" : "justify-start w-full"} p-2 rounded-xl transition-all duration-300 relative overflow-hidden outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00b4eb]/50
              ${active
                ? "bg-white/10 backdrop-blur-md"
                : "bg-transparent hover:bg-white/5"
              }`;

            if (link.onClick) {
              return (
                <button
                  key={index}
                  onClick={(e) => {
                    link.onClick(e);
                    if (onClose) onClose();
                  }}
                  className={className}
                  title={link.label}
                  data-tour={link.tourId}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={link.to || index}
                to={link.to || "#"}
                onClick={onClose}
                className={className}
                title={link.label}
                data-tour={link.tourId}
              >
                {content}
              </Link>
            );
          })}

          {/* Separator for external documents / Serendib */}
          {externalLinks.length > 0 && (
            <div className="w-full">
              <hr className="border-white/10 my-1 mx-2" />
              <div className={isCollapsed ? "flex flex-col gap-1.5" : (mode === "grid" ? "grid grid-cols-2 gap-2" : "flex flex-col gap-1.5")}>
                {externalLinks.map((link, index) => {
                  const content = (!isCollapsed && mode === "grid") ? (
                    <>
                      <div
                        className="mb-1 flex items-center justify-center p-2 rounded-full bg-white/5 text-white/70 group-hover:scale-110 group-hover:bg-white/10 group-hover:text-white transition-transform duration-300"
                      >
                        {link.icon}
                      </div>
                      <span className="text-[9px] font-semibold text-center leading-[1.1] tracking-wide px-0.5 text-white/70 group-hover:text-white">
                        {link.label}
                      </span>
                    </>
                  ) : (
                    <>
                      <div
                        className="flex items-center justify-center p-2 rounded-full bg-white/5 text-white/70 group-hover:scale-110 group-hover:bg-white/10 group-hover:text-white transition-transform duration-300 shrink-0"
                      >
                        {link.icon}
                      </div>
                      {!isCollapsed && (
                        <span className="text-xs font-bold leading-[1.1] tracking-wide px-3 truncate w-full text-left text-white/70 group-hover:text-white transition-colors duration-300">
                          {link.label}
                        </span>
                      )}
                    </>
                  );

                  const className = (!isCollapsed && mode === "grid")
                    ? `group flex flex-col items-center justify-center p-1.5 h-20 rounded-xl transition-all duration-300 relative overflow-hidden bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:bg-white/15 hover:border-white/20 text-white/70 hover:text-white`
                    : `group flex items-center ${isCollapsed ? "justify-center w-full h-14" : "justify-start w-full"} p-2 rounded-xl transition-all duration-300 relative overflow-hidden bg-transparent border border-transparent hover:bg-white/15 hover:border-white/20 text-white/70 hover:text-white`;

                  return (
                    <button
                      key={`ext-${index}`}
                      data-tour={link.tourId}
                      onClick={(e) => {
                        if (link.onClick) link.onClick(e);
                        if (onClose) onClose();
                      }}
                      className={className}
                      title={link.label}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Bottom Actions Section */}
      <div className="px-3 pb-3 mt-auto flex flex-col shrink-0">


        {/* Sign Out Button */}
        {onLogout && (
          <div className="w-full">
            <hr className={`border-white/10 mx-2 ${location.pathname.startsWith('/admin') ? 'mb-6' : 'mb-3'}`} />
            <button
              data-tour="sidebar-signout"
              onClick={() => {
                if (onClose) onClose();
                onLogout();
              }}
              className={`group flex items-center w-full rounded-xl transition-all duration-300 relative overflow-hidden bg-rose-500/10 border border-rose-400/25 hover:bg-rose-600 hover:border-rose-500 text-rose-100/80 hover:text-white ${isCollapsed ? "justify-center p-2 h-14" : "justify-between p-3"}`}
              title={isCollapsed ? "Sign Out" : undefined}
              aria-label="Sign Out"
            >
              {!isCollapsed && (
                <div className="flex flex-col items-start text-left truncate max-w-[75%]">
                  <span className="text-xs font-bold truncate w-full text-left group-hover:text-white transition-colors">
                    Sign Out
                  </span>
                  {user?.email && (
                    <span className="text-[10px] text-rose-100/50 truncate w-full text-left group-hover:text-white/80 transition-colors mt-0.5">
                      {user.email}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-center p-2 rounded-full bg-rose-400/10 text-rose-200 group-hover:bg-white/15 group-hover:text-white transition-colors duration-300 shrink-0">
                <LogOut className="h-4 w-4" />
              </div>
            </button>
          </div>
        )}

      </div>

      {/* Bottom section - perfectly matched to Footer left color */}
      <div className="border-t border-white/10 shrink-0 mt-auto bg-transparent px-6 py-2 flex items-center justify-center shadow-[0_-4px_10px_rgba(0,0,0,0.1)] relative z-10">
        <div className="text-[10px] text-center text-white/60 w-full font-medium">
          Powered by <span className="font-semibold text-white/90 drop-shadow-sm">Sri Lanka Telecom</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
