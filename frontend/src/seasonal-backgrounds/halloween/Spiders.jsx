import React from 'react';
import './Spiders.css';

export default function Spiders() {
  return (
    <div className="spiders-container">
      {/* Spider Web */}
      <svg className="spider-web spider-web-left" viewBox="0 0 100 100" preserveAspectRatio="xMinYMin meet">
        <path d="M0,0 L100,0 M0,0 L100,20 M0,0 L80,50 M0,0 L50,80 M0,0 L20,100 M0,0 L0,100" stroke="#444" strokeWidth="1" fill="none" opacity="0.6"/>
        <path d="M20,0 Q25,10 40,8 Q30,20 50,25 Q35,35 45,45 Q20,30 25,50 Q10,25 0,20" stroke="#444" strokeWidth="1" fill="none" opacity="0.6"/>
        <path d="M40,0 Q45,20 70,15 Q55,40 85,50 Q60,65 75,85 Q40,55 45,90 Q20,45 0,40" stroke="#444" strokeWidth="1" fill="none" opacity="0.6"/>
        <path d="M70,0 Q75,35 100,25 Q80,65 100,90 Q60,85 75,100 Q40,85 50,100 Q30,75 0,70" stroke="#444" strokeWidth="1" fill="none" opacity="0.6"/>
      </svg>
      
      {/* Spider dropping down */}
      <div className="spider spider-1">
        <div className="spider-thread"></div>
        <div className="spider-body">
          <svg viewBox="0 0 50 50">
            <circle cx="25" cy="20" r="8" fill="#111" />
            <circle cx="25" cy="32" r="12" fill="#111" />
            {/* Legs */}
            <path d="M18,20 Q10,10 5,20 M18,24 Q5,20 2,30 M18,28 Q10,40 5,45 M20,32 Q15,45 10,50" stroke="#111" strokeWidth="2" fill="none" />
            <path d="M32,20 Q40,10 45,20 M32,24 Q45,20 48,30 M32,28 Q40,40 45,45 M30,32 Q35,45 40,50" stroke="#111" strokeWidth="2" fill="none" />
            {/* Eyes */}
            <circle cx="22" cy="18" r="2" fill="#f00" className="spider-eye" />
            <circle cx="28" cy="18" r="2" fill="#f00" className="spider-eye" />
          </svg>
        </div>
      </div>
      
      <div className="spider spider-2">
        <div className="spider-thread"></div>
        <div className="spider-body">
          <svg viewBox="0 0 50 50">
            <circle cx="25" cy="20" r="8" fill="#111" />
            <circle cx="25" cy="32" r="12" fill="#111" />
            <path d="M18,20 Q10,10 5,20 M18,24 Q5,20 2,30 M18,28 Q10,40 5,45 M20,32 Q15,45 10,50" stroke="#111" strokeWidth="2" fill="none" />
            <path d="M32,20 Q40,10 45,20 M32,24 Q45,20 48,30 M32,28 Q40,40 45,45 M30,32 Q35,45 40,50" stroke="#111" strokeWidth="2" fill="none" />
            <circle cx="22" cy="18" r="2" fill="#f00" className="spider-eye" />
            <circle cx="28" cy="18" r="2" fill="#f00" className="spider-eye" />
          </svg>
        </div>
      </div>
    </div>
  );
}
