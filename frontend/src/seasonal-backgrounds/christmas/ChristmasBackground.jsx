import React from 'react';
import './ChristmasBackground.css';
import Snow from './Snow';
import ChristmasTree from './ChristmasTree';
import SantaSleigh from './SantaSleigh';
import Presents from './Presents';
import Snowman from './Snowman';

export default function ChristmasBackground() {
  return (
    <>
      <div className="christmas-background">
        <div className="northern-lights northern-lights-1"></div>
        <div className="northern-lights northern-lights-2"></div>
        
        {/* The snowy ground at the bottom */}
        <div className="snow-hills">
          <div className="hill hill-1"></div>
          <div className="hill hill-2"></div>
        </div>

        <SantaSleigh />
        <ChristmasTree />
        <Presents />
        <Snowman />
        
        {/* Snow covers everything */}
        <Snow />
      </div>
    </>
  );
}
