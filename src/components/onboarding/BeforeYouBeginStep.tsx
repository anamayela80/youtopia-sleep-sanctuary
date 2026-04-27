import { motion } from "framer-motion";

/**
 * "Before You Begin" — first-time orientation shown before the intake questions.
 * Calm, editorial tone. No em dashes. No exclamation marks.
 */
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="font-heading text-2xl text-secondary leading-tight">{title}</h2>
    <div className="space-y-3 font-body text-accent leading-relaxed">{children}</div>
  </section>
);

const Divider = () => (
  <div className="my-8 mx-auto h-px w-16 bg-accent/20" aria-hidden />
);

interface BeforeYouBeginStepProps {
  showSkip?: boolean;
  onSkip?: () => void;
}

const BeforeYouBeginStep = ({ showSkip = false, onSkip }: BeforeYouBeginStepProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.7 }}
    className="flex-1 flex flex-col px-1 py-2"
  >
    <header className="text-center mb-8">
      <h1 className="font-heading text-4xl md:text-5xl text-secondary leading-tight mb-3">
        Before You Begin
      </h1>
      <p className="font-body text-accent/80 text-base leading-relaxed max-w-md mx-auto">
        A few things worth knowing before your session.
      </p>
      {showSkip && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-4 font-body text-sm text-accent/60 underline underline-offset-4 hover:text-accent transition-colors"
        >
          Skip, I've read this before
        </button>
      )}
    </header>

    <div className="max-w-md mx-auto w-full text-left">
      <Section title="When to meditate">
        <p>
          <span className="italic">Morning</span> is one of the most powerful windows.
          Your brain is still close to sleep, still porous. The day hasn't filled you yet.
          This is the time to set the tone, to meet your future self before the noise arrives.
          Do it as early as you can, ideally before checking your phone.
        </p>
        <p>
          <span className="italic">Night</span> works differently. As you drift toward sleep,
          your brain enters a state of high suggestibility. The critical, analytical mind quiets.
          What you place in that space goes deeper. Youtopia uses this: your night session plants
          the seeds while the subconscious is most open to receive them.
        </p>
        <p>
          Both windows work. What matters most is that you choose one and return to it daily.
        </p>
      </Section>

      <Divider />

      <Section title="How to set up">
        <p>
          Find a position, sitting or lying down, that you can hold without needing to adjust.
          Once you settle in, try not to move. Movement pulls you back to the surface.
        </p>
        <p>
          Eyes closed is best. An eye mask helps. Headphones are strongly recommended:
          the music and the voice are designed to work together, and the full effect reaches
          you through sound.
        </p>
      </Section>

      <Divider />

      <Section title="What the questions are for">
        <p>
          The intake questions are not a survey. They are the raw material your meditation is
          built from. Youtopia takes what you share and weaves it into the vision you will hear,
          translated into feeling, not read back to you literally.
        </p>
        <p>
          The more honest your answers, the more specific the images. Specificity is what makes
          this land.
        </p>
      </Section>

      <Divider />

      <Section title="Why daily matters">
        <p>One session opens a door. Repetition walks you through it.</p>
        <p>
          The brain changes through consistent, emotionally elevated practice. Each session
          reinforces the neural pathways laid down in the one before. This is not motivation,
          it is biology. Come back tomorrow.
        </p>
      </Section>

      <Divider />

      <Section title="About the voice">
        <p>
          Your narrator is always optional. But there is something worth knowing: your own voice,
          heard in a relaxed state, bypasses resistance in a way no other voice can. When you
          hear yourself speak something, the brain registers it differently. It cannot dismiss
          it as coming from outside.
        </p>
        <p>
          The voice feature is available when you are ready for it. There is no rush.
        </p>
      </Section>

      <Divider />

      <Section title="Your journal and mood calendar">
        <p>
          After each session, you are invited to write, even one line. The journal is not about
          capturing what happened. It is about noticing what is different: what shifted, what
          surfaced, what you felt in your body.
        </p>
        <p>
          The mood calendar tracks your emotional landscape over time. Patterns appear that you
          cannot see day to day. Over weeks, you will begin to see the arc.
        </p>
        <p>Both take less than two minutes. Both compound.</p>
      </Section>

      <Divider />

      <Section title="One important reframe">
        <p>You are not imagining things.</p>
        <p>
          When you visualize something with full sensory detail and genuine emotion, your brain
          cannot distinguish that experience from a real one. The same neural circuits fire.
          The same chemistry releases. The body responds as if it already happened.
        </p>
        <p>
          You are not daydreaming about a future. You are building a memory of it. The brain
          learns what the body has felt. This is the mechanism.
        </p>
        <p>Come back to it every day and watch what the repetition does.</p>
      </Section>
    </div>
  </motion.div>
);

export default BeforeYouBeginStep;
