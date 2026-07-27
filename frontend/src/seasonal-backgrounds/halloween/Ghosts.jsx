import React from 'react';
import './Ghosts.css';

export default function Ghosts() {
  return (
    <div className="ghosts-container">
      <div className="ghost ghost-1">
        <svg viewBox="0 0 100 120">
          <path d="M50,10 C20,10 10,40 10,70 L10,110 Q20,90 30,110 Q40,90 50,110 Q60,90 70,110 Q80,90 90,110 L90,70 C90,40 80,10 50,10 Z" fill="rgba(255, 255, 255, 0.6)" filter="url(#glow)" />
          <circle cx="35" cy="45" r="5" fill="#000" />
          <circle cx="65" cy="45" r="5" fill="#000" />
          <ellipse cx="50" cy="65" rx="8" ry="12" fill="#000" />
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </svg>
      </div>
      <div className="ghost ghost-2">
        <svg viewBox="0 0 100 120">
          <path d="M50,10 C20,10 10,40 10,70 L10,110 Q20,90 30,110 Q40,90 50,110 Q60,90 70,110 Q80,90 90,110 L90,70 C90,40 80,10 50,10 Z" fill="rgba(255, 255, 255, 0.4)" filter="url(#glow2)" />
          <circle cx="35" cy="50" r="4" fill="#111" />
          <circle cx="65" cy="50" r="4" fill="#111" />
          <circle cx="50" cy="70" r="6" fill="#111" />
          <defs>
            <filter id="glow2">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </svg>
      </div>
    </div>
  );
}
