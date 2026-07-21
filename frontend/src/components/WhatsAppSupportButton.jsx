import React from "react";
import { FaWhatsapp } from "react-icons/fa";

export const WHATSAPP_SUPPORT_LINK =
  "https://chat.whatsapp.com/GFUFRwZOBBD9E5Xv0bZaCT?mode=gi_t";

const variantClasses = {
  solid:
    "bg-[#25D366] text-white hover:bg-[#1ebe5d] shadow-lg shadow-[#25D366]/20",
  light:
    "bg-white text-[#128C7E] hover:bg-[#f0fff7] border border-[#25D366]/25 shadow-sm",
  outline:
    "bg-transparent text-[#128C7E] hover:bg-[#25D366]/10 border border-[#25D366]/40",
};

const sizeClasses = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-3 text-sm",
  lg: "px-5 py-3.5 text-base",
};

const WhatsAppSupportButton = ({
  className = "",
  label = "Contact Support",
  size = "md",
  variant = "solid",
}) => {
  return (
    <a
      href={WHATSAPP_SUPPORT_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contact TalentHub support on WhatsApp"
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-200 active:scale-95",
        variantClasses[variant] || variantClasses.solid,
        sizeClasses[size] || sizeClasses.md,
        className,
      ].join(" ")}
    >
      <FaWhatsapp className="h-5 w-5" />
      <span>{label}</span>
    </a>
  );
};

export default WhatsAppSupportButton;
