import React from 'react';
import './FestiveSweets.css';

export default function FestiveSweets() {
  return (
    <div className="festive-sweets-container">
      <svg className="sweets-svg" viewBox="0 0 200 100">
        {/* Banana Leaf Base */}
        <path d="M10,50 Q100,0 190,50 Q100,100 10,50 Z" fill="#4caf50" stroke="#388e3c" strokeWidth="2" />
        <path d="M10,50 Q100,50 190,50" stroke="#388e3c" strokeWidth="2" fill="none" />
        
        {/* Betel Leaves */}
        <path d="M30,40 Q50,20 60,40 Q40,60 30,40 Z" fill="#2e7d32" stroke="#1b5e20" transform="rotate(-20 45 40)" />
        <path d="M40,55 Q60,35 70,55 Q50,75 40,55 Z" fill="#2e7d32" stroke="#1b5e20" transform="rotate(10 55 55)" />

        {/* Kokis (Wheel Shape) */}
        <g transform="translate(130, 45) scale(0.6)">
          <circle cx="0" cy="0" r="20" fill="none" stroke="#fbc02d" strokeWidth="5" />
          <path d="M0,-20 L0,20 M-20,0 L20,0 M-14,-14 L14,14 M-14,14 L14,-14" stroke="#fbc02d" strokeWidth="4" />
          <circle cx="0" cy="0" r="5" fill="#f9a825" />
        </g>
        <g transform="translate(150, 60) scale(0.5)">
          <circle cx="0" cy="0" r="20" fill="none" stroke="#fbc02d" strokeWidth="5" />
          <path d="M0,-20 L0,20 M-20,0 L20,0 M-14,-14 L14,14 M-14,14 L14,-14" stroke="#fbc02d" strokeWidth="4" />
          <circle cx="0" cy="0" r="5" fill="#f9a825" />
        </g>

        {/* Kevum (Sinhala traditional sweet) */}
        <path d="M90,70 Q100,40 110,70 Z" fill="#8d6e63" />
        <ellipse cx="100" cy="70" rx="15" ry="8" fill="#795548" />
        <path d="M95,45 Q100,35 105,45 Z" fill="#5d4037" />

        {/* Laddu (Tamil traditional sweet) */}
        <circle cx="75" cy="45" r="12" fill="#ffb300" />
        <circle cx="71" cy="42" r="1.5" fill="#e65100" />
        <circle cx="78" cy="46" r="1.5" fill="#e65100" />
        
        <circle cx="95" cy="35" r="10" fill="#ffb300" />
        <circle cx="92" cy="32" r="1.5" fill="#e65100" />
      </svg>
    </div>
  );
}
