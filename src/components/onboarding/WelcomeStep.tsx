import { motion } from "framer-motion";
import logo from "@/assets/youtopia-logo.png";

interface WelcomeStepProps {
  userFirstName: string;
}

const WelcomeStep = ({ userFirstName }: WelcomeStepProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.7 }}
    className="flex flex-col items-center text-center flex-1 justify-center px-2"
  >
    <img src={logo} alt="YOUTOPIA" className="h-24 md:h-28 mb-10 mix-blend-multiply" />

    <h1 className="font-heading text-4xl text-secondary mb-6 leading-tight">
      Welcome, {userFirstName || "friend"}.
    </h1>

    <div className="space-y-5 max-w-md font-body text-accent leading-relaxed">
      <p>
        You've just stepped into something built differently. Youtopia is not a meditation app.
        It's a monthly practice that goes somewhere most apps are afraid to go — into the real questions,
        the ones that actually change how you feel from the inside out.
      </p>
      <p>
        Every month you'll receive a morning meditation built entirely around your answers to five questions.
        And every night, five Seeds — whispered in your own voice — will plant new beliefs while you sleep.
      </p>
      <p className="italic text-foreground/80">
        This is not generic. Nothing here is for everyone. It is made, every month, specifically for you.
      </p>
      <p className="font-heading text-xl text-coral-dark pt-2">
        Are you ready to begin?
      </p>
    </div>
  </motion.div>
);

export default WelcomeStep;
