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
    <img src={logo} alt="YOUTOPIA" className="h-20 md:h-24 mb-10 mix-blend-multiply" />

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

    <motion.p
      className="font-body text-sm text-muted-foreground italic max-w-xs leading-relaxed"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7, delay: 0.7 }}
    >
      Your five questions are drawn from this theme.
    </motion.p>
  </motion.div>
);

export default ThemeIntroStep;
