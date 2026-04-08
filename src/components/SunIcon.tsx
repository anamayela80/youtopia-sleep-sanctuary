import { motion } from "framer-motion";

interface SunIconProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

/**
 * Spiral sun motif inspired by the YOUTOPIA logo.
 * Uses coral salmon (--coral) as the primary color.
 */
const SunIcon = ({ size = 48, className = "", animate = false }: SunIconProps) => {
  const Wrapper = animate ? motion.div : "div";
  const wrapperProps = animate
    ? { animate: { rotate: 360 }, transition: { duration: 30, repeat: Infinity, ease: "linear" as const } }
    : {};

  return (
    <Wrapper className={className} {...wrapperProps}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Central circle */}
        <circle cx="32" cy="32" r="10" fill="hsl(var(--coral))" />
        {/* Rays — 12 organic petals */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = i * 30;
          return (
            <line
              key={i}
              x1="32"
              y1="32"
              x2={32 + 22 * Math.cos((angle * Math.PI) / 180)}
              y2={32 + 22 * Math.sin((angle * Math.PI) / 180)}
              stroke="hsl(var(--coral))"
              strokeWidth={i % 2 === 0 ? 2.5 : 1.5}
              strokeLinecap="round"
              opacity={i % 2 === 0 ? 1 : 0.5}
            />
          );
        })}
        {/* Inner spiral suggestion */}
        <circle cx="32" cy="32" r="16" stroke="hsl(var(--coral))" strokeWidth="1" opacity="0.3" fill="none" />
      </svg>
    </Wrapper>
  );
};

export default SunIcon;
