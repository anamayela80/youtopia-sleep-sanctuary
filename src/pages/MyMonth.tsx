import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Moon, Headphones, SkipForward, SkipBack, Sun, ArrowLeft, Download,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useSegmentedMixer } from "@/hooks/useSegmentedMixer";
import { useSeedsPlayer } from "@/hooks/useSeedsPlayer";
import {
  getLatestMeditation, getLatestSeeds, getActiveTheme, getUserProfile,
  getUserAnswers, getTenureBand, regenerateMeditationForUser,
} from "@/services/meditationService";
import { renderMixedAudio } from "@/lib/renderMixedAudio";
import { RefreshCw } from "lucide-react";
import { getCurrentIntake, type UserIntake } from "@/services/intakeService";
import { supabase as sb } from "@/integrations/supabase/client";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p
    className="text-[10px] uppercase font-body mb-3 px-1"
    style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}
  >
    {children}
  </p>
);

// Collapses content to ~8 lines with a Read More toggle.
const Expandable = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useState<HTMLDivElement | null>(null);
  const [el, setEl] = ref;

  useEffect(() => {
    if (!el) return;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, children]);

  return (
    <div className={className}>
      <div
        ref={setEl}
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: 8,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }
        }
      >
        {children}
      </div>
      {(overflowing || expanded) && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs font-body font-medium hover:opacity-80 text-secondary"
        >
          {expanded ? "Show Less ↑" : "Read More ↓"}
        </button>
      )}
    </div>
  );
};

// Two warm beige tones to alternate between sections
const TONE_PAGE = "hsl(var(--background))"; // #F2EAD8
const TONE_FOLDER = "hsl(var(--folder))";   // #E8DCC8
const SOFT_BORDER = "1px solid rgba(160, 120, 70, 0.15)";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenStatus, setRegenStatus] = useState("");
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
    tenureBand: getTenureBand(profile?.membership_start_date),
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

    // Admin check — gates the regenerate button
    const { data: roleRow } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!roleRow);

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

  const handleRegenerate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (!confirm("Regenerate this user's meditation with the current prompt? The previous version stays in history.")) return;
    setRegenerating(true);
    setRegenStatus("Starting…");
    try {
      meditationMixer.stop?.();
      await regenerateMeditationForUser(user.id, (msg) => setRegenStatus(msg));
      setRegenStatus("Reloading…");
      await loadData();
      setRegenStatus("");
    } catch (e: any) {
      console.error("Regenerate failed:", e);
      alert(`Regenerate failed: ${e?.message || e}`);
      setRegenStatus("");
    } finally {
      setRegenerating(false);
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  const handleDownload = async () => {
    if (!meditation || isDownloading) return;
    setIsDownloading(true);
    setRenderProgress(0);

    const slug = (theme?.theme || "meditation").replace(/\s+/g, "-").toLowerCase();
    const musicUrl = theme?.morning_music_url || theme?.music_file_url || null;
    const tenure = getTenureBand(profile?.membership_start_date) as "orienting" | "settling" | "established";

    const segmentUrls = (meditation.meditation_segments || [])
      .slice()
      .sort((a: any, b: any) => a.segment_number - b.segment_number)
      .filter((s: any) => s.audio_url)
      .map((s: any) => s.audio_url);

    try {
      const wav = await renderMixedAudio(
        segmentUrls,
        musicUrl,
        tenure,
        0.42,
        0.72,
        (pct) => setRenderProgress(pct),
      );

      const url = URL.createObjectURL(wav);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setIsDownloading(false);
      setRenderProgress(0);
    }
  };

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
            <h1 className="font-heading text-3xl text-coral-dark leading-tight">{themeName}</h1>
          </div>
        </div>

        {/* Centered artwork */}
        {hasMeditation && (
          <div className="mb-8 flex flex-col items-center">
            <div className="w-[220px] h-[220px] aspect-square rounded-2xl overflow-hidden relative shadow-[0_8px_24px_-12px_hsl(var(--accent)/0.25)]">
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
            <h2 className="font-heading text-2xl text-accent text-center mt-4 w-[220px]">{meditationName}</h2>
          </div>
        )}

        {/* Row 1: Morning Meditation (left) + Seeds (right) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 items-start">
        {/* Morning Meditation */}
        {hasMeditation && (
          <section>
            <SectionLabel>Morning Meditation</SectionLabel>
            <div
              className="rounded-3xl p-6"
              style={{ background: TONE_FOLDER, border: SOFT_BORDER }}
            >

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

              {/* Download button — always visible so users can keep their content */}
              <div className="mt-6 pt-5 border-t" style={{ borderColor: "rgba(160, 120, 70, 0.18)" }}>
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full font-body text-xs tracking-wide transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: "rgba(107, 158, 143, 0.10)", color: "hsl(var(--sage-soft))" }}
                >
                  {isDownloading ? (
                    <div className="w-full flex flex-col items-center gap-1.5">
                      <div className="flex items-center gap-2">
                        <motion.div
                          className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent"
                          style={{ borderColor: "hsl(var(--sage-soft))" }}
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        <span>
                          {renderProgress < 50
                            ? "Loading audio…"
                            : renderProgress < 90
                            ? "Mixing your meditation…"
                            : "Almost ready…"}
                        </span>
                      </div>
                      <div className="w-full h-0.5 rounded-full bg-current/10 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: "hsl(var(--sage-soft))" }}
                          animate={{ width: `${renderProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <Download size={13} />
                      <span>Download to keep</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </section>
        )}

        {/* Evening Seeds */}
        {/* Evening Seeds */}
        {hasSeeds && (
          <section>
            <SectionLabel>Evening Seeds</SectionLabel>
            <div
              className="rounded-3xl p-6"
              style={{ background: TONE_PAGE, border: "1px solid rgba(160, 120, 70, 0.18)" }}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#DDD0EE" }}>
                  <Moon size={20} style={{ color: "hsl(var(--moon))" }} />
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
        </div>

        {/* Row 2: A Message For You + This Month's Practice + What You Shared */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-stretch">
          {/* A message for you */}
          <section className="flex flex-col h-full">
            <SectionLabel>A Message For You</SectionLabel>
            <div
              className="rounded-3xl p-6 flex-1 flex flex-col"
              style={{ background: TONE_FOLDER, border: SOFT_BORDER }}
            >
              <Expandable className="flex-1">
                {messageForYou ? (
                  <p className="font-body text-base text-accent/90 leading-relaxed">{messageForYou}</p>
                ) : (
                  <p className="font-body text-sm text-muted-foreground/80 italic leading-relaxed">
                    Your personal message will appear here.
                  </p>
                )}
              </Expandable>
            </div>
          </section>

          {/* This month's practice */}
          {tenureIntro && (
            <section className="flex flex-col h-full">
              <SectionLabel>This Month's Practice</SectionLabel>
              <div
                className="rounded-3xl p-6 flex-1 flex flex-col"
                style={{ background: TONE_PAGE, border: "1px solid rgba(160, 120, 70, 0.18)" }}
              >
                <Expandable className="flex-1">
                  <div className="font-body text-sm text-accent/85 leading-relaxed whitespace-pre-wrap">
                    {tenureIntro}
                  </div>
                </Expandable>
              </div>
            </section>
          )}

          {/* What you shared */}
          {answerList.length > 0 && (
            <section className="flex flex-col h-full">
              <SectionLabel>What You Shared</SectionLabel>
              <div
                className="rounded-3xl p-6 flex-1 flex flex-col"
                style={{ background: TONE_FOLDER, border: SOFT_BORDER }}
              >
                <Expandable className="flex-1">
                  <div className="space-y-4">
                    {answerList.map((item, i) => (
                      <div key={i}>
                        <p className="font-body text-sm text-accent leading-relaxed mb-1">{item.q}</p>
                        {item.a ? (
                          <p className="font-body text-[15px] text-accent/75 leading-relaxed italic">{item.a}</p>
                        ) : (
                          <p className="font-body text-sm text-muted-foreground/70 italic">Your answer will appear here</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Expandable>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyMonth;
