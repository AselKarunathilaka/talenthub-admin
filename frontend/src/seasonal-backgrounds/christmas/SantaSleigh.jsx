import React from 'react';
import './SantaSleigh.css';

export default function SantaSleigh() {
  return (
    <div className="santa-sleigh-container">
      <svg className="santa-svg" viewBox="0 0 800 200">
        <path d="M200,100 C150,150 50,150 10,130 C20,100 80,100 120,90 C120,60 160,70 180,90 C190,90 200,90 200,100 Z" fill="#111" />
        <path d="M150,80 C150,60 165,50 170,70" stroke="#111" strokeWidth="5" fill="none" />
        {/* Reindeer 1 */}
        <path d="M260,110 C240,120 220,110 220,90 C240,80 270,90 260,110 Z" fill="#111" />
        <path d="M250,90 C260,70 270,70 270,85 C280,75 285,85 270,95" stroke="#111" strokeWidth="3" fill="none" />
        <path d="M225,100 L210,130 M235,105 L225,135 M250,105 L260,125 M255,100 L270,120" stroke="#111" strokeWidth="3" fill="none" />
        {/* Reindeer 2 */}
        <path d="M340,100 C320,110 300,100 300,80 C320,70 350,80 340,100 Z" fill="#111" />
        <path d="M330,80 C340,60 350,60 350,75 C360,65 365,75 350,85" stroke="#111" strokeWidth="3" fill="none" />
        <path d="M305,90 L290,120 M315,95 L305,125 M330,95 L340,115 M335,90 L350,110" stroke="#111" strokeWidth="3" fill="none" />
        {/* Reins */}
        <path d="M180,95 Q230,120 250,90 M250,90 Q300,110 330,80" stroke="#111" strokeWidth="1" fill="none" />
      </svg>
    </div>
  );
}
