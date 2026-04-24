import { motion } from "framer-motion";
import logo from "@/assets/youtopia-logo.png";

const ScienceStep = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.7 }}
    className="flex flex-col items-center text-center flex-1 justify-center px-2"
  >
    <img src={logo} alt="YOUTOPIA" className="h-20 md:h-24 mb-8 mix-blend-multiply" />

    <h1 className="font-heading text-4xl text-secondary mb-6 leading-tight">
      Why this works
    </h1>

    <div className="space-y-5 max-w-md font-body text-accent leading-relaxed text-left">
      <p>
        Your brain is most open to new beliefs at two specific moments: just after waking,
        and just before sleep, when it shifts between conscious and subconscious states.
      </p>
      <p>
        Youtopia works with both windows. Your morning meditation uses guided imagery and breath
        to bring you into a focused, receptive state, then plants the seeds of this month's intention.
        Your nightly Seeds use your own voice, whispered as you drift off, to reach the subconscious directly.
      </p>
      <p>
        Research in neuroplasticity shows that repeated suggestion during these threshold states,
        delivered in a familiar voice, accelerates the formation of new neural pathways.
        In other words: <span className="italic">what you hear yourself say, at the right moment, becomes what you believe.</span>
      </p>
      <p className="text-foreground/80">
        The questions you're about to answer are not intake forms. They are the raw material your meditation
        is built from. Answer honestly. The more real you are, the more powerful what comes next will be.
      </p>
    </div>
  </motion.div>
);

export default ScienceStep;
