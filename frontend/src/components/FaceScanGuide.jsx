import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ScanFace } from "lucide-react";

const FaceScanGuide = ({
  ready = false,
  sampleCount = 0,
  requiredSamples = 0,
  enrollment = false,
  direction = "center",
}) => {
  const completed = Math.min(sampleCount, requiredSamples);
  const DirectionIcon =
    direction === "left" ? ArrowLeft : direction === "right" ? ArrowRight : ScanFace;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-slate-950/10" />
      <div className="relative h-[80%] w-[58%] max-w-[20rem] sm:w-[46%]">
        <div
          className={`absolute inset-0 rounded-[48%] border-2 shadow-[0_0_0_999px_rgba(15,23,42,0.2)] transition-colors duration-300 ${
            ready ? "border-emerald-300" : "border-sky-200"
          }`}
        />
        <motion.div
          className={`absolute inset-[3%] rounded-[48%] border ${
            ready ? "border-emerald-300/80" : "border-sky-200/70"
          }`}
          animate={{ opacity: [0.35, 0.9, 0.35], scale: [0.98, 1.025, 0.98] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className={`absolute left-[12%] right-[12%] h-px shadow-[0_0_10px_currentColor] ${
            ready ? "bg-emerald-300 text-emerald-300" : "bg-sky-200 text-sky-200"
          }`}
          animate={{ top: ["16%", "80%", "16%"] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
        {enrollment && (
          <motion.div
            className="absolute left-1/2 top-[43%] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/35 p-3 text-white"
            animate={
              direction === "left"
                ? { x: [-4, -18, -4], opacity: [0.65, 1, 0.65] }
                : direction === "right"
                  ? { x: [4, 18, 4], opacity: [0.65, 1, 0.65] }
                  : { scale: [0.92, 1.08, 0.92], opacity: [0.65, 1, 0.65] }
            }
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <DirectionIcon className="h-7 w-7" strokeWidth={2} />
          </motion.div>
        )}
        {enrollment && requiredSamples > 0 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950/35 px-3 py-2">
            {Array.from({ length: requiredSamples }, (_, index) => (
              <span
                key={index}
                className={`h-2 w-2 rounded-full border border-white/80 transition-colors ${
                  index < completed ? "bg-emerald-300" : "bg-white/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FaceScanGuide;
