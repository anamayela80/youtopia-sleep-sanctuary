import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  generateMeditationScript,
  generateMonthlyPackage,
  narrateSegment,
  uploadSegmentAudio,
  saveMeditation,
  saveMeditationSegment,
  saveUserAnswers,
  cloneVoice,
  saveVoiceClone,
  getUserVoiceClone,
  generateSeeds,
  narrateSeed,
  uploadSeedAudio,
  saveSeeds,
  getActiveTheme,
} from "@/services/meditationService";
import ThemeIntroStep from "@/components/onboarding/ThemeIntroStep";
import QuestionsStep from "@/components/onboarding/QuestionsStep";
import VoiceCaptureStep from "@/components/onboarding/VoiceCaptureStep";
import GeneratingStep from "@/components/onboarding/GeneratingStep";

const DEFAULT_QUESTIONS = [
  "How do you want to feel every day this month?",
  "What would a transformed version of you look like in 30 days?",
  "What is one thing you are ready to release this month?",
];

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [themeQuestions, setThemeQuestions] = useState<string[]>(DEFAULT_QUESTIONS);
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [hasExistingClone, setHasExistingClone] = useState(false);
  const [theme, setTheme] = useState<any>(null);
  const [userFirstName, setUserFirstName] = useState<string>("");
  const voiceRecordingRef = useRef<Blob | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step 1 = theme intro; Steps 2..(N+1) = questions; last = voice capture
  const questionCount = themeQuestions.length;
  const totalSteps = 2 + questionCount;
  const voiceStep = totalSteps;

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const activeTheme = await getActiveTheme();
    if (activeTheme) {
      setTheme(activeTheme);
      if (activeTheme.questions) {
        try {
          const qs = typeof activeTheme.questions === "string"
            ? JSON.parse(activeTheme.questions)
            : activeTheme.questions;
          if (Array.isArray(qs)) {
            const cleaned = qs
              .map((q: any) => (typeof q === "string" ? q.trim() : ""))
              .filter((s: string) => s.length > 0)
              .slice(0, 5);
            if (cleaned.length > 0) {
              setThemeQuestions(cleaned);
              setAnswers(new Array(cleaned.length).fill(""));
            }
          }
        } catch {}
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserFirstName((user.user_metadata?.full_name || "").split(" ")[0] || "");
      const voiceId = await getUserVoiceClone(user.id);
      if (voiceId) setHasExistingClone(true);
    }
  };

  const progress = (step / totalSteps) * 100;


  const handleQuestionAnswer = (questionIndex: number, answer: string) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = answer;
    setAnswers(newAnswers);
  };

  const handleVoiceRecording = (blob: Blob) => {
    voiceRecordingRef.current = blob;
    setHasRecording(true);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({ variant: "destructive", title: "Not logged in", description: "Please sign in first." });
        navigate("/auth?mode=login");
        return;
      }
      const user = session.user;
      const userName = user.user_metadata?.full_name || "";

      // 1. Save answers (DB stores first 3 question slots)
      setGenerationStatus("Saving your intentions...");
      const padded = [answers[0] || "", answers[1] || "", answers[2] || ""];
      await saveUserAnswers(user.id, padded);

      // 2. Clone voice if new recording provided
      let userVoiceId = await getUserVoiceClone(user.id);
      if (voiceRecordingRef.current) {
        setGenerationStatus("Creating your personal voice...");
        const clonedId = await cloneVoice(voiceRecordingRef.current);
        await saveVoiceClone(user.id, clonedId);
        userVoiceId = clonedId;
        voiceRecordingRef.current = null; // Delete raw recording reference
      }

      // 3. Generate meditation script (4 segments)
      setGenerationStatus("Writing your morning meditation...");
      const guideVoiceId = theme?.guide_voice_id || "9BDgg2Q7WSrW0x8naPLw";
      const { script, segments } = await generateMeditationScript({
        question1: answers[0],
        question2: answers[1],
        question3: answers[2],
        userName,
        monthlyTheme: theme?.theme,
        themeIntention: theme?.intention,
      });

      // 4. Narrate each segment with guide voice
      const currentMonth = new Date().toLocaleString("default", { month: "long", year: "numeric" });
      const monthSlug = currentMonth.replace(/\s/g, "-");

      setGenerationStatus("Creating voice narration (segment 1 of 4)...");
      const segmentAudioUrls: string[] = [];
      for (let i = 0; i < segments.length && i < 4; i++) {
        setGenerationStatus(`Creating voice narration (segment ${i + 1} of 4)...`);
        const audioBlob = await narrateSegment(segments[i].text, guideVoiceId, i + 1);
        if (!audioBlob || audioBlob.size === 0) throw new Error(`Segment ${i + 1} narration failed`);
        const audioUrl = await uploadSegmentAudio(user.id, audioBlob, monthSlug, i + 1);
        segmentAudioUrls.push(audioUrl);
      }

      // 5. Save meditation row (name/message/artwork prompt filled by monthly-package)
      setGenerationStatus("Saving your meditation...");
      const meditationId = await saveMeditation({
        userId: user.id,
        title: `${currentMonth} Meditation`,
        script,
        voiceId: guideVoiceId,
        musicMood: "theme",
        month: currentMonth,
        themeId: theme?.id,
        meditationName: null,
        messageForYou: null,
        meditationArtworkUrl: null,
      });

      for (let i = 0; i < segmentAudioUrls.length; i++) {
        await saveMeditationSegment(meditationId, i + 1, segmentAudioUrls[i]);
      }

      // 6. Generate seeds if user has a voice clone
      if (userVoiceId) {
        setGenerationStatus("Creating your personal seeds...");
        const phrases = await generateSeeds({
          question1: answers[0],
          question2: answers[1],
          question3: answers[2],
          monthlyTheme: theme?.theme,
          themeIntention: theme?.intention,
        });

        const seedAudioUrls: string[] = [];
        for (let i = 0; i < phrases.length && i < 5; i++) {
          setGenerationStatus(`Whispering seed ${i + 1} of 5...`);
          try {
            const seedBlob = await narrateSeed(phrases[i], userVoiceId);
            const seedUrl = await uploadSeedAudio(user.id, seedBlob, monthSlug, i + 1);
            seedAudioUrls.push(seedUrl);
          } catch (e: any) {
            console.error(`Seed ${i + 1} narration failed:`, e);
            seedAudioUrls.push("");
          }
        }

        await saveSeeds({
          userId: user.id,
          month: currentMonth,
          themeId: theme?.id,
          phrases,
          audioUrls: seedAudioUrls,
        });
      }

      // 7. Generate monthly package (name, message, image prompt) and persist
      setGenerationStatus("Composing your monthly message...");
      try {
        await generateMonthlyPackage({
          meditationId,
          userName,
          monthlyTheme: theme?.theme,
          themeIntention: theme?.intention,
          answers: answers.filter((a) => a.trim().length > 0),
        });
      } catch (e) {
        console.error("Monthly package generation failed (non-blocking):", e);
      }

      toast({ title: "Your meditation is ready! 🧘", description: "Your morning meditation and seeds are waiting." });
      navigate("/home");
    } catch (err: any) {
      console.error("Generation error:", err);
      toast({
        variant: "destructive",
        title: err?.message?.toLowerCase().includes("credits") ? "More credits needed" : "Something went wrong",
        description: err.message,
      });
      setIsGenerating(false);
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleGenerate();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const canProceed = () => {
    if (step === 1) return true; // Theme intro — always can proceed
    if (step >= 2 && step <= 4) return answers[step - 2].trim().length > 0;
    if (step === 5) return hasExistingClone || hasRecording;
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
          {step === 1 && (
            <ThemeIntroStep
              key="theme"
              themeName={theme?.theme || "Your Journey Begins"}
              description={theme?.description || "Each month brings a new focus for your inner transformation. Answer three questions and we'll create your personalized meditation and seeds."}
              intention={theme?.intention || "Creating your everyday utopia"}
            />
          )}
          {step >= 2 && step <= 4 && (
            <QuestionsStep
              key={`q-${step}`}
              questionIndex={step - 2}
              answer={answers[step - 2]}
              onAnswer={(a) => handleQuestionAnswer(step - 2, a)}
              questions={themeQuestions}
            />
          )}
          {step === 5 && (
            <VoiceCaptureStep
              key="voice"
              onRecordingComplete={handleVoiceRecording}
              hasExistingClone={hasExistingClone}
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
        {step === 1
          ? "Begin"
          : step === totalSteps
          ? "Create My Meditation ✨"
          : "Continue"}
      </motion.button>
    </div>
  );
};

export default Onboarding;
