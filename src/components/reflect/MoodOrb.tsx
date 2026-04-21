import { motion } from "framer-motion";

export type MoodKey = "heavy" | "unsettled" | "okay" | "good" | "alive";

export interface MoodConfig {
  key: MoodKey;
  label: string;
  color: string;
  bgUnselected: string;
  shadow: string;
}

export const MOODS: MoodConfig[] = [
  {
    key: "heavy",
    label: "heavy",
    color: "#7A9BB5",
    bgUnselected: "rgba(122, 155, 181, 0.1)",
    shadow: "0 6px 20px rgba(122, 155, 181, 0.4)",
  },
  {
    key: "unsettled",
    label: "unsettled",
    color: "#9B8BBE",
    bgUnselected: "rgba(155, 139, 190, 0.1)",
    shadow: "0 6px 20px rgba(155, 139, 190, 0.4)",
  },
  {
    key: "okay",
    label: "okay",
    color: "#B89A6A",
    bgUnselected: "rgba(184, 154, 106, 0.1)",
    shadow: "0 6px 20px rgba(184, 154, 106, 0.4)",
  },
  {
    key: "good",
    label: "good",
    color: "#C4A030",
    bgUnselected: "rgba(196, 160, 48, 0.1)",
    shadow: "0 6px 20px rgba(196, 160, 48, 0.4)",
  },
  {
    key: "alive",
    label: "alive",
    color: "#C4604A",
    bgUnselected: "rgba(196, 96, 74, 0.1)",
    shadow: "0 6px 20px rgba(196, 96, 74, 0.4)",
  },
];

const STROKE = 1.3;

const HeavyIcon = ({ stroke }: { stroke: string }) => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
    <path
      d="M5 8 Q 9 5, 13 8 T 21 8"
      stroke={stroke}
      strokeWidth={STROKE}
      strokeLinecap="round"
      fill="none"
      opacity={0.2}
    />
    <path
      d="M5 13 Q 9 10, 13 13 T 21 13"
      stroke={stroke}
      strokeWidth={STROKE}
      strokeLinecap="round"
      fill="none"
      opacity={0.5}
    />
    <path
      d="M5 19 Q 9 16, 13 19 T 21 19"
      stroke={stroke}
      strokeWidth={STROKE}
      strokeLinecap="round"
      fill="none"
      opacity={1}
    />
  </svg>
);

const UnsettledIcon = ({ stroke }: { stroke: string }) => {
  const path = (x: number) =>
    `M ${x} 6 C ${x - 2.2} 9, ${x + 2.2} 13, ${x} 16 S ${x - 2.2} 19, ${x} 21`;
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <path d={path(8)} stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" fill="none" opacity={0.45} />
      <path d={path(13)} stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" fill="none" opacity={1} />
      <path d={path(18)} stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" fill="none" opacity={0.45} />
    </svg>
  );
};

const OkayIcon = ({ stroke }: { stroke: string }) => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
    <line x1="6" y1="9" x2="20" y2="9" stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" opacity={0.4} />
    <line x1="6" y1="13" x2="20" y2="13" stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" opacity={1} />
    <line x1="6" y1="17" x2="20" y2="17" stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" opacity={0.4} />
  </svg>
);

const GoodIcon = ({ stroke }: { stroke: string }) => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
    <polygon
      points="13,4 22,13 13,22 4,13"
      stroke={stroke}
      strokeWidth={STROKE}
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="13" cy="13" r="2.2" fill={stroke} opacity={0.4} />
  </svg>
);

const AliveIcon = ({ stroke }: { stroke: string }) => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
    <circle cx="13" cy="13" r="2.2" fill={stroke} />
    {/* cardinal */}
    <line x1="13" y1="3" x2="13" y2="7" stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" />
    <line x1="13" y1="19" x2="13" y2="23" stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" />
    <line x1="3" y1="13" x2="7" y2="13" stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" />
    <line x1="19" y1="13" x2="23" y2="13" stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" />
    {/* diagonals */}
    <line x1="6" y1="6" x2="9" y2="9" stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" opacity={0.5} />
    <line x1="20" y1="6" x2="17" y2="9" stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" opacity={0.5} />
    <line x1="6" y1="20" x2="9" y2="17" stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" opacity={0.5} />
    <line x1="20" y1="20" x2="17" y2="17" stroke={stroke} strokeWidth={STROKE} strokeLinecap="round" opacity={0.5} />
  </svg>
);

const ICONS: Record<MoodKey, (p: { stroke: string }) => JSX.Element> = {
  heavy: HeavyIcon,
  unsettled: UnsettledIcon,
  okay: OkayIcon,
  good: GoodIcon,
  alive: AliveIcon,
};

interface MoodOrbProps {
  mood: MoodConfig;
  selected: boolean;
  disabled?: boolean;
  glowing?: boolean;
  onSelect?: () => void;
}

export const MoodOrb = ({ mood, selected, disabled, glowing, onSelect }: MoodOrbProps) => {
  const Icon = ICONS[mood.key];
  const filled = selected || glowing;
  const strokeColor = filled ? "#FFFFFF" : mood.color;

  return (
    <div className="flex flex-col items-center" style={{ gap: "9px" }}>
      <motion.button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-label={mood.label}
        className="rounded-full flex items-center justify-center"
        style={{
          width: "54px",
          height: "54px",
          background: filled ? mood.color : mood.bgUnselected,
          border: `1.5px solid ${mood.color}`,
          boxShadow: filled ? mood.shadow : "none",
          cursor: disabled ? "default" : "pointer",
        }}
        animate={{ scale: selected ? 1.18 : 1 }}
        transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <Icon stroke={strokeColor} />
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
