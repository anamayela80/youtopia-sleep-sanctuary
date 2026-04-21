import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Moon, Headphones, SkipForward, SkipBack, Sun, ArrowLeft,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useSegmentedMixer } from "@/hooks/useSegmentedMixer";
import { useSeedsPlayer } from "@/hooks/useSeedsPlayer";
import {
  getLatestMeditation, getLatestSeeds, getActiveTheme, getUserProfile,
  getUserAnswers, getTenureBand,
} from "@/services/meditationService";
import { getCurrentIntake, type UserIntake } from "@/services/intakeService";
import { supabase as sb } from "@/integrations/supabase/client";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] uppercase tracking-[0.22em] font-body text-sage mb-3 px-1">
    {children}
  </p>
);

const MyMonth = () => {
  const [meditation, setMeditation] = useState<any>(null);
  const [seeds, setSeeds] = useState<any>(null);
  const [theme, setTheme] = useState<any>(null);
  const [intake, setIntake] = useState<UserIntake | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [answers, setAnswers] = useState<any>(null);
  const [intakeQuestions, setIntakeQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFirstName, setUserFirstName] = useState("");
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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth?mode=login"); return; }
    setUserFirstName((user.user_metadata?.full_name || "").split(" ")[0] || "");

    const [med, seedData, currentIntake, prof, ans] = await Promise.all([
      getLatestMeditation(user.id),
      getLatestSeeds(user.id),
      getCurrentIntake(user.id),
      getUserProfile(user.id),
      getUserAnswers(user.id),
    ]);

    setIntake(currentIntake);
    let displayTheme: any = null;
    let qs: string[] = [];
    if (currentIntake?.theme_id) {
      const { data: snap } = await sb.from("monthly_themes").select("*").eq("id", currentIntake.theme_id).maybeSingle();
      displayTheme = snap;
      try {
        const raw = snap?.questions;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) {
          qs = parsed.map((q: any) => (typeof q === "string" ? q.trim() : "")).filter(Boolean).slice(0, 5);
        }
      } catch {}
    }
    if (!displayTheme) displayTheme = await getActiveTheme();

    setMeditation(med);
    setSeeds(seedData);
    setTheme(displayTheme);
    setIntakeQuestions(qs);
    setProfile(prof);
    setAnswers(ans);
    setLoading(false);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div className="w-12 h-12 rounded-full bg-primary/20"
          animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
      </div>
    );
  }

  const hasMeditation = meditation && segmentUrls.length > 0;
  const hasSeeds = seedAudioUrls.length > 0;
  const themeName = theme?.theme || "Your Practice";
  const monthName = new Date().toLocaleString("default", { month: "long" });
  const meditationName = meditation?.meditation_name || meditation?.title || "Morning Meditation";
  const artworkUrl = meditation?.meditation_artwork_url;
  const messageForYou = meditation?.message_for_you;

  const tenure = getTenureBand(profile?.membership_start_date);
  const rawTenureIntro =
    (tenure === "orienting" && theme?.intro_orienting) ||
    (tenure === "settling" && theme?.intro_settling) ||
    (tenure === "established" && theme?.intro_established) ||
    theme?.description || "";
  const tenureIntro = rawTenureIntro ? rawTenureIntro.replace(/\{name\}/gi, userFirstName || "friend") : "";

  const intakeAnswers: string[] = Array.isArray(intake?.answers) ? intake!.answers : [];
  const answerList: { q: string; a: string }[] = (() => {
    if (intakeQuestions.length > 0) return intakeQuestions.map((q, i) => ({ q, a: intakeAnswers[i] || "" }));
    if (answers) {
      const legacyQs = [
        "How do you want to feel every day this month?",
        "What does a transformed version of you look like in 30 days?",
        "What is one thing you are ready to release this month?",
      ];
      return [
        { q: legacyQs[0], a: answers.question_1 || "" },
        { q: legacyQs[1], a: answers.question_2 || "" },
        { q: legacyQs[2], a: answers.question_3 || "" },
      ];
    }
    return [];
  })();

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="max-w-2xl mx-auto px-6 pt-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate("/home")} className="text-accent" aria-label="Back to library">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-[0.22em] font-body text-sage">{monthName}</p>
            <h1 className="font-heading text-3xl text-coral-dark leading-tight">{themeName}</h1>
          </div>
        </div>

        {/* Morning Meditation */}
        {hasMeditation && (
          <section className="mb-8">
            <SectionLabel>Morning Meditation</SectionLabel>
            <div className="bg-card rounded-3xl p-6 shadow-[0_2px_12px_-6px_hsl(var(--accent)/0.22)]">
              <div className="w-[220px] h-[220px] mx-auto aspect-square rounded-2xl overflow-hidden mb-5 relative shadow-[0_8px_24px_-12px_hsl(var(--accent)/0.25)]">
                {artworkUrl ? (
                  <img src={artworkUrl} alt={meditationName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-cream via-coral-light to-coral/40 flex items-center justify-center">
                    <motion.div
                      className="w-16 h-16 rounded-full bg-gradient-to-br from-cream-light/60 to-coral/20 blur-xl"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                )}
              </div>

              <h3 className="font-heading text-xl text-accent text-center mb-2">{meditationName}</h3>
              <p className="font-body text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5 mb-5">
                <Headphones className="w-3.5 h-3.5" />
                Best with headphones and eyes closed
              </p>

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
                  className="w-16 h-16 rounded-full bg-coral-dark flex items-center justify-center text-primary-foreground transition-all active:scale-95 disabled:opacity-50 shadow-[0_10px_24px_-10px_hsl(var(--coral)/0.5)]"
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
          </section>
        )}

        {/* Evening Seeds */}
        {hasSeeds && (
          <section className="mb-8">
            <SectionLabel>Evening Seeds</SectionLabel>
            <div className="bg-card rounded-3xl p-6 shadow-[0_2px_12px_-6px_hsl(var(--accent)/0.22)]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-cream flex items-center justify-center">
                  <Moon size={20} className="text-coral-dark" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-lg text-accent">Plant the Seeds Tonight</h3>
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
                  className="w-14 h-14 rounded-full bg-coral-dark flex items-center justify-center text-primary-foreground transition-all active:scale-95 disabled:opacity-50 shadow-[0_10px_24px_-10px_hsl(var(--coral)/0.5)]"
                  aria-label={seedsPlayer.isPlaying ? "Pause" : "Play"}
                >
                  {seedsPlayer.isLoading ? (
                    <motion.div className="w-5 h-5 rounded-full border-2 border-primary-foreground border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
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
          </section>
        )}

        {/* A message for you */}
        {messageForYou && (
          <section className="mb-8">
            <SectionLabel>A Message For You</SectionLabel>
            <div className="bg-card rounded-3xl p-6 shadow-[0_2px_10px_-6px_hsl(var(--accent)/0.2)]">
              <p className="font-body text-base text-accent/90 leading-relaxed">{messageForYou}</p>
            </div>
          </section>
        )}

        {/* This month's practice */}
        {tenureIntro && (
          <section className="mb-8">
            <SectionLabel>This Month's Practice</SectionLabel>
            <div className="bg-card rounded-3xl p-6 shadow-[0_2px_10px_-6px_hsl(var(--accent)/0.2)]">
              <div className="font-body text-sm text-accent/85 leading-relaxed whitespace-pre-wrap line-clamp-3">
                {tenureIntro}
              </div>
              <button
                onClick={() => navigate("/practice")}
                className="mt-3 text-xs font-body font-medium hover:opacity-80 text-secondary"
              >
                Read More →
              </button>
            </div>
          </section>
        )}

        {/* What you shared */}
        {answerList.length > 0 && (
          <section className="mb-8">
            <SectionLabel>What You Shared</SectionLabel>
            <div className="space-y-3">
              {answerList.map((item, i) => (
                <div key={i} className="bg-card rounded-3xl px-5 py-5 shadow-[0_2px_10px_-6px_hsl(var(--accent)/0.2)]">
                  <p className="font-body text-sm text-accent leading-relaxed mb-2">{item.q}</p>
                  {item.a ? (
                    <p className="font-body text-[15px] text-accent/75 leading-relaxed italic">{item.a}</p>
                  ) : (
                    <p className="font-body text-sm text-muted-foreground/70 italic">Your answer will appear here</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default MyMonth;
