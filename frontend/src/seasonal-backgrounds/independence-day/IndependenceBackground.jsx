import React from 'react';
import './IndependenceBackground.css';
import MemorialHall from './MemorialHall';
import AirforceJets from './AirforceJets';
import Balloons from './Balloons';
import Bunting from './Bunting';
import NationalFlag from './NationalFlag';

export default function IndependenceBackground() {
  return (
    <div className="independence-background">
      <div className="daytime-sky"></div>
      
      <AirforceJets />
      <Balloons />
      <MemorialHall />
      <Bunting />
      <NationalFlag />
    </div>
  );
}
