import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import sun from "@/assets/youtopia-sun.png";

interface GeneratingStepProps {
  status?: string;
  themeName?: string;
}

const ROTATING = [
  "Reading your answers…",
  "Writing your meditation…",
  "Planting your Seeds…",
];

const GeneratingStep = ({ status, themeName }: GeneratingStepProps) => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % ROTATING.length), 2600);
    return () => clearInterval(t);
  }, []);

  // If the parent passed a specific status (e.g. "Creating voice narration..."),
  // show that. Otherwise rotate through the ceremonial copy.
  const message = status && status.length > 0 ? status : ROTATING[idx];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="flex flex-col items-center text-center"
      >
        <motion.img
          src={sun}
          alt=""
          className="w-24 h-24 mb-10"
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />

        <h2 className="font-heading text-3xl text-secondary mb-6 max-w-sm leading-tight">
          Creating your {themeName || "monthly"} practice…
        </h2>

        <AnimatePresence mode="wait">
          <motion.p
            key={message}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5 }}
            className="font-body text-accent text-base"
          >
            {message}
          </motion.p>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default GeneratingStep;
