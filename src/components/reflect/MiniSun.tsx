// MiniSun.jsx
// Renders one day's mood as a miniature of the Youtopia sun-mandala.
// mood: 0 (no data) | 1 heavy | 2 unsettled | 3 okay | 4 good | 5 alive

const SAGE = "#54a088";
const HAIRLINE = "#ddd0b7";

const RAY_SETS: Record<number, number[]> = {
  0: [],
  1: [],
  2: [45, 225],
  3: [0, 90, 180, 270],
  4: [0, 45, 135, 180, 225, 315],
  5: [0, 45, 90, 135, 180, 225, 270, 315],
};

interface MiniSunProps {
  mood?: number;
  size?: number;
  title?: string;
}

export function MiniSun({ mood = 0, size = 14, title }: MiniSunProps) {
  const rays = RAY_SETS[mood] ?? [];
  const checked = mood > 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {!checked && (
        <circle cx="12" cy="12" r="6" fill="none" stroke={HAIRLINE} strokeWidth="1" />
      )}
      {checked && (
        <circle cx="12" cy="12" r="3" fill="none" stroke={SAGE} strokeWidth="1.5" />
      )}
      {rays.map((deg) => (
        <g key={deg} transform={`rotate(${deg} 12 12)`}>
          <path d="M 12 1 L 13.4 5 L 12 7 L 10.6 5 Z" fill={SAGE} />
        </g>
      ))}
    </svg>
  );
}

export const MOOD_LABEL: Record<number, string> = {
  1: "heavy",
  2: "unsettled",
  3: "okay",
  4: "good",
  5: "alive",
};
