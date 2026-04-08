import { motion } from "framer-motion";
import SunIcon from "@/components/SunIcon";

interface ThemeIntroStepProps {
  themeName: string;
  description: string;
  intention: string;
}

const ThemeIntroStep = ({ themeName, description, intention }: ThemeIntroStepProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.8 }}
      className="flex flex-col items-center text-center flex-1 justify-center px-4"
    >
      {/* Decorative sun from logo */}
      <motion.div
        className="mb-8"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, delay: 0.2 }}
      >
        <div className="w-20 h-20 rounded-full bg-coral/10 flex items-center justify-center">
          <SunIcon size={44} animate />
        </div>
      </motion.div>

      {/* Theme name — large serif heading */}
      <motion.h1
        className="font-heading text-4xl md:text-5xl text-secondary mb-6 leading-tight tracking-tight"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4 }}
      >
        {themeName}
      </motion.h1>

      {/* Description — 2-3 sentences */}
      <motion.p
        className="font-body text-base text-accent leading-relaxed mb-8 max-w-sm"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.7 }}
      >
        {description}
      </motion.p>

      {/* Core intention — italic */}
      <motion.p
        className="font-body text-sm text-muted-foreground italic max-w-xs leading-relaxed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 1.0 }}
      >
        "{intention}"
      </motion.p>
    </motion.div>
  );
};

export default ThemeIntroStep;
