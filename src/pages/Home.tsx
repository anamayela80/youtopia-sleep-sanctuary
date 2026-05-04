import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Settings as SettingsIcon, Check, Headphones, Flame, Clock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getLatestMeditation, getLatestSeeds, getActiveTheme, getUserProfile,
} from "@/services/meditationService";
import { getCurrentIntake, isIntakeExpired, getNextThemeForUser, type UserIntake } from "@/services/intakeService";
import { supabase as sb } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import ScienceStep from "@/components/onboarding/ScienceStep";
import BeforeYouBeginStep from "@/components/onboarding/BeforeYouBeginStep";

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

type CheckinRow = { checkin_date: string; mood_score: number };

// Mood dot colours — index 0 = score 1 (lowest) … index 4 = score 5 (highest)
// Matches the MOODS palette in MoodOrb.tsx
const MOOD_COLORS = ["#7A9BB5", "#9B8BBE", "#B89A6A", "#C4A030", "#C4604A"];

/** Build month-by-month mood dot grid from raw checkin rows. */
function buildMoodHistory(
  checkins: CheckinRow[],
  intakeStartDate: string | null,
): { label: string; monthKey: string; days: (number | null)[] }[] {
  const moodMap = new Map<string, number>();
  checkins.forEach((c) => moodMap.set(c.checkin_date, c.mood_score));

  const now = new Date();
  const start = intakeStartDate ? new Date(intakeStartDate) : now;
  const monthsDiff =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  const monthsToShow = Math.min(Math.max(monthsDiff + 1, 1), 12);

  const result: { label: string; monthKey: string; days: (number | null)[] }[] = [];
  for (let m = monthsToShow - 1; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const isCurrent = m === 0;
    const fillThrough = isCurrent ? now.getDate() : daysInMonth;
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

    const days: (number | null)[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      if (day > fillThrough) { days.push(null); continue; }
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push(moodMap.get(dateStr) ?? null);
    }
    result.push({
      label: d.toLocaleDateString(undefined, { month: "short" }),
      monthKey,
      days,
    });
  }
  return result;
}

/** Count consecutive days with a checkin going backwards from today. */
function calcStreak(checkins: CheckinRow[]): number {
  if (checkins.length === 0) return 0;
  const dateSet = new Set(checkins.map((c) => c.checkin_date));
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dateSet.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes === 0) return "0m";
  if (totalMinutes < 60) return `${totalMinutes}m`;
  return `${Math.round(totalMinutes / 60)}h`;
}

// ====== Custom icons ======
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

const StatTile = ({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) => (
  <div
    className="flex-1 rounded-2xl px-3 py-3 flex flex-col items-center text-center"
    style={{ background: "hsl(var(--folder))", border: "1px solid rgba(160, 120, 70, 0.12)" }}
  >
    <span className="mb-1.5" style={{ color: "hsl(var(--coral))" }}>{icon}</span>
    <span
      className="font-heading leading-none"
      style={{ fontSize: "20px", color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}
    >
      {value}
    </span>
    <span className="text-[10px] italic mt-1" style={{ color: "hsl(var(--subtitle))" }}>{label}</span>
  </div>
);

// ====== Page ======
const Home = () => {
  const [intake, setIntake] = useState<UserIntake | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [theme, setTheme] = useState<any>(null);
  const [nextTheme, setNextTheme] = useState<any>(null);
  const [needsNewChapter, setNeedsNewChapter] = useState(false);
  const [chapterNumber, setChapterNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [userFirstName, setUserFirstName] = useState<string>("");
  const [currentChapter, setCurrentChapter] = useState<ChapterFolder | null>(null);
  const [pastChapters, setPastChapters] = useState<ChapterFolder[]>([]);

  // Stats
  const [monthsCount, setMonthsCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);

  // Mood history
  const [moodHistory, setMoodHistory] = useState<{ label: string; monthKey: string; days: (number | null)[] }[]>([]);
  const [hasAnyMood, setHasAnyMood] = useState(false);

  // Mid-month check-in card state
  const [checkinPrompt, setCheckinPrompt] = useState<{
    questionNumber: 1 | 2;
    questionText: string;
    intakeId: string;
  } | null>(null);
  const [checkinAnswer, setCheckinAnswer] = useState("");
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinDismissedThisSession, setCheckinDismissedThisSession] = useState(false);
  const [infoOpen, setInfoOpen] = useState<null | "how" | "before">(null);

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

    // A new chapter is ready ONLY when the user's full 30-day window has passed
    // AND a different next theme exists for them. Otherwise, show Home as normal.
    const newChapterReady = currentIntake !== null && isIntakeExpired(currentIntake);
    if (newChapterReady) {
      const next = await getNextThemeForUser(user.id);
      const hasNewTheme = !!next && next.id !== currentIntake?.theme_id;
      if (hasNewTheme) {
        setNextTheme(next);
        setNeedsNewChapter(true);
        const { count: completedCount } = await sb
          .from("user_monthly_intakes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        setChapterNumber((completedCount ?? 0) + 1);
      }
    }

    if (!currentIntake) { navigate("/onboarding"); return; }

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

    // Past chapters from meditation history
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

    // ── Stats ──────────────────────────────────────────────────────────────
    // months = past completed + current (always at least 1 once onboarded)
    const totalMonths = past.length + 1;
    setMonthsCount(totalMonths);

    // All checkins for streak + mood history
    const { data: allCheckins } = await sb
      .from("checkins")
      .select("checkin_date, mood_score")
      .eq("user_id", user.id)
      .order("checkin_date", { ascending: false });

    const checkins: CheckinRow[] = (allCheckins || []).filter(
      (c: any) => c.checkin_date && typeof c.mood_score === "number",
    );

    setStreak(calcStreak(checkins));

    // Hours: count meditation records × ~20 min per session (rough estimate
    // until we have actual session-duration tracking)
    const { count: medCount } = await sb
      .from("meditations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    setTotalMinutes((medCount ?? 0) * 20);

    // ── Mood history ───────────────────────────────────────────────────────
    const history2 = buildMoodHistory(checkins, currentIntake?.intake_start_date ?? null);
    setMoodHistory(history2);
    setHasAnyMood(checkins.length > 0);

    // ── Mid-month check-in trigger ─────────────────────────────────────────
    if (currentIntake?.id) {
      const { count: doneCount } = await sb
        .from("checkins")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("checkin_date", currentIntake.intake_start_date);

      let triggerNumber: 1 | 2 | null = null;
      if ((doneCount ?? 0) >= 22) triggerNumber = 2;
      else if ((doneCount ?? 0) >= 10) triggerNumber = 1;

      if (triggerNumber) {
        const { data: state } = await sb
          .from("intake_checkin_state")
          .select("*")
          .eq("user_id", user.id)
          .eq("intake_id", currentIntake.id)
          .eq("question_number", triggerNumber)
          .maybeSingle();

        const alreadyDone = state?.answered_at || state?.dismissed_permanently;
        if (!alreadyDone) {
          const { data: appSet } = await sb.from("app_settings").select("checkin_question_1, checkin_question_2").maybeSingle();
          const themeQ1 = displayTheme?.checkin_question;
          const themeQ2 = displayTheme?.checkin_question_2;
          const text = triggerNumber === 1
            ? (themeQ1 || appSet?.checkin_question_1 || "What is shifting inside you right now?")
            : (themeQ2 || appSet?.checkin_question_2 || "What is shifting inside you right now?");
          setCheckinPrompt({ questionNumber: triggerNumber, questionText: text, intakeId: currentIntake.id });
        }
      }
    }

    setLoading(false);
  };

  const dismissCheckin = async () => {
    if (!checkinPrompt) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (checkinDismissedThisSession) {
      await sb.from("intake_checkin_state").upsert(
        { user_id: user.id, intake_id: checkinPrompt.intakeId, question_number: checkinPrompt.questionNumber, dismissed_permanently: true },
        { onConflict: "user_id,intake_id,question_number" },
      );
      setCheckinPrompt(null);
    } else {
      await sb.from("intake_checkin_state").upsert(
        { user_id: user.id, intake_id: checkinPrompt.intakeId, question_number: checkinPrompt.questionNumber },
        { onConflict: "user_id,intake_id,question_number" },
      );
      setCheckinDismissedThisSession(true);
      setCheckinPrompt(null);
    }
  };

  const submitCheckin = async () => {
    if (!checkinPrompt || !checkinAnswer.trim()) return;
    setCheckinSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("regenerate-seed-5", {
        body: {
          question: checkinPrompt.questionText,
          answer: checkinAnswer.trim(),
          questionNumber: checkinPrompt.questionNumber,
          intakeId: checkinPrompt.intakeId,
        },
      });
      if (error) console.error("regenerate-seed-5 error:", error);
      setCheckinPrompt(null);
      setCheckinAnswer("");
    } catch (e) {
      console.error(e);
    } finally {
      setCheckinSubmitting(false);
    }
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

  // Note: a user without an intake is routed to /onboarding by Index.tsx,
  // so we never need to render an empty-state here.

  const greeting = getGreeting();
  const displayName = userFirstName || "friend";

  return (
    <div className="min-h-screen bg-background flex flex-col pb-28">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <SpiralLogo />
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/settings")} aria-label="Settings" className="p-1.5">
            <SettingsIcon size={20} style={{ color: "hsl(var(--subtitle))" }} strokeWidth={1.6} />
          </button>
        </div>
      </div>

      {/* Greeting */}
      <div className="px-[26px] pt-4 pb-6">
        <p className="italic mb-2 lowercase" style={{ fontSize: "12px", letterSpacing: "0.14em", color: "hsl(var(--sage))" }}>
          {greeting}
        </p>
        <h1 className="font-heading leading-tight" style={{ fontSize: "36px", color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}>
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

      {/* ── New Chapter card (shown only when current intake is expired) ──── */}
      {needsNewChapter && nextTheme && (
        <div className="mb-7 mx-4">
          <div
            className="rounded-2xl p-5"
            style={{
              background: "hsl(var(--folder))",
              border: "1px solid rgba(107, 158, 143, 0.35)",
            }}
          >
            <p
              className="uppercase mb-2"
              style={{ fontSize: "10px", letterSpacing: "0.22em", color: "#4E8C7A", fontFamily: "Georgia, serif" }}
            >
              Chapter {chapterNumber} is ready
            </p>
            <h2
              className="font-heading mb-2"
              style={{ fontSize: "22px", lineHeight: 1.25, color: "hsl(var(--foreground))", fontFamily: "Georgia, serif" }}
            >
              {nextTheme.theme}
            </h2>
            {(nextTheme.intention || nextTheme.description) && (
              <p
                className="italic mb-4"
                style={{ fontSize: "14px", lineHeight: 1.55, color: "hsl(var(--subtitle))", fontFamily: "Georgia, serif" }}
              >
                {nextTheme.intention || nextTheme.description}
              </p>
            )}
            <button
              onClick={() => navigate("/onboarding?mode=new-month")}
              className="w-full py-3 rounded-2xl font-body font-semibold text-[14px] transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "hsl(var(--coral))", color: "white" }}
            >
              Set my intention
            </button>
          </div>
        </div>
      )}

      {/* ── Your Journey stats ────────────────────────────────────────────── */}
      <div className="mb-7">
        <SectionLabel>Your Journey</SectionLabel>
        <div className="px-4 flex gap-2">
          <StatTile icon={<Headphones size={16} />} value={String(monthsCount)} label="months" />
          <StatTile icon={<Flame size={16} />} value={String(streak)} label="day streak" />
          <StatTile icon={<Clock size={16} />} value={formatMinutes(totalMinutes)} label="practiced" />
        </div>
      </div>

      {/* ── Mood Over Time ────────────────────────────────────────────────── */}
      <div className="mb-7">
        <SectionLabel>Mood Over Time</SectionLabel>
        <div
          className="mx-4 rounded-2xl px-4 py-4"
          style={{ background: "hsl(var(--folder))", border: "1px solid rgba(160, 120, 70, 0.12)" }}
        >
          {hasAnyMood ? (
            <>
              <div className="space-y-2">
                {moodHistory.map((row) => (
                  <div key={row.monthKey} className="flex items-center gap-2">
                    <span
                      className="text-[10px] uppercase italic w-8 flex-shrink-0"
                      style={{ letterSpacing: "0.12em", color: "hsl(var(--subtitle))", fontFamily: "Georgia, serif" }}
                    >
                      {row.label}
                    </span>
                    <div className="flex flex-wrap gap-[3px] flex-1">
                      {row.days.map((score, i) => (
                        <div
                          key={i}
                          className="rounded-full"
                          style={{
                            width: "8px",
                            height: "8px",
                            background: score !== null ? MOOD_COLORS[score - 1] : "transparent",
                            border: score === null ? "1px solid rgba(160, 120, 70, 0.18)" : "none",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {/* Legend */}
              <div
                className="flex items-center justify-center gap-1.5 mt-4 pt-3"
                style={{ borderTop: "1px solid rgba(160, 120, 70, 0.12)" }}
              >
                <span className="text-[9px] italic mr-1" style={{ color: "hsl(var(--subtitle))" }}>low</span>
                {MOOD_COLORS.map((c, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                ))}
                <span className="text-[9px] italic ml-1" style={{ color: "hsl(var(--subtitle))" }}>high</span>
              </div>
            </>
          ) : (
            <p
              className="text-center italic py-4"
              style={{ fontSize: "12px", color: "hsl(var(--subtitle))", fontFamily: "Georgia, serif" }}
            >
              Your mood map will grow here as you check in daily.
            </p>
          )}
        </div>
      </div>

      {/* ── Current chapter ───────────────────────────────────────────────── */}
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
                title="Morning & Evening Practice"
                subtitle="Your meditation and seeds for this month"
                done={false}
                onClick={() => navigate("/month")}
              />
              <PracticeItem
                icon={<JournalGlyph />}
                iconBg="#C8DED8"
                title="Reflect"
                subtitle="your daily moment of honesty"
                done={false}
                onClick={() => navigate("/reflect")}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Mid-month check-in ────────────────────────────────────────────── */}
      {checkinPrompt && (
        <div
          className="mb-8 mx-4"
          style={{
            background: "#DDD0EE",
            borderRadius: "18px",
            padding: "18px",
            border: "1px solid rgba(155, 123, 212, 0.2)",
          }}
        >
          <p
            className="uppercase mb-3"
            style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#9B7BD4", fontFamily: "Georgia, serif" }}
          >
            a question for you
          </p>
          <p
            className="italic mb-4"
            style={{ fontSize: "17px", color: "#3D2E1E", fontFamily: "Georgia, serif", lineHeight: 1.5 }}
          >
            {checkinPrompt.questionText}
          </p>
          <textarea
            value={checkinAnswer}
            onChange={(e) => setCheckinAnswer(e.target.value)}
            placeholder="take your time..."
            rows={3}
            className="w-full bg-transparent outline-none resize-none italic mb-3"
            style={{
              fontSize: "14px",
              color: "#3D2E1E",
              fontFamily: "Georgia, serif",
              borderBottom: "1px solid rgba(155, 123, 212, 0.2)",
              padding: "6px 2px",
              lineHeight: 1.6,
            }}
          />
          <div className="flex justify-end mb-2">
            <button
              onClick={submitCheckin}
              disabled={!checkinAnswer.trim() || checkinSubmitting}
              className="lowercase transition-opacity"
              style={{
                fontSize: "13px",
                color: "#9B7BD4",
                fontFamily: "Georgia, serif",
                opacity: !checkinAnswer.trim() || checkinSubmitting ? 0.4 : 1,
                padding: "6px 14px",
              }}
            >
              {checkinSubmitting ? "sharing..." : "share"}
            </button>
          </div>
          <div className="flex justify-center">
            <button
              onClick={dismissCheckin}
              className="lowercase"
              style={{ fontSize: "11px", color: "#C8B090", fontFamily: "Georgia, serif" }}
            >
              maybe later
            </button>
          </div>
        </div>
      )}

      {/* ── Previous chapters ─────────────────────────────────────────────── */}
      {pastChapters.length > 0 && (
        <div className="mb-8">
          <SectionLabel>Previous Chapters</SectionLabel>
          <div>
            {pastChapters.map((c) => {
              const open = openChapter === c.key;
              // Derive a human-readable month label from the key (YYYY-MM)
              const [y, m] = c.key.split("-").map(Number);
              const monthLabel = new Date(y, m - 1, 1).toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              });
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
                      className="text-[10px] italic mr-2 flex-shrink-0"
                      style={{ color: "hsl(var(--subtitle))" }}
                    >
                      {monthLabel}
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
                          <PracticeItem
                            icon={<MoonGlyph />}
                            iconBg="#DDD0EE"
                            title="Evening Seeds"
                            subtitle="Revisit this practice"
                            done
                            onClick={() => navigate(`/month?key=${c.key}&play=seeds`)}
                          />
                          <PracticeItem
                            icon={<JournalGlyph />}
                            iconBg="#C8DED8"
                            title="Reflect"
                            subtitle="Reread your journal entries"
                            done
                            onClick={() => navigate("/reflect")}
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

      {/* Footer links */}
      <div className="mt-10 px-6 flex items-center justify-center">
        <button
          type="button"
          onClick={() => setInfoOpen("how")}
          className="font-body text-xs italic underline-offset-4 hover:underline inline-flex items-center gap-1.5"
          style={{ color: "hsl(var(--subtitle))" }}
        >
          <Sparkles size={13} strokeWidth={1.6} />
          How this works
        </button>
      </div>

      <Dialog open={infoOpen !== null} onOpenChange={(o) => !o && setInfoOpen(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-background">
          <DialogTitle className="sr-only">
            {infoOpen === "how" ? "How this works" : "Before you begin"}
          </DialogTitle>
          {infoOpen === "how" && <ScienceStep />}
          {infoOpen === "before" && <BeforeYouBeginStep />}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Home;
