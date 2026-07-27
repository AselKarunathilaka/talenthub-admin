import React from 'react';
import './Pumpkins.css';

export default function Pumpkins() {
  return (
    <div className="pumpkins-container">
      <div className="pumpkin pumpkin-left">
        <svg viewBox="0 0 100 100">
          <path d="M50,95 Q10,95 10,60 Q10,20 40,20 Q50,15 60,20 Q90,20 90,60 Q90,95 50,95" fill="#d95319" stroke="#b03a00" strokeWidth="2" />
          {/* Stem */}
          <path d="M45,20 Q50,0 60,5 Q55,10 55,20 Z" fill="#2e8b57" />
          {/* Eyes & Mouth */}
          <polygon points="30,45 40,45 35,35" fill="#ffe066" className="pumpkin-glow" />
          <polygon points="60,45 70,45 65,35" fill="#ffe066" className="pumpkin-glow" />
          <path d="M30,65 L40,75 L50,65 L60,75 L70,65 L60,85 L40,85 Z" fill="#ffe066" className="pumpkin-glow" />
        </svg>
      </div>
      <div className="pumpkin pumpkin-right">
        <svg viewBox="0 0 100 100">
          <path d="M50,90 Q15,95 15,55 Q15,15 45,15 Q50,10 55,15 Q85,15 85,55 Q85,95 50,90" fill="#e65c00" stroke="#b03a00" strokeWidth="2" />
          <path d="M48,15 Q50,-5 40,0 Q45,10 52,15 Z" fill="#2e8b57" />
          <polygon points="35,40 45,35 40,50" fill="#ffcc00" className="pumpkin-glow" />
          <polygon points="65,40 55,35 60,50" fill="#ffcc00" className="pumpkin-glow" />
          <path d="M35,65 Q50,85 65,65 Q50,75 35,65 Z" fill="#ffcc00" className="pumpkin-glow" />
        </svg>
      </div>
    </div>
  );
}
