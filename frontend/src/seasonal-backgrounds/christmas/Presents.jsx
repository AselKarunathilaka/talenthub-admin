import React from 'react';
import './Presents.css';

export default function Presents() {
  return (
    <div className="presents-container">
      {/* Present 1 */}
      <div className="present present-1">
        <svg viewBox="0 0 100 100">
          <rect x="20" y="40" width="60" height="60" fill="#e63946" />
          <rect x="15" y="30" width="70" height="15" fill="#f1faee" />
          <rect x="45" y="45" width="10" height="55" fill="#f1faee" />
          {/* Bow */}
          <path d="M50,30 Q30,10 40,25 Q50,30 50,30" fill="#f1faee" stroke="#e63946" strokeWidth="2" />
          <path d="M50,30 Q70,10 60,25 Q50,30 50,30" fill="#f1faee" stroke="#e63946" strokeWidth="2" />
        </svg>
      </div>
      
      {/* Present 2 */}
      <div className="present present-2">
        <svg viewBox="0 0 100 100">
          <rect x="25" y="50" width="50" height="50" fill="#457b9d" />
          <rect x="20" y="40" width="60" height="15" fill="#a8dadc" />
          <rect x="45" y="55" width="10" height="45" fill="#a8dadc" />
          {/* Bow */}
          <path d="M50,40 Q35,25 45,35 Q50,40 50,40" fill="#a8dadc" stroke="#457b9d" strokeWidth="2" />
          <path d="M50,40 Q65,25 55,35 Q50,40 50,40" fill="#a8dadc" stroke="#457b9d" strokeWidth="2" />
        </svg>
      </div>
      
      {/* Present 3 */}
      <div className="present present-3">
        <svg viewBox="0 0 100 100">
          <rect x="30" y="60" width="40" height="40" fill="#2a9d8f" />
          <rect x="25" y="50" width="50" height="10" fill="#e9c46a" />
          <rect x="45" y="60" width="10" height="40" fill="#e9c46a" />
          {/* Bow */}
          <path d="M50,50 Q40,35 45,45 Q50,50 50,50" fill="#e9c46a" stroke="#2a9d8f" strokeWidth="2" />
          <path d="M50,50 Q60,35 55,45 Q50,50 50,50" fill="#e9c46a" stroke="#2a9d8f" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}
