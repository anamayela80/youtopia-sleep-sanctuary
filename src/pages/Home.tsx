import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Home as HomeIcon, CalendarDays, BookOpen, User as UserIcon, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getLatestMeditation, getLatestSeeds, getActiveTheme, getUserProfile,
} from "@/services/meditationService";
import { getCurrentIntake, type UserIntake } from "@/services/intakeService";
import { supabase as sb } from "@/integrations/supabase/client";
import spiralLogo from "@/assets/youtopia-sun.png";

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "good morning";
  if (h < 18) return "good afternoon";
  return "good evening";
};

type ChapterFolder = {
  key: string;
  themeName: string;
  hasMeditation: boolean;
  hasSeeds: boolean;
};

// ====== Custom icons (per spec) ======
const SunGlyph = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="hsl(var(--gold))" strokeWidth="1.7" strokeLinecap="round">
    <circle cx="12" cy="12" r="3.6" fill="hsl(var(--gold))" stroke="none" />
    <line x1="12" y1="2.5" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="21.5" />
    <line x1="2.5" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="21.5" y2="12" />
    <line x1="5.2" y1="5.2" x2="6.9" y2="6.9" />
    <line x1="17.1" y1="17.1" x2="18.8" y2="18.8" />
    <line x1="5.2" y1="18.8" x2="6.9" y2="17.1" />
    <line x1="17.1" y1="6.9" x2="18.8" y2="5.2" />
  </svg>
);

const MoonGlyph = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="hsl(var(--moon))" opacity="0.85" />
  </svg>
);

const JournalGlyph = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="hsl(var(--sage-soft))" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h11a1 1 0 0 1 1 1v15H7a1 1 0 0 1-1-1V4z" />
    <line x1="9" y1="8.5" x2="15" y2="8.5" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="15.5" x2="13" y2="15.5" />
  </svg>
);

const FaceGlyph = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="hsl(var(--coral))" strokeWidth="1.6" strokeLinecap="round">
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="9.3" cy="10.5" r="0.8" fill="hsl(var(--coral))" stroke="none" />
    <circle cx="14.7" cy="10.5" r="0.8" fill="hsl(var(--coral))" stroke="none" />
    <path d="M9 14.2c1 1.1 2 1.6 3 1.6s2-.5 3-1.6" />
  </svg>
);

const SpiralLogo = () => (
  <img src={spiralLogo} alt="Youtopia" className="w-[26px] h-[26px] object-contain" />
);

// ====== Building blocks ======
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] uppercase font-body mb-3 px-6" style={{ letterSpacing: "0.22em", color: "hsl(var(--label))" }}>
    {children}
  </p>
);

const CompletionCircle = ({ done }: { done: boolean }) => (
  <span
    className="inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
    style={{
      border: done ? "1.5px solid hsl(var(--sage))" : "1.5px solid #C8B090",
      background: done ? "hsl(var(--sage))" : "transparent",
    }}
    aria-label={done ? "Completed" : "Not yet"}
  >
    {done && <Check size={12} strokeWidth={3} className="text-white" />}
  </span>
);

const PracticeItem = ({
  icon, iconBg, title, subtitle, done, onClick,
}: {
  icon: React.ReactNode; iconBg: string;
  title: string; subtitle: string; done: boolean; onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-colors hover:brightness-[0.99]"
    style={{
      background: "hsl(var(--background))",
      border: "1px solid rgba(160, 120, 70, 0.08)",
    }}
  >
    <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
      {icon}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block font-heading text-[15px] leading-tight truncate" style={{ color: "hsl(var(--foreground))" }}>{title}</span>
      <span className="block text-[11px] italic mt-0.5 truncate" style={{ color: "hsl(var(--subtitle))" }}>{subtitle}</span>
    </span>
    <CompletionCircle done={done} />
  </button>
);

const NavBtn = ({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 transition-colors"
    style={{ color: active ? "hsl(var(--sage))" : "#C0A880" }}
  >
    {icon}
    <span className="text-[10px] font-body font-medium" style={{ letterSpacing: "0.06em" }}>{label}</span>
  </button>
);

// ====== Page ======
const Home = () => {
  const [intake, setIntake] = useState<UserIntake | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [theme, setTheme] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [userFirstName, setUserFirstName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"home" | "month" | "journal" | "settings">("home");
  const [currentChapter, setCurrentChapter] = useState<ChapterFolder | null>(null);
  const [pastChapters, setPastChapters] = useState<ChapterFolder[]>([]);
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth?mode=login"); return; }

    setUserFirstName((user.user_metadata?.full_name || "").split(" ")[0] || "");

    const [med, seedData, currentIntake, prof] = await Promise.all([
      getLatestMeditation(user.id),
      getLatestSeeds(user.id),
      getCurrentIntake(user.id),
      getUserProfile(user.id),
    ]);

    setIntake(currentIntake);

    let displayTheme: any = null;
    if (currentIntake?.theme_id) {
      const { data: snap } = await sb.from("monthly_themes").select("*").eq("id", currentIntake.theme_id).maybeSingle();
      displayTheme = snap;
    }
    if (!displayTheme) displayTheme = await getActiveTheme();
    setTheme(displayTheme);
    setProfile(prof);

    const now = new Date();
    const cur: ChapterFolder = {
      key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      themeName: displayTheme?.theme || "Your Practice",
      hasMeditation: !!med && (med.meditation_segments?.length ?? 0) > 0,
      hasSeeds: !!seedData && [seedData.audio_url_1, seedData.audio_url_2, seedData.audio_url_3, seedData.audio_url_4, seedData.audio_url_5].some(Boolean),
    };
    setCurrentChapter(cur);

    const { data: history } = await sb
      .from("meditations")
      .select("month, theme_id, monthly_themes(theme)")
      .eq("user_id", user.id)
      .order("month", { ascending: false });

    const seen = new Set<string>();
    const past: ChapterFolder[] = [];
    (history || []).forEach((row: any) => {
      const d = new Date(row.month);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key === cur.key || seen.has(key)) return;
      seen.add(key);
      past.push({
        key,
        themeName: row.monthly_themes?.theme || "Practice",
        hasMeditation: true,
        hasSeeds: false,
      });
    });
    setPastChapters(past);

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          className="w-12 h-12 rounded-full bg-sage/30"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
    );
  }

  // Empty state
  if (currentChapter && !currentChapter.hasMeditation && !currentChapter.hasSeeds && pastChapters.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🧘</div>
        <h2 className="font-heading text-xl mb-2" style={{ color: "hsl(var(--foreground))" }}>Your library is waiting</h2>
        <p className="font-body text-sm mb-6" style={{ color: "hsl(var(--subtitle))" }}>
          Create your first personalized chapter
        </p>
        <button
          onClick={() => navigate("/onboarding")}
          className="px-8 py-4 rounded-2xl text-primary-foreground font-body font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: "hsl(var(--coral))" }}
        >
          Get Started
        </button>
      </div>
    );
  }

  const greeting = getGreeting();
  const displayName = userFirstName || "friend";

  return (
    <div className="min-h-screen bg-background flex flex-col pb-28">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <SpiralLogo />
        <button onClick={() => navigate("/settings")} aria-label="Menu" className="p-1">
          <Menu size={22} style={{ color: "hsl(var(--subtitle))" }} strokeWidth={1.6} />
        </button>
      </div>

      {/* Greeting */}
      <div className="px-[26px] pt-4 pb-6">
        <p
          className="italic mb-2 lowercase"
          style={{ fontSize: "12px", letterSpacing: "0.14em", color: "hsl(var(--sage))" }}
        >
          {greeting}
        </p>
        <h1
          className="font-heading leading-tight"
          style={{ fontSize: "36px", color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}
        >
          {displayName}<span style={{ color: "hsl(var(--coral))" }}>.</span>
        </h1>

        {currentChapter && (
          <div className="mt-4">
            <span
              className="inline-block italic"
              style={{
                background: "rgba(107, 158, 143, 0.12)",
                border: "1px solid rgba(107, 158, 143, 0.35)",
                color: "#4E8C7A",
                fontSize: "11px",
                padding: "5px 14px",
                borderRadius: "20px",
              }}
            >
              {currentChapter.themeName}
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-6 mb-6" style={{ height: "1px", background: "rgba(120, 90, 60, 0.12)" }} />

      {/* Current chapter folder */}
      {currentChapter && (
        <div className="mb-8">
          <SectionLabel>Current Chapter</SectionLabel>

          <div
            className="mx-4"
            style={{
              background: "hsl(var(--folder))",
              border: "1px solid rgba(160, 120, 70, 0.15)",
              borderRadius: "22px",
              padding: "20px 16px 16px",
            }}
          >
            <h2
              className="font-heading mb-4 px-1"
              style={{ fontSize: "20px", lineHeight: 1.3, color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}
            >
              {currentChapter.themeName}
            </h2>

            <div className="space-y-2">
              <PracticeItem
                icon={<SunGlyph />}
                iconBg="#F5E4C0"
                title="Morning Meditation"
                subtitle="Listen with headphones, eyes closed"
                done={false}
                onClick={() => navigate("/month?play=morning")}
              />
              <PracticeItem
                icon={<MoonGlyph />}
                iconBg="#DDD0EE"
                title="Evening Seeds"
                subtitle="Plant the seeds before sleep"
                done={false}
                onClick={() => navigate("/month?play=seeds")}
              />
              <PracticeItem
                icon={<JournalGlyph />}
                iconBg="#C8DED8"
                title="Journal"
                subtitle="A quiet place to reflect"
                done={false}
                onClick={() => setActiveTab("journal")}
              />
              <PracticeItem
                icon={<FaceGlyph />}
                iconBg="#F0D4C8"
                title="Daily Check-in"
                subtitle="A small moment of honesty"
                done={false}
                onClick={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* Previous chapters */}
      {pastChapters.length > 0 && (
        <div className="mb-8">
          <SectionLabel>Previous Chapters</SectionLabel>
          <div>
            {pastChapters.map((c) => {
              const open = openChapter === c.key;
              return (
                <div
                  key={c.key}
                  className="mx-4 mb-2"
                  style={{
                    background: "hsl(var(--folder-past))",
                    border: "1px solid rgba(160, 120, 70, 0.1)",
                    borderRadius: "16px",
                    opacity: 0.85,
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setOpenChapter(open ? null : c.key)}
                    className="w-full flex items-center gap-3 text-left"
                    style={{ padding: "14px 18px" }}
                  >
                    <span
                      className="flex-1 min-w-0 italic font-heading truncate"
                      style={{ fontSize: "15px", color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}
                    >
                      {c.themeName}
                    </span>
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: "hsl(var(--sage))" }}
                      aria-label="Completed chapter"
                    />
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
                        <div className="px-4 pb-4 space-y-2">
                          <PracticeItem
                            icon={<SunGlyph />}
                            iconBg="#F5E4C0"
                            title="Morning Meditation"
                            subtitle="Revisit this practice"
                            done
                            onClick={() => navigate(`/month?key=${c.key}`)}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0"
        style={{
          background: "hsl(var(--background))",
          borderTop: "1px solid rgba(160, 120, 70, 0.15)",
          paddingTop: "13px",
          paddingBottom: "22px",
        }}
      >
        <div className="flex justify-around max-w-sm mx-auto px-6">
          <NavBtn icon={<HomeIcon size={20} strokeWidth={1.6} />} label="Home" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
          <NavBtn icon={<CalendarDays size={20} strokeWidth={1.6} />} label="My Month" active={activeTab === "month"} onClick={() => navigate("/month")} />
          <NavBtn icon={<BookOpen size={20} strokeWidth={1.6} />} label="Journal" active={activeTab === "journal"} onClick={() => setActiveTab("journal")} />
          <NavBtn icon={<UserIcon size={20} strokeWidth={1.6} />} label="Settings" active={activeTab === "settings"} onClick={() => navigate("/settings")} />
        </div>
      </nav>
    </div>
  );
};

export default Home;
