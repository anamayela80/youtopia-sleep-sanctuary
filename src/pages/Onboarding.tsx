import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
} from "@/services/meditationService";
import {
  hasEverCompletedIntake,
  getNextThemeForUser,
  saveIntake,
} from "@/services/intakeService";
import WelcomeStep from "@/components/onboarding/WelcomeStep";
import ScienceStep from "@/components/onboarding/ScienceStep";
import ThemeIntroStep from "@/components/onboarding/ThemeIntroStep";
import QuestionsStep from "@/components/onboarding/QuestionsStep";
import VoiceCaptureStep from "@/components/onboarding/VoiceCaptureStep";
import GeneratingStep from "@/components/onboarding/GeneratingStep";
import FolderUnlockStep from "@/components/onboarding/FolderUnlockStep";

/**
 * Monthly Intake Flow.
 *
 * Step layout (dynamic — Welcome + Science only on first-ever intake):
 *   firstEver:  [Welcome, Science, ThemeReveal, Q1..Q5, Voice, FolderUnlock]
 *   returning:  [ThemeReveal, Q1..Q5, Voice, FolderUnlock]
 *
 * "Generating" is shown as a full-screen overlay while we build the meditation.
 */
const Onboarding = () => {
  const [searchParams] = useSearchParams();
  const forceFull = searchParams.get("full") === "1"; // for testing the full flow

  const [step, setStep] = useState(0);
  const [isFirstEver, setIsFirstEver] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<any>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [userFirstName, setUserFirstName] = useState<string>("");
  const [hasExistingClone, setHasExistingClone] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [unlockArtwork, setUnlockArtwork] = useState<string | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);
  const voiceRecordingRef = useRef<Blob | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth?mode=login"); return; }

      setUserFirstName((user.user_metadata?.full_name || "").split(" ")[0] || "");

      const [everCompleted, nextTheme, voiceId] = await Promise.all([
        hasEverCompletedIntake(user.id),
        getNextThemeForUser(user.id),
        getUserVoiceClone(user.id),
      ]);

      setIsFirstEver(forceFull ? true : !everCompleted);
      setHasExistingClone(!!voiceId);

      if (!nextTheme) {
        toast({
          variant: "destructive",
          title: "No theme available",
          description: "An admin needs to publish a theme first.",
        });
        return;
      }

      setTheme(nextTheme);

      // Parse questions from theme
      let qs: string[] = [];
      try {
        const raw = nextTheme.questions;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) {
          qs = parsed
            .map((q: any) => (typeof q === "string" ? q.trim() : ""))
            .filter((s: string) => s.length > 0)
            .slice(0, 5);
        }
      } catch {}
      if (qs.length === 0) {
        qs = [
          "How do you want to feel every day this month?",
          "What would a transformed version of you look like in 30 days?",
          "What is one thing you are ready to release this month?",
        ];
      }
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(""));
      setStep(0);
    })();
  }, [navigate, toast, forceFull]);

  // Build the dynamic step list once we know the gating
  const stepList: Array<"welcome" | "science" | "theme" | "question" | "voice"> = (() => {
    if (isFirstEver === null) return [];
    const list: Array<"welcome" | "science" | "theme" | "question" | "voice"> = [];
    if (isFirstEver) list.push("welcome", "science");
    list.push("theme");
    for (let i = 0; i < questions.length; i++) list.push("question");
    list.push("voice");
    return list;
  })();
  const totalSteps = stepList.length;
  const currentKind = stepList[step];

  // Index of the question currently shown (if applicable)
  const questionIndex = (() => {
    if (currentKind !== "question") return -1;
    const firstQ = stepList.indexOf("question");
    return step - firstQ;
  })();

  const progress = totalSteps > 0 ? ((step + 1) / totalSteps) * 100 : 0;

  const handleQuestionAnswer = (idx: number, val: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const handleVoiceRecording = (blob: Blob) => {
    voiceRecordingRef.current = blob;
    setHasRecording(true);
  };

  const canProceed = () => {
    if (currentKind === "welcome" || currentKind === "science" || currentKind === "theme") return true;
    if (currentKind === "question") return (answers[questionIndex] || "").trim().length > 0;
    if (currentKind === "voice") return hasExistingClone || hasRecording;
    return false;
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleNext = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else handleGenerate();
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({ variant: "destructive", title: "Not logged in" });
        navigate("/auth?mode=login");
        return;
      }
      const user = session.user;
      const userName = user.user_metadata?.full_name || "";

      // 1. Save raw answers (legacy table — keeps first 3)
      setGenerationStatus("Reading your answers…");
      const padded = [answers[0] || "", answers[1] || "", answers[2] || ""];
      await saveUserAnswers(user.id, padded);

      // 2. Voice clone (if new recording given). Otherwise fall back to theme guide voice for Seeds.
      let userVoiceId = await getUserVoiceClone(user.id);
      if (voiceRecordingRef.current) {
        setGenerationStatus("Creating your personal voice…");
        const clonedId = await cloneVoice(voiceRecordingRef.current);
        await saveVoiceClone(user.id, clonedId);
        userVoiceId = clonedId;
        voiceRecordingRef.current = null;
      }
      const guideVoiceId = theme?.guide_voice_id || "9BDgg2Q7WSrW0x8naPLw";
      const seedVoiceId = userVoiceId || guideVoiceId; // Serena fallback = theme guide voice

      // 3. Meditation script
      setGenerationStatus("Writing your meditation…");
      const { script, segments } = await generateMeditationScript({
        question1: answers[0],
        question2: answers[1],
        question3: answers[2],
        userName,
        monthlyTheme: theme?.theme,
        themeIntention: theme?.intention,
      });

      // 4. Narrate segments
      const themeSlug = (theme?.theme || "practice").toLowerCase().replace(/\s+/g, "-");
      const segmentAudioUrls: string[] = [];
      for (let i = 0; i < segments.length && i < 4; i++) {
        setGenerationStatus(`Recording your meditation (${i + 1} of ${Math.min(segments.length, 4)})…`);
        const audioBlob = await narrateSegment(segments[i].text, guideVoiceId, i + 1);
        if (!audioBlob || audioBlob.size === 0) throw new Error(`Segment ${i + 1} narration failed`);
        const audioUrl = await uploadSegmentAudio(user.id, audioBlob, themeSlug, i + 1);
        segmentAudioUrls.push(audioUrl);
      }

      // 5. Persist meditation row
      setGenerationStatus("Saving your meditation…");
      const monthLabel = new Date().toLocaleString("default", { month: "long", year: "numeric" });
      const meditationId = await saveMeditation({
        userId: user.id,
        title: `${theme?.theme || "Monthly"} Meditation`,
        script,
        voiceId: guideVoiceId,
        musicMood: "theme",
        month: monthLabel,
        themeId: theme?.id,
        meditationName: null,
        messageForYou: null,
        meditationArtworkUrl: null,
      });
      for (let i = 0; i < segmentAudioUrls.length; i++) {
        await saveMeditationSegment(meditationId, i + 1, segmentAudioUrls[i]);
      }

      // 6. Seeds
      setGenerationStatus("Planting your Seeds…");
      const phrases = await generateSeeds({
        question1: answers[0],
        question2: answers[1],
        question3: answers[2],
        monthlyTheme: theme?.theme,
        themeIntention: theme?.intention,
      });
      const seedAudioUrls: string[] = [];
      for (let i = 0; i < phrases.length && i < 5; i++) {
        setGenerationStatus(`Planting Seed ${i + 1} of 5…`);
        try {
          const seedBlob = await narrateSeed(phrases[i], seedVoiceId);
          const seedUrl = await uploadSeedAudio(user.id, seedBlob, themeSlug, i + 1);
          seedAudioUrls.push(seedUrl);
        } catch (e) {
          console.error(`Seed ${i + 1} failed:`, e);
          seedAudioUrls.push("");
        }
      }
      await saveSeeds({
        userId: user.id,
        month: monthLabel,
        themeId: theme?.id,
        phrases,
        audioUrls: seedAudioUrls,
      });

      // 7. Monthly package (name, message, artwork prompt)
      setGenerationStatus("Composing your monthly message…");
      let artwork: string | null = null;
      try {
        await generateMonthlyPackage({
          meditationId,
          userName,
          monthlyTheme: theme?.theme,
          themeIntention: theme?.intention,
          answers: answers.filter((a) => a.trim().length > 0),
        });
        const { data: med } = await supabase
          .from("meditations")
          .select("meditation_artwork_url")
          .eq("id", meditationId)
          .maybeSingle();
        artwork = med?.meditation_artwork_url || null;
      } catch (e) {
        console.error("Monthly package failed (non-blocking):", e);
      }

      // 8. Save the intake row — locks in the user's 30-day cycle
      await saveIntake({
        userId: user.id,
        themeId: theme.id,
        answers,
        meditationId,
      });

      // 9. Show folder unlock screen
      setUnlockArtwork(artwork);
      setIsGenerating(false);
      setShowUnlock(true);
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

  // Loading initial data
  if (isFirstEver === null || stepList.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          className="w-10 h-10 rounded-full bg-primary/20"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
    );
  }

  if (isGenerating) {
    return <GeneratingStep status={generationStatus} themeName={theme?.theme} />;
  }

  if (showUnlock) {
    return (
      <FolderUnlockStep
        userFirstName={userFirstName}
        themeName={theme?.theme || "monthly"}
        artworkUrl={unlockArtwork}
      />
    );
  }

  const continueLabel =
    currentKind === "welcome"
      ? "I'm ready"
      : currentKind === "science"
      ? "Begin"
      : currentKind === "theme"
      ? "I'm ready for my questions"
      : currentKind === "voice"
      ? "Create my practice ✨"
      : "Continue";

  // Theme intro and welcome/science screens hide the progress bar for cleaner reveal
  const showProgress = currentKind === "question" || currentKind === "voice";

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 pt-6 pb-8">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6 min-h-[24px]">
        {step > 0 && (
          <button onClick={handleBack} className="text-accent" aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        )}
        {showProgress && (
          <>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <span className="text-xs font-body text-muted-foreground">{step + 1}/{totalSteps}</span>
          </>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {currentKind === "welcome" && (
            <WelcomeStep key="welcome" userFirstName={userFirstName} />
          )}
          {currentKind === "science" && <ScienceStep key="science" />}
          {currentKind === "theme" && (
            <ThemeIntroStep
              key="theme"
              themeName={theme?.theme || "Your Practice"}
              description={theme?.description || ""}
              intention={theme?.intention || ""}
              monthLabel={new Date().toLocaleString("default", { month: "long", year: "numeric" })}
            />
          )}
          {currentKind === "question" && (
            <QuestionsStep
              key={`q-${questionIndex}`}
              questionIndex={questionIndex}
              totalQuestions={questions.length}
              answer={answers[questionIndex] || ""}
              onAnswer={(a) => handleQuestionAnswer(questionIndex, a)}
              question={questions[questionIndex] || ""}
              userFirstName={userFirstName}
              themeName={theme?.theme}
            />
          )}
          {currentKind === "voice" && (
            <VoiceCaptureStep
              key="voice"
              onRecordingComplete={handleVoiceRecording}
              hasExistingClone={hasExistingClone}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Continue */}
      <motion.button
        onClick={handleNext}
        disabled={!canProceed()}
        className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-body font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed mt-6"
        whileTap={{ scale: 0.98 }}
      >
        {continueLabel}
      </motion.button>

      {/* Voice fallback link */}
      {currentKind === "voice" && !hasExistingClone && !hasRecording && (
        <button
          onClick={() => {
            // Mark as "use guide voice" — handled via seedVoiceId fallback in handleGenerate
            setHasRecording(true);
            voiceRecordingRef.current = null;
            setTimeout(handleGenerate, 0);
          }}
          className="mt-3 text-sm font-body text-accent underline hover:opacity-80"
        >
          Use Serena's voice for now
        </button>
      )}
    </div>
  );
};

export default Onboarding;
