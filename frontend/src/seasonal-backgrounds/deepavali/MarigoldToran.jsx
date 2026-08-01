import React from 'react';
import './MarigoldToran.css';

export default function MarigoldToran() {
  // Create a series of hanging flowers
  const segments = Array.from({ length: 20 });

  return (
    <div className="marigold-toran-container">
      <div className="toran-string">
        {segments.map((_, i) => (
          <div key={i} className="toran-segment">
            {/* Mango Leaf */}
            <svg className="mango-leaf" viewBox="0 0 20 40">
              <path d="M10,0 Q20,10 10,40 Q0,10 10,0 Z" fill="#2e7d32" />
            </svg>
            
            {/* Marigold Flower */}
            <svg className="marigold-flower" viewBox="0 0 30 30">
              <circle cx="15" cy="15" r="10" fill="#ff9800" />
              <circle cx="15" cy="15" r="7" fill="#ffc107" />
              <circle cx="15" cy="15" r="4" fill="#ff5722" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}
