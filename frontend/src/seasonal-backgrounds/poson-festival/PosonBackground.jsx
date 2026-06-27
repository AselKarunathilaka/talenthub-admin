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
    <div className="poson-background">
      <StarrySky />
      <Particles />
      <VesakLanterns />
      <MihinthaleSilhouette />
    </div>
  )
}
