import React from 'react';
import './NationalFlag.css';
import sriLankaFlag from '../../assets/sri_lanka_flag.svg';

export default function NationalFlag() {
  return (
    <div className="national-flag-container">
      <div className="flag-pole"></div>
      <div className="flag-fabric-img-wrapper">
        <img src={sriLankaFlag} alt="Sri Lankan Flag" className="sri-lanka-flag-img" />
      </div>
    </div>
  );
}
