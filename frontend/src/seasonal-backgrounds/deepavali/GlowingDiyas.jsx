import React from 'react';
import './GlowingDiyas.css';

export default function GlowingDiyas() {
  const diyas = [
    { id: 1, left: '20%', scale: 0.8 },
    { id: 2, left: '35%', scale: 1 },
    { id: 3, left: '50%', scale: 1.2 },
    { id: 4, left: '65%', scale: 1 },
    { id: 5, left: '80%', scale: 0.8 },
  ];

  return (
    <div className="glowing-diyas-container">
      {/* Rangoli Pattern on Ground */}
      <div className="rangoli-base">
        <svg viewBox="0 0 400 100" preserveAspectRatio="none">
          <path d="M0,50 Q100,0 200,50 T400,50" fill="none" stroke="rgba(255, 102, 0, 0.4)" strokeWidth="3" />
          <path d="M0,50 Q100,100 200,50 T400,50" fill="none" stroke="rgba(255, 102, 0, 0.4)" strokeWidth="3" />
          <circle cx="100" cy="50" r="20" fill="rgba(255, 204, 0, 0.3)" />
          <circle cx="200" cy="50" r="20" fill="rgba(255, 204, 0, 0.3)" />
          <circle cx="300" cy="50" r="20" fill="rgba(255, 204, 0, 0.3)" />
        </svg>
      </div>

      {diyas.map((diya) => (
        <div 
          key={diya.id} 
          className="diya-wrapper"
          style={{ left: diya.left, transform: `scale(${diya.scale}) translateX(-50%)` }}
        >
          <svg className="diya-svg" viewBox="0 0 60 40">
            {/* Diya Base */}
            <path d="M10,25 C10,40 50,40 50,25 C55,20 30,15 10,25 Z" fill="#8d542d" />
            {/* Oil */}
            <ellipse cx="30" cy="22" rx="15" ry="4" fill="#a05a30" />
            
            {/* Flame */}
            <g className="diya-flame">
              <path d="M30,22 Q25,12 30,5 Q35,12 30,22 Z" fill="#ff9800" className="flame-outer" />
              <path d="M30,22 Q28,15 30,10 Q32,15 30,22 Z" fill="#ffeb3b" className="flame-inner" />
            </g>
          </svg>
        </div>
      ))}
    </div>
  );
}
