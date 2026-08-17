import React from 'react';
import './Fireworks.css';

export default function Fireworks() {
  // Generate random positions and delays for multiple fireworks
  const fireworks = Array.from({ length: 6 }).map((_, i) => ({
    id: i,
    left: `${20 + Math.random() * 60}%`,
    top: `${10 + Math.random() * 40}%`,
    animationDelay: `${Math.random() * 4}s`,
    colorType: ['red', 'gold', 'blue', 'green', 'purple'][Math.floor(Math.random() * 5)]
  }));

  return (
    <div className="fireworks-container">
      {fireworks.map((fw) => (
        <div 
          key={fw.id} 
          className={`firework ${fw.colorType}`}
          style={{ left: fw.left, top: fw.top, animationDelay: fw.animationDelay }}
        >
          <div className="spark spark-1"></div>
          <div className="spark spark-2"></div>
          <div className="spark spark-3"></div>
          <div className="spark spark-4"></div>
          <div className="spark spark-5"></div>
          <div className="spark spark-6"></div>
          <div className="spark spark-7"></div>
          <div className="spark spark-8"></div>
        </div>
      ))}
    </div>
  );
}
