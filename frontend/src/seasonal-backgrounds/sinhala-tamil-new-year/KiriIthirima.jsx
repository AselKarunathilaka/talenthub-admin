import React from 'react';
import './KiriIthirima.css';

export default function KiriIthirima() {
  return (
    <div className="kiri-ithirima-container">
      <svg className="kiri-svg" viewBox="0 0 150 150">
        {/* Fire */}
        <path d="M75,130 Q60,100 70,80 Q85,110 75,130" fill="#ff5722" className="fire fire-1" />
        <path d="M75,130 Q90,90 80,70 Q65,100 75,130" fill="#ff9800" className="fire fire-2" />
        <path d="M75,130 Q80,100 75,90 Q70,110 75,130" fill="#ffc107" className="fire fire-3" />

        {/* Hearth (Lipa - 3 stones) */}
        <path d="M40,140 Q45,120 60,130 Q55,145 40,140" fill="#795548" />
        <path d="M90,140 Q85,120 70,130 Q75,145 90,140" fill="#795548" />
        <path d="M65,145 Q75,135 85,145 Q75,155 65,145" fill="#5d4037" />

        {/* Earthen Pot */}
        <path d="M50,80 C40,110 110,110 100,80 C95,65 100,55 105,50 L45,50 C50,55 55,65 50,80 Z" fill="#a0522d" stroke="#8b4513" strokeWidth="2" />
        <ellipse cx="75" cy="50" rx="30" ry="10" fill="#8b4513" />
        
        {/* Boiling Milk */}
        <ellipse cx="75" cy="50" rx="26" ry="8" fill="#fdf5e6" />
        <path d="M50,55 Q40,70 50,80 Q55,65 55,55 Z" fill="#fdf5e6" className="milk-spill milk-left" />
        <path d="M100,55 Q110,75 100,90 Q95,70 95,55 Z" fill="#fdf5e6" className="milk-spill milk-right" />
        
        {/* Bubbles */}
        <circle cx="65" cy="48" r="3" fill="#fff" className="bubble bubble-1" />
        <circle cx="85" cy="52" r="2" fill="#fff" className="bubble bubble-2" />
        <circle cx="75" cy="45" r="4" fill="#fff" className="bubble bubble-3" />
      </svg>
    </div>
  );
}
