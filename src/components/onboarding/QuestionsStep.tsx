import { motion } from "framer-motion";

export interface ThemeQuestion {
  label: string;
  text?: string;
  placeholder?: string;
}

interface QuestionsStepProps {
  questionIndex: number;
  totalQuestions: number;
  answer: string;
  onAnswer: (answer: string) => void;
  question: string | ThemeQuestion;
  userFirstName?: string;
  themeName?: string;
}

const QuestionsStep = ({
  questionIndex,
  totalQuestions,
  answer,
  onAnswer,
  question,
  userFirstName,
  themeName,
}: QuestionsStepProps) => {
  const isRich = typeof question === "object" && question !== null;
  const labelRaw = isRich ? (question as ThemeQuestion).label : (question as string);
  const bodyText = isRich ? ((question as ThemeQuestion).text || "") : "";
  const placeholderText = isRich
    ? ((question as ThemeQuestion).placeholder || "Take your time…")
    : "Take your time…";

  const rendered = (labelRaw || "").replace(/\{name\}/gi, userFirstName || "friend");
  const renderedBody = bodyText.replace(/\{name\}/gi, userFirstName || "friend");

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col"
    >
      {themeName && (
        <p className="text-[11px] uppercase tracking-[0.18em] font-body text-accent mb-2">
          {themeName}
        </p>
      )}
      <p className="text-xs font-body text-muted-foreground mb-5">
        Question {questionIndex + 1} of {totalQuestions}
      </p>

      <h2 className="font-heading text-3xl text-coral-dark mb-3 whitespace-pre-line leading-snug">
        {rendered}
      </h2>
      {renderedBody ? (
        <p className="font-body text-sm text-muted-foreground mb-6 leading-relaxed">
          {renderedBody}
        </p>
      ) : (
        <p className="font-body text-sm text-muted-foreground italic mb-6">
          Every answer is the right one. Speak from your heart.
        </p>
      )}

      <textarea
        value={answer}
        onChange={(e) => onAnswer(e.target.value)}
        className="w-full h-44 px-4 py-4 rounded-2xl bg-cream-light border border-border font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none leading-relaxed"
        placeholder={placeholderText}
        maxLength={500}
      />
      <div className="flex justify-end mt-2">
        <span className="text-xs font-body text-muted-foreground">{answer.length}/500</span>
      </div>
    </motion.div>
  );
};

export default QuestionsStep;
