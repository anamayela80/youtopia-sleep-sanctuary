import { motion } from "framer-motion";

interface BeforeYouBeginStepProps {
  showSkip?: boolean;
  onSkip?: () => void;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="font-heading text-2xl text-secondary leading-tight">{title}</h2>
    <p className="font-body text-accent leading-relaxed">{children}</p>
  </section>
);

const BeforeYouBeginStep = ({ showSkip = false, onSkip }: BeforeYouBeginStepProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.7 }}
    className="flex-1 flex flex-col px-1 py-2"
  >
    <header className="text-center mb-10">
      <h1 className="font-heading text-4xl text-secondary leading-tight mb-3">
        Before You Begin
      </h1>
      {showSkip && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-2 font-body text-sm text-accent/60 underline underline-offset-4 hover:text-accent transition-colors"
        >
          Skip, I've read this before
        </button>
      )}
    </header>

    <div className="max-w-md mx-auto w-full text-left space-y-8">
      <Section title="When">
        Use YOUtopia in the morning before checking your phone, and at night as you settle in
        to sleep. These are the two windows when the brain is most receptive. Eyes closed,
        headphones on.
      </Section>

      <Section title="How to listen">
        Find a comfortable position and stay still. Movement pulls you back to the surface.
        Let the voice guide you. All you need is to be present.
      </Section>

      <Section title="Your questions">
        The questions below are the material your personal practice is built from.
        Answer honestly. Specificity is what makes this land.
      </Section>
    </div>
  </motion.div>
);

export default BeforeYouBeginStep;
