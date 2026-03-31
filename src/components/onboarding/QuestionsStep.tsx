import { motion } from "framer-motion";

const questions = [
  {
    emoji: "🌿",
    title: "How do you want to feel\nevery day?",
    placeholder: "Calm, focused, at peace, energized...",
    hint: "There's no wrong answer — speak from your heart.",
  },
  {
    emoji: "✨",
    title: "What does your ideal life\nlook like in 90 days?",
    placeholder: "I see myself waking up feeling rested...",
    hint: "Paint a picture — be as specific or dreamy as you like.",
  },
  {
    emoji: "🍃",
    title: "What is one thing you\nwant to let go of?",
    placeholder: "Stress about work, self-doubt, restless nights...",
    hint: "This stays between you and your meditation.",
  },
];

interface QuestionsStepProps {
  questionIndex: number;
  answer: string;
  onAnswer: (answer: string) => void;
}

const QuestionsStep = ({ questionIndex, answer, onAnswer }: QuestionsStepProps) => {
  const q = questions[questionIndex];

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col"
    >
      <div className="text-4xl mb-4">{q.emoji}</div>
      <h2 className="font-heading text-2xl text-secondary mb-2 whitespace-pre-line leading-snug">
        {q.title}
      </h2>
      <p className="font-body text-sm text-muted-foreground mb-6">{q.hint}</p>

      <textarea
        value={answer}
        onChange={(e) => onAnswer(e.target.value)}
        className="w-full h-36 px-4 py-4 rounded-2xl bg-cream-light border border-border font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none leading-relaxed"
        placeholder={q.placeholder}
        maxLength={500}
      />
      <div className="flex justify-end mt-2">
        <span className="text-xs font-body text-muted-foreground">{answer.length}/500</span>
      </div>
    </motion.div>
  );
};

export default QuestionsStep;
