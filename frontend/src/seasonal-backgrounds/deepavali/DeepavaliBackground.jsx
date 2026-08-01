import React from 'react';
import './DeepavaliBackground.css';

export default function DeepavaliBackground() {
  return (
    <div className="deepavali-background">
      <div className="deepavali-sky"></div>
      
      {/* Kolam / Rangoli pattern on the ground */}
      <div className="deepavali-ground">
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="kolam-pattern">
          <path d="M0,50 Q20,20 40,50 T80,50 T120,50 T160,50 T200,50 T240,50 T280,50 T320,50 T360,50 T400,50" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          <path d="M0,50 Q20,80 40,50 T80,50 T120,50 T160,50 T200,50 T240,50 T280,50 T320,50 T360,50 T400,50" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          <circle cx="20" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="60" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="100" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="140" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="180" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="220" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="260" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="300" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="340" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="380" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
        </svg>
      </div>

      <div className="diya diya-1">
        <svg viewBox="0 0 100 100" className="lamp-svg">
          {/* Base */}
          <path d="M20,70 Q50,90 80,70 Q50,75 20,70 Z" fill="#bcaaa4" />
          <path d="M20,70 Q50,100 80,70 Z" fill="#8d6e63" />
          {/* Flame */}
          <path d="M50,70 Q40,50 50,30 Q60,50 50,70 Z" fill="#ff9800" className="flame flame-1" />
        </svg>
      </div>
      
      <div className="diya diya-2">
        <svg viewBox="0 0 100 100" className="lamp-svg">
          <path d="M20,70 Q50,90 80,70 Q50,75 20,70 Z" fill="#bcaaa4" />
          <path d="M20,70 Q50,100 80,70 Z" fill="#8d6e63" />
          <path d="M50,70 Q40,50 50,30 Q60,50 50,70 Z" fill="#ffeb3b" className="flame flame-2" />
        </svg>
      </div>
    </div>
  );
}
