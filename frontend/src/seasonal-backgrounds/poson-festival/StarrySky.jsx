import { useMemo } from 'react'
import './StarrySky.css'

export default function StarrySky() {
  const stars = useMemo(() => {
    const arr = []
    for (let i = 0; i < 200; i++) {
      const size = Math.random() * 2.5 + 0.5
      arr.push({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 70}%`, // Keep stars in the upper 70% to avoid mountain area
        size: `${size}px`,
        delay: `${Math.random() * 6}s`,
        duration: `${3 + Math.random() * 5}s`,
        opacity: Math.random() * 0.7 + 0.1,
      })
    }
    return arr
  }, [])

  const shootingStars = useMemo(() => {
    return [0, 1, 2].map((i) => ({
      id: i,
      top: `${5 + Math.random() * 35}%`,
      left: `${20 + Math.random() * 60}%`,
      delay: `${i * 9 + Math.random() * 5}s`,
      duration: `${1.5 + Math.random() * 1}s`,
    }))
  }, [])

  return (
    <div className="starry-sky" aria-hidden="true">
      {/* Moon with enhanced glow and realism */}
      <div className="moon">
        <div className="moon-atmosphere" />
        <div className="moon-glow moon-glow--far" />
        <div className="moon-glow moon-glow--mid" />
        <div className="moon-glow moon-glow--near" />
        <div className="moon-body" />
        <div className="moon-crater moon-crater--1" />
        <div className="moon-crater moon-crater--2" />
        <div className="moon-crater moon-crater--3" />
        <div className="moon-crater moon-crater--4" />
      </div>

      {/* Stars */}
      {stars.map((s) => (
        <div
          key={s.id}
          className="star"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
            animationDuration: s.duration,
            opacity: s.opacity,
          }}
        />
      ))}

      {/* Shooting stars */}
      {shootingStars.map((s) => (
        <div
          key={`shoot-${s.id}`}
          className="shooting-star"
          style={{
            top: s.top,
            left: s.left,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }}
        />
      ))}
    </div>
  )
}
