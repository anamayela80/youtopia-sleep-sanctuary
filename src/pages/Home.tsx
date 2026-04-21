import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Moon, Settings, Headphones, SkipForward, SkipBack, Shield, ChevronDown, Home as HomeIcon, Plus } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useSegmentedMixer } from "@/hooks/useSegmentedMixer";
import { useSeedsPlayer } from "@/hooks/useSeedsPlayer";
import {
  getLatestMeditation,
  getLatestSeeds,
  getActiveTheme,
  getUserProfile,
  getUserAnswers,
  getTenureBand,
} from "@/services/meditationService";
import { getCurrentIntake, isIntakeExpired, type UserIntake } from "@/services/intakeService";
import { supabase as sb } from "@/integrations/supabase/client";
import logo from "@/assets/youtopia-logo.png";

const Home = () => {
  const [meditation, setMeditation] = useState<any>(null);
  const [seeds, setSeeds] = useState<any>(null);
  const [theme, setTheme] = useState<any>(null);
  const [intake, setIntake] = useState<UserIntake | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [answers, setAnswers] = useState<any>(null);
  const [intakeQuestions, setIntakeQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [practiceExpanded, setPracticeExpanded] = useState(false);
  const [openAnswer, setOpenAnswer] = useState<number | null>(null);
  const [userFirstName, setUserFirstName] = useState<string>("");
  const navigate = useNavigate();

  const segmentUrls = meditation?.meditation_segments
    ?.sort((a: any, b: any) => a.segment_number - b.segment_number)
    ?.map((s: any) => s.audio_url) || [];

  const seedAudioUrls = seeds
    ? [seeds.audio_url_1, seeds.audio_url_2, seeds.audio_url_3, seeds.audio_url_4, seeds.audio_url_5].filter(Boolean)
    : [];

  const meditationMixer = useSegmentedMixer({
    segmentUrls,
    musicUrl: theme?.morning_music_url || theme?.music_file_url || null,
  });

  const seedsPlayer = useSeedsPlayer({
    seedAudioUrls,
    musicUrl: theme?.evening_music_url || theme?.music_file_url || null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth?mode=login"); return; }

    setUserFirstName((user.user_metadata?.full_name || "").split(" ")[0] || "");

    const [med, seedData, currentIntake, roleRes, prof, ans] = await Promise.all([
      getLatestMeditation(user.id),
      getLatestSeeds(user.id),
      getCurrentIntake(user.id),
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle(),
      getUserProfile(user.id),
      getUserAnswers(user.id),
    ]);

    setIntake(currentIntake);

    // Theme: prefer the snapshotted theme from the user's current intake, else active theme
    let displayTheme: any = null;
    let qs: string[] = [];
    if (currentIntake?.theme_id) {
      const { data: snap } = await sb
        .from("monthly_themes")
        .select("*")
        .eq("id", currentIntake.theme_id)
        .maybeSingle();
      displayTheme = snap;
      try {
        const raw = snap?.questions;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) {
          qs = parsed.map((q: any) => (typeof q === "string" ? q.trim() : "")).filter(Boolean).slice(0, 5);
        }
      } catch {}
    }
    if (!displayTheme) {
      displayTheme = await getActiveTheme();
    }

    setMeditation(med);
    setSeeds(seedData);
    setTheme(displayTheme);
    setIntakeQuestions(qs);
    setIsAdmin(!!roleRes.data);
    setProfile(prof);
    setAnswers(ans);
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          className="w-12 h-12 rounded-full bg-primary/20"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
    );
  }

  const hasMeditation = meditation && segmentUrls.length > 0;
  const hasSeeds = seedAudioUrls.length > 0;

  if (!hasMeditation && !hasSeeds) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🧘</div>
        <h2 className="font-heading text-xl text-secondary mb-2">Your journey begins</h2>
        <p className="font-body text-sm text-muted-foreground mb-6">
          Create your first personalized morning meditation and seeds
        </p>
        <button
          onClick={() => navigate("/onboarding")}
          className="px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-body font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Get Started
        </button>
      </div>
    );
  }

  // Tenure-aware "this month's practice" copy
  const tenure = getTenureBand(profile?.membership_start_date);
  const rawTenureIntro =
    (tenure === "orienting" && theme?.intro_orienting) ||
    (tenure === "settling" && theme?.intro_settling) ||
    (tenure === "established" && theme?.intro_established) ||
    theme?.description ||
    "";
  const tenureIntro = rawTenureIntro
    ? rawTenureIntro.replace(/\{name\}/gi, userFirstName || "friend")
    : "";

  const now = new Date();
  const monthYear = now.toLocaleString("default", { month: "long", year: "numeric" });

  const seedPhrases = seeds
    ? [seeds.phrase_1, seeds.phrase_2, seeds.phrase_3, seeds.phrase_4, seeds.phrase_5].filter(Boolean)
    : [];

  // What you shared — pulled from the intake snapshot when available, else legacy answers
  const intakeAnswers: string[] = Array.isArray(intake?.answers) ? intake!.answers : [];
  const answerList: { q: string; a: string }[] = (() => {
    if (intakeAnswers.length > 0 && intakeQuestions.length > 0) {
      return intakeQuestions
        .map((q, i) => ({ q, a: intakeAnswers[i] || "" }))
        .filter((x) => x.a);
    }
    if (answers) {
      const legacyQs = [
        "How do you want to feel every day this month?",
        "What does a transformed version of you look like in 30 days?",
        "What is one thing you are ready to release this month?",
      ];
      return [
        { q: legacyQs[0], a: answers.question_1 },
        { q: legacyQs[1], a: answers.question_2 },
        { q: legacyQs[2], a: answers.question_3 },
      ].filter((x) => x.a);
    }
    return [];
  })();

  const messageForYou = meditation?.message_for_you;
  const meditationName = meditation?.meditation_name || meditation?.title || "Morning Meditation";
  const artworkUrl = meditation?.meditation_artwork_url;
  const themeName = theme?.theme || "Your";
  const expired = isIntakeExpired(intake);

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 flex items-center justify-between">
        <img src={logo} alt="YOUTOPIA" className="h-8" />
        <div className="flex items-center gap-4">
          {isAdmin && (
            <button onClick={() => navigate("/admin")} className="text-accent" aria-label="Admin">
              <Shield size={20} />
            </button>
          )}
          <button onClick={() => navigate("/settings")} className="text-accent" aria-label="Settings">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Soft-expiry banner — old practice stays accessible */}
      {expired ? (
        <div className="mx-6 mb-6">
          <div className="bg-coral-light/50 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 border border-coral/20">
            <p className="text-sm font-body text-foreground/85 leading-snug">
              Your <span className="font-semibold">{themeName}</span> practice has completed.
              Your next theme is waiting whenever you're ready.
            </p>
            <button
              onClick={() => navigate("/onboarding")}
              className="flex-shrink-0 px-4 py-2 rounded-xl bg-coral-dark text-primary-foreground font-body text-xs font-semibold whitespace-nowrap hover:opacity-90 active:scale-95 transition-all"
            >
              Begin
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-6 mb-6">
          <div className="bg-teal-light/40 rounded-xl px-4 py-2.5 text-center">
            <p className="text-xs font-body text-teal-dark">
              ✨ Welcome to the YOUTOPIA beta — full experience, completely free while we grow
            </p>
          </div>
        </div>
      )}

      {/* 1. Theme header (theme title primary, calendar month secondary) */}
      <div className="px-6 mb-8 text-center">
        <h1 className="font-heading text-4xl text-coral-dark leading-tight">
          {themeName}
        </h1>
        {theme?.intention && (
          <p className="font-body text-base text-accent/80 italic mt-2">
            {theme.intention}
          </p>
        )}
        <p className="font-body text-xs text-muted-foreground mt-2 tracking-wide uppercase">
          {now.toLocaleString("default", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* 2. Morning Meditation */}
      {hasMeditation && (
        <div className="px-6 mb-6">
          <div className="bg-cream-light rounded-3xl p-6 border border-border">
            {/* Square artwork */}
            <div className="w-full aspect-square rounded-2xl overflow-hidden mb-5 relative">
              {artworkUrl ? (
                <img src={artworkUrl} alt={meditationName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-cream via-coral-light to-coral/40 flex items-center justify-center">
                  <motion.div
                    className="w-32 h-32 rounded-full bg-gradient-to-br from-cream-light/60 to-coral/20 blur-xl"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              )}
            </div>

            {/* Track title */}
            <h3 className="font-heading text-2xl text-secondary text-center mb-1">
              {meditationName}
            </h3>
            <p className="font-body text-xs text-muted-foreground text-center uppercase tracking-wider mb-5">
              Morning Meditation
            </p>

            {/* Progress */}
            {(meditationMixer.isPlaying || meditationMixer.isPaused || meditationMixer.hasStarted) && (
              <div className="mb-4">
                <Slider
                  value={[meditationMixer.currentTime]}
                  max={meditationMixer.duration || 1}
                  step={1}
                  onValueChange={([v]) => meditationMixer.seekTo(v)}
                  className="w-full"
                />
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs font-body text-muted-foreground">{formatTime(meditationMixer.currentTime)}</span>
                  <span className="text-xs font-body text-muted-foreground">{formatTime(meditationMixer.duration)}</span>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-8">
              <button
                onClick={() => meditationMixer.skipBackward()}
                disabled={!meditationMixer.hasStarted}
                className="text-accent transition-all active:scale-90 disabled:opacity-30"
                aria-label="Rewind 30 seconds"
              >
                <div className="relative">
                  <SkipBack size={22} />
                  <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-body font-medium text-muted-foreground">30</span>
                </div>
              </button>

              <button
                onClick={() => {
                  if (seedsPlayer.isPlaying) seedsPlayer.stop();
                  meditationMixer.togglePlay();
                }}
                disabled={meditationMixer.isLoading}
                className="w-16 h-16 rounded-full bg-coral-dark flex items-center justify-center text-primary-foreground transition-all active:scale-95 disabled:opacity-50 shadow-md"
                aria-label={meditationMixer.isPlaying ? "Pause" : "Play"}
              >
                {meditationMixer.isLoading ? (
                  <motion.div className="w-5 h-5 rounded-full border-2 border-primary-foreground border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                ) : meditationMixer.isPlaying ? (
                  <Pause size={26} />
                ) : (
                  <Play size={26} className="ml-1" />
                )}
              </button>

              <button
                onClick={() => meditationMixer.skipForward()}
                disabled={!meditationMixer.hasStarted}
                className="text-accent transition-all active:scale-90 disabled:opacity-30"
                aria-label="Forward 30 seconds"
              >
                <div className="relative">
                  <SkipForward size={22} />
                  <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-body font-medium text-muted-foreground">30</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Tonight's Seeds */}
      {hasSeeds && (
        <div className="px-6 mb-6">
          <div className="bg-cream-light rounded-3xl p-6 border border-border">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-coral-light via-secondary/20 to-teal-light flex items-center justify-center">
                <Moon size={20} className="text-foreground/70" />
              </div>
              <div className="flex-1">
                <h3 className="font-heading text-lg text-secondary">Plant the Seeds Tonight</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Headphones size={11} className="text-muted-foreground" />
                  <p className="font-body text-xs text-muted-foreground">Best with headphones and eyes closed</p>
                </div>
              </div>
            </div>

            {(seedsPlayer.isPlaying || seedsPlayer.isPaused || seedsPlayer.hasStarted) && (
              <div className="mb-4">
                <Slider
                  value={[seedsPlayer.currentTime]}
                  max={seedsPlayer.duration || 1}
                  step={1}
                  onValueChange={([v]) => seedsPlayer.seekTo(v)}
                  className="w-full"
                />
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs font-body text-muted-foreground">{formatTime(seedsPlayer.currentTime)}</span>
                  <span className="text-xs font-body text-muted-foreground">{formatTime(seedsPlayer.duration)}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-8">
              <button
                onClick={() => seedsPlayer.skipBackward()}
                disabled={!seedsPlayer.hasStarted}
                className="text-accent transition-all active:scale-90 disabled:opacity-30"
                aria-label="Rewind 30 seconds"
              >
                <div className="relative">
                  <SkipBack size={20} />
                  <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-body font-medium text-muted-foreground">30</span>
                </div>
              </button>

              <button
                onClick={() => {
                  if (meditationMixer.isPlaying) meditationMixer.stop();
                  seedsPlayer.togglePlay();
                }}
                disabled={seedsPlayer.isLoading}
                className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground transition-all active:scale-95 disabled:opacity-50 shadow-md"
                aria-label={seedsPlayer.isPlaying ? "Pause" : "Play"}
              >
                {seedsPlayer.isLoading ? (
                  <motion.div className="w-5 h-5 rounded-full border-2 border-secondary-foreground border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                ) : seedsPlayer.isPlaying ? (
                  <Pause size={22} />
                ) : (
                  <Play size={22} className="ml-1" />
                )}
              </button>

              <button
                onClick={() => seedsPlayer.skipForward()}
                disabled={!seedsPlayer.hasStarted}
                className="text-accent transition-all active:scale-90 disabled:opacity-30"
                aria-label="Forward 30 seconds"
              >
                <div className="relative">
                  <SkipForward size={20} />
                  <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-body font-medium text-muted-foreground">30</span>
                </div>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 4. A message for you */}
      <div className="px-6 mb-6 text-left">
        <p className="text-[11px] uppercase tracking-widest font-body text-accent mb-2 px-1">
          A message for you
        </p>
        <div className="bg-cream rounded-3xl p-6 border border-border/60 shadow-sm">
          {messageForYou ? (
            <p className="font-body text-base text-foreground/85 leading-relaxed">
              {messageForYou}
            </p>
          ) : (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-5/6" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          )}
        </div>
      </div>

      {/* 5. This month's practice */}
      {tenureIntro && (
        <div className="px-6 mb-6">
          <p className="text-[11px] uppercase tracking-widest font-body text-accent mb-2 px-1">
            This month's practice
          </p>
          <div className="bg-cream-light rounded-3xl p-6 border border-border">
            <div className={`font-body text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap ${!practiceExpanded ? "line-clamp-3" : ""}`}>
              {tenureIntro}
            </div>
            <div className="mt-3 flex items-center gap-4">
              {tenureIntro.length > 180 && (
                <button
                  onClick={() => setPracticeExpanded((v) => !v)}
                  className="text-xs font-body font-medium text-coral-dark hover:opacity-80"
                >
                  {practiceExpanded ? "Show less" : "Read more"}
                </button>
              )}
              <button
                onClick={() => navigate("/practice")}
                className="text-xs font-body font-medium text-coral-dark hover:opacity-80"
              >
                Open full practice →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. What you shared */}
      {answerList.length > 0 && (
        <div className="px-6 mb-6">
          <p className="text-[11px] uppercase tracking-widest font-body text-accent mb-2 px-1">
            What you shared
          </p>
          <div className="bg-cream-light rounded-3xl border border-border overflow-hidden">
            {answerList.map((item, i) => {
              const isOpen = openAnswer === i;
              return (
                <div key={i} className={i > 0 ? "border-t border-border/60" : ""}>
                  <button
                    onClick={() => setOpenAnswer(isOpen ? null : i)}
                    className="w-full px-5 py-4 text-left flex items-start justify-between gap-3 hover:bg-cream/50 transition-colors"
                  >
                    <span className="font-body text-xs text-muted-foreground flex-1 leading-relaxed">
                      {item.q}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-accent flex-shrink-0 mt-0.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-4 font-body text-sm text-foreground/85 leading-relaxed">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-cream-light/90 backdrop-blur-lg border-t border-border px-6 py-3">
        <div className="flex justify-around max-w-sm mx-auto">
          <button className="flex flex-col items-center gap-1 text-primary">
            <HomeIcon size={20} />
            <span className="text-[10px] font-body font-medium">Home</span>
          </button>
          <button
            onClick={() => navigate("/settings")}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
          >
            <Settings size={20} />
            <span className="text-[10px] font-body">Settings</span>
          </button>
          <button
            onClick={() => navigate("/onboarding")}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            title="Re-run onboarding (testing)"
          >
            <Plus size={20} />
            <span className="text-[10px] font-body">New</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            >
              <Shield size={20} />
              <span className="text-[10px] font-body">Admin</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
