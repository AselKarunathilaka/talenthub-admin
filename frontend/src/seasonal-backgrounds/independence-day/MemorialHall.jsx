import React from 'react';
import './MemorialHall.css';

export default function MemorialHall() {
  return (
    <div className="memorial-hall-container">
      <svg className="memorial-svg" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax meet">
        {/* Ground */}
        <rect x="0" y="280" width="1000" height="20" fill="#111" />
        
        {/* Steps */}
        <rect x="250" y="270" width="500" height="10" fill="#222" />
        <rect x="280" y="260" width="440" height="10" fill="#333" />
        <rect x="300" y="250" width="400" height="10" fill="#222" />

        {/* Pillars Base */}
        <rect x="320" y="240" width="360" height="10" fill="#111" />

        {/* Pillars */}
        {/* Render multiple pillars */}
        {Array.from({ length: 8 }).map((_, i) => (
          <g key={i} transform={`translate(${330 + i * 45}, 140)`}>
            <rect x="0" y="0" width="15" height="100" fill="#2a2a2a" />
            <rect x="-2" y="0" width="19" height="5" fill="#111" />
            <rect x="-2" y="95" width="19" height="5" fill="#111" />
          </g>
        ))}

        {/* Roof Base */}
        <rect x="310" y="130" width="380" height="10" fill="#222" />
        <rect x="300" y="120" width="400" height="10" fill="#333" />

        {/* Traditional Kandyan Roof */}
        <path d="M280,120 L330,60 L670,60 L720,120 Z" fill="#2a2a2a" />
        <path d="M330,60 L450,20 L550,20 L670,60 Z" fill="#222" />
        
        {/* Roof Details / Ridges */}
        <path d="M330,60 L450,20" stroke="#111" strokeWidth="2" />
        <path d="M670,60 L550,20" stroke="#111" strokeWidth="2" />
        <path d="M280,120 L450,20" stroke="#111" strokeWidth="1" />
        <path d="M720,120 L550,20" stroke="#111" strokeWidth="1" />

        {/* Spire / Pinnacle */}
        <polygon points="495,20 505,20 500,5" fill="#111" />
        <circle cx="500" cy="5" r="3" fill="#ffcc00" className="pinnacle-glow" />

        {/* Lions at entrance (abstracted as silhouettes) */}
        <path d="M250,270 Q240,240 260,250 Q265,260 250,270" fill="#111" />
        <path d="M750,270 Q760,240 740,250 Q735,260 750,270" fill="#111" />
      </svg>
    </div>
  );
}
