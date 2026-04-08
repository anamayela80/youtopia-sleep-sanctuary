import { motion } from "framer-motion";

interface ThemeIntroStepProps {
  themeName: string;
  description: string;
  intention: string;
}

const ThemeIntroStep = ({ themeName, description, intention }: ThemeIntroStepProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.6 }}
      className="flex flex-col items-center text-center flex-1 justify-center"
    >
      <div className="text-4xl mb-6">🌀</div>

      <h1 className="font-heading text-3xl text-secondary mb-4 leading-snug">
        {themeName}
      </h1>

      <p className="font-body text-accent leading-relaxed mb-6 max-w-sm">
        {description}
      </p>

      <p className="font-body text-sm text-muted-foreground italic max-w-xs">
        {intention}
      </p>
    </motion.div>
  );
};

export default ThemeIntroStep;
