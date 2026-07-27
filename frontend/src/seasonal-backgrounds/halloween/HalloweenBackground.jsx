import React from 'react';
import './HalloweenBackground.css';
import Fog from './Fog';
import Bats from './Bats';
import Pumpkins from './Pumpkins';
import Spiders from './Spiders';
import Ghosts from './Ghosts';
import HauntedHouse from './HauntedHouse';

export default function HalloweenBackground() {
  return (
    <>
      <div className="halloween-background">
        {/* The Moon is part of the background gradient, but we can also add a distinct moon element for glow */}
        <div className="halloween-moon"></div>
        <HauntedHouse />
        <Ghosts />
        <Bats />
        <Spiders />
        <Fog />
        <Pumpkins />
      </div>
    </>
  );
}
