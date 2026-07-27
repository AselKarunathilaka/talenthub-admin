import React from 'react';
import './Snowman.css';

export default function Snowman() {
  return (
    <div className="snowman-container">
      <svg className="snowman-svg" viewBox="0 0 200 300">
        {/* Shadow */}
        <ellipse cx="100" cy="275" rx="70" ry="15" fill="rgba(0, 50, 100, 0.2)" />
        
        {/* Body */}
        <circle cx="100" cy="220" r="60" fill="#ffffff" />
        <circle cx="100" cy="130" r="45" fill="#ffffff" />
        <circle cx="100" cy="55" r="35" fill="#ffffff" />
        
        {/* Buttons */}
        <circle cx="100" cy="110" r="4" fill="#333" />
        <circle cx="100" cy="135" r="4" fill="#333" />
        <circle cx="100" cy="160" r="4" fill="#333" />
        <circle cx="100" cy="190" r="4" fill="#333" />
        
        {/* Scarf */}
        <path d="M65,85 Q100,105 135,85 L145,95 Q100,120 55,95 Z" fill="#e63946" />
        <path d="M125,90 L140,150 L120,150 L115,95 Z" fill="#e63946" />
        <line x1="140" y1="150" x2="140" y2="160" stroke="#e63946" strokeWidth="2" />
        <line x1="130" y1="150" x2="130" y2="160" stroke="#e63946" strokeWidth="2" />
        <line x1="120" y1="150" x2="120" y2="160" stroke="#e63946" strokeWidth="2" />
        
        {/* Arms */}
        <path d="M55,130 L10,100" stroke="#5c4033" strokeWidth="4" strokeLinecap="round" />
        <path d="M25,110 L15,120" stroke="#5c4033" strokeWidth="3" strokeLinecap="round" />
        
        <path d="M145,130 L190,100" stroke="#5c4033" strokeWidth="4" strokeLinecap="round" />
        <path d="M175,110 L185,120" stroke="#5c4033" strokeWidth="3" strokeLinecap="round" />
        
        {/* Eyes & Smile */}
        <circle cx="85" cy="45" r="4" fill="#333" />
        <circle cx="115" cy="45" r="4" fill="#333" />
        <path d="M80,65 Q100,80 120,65" stroke="#333" strokeWidth="3" fill="none" strokeLinecap="round" />
        
        {/* Carrot Nose */}
        <path d="M100,55 L135,58 L100,61 Z" fill="#ff9900" />
        
        {/* Hat */}
        <rect x="60" y="15" width="80" height="10" fill="#333" rx="5" />
        <rect x="70" y="-20" width="60" height="35" fill="#333" />
        <rect x="70" y="10" width="60" height="5" fill="#e63946" />
      </svg>
    </div>
  );
}
