import { motion } from "framer-motion";

const Section = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    {title && (
      <h2 className="font-heading text-2xl text-secondary leading-tight">{title}</h2>
    )}
    <p className="font-body text-accent leading-relaxed">{children}</p>
  </section>
);

const ScienceStep = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.7 }}
    className="flex-1 flex flex-col px-1 py-2"
  >
    <header className="text-center mb-10">
      <h1 className="font-heading text-4xl text-secondary leading-tight">
        How this works
      </h1>
    </header>

    <div className="max-w-md mx-auto w-full text-left space-y-8">
      <Section>
        Your brain cannot tell the difference between a vividly imagined experience and a real
        one. The same neural circuits fire. The same chemistry releases. When you return to a
        vision every day with full sensory detail and genuine emotion, you are building a memory
        of it. Repetition is what turns a memory into a belief.
      </Section>

      <Section>
        Your brain also enters a highly receptive state twice a day: just after waking and just
        before sleep. In both moments, the analytical mind steps back and the subconscious
        becomes accessible. This is why the practice happens at these two windows, and why
        returning to the same intention every day compounds over time.
      </Section>

      <Section title="Your voice">
        Research in neuroplasticity shows that repeated suggestion, delivered in a familiar
        voice during these threshold states, accelerates the formation of new neural pathways.
        Your own voice is the most powerful delivery system for this. The brain cannot dismiss
        what it hears itself say.
      </Section>

      <Section title="Moods and journal">
        After each morning session you are invited to log your mood and write one line. Over
        weeks, patterns emerge that you cannot see day to day. The mood calendar shows you the
        arc of the shift as it happens.
      </Section>
    </div>
  </motion.div>
);

export default ScienceStep;
