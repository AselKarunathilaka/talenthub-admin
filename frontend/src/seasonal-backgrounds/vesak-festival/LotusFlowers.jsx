import React from 'react';
import './LotusFlowers.css';

export default function LotusFlowers() {
  return (
    <div className="lotus-flowers-container">
      <div className="lotus lotus-1">
        <svg viewBox="0 0 100 60">
          <path d="M50,55 Q30,55 10,40 Q30,30 50,55" fill="#f8bbd0" stroke="#d81b60" strokeWidth="1" />
          <path d="M50,55 Q70,55 90,40 Q70,30 50,55" fill="#f8bbd0" stroke="#d81b60" strokeWidth="1" />
          <path d="M50,55 Q20,40 30,20 Q45,35 50,55" fill="#f48fb1" stroke="#d81b60" strokeWidth="1" />
          <path d="M50,55 Q80,40 70,20 Q55,35 50,55" fill="#f48fb1" stroke="#d81b60" strokeWidth="1" />
          <path d="M50,55 Q40,30 50,10 Q60,30 50,55" fill="#f06292" stroke="#d81b60" strokeWidth="1" />
          <circle cx="50" cy="50" r="5" fill="#fff59d" className="lotus-glow" />
        </svg>
      </div>
      <div className="lotus lotus-2">
        <svg viewBox="0 0 100 60">
          <path d="M50,55 Q30,55 10,40 Q30,30 50,55" fill="#e1bee7" stroke="#8e24aa" strokeWidth="1" />
          <path d="M50,55 Q70,55 90,40 Q70,30 50,55" fill="#e1bee7" stroke="#8e24aa" strokeWidth="1" />
          <path d="M50,55 Q20,40 30,20 Q45,35 50,55" fill="#ce93d8" stroke="#8e24aa" strokeWidth="1" />
          <path d="M50,55 Q80,40 70,20 Q55,35 50,55" fill="#ce93d8" stroke="#8e24aa" strokeWidth="1" />
          <path d="M50,55 Q40,30 50,10 Q60,30 50,55" fill="#ba68c8" stroke="#8e24aa" strokeWidth="1" />
          <circle cx="50" cy="50" r="5" fill="#fff59d" className="lotus-glow" />
        </svg>
      </div>
      <div className="lotus lotus-3">
        <svg viewBox="0 0 100 60">
          <path d="M50,55 Q30,55 10,40 Q30,30 50,55" fill="#ffcdd2" stroke="#e53935" strokeWidth="1" />
          <path d="M50,55 Q70,55 90,40 Q70,30 50,55" fill="#ffcdd2" stroke="#e53935" strokeWidth="1" />
          <path d="M50,55 Q20,40 30,20 Q45,35 50,55" fill="#ef9a9a" stroke="#e53935" strokeWidth="1" />
          <path d="M50,55 Q80,40 70,20 Q55,35 50,55" fill="#ef9a9a" stroke="#e53935" strokeWidth="1" />
          <path d="M50,55 Q40,30 50,10 Q60,30 50,55" fill="#e57373" stroke="#e53935" strokeWidth="1" />
          <circle cx="50" cy="50" r="5" fill="#fff59d" className="lotus-glow" />
        </svg>
      </div>
    </div>
  );
}
