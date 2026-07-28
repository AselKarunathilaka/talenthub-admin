import React from 'react';
import StarrySky from '../poson-festival/StarrySky';
import Particles from '../poson-festival/Particles';
import VesakLanterns from '../poson-festival/VesakLanterns';
import StupaSilhouette from './StupaSilhouette';
import LotusFlowers from './LotusFlowers';
import './VesakBackground.css';

export default function VesakBackground() {
  return (
    <>
      <div className="vesak-background">
        <StarrySky />
        <Particles />
        <StupaSilhouette />
        <LotusFlowers />
      </div>
      <VesakLanterns />
    </>
  );
}
