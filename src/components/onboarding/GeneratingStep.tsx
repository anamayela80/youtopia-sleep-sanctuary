import { motion } from "framer-motion";
import SunIcon from "@/components/SunIcon";

interface GeneratingStepProps {
  status: string;
}

const GeneratingStep = ({ status }: GeneratingStepProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center text-center"
      >
        {/* Animated sun */}
        <div className="mb-8">
          <SunIcon size={80} animate />
        </div>

        <h2 className="font-heading text-2xl text-secondary mb-3">
          Crafting your meditation
        </h2>

        <motion.p
          key={status}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-body text-muted-foreground mb-8"
        >
          {status}
        </motion.p>

        <div className="flex space-x-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-coral"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default GeneratingStep;
