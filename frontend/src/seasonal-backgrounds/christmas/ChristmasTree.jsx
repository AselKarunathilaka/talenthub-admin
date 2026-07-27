import React from 'react';
import './ChristmasTree.css';

export default function ChristmasTree() {
  return (
    <div className="christmas-tree-container">
      <svg className="christmas-tree-svg" viewBox="0 0 200 300" preserveAspectRatio="xMidYMax meet">
        {/* Trunk */}
        <rect x="90" y="250" width="20" height="40" fill="#5c4033" />
        
        {/* Tree Layers */}
        <path d="M100,60 L160,140 L40,140 Z" fill="#0f4d19" />
        <path d="M100,100 L170,190 L30,190 Z" fill="#0b3b13" />
        <path d="M100,150 L180,260 L20,260 Z" fill="#072c0e" />
        
        {/* Star */}
        <polygon className="tree-star" points="100,30 105,50 125,50 110,60 115,80 100,68 85,80 90,60 75,50 95,50" fill="#ffd700" />
        
        {/* Fairy Lights */}
        <circle cx="90" cy="110" r="4" fill="#ff0000" className="fairy-light light-1" />
        <circle cx="110" cy="130" r="4" fill="#00ff00" className="fairy-light light-2" />
        <circle cx="70" cy="170" r="4" fill="#0000ff" className="fairy-light light-3" />
        <circle cx="130" cy="180" r="4" fill="#ffff00" className="fairy-light light-1" />
        <circle cx="95" cy="160" r="4" fill="#ff00ff" className="fairy-light light-2" />
        <circle cx="60" cy="220" r="4" fill="#ff8c00" className="fairy-light light-3" />
        <circle cx="105" cy="230" r="4" fill="#00ffff" className="fairy-light light-1" />
        <circle cx="140" cy="240" r="4" fill="#ff0000" className="fairy-light light-2" />
        <circle cx="80" cy="250" r="4" fill="#00ff00" className="fairy-light light-3" />
      </svg>
    </div>
  );
}
