import React from "react";

const Footer = () => {
  return (
    <footer className="w-full py-2 px-6 bg-gradient-to-r from-[#000066] to-[#006600] border-t border-white/10 mt-auto shrink-0 shadow-inner">
      <div className="flex flex-col md:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
        <p className="text-xs text-white/80 font-medium text-center md:text-left">
          &copy; {new Date().getFullYear()} TalentHub. All rights reserved.
        </p>
        <div className="flex items-center gap-4 text-xs font-bold text-white/90 tracking-wide">
          <span>Version 2.0</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
