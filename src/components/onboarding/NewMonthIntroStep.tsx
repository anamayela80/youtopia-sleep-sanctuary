import { motion } from "framer-motion";
import logo from "@/assets/youtopia-logo.png";

interface NewMonthIntroStepProps {
  monthName: string;
}

const NewMonthIntroStep = ({ monthName }: NewMonthIntroStepProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.7 }}
    className="flex flex-col items-center text-center flex-1 justify-center px-2"
  >
    <img src={logo} alt="YOUTOPIA" className="h-24 md:h-28 mb-10 mix-blend-multiply" />

    <h1 className="font-heading text-4xl text-secondary mb-6 leading-tight">
      A new chapter is ready for you.
    </h1>

    <p className="font-body text-accent leading-relaxed max-w-md">
      Let's set your intention for {monthName}.
    </p>
  </motion.div>
);

export default NewMonthIntroStep;
