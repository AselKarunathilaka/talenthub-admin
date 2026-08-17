import React from 'react';
import './NewYearBackground.css';
import Confetti from './Confetti';
import HappyNewYearText from './HappyNewYearText';
import MidnightFireworks from './MidnightFireworks';
import CitySkyline from './CitySkyline';
import Spotlights from './Spotlights';

export default function NewYearBackground() {
  return (
    <div className="new-year-background">
      <div className="new-year-stars"></div>
      <Spotlights />
      <Confetti />
      <MidnightFireworks />
      <CitySkyline />
      <HappyNewYearText />
    </div>
  );
}
