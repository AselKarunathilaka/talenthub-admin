import React from "react";
import { motion } from "framer-motion";
import { FiCheckCircle, FiXCircle } from "react-icons/fi";

/**
 * LivePassIndicator
 * ------------------
 * A small animated pill used anywhere a short-leave pass's live validity
 * needs to be shown (the pass preview card in "My Requests" AND the full
 * live pass screen). It renders 3 pulsing dots + a label, colored green
 * while the pass is live/valid and red once it has expired.
 *
 * Why this exists: the request-list card used to show a plain, static
 * "Approved" badge that never changed even after the pass expired at
 * 4:30 PM. A screenshot of that static badge looked identical whether the
 * pass was live or long expired, so it could be reused/shared to bypass
 * security. Because this indicator is animated, a screenshot freezes the
 * dots mid-pulse, making it visually obvious (to anyone trained to look
 * for the animation) that what they're viewing is not the live pass.
 *
 * Props:
 *  - isLive: boolean — true = green "LIVE" state, false = red "EXPIRED" state
 *  - label: optional override for the two labels, e.g. { live: "VALID", expired: "EXPIRED" }
 *  - size: "sm" | "md" (default "sm") — sm is for compact list rows, md for larger cards
 */
const LivePassIndicator = ({ isLive, label, size = "sm" }) => {
    const text = isLive ? (label?.live || "LIVE") : (label?.expired || "EXPIRED");
    const dotColor = isLive ? "bg-[#50b748]" : "bg-rose-400";
    const isSmall = size === "sm";

    return (
        <div
            className={`inline-flex items-center gap-2 rounded-full border font-black uppercase tracking-widest ${isSmall ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-xs"
                } ${isLive
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
        >
            {isLive ? (
                <FiCheckCircle size={isSmall ? 11 : 13} />
            ) : (
                <FiXCircle size={isSmall ? 11 : 13} />
            )}
            <span>{text}</span>
            <span className="flex items-center gap-[3px]">
                {[...Array(3)].map((_, i) => (
                    <motion.span
                        key={i}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                        className={`rounded-full ${dotColor} ${isSmall ? "w-1.5 h-1.5" : "w-2 h-2"}`}
                    />
                ))}
            </span>
        </div>
    );
};

export default LivePassIndicator;
