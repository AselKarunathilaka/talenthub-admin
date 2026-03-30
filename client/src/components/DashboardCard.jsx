import React from 'react';

const DashboardCard = ({ title, count, color, icon }) => {
  return (
    <div className={`p-4 md:p-6 rounded-2xl shadow-lg border border-gray-200 bg-white`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-gray-500 text-xs sm:text-sm font-medium truncate">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">{count}</p>
        </div>
        <div className={`p-3 md:p-4 rounded-full bg-opacity-10 ${color} flex-shrink-0`}>
          <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center">
            {React.cloneElement(icon, { size: 40, className: icon.props.className + ' w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12' })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardCard;
