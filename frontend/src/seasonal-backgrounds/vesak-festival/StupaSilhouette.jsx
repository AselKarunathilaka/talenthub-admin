import React from 'react';
import './StupaSilhouette.css';

export default function StupaSilhouette() {
  return (
    <div className="stupa-silhouette-container">
      <svg className="stupa-svg" viewBox="0 0 800 400" preserveAspectRatio="xMidYMax meet">
        {/* Bodhi Tree */}
        <path d="M150,400 Q130,250 180,150 Q160,180 140,160 Q180,120 220,130 Q190,140 200,180 Q170,250 180,400 Z" fill="#000" />
        <path d="M180,150 Q220,90 260,110 Q230,130 210,120 Q190,140 200,180" fill="#000" />
        <path d="M180,150 Q120,100 80,120 Q110,140 130,130 Q150,150 140,160" fill="#000" />
        <circle cx="160" cy="110" r="40" fill="#000" opacity="0.8"/>
        <circle cx="210" cy="130" r="30" fill="#000" opacity="0.8"/>
        <circle cx="110" cy="130" r="30" fill="#000" opacity="0.8"/>
        <circle cx="180" cy="80" r="35" fill="#000" opacity="0.8"/>
        
        {/* Ground */}
        <path d="M0,400 Q200,380 400,390 Q600,400 800,380 L800,400 L0,400 Z" fill="#000" />
        <path d="M400,390 Q500,370 600,380 Q700,375 800,390 L800,400 L400,400 Z" fill="#050505" />

        {/* Stupa Base */}
        <path d="M500,400 L700,400 L680,360 L520,360 Z" fill="#000" />
        <path d="M510,360 L690,360 L670,320 L530,320 Z" fill="#000" />
        
        {/* Stupa Dome (Garbha) */}
        <path d="M530,320 Q600,200 670,320 Z" fill="#000" />
        
        {/* Square Base (Hatharaskotuwa) */}
        <rect x="585" y="240" width="30" height="20" fill="#000" />
        
        {/* Spire (Koth Kerella) */}
        <polygon points="590,240 610,240 605,150 595,150" fill="#000" />
        
        {/* Crystal (Chudamanikya) */}
        <circle cx="600" cy="145" r="5" fill="#fff" className="stupa-crystal-glow" />
      </svg>
    </div>
  );
}
