import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Moon, Settings as SettingsIcon, Headphones, SkipForward, SkipBack,
  Shield, Sun, BookOpen, MessageCircle, ChevronDown, ChevronRight,
  Home as HomeIcon, CalendarDays, User as UserIcon,
} from "lucide-react";
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

const getGreeting = (name: string) => {
  const h = new Date().getHours();
  const n = name || "friend";
  if (h >= 5 && h < 12) return `Good morning, ${n}.`;
  if (h >= 12 && h < 18) return `Good afternoon, ${n}.`;
  if (h >= 18 && h < 22) return `Good evening, ${n}.`;
  return `Time to plant your seeds, ${n}.`;
};

// A quiet, gently-filled circle to indicate completion
const StatusDot = ({ done }: { done: boolean }) => (
  <span
    className={`inline-block w-3.5 h-3.5 rounded-full border ${
      done ? "bg-sage border-sage" : "bg-transparent border-border"
    }`}
    aria-label={done ? "Completed today" : "Not yet"}
  />
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] uppercase tracking-[0.22em] font-body text-sage mb-3 px-1">
    {children}
  </p>
);

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
  const [openMonth, setOpenMonth] = useState<string | null>(null); // closed-folder UI for past months
  const [userFirstName, setUserFirstName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"home" | "month" | "journal" | "settings">("home");
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
  const monthName = now.toLocaleString("default", { month: "long" });

  const intakeAnswers: string[] = Array.isArray(intake?.answers) ? intake!.answers : [];
  const answerList: { q: string; a: string }[] = (() => {
    if (intakeQuestions.length > 0) {
      return intakeQuestions.map((q, i) => ({ q, a: intakeAnswers[i] || "" }));
    }
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

  const messageForYou = meditation?.message_for_you;
  const meditationName = meditation?.meditation_name || meditation?.title || "Morning Meditation";
  const artworkUrl = meditation?.meditation_artwork_url;
  const themeName = theme?.theme || "Your Practice";
  const expired = isIntakeExpired(intake);

  // Mock previous months — keep visual structure; closed folders. (No new data layer required.)
  const previousMonths: { month: string; theme: string }[] = [];

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* ───────── Greeting header with watermark logo ───────── */}
      <div className="relative px-6 pt-10 pb-6 overflow-hidden">
        {/* subtle watermark */}
        <img
          src={logo}
          alt=""
          aria-hidden
          className="absolute -right-8 -top-6 w-56 opacity-[0.07] pointer-events-none select-none"
        />
        <div className="flex items-start justify-between relative">
          <div className="flex-1">
            <h1 className="font-heading text-3xl md:text-4xl text-coral-dark leading-tight">
              {getGreeting(userFirstName)}
            </h1>
            <p className="mt-3 text-[11px] uppercase tracking-[0.22em] font-body text-sage">
              {monthName} · {themeName}
            </p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            {isAdmin && (
              <button onClick={() => navigate("/admin")} className="text-accent/70 hover:text-accent" aria-label="Admin">
                <Shield size={18} />
              </button>
            )}
            <button onClick={() => navigate("/settings")} className="text-accent/70 hover:text-accent" aria-label="Settings">
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Soft expiry / beta banner */}
      {expired ? (
        <div className="mx-6 mb-6">
          <div className="bg-coral-light/40 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3">
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
      ) : null}

      {/* ───────── Current month — open folder ───────── */}
      <div className="px-6 mb-8">
        <SectionLabel>This Month</SectionLabel>

        <div className="space-y-3">
          {/* Morning Meditation card */}
          {hasMeditation && (
            <FolderItem
              icon={<Sun size={18} className="text-coral-dark" />}
              title={meditationName}
              subtitle="Morning Meditation"
              done={meditationMixer.hasStarted}
              expanded
            >
              {/* Artwork */}
              <div className="w-[220px] h-[220px] mx-auto aspect-square rounded-2xl overflow-hidden mb-5 mt-2 relative shadow-[0_8px_24px_-12px_hsl(var(--accent)/0.25)]">
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

              <p className="font-body text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5 mb-4">
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
            </FolderItem>
          )}

          {/* Evening Seeds card */}
          {hasSeeds && (
            <FolderItem
              icon={<Moon size={18} className="text-coral-dark" />}
              title="Plant the Seeds"
              subtitle="Evening Seeds"
              done={seedsPlayer.hasStarted}
              expanded
            >
              <p className="font-body text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5 mb-4 mt-1">
                <Headphones className="w-3.5 h-3.5" />
                Best with headphones and eyes closed
              </p>

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
            </FolderItem>
          )}

          {/* Journal */}
          <button
            onClick={() => setActiveTab("journal")}
            className="w-full text-left bg-card rounded-2xl px-5 py-4 flex items-center gap-4 hover:bg-card/80 transition-colors shadow-[0_2px_10px_-6px_hsl(var(--accent)/0.2)]"
          >
            <span className="w-10 h-10 rounded-full bg-cream flex items-center justify-center">
              <BookOpen size={18} className="text-coral-dark" />
            </span>
            <span className="flex-1">
              <span className="block font-heading text-base text-accent">Journal</span>
              <span className="block font-body text-xs text-muted-foreground">A quiet place to reflect</span>
            </span>
            <StatusDot done={false} />
          </button>

          {/* Daily check-in */}
          <button
            className="w-full text-left bg-card rounded-2xl px-5 py-4 flex items-center gap-4 hover:bg-card/80 transition-colors shadow-[0_2px_10px_-6px_hsl(var(--accent)/0.2)]"
          >
            <span className="w-10 h-10 rounded-full bg-cream flex items-center justify-center">
              <MessageCircle size={18} className="text-coral-dark" />
            </span>
            <span className="flex-1">
              <span className="block font-heading text-base text-accent">Daily Check-in</span>
              <span className="block font-body text-xs text-muted-foreground">A small moment of honesty</span>
            </span>
            <StatusDot done={false} />
          </button>
        </div>
      </div>

      {/* ───────── A Message For You ───────── */}
      {messageForYou && (
        <div className="px-6 mb-8">
          <SectionLabel>A Message For You</SectionLabel>
          <div className="bg-card rounded-3xl p-6 shadow-[0_2px_10px_-6px_hsl(var(--accent)/0.2)]">
            <p className="font-body text-base text-accent/90 leading-relaxed">
              {messageForYou}
            </p>
          </div>
        </div>
      )}

      {/* ───────── This Month's Practice ───────── */}
      {tenureIntro && (
        <div className="px-6 mb-8">
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
        </div>
      )}

      {/* ───────── What You Shared — open journal cards ───────── */}
      {answerList.length > 0 && (
        <div className="px-6 mb-8">
          <SectionLabel>What You Shared</SectionLabel>
          <div className="space-y-3">
            {answerList.map((item, i) => (
              <div
                key={i}
                className="bg-card rounded-3xl px-5 py-5 shadow-[0_2px_10px_-6px_hsl(var(--accent)/0.2)]"
              >
                <p className="font-body text-sm text-accent leading-relaxed mb-2">
                  {item.q}
                </p>
                {item.a ? (
                  <p className="font-body text-[15px] text-accent/75 leading-relaxed italic">
                    {item.a}
                  </p>
                ) : (
                  <p className="font-body text-sm text-muted-foreground/70 italic">
                    Your answer will appear here
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───────── Previous months — closed folders ───────── */}
      {previousMonths.length > 0 && (
        <div className="px-6 mb-8">
          <SectionLabel>Previous Months</SectionLabel>
          <div className="space-y-2.5">
            {previousMonths.map((m) => {
              const open = openMonth === m.month;
              return (
                <div key={m.month} className="bg-card rounded-2xl shadow-[0_2px_10px_-6px_hsl(var(--accent)/0.2)] overflow-hidden">
                  <button
                    onClick={() => setOpenMonth(open ? null : m.month)}
                    className="w-full px-5 py-4 flex items-center gap-3 text-left"
                  >
                    <ChevronRight
                      size={16}
                      className={`text-sage flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
                    />
                    <span className="flex-1">
                      <span className="block font-heading text-base text-accent">{m.month}</span>
                      <span className="block font-body text-xs text-sage uppercase tracking-[0.18em] mt-0.5">{m.theme}</span>
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 font-body text-sm text-muted-foreground italic">
                          Past content from {m.month} will appear here.
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

      {/* ───────── Bottom nav ───────── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/85 backdrop-blur-lg px-6 py-3 border-t border-border/40">
        <div className="flex justify-around max-w-sm mx-auto">
          <NavBtn icon={<HomeIcon size={20} />} label="Home" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
          <NavBtn icon={<CalendarDays size={20} />} label="My Month" active={activeTab === "month"} onClick={() => setActiveTab("month")} />
          <NavBtn icon={<BookOpen size={20} />} label="Journal" active={activeTab === "journal"} onClick={() => setActiveTab("journal")} />
          <NavBtn icon={<UserIcon size={20} />} label="Settings" active={activeTab === "settings"} onClick={() => navigate("/settings")} />
        </div>
      </nav>
    </div>
  );
};

/* ───────── Sub-components ───────── */

const FolderItem = ({
  icon, title, subtitle, done, expanded, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  done: boolean;
  expanded?: boolean;
  children?: React.ReactNode;
}) => (
  <div className="bg-card rounded-3xl p-5 shadow-[0_2px_12px_-6px_hsl(var(--accent)/0.22)]">
    <div className="flex items-center gap-4">
      <span className="w-10 h-10 rounded-full bg-cream flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="font-heading text-lg text-accent leading-tight truncate">{title}</h3>
        <p className="font-body text-[11px] uppercase tracking-[0.18em] text-sage mt-0.5">
          {subtitle}
        </p>
      </div>
      <StatusDot done={done} />
    </div>
    {expanded && children && <div className="mt-5">{children}</div>}
  </div>
);

const NavBtn = ({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-colors ${
      active ? "text-sage" : "text-accent/50 hover:text-accent/80"
    }`}
  >
    {icon}
    <span className="text-[10px] font-body font-medium">{label}</span>
  </button>
);

export default Home;
