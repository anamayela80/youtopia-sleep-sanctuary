import { motion } from "framer-motion";
import logo from "@/assets/youtopia-logo.png";

interface ThemeIntroStepProps {
  themeName: string;
  description: string;
  intention: string;
}

const ThemeIntroStep = ({ themeName, description, intention }: ThemeIntroStepProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.8 }}
    className="flex flex-col items-center text-center flex-1 justify-center px-4"
  >
    <img
      src={logo}
      alt="YOUTOPIA"
      style={{ objectFit: "contain" }}
      className="h-20 w-auto mb-10 mix-blend-multiply"
    />

    <motion.p
      className="font-body text-xs uppercase tracking-[0.2em] text-accent/70 mb-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
    >
      This is the theme for this month
    </motion.p>

    <motion.h1
      className="font-heading text-5xl md:text-6xl text-coral-dark mb-6 leading-[1.05] tracking-tight"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.2 }}
    >
      {themeName}
    </motion.h1>

    {(description || intention) && (
      <motion.p
        className="font-body text-base text-accent leading-relaxed mb-6 max-w-md"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4 }}
      >
        {description || intention}
      </motion.p>
    )}

  </motion.div>
);

export default ThemeIntroStep;
