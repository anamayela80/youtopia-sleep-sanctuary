import { motion } from "framer-motion";
import logo from "@/assets/youtopia-logo.png";

interface WelcomeStepProps {
  userFirstName: string;
  onSignOut?: () => void;
}

const WelcomeStep = ({ userFirstName, onSignOut }: WelcomeStepProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.7 }}
    className="flex flex-col items-center text-center flex-1 justify-center px-2"
  >
    <img
      src={logo}
      alt="YOUTOPIA"
      style={{ objectFit: "contain" }}
      className="h-24 w-auto mb-10 mix-blend-multiply"
    />

    <h1 className="font-heading text-4xl text-secondary mb-6 leading-tight">
      Welcome, {userFirstName || "friend"}.
    </h1>

    <div className="space-y-5 max-w-md font-body text-accent leading-relaxed">
      <p>
        You are about to create your own utopia. A state. A version of you
        that thinks, feels, and moves through the world differently. That is what this practice
        builds.
      </p>
      <p>
        Here is what science tells us: your brain cannot tell the difference between a vividly
        imagined experience and a real one. The same neural circuits fire. The same chemistry
        releases. When you return to a vision every day with full sensory detail and genuine
        emotion, you are building a memory of it.
        Repetition is what turns a memory into a belief.
      </p>
      <p>
        At night, your Seeds are designed to be the last thing you hear before sleep. Drifting
        off while listening is encouraged. As you fall asleep, the words slip past the conscious
        mind and settle exactly where they need to.
      </p>
      <p className="italic text-foreground/80">
        Nothing here is generic. Everything you are about to experience is built from your
        answers, for you alone.
      </p>
      <p className="font-heading text-xl text-coral-dark pt-2">
        Are you ready to begin?
      </p>
    </div>
    {onSignOut && (
      <button
        type="button"
        onClick={onSignOut}
        className="mt-8 font-body text-sm text-muted-foreground underline underline-offset-4 hover:text-secondary"
      >
        Sign out
      </button>
    )}
  </motion.div>
);

export default WelcomeStep;
