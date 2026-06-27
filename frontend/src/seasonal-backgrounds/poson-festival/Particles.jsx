import { useMemo } from 'react'
import './Particles.css'

export default function Particles() {
  const particles = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: 1 + Math.random() * 2.5,
      delay: `${Math.random() * 20}s`,
      duration: `${12 + Math.random() * 18}s`,
      opacity: 0.1 + Math.random() * 0.3,
    }))
  }, [])

  const fireflies = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      id: `ff-${i}`,
      left: `${10 + Math.random() * 80}%`, // Mostly concentrated in lower/mid areas
      bottom: `${10 + Math.random() * 40}%`,
      delay: `${Math.random() * 10}s`,
      duration: `${6 + Math.random() * 6}s`,
    }))
  }, [])

  return (
    <div className="particles-layer" aria-hidden="true">
      {/* Ambient background particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="glow-particle"
          style={{
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: p.delay,
            animationDuration: p.duration,
            '--particle-opacity': p.opacity,
          }}
        />
      ))}

      {/* Fireflies floating primarily around the bottom/mountain area */}
      {fireflies.map((f) => (
        <div
          key={f.id}
          className="firefly"
          style={{
            left: f.left,
            bottom: f.bottom,
            animationDelay: f.delay,
            animationDuration: f.duration,
          }}
        />
      ))}
    </div>
  )
}
