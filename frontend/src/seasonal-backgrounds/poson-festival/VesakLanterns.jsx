import './VesakLanterns.css'

export default function VesakLanterns() {
  return (
    <div className="branch-scene" aria-label="Realistic tree branch with Vesak lanterns">
      <svg className="branch-svg" viewBox="0 0 700 520" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2c1e13" />
            <stop offset="60%" stopColor="#1a110a" />
            <stop offset="100%" stopColor="#0d0805" />
          </linearGradient>
          {/* Moonlight highlighting on upper bark edge */}
          <linearGradient id="barkMoonlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5c6e80" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          {/* Leaf gradient (night time) */}
          <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1a2e1c" />
            <stop offset="100%" stopColor="#0d180f" />
          </linearGradient>
          {/* Leaf highlight from moonlight */}
          <linearGradient id="leafHighlight" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#304a3e" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          
          <linearGradient id="goldCap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e6c040" />
            <stop offset="50%" stopColor="#c9972e" />
            <stop offset="100%" stopColor="#8a6914" />
          </linearGradient>
          <radialGradient id="warmGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,215,0,0.55)" />
            <stop offset="40%" stopColor="rgba(255,160,0,0.25)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="redGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,80,30,0.5)" />
            <stop offset="40%" stopColor="rgba(255,50,10,0.2)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="blueGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(80,160,255,0.45)" />
            <stop offset="40%" stopColor="rgba(50,120,220,0.18)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="greenGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(80,200,100,0.4)" />
            <stop offset="40%" stopColor="rgba(50,160,70,0.15)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          
          <radialGradient id="ambientWarm" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,215,0,0.1)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="ambientRed" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,80,30,0.08)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="ambientBlue" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(80,160,255,0.08)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="ambientGreen" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(80,200,100,0.06)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* Reusable leaf paths */}
          <g id="leaf-cluster">
            <path d="M0,0 Q5,-8 12,-10 Q8,-3 0,0" fill="url(#leafGrad)" />
            <path d="M0,0 Q5,-8 12,-10 Q8,-3 0,0" fill="url(#leafHighlight)" opacity="0.6" />
            <path d="M0,0 Q8,2 14,0 Q10,-6 0,0" fill="url(#leafGrad)" />
            <path d="M0,0 Q-4,-6 -10,-4 Q-6,2 0,0" fill="url(#leafGrad)" />
          </g>
          
          <g id="leaf-cluster-small">
            <path d="M0,0 Q4,-6 8,-8 Q6,-2 0,0" fill="url(#leafGrad)" />
            <path d="M0,0 Q4,-6 8,-8 Q6,-2 0,0" fill="url(#leafHighlight)" opacity="0.5" />
            <path d="M0,0 Q6,2 10,0 Q8,-4 0,0" fill="url(#leafGrad)" />
          </g>
        </defs>

        {/* ═══════════ MAIN BRANCH & SUB-BRANCHES ═══════════ */}
        {/* Main branch base (thickest part, top right) */}
        <path
          d="M720 -10 Q680 15 630 30 Q580 45 530 65 Q480 85 430 95 Q380 105 340 108"
          stroke="url(#bark)" strokeWidth="26" fill="none" strokeLinecap="round"
        />
        <path
          d="M720 -18 Q680 7 630 22 Q580 37 530 57 Q480 77 430 87 Q380 97 340 100"
          stroke="url(#barkMoonlight)" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.5"
        />
        
        {/* Branch extension (tapering down) */}
        <path
          d="M360 106 Q320 110 280 115 Q240 120 200 122 Q170 124 150 125"
          stroke="url(#bark)" strokeWidth="12" fill="none" strokeLinecap="round"
        />
        <path
          d="M360 100 Q320 104 280 109 Q240 114 200 116 Q170 118 150 119"
          stroke="url(#barkMoonlight)" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.4"
        />

        {/* Sub-branch A (hang point at 570,82) */}
        <path d="M590 42 Q582 60 572 75 Q570 80 570 82" stroke="url(#bark)" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M595 40 Q587 58 577 73 Q575 78 575 80" stroke="url(#barkMoonlight)" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.3" />

        {/* Sub-branch B (hang point at 430,132) */}
        <path d="M450 88 Q442 105 434 120 Q430 130 430 132" stroke="url(#bark)" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M455 86 Q447 103 439 118 Q435 128 435 130" stroke="url(#barkMoonlight)" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.3" />

        {/* Sub-branch C (hang point at 308,146) */}
        <path d="M330 107 Q322 125 312 138 Q308 144 308 146" stroke="url(#bark)" strokeWidth="7" fill="none" strokeLinecap="round" />

        {/* Sub-branch D (hang point at 180,150) */}
        <path d="M195 122 Q190 135 184 145 Q180 148 180 150" stroke="url(#bark)" strokeWidth="5" fill="none" strokeLinecap="round" />

        {/* Small upper twigs (no lanterns, just for realism) */}
        <path d="M630 30 Q620 15 600 5" stroke="url(#bark)" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M510 75 Q495 55 475 45" stroke="url(#bark)" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M390 103 Q375 85 355 75" stroke="url(#bark)" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M260 117 Q250 105 235 95" stroke="url(#bark)" strokeWidth="3" fill="none" strokeLinecap="round" />
        
        {/* Bark texture lines (very subtle) */}
        <path d="M660 22 Q650 25 640 28" stroke="#0a0502" strokeWidth="1" opacity="0.5" />
        <path d="M550 58 Q540 62 530 65" stroke="#0a0502" strokeWidth="1" opacity="0.5" />
        <path d="M450 88 Q440 91 430 94" stroke="#0a0502" strokeWidth="1" opacity="0.5" />
        <path d="M350 105 Q340 107 330 108" stroke="#0a0502" strokeWidth="1" opacity="0.5" />

        {/* ═══════════ LEAVES (placed to not cover lanterns) ═══════════ */}
        <use href="#leaf-cluster" x="600" y="5" transform="rotate(-15, 600, 5)" />
        <use href="#leaf-cluster" x="610" y="10" transform="rotate(25, 610, 10)" />
        <use href="#leaf-cluster" x="475" y="45" transform="rotate(-30, 475, 45)" />
        <use href="#leaf-cluster-small" x="485" y="50" transform="rotate(10, 485, 50)" />
        <use href="#leaf-cluster" x="355" y="75" transform="rotate(-20, 355, 75)" />
        <use href="#leaf-cluster-small" x="365" y="80" transform="rotate(40, 365, 80)" />
        <use href="#leaf-cluster" x="235" y="95" transform="rotate(-10, 235, 95)" />
        <use href="#leaf-cluster-small" x="150" y="125" transform="rotate(15, 150, 125)" />
        
        {/* Additional filler leaves along main branch top */}
        <use href="#leaf-cluster-small" x="680" y="15" transform="rotate(10, 680, 15)" />
        <use href="#leaf-cluster-small" x="550" y="45" transform="rotate(5, 550, 45)" />
        <use href="#leaf-cluster-small" x="410" y="85" transform="rotate(-5, 410, 85)" />

        {/* ═══════════ STRINGS ═══════════ */}
        {/* String A */}
        <line x1="570" y1="82" x2="570" y2="140" stroke="#a08a50" strokeWidth="1.2" opacity="0.8" />
        {/* String B */}
        <line x1="430" y1="132" x2="430" y2="195" stroke="#a08a50" strokeWidth="1.2" opacity="0.8" />
        {/* String C */}
        <line x1="308" y1="146" x2="308" y2="200" stroke="#a08a50" strokeWidth="1.2" opacity="0.8" />
        {/* String D */}
        <line x1="180" y1="150" x2="180" y2="192" stroke="#a08a50" strokeWidth="1.2" opacity="0.8" />

        {/* ═══════════ LANTERNS ═══════════ */}
        {/* Lantern A: Large Traditional Octagonal */}
        <g className="lantern-swing lantern-swing--a">
          <circle cx="570" cy="210" r="65" fill="url(#ambientWarm)" className="glow-pulse" />
          
          <rect x="540" y="140" width="60" height="10" rx="3" fill="url(#goldCap)" />
          <rect x="564" y="132" width="12" height="10" rx="4" fill="url(#goldCap)" />

          <rect x="538" y="150" width="64" height="98" rx="2" fill="rgba(255,100,20,0.18)"
            style={{ clipPath: 'polygon(12% 0%, 88% 0%, 100% 10%, 100% 90%, 88% 100%, 12% 100%, 0% 90%, 0% 10%)' }} />

          <ellipse cx="570" cy="199" rx="22" ry="32" fill="url(#warmGlow)" className="glow-pulse" />

          <line x1="556" y1="150" x2="556" y2="248" stroke="rgba(230,180,34,0.4)" strokeWidth="0.8" />
          <line x1="570" y1="150" x2="570" y2="248" stroke="rgba(230,180,34,0.3)" strokeWidth="0.6" />
          <line x1="584" y1="150" x2="584" y2="248" stroke="rgba(230,180,34,0.4)" strokeWidth="0.8" />

          <line x1="538" y1="174" x2="602" y2="174" stroke="rgba(230,180,34,0.35)" strokeWidth="0.7" />
          <line x1="538" y1="199" x2="602" y2="199" stroke="rgba(230,180,34,0.35)" strokeWidth="0.7" />
          <line x1="538" y1="224" x2="602" y2="224" stroke="rgba(230,180,34,0.35)" strokeWidth="0.7" />

          <path d="M570 210C565 216 558 219 550 220C558 220 565 223 570 228C575 223 582 220 590 220C582 219 575 216 570 210Z"
            fill="rgba(255,140,0,0.4)" stroke="rgba(255,215,0,0.5)" strokeWidth="0.5" />

          <line x1="538" y1="152" x2="538" y2="246" stroke="rgba(230,180,34,0.6)" strokeWidth="1.5" />
          <line x1="602" y1="152" x2="602" y2="246" stroke="rgba(230,180,34,0.6)" strokeWidth="1.5" />

          <rect x="540" y="248" width="60" height="8" rx="3" fill="url(#goldCap)" />

          <line x1="552" y1="256" x2="552" y2="272" stroke="#c9972e" strokeWidth="1.2" opacity="0.8" />
          <line x1="558" y1="256" x2="558" y2="278" stroke="#e6b422" strokeWidth="1.2" opacity="0.8" />
          <line x1="564" y1="256" x2="564" y2="282" stroke="#ffd700" strokeWidth="1.2" opacity="0.9" />
          <line x1="570" y1="256" x2="570" y2="286" stroke="#e6b422" strokeWidth="1.2" opacity="0.9" />
          <line x1="576" y1="256" x2="576" y2="282" stroke="#ffd700" strokeWidth="1.2" opacity="0.9" />
          <line x1="582" y1="256" x2="582" y2="278" stroke="#e6b422" strokeWidth="1.2" opacity="0.8" />
          <line x1="588" y1="256" x2="588" y2="272" stroke="#c9972e" strokeWidth="1.2" opacity="0.8" />
        </g>

        {/* Lantern B: Star Shape */}
        <g className="lantern-swing lantern-swing--b">
          <circle cx="430" cy="245" r="55" fill="url(#ambientRed)" className="glow-pulse glow-pulse--delay" />
          
          <rect x="418" y="195" width="24" height="7" rx="2" fill="url(#goldCap)" />
          
          <polygon
            points="430,206 436,226 458,226 440,238 446,258 430,248 414,258 420,238 402,226 424,226"
            fill="rgba(220,50,40,0.22)"
            stroke="rgba(255,160,50,0.7)"
            strokeWidth="1"
          />
          <polygon
            points="430,214 434,228 448,228 437,236 440,250 430,244 420,250 423,236 412,228 426,228"
            fill="rgba(255,80,20,0.2)"
            stroke="rgba(255,215,0,0.4)"
            strokeWidth="0.5"
          />

          <circle cx="430" cy="235" r="15" fill="url(#redGlow)" className="glow-pulse" />

          <line x1="424" y1="258" x2="424" y2="270" stroke="#c9972e" strokeWidth="1.2" opacity="0.7" />
          <line x1="430" y1="260" x2="430" y2="276" stroke="#e6b422" strokeWidth="1.2" opacity="0.8" />
          <line x1="436" y1="258" x2="436" y2="270" stroke="#c9972e" strokeWidth="1.2" opacity="0.7" />
        </g>

        {/* Lantern C: Diamond / Rhombus */}
        <g className="lantern-swing lantern-swing--c">
          <circle cx="308" cy="245" r="48" fill="url(#ambientBlue)" className="glow-pulse" />

          <polygon
            points="308,200 338,240 308,280 278,240"
            fill="rgba(40,100,220,0.15)"
            stroke="rgba(100,180,255,0.6)"
            strokeWidth="1"
          />
          <polygon
            points="308,212 330,240 308,268 286,240"
            fill="rgba(50,120,240,0.12)"
            stroke="rgba(100,180,255,0.4)"
            strokeWidth="0.5"
          />

          <line x1="282" y1="240" x2="334" y2="240" stroke="rgba(100,180,255,0.45)" strokeWidth="0.6" />
          <line x1="308" y1="204" x2="308" y2="276" stroke="rgba(100,180,255,0.45)" strokeWidth="0.6" />

          <ellipse cx="308" cy="240" rx="14" ry="20" fill="url(#blueGlow)" className="glow-pulse glow-pulse--delay" />

          <line x1="302" y1="280" x2="302" y2="292" stroke="#8ab4d8" strokeWidth="1" opacity="0.6" />
          <line x1="308" y1="280" x2="308" y2="296" stroke="#a0c8e8" strokeWidth="1" opacity="0.7" />
          <line x1="314" y1="280" x2="314" y2="292" stroke="#8ab4d8" strokeWidth="1" opacity="0.6" />
        </g>

        {/* Lantern D: Small Round */}
        <g className="lantern-swing lantern-swing--d">
          <circle cx="180" cy="218" r="38" fill="url(#ambientGreen)" className="glow-pulse glow-pulse--delay" />

          <ellipse cx="180" cy="218" rx="18" ry="24"
            fill="rgba(40,180,60,0.18)"
            stroke="rgba(80,200,100,0.55)"
            strokeWidth="1"
          />

          <line x1="164" y1="210" x2="196" y2="210" stroke="rgba(80,200,100,0.4)" strokeWidth="0.6" />
          <line x1="163" y1="218" x2="197" y2="218" stroke="rgba(80,200,100,0.4)" strokeWidth="0.6" />
          <line x1="164" y1="226" x2="196" y2="226" stroke="rgba(80,200,100,0.4)" strokeWidth="0.6" />

          <ellipse cx="180" cy="218" rx="10" ry="14" fill="url(#greenGlow)" className="glow-pulse" />

          <line x1="177" y1="242" x2="177" y2="252" stroke="#6aaa70" strokeWidth="1" opacity="0.6" />
          <line x1="183" y1="242" x2="183" y2="254" stroke="#80c088" strokeWidth="1" opacity="0.7" />
        </g>
      </svg>
    </div>
  )
}
