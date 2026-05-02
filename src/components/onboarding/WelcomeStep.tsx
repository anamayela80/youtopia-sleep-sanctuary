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
        YOUtopia is not an app. It is a monthly inner practice, built from your own answers,
        spoken in your own voice, delivered at the exact moments your brain is most open to change.
      </p>
      <p>
        Morning and evening. The morning practice sets the tone for the day. Your evening Seeds
        plant it while you sleep. Together, they compound in a way neither can do alone.
      </p>
      <p className="italic text-foreground/80">
        Nothing here is generic. Every word you are about to hear was written for you, from what
        you are about to share.
      </p>
      <p className="font-heading text-xl text-coral-dark pt-2">
        Are you ready?
      </p>
    </div>
  </motion.div>
);

export default WelcomeStep;
