import React from 'react';
import './Bunting.css';

export default function Bunting() {
  const flags = Array.from({ length: 20 });
  const colors = ['#8b0000', '#ff6600', '#008000', '#ffcc00']; // Maroon, Orange, Green, Gold

  return (
    <div className="bunting-container">
      <div className="bunting-string"></div>
      <div className="flags">
        {flags.map((_, i) => (
          <div 
            key={i} 
            className="bunting-flag" 
            style={{ 
              borderTopColor: colors[i % colors.length],
              animationDelay: `${i * 0.1}s` 
            }}
          ></div>
        ))}
      </div>
    </div>
  );
}
