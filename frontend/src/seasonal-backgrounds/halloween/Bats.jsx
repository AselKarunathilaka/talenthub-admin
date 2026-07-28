import React from 'react';
import './Bats.css';

export default function Bats() {
  // We render a few bat SVGs, positioned via CSS
  const batPath = "M10,20 Q30,5 50,20 Q70,5 90,20 Q80,40 50,30 Q20,40 10,20 Z";
  
  return (
    <div className="bats-container">
      <div className="bat bat-1">
        <svg viewBox="0 0 100 50"><path d={batPath} fill="#000"/></svg>
      </div>
      <div className="bat bat-2">
        <svg viewBox="0 0 100 50"><path d={batPath} fill="#000"/></svg>
      </div>
      <div className="bat bat-3">
        <svg viewBox="0 0 100 50"><path d={batPath} fill="#000"/></svg>
      </div>
      <div className="bat bat-4">
        <svg viewBox="0 0 100 50"><path d={batPath} fill="#000"/></svg>
      </div>
    </div>
  );
}
