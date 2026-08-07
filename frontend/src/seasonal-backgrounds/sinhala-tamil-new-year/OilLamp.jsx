import React from 'react';
import './OilLamp.css';

export default function OilLamp() {
  return (
    <div className="oil-lamp-container">
      <svg className="lamp-svg" viewBox="0 0 100 150">
        {/* Lamp Base and Stand */}
        <path d="M20,140 L80,140 Q90,140 85,130 L60,120 L60,50 L40,50 L40,120 L15,130 Q10,140 20,140 Z" fill="#d4af37" />
        <path d="M45,50 L55,50 L55,30 L45,30 Z" fill="#b8860b" />
        
        {/* Oil Tray (Top part) */}
        <ellipse cx="50" cy="30" rx="30" ry="10" fill="#d4af37" />
        <ellipse cx="50" cy="28" rx="25" ry="7" fill="#b8860b" />
        
        {/* Flames */}
        <g className="flames">
          <path d="M25,25 Q20,10 25,5 Q30,15 25,25 Z" fill="#ff9800" className="flame flame-1" />
          <path d="M50,25 Q45,5 50,0 Q55,10 50,25 Z" fill="#ff9800" className="flame flame-2" />
          <path d="M75,25 Q70,10 75,5 Q80,15 75,25 Z" fill="#ff9800" className="flame flame-3" />
        </g>
      </svg>
    </div>
  );
}
