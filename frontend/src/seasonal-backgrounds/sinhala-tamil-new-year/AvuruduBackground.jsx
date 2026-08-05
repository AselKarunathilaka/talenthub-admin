import React from 'react';
import './AvuruduBackground.css';
import Sun from './Sun';
import ErabaduBranch from './ErabaduBranch';
import KiriIthirima from './KiriIthirima';
import OilLamp from './OilLamp';
import FestiveSweets from './FestiveSweets';

export default function AvuruduBackground() {
  return (
    <div className="avurudu-background">
      <div className="morning-sky"></div>
      
      {/* Kolam / Rangoli pattern on the ground */}
      <div className="kolam-ground">
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="kolam-pattern">
          <path d="M0,50 Q20,20 40,50 T80,50 T120,50 T160,50 T200,50 T240,50 T280,50 T320,50 T360,50 T400,50" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          <path d="M0,50 Q20,80 40,50 T80,50 T120,50 T160,50 T200,50 T240,50 T280,50 T320,50 T360,50 T400,50" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          <circle cx="20" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="60" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="100" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="140" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="180" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="220" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="260" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="300" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="340" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="380" cy="50" r="3" fill="rgba(255,255,255,0.2)" />
        </svg>
      </div>

      <Sun />
      <ErabaduBranch />
      <KiriIthirima />
      <OilLamp />
      <FestiveSweets />
    </div>
  );
}
