import { motion } from "framer-motion";

interface QuestionsStepProps {
  questionIndex: number;
  answer: string;
  onAnswer: (answer: string) => void;
  question: string;
  userFirstName?: string;
  themeName?: string;
}

const EMOJIS = ["🌿", "✨", "🍃", "🌙", "🌤️"];
const HINTS = [
  "There's no wrong answer — speak from your heart.",
  "Imagine the best version of this month — be specific or dreamy.",
  "This stays between you and your meditation.",
  "Take a breath. Notice what comes up.",
  "Whatever feels true — write it down.",
];
const PLACEHOLDERS = [
  "Calm, focused, at peace, energized...",
  "I see myself waking up feeling rested and present...",
  "Stress about work, self-doubt, restless nights...",
  "Whatever comes to mind first...",
  "Speak from where you are right now...",
];

const QuestionsStep = ({ questionIndex, answer, onAnswer, question, userFirstName, themeName }: QuestionsStepProps) => {
  const emoji = EMOJIS[questionIndex] || "🌿";
  const hint = HINTS[questionIndex] || HINTS[0];
  const placeholder = PLACEHOLDERS[questionIndex] || PLACEHOLDERS[0];
  const rendered = (question || "").replace(/\{name\}/gi, userFirstName || "friend");

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col"
    >
      {themeName && (
        <p className="text-[11px] uppercase tracking-[0.18em] font-body text-accent mb-3">
          This month · {themeName}
        </p>
      )}
      <div className="text-4xl mb-4">{emoji}</div>
      <h2 className="font-heading text-2xl text-secondary mb-2 whitespace-pre-line leading-snug">
        {rendered}
      </h2>
      <p className="font-body text-sm text-muted-foreground mb-6">{hint}</p>

      <textarea
        value={answer}
        onChange={(e) => onAnswer(e.target.value)}
        className="w-full h-36 px-4 py-4 rounded-2xl bg-cream-light border border-border font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none leading-relaxed"
        placeholder={placeholder}
        maxLength={500}
      />
      <div className="flex justify-end mt-2">
        <span className="text-xs font-body text-muted-foreground">{answer.length}/500</span>
      </div>
    </motion.div>
  );
};

export default QuestionsStep;
