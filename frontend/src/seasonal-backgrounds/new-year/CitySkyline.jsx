import React, { useMemo } from 'react';
import './CitySkyline.css';

export default function CitySkyline() {
  const buildings = useMemo(() => Array.from({ length: 45 }).map((_, i) => ({
    id: i,
    height: `${15 + Math.random() * 65}%`, 
    width: `${1.5 + Math.random() * 3}%`,
    opacity: 0.7 + Math.random() * 0.3,
    windowOpacity: Math.random()
  })), []);

  return (
    <div className="city-skyline-container">
       {buildings.map(b => (
          <div 
            key={b.id} 
            className="building" 
            style={{ 
              height: b.height, 
              width: b.width,
              opacity: b.opacity
            }}
          >
             <div className="building-windows" style={{ '--window-opacity': b.windowOpacity }}></div>
          </div>
       ))}
    </div>
  );
}
