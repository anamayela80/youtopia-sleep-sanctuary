import { motion } from "framer-motion";
import logo from "@/assets/youtopia-logo.png";

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
        {/* Animated spiral */}
        <motion.div
          className="w-32 h-32 rounded-full bg-gradient-to-br from-teal-light via-primary/30 to-coral-light flex items-center justify-center mb-8"
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-primary/20 to-coral-light/50 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-cream-light flex items-center justify-center">
              <motion.div
                className="w-3 h-3 rounded-full bg-primary"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
          </div>
        </motion.div>

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
              className="w-2 h-2 rounded-full bg-primary"
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
