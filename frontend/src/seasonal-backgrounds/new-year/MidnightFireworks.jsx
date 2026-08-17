import React, { useMemo } from 'react';
import './MidnightFireworks.css';

export default function MidnightFireworks() {
  const fireworks = useMemo(() => Array.from({ length: 15 }).map((_, i) => ({
    id: i,
    left: `${10 + Math.random() * 80}vw`,
    top: `${25 + Math.random() * 30}vh`, /* Spawns lower so blast doesn't hit top edge */
    animationDelay: `${Math.random() * 5}s`,
    color: ['#ff3366', '#ffcc00', '#33ccff', '#33ff99', '#cc66ff', '#FFF7B6'][Math.floor(Math.random() * 6)],
    scale: 0.6 + Math.random() * 1.5,
  })), []);

  return (
    <div className="midnight-fireworks-container">
      {fireworks.map(fw => (
        <div 
          key={fw.id} 
          className="midnight-firework"
          style={{ 
            left: fw.left, 
            top: fw.top, 
            '--fw-color': fw.color,
            transform: `scale(${fw.scale})`
          }}
        >
          {Array.from({ length: 16 }).map((_, j) => (
             <div key={j} className="fw-spark" style={{ transform: `rotate(${j * 22.5}deg)` }}>
                <div className="fw-spark-trail" style={{ animationDelay: fw.animationDelay }}></div>
             </div>
          ))}
        </div>
      ))}
    </div>
  );
}
