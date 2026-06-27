import './MihinthaleSilhouette.css'

export default function MihinthaleSilhouette() {
  return (
    <div className="mihinthale-wrapper" aria-label="Mihintale mountain landscape with historical scene">
      {/* ── Realistic Mist Layers ── */}
      <div className="mist mist--base" />
      <div className="mist mist--1" />
      <div className="mist mist--2" />
      <div className="mist mist--3" />

      {/* ── Full-width landscape SVG ── */}
      <svg
        className="landscape-svg"
        viewBox="0 0 1600 500"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Atmospheric gradients */}
          <linearGradient id="farHill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#181a38" />
            <stop offset="100%" stopColor="#0d0e20" />
          </linearGradient>
          <linearGradient id="midHill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#12142d" />
            <stop offset="100%" stopColor="#090a18" />
          </linearGradient>
          <linearGradient id="mainMtn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c0d1c" />
            <stop offset="50%" stopColor="#070812" />
            <stop offset="100%" stopColor="#03040a" />
          </linearGradient>
          <linearGradient id="nearHill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a0a14" />
            <stop offset="100%" stopColor="#020208" />
          </linearGradient>
          <linearGradient id="foreground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#05050c" />
            <stop offset="100%" stopColor="#000000" />
          </linearGradient>
          <linearGradient id="stupaGold" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#ffda66" />
            <stop offset="100%" stopColor="#c9972e" />
          </linearGradient>
          <radialGradient id="stupaAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,215,0,0.25)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="silhouetteFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#706040" />
            <stop offset="100%" stopColor="#5a4a2e" />
          </linearGradient>
          <linearGradient id="silhouetteDetail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#887548" />
            <stop offset="100%" stopColor="#6a5832" />
          </linearGradient>
        </defs>

        {/* ── Layer 1: Farthest hills ── */}
        <path
          d="M-50 430
             Q150 380 300 400
             Q450 420 600 390
             Q800 350 950 380
             Q1150 420 1300 390
             Q1450 360 1650 410
             L1650 500 L-50 500 Z"
          fill="url(#farHill)" opacity="0.45"
        />

        {/* ── Layer 2: Mid hills ── */}
        <path
          d="M-50 460
             Q200 420 350 430
             Q500 440 700 390
             Q900 340 1050 390
             Q1200 440 1400 410
             Q1550 380 1650 420
             L1650 500 L-50 500 Z"
          fill="url(#midHill)" opacity="0.6"
        />

        {/* ── Layer 3: Main Mihintale mountain (Majestic and clear) ── */}
        <path
          d="M-50 500
             Q 150 480, 300 430
             Q 450 370, 550 320
             Q 620 280, 680 255
             Q 710 245, 740 245
             Q 770 245, 820 270
             Q 900 310, 1000 370
             Q 1150 450, 1350 470
             Q 1500 485, 1650 490
             L1650 500 L-50 500 Z"
          fill="url(#mainMtn)"
        />

        {/* ── Stupa at the peak (x=740, y=245) ── */}
        <g className="stupa-peak" transform="translate(740, 245)">
          <circle cx="0" cy="-30" r="50" fill="url(#stupaAura)" className="stupa-glow-anim" />

          {/* Platform steps */}
          <rect x="-24" y="-4" width="48" height="4" rx="1" fill="#0c0d1c" />
          <rect x="-20" y="-8" width="40" height="4" rx="1" fill="#0c0d1c" />
          <rect x="-16" y="-12" width="32" height="4" rx="1" fill="#0c0d1c" />

          {/* Dome */}
          <path d="M-14 -12 Q-14 -35 0 -42 Q14 -35 14 -12 Z" fill="#0c0d1c" />

          {/* Spire base (Hatharas Kotuwa) */}
          <rect x="-4" y="-48" width="8" height="6" fill="#0c0d1c" />

          {/* Spire (Kotha) */}
          <polygon points="-2,-48 2,-48 0,-65" fill="#0c0d1c" />

          {/* Gold tip (Chudamanikya) */}
          <circle cx="0" cy="-66" r="3" fill="url(#stupaGold)" opacity="0.9" className="stupa-tip" />
          
          {/* Subtle gold highlight on the dome */}
          <path d="M0 -42 Q12 -35 12 -12" fill="none" stroke="url(#stupaGold)" strokeWidth="0.8" opacity="0.3" />
        </g>

        {/* ── Layer 4: Near hill (Right foreground) ── */}
        <path
          d="M1000 500
             Q1150 460, 1300 450
             Q1450 440, 1650 455
             L1650 500 Z"
          fill="url(#nearHill)" opacity="0.8"
        />

        {/* ── Near hill (Left edge foreground) ── */}
        <path
          d="M-50 500
             Q50 475, 150 470
             Q250 465, 350 475
             Q400 480, 450 500
             L-50 500 Z"
          fill="url(#nearHill)" opacity="0.75"
        />

        {/* ═══ HISTORICAL SILHOUETTE SCENE: Deer + King ═══ */}

        {/* ── Running Deer (Leaping rightwards) ── */}
        <g transform="translate(670, 410) scale(1.5)">
          <g className="deer-figure" opacity="0.8">
            <ellipse cx="0" cy="0" rx="20" ry="9" fill="url(#silhouetteDetail)" transform="rotate(-5)" />
            <path d="M12,-6 Q18,-18 16,-28" stroke="url(#silhouetteDetail)" strokeWidth="5.5" fill="none" strokeLinecap="round" />
            <ellipse cx="16" cy="-30" rx="7" ry="4.5" fill="url(#silhouetteDetail)" transform="rotate(-20,16,-30)" />
            <path d="M19,-31 L24,-29 L21,-27 Z" fill="url(#silhouetteDetail)" />
            <path d="M16,-32 Q14,-40 12,-34" stroke="url(#silhouetteDetail)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <path d="M12,-33 Q8,-44 4,-48" stroke="url(#silhouetteDetail)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <path d="M9,-40 Q13,-42 16,-45" stroke="url(#silhouetteDetail)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
            <path d="M6,-45 Q2,-47 -1,-46" stroke="url(#silhouetteDetail)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <path d="M10,-33 Q4,-42 -2,-45" stroke="url(#silhouetteFill)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
            <path d="M4,-38 Q7,-41 8,-44" stroke="url(#silhouetteFill)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <path d="M12,-3 Q16,-5 22,8 Q24,14 26,18" stroke="url(#silhouetteDetail)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M14,-1 Q20,1 26,12 Q28,16 29,19" stroke="url(#silhouetteFill)" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M-12,4 Q-18,12 -24,20 Q-26,24 -28,24" stroke="url(#silhouetteDetail)" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M-10,6 Q-14,14 -16,22 Q-17,25 -19,25" stroke="url(#silhouetteFill)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M-18,-3 Q-25,-8 -28,-14" stroke="url(#silhouetteDetail)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </g>
        </g>

        {/* ── King / Hunter figure (Chasing rightwards) ── */}
        <g transform="translate(550, 420) scale(1.5)">
          <g className="king-figure" opacity="0.8">
            <circle cx="0" cy="-32" r="5.5" fill="url(#silhouetteDetail)" />
            <path d="M-4,-37 L0,-45 L4,-37 Z" fill="url(#silhouetteDetail)" />
            <path d="M-5,-34 Q-8,-40 -2,-39" stroke="url(#silhouetteDetail)" strokeWidth="1.5" fill="none" />
            <path d="M5,-34 Q8,-40 2,-39" stroke="url(#silhouetteDetail)" strokeWidth="1.5" fill="none" />
            <line x1="0" y1="-27" x2="2" y2="-22" stroke="url(#silhouetteDetail)" strokeWidth="4" />
            <path d="M2,-22 Q8,-10 6,2" stroke="url(#silhouetteDetail)" strokeWidth="6" fill="none" strokeLinecap="round" />
            <path d="M4,-2 Q-4,4 -10,8 Q-16,10 -20,8" fill="url(#silhouetteDetail)" opacity="0.9" />
            <path d="M6,2 Q0,8 -4,14 Q-8,18 -12,18" stroke="url(#silhouetteFill)" strokeWidth="2" fill="none" />
            <path d="M2,4 Q-6,12 -14,16 Q-18,18 -22,16" fill="url(#silhouetteFill)" opacity="0.7" />
            <path d="M4,-20 Q12,-16 22,-14 Q26,-13 28,-14" stroke="url(#silhouetteDetail)" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M28,-36 Q38,-14 28,8" stroke="url(#silhouetteDetail)" strokeWidth="2" fill="none" strokeLinecap="round" />
            <line x1="28" y1="-36" x2="28" y2="8" stroke="url(#silhouetteFill)" strokeWidth="0.8" />
            <line x1="14" y1="-14" x2="38" y2="-14" stroke="url(#silhouetteDetail)" strokeWidth="1.2" />
            <path d="M38,-14 L34,-16 L34,-12 Z" fill="url(#silhouetteDetail)" />
            <path d="M14,-14 L18,-16 L18,-12 Z" fill="url(#silhouetteDetail)" />
            <path d="M1,-20 Q-8,-16 -16,-20 Q-22,-24 -24,-20" stroke="url(#silhouetteFill)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M6,2 Q12,8 20,18 Q24,24 26,24" stroke="url(#silhouetteDetail)" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M26,24 L30,24" stroke="url(#silhouetteDetail)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M4,0 Q-4,10 -14,16 Q-18,20 -22,20" stroke="url(#silhouetteFill)" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M-22,20 L-26,22" stroke="url(#silhouetteFill)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </g>
        </g>

        {/* ── Palm trees (left foreground) ── */}
        <g opacity="0.85">
          <path d="M60 500 Q64 475 70 445 Q74 428 78 418" stroke="#04040a" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="78" cy="413" rx="24" ry="9" fill="#020206" transform="rotate(-20,78,413)" />
          <ellipse cx="83" cy="416" rx="22" ry="8" fill="#020206" transform="rotate(25,83,416)" />
          <ellipse cx="71" cy="415" rx="20" ry="8" fill="#020206" transform="rotate(-35,71,415)" />

          <path d="M140 500 Q138 478 135 452 Q133 438 130 428" stroke="#04040a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <ellipse cx="130" cy="423" rx="22" ry="8" fill="#020206" transform="rotate(-15,130,423)" />
          <ellipse cx="135" cy="426" rx="20" ry="7" fill="#020206" transform="rotate(30,135,426)" />
          <ellipse cx="123" cy="425" rx="18" ry="7" fill="#020206" transform="rotate(-40,123,425)" />
        </g>

        {/* ── Palm trees (right foreground) ── */}
        <g opacity="0.85">
          <path d="M1480 500 Q1478 478 1475 455 Q1473 440 1470 430" stroke="#04040a" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="1470" cy="425" rx="24" ry="9" fill="#020206" transform="rotate(15,1470,425)" />
          <ellipse cx="1465" cy="428" rx="22" ry="8" fill="#020206" transform="rotate(-30,1465,428)" />
          <ellipse cx="1477" cy="427" rx="20" ry="8" fill="#020206" transform="rotate(40,1477,427)" />
        </g>

        {/* ── Dense canopy edges ── */}
        <ellipse cx="20" cy="492" rx="60" ry="20" fill="#030308" />
        <ellipse cx="120" cy="488" rx="70" ry="25" fill="#020205" />
        <ellipse cx="250" cy="490" rx="60" ry="18" fill="#040408" />

        <ellipse cx="1350" cy="488" rx="60" ry="20" fill="#030308" />
        <ellipse cx="1480" cy="490" rx="70" ry="25" fill="#020205" />
        <ellipse cx="1600" cy="486" rx="60" ry="22" fill="#040408" />

        {/* ── Foreground ground ── */}
        <path
          d="M-50 494 Q300 490 800 492 Q1300 490 1650 494 L1650 500 L-50 500 Z"
          fill="url(#foreground)"
        />
      </svg>
    </div>
  )
}
