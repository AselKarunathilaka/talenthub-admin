import React from 'react';
import './AirforceJets.css';

export default function AirforceJets() {
  return (
    <div className="airforce-jets-container">
      {/* Jet 1 - Maroon Trail */}
      <div className="jet-wrapper jet-1">
        <div className="smoke smoke-maroon"></div>
        <svg className="jet-svg" viewBox="0 0 100 100">
          <path d="M10,50 L30,45 L80,50 L90,50 L100,50 L90,55 L80,55 L30,55 Z" fill="#333" />
          <path d="M30,45 L50,10 L70,45 Z" fill="#222" />
          <path d="M30,55 L50,90 L70,55 Z" fill="#222" />
          <path d="M10,50 L0,30 L20,45 Z" fill="#222" />
          <path d="M10,50 L0,70 L20,55 Z" fill="#222" />
        </svg>
      </div>

      {/* Jet 2 - Orange Trail */}
      <div className="jet-wrapper jet-2">
        <div className="smoke smoke-orange"></div>
        <svg className="jet-svg" viewBox="0 0 100 100">
          <path d="M10,50 L30,45 L80,50 L90,50 L100,50 L90,55 L80,55 L30,55 Z" fill="#333" />
          <path d="M30,45 L50,10 L70,45 Z" fill="#222" />
          <path d="M30,55 L50,90 L70,55 Z" fill="#222" />
          <path d="M10,50 L0,30 L20,45 Z" fill="#222" />
          <path d="M10,50 L0,70 L20,55 Z" fill="#222" />
        </svg>
      </div>

      {/* Jet 3 - Green Trail */}
      <div className="jet-wrapper jet-3">
        <div className="smoke smoke-green"></div>
        <svg className="jet-svg" viewBox="0 0 100 100">
          <path d="M10,50 L30,45 L80,50 L90,50 L100,50 L90,55 L80,55 L30,55 Z" fill="#333" />
          <path d="M30,45 L50,10 L70,45 Z" fill="#222" />
          <path d="M30,55 L50,90 L70,55 Z" fill="#222" />
          <path d="M10,50 L0,30 L20,45 Z" fill="#222" />
          <path d="M10,50 L0,70 L20,55 Z" fill="#222" />
        </svg>
      </div>

      {/* Jet 4 - Gold Trail */}
      <div className="jet-wrapper jet-4">
        <div className="smoke smoke-gold"></div>
        <svg className="jet-svg" viewBox="0 0 100 100">
          <path d="M10,50 L30,45 L80,50 L90,50 L100,50 L90,55 L80,55 L30,55 Z" fill="#333" />
          <path d="M30,45 L50,10 L70,45 Z" fill="#222" />
          <path d="M30,55 L50,90 L70,55 Z" fill="#222" />
          <path d="M10,50 L0,30 L20,45 Z" fill="#222" />
          <path d="M10,50 L0,70 L20,55 Z" fill="#222" />
        </svg>
      </div>
    </div>
  );
}
