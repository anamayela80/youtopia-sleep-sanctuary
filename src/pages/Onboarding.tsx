import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import QuestionsStep from "@/components/onboarding/QuestionsStep";
import VoiceStep from "@/components/onboarding/VoiceStep";
import MusicStep from "@/components/onboarding/MusicStep";

const Onboarding = () => {
  const [step, setStep] = useState(1); // 1-3: questions, 4: voice, 5: music
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [selectedMusic, setSelectedMusic] = useState<string | null>(null);
  const navigate = useNavigate();

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const handleQuestionAnswer = (questionIndex: number, answer: string) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = answer;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      navigate("/home");
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const canProceed = () => {
    if (step <= 3) return answers[step - 1].trim().length > 0;
    if (step === 4) return selectedVoice !== null;
    if (step === 5) return selectedMusic !== null;
    return false;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 pt-8 pb-8">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-8">
        {step > 1 && (
          <button onClick={handleBack} className="text-accent">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        )}
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <span className="text-xs font-body text-muted-foreground">{step}/{totalSteps}</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {step <= 3 && (
            <QuestionsStep
              key={`q-${step}`}
              questionIndex={step - 1}
              answer={answers[step - 1]}
              onAnswer={(a) => handleQuestionAnswer(step - 1, a)}
            />
          )}
          {step === 4 && (
            <VoiceStep
              key="voice"
              selectedVoice={selectedVoice}
              onSelect={setSelectedVoice}
            />
          )}
          {step === 5 && (
            <MusicStep
              key="music"
              selectedMusic={selectedMusic}
              onSelect={setSelectedMusic}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Continue button */}
      <motion.button
        onClick={handleNext}
        disabled={!canProceed()}
        className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-body font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed mt-6"
        whileTap={{ scale: 0.98 }}
      >
        {step === totalSteps ? "Create My Meditation" : "Continue"}
      </motion.button>
    </div>
  );
};

export default Onboarding;
