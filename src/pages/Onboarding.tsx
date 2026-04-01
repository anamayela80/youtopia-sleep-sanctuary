import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  generateMeditationScript,
  narrateMeditation,
  uploadMeditationAudio,
  saveMeditation,
  saveUserAnswers,
} from "@/services/meditationService";
import QuestionsStep from "@/components/onboarding/QuestionsStep";
import VoiceStep from "@/components/onboarding/VoiceStep";
import MusicStep from "@/components/onboarding/MusicStep";
import GeneratingStep from "@/components/onboarding/GeneratingStep";

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [selectedMusic, setSelectedMusic] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const handleQuestionAnswer = (questionIndex: number, answer: string) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = answer;
    setAnswers(newAnswers);
  };

  const handleGenerateMeditation = async () => {
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({ variant: "destructive", title: "Not logged in", description: "Please sign in first." });
        navigate("/auth?mode=login");
        return;
      }
      const user = session.user;

      // Step 1: Save answers
      setGenerationStatus("Saving your intentions...");
      await saveUserAnswers(user.id, answers);

      // Step 2: Generate script
      setGenerationStatus("Writing your personal meditation...");
      const script = await generateMeditationScript({
        question1: answers[0],
        question2: answers[1],
        question3: answers[2],
      });

      // Step 3: Narrate with chosen voice
      setGenerationStatus("Creating your voice narration...");
      const audioBlob = await narrateMeditation(script, selectedVoice || "sofia");

      // Step 4: Upload audio
      setGenerationStatus("Saving your meditation...");
      const currentMonth = new Date().toLocaleString("default", { month: "long", year: "numeric" });
      const audioUrl = await uploadMeditationAudio(user.id, audioBlob, currentMonth.replace(/\s/g, "-"));

      // Step 5: Save meditation record
      await saveMeditation({
        userId: user.id,
        title: `${currentMonth} Meditation`,
        script,
        audioUrl,
        voiceId: selectedVoice || "sofia",
        musicMood: selectedMusic || "deep-sleep",
        month: currentMonth,
      });

      toast({ title: "Your meditation is ready! 🧘", description: "Time to drift into peace." });
      navigate("/home");
    } catch (err: any) {
      console.error("Generation error:", err);
      toast({ variant: "destructive", title: "Something went wrong", description: err.message });
      setIsGenerating(false);
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleGenerateMeditation();
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

  if (isGenerating) {
    return <GeneratingStep status={generationStatus} />;
  }

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
        {step === totalSteps ? "Create My Meditation ✨" : "Continue"}
      </motion.button>
    </div>
  );
};

export default Onboarding;
