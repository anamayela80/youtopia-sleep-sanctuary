import { motion } from "framer-motion";
import heavyImg from "@/assets/mood-heavy.png";
import unsettledImg from "@/assets/mood-unsettled.png";
import okayImg from "@/assets/mood-okay.png";
import goodImg from "@/assets/mood-good.png";
import aliveImg from "@/assets/mood-alive.png";

export type MoodKey = "heavy" | "unsettled" | "okay" | "good" | "alive";

export interface MoodConfig {
  key: MoodKey;
  label: string;
  color: string;
  bgUnselected: string;
  shadow: string;
  icon: string;
}

const SAGE = "#54a088";
const SAGE_BG = "rgba(84, 160, 136, 0.10)";
const SAGE_SHADOW = "0 6px 20px rgba(84, 160, 136, 0.35)";

export const MOODS: MoodConfig[] = [
  { key: "heavy",     label: "heavy",     color: SAGE, bgUnselected: SAGE_BG, shadow: SAGE_SHADOW, icon: heavyImg },
  { key: "unsettled", label: "unsettled", color: SAGE, bgUnselected: SAGE_BG, shadow: SAGE_SHADOW, icon: unsettledImg },
  { key: "okay",      label: "okay",      color: SAGE, bgUnselected: SAGE_BG, shadow: SAGE_SHADOW, icon: okayImg },
  { key: "good",      label: "good",      color: SAGE, bgUnselected: SAGE_BG, shadow: SAGE_SHADOW, icon: goodImg },
  { key: "alive",     label: "alive",     color: SAGE, bgUnselected: SAGE_BG, shadow: SAGE_SHADOW, icon: aliveImg },
];

interface MoodOrbProps {
  mood: MoodConfig;
  selected: boolean;
  disabled?: boolean;
  glowing?: boolean;
  onSelect?: () => void;
}

export const MoodOrb = ({ mood, selected, disabled, glowing, onSelect }: MoodOrbProps) => {
  const filled = selected || glowing;

  return (
    <div className="flex flex-col items-center" style={{ gap: "9px" }}>
      <motion.button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-label={mood.label}
        className="rounded-full flex items-center justify-center"
        style={{
          width: "60px",
          height: "60px",
          background: "transparent",
          border: "none",
          filter: filled ? `drop-shadow(${SAGE_SHADOW})` : "none",
          opacity: filled ? 1 : 0.55,
          cursor: disabled ? "default" : "pointer",
        }}
        animate={{ scale: selected ? 1.18 : 1 }}
        transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <img
          src={mood.icon}
          alt={mood.label}
          style={{ width: "56px", height: "56px", objectFit: "contain" }}
        />
      </motion.button>
      <span
        className="italic"
        style={{
          fontSize: "10px",
          color: mood.color,
          fontFamily: "Georgia, serif",
          lineHeight: 1,
        }}
      >
        {mood.label}
      </span>
    </div>
  );
};
