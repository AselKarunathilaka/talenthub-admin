import React from 'react';
import './StupaSilhouette.css';

export default function StupaSilhouette() {
  return (
    <div className="stupa-silhouette-container">
      <svg className="stupa-svg" viewBox="0 0 800 400" preserveAspectRatio="xMidYMax meet">
        {/* Ground */}
        <path d="M0,400 Q180,380 345,388 Q550,395 800,380 L800,400 L0,400 Z" fill="#000" />
        <path d="M150,390 Q345,375 550,385 Q680,380 800,390 L800,400 L150,400 Z" fill="#050505" />

        {/* Stupa Base (Shifted left to align dead-center in the gap between login cards) */}
        <path d="M245,400 L445,400 L425,360 L265,360 Z" fill="#000" />
        <path d="M255,360 L435,360 L415,320 L275,320 Z" fill="#000" />
        
        {/* Stupa Dome (Garbha) */}
        <path d="M275,320 Q345,200 415,320 Z" fill="#000" />
        
        {/* Square Base (Hatharaskotuwa) */}
        <rect x="330" y="240" width="30" height="20" fill="#000" />
        
        {/* Spire (Koth Kerella) */}
        <polygon points="335,240 355,240 350,150 340,150" fill="#000" />
        
        {/* Crystal (Chudamanikya) */}
        <circle cx="345" cy="145" r="5" fill="#fff" className="stupa-crystal-glow" />
      </svg>
    </div>
  );
}
