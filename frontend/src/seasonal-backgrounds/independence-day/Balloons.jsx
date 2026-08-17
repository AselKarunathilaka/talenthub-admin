import React, { useMemo } from 'react';
import './Balloons.css';

export default function Balloons() {
  const colors = ['maroon', 'orange', 'green', 'gold'];
  const balloons = useMemo(() => Array.from({ length: 15 }).map((_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${Math.random() * 100}vw`,
    animationDelay: `${Math.random() * 15}s`,
    animationDuration: `${15 + Math.random() * 15}s`,
    scale: 0.6 + Math.random() * 0.6,
  })), []);

  return (
    <div className="balloons-container">
      {balloons.map((b) => (
        <div 
          key={b.id} 
          className={`balloon-wrapper ${b.color}`}
          style={{ 
            left: b.left, 
            animationDelay: b.animationDelay, 
            animationDuration: b.animationDuration,
            '--scale': b.scale
          }}
        >
          <div className="balloon"></div>
          <div className="string"></div>
        </div>
      ))}
    </div>
  );
}
