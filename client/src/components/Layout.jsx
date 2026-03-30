import React, { useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Layout = ({ children, className = '' }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar isMobileOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileMenuOpen} />
      <div className="flex-1 flex flex-col w-full lg:w-auto">
        <Navbar onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <div className="h-20"></div> {/* Spacing for fixed navbar */}
        <main className={`flex-1 p-4 sm:p-6 md:p-10 overflow-y-auto ${className}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
