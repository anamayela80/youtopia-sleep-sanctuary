import { motion } from "framer-motion";

interface BeforeYouBeginStepProps {
  showSkip?: boolean;
  onSkip?: () => void;
}

const Section = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    {title && (
      <h2 className="font-heading text-2xl text-secondary leading-tight">{title}</h2>
    )}
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
      <h1 className="font-heading text-4xl text-secondary leading-tight">
        Before you begin
      </h1>
    </header>

    <div className="max-w-md mx-auto w-full text-left space-y-8">
      <Section title="Find a quiet moment">
        The next few minutes shape the practice you will return to every day for a month.
        Settle somewhere you will not be interrupted. There is no rush.
      </Section>

      <Section title="Answer honestly">
        The questions ahead are the raw material of your meditation and your Seeds.
        Honesty here is what makes everything that follows feel true.
      </Section>

      <Section title="Speak from where you are">
        Not from where you think you should be. Your real words carry more weight than
        polished ones.
      </Section>

      <p className="font-body italic text-foreground/70 leading-relaxed pt-2">
        When you are ready, take a breath, and continue.
      </p>
    </div>

    {showSkip && onSkip && (
      <button
        type="button"
        onClick={onSkip}
        className="mt-8 mx-auto font-body text-sm text-muted-foreground underline underline-offset-4 hover:text-secondary"
      >
        Skip
      </button>
    )}
  </motion.div>
);

export default BeforeYouBeginStep;
