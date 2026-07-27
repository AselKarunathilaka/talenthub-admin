import React from 'react';
import './HauntedHouse.css';

export default function HauntedHouse() {
  return (
    <div className="haunted-house-container">
      {/* SVG for a haunted house silhouette */}
      <svg className="haunted-house-svg" viewBox="0 0 800 400" preserveAspectRatio="xMidYMax meet">
        {/* Ground */}
        <path d="M0,400 L800,400 L800,380 Q700,360 600,380 Q400,410 200,380 Q100,370 0,390 Z" fill="#000" />
        {/* House Base */}
        <rect x="500" y="200" width="160" height="180" fill="#000" />
        <rect x="660" y="250" width="80" height="130" fill="#000" />
        <rect x="420" y="260" width="80" height="120" fill="#000" />
        {/* Roofs */}
        <polygon points="480,200 580,100 680,200" fill="#000" />
        <polygon points="650,250 700,180 750,250" fill="#000" />
        <polygon points="410,260 460,200 510,260" fill="#000" />
        {/* Chimney */}
        <rect x="520" y="120" width="15" height="50" fill="#000" />
        <polygon points="515,120 540,120 540,110 515,110" fill="#000" />
        {/* Windows */}
        <rect x="530" y="230" width="20" height="30" fill="#ffb347" className="window-glow" />
        <rect x="610" y="230" width="20" height="30" fill="#ffb347" className="window-glow" />
        <rect x="530" y="300" width="20" height="30" fill="#ffb347" className="window-glow" />
        <rect x="680" y="280" width="15" height="25" fill="#ffb347" className="window-glow" />
        {/* Door */}
        <path d="M570,380 L570,330 Q580,310 590,330 L590,380 Z" fill="#ffb347" className="window-glow" />
        {/* Dead Trees */}
        <path d="M250,380 Q260,300 270,250 Q280,220 290,200 Q270,230 260,240 M270,250 Q290,220 310,190 M265,300 Q240,280 230,260 M262,340 Q290,320 310,300" stroke="#000" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M150,390 Q155,320 160,280 Q165,260 170,240 Q155,260 145,270 M160,280 Q180,260 190,240 M158,320 Q140,300 130,280" stroke="#000" strokeWidth="6" fill="none" strokeLinecap="round" />
        {/* Fence */}
        <rect x="340" y="360" width="5" height="30" fill="#000" />
        <rect x="360" y="355" width="5" height="35" fill="#000" />
        <rect x="380" y="362" width="5" height="28" fill="#000" />
        <rect x="400" y="358" width="5" height="32" fill="#000" />
        <path d="M335,370 L405,375 M335,385 L405,380" stroke="#000" strokeWidth="3" />
      </svg>
    </div>
  );
}
