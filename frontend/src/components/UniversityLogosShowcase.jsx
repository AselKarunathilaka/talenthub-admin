import React from "react";
import { motion } from "framer-motion";

/**
 * High-quality transparent vector logos/crests for top Sri Lankan Universities
 * Designed without backgrounds for pristine display on glassmorphic dark panels.
 */
export const SRI_LANKAN_UNIVERSITIES = [
  {
    id: "nsbm",
    name: "NSBM Green University",
    shortName: "NSBM",
    type: "State-affiliated / UGC Recognized",
    accentColor: "#50b748",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 4L54 16V36C54 48 44 57 32 60C20 57 10 48 10 36V16L32 4Z" fill="#14532d" stroke="#50b748" strokeWidth="2.5"/>
        <path d="M32 14C32 14 42 22 42 34C42 41 37 46 32 48C27 46 22 41 22 34C22 22 32 14 32 14Z" fill="#22c55e"/>
        <path d="M32 20V46M32 28L39 23M32 34L40 30M32 28L25 23M32 34L24 30" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="32" cy="14" r="2.5" fill="#facc15"/>
      </svg>
    ),
  },
  {
    id: "uom",
    name: "University of Moratuwa",
    shortName: "UoM",
    type: "State University",
    accentColor: "#991b1b",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="27" fill="#7f1d1d" stroke="#f59e0b" strokeWidth="2.5"/>
        <circle cx="32" cy="32" r="21" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="3 2"/>
        {/* Gear / Engineering motif */}
        <path d="M32 18V22M32 42V46M18 32H22M42 32H46M22 22L25 25M39 39L42 42M22 42L25 39M39 25L42 22" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round"/>
        <circle cx="32" cy="32" r="7" fill="#f59e0b"/>
        <polygon points="32,27 34,31 38,32 35,35 36,39 32,37 28,39 29,35 26,32 30,31" fill="#7f1d1d"/>
      </svg>
    ),
  },
  {
    id: "sliit",
    name: "Sri Lanka Institute of Information Technology",
    shortName: "SLIIT",
    type: "UGC Recognized Degree Awarding",
    accentColor: "#0284c7",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="12" width="48" height="40" rx="10" fill="#0369a1" stroke="#38bdf8" strokeWidth="2.2"/>
        {/* Modern SLIIT Ribbon / Node Emblem */}
        <path d="M18 38C18 26 30 18 42 22C46 23.5 48 27 45 31C41 36 26 31 22 42" stroke="#ffffff" strokeWidth="3" strokeLinecap="round"/>
        <path d="M22 24C28 32 40 34 46 42" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="45" cy="22" r="3" fill="#38bdf8"/>
        <circle cx="19" cy="40" r="3" fill="#f59e0b"/>
      </svg>
    ),
  },
  {
    id: "uoc",
    name: "University of Colombo",
    shortName: "UoC",
    type: "State University",
    accentColor: "#b91c1c",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="32,6 56,18 56,46 32,58 8,46 8,18" fill="#881337" stroke="#fbbf24" strokeWidth="2.2"/>
        {/* Clock tower & palm insignia */}
        <rect x="28" y="22" width="8" height="22" fill="#fbbf24" rx="1.5"/>
        <polygon points="32,14 26,22 38,22" fill="#fbbf24"/>
        <circle cx="32" cy="28" r="2" fill="#881337"/>
        <path d="M20 42C24 38 28 40 32 40C36 40 40 38 44 42" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "usj",
    name: "University of Sri Jayewardenepura",
    shortName: "USJ",
    type: "State University",
    accentColor: "#7e22ce",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="26" fill="#581c87" stroke="#f59e0b" strokeWidth="2.2"/>
        {/* Traditional flame & book */}
        <path d="M32 14C32 14 38 22 36 28C34 33 30 33 28 28C26 23 32 14 32 14Z" fill="#f59e0b"/>
        <path d="M32 18C32 18 35 23 34 26C33 29 31 29 30 26C29 23 32 18 32 18Z" fill="#ef4444"/>
        <path d="M16 42C22 38 32 40 32 40C32 40 42 38 48 42L48 46C42 42 32 44 32 44C32 44 22 42 16 46Z" fill="#ffffff"/>
      </svg>
    ),
  },
  {
    id: "uop",
    name: "University of Peradeniya",
    shortName: "UoP",
    type: "State University",
    accentColor: "#d97706",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="27" fill="#78350f" stroke="#fbbf24" strokeWidth="2.5"/>
        {/* Kandyan Lion Motif & Sarasavi lotus */}
        <circle cx="32" cy="32" r="18" fill="#b45309" stroke="#fbbf24" strokeWidth="1.2"/>
        <path d="M24 35C24 28 32 24 32 24C32 24 40 28 40 35C40 39 36 41 32 41C28 41 24 39 24 35Z" fill="#fbbf24"/>
        <circle cx="32" cy="22" r="3" fill="#fef08a"/>
        <circle cx="32" cy="33" r="2.5" fill="#78350f"/>
      </svg>
    ),
  },
  {
    id: "uok",
    name: "University of Kelaniya",
    shortName: "UoK",
    type: "State University",
    accentColor: "#be185d",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="26" fill="#831843" stroke="#f472b6" strokeWidth="2.2"/>
        {/* Sacred swan / Hamsa motif */}
        <path d="M22 36C22 28 30 20 38 22C42 23 44 26 42 29C40 32 35 30 33 34C31 38 38 38 42 42C36 45 22 44 22 36Z" fill="#fbcfe8"/>
        <circle cx="38" cy="25" r="1.5" fill="#831843"/>
        <path d="M18 45H46" stroke="#fbcfe8" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "iit",
    name: "Informatics Institute of Technology",
    shortName: "IIT",
    type: "Private Higher Education",
    accentColor: "#ea580c",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="10" width="44" height="44" rx="10" fill="#1e293b" stroke="#f97316" strokeWidth="2.5"/>
        <path d="M20 22H26V42H20V22Z" fill="#f97316"/>
        <path d="M30 22H36V42H30V22Z" fill="#f97316"/>
        <path d="M40 22H48V28H44V42H38V28H40V22Z" fill="#38bdf8"/>
        <circle cx="23" cy="16" r="2" fill="#f97316"/>
        <circle cx="33" cy="16" r="2" fill="#f97316"/>
      </svg>
    ),
  },
  {
    id: "uor",
    name: "University of Ruhuna",
    shortName: "UoR",
    type: "State University",
    accentColor: "#0369a1",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 6L54 18V38C54 49 44 57 32 60C20 57 10 49 10 38V18L32 6Z" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="2.2"/>
        {/* Lighthouse & ocean waves */}
        <polygon points="32,16 28,38 36,38" fill="#fbbf24"/>
        <rect x="30" y="14" width="4" height="4" fill="#ffffff"/>
        <path d="M18 44C24 41 28 45 32 43C36 41 40 45 46 42" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "kdu",
    name: "General Sir John Kotelawala Defence University",
    shortName: "KDU",
    type: "Defence & State University",
    accentColor: "#0f766e",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="32,4 56,16 56,44 32,60 8,44 8,16" fill="#134e4a" stroke="#2dd4bf" strokeWidth="2.2"/>
        {/* Crossed swords & book */}
        <path d="M22 22L42 42M42 22L22 42" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="32" cy="32" r="5" fill="#134e4a" stroke="#facc15" strokeWidth="2"/>
      </svg>
    ),
  },
  {
    id: "sltc",
    name: "SLTC Research University",
    shortName: "SLTC",
    type: "Non-State Research University",
    accentColor: "#2563eb",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="12" width="48" height="40" rx="8" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="2"/>
        <path d="M20 36L32 20L44 36H20Z" stroke="#60a5fa" strokeWidth="2.5" fill="none"/>
        <circle cx="32" cy="29" r="3" fill="#facc15"/>
        <path d="M16 44H48" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "cinec",
    name: "CINEC Campus",
    shortName: "CINEC",
    type: "Maritime & Multi-Faculty Campus",
    accentColor: "#0284c7",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="26" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.2"/>
        {/* Ship's wheel */}
        <circle cx="32" cy="32" r="14" stroke="#38bdf8" strokeWidth="2.5" fill="none"/>
        <path d="M32 10V54M10 32H54M16 16L48 48M16 48L48 16" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="32" cy="32" r="5" fill="#38bdf8"/>
      </svg>
    ),
  },
  {
    id: "ousl",
    name: "Open University of Sri Lanka",
    shortName: "OUSL",
    type: "National Open University",
    accentColor: "#15803d",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="26" fill="#14532d" stroke="#86efac" strokeWidth="2.2"/>
        {/* Open book & torch */}
        <path d="M18 36C24 32 32 34 32 34C32 34 40 32 46 36V44C40 40 32 42 32 42C32 42 24 40 18 44V36Z" fill="#facc15"/>
        <path d="M32 16V34" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round"/>
        <polygon points="32,12 29,17 35,17" fill="#ef4444"/>
      </svg>
    ),
  },
  {
    id: "horizon",
    name: "Horizon Campus",
    shortName: "Horizon",
    type: "UGC Recognized University College",
    accentColor: "#0284c7",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="10" width="48" height="44" rx="12" fill="#075985" stroke="#38bdf8" strokeWidth="2"/>
        {/* Rising sun / Horizon */}
        <path d="M16 38H48" stroke="#ffffff" strokeWidth="2.5"/>
        <path d="M22 38C22 28 42 28 42 38" fill="#f97316"/>
        <path d="M32 20V14M22 24L18 20M42 24L46 20" stroke="#facc15" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "nibm",
    name: "National Institute of Business Management",
    shortName: "NIBM",
    type: "National Business Institute",
    accentColor: "#ca8a04",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="32,6 54,19 54,45 32,58 10,45 10,19" fill="#713f12" stroke="#eab308" strokeWidth="2.2"/>
        {/* Modern NIBM abstract structure */}
        <polygon points="32,18 44,25 44,39 32,46 20,39 20,25" fill="#ca8a04"/>
        <circle cx="32" cy="32" r="5" fill="#ffffff"/>
      </svg>
    ),
  },
  {
    id: "uwu",
    name: "Uva Wellassa University",
    shortName: "UWU",
    type: "Value Addition Entrepreneurial Uni",
    accentColor: "#b45309",
    logoSvg: (
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="26" fill="#451a03" stroke="#f59e0b" strokeWidth="2.2"/>
        {/* Mountain peak & entrepreneurial torch */}
        <polygon points="32,14 46,44 18,44" fill="#b45309"/>
        <polygon points="32,24 40,44 24,44" fill="#f59e0b"/>
        <circle cx="32" cy="14" r="3" fill="#facc15"/>
      </svg>
    ),
  },
];

const UniversityLogosShowcase = ({ onSelectUniversity }) => {
  return (
    <div className="w-full">
      {/* University Grid (3 columns on desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-[380px] xl:max-h-[440px] overflow-y-auto pr-1.5 custom-scrollbar">
        {SRI_LANKAN_UNIVERSITIES.map((uni, idx) => (
          <motion.div
            key={uni.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + idx * 0.03, duration: 0.35 }}
            onClick={() => onSelectUniversity && onSelectUniversity(uni.name)}
            className="group relative flex flex-col items-center justify-between p-3 rounded-2xl cursor-pointer transition-all duration-300 backdrop-blur-md"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.07)",
            }}
            whileHover={{
              scale: 1.04,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              borderColor: `${uni.accentColor}80`,
              boxShadow: `0 8px 24px ${uni.accentColor}25`,
            }}
          >
            {/* Vector Emblem - Zero Background */}
            <div className="w-12 h-12 mb-2 p-1 relative flex items-center justify-center filter drop-shadow-md group-hover:scale-110 transition-transform duration-300">
              {uni.logoSvg}
            </div>

            {/* University Name */}
            <div className="text-center w-full">
              <span className="block text-xs font-bold text-white tracking-tight leading-tight line-clamp-1 group-hover:text-[#00b4eb] transition-colors">
                {uni.shortName}
              </span>
              <p className="text-[10px] text-white/50 leading-tight mt-0.5 line-clamp-2">
                {uni.name}
              </p>
            </div>

            {/* Selection indicator hint */}
            <div
              className="mt-2 w-full py-0.5 rounded-full text-[9px] font-semibold text-center uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: `${uni.accentColor}25`,
                color: uni.accentColor,
              }}
            >
              Select
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default UniversityLogosShowcase;
