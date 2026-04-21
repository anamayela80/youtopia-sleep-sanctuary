import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings as SettingsIcon, Shield, Sun, Moon, BookOpen, MessageCircle,
  ChevronRight, Home as HomeIcon, CalendarDays, User as UserIcon, FolderOpen, Folder,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getLatestMeditation, getLatestSeeds, getActiveTheme, getUserProfile,
} from "@/services/meditationService";
import { getCurrentIntake, type UserIntake } from "@/services/intakeService";
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

const StatusDot = ({ done }: { done: boolean }) => (
  <span
    className={`inline-block w-3 h-3 rounded-full border ${
      done ? "bg-sage border-sage" : "bg-transparent border-border"
    }`}
    aria-label={done ? "Completed" : "Not yet"}
  />
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] uppercase tracking-[0.22em] font-body text-sage mb-3 px-1">
    {children}
  </p>
);

type MonthFolder = {
  key: string;          // e.g. "2026-04"
  monthLabel: string;   // "April"
  yearLabel: string;    // "2026"
  themeName: string;
  hasMeditation: boolean;
  hasSeeds: boolean;
};

const Home = () => {
  const [theme, setTheme] = useState<any>(null);
  const [intake, setIntake] = useState<UserIntake | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [userFirstName, setUserFirstName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"home" | "month" | "journal" | "settings">("home");
  const [currentMonth, setCurrentMonth] = useState<MonthFolder | null>(null);
  const [pastMonths, setPastMonths] = useState<MonthFolder[]>([]);
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth?mode=login"); return; }

    setUserFirstName((user.user_metadata?.full_name || "").split(" ")[0] || "");

    const [med, seedData, currentIntake, roleRes, prof] = await Promise.all([
      getLatestMeditation(user.id),
      getLatestSeeds(user.id),
      getCurrentIntake(user.id),
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle(),
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
    setIsAdmin(!!roleRes.data);
    setProfile(prof);

    // Build the current month folder
    const now = new Date();
    const cur: MonthFolder = {
      key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      monthLabel: now.toLocaleString("default", { month: "long" }),
      yearLabel: String(now.getFullYear()),
      themeName: displayTheme?.theme || "Your Practice",
      hasMeditation: !!med && (med.meditation_segments?.length ?? 0) > 0,
      hasSeeds: !!seedData && [seedData.audio_url_1, seedData.audio_url_2, seedData.audio_url_3, seedData.audio_url_4, seedData.audio_url_5].some(Boolean),
    };
    setCurrentMonth(cur);

    // Pull past meditations for this user, group into month folders (excluding the current month)
    const { data: history } = await sb
      .from("meditations")
      .select("month, theme_id, monthly_themes(theme)")
      .eq("user_id", user.id)
      .order("month", { ascending: false });

    const seen = new Set<string>();
    const past: MonthFolder[] = [];
    (history || []).forEach((row: any) => {
      const d = new Date(row.month);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key === cur.key || seen.has(key)) return;
      seen.add(key);
      past.push({
        key,
        monthLabel: d.toLocaleString("default", { month: "long" }),
        yearLabel: String(d.getFullYear()),
        themeName: row.monthly_themes?.theme || "Practice",
        hasMeditation: true,
        hasSeeds: false,
      });
    });
    setPastMonths(past);

    setLoading(false);
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

  // Empty state — no meditation yet
  if (currentMonth && !currentMonth.hasMeditation && !currentMonth.hasSeeds && pastMonths.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🧘</div>
        <h2 className="font-heading text-xl text-accent mb-2">Your library is waiting</h2>
        <p className="font-body text-sm text-muted-foreground mb-6">
          Create your first personalized monthly practice
        </p>
        <button
          onClick={() => navigate("/onboarding")}
          className="px-8 py-4 rounded-2xl bg-coral-dark text-primary-foreground font-body font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Get Started
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* Header with watermark logo */}
      <div className="relative px-6 pt-10 pb-8 overflow-hidden">
        <img
          src={logo}
          alt=""
          aria-hidden
          className="absolute -right-10 -top-8 w-60 opacity-[0.07] pointer-events-none select-none"
        />
        <div className="flex items-start justify-between relative">
          <div className="flex-1">
            <h1 className="font-heading text-3xl md:text-4xl text-coral-dark leading-tight">
              {getGreeting(userFirstName)}
            </h1>
            <p className="mt-3 text-[11px] uppercase tracking-[0.22em] font-body text-sage">
              Your library of practices
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

      {/* Current Month — open folder */}
      {currentMonth && (
        <div className="px-6 mb-8">
          <SectionLabel>This Month</SectionLabel>

          <div className="bg-card rounded-3xl p-5 shadow-[0_2px_12px_-6px_hsl(var(--accent)/0.22)]">
            {/* Folder header */}
            <button
              onClick={() => navigate("/month")}
              className="w-full flex items-center gap-3 text-left mb-1 group"
            >
              <FolderOpen size={20} className="text-coral-dark flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h2 className="font-heading text-2xl text-accent leading-tight truncate">
                  {currentMonth.monthLabel}
                </h2>
                <p className="font-body text-[11px] uppercase tracking-[0.22em] text-sage mt-0.5 truncate">
                  {currentMonth.themeName}
                </p>
              </div>
              <ChevronRight size={18} className="text-sage opacity-60 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* Folder items */}
            <div className="mt-4 space-y-2">
              {currentMonth.hasMeditation && (
                <FolderItem
                  icon={<Sun size={16} className="text-coral-dark" />}
                  title="Morning Meditation"
                  subtitle="Listen with headphones, eyes closed"
                  done={false}
                  onClick={() => navigate("/month?play=morning")}
                />
              )}
              {currentMonth.hasSeeds && (
                <FolderItem
                  icon={<Moon size={16} className="text-coral-dark" />}
                  title="Evening Seeds"
                  subtitle="Plant the seeds before sleep"
                  done={false}
                  onClick={() => navigate("/month?play=seeds")}
                />
              )}
              <FolderItem
                icon={<BookOpen size={16} className="text-coral-dark" />}
                title="Journal"
                subtitle="A quiet place to reflect"
                done={false}
                onClick={() => setActiveTab("journal")}
              />
              <FolderItem
                icon={<MessageCircle size={16} className="text-coral-dark" />}
                title="Daily Check-in"
                subtitle="A small moment of honesty"
                done={false}
                onClick={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* Previous months — closed folders */}
      {pastMonths.length > 0 && (
        <div className="px-6 mb-8">
          <SectionLabel>Previous Months</SectionLabel>
          <div className="space-y-2.5">
            {pastMonths.map((m) => {
              const open = openMonth === m.key;
              return (
                <div key={m.key} className="bg-card rounded-2xl shadow-[0_2px_10px_-6px_hsl(var(--accent)/0.2)] overflow-hidden">
                  <button
                    onClick={() => setOpenMonth(open ? null : m.key)}
                    className="w-full px-5 py-4 flex items-center gap-3 text-left"
                  >
                    {open ? (
                      <FolderOpen size={18} className="text-sage flex-shrink-0" />
                    ) : (
                      <Folder size={18} className="text-sage flex-shrink-0" />
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block font-heading text-base text-accent truncate">
                        {m.monthLabel} <span className="text-accent/50 font-body text-sm">· {m.yearLabel}</span>
                      </span>
                      <span className="block font-body text-[11px] uppercase tracking-[0.22em] text-sage mt-0.5 truncate">
                        {m.themeName}
                      </span>
                    </span>
                    <ChevronRight
                      size={16}
                      className={`text-sage flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
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
                        <div className="px-5 pb-5 space-y-2">
                          <FolderItem
                            icon={<Sun size={16} className="text-coral-dark" />}
                            title="Morning Meditation"
                            subtitle="Revisit this practice"
                            done
                            onClick={() => navigate(`/month?key=${m.key}`)}
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

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/85 backdrop-blur-lg px-6 py-3 border-t border-border/40">
        <div className="flex justify-around max-w-sm mx-auto">
          <NavBtn icon={<HomeIcon size={20} />} label="Home" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
          <NavBtn icon={<CalendarDays size={20} />} label="My Month" active={activeTab === "month"} onClick={() => navigate("/month")} />
          <NavBtn icon={<BookOpen size={20} />} label="Journal" active={activeTab === "journal"} onClick={() => setActiveTab("journal")} />
          <NavBtn icon={<UserIcon size={20} />} label="Settings" active={activeTab === "settings"} onClick={() => navigate("/settings")} />
        </div>
      </nav>
    </div>
  );
};

const FolderItem = ({
  icon, title, subtitle, done, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  done: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full text-left bg-cream rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:bg-cream/70 transition-colors"
  >
    <span className="w-9 h-9 rounded-full bg-card flex items-center justify-center flex-shrink-0">
      {icon}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block font-heading text-base text-accent leading-tight truncate">{title}</span>
      <span className="block font-body text-xs text-accent/60 mt-0.5 truncate">{subtitle}</span>
    </span>
    <StatusDot done={done} />
    <ChevronRight size={16} className="text-sage/60 flex-shrink-0" />
  </button>
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
