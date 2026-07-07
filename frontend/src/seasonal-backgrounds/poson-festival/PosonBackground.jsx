import React from 'react'
import StarrySky from './StarrySky'
import Particles from './Particles'
import VesakLanterns from './VesakLanterns'
import MihinthaleSilhouette from './MihinthaleSilhouette'
import './PosonBackground.css'

/**
 * Poson Festival background — composes all Poson/Vesak sub-components
 * into a single fixed background layer. Renders behind Login content.
 */
export default function PosonBackground() {
  return (
    <>
      <div className="poson-background">
        <StarrySky />
        <Particles />
        <MihinthaleSilhouette />
      </div>
      {/* VesakLanterns rendered outside the fixed container so its
          z-index is relative to the page root, not the background layer */}
      <VesakLanterns />
    </>
  )
}
