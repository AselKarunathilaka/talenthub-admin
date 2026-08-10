import React from 'react';
import './ErabaduBranch.css';

export default function ErabaduBranch() {
  return (
    <div className="erabadu-container">
      <svg className="erabadu-svg" viewBox="0 0 400 300" preserveAspectRatio="xMaxYMin meet">
        {/* Branch */}
        <path d="M400,0 Q300,50 200,80 Q100,100 0,150" stroke="#5c4033" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M300,50 Q250,100 220,150" stroke="#5c4033" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M150,90 Q120,50 100,60" stroke="#5c4033" strokeWidth="4" fill="none" strokeLinecap="round" />

        {/* Leaves */}
        <path d="M350,25 Q330,10 320,30 Q340,40 350,25" fill="#2e8b57" />
        <path d="M280,75 Q260,60 250,80 Q270,90 280,75" fill="#2e8b57" />
        <path d="M180,95 Q160,80 150,100 Q170,110 180,95" fill="#2e8b57" />

        {/* Erabadu Flowers (Red) */}
        <g fill="#d81b60">
          <polygon points="220,150 215,170 225,170" />
          <polygon points="220,150 210,165 220,165" />
          <polygon points="220,150 230,165 220,165" />
          
          <polygon points="100,60 95,80 105,80" />
          <polygon points="100,60 90,75 100,75" />
          
          <polygon points="50,135 45,155 55,155" />
        </g>
        
        {/* Koha Bird */}
        <g className="koha-bird" transform="translate(130, 45)">
          {/* Tail */}
          <path d="M20,15 L0,40 L10,40 Z" fill="#111" />
          {/* Body */}
          <ellipse cx="25" cy="20" rx="15" ry="10" fill="#222" transform="rotate(-20 25 20)" />
          {/* Head */}
          <circle cx="40" cy="10" r="8" fill="#111" />
          {/* Eye (Red/Orange) */}
          <circle cx="42" cy="8" r="1.5" fill="#ff4500" />
          {/* Beak (Open) */}
          <path d="M48,8 L55,5 L48,10 Z" fill="#ffcc00" className="beak-top" />
          <path d="M48,10 L55,15 L48,12 Z" fill="#ffcc00" className="beak-bottom" />
        </g>

        {/* Sound Waves */}
        <g className="sound-waves" transform="translate(190, 50)" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M0,-5 Q5,0 0,5" className="wave wave-1" />
          <path d="M5,-10 Q15,0 5,10" className="wave wave-2" />
          <path d="M10,-15 Q25,0 10,15" className="wave wave-3" />
        </g>
      </svg>
    </div>
  );
}
