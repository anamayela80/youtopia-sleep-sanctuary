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
        Each month you work with one intention. One theme to return to, morning and night,
        until it becomes part of how you move through the world.
      </p>
      <p>
        The practice happens twice a day. A morning session to set the tone before the day
        begins. An evening Seed to reach you as you fall asleep.
      </p>
      <p>
        For your evening Seed, you will have the option to record it in your own voice. This
        is recommended. Your brain responds differently to a voice it already trusts. But the
        YOUtopia voice is always there if you prefer it.
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
