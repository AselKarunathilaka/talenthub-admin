import React, { useMemo } from 'react';
import './Confetti.css';

export default function Confetti() {
  const confettiPieces = useMemo(() => {
    const colors = ['#FFF7B6', '#EFD466', '#D7B030']; // Gold palette
    return Array.from({ length: 120 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}vw`,
      width: `${Math.random() * 8 + 4}px`,
      height: `${Math.random() * 16 + 8}px`,
      color: colors[Math.floor(Math.random() * colors.length)],
      animationDelay: `-${Math.random() * 10}s`, // Negative delay so they are already falling!
      animationDuration: `${Math.random() * 5 + 5}s`,
      rotateDelay: `-${Math.random() * 2}s`,
    }));
  }, []);

  return (
    <div className="confetti-container">
      {confettiPieces.map((p) => (
        <div
          key={p.id}
          className="confetti-fall-wrapper"
          style={{
            left: p.left,
            animationDelay: p.animationDelay,
            animationDuration: p.animationDuration,
          }}
        >
          <div
            className="confetti-piece"
            style={{
              width: p.width,
              height: p.height,
              backgroundColor: p.color,
              animationDelay: p.rotateDelay,
            }}
          />
        </div>
      ))}
    </div>
  );
}
