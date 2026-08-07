import React from 'react';
import './DeepavaliBackground.css';
import Fireworks from './Fireworks';
import MarigoldToran from './MarigoldToran';
import GlowingDiyas from './GlowingDiyas';

export default function DeepavaliBackground() {
  return (
    <div className="deepavali-background">
      <div className="deepavali-sky"></div>
      
      <Fireworks />
      
      <MarigoldToran />
      
      {/* Floor / Ground */}
      <div className="deepavali-ground"></div>
      
      <GlowingDiyas />
    </div>
  );
}
